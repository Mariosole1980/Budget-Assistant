/**
 * js/searchFilterService.js
 *
 * Transaction Search, Filtering, Bottom Sheets & Multi-Select Subsystem.
 * Extracted from app.js (Phase 6 Architectural Domain Extraction).
 *
 * Features:
 * - Real-time diacritic-insensitive Greek & Latin text search (note, category, subcategory, account, amount prefix)
 * - Multi-criteria bottom sheets: period, type, account, category, subcategory, member, receipt photo
 * - Dual-handle amount range slider with touch & drag support
 * - Grouped by day transaction search results layout
 * - Multi-selection and bulk transaction deletion
 * - UMD wrapper exposing methods globally to window and pure helpers to Node tests
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser: attach to root (window)
    var exports = factory();
    Object.assign(root, exports);
    root.SearchFilterService = exports;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;


  /**
   * Pure helper: Filter a list of transactions according to search & filter criteria.
   * Usable in Node tests and invoked by handleSearchChange.
   */
  function filterTransactions(transactionList, criteria) {
    criteria = criteria || {};
    if (!Array.isArray(transactionList)) return [];

    var query = normalizeText(criteria.query || '');
    var filterType = criteria.filterType || '';
    var filterAcc = criteria.filterAcc || '';
    var filterCat = criteria.filterCat || '';
    var filterSub = criteria.filterSub || '';
    var filterMember = criteria.filterMember || '';
    var filterPhoto = criteria.filterPhoto || '';
    var minAmt = (criteria.minAmt !== undefined && criteria.minAmt !== null && !isNaN(criteria.minAmt)) ? parseFloat(criteria.minAmt) : null;
    var maxAmt = (criteria.maxAmt !== undefined && criteria.maxAmt !== null && !isNaN(criteria.maxAmt)) ? parseFloat(criteria.maxAmt) : null;
    var dateStart = criteria.dateStart || '';
    var dateEnd = criteria.dateEnd || '';

    return transactionList.filter(function (t) {
      if (!t) return false;

      // 1. Text Query (Search in Note, Category, Subcategory, Description, Account, and Amount)
      if (query) {
        var note = normalizeText(t.note);
        var cat = normalizeText(t.category);
        var sub = normalizeText(t.subcategory);
        var desc = normalizeText(t.description);
        var acc = normalizeText(t.account_from);
        var accTo = normalizeText(t.account_to);

        var textMatch = note.includes(query) || cat.includes(query) || sub.includes(query) || desc.includes(query) || acc.includes(query) || accTo.includes(query);

        var amtMatch = false;
        var numericQuery = query.replace(',', '.').trim();
        if (/^\d+(\.\d+)?$/.test(numericQuery)) {
          var queryNum = parseFloat(numericQuery);
          var amtNum = parseFloat(t.amount) || 0;
          amtMatch = amtNum === queryNum || String(amtNum).startsWith(numericQuery);
        }

        if (!textMatch && !amtMatch) {
          return false;
        }
      }

      // 2. Type Filter
      if (filterType && t.type !== filterType) return false;

      // 3. Account Filter
      if (filterAcc && t.account_from !== filterAcc && t.account_to !== filterAcc) return false;

      // 4. Category Filter
      if (filterCat && t.category !== filterCat) return false;

      // 4b. Subcategory Filter
      if (filterSub && (t.subcategory || '').trim() !== filterSub) return false;

      // 4c. Member Filter (user_id matching)
      if (filterMember && t.user_id !== filterMember) return false;

      // 4d. Photo/Receipt Filter
      if (filterPhoto) {
        var hasPhoto = !!(t.photo_local_uri || t.photo_url);
        if (filterPhoto === 'has_photo' && !hasPhoto) return false;
        if (filterPhoto === 'no_photo' && hasPhoto) return false;
      }

      // 5. Amount Range Filter
      var amt = parseFloat(t.amount) || 0;
      if (minAmt !== null && amt < minAmt) return false;
      if (maxAmt !== null && amt > maxAmt) return false;

      // 6. Date Range Filter
      var datePart = String(t.date || '').split('T')[0].split(' ')[0];
      if (dateStart && datePart < dateStart) return false;
      if (dateEnd && datePart > dateEnd) return false;

      return true;
    });
  }

  /**
   * Pure helper: Calculate income, expense, and transfer totals for filtered transactions.
   */
  function calculateSearchTotals(filteredTransactions, searchDisplayCurrency) {
    var totalIncome = 0;
    var totalExpense = 0;
    var totalTransfer = 0;

    (filteredTransactions || []).forEach(function (t) {
      var amt = (typeof CurrencyService !== 'undefined' && typeof CurrencyService.displayAmount === 'function')
        ? CurrencyService.displayAmount(t, searchDisplayCurrency)
        : (parseFloat(t.amount) || 0);
      if (t.type === 'income') {
        totalIncome += amt;
      } else if (t.type === 'expense') {
        totalExpense += amt;
      } else if (t.type === 'transfer') {
        totalTransfer += amt;
      }
    });

    return {
      totalIncome: totalIncome,
      totalExpense: totalExpense,
      totalTransfer: totalTransfer
    };
  }
// ============================================================
// FEATURE: TRANSACTION SEARCH AND FILTERS
// ============================================================
let searchResultLimit = 50;

function loadMoreSearchResults() {
  // Increment by the same step as the initial limit (50) so pagination
  // grows consistently (50 -> 100 -> 150 ...) instead of jumping 50 -> 150.
  searchResultLimit += 50;
  handleSearchChange(false);
}

function toggleSearchFiltersPanel() {
  const panel = document.getElementById('search-filters-panel');
  const btn = document.getElementById('search-toggle-btn');
  if (!panel) {
    console.warn('[filters] panel element not found!');
    return;
  }
  const isActive = panel.classList.toggle('active');
  if (btn) btn.classList.toggle('active', isActive);
}

function openSearchOverlay() {
  ensureHistoryPushed();
  const overlay = document.getElementById('search-overlay');
  if (overlay) {
    // FIX: Ensure the search overlay is a direct child of <body> before showing.
    ensureOverlayInBody(overlay);
    overlay.classList.add('active');
  }

  searchResultLimit = 50;

  // Reset multi-select mode in search
  state.searchSelectMode = false;
  if (state.selectedSearchIds) state.selectedSearchIds.clear();

  const selectBtn = document.getElementById('search-select-mode-btn');
  if (selectBtn) {
    selectBtn.classList.remove('active-blue');
    selectBtn.style.borderColor = 'var(--border)';
    selectBtn.style.background = 'none';
    selectBtn.style.color = 'var(--text-secondary)';
    selectBtn.textContent = state.lang === 'el' ? 'Επιλογή' : 'Select';
  }
  const bulkPanel = document.getElementById('search-bulk-actions-panel');
  if (bulkPanel) bulkPanel.style.display = 'none';

  // Collapse filters panel by default
  const panel = document.getElementById('search-filters-panel');
  if (panel) panel.classList.remove('active');
  const btn = document.querySelector('.search-settings-btn-modern');
  if (btn) btn.classList.remove('active');

  // Populate dynamic dropdown filters
  populateSearchFilterDropdowns();

  // Reset inputs and run initial query to show all
  resetSearchFilters();

  // Trigger initial search to show all transactions
  handleSearchChange();
}

function closeSearchOverlay() {
  const overlay = document.getElementById('search-overlay');
  if (overlay) overlay.classList.remove('active');
  closeSearchBottomSheet();
}

// State for custom slider dragging
let sliderMinVal = 0;
let sliderMaxVal = 1000;
let currentMinVal = 0;
let currentMaxVal = 1000;
let isDraggingMin = false;
let isDraggingMax = false;

// 1. Period selection logic
function selectPeriodFilter(periodType, element) {
  const chips = document.querySelectorAll('#period-chips-container .filter-chip');
  chips.forEach(c => c.classList.remove('active', 'active-blue'));

  const customInputs = document.getElementById('custom-date-inputs');

  if (element && element.getAttribute('data-active') === 'true') {
    element.removeAttribute('data-active');
    const startEl = document.getElementById('search-filter-date-start');
    if (startEl) startEl.value = '';
    const endEl = document.getElementById('search-filter-date-end');
    if (endEl) endEl.value = '';
    if (customInputs) customInputs.style.display = 'none';
  } else {
    chips.forEach(c => c.removeAttribute('data-active'));
    if (element) {
      element.classList.add(periodType === 'Custom Period' || periodType === 'Προσαρμοσμένο' ? 'active-blue' : 'active');
      element.setAttribute('data-active', 'true');
    }

    const today = new Date();
    let dateStart = '';
    let dateEnd = '';

    if (periodType === 'Weekly' || periodType === 'Εβδομάδα') {
      const start = new Date();
      start.setDate(today.getDate() - 7);
      dateStart = start.toISOString().split('T')[0];
      dateEnd = today.toISOString().split('T')[0];
      if (customInputs) customInputs.style.display = 'none';
    } else if (periodType === 'Monthly' || periodType === 'Μήνας') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      dateStart = start.toISOString().split('T')[0];
      dateEnd = today.toISOString().split('T')[0];
      if (customInputs) customInputs.style.display = 'none';
    } else if (periodType === 'Annually' || periodType === 'Έτος') {
      const start = new Date(today.getFullYear(), 0, 1);
      dateStart = start.toISOString().split('T')[0];
      dateEnd = today.toISOString().split('T')[0];
      if (customInputs) customInputs.style.display = 'none';
    } else if (periodType === 'Custom Period' || periodType === 'Προσαρμοσμένο') {
      if (customInputs) customInputs.style.display = 'flex';
      const customStart = document.getElementById('custom-date-start');
      if (customStart) dateStart = customStart.value;
      const customEnd = document.getElementById('custom-date-end');
      if (customEnd) dateEnd = customEnd.value;
    }

    const startEl = document.getElementById('search-filter-date-start');
    if (startEl) startEl.value = dateStart;
    const endEl = document.getElementById('search-filter-date-end');
    if (endEl) endEl.value = dateEnd;
  }

  handleSearchChange();
}

