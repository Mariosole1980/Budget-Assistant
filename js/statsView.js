// ============================================================
// MONTHLY STATISTICS & VISUAL ANALYTICS TAB
// Autonomous UMD Module (Phase 12C Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StatsView = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;
  var statsChartInstance = window.statsChartInstance || null;

function renderStatsTab(skipChart = false) {
  const { start, end } = getStatsDateRange();
  // Declared here (before the anti-flicker signature below) so it is available
  // for the signature guard. It is also used later when aggregating in the
  // display (app) currency.
  const displayCurrency = getDisplayCurrency();

  // ANTI-FLICKER: Skip the full re-render if nothing that affects the stats
  // view has changed. Without this, every updateUI() (e.g. the deferred render
  // after resuming from background) would wipe the breakdown list and rebuild
  // the chart with a 700ms rotate animation — a visible flash on the Stats tab.
  const statsSig = [
    (state.transactions || []).map(t => `${t.id}_${t.date}_${t.amount}_${t.category}_${t.type}_${t.user_id || ''}`).join('|'),
    state.statsType || 'expense',
    state.statsPeriodType || 'monthly',
    state.lang || 'el',
    state.selectedFamilyMemberId || 'all',
    // Include the active period/date so changing the month/year via the picker
    // (or the custom period range) triggers a re-render instead of being skipped
    // by the anti-flicker signature guard.
    state.statsDate ? state.statsDate.getTime() : '',
    state.statsCustomStart || '',
    state.statsCustomEnd || '',
    skipChart ? '1' : '0',
    displayCurrency,
    state.statsSubtab || 'breakdown',
    (state.budgets || []).map(b => `${b.id}_${b.amount}_${b.currency}_${b.subcategory || ''}_${b.is_deleted ? '1' : '0'}_${b.updated_at || ''}`).join('|')
  ].join('||');
  const statsListEl = document.getElementById('stats-breakdown-list');
  if (statsListEl && statsListEl._lastRenderSignature === statsSig) {
    return;
  }
  if (statsListEl) statsListEl._lastRenderSignature = statsSig;

  // Set month/period text on the top left
  const rawStatsTitle = formatStatsPeriodTitle(start, end);
  document.getElementById('stats-period-title').innerHTML = wrapPeriodTitleWithSpans(rawStatsTitle);

  // Update dropdown button text
  let periodLabel = TRANSLATIONS[state.lang]['stats_period_monthly'];
  if (state.statsPeriodType === 'weekly') periodLabel = TRANSLATIONS[state.lang]['stats_period_weekly'];
  else if (state.statsPeriodType === 'annually') periodLabel = TRANSLATIONS[state.lang]['stats_period_annually'];
  else if (state.statsPeriodType === 'period') periodLabel = TRANSLATIONS[state.lang]['stats_period_custom'];

  document.getElementById('stats-period-dropdown-btn').innerHTML =
    `<span class="stats-btn-text">${periodLabel}</span> <i class="fa-solid fa-chevron-down" style="font-size: 9px; margin-left: 4px; flex-shrink: 0;"></i>`;

  // Highlight active dropdown choice
  document.querySelectorAll('.stats-dropdown-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-value') === state.statsPeriodType);
  });

  // Dynamically populate Family Member Filter Dropdown
  const familyFilterContainer = document.getElementById('stats-family-dropdown-container');
  const familyFilterMenu = document.getElementById('stats-family-dropdown-menu');
  const familyFilterBtn = document.getElementById('stats-family-dropdown-btn');

  if (state.userProfile && state.userProfile.family_id) {
    if (familyFilterContainer) familyFilterContainer.style.display = 'block';

    if (familyFilterMenu) {
      familyFilterMenu.innerHTML = '';

      const allText = state.lang === 'el' ? 'Όλη η Οικογένεια' : 'All Family';
      const allItem = document.createElement('div');
      allItem.className = 'stats-dropdown-item' + (state.selectedFamilyMemberId === 'all' ? ' active' : '');
      allItem.setAttribute('data-value', 'all');
      allItem.textContent = allText;
      allItem.addEventListener('click', (e) => {
        e.stopPropagation();
        state.selectedFamilyMemberId = 'all';
        localStorage.setItem('selected_family_member_id', 'all');
        familyFilterMenu.classList.remove('active');
        renderStatsTab();
      });
      familyFilterMenu.appendChild(allItem);

      const members = state.familyProfiles || [];
      members.forEach(member => {
        const isMe = member.id === state.currentUser.id;
        const meSuffix = isMe ? ` (${state.lang === 'el' ? 'Εσείς' : 'You'})` : '';
        const name = (member.display_name || member.email.split('@')[0]) + meSuffix;

        const item = document.createElement('div');
        item.className = 'stats-dropdown-item' + (state.selectedFamilyMemberId === member.id ? ' active' : '');
        item.setAttribute('data-value', member.id);
        item.textContent = name;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          state.selectedFamilyMemberId = member.id;
          localStorage.setItem('selected_family_member_id', member.id);
          familyFilterMenu.classList.remove('active');
          renderStatsTab();
        });
        familyFilterMenu.appendChild(item);
      });
    }

    if (familyFilterBtn) {
      let activeText = state.lang === 'el' ? 'Όλη η Οικογένεια' : 'All Family';
      if (state.selectedFamilyMemberId !== 'all') {
        const activeMember = (state.familyProfiles || []).find(m => m.id === state.selectedFamilyMemberId);
        if (activeMember) {
          const isMe = activeMember.id === state.currentUser.id;
          const meSuffix = isMe ? ` (${state.lang === 'el' ? 'Εσείς' : 'You'})` : '';
          activeText = (activeMember.display_name || activeMember.email.split('@')[0]) + meSuffix;
        }
      }
      familyFilterBtn.innerHTML = `<span class="stats-btn-text">${activeText}</span> <i class="fa-solid fa-chevron-down" style="font-size: 9px; margin-left: 4px; flex-shrink: 0;"></i>`;
    }
  } else {
    if (familyFilterContainer) familyFilterContainer.style.display = 'none';
    state.selectedFamilyMemberId = 'all';
  }

  const walletTrans = getActiveTransactions();

  // Filter by selected family member
  let memberFilteredTrans = walletTrans;
  if (state.userProfile && state.userProfile.family_id && state.selectedFamilyMemberId !== 'all') {
    memberFilteredTrans = walletTrans.filter(t => t.user_id === state.selectedFamilyMemberId);
  }

  const filteredTrans = memberFilteredTrans.filter(t => {
    if (!t.date) return false;
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const tDate = new Date(datePart + 'T00:00:00');
    return tDate >= start && tDate <= end;
  });

  // Aggregate directly in the display (app) currency so each transaction is
  // converted from its own stored base_currency with the exchange rate when the
  // app currency changes (e.g. 1316 € → ~1420 $).
  const monthlyIncome = filteredTrans.filter(t => t.type === 'income').reduce((s, t) => s + CurrencyService.displayAmount(t, displayCurrency), 0);
  const monthlyExpense = filteredTrans.filter(t => t.type === 'expense').reduce((s, t) => s + CurrencyService.displayAmount(t, displayCurrency), 0);

  document.getElementById('stats-tab-income-amt').textContent = `${getCurrencySymbol()} ${formatDisplayAmount(monthlyIncome, displayCurrency)}`;
  document.getElementById('stats-tab-expense-amt').textContent = `${getCurrencySymbol()} ${formatDisplayAmount(monthlyExpense, displayCurrency)}`;

  // Calculate and display Net Savings
  const netSavings = monthlyIncome - monthlyExpense;
  const netValEl = document.getElementById('stats-net-savings-val');
  if (netValEl) {
    netValEl.textContent = `${netSavings >= 0 ? '+' : ''}${getCurrencySymbol()} ${formatDisplayAmount(netSavings, displayCurrency)}`;
    netValEl.className = 'stats-net-val ' + (netSavings >= 0 ? 'positive' : 'negative');
  }

  const activeTrans = filteredTrans.filter(t => t.type === state.statsType);
  const totalSum = activeTrans.reduce((s, t) => s + CurrencyService.displayAmount(t, displayCurrency), 0);

  const catGroups = {};
  activeTrans.forEach(t => {
    const catInfo = getCategoryInfo(t.category, t.type);
    const key = catInfo.name || t.category || (state.lang === 'el' ? 'Άλλα' : 'Other');
    if (!catGroups[key]) {
      catGroups[key] = {
        amount: 0,
        icon: catInfo.icon,
        color: catInfo.color,
        subcategories: {}
      };
    }
    catGroups[key].amount += CurrencyService.displayAmount(t, displayCurrency);

    const subcatName = t.subcategory || '';
    if (!catGroups[key].subcategories[subcatName]) {
      catGroups[key].subcategories[subcatName] = 0;
    }
    catGroups[key].subcategories[subcatName] += CurrencyService.displayAmount(t, displayCurrency);
  });

  const breakdownList = Object.entries(catGroups).map(([name, d]) => ({
    name,
    amount: d.amount,
    percentage: totalSum > 0 ? (d.amount / totalSum) * 100 : 0,
    icon: d.icon,
    color: d.color,
    subcategories: Object.entries(d.subcategories)
      .map(([subName, subAmt]) => ({
        name: subName,
        amount: subAmt,
        percentage: d.amount > 0 ? (subAmt / d.amount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
  })).sort((a, b) => b.amount - a.amount);

  const displayList = breakdownList;

  const listContainer = document.getElementById('stats-breakdown-list');
  const chartContainer = document.querySelector('.chart-container');
  const statsFragment = document.createDocumentFragment();

  const centerTitleEl = document.getElementById('chart-center-title');
  const centerAmountEl = document.getElementById('chart-center-amount');
  const chartCenterVal = document.getElementById('chart-center-val');

  if (!displayList.length) {
    if (chartContainer) chartContainer.style.display = 'none';
    const lang = state.lang || 'el';
    const emptyTitle = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['stats_empty_title']) || (lang === 'el' ? 'Δεν υπάρχουν δεδομένα για αυτόν τον μήνα' : 'No Data for this Month');
    const emptyDesc = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['stats_empty_desc']) || (lang === 'el' ? 'Καταγράψτε τα έξοδά σας για να ξεκλειδώσετε αναλυτικά γραφήματα και στατιστικά ανά κατηγορία.' : 'Track your expenses to see detailed breakdown charts and category insights.');
    const btnAddText = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['stats_empty_btn_add']) || (lang === 'el' ? '➕ Προσθήκη Συναλλαγής' : '➕ Add Transaction');
    const btnDemoText = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['stats_empty_btn_demo']) || (lang === 'el' ? '📊 Δοκιμή με Δείγματα (Demo)' : '📊 Try Demo Mode');

    if (listContainer) {
      listContainer.innerHTML = `
        <div class="stats-empty-card">
          <div class="stats-ghost-ring-wrapper">
            <div class="stats-ghost-ring"></div>
            <div class="stats-ghost-ring-inner"></div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <h3 class="stats-empty-title">${emptyTitle}</h3>
            <p class="stats-empty-desc">${emptyDesc}</p>
          </div>
          <div class="stats-empty-actions">
            <button class="stats-empty-btn-primary" onclick="openAddTransactionModal()">
              <span>${btnAddText}</span>
            </button>
            <button class="stats-empty-btn-secondary" onclick="onboardingAddDemoData()">
              <span>${btnDemoText}</span>
            </button>
          </div>
        </div>`;
    }
    if (!skipChart) {
      if (statsChartInstance) { statsChartInstance.destroy(); statsChartInstance = null; }
      if (chartCenterVal) chartCenterVal.style.display = 'none';
    }
    renderCategoryBudgetsView(catGroups);
    return;
  }

  if (chartContainer) chartContainer.style.display = 'flex';

  // Update high tech doughnut center text
  if (!skipChart && chartCenterVal) {
    chartCenterVal.style.display = 'flex';
    if (centerTitleEl) {
      centerTitleEl.textContent = state.statsType === 'income' ? TRANSLATIONS[state.lang]['summary_income'] : TRANSLATIONS[state.lang]['summary_expense'];
    }
    if (centerAmountEl) {
      centerAmountEl.textContent = `${getCurrencySymbol()} ${formatDisplayAmount(totalSum, displayCurrency)}`;
    }
  }

  // Update income vs expense ratio bar
  if (!skipChart) {
    const ratioWrapper = document.getElementById('chart-ratio-wrapper');
    const ratioIncomeFill = document.getElementById('ratio-fill-income');
    const ratioExpenseFill = document.getElementById('ratio-fill-expense');
    const ratioIncomePct = document.getElementById('ratio-income-pct');
    const ratioExpensePct = document.getElementById('ratio-expense-pct');
    const totalIE = monthlyIncome + monthlyExpense;
    if (ratioWrapper && totalIE > 0) {
      ratioWrapper.style.display = 'block';
      const iPct = Math.round((monthlyIncome / totalIE) * 100);
      const ePct = 100 - iPct;
      ratioIncomeFill.style.width = iPct + '%';
      ratioExpenseFill.style.width = ePct + '%';
      ratioIncomePct.textContent = iPct + '%';
      ratioExpensePct.textContent = ePct + '%';
    } else if (ratioWrapper) {
      ratioWrapper.style.display = 'none';
    }
  }

  displayList.forEach((item, idx) => {
    const catId = `stats-cat-${idx}-${Date.now()}`;
    const row = document.createElement('div');
    row.className = 'stats-row';
    const hasSubcats = item.subcategories.length > 0 && item.subcategories.some(s => s.name);
    const catColor = NEON_PALETTE[idx % NEON_PALETTE.length];

    const statsIconHtml = (typeof renderCategoryIconHtml === 'function')
      ? renderCategoryIconHtml(item.name, { size: 'inline', customColor: catColor })
      : item.icon;

    row.innerHTML = `
      <div class="stats-row-left">
        <span class="stats-pct-badge" style="background-color: ${catColor};">${Math.round(item.percentage)}%</span>
        <span class="stats-cat-icon" style="font-size:14px; margin-right:4px; display:inline-flex; align-items:center;">${statsIconHtml}</span>
        <span class="stats-category-name">${getCategoryDisplayName(stripLeadingEmoji(item.name))}</span>
      </div>
      <div class="stats-row-right">${getCurrencySymbol()} ${formatDisplayAmount(item.amount, displayCurrency)}</div>`;
    statsFragment.appendChild(row);

    if (hasSubcats) {
      const subContainer = document.createElement('div');
      subContainer.id = catId;
      subContainer.className = 'stats-subcategories-container';

      const isExpanded = state.expandedStatsCategories.has(item.name);
      if (isExpanded) {
        row.classList.add('expanded');
        subContainer.classList.add('active');
      }

      item.subcategories.forEach(sub => {
        const subDisplayName = sub.name ? getSubcategoryDisplayName(sub.name, item.name) : (state.lang === 'el' ? 'Χωρίς υποκατηγορία' : 'Uncategorized');
        const subRow = document.createElement('div');
        subRow.className = 'stats-sub-row';

        subRow.innerHTML = `
          <div class="stats-sub-left">
            <span class="stats-sub-pct" style="background-color: ${catColor}26; color: ${catColor}; border: 1px solid ${catColor}33;">${Math.round(sub.percentage)}%</span>
            <span class="stats-sub-name">${subDisplayName}</span>
          </div>
          <div class="stats-sub-right">${getCurrencySymbol()} ${formatDisplayAmount(sub.amount, displayCurrency)}</div>
        `;

        let subFeedbackTimer;
        let subTouchStartX = 0;
        let subTouchStartY = 0;
        let subTouchMoved = false;

        subRow.addEventListener('touchstart', (e) => {
          subTouchMoved = false;
          const touch = e.touches[0];
          subTouchStartX = touch.clientX;
          subTouchStartY = touch.clientY;

          clearTimeout(subFeedbackTimer);
          subFeedbackTimer = setTimeout(() => {
            if (!subTouchMoved && !state.isSwipingMonth) {
              subRow.classList.add('pressed');
            }
          }, 100);
        }, { passive: true });

        subRow.addEventListener('touchmove', (e) => {
          const touch = e.touches[0];
          const dx = touch.clientX - subTouchStartX;
          const dy = touch.clientY - subTouchStartY;
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            subTouchMoved = true;
            clearTimeout(subFeedbackTimer);
            subRow.classList.remove('pressed');
          }
        }, { passive: true });

        subRow.addEventListener('touchend', (e) => {
          clearTimeout(subFeedbackTimer);
          subRow.classList.remove('pressed');
          if (state.isSwipingMonth || subTouchMoved) {
            if (e.cancelable) e.preventDefault();
          }
        }, { passive: false });

        subRow.addEventListener('touchcancel', () => {
          clearTimeout(subFeedbackTimer);
          subRow.classList.remove('pressed');
        });

        subRow.addEventListener('click', (e) => {
          e.stopPropagation();
          if (state.isSwipingMonth || subTouchMoved || (Date.now() - state.lastSwipeTime < 1500)) {
            return;
          }
          openStatsTransactionsModal(item.name, sub.name);
        });

        subContainer.appendChild(subRow);
      });

      statsFragment.appendChild(subContainer);
    }

    let rowFeedbackTimer;
    let rowTouchStartX = 0;
    let rowTouchStartY = 0;
    let rowTouchMoved = false;

    row.addEventListener('touchstart', (e) => {
      rowTouchMoved = false;
      const touch = e.touches[0];
      rowTouchStartX = touch.clientX;
      rowTouchStartY = touch.clientY;

      clearTimeout(rowFeedbackTimer);
      rowFeedbackTimer = setTimeout(() => {
        if (!rowTouchMoved && !state.isSwipingMonth) {
          row.classList.add('pressed');
        }
      }, 100);
    }, { passive: true });

    row.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const dx = touch.clientX - rowTouchStartX;
      const dy = touch.clientY - rowTouchStartY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        rowTouchMoved = true;
        clearTimeout(rowFeedbackTimer);
        row.classList.remove('pressed');
      }
    }, { passive: true });

    row.addEventListener('touchend', (e) => {
      clearTimeout(rowFeedbackTimer);
      row.classList.remove('pressed');
      if (state.isSwipingMonth || rowTouchMoved) {
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    row.addEventListener('touchcancel', () => {
      clearTimeout(rowFeedbackTimer);
      row.classList.remove('pressed');
    });

    row.addEventListener('click', () => {
      if (state.isSwipingMonth || rowTouchMoved || (Date.now() - state.lastSwipeTime < 1500)) {
        return;
      }
      if (hasSubcats) {
        const subContainerEl = document.getElementById(catId);
        if (subContainerEl) {
          const expanded = row.classList.toggle('expanded');
          subContainerEl.classList.toggle('active', expanded);
          if (expanded) {
            state.expandedStatsCategories.add(item.name);
          } else {
            state.expandedStatsCategories.delete(item.name);
          }
        }
      } else {
        openStatsTransactionsModal(item.name, null);
      }
    });
  });

  if (listContainer) listContainer.replaceChildren(statsFragment);

  if (state.activeTab === 'stats' && !skipChart) {
    renderChart(displayList);
  }

  if (state.activeSubcategoryTransactions) {
    renderSubcategoryTransactions(state.activeSubcategoryTransactions.category, state.activeSubcategoryTransactions.subcategory);
  }

  // Render Category Budgets View
  renderCategoryBudgetsView(catGroups);
}

