/**
 * TransactionListService - Primary Transactions Tab Renderer & Scroll Controller
 *
 * Handles:
 * - renderTransactionsTab: Monthly transaction grouping by date, sorting, daily totals,
 *   summary cards (income, expense, total), empty state card, and item card rendering.
 * - Transaction item interactions: selection mode checkboxes, long-press gestures,
 *   touchmove cancellation, ripple visual feedback, edit modal opening.
 * - scrollToToday: Smart scrolling to today's header or top of month list.
 *
 * UMD pattern: Browser global + Node.js module.exports
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TransactionListService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function _getState() {
    return (typeof state !== 'undefined' ? state : (typeof window !== 'undefined' ? window.state : null)) || {};
  }

  /**
   * Render transactions list for the transactions tab
   */
  function renderTransactionsTab(containerOverride, yearOverride, monthOverride) {
    if (typeof document === 'undefined') return;
    var appState = _getState();
    var listContainer = containerOverride || document.getElementById('transactions-list');
    if (!listContainer) return;

    var selectedYear = (yearOverride !== undefined && yearOverride !== null) ? yearOverride : appState.selectedYear;
    var selectedMonth = (monthOverride !== undefined && monthOverride !== null) ? monthOverride : appState.selectedMonth;

    var monthStartDay = 1;
    if (typeof localStorage !== 'undefined') {
      try {
        monthStartDay = parseInt(localStorage.getItem('app_month_start') || '1', 10);
      } catch (e) {}
    }

    var start, end;
    if (monthStartDay === 1) {
      start = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
      end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    } else {
      start = new Date(selectedYear, selectedMonth, monthStartDay, 0, 0, 0, 0);
      end = new Date(selectedYear, selectedMonth + 1, monthStartDay - 1, 23, 59, 59, 999);
    }

    var startISO = start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') + '-' + String(start.getDate()).padStart(2, '0');
    var endISO = end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-' + String(end.getDate()).padStart(2, '0');

    var getActiveTxs = typeof getActiveTransactions === 'function'
      ? getActiveTransactions
      : (typeof TransactionScopeService !== 'undefined' && typeof TransactionScopeService.getActiveTransactions === 'function'
        ? TransactionScopeService.getActiveTransactions
        : function () { return appState.transactions || []; });

    var walletTrans = getActiveTxs();
    var filteredTrans = walletTrans.filter(function (t) {
      if (!t.date) return false;
      var tDatePart = String(t.date).split('T')[0].split(' ')[0];
      return tDatePart >= startISO && tDatePart <= endISO;
    });

    var cmp = typeof compareTransactions === 'function'
      ? compareTransactions
      : (typeof TransactionScopeService !== 'undefined' && typeof TransactionScopeService.compareTransactions === 'function'
        ? TransactionScopeService.compareTransactions
        : function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

    var sortedTrans = filteredTrans.slice().sort(cmp);

    var getDispCurr = typeof getDisplayCurrency === 'function'
      ? getDisplayCurrency
      : function () { return (typeof CurrencyService !== 'undefined' && typeof CurrencyService.getAppCurrency === 'function') ? CurrencyService.getAppCurrency() : 'EUR'; };

    var displayCurrency = getDispCurr();
    var sumInCurr = (typeof CurrencyService !== 'undefined' && typeof CurrencyService.sumInCurrency === 'function')
      ? CurrencyService.sumInCurrency
      : function (arr) { return arr.reduce(function (sum, t) { return sum + (parseFloat(t.amount) || 0); }, 0); };

    var monthlyIncome = sumInCurr(sortedTrans.filter(function (t) { return t.type === 'income'; }), displayCurrency);
    var monthlyExpense = sumInCurr(sortedTrans.filter(function (t) { return t.type === 'expense'; }), displayCurrency);
    var groups = {};

    var dispAmt = (typeof CurrencyService !== 'undefined' && typeof CurrencyService.displayAmount === 'function')
      ? CurrencyService.displayAmount
      : function (t) { return parseFloat(t.amount) || 0; };

    sortedTrans.forEach(function (t) {
      var amt = dispAmt(t, displayCurrency);
      var dateKey = String(t.date || '').split('T')[0].split(' ')[0];
      if (!groups[dateKey]) groups[dateKey] = { transactions: [], income: 0, expense: 0 };
      groups[dateKey].transactions.push(t);
      if (t.type === 'income') groups[dateKey].income += amt;
      else if (t.type === 'expense') groups[dateKey].expense += amt;
    });

    var getCurrSym = typeof getCurrencySymbol === 'function' ? getCurrencySymbol : function () { return '€'; };
    var fmtDispAmt = typeof formatDisplayAmount === 'function' ? formatDisplayAmount : function (v) { return Number(v).toFixed(2); };

    if (!containerOverride) {
      var incValEl = document.getElementById('summary-income-val');
      var expValEl = document.getElementById('summary-expense-val');
      var totValEl = document.getElementById('summary-total-val');
      if (incValEl) incValEl.textContent = getCurrSym() + ' ' + fmtDispAmt(monthlyIncome, displayCurrency);
      if (expValEl) expValEl.textContent = getCurrSym() + ' ' + fmtDispAmt(monthlyExpense, displayCurrency);
      if (totValEl) totValEl.textContent = getCurrSym() + ' ' + fmtDispAmt(monthlyIncome - monthlyExpense, displayCurrency);
    }

    var lang = appState.lang || 'el';
    var translations = (typeof TRANSLATIONS !== 'undefined' ? TRANSLATIONS : (typeof window !== 'undefined' ? window.TRANSLATIONS : null)) || {};

    if (sortedTrans.length === 0) {
      var emptySig = 'empty_' + lang;
      if (listContainer._lastRenderSignature === emptySig) return;
      listContainer._lastRenderSignature = emptySig;

      var title = (translations[lang] && translations[lang]['trans_empty_title']) || (lang === 'el' ? 'Δεν υπάρχουν συναλλαγές για αυτόν τον μήνα' : 'No Transactions This Month');
      var desc = (translations[lang] && translations[lang]['trans_empty_desc']) || (lang === 'el'
        ? 'Προσθέστε την πρώτη σας συναλλαγή για να παρακολουθείτε την καθημερινή ροή των χρημάτων σας.'
        : 'Add your first transaction to start tracking your daily cash flow.');
      var addBtnText = (translations[lang] && translations[lang]['trans_empty_btn_add']) || (lang === 'el' ? '➕ Προσθήκη Συναλλαγής' : '➕ Add Transaction');
      var demoBtnText = (translations[lang] && translations[lang]['trans_empty_btn_demo']) || (lang === 'el' ? '📊 Δοκιμή με Δείγματα (Demo)' : '📊 Try Demo Mode');

      var jumpBtnHtml = '';
      if (walletTrans && walletTrans.length > 0) {
        var latestWithData = null;
        for (var i = 0; i < walletTrans.length; i++) {
          var tx = walletTrans[i];
          if (tx && tx.date) {
            var dParts = String(tx.date).split('T')[0].split(' ')[0].split('-');
            if (dParts.length === 3) {
              var ty = parseInt(dParts[0], 10);
              var tm = parseInt(dParts[1], 10) - 1;
              if (!isNaN(ty) && !isNaN(tm)) {
                if (!latestWithData || ty > latestWithData.year || (ty === latestWithData.year && tm > latestWithData.month)) {
                  latestWithData = { year: ty, month: tm };
                }
              }
            }
          }
        }
        if (latestWithData && (latestWithData.year !== selectedYear || latestWithData.month !== selectedMonth)) {
          var getMoName = (typeof getMonthName === 'function')
            ? getMonthName
            : (typeof window !== 'undefined' && typeof window.getMonthName === 'function' ? window.getMonthName : function (m) { return String(m + 1); });
          var targetMonthLabel = getMoName(latestWithData.month, false) + ' ' + latestWithData.year;
          var jumpText = (lang === 'el')
            ? ('📅 Μετάβαση σε ' + targetMonthLabel + ' (προηγούμενες κινήσεις)')
            : ('📅 Jump to ' + targetMonthLabel + ' (previous data)');
          jumpBtnHtml =
            '<button class="stats-empty-btn-primary" onclick="if(window.goToMonth)window.goToMonth(' + latestWithData.year + ', ' + latestWithData.month + ')" style="width: 100%; justify-content: center; font-size: 13px; font-weight: 700; padding: 11px 16px; border-radius: 12px; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); color: #fff; cursor: pointer; margin-bottom: 2px;">' +
              '<span>' + jumpText + '</span>' +
            '</button>';
        }
      }

      listContainer.innerHTML =
        '<div class="stats-empty-card" style="margin: 28px 14px;">' +
          '<div style="width: 76px; height: 76px; border-radius: 24px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); display: flex; align-items: center; justify-content: center; font-size: 32px; color: var(--accent); box-shadow: 0 0 25px rgba(99, 102, 241, 0.25); margin-bottom: 2px;">' +
            '<i class="fa-solid fa-receipt"></i>' +
          '</div>' +
          '<div style="display: flex; flex-direction: column; gap: 6px;">' +
            '<h3 class="stats-empty-title">' + title + '</h3>' +
            '<p class="stats-empty-desc">' + desc + '</p>' +
          '</div>' +
          '<div class="stats-empty-actions" style="display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 320px; margin-top: 10px;">' +
            jumpBtnHtml +
            '<button class="stats-empty-btn-primary" onclick="openQuickStartModal(0)" style="width: 100%; justify-content: center; font-size: 14px; font-weight: 700; padding: 12px 18px; border-radius: 12px; background: linear-gradient(135deg, var(--accent, #6366f1) 0%, #4f46e5 100%); border: none; color: #fff; cursor: pointer; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);">' +
              '<span>' + (lang === 'el' ? 'Υπολογισμός ορίου σε 1′' : 'Calculate limit in 1 min') + '</span>' +
            '</button>' +
            '<div style="display: flex; gap: 8px; width: 100%;">' +
              '<button class="stats-empty-btn-secondary" onclick="openAddTransactionModal()" style="flex: 1; justify-content: center; font-size: 12.5px; padding: 10px 10px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary); cursor: pointer;">' +
                '<span>' + addBtnText + '</span>' +
              '</button>' +
              '<button class="stats-empty-btn-secondary" onclick="onboardingAddDemoData()" style="flex: 1; justify-content: center; font-size: 12.5px; padding: 10px 10px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: var(--text-secondary); cursor: pointer;">' +
                '<span>' + demoBtnText + '</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      return;
    }

    var selectedIds = appState.selectedIds || new Set();
    var accountsHash = (appState.accounts || []).map(function (a) { return a.id + '_' + a.name + '_' + a.balance; }).join('|');
    var categoriesHash = (appState.categories || []).map(function (c) { return c.id + '_' + c.name + '_' + c.icon; }).join('|');
    var hideAmt = (typeof localStorage !== 'undefined' && localStorage.getItem('settings_hide_amounts') === 'true') ? '1' : '0';

    var renderSignature = sortedTrans.map(function (t) {
      return t.id + '_' + t.date + '_' + t.amount + '_' + t.category + '_' + (t.subcategory || '') + '_' + t.type + '_' + (t.note || '') + '_' + (t.user_id || '') + '_' + (selectedIds.has(t.id) ? '1' : '0');
    }).join('|') + '_selMode_' + (appState.selectionMode ? '1' : '0') + '_lang_' + lang + '_accs_' + accountsHash + '_cats_' + categoriesHash + '_curr_' + displayCurrency + '_hideAmt_' + hideAmt;

    if (listContainer._lastRenderSignature === renderSignature) {
      return;
    }
    listContainer._lastRenderSignature = renderSignature;

    var todayObj = new Date();
    var todayStr = todayObj.getFullYear() + '-' + String(todayObj.getMonth() + 1).padStart(2, '0') + '-' + String(todayObj.getDate()).padStart(2, '0');
    var fragment = document.createDocumentFragment();

    var getDayName = typeof getWeekdayName === 'function' ? getWeekdayName : (typeof I18nService !== 'undefined' && typeof I18nService.getWeekdayName === 'function' ? I18nService.getWeekdayName : function () { return ''; });
    var getMName = typeof getMonthName === 'function' ? getMonthName : (typeof I18nService !== 'undefined' && typeof I18nService.getMonthName === 'function' ? I18nService.getMonthName : function () { return ''; });
    var getCatInfo = typeof getCategoryInfo === 'function' ? getCategoryInfo : (typeof CategoryHelperService !== 'undefined' && typeof CategoryHelperService.getCategoryInfo === 'function' ? CategoryHelperService.getCategoryInfo : function () { return {}; });
    var getCatDispName = typeof getCategoryDisplayName === 'function' ? getCategoryDisplayName : (typeof CategoryHelperService !== 'undefined' && typeof CategoryHelperService.getCategoryDisplayName === 'function' ? CategoryHelperService.getCategoryDisplayName : function (c) { return c; });
    var getSubcatDispName = typeof getSubcategoryDisplayName === 'function' ? getSubcategoryDisplayName : (typeof CategoryHelperService !== 'undefined' && typeof CategoryHelperService.getSubcategoryDisplayName === 'function' ? CategoryHelperService.getSubcategoryDisplayName : function (s) { return s; });
    var escHtml = typeof escapeHtml === 'function' ? escapeHtml : (typeof FormatUtils !== 'undefined' && typeof FormatUtils.escapeHtml === 'function' ? FormatUtils.escapeHtml : function (s) { return s || ''; });
    var getAccDispName = typeof getAccountDisplayName === 'function' ? getAccountDisplayName : (typeof AccountManagerService !== 'undefined' && typeof AccountManagerService.getAccountDisplayName === 'function' ? AccountManagerService.getAccountDisplayName : function (a) { return a; });

    Object.keys(groups).sort(function (a, b) { return b.localeCompare(a); }).forEach(function (dateStr) {
      var group = groups[dateStr];
      var parts = dateStr.split('-').map(Number);
      var y = parts[0], m = parts[1], d = parts[2];
      var dateObj = new Date(y, m - 1, d);
      var dayOfWeek = dateObj.getDay();
      var dayNum = d;
      var shortDay = getDayName(dayOfWeek);
      var weekendClass = dayOfWeek === 6 ? ' saturday' : dayOfWeek === 0 ? ' sunday' : '';
      var isToday = (dateStr === todayStr);

      var rightTotals = '';
      if (group.income > 0) rightTotals += '<span class="day-group-income">' + getCurrSym() + ' ' + fmtDispAmt(group.income, displayCurrency) + '</span>';
      if (group.expense > 0) rightTotals += '<span class="day-group-expense">' + getCurrSym() + ' ' + fmtDispAmt(group.expense, displayCurrency) + '</span>';

      var header = document.createElement('div');
      header.className = 'day-header' + (isToday ? ' is-today' : '');
      var todayBadge = isToday ? (' <span class="today-badge">' + (lang === 'el' ? 'ΣΗΜΕΡΑ' : 'TODAY') + '</span>') : '';
      header.innerHTML =
        '<div class="day-header-left">' +
          '<span class="day-num">' + dayNum + '</span>' +
          '<div>' +
            '<span class="day-name' + weekendClass + '">' + shortDay + '</span>' + todayBadge +
            '<span class="day-month">' + getMName(m - 1, true) + ' ' + y + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="day-header-right">' + rightTotals + '</div>';
      fragment.appendChild(header);

      group.transactions.forEach(function (t) {
        var catInfo = getCatInfo(t.category, t.type);
        var item = document.createElement('div');
        item.className = 'transaction-item';
        item.setAttribute('data-id', t.id);

        var isSelected = selectedIds.has(t.id);
        if (appState.selectionMode && isSelected) {
          item.classList.add('selected');
        }

        var checkboxHtml = appState.selectionMode ? (
          '<div class="trans-checkbox ' + (isSelected ? 'checked' : '') + '">' +
            '<i class="fa-solid ' + (isSelected ? 'fa-circle-check' : 'fa-circle') + '"></i>' +
          '</div>'
        ) : '';

        var pressTimer;
        var feedbackTimer;
        var isLongPress = false;
        var touchStartX = 0;
        var touchStartY = 0;

        item.addEventListener('touchstart', function (e) {
          isLongPress = false;
          appState.touchDidMove = false;
          if (e.touches && e.touches[0]) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
          }

          clearTimeout(feedbackTimer);
          feedbackTimer = setTimeout(function () {
            if (!appState.touchDidMove && !appState.isSwipingMonth) {
              item.classList.add('pressed');
            }
          }, 80);

          if (appState.selectionMode) return;
          pressTimer = setTimeout(function () {
            isLongPress = true;
            if (typeof enterSelectionMode === 'function') enterSelectionMode();
            if (typeof toggleSelection === 'function') toggleSelection(t.id);
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try { navigator.vibrate(15); } catch (err) {}
            }
          }, 600);
        }, { passive: true });

        item.addEventListener('touchmove', function (e) {
          if (e.touches && e.touches[0]) {
            var dx = e.touches[0].clientX - touchStartX;
            var dy = e.touches[0].clientY - touchStartY;
            if (Math.hypot(dx, dy) > 10) {
              clearTimeout(pressTimer);
              clearTimeout(feedbackTimer);
              item.classList.remove('pressed');
              appState.touchDidMove = true;
            }
          } else {
            clearTimeout(pressTimer);
            clearTimeout(feedbackTimer);
            item.classList.remove('pressed');
            appState.touchDidMove = true;
          }
        }, { passive: true });

        item.addEventListener('touchend', function (e) {
          clearTimeout(pressTimer);
          clearTimeout(feedbackTimer);
          item.classList.remove('pressed');
          if (appState.isSwipingMonth || appState.touchDidMove) {
            if (e.cancelable) e.preventDefault();
          }
        }, { passive: false });

        item.addEventListener('touchcancel', function () {
          clearTimeout(pressTimer);
          clearTimeout(feedbackTimer);
          item.classList.remove('pressed');
        });

        item.addEventListener('mousedown', function () {
          isLongPress = false;
          item.classList.add('pressed');
          if (appState.selectionMode) return;
          pressTimer = setTimeout(function () {
            isLongPress = true;
            if (typeof enterSelectionMode === 'function') enterSelectionMode();
            if (typeof toggleSelection === 'function') toggleSelection(t.id);
          }, 600);
        });

        item.addEventListener('mouseup', function () {
          clearTimeout(pressTimer);
          item.classList.remove('pressed');
        });

        item.addEventListener('mouseleave', function () {
          clearTimeout(pressTimer);
          item.classList.remove('pressed');
        });

        item.onclick = function () {
          if (appState.isSwipingMonth || appState.touchDidMove || (Date.now() - (appState.lastSwipeTime || 0) < 1500)) {
            isLongPress = false;
            appState.touchDidMove = false;
            return;
          }
          if (isLongPress) {
            isLongPress = false;
            return;
          }
          if (appState.selectionMode) {
            if (typeof toggleSelection === 'function') toggleSelection(t.id);
          } else {
            if (typeof openEditTransactionModal === 'function') openEditTransactionModal(t);
          }
        };

        var amountClass = 'trans-amount';
        var accountText = t.account_from ? getAccDispName(t.account_from) : '';
        if (t.type === 'expense') {
          amountClass += ' expense';
        } else if (t.type === 'income') {
          amountClass += ' income';
        } else if (t.type === 'transfer') {
          var fromDisp = getAccDispName(t.account_from);
          var toDisp = getAccDispName(t.account_to);
          amountClass += ' transfer';
          accountText = fromDisp + ' → ' + toDisp;
        }

        var translatedSub = getSubcatDispName(t.subcategory, t.category);
        var translatedCat = getCatDispName(t.category);
        var displayTitle = (t.note && t.note.trim()) ? t.note.trim()
          : (t.description && t.description.trim()) ? t.description.trim()
            : (translatedSub && translatedSub.trim()) ? translatedSub.trim()
              : (translatedCat || '');

        var memberBadge = (typeof getMemberBadgeHTML === 'function')
          ? getMemberBadgeHTML(t)
          : (typeof PartnerSyncService !== 'undefined' && typeof PartnerSyncService.getMemberBadgeHTML === 'function')
            ? PartnerSyncService.getMemberBadgeHTML(t)
            : '';

        var catBadgeHtml = (typeof renderCategoryIconHtml === 'function')
          ? renderCategoryIconHtml(t.category, { size: 'sm', transType: t.type })
          : ('<div class="trans-cat-icon">' + (catInfo.icon || '💰') + '</div>');

        var isRec = typeof isTransactionRecurring === 'function' ? isTransactionRecurring(t) : false;
        var recIcon = isRec
          ? ('<i class="fa-solid fa-arrows-rotate recurring-arrows-icon" title="' + (lang === 'el' ? 'Επαναλαμβανόμενη κίνηση' : 'Recurring transaction') + '"></i>')
          : '';

        var txCurrLabel = typeof getTxCurrencyLabel === 'function' ? getTxCurrencyLabel(t) : '';
        var relBadge = typeof getReliabilityBadge === 'function' ? getReliabilityBadge(t) : '';

        item.innerHTML =
          checkboxHtml +
          '<div class="trans-left">' +
            '<div class="trans-category-container">' +
              catBadgeHtml +
              '<div class="trans-cat-name">' + (escHtml(translatedCat) || '') + '</div>' +
              (t.subcategory ? ('<div class="trans-sub-name">' + escHtml(translatedSub) + '</div>') : '') +
            '</div>' +
            '<div class="trans-details">' +
              '<span class="trans-title">' + escHtml(displayTitle) + recIcon + memberBadge + '</span>' +
              '<span class="trans-acc-label">' + escHtml(accountText) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="' + amountClass + '">' + getCurrSym() + ' ' + fmtDispAmt(dispAmt(t, displayCurrency), displayCurrency) + txCurrLabel + relBadge + '</div>';

        fragment.appendChild(item);
      });
    });

    if (typeof listContainer.replaceChildren === 'function') {
      listContainer.replaceChildren(fragment);
    } else {
      listContainer.innerHTML = '';
      listContainer.appendChild(fragment);
    }
  }

  /**
   * Scroll smoothly to today's date header in transactions tab
   */
  function scrollToToday(behavior) {
    behavior = behavior || 'smooth';
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    var isMobile = window.innerWidth <= 767;
    var scrollContainer = isMobile
      ? document.querySelector('.trans-scroll-content')
      : document.querySelector('.app-content');
    var list = document.getElementById('transactions-list');
    if (!scrollContainer || !list) return;

    var todayHeader = list.querySelector('.day-header.is-today');
    if (todayHeader) {
      var relativeTop = 0;
      var el = todayHeader;
      while (el && el !== scrollContainer) {
        relativeTop += el.offsetTop;
        el = el.offsetParent;
      }

      var offset = isMobile ? 0 : 105;

      if (typeof scrollContainer.scrollTo === 'function') {
        scrollContainer.scrollTo({
          top: Math.max(0, relativeTop - offset),
          behavior: behavior
        });
      } else {
        scrollContainer.scrollTop = Math.max(0, relativeTop - offset);
      }
    } else {
      if (typeof scrollContainer.scrollTo === 'function') {
        scrollContainer.scrollTo({
          top: 0,
          behavior: behavior
        });
      } else {
        scrollContainer.scrollTop = 0;
      }
    }
  }

  function goToMonth(year, month) {
    var s = _getState();
    if (s) {
      s.selectedYear = year;
      s.selectedMonth = month;
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('selected_year', year);
          localStorage.setItem('selected_month', month);
        } catch (_) {}
      }
      if (typeof updateUI === 'function') {
        updateUI();
      } else if (typeof window !== 'undefined' && typeof window.updateUI === 'function') {
        window.updateUI();
      }
    }
  }

  var service = {
    renderTransactionsTab: renderTransactionsTab,
    scrollToToday: scrollToToday,
    goToMonth: goToMonth
  };

  if (typeof window !== 'undefined') {
    window.TransactionListService = service;
    window.renderTransactionsTab = renderTransactionsTab;
    window.scrollToToday = scrollToToday;
    window.goToMonth = goToMonth;
  }

  return service;
}));
