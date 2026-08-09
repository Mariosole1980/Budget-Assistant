/* ============================================================ */
/* BUDGET ASSISTANT — DESKTOP WEB UI (web-ui.js)                 */
/* ============================================================ */
/* Desktop/PWA UI layer for the WEB version only.                */
/*                                                               */
/* SAFETY: All entry points are guarded by `html.web-mode` so    */
/* the Android/iOS native app (Capacitor) is NEVER affected.     */
/* `html.web-mode` is added by index.html only when NOT running  */
/* inside Capacitor.                                             */
/*                                                               */
/* This file is loaded with `defer` AFTER app.js (see index.html) */
/* and is invoked by a single hook line at the end of initApp(). */
/* ============================================================ */

(function () {
    'use strict';

    // Guard: only run on the web (non-native) platform.
    function isWebMode() {
        return document.documentElement && document.documentElement.classList.contains('web-mode');
    }

    // Localize the dynamically-injected "New Transaction" buttons using the
    // fab_add_transaction translation key (kept in sync with the current lang).
    function localizeAddButton(btn) {
        var span = btn.querySelector('span[data-i18n="fab_add_transaction"]');
        if (!span) return;
        var lang = (window.state && window.state.lang) || 'el';
        var dict = (window.TRANSLATIONS && window.TRANSLATIONS[lang]) || {};
        span.textContent = dict.fab_add_transaction || (lang === 'en' ? 'Add Transaction' : 'Προσθήκη Συναλλαγής');
    }

    // ------------------------------------------------------------
    // Step 2: Desktop sidebar brand header + "Νέα Κίνηση" button.
    // Injected into the existing .bottom-nav (which desktop.css turns
    // into a left sidebar). Reuses the existing nav-item click logic
    // (data-tab / switchTab) so no duplicate navigation wiring.
    // ------------------------------------------------------------
    function initDesktopSidebar() {
        var nav = document.querySelector('.bottom-nav');
        if (!nav) return;

        // Avoid double-injection if initDesktopUI runs more than once.
        if (nav.querySelector('.desktop-sidebar-brand')) return;

        // Brand header (logo + app name)
        var brand = document.createElement('div');
        brand.className = 'desktop-sidebar-brand';
        brand.innerHTML =
            '<div class="desktop-brand-logo">' +
            '  <i class="fa-solid fa-wallet"></i>' +
            '</div>' +
            '<div class="desktop-brand-text">' +
            '  <span class="desktop-brand-name">Budget Assistant</span>' +
            '</div>';
        nav.insertBefore(brand, nav.firstChild);

        // "New Transaction" primary action button (localized via fab_add_transaction key)
        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'desktop-sidebar-add';
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i><span data-i18n="fab_add_transaction"></span>';
        addBtn.addEventListener('click', function () {
            if (typeof window.openAddTransactionModal === 'function') {
                window.openAddTransactionModal();
            }
        });
        nav.insertBefore(addBtn, brand.nextSibling);
        localizeAddButton(addBtn);
    }

    // ------------------------------------------------------------
    // Step 2: Desktop topbar "Νέα Κίνηση" button.
    // Injected into the existing .app-header (which desktop.css turns
    // into the top bar). Reuses openAddTransactionModal().
    // ------------------------------------------------------------
    function initDesktopTopbar() {
        var header = document.querySelector('.app-header');
        if (!header) return;

        if (header.querySelector('.desktop-topbar-add')) return;

        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'desktop-topbar-add';
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i><span data-i18n="fab_add_transaction"></span>';
        addBtn.addEventListener('click', function () {
            if (typeof window.openAddTransactionModal === 'function') {
                window.openAddTransactionModal();
            }
        });

        var actions = header.querySelector('.header-actions');
        if (actions) {
            actions.insertBefore(addBtn, actions.firstChild);
        } else {
            header.appendChild(addBtn);
        }
        localizeAddButton(addBtn);
    }

    // ------------------------------------------------------------
    // Step 3: Keyboard shortcuts (desktop only).
    //   N        → New transaction
    //   Escape   → Close any open modal / sheet
    //   /        → Focus global search (when a search field exists)
    //   ← / →    → Navigate between tabs
    // ------------------------------------------------------------
    function initKeyboardShortcuts() {
        if (document.documentElement.classList.contains('desktop-shortcuts-ready')) return;
        document.documentElement.classList.add('desktop-shortcuts-ready');

        var TAB_ORDER = ['trans', 'stats', 'accounts', 'more'];

        // Ignore shortcuts while the user is typing in a field.
        function isTypingTarget(e) {
            var t = e.target;
            if (!t) return false;
            var tag = t.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
                t.isContentEditable === true;
        }

        document.addEventListener('keydown', function (e) {
            // Only active in web-mode (defensive; listener is only added in web-mode).
            if (!isWebMode()) return;

            // Don't hijack keys while typing (except Escape to close modals).
            if (isTypingTarget(e) && e.key !== 'Escape') return;

            // N → New transaction
            if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                if (typeof window.openAddTransactionModal === 'function') {
                    window.openAddTransactionModal();
                }
                return;
            }

            // Escape → close modals / sheets
            if (e.key === 'Escape') {
                if (typeof window.forceCloseAllModals === 'function') {
                    window.forceCloseAllModals();
                }
                return;
            }

            // / → focus global search (if present in a future phase)
            if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                var search = document.querySelector('.desktop-global-search input, #desktop-search-input');
                if (search) {
                    e.preventDefault();
                    search.focus();
                }
                return;
            }

            // ← / → → tab navigation (only when not typing)
            if (isTypingTarget(e)) return;
            if (e.altKey || e.ctrlKey || e.metaKey) return;

            var currentIdx = TAB_ORDER.indexOf(window.state && window.state.activeTab);
            if (currentIdx === -1) return;

            if (e.key === 'ArrowRight') {
                var next = TAB_ORDER[(currentIdx + 1) % TAB_ORDER.length];
                if (typeof window.switchTab === 'function') {
                    e.preventDefault();
                    window.switchTab(next);
                }
            } else if (e.key === 'ArrowLeft') {
                var prev = TAB_ORDER[(currentIdx - 1 + TAB_ORDER.length) % TAB_ORDER.length];
                if (typeof window.switchTab === 'function') {
                    e.preventDefault();
                    window.switchTab(prev);
                }
            }
        });
    }

    // ------------------------------------------------------------
    // Stats Summary (desktop-only).
    //
    // The former Dashboard content (KPI cards + recent transactions)
    // now lives at the top of the Στατιστικά (Stats) tab, so the
    // redundant "Dashboard" nav item/screen were removed. This
    // function populates that summary whenever the stats tab renders.
    // It is web-mode gated and hidden on mobile via desktop.css.
    // ------------------------------------------------------------

    function sumCurrencySymbol() {
        var code = (typeof window.getDisplayCurrency === 'function')
            ? window.getDisplayCurrency()
            : 'EUR';
        var map = { 'EUR': '€', 'USD': '$', 'GBP': '£', 'JPY': '¥', 'CHF': 'CHF' };
        return map[code] || (code || '€');
    }

    function sumFmt(val) {
        if (typeof window.formatCurrency === 'function') {
            return window.formatCurrency(val);
        }
        return (parseFloat(val) || 0).toFixed(2);
    }

    function sumMonthKey(date) {
        var d = date ? new Date(date) : new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    function sumSetText(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    // Populate the KPI cards + recent transactions in the stats summary.
    function renderStatsSummary() {
        var summary = document.getElementById('stats-summary');
        if (!summary) return;

        var state = window.state || {};
        var transactions = (typeof window.getActiveTransactions === 'function')
            ? window.getActiveTransactions()
            : (state.transactions || []);
        var accounts = state.accounts || [];
        var symbol = sumCurrencySymbol();

        // ---- KPI: Net worth ----
        var netWorth = 0;
        if (typeof window.computeNetWorth === 'function') {
            netWorth = window.computeNetWorth();
        } else {
            accounts.forEach(function (a) {
                netWorth += (parseFloat(a.balance) || 0);
            });
        }
        sumSetText('sum-net-worth', symbol + ' ' + sumFmt(netWorth));
        sumSetText('sum-net-worth-sub', accounts.length + ' ' + (state.lang === 'en' ? 'accounts' : 'λογαριασμοί'));

        // ---- KPI: Current month income / expense / savings ----
        var now = new Date();
        var curKey = sumMonthKey(now);
        var monthIncome = 0, monthExpense = 0;
        transactions.forEach(function (t) {
            var key = sumMonthKey(t.date);
            if (key !== curKey) return;
            var amt = 0;
            if (typeof window.CurrencyService !== 'undefined' && window.CurrencyService.toBase) {
                amt = window.CurrencyService.toBase(t) || 0;
            } else {
                amt = parseFloat(t.amount) || 0;
            }
            if (t.type === 'income') monthIncome += amt;
            else if (t.type === 'expense') monthExpense += amt;
        });
        var monthSavings = monthIncome - monthExpense;

        sumSetText('sum-month-income', symbol + ' ' + sumFmt(monthIncome));
        sumSetText('sum-month-expense', symbol + ' ' + sumFmt(monthExpense));
        sumSetText('sum-month-savings', symbol + ' ' + sumFmt(monthSavings));

        var monthName = (state.lang === 'en')
            ? now.toLocaleDateString('en-US', { month: 'long' })
            : now.toLocaleDateString('el-GR', { month: 'long' });
        sumSetText('sum-month-income-sub', monthName);
        sumSetText('sum-month-expense-sub', monthName);
        sumSetText('sum-month-savings-sub', monthName);

        // ---- Recent transactions (last 6) ----
        var recent = transactions.slice().sort(function (a, b) {
            var ta = (typeof window.getTransactionTime === 'function') ? window.getTransactionTime(a) : 0;
            var tb = (typeof window.getTransactionTime === 'function') ? window.getTransactionTime(b) : 0;
            return tb - ta;
        }).slice(0, 6);
        renderSummaryRecent(recent, symbol);
    }

    function renderSummaryRecent(recent, symbol) {
        var container = document.getElementById('sum-recent-list');
        if (!container) return;
        if (!recent.length) {
            container.innerHTML = '<div class="stats-summary-empty">' +
                (window.state && window.state.lang === 'en' ? 'No transactions yet.' : 'Δεν υπάρχουν ακόμη κινήσεις.') +
                '</div>';
            return;
        }
        var html = '';
        recent.forEach(function (t) {
            var cat = (typeof window.getCategoryInfo === 'function')
                ? window.getCategoryInfo(t.category, t.type)
                : { icon: '💸', color: '#78909c' };
            var icon = cat.icon || '💸';
            var color = cat.color || '#78909c';
            var catName = (typeof window.getCategoryDisplayName === 'function')
                ? window.getCategoryDisplayName(t.category)
                : (t.category || '');
            var amt = 0;
            if (typeof window.CurrencyService !== 'undefined' && window.CurrencyService.toBase) {
                amt = window.CurrencyService.toBase(t) || 0;
            } else {
                amt = parseFloat(t.amount) || 0;
            }
            var sign = (t.type === 'income') ? '+' : (t.type === 'expense' ? '-' : '');
            var cls = (t.type === 'income') ? 'sum-income' : (t.type === 'expense' ? 'sum-expense' : 'sum-transfer');
            var dateStr = '';
            if (t.date) {
                var d = new Date(t.date);
                dateStr = (window.state && window.state.lang === 'en')
                    ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
                    : d.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' });
            }
            html +=
                '<div class="stats-summary-recent-item">' +
                '  <div class="stats-summary-recent-icon" style="background:' + color + '22;color:' + color + ';">' + icon + '</div>' +
                '  <div class="stats-summary-recent-info">' +
                '    <div class="stats-summary-recent-name">' + escapeHtml(catName || (t.note || '—')) + '</div>' +
                '    <div class="stats-summary-recent-date">' + escapeHtml(dateStr) + '</div>' +
                '  </div>' +
                '  <div class="stats-summary-recent-amount ' + cls + '">' + sign + symbol + ' ' + sumFmt(amt) + '</div>' +
                '</div>';
        });
        container.innerHTML = html;
    }

    // ------------------------------------------------------------
    // Hook into renderStatsTab so the desktop summary is refreshed
    // whenever the stats tab re-renders (period change, data change,
    // tab switch, etc.). Web-mode only; no-op elsewhere.
    // ------------------------------------------------------------
    function initStatsSummaryHook() {
        if (window.__desktopStatsSummaryHooked) return;
        window.__desktopStatsSummaryHooked = true;

        var original = window.renderStatsTab;
        if (typeof original !== 'function') return;

        window.renderStatsTab = function (skipChart) {
            var result = original(skipChart);
            if (isWebMode()) {
                try {
                    renderStatsSummary();
                } catch (e) {
                    console.error('[DesktopUI] renderStatsSummary failed:', e);
                }
            }
            return result;
        };
    }

    // ------------------------------------------------------------
    // Main entry point — called from app.js initApp() hook.
    // ------------------------------------------------------------
    function initDesktopUI() {
        if (!isWebMode()) return;

        // Phase 1 (foundation): P0 fixes handled entirely in desktop.css.
        // Phase 2 (navigation): sidebar brand + topbar add button.
        initDesktopSidebar();
        initDesktopTopbar();

        // Phase 3 (keyboard): shortcuts.
        initKeyboardShortcuts();

        // Stats summary: populate the KPI/recent section in Στατιστικά
        // and keep it in sync with every stats re-render.
        initStatsSummaryHook();
        renderStatsSummary();

        // Mark the desktop UI as initialized (useful for debugging).
        document.documentElement.classList.add('desktop-ui-ready');
    }

    // Expose globally so app.js can call it via the hook line.
    window.initDesktopUI = initDesktopUI;

    // ------------------------------------------------------------
    // Auto-init fallback: if app.js's hook line is not present
    // (e.g. older cached app.js), still initialize on DOM ready.
    // This keeps the desktop layer self-sufficient and safe.
    // ------------------------------------------------------------
    function autoInit() {
        if (isWebMode() && typeof window.initDesktopUI === 'function') {
            // Defer slightly so app.js has finished its own init.
            setTimeout(function () {
                window.initDesktopUI();
            }, 0);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }
})();