function switchStatsSubtab(tab) {
  state.statsSubtab = tab === 'budgets' ? 'budgets' : 'breakdown';

  const breakdownContainer = document.getElementById('stats-breakdown-container');
  const budgetsContainer = document.getElementById('stats-budgets-container');
  const btnBreakdown = document.getElementById('stats-subtab-breakdown');
  const btnBudgets = document.getElementById('stats-subtab-budgets');

  if (breakdownContainer) {
    breakdownContainer.style.display = state.statsSubtab === 'breakdown' ? 'block' : 'none';
  }
  if (budgetsContainer) {
    budgetsContainer.style.display = state.statsSubtab === 'budgets' ? 'flex' : 'none';
  }

  // Update active button styling
  if (btnBreakdown) {
    btnBreakdown.classList.toggle('active', state.statsSubtab === 'breakdown');
    btnBreakdown.style.background = state.statsSubtab === 'breakdown' ? 'var(--accent)' : 'transparent';
    btnBreakdown.style.color = state.statsSubtab === 'breakdown' ? '#ffffff' : 'var(--text-secondary)';
  }
  if (btnBudgets) {
    btnBudgets.classList.toggle('active', state.statsSubtab === 'budgets');
    btnBudgets.style.background = state.statsSubtab === 'budgets' ? 'var(--accent)' : 'transparent';
    btnBudgets.style.color = state.statsSubtab === 'budgets' ? '#ffffff' : 'var(--text-secondary)';
  }

  // Re-render so the active view is fresh (statsSubtab is part of the render signature)
  renderStatsTab();
}
window.switchStatsSubtab = switchStatsSubtab;

