const test = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Tests for the Enable Banking callback endpoint (functions/api/bank-callback.js)
//
// The endpoint is the single place where a bank authorization code is exchanged
// for a session and stored in Supabase, so it is also the place that must stay
// correct when the callback is delivered more than once (deep link + web bounce
// page + launch URL). These tests run the real handler against a mocked
// Supabase REST API, so no network access or credentials are required.
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://project.supabase.co';
const CALLBACK_URL = 'https://www.budgetassistant.org/api/bank-callback';

// Enable Banking credentials are intentionally absent: BankService then uses its
// documented sandbox behaviour, which keeps the handler path deterministic.
const BASE_ENV = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Mock of global fetch that emulates the Supabase REST endpoints touched by the
 * callback: bank_connections, accounts, bank_accounts and transactions.
 *
 * `recentConnection` makes the "code was already consumed" lookup return a row,
 * which is how a duplicate delivery is detected server-side.
 */
function makeFetchMock({ recentConnection = null } = {}) {
  const calls = [];

  const fetchMock = async (url, options = {}) => {
    const target = String(url);
    const method = String(options.method || 'GET').toUpperCase();
    calls.push({
      url: target,
      method,
      body: options.body ? JSON.parse(options.body) : null
    });

    if (target.includes('/rest/v1/bank_connections')) {
      if (method === 'GET') {
        // findRecentlyConnectedBank() is the only lookup that filters on a
        // recent last_synced_at window.
        if (target.includes('last_synced_at=gte.')) {
          return jsonResponse(recentConnection ? [recentConnection] : []);
        }
        return jsonResponse([]);
      }
      if (method === 'POST') return jsonResponse([{ id: 'conn-1' }]);
      return jsonResponse({});
    }

    if (target.includes('/rest/v1/bank_accounts')) {
      if (method === 'GET') return jsonResponse([]);
      if (method === 'POST') return jsonResponse([{ id: 'bank-acc-1' }]);
      return jsonResponse({});
    }

    if (target.includes('/rest/v1/accounts')) {
      if (method === 'GET') return jsonResponse([]);
      if (method === 'POST') return jsonResponse([{ id: 'app-acc-1' }]);
      return jsonResponse({});
    }

    if (target.includes('/rest/v1/transactions')) {
      if (method === 'GET') return jsonResponse([]);
      if (method === 'POST') return jsonResponse([{ id: 'tx-1' }]);
      return jsonResponse({});
    }

    return jsonResponse({ error: 'unexpected request: ' + target }, 500);
  };

  return { fetchMock, calls };
}

function makeRequest(body) {
  const raw = JSON.stringify(body);
  return new Request(CALLBACK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(raw)),
      Origin: 'https://www.budgetassistant.org',
      'CF-Connecting-IP': '203.0.113.10'
    },
    body: raw
  });
}

async function runWithMockedFetch({ mockOptions = {}, env = BASE_ENV, body }) {
  const { fetchMock, calls } = makeFetchMock(mockOptions);
  const originalFetch = global.fetch;
  global.fetch = fetchMock;
  try {
    const { onRequestPost } = await import('../functions/api/bank-callback.js');
    const response = await onRequestPost({ request: makeRequest(body), env });
    const payload = await response.json();
    return { response, payload, calls };
  } finally {
    global.fetch = originalFetch;
  }
}

test('bank-callback: creates the connection from the state blob when no Bearer token is present', async () => {
  const state = JSON.stringify({ userId: 'user-1', bankName: 'Eurobank', timestamp: Date.now() });

  const { response, payload, calls } = await runWithMockedFetch({
    body: { code: 'auth-code-1', state }
  });

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.alreadyConnected, false);
  assert.equal(payload.connectionId, 'conn-1');

  const connectionInsert = calls.find(
    (call) => call.method === 'POST' && call.url.endsWith('/rest/v1/bank_connections')
  );
  assert.ok(connectionInsert, 'expected the handler to insert a bank_connections row');
  assert.equal(connectionInsert.body.user_id, 'user-1');
  assert.equal(connectionInsert.body.aspsp_name, 'Eurobank');
  assert.equal(connectionInsert.body.status, 'active');

  const transactionInsert = calls.find(
    (call) => call.method === 'POST' && call.url.endsWith('/rest/v1/transactions')
  );
  assert.ok(transactionInsert, 'expected the handler to import the first transaction batch');
  assert.ok(Array.isArray(transactionInsert.body));
  assert.equal(transactionInsert.body[0].user_id, 'user-1');
  assert.equal(payload.syncedCount, 1);
});