function applyCustomDates() {
  const customStart = document.getElementById('custom-date-start');
  const customEnd = document.getElementById('custom-date-end');
  const startVal = customStart ? customStart.value : '';
  const endVal = customEnd ? customEnd.value : '';

  const startEl = document.getElementById('search-filter-date-start');
  if (startEl) startEl.value = startVal;
  const endEl = document.getElementById('search-filter-date-end');
  if (endEl) endEl.value = endVal;

  handleSearchChange();
}

function resetPeriodFilter() {
  const chips = document.querySelectorAll('#period-chips-container .filter-chip');
  chips.forEach(c => {
    c.classList.remove('active', 'active-blue');
    c.removeAttribute('data-active');
  });

  const startEl = document.getElementById('search-filter-date-start');
  if (startEl) startEl.value = '';
  const endEl = document.getElementById('search-filter-date-end');
  if (endEl) endEl.value = '';

  const customStart = document.getElementById('custom-date-start');
  if (customStart) customStart.value = '';
  const customEnd = document.getElementById('custom-date-end');
  if (customEnd) customEnd.value = '';

  const customInputs = document.getElementById('custom-date-inputs');
  if (customInputs) customInputs.style.display = 'none';

  handleSearchChange();
}

// 2. Account selection logic
function selectAccountChipFilter(accName, element) {
  const chips = document.querySelectorAll('#account-chips-container .filter-chip');
  const filterInput = document.getElementById('search-filter-account');

  if (element && element.classList.contains('active')) {
    element.classList.remove('active');
    filterInput.value = '';
  } else {
    chips.forEach(c => c.classList.remove('active'));
    if (element) element.classList.add('active');
    filterInput.value = accName;
  }
  handleSearchChange();
}

// 3. Category selection logic
let currentCategoryType = 'expense';

function setCategoryTypeFilter(type) {
  currentCategoryType = type;

  const segExpense = document.getElementById('seg-tab-expense');
  const segIncome = document.getElementById('seg-tab-income');
  if (type === 'expense') {
    if (segExpense) segExpense.className = 'segmented-tab active';
    if (segIncome) segIncome.className = 'segmented-tab';
    document.getElementById('category-segmented-control')?.style.setProperty('--segmented-active-bg', 'var(--red-negative, #ef5350)');
  } else {
    if (segExpense) segExpense.className = 'segmented-tab';
    if (segIncome) segIncome.className = 'segmented-tab active income-active';
    document.getElementById('category-segmented-control')?.style.setProperty('--segmented-active-bg', 'var(--blue-positive, #3b82f6)');
  }

  document.getElementById('search-filter-type').value = type;
  resetCategoryFilter(false);
  renderCategoryChips();
  handleSearchChange();
}

function selectCategoryChipFilter(catName, element) {
  const chips = document.querySelectorAll('#category-chips-container .filter-chip');
  const filterInput = document.getElementById('search-filter-category');

  if (element && element.classList.contains('active')) {
    element.classList.remove('active');
    filterInput.value = '';

    const subWrapper1 = document.getElementById('subcategory-chips-wrapper');
    if (subWrapper1) subWrapper1.style.display = 'none';
    const subFilter1 = document.getElementById('search-filter-subcategory');
    if (subFilter1) subFilter1.value = '';
  } else {
    chips.forEach(c => c.classList.remove('active'));
    if (element) element.classList.add('active');
    filterInput.value = catName;

    const categoryObj = state.categories.find(c => c.name === catName && c.type === currentCategoryType);
    if (categoryObj && categoryObj.subcategories && categoryObj.subcategories.length > 0) {
      renderSubcategoryChips(categoryObj.subcategories);
    } else {
      const subWrapper2 = document.getElementById('subcategory-chips-wrapper');
      if (subWrapper2) subWrapper2.style.display = 'none';
      const subFilter2 = document.getElementById('search-filter-subcategory');
      if (subFilter2) subFilter2.value = '';
    }
  }
  handleSearchChange();
}

function selectSubcategoryChipFilter(subName, element) {
  const chips = document.querySelectorAll('#subcategory-chips-container .filter-chip');
  const filterInput = document.getElementById('search-filter-subcategory');

  chips.forEach(c => c.classList.remove('active'));
  if (element) element.classList.add('active');

  filterInput.value = (subName === 'all' || subName === 'Όλες') ? '' : subName;
  handleSearchChange();
}

function resetCategoryFilter(triggerSearch = true) {
  const chips = document.querySelectorAll('#category-chips-container .filter-chip');
  chips.forEach(c => c.classList.remove('active'));
  const catFilter = document.getElementById('search-filter-category');
  if (catFilter) catFilter.value = '';

  const subWrapper = document.getElementById('subcategory-chips-wrapper');
  if (subWrapper) subWrapper.style.display = 'none';
  const subFilter = document.getElementById('search-filter-subcategory');
  if (subFilter) subFilter.value = '';

  if (triggerSearch) handleSearchChange();
}

// 4. Renderers
function renderPeriodChips() {
  const container = document.getElementById('period-chips-container');
  if (!container) return;

  const lang = state.lang || 'el';
  const periodOptions = lang === 'en'
    ? ['Weekly', 'Monthly', 'Annually', 'Custom Period']
    : ['Εβδομάδα', 'Μήνας', 'Έτος', 'Προσαρμοσμένο'];

  container.innerHTML = periodOptions.map(p => {
    return `<button type="button" class="filter-chip" onclick="selectPeriodFilter('${p}', this)">${p}</button>`;
  }).join('');
}

function renderAccountChips() {
  const container = document.getElementById('account-chips-container');
  if (!container) return;

  container.innerHTML = '';

  const getAccIcon = (type) => {
    if (type === 'cash') return '💵';
    if (type === 'card') return '💳';
    if (type === 'bank') return '🏦';
    return '💳';
  };

  state.accounts.forEach(acc => {
    const icon = getAccIcon(acc.type);
    const displayName = getAccountDisplayName(acc);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip';
    chip.innerHTML = `${icon} ${displayName}`;
    chip.onclick = function () {
      selectAccountChipFilter(acc.name, this);
    };
    container.appendChild(chip);
  });
}

function renderCategoryChips() {
  const container = document.getElementById('category-chips-container');
  if (!container) return;

  container.innerHTML = '';

  const filteredCats = state.categories.filter(c => c.type === currentCategoryType);

  filteredCats.forEach(cat => {
    const iconHtml = (typeof renderCategoryIconHtml === 'function')
      ? renderCategoryIconHtml(cat, { size: 'inline', transType: currentCategoryType })
      : (cat.icon && cat.icon.startsWith('fa-') ? `<i class="${cat.icon}"></i>` : (cat.icon || '📁'));
    const hasSubcats = getSortedSubcategoriesForCategory(cat.name).length > 0;
    const arrow = hasSubcats ? ' <i class="fa-solid fa-chevron-down" style="font-size:8px; opacity:0.7;"></i>' : '';

    // Check if selected
    const selectedCat = document.getElementById('search-filter-category').value;
    const isSelected = selectedCat === cat.name;
    const checkmark = isSelected ? ' <i class="fa-solid fa-check" style="font-size:9px; margin-left:2px; color:var(--accent);"></i>' : '';

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `filter-chip ${isSelected ? 'active' : ''}`;
    chip.innerHTML = `${iconHtml} <span>${getCategoryDisplayName(cat.name)}</span>${arrow}${checkmark}`;
    chip.onclick = function () {
      selectCategoryChipFilter(cat.name, this);
    };
    container.appendChild(chip);
  });
}

function renderSubcategoryChips(subcategories) {
  const container = document.getElementById('subcategory-chips-container');
  const wrapper = document.getElementById('subcategory-chips-wrapper');
  if (!container || !wrapper) return;

  container.innerHTML = '';

  const allText = state.lang === 'en' ? 'All' : 'Όλες';
  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = 'filter-chip active';
  allChip.textContent = allText;
  allChip.onclick = function () {
    selectSubcategoryChipFilter('all', this);
  };
  container.appendChild(allChip);

  subcategories.forEach(sub => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip';
    chip.textContent = sub;
    chip.onclick = function () {
      selectSubcategoryChipFilter(sub, this);
    };
    container.appendChild(chip);
  });

  wrapper.style.display = 'block';
}

