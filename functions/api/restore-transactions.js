import { validateRequest, corsHeadersFor, getSupabasePublicConfig } from './_security.js';

export async function onRequestOptions(context) {
    const { request } = context;
    const corsHeaders = corsHeadersFor(request, {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    });
    if (!corsHeaders) {
        return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
    const { request, env } = context;

    const sec = validateRequest(request);
    if (!sec.ok) {
        return new Response(sec.body, { status: sec.status, headers: sec.headers });
    }
    const corsHeaders = sec.headers;

    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Missing session token.' }), {
            status: 401,
            headers: corsHeaders
        });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabasePublicConfig(env);
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabase || !serviceRoleKey) {
        return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
            status: 500,
            headers: corsHeaders
        });
    }
    const { supabaseUrl, supabaseKey } = supabase;

    try {
        // 1. Authenticate user
        const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${token}`
            }
        });

        if (!userRes.ok) {
            const errText = await userRes.text();
            return new Response(JSON.stringify({ error: `Unauthorized: ${errText}` }), {
                status: 401,
                headers: corsHeaders
            });
        }

        const userData = await userRes.json();
        const userId = userData.id;
        if (!userId) {
            return new Response(JSON.stringify({ error: 'User ID not found.' }), {
                status: 401,
                headers: corsHeaders
            });
        }

        // 2. Fetch user profile to get family_id and partner_id
        //    TABLE NAME: "profiles" (not "user_profiles")
        const serviceHeaders = {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };

        let familyId = null;
        let partnerId = null;
        try {
            const profRes = await fetch(`${supabaseUrl}/rest/v1/profiles?select=family_id,partner_id&id=eq.${userId}`, {
                headers: serviceHeaders
            });
            if (profRes.ok) {
                const profData = await profRes.json();
                if (Array.isArray(profData) && profData.length > 0) {
                    familyId = profData[0].family_id;
                    partnerId = profData[0].partner_id;
                }
            }
        } catch (_) { }

        // 3. Query all soft-deleted transactions for this user, partner, or family
        //    Using service role key to bypass RLS.
        let txUrl = `${supabaseUrl}/rest/v1/transactions?select=*&status=eq.deleted&limit=5000`;
        if (familyId && partnerId) {
            txUrl += `&or=(user_id.eq.${userId},user_id.eq.${partnerId},family_id.eq.${familyId})`;
        } else if (familyId) {
            txUrl += `&or=(user_id.eq.${userId},family_id.eq.${familyId})`;
        } else if (partnerId) {
            txUrl += `&or=(user_id.eq.${userId},user_id.eq.${partnerId})`;
        } else {
            txUrl += `&user_id=eq.${userId}`;
        }

        const txRes = await fetch(txUrl, { headers: serviceHeaders });
        if (!txRes.ok) {
            const errText = await txRes.text();
            return new Response(JSON.stringify({ error: `Failed to fetch deleted transactions: ${errText}` }), {
                status: 500,
                headers: corsHeaders
            });
        }

        const deletedRows = await txRes.json();
        if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                restoredCount: 0,
                restoredRows: [],
                debug: { userId, familyId, partnerId, deletedCount: 0, txUrl }
            }), {
                status: 200,
                headers: corsHeaders
            });
        }

        // 4. Filter manual non-recurring transactions
        const manualRows = deletedRows.filter(r => {
            if (!r || !r.id) return false;
            if (r.recurring_template_id) return false;
            if (String(r.id).startsWith('recurring_')) return false;
            return true;
        });

        if (manualRows.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                restoredCount: 0,
                restoredRows: [],
                debug: { userId, familyId, partnerId, deletedCount: deletedRows.length, manualCount: 0 }
            }), {
                status: 200,
                headers: corsHeaders
            });
        }

        const idsToRestore = manualRows.map(r => r.id);

        // 5. Update status back to 'active' using serviceRoleKey (bypasses RLS)
        const updateUrl = `${supabaseUrl}/rest/v1/transactions?id=in.(${idsToRestore.join(',')})`;
        const patchRes = await fetch(updateUrl, {
            method: 'PATCH',
            headers: serviceHeaders,
            body: JSON.stringify({
                status: 'active',
                deleted_at: null,
                deleted_by: null,
                updated_at: new Date().toISOString()
            })
        });

        if (!patchRes.ok) {
            const errText = await patchRes.text();
            return new Response(JSON.stringify({ error: `Failed to update transactions: ${errText}` }), {
                status: 500,
                headers: corsHeaders
            });
        }

        // 6. Clean up tombstones (correct table name: sync_tombstones)
        try {
            const tombUrl = `${supabaseUrl}/rest/v1/sync_tombstones?row_id=in.(${idsToRestore.join(',')})`;
            await fetch(tombUrl, {
                method: 'DELETE',
                headers: serviceHeaders
            });
        } catch (_) { }

        const restoredRows = manualRows.map(r => ({
            ...r,
            status: 'active',
            deleted_at: null,
            deleted_by: null
        }));

        return new Response(JSON.stringify({
            success: true,
            restoredCount: restoredRows.length,
            restoredRows,
            debug: { userId, familyId, partnerId, deletedCount: deletedRows.length, restoredIds: idsToRestore }
        }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: `Server error: ${err.message || err}` }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