test('bank-callback: derives the bank name from state when the body omits it', async () => {
  const state = JSON.stringify({ userId: 'user-2', bankName: 'Piraeus Bank', timestamp: Date.now() });

  const { response, payload, calls } = await runWithMockedFetch({
    body: { code: 'auth-code-2', state }
  });

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);

  const connectionInsert = calls.find(
    (call) => call.method === 'POST' && call.url.endsWith('/rest/v1/bank_connections')
  );
  assert.equal(connectionInsert.body.aspsp_name, 'Piraeus Bank');
});

test('bank-callback: rejects a callback without a token or a parseable state blob', async () => {
  const { response, payload, calls } = await runWithMockedFetch({
    body: { code: 'auth-code-3' }
  });

  assert.equal(response.status, 401);
  assert.match(payload.error, /Unauthorized/);
  assert.equal(calls.length, 0, 'nothing may be written when the user cannot be identified');
});

test('bank-callback: rejects an expired state blob (older than 30 minutes)', async () => {
  const expiredState = JSON.stringify({
    userId: 'user-3',
    bankName: 'Eurobank',
    timestamp: Date.now() - 31 * 60 * 1000
  });

  const { response } = await runWithMockedFetch({ body: { code: 'auth-code-4', state: expiredState } });

  assert.equal(response.status, 401);
});

test('bank-callback: duplicate delivery reports the existing connection instead of failing', async () => {
  // A bogus Enable Banking key makes getJwt() throw, which emulates the second
  // delivery of a code that was already exchanged by the first one.
  const state = JSON.stringify({ userId: 'user-4', bankName: 'Eurobank', timestamp: Date.now() });

  const { response, payload, calls } = await runWithMockedFetch({
    mockOptions: {
      recentConnection: {
        id: 'conn-9',
        aspsp_name: 'Eurobank',
        last_synced_at: new Date().toISOString()
      }
    },
    env: {
      ...BASE_ENV,
      ENABLE_BANKING_APP_ID: 'app-id',
      ENABLE_BANKING_PRIVATE_KEY: 'not-a-valid-pem'
    },
    body: { code: 'already-used-code', state }
  });

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.alreadyConnected, true);
  assert.equal(payload.connectionId, 'conn-9');
  assert.equal(payload.aspspName, 'Eurobank');

  const connectionInsert = calls.find(
    (call) => call.method === 'POST' && call.url.endsWith('/rest/v1/bank_connections')
  );
  assert.equal(connectionInsert, undefined, 'a duplicate delivery must not create a second connection');
});

test('bank-callback: credit card account is linked with type card and card icon', async () => {
  const state = JSON.stringify({ userId: 'user-card-1', bankName: 'Eurobank', timestamp: Date.now() });

  const { fetchMock, calls } = makeFetchMock();
  const originalFetch = global.fetch;
  global.fetch = fetchMock;

  try {
    const { BankService } = await import('../functions/api/_bank_service.js');
    const origExchange = BankService.prototype.exchangeSession;
    BankService.prototype.exchangeSession = async function() {
      return {
        sessionId: 'sess-card-1',
        accessValidUntil: new Date(Date.now() + 86400000).toISOString(),
        accounts: [
          {
            uid: 'card-uid-99',
            iban: null,
            currency: 'EUR',
            accountName: 'Eurobank Πιστωτική Κάρτα (•••• 4321)',
            balance: -150.50,
            isCard: true,
            accountType: 'card',
            cardMask: '4321'
          }
        ]
      };
    };

    try {
      const { onRequestPost } = await import('../functions/api/bank-callback.js');
      const response = await onRequestPost({
        request: makeRequest({ code: 'card-code-1', state }),
        env: BASE_ENV
      });
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload.ok, true);

      // Verify public.accounts was created with type 'card'
      const appAccountInsert = calls.find(
        (call) => call.method === 'POST' && call.url.endsWith('/rest/v1/accounts')
      );
      assert.ok(appAccountInsert, 'expected public.accounts insertion for credit card');
      assert.equal(appAccountInsert.body.type, 'card');
      assert.equal(appAccountInsert.body.icon, 'fa-credit-card');
      assert.equal(appAccountInsert.body.color, '#f59e0b');
      assert.equal(appAccountInsert.body.name, 'Eurobank Πιστωτική Κάρτα (•••• 4321)');

      // Verify public.bank_accounts has CARD-****4321
      const bankAccountInsert = calls.find(
        (call) => call.method === 'POST' && call.url.endsWith('/rest/v1/bank_accounts')
      );
      assert.ok(bankAccountInsert, 'expected public.bank_accounts insertion for credit card');
      assert.equal(bankAccountInsert.body.iban, 'CARD-****4321');
      assert.equal(bankAccountInsert.body.account_uid, 'card-uid-99');
    } finally {
      BankService.prototype.exchangeSession = origExchange;
    }
  } finally {
    global.fetch = originalFetch;
  }
});
