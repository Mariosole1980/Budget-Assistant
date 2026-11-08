const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// ---------------------------------------------------------------------------
// Enable Banking integration (provider contract)
//
// These tests cover the requirements that made "some banks" impossible to
// connect, against a mocked Enable Banking API (no network, no credentials):
//   - the ASPSP must be addressed by the exact provider `name` + `country`
//   - the consent must request balances/transactions and never exceed the
//     bank's `maximum_consent_validity`
//   - the PSU type and PSU context headers must reach the provider
//   - transactions must use `credit_debit_indicator` for the sign and follow
//     `continuation_key` pagination
// ---------------------------------------------------------------------------

const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' }
});

const ENV = {
  ENABLE_BANKING_APP_ID: 'test-app-id',
  ENABLE_BANKING_PRIVATE_KEY: privateKey
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function providerMock({ aspsps = [], auth = {}, balances = [], transactionPages = [] } = {}) {
  const calls = [];
  let transactionPage = 0;

  const fetchMock = async (url, options = {}) => {
    const target = String(url);
    const method = String((options && options.method) || 'GET').toUpperCase();
    calls.push({
      url: target,
      method,
      headers: (options && options.headers) || {},
      body: options && options.body ? JSON.parse(options.body) : null
    });

    if (target.includes('/aspsps')) return jsonResponse({ aspsps });
    if (target.endsWith('/auth')) return jsonResponse(auth);
    if (target.includes('/balances')) return jsonResponse({ balances });
    if (target.includes('/transactions')) {
      const page = transactionPages[Math.min(transactionPage, transactionPages.length - 1)] || { transactions: [] };
      transactionPage += 1;
      return jsonResponse(page);
    }
    return jsonResponse({ error: 'not found' }, 404);
  };

  return { calls, fetchMock };
}

async function withProviderMock(mock, run) {
  const originalFetch = global.fetch;
  global.fetch = mock.fetchMock;
  try {
    return await run();
  } finally {
    global.fetch = originalFetch;
  }
}

const GREEK_ASPSPS = [
  {
    name: 'National Bank of Greece',
    country: 'GR',
    maximum_consent_validity: 7776000,
    psu_types: ['personal', 'business'],
    required_psu_headers: ['Psu-Ip-Address'],
    logo: 'https://enablebanking.com/brands/GR/National%20Bank%20of%20Greece/'
  },
  { name: 'Eurobank', country: 'GR', maximum_consent_validity: 7776000 },
  { name: 'Revolut', country: 'GB', maximum_consent_validity: 7776000 }
];

test('startAuth: addresses the exact provider ASPSP and asks for full AIS consent', async () => {
  const { BankService } = await import('../functions/api/_bank_service.js');
  const mock = providerMock({
    aspsps: GREEK_ASPSPS,
    auth: { url: 'https://auth.enablebanking.com/ais/start?sessionid=abc', authorization_id: 'auth-42' }
  });

  const result = await withProviderMock(mock, () => {
    const service = new BankService(ENV);
    return service.startAuth({
      bankName: 'NBG',                      // user-facing alias
      country: 'GR',
      redirectUrl: 'https://www.budgetassistant.org/index.html',
      state: '{"userId":"u1"}',
      psuType: 'business',
      language: 'el',
      psuHeaders: { 'Psu-Ip-Address': '203.0.113.9', 'Psu-User-Agent': 'BudgetAssistant/1.0' }
    });
  });

  const authCall = mock.calls.find((call) => call.method === 'POST' && call.url.endsWith('/auth'));
  assert.ok(authCall, 'expected a POST /auth call');

  // Exact provider identity — not the local display name.
  assert.deepEqual(authCall.body.aspsp, { name: 'National Bank of Greece', country: 'GR' });
  assert.equal(authCall.body.access.balances, true, 'balances consent is required for /balances');
  assert.equal(authCall.body.access.transactions, true, 'transactions consent is required for /transactions');
  assert.equal(authCall.body.psu_type, 'business');
  assert.equal(authCall.body.language, 'el');
  assert.equal(authCall.body.state, '{"userId":"u1"}');
  assert.equal(authCall.body.redirect_url, 'https://www.budgetassistant.org/index.html');

  const consentDays = (Date.parse(authCall.body.access.valid_until) - Date.now()) / 86400000;
  assert.ok(consentDays > 88 && consentDays <= 89, 'expected ~89 days of consent, got ' + consentDays);

  // PSU context must be forwarded or ASPSPs listing required_psu_headers reject it.
  assert.equal(authCall.headers['Psu-Ip-Address'], '203.0.113.9');
  assert.equal(authCall.headers['Psu-User-Agent'], 'BudgetAssistant/1.0');
  assert.match(String(authCall.headers.Authorization || ''), /^Bearer /);

  assert.equal(result.url, 'https://auth.enablebanking.com/ais/start?sessionid=abc');
  assert.equal(result.authorizationId, 'auth-42', '/auth answers with authorization_id, not session_id');
  assert.equal(result.sessionId, 'auth-42');
  assert.deepEqual(result.aspsp, { name: 'National Bank of Greece', country: 'GR' });
});

test('startAuth: never asks for more consent than the bank allows', async () => {
  const { BankService } = await import('../functions/api/_bank_service.js');
  const mock = providerMock({
    aspsps: [{ name: 'Bank of Cyprus', country: 'CY', maximum_consent_validity: 2592000 }], // 30 days
    auth: { url: 'https://auth.enablebanking.com/ais/start?sessionid=cy', authorization_id: 'auth-cy' }
  });

  await withProviderMock(mock, () => {
    const service = new BankService(ENV);
    return service.startAuth({
      bankName: 'Bank of Cyprus',
      country: 'CY',
      redirectUrl: 'https://www.budgetassistant.org/index.html',
      state: 'state'
    });
  });

  const authCall = mock.calls.find((call) => call.method === 'POST' && call.url.endsWith('/auth'));
  const consentDays = (Date.parse(authCall.body.access.valid_until) - Date.now()) / 86400000;

  assert.ok(consentDays > 29 && consentDays <= 30,
    'consent must stay inside the bank\'s 30-day ceiling, got ' + consentDays);
  // Defaults must still be valid values for the provider enums.
  assert.equal(authCall.body.psu_type, 'personal');
  assert.equal(authCall.body.language, 'el');
});

test('startAuth: resolves a bank published under another country (Revolut → GB)', async () => {
  const { BankService } = await import('../functions/api/_bank_service.js');
  const mock = providerMock({
    aspsps: GREEK_ASPSPS,
    auth: { url: 'https://auth.enablebanking.com/ais/start?sessionid=rev', authorization_id: 'auth-rev' }
  });

  const result = await withProviderMock(mock, () => {
    const service = new BankService(ENV);
    // The app always sent country: 'GR' for Revolut, which the provider rejects.
    return service.startAuth({
      bankName: 'Revolut',
      country: 'GR',
      redirectUrl: 'https://www.budgetassistant.org/index.html',
      state: 'state'
    });
  });

  assert.deepEqual(result.aspsp, { name: 'Revolut', country: 'GB' });

  const authCall = mock.calls.find((call) => call.method === 'POST' && call.url.endsWith('/auth'));
  assert.deepEqual(authCall.body.aspsp, { name: 'Revolut', country: 'GB' });
});

test('getAccountTransactions: honours credit_debit_indicator, pagination and order', async () => {
  const { BankService } = await import('../functions/api/_bank_service.js');
  const mock = providerMock({
    transactionPages: [
      {
        continuation_key: 'page-2',
        transactions: [
          {
            entry_reference: 'tx-debit',
            credit_debit_indicator: 'DBIT',
            transaction_amount: { amount: '12.34', currency: 'EUR' },
            status: 'BOOK',
            booking_date: '2026-10-20',
            remittance_information: ['ΣΚΛΑΒΕΝΙΤΗΣ']
          },
          {
            entry_reference: 'tx-credit',
            credit_debit_indicator: 'CRDT',
            transaction_amount: { amount: '1450.00', currency: 'EUR' },
            status: 'BOOK',
            booking_date: '2026-10-22',
            remittance_information: ['ΜΙΣΘΟΔΟΣΙΑ']
          },
          {
            entry_reference: 'tx-pending',
            credit_debit_indicator: 'DBIT',
            transaction_amount: { amount: '9.99', currency: 'EUR' },
            status: 'PEND',
            booking_date: '2026-10-23'
          }
        ]
      },
      {
        transactions: [
          {
            entry_reference: 'tx-older',
            credit_debit_indicator: 'DBIT',
            transaction_amount: { amount: '5.00', currency: 'EUR' },
            status: 'BOOK',
            booking_date: '2026-10-01',
            remittance_information: ['COFFEE ISLAND']
          }
        ]
      }
    ]
  });

  const transactions = await withProviderMock(mock, () => {
    const service = new BankService(ENV);
    return service.getAccountTransactions('acc-1');
  });

  // Direction comes from the indicator: many banks send unsigned amounts.
  const debit = transactions.find((tx) => tx.transactionId === 'tx-debit');
  const credit = transactions.find((tx) => tx.transactionId === 'tx-credit');
  assert.equal(debit.amount, -12.34);
  assert.equal(credit.amount, 1450);

  // Pending rows would be re-published with another entry_reference once booked.
  assert.equal(transactions.some((tx) => tx.transactionId === 'tx-pending'), false);

  // Newest first — importBankTransactions() keeps only the first N rows.
  assert.deepEqual(transactions.map((tx) => tx.transactionId), ['tx-credit', 'tx-debit', 'tx-older']);

  const txCalls = mock.calls.filter((call) => call.url.includes('/transactions'));
  assert.equal(txCalls.length, 2, 'expected the second page to be fetched');
  assert.match(txCalls[0].url, /date_from=\d{4}-\d{2}-\d{2}/);
  assert.equal(txCalls[1].url.includes('continuation_key=page-2'), true);
});

test('getAccountBalances: prefers the booked balance over the available one', async () => {
  const { BankService } = await import('../functions/api/_bank_service.js');
  const mock = providerMock({
    balances: [
      { name: 'Available balance', balance_type: 'ITAV', balance_amount: { amount: '1000.00', currency: 'EUR' } },
      { name: 'Booked balance', balance_type: 'CLBD', balance_amount: { amount: '842.10', currency: 'EUR' } }
    ]
  });

  const balance = await withProviderMock(mock, () => {
    const service = new BankService(ENV);
    return service.getAccountBalances('acc-1');
  });

  assert.equal(balance, 842.10);
});

test('startAuth: reports an unsupported bank instead of sending it to the provider', async () => {
  const { BankService } = await import('../functions/api/_bank_service.js');
  const mock = providerMock({
    aspsps: [{ name: 'Deutsche Bank', country: 'DE', maximum_consent_validity: 7776000 }]
  });

  await assert.rejects(
    withProviderMock(mock, () => {
      const service = new BankService(ENV);
      return service.startAuth({
        bankName: 'Eurobank',
        country: 'DE',
        redirectUrl: 'https://www.budgetassistant.org/index.html',
        state: 'state'
      });
    }),
    (err) => err && err.code === 'ASPSP_NOT_FOUND' && /Eurobank/.test(err.message)
  );

  assert.equal(
    mock.calls.filter((call) => call.url.endsWith('/auth')).length,
    0,
    'an unknown ASPSP must not be sent to POST /auth'
  );
});

test('provider mapping helpers: names, consent ceiling, PSU headers', async () => {
  const {
    canonicalBankKey,
    normalizeBankName,
    computeConsentValidUntil,
    normalizePsuHeaders,
    pickPrimaryBalance,
    mapProviderTransaction
  } = await import('../functions/api/_bank_service.js');

  assert.equal(normalizeBankName('Εθνική Τράπεζα'), normalizeBankName('εθνικη τραπεζα'));
  assert.equal(canonicalBankKey('NBG'), canonicalBankKey('National Bank of Greece'));
  assert.equal(canonicalBankKey('ALPHA BANK S.A.'), canonicalBankKey('Alpha Bank'));
  assert.equal(canonicalBankKey('τράπεζα πειραιώς'), canonicalBankKey('Piraeus Bank'));

  // A short ASPSP ceiling must not be rounded up to the 89-day default.
  const cappedDays = (Date.parse(computeConsentValidUntil(3600)) - Date.now()) / 86400000;
  assert.ok(cappedDays < 0.05, 'a one-hour ceiling must stay about one hour, got ' + cappedDays);

  const fallbackDays = (Date.parse(computeConsentValidUntil(null)) - Date.now()) / 86400000;
  assert.ok(fallbackDays > 88 && fallbackDays <= 89);

  // Header values are sanitised: no CR/LF injection into the provider request.
  assert.deepEqual(normalizePsuHeaders({ 'Psu-Ip-Address': '1.2.3.4\r\nInjected: 1', userAgent: 'UA' }), {
    'Psu-Ip-Address': '1.2.3.4 Injected: 1',
    'Psu-User-Agent': 'UA'
  });
  assert.deepEqual(normalizePsuHeaders(null), {});

  assert.equal(
    pickPrimaryBalance([
      { balance_type: 'ITAV', balance_amount: { amount: '10' } },
      { balance_type: 'CLBD', balance_amount: { amount: '7' } }
    ]).balance_type,
    'CLBD'
  );
  assert.equal(pickPrimaryBalance([]), null);

  // Unsigned provider amount + DBIT indicator = expense.
  assert.equal(
    mapProviderTransaction({
      entry_reference: 'a',
      credit_debit_indicator: 'DBIT',
      transaction_amount: { amount: '3.50' },
      status: 'BOOK',
      booking_date: '2026-10-20'
    }).amount,
    -3.5
  );
  assert.equal(mapProviderTransaction({ status: 'PEND', transaction_amount: { amount: '1' } }), null);
  assert.equal(mapProviderTransaction({ transaction_amount: { amount: '0' } }), null);
});

test('credit card helpers: extractAccountUid, isCardAccount, extractCardMask, formatAccountDisplayName, collectRawAccountsFromSession', async () => {
  const {
    extractAccountUid,
    isCardAccount,
    extractCardMask,
    formatAccountDisplayName,
    collectRawAccountsFromSession
  } = await import('../functions/api/_bank_service.js');

  // 1. extractAccountUid
  assert.equal(extractAccountUid('str-uid-1'), 'str-uid-1');
  assert.equal(extractAccountUid({ uid: 'uid-2' }), 'uid-2');
  assert.equal(extractAccountUid({ id: 'id-3' }), 'id-3');
  assert.equal(extractAccountUid({ resource_id: 'res-4' }), 'res-4');
  assert.equal(extractAccountUid({ card_id: 'card-5' }), 'card-5');
  assert.equal(extractAccountUid({ account_id: { iban: 'GR12345' } }), 'GR12345');
  assert.equal(extractAccountUid({ account_id: { masked_pan: '4532XXXXXXXX1234' } }), '4532XXXXXXXX1234');
  assert.equal(extractAccountUid({ account_id: { other: { identification: 'ident-6' } } }), 'ident-6');
  assert.equal(extractAccountUid({ masked_pan: '************5678' }), '************5678');
  assert.equal(extractAccountUid(null), null);

  // 2. isCardAccount
  assert.equal(isCardAccount({ cash_account_type: 'CARD' }), true);
  assert.equal(isCardAccount({ account_type: 'CREDIT_CARD' }), true);
  assert.equal(isCardAccount({ product: 'Visa Gold' }), true);
  assert.equal(isCardAccount({ details: 'Πιστωτική Κάρτα Eurobank' }), true);
  assert.equal(isCardAccount({ account_id: { masked_pan: '4532XXXXXXXX9999' } }), true);
  assert.equal(isCardAccount({ cash_account_type: 'CACC', iban: 'GR111' }), false);

  // 3. extractCardMask
  assert.equal(extractCardMask({ account_id: { masked_pan: '4532XXXXXXXX1234' } }), '1234');
  assert.equal(extractCardMask({ masked_pan: '************7890' }), '7890');
  assert.equal(extractCardMask({ iban: 'GR111' }), null);

  // 4. formatAccountDisplayName
  assert.equal(
    formatAccountDisplayName({ cash_account_type: 'CARD', masked_pan: '************1234' }, {}, 'Eurobank'),
    'Eurobank Πιστωτική Κάρτα (•••• 1234)'
  );
  assert.equal(
    formatAccountDisplayName({ product: 'Visa Platinum', masked_pan: '************5678' }),
    'Visa Platinum (•••• 5678)'
  );
  assert.equal(
    formatAccountDisplayName({ iban: 'GR12345678901234' }),
    'Λογαριασμός (1234)'
  );

  // 5. collectRawAccountsFromSession
  const sessionWithCardsOnly = {
    accounts: [],
    card_accounts: [
      { uid: 'card-uid-1', cash_account_type: 'CARD', masked_pan: '************1111' }
    ]
  };
  const collectedCards = collectRawAccountsFromSession(sessionWithCardsOnly);
  assert.equal(collectedCards.length, 1);
  assert.equal(collectedCards[0].uid, 'card-uid-1');

  const sessionMixed = {
    accounts: [
      { uid: 'acc-1', iban: 'GR111' }
    ],
    card_accounts: [
      { uid: 'card-1', masked_pan: '************2222' }
    ]
  };
  const collectedMixed = collectRawAccountsFromSession(sessionMixed);
  assert.equal(collectedMixed.length, 2);

  // Deduplication
  const sessionDupes = {
    accounts: [{ uid: 'same-uid' }],
    card_accounts: [{ uid: 'same-uid' }]
  };
  assert.equal(collectRawAccountsFromSession(sessionDupes).length, 1);
});

test('importBankTransactions: keeps syncing other accounts but reports the failed ones', async () => {
  const { importBankTransactions } = await import('../functions/api/_bank_service.js');

  const supabaseUrl = 'https://supabase.test';
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    const method = String(options.method || 'GET').toUpperCase();
    calls.push({ url: target, method });

    if (target.includes('/rest/v1/transactions') && method === 'GET') return jsonResponse([]);
    if (target.includes('/rest/v1/transactions') && method === 'POST') {
      const rows = JSON.parse(options.body);
      const list = Array.isArray(rows) ? rows : [rows];
      return jsonResponse(list.map((row, i) => ({ id: `row-${i}`, ...row })));
    }
    if (target.includes('/rest/v1/bank_accounts')) return new Response(null, { status: 204 });
    return jsonResponse({ error: 'not found' }, 404);
  };

  // The first account fails exactly like an expired/insufficient consent does.
  const consentError = new Error('Enable Banking transactions failed (403): access_denied');
  consentError.providerStatus = 403;
  const bankService = {
    getAccountTransactions: async (uid) => {
      if (uid === 'acc-bad') throw consentError;
      return [{
        transactionId: 'tx-good-1',
        amount: -12.5,
        date: '2026-10-20',
        description: 'ΣΚΛΑΒΕΝΙΤΗΣ',
        currency: 'EUR'
      }];
    }
  };

  try {
    const result = await importBankTransactions({
      supabaseUrl,
      serviceRoleKey: 'service-key',
      userId: 'user-1',
      bankService,
      bankAccounts: [
        { id: 'id-bad', account_uid: 'acc-bad', account_name: 'Διαθέσιμο' },
        { id: 'id-good', account_uid: 'acc-good', account_name: 'Τρεχούμενος' }
      ]
    });

    // The healthy account is still imported...
    assert.equal(result.syncedCount, 1);
    assert.equal(result.transactions.length, 1);
    assert.equal(result.transactions[0].bank_transaction_id, 'tx-good-1');
    assert.equal(result.transactions[0].type, 'expense');
    assert.equal(result.transactions[0].amount, 12.5);

    // ...while the failure is surfaced so the UI does not claim "up to date".
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].account_uid, 'acc-bad');
    assert.equal(result.errors[0].status, 403);
    assert.match(result.errors[0].message, /403/);

    const synced = calls.filter(c => c.method === 'PATCH' && c.url.includes('/bank_accounts'));
    assert.equal(synced.length, 1);
    assert.match(synced[0].url, /id=eq\.id-good/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('bank-institutions: returns the live provider catalogue with its source', async () => {
  const { onRequestGet } = await import('../functions/api/bank-institutions.js');

  // A country no earlier test touched: the ASPSP catalogue is cached per
  // isolate for an hour, keyed by country, so a fresh key guarantees a live call.
  const mock = providerMock({
    aspsps: [
      { name: 'Intesa Sanpaolo', country: 'IT', maximum_consent_validity: 7776000 },
      { name: 'UniCredit', country: 'IT', maximum_consent_validity: 7776000 }
    ]
  });

  await withProviderMock(mock, async () => {
    const res = await onRequestGet({
      request: new Request('https://www.budgetassistant.org/api/bank-institutions?country=it', {
        headers: { Origin: 'https://www.budgetassistant.org' }
      }),
      env: ENV
    });

    assert.equal(res.status, 200);
    assert.match(res.headers.get('Cache-Control') || '', /max-age=300/);

    const body = await res.json();
    assert.equal(body.configured, true);
    assert.equal(body.source, 'provider');
    assert.equal(body.institutions.length, 2);
    assert.ok(body.institutions.some(b => b.name === 'UniCredit' && b.country === 'IT'));

    // The country from the query string reaches the provider catalogue request.
    const aspspCall = mock.calls.find(c => c.url.includes('/aspsps'));
    assert.ok(aspspCall, 'the provider catalogue must be requested');
    assert.match(aspspCall.url, /country=IT/);
  });
});
