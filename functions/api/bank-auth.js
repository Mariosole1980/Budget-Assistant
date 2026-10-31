import { validateRequest, corsHeadersFor, getSupabasePublicConfig } from './_security.js';
import { BankService, psuHeadersFromRequest } from './_bank_service.js';

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
  const corsHeaders = sec.headers;

  // Supabase Auth validation
  const supabase = getSupabasePublicConfig(env);
  if (!supabase) {
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
    const { bankName, country = 'GR', redirectUrl, psuType, language } = body;

    if (!bankName) {
      return new Response(JSON.stringify({ error: 'Missing bankName' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const bankService = new BankService(env);
    // `country` is carried in the state blob so the callback stores the bank's
    // real country (Revolut is published as GB, not GR).
    const aspspCountry = String(country || 'GR').trim().toUpperCase();
    const state = JSON.stringify({ userId, bankName, country: aspspCountry, timestamp: Date.now() });

    const authResult = await bankService.startAuth({
      bankName,
      country: aspspCountry,
      redirectUrl: redirectUrl || 'https://www.budgetassistant.org/index.html',
      state,
      psuType,
      language,
      psuHeaders: psuHeadersFromRequest(request)
    });

    return new Response(JSON.stringify(authResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[bank-auth] Error:', err);
    // A bank the provider does not offer for this country is a client-side
    // choice problem, not a server failure — surface it as 422 so the app can
    // tell the user instead of showing a generic "try again".
    const status = err && err.code === 'ASPSP_NOT_FOUND' ? 422 : 500;
    return new Response(JSON.stringify({ error: err.message || 'Failed to start bank auth' }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
