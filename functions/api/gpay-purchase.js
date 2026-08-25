import { validateRequest, corsHeadersFor, getSupabasePublicConfig } from './_security.js';

// Google Pay direct-wallet purchase endpoint (web / PWA).
//
// This is the "separate Google Pay" flow: the client opens the native Google
// Pay sheet (Google Pay API) — there is NO Stripe Checkout redirect in this
// flow. This endpoint provides:
//
//   GET  /api/gpay-purchase
//       Returns { publishableKey, environment } used to build the Google Pay
//       PaymentDataRequest with the Stripe tokenization gateway.
//
//   POST /api/gpay-purchase  body: { token }
//       Converts the Google Pay Stripe token into a confirmed PaymentIntent and
//       grants the Premium Lifetime entitlement — but ONLY after Stripe reports
//       the PaymentIntent as 'succeeded'.
//
// Security: the entitlement grant is guarded by (a) JWT authentication and
// (b) a server-confirmed Stripe charge (status 'succeeded'). The client can
// never self-grant premium — the server is the source of truth.
//
// Uses Stripe's REST API directly via fetch (no SDK dependency), consistent
// with functions/api/purchase.js and functions/api/webhook.js.

const PREMIUM_PRICE_EUR = 9.99;

export async function onRequestOptions(context) {
    const { request } = context;
    const corsHeaders = corsHeadersFor(request, {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    });
    if (!corsHeaders) {
        return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 204, headers: corsHeaders });
}

// Authenticate the JWT (Bearer token -> /auth/v1/user) and resolve the user id.
// Returns { userId } or { error, status }.
async function authenticateUser(request, env) {
    const supabase = getSupabasePublicConfig(env);
    if (!supabase) {
        return { error: 'Server configuration error: SUPABASE_URL / SUPABASE_ANON_KEY not configured.', status: 500 };
    }
    const { supabaseUrl, supabaseKey } = supabase;

    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
        return { error: 'Unauthorized: Missing session token. Please log in.', status: 401 };
    }
    const token = authHeader.substring(7);

    try {
        const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${token}`
            }
        });
        if (!userRes.ok) {
            return { error: 'Unauthorized: Invalid session token.', status: 401 };
        }
        const userData = await userRes.json();
        if (!userData.id) {
            return { error: 'Unauthorized: User ID not found.', status: 401 };
        }
        return { userId: userData.id };
    } catch (err) {
        console.warn('gpay-purchase auth error:', err.message);
        return { error: 'Unauthorized: could not verify session.', status: 401 };
    }
}

// GET: return the Stripe publishable key + Google Pay environment so the client
// can build the PaymentDataRequest (tokenization gateway = stripe).
export async function onRequestGet(context) {
    const { request, env } = context;

    const sec = validateRequest(request);
    if (!sec.ok) {
        return new Response(sec.body, { status: sec.status, headers: sec.headers });
    }
    const corsHeaders = sec.headers;

    const auth = await authenticateUser(request, env);
    if (auth.error) {
        return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: corsHeaders });
    }

    const publishableKey = env.STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
        return new Response(JSON.stringify({ error: 'Server configuration error: STRIPE_PUBLISHABLE_KEY not configured.' }), {
            status: 500,
            headers: corsHeaders
        });
    }

    return new Response(JSON.stringify({
        publishableKey,
        environment: String(publishableKey).startsWith('pk_test') ? 'TEST' : 'PRODUCTION'
    }), { status: 200, headers: corsHeaders });
}

// POST: charge the Google Pay token and grant the Premium Lifetime entitlement.
export async function onRequestPost(context) {
    const { request, env } = context;

    const sec = validateRequest(request);
    if (!sec.ok) {
        return new Response(sec.body, { status: sec.status, headers: sec.headers });
    }
    const corsHeaders = sec.headers;

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
    const supabaseUrl = env.SUPABASE_URL;
    if (!supabaseUrl) {
        return new Response(JSON.stringify({ error: 'Server configuration error: SUPABASE_URL not configured.' }), {
            status: 500,
            headers: corsHeaders
        });
    }

    const auth = await authenticateUser(request, env);
    if (auth.error) {
        return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: corsHeaders });
    }
    const userId = auth.userId;

    let reqBody = {};
    try {
        reqBody = await request.json();
    } catch (e) { }
    const gpayToken = reqBody.token || '';

    if (!gpayToken) {
        return new Response(JSON.stringify({ error: 'Missing Google Pay token.' }), {
            status: 400,
            headers: corsHeaders
        });
    }

    try {
        // Create + confirm the PaymentIntent in one call using the Google Pay
        // Stripe token (returned by the Google Pay API when the tokenization
        // gateway is 'stripe'). Client_reference_id binds the charge to the
        // authenticated user (same convention as purchase.js).
        const body = new URLSearchParams();
        body.append('amount', String(Math.round(PREMIUM_PRICE_EUR * 100)));
        body.append('currency', 'eur');
        body.append('confirm', 'true');
        body.append('payment_method_data[type]', 'card');
        body.append('payment_method_data[card][token]', gpayToken);
        body.append('client_reference_id', userId);
        body.append('metadata[user_id]', userId);
        body.append('metadata[selected_method]', 'gpay');

        const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });
        const piData = await piRes.json().catch(() => ({}));

        if (!piRes.ok) {
            console.error('Google Pay PaymentIntent error:', piData);
            const stripeMsg = piData.error && piData.error.message ? piData.error.message : 'Payment failed.';
            return new Response(JSON.stringify({ error: stripeMsg }), {
                status: 502,
                headers: corsHeaders
            });
        }

        // SCA / 3DS would surface as requires_action. Google Pay tokens are
        // normally already authenticated, but if the bank still demands 3DS we
        // cannot continue without Stripe.js — ask the user to use Card instead.
        if (piData.status === 'requires_action' || piData.status === 'requires_confirmation') {
            return new Response(JSON.stringify({ error: 'requires_action' }), {
                status: 402,
                headers: corsHeaders
            });
        }

        if (piData.status !== 'succeeded') {
            console.warn('Google Pay PaymentIntent not succeeded:', piData.status);
            return new Response(JSON.stringify({ error: 'payment_failed' }), {
                status: 402,
                headers: corsHeaders
            });
        }

        // Payment succeeded — grant the Premium Lifetime entitlement (same as
        // the webhook). Safe: Stripe confirmed the charge (status 'succeeded')
        // before anything is written. Idempotent: re-setting the same values is
        // harmless.
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
            console.error('gpay-purchase: failed to grant premium:', updateRes.status, errText);
            return new Response(JSON.stringify({ error: 'Failed to grant premium entitlement.' }), {
                status: 500,
                headers: corsHeaders
            });
        }

        console.log(`gpay-purchase: granted Premium Lifetime to user ${userId} (pi ${piData.id})`);
        return new Response(JSON.stringify({ success: true, paymentIntentId: piData.id }), {
            status: 200,
            headers: corsHeaders
        });
    } catch (err) {
        console.error('gpay-purchase error:', err.message);
        return new Response(JSON.stringify({ error: 'Internal server error.' }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
