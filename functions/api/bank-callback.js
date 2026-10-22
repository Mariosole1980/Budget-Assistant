import { validateRequest, corsHeadersFor, getSupabasePublicConfig, getSupabaseServiceConfig } from './_security.js';
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

  const supabasePublic = getSupabasePublicConfig(env);
  const supabaseService = getSupabaseServiceConfig(env);
  if (!supabasePublic.ok || !supabaseService.ok) {
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
    const body = await request.json();
    const { code, bankName } = body;

    if (!code) {
      return new Response(JSON.stringify({ error: 'Missing code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const bankService = new BankService(env);
    const sessionData = await bankService.exchangeSession(code);

    const { supabaseUrl, serviceRoleKey } = supabaseService;

    // 1. Insert into bank_connections
    const connInsertRes = await fetch(`${supabaseUrl}/rest/v1/bank_connections`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_id: userId,
        aspsp_name: bankName || 'Τραπεζικός Λογαριασμός',
        aspsp_country: 'GR',
        session_id: sessionData.sessionId,
        access_valid_until: sessionData.accessValidUntil,
        status: 'active',
        last_synced_at: new Date().toISOString()
      })
    });

    if (!connInsertRes.ok) {
      const errBody = await connInsertRes.text();
      console.error('[bank-callback] Failed to insert bank_connection:', errBody);
      return new Response(JSON.stringify({ error: 'Failed to record connection' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const [connection] = await connInsertRes.json();

    // 2. Insert into bank_accounts
    const accountsToInsert = sessionData.accounts.map(acc => ({
      connection_id: connection.id,
      user_id: userId,
      account_uid: acc.uid,
      iban: acc.iban,
      currency: acc.currency || 'EUR',
      account_name: acc.accountName || `${bankName || 'Bank'} (${acc.iban ? acc.iban.slice(-4) : 'Account'})`,
      balance: acc.balance || 0.0,
      last_synced_at: new Date().toISOString()
    }));

    if (accountsToInsert.length > 0) {
      await fetch(`${supabaseUrl}/rest/v1/bank_accounts`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(accountsToInsert)
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      connectionId: connection.id,
      accounts: accountsToInsert
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[bank-callback] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Callback failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
