import { validateRequest, corsHeadersFor, getSupabasePublicConfig } from './_security.js';

// Google Play Billing verification endpoint (native Android).
//
// The native Android app (Capacitor) uses the `capacitor-billing` plugin to
// launch the Google Play purchase sheet. After a successful purchase the client
// receives a purchase token and posts it here for SERVER-SIDE verification
// against the Google Play Developer API. Only a verified, active purchase grants
// the Premium Lifetime entitlement (profiles.premium_active = true).
//
// This mirrors the Stripe web flow (functions/api/purchase.js + webhook.js):
// the client can never self-grant premium — the server is the source of truth.
//
// Flow:
//   1. validateRequest() (CORS, rate limit, body size) + JWT auth.
//   2. Build a signed JWT from the Google service account (RS256 via Web Crypto).
//   3. Exchange the JWT for a Google OAuth2 access token.
//   4. Call the Play Developer API to verify the purchase token is valid + active.
//   5. Grant entitlement via SUPABASE_SERVICE_ROLE_KEY (same as the webhook).
//
// Required Cloudflare Pages secrets:
//   GOOGLE_SERVICE_ACCOUNT_JSON  — full service-account JSON (from Google Cloud)
//   PLAY_PACKAGE_NAME            — e.g. com.budgetassistant.app
//   SUPABASE_SERVICE_ROLE_KEY    — server-only secret (already used elsewhere)
//   SUPABASE_URL / SUPABASE_ANON_KEY

const PLAY_API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

// ---------------------------------------------------------------------------
// Google service-account JWT (RS256) signing via Web Crypto.
// Cloudflare Workers have no Node crypto/jsonwebtoken, so we sign manually.
// ---------------------------------------------------------------------------

function base64UrlEncode(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// Import an RSA private key (PKCS#8, PEM) for RS256 signing.
async function importPrivateKey(pem) {
    const pemBody = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\s+/g, '');
    const keyData = base64UrlDecode(pemBody);
    return crypto.subtle.importKey(
        'pkcs8',
        keyData,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );
}

// Build and sign a Google OAuth2 JWT assertion from the service account.
async function createSignedJwt(serviceAccount) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
        iss: serviceAccount.client_email,
        scope: SCOPE,
        aud: OAUTH_TOKEN_URL,
        iat: now,
        exp: now + 3600
    };

    const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
    const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    const signingInput = `${headerB64}.${payloadB64}`;

    const privateKey = await importPrivateKey(serviceAccount.private_key);
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        privateKey,
        new TextEncoder().encode(signingInput)
    );

    return `${signingInput}.${base64UrlEncode(signature)}`;
}

// Exchange the signed JWT for a Google OAuth2 access token.
async function getGoogleAccessToken(serviceAccount) {
    const assertion = await createSignedJwt(serviceAccount);
    const body = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion
    });

    const res = await fetch(OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google OAuth token exchange failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    if (!data.access_token) {
        throw new Error('Google OAuth token exchange returned no access_token.');
    }
    return data.access_token;
}

// Verify a one-time (INAPP) purchase token against the Play Developer API.
// Returns the purchase object when valid + active, otherwise null.
async function verifyPlayPurchase(accessToken, packageName, productId, purchaseToken) {
    const url = `${PLAY_API_BASE}/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!res.ok) {
        // 404 = invalid/unknown token; 401/403 = auth/service-account problem.
        // Surface the real Google reason so the client toast is actionable.
        const errText = await res.text();
        console.warn('Play purchase verification failed:', res.status, errText);
        throw new Error(`Google Play API ${res.status}: ${(errText || 'no details').slice(0, 300)}`);
    }

    const data = await res.json();
    // purchaseState: 0 = purchased (unconfirmed), 1 = canceled, 2 = pending.
    // We require a purchased (0) state. Also require consumptionState 0 (yet to be
    // consumed) OR already consumed — for a one-time product, a valid token that
    // was purchased is sufficient to grant the entitlement.
    if (data.purchaseState !== 0) {
        throw new Error(`Purchase state is ${data.purchaseState} (expected 0 = purchased).`);
    }
    return data;
}

// ---------------------------------------------------------------------------
// Endpoint handlers
// ---------------------------------------------------------------------------

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

    // Required env vars (fail-closed).
    const serviceAccountJson = env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
        return new Response(JSON.stringify({ error: 'Server configuration error: GOOGLE_SERVICE_ACCOUNT_JSON not configured.' }), {
            status: 500,
            headers: corsHeaders
        });
    }
    const packageName = env.PLAY_PACKAGE_NAME;
    if (!packageName) {
        return new Response(JSON.stringify({ error: 'Server configuration error: PLAY_PACKAGE_NAME not configured.' }), {
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
        console.warn('Play-billing auth error:', err.message);
        return new Response(JSON.stringify({ error: 'Unauthorized: could not verify session.' }), {
            status: 401,
            headers: corsHeaders
        });
    }

    // Parse the request body.
    let body;
    try {
        body = await request.json();
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
            status: 400,
            headers: corsHeaders
        });
    }

    const purchaseToken = body && body.purchaseToken;
    const productId = body && body.productId;
    if (!purchaseToken || !productId) {
        return new Response(JSON.stringify({ error: 'Missing purchaseToken or productId.' }), {
            status: 400,
            headers: corsHeaders
        });
    }

    // Parse the service account JSON.
    let serviceAccount;
    try {
        serviceAccount = JSON.parse(serviceAccountJson);
    } catch (err) {
        console.error('Play-billing: invalid GOOGLE_SERVICE_ACCOUNT_JSON:', err.message);
        return new Response(JSON.stringify({ error: 'Server configuration error: invalid service account JSON.' }), {
            status: 500,
            headers: corsHeaders
        });
    }
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
        return new Response(JSON.stringify({ error: 'Server configuration error: service account missing client_email/private_key.' }), {
            status: 500,
            headers: corsHeaders
        });
    }

    // Verify the purchase token against the Google Play Developer API.
    let accessToken;
    try {
        accessToken = await getGoogleAccessToken(serviceAccount);
    } catch (err) {
        console.error('Play-billing: Google auth error:', err.message);
        return new Response(JSON.stringify({ error: 'Failed to authenticate with Google Play.' }), {
            status: 502,
            headers: corsHeaders
        });
    }

    let purchase;
    try {
        purchase = await verifyPlayPurchase(accessToken, packageName, productId, purchaseToken);
    } catch (err) {
        console.error('Play-billing: verification error:', err.message);
        return new Response(JSON.stringify({ error: `Failed to verify purchase: ${err.message}` }), {
            status: 502,
            headers: corsHeaders
        });
    }

    if (!purchase) {
        return new Response(JSON.stringify({ error: 'Purchase token is invalid or not active.' }), {
            status: 403,
            headers: corsHeaders
        });
    }

    // Purchase verified — grant the Premium Lifetime entitlement (idempotent).
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
            console.error('Play-billing: failed to grant premium:', updateRes.status, errText);
            return new Response(JSON.stringify({ error: 'Failed to grant premium entitlement.' }), {
                status: 500,
                headers: corsHeaders
            });
        }

        console.log(`Play-billing: granted Premium Lifetime to user ${userId} (product ${productId})`);
        return new Response(JSON.stringify({ ok: true, premium_active: true }), {
            status: 200,
            headers: corsHeaders
        });
    } catch (err) {
        console.error('Play-billing: error granting premium:', err.message);
        return new Response(JSON.stringify({ error: 'Failed to grant premium entitlement.' }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
