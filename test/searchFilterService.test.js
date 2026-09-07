const test = require('node:test');
const assert = require('node:assert/strict');

// Import searchFilterService in CommonJS Node environment
const searchFilterService = require('../js/searchFilterService.js');

test('searchFilterService Module Tests', async (t) => {

  await t.test('1. exports all expected functions and helpers', () => {
    const expectedFns = [
      'normalizeText',
      'filterTransactions',
      'calculateSearchTotals',
      'getCategoryType',
      'openSearchOverlay',
      'closeSearchOverlay',
      'handleSearchChange',
      'debouncedSearchChange',
      'resetSearchFilters',
      'clearSearchInput',
      'toggleSearchSelectMode',
      'toggleSearchSelection',
      'clearSearchSelection',
      'deleteSelectedSearchTransactions',
      'renderGroupedTransactions',
      'initAmountRangeSlider',
      'selectPeriodFilter',
      'applyCustomDates',
      'resetPeriodFilter',
      'selectAccountChipFilter',
      'setCategoryTypeFilter',
      'selectCategoryChipFilter',
      'selectSubcategoryChipFilter',
      'resetCategoryFilter',
      'renderPeriodChips',
      'renderAccountChips',
      'renderCategoryChips',
      'renderSubcategoryChips',
      'openSearchPeriodSheet',
      'selectPeriodSearchFilter',
      'applySearchCustomPeriod',
      'openSearchBottomSheet',
      'closeSearchBottomSheet',
      'selectTypeSearchFilter',
      'populateSearchAccountSheet',
      'selectAccountSearchFilter',
      'populateSearchCategorySheet',
      'selectCategorySearchFilter',
      'populateSearchMemberSheet',
      'syncAmountFiltersFromInline',
      'selectMemberSearchFilter',
      'selectPhotoSearchFilter',
      'applyAdvancedSearchFiltersVisual',
      'resetAdvancedSearchFiltersVisual',
      'resetAllSearchChips',
      'populateSearchFilterDropdowns',
      'populateSearchSubcategoryDropdown',
      'loadMoreSearchResults',
      'toggleSearchFiltersPanel'
    ];

    expectedFns.forEach(fn => {
      assert.strictEqual(typeof searchFilterService[fn], 'function', `Expected ${fn} to be a function`);
    });
  });

  await t.test('2. normalizeText', async (st) => {
    const { normalizeText } = searchFilterService;

    await st.test('strips Greek accents and lowercases', () => {
      assert.strictEqual(normalizeText('Έξοδα'), 'εξοδα');
      assert.strictEqual(normalizeText('ΜΙΣΘΌΣ'), 'μισθοσ');
      assert.strictEqual(normalizeText('μισθος'), 'μισθοσ');
      assert.strictEqual(normalizeText('Σούπερ Μάρκετ'), 'σουπερ μαρκετ');
      // Final sigma ς is normalized to σ so search matches regardless of sigma form
      assert.strictEqual(normalizeText('Καφές & Ποτά'), normalizeText('καφες & ποτα'));
      assert.strictEqual(normalizeText('Καφές'), 'καφεσ');
    });

    await st.test('strips Latin diacritics and lowercases', () => {
      assert.strictEqual(normalizeText('Café'), 'cafe');
      assert.strictEqual(normalizeText('RÉSUMÉ'), 'resume');
      assert.strictEqual(normalizeText('NAÏVE'), 'naive');
    });

    await st.test('safely handles empty, null, undefined, or numbers', () => {
      assert.strictEqual(normalizeText(''), '');
      assert.strictEqual(normalizeText(null), '');
      assert.strictEqual(normalizeText(undefined), '');
      assert.strictEqual(normalizeText(123.45), '123.45');
    });

    await st.test('trims surrounding whitespace', () => {
      assert.strictEqual(normalizeText('   hello world   '), 'hello world');
    });
  });

  await t.test('3. filterTransactions', async (st) => {
    const { filterTransactions } = searchFilterService;

    const sampleTxList = [
      {
        id: 'tx-1',
        type: 'expense',
        category: 'Φαγητό',
        subcategory: 'Σούπερ Μάρκετ',
        note: 'Εβδομαδιαία ψώνια Lidl',
        description: 'Lidl Hellas',
        account_from: 'Alpha Bank',
        account_to: '',
        amount: 45.50,
        date: '2026-03-10T14:30:00Z',
        user_id: 'user-mario',
        photo_local_uri: 'receipt1.jpg'
      },
      {
        id: 'tx-2',
        type: 'expense',
        category: 'Μεταφορές',
        subcategory: 'Βενζίνη',
        note: 'Shell καύσιμα',
        description: 'Shell Oil',
        account_from: 'Eurobank',
        account_to: '',
        amount: 50.00,
        date: '2026-03-12T10:00:00Z',
        user_id: 'user-elena',
        photo_url: 'https://cloud.com/photo.jpg'
      },
      {
        id: 'tx-3',
        type: 'income',
        category: 'Μισθός',
        subcategory: '',
        note: 'Μισθοδοσία Μαρτίου',
        description: 'Εταιρεία ΑΕ',
        account_from: '',
        account_to: 'Alpha Bank',
        amount: 1500.00,
        date: '2026-03-01T08:00:00Z',
        user_id: 'user-mario'
      },
      {
        id: 'tx-4',
        type: 'transfer',
        category: 'Μεταφορά',
        subcategory: '',
        note: 'Μεταφορά για έξοδα',
        description: '',
        account_from: 'Alpha Bank',
        account_to: 'Revolut',
        amount: 200.00,
        date: '2026-03-15T12:00:00Z',
        user_id: 'user-mario'
      }
    ];

    await st.test('filters by text query (note, category, subcategory, account)', () => {
      const res1 = filterTransactions(sampleTxList, { query: 'lidl' });
      assert.strictEqual(res1.length, 1);
      assert.strictEqual(res1[0].id, 'tx-1');

      const res2 = filterTransactions(sampleTxList, { query: 'φαγητο' });
      assert.strictEqual(res2.length, 1);
      assert.strictEqual(res2[0].id, 'tx-1');

      const res3 = filterTransactions(sampleTxList, { query: 'βενζινη' });
      assert.strictEqual(res3.length, 1);
      assert.strictEqual(res3[0].id, 'tx-2');

      const res4 = filterTransactions(sampleTxList, { query: 'eurobank' });
      assert.strictEqual(res4.length, 1);
      assert.strictEqual(res4[0].id, 'tx-2');

      const resNone = filterTransactions(sampleTxList, { query: 'cinema' });
      assert.strictEqual(resNone.length, 0);
    });

    await st.test('filters by numeric query matching amount and prefix', () => {
      const res1 = filterTransactions(sampleTxList, { query: '50' });
      assert.strictEqual(res1.length, 1);
      assert.strictEqual(res1[0].id, 'tx-2');

      const res2 = filterTransactions(sampleTxList, { query: '45' });
      assert.strictEqual(res2.length, 1);
      assert.strictEqual(res2[0].id, 'tx-1');

      const res3 = filterTransactions(sampleTxList, { query: '45,5' });
      assert.strictEqual(res3.length, 1);
      assert.strictEqual(res3[0].id, 'tx-1');
    });

    await st.test('filters by transaction type', () => {
      const expenses = filterTransactions(sampleTxList, { filterType: 'expense' });
      assert.strictEqual(expenses.length, 2);
      assert.ok(expenses.every(t => t.type === 'expense'));

      const incomes = filterTransactions(sampleTxList, { filterType: 'income' });
      assert.strictEqual(incomes.length, 1);
      assert.strictEqual(incomes[0].id, 'tx-3');

      const transfers = filterTransactions(sampleTxList, { filterType: 'transfer' });
      assert.strictEqual(transfers.length, 1);
      assert.strictEqual(transfers[0].id, 'tx-4');
    });

    await st.test('filters by account (both account_from and account_to)', () => {
      const alphaRes = filterTransactions(sampleTxList, { filterAcc: 'Alpha Bank' });
      assert.strictEqual(alphaRes.length, 3);

      const revolutRes = filterTransactions(sampleTxList, { filterAcc: 'Revolut' });
      assert.strictEqual(revolutRes.length, 1);
      assert.strictEqual(revolutRes[0].id, 'tx-4');
    });

    await st.test('filters by category and subcategory', () => {
      const catRes = filterTransactions(sampleTxList, { filterCat: 'Φαγητό' });
      assert.strictEqual(catRes.length, 1);
      assert.strictEqual(catRes[0].id, 'tx-1');

      const subRes = filterTransactions(sampleTxList, { filterCat: 'Φαγητό', filterSub: 'Σούπερ Μάρκετ' });
      assert.strictEqual(subRes.length, 1);
      assert.strictEqual(subRes[0].id, 'tx-1');

      const mismatchSub = filterTransactions(sampleTxList, { filterCat: 'Φαγητό', filterSub: 'Εστιατόρια' });
      assert.strictEqual(mismatchSub.length, 0);
    });

    await st.test('filters by member (user_id)', () => {
      const marioRes = filterTransactions(sampleTxList, { filterMember: 'user-mario' });
      assert.strictEqual(marioRes.length, 3);

      const elenaRes = filterTransactions(sampleTxList, { filterMember: 'user-elena' });
      assert.strictEqual(elenaRes.length, 1);
      assert.strictEqual(elenaRes[0].id, 'tx-2');
    });

    await st.test('filters by photo/receipt presence', () => {
      const withPhoto = filterTransactions(sampleTxList, { filterPhoto: 'has_photo' });
      assert.strictEqual(withPhoto.length, 2);
      assert.ok(withPhoto.some(t => t.id === 'tx-1'));
      assert.ok(withPhoto.some(t => t.id === 'tx-2'));

      const withoutPhoto = filterTransactions(sampleTxList, { filterPhoto: 'no_photo' });
      assert.strictEqual(withoutPhoto.length, 2);
      assert.ok(withoutPhoto.some(t => t.id === 'tx-3'));
      assert.ok(withoutPhoto.some(t => t.id === 'tx-4'));
    });

    await st.test('filters by amount range (minAmt, maxAmt)', () => {
      const range1 = filterTransactions(sampleTxList, { minAmt: 40, maxAmt: 60 });
      assert.strictEqual(range1.length, 2);

      const range2 = filterTransactions(sampleTxList, { minAmt: 1000 });
      assert.strictEqual(range2.length, 1);
      assert.strictEqual(range2[0].id, 'tx-3');
    });

    await st.test('filters by date range (dateStart, dateEnd)', () => {
      const dateRange = filterTransactions(sampleTxList, {
        dateStart: '2026-03-05',
        dateEnd: '2026-03-12'
      });
      assert.strictEqual(dateRange.length, 2);
    });

    await st.test('handles non-array or empty inputs gracefully', () => {
      assert.deepStrictEqual(filterTransactions(null), []);
      assert.deepStrictEqual(filterTransactions(undefined), []);
      assert.deepStrictEqual(filterTransactions('invalid'), []);
      assert.deepStrictEqual(filterTransactions([]), []);
    });
  });

  await t.test('4. calculateSearchTotals', () => {
    const { calculateSearchTotals } = searchFilterService;

    const sampleList = [
      { type: 'income', amount: 1200 },
      { type: 'expense', amount: 150 },
      { type: 'expense', amount: 50 },
      { type: 'transfer', amount: 300 }
    ];

    const totals = calculateSearchTotals(sampleList, 'EUR');
    assert.strictEqual(totals.totalIncome, 1200);
    assert.strictEqual(totals.totalExpense, 200);
    assert.strictEqual(totals.totalTransfer, 300);

    const emptyTotals = calculateSearchTotals([], 'EUR');
    assert.strictEqual(emptyTotals.totalIncome, 0);
    assert.strictEqual(emptyTotals.totalExpense, 0);
    assert.strictEqual(emptyTotals.totalTransfer, 0);
  });

  await t.test('5. openSearchOverlay delegation and execution safety', () => {
    assert.strictEqual(typeof searchFilterService.openSearchOverlay, 'function');
    assert.strictEqual(typeof searchFilterService.closeSearchOverlay, 'function');

    // Simulate forwarder as in app.js
    global.SearchFilterService = searchFilterService;
    function openSearchOverlayForwarder() {
      if (typeof SearchFilterService !== 'undefined' && typeof SearchFilterService.openSearchOverlay === 'function') {
        return SearchFilterService.openSearchOverlay.apply(this, arguments);
      }
    }

    // Verify calling forwarder does not throw recursion or RangeError
    assert.doesNotThrow(() => {
      // Mock minimal environment
      global.document = {
        getElementById: () => ({
          classList: { toggle: () => false, add: () => {}, remove: () => {} },
          style: { setProperty: () => {} },
          appendChild: () => {},
          addEventListener: () => {},
          querySelector: () => ({ textContent: '', classList: { remove: () => {} } }),
          querySelectorAll: () => [],
          value: ''
        }),
        querySelector: () => ({ classList: { remove: () => {} } }),
        querySelectorAll: () => [],
        createElement: () => ({ tagName: 'div', classList: { add: () => {} } })
      };
      global.state = {
        selectedSearchIds: new Set(),
        lang: 'el',
        accounts: [],
        categories: [],
        transactions: []
      };
      global.TRANSLATIONS = { el: {} };
      global.getAccountDisplayName = (a) => a.name;
      global.getActiveTransactions = () => [];
      global.formatDisplayAmount = (x) => String(x);
      global.getCurrencySymbol = () => '€';
      global.getDisplayCurrency = () => 'EUR';
      global.CurrencyService = { displayAmount: (t) => t.amount, sumInCurrency: () => 0 };
      global.compareTransactions = () => 0;
      global.getCategoryInfo = () => ({ icon: '', color: '' });
      global.getCategoryDisplayName = (c) => c;
      global.getSubcategoryDisplayName = (s) => s;
      global.escapeHtml = (s) => s;
      global.ensureHistoryPushed = () => {};
      global.ensureOverlayInBody = () => {};

      openSearchOverlayForwarder();
    });
  });

});