function initAmountRangeSlider() {
  const track = document.getElementById('slider-track');
  const thumbMin = document.getElementById('slider-thumb-min');
  const thumbMax = document.getElementById('slider-thumb-max');
  const slider = document.getElementById('amount-dual-slider');
  const valDisplay = document.getElementById('amount-range-val');

  if (!track || !thumbMin || !thumbMax || !slider) return;

  const amounts = state.transactions.map(t => parseFloat(t.amount) || 0);
  const maxVal = amounts.length > 0 ? Math.ceil(Math.max(...amounts)) : 1000;

  sliderMinVal = 0;
  sliderMaxVal = maxVal;
  currentMinVal = 0;
  currentMaxVal = maxVal;

  let pctMin = 0;
  let pctMax = 100;

  updateSliderUI();

  function onStart(e, isMin) {
    e.preventDefault();
    if (isMin) isDraggingMin = true;
    else isDraggingMax = true;

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  function onMove(e) {
    if (!isDraggingMin && !isDraggingMax) return;
    if (e.cancelable) e.preventDefault();

    const rect = slider.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));

    if (isDraggingMin) {
      if (pct > pctMax - 5) pct = pctMax - 5;
      pctMin = pct;
      currentMinVal = Math.round(sliderMinVal + (pctMin / 100) * (sliderMaxVal - sliderMinVal));
    } else {
      if (pct < pctMin + 5) pct = pctMin + 5;
      pctMax = pct;
      currentMaxVal = Math.round(sliderMinVal + (pctMax / 100) * (sliderMaxVal - sliderMinVal));
    }

    updateSliderUI();

    document.getElementById('search-filter-amount-min').value = currentMinVal;
    document.getElementById('search-filter-amount-max').value = (pctMax >= 99) ? '' : currentMaxVal;

    // Keep the inline min/max inputs in sync with the slider so the two
    // amount-filter mechanisms never show conflicting values.
    const inlineMin = document.getElementById('search-amount-min-inline');
    const inlineMax = document.getElementById('search-amount-max-inline');
    if (inlineMin) inlineMin.value = currentMinVal;
    if (inlineMax) inlineMax.value = (pctMax >= 99) ? '' : currentMaxVal;

    handleSearchChange();
  }

  function onEnd() {
    isDraggingMin = false;
    isDraggingMax = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
  }

  function updateSliderUI() {
    thumbMin.style.left = pctMin + '%';
    thumbMax.style.left = pctMax + '%';
    track.style.left = pctMin + '%';
    track.style.right = (100 - pctMax) + '%';

    const maxText = (pctMax >= 99) ? 'Max.' : currentMaxVal + ' €';
    if (valDisplay) valDisplay.textContent = `${currentMinVal} € ~ ${maxText}`;
  }

  thumbMin.addEventListener('mousedown', (e) => onStart(e, true));
  thumbMin.addEventListener('touchstart', (e) => onStart(e, true), { passive: false });

  thumbMax.addEventListener('mousedown', (e) => onStart(e, false));
  thumbMax.addEventListener('touchstart', (e) => onStart(e, false), { passive: false });

  // Expose a way to move the slider position from the inline min/max inputs,
  // so the two amount-filter mechanisms stay in sync bidirectionally.
  window.updateAmountSliderFromInline = function (minVal, maxVal) {
    const minNum = parseFloat(minVal);
    const maxNum = parseFloat(maxVal);
    const range = (sliderMaxVal - sliderMinVal) || 1;

    if (!isNaN(minNum)) {
      currentMinVal = Math.max(sliderMinVal, Math.min(sliderMaxVal, minNum));
      pctMin = ((currentMinVal - sliderMinVal) / range) * 100;
    } else {
      currentMinVal = sliderMinVal;
      pctMin = 0;
    }

    if (!isNaN(maxNum)) {
      currentMaxVal = Math.max(sliderMinVal, Math.min(sliderMaxVal, maxNum));
      pctMax = ((currentMaxVal - sliderMinVal) / range) * 100;
    } else {
      currentMaxVal = sliderMaxVal;
      pctMax = 100;
    }

    // Keep min thumb left of max thumb
    if (pctMin > pctMax - 5) pctMin = Math.max(0, pctMax - 5);
    if (pctMax < pctMin + 5) pctMax = Math.min(100, pctMin + 5);

    updateSliderUI();
  };
}

// Bind to window
window.selectPeriodFilter = selectPeriodFilter;
window.applyCustomDates = applyCustomDates;
window.resetPeriodFilter = resetPeriodFilter;
window.selectAccountChipFilter = selectAccountChipFilter;
window.setCategoryTypeFilter = setCategoryTypeFilter;
window.selectCategoryChipFilter = selectCategoryChipFilter;
window.selectSubcategoryChipFilter = selectSubcategoryChipFilter;
window.resetCategoryFilter = resetCategoryFilter;
window.renderPeriodChips = renderPeriodChips;
window.renderAccountChips = renderAccountChips;
window.renderCategoryChips = renderCategoryChips;
window.renderSubcategoryChips = renderSubcategoryChips;
window.initAmountRangeSlider = initAmountRangeSlider;


function openSearchPeriodSheet() {
  openSearchBottomSheet('period');
}

function selectPeriodSearchFilter(val) {
  const today = new Date();
  let dateStart = '';
  let dateEnd = '';
  let labelText = '';

  state.searchPeriod = val;

  if (val === 'all') {
    dateStart = '';
    dateEnd = '';
    labelText = state.lang === 'el' ? 'Όλη η περίοδος' : 'All period';
    document.getElementById('search-filter-date-start').value = '';
    document.getElementById('search-filter-date-end').value = '';
    const valEl = document.getElementById('search-val-period');
    if (valEl) valEl.textContent = labelText;
    closeSearchBottomSheet();
    handleSearchChange();
  } else if (val === 'weekly') {
    const start = new Date();
    start.setDate(today.getDate() - 7);
    dateStart = start.toISOString().split('T')[0];
    dateEnd = today.toISOString().split('T')[0];
    labelText = state.lang === 'el' ? 'Εβδομαδιαία' : 'Weekly';
    document.getElementById('search-filter-date-start').value = dateStart;
    document.getElementById('search-filter-date-end').value = dateEnd;
    const valEl = document.getElementById('search-val-period');
    if (valEl) valEl.textContent = labelText;
    closeSearchBottomSheet();
    handleSearchChange();
  } else if (val === 'monthly') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    dateStart = start.toISOString().split('T')[0];
    dateEnd = today.toISOString().split('T')[0];
    labelText = state.lang === 'el' ? 'Μηνιαία' : 'Monthly';
    document.getElementById('search-filter-date-start').value = dateStart;
    document.getElementById('search-filter-date-end').value = dateEnd;
    const valEl = document.getElementById('search-val-period');
    if (valEl) valEl.textContent = labelText;
    closeSearchBottomSheet();
    handleSearchChange();
  } else if (val === 'annually') {
    const start = new Date(today.getFullYear(), 0, 1);
    dateStart = start.toISOString().split('T')[0];
    dateEnd = today.toISOString().split('T')[0];
    labelText = state.lang === 'el' ? 'Ετήσια' : 'Annually';
    document.getElementById('search-filter-date-start').value = dateStart;
    document.getElementById('search-filter-date-end').value = dateEnd;
    const valEl = document.getElementById('search-val-period');
    if (valEl) valEl.textContent = labelText;
    closeSearchBottomSheet();
    handleSearchChange();
  } else if (val === 'custom') {
    closeSearchBottomSheet(false);
    openModal('search-custom-period-modal');
    const startVal = document.getElementById('search-filter-date-start').value;
    const endVal = document.getElementById('search-filter-date-end').value;
    document.getElementById('search-custom-period-start').value = startVal || today.toISOString().split('T')[0];
    document.getElementById('search-custom-period-end').value = endVal || today.toISOString().split('T')[0];
  }
}

function applySearchCustomPeriod() {
  const startVal = document.getElementById('search-custom-period-start').value;
  const endVal = document.getElementById('search-custom-period-end').value;

  document.getElementById('search-filter-date-start').value = startVal;
  document.getElementById('search-filter-date-end').value = endVal;

  state.searchPeriod = 'custom';

  const valEl = document.getElementById('search-val-period');
  if (valEl) {
    if (startVal && endVal) {
      valEl.textContent = `${startVal} ~ ${endVal}`;
    } else {
      valEl.textContent = state.lang === 'el' ? 'Όλη η περίοδος' : 'All period';
    }
  }

  closeModal('search-custom-period-modal');
  handleSearchChange();
}

function openSearchBottomSheet(type) {
  // Hide all bottom sheets first
  closeSearchBottomSheet(false);

  // Show backdrop
  const backdrop = document.getElementById('search-bottom-sheet-backdrop');
  if (backdrop) backdrop.classList.add('active');

  // Show target sheet
  const sheet = document.getElementById(`search-bottom-sheet-${type}`);
  if (sheet) {
    sheet.classList.add('active');

    // Dynamic populating based on type
    if (type === 'category') {
      populateSearchCategorySheet();
    } else if (type === 'account') {
      populateSearchAccountSheet();
    } else if (type === 'member') {
      populateSearchMemberSheet();
    } else if (type === 'advanced') {
      // Sync visual inputs with the hidden ones
      document.getElementById('search-filter-amount-min-visual').value = document.getElementById('search-filter-amount-min').value;
      document.getElementById('search-filter-amount-max-visual').value = document.getElementById('search-filter-amount-max').value;
      const startVis = document.getElementById('search-filter-date-start-visual');
      const startHid = document.getElementById('search-filter-date-start');
      if (startVis && startHid) startVis.value = startHid.value;
      const endVis = document.getElementById('search-filter-date-end-visual');
      const endHid = document.getElementById('search-filter-date-end');
      if (endVis && endHid) endVis.value = endHid.value;
    }
  }
}

function closeSearchBottomSheet(hideBackdrop = true) {
  document.querySelectorAll('.search-bottom-sheet').forEach(sheet => {
    sheet.classList.remove('active');
  });
  if (hideBackdrop) {
    const backdrop = document.getElementById('search-bottom-sheet-backdrop');
    if (backdrop) backdrop.classList.remove('active');
  }
}

// Get category type ('expense' or 'income') for search category filtering
function getCategoryType(catName) {
  if (!catName) return '';
  const catObj = state.categories.find(c => c.name === catName);
  if (catObj) return catObj.type;

  const trans = state.transactions.find(t => t.category === catName);
  if (trans) return trans.type;

  return '';
}

