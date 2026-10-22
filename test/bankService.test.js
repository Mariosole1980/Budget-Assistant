const test = require('node:test');
const assert = require('node:assert/strict');

test('BankService: loads and provides Greek institutions and mock sandbox', async () => {
  const { BankService, SUPPORTED_GREEK_BANKS } = await import('../functions/api/_bank_service.js');

  assert.ok(Array.isArray(SUPPORTED_GREEK_BANKS));
  assert.equal(SUPPORTED_GREEK_BANKS.length, 5);

  const nbg = SUPPORTED_GREEK_BANKS.find(b => b.code === 'NBG');
  assert.ok(nbg);
  assert.equal(nbg.country, 'GR');

  // Test sandbox behavior when unconfigured
  const service = new BankService({});
  assert.equal(service.isConfigured, false);

  const institutions = await service.getInstitutions('GR');
  assert.equal(institutions.length, 5);

  const authRes = await service.startAuth({
    bankName: 'Eurobank',
    redirectUrl: 'https://example.com/callback'
  });
  assert.ok(authRes.url);
  assert.ok(authRes.url.includes('mock_auth_code'));

  const session = await service.exchangeSession('mock_code_123');
  assert.ok(session.sessionId);
  assert.ok(session.accounts.length > 0);
  assert.ok(session.accounts[0].iban.startsWith('GR'));

  const txs = await service.getAccountTransactions(session.accounts[0].uid);
  assert.ok(Array.isArray(txs));
  assert.ok(txs.length > 0);
  assert.ok(txs.some(t => t.description.includes('ΣΚΛΑΒΕΝΙΤΗΣ')));
});