function renderCategoryBudgetsView(catGroups = {}) {
  const container = document.getElementById('stats-budgets-container');
  if (!container) return;
  const displayCurrency = getDisplayCurrency();
  const symbol = getCurrencySymbol();
  const lang = state.lang || 'el';
  const budgets = (state.budgets || []).filter(b => !b.is_deleted);

  // Remaining days in current month/period calculation
  const now = new Date();
  const startDay = parseInt(localStorage.getItem('app_month_start') || '1', 10);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= startDay ? 1 : 0), startDay - 1);
  const diffTime = endOfMonth.getTime() - now.getTime();
  const remainingDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  let totalSpentInCurrency = 0;
  let totalBudgetInCurrency = 0;

  // Process defined budgets
  const budgetRowsHtml = budgets.map(b => {
    const catInfo = getCategoryInfo(b.category, 'expense');
    let spent = 0;
    if (b.subcategory) {
      spent = catGroups[catInfo.name || b.category]?.subcategories?.[b.subcategory] || 0;
    } else {
      spent = catGroups[catInfo.name || b.category]?.amount || 0;
    }
    totalSpentInCurrency += spent;

    // Convert budget amount from its stored currency to display currency
    const budgetAmountInDisplay = window.CurrencyService
      ? window.CurrencyService.convert(b.amount, b.currency || 'EUR', displayCurrency)
      : b.amount;
    totalBudgetInCurrency += budgetAmountInDisplay;

    const pct = budgetAmountInDisplay > 0 ? (spent / budgetAmountInDisplay) * 100 : 0;
    const isOver = pct >= 100;
    const isWarn = pct >= 75 && pct < 100;

    let badgeClass = 'badge-ok';
    let badgeText = `${Math.round(pct)}% ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_status_ok']) || (lang === 'el' ? 'Εντός' : 'OK')}`;
    let barColor = catInfo.color || '#10b981';

    if (isOver) {
      badgeClass = 'badge-alert';
      const overAmt = (spent - budgetAmountInDisplay).toFixed(2);
      const overLabel = (TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_status_over']) || (lang === 'el' ? 'Υπέρβαση' : 'Over');
      badgeText = `⚠️ ${Math.round(pct)}% (${overLabel} +${symbol}${overAmt})`;
      barColor = '#ff5b5b';
    } else if (isWarn) {
      badgeClass = 'badge-warn';
      const warnLabel = (TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_status_warn']) || (lang === 'el' ? 'Πλησιάζει' : 'Warning');
      badgeText = `${Math.round(pct)}% (${warnLabel})`;
      barColor = '#f59e0b';
    }

    const scopeIcon = b.scope === 'family' ? `<i class="fa-solid fa-users" style="font-size:11px; margin-left:4px; color:var(--primary);" title="${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_modal_family']) || 'Οικογενειακό'}"></i>` : '';
    // Use translated display name for category and subcategory
    const cleanCatName = getCategoryDisplayName(catInfo.name || b.category) || stripLeadingEmoji(catInfo.name || b.category).trim();
    const subcatDisplayName = b.subcategory ? (typeof getSubcategoryDisplayName === 'function' ? getSubcategoryDisplayName(b.subcategory) : b.subcategory) : '';
    const titleLabel = subcatDisplayName ? `${cleanCatName} <span style="font-size:12px; opacity:0.75; font-weight:600;">(${subcatDisplayName})</span>` : cleanCatName;

    const budgetBadgeHtml = (typeof renderCategoryIconHtml === 'function')
      ? renderCategoryIconHtml(b.category, { size: 'md', customColor: catInfo.color })
      : `<div style="width: 40px; height: 40px; border-radius: 12px; background: ${catInfo.color}20; color: ${catInfo.color}; display: flex; align-items: center; justify-content: center; font-size: 19px; flex-shrink: 0;">${catInfo.icon}</div>`;

    return `
      <div class="budget-cat-row ${isOver ? 'over-budget' : ''}" style="background: var(--bg-card); border: 1px solid ${isOver ? 'rgba(255, 91, 91, 0.4)' : 'var(--border)'}; border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
            ${budgetBadgeHtml}
            <div style="display: flex; flex-direction: column; min-width: 0;">
              <span style="font-size: 14.5px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 4px; word-break: break-word;">${titleLabel}${scopeIcon}</span>
              <span style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${symbol} ${formatDisplayAmount(spent, displayCurrency)} / ${symbol} ${formatDisplayAmount(budgetAmountInDisplay, displayCurrency)}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <span class="badge-status ${badgeClass}" style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px;">${badgeText}</span>
            <button type="button" class="action-icon-btn" onclick="openCategoryBudgetModal('${escapeHtml(b.category)}', '${escapeHtml(b.subcategory || '')}')" title="${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['btn_edit']) || (lang === 'el' ? 'Επεξεργασία' : 'Edit')}" style="width: 32px; height: 32px; border-radius: 10px; border: 1px solid var(--border); background: rgba(255,255,255,0.04); color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;">
              <i class="fa-solid fa-pen"></i>
            </button>
          </div>
        </div>
        <div style="height: 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.06); width: 100%; overflow: hidden; position: relative;">
          <div style="height: 100%; border-radius: 6px; width: ${Math.min(100, pct)}%; background: ${barColor}; transition: width 0.4s ease;"></div>
        </div>
      </div>
    `;
  }).join('');

  const overallPct = totalBudgetInCurrency > 0 ? (totalSpentInCurrency / totalBudgetInCurrency) * 100 : 0;
  const remainingTotal = Math.max(0, totalBudgetInCurrency - totalSpentInCurrency);
  const dailyAvailable = (remainingTotal / remainingDays).toFixed(2);

  const overallCardHtml = `
    <div style="background: linear-gradient(135deg, rgba(124, 106, 247, 0.12) 0%, rgba(99, 102, 241, 0.05) 100%); border: 1px solid var(--border-accent, rgba(124, 106, 247, 0.3)); border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <span style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; display: block;">${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_total_monthly']) || (lang === 'el' ? 'Συνολικό Budget Μήνα' : 'Total Monthly Budget')}</span>
          <div style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
            ${symbol} ${formatDisplayAmount(totalSpentInCurrency, displayCurrency)} <span style="font-size: 13.5px; font-weight: 600; color: var(--text-secondary);">/ ${symbol} ${formatDisplayAmount(totalBudgetInCurrency, displayCurrency)}</span>
          </div>
        </div>
        <div style="text-align: right;">
          <span class="badge-status ${overallPct >= 100 ? 'badge-alert' : overallPct >= 75 ? 'badge-warn' : 'badge-ok'}" style="font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 12px;">${Math.round(overallPct)}% ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_used_badge']) || (lang === 'el' ? 'Χρήση' : 'Used')}</span>
          <div style="font-size: 11.5px; color: #10b981; font-weight: 700; margin-top: 4px;">${symbol} ${formatDisplayAmount(remainingTotal, displayCurrency)} ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_remaining_badge']) || (lang === 'el' ? 'διαθέσιμα' : 'left')}</div>
        </div>
      </div>
      <div>
        <div style="height: 10px; border-radius: 6px; background: rgba(255, 255, 255, 0.08); width: 100%; overflow: hidden; position: relative;">
          <div style="height: 100%; border-radius: 6px; width: ${Math.min(100, overallPct)}%; background: linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%); transition: width 0.4s ease;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 6px;">
          <span>${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_days_remaining']) || (lang === 'el' ? 'Απομένουν' : 'Remaining')} ${remainingDays} ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_days_unit']) || (lang === 'el' ? 'ημέρες' : 'days')}</span>
          <span><strong>${symbol} ${formatDisplayAmount(dailyAvailable, displayCurrency)}</strong> / ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_per_day']) || (lang === 'el' ? 'ημέρα' : 'day')}</span>
        </div>
      </div>
    </div>
  `;

  const addBtnHtml = `
    <button type="button" onclick="openCategoryBudgetModal()" style="width: 100%; padding: 14px; border-radius: 14px; background: rgba(124, 106, 247, 0.08); border: 1px dashed rgba(124, 106, 247, 0.3); color: var(--accent); font-size: 13.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s;">
      <i class="fa-solid fa-plus"></i> ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_add_new_btn']) || (lang === 'el' ? 'Ορισμός Νέου Προϋπολογισμού' : 'Set New Category Budget')}
    </button>
  `;

  container.innerHTML = overallCardHtml + (budgetRowsHtml || `<div style="text-align: center; padding: 24px 16px; color: var(--text-secondary); font-size: 13.5px;">${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_no_budgets_empty']) || (lang === 'el' ? 'Δεν έχετε ορίσει ακόμα προϋπολογισμούς κατηγοριών.' : 'No category budgets set yet.')}</div>`) + addBtnHtml;
}
window.renderCategoryBudgetsView = renderCategoryBudgetsView;

function getSubcategoriesForCategoryName(catName) {
  if (!catName) return [];
  return getSubcategoriesForCategory(catName);
}

function onBudgetCategoryChange() {
  const catSelect = document.getElementById('budget-modal-category');
  const subcatContainer = document.getElementById('budget-modal-subcat-container');
  const subcatSelect = document.getElementById('budget-modal-subcategory');
  if (!catSelect || !subcatSelect) return;

  const catName = catSelect.value;
  const subcats = getSubcategoriesForCategoryName(catName);

  if (subcats && subcats.length > 0) {
    subcatSelect.innerHTML = `<option value="">${state.lang === 'el' ? 'Όλες οι υποκατηγορίες' : 'All subcategories'}</option>`;
    subcats.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      subcatSelect.appendChild(opt);
    });
    if (subcatContainer) subcatContainer.style.display = 'block';
  } else {
    subcatSelect.innerHTML = `<option value="">${state.lang === 'el' ? 'Όλες οι υποκατηγορίες' : 'All subcategories'}</option>`;
    if (subcatContainer) subcatContainer.style.display = 'none';
  }

  // Keep the modern trigger buttons in sync with the hidden native selects.
  if (typeof syncBudgetPickerTriggers === 'function') {
    syncBudgetPickerTriggers();
  }
}
window.onBudgetCategoryChange = onBudgetCategoryChange;

