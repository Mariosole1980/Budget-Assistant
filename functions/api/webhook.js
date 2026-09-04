import { grantHouseholdPremium } from './_security.js';

// Stripe webhook endpoint (web / PWA).
//
// Stripe calls this endpoint after a payment event. We verify the signature
// using STRIPE_WEBHOOK_SECRET, and on `checkout.session.completed` we grant the
// Premium Lifetime entitlement by setting `premium_active = true` on the user's
// Supabase profile (using the service role key).
//
// IMPORTANT: This endpoint is called by Stripe's servers, NOT by the browser.
// It must NOT go through the shared CORS/rate-limit `validateRequest` helper,
// because Stripe does not send an Origin header and its IPs are not our users.
// Instead we verify the Stripe signature (cryptographic proof of authenticity).
//
// Uses Stripe's REST API directly via fetch (no SDK dependency), consistent
// with functions/api/purchase.js.

export async function onRequestPost(context) {
    const { request, env } = context;

    const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET;
    if (!stripeWebhookSecret) {
        return new Response(JSON.stringify({ error: 'Server configuration error: STRIPE_WEBHOOK_SECRET not configured.' }), {
            status: 500,
        });
    }

    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        return new Response(JSON.stringify({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY not configured.' }), {
            status: 500,
        });
    }

    const supabaseUrl = env.SUPABASE_URL;
    if (!supabaseUrl) {
        return new Response(JSON.stringify({ error: 'Server configuration error: SUPABASE_URL not configured.' }), {
            status: 500,
        });
    }

    // Read the raw body (needed for signature verification).
    let rawBody;
    try {
        rawBody = await request.text();
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Could not read request body.' }), { status: 400 });
    }

    // Verify the Stripe signature.
    const signatureHeader = request.headers.get('Stripe-Signature') || '';
    if (!signatureHeader) {
        return new Response(JSON.stringify({ error: 'Missing Stripe-Signature header.' }), { status: 400 });
    }

    let event;
    try {
        event = await constructStripeEvent(rawBody, signatureHeader, stripeWebhookSecret);
    } catch (err) {
        console.error('Stripe webhook signature verification failed:', err.message);
        return new Response(JSON.stringify({ error: 'Invalid signature.' }), { status: 400 });
    }

    // Only handle completed checkout sessions (one-time payment).
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object || {};

        // The userId was stored in client_reference_id (and metadata) by purchase.js.
        const userId = session.client_reference_id || (session.metadata && session.metadata.user_id);

        if (!userId) {
            console.error('Webhook: checkout.session.completed without a user id.', session.id);
            return new Response(JSON.stringify({ error: 'Missing user id in session.' }), { status: 400 });
        }

        // Grant the Premium Lifetime entitlement (household-wide).
        const grantRes = await grantHouseholdPremium(supabaseUrl, serviceRoleKey, userId);
        if (!grantRes.ok) {
            console.error('Webhook: failed to grant premium:', grantRes.status, grantRes.error);
            // Return 500 so Stripe retries the webhook.
            return new Response(JSON.stringify({ error: 'Failed to grant premium.' }), { status: 500 });
        }

        console.log(`Webhook: granted Premium Lifetime to user ${userId} (household unlocked)`);
    }

    // Acknowledge the event (Stripe expects a 2xx to stop retrying).
    return new Response(JSON.stringify({ received: true }), { status: 200 });
}

// Verify the Stripe signature and return the parsed event.
// Implements the same algorithm Stripe's SDK uses (t, v1 HMAC-SHA256).
async function constructStripeEvent(rawBody, signatureHeader, secret) {
    const parts = {};
    for (const item of signatureHeader.split(',')) {
        const [key, value] = item.split('=');
        if (key && value) parts[key.trim()] = value.trim();
    }

    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) {
        throw new Error('Signature header missing t or v1.');
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expected = await hmacSha256Hex(secret, signedPayload);

    // Constant-time comparison to avoid timing attacks.
    if (!safeEqual(expected, signature)) {
        throw new Error('Signature mismatch.');
    }

    // NOTE: We intentionally do NOT reject events based on their timestamp age.
    // Stripe preserves the ORIGINAL event timestamp (`t`) across its automatic
    // webhook retries (1min, 10min, 100min, ...). A strict "older than N minutes"
    // check would reject legitimate retries with a 400 (permanent failure), so the
    // premium entitlement would never be granted. Replay protection is instead
    // provided by (a) the HMAC-SHA256 signature, which only Stripe can produce
    // (it requires the webhook secret), and (b) the idempotent PATCH below
    // (setting premium_active = true repeatedly is harmless).

    return JSON.parse(rawBody);
}

// HMAC-SHA256 using the Web Crypto API (available in Cloudflare Workers).
async function hmacSha256Hex(secret, message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

// Constant-time string comparison.
function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}
