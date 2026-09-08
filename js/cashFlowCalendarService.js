/**
 * js/cashFlowCalendarService.js
 *
 * Cash Flow Calendar & Upcoming Bills Intelligence Subsystem for Budget Assistant.
 *
 * Combines historical transactions with scheduled recurring templates
 * to provide a comprehensive daily cash flow map:
 * - 7-day week grid (Mon-Sun) with income, expense, and upcoming bill status dots
 * - Month-end projected balance calculation (Actual Net - Remaining Fixed Bills)
 * - Interactive Day Drawer with transaction breakdown & 1-tap bill Quick-Pay
 * - Pure calculation methods fully decoupled for unit testing
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser global
    var exports = factory();
    Object.assign(root, exports);
    root.CashFlowCalendarService = exports;
    if (typeof globalThis !== 'undefined') globalThis.CashFlowCalendarService = exports;
    if (typeof window !== 'undefined') {
      window.CashFlowCalendarService = exports;
      window.openCashFlowCalendarModal = exports.openCashFlowCalendarModal;
      window.closeCashFlowCalendarModal = exports.closeCashFlowCalendarModal;
      window.navCashFlowMonth = exports.navCashFlowMonth;
      window.selectCashFlowDay = exports.selectCashFlowDay;
      window.quickPayCalendarBill = exports.quickPayCalendarBill;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var _viewYear = new Date().getFullYear();
  var _viewMonth = new Date().getMonth(); // 0..11
  var _selectedDateStr = null;

  var GREEK_MONTHS = [
    'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
    'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'
  ];

  var ENGLISH_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  var GREEK_WEEKDAYS_SHORT = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'];
  var ENGLISH_WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function padZero(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function getDaysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  /**
   * Converts Sunday=0..Saturday=6 to Monday=0..Sunday=6
   */
  function getMondayFirstWeekday(year, monthIndex, day) {
    var d = new Date(year, monthIndex, day).getDay();
    return d === 0 ? 6 : d - 1;
  }

  function formatDisplayDate(dateStr, lang) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = parseInt(parts[2], 10);
    var dt = new Date(y, m, d);

    var elDays = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
    var enDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    var dayName = (lang === 'el' ? elDays : enDays)[dt.getDay()];
    var monthName = (lang === 'el' ? GREEK_MONTHS : ENGLISH_MONTHS)[m];
    return dayName + ', ' + d + ' ' + monthName + ' ' + y;
  }

  /**
   * Pure calculation function: builds month matrix with transactions and upcoming bills
   */
  function getMonthCashFlowData(year, monthIndex, transactions, recurringTemplates) {
    transactions = Array.isArray(transactions) ? transactions : [];
    recurringTemplates = Array.isArray(recurringTemplates) ? recurringTemplates : [];

    var daysInMonth = getDaysInMonth(year, monthIndex);
    var firstDayWeekday = getMondayFirstWeekday(year, monthIndex, 1);

    var now = new Date();
    var todayStr = now.getFullYear() + '-' + padZero(now.getMonth() + 1) + '-' + padZero(now.getDate());

    var actualIncome = 0;
    var actualExpense = 0;
    var projectedRemainingBills = 0;

    // Filter transactions for this month (excluding transfers from income/expense totals)
    var monthPrefix = year + '-' + padZero(monthIndex + 1) + '-';
    var monthTxMap = {};
    for (var i = 1; i <= daysInMonth; i++) {
      monthTxMap[monthPrefix + padZero(i)] = [];
    }

    transactions.forEach(function (t) {
      if (!t || t.is_deleted) return;
      var dateStr = String(t.date || '').split('T')[0];
      if (monthTxMap[dateStr]) {
        monthTxMap[dateStr].push(t);
      }
    });

    // Check recurring templates for upcoming bills this month
    // A template is active if not deleted and matches the schedule
    var days = [];
    for (var dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      var dateStr = monthPrefix + padZero(dayNum);
      var dayTx = monthTxMap[dateStr] || [];

      var dayIncome = 0;
      var dayExpense = 0;

      dayTx.forEach(function (t) {
        var amt = parseFloat(t.amount) || 0;
        if (typeof window !== 'undefined' && window.CurrencyService && typeof window.CurrencyService.toBase === 'function') {
          amt = window.CurrencyService.toBase(t);
        }
        if (t.type === 'income') {
          dayIncome += amt;
        } else if (t.type === 'expense') {
          dayExpense += amt;
        }
      });

      actualIncome += dayIncome;
      actualExpense += dayExpense;

      // Find upcoming bills for this day
      var upcomingBills = [];
      recurringTemplates.forEach(function (tpl) {
        if (!tpl || tpl.is_deleted) return;
        var dueDay = parseInt(tpl.day_of_month, 10);
        if (isNaN(dueDay) && tpl.start_date) {
          dueDay = parseInt(String(tpl.start_date).split('-')[2], 10);
        }
        if (dueDay === dayNum) {
          // Check if already paid this month
          var isPaid = false;
          // 1. Matched by recurring_template_id
          for (var k = 0; k < dayTx.length; k++) {
            if (String(dayTx[k].recurring_template_id) === String(tpl.id)) {
              isPaid = true;
              break;
            }
          }
          // 2. Fuzzy match note/category/amount if not strictly tagged
          if (!isPaid) {
            for (var m = 0; m < dayTx.length; m++) {
              var tx = dayTx[m];
              if (tx.type === 'expense' && Math.abs(parseFloat(tx.amount) - parseFloat(tpl.amount)) < 0.05) {
                var tplNote = String(tpl.note || '').trim().toLowerCase();
                var txNote = String(tx.note || '').trim().toLowerCase();
                if (tplNote && txNote && (txNote.indexOf(tplNote) !== -1 || tplNote.indexOf(txNote) !== -1)) {
                  isPaid = true;
                  break;
                }
              }
            }
          }

          var billAmount = parseFloat(tpl.amount) || 0;
          if (!isPaid) {
            upcomingBills.push({
              id: tpl.id,
              note: tpl.note || tpl.category || 'Πάγια Υποχρέωση',
              category: tpl.category || 'Λογαριασμοί',
              amount: billAmount,
              currency: tpl.currency || 'EUR',
              day: dayNum,
              dateStr: dateStr
            });

            // If date is today or in the future, add to remaining projected bills
            if (dateStr >= todayStr) {
              projectedRemainingBills += billAmount;
            }
          }
        }
      });

      var isToday = (dateStr === todayStr);
      var isPast = (dateStr < todayStr);
      var isFuture = (dateStr > todayStr);

      days.push({
        dayNum: dayNum,
        dateStr: dateStr,
        weekday: (firstDayWeekday + (dayNum - 1)) % 7,
        isToday: isToday,
        isPast: isPast,
        isFuture: isFuture,
        transactions: dayTx,
        upcomingBills: upcomingBills,
        totalIncome: dayIncome,
        totalExpense: dayExpense,
        netDay: dayIncome - dayExpense,
        hasIncome: dayIncome > 0,
        hasExpense: dayExpense > 0,
        hasUpcomingBill: upcomingBills.length > 0
      });
    }

    var actualNet = actualIncome - actualExpense;
    var projectedEndOfMonthNet = actualNet - projectedRemainingBills;

    return {
      year: year,
      monthIndex: monthIndex,
      daysInMonth: daysInMonth,
      firstDayWeekday: firstDayWeekday,
      days: days,
      actualIncome: actualIncome,
      actualExpense: actualExpense,
      actualNet: actualNet,
      projectedRemainingBills: projectedRemainingBills,
      projectedEndOfMonthNet: projectedEndOfMonthNet
    };
  }

  function getActiveAppState() {
    if (typeof state !== 'undefined' && state) return state;
    if (typeof window !== 'undefined' && window.state) return window.state;
    return {};
  }

  function formatMoney(amount, currency) {
    if (typeof window !== 'undefined' && typeof window.formatDisplayAmount === 'function') {
      var sym = (typeof window.getCurrencySymbol === 'function') ? window.getCurrencySymbol() : '€';
      return sym + ' ' + window.formatDisplayAmount(amount);
    }
    return (parseFloat(amount) || 0).toFixed(2) + ' €';
  }

  function triggerHaptic(type) {
    if (typeof window !== 'undefined' && window.HapticFeedbackService && typeof window.HapticFeedbackService.trigger === 'function') {
      window.HapticFeedbackService.trigger(type);
    }
  }

  /**
   * Renders the Cash Flow Calendar UI into the modal
   */
  function renderCashFlowCalendar(year, monthIndex) {
    if (typeof year === 'number') _viewYear = year;
    if (typeof monthIndex === 'number') _viewMonth = monthIndex;

    var s = getActiveAppState();
    var lang = s.lang || 'el';
    var transactions = s.transactions || [];
    var templates = s.recurringTemplates || [];

    var data = getMonthCashFlowData(_viewYear, _viewMonth, transactions, templates);

    // 1. Month Header & Navigation
    var titleEl = document.getElementById('cash-flow-month-title');
    if (titleEl) {
      var monthName = (lang === 'el' ? GREEK_MONTHS : ENGLISH_MONTHS)[_viewMonth];
      titleEl.textContent = monthName + ' ' + _viewYear;
    }

    // 2. Summary Cards
    var incEl = document.getElementById('cf-summary-income');
    var expEl = document.getElementById('cf-summary-expense');
    var remEl = document.getElementById('cf-summary-remaining-bills');
    var netEl = document.getElementById('cf-summary-net');

    if (incEl) incEl.textContent = '+' + formatMoney(data.actualIncome);
    if (expEl) expEl.textContent = '-' + formatMoney(data.actualExpense);
    if (remEl) remEl.textContent = formatMoney(data.projectedRemainingBills);
    if (netEl) {
      var netVal = data.projectedEndOfMonthNet;
      netEl.textContent = (netVal >= 0 ? '+' : '') + formatMoney(netVal);
      netEl.className = 'cf-summary-val ' + (netVal >= 0 ? 'positive' : 'negative');
    }

    // 3. Weekday Headers
    var weekGrid = document.getElementById('cash-flow-weekdays');
    if (weekGrid && weekGrid.children.length === 0) {
      var wdNames = (lang === 'el' ? GREEK_WEEKDAYS_SHORT : ENGLISH_WEEKDAYS_SHORT);
      weekGrid.innerHTML = wdNames.map(function (w) {
        return '<div class="cf-weekday-cell">' + w + '</div>';
      }).join('');
    }

    // 4. Days Grid
    var gridEl = document.getElementById('cash-flow-days-grid');
    if (gridEl) {
      gridEl.innerHTML = '';

      // Blank offset cells before 1st day
      for (var b = 0; b < data.firstDayWeekday; b++) {
        var blank = document.createElement('div');
        blank.className = 'cf-day-cell blank';
        gridEl.appendChild(blank);
      }

      // Day cells
      data.days.forEach(function (d) {
        var cell = document.createElement('div');
        cell.className = 'cf-day-cell' +
          (d.isToday ? ' today' : '') +
          (d.dateStr === _selectedDateStr ? ' selected' : '') +
          (d.isFuture ? ' future' : '');
        cell.setAttribute('data-date', d.dateStr);

        var netDisplay = '';
        if (d.netDay !== 0) {
          var isPos = d.netDay > 0;
          netDisplay = '<span class="cf-day-net ' + (isPos ? 'pos' : 'neg') + '">' +
            (isPos ? '+' : '') + Math.round(d.netDay) + '€</span>';
        }

        var dotsHtml = '';
        if (d.hasIncome) dotsHtml += '<span class="cf-dot income" title="Έσοδο"></span>';
        if (d.hasExpense) dotsHtml += '<span class="cf-dot expense" title="Έξοδο"></span>';
        if (d.hasUpcomingBill) dotsHtml += '<span class="cf-dot bill" title="Πάγια Υποχρέωση"></span>';

        cell.innerHTML =
          '<div class="cf-day-header">' +
            '<span class="cf-day-number">' + d.dayNum + '</span>' +
            netDisplay +
          '</div>' +
          '<div class="cf-day-dots">' + dotsHtml + '</div>';

        cell.onclick = function () {
          selectCashFlowDay(d.dateStr);
        };

        gridEl.appendChild(cell);
      });
    }

    // 5. Select default day (today if viewing current month, or 1st day of month)
    var now = new Date();
    var defaultDate = (_viewYear === now.getFullYear() && _viewMonth === now.getMonth())
      ? now.getFullYear() + '-' + padZero(now.getMonth() + 1) + '-' + padZero(now.getDate())
      : _viewYear + '-' + padZero(_viewMonth + 1) + '-01';

    if (!_selectedDateStr || _selectedDateStr.indexOf(_viewYear + '-' + padZero(_viewMonth + 1)) !== 0) {
      _selectedDateStr = defaultDate;
    }

    renderCashFlowDayDrawer(_selectedDateStr, data);
  }

  /**
   * Selects a day cell and renders the day drawer
   */
  function selectCashFlowDay(dateStr) {
    _selectedDateStr = dateStr;
    triggerHaptic('selection');

    // Update active class on cells
    var gridEl = document.getElementById('cash-flow-days-grid');
    if (gridEl) {
      var cells = gridEl.querySelectorAll('.cf-day-cell');
      cells.forEach(function (c) {
        if (c.getAttribute('data-date') === dateStr) {
          c.classList.add('selected');
        } else {
          c.classList.remove('selected');
        }
      });
    }

    var s = getActiveAppState();
    var transactions = s.transactions || [];
    var templates = s.recurringTemplates || [];
    var data = getMonthCashFlowData(_viewYear, _viewMonth, transactions, templates);
    renderCashFlowDayDrawer(dateStr, data);
  }

  /**
   * Renders details of the selected day in bottom drawer
   */
  function renderCashFlowDayDrawer(dateStr, data) {
    var drawerEl = document.getElementById('cash-flow-day-drawer');
    if (!drawerEl) return;

    var s = getActiveAppState();
    var lang = s.lang || 'el';

    var dayData = (data && data.days) ? data.days.find(function (d) { return d.dateStr === dateStr; }) : null;

    var dateTitle = formatDisplayDate(dateStr, lang);

    var html =
      '<div class="cf-drawer-header">' +
        '<div class="cf-drawer-date"><i class="fa-solid fa-calendar-day" style="color:var(--accent);"></i> ' + dateTitle + '</div>' +
        '<div class="cf-drawer-net">' +
          ((dayData && dayData.netDay !== 0)
            ? ((dayData.netDay > 0 ? '+' : '') + formatMoney(dayData.netDay))
            : (lang === 'el' ? 'Καθαρό: 0,00€' : 'Net: 0.00€')) +
        '</div>' +
      '</div>';

    if (!dayData || (dayData.transactions.length === 0 && dayData.upcomingBills.length === 0)) {
      html +=
        '<div class="cf-drawer-empty">' +
          '<i class="fa-solid fa-mug-hot" style="font-size: 24px; color: var(--text-muted); margin-bottom: 8px;"></i>' +
          '<div>' + (lang === 'el' ? 'Δεν υπάρχουν κινήσεις ή πάγια για αυτή την ημέρα.' : 'No transactions or bills for this day.') + '</div>' +
        '</div>';
      drawerEl.innerHTML = html;
      return;
    }

    // 1. Upcoming Bills Section
    if (dayData.upcomingBills && dayData.upcomingBills.length > 0) {
      html += '<div class="cf-drawer-section-title">' + (lang === 'el' ? '⏳ Πάγιες Υποχρεώσεις προς Πληρωμή' : '⏳ Scheduled Bills to Pay') + '</div>';
      dayData.upcomingBills.forEach(function (bill) {
        html +=
          '<div class="cf-bill-card">' +
            '<div class="cf-bill-icon"><i class="fa-solid fa-receipt"></i></div>' +
            '<div class="cf-bill-info">' +
              '<div class="cf-bill-title">' + (bill.note || bill.category) + '</div>' +
              '<div class="cf-bill-cat">' + bill.category + '</div>' +
            '</div>' +
            '<div class="cf-bill-amount">-' + formatMoney(bill.amount, bill.currency) + '</div>' +
            '<button type="button" class="cf-quick-pay-btn" onclick="quickPayCalendarBill(\'' + bill.id + '\', \'' + dateStr + '\')">' +
              '<i class="fa-solid fa-bolt-lightning"></i> ' + (lang === 'el' ? 'Πληρωμή' : 'Pay') +
            '</button>' +
          '</div>';
      });
    }

    // 2. Transactions Section
    if (dayData.transactions && dayData.transactions.length > 0) {
      html += '<div class="cf-drawer-section-title">' + (lang === 'el' ? '💳 Καταχωρημένες Κινήσεις' : '💳 Logged Transactions') + '</div>';
      dayData.transactions.forEach(function (t) {
        var isIncome = t.type === 'income';
        var isTransfer = t.type === 'transfer';
        var amtClass = isIncome ? 'pos' : (isTransfer ? 'transfer' : 'neg');
        var sign = isIncome ? '+' : (isTransfer ? '⇄ ' : '-');
        var catName = t.category || (isTransfer ? 'Μεταφορά' : 'Γενικά');

        html +=
          '<div class="cf-tx-card" onclick="if(typeof openEditTransactionModal===\'function\'){closeModal(\'cash-flow-calendar-modal\');openEditTransactionModal(\'' + t.id + '\');}">' +
            '<div class="cf-tx-icon ' + amtClass + '">' +
              '<i class="fa-solid ' + (isIncome ? 'fa-arrow-down' : (isTransfer ? 'fa-right-left' : 'fa-arrow-up')) + '"></i>' +
            '</div>' +
            '<div class="cf-tx-info">' +
              '<div class="cf-tx-title">' + (t.note || catName) + '</div>' +
              '<div class="cf-tx-cat">' + catName + '</div>' +
            '</div>' +
            '<div class="cf-tx-amount ' + amtClass + '">' + sign + formatMoney(t.amount, t.currency) + '</div>' +
          '</div>';
      });
    }

    drawerEl.innerHTML = html;
  }

  /**
   * 1-Tap Quick-Pay scheduled bill from calendar
   */
  function quickPayCalendarBill(templateId, dateStr) {
    triggerHaptic('success');
    var s = getActiveAppState();
    var tpl = (s.recurringTemplates || []).find(function (t) { return String(t.id) === String(templateId); });
    if (!tpl) return;

    if (typeof window !== 'undefined' && typeof window.quickPaySubscription === 'function') {
      window.quickPaySubscription(templateId);
    } else {
      // Fallback transaction creation
      var newTx = {
        id: (typeof window !== 'undefined' && typeof window.generateUUID === 'function') ? window.generateUUID() : ('tx_' + Date.now()),
        type: 'expense',
        amount: parseFloat(tpl.amount) || 0,
        category: tpl.category || 'Λογαριασμοί',
        note: tpl.note || 'Πάγια Υποχρέωση',
        date: dateStr || new Date().toISOString().split('T')[0],
        recurring_template_id: tpl.id,
        is_recurring: true
      };
      if (typeof window !== 'undefined' && typeof window.saveTransactionOffline === 'function') {
        window.saveTransactionOffline(newTx);
      }
    }

    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(s.lang === 'el' ? '✓ Η πληρωμή καταχωρήθηκε επιτυχώς!' : '✓ Payment logged successfully!', 'success');
    }

    setTimeout(function () {
      renderCashFlowCalendar(_viewYear, _viewMonth);
    }, 200);
  }

  function navCashFlowMonth(direction) {
    triggerHaptic('light');
    _viewMonth += direction;
    if (_viewMonth < 0) {
      _viewMonth = 11;
      _viewYear--;
    } else if (_viewMonth > 11) {
      _viewMonth = 0;
      _viewYear++;
    }
    renderCashFlowCalendar(_viewYear, _viewMonth);
  }

  function openCashFlowCalendarModal(targetYear, targetMonth) {
    triggerHaptic('medium');
    var now = new Date();
    _viewYear = (typeof targetYear === 'number') ? targetYear : now.getFullYear();
    _viewMonth = (typeof targetMonth === 'number') ? targetMonth : now.getMonth();

    if (typeof window !== 'undefined' && typeof window.openModal === 'function') {
      window.openModal('cash-flow-calendar-modal');
    } else {
      var m = document.getElementById('cash-flow-calendar-modal');
      if (m) m.classList.add('active');
    }

    try {
      renderCashFlowCalendar(_viewYear, _viewMonth);
    } catch (err) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[CashFlowCalendar] Error rendering calendar:', err);
      }
    }
  }

  function closeCashFlowCalendarModal() {
    triggerHaptic('light');
    if (typeof window !== 'undefined' && typeof window.closeModal === 'function') {
      window.closeModal('cash-flow-calendar-modal');
    } else {
      var m = document.getElementById('cash-flow-calendar-modal');
      if (m) m.classList.remove('active');
    }
  }

  return {
    getMonthCashFlowData: getMonthCashFlowData,
    renderCashFlowCalendar: renderCashFlowCalendar,
    selectCashFlowDay: selectCashFlowDay,
    renderCashFlowDayDrawer: renderCashFlowDayDrawer,
    quickPayCalendarBill: quickPayCalendarBill,
    navCashFlowMonth: navCashFlowMonth,
    openCashFlowCalendarModal: openCashFlowCalendarModal,
    closeCashFlowCalendarModal: closeCashFlowCalendarModal,
    getMondayFirstWeekday: getMondayFirstWeekday,
    getDaysInMonth: getDaysInMonth
  };
});