// ============================================================
// MODERN BUDGET CATEGORY / SUBCATEGORY PICKER
// ============================================================
let _budgetPickerMode = 'category';
let _budgetPickerCategory = '';

function openBudgetCategoryPicker() {
  _budgetPickerMode = 'category';
  _budgetPickerCategory = '';
  const catSelect = document.getElementById('budget-modal-category');
  if (catSelect && catSelect.value) {
    _budgetPickerCategory = catSelect.value;
  }
  const backBtn = document.getElementById('budget-picker-back');
  if (backBtn) backBtn.style.display = 'none';
  const title = document.getElementById('budget-picker-title');
  if (title) title.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['budget_picker_title_cat']) || (state.lang === 'el' ? 'Επιλογή Κατηγορίας' : 'Select Category');
  const searchWrap = document.getElementById('budget-picker-search-wrap');
  if (searchWrap) searchWrap.style.display = 'block';
  const search = document.getElementById('budget-picker-search');
  if (search) search.value = '';
  renderBudgetPickerOptions();
  openModal('budget-picker-modal');
}
window.openBudgetCategoryPicker = openBudgetCategoryPicker;

function openBudgetSubcategoryPicker() {
  const catSelect = document.getElementById('budget-modal-category');
  if (!catSelect || !catSelect.value) {
    showToast((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['budget_select_cat_first']) || (state.lang === 'el' ? 'Παρακαλώ επιλέξτε πρώτα κατηγορία' : 'Please select a category first'), 'warning');
    return;
  }
  _budgetPickerMode = 'subcategory';
  _budgetPickerCategory = catSelect.value;
  const backBtn = document.getElementById('budget-picker-back');
  if (backBtn) backBtn.style.display = 'flex';
  const title = document.getElementById('budget-picker-title');
  if (title) title.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['budget_picker_title_subcat']) || (state.lang === 'el' ? 'Επιλογή Υποκατηγορίας' : 'Select Subcategory');
  const searchWrap = document.getElementById('budget-picker-search-wrap');
  if (searchWrap) searchWrap.style.display = 'block';
  const search = document.getElementById('budget-picker-search');
  if (search) search.value = '';
  renderBudgetPickerOptions();
  openModal('budget-picker-modal');
}
window.openBudgetSubcategoryPicker = openBudgetSubcategoryPicker;

