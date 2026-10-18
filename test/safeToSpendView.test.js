const { test } = require('node:test');
const assert = require('node:assert');

// Mock DOM & environment
global.window = global;
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

global.state = {
  lang: 'el',
  accounts: [
    { name: 'Μετρητά', balance: 300 },
    { name: 'Τράπεζα', balance: 1700 }
  ],
  transactions: [],
  recurringTemplates: [
    { id: 'rec-1', amount: 50, category: 'Bills', is_active: true, day_of_month: 15 }
  ],
  budgets: []
};

const domElements = {};
function getMockElement(id) {
  if (!domElements[id]) {
    const classes = new Set();
    domElements[id] = {
      id,
      style: {},
      classList: {
        add(c) { classes.add(c); },
        remove(c) { classes.delete(c); },
        contains(c) { return classes.has(c); },
        toggle(c, force) {
          if (force !== undefined) {
            if (force) classes.add(c);
            else classes.delete(c);
            return force;
          }
          if (classes.has(c)) { classes.delete(c); return false; }
          else { classes.add(c); return true; }
        }
      },
      innerHTML: '',
      textContent: '',
      value: '',
      dataset: {},
      querySelector() { return { onclick: null, addEventListener() {} }; },
      querySelectorAll() { return []; }
    };
  }
  return domElements[id];
}

global.document = {
  createElement(tag) {
    return {
      tagName: tag.toUpperCase(),
      className: '',
      style: {},
      innerHTML: '',
      setAttribute(k, v) { this[k] = v; },
      getAttribute(k) { return this[k]; },
      querySelector() { return { onclick: null, addEventListener() {} }; }
    };
  },
  getElementById(id) {
    return getMockElement(id);
  },
  querySelector(sel) {
    if (sel.startsWith('#')) return getMockElement(sel.slice(1));
    return { onclick: null, addEventListener() {} };
  },
  querySelectorAll() {
    return [];
  }
};

let openedModal = null;
let closedModal = null;
global.openModal = (id) => { openedModal = id; };
global.closeModal = (id) => { closedModal = id; };

global.sanitizeFloat = (num) => Math.round(Number(num) * 100) / 100;
global.getCurrencySymbol = () => '€';
global.formatDisplayAmount = (amt) => String(amt);
global.escapeHtml = (str) => String(str || '');
global.getCategoryDisplayName = (cat) => String(cat || '');
global.generateUUID = () => 'uuid-' + Math.random().toString(36).slice(2);
global.updateUI = () => {};
global.showToast = () => {};

const SafeToSpendView = require('../js/safeToSpendView.js');
// Expose browser globals that safeToSpendView.js expects at call time
global.TRANSLATIONS = require('../js/translations.js');
global.isTransferTransaction = (t) => !!(t && (t.is_transfer === true || t.type === 'transfer'));
// Expose the engine so getUnpaidRecurringBillsThisMonth() takes the real
// multi-occurrence path instead of its simplified fallback.
global.SubscriptionEngine = require('../js/SubscriptionEngine.js');

test('SafeToSpendView: exports all expected functions', () => {
  const expectedFns = [
    'getLiquidBalance',
    'computeLiquidBalance',
    'getSafeToSpendInputs',
    'getDiscretionaryBudgets',
    'isSavingsBudget',
    'isRecurringTemplateCoveredByBudget',
    'getUnpaidRecurringBillsThisMonth',
    'getMonthlySavingsGoal',
    'updateSafeToSpendUI',
    'openSafeToSpendModal',
    'runWhatIfSimulation',
    'openAiAdvisorFromBar',
    'openSubscriptionsHubModal',
    'renderSubscriptionsHub',
    'acceptDetectedSubscription',
    'quickPaySubscription',
    'toggleStsSavingsGoalEditor',
    'setStsSavingsInputValue',
    'saveStsSavingsGoal',
    'updateStsSavingsAnnualHint'
  ];

  expectedFns.forEach(fn => {
    assert.strictEqual(typeof SafeToSpendView[fn], 'function', `${fn} must be a function`);
  });
});

test('SafeToSpendView: getLiquidBalance calculates total balance of accounts', () => {
  const balance = SafeToSpendView.getLiquidBalance();
  assert.strictEqual(balance, 2000);
});

