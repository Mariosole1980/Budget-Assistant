import { validateRequest, corsHeadersFor, getSupabasePublicConfig, getSupabaseServiceConfig } from './_security.js';
import { BankService, importBankTransactions, psuHeadersFromRequest } from './_bank_service.js';

/**
 * The bank authorization code is single-use. When the same callback is delivered
 * twice (WebView + external browser, retried request, user re-opening the deep
 * link, ...) the second exchange fails even though the connection was created by
 * the first one. In that case we reuse the very recent connection so the flow
 * still reports success and still (re)imports the transactions.
 */
async function findRecentlyConnectedBank({ supabaseUrl, serviceRoleKey, userId, bankName }) {
  const headers = {
    'apikey': serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`
  };

  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  try {
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/bank_connections?user_id=eq.${encodeURIComponent(userId)}` +
      `&status=eq.active&last_synced_at=gte.${cutoff}` +
      `&select=id,aspsp_name,last_synced_at&order=last_synced_at.desc&limit=5`,
      { headers }
    );
    if (!connRes.ok) return null;

    const conns = await connRes.json();
    if (!Array.isArray(conns) || conns.length === 0) return null;

    const wanted = String(bankName || '').toLowerCase().trim();
    const conn = (wanted && conns.find(c => String(c.aspsp_name || '').toLowerCase().includes(wanted))) || conns[0];

    const accRes = await fetch(
      `${supabaseUrl}/rest/v1/bank_accounts?connection_id=eq.${encodeURIComponent(conn.id)}` +
      `&select=id,account_uid,account_name,currency,balance`,
      { headers }
    );
    const accounts = accRes.ok ? await accRes.json() : [];

    return {
      connectionId: conn.id,
      aspspName: conn.aspsp_name,
      accounts: Array.isArray(accounts) ? accounts : []
    };
  } catch (e) {
    console.warn('[bank-callback] Existing connection lookup failed:', e);
    return null;
  }
}

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

  let { code, bankName, state } = body || {};

  // The `state` blob produced by /api/bank-auth is { userId, bankName, timestamp }.
  // It is needed twice: to recover the user when the flow returns through an
  // external browser (no Authorization header) and to recover the bank name when
  // the bounce page cannot provide it (otherwise the connection is stored as a
  // generic "Bank" and later name-based lookups fail).
  let parsedState = null;
  if (state) {
    if (typeof state !== 'string') {
      parsedState = state;
    } else {
      try {
        parsedState = JSON.parse(state);
      } catch (e) {
        try {
          parsedState = JSON.parse(decodeURIComponent(state));
        } catch (e2) {
          parsedState = null;
        }
      }
    }
  }

  if (parsedState && parsedState.bankName && !bankName) {
    bankName = String(parsedState.bankName);
  }

  // Resilient fallback: if Bearer token was absent (user returned via external browser),
  // extract and verify userId from state
  if (!userId && parsedState && parsedState.userId && parsedState.timestamp) {
    const ageMs = Date.now() - Number(parsedState.timestamp);
    // Valid for up to 30 minutes
    if (ageMs >= 0 && ageMs < 30 * 60 * 1000) {
      userId = parsedState.userId;
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
    const bankService = new BankService(env, { psuHeaders: psuHeadersFromRequest(request) });
    const { supabaseUrl, serviceRoleKey } = supabaseService;
    const aspspCountry = String((parsedState && parsedState.country) || 'GR').trim().toUpperCase();

    let sessionData = null;

    try {
      sessionData = await bankService.exchangeSession(code);
    } catch (exchangeErr) {
      console.warn('[bank-callback] Code exchange failed:', exchangeErr.message);

      const recent = await findRecentlyConnectedBank({ supabaseUrl, serviceRoleKey, userId, bankName });
      if (!recent) throw exchangeErr;

      // The connection already exists (code was consumed by an earlier callback
      // delivery) → import whatever is missing and report success.
      const imported = await importBankTransactions({
        supabaseUrl,
        serviceRoleKey,
        userId,
        bankService,
        bankAccounts: recent.accounts
      });

      return new Response(JSON.stringify({
        ok: true,
        alreadyConnected: true,
        connectionId: recent.connectionId,
        aspspName: recent.aspspName,
        accounts: recent.accounts,
        syncedCount: imported.syncedCount
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
          aspsp_country: aspspCountry,
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

    // If the bank returned 0 authorized accounts or cards (user did not tick any checkbox on bank portal)
    if (!sessionData.accounts || sessionData.accounts.length === 0) {
      return new Response(JSON.stringify({
        ok: true,
        warning: 'NO_ACCOUNTS_SELECTED',
        message: 'Η σύνδεση εγκρίθηκε, αλλά δεν επιλέχθηκε κανένας λογαριασμός ή κάρτα στη σελίδα της τράπεζας. Παρακαλούμε συνδεθείτε ξανά και επιλέξτε (τικ) τον λογαριασμό ή την κάρτα σας.',
        connectionId: connectionId,
        accounts: [],
        syncedCount: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Link or create accounts in public.accounts AND record in public.bank_accounts
    const accountsProcessed = [];
    for (const acc of sessionData.accounts) {
      const isCard = Boolean(acc.isCard || acc.accountType === 'card');
      const fallbackName = isCard
        ? `${bankName || 'Κάρτα'} (•••• ${acc.cardMask || 'Κάρτα'})`
        : `${bankName || 'Τράπεζα'} (${acc.iban ? acc.iban.slice(-4) : 'Λογαριασμός'})`;
      const displayName = acc.accountName || fallbackName;
      const balanceVal = typeof acc.balance === 'number' ? acc.balance : 0.0;
      const appAccType = isCard ? 'card' : 'bank';
      const appAccColor = isCard ? '#f59e0b' : '#00D2FF';
      const appAccIcon = isCard ? 'fa-credit-card' : 'fa-university';

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
          if (balanceVal !== 0) {
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
            type: appAccType,
            balance: balanceVal,
            user_id: userId,
            currency: acc.currency || 'EUR',
            is_active: true,
            color: appAccColor,
            icon: appAccIcon
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
      const bankAccIban = acc.iban || (isCard && acc.cardMask ? `CARD-****${acc.cardMask}` : null);
      const bankAccRecord = {
        connection_id: connectionId,
        user_id: userId,
        account_uid: acc.uid,
        iban: bankAccIban,
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

    // 3. Import the first batch of transactions right away so the user sees data
    //    even if the client never comes back (lost deep link, killed app, ...).
    const imported = await importBankTransactions({
      supabaseUrl,
      serviceRoleKey,
      userId,
      bankService,
      bankAccounts: accountsProcessed
    });

    return new Response(JSON.stringify({
      ok: true,
      alreadyConnected: false,
      connectionId: connectionId,
      accounts: accountsProcessed,
      syncedCount: imported.syncedCount
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
