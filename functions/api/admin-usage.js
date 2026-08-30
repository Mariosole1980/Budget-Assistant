import { validateRequest, getSupabasePublicConfig } from './_security.js';

export async function onRequestOptions(context) {
  const { request } = context;
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
    'https://www.budgetassistant.org',
    'https://budgetassistant.org',
    'https://budget-assistant-pwa.pages.dev',
    'capacitor://localhost',
    'http://localhost',
    'https://localhost'
  ];
  if (!origin || !allowedOrigins.includes(origin)) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Shared security: CORS origin check, rate limiting, body size guard.
  const sec = validateRequest(request);
  if (!sec.ok) {
    return new Response(sec.body, { status: sec.status, headers: sec.headers });
  }
  const corsHeaders = sec.headers;

  // Require a logged-in user (the admin gate is enforced INSIDE the DB RPC).
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized: missing session token' }), {
      status: 401,
      headers: corsHeaders
    });
  }
  const authToken = authHeader.substring(7);

  const supabase = getSupabasePublicConfig(env);
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Server configuration error: SUPABASE_URL / SUPABASE_ANON_KEY not configured.' }), {
      status: 500,
      headers: corsHeaders
    });
  }
  const { supabaseUrl, supabaseKey } = supabase;

  // 1. Verify the token is valid (rejects forged/invalid tokens).
  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${authToken}`
      }
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid session token' }), {
        status: 401,
        headers: corsHeaders
      });
    }
  } catch (err) {
    console.warn('Admin-usage session verification error:', err.message);
    return new Response(JSON.stringify({ error: 'Unauthorized: could not verify session' }), {
      status: 401,
      headers: corsHeaders
    });
  }

  // 2. Call the admin RPC. It is SECURITY DEFINER and returns
  //    {"error":"forbidden"} for any non-admin user, so the admin check is
  //    authoritative (cannot be bypassed by calling this endpoint directly).
  try {
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/admin_get_usage`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });

    if (rpcRes.status === 404) {
      return new Response(JSON.stringify({
        error: 'ADMIN_RPC_MISSING',
        message: 'The admin_get_usage RPC is not installed. Run admin-dashboard-migration.sql in the Supabase SQL editor.'
      }), { status: 500, headers: corsHeaders });
    }

    if (!rpcRes.ok) {
      const errText = await rpcRes.text();
      let parsedErr = errText;
      try {
        const p = JSON.parse(errText);
        parsedErr = p.message || p.error || p.hint || errText;
      } catch (_) {}
      return new Response(JSON.stringify({
        error: 'admin_usage_failed',
        details: parsedErr.slice(0, 500)
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const data = await rpcRes.json();
    if (data && data.error) {
      if (data.error === 'forbidden') {
        return new Response(JSON.stringify({ error: 'Forbidden: not an administrator' }), {
          status: 403,
          headers: corsHeaders
        });
      }
      return new Response(JSON.stringify({ error: 'admin_usage_failed', details: data.error }), {
        status: 500,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err) {
    console.error('Admin-usage endpoint error:', err.message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
