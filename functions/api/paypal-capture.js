import { validateRequest, corsHeadersFor, getSupabasePublicConfig } from './_security.js';

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

  const paypalClientId = env.PAYPAL_CLIENT_ID || 'BAAPrv586Eftb2ZZpvcJSO30qDGRzULdVaOOhAZ-4jUlsZC5-Iq6Ungx5EsGgBYwA0bAi2WnzYayxofCkQ';
  const paypalSecret = env.PAYPAL_CLIENT_SECRET || 'ELf0xoqbR0qgDpRA-PqrGKrn5k1eg307kH2rl9p22MdoCyu3lxkexOWtV7js5rhuZDZj2cg9MceAOcCe';
  const isSandbox = (env.PAYPAL_MODE || '').toLowerCase() === 'sandbox';
  const paypalBaseUrl = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized: missing session token' }), {
      status: 401,
      headers: corsHeaders
    });
  }

  const token = authHeader.substring(7);
  const supabase = getSupabasePublicConfig(env);
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: corsHeaders
    });
  }
  const { supabaseUrl, supabaseKey } = supabase;

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized session' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const userData = await userRes.json();
    const userId = userData.id;

    const payload = await request.json().catch(() => ({}));
    const orderId = payload.orderId;

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Missing orderId' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // 1. Get PayPal OAuth2 Token
    const basicAuth = btoa(`${paypalClientId}:${paypalSecret}`);
    const tokenRes = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('PayPal token error:', errText);
      return new Response(JSON.stringify({ error: 'Failed to authenticate with PayPal' }), {
        status: 502,
        headers: corsHeaders
      });
    }

    const tokenData = await tokenRes.json();
    const paypalAccessToken = tokenData.access_token;

    // 2. Capture the PayPal Order
    const captureRes = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paypalAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const captureData = await captureRes.json().catch(() => ({}));
    const status = captureData.status;

    if (status === 'COMPLETED' || status === 'APPROVED') {
      // 3. Grant Lifetime PRO Entitlement in Supabase
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/user_profiles?user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          is_premium: true,
          premium_granted_at: new Date().toISOString(),
          premium_source: 'paypal_lifetime',
          updated_at: new Date().toISOString()
        })
      });

      if (!updateRes.ok) {
        console.warn('Could not update user profile with premium:', await updateRes.text());
      }

      return new Response(JSON.stringify({ success: true, status: 'COMPLETED', is_premium: true }), {
        status: 200,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ success: false, status: status, details: captureData }), {
      status: 400,
      headers: corsHeaders
    });

  } catch (err) {
    console.error('PayPal capture exception:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