test('SafeToSpendView: getMonthlySavingsGoal returns saved goal or default', () => {
  localStorage.removeItem('ba_monthly_savings_goal');
  localStorage.removeItem('ba_quick_start_profile');
  localStorage.removeItem('overview_savings_target');

  state.budgets = [{ name: 'Αποταμίευση', amount: 250 }];
  let goal = SafeToSpendView.getMonthlySavingsGoal();
  assert.strictEqual(goal, 250);

  state.budgets = [];
  assert.strictEqual(SafeToSpendView.getMonthlySavingsGoal(), 0);

  // Test ba_monthly_savings_goal priority
  localStorage.setItem('ba_monthly_savings_goal', '320');
  assert.strictEqual(SafeToSpendView.getMonthlySavingsGoal(), 320);

  // Test annual target fallback
  localStorage.removeItem('ba_monthly_savings_goal');
  localStorage.setItem('overview_savings_target', '2400');
  assert.strictEqual(SafeToSpendView.getMonthlySavingsGoal(), 200);

  localStorage.removeItem('overview_savings_target');

  // Test year savings rate fallback from transactions (must only apply when { includeEstimate: true })
  const thisYear = new Date().getFullYear();
  state.transactions = [
    { type: 'income', amount: 3000, date: `${thisYear}-01-15` },
    { type: 'expense', amount: 1000, date: `${thisYear}-01-20` }
  ];
  const elapsedMonths = Math.max(1, new Date().getMonth() + 1);
  const expectedRate = Math.round(2000 / elapsedMonths);
  // Unconfigured goal must return 0 by default to prevent false overdrafts
  assert.strictEqual(SafeToSpendView.getMonthlySavingsGoal(), 0);
  // Must return expected rate when explicitly requesting estimate
  assert.strictEqual(SafeToSpendView.getMonthlySavingsGoal({ includeEstimate: true }), expectedRate);
  state.transactions = [];
});

test('SafeToSpendView: getLiquidBalance uses cashflow baseline when accounts balance is 0', () => {
  const savedAccs = state.accounts;
  const savedTxs = state.transactions;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  state.accounts = [
    { name: 'Cash', balance: 0 },
    { name: 'Bank Account', balance: 0 }
  ];
  state.transactions = [
    { type: 'income', amount: 1500, date: `${currentYear}-${currentMonth}-01` },
    { type: 'expense', amount: 300, date: `${currentYear}-${currentMonth}-05` }
  ];

  const liquid = SafeToSpendView.getLiquidBalance();
  assert.strictEqual(liquid, 1200);

  state.accounts = savedAccs;
  state.transactions = savedTxs;
});

test('SafeToSpendView: getLiquidBalance does not double-count future-dated recurring transactions', () => {
  const savedAccs = state.accounts;
  const savedTxs = state.transactions;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  state.accounts = [{ name: 'Cash', balance: 0 }];
  state.transactions = [
    { type: 'income', amount: 1000, date: `${currentYear}-${currentMonth}-01` },
    { type: 'expense', amount: 200, date: `${currentYear}-${currentMonth}-02` },
    // Future-dated recurring expense on the 28th (should NOT be deducted from spentThisMonth)
    { type: 'expense', amount: 150, date: `${currentYear}-${currentMonth}-28` }
  ];

  // If today is before the 28th, the future expense should not be deducted from cashflow baseline
  const today = now.getDate();
  const liquid = SafeToSpendView.getLiquidBalance();
  if (today < 28) {
    assert.strictEqual(liquid, 800); // 1000 - 200 (150 is preserved for unpaid bills)
  }

  state.accounts = savedAccs;
  state.transactions = savedTxs;
});

test('SafeToSpendView: updateSafeToSpendUI anti-glitch guard prevents flicker to 0 during in-flight sync', () => {
  // Setup stable state
  state._lastSafeToSpendResult = {
    safeDaily: 21.08,
    safeWeekly: 147.56,
    daysRemaining: 15,
    status: 'healthy'
  };

  const dailyEl = getMockElement('trans-sts-daily-val');
  dailyEl.textContent = '€ 21,08';

  // Mock in-flight sync flag
  global.SupabaseRealtimeService = {
    isForceSyncInFlight: () => true
  };

  // Temporarily empty transactions (as during sync)
  const savedTxs = state.transactions;
  const savedAccs = state.accounts;
  state.transactions = [];
  state.accounts = [{ name: 'Cash', balance: 0 }];

  SafeToSpendView.updateSafeToSpendUI();

  // The daily display should NOT have been wiped to 0
  assert.strictEqual(dailyEl.textContent, '€ 21,08');
  assert.strictEqual(state._lastSafeToSpendResult.safeDaily, 21.08);

  // Restore
  delete global.SupabaseRealtimeService;
  state.transactions = savedTxs;
  state.accounts = savedAccs;
});