function renderBudgetPickerOptions() {
  const list = document.getElementById('budget-picker-list');
  if (!list) return;
  const search = document.getElementById('budget-picker-search');
  const query = (search ? search.value : '').trim().toLowerCase();
  list.innerHTML = '';

  if (_budgetPickerMode === 'category') {
    const catSelect = document.getElementById('budget-modal-category');
    const currentCat = catSelect ? catSelect.value : '';
    const expenseCats = (state.categories || [])
      .filter(c => c && (c.type === 'expense' || !c.type) && !c.hidden);
    const seenCats = new Set();
    let any = false;

    expenseCats.forEach(c => {
      const cleanName = stripLeadingEmoji(c.name).trim() || c.name;
      if (seenCats.has(cleanName)) return;
      seenCats.add(cleanName);
      const displayName = getCategoryDisplayName(cleanName) || cleanName;
      if (query && !displayName.toLowerCase().includes(query) && !cleanName.toLowerCase().includes(query)) return;
      any = true;
      const item = document.createElement('div');
      item.className = 'budget-picker-item' + (cleanName === currentCat ? ' selected' : '');
      item.innerHTML = `
        <span class="budget-picker-item-icon">${c.icon || '🏷️'}</span>
        <span class="budget-picker-item-name">${escapeHtml(displayName)}</span>`;
      item.onclick = () => selectBudgetPickerCategory(cleanName);
      list.appendChild(item);
    });

    if (!any) {
      list.innerHTML = `<div class="budget-picker-empty">${state.lang === 'el' ? 'Δεν βρέθηκαν κατηγορίες' : 'No categories found'}</div>`;
    }
  } else {
    const subcats = getSubcategoriesForCategoryName(_budgetPickerCategory);
    const subcatSelect = document.getElementById('budget-modal-subcategory');
    const currentSub = subcatSelect ? subcatSelect.value : '';
    let any = false;

    const allItem = document.createElement('div');
    allItem.className = 'budget-picker-item' + (currentSub === '' ? ' selected' : '');
    allItem.innerHTML = `
      <span class="budget-picker-item-icon">🗂️</span>
      <span class="budget-picker-item-name">${(TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['budget_modal_all_subcategories']) || (state.lang === 'el' ? 'Όλες οι υποκατηγορίες' : 'All subcategories')}</span>`;
    allItem.onclick = () => selectBudgetPickerSubcategory('');
    list.appendChild(allItem);
    any = true;

    subcats.forEach(sub => {
      const displayName = getSubcategoryDisplayName(sub, _budgetPickerCategory) || sub;
      if (query && !displayName.toLowerCase().includes(query) && !sub.toLowerCase().includes(query)) return;
      any = true;
      const item = document.createElement('div');
      item.className = 'budget-picker-item sub' + (sub === currentSub ? ' selected' : '');
      item.innerHTML = `
        <span class="budget-picker-item-icon">🔹</span>
        <span class="budget-picker-item-name">${escapeHtml(displayName)}</span>`;
      item.onclick = () => selectBudgetPickerSubcategory(sub);
      list.appendChild(item);
    });

    if (!any) {
      list.innerHTML = `<div class="budget-picker-empty">${state.lang === 'el' ? 'Δεν βρέθηκαν υποκατηγορίες' : 'No subcategories found'}</div>`;
    }
  }
}
window.renderBudgetPickerOptions = renderBudgetPickerOptions;

function selectBudgetPickerCategory(name) {
  const catSelect = document.getElementById('budget-modal-category');
  if (catSelect) {
    catSelect.value = name;
    onBudgetCategoryChange();
  }
  syncBudgetPickerTriggers();
  closeModal('budget-picker-modal');
}
window.selectBudgetPickerCategory = selectBudgetPickerCategory;

