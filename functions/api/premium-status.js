import { validateRequest, corsHeadersFor, getSupabasePublicConfig } from './_security.js';

// Premium status / reconciliation endpoint (web / PWA).
//
// Defense-in-depth for the case where the Stripe webhook is permanently lost
// (misconfigured, endpoint down >3 days, etc.). The user pays on Stripe but the
// entitlement is never granted because the webhook never fires.
//
// This endpoint:
//   1. Authenticates the caller via JWT (Bearer token -> /auth/v1/user).
//   2. Queries Stripe for the authenticated user's successful Checkout Sessions
//      (by client_reference_id = user id). The session target is bound to the
//      authenticated user, so a user can only reconcile THEIR OWN purchase.
//   3. If a paid session exists but the profile is not marked premium, it grants
//      the entitlement using the service role key (same as the webhook).
//   4. Returns the current premium status.
//
// It is idempotent: re-calling it with an already-granted profile is a no-op.
// There is NO way to activate premium without a real, paid Stripe session.
//
// Uses Stripe's REST API directly via fetch (no SDK dependency), consistent
// with functions/api/purchase.js and functions/api/webhook.js.

export async function onRequestOptions(context) {
    const { request } = context;
    const corsHeaders = corsHeadersFor(request, {
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    });
    if (!corsHeaders) {
        return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
    const { request, env } = context;

    // Shared security: CORS origin check, rate limiting.
    const sec = validateRequest(request);
    if (!sec.ok) {
        return new Response(sec.body, { status: sec.status, headers: sec.headers });
    }
    const corsHeaders = sec.headers;

    // Stripe secret key is required for reconciliation.
    const stripeSecretKey = env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
        return new Response(JSON.stringify({ error: 'Server configuration error: STRIPE_SECRET_KEY not configured.' }), {
            status: 500,
            headers: corsHeaders
        });
    }

    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        return new Response(JSON.stringify({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY not configured.' }), {
            status: 500,
            headers: corsHeaders
        });
    }

    const supabase = getSupabasePublicConfig(env);
    if (!supabase) {
        return new Response(JSON.stringify({ error: 'Server configuration error: SUPABASE_URL / SUPABASE_ANON_KEY not configured.' }), {
            status: 500,
            headers: corsHeaders
        });
    }
    const { supabaseUrl, supabaseKey } = supabase;

    // Authenticate the user via JWT.
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Missing session token. Please log in.' }), {
            status: 401,
            headers: corsHeaders
        });
    }
    const token = authHeader.substring(7);

    let userId;
    try {
        const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${token}`
            }
        });
        if (!userRes.ok) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid session token.' }), {
                status: 401,
                headers: corsHeaders
            });
        }
        const userData = await userRes.json();
        userId = userData.id;
        if (!userId) {
            return new Response(JSON.stringify({ error: 'Unauthorized: User ID not found.' }), {
                status: 401,
                headers: corsHeaders
            });
        }
    } catch (err) {
        console.warn('Premium-status auth error:', err.message);
        return new Response(JSON.stringify({ error: 'Unauthorized: could not verify session.' }), {
            status: 401,
            headers: corsHeaders
        });
    }

    // Read the current profile (premium status) using the service role so we
    // always see the authoritative value regardless of RLS.
    let currentPremium = false;
    let currentPurchasedAt = null;
    try {
        const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=premium_active,premium_purchased_at`, {
            method: 'GET',
            headers: {
                'apikey': serviceRoleKey,
                'Authorization': `Bearer ${serviceRoleKey}`
            }
        });
        if (profileRes.ok) {
            const rows = await profileRes.json();
            if (Array.isArray(rows) && rows.length > 0) {
                currentPremium = !!rows[0].premium_active;
                currentPurchasedAt = rows[0].premium_purchased_at || null;
            }
        }
    } catch (err) {
        console.warn('Premium-status: failed to read profile:', err.message);
    }

    // If already premium, no reconciliation needed — return status immediately.
    if (currentPremium) {
        return new Response(JSON.stringify({
            premium_active: true,
            premium_purchased_at: currentPurchasedAt,
            reconciled: false
        }), { status: 200, headers: corsHeaders });
    }

    // Query Stripe for this user's successful Checkout Sessions. The session
    // target is bound to the authenticated user via client_reference_id, so a
    // user can only ever reconcile their own purchase.
    let paidSession = null;
    try {
        const params = new URLSearchParams({
            'client_reference_id': userId,
            'status': 'complete',
            'limit': '100'
        });
        const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${stripeSecretKey}`
            }
        });
        if (stripeRes.ok) {
            const data = await stripeRes.json();
            const sessions = (data && data.data) || [];
            // Find a session that was actually paid (payment_status === 'paid')
            // and is a one-time payment (mode === 'payment').
            paidSession = sessions.find(s =>
                s.payment_status === 'paid' &&
                s.mode === 'payment' &&
                (s.client_reference_id === userId || (s.metadata && s.metadata.user_id === userId))
            ) || null;
        } else {
            console.warn('Premium-status: Stripe query failed:', stripeRes.status);
        }
    } catch (err) {
        console.warn('Premium-status: Stripe query error:', err.message);
    }

    // If no paid session exists, there is nothing to grant. Return the current
    // (non-premium) status. This is the safe default — no entitlement without
    // a real, verified, paid Stripe session.
    if (!paidSession) {
        return new Response(JSON.stringify({
            premium_active: false,
            premium_purchased_at: null,
            reconciled: false
        }), { status: 200, headers: corsHeaders });
    }

    // A paid session exists but the profile is not premium — grant the
    // entitlement (same as the webhook). Idempotent: setting the same values
    // again is harmless.
    try {
        const updateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
            method: 'PATCH',
            headers: {
                'apikey': serviceRoleKey,
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                premium_active: true,
                premium_purchased_at: new Date().toISOString()
            })
        });

        if (!updateRes.ok) {
            const errText = await updateRes.text();
            console.error('Premium-status: failed to grant premium:', updateRes.status, errText);
            return new Response(JSON.stringify({ error: 'Failed to reconcile premium entitlement.' }), {
                status: 500,
                headers: corsHeaders
            });
        }

        console.log(`Premium-status: reconciled Premium Lifetime for user ${userId} (paid session ${paidSession.id})`);
        return new Response(JSON.stringify({
            premium_active: true,
            premium_purchased_at: new Date().toISOString(),
            reconciled: true,
            session_id: paidSession.id
        }), { status: 200, headers: corsHeaders });
    } catch (err) {
        console.error('Premium-status: error granting premium:', err.message);
        return new Response(JSON.stringify({ error: 'Failed to reconcile premium entitlement.' }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