test('SafeToSpendView: savings goal editor helper functions operate correctly', () => {
  // setStsSavingsInputValue sets input value
  const inputEl = getMockElement('sts-savings-input');
  SafeToSpendView.setStsSavingsInputValue(450);
  assert.strictEqual(inputEl.value, 450);

  // saveStsSavingsGoal persists to localStorage
  SafeToSpendView.saveStsSavingsGoal();
  assert.strictEqual(localStorage.getItem('ba_monthly_savings_goal'), '450');
  assert.strictEqual(SafeToSpendView.getMonthlySavingsGoal(), 450);

  // Clean up
  localStorage.removeItem('ba_monthly_savings_goal');
});

test('SafeToSpendView: openSafeToSpendModal and openSubscriptionsHubModal trigger openModal', () => {
  openedModal = null;
  SafeToSpendView.openSafeToSpendModal();
  assert.strictEqual(openedModal, 'safe-to-spend-modal');

  openedModal = null;
  SafeToSpendView.openSubscriptionsHubModal();
  assert.strictEqual(openedModal, 'subscriptions-hub-modal');
});

test('SafeToSpendView: openSafeToSpendModal adapts UI according to PRO entitlement', () => {
  const ctaBtn = getMockElement('sts-premium-cta-btn');
  const proBadge = getMockElement('sts-sim-pro-badge');

  // Case 1: Free user
  global.isPremium = () => false;
  state.userProfile = { premium_active: false };
  localStorage.removeItem('premium_active');
  SafeToSpendView.openSafeToSpendModal();
  assert.strictEqual(ctaBtn.style.display, 'flex');
  assert.strictEqual(proBadge.textContent, 'PRO');

  // Case 2: PRO user
  global.isPremium = () => true;
  state.userProfile = { premium_active: true };
  localStorage.setItem('premium_active', 'true');
  SafeToSpendView.openSafeToSpendModal();
  assert.strictEqual(ctaBtn.style.display, 'none');
  assert.strictEqual(proBadge.textContent, '✓ PRO');

  // Clean up
  delete global.isPremium;
  delete state.userProfile;
  localStorage.removeItem('premium_active');
});

test('SafeToSpendView: updateStsSavingsAnnualHint clarifies annual basis', () => {
  const hintEl = getMockElement('sts-savings-annual-hint-text');
  SafeToSpendView.updateStsSavingsAnnualHint(200);
  assert.ok(hintEl.textContent.includes('2.400') || hintEl.textContent.includes('2400'), 'Hint must show annual amount');
  assert.ok(hintEl.textContent.includes('Ετήσιο Στόχο') || hintEl.textContent.includes('Επισκόπηση'), 'Hint must reference annual overview target');

  // When value is 0
  SafeToSpendView.updateStsSavingsAnnualHint(0);
  assert.ok(hintEl.textContent.includes('Προτεινόμενο') || hintEl.textContent.includes('Ετήσια Αποταμίευση') || hintEl.textContent.includes('Επισκόπηση'), 'Hint must reference either suggested goal or annual sync');
});

// ---------------------------------------------------------------------------
// Budget baseline / savings / recurring-bill double deduction guards
// ---------------------------------------------------------------------------

function resetStsInputsState() {
  localStorage.removeItem('ba_monthly_savings_goal');
  localStorage.removeItem('ba_quick_start_profile');
  localStorage.removeItem('overview_savings_target');
}

test('SafeToSpendView: savings budgets are excluded from the discretionary baseline', () => {
  const savedBudgets = state.budgets;
  const savedTxs = state.transactions;

  resetStsInputsState();
  state.transactions = [];
  state.budgets = [
    { name: 'Αποταμίευση', amount: 250 },
    { name: 'ΣΠΙΤΙ', amount: 800 }
  ];

  const discretionary = SafeToSpendView.getDiscretionaryBudgets();
  assert.strictEqual(discretionary.length, 1);
  assert.strictEqual(discretionary[0].name, 'ΣΠΙΤΙ');

  // Budget baseline must not include the savings envelope (it is deducted once as the goal)
  const liquid = SafeToSpendView.computeLiquidBalance();
  assert.strictEqual(liquid.mode, 'budget');
  assert.strictEqual(liquid.balance, 800);
  assert.strictEqual(SafeToSpendView.getMonthlySavingsGoal(), 250);

  state.budgets = savedBudgets;
  state.transactions = savedTxs;
  resetStsInputsState();
});