function selectBudgetPickerSubcategory(name) {
  const subcatSelect = document.getElementById('budget-modal-subcategory');
  if (subcatSelect) {
    subcatSelect.value = name;
  }
  syncBudgetPickerTriggers();
  closeModal('budget-picker-modal');
}
window.selectBudgetPickerSubcategory = selectBudgetPickerSubcategory;

function syncBudgetPickerTriggers() {
  const catSelect = document.getElementById('budget-modal-category');
  const subcatSelect = document.getElementById('budget-modal-subcategory');
  const catTrigger = document.getElementById('budget-category-trigger');
  const subTrigger = document.getElementById('budget-subcategory-trigger');

  if (catSelect && catTrigger) {
    const catInfo = getCategoryInfo(catSelect.value, 'expense');
    const cleanName = catSelect.value ? (stripLeadingEmoji(catInfo.name || catSelect.value).trim() || catSelect.value) : '';
    const iconEl = document.getElementById('budget-category-trigger-icon');
    const labelEl = document.getElementById('budget-category-trigger-label');
    if (iconEl) iconEl.textContent = catSelect.value ? (catInfo.icon || '🏷️') : '🏷️';
    if (labelEl) labelEl.textContent = cleanName || ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['budget_modal_category_placeholder']) || (state.lang === 'el' ? 'Επιλέξτε κατηγορία' : 'Select category'));
    catTrigger.classList.toggle('placeholder', !catSelect.value);
  }

  if (subcatSelect && subTrigger) {
    const labelEl = document.getElementById('budget-subcategory-trigger-label');
    if (labelEl) {
      labelEl.textContent = subcatSelect.value
        ? (getSubcategoryDisplayName(subcatSelect.value, catSelect ? catSelect.value : '') || subcatSelect.value)
        : ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['budget_modal_all_subcategories']) || (state.lang === 'el' ? 'Όλες οι υποκατηγορίες' : 'All subcategories'));
    }
    subTrigger.classList.toggle('placeholder', !subcatSelect.value);
  }
}
window.syncBudgetPickerTriggers = syncBudgetPickerTriggers;

function budgetPickerGoBack() {
  _budgetPickerMode = 'category';
  const backBtn = document.getElementById('budget-picker-back');
  if (backBtn) backBtn.style.display = 'none';
  const title = document.getElementById('budget-picker-title');
  if (title) title.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['budget_picker_title_cat']) || (state.lang === 'el' ? 'Επιλογή Κατηγορίας' : 'Select Category');
  const search = document.getElementById('budget-picker-search');
  if (search) search.value = '';
  renderBudgetPickerOptions();
}
window.budgetPickerGoBack = budgetPickerGoBack;

function openCategoryBudgetModal(targetCategoryName = null, targetSubcategory = null) {
  const catSelect = document.getElementById('budget-modal-category');
  const subcatSelect = document.getElementById('budget-modal-subcategory');
  const amtInput = document.getElementById('budget-modal-amount');
  const idInput = document.getElementById('budget-modal-id');
  const delBtn = document.getElementById('budget-delete-btn');
  if (!catSelect || !amtInput) return;

  // Populate expense categories dropdown cleanly (NO DOUBLE EMOJIS)
  catSelect.innerHTML = '';
  const expenseCats = (state.categories || []).filter(c => c && (c.type === 'expense' || !c.type) && !c.hidden);
  const seenCats = new Set();

  expenseCats.forEach(c => {
    const catInfo = getCategoryInfo(c.name, 'expense');
    // Strip leading emoji from the name since the icon is prepended separately
    const cleanName = stripLeadingEmoji(catInfo.name || c.name).trim() || (catInfo.name || c.name);
    if (!seenCats.has(cleanName)) {
      seenCats.add(cleanName);
      const opt = document.createElement('option');
      opt.value = cleanName;
      opt.textContent = `${catInfo.icon} ${cleanName}`;
      catSelect.appendChild(opt);
    }
  });

  const existingBudgets = (state.budgets || []).filter(b => !b.is_deleted);
  let existing = null;

  if (targetCategoryName) {
    const cleanTarget = getCategoryInfo(targetCategoryName).name || targetCategoryName;
    existing = existingBudgets.find(b => {
      const cleanB = getCategoryInfo(b.category).name || b.category;
      if (targetSubcategory) {
        return cleanB === cleanTarget && b.subcategory === targetSubcategory;
      }
      return cleanB === cleanTarget && (!b.subcategory || b.subcategory === '');
    });
  }

  if (existing) {
    idInput.value = existing.id;
    catSelect.value = getCategoryInfo(existing.category).name || existing.category;
    onBudgetCategoryChange();
    if (subcatSelect && existing.subcategory) {
      subcatSelect.value = existing.subcategory;
    }
    amtInput.value = existing.amount;
    selectBudgetScope(existing.scope || 'personal');
    if (delBtn) delBtn.style.display = 'block';
  } else {
    idInput.value = '';
    if (targetCategoryName) {
      catSelect.value = getCategoryInfo(targetCategoryName).name || targetCategoryName;
    }
    onBudgetCategoryChange();
    if (subcatSelect && targetSubcategory) {
      subcatSelect.value = targetSubcategory;
    }
    amtInput.value = '';
    selectBudgetScope('personal');
    if (delBtn) delBtn.style.display = 'none';
  }

  const titleEl = document.getElementById('budget-modal-title');
  if (titleEl) {
    titleEl.textContent = existing
      ? ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['budget_modal_title_edit']) || (state.lang === 'el' ? '🎯 Επεξεργασία Προϋπολογισμού' : '🎯 Edit Category Budget'))
      : ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['budget_modal_title_set']) || (state.lang === 'el' ? '🎯 Ορισμός Προϋπολογισμού' : '🎯 Set Category Budget'));
  }

  if (typeof syncBudgetPickerTriggers === 'function') {
    syncBudgetPickerTriggers();
  }

  openModal('category-budget-modal');
}
window.openCategoryBudgetModal = openCategoryBudgetModal;

function setBudgetAmountPreset(val) {
  const amtInput = document.getElementById('budget-modal-amount');
  if (amtInput) {
    amtInput.value = val;
  }
}
window.setBudgetAmountPreset = setBudgetAmountPreset;

function selectBudgetScope(scope) {
  const input = document.getElementById('budget-modal-scope');
  const btnPersonal = document.getElementById('budget-scope-personal');
  const btnFamily = document.getElementById('budget-scope-family');
  if (input) input.value = scope;

  if (scope === 'family') {
    if (btnFamily) { btnFamily.style.background = 'var(--accent)'; btnFamily.style.color = '#ffffff'; }
    if (btnPersonal) { btnPersonal.style.background = 'transparent'; btnPersonal.style.color = 'var(--text-secondary)'; }
  } else {
    if (btnPersonal) { btnPersonal.style.background = 'var(--accent)'; btnPersonal.style.color = '#ffffff'; }
    if (btnFamily) { btnFamily.style.background = 'transparent'; btnFamily.style.color = 'var(--text-secondary)'; }
  }
}
window.selectBudgetScope = selectBudgetScope;