function selectTypeSearchFilter(val) {
  const hiddenSelect = document.getElementById('search-filter-type');
  if (hiddenSelect) {
    hiddenSelect.value = val;
  }

  // If the currently selected category doesn't match the new selected type, clear the category selection
  const currentCat = document.getElementById('search-filter-category')?.value;
  if (currentCat && val) {
    const catType = getCategoryType(currentCat);
    if (catType && catType !== val) {
      const hiddenCat = document.getElementById('search-filter-category');
      const hiddenSub = document.getElementById('search-filter-subcategory');
      if (hiddenCat) hiddenCat.value = '';
      if (hiddenSub) hiddenSub.value = '';

      const catChip = document.getElementById('search-chip-category');
      if (catChip) {
        const label = catChip.querySelector('.chip-label');
        if (label) {
          label.textContent = TRANSLATIONS[state.lang]['search_chip_category'] || 'Κατηγορία';
        }
        catChip.classList.remove('active');
      }
    }
  }

  const valDisplay = document.getElementById('search-val-type');
  if (valDisplay) {
    if (val) {
      valDisplay.textContent = val === 'expense' ? (state.lang === 'el' ? 'Έξοδο' : 'Expense')
        : val === 'income' ? (state.lang === 'el' ? 'Έσοδο' : 'Income')
          : (state.lang === 'el' ? 'Μεταφορά' : 'Transfer');
    } else {
      valDisplay.textContent = state.lang === 'el' ? 'Όλοι οι τύποι' : 'All types';
    }
  }

  // Update Type Chip UI
  const chip = document.getElementById('search-chip-type');
  if (chip) {
    const label = chip.querySelector('.chip-label');
    if (label) {
      if (val) {
        let text = val === 'expense' ? TRANSLATIONS[state.lang]['type_tab_expense'] : val === 'income' ? TRANSLATIONS[state.lang]['type_tab_income'] : TRANSLATIONS[state.lang]['type_tab_transfer'];
        label.textContent = `✓ ${text}`;
        chip.classList.add('active');
      } else {
        label.textContent = TRANSLATIONS[state.lang]['search_chip_type'] || 'Τύπος';
        chip.classList.remove('active');
      }
    }
  }

  // Update active option styling in sheet
  const sheet = document.getElementById('search-bottom-sheet-type');
  if (sheet) {
    sheet.querySelectorAll('.bottom-sheet-option').forEach(opt => {
      opt.classList.toggle('active', opt.getAttribute('data-value') === val);
    });
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

function populateSearchAccountSheet() {
  const container = document.getElementById('search-bottom-sheet-account-list');
  if (!container) return;

  const currentVal = document.getElementById('search-filter-account').value;

  let html = `
    <div class="bottom-sheet-option ${currentVal === '' ? 'active' : ''}" onclick="selectAccountSearchFilter('')">
      <span class="option-label">${state.lang === 'el' ? 'Όλοι οι τρόποι πληρωμής' : 'All accounts'}</span>
      <i class="fa-solid fa-check option-check-icon"></i>
    </div>
  `;

  state.accounts.forEach(acc => {
    const isActive = acc.name === currentVal;
    html += `
      <div class="bottom-sheet-option ${isActive ? 'active' : ''}" onclick="selectAccountSearchFilter('${acc.name}')">
        <span class="option-label"><i class="fa-solid fa-wallet" style="margin-right: 8px; color: var(--accent);"></i> ${getAccountDisplayName(acc)}</span>
        <i class="fa-solid fa-check option-check-icon"></i>
      </div>
    `;
  });

  container.innerHTML = html;
}

function selectAccountSearchFilter(val) {
  const hiddenSelect = document.getElementById('search-filter-account');
  if (hiddenSelect) {
    hiddenSelect.value = val;
  }

  // Update Account UI Row
  const valDisplay = document.getElementById('search-val-account');
  if (valDisplay) {
    if (val) {
      valDisplay.textContent = getAccountDisplayName(val);
    } else {
      valDisplay.textContent = state.lang === 'el' ? 'Όλοι' : 'All';
    }
  }

  // Fallback update to Account Chip UI if it exists
  const chip = document.getElementById('search-chip-account');
  if (chip) {
    const label = chip.querySelector('.chip-label');
    if (label) {
      if (val) {
        label.textContent = `✓ ${getAccountDisplayName(val)}`;
        chip.classList.add('active');
      } else {
        label.textContent = TRANSLATIONS[state.lang]['search_chip_account'] || 'Λογαριασμός';
        chip.classList.remove('active');
      }
    }
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

function populateSearchCategorySheet() {
  const container = document.getElementById('search-bottom-sheet-category-list');
  if (!container) return;

  const currentCat = document.getElementById('search-filter-category').value;
  const currentSub = document.getElementById('search-filter-subcategory').value;
  const searchType = document.getElementById('search-filter-type')?.value || '';

  let html = `
    <div class="bottom-sheet-option ${currentCat === '' && currentSub === '' ? 'active' : ''}" onclick="selectCategorySearchFilter('', '')">
      <span class="option-label">${state.lang === 'el' ? 'Όλες οι κατηγορίες' : 'All categories'}</span>
      <i class="fa-solid fa-check option-check-icon"></i>
    </div>
  `;

  // Get all unique category names
  const allCats = new Set();
  state.categories.forEach(c => allCats.add(c.name));
  state.transactions.forEach(t => { if (t.category) allCats.add(t.category); });

  // Map category name to type
  const catTypeMap = {};
  state.categories.forEach(c => {
    if (c.name) catTypeMap[c.name] = c.type;
  });
  state.transactions.forEach(t => {
    if (t.category && !catTypeMap[t.category]) {
      catTypeMap[t.category] = t.type;
    }
  });

  let sortedCats = Array.from(allCats);
  if (searchType === 'income' || searchType === 'expense') {
    sortedCats = sortedCats.filter(catName => {
      const type = catTypeMap[catName];
      return type === searchType;
    });
  }
  sortedCats.sort((a, b) => getCategoryDisplayName(a).localeCompare(getCategoryDisplayName(b)));

  sortedCats.forEach(catName => {
    const isCatActive = catName === currentCat && !currentSub;
    const catInfo = getCategoryInfo(catName);
    const iconHtml = (typeof renderCategoryIconHtml === 'function')
      ? renderCategoryIconHtml(catName, { size: 'inline' })
      : (catInfo.icon && catInfo.icon.startsWith('fa-') ? `<i class="${catInfo.icon}"></i>` : (catInfo.icon || '📁'));
    const displayName = getCategoryDisplayName(catName);

    html += `
      <div class="bottom-sheet-option ${isCatActive ? 'active' : ''}" onclick="selectCategorySearchFilter('${catName}', '')">
        <span class="option-label" style="display:flex; align-items:center; gap:6px;">${iconHtml} ${displayName}</span>
        <i class="fa-solid fa-check option-check-icon"></i>
      </div>
    `;

    // Find subcategories for this category using getSortedSubcategoriesForCategory
    const subcats = getSortedSubcategoriesForCategory(catName);

    if (subcats.length > 0) {
      subcats.forEach(subName => {
        const isSubActive = catName === currentCat && subName === currentSub;
        html += `
          <div class="bottom-sheet-option subcategory-option ${isSubActive ? 'active' : ''}" onclick="selectCategorySearchFilter('${catName}', '${subName}')" style="padding-left: 36px; font-size: 12.5px; opacity: 0.9;">
            <span class="option-label"><i class="fa-solid fa-turn-up" style="transform: rotate(90deg); margin-right: 8px; color: var(--text-muted); font-size: 10px;"></i> ${getSubcategoryDisplayName(subName, catName)}</span>
            <i class="fa-solid fa-check option-check-icon"></i>
          </div>
        `;
      });
    }
  });

  container.innerHTML = html;
}

function selectCategorySearchFilter(cat, sub) {
  const hiddenCat = document.getElementById('search-filter-category');
  const hiddenSub = document.getElementById('search-filter-subcategory');
  if (hiddenCat) hiddenCat.value = cat;
  if (hiddenSub) hiddenSub.value = sub;

  // Update Category UI Row
  const valDisplay = document.getElementById('search-val-category');
  if (valDisplay) {
    if (cat) {
      if (sub) {
        valDisplay.textContent = `${getCategoryDisplayName(cat)} > ${getSubcategoryDisplayName(sub, cat)}`;
      } else {
        valDisplay.textContent = getCategoryDisplayName(cat);
      }
    } else {
      valDisplay.textContent = state.lang === 'el' ? 'Όλες' : 'All';
    }
  }

  // Fallback update to Category Chip UI if it exists
  const chip = document.getElementById('search-chip-category');
  if (chip) {
    const label = chip.querySelector('.chip-label');
    if (label) {
      if (cat) {
        if (sub) {
          label.textContent = `✓ ${getSubcategoryDisplayName(sub, cat)}`;
        } else {
          label.textContent = `✓ ${getCategoryDisplayName(cat)}`;
        }
        chip.classList.add('active');
      } else {
        label.textContent = TRANSLATIONS[state.lang]['search_chip_category'] || 'Κατηγορία';
        chip.classList.remove('active');
      }
    }
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

function populateSearchMemberSheet() {
  const container = document.getElementById('search-bottom-sheet-member-list');
  if (!container) return;

  const currentVal = document.getElementById('search-filter-member').value;

  const myName = state.userProfile?.display_name || state.currentUser?.email?.split('@')[0] || (state.lang === 'el' ? 'Εσείς' : 'You');
  const myId = state.currentUser?.id || '';

  let html = `
    <div class="bottom-sheet-option ${currentVal === '' ? 'active' : ''}" onclick="selectMemberSearchFilter('')">
      <span class="option-label">${state.lang === 'el' ? 'Όλα τα μέλη' : 'All members'}</span>
      <i class="fa-solid fa-check option-check-icon"></i>
    </div>
  `;

  // My option
  html += `
    <div class="bottom-sheet-option ${currentVal === myId ? 'active' : ''}" onclick="selectMemberSearchFilter('${myId}')">
      <span class="option-label"><i class="fa-solid fa-user" style="margin-right: 8px; color: var(--accent);"></i> ${myName}</span>
      <i class="fa-solid fa-check option-check-icon"></i>
    </div>
  `;

  // Partner option if exists
  if (state.partnerProfile) {
    const partnerName = state.partnerProfile.display_name || state.partnerProfile.email.split('@')[0] || (state.lang === 'el' ? 'Σύντροφος' : 'Partner');
    const partnerId = state.partnerProfile.id;
    html += `
      <div class="bottom-sheet-option ${currentVal === partnerId ? 'active' : ''}" onclick="selectMemberSearchFilter('${partnerId}')">
        <span class="option-label"><i class="fa-solid fa-user-group" style="margin-right: 8px; color: var(--accent);"></i> ${partnerName}</span>
        <i class="fa-solid fa-check option-check-icon"></i>
      </div>
    `;
  }

  container.innerHTML = html;
}

function syncAmountFiltersFromInline() {
  const minVal = document.getElementById('search-amount-min-inline')?.value || '';
  const maxVal = document.getElementById('search-amount-max-inline')?.value || '';
  const hiddenMin = document.getElementById('search-filter-amount-min');
  const hiddenMax = document.getElementById('search-filter-amount-max');
  if (hiddenMin) hiddenMin.value = minVal;
  if (hiddenMax) hiddenMax.value = maxVal;

  // Keep the dual range slider in sync with the inline inputs.
  if (typeof window.updateAmountSliderFromInline === 'function') {
    window.updateAmountSliderFromInline(minVal, maxVal);
  }

  handleSearchChange();
}

function selectMemberSearchFilter(val) {
  const hiddenInput = document.getElementById('search-filter-member');
  if (hiddenInput) {
    hiddenInput.value = val;
  }

  // Update Member Row display UI
  const valDisplay = document.getElementById('search-val-member');
  if (valDisplay) {
    if (val) {
      let name = '';
      const myId = state.currentUser?.id || '';
      if (val === myId) {
        name = state.userProfile?.display_name || state.currentUser?.email?.split('@')[0] || (state.lang === 'el' ? 'Εσείς' : 'You');
      } else if (state.partnerProfile && val === state.partnerProfile.id) {
        name = state.partnerProfile.display_name || state.partnerProfile.email.split('@')[0] || (state.lang === 'el' ? 'Σύντροφος' : 'Partner');
      }
      valDisplay.textContent = name;
    } else {
      valDisplay.textContent = state.lang === 'el' ? 'Όλα τα μέλη' : 'All members';
    }
  }

  // Update Member Chip UI if exists
  const chip = document.getElementById('search-chip-member');
  if (chip) {
    const label = chip.querySelector('.chip-label');
    if (label) {
      if (val) {
        let name = '';
        const myId = state.currentUser?.id || '';
        if (val === myId) {
          name = state.userProfile?.display_name || state.currentUser?.email?.split('@')[0] || (state.lang === 'el' ? 'Εσείς' : 'You');
        } else if (state.partnerProfile && val === state.partnerProfile.id) {
          name = state.partnerProfile.display_name || state.partnerProfile.email.split('@')[0] || (state.lang === 'el' ? 'Σύντροφος' : 'Partner');
        }
        label.textContent = `✓ ${name}`;
        chip.classList.add('active');
      } else {
        label.textContent = TRANSLATIONS[state.lang]['search_chip_member'] || 'Μέλος';
        chip.classList.remove('active');
      }
    }
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

function selectPhotoSearchFilter(val) {
  const hiddenInput = document.getElementById('search-filter-photo');
  if (hiddenInput) {
    hiddenInput.value = val;
  }

  // Update Photo row display UI
  const valDisplay = document.getElementById('search-val-photo');
  if (valDisplay) {
    if (val === 'has_photo') {
      valDisplay.textContent = state.lang === 'el' ? 'Με απόδειξη' : 'With receipt';
    } else if (val === 'no_photo') {
      valDisplay.textContent = state.lang === 'el' ? 'Χωρίς απόδειξη' : 'Without receipt';
    } else {
      valDisplay.textContent = state.lang === 'el' ? 'Όλες' : 'All';
    }
  }

  // Update Photo Chip UI if exists
  const chip = document.getElementById('search-chip-photo');
  if (chip) {
    const label = chip.querySelector('.chip-label');
    if (label) {
      if (val) {
        let text = val === 'has_photo' ? (state.lang === 'el' ? 'Με απόδειξη' : 'With receipt') : (state.lang === 'el' ? 'Χωρίς απόδειξη' : 'Without receipt');
        label.textContent = `✓ ${text}`;
        chip.classList.add('active');
      } else {
        label.textContent = TRANSLATIONS[state.lang]['search_chip_photo'] || 'Απόδειξη';
        chip.classList.remove('active');
      }
    }
  }

  // Update active option styling in sheet
  const sheet = document.getElementById('search-bottom-sheet-photo');
  if (sheet) {
    sheet.querySelectorAll('.bottom-sheet-option').forEach(opt => {
      const optVal = opt.getAttribute('data-value') || '';
      opt.classList.toggle('active', optVal === val);
    });
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

function applyAdvancedSearchFiltersVisual() {
  const minVal = document.getElementById('search-filter-amount-min-visual').value;
  const maxVal = document.getElementById('search-filter-amount-max-visual').value;
  const startVis = document.getElementById('search-filter-date-start-visual');
  const endVis = document.getElementById('search-filter-date-end-visual');

  document.getElementById('search-filter-amount-min').value = minVal;
  document.getElementById('search-filter-amount-max').value = maxVal;
  if (startVis) document.getElementById('search-filter-date-start').value = startVis.value;
  if (endVis) document.getElementById('search-filter-date-end').value = endVis.value;

  // Update Amount UI Row
  const valDisplay = document.getElementById('search-val-amount');
  if (valDisplay) {
    if (minVal || maxVal) {
      const minText = minVal ? `${minVal} €` : 'Min.';
      const maxText = maxVal ? `${maxVal} €` : 'Max.';
      valDisplay.textContent = `${minText} ~ ${maxText}`;
    } else {
      valDisplay.textContent = 'Min. ~ Max.';
    }
  }

  // Update Advanced Chip UI if exists
  const chip = document.getElementById('search-chip-advanced');
  if (chip) {
    const hasValues = minVal || maxVal || (startVis && startVis.value) || (endVis && endVis.value);
    if (hasValues) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

// Clear visual dashboard filters if initialized
function resetAdvancedSearchFiltersVisual() {
  document.getElementById('search-filter-amount-min-visual').value = '';
  document.getElementById('search-filter-amount-max-visual').value = '';
  const startVis = document.getElementById('search-filter-date-start-visual');
  if (startVis) startVis.value = '';
  const endVis = document.getElementById('search-filter-date-end-visual');
  if (endVis) endVis.value = '';

  document.getElementById('search-filter-amount-min').value = '';
  document.getElementById('search-filter-amount-max').value = '';
  document.getElementById('search-filter-date-start').value = '';
  document.getElementById('search-filter-date-end').value = '';

  // Update Amount UI Row
  const valDisplay = document.getElementById('search-val-amount');
  if (valDisplay) {
    valDisplay.textContent = 'Min. ~ Max.';
  }

  const chip = document.getElementById('search-chip-advanced');
  if (chip) chip.classList.remove('active');

  closeSearchBottomSheet();
  handleSearchChange();
}

function resetAllSearchChips() {
  const typeChip = document.getElementById('search-chip-type');
  if (typeChip) {
    const label = typeChip.querySelector('.chip-label');
    if (label) label.textContent = TRANSLATIONS[state.lang]['search_chip_type'] || 'Τύπος';
    typeChip.classList.remove('active');
  }
  const catChip = document.getElementById('search-chip-category');
  if (catChip) {
    const label = catChip.querySelector('.chip-label');
    if (label) label.textContent = TRANSLATIONS[state.lang]['search_chip_category'] || 'Κατηγορία';
    catChip.classList.remove('active');
  }
  const accChip = document.getElementById('search-chip-account');
  if (accChip) {
    const label = accChip.querySelector('.chip-label');
    if (label) label.textContent = TRANSLATIONS[state.lang]['search_chip_account'] || 'Λογαριασμός';
    accChip.classList.remove('active');
  }
  const memChip = document.getElementById('search-chip-member');
  if (memChip) {
    const label = memChip.querySelector('.chip-label');
    if (label) label.textContent = TRANSLATIONS[state.lang]['search_chip_member'] || 'Μέλος';
    memChip.classList.remove('active');
  }
  const photoChip = document.getElementById('search-chip-photo');
  if (photoChip) {
    const label = photoChip.querySelector('.chip-label');
    if (label) label.textContent = TRANSLATIONS[state.lang]['search_chip_photo'] || 'Απόδειξη';
    photoChip.classList.remove('active');
  }
  const advChip = document.getElementById('search-chip-advanced');
  if (advChip) {
    advChip.classList.remove('active');
  }

  // Reset new search val elements
  const periodVal = document.getElementById('search-val-period');
  if (periodVal) periodVal.textContent = state.lang === 'el' ? 'Όλη η περίοδος' : 'All period';

  const accountVal = document.getElementById('search-val-account');
  if (accountVal) accountVal.textContent = state.lang === 'el' ? 'Όλοι' : 'All';

  const categoryVal = document.getElementById('search-val-category');
  if (categoryVal) categoryVal.textContent = state.lang === 'el' ? 'Όλες' : 'All';

  const memberVal = document.getElementById('search-val-member');
  if (memberVal) memberVal.textContent = state.lang === 'el' ? 'Όλα τα μέλη' : 'All members';

  const photoVal = document.getElementById('search-val-photo');
  if (photoVal) photoVal.textContent = state.lang === 'el' ? 'Όλες' : 'All';

  const amountVal = document.getElementById('search-val-amount');
  if (amountVal) amountVal.textContent = 'Min. ~ Max.';

  // Reset active checkmark in sheets
  const memSheet = document.getElementById('search-bottom-sheet-member');
  if (memSheet) {
    memSheet.querySelectorAll('.bottom-sheet-option').forEach(opt => {
      opt.classList.toggle('active', opt.getAttribute('data-value') === '' || !opt.hasAttribute('data-value'));
    });
  }
  const photoSheet = document.getElementById('search-bottom-sheet-photo');
  if (photoSheet) {
    photoSheet.querySelectorAll('.bottom-sheet-option').forEach(opt => {
      const optVal = opt.getAttribute('data-value') || '';
      opt.classList.toggle('active', optVal === '');
    });
  }

  state.searchPeriod = 'all';
}

// Bind to window to ensure HTML inline onclick works perfectly
window.openSearchOverlay = openSearchOverlay;
window.closeSearchOverlay = closeSearchOverlay;
window.openSearchBottomSheet = openSearchBottomSheet;
window.closeSearchBottomSheet = closeSearchBottomSheet;
window.syncAmountFiltersFromInline = syncAmountFiltersFromInline;
window.resetSearchFilters = resetSearchFilters;
window.clearSearchInput = clearSearchInput;
window.selectTypeSearchFilter = selectTypeSearchFilter;
window.selectAccountSearchFilter = selectAccountSearchFilter;
window.selectCategorySearchFilter = selectCategorySearchFilter;
window.selectMemberSearchFilter = selectMemberSearchFilter;
window.selectPhotoSearchFilter = selectPhotoSearchFilter;
window.handleSearchChange = handleSearchChange;
window.loadMoreSearchResults = loadMoreSearchResults;
window.toggleSearchFiltersPanel = toggleSearchFiltersPanel;
window.applyAdvancedSearchFiltersVisual = applyAdvancedSearchFiltersVisual;
window.resetAdvancedSearchFiltersVisual = resetAdvancedSearchFiltersVisual;
window.resetAllSearchChips = resetAllSearchChips;
window.openSearchPeriodSheet = openSearchPeriodSheet;
window.selectPeriodSearchFilter = selectPeriodSearchFilter;
window.applySearchCustomPeriod = applySearchCustomPeriod;


function populateSearchFilterDropdowns() {
  // Populate accounts filter
  const accSelect = document.getElementById('search-filter-account');
  if (accSelect) {
    accSelect.innerHTML = `<option value="">${state.lang === 'el' ? 'Όλοι οι τρόποι πληρωμής' : 'All accounts'}</option>`;
    state.accounts.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc.name;
      opt.textContent = getAccountDisplayName(acc);
      accSelect.appendChild(opt);
    });
  }

  // Populate categories filter
  const catSelect = document.getElementById('search-filter-category');
  if (catSelect) {
    catSelect.innerHTML = `<option value="">${(TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['label_all_categories']) || 'Όλες οι κατηγορίες'}</option>`;
    const allCats = new Set();
    state.categories.forEach(c => allCats.add(c.name));
    state.transactions.forEach(t => { if (t.category) allCats.add(t.category); });
    Array.from(allCats).sort().forEach(catName => {
      const opt = document.createElement('option');
      opt.value = catName;
      opt.textContent = catName;
      catSelect.appendChild(opt);
    });
    // Wire up category change to update subcategory dropdown
    catSelect.onchange = function () {
      handleSearchChange();
      populateSearchSubcategoryDropdown(this.value);
    };
  }

  // Sync custom dropdowns!
  if (typeof syncCustomSelect === 'function') {
    syncCustomSelect('type');
    syncCustomSelect('account');
    syncCustomSelect('category');
  } else if (typeof window !== 'undefined' && typeof window.syncCustomSelect === 'function') {
    window.syncCustomSelect('type');
    window.syncCustomSelect('account');
    window.syncCustomSelect('category');
  }

  // Populate subcategory filter (all subcats initially)
  populateSearchSubcategoryDropdown('');
}

function populateSearchSubcategoryDropdown(filterByCat) {
  const subSelect = document.getElementById('search-filter-subcategory');
  if (!subSelect) return;
  subSelect.innerHTML = `<option value="">${(TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['label_all']) || 'Όλες'}</option>`;
  const allSubs = new Set();
  state.transactions.forEach(t => {
    if (t.subcategory && t.subcategory.trim()) {
      // If a category is selected, only show subcats from that cat
      if (!filterByCat || t.category === filterByCat) {
        allSubs.add(t.subcategory.trim());
      }
    }
  });
  Array.from(allSubs).sort().forEach(subName => {
    const opt = document.createElement('option');
    opt.value = subName;
    opt.textContent = subName;
    subSelect.appendChild(opt);
  });

  // Sync subcategory custom select!
  if (typeof syncCustomSelect === 'function') {
    syncCustomSelect('subcategory');
  } else if (typeof window !== 'undefined' && typeof window.syncCustomSelect === 'function') {
    window.syncCustomSelect('subcategory');
  }
}


function resetSearchFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('search-filter-type').value = '';
  document.getElementById('search-filter-account').value = '';
  document.getElementById('search-filter-category').value = '';
  const subSel = document.getElementById('search-filter-subcategory');
  if (subSel) subSel.value = '';
  document.getElementById('search-filter-amount-min').value = '';
  document.getElementById('search-filter-amount-max').value = '';
  // Also clear inline amount inputs
  const inlineMin = document.getElementById('search-amount-min-inline');
  const inlineMax = document.getElementById('search-amount-max-inline');
  if (inlineMin) inlineMin.value = '';
  if (inlineMax) inlineMax.value = '';
  document.getElementById('search-filter-date-start').value = '';
  document.getElementById('search-filter-date-end').value = '';

  // Reset member filter
  const memSel = document.getElementById('search-filter-member');
  if (memSel) memSel.value = '';

  // Reset photo filter
  const photoSel = document.getElementById('search-filter-photo');
  if (photoSel) photoSel.value = '';

  // Reset visual dashboard filters if initialized
  if (typeof resetPeriodFilter === 'function') {
    resetPeriodFilter();
  }
  if (typeof resetCategoryFilter === 'function') {
    resetCategoryFilter(false);
  }

  // Reset segmented switcher
  const segExpense = document.getElementById('seg-tab-expense');
  const segIncome = document.getElementById('seg-tab-income');
  if (segExpense && segIncome) {
    segExpense.className = 'segmented-tab active';
    segIncome.className = 'segmented-tab';
    document.getElementById('category-segmented-control')?.style.setProperty('--segmented-active-bg', 'var(--red-negative, #ef5350)');
  }
  currentCategoryType = 'expense';
  document.getElementById('search-filter-type').value = '';
  const typeVal = document.getElementById('search-val-type');
  if (typeVal) typeVal.textContent = state.lang === 'el' ? 'Όλοι οι τύποι' : 'All types';

  if (typeof renderCategoryChips === 'function') {
    renderCategoryChips();
  }
  if (typeof initAmountRangeSlider === 'function') {
    initAmountRangeSlider();
  }

  populateSearchSubcategoryDropdown('');

  // Sync the custom UI trigger labels and selections
  if (typeof updateCustomSelectTriggers === 'function') {
    updateCustomSelectTriggers();
  } else if (typeof window !== 'undefined' && typeof window.updateCustomSelectTriggers === 'function') {
    window.updateCustomSelectTriggers();
  }

  // Reset visual chip elements to default labels
  resetAllSearchChips();

  handleSearchChange();
}

function clearSearchInput() {
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  if (clearBtn) clearBtn.classList.remove('visible');
  handleSearchChange();
}


function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ς/g, 'σ') // Normalize Greek final sigma so "καφές" matches "καφεσ"
    .trim();
}

// Debounce the search input so filtering/rendering only happens after the user
// pauses typing. This avoids re-running the (potentially expensive) filter +
// grouped render on every keystroke.
let _searchDebounceTimer = null;
function debouncedSearchChange() {
  clearTimeout(_searchDebounceTimer);
  _searchDebounceTimer = setTimeout(() => handleSearchChange(), 200);
}

function handleSearchChange(resetLimit = true) {
  if (resetLimit === true) {
    searchResultLimit = 50;
  }
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');

  // Show/hide the clear button based on input
  if (clearBtn) {
    if (searchInput && searchInput.value.length > 0) {
      clearBtn.classList.add('visible');
    } else {
      clearBtn.classList.remove('visible');
    }
  }

  const query = normalizeText(searchInput.value);
  const filterType = document.getElementById('search-filter-type').value;
  const filterAcc = document.getElementById('search-filter-account').value;
  const filterCat = document.getElementById('search-filter-category').value;
  const filterSubEl = document.getElementById('search-filter-subcategory');
  const filterSub = filterSubEl ? filterSubEl.value : '';
  const minAmt = parseFloat(document.getElementById('search-filter-amount-min').value) || null;
  const maxAmt = parseFloat(document.getElementById('search-filter-amount-max').value) || null;
  const dateStart = document.getElementById('search-filter-date-start').value;
  const dateEnd = document.getElementById('search-filter-date-end').value;

  // Member Filter value
  const filterMember = document.getElementById('search-filter-member')?.value || '';
  const filterPhoto = document.getElementById('search-filter-photo')?.value || '';

  const filtered = state.transactions.filter(t => {
    // 1. Text Query (Search in Note, Category, Subcategory, Description, Account, and Amount)
    if (query) {
      const note = normalizeText(t.note);
      const cat = normalizeText(t.category);
      const sub = normalizeText(t.subcategory);
      const desc = normalizeText(t.description);
      const acc = normalizeText(t.account_from);
      const accTo = normalizeText(t.account_to);

      const textMatch = note.includes(query) || cat.includes(query) || sub.includes(query) || desc.includes(query) || acc.includes(query) || accTo.includes(query);

      // Amount matching: only treat the query as an amount when it is purely
      // numeric (digits, optional decimal separator). This avoids noisy
      // substring matches like "12" matching "112", "120", "12.50", etc.
      let amtMatch = false;
      const numericQuery = query.replace(',', '.').trim();
      if (/^\d+(\.\d+)?$/.test(numericQuery)) {
        const queryNum = parseFloat(numericQuery);
        const amtNum = parseFloat(t.amount) || 0;
        // Match when the query equals the amount, or is a prefix of it
        // (e.g. "12" matches 12.50), but never a loose substring.
        amtMatch = amtNum === queryNum || String(amtNum).startsWith(numericQuery);
      }

      if (!textMatch && !amtMatch) {
        return false;
      }
    }

    // 2. Type Filter
    if (filterType && t.type !== filterType) return false;

    // 3. Account Filter
    if (filterAcc && t.account_from !== filterAcc && t.account_to !== filterAcc) return false;

    // 4. Category Filter
    if (filterCat && t.category !== filterCat) return false;

    // 4b. Subcategory Filter
    if (filterSub && (t.subcategory || '').trim() !== filterSub) return false;

    // 4c. Member Filter (user_id matching)
    if (filterMember && t.user_id !== filterMember) return false;

    // 4d. Photo/Receipt Filter
    if (filterPhoto) {
      const hasPhoto = !!(t.photo_local_uri || t.photo_url);
      if (filterPhoto === 'has_photo' && !hasPhoto) return false;
      if (filterPhoto === 'no_photo' && hasPhoto) return false;
    }

    // 5. Amount Range Filter
    const amt = parseFloat(t.amount) || 0;
    if (minAmt !== null && amt < minAmt) return false;
    if (maxAmt !== null && amt > maxAmt) return false;

    // 6. Date Range Filter
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    if (dateStart && datePart < dateStart) return false;
    if (dateEnd && datePart > dateEnd) return false;

    return true;
  });

  // Sort transactions by date descending
  filtered.sort(compareTransactions);

  // Update Badge Count if exists
  const countBadge = document.getElementById('search-results-count');
  if (countBadge) {
    countBadge.textContent = filtered.length;
  }

  // Calculate Totals for search summary bar. Aggregate each transaction in the
  // display currency so amounts convert with the exchange rate when the app
  // currency changes (e.g. 1316 € → ~1420 $).
  const searchDisplayCurrency = getDisplayCurrency();
  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransfer = 0;

  filtered.forEach(t => {
    const amt = CurrencyService.displayAmount(t, searchDisplayCurrency);
    if (t.type === 'income') {
      totalIncome += amt;
    } else if (t.type === 'expense') {
      totalExpense += amt;
    } else if (t.type === 'transfer') {
      totalTransfer += amt;
    }
  });

  const currencySymbol = getCurrencySymbol();
  const incomeValEl = document.getElementById('search-summary-income-val');
  const expenseValEl = document.getElementById('search-summary-expense-val');
  const transferValEl = document.getElementById('search-summary-transfer-val');

  if (incomeValEl) incomeValEl.textContent = `${currencySymbol} ${formatDisplayAmount(totalIncome, searchDisplayCurrency)}`;
  if (expenseValEl) expenseValEl.textContent = `${currencySymbol} ${formatDisplayAmount(totalExpense, searchDisplayCurrency)}`;
  if (transferValEl) transferValEl.textContent = `${currencySymbol} ${formatDisplayAmount(totalTransfer, searchDisplayCurrency)}`;

  // Render Day-Grouped search results
  const resultsContainer = document.getElementById('search-results-list');
  renderGroupedTransactions(filtered, resultsContainer);

}

function renderGroupedTransactions(transactions, container) {
  container.innerHTML = '';
  const searchDisplayCurrency = getDisplayCurrency();

  if (transactions.length === 0) {
    const lang = state.lang || 'el';
    const title = lang === 'el' ? 'Δεν βρέθηκαν συναλλαγές' : 'No transactions found';
    const desc = lang === 'el' ? 'Δοκιμάστε άλλα φίλτρα ή λέξεις-κλειδιά' : 'Try different filters or keywords';
    container.innerHTML = `
      <div style="text-align:center; padding: 48px 16px; color:var(--text-secondary); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px;">
        <div style="width:54px; height:54px; border-radius:50%; background:rgba(255,255,255,0.03); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:22px; color:var(--text-muted); margin-bottom:4px;">
          <i class="fa-solid fa-magnifying-glass"></i>
        </div>
        <h4 style="margin:0; font-family:'Outfit',sans-serif; font-size:16px; font-weight:700; color:var(--text-primary);">${title}</h4>
        <p style="margin:0; font-size:13px; color:var(--text-secondary); line-height:1.4; max-width:260px;">${desc}</p>
      </div>`;
    return;
  }

  const itemsToRender = transactions.slice(0, searchResultLimit);

  // Group transactions by day so results are not a flat, mixed list.
  // Each day gets a header (with per-day income/expense totals) followed by
  // its transactions, matching the main transactions list layout.
  const groups = {};
  itemsToRender.forEach(t => {
    const dateKey = String(t.date || '').split('T')[0].split(' ')[0];
    if (!groups[dateKey]) groups[dateKey] = { transactions: [], income: 0, expense: 0 };
    groups[dateKey].transactions.push(t);
    const amt = CurrencyService.displayAmount(t, searchDisplayCurrency);
    if (t.type === 'income') groups[dateKey].income += amt;
    else if (t.type === 'expense') groups[dateKey].expense += amt;
  });

  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(dateStr => {
    const group = groups[dateStr];
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const shortDay = getWeekdayName(dayOfWeek);
    const weekendClass = dayOfWeek === 6 ? ' saturday' : dayOfWeek === 0 ? ' sunday' : '';
    const isToday = (dateStr === todayStr);

    let rightTotals = '';
    if (group.income > 0) rightTotals += `<span class="day-group-income">${getCurrencySymbol()} ${formatDisplayAmount(group.income, searchDisplayCurrency)}</span>`;
    if (group.expense > 0) rightTotals += `<span class="day-group-expense">${getCurrencySymbol()} ${formatDisplayAmount(group.expense, searchDisplayCurrency)}</span>`;

    const header = document.createElement('div');
    header.className = 'day-header' + (isToday ? ' is-today' : '');
    const todayBadge = isToday ? ` <span class="today-badge">${state.lang === 'el' ? 'ΣΗΜΕΡΑ' : 'TODAY'}</span>` : '';
    header.innerHTML = `
      <div class="day-header-left">
        <span class="day-num">${d}</span>
        <div>
          <span class="day-name${weekendClass}">${shortDay}</span>${todayBadge}
          <span class="day-month">${getMonthName(m - 1, true)} ${y}</span>
        </div>
      </div>
      <div class="day-header-right">${rightTotals}</div>`;
    container.appendChild(header);

    group.transactions.forEach(t => {
      const catInfo = getCategoryInfo(t.category, t.type);
      const item = document.createElement('div');

      const isSelected = state.selectedSearchIds && state.selectedSearchIds.has(t.id);
      item.className = 'search-result-item';
      if (state.searchSelectMode) {
        item.className += ' selectable';
        if (isSelected) {
          item.style.background = 'rgba(33, 150, 243, 0.15)';
        }
      }

      let pressTimer;
      let feedbackTimer;
      let isLongPress = false;
      let touchDidMove = false;

      // touchstart listener for long-press selection initiation
      item.addEventListener('touchstart', (e) => {
        isLongPress = false;
        touchDidMove = false;

        clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(() => {
          if (!touchDidMove) {
            item.classList.add('pressed');
          }
        }, 80);

        if (state.searchSelectMode) return;
        pressTimer = setTimeout(() => {
          isLongPress = true;
          toggleSearchSelectMode(); // enter select mode
          toggleSearchSelection(t.id, item); // select this item
          if (navigator.vibrate) {
            try { navigator.vibrate(15); } catch (err) { }
          }
        }, 600);
      }, { passive: true });

      // touchmove listener - scrolling cancels selection
      item.addEventListener('touchmove', (e) => {
        clearTimeout(pressTimer);
        clearTimeout(feedbackTimer);
        item.classList.remove('pressed');
        touchDidMove = true;
      }, { passive: true });

      // touchend listener
      item.addEventListener('touchend', (e) => {
        clearTimeout(pressTimer);
        clearTimeout(feedbackTimer);
        item.classList.remove('pressed');
      }, { passive: true });

      // touchcancel listener
      item.addEventListener('touchcancel', () => {
        clearTimeout(pressTimer);
        clearTimeout(feedbackTimer);
        item.classList.remove('pressed');
      });

      // mousedown listener for mouse users
      item.addEventListener('mousedown', (e) => {
        isLongPress = false;
        item.classList.add('pressed');
        if (state.searchSelectMode) return;
        pressTimer = setTimeout(() => {
          isLongPress = true;
          toggleSearchSelectMode(); // enter select mode
          toggleSearchSelection(t.id, item); // select this item
        }, 600);
      });

      // mouseup/mouseleave listeners
      item.addEventListener('mouseup', () => {
        clearTimeout(pressTimer);
        item.classList.remove('pressed');
      });
      item.addEventListener('mouseleave', () => {
        clearTimeout(pressTimer);
        item.classList.remove('pressed');
      });

      item.onclick = (e) => {
        if (touchDidMove) return;
        if (isLongPress) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (state.searchSelectMode) {
          e.stopPropagation();
          toggleSearchSelection(t.id, item);
        } else {
          closeSearchOverlay();
          openEditTransactionModal(t);
        }
      };

      let amountClass = 'search-item-amount';
      let accountText = t.account_from || '';
      if (t.type === 'expense') { amountClass += ' expense'; }
      else if (t.type === 'income') { amountClass += ' income'; }
      else if (t.type === 'transfer') { amountClass += ' transfer'; accountText = `${t.account_from} → ${t.account_to}`; }

      const translatedSub = getSubcategoryDisplayName(t.subcategory, t.category);
      const translatedCat = getCategoryDisplayName(t.category);
      const displayTitle = (t.note && t.note.trim()) ? t.note.trim()
        : (t.description && t.description.trim()) ? t.description.trim()
          : (translatedSub && translatedSub.trim()) ? translatedSub.trim()
            : (translatedCat || '');

      const memberBadge = (typeof getMemberBadgeHTML === 'function')
        ? getMemberBadgeHTML(t)
        : (typeof PartnerSyncService !== 'undefined' && typeof PartnerSyncService.getMemberBadgeHTML === 'function')
          ? PartnerSyncService.getMemberBadgeHTML(t)
          : '';
      const datePart = (t.date || '').split('T')[0];

      const catSubLine = t.subcategory
        ? `${catInfo.icon || ''} ${escapeHtml(translatedCat)}/${escapeHtml(translatedSub)}`
        : `${catInfo.icon || ''} ${escapeHtml(translatedCat)}`;

      const selectIndicator = state.searchSelectMode
        ? `<div class="search-item-select-circle" style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid ${isSelected ? 'var(--primary)' : 'var(--text-secondary)'}; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; background: ${isSelected ? 'var(--primary)' : 'transparent'}; color: white; font-size: 11px; font-weight: bold; box-sizing: border-box;">${isSelected ? '✓' : ''}</div>`
        : '';

      item.innerHTML = `
      <div class="search-item-left" style="display: flex; align-items: center; min-width: 0; flex: 1;">
        ${selectIndicator}
        <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
          <span class="search-item-date">${escapeHtml(datePart)}</span>
          <div class="search-item-info">
            <span class="search-item-title">${escapeHtml(displayTitle)}${memberBadge}</span>
            <span class="search-item-sub">${catSubLine}&nbsp;&nbsp;${escapeHtml(accountText)}</span>
          </div>
        </div>
      </div>
      <div class="${amountClass}">${getCurrencySymbol()} ${formatDisplayAmount(CurrencyService.displayAmount(t, searchDisplayCurrency), searchDisplayCurrency)}</div>`;
      container.appendChild(item);
    });
  });

  if (transactions.length > searchResultLimit) {
    const remaining = transactions.length - searchResultLimit;
    const loadMoreDiv = document.createElement('div');
    loadMoreDiv.className = 'search-load-more-container';
    loadMoreDiv.style.cssText = 'padding: 16px 20px; text-align: center;';

    const btnText = state.lang === 'el'
      ? `Φόρτωση Περισσότερων (${remaining} ακόμα)`
      : `Load More (${remaining} remaining)`;

    loadMoreDiv.innerHTML = `
      <button class="btn btn-secondary search-load-more-btn" onclick="loadMoreSearchResults()" style="width: 100%; border-radius: 12px; font-size: 13px; font-weight: 600; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: var(--text-main);">
        ${btnText}
      </button>
    `;
    container.appendChild(loadMoreDiv);
  }
}

function toggleSearchSelectMode() {
  state.searchSelectMode = !state.searchSelectMode;
  state.selectedSearchIds.clear();

  const btn = document.getElementById('search-select-mode-btn');
  if (btn) {
    if (state.searchSelectMode) {
      btn.classList.add('active-blue');
      btn.style.borderColor = 'var(--primary)';
      btn.style.background = 'rgba(33, 150, 243, 0.1)';
      btn.style.color = 'var(--primary)';
      btn.textContent = state.lang === 'el' ? 'Ακύρωση' : 'Cancel';
    } else {
      btn.classList.remove('active-blue');
      btn.style.borderColor = 'var(--border)';
      btn.style.background = 'none';
      btn.style.color = 'var(--text-secondary)';
      btn.textContent = state.lang === 'el' ? 'Επιλογή' : 'Select';
    }
  }

  const bulkPanel = document.getElementById('search-bulk-actions-panel');
  if (bulkPanel) bulkPanel.style.display = 'none';

  handleSearchChange(false);
}

function toggleSearchSelection(id, itemElement) {
  if (state.selectedSearchIds.has(id)) {
    state.selectedSearchIds.delete(id);
  } else {
    state.selectedSearchIds.add(id);
  }

  const isSelected = state.selectedSearchIds.has(id);
  if (itemElement) {
    itemElement.style.background = isSelected ? 'rgba(33, 150, 243, 0.15)' : 'none';
    const circle = itemElement.querySelector('.search-item-select-circle');
    if (circle) {
      circle.style.background = isSelected ? 'var(--primary)' : 'transparent';
      circle.style.borderColor = isSelected ? 'var(--primary)' : 'var(--text-secondary)';
      circle.innerHTML = isSelected ? '✓' : '';
    }
  }

  const count = state.selectedSearchIds.size;
  const countSpan = document.getElementById('search-selected-count');
  if (countSpan) {
    countSpan.textContent = state.lang === 'el' ? `${count} επιλεγμένες` : `${count} selected`;
  }

  const bulkPanel = document.getElementById('search-bulk-actions-panel');
  if (bulkPanel) {
    bulkPanel.style.display = count > 0 ? 'flex' : 'none';
  }
}

function clearSearchSelection() {
  state.selectedSearchIds.clear();
  const countSpan = document.getElementById('search-selected-count');
  if (countSpan) {
    countSpan.textContent = state.lang === 'el' ? '0 επιλεγμένες' : '0 selected';
  }
  const bulkPanel = document.getElementById('search-bulk-actions-panel');
  if (bulkPanel) bulkPanel.style.display = 'none';

  handleSearchChange(false);
}

async function deleteSelectedSearchTransactions() {
  const selectedIds = Array.from(state.selectedSearchIds || []);
  if (selectedIds.length === 0) return;

  if (selectedIds.length === 1) {
    const singleId = selectedIds[0];
    const tx = (state.transactions || []).find(t => String(t.id) === String(singleId));
    if (tx && (isTransactionRecurring(tx) || resolveRecurringTemplateForTx(tx))) {
      toggleSearchSelectMode();
      setTimeout(() => {
        openRecurringDeleteModal(tx, String(tx.date || '').split('T')[0].split(' ')[0], { instant: true });
      }, 100);
      return;
    }
  }

  state.selectedIds = new Set(selectedIds);
  toggleSearchSelectMode();
  await deleteSelectedTransactions();
  if (typeof handleSearchChange === 'function') {
    handleSearchChange(false);
  }
}

window.toggleSearchSelectMode = toggleSearchSelectMode;
window.toggleSearchSelection = toggleSearchSelection;
window.clearSearchSelection = clearSearchSelection;
window.deleteSelectedSearchTransactions = deleteSelectedSearchTransactions;

  // Bind all functions to windowObj for HTML onclick & global availability
  windowObj.filterTransactions = filterTransactions;
  windowObj.calculateSearchTotals = calculateSearchTotals;
  windowObj.normalizeText = normalizeText;
  windowObj.getCategoryType = getCategoryType;
  windowObj.loadMoreSearchResults = loadMoreSearchResults;
  windowObj.toggleSearchFiltersPanel = toggleSearchFiltersPanel;
  windowObj.openSearchOverlay = openSearchOverlay;
  windowObj.closeSearchOverlay = closeSearchOverlay;
  windowObj.selectPeriodFilter = selectPeriodFilter;
  windowObj.applyCustomDates = applyCustomDates;
  windowObj.resetPeriodFilter = resetPeriodFilter;
  windowObj.selectAccountChipFilter = selectAccountChipFilter;
  windowObj.setCategoryTypeFilter = setCategoryTypeFilter;
  windowObj.selectCategoryChipFilter = selectCategoryChipFilter;
  windowObj.selectSubcategoryChipFilter = selectSubcategoryChipFilter;
  windowObj.resetCategoryFilter = resetCategoryFilter;
  windowObj.renderPeriodChips = renderPeriodChips;
  windowObj.renderAccountChips = renderAccountChips;
  windowObj.renderCategoryChips = renderCategoryChips;
  windowObj.renderSubcategoryChips = renderSubcategoryChips;
  windowObj.initAmountRangeSlider = initAmountRangeSlider;
  windowObj.openSearchPeriodSheet = openSearchPeriodSheet;
  windowObj.selectPeriodSearchFilter = selectPeriodSearchFilter;
  windowObj.applySearchCustomPeriod = applySearchCustomPeriod;
  windowObj.openSearchBottomSheet = openSearchBottomSheet;
  windowObj.closeSearchBottomSheet = closeSearchBottomSheet;
  windowObj.selectTypeSearchFilter = selectTypeSearchFilter;
  windowObj.populateSearchAccountSheet = populateSearchAccountSheet;
  windowObj.selectAccountSearchFilter = selectAccountSearchFilter;
  windowObj.populateSearchCategorySheet = populateSearchCategorySheet;
  windowObj.selectCategorySearchFilter = selectCategorySearchFilter;
  windowObj.populateSearchMemberSheet = populateSearchMemberSheet;
  windowObj.syncAmountFiltersFromInline = syncAmountFiltersFromInline;
  windowObj.selectMemberSearchFilter = selectMemberSearchFilter;
  windowObj.selectPhotoSearchFilter = selectPhotoSearchFilter;
  windowObj.applyAdvancedSearchFiltersVisual = applyAdvancedSearchFiltersVisual;
  windowObj.resetAdvancedSearchFiltersVisual = resetAdvancedSearchFiltersVisual;
  windowObj.resetAllSearchChips = resetAllSearchChips;
  windowObj.populateSearchFilterDropdowns = populateSearchFilterDropdowns;
  windowObj.populateSearchSubcategoryDropdown = populateSearchSubcategoryDropdown;
  windowObj.resetSearchFilters = resetSearchFilters;
  windowObj.clearSearchInput = clearSearchInput;
  windowObj.debouncedSearchChange = debouncedSearchChange;
  windowObj.handleSearchChange = handleSearchChange;
  windowObj.renderGroupedTransactions = renderGroupedTransactions;
  windowObj.toggleSearchSelectMode = toggleSearchSelectMode;
  windowObj.toggleSearchSelection = toggleSearchSelection;
  windowObj.clearSearchSelection = clearSearchSelection;
  windowObj.deleteSelectedSearchTransactions = deleteSelectedSearchTransactions;

  // Return module exports for Node / CommonJS
  return {
    normalizeText: normalizeText,
    filterTransactions: filterTransactions,
    calculateSearchTotals: calculateSearchTotals,
    getCategoryType: getCategoryType,
    loadMoreSearchResults: loadMoreSearchResults,
    toggleSearchFiltersPanel: toggleSearchFiltersPanel,
    openSearchOverlay: openSearchOverlay,
    closeSearchOverlay: closeSearchOverlay,
    selectPeriodFilter: selectPeriodFilter,
    applyCustomDates: applyCustomDates,
    resetPeriodFilter: resetPeriodFilter,
    selectAccountChipFilter: selectAccountChipFilter,
    setCategoryTypeFilter: setCategoryTypeFilter,
    selectCategoryChipFilter: selectCategoryChipFilter,
    selectSubcategoryChipFilter: selectSubcategoryChipFilter,
    resetCategoryFilter: resetCategoryFilter,
    renderPeriodChips: renderPeriodChips,
    renderAccountChips: renderAccountChips,
    renderCategoryChips: renderCategoryChips,
    renderSubcategoryChips: renderSubcategoryChips,
    initAmountRangeSlider: initAmountRangeSlider,
    openSearchPeriodSheet: openSearchPeriodSheet,
    selectPeriodSearchFilter: selectPeriodSearchFilter,
    applySearchCustomPeriod: applySearchCustomPeriod,
    openSearchBottomSheet: openSearchBottomSheet,
    closeSearchBottomSheet: closeSearchBottomSheet,
    selectTypeSearchFilter: selectTypeSearchFilter,
    populateSearchAccountSheet: populateSearchAccountSheet,
    selectAccountSearchFilter: selectAccountSearchFilter,
    populateSearchCategorySheet: populateSearchCategorySheet,
    selectCategorySearchFilter: selectCategorySearchFilter,
    populateSearchMemberSheet: populateSearchMemberSheet,
    syncAmountFiltersFromInline: syncAmountFiltersFromInline,
    selectMemberSearchFilter: selectMemberSearchFilter,
    selectPhotoSearchFilter: selectPhotoSearchFilter,
    applyAdvancedSearchFiltersVisual: applyAdvancedSearchFiltersVisual,
    resetAdvancedSearchFiltersVisual: resetAdvancedSearchFiltersVisual,
    resetAllSearchChips: resetAllSearchChips,
    populateSearchFilterDropdowns: populateSearchFilterDropdowns,
    populateSearchSubcategoryDropdown: populateSearchSubcategoryDropdown,
    resetSearchFilters: resetSearchFilters,
    clearSearchInput: clearSearchInput,
    debouncedSearchChange: debouncedSearchChange,
    handleSearchChange: handleSearchChange,
    renderGroupedTransactions: renderGroupedTransactions,
    toggleSearchSelectMode: toggleSearchSelectMode,
    toggleSearchSelection: toggleSearchSelection,
    clearSearchSelection: clearSearchSelection,
    deleteSelectedSearchTransactions: deleteSelectedSearchTransactions
  };
});