test('SafeToSpendView: computeLiquidBalance reports the baseline source', () => {
  const savedBudgets = state.budgets;
  const savedTxs = state.transactions;
  const savedAccounts = state.accounts;

  resetStsInputsState();

  // No income, no budgets -> cash in accounts
  state.budgets = [];
  state.transactions = [];
  state.accounts = [{ name: 'Cash', balance: 2000 }];
  assert.deepStrictEqual(SafeToSpendView.computeLiquidBalance(), { balance: 2000, mode: 'accounts' });

  // Current-month income -> income baseline minus what is already spent
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  state.transactions = [
    { type: 'income', amount: 1000, date: `${monthKey}-01` },
    { type: 'expense', amount: 250, date: `${monthKey}-02` }
  ];
  const incomeLiquid = SafeToSpendView.computeLiquidBalance();
  assert.strictEqual(incomeLiquid.mode, 'income');
  assert.strictEqual(incomeLiquid.balance, 750);

  state.budgets = savedBudgets;
  state.transactions = savedTxs;
  state.accounts = savedAccounts;
});

test('SafeToSpendView: recurring templates already covered by a budget are detected', () => {
  const savedBudgets = state.budgets;
  state.budgets = [
    { name: 'ΣΠΙΤΙ', amount: 800 },
    { name: 'Αποταμίευση', amount: 200 }
  ];

  assert.strictEqual(SafeToSpendView.isRecurringTemplateCoveredByBudget({ category: 'ΣΠΙΤΙ', note: 'Ενοίκιο' }), true);
  assert.strictEqual(SafeToSpendView.isRecurringTemplateCoveredByBudget({ category: 'Λογαριασμοί', note: 'ΔΕΗ' }), false);
  // Savings envelopes must never swallow a bill
  assert.strictEqual(SafeToSpendView.isRecurringTemplateCoveredByBudget({ category: 'Αποταμίευση', note: 'Κουμπαράς' }), false);
  assert.strictEqual(SafeToSpendView.isRecurringTemplateCoveredByBudget(null), false);

  state.budgets = savedBudgets;
});

test('SafeToSpendView: getSafeToSpendInputs is consistent and skips budget-covered bills', () => {
  const savedBudgets = state.budgets;
  const savedTemplates = state.recurringTemplates;
  const savedTxs = state.transactions;
  const savedAccounts = state.accounts;

  resetStsInputsState();
  state.transactions = [];
  state.accounts = [{ name: 'Cash', balance: 2000 }];
  state.budgets = [
    { name: 'Αποταμίευση', amount: 250 },
    { name: 'ΣΠΙΤΙ', amount: 800 }
  ];
  state.recurringTemplates = [
    { id: 'rent', type: 'expense', category: 'ΣΠΙΤΙ', note: 'Ενοίκιο', amount: 500, startDate: '2026-01-05', preset: 'monthly' },
    { id: 'netflix', type: 'expense', category: 'Bills', note: 'Netflix', amount: 50, startDate: '2026-01-15', preset: 'monthly' }
  ];

  // All bills are still owed when the baseline comes from real accounts
  assert.strictEqual(SafeToSpendView.getUnpaidRecurringBillsThisMonth(), 550);
  assert.strictEqual(SafeToSpendView.getUnpaidRecurringBillsThisMonth({ excludeBudgetCovered: true }), 50);

  const inputs = SafeToSpendView.getSafeToSpendInputs();
  assert.strictEqual(inputs.mode, 'budget');
  assert.strictEqual(inputs.balance, 800);
  assert.strictEqual(inputs.unpaidBills, 50); // rent is already inside the ΣΠΙΤΙ budget
  assert.strictEqual(inputs.savingsGoal, 250);
  assert.strictEqual(inputs.balance, SafeToSpendView.getLiquidBalance());
  assert.strictEqual(inputs.savingsGoal, SafeToSpendView.getMonthlySavingsGoal());

  // Accounts baseline: every bill is deducted, regardless of budgets
  state.budgets = [];
  const accountsInputs = SafeToSpendView.getSafeToSpendInputs();
  assert.strictEqual(accountsInputs.mode, 'accounts');
  assert.strictEqual(accountsInputs.balance, 2000);
  assert.strictEqual(accountsInputs.unpaidBills, 550);
  assert.strictEqual(accountsInputs.savingsGoal, 0);

  state.budgets = savedBudgets;
  state.recurringTemplates = savedTemplates;
  state.transactions = savedTxs;
  state.accounts = savedAccounts;
  resetStsInputsState();
});