function saveCategoryBudgetFromModal() {
  const idInput = document.getElementById('budget-modal-id');
  const catSelect = document.getElementById('budget-modal-category');
  const subcatSelect = document.getElementById('budget-modal-subcategory');
  const amtInput = document.getElementById('budget-modal-amount');
  const scopeInput = document.getElementById('budget-modal-scope');
  const lang = state.lang || 'el';

  if (!catSelect || !amtInput) return;

  const categoryName = catSelect.value;
  const subcategoryName = subcatSelect ? subcatSelect.value : '';
  const amount = parseFloat(amtInput.value || 0);
  const scope = scopeInput ? scopeInput.value : 'personal';

  if (!categoryName) {
    showToast((TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_select_cat_first']) || (lang === 'el' ? 'Παρακαλώ επιλέξτε κατηγορία' : 'Please select category'), 'warning');
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    showToast(lang === 'el' ? 'Παρακαλώ εισάγετε έγκυρο θετικό ποσό' : 'Please enter valid positive amount', 'warning');
    return;
  }

  const budgetId = idInput.value || generateUUID();
  const existingIdx = (state.budgets || []).findIndex(b => b.id === budgetId || (b.category === categoryName && (b.subcategory || '') === subcategoryName));

  const budgetRecord = {
    id: budgetId,
    user_id: state.currentUser ? state.currentUser.id : 'offline-user',
    family_id: state.userProfile ? state.userProfile.family_id : null,
    category: categoryName,
    subcategory: subcategoryName,
    amount: amount,
    currency: getDisplayCurrency(),
    period: 'monthly',
    scope: scope,
    notify_threshold: 0.8,
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (existingIdx !== -1) {
    state.budgets[existingIdx] = budgetRecord;
  } else {
    // Premium gate: Free users may create up to 2 category budgets.
    // Adding a new (3rd+) budget requires Premium. Editing an existing
    // budget is always allowed (never lose data).
    const activeBudgetCount = (state.budgets || []).filter(b => !b.is_deleted).length;
    if (activeBudgetCount >= PREMIUM_LIMITS.budgets && !isPremium()) {
      closeModal('category-budget-modal');
      if (typeof openPremiumModal === 'function') openPremiumModal('budgets');
      showToast(
        lang === 'el'
          ? 'Μπορείτε να δημιουργήσετε έως 2 προϋπολογισμούς με το δωρεάν πλάνο. Αναβαθμίστε σε Premium για απεριόριστους.'
          : 'You can create up to 2 budgets on the free plan. Upgrade to Premium for unlimited budgets.',
        'warning'
      );
      return;
    }
    state.budgets.push(budgetRecord);
  }

  saveBudgets();
  closeModal('category-budget-modal');
  renderStatsTab();
  const savedToast = (TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_saved_toast']) || (lang === 'el' ? '🎯 Ο προϋπολογισμός αποθηκεύτηκε!' : '🎯 Budget saved!');
  showToast(savedToast, 'success');

  if (state.supabaseClient && state.currentUser) {
    syncBudgets();
  }
}
window.saveCategoryBudgetFromModal = saveCategoryBudgetFromModal;

async function deleteSelectedCategoryBudget() {
  const idInput = document.getElementById('budget-modal-id');
  const catSelect = document.getElementById('budget-modal-category');
  const lang = state.lang || 'el';

  if (!idInput || !idInput.value) return;
  const budgetId = idInput.value;
  const categoryName = catSelect ? catSelect.value : '';

  const confirmMsg = (TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_delete_confirm']) || (lang === 'el' ? 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτόν τον προϋπολογισμό;' : 'Are you sure you want to delete this budget?');
  const confirmed = await showConfirm(confirmMsg, lang === 'el' ? 'Διαγραφή Προϋπολογισμού' : 'Delete Budget', '🗑️');
  if (!confirmed) return;

  const idx = (state.budgets || []).findIndex(b => b.id === budgetId);
  if (idx !== -1) {
    state.budgets[idx].is_deleted = true;
    state.budgets[idx].updated_at = new Date().toISOString();
  }

  saveBudgets();
  closeModal('category-budget-modal');
  renderStatsTab();
  const deletedToast = (TRANSLATIONS[lang] && TRANSLATIONS[lang]['budget_deleted_toast']) || (lang === 'el' ? '🗑️ Ο προϋπολογισμός διαγράφηκε' : '🗑️ Budget deleted');
  showToast(deletedToast, 'info');

  if (state.supabaseClient && state.currentUser) {
    syncBudgets();
  }
}
window.deleteSelectedCategoryBudget = deleteSelectedCategoryBudget;

function checkOverBudgetNotification(transaction) {
  if (!transaction || transaction.type !== 'expense' || !state.budgets || state.budgets.length === 0) return;

  const catInfo = getCategoryInfo(transaction.category, 'expense');
  const catName = catInfo.name || transaction.category;
  const budget = state.budgets.find(b => !b.is_deleted && (b.category === catName || getCategoryInfo(b.category).name === catName));

  if (!budget) return;

  const displayCurrency = getDisplayCurrency();
  const symbol = getCurrencySymbol();
  const catSpent = (state.transactions || []).reduce((sum, t) => {
    if (t.type === 'expense' && (getCategoryInfo(t.category).name === catName)) {
      return sum + CurrencyService.displayAmount(t, displayCurrency);
    }
    return sum;
  }, 0);

  const budgetInDisplay = window.CurrencyService
    ? window.CurrencyService.convert(budget.amount, budget.currency || 'EUR', displayCurrency)
    : budget.amount;

  if (budgetInDisplay > 0 && catSpent >= budgetInDisplay) {
    const lang = state.lang || 'el';
    const overAmt = (catSpent - budgetInDisplay).toFixed(2);
    const title = lang === 'el' ? '⚠️ Υπέρβαση Προϋπολογισμού!' : '⚠️ Budget Limit Exceeded!';
    const body = lang === 'el'
      ? `Έχετε υπερβεί το όριο στην κατηγορία "${catName}" κατά ${symbol}${overAmt}`
      : `You have exceeded the limit for "${catName}" by ${symbol}${overAmt}`;

    addInAppNotification(title, body, { type: 'open_analytics' });

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
      window.Capacitor.Plugins.LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 100000),
          title: title,
          body: body,
          smallIcon: 'ic_launcher_round',
            iconColor: '#0F1219',
          schedule: { at: new Date(Date.now() + 500) }
        }]
      }).catch(e => console.warn('Failed to schedule local notification:', e));
    }
  }
}
window.checkOverBudgetNotification = checkOverBudgetNotification;

function openStatsTransactionsModal(category, subcategory) {
  state.activeSubcategoryTransactions = { category, subcategory };
  renderSubcategoryTransactions(category, subcategory);
  openModal('stats-transactions-modal');
}

function closeStatsTransactionsModal() {
  state.activeSubcategoryTransactions = null;
  closeModal('stats-transactions-modal');
}

