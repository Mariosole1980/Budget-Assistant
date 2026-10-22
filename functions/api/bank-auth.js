import { validateRequest, corsHeadersFor, getSupabasePublicConfig } from './_security.js';
import { BankService } from './_bank_service.js';

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
  const corsHeaders = sec.corsHeaders;

  // Supabase Auth validation
  const supabase = getSupabasePublicConfig(env);
  if (!supabase.ok) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Log in required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  const token = authHeader.substring(7);

  let userId;
  try {
    const userRes = await fetch(`${supabase.supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': supabase.supabaseKey,
        'Authorization': `Bearer ${token}`
      }
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userData = await userRes.json();
    userId = userData.id;
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Auth verification failed' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { bankName, country = 'GR', redirectUrl } = body;

    if (!bankName) {
      return new Response(JSON.stringify({ error: 'Missing bankName' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const bankService = new BankService(env);
    const state = JSON.stringify({ userId, bankName, timestamp: Date.now() });
    const authResult = await bankService.startAuth({
      bankName,
      country,
      redirectUrl: redirectUrl || 'https://www.budgetassistant.org/index.html',
      state
    });

    return new Response(JSON.stringify(authResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[bank-auth] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to start bank auth' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