// ---------------------------------------------------------------------------
// Annual target progress -> prorated monthly reservation (Safe-to-Spend fix)
// ---------------------------------------------------------------------------

function setStsYearTransactions(income, expense) {
  const year = new Date().getFullYear();
  state.transactions = [
    { id: 'inc-ytd', type: 'income', amount: income, date: `${year}-01-01`, note: 'Income' },
    { id: 'exp-ytd', type: 'expense', amount: expense, date: `${year}-01-01`, note: 'Expenses' }
  ];
}

test('SafeToSpendView: annual target already met stops the monthly reservation', () => {
  resetStsInputsState();
  const savedTxs = state.transactions;
  const savedBudgets = state.budgets;
  const savedTemplates = state.recurringTemplates;

  state.budgets = [];
  state.recurringTemplates = [];
  // 10.512 € target, 12.535 € already saved (119%) -> nothing left to reserve.
  setStsYearTransactions(20000, 7465);
  localStorage.setItem('ba_monthly_savings_goal', '876');
  localStorage.setItem('overview_savings_target', '10512');

  const inputs = SafeToSpendView.getSafeToSpendInputs();
  assert.strictEqual(inputs.baseSavingsGoal, 876);
  assert.strictEqual(inputs.savingsProgress.annualTarget, 10512);
  assert.strictEqual(inputs.savingsProgress.savedYtd, 12535);
  assert.strictEqual(inputs.savingsProgress.remaining, 0);
  assert.strictEqual(inputs.savingsProgress.progressPct, 119);
  assert.strictEqual(inputs.savingsGoal, 0);
  assert.strictEqual(inputs.savingsCapped, true);

  // Row renders a single minus-free zero and explains why.
  SafeToSpendView.renderStsSavingsRow(inputs);
  const valueEl = getMockElement('modal-sts-savings');
  const labelEl = getMockElement('modal-sts-savings-label');
  const progressEl = getMockElement('modal-sts-savings-progress');
  assert.strictEqual(valueEl.textContent, '€ 0');
  assert.ok(!labelEl.textContent.startsWith('-'), 'Label must not add a second minus sign');
  assert.ok(progressEl.textContent.includes('10512') || progressEl.textContent.includes('10.512'), 'Progress must show the annual target');
  assert.ok(progressEl.textContent.includes('12535') || progressEl.textContent.includes('12.535'), 'Progress must show year-to-date savings');
  assert.ok(progressEl.textContent.includes('καλύφθηκε'), 'Progress must explain that the target is met');

  state.transactions = savedTxs;
  state.budgets = savedBudgets;
  state.recurringTemplates = savedTemplates;
  resetStsInputsState();
});

test('SafeToSpendView: remaining annual target is prorated across the months left', () => {
  resetStsInputsState();
  const savedTxs = state.transactions;
  const savedBudgets = state.budgets;
  const savedTemplates = state.recurringTemplates;

  state.budgets = [];
  state.recurringTemplates = [];
  // 512 € still missing: always below the 876 € monthly goal, whatever the month.
  setStsYearTransactions(12000, 2000);
  localStorage.setItem('ba_monthly_savings_goal', '876');
  localStorage.setItem('overview_savings_target', '10512');

  const monthsRemaining = Math.max(1, 12 - new Date().getMonth());
  const expected = Math.round((512 / monthsRemaining) * 100) / 100;

  const inputs = SafeToSpendView.getSafeToSpendInputs();
  assert.strictEqual(inputs.savingsProgress.remaining, 512);
  assert.strictEqual(inputs.savingsGoal, expected);
  assert.strictEqual(inputs.savingsCapped, true);
  assert.ok(inputs.savingsGoal < inputs.baseSavingsGoal);

  state.transactions = savedTxs;
  state.budgets = savedBudgets;
  state.recurringTemplates = savedTemplates;
  resetStsInputsState();
});

test('SafeToSpendView: missing annual target falls back to monthly x 12 without capping', () => {
  resetStsInputsState();
  const savedTxs = state.transactions;

  state.transactions = [];
  localStorage.setItem('ba_monthly_savings_goal', '876');
  localStorage.removeItem('overview_savings_target');

  const inputs = SafeToSpendView.getSafeToSpendInputs();
  assert.strictEqual(inputs.savingsProgress.annualTarget, 10512);
  assert.strictEqual(inputs.savingsProgress.savedYtd, 0);
  assert.strictEqual(inputs.savingsGoal, 876);
  assert.strictEqual(inputs.savingsCapped, false);

  state.transactions = savedTxs;
  resetStsInputsState();
});