function renderSubcategoryTransactions(category, subcategory) {
  const titleEl = document.getElementById('stats-transactions-title');
  const listContainer = document.getElementById('stats-transactions-list');
  if (!listContainer) return;
  const displayCurrency = getDisplayCurrency();

  const catDisplayName = getCategoryDisplayName(category);
  if (titleEl) {
    if (subcategory) {
      const subDisplayName = getSubcategoryDisplayName(subcategory, category);
      titleEl.textContent = `${catDisplayName} · ${subDisplayName}`;
    } else {
      titleEl.textContent = catDisplayName;
    }
  }

  listContainer.innerHTML = '';

  const { start, end } = getStatsDateRange();
  const walletTrans = getActiveTransactions();

  let memberFilteredTrans = walletTrans;
  if (state.userProfile && state.userProfile.family_id && state.selectedFamilyMemberId !== 'all') {
    memberFilteredTrans = walletTrans.filter(t => t.user_id === state.selectedFamilyMemberId);
  }

  const periodTrans = memberFilteredTrans.filter(t => {
    if (!t.date) return false;
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const tDate = new Date(datePart + 'T00:00:00');
    return tDate >= start && tDate <= end;
  });

  const subcatTrans = periodTrans.filter(t => {
    if (t.type !== state.statsType) return false;

    const catInfo = getCategoryInfo(t.category, t.type);
    const catName = catInfo.name || t.category || (state.lang === 'el' ? 'Άλλα' : 'Other');
    if (catName.toUpperCase() !== category.toUpperCase()) return false;

    if (!subcategory) return true;

    const tSub = t.subcategory || '';
    return tSub.toUpperCase() === subcategory.toUpperCase();
  }).sort(compareTransactions);

  if (subcatTrans.length === 0) {
    closeStatsTransactionsModal();
    return;
  }

  subcatTrans.forEach(t => {
    const catInfo = getCategoryInfo(t.category, t.type);
    const item = document.createElement('div');
    item.className = 'transaction-item';
    item.setAttribute('data-id', t.id);

    let modalTouchStartX = 0;
    let modalTouchStartY = 0;
    let modalTouchMoved = false;
    let modalFeedbackTimer;

    item.addEventListener('touchstart', (e) => {
      modalTouchMoved = false;
      const touch = e.touches[0];
      modalTouchStartX = touch.clientX;
      modalTouchStartY = touch.clientY;

      clearTimeout(modalFeedbackTimer);
      modalFeedbackTimer = setTimeout(() => {
        if (!modalTouchMoved && !state.isSwipingMonth) {
          item.classList.add('pressed');
        }
      }, 100);
    }, { passive: true });

    item.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const dx = touch.clientX - modalTouchStartX;
      const dy = touch.clientY - modalTouchStartY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        modalTouchMoved = true;
        clearTimeout(modalFeedbackTimer);
        item.classList.remove('pressed');
      }
    }, { passive: true });

    item.addEventListener('touchend', (e) => {
      clearTimeout(modalFeedbackTimer);
      item.classList.remove('pressed');
      if (state.isSwipingMonth || modalTouchMoved) {
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    item.addEventListener('touchcancel', () => {
      clearTimeout(modalFeedbackTimer);
      item.classList.remove('pressed');
    });

    item.onclick = () => {
      if (state.isSwipingMonth || modalTouchMoved || (Date.now() - state.lastSwipeTime < 1500)) return;
      openEditTransactionModal(t);
    };

    let amountClass = 'trans-amount';
    let accountText = t.account_from ? getAccountDisplayName(t.account_from) : '';
    if (t.type === 'expense') { amountClass += ' expense'; }
    else if (t.type === 'income') { amountClass += ' income'; }
    else if (t.type === 'transfer') {
      const fromDisp = getAccountDisplayName(t.account_from);
      const toDisp = getAccountDisplayName(t.account_to);
      amountClass += ' transfer';
      accountText = `${fromDisp} → ${toDisp}`;
    }

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

    // Format short date
    let dateLabel = '';
    if (t.date) {
      const datePart = String(t.date).split('T')[0].split(' ')[0];
      const [y, m, d] = datePart.split('-');
      dateLabel = `${d}/${m}/${y.substring(2)}`;
    }

    item.innerHTML = `
      <div class="trans-left">
        <div class="trans-category-container">
          <div class="trans-cat-icon">${catInfo.icon || '💰'}</div>
        </div>
        <div class="trans-details">
          <span class="trans-title">${escapeHtml(displayTitle)}${isTransactionRecurring(t) ? '<i class="fa-solid fa-arrows-rotate recurring-arrows-icon" title="' + (state.lang === 'el' ? 'Επαναλαμβανόμενη κίνηση' : 'Recurring transaction') + '"></i>' : ''}${memberBadge}</span>
          <span class="trans-acc-label">${escapeHtml(dateLabel)} · ${escapeHtml(accountText)}</span>
        </div>
      </div>
      <div class="${amountClass}">${getCurrencySymbol()} ${formatDisplayAmount(CurrencyService.displayAmount(t, displayCurrency), displayCurrency)}</div>`;
    listContainer.appendChild(item);
  });
}

window.openStatsTransactionsModal = openStatsTransactionsModal;
window.closeStatsTransactionsModal = closeStatsTransactionsModal;

function renderChart(dataList) {
  const ctx = document.getElementById('statsChart').getContext('2d');
  if (statsChartInstance) statsChartInstance.destroy();

  // Assign neon colors preserving original category color hints
  const colors = dataList.map((d, i) => NEON_PALETTE[i % NEON_PALETTE.length]);

  // Build gradient-aware colors for glow effect
  const bgColors = colors.map(c => c);
  const hoverColors = colors.map(c => c + 'dd');

  statsChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: dataList.map(d => `${d.icon} ${getCategoryDisplayName(d.name)}`),
      datasets: [{
        data: dataList.map(d => d.amount),
        backgroundColor: bgColors,
        hoverBackgroundColor: hoverColors,
        borderWidth: 2,
        borderColor: 'rgba(15,18,28,0.9)',
        borderRadius: 6,
        spacing: 4,
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      animation: {
        animateRotate: true,
        animateScale: false,
        duration: 700,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,18,28,0.97)',
          titleFont: { family: 'Outfit', size: 13, weight: '800' },
          bodyFont: { family: 'Inter', size: 13, weight: '600' },
          padding: 14,
          cornerRadius: 14,
          borderColor: 'rgba(99,102,241,0.4)',
          borderWidth: 1,
          displayColors: true,
          boxWidth: 10,
          boxHeight: 10,
          boxPadding: 4,
          callbacks: {
            label: ctx => {
              const val = ctx.raw;
              const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = sum > 0 ? Math.round((val / sum) * 100) : 0;
              return `  ${getCurrencySymbol()} ${formatDisplayAmount(val)}  (${pct}%)`;
            }
          }
        },
        datalabels: { display: false }
      }
    }
  });

  // Also update the stats breakdown list colors to match neon palette
  const rows = document.querySelectorAll('.stats-pct-badge');
  rows.forEach((badge, i) => {
    badge.style.background = colors[i % colors.length];
    badge.style.boxShadow = `0 0 8px ${colors[i % colors.length]}60`;
  });
}

  // UMD Exports & Window Binding
  window.renderStatsTab = renderStatsTab;
  window.switchStatsSubtab = switchStatsSubtab;
  window.renderCategoryBudgetsView = renderCategoryBudgetsView;
  window.openBudgetCategoryPicker = openBudgetCategoryPicker;
  window.openBudgetSubcategoryPicker = openBudgetSubcategoryPicker;
  window.openCategoryBudgetModal = openCategoryBudgetModal;
  window.saveCategoryBudgetFromModal = saveCategoryBudgetFromModal;
  window.deleteSelectedCategoryBudget = deleteSelectedCategoryBudget;
  window.openStatsTransactionsModal = openStatsTransactionsModal;
  window.closeStatsTransactionsModal = closeStatsTransactionsModal;
  window.renderChart = renderChart;

  return {
    renderStatsTab: renderStatsTab,
    switchStatsSubtab: switchStatsSubtab,
    renderCategoryBudgetsView: renderCategoryBudgetsView,
    openBudgetCategoryPicker: openBudgetCategoryPicker,
    openBudgetSubcategoryPicker: openBudgetSubcategoryPicker,
    openCategoryBudgetModal: openCategoryBudgetModal,
    saveCategoryBudgetFromModal: saveCategoryBudgetFromModal,
    deleteSelectedCategoryBudget: deleteSelectedCategoryBudget,
    openStatsTransactionsModal: openStatsTransactionsModal,
    closeStatsTransactionsModal: closeStatsTransactionsModal,
    renderChart: renderChart
  };
}));
