import { validateRequest, corsHeadersFor, getSupabasePublicConfig } from './_security.js';

// ============================================================================
// POST /api/cleanup-recurring-duplicates
// ============================================================================
// One-off maintenance endpoint that removes duplicate recurring installments
// (e.g. a loan installment appearing multiple times in the same month) that
// were created by a cloud-sync race condition.
//
// SAFETY / DATA-INTEGRITY:
//   * Operates ONLY on transactions that carry a recurring_template_id (rows
//     created by the recurring generator). Legitimate identical MANUAL
//     transactions (recurring_template_id = NULL) are NEVER touched.
//   * A "true duplicate" = same recurring_template_id + same date + same amount
//     + status='active'. For each group we KEEP the single oldest row (lowest
//     created_at, then lowest id) and soft-delete the rest.
//   * Soft-delete (status='deleted', deleted_at, deleted_by) matches the app's
//     trash/restore flow, so nothing is permanently destroyed.
//
// AUTH: Requires a valid Supabase session token (Bearer). The service-role key
// (env.SUPABASE_SERVICE_ROLE_KEY) is used server-side to bypass RLS so the
// cleanup can run across the user's rows regardless of RLS policy shape.
// ============================================================================

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

    // JWT Token Verification Check
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Missing session token. Please log in.' }), {
            status: 401,
            headers: corsHeaders
        });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabasePublicConfig(env);
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabase || !serviceRoleKey) {
        return new Response(JSON.stringify({ error: 'Server configuration error: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY not configured.' }), {
            status: 500,
            headers: corsHeaders
        });
    }
    const { supabaseUrl, supabaseKey } = supabase;

    // Optional dry-run flag: { "dryRun": true } only reports, does not modify.
    let dryRun = false;
    try {
        const body = await request.json();
        dryRun = !!(body && body.dryRun);
    } catch (_) {
        // No/invalid body -> treat as apply (dryRun=false)
    }

    try {
        // 1. Authenticate access token with Supabase Auth API
        const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${token}`
            }
        });

        if (!userRes.ok) {
            const errText = await userRes.text();
            return new Response(JSON.stringify({ error: `Unauthorized: Invalid session token. Details: ${errText}` }), {
                status: 401,
                headers: corsHeaders
            });
        }

        const userData = await userRes.json();
        const userId = userData.id;
        if (!userId) {
            return new Response(JSON.stringify({ error: 'Unauthorized: User ID not found in session.' }), {
                status: 401,
                headers: corsHeaders
            });
        }

        // 2. Fetch ALL active transactions that carry a recurring_template_id for
        //    this user (service-role key bypasses RLS). Paginate in case >1000 rows.
        const headers = {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`
        };

        let allTx = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
            // PostgREST accepts a single `order` param; multiple comma-separated
            // columns are supported within it. Using two separate `order` params
            // would only honor the last one, silently dropping the created_at sort
            // and breaking the "keep oldest by created_at" dedup logic.
            const url = `${supabaseUrl}/rest/v1/transactions?select=id,recurring_template_id,date,amount,user_id,created_at,status&recurring_template_id=not.is.null&status=eq.active&order=created_at.asc,id.asc&range=${page * pageSize}-${(page + 1) * pageSize - 1}`;
            const res = await fetch(url, { headers });
            if (!res.ok) {
                const errText = await res.text();
                return new Response(JSON.stringify({ error: `Failed to fetch transactions: ${res.status} ${errText}` }), {
                    status: 500,
                    headers: corsHeaders
                });
            }
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                hasMore = false;
            } else {
                allTx = allTx.concat(data);
                if (data.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            }
        }

        // 3. Group by (recurring_template_id, date, amount) and find duplicates.
        const groups = new Map();
        for (const t of allTx) {
            const key = `${t.recurring_template_id}|${String(t.date || '').split('T')[0]}|${(parseFloat(t.amount) || 0).toFixed(2)}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(t);
        }

        const duplicateIds = [];
        const keptIds = [];
        for (const [key, rows] of groups.entries()) {
            if (rows.length > 1) {
                // Keep the oldest (already sorted by created_at, id ascending).
                const [keep, ...dups] = rows;
                keptIds.push(keep.id);
                for (const d of dups) duplicateIds.push(d.id);
            }
        }

        const report = {
            dryRun,
            userId,
            scanned: allTx.length,
            duplicateGroups: groups.size > 0 ? [...groups.values()].filter(g => g.length > 1).length : 0,
            toDelete: duplicateIds.length,
            kept: keptIds.length,
            duplicateIds
        };

        // 4. Apply soft-delete unless dry-run.
        if (!dryRun && duplicateIds.length > 0) {
            // Delete in batches of 100 (URL length / PostgREST limits).
            for (let i = 0; i < duplicateIds.length; i += 100) {
                const batch = duplicateIds.slice(i, i + 100);
                const idFilter = batch.map(id => `id=eq.${id}`).join(',');
                const delRes = await fetch(`${supabaseUrl}/rest/v1/transactions?${idFilter}`, {
                    method: 'PATCH',
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({
                        status: 'deleted',
                        deleted_at: new Date().toISOString(),
                        deleted_by: userId
                    })
                });
                if (!delRes.ok) {
                    const errText = await delRes.text();
                    return new Response(JSON.stringify({ error: `Failed to soft-delete batch: ${delRes.status} ${errText}` }), {
                        status: 500,
                        headers: corsHeaders
                    });
                }
            }
            report.deleted = duplicateIds.length;
        } else {
            report.deleted = 0;
        }

        return new Response(JSON.stringify(report), {
            status: 200,
            headers: corsHeaders
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: `Server error during cleanup: ${err.message}` }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
