import { validateRequest, corsHeadersFor, getSupabasePublicConfig } from './_security.js';

// Premium Lifetime purchase endpoint (web / PWA).
//
// Creates a Stripe Checkout Session for the one-time €9.99 Premium Lifetime
// plan. The user must be authenticated (JWT). On success the client redirects
// to the returned Stripe Checkout URL. The actual entitlement is granted by the
// webhook (functions/api/webhook.js) once payment completes.
//
// Uses Stripe's REST API directly via fetch (no SDK dependency), which is the
// recommended approach for Cloudflare Workers/Pages Functions.

const PREMIUM_PRICE_EUR = 9.99;

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

    // Shared security: CORS origin check, rate limiting, body size guard.
    const sec = validateRequest(request);
    if (!sec.ok) {
        return new Response(sec.body, { status: sec.status, headers: sec.headers });
    }
    const corsHeaders = sec.headers;

    // Stripe secret key is required.
    const stripeSecretKey = env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
        return new Response(JSON.stringify({ error: 'Server configuration error: STRIPE_SECRET_KEY not configured.' }), {
            status: 500,
            headers: corsHeaders
        });
    }

    // Authenticate the user via JWT.
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Missing session token. Please log in.' }), {
            status: 401,
            headers: corsHeaders
        });
    }
    const token = authHeader.substring(7);
    const supabase = getSupabasePublicConfig(env);
    if (!supabase) {
        return new Response(JSON.stringify({ error: 'Server configuration error: SUPABASE_URL / SUPABASE_ANON_KEY not configured.' }), {
            status: 500,
            headers: corsHeaders
        });
    }
    const { supabaseUrl, supabaseKey } = supabase;

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
        console.warn('Purchase auth error:', err.message);
        return new Response(JSON.stringify({ error: 'Unauthorized: could not verify session.' }), {
            status: 401,
            headers: corsHeaders
        });
    }

    let reqBody = {};
    try {
        reqBody = await request.json();
    } catch (e) { }
    const paymentMethod = reqBody.method || 'card';

    // Determine the app origin for the success/cancel redirect URLs.
    const origin = request.headers.get('Origin') || 'https://budget-assistant-pwa.pages.dev';
    const successUrl = `${origin}/?premium=success`;
    const cancelUrl = `${origin}/?premium=cancelled`;

    try {
        // Create a Stripe Checkout Session (one-time payment).
        const body = new URLSearchParams();
        body.append('mode', 'payment');
        body.append('client_reference_id', userId);
        body.append('success_url', successUrl);
        body.append('cancel_url', cancelUrl);
        body.append('line_items[0][price_data][currency]', 'eur');
        body.append('line_items[0][price_data][unit_amount]', String(Math.round(PREMIUM_PRICE_EUR * 100)));
        body.append('line_items[0][price_data][product_data][name]', 'Premium Lifetime');
        body.append('line_items[0][price_data][product_data][description]', 'One-time payment. Unlock all Premium features forever.');
        body.append('line_items[0][quantity]', '1');
        body.append('metadata[user_id]', userId);
        body.append('metadata[selected_method]', paymentMethod);

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        const data = await stripeRes.json().catch(() => ({}));

        if (!stripeRes.ok) {
            console.error('Stripe Checkout error:', data);
            return new Response(JSON.stringify({ error: 'Failed to create checkout session.' }), {
                status: 502,
                headers: corsHeaders
            });
        }

        if (!data.url) {
            return new Response(JSON.stringify({ error: 'Checkout session created without a URL.' }), {
                status: 502,
                headers: corsHeaders
            });
        }

        return new Response(JSON.stringify({ url: data.url }), {
            status: 200,
            headers: corsHeaders
        });
    } catch (err) {
        console.error('Purchase endpoint error:', err.message);
        return new Response(JSON.stringify({ error: 'Internal server error.' }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
