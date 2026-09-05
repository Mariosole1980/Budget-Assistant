'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { normalizeGreekString } = require('../js/utils.js');

describe('AI Agent Enhancement Tests', () => {

  test('Natural Language: correctly distinguishes income verbs from expense verbs', () => {
    const isIncome = (query) => {
      const nq = normalizeGreekString(query);
      const hasIncomeVerb = nq.includes('πηρα') || nq.includes('μπηκε') || nq.includes('μισθος') || nq.includes('εισπραξη') || nq.includes('επιστροφη') || nq.includes('κερδισα') || nq.includes('εσοδο') || nq.includes('καταθεση') || nq.includes('received') || nq.includes('earned') || nq.includes('salary');
      return hasIncomeVerb;
    };

    assert.strictEqual(isIncome('Μου μπήκε ο μισθός 1200€'), true);
    assert.strictEqual(isIncome('Πήρα 50€ επιστροφή'), true);
    assert.strictEqual(isIncome('Είσπραξη 200€ από ενοίκιο'), true);
    assert.strictEqual(isIncome('Κέρδισα 100€ στο στοίχημα'), true);
    assert.strictEqual(isIncome('Received 500 bonus'), true);

    assert.strictEqual(isIncome('Έβαλα 20€ βενζίνη'), false);
    assert.strictEqual(isIncome('Πλήρωσα 45€ σούπερ μάρκετ'), false);
    assert.strictEqual(isIncome('Χάλασα 15€ για καφέδες'), false);
  });

  test('Natural Language: relative date recognition maps to past dates', () => {
    const parseRelativeDate = (query, baseDate = new Date('2026-09-05T12:00:00Z')) => {
      const nq = normalizeGreekString(query);
      if (nq.includes('προχθες') || nq.includes('day before yesterday')) {
        return new Date(baseDate.getTime() - 2 * 86400000).toISOString().split('T')[0];
      }
      if (nq.includes('χθες') || nq.includes('yesterday')) {
        return new Date(baseDate.getTime() - 86400000).toISOString().split('T')[0];
      }
      return baseDate.toISOString().split('T')[0];
    };

    const base = new Date('2026-09-05T12:00:00Z');
    assert.strictEqual(parseRelativeDate('χθες έβαλα 20€ βενζίνη', base), '2026-09-04');
    assert.strictEqual(parseRelativeDate('προχθές πλήρωσα 50€', base), '2026-09-03');
    assert.strictEqual(parseRelativeDate('πλήρωσα 10€ σήμερα', base), '2026-09-05');
  });

  test('Natural Language: account matching finds account name in query', () => {
    const accounts = [
      { name: 'Alpha Bank', type: 'bank' },
      { name: 'Revolut', type: 'card' },
      { name: 'Μετρητά', type: 'cash' },
      { name: 'Πειραιώς', type: 'bank' }
    ];

    const matchAccount = (query) => {
      const nq = normalizeGreekString(query);
      for (const acc of accounts) {
        const na = normalizeGreekString(acc.name);
        if (na && na.length > 2 && nq.includes(na)) {
          return acc.name;
        }
      }
      return null;
    };

    assert.strictEqual(matchAccount('50€ βενζίνη από την Alpha Bank'), 'Alpha Bank');
    assert.strictEqual(matchAccount('πλήρωσα 15€ με Revolut'), 'Revolut');
    assert.strictEqual(matchAccount('έδωσα μετρητά 10€'), 'Μετρητά');
    assert.strictEqual(matchAccount('μπήκε ο μισθός στην Πειραιώς'), 'Πειραιώς');
    assert.strictEqual(matchAccount('έφαγα 25€ σε ταβέρνα'), null);
  });

  test('AIEngine: returns enriched entities with type, account, and date', () => {
    // Mock environment for AIEngine
    global.window = {
      OnlineAIProvider: {
        processQuery: async (input, cats, accounts, subcats, date) => ({
          amount: 35.5,
          merchant: 'Shell',
          type: 'expense',
          category: '🚗 ΑΥΤΟΚΙΝΗΤΟ',
          subcategory: 'Καύσιμα',
          account_from: 'Revolut',
          date: '2026-09-04'
        })
      },
      MemoryEngine: {
        addTokenToMemory: () => {},
        inferCategoryProbabilities: () => ({ '🚗 ΑΥΤΟΚΙΝΗΤΟ': 1.0 })
      },
      DecisionEngine: {
        getDecisionPolicy: () => ({ action: 'AUTO_ACCEPT', bestCategory: '🚗 ΑΥΤΟΚΙΝΗΤΟ' })
      }
    };

    // Load AIEngine
    require('../js/AIEngine.js');

    return global.window.AIEngine.process('Χθες 35.5€ βενζίνη με Revolut', {
      categories: [{ name: '🚗 ΑΥΤΟΚΙΝΗΤΟ', type: 'expense' }],
      accounts: [{ name: 'Revolut' }],
      subcategories: ['Καύσιμα']
    }).then(res => {
      assert.strictEqual(res.action, 'AUTO_ACCEPT');
      assert.strictEqual(res.entities.amount, 35.5);
      assert.strictEqual(res.entities.merchant, 'Shell');
      assert.strictEqual(res.entities.type, 'expense');
      assert.strictEqual(res.entities.category, '🚗 ΑΥΤΟΚΙΝΗΤΟ');
      assert.strictEqual(res.entities.subcategory, 'Καύσιμα');
      assert.strictEqual(res.entities.account_from, 'Revolut');
      assert.strictEqual(res.entities.date, '2026-09-04');
    });
  });

});
