import { validateRequest, corsHeadersFor, getSupabasePublicConfig, getSupabaseServiceConfig } from './_security.js';

export async function onRequestOptions(context) {
  const { request } = context;
  const corsHeaders = corsHeadersFor(request, {
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  });
  if (!corsHeaders) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const sec = validateRequest(request);
  if (!sec.ok) {
    return new Response(sec.body, { status: sec.status, headers: sec.headers });
  }
  const corsHeaders = sec.headers;

  const supabasePublic = getSupabasePublicConfig(env);
  const supabaseService = getSupabaseServiceConfig(env);
  if (!supabasePublic || !supabaseService) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  const token = authHeader.substring(7);

  let userId;
  try {
    const userRes = await fetch(`${supabasePublic.supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': supabasePublic.supabaseKey,
        'Authorization': `Bearer ${token}`
      }
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userData = await userRes.json();
    userId = userData.id;
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Auth failed' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { supabaseUrl, serviceRoleKey } = supabaseService;

    // Fetch user's bank connections and nested bank accounts
    const connsRes = await fetch(`${supabaseUrl}/rest/v1/bank_connections?user_id=eq.${encodeURIComponent(userId)}&select=*,bank_accounts(*)`, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });

    if (!connsRes.ok) {
      const errText = await connsRes.text();
      throw new Error(`Failed to query bank connections: ${errText}`);
    }

    const connections = await connsRes.json();

    return new Response(JSON.stringify({ connections: connections || [] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[bank-connections] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to list connections' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;

  const sec = validateRequest(request);
  if (!sec.ok) {
    return new Response(sec.body, { status: sec.status, headers: sec.headers });
  }
  const corsHeaders = sec.headers;

  const supabasePublic = getSupabasePublicConfig(env);
  const supabaseService = getSupabaseServiceConfig(env);
  if (!supabasePublic || !supabaseService) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  const token = authHeader.substring(7);

  let userId;
  try {
    const userRes = await fetch(`${supabasePublic.supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': supabasePublic.supabaseKey,
        'Authorization': `Bearer ${token}`
      }
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userData = await userRes.json();
    userId = userData.id;
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Auth failed' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const connectionId = url.searchParams.get('id');

  if (!connectionId) {
    return new Response(JSON.stringify({ error: 'Missing connection id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { supabaseUrl, serviceRoleKey } = supabaseService;

    // Delete bank_connection (cascade deletes bank_accounts)
    const delRes = await fetch(`${supabaseUrl}/rest/v1/bank_connections?id=eq.${encodeURIComponent(connectionId)}&user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });

    if (!delRes.ok) {
      const errText = await delRes.text();
      throw new Error(`Failed to delete connection: ${errText}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[bank-connections] Delete error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to delete' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
