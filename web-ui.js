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

    var TAB_TITLES = {
        'trans': {
            icon: 'fa-receipt',
            el: 'Κινήσεις',
            en: 'Transactions'
        },
        'stats': {
            icon: 'fa-chart-pie',
            el: 'Στατιστικά & Ανάλυση',
            en: 'Statistics & Analytics'
        },
        'accounts': {
            icon: 'fa-credit-card',
            el: 'Λογαριασμοί & Πορτοφόλια',
            en: 'Accounts & Wallets'
        },
        'more': {
            icon: 'fa-sliders',
            el: 'Περισσότερα & Ρυθμίσεις',
            en: 'More & Settings'
        }
    };

    var LOGO_IMG_HTML = '<img src="logo-mark.png" id="header-wallet-icon" class="header-app-logo" alt="Budget Assistant Logo">';

    function updateDesktopTopbarTitle(tabKey) {
        if (!isWebMode()) return;
        var tab = tabKey || (window.state && window.state.activeTab) || 'trans';
        var info = TAB_TITLES[tab] || TAB_TITLES['trans'];
        var lang = (window.state && window.state.lang) || 'el';
        var text = info[lang] || info['el'];

        var heading = document.getElementById('app-heading-title');
        if (heading) {
            if (window.innerWidth >= 768) {
                heading.innerHTML =
                    '<div class="desktop-header-title-badge">' +
                    '  <i class="fa-solid ' + info.icon + '"></i>' +
                    '</div>' +
                    '<span class="desktop-header-title-text">' + text + '</span>';
            } else {
                heading.innerHTML =
                    LOGO_IMG_HTML +
                    '<span class="header-title-text">Budget Assistant</span>';
            }
        }
    }

    // ------------------------------------------------------------
    // Step 2: Desktop sidebar brand header & User Profile Card
    // ------------------------------------------------------------
    function initDesktopSidebar() {
        var nav = document.querySelector('.bottom-nav');
        if (!nav) return;

        // Avoid double-injection
        if (nav.querySelector('.desktop-sidebar-brand')) return;

        // Brand header (logo + app name + desktop badge)
        var brand = document.createElement('div');
        brand.className = 'desktop-sidebar-brand';
        brand.innerHTML =
            '<div class="desktop-brand-logo">' +
            LOGO_IMG_HTML +
            '</div>' +
            '<div class="desktop-brand-text">' +
            '  <span class="desktop-brand-name">Budget Assistant</span>' +
            '  <span class="desktop-brand-badge">WEB PRO</span>' +
            '</div>';
        nav.insertBefore(brand, nav.firstChild);

        // Sidebar User Profile widget at bottom
        var userCard = document.createElement('div');
        userCard.className = 'desktop-sidebar-user-card';
        userCard.setAttribute('title', 'Προφίλ & Ρυθμίσεις');
        userCard.innerHTML =
            '<div class="desktop-user-avatar" id="desktop-sidebar-avatar">' +
            '  <i class="fa-solid fa-user"></i>' +
            '</div>' +
            '<div class="desktop-user-info">' +
            '  <span class="desktop-user-name" id="desktop-sidebar-name">Mario</span>' +
            '  <span class="desktop-user-status" id="desktop-sidebar-status"><i class="fa-solid fa-crown" style="color:#ffc107;font-size:10px;"></i> Premium</span>' +
            '</div>' +
            '<i class="fa-solid fa-chevron-right desktop-user-chevron"></i>';

        userCard.addEventListener('click', function () {
            if (window.state && (window.state.guestMode || !window.state.currentUser)) {
                if (typeof window.showAuthOverlay === 'function') {
                    window.showAuthOverlay();
                    return;
                }
            }
            if (typeof window.openProfileSettingsModal === 'function') {
                window.openProfileSettingsModal();
            } else if (typeof window.switchTab === 'function') {
                window.switchTab('more');
            }
        });

        nav.appendChild(userCard);
        updateDesktopSidebarUser();
    }

    function updateDesktopSidebarUser() {
        if (!isWebMode()) return;
        var nameEl = document.getElementById('desktop-sidebar-name');
        var avatarEl = document.getElementById('desktop-sidebar-avatar');
        var statusEl = document.getElementById('desktop-sidebar-status');

        var state = window.state || {};
        var user = state.currentUser;
        var isPrem = (typeof window.isPremium === 'function') ? window.isPremium() : true;

        if (nameEl) {
            var profileName = (state.userProfile && (state.userProfile.display_name || state.userProfile.name)) ||
                              localStorage.getItem('profile_name') ||
                              (user ? (user.user_metadata && user.user_metadata.full_name) : null);
            if (!profileName && user && user.email) {
                profileName = user.email.split('@')[0];
            }
            nameEl.textContent = profileName || (state.lang === 'en' ? 'Guest' : 'Επισκέπτης');
        }

        if (avatarEl) {
            var avatarUrl = localStorage.getItem('profile_avatar_url') || (state.userProfile && state.userProfile.avatar_url);
            if (avatarUrl) {
                avatarEl.innerHTML = '<img src="' + avatarUrl + '" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
            } else {
                var initial = (nameEl && nameEl.textContent) ? nameEl.textContent.trim().charAt(0).toUpperCase() : 'M';
                avatarEl.textContent = initial || 'M';
            }
        }

        if (statusEl) {
            var hasFamily = Boolean(state.familyGroup || (state.userProfile && state.userProfile.family_id) || (user && user.family_id));
            var currentMode = state.activeAccountMode || (hasFamily ? 'family' : 'personal');
            var isFamilyActive = (currentMode === 'family' && hasFamily);
            var planLabel = isPrem ? 'PRO' : 'Free';
            var scopeLabel = isFamilyActive ? (state.lang === 'en' ? 'Family' : 'Οικογένεια') : (state.lang === 'en' ? 'Personal' : 'Ατομικό');
            statusEl.innerHTML = (isPrem ? '<i class="fa-solid fa-crown" style="color:#ffc107;font-size:10px;margin-right:3px;"></i>' : '') + planLabel + ' • ' + scopeLabel;
        }
    }
    window.updateDesktopSidebarUser = updateDesktopSidebarUser;

    // ------------------------------------------------------------
    // Step 2: Desktop topbar (Dynamic Breadcrumb, Search, Add Button)
    // ------------------------------------------------------------
    function initDesktopTopbar() {
        var header = document.querySelector('.app-header');
        if (!header) return;

        // Set initial dynamic section title
        updateDesktopTopbarTitle(window.state && window.state.activeTab);

        var actions = header.querySelector('.header-actions');
        if (!actions) return;

        // Desktop Global Search Trigger Chip
        if (!header.querySelector('.desktop-topbar-search')) {
            var searchChip = document.createElement('button');
            searchChip.type = 'button';
            searchChip.className = 'desktop-topbar-search';
            searchChip.innerHTML =
                '<i class="fa-solid fa-magnifying-glass"></i>' +
                '<span data-i18n="search_placeholder">' + (window.state && window.state.lang === 'en' ? 'Search in expenses, accounts or dates...' : 'Αναζήτηση σε έξοδα, λογαριασμούς ή ημερομηνία...') + '</span>' +
                '<kbd>/</kbd>';
            searchChip.addEventListener('click', function () {
                if (typeof window.openSearchOverlay === 'function') {
                    window.openSearchOverlay();
                }
            });
            actions.insertBefore(searchChip, actions.firstChild);
        }

        // Single Primary "New Transaction" Button in Header
        if (!header.querySelector('.desktop-topbar-add')) {
            var addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'desktop-topbar-add';
            addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> <span data-i18n="fab_add_transaction">' + (window.state && window.state.lang === 'en' ? 'Add Transaction' : 'Προσθήκη Συναλλαγής') + '</span>';
            addBtn.addEventListener('click', function () {
                if (typeof window.openAddTransactionModal === 'function') {
                    window.openAddTransactionModal();
                }
            });
            actions.insertBefore(addBtn, actions.firstChild.nextSibling);
            localizeAddButton(addBtn);
        }

        // Quick Notepad Header Trigger
        if (!header.querySelector('.desktop-topbar-note')) {
            var noteBtn = document.createElement('button');
            noteBtn.type = 'button';
            noteBtn.className = 'icon-btn desktop-topbar-note';
            noteBtn.setAttribute('title', window.state && window.state.lang === 'en' ? 'Notepad & Reminders' : 'Σημειωματάριο & Υπενθυμίσεις');
            noteBtn.innerHTML = '<i class="fa-solid fa-note-sticky"></i>';
            noteBtn.addEventListener('click', function () {
                if (typeof window.openNotesManagerModal === 'function') {
                    window.openNotesManagerModal();
                }
            });
            actions.appendChild(noteBtn);
        }
    }

    // ------------------------------------------------------------
    // Step 3: Keyboard shortcuts (desktop only).
    //   N        → New transaction
    //   Escape   → Close any open modal / sheet
    //   /        → Focus global search
    //   ← / →    → Navigate between tabs
    // ------------------------------------------------------------
    function initKeyboardShortcuts() {
        if (document.documentElement.classList.contains('desktop-shortcuts-ready')) return;
        document.documentElement.classList.add('desktop-shortcuts-ready');

        var TAB_ORDER = ['trans', 'stats', 'accounts', 'more'];

        function isTypingTarget(e) {
            var t = e.target;
            if (!t) return false;
            var tag = t.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
                t.isContentEditable === true;
        }

        document.addEventListener('keydown', function (e) {
            if (!isWebMode()) return;

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

            // / → open search
            if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                if (typeof window.openSearchOverlay === 'function') {
                    window.openSearchOverlay();
                }
                return;
            }

            // ← / → → tab navigation
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
    // Hook into switchTab to update the topbar title & sidebar
    // ------------------------------------------------------------
    function initTabSwitchHook() {
        if (window.__desktopTabSwitchHooked) return;
        window.__desktopTabSwitchHooked = true;

        var origSwitchTab = window.switchTab;
        if (typeof origSwitchTab === 'function') {
            window.switchTab = function (tab, instant) {
                var res = origSwitchTab(tab, instant);
                if (isWebMode()) {
                    updateDesktopTopbarTitle(tab);
                    updateDesktopSidebarUser();
                }
                return res;
            };
        }
    }

    // ------------------------------------------------------------
    // Stats Summary (desktop-only).
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

    function renderStatsSummary() {
        var summary = document.getElementById('stats-summary');
        if (!summary) return;

        var state = window.state || {};
        var transactions = (typeof window.getActiveTransactions === 'function')
            ? window.getActiveTransactions()
            : (state.transactions || []);
        var accounts = state.accounts || [];
        var symbol = sumCurrencySymbol();

        // Net worth
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

        // Income / Expense / Savings
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

        // Recent transactions (last 6)
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

        initDesktopSidebar();
        initDesktopTopbar();
        initKeyboardShortcuts();
        initTabSwitchHook();
        initStatsSummaryHook();
        renderStatsSummary();

        document.documentElement.classList.add('desktop-ui-ready');

        window.addEventListener('resize', function () {
            updateDesktopTopbarTitle();
        });
    }

    window.initDesktopUI = initDesktopUI;

    function autoInit() {
        if (isWebMode() && typeof window.initDesktopUI === 'function') {
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
