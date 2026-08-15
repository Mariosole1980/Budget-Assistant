// Shared security helpers for Cloudflare Pages Functions (AI endpoints).
//
// Design notes (minimal, architecture-aware):
// - Guest Mode is a first-class feature: unauthenticated users may call the AI
//   endpoints, so authentication is OPTIONAL here (the client only sends a
//   Bearer token when a Supabase session exists). We still validate the token
//   when it IS present so a forged/invalid token is rejected instead of ignored.
// - CORS is restricted to the app's own origins (production PWA, Capacitor
//   WebView, local dev) instead of '*', closing the main abuse vector where any
//   third-party site could burn the Gemini API budget.
// - Rate limiting is a per-isolate in-memory sliding window keyed by client IP.
//   Cloudflare Workers have no shared state across isolates without KV, so this
//   provides best-effort protection against single-source abuse without adding
//   infrastructure. It is intentionally simple and self-contained.

const ALLOWED_ORIGINS = [
    'https://budget-assistant-pwa.pages.dev',
    'capacitor://localhost',
    'http://localhost',
    'https://localhost'
];

// In-memory rate limiter: Map<ip, { count, windowStart }>
const rateBuckets = new Map();
const RATE_LIMIT_MAX = 30;          // max requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function getClientIp(request) {
    return (
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
        'unknown'
    );
}

function isAllowedOrigin(origin) {
    if (!origin) return false;
    return ALLOWED_ORIGINS.includes(origin);
}

function checkRateLimit(ip) {
    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
        rateBuckets.set(ip, { count: 1, windowStart: now });
        // Opportunistic cleanup: evict buckets whose window has fully expired so the
        // Map does not grow unboundedly over the lifetime of the isolate (memory leak).
        if (rateBuckets.size > 1000) {
            for (const [key, b] of rateBuckets) {
                if (now - b.windowStart >= RATE_LIMIT_WINDOW_MS) {
                    rateBuckets.delete(key);
                }
            }
        }
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }
    if (bucket.count >= RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0 };
    }
    bucket.count += 1;
    return { allowed: true, remaining: RATE_LIMIT_MAX - bucket.count };
}

// Build CORS headers for a request. Returns null when the origin is not allowed.
function corsHeadersFor(request, extra = {}) {
    const origin = request.headers.get('Origin');
    if (!isAllowedOrigin(origin)) {
        return null;
    }
    return {
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin',
        'Content-Type': 'application/json',
        ...extra
    };
}

// Validate a request before processing. Returns { ok, status, headers, body }.
function validateRequest(request, { maxBodyBytes = 64 * 1024 } = {}) {
    // 1. CORS / origin check
    const corsHeaders = corsHeadersFor(request);
    if (!corsHeaders) {
        return {
            ok: false,
            status: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Forbidden: origin not allowed' })
        };
    }

    // 2. Rate limit
    const ip = getClientIp(request);
    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
        return {
            ok: false,
            status: 429,
            headers: { ...corsHeaders, 'Retry-After': '60' },
            body: JSON.stringify({ error: 'Too many requests. Please try again later.' })
        };
    }

    // 3. Body size guard
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > maxBodyBytes) {
        return {
            ok: false,
            status: 413,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Request body too large' })
        };
    }

    return { ok: true, headers: corsHeaders };
}

// ---------------------------------------------------------------------------
// Supabase configuration resolution (fail-closed)
// ---------------------------------------------------------------------------
// The functions previously fell back to hardcoded Supabase URL / anon key when
// the Cloudflare environment variables were missing. That is a security risk:
// credentials in source control are exposed to anyone with repo access, and a
// silent fallback masks misconfiguration. These helpers resolve credentials
// ONLY from `env` (Cloudflare Pages environment variables / secrets) and return
// null when a required value is absent, so callers can fail-closed with a 500
// instead of silently using hardcoded credentials.
//
// Required env vars (set in Cloudflare Pages -> Settings -> Environment
// variables & secrets):
//   SUPABASE_URL            e.g. https://<project>.supabase.co
//   SUPABASE_ANON_KEY       publishable anon key (client-safe)
//   SUPABASE_SERVICE_ROLE_KEY  service-role key (server-only secret)
// ---------------------------------------------------------------------------

// Resolve the public (anon) Supabase config. Returns null if either var is missing.
function getSupabasePublicConfig(env) {
    const supabaseUrl = env?.SUPABASE_URL;
    const supabaseKey = env?.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    return { supabaseUrl, supabaseKey };
}

// Resolve the service-role config. Returns null if any required var is missing.
function getSupabaseServiceConfig(env) {
    const base = getSupabasePublicConfig(env);
    const serviceRoleKey = env?.SUPABASE_SERVICE_ROLE_KEY;
    if (!base || !serviceRoleKey) return null;
    return { ...base, serviceRoleKey };
}

export {
    corsHeadersFor,
    validateRequest,
    getClientIp,
    ALLOWED_ORIGINS,
    getSupabasePublicConfig,
    getSupabaseServiceConfig
};
