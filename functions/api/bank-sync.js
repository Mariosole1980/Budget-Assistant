import { validateRequest, corsHeadersFor, getSupabasePublicConfig, getSupabaseServiceConfig } from './_security.js';
import { BankService, importBankTransactions, psuHeadersFromRequest } from './_bank_service.js';

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
    const { supabaseUrl, serviceRoleKey } = supabaseService;
    const bankService = new BankService(env, { psuHeaders: psuHeadersFromRequest(request) });

    // 1. Fetch user's active bank connections & accounts
    const acctsRes = await fetch(`${supabaseUrl}/rest/v1/bank_accounts?user_id=eq.${encodeURIComponent(userId)}&select=*,bank_connections!inner(status,aspsp_name)`, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });

    if (!acctsRes.ok) {
      const errBody = await acctsRes.text();
      throw new Error(`Failed to query bank accounts: ${errBody}`);
    }

    let accounts = await acctsRes.json();
    if (!Array.isArray(accounts)) accounts = [];

    // Auto-recovery: If no bank_accounts exist in DB, discover from active bank_connections
    if (accounts.length === 0) {
      const connsRes = await fetch(`${supabaseUrl}/rest/v1/bank_connections?user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=*`, {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        }
      });
      const conns = (connsRes.ok && (await connsRes.json())) || [];
      let hadEmptySession = false;

      for (const conn of conns) {
        if (!conn.session_id) continue;
        const session = await bankService.getSession(conn.session_id);
        const rawAccounts = (session && Array.isArray(session.accounts_data) && session.accounts_data.length > 0)
          ? session.accounts_data
          : (session && Array.isArray(session.accounts) ? session.accounts : []);

        if (rawAccounts.length === 0) {
          hadEmptySession = true;
          continue;
        }

        for (const rawAcc of rawAccounts) {
          const uid = typeof rawAcc === 'string'
            ? rawAcc
            : (rawAcc && (rawAcc.uid || rawAcc.accountId || rawAcc.account_uid || (rawAcc.account_id && (rawAcc.account_id.iban || rawAcc.account_id.other))));
          if (!uid) continue;

          let bal = 0.0;
          let details = null;
          try {
            bal = await bankService.getAccountBalances(uid);
          } catch (_) {}
          try {
            details = await bankService.getAccountDetails(uid);
          } catch (_) {}

          const iban = (details && details.account_id && details.account_id.iban) ||
                       (rawAcc && typeof rawAcc === 'object' && rawAcc.account_id && rawAcc.account_id.iban) ||
                       (rawAcc && typeof rawAcc === 'object' && rawAcc.iban) || null;
          const currency = (details && details.currency) || (rawAcc && typeof rawAcc === 'object' && rawAcc.currency) || 'EUR';
          const productName = (details && (details.product || details.name)) || (rawAcc && typeof rawAcc === 'object' && (rawAcc.details || rawAcc.name));
          const displayName = productName || (iban ? `Λογαριασμός (${iban.slice(-4)})` : (conn.aspsp_name || 'Τραπεζικός Λογαριασμός'));

          const bankAccRecord = {
            connection_id: conn.id,
            user_id: userId,
            account_uid: String(uid),
            iban,
            currency,
            account_name: displayName,
            balance: bal,
            last_synced_at: new Date().toISOString()
          };

          const insRes = await fetch(`${supabaseUrl}/rest/v1/bank_accounts`, {
            method: 'POST',
            headers: {
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(bankAccRecord)
          });
          if (insRes.ok) {
            const [created] = await insRes.json();
            if (created) accounts.push(created);
          }
        }
      }

      if (accounts.length === 0) {
        const errorMsg = hadEmptySession
          ? 'Δεν βρέθηκαν επιλεγμένοι λογαριασμοί στη σύνδεση. Αποσυνδέστε και επανασυνδέστε την τράπεζα, φροντίζοντας να επιλέξετε (τικ) τον λογαριασμό σας στην οθόνη της τράπεζας.'
          : 'Δεν βρέθηκαν συνδεδεμένοι τραπεζικοί λογαριασμοί. Παρακαλούμε συνδέστε την τράπεζά σας πρώτα.';
        return new Response(JSON.stringify({
          ok: true,
          message: errorMsg,
          warning: hadEmptySession ? 'NO_ACCOUNTS_SELECTED' : undefined,
          syncedCount: 0
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const { syncedCount, transactions, errors } = await importBankTransactions({
      supabaseUrl,
      serviceRoleKey,
      userId,
      bankService,
      bankAccounts: accounts
    });

    return new Response(JSON.stringify({
      ok: true,
      syncedCount,
      transactions,
      errors: errors || []
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[bank-sync] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Sync failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
