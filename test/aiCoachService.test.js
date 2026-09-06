const test = require('node:test');
const assert = require('node:assert/strict');

// Mock CurrencyService before requiring aiCoachService
global.CurrencyService = {
  toBase: (t) => parseFloat(t.amount) || 0
};
global.formatCurrency = (val) => '€' + (parseFloat(val) || 0).toFixed(2);
global.getCategoryDisplayName = (cat) => cat || '';
global.getSubcategoryDisplayName = (sub) => sub || '';
global.escapeHtml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
global.normalizeGreekString = (str) => {
  if (!str) return '';
  return String(str).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ς/g, 'σ')
    .replace(/[^a-z0-9α-ω]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};
global.stripLeadingEmoji = (str) => String(str || '').replace(/^[\p{Emoji}\s]+/u, '').trim();

// Mock localStorage
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { for (const k of Object.keys(storage)) delete storage[k]; }
};
global.window = global;
global.confirm = () => true;

// Import aiCoachService in CommonJS Node environment
const aiCoachService = require('../js/aiCoachService.js');

test('aiCoachService Module Tests', async (t) => {

  await t.test('1. exports all expected functions and controllers', () => {
    const expectedFns = [
      'openAdvisorChat',
      'closeAdvisorChat',
      'loadAdvisorConversations',
      'saveAdvisorConversations',
      'getActiveAdvisorConversationId',
      'setActiveAdvisorConversationId',
      'getActiveAdvisorConversation',
      'getConversationTitle',
      'showAdvisorConversationList',
      'renderAdvisorConversationList',
      'formatConversationTime',
      'openAdvisorConversation',
      'startNewAdvisorConversation',
      'deleteAdvisorConversation',
      'appendChatMessage',
      'coachFilterCategory',
      'coachOpenBudgets',
      'coachOpenReports',
      'coachOpenRecurring',
      'handleAdvisorChatInput',
      'submitCoachInput',
      'handleAdvisorChatKeydown',
      'submitCoachQuery',
      'getCoachAveragePacing',
      'runCoachOverspendingAnalysis',
      'runCoachSavingsAdvice',
      'runCoachFiveYearForecast',
      'runCoachTargetMilestone',
      'runCoachCategoryAnalysis',
      'predictCategoryFromHistory',
      'getSubcategoriesForCategory',
      'predictSubcategoryFromHistory',
      'updateCoachSubcategories',
      'runCoachTransactionEntry',
      'runCoachTopCategories',
      'runCoachWhatIfSimulation',
      'runCoachSearchQuery',
      'processCoachQuery',
      'submitCoachTransaction'
    ];

    expectedFns.forEach(fn => {
      assert.strictEqual(typeof aiCoachService[fn], 'function', `Expected ${fn} to be a function`);
    });
  });

  await t.test('2. conversation history management (load, save, create, delete)', async (st) => {
    const {
      loadAdvisorConversations,
      saveAdvisorConversations,
      getActiveAdvisorConversationId,
      setActiveAdvisorConversationId,
      getConversationTitle,
      startNewAdvisorConversation,
      deleteAdvisorConversation
    } = aiCoachService;

    localStorage.clear();
    global.state = {
      currentUser: { id: 'test-user-1' },
      lang: 'el',
      advisorChatHistory: []
    };
    global.document = {
      getElementById: () => ({ innerHTML: '', style: {}, focus: () => {}, appendChild: () => {} }),
      querySelector: () => null,
      createElement: () => ({ innerHTML: '', style: {}, appendChild: () => {}, onclick: null, className: '' })
    };

    await st.test('saves and loads conversations in user-scoped storage', () => {
      const convs = [
        { id: 'conv-1', title: 'Test Chat 1', messages: [], updated_at: Date.now() },
        { id: 'conv-2', title: 'Test Chat 2', messages: [], updated_at: Date.now() }
      ];
      saveAdvisorConversations(convs);
      const loaded = loadAdvisorConversations();
      assert.strictEqual(loaded.length, 2);
      assert.strictEqual(loaded[0].id, 'conv-1');
      assert.strictEqual(loaded[1].id, 'conv-2');
    });

    await st.test('active conversation ID management', () => {
      setActiveAdvisorConversationId('conv-1');
      assert.strictEqual(getActiveAdvisorConversationId(), 'conv-1');

      setActiveAdvisorConversationId(null);
      assert.strictEqual(getActiveAdvisorConversationId(), null);
    });

    global.window.confirm = () => true;
    global.confirm = () => true;

    await st.test('derives clean conversation title from first user message', () => {
      const msgs = [
        { sender: 'model', html: 'Hello!' },
        { sender: 'user', html: 'Spending on groceries' }
      ];
      const title = getConversationTitle(msgs);
      assert.strictEqual(title, 'Spending on groceries');

      const longMsgs = [
        { sender: 'user', html: 'A'.repeat(60) }
      ];
      const truncated = getConversationTitle(longMsgs);
      assert.ok(truncated.endsWith('…'));
      assert.strictEqual(truncated.length, 41);
    });

    await st.test('deletes a conversation and clears active ID if deleted', () => {
      const convs = [
        { id: 'conv-a', title: 'Chat A', messages: [] },
        { id: 'conv-b', title: 'Chat B', messages: [] }
      ];
      saveAdvisorConversations(convs);
      setActiveAdvisorConversationId('conv-a');

      deleteAdvisorConversation('conv-a');
      const remaining = loadAdvisorConversations();
      assert.strictEqual(remaining.length, 1);
      assert.strictEqual(remaining[0].id, 'conv-b');
      assert.strictEqual(getActiveAdvisorConversationId(), null);
    });
  });

  await t.test('3. heuristic offline coach intelligence queries', async (st) => {
    const {
      processCoachQuery,
      getCoachAveragePacing,
      runCoachFiveYearForecast,
      runCoachTargetMilestone,
      runCoachWhatIfSimulation,
      predictCategoryFromHistory
    } = aiCoachService;

    global.state = {
      lang: 'el',
      accounts: [{ name: 'Alpha Bank', balance: 10000 }],
      transactions: [
        { id: 't1', type: 'income', amount: 2500, category: '💼 Μισθός', date: '2026-01-15' },
        { id: 't2', type: 'expense', amount: 1500, category: '🛒 Supermarket', note: 'Σκλαβενίτης τρόφιμα', date: '2026-01-20' },
        { id: 't3', type: 'income', amount: 2500, category: '💼 Μισθός', date: '2026-02-15' },
        { id: 't4', type: 'expense', amount: 1500, category: '🛒 Supermarket', note: 'Σκλαβενίτης', date: '2026-02-20' },
        { id: 't5', type: 'income', amount: 2500, category: '💼 Μισθός', date: '2026-03-15' },
        { id: 't6', type: 'expense', amount: 1500, category: '🛒 Supermarket', note: 'Σκλαβενίτης ψώνια', date: '2026-03-20' }
      ]
    };

    await st.test('getCoachAveragePacing computes 3-month averages correctly', () => {
      const pacing = getCoachAveragePacing();
      assert.strictEqual(pacing.avgIncome, 2500);
      assert.strictEqual(pacing.avgExpense, 1500);
      assert.strictEqual(pacing.avgSavings, 1000);
      assert.strictEqual(pacing.totalBalance, 10000);
    });

    await st.test('runCoachFiveYearForecast calculates compound progression', () => {
      const html = runCoachFiveYearForecast();
      assert.ok(html.includes('Πρόβλεψη Εξέλιξης 5ετίας'));
      assert.ok(html.includes('Έτος 1'));
      assert.ok(html.includes('Έτος 5'));
    });

    await st.test('runCoachTargetMilestone calculates time to milestone', () => {
      const html = runCoachTargetMilestone(50000);
      assert.ok(html.includes('Ανάλυση Στόχου'));
      // remaining = 50000 - 10000 = 40000; at 1000/mo = 40 months
      assert.ok(html.includes('40 μήνες'));
    });

    await st.test('runCoachWhatIfSimulation simulates single purchase impact', () => {
      const html = runCoachWhatIfSimulation(2000, 'Laptop');
      assert.ok(html.includes('What-If'));
      assert.ok(html.includes('Laptop'));
      // remaining = 10000 - 2000 = 8000
      assert.ok(html.includes('8000'));
    });

    await st.test('predictCategoryFromHistory predicts category from transaction notes', () => {
      const cat = predictCategoryFromHistory('Ψώνια Σκλαβενίτης');
      assert.strictEqual(cat, '🛒 Supermarket');
    });

    await st.test('processCoachQuery dispatches keywords appropriately', () => {
      const overspendingHtml = processCoachQuery('overspending');
      assert.ok(overspendingHtml.length > 0);

      const savingsHtml = processCoachQuery('savings');
      assert.ok(savingsHtml.length > 0);

      const forecastHtml = processCoachQuery('forecast_5y');
      assert.ok(forecastHtml.includes('Πρόβλεψη'));

      const milestoneHtml = processCoachQuery('milestone_50k');
      assert.ok(milestoneHtml.includes('Στόχου'));
    });
  });

});
