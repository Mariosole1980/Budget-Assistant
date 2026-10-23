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
  const corsHeaders = sec.headers;

  const supabasePublic = getSupabasePublicConfig(env);
  const supabaseService = getSupabaseServiceConfig(env);
  if (!supabasePublic || !supabaseService) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let userId = null;
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const userRes = await fetch(`${supabasePublic.supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
          'apikey': supabasePublic.supabaseKey,
          'Authorization': `Bearer ${token}`
        }
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        userId = userData.id;
      }
    } catch (_) {}
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { code, bankName, state } = body || {};

  // Resilient fallback: if Bearer token was absent (user returned via external browser),
  // extract and verify userId from state
  if (!userId && state) {
    try {
      const parsedState = typeof state === 'string' ? JSON.parse(state) : state;
      if (parsedState && parsedState.userId && parsedState.timestamp) {
        const ageMs = Date.now() - Number(parsedState.timestamp);
        // Valid for up to 30 minutes
        if (ageMs >= 0 && ageMs < 30 * 60 * 1000) {
          userId = parsedState.userId;
        }
      }
    } catch (e) {
      console.warn('[bank-callback] State fallback parse error:', e);
    }
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Valid session or state required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const bankService = new BankService(env);
    const sessionData = await bankService.exchangeSession(code);

    const { supabaseUrl, serviceRoleKey } = supabaseService;

    // 1. Insert or update bank_connections
    let connectionId = null;
    const existingConnRes = await fetch(`${supabaseUrl}/rest/v1/bank_connections?user_id=eq.${encodeURIComponent(userId)}&aspsp_name=eq.${encodeURIComponent(bankName || 'Bank')}&select=id`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });

    if (existingConnRes.ok) {
      const existingConns = await existingConnRes.json();
      if (Array.isArray(existingConns) && existingConns.length > 0) {
        connectionId = existingConns[0].id;
        await fetch(`${supabaseUrl}/rest/v1/bank_connections?id=eq.${encodeURIComponent(connectionId)}`, {
          method: 'PATCH',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            session_id: sessionData.sessionId,
            access_valid_until: sessionData.accessValidUntil,
            status: 'active',
            last_synced_at: new Date().toISOString()
          })
        });
      }
    }

    if (!connectionId) {
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
      connectionId = connection.id;
    }

    // 2. Link or create accounts in public.accounts AND record in public.bank_accounts
    const accountsProcessed = [];
    for (const acc of sessionData.accounts) {
      const displayName = acc.accountName || `${bankName || 'Τράπεζα'} (${acc.iban ? acc.iban.slice(-4) : 'Λογαριασμός'})`;
      const balanceVal = typeof acc.balance === 'number' ? acc.balance : 0.0;

      // 2a. Check if account already exists in public.accounts for this user
      let appAccountId = null;
      const appAccCheckRes = await fetch(`${supabaseUrl}/rest/v1/accounts?user_id=eq.${encodeURIComponent(userId)}&name=eq.${encodeURIComponent(displayName)}&select=id`, {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        }
      });

      if (appAccCheckRes.ok) {
        const appAccs = await appAccCheckRes.json();
        if (Array.isArray(appAccs) && appAccs.length > 0) {
          appAccountId = appAccs[0].id;
          if (balanceVal > 0) {
            await fetch(`${supabaseUrl}/rest/v1/accounts?id=eq.${encodeURIComponent(appAccountId)}`, {
              method: 'PATCH',
              headers: {
                'apikey': serviceRoleKey,
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ balance: balanceVal })
            });
          }
        }
      }

      // If no account exists in public.accounts, create one so it appears in the app!
      if (!appAccountId) {
        const createAccRes = await fetch(`${supabaseUrl}/rest/v1/accounts`, {
          method: 'POST',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            name: displayName,
            type: 'bank',
            balance: balanceVal,
            user_id: userId,
            currency: acc.currency || 'EUR',
            is_active: true
          })
        });

        if (createAccRes.ok) {
          const [newAppAcc] = await createAccRes.json();
          appAccountId = newAppAcc.id;
        } else {
          console.warn('[bank-callback] Failed to create public.accounts entry:', await createAccRes.text());
        }
      }

      // 2b. Insert or update in public.bank_accounts
      const bankAccRecord = {
        connection_id: connectionId,
        user_id: userId,
        account_uid: acc.uid,
        iban: acc.iban,
        currency: acc.currency || 'EUR',
        account_name: displayName,
        balance: balanceVal,
        linked_app_account_id: appAccountId,
        last_synced_at: new Date().toISOString()
      };

      const checkBankAcc = await fetch(`${supabaseUrl}/rest/v1/bank_accounts?account_uid=eq.${encodeURIComponent(acc.uid)}&user_id=eq.${encodeURIComponent(userId)}&select=id`, {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        }
      });

      if (checkBankAcc.ok) {
        const existingBankAccs = await checkBankAcc.json();
        if (Array.isArray(existingBankAccs) && existingBankAccs.length > 0) {
          await fetch(`${supabaseUrl}/rest/v1/bank_accounts?id=eq.${encodeURIComponent(existingBankAccs[0].id)}`, {
            method: 'PATCH',
            headers: {
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(bankAccRecord)
          });
        } else {
          await fetch(`${supabaseUrl}/rest/v1/bank_accounts`, {
            method: 'POST',
            headers: {
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(bankAccRecord)
          });
        }
      }

      accountsProcessed.push(bankAccRecord);
    }

    return new Response(JSON.stringify({
      ok: true,
      connectionId: connectionId,
      accounts: accountsProcessed
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
