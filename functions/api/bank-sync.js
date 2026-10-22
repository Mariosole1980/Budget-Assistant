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

function inferCategoryFromDescription(desc, isIncome) {
  if (isIncome) {
    const s = desc.toLowerCase();
    if (s.includes('μισθοδοσ') || s.includes('salary') || s.includes('payroll')) return 'Μισθός';
    if (s.includes('ενοικ') || s.includes('rent')) return 'Ενοίκια';
    if (s.includes('επιστροφ') || s.includes('refund') || s.includes('cashback')) return 'Cashback / Επιστροφή';
    return 'Άλλα Έσοδα';
  }

  const s = desc.toLowerCase();
  // Supermarkets
  if (s.includes('sklavenitis') || s.includes('σκλαβενιτ') || s.includes('ab ') || s.includes('vassilopoulos') ||
      s.includes('βασιλοπουλ') || s.includes('lidl') || s.includes('mymarket') || s.includes('masoutis') ||
      s.includes('μασουτ') || s.includes('market in') || s.includes('galaxias') || s.includes('γαλαξιας') ||
      s.includes('bazaar') || s.includes('supermarket') || s.includes('σουπερ μαρκετ')) {
    return 'Σούπερ Μάρκετ';
  }
  // Coffee & Dining
  if (s.includes('coffee') || s.includes('kafe') || s.includes('everest') || s.includes('gregorys') ||
      s.includes('mikel') || s.includes('starbucks') || s.includes('flocaf') || s.includes('e-food') ||
      s.includes('efood') || s.includes('wolt') || s.includes('σουβλακ') || s.includes('pizza') ||
      s.includes('tavern') || s.includes('restaurant') || s.includes('burger')) {
    return 'Φαγητό';
  }
  // Transport & Fuel
  if (s.includes('eko') || s.includes('shell') || s.includes('bp ') || s.includes('avet') ||
      s.includes('avinoil') || s.includes('revoil') || s.includes('cyclon') || s.includes('βενζιν') ||
      s.includes('fuel') || s.includes('oasa') || s.includes('attiki odos') || s.includes('διοδια') ||
      s.includes('taxi') || s.includes('uber') || s.includes('freenow')) {
    return 'Μετακινήσεις';
  }
  // Bills & Utilities
  if (s.includes('dei') || s.includes('δεη') || s.includes('protergia') || s.includes('heron') ||
      s.includes('ηρων') || s.includes('cosmote') || s.includes('vodafone') || s.includes('nova') ||
      s.includes('eydap') || s.includes('ευδαπ') || s.includes('dpa') || s.includes('enoseis') ||
      s.includes('ote') || s.includes('wind')) {
    return 'Λογαριασμοί';
  }
  // Health
  if (s.includes('pharm') || s.includes('φαρμακ') || s.includes('doctor') || s.includes('iatreio') ||
      s.includes('ιατρ') || s.includes('dentist') || s.includes('νοσοκομ')) {
    return 'Υγεία';
  }
  // Entertainment & Shopping
  if (s.includes('netflix') || s.includes('spotify') || s.includes('cinema') || s.includes('village') ||
      s.includes('theatre') || s.includes('zara') || s.includes('h&m') || s.includes('public') ||
      s.includes('plaisio') || s.includes('amazon') || s.includes('skroutz')) {
    return 'Ψώνια';
  }

  return 'Γενικά Έξοδα';
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
    const { supabaseUrl, serviceRoleKey } = supabaseService;
    const bankService = new BankService(env);

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

    const accounts = await acctsRes.json();
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return new Response(JSON.stringify({
        ok: true,
        message: 'No bank accounts found. Please connect your bank first.',
        syncedCount: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let totalSynced = 0;
    const newTransactionsCreated = [];

    for (const acct of accounts) {
      try {
        const rawTxs = await bankService.getAccountTransactions(acct.account_uid);
        if (!Array.isArray(rawTxs) || rawTxs.length === 0) continue;

        // Fetch existing bank transaction IDs for deduplication
        const txIds = rawTxs.map(t => t.transactionId).filter(Boolean);
        const existingTxRes = await fetch(`${supabaseUrl}/rest/v1/transactions?user_id=eq.${encodeURIComponent(userId)}&bank_transaction_id=in.(${txIds.map(encodeURIComponent).join(',')})&select=bank_transaction_id`, {
          method: 'GET',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`
          }
        });

        let existingSet = new Set();
        if (existingTxRes.ok) {
          const existingRows = await existingTxRes.json();
          existingRows.forEach(r => existingSet.add(r.bank_transaction_id));
        }

        const candidateTxs = rawTxs.filter(t => !existingSet.has(t.transactionId));

        for (const t of candidateTxs) {
          const isIncome = t.amount > 0;
          const absAmount = Math.abs(t.amount);
          const category = inferCategoryFromDescription(t.description || '', isIncome);
          const accountName = acct.account_name || 'Τράπεζα';

          const newTx = {
            user_id: userId,
            date: t.date,
            type: isIncome ? 'income' : 'expense',
            amount: absAmount,
            category: category,
            account_from: accountName,
            note: t.description || 'Τραπεζική Συναλλαγή',
            currency: t.currency || 'EUR',
            bank_transaction_id: t.transactionId,
            bank_account_uid: acct.account_uid,
            status: 'active'
          };

          const insertRes = await fetch(`${supabaseUrl}/rest/v1/transactions`, {
            method: 'POST',
            headers: {
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(newTx)
          });

          if (insertRes.ok) {
            const [created] = await insertRes.json();
            newTransactionsCreated.push(created);
            totalSynced++;
          }
        }

        // Update last_synced_at on bank_account
        await fetch(`${supabaseUrl}/rest/v1/bank_accounts?id=eq.${encodeURIComponent(acct.id)}`, {
          method: 'PATCH',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ last_synced_at: new Date().toISOString() })
        });
      } catch (acctErr) {
        console.warn(`[bank-sync] Error syncing account ${acct.account_uid}:`, acctErr);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      syncedCount: totalSynced,
      transactions: newTransactionsCreated
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
