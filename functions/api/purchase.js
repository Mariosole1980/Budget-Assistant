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

    // Direct PayPal Flow (using user's PayPal Developer credentials)
    if (paymentMethod === 'paypal') {
        const paypalClientId = env.PAYPAL_CLIENT_ID || 'BAAPrv586Eftb2ZZpvcJSO30qDGRzULdVaOOhAZ-4jUlsZC5-Iq6Ungx5EsGgBYwA0bAi2WnzYayxofCkQ';
        const paypalSecret = env.PAYPAL_CLIENT_SECRET || 'ELf0xoqbR0qgDpRA-PqrGKrn5k1eg307kH2rl9p22MdoCyu3lxkexOWtV7js5rhuZDZj2cg9MceAOcCe';
        const isSandbox = (env.PAYPAL_MODE || '').toLowerCase() === 'sandbox';
        const paypalBaseUrl = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

        try {
            const basicAuth = btoa(`${paypalClientId}:${paypalSecret}`);
            const tokenRes = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${basicAuth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: 'grant_type=client_credentials'
            });

            if (tokenRes.ok) {
                const tokenData = await tokenRes.json();
                const paypalAccessToken = tokenData.access_token;

                const orderRes = await fetch(`${paypalBaseUrl}/v2/checkout/orders`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${paypalAccessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        intent: 'CAPTURE',
                        purchase_units: [
                            {
                                reference_id: 'budget_assistant_lifetime_pro',
                                custom_id: userId,
                                description: 'Budget Assistant Lifetime PRO',
                                amount: {
                                    currency_code: 'EUR',
                                    value: '9.99'
                                }
                            }
                        ],
                        application_context: {
                            brand_name: 'MKlogic',
                            landing_page: 'NO_PREFERENCE',
                            user_action: 'PAY_NOW',
                            return_url: `${origin}/?paypal=success`,
                            cancel_url: `${origin}/?premium=cancelled`
                        }
                    })
                });

                if (orderRes.ok) {
                    const orderData = await orderRes.json();
                    const approveLink = (orderData.links || []).find(l => l.rel === 'approve');
                    if (approveLink && approveLink.href) {
                        return new Response(JSON.stringify({ url: approveLink.href, orderId: orderData.id }), {
                            status: 200,
                            headers: corsHeaders
                        });
                    }
                } else {
                    console.error('PayPal Order Create Error:', await orderRes.text());
                }
            }
        } catch (paypalErr) {
            console.warn('Direct PayPal Order creation error:', paypalErr);
        }
    }

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
        
        if (paymentMethod === 'paypal') {
            body.append('payment_method_types[0]', 'paypal');
            body.append('payment_method_types[1]', 'card');
        } else {
            body.append('payment_method_types[0]', 'card');
        }

        let stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        let data = await stripeRes.json().catch(() => ({}));

        // If PayPal was requested but not enabled on Stripe account, retry with standard card
        if (!stripeRes.ok && paymentMethod === 'paypal' && data.error && data.error.message && data.error.message.includes('paypal')) {
            const fallbackBody = new URLSearchParams(body);
            fallbackBody.delete('payment_method_types[0]');
            fallbackBody.delete('payment_method_types[1]');
            fallbackBody.append('payment_method_types[0]', 'card');

            stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${stripeSecretKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: fallbackBody.toString()
            });
            data = await stripeRes.json().catch(() => ({}));
        }

        if (!stripeRes.ok) {
            console.error('Stripe Checkout error:', data);
            return new Response(JSON.stringify({ error: data.error?.message || 'Failed to create checkout session.' }), {
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
