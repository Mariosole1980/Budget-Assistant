import { validateRequest, corsHeadersFor, getSupabaseServiceConfig } from './_security.js';

export async function onRequestOptions(context) {
  const { request } = context;
  const corsHeaders = corsHeadersFor(request, {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  });
  if (!corsHeaders) return new Response(null, { status: 204 });
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const sec = validateRequest(request);
  if (!sec.ok) return new Response(sec.body, { status: sec.status, headers: sec.headers });
  const corsHeaders = sec.headers;

  try {
    const payload = await request.json();
    const { email, password, lang } = payload || {};

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const config = getSupabaseServiceConfig(env);
    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const { supabaseUrl, serviceRoleKey } = config;
    const adminUrl = `${supabaseUrl}/auth/v1/admin/users`;

    // Create user with pre-confirmed email (bypasses email sending and zero rate limit)
    const res = await fetch(adminUrl, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password: password,
        email_confirm: true,
        user_metadata: {
          lang: lang || 'el'
        }
      })
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.msg || data?.message || data?.error_description || 'Signup failed';
      return new Response(
        JSON.stringify({ error: errMsg, code: res.status }),
        { status: res.status, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: data
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Server error: ${err.message || err}` }),
      { status: 500, headers: corsHeaders }
    );
  }
}
