// ============================================================
// CURRENCY FORMATTING & SETTINGS VIEW SUBSYSTEM
// Autonomous UMD Module (Phase 18A Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
    var exports = factory();
    Object.assign(rootObj, exports);
    rootObj.CurrencyFormattingService = exports;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

// ============================================================
// SETTINGS AND LOCALIZATION HELPERS
// ============================================================
function getCurrencySymbol() {
  // When multi-currency is enabled, the display currency (if different from the
  // base currency) determines the symbol shown for aggregated/displayed amounts.
  const currency = getDisplayCurrency();
  // Use CurrencyService so ANY currency (not just EUR/USD/GBP/JPY) gets its
  // correct symbol. Fall back to the code itself if the symbol is unknown.
  if (typeof CurrencyService !== 'undefined' && typeof CurrencyService.getSymbol === 'function') {
    const sym = CurrencyService.getSymbol(currency);
    if (sym) return sym;
  }
  switch (currency) {
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'JPY': return '¥';
    case 'EUR':
    default:
      return '€';
  }
}

function updateCurrencySymbols() {
  const symbol = getCurrencySymbol();
  // Ensure the amount row has a currency symbol element. We inject it via JS
  // (rather than relying only on the HTML) so it also works on devices that
  // receive OTA updates, which only replace app.js/style.css and NOT index.html.
  const amountRow = document.getElementById('form-row-amount');
  if (amountRow) {
    const container = amountRow.querySelector('.form-row-value-container');
    const input = document.getElementById('trans-amount');
    if (container && input && !container.querySelector('.currency-symbol')) {
      const span = document.createElement('span');
      span.className = 'currency-symbol';
      span.style.fontSize = '18px';
      span.style.fontWeight = '600';
      span.style.color = 'var(--text-secondary, #9aa0b4)';
      container.insertBefore(span, input);
    }
  }
  // Update the amount row's currency symbol via updateAmountCurrencySymbol(),
  // which preserves the tappable class, the tap handlers AND the chevron icon.
  // Setting el.textContent directly here would wipe the chevron <i> element that
  // updateAmountCurrencySymbol() injects, leaving a bare symbol that no longer
  // looks tappable. Only fall back to plain text for OTHER .currency-symbol
  // elements (e.g. the "actual amount" correction symbol).
  const amountSymbol = amountRow ? amountRow.querySelector('.currency-symbol') : null;
  document.querySelectorAll('.currency-symbol').forEach(el => {
    if (el === amountSymbol) return; // handled by updateAmountCurrencySymbol()
    el.textContent = symbol;
  });
  if (amountSymbol) {
    updateAmountCurrencySymbol();
  }
}

// Updates the currency symbol in the amount row. The symbol is ALWAYS visible
// and tappable (opens the currency picker), so the user always knows in which
// currency they are entering the amount. A chevron hints that it is tappable.
function updateAmountCurrencySymbol() {
  const input = document.getElementById('trans-amount');
  const amountRow = document.getElementById('form-row-amount');
  if (!input || !amountRow) return;
  const container = amountRow.querySelector('.form-row-value-container');
  if (!container) return;
  let span = container.querySelector('.currency-symbol');
  if (!span) {
    span = document.createElement('span');
    span.className = 'currency-symbol currency-symbol-tappable';
    span.style.fontSize = '18px';
    span.style.fontWeight = '600';
    span.style.color = 'var(--text-secondary, #9aa0b4)';
    span.style.cursor = 'pointer';
    span.style.padding = '4px 6px';
    span.style.borderRadius = '8px';
    span.style.display = 'inline-flex';
    span.style.alignItems = 'center';
    span.style.gap = '3px';
    span.style.whiteSpace = 'nowrap';
    container.insertBefore(span, input);
  }
  // CRITICAL: updateCurrencySymbols() may have created the span with only the
  // 'currency-symbol' class (no 'currency-symbol-tappable'). Ensure the tappable
  // class is ALWAYS present so the capture-phase listener and routing handler
  // reliably match it. Without this, taps on the symbol fall through to the
  // parent and open the calculator instead of the currency picker.
  if (!span.classList.contains('currency-symbol-tappable')) {
    span.classList.add('currency-symbol-tappable');
  }
  // Ensure the symbol sits ABOVE the amount input so taps on it are never
  // swallowed by the input (which has onfocus="this.blur()"). On installed
  // devices the stale index.html may lay the input over the symbol area.
  span.style.position = 'relative';
  span.style.zIndex = '5';
  // Always (re)bind the tap handler so the symbol is reliably tappable even
  // when the span already exists in the HTML markup. Bind BOTH click and
  // pointerdown for maximum reliability on Android WebView.
  span.onclick = (e) => { e.stopPropagation(); e.preventDefault(); openCurrencyPickerModal(); };
  span.onpointerdown = (e) => { e.stopPropagation(); };
  // Use a FontAwesome chevron icon (not the text glyph ▾) so it renders
  // reliably BESIDE the currency symbol instead of wrapping below it.
  span.innerHTML = escapeHtml(getTransactionCurrencySymbol()) +
    ' <i class="fa-solid fa-chevron-down" style="font-size: 10px; color: var(--text-muted, #9aa0b4);"></i>';
  span.style.display = 'inline-flex';
  updateDualAmountDisplay();

  // The "actual amount" correction field is always in the base currency.
  const actualSymbol = document.getElementById('trans-actual-amount-symbol');
  if (actualSymbol) {
    const baseCurrency = localStorage.getItem('app_currency') || 'EUR';
    actualSymbol.textContent = CurrencyService.getSymbol(baseCurrency);
  }
}

// Returns the symbol for the currently selected transaction currency (multi-currency aware).
function getTransactionCurrencySymbol() {
  const code = getTransactionCurrency();
  const c = CurrencyService.getCurrency(code);
  return c ? c.symbol : getCurrencySymbol();
}

// Returns the currency code of a transaction, defaulting to the base currency.
function getTxCurrencyCode(tx) {
  return (tx && tx.currency) || localStorage.getItem('app_currency') || 'EUR';
}

// Returns a small reliability badge for a transaction's conversion status.
// Only shown when the transaction currency differs from the base currency.
function getReliabilityBadge(tx) {
  const baseCurrency = localStorage.getItem('app_currency') || 'EUR';
  const txCurrency = getTxCurrencyCode(tx);
  if (txCurrency === baseCurrency) return '';
  const status = CurrencyService.conversionStatus(tx);
  const lang = state.lang || 'el';
  if (status === 'manual') {
    return `<span class="fx-reliability-badge fx-manual" title="${lang === 'el' ? 'Χειροκίνητη ισοτιμία' : 'Manual rate'}">✍️</span>`;
  }
  if (status === 'estimate') {
    return `<span class="fx-reliability-badge fx-estimate" title="${lang === 'el' ? 'Εκτίμηση (cached ισοτιμία)' : 'Estimate (cached rate)'}">≈</span>`;
  }
  return '';
}

// Returns the currency code label shown next to a transaction amount when it
// differs from the base currency (e.g. "USD").
function getTxCurrencyLabel(tx) {
  const baseCurrency = localStorage.getItem('app_currency') || 'EUR';
  const txCurrency = getTxCurrencyCode(tx);
  if (txCurrency === baseCurrency) return '';
  return `<span class="fx-currency-label">${escapeHtml(txCurrency)}</span>`;
}

// Shows the base-currency equivalent of the entered amount below the amount row,
// when the transaction currency differs from the base currency (multi-currency).
function updateDualAmountDisplay() {
  const amountRow = document.getElementById('form-row-amount');
  if (!amountRow) return;
  const input = document.getElementById('trans-amount');
  if (!input) return;

  // Ensure the dual-amount element exists.
  let dual = amountRow.querySelector('.dual-amount');
  if (!dual) {
    dual = document.createElement('div');
    dual.className = 'dual-amount';
    dual.style.cssText = 'font-size: 12px; color: var(--text-muted, #9aa0b4); margin-top: 2px;';
    const container = amountRow.querySelector('.form-row-value-container');
    if (container) container.appendChild(dual);
  }

  const txCurrency = getTransactionCurrency();
  const baseCurrency = localStorage.getItem('app_currency') || 'EUR';
  const rawVal = String(input.value || '').trim();

  if (txCurrency === baseCurrency || rawVal === '') {
    dual.textContent = '';
    dual.style.display = 'none';
    return;
  }

  const amount = parseFloat(rawVal.replace(',', '.'));
  if (isNaN(amount)) {
    dual.textContent = '';
    dual.style.display = 'none';
    return;
  }

  const rate = CurrencyService.getRate(txCurrency, baseCurrency, document.getElementById('trans-date')?.value);
  if (rate == null || rate <= 0) {
    dual.textContent = state.lang === 'el' ? 'Ισοτιμία μη διαθέσιμη' : 'Rate unavailable';
    dual.style.display = 'block';
    return;
  }

  const baseAmount = CurrencyService.round(amount / rate, 2);
  const baseSymbol = CurrencyService.getSymbol(baseCurrency);
  dual.textContent = `≈ ${baseAmount.toLocaleString(state.lang === 'el' ? 'el-GR' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${baseSymbol} (1 ${txCurrency} = ${rate} ${baseSymbol})`;
  dual.style.display = 'block';
}

// ============================================================
// MULTI-CURRENCY: DISPLAY CURRENCY & NET WORTH (Phase 7)
// ============================================================

// Returns the display currency code. In the "Invisible Multi-Currency" model,
// the display currency concept is removed: all amounts are shown in the
// application currency (base currency). This always returns the base currency.
// Returns the display currency code per user (or fallback to device setting).
function getDisplayCurrency() {
  const userId = state.currentUser ? state.currentUser.id : null;
  const userDisplayCurrency = state.userProfile?.display_currency || state.userProfile?.preferred_currency;
  if (userDisplayCurrency) return userDisplayCurrency;
  if (userId) {
    const userStored = localStorage.getItem(`app_currency_${userId}`);
    if (userStored) return userStored;
  }
  return localStorage.getItem('app_currency') || 'EUR';
}

// Determines the source currency of aggregated values that were computed via
// CurrencyService.toBase(t) (e.g. FHS liquid balance, forecast savings).
function getTransactionsBaseCurrency(transactions) {
  const counts = {};
  let best = getDisplayCurrency();
  let bestCount = 0;
  (transactions || []).forEach(t => {
    const bc = t.base_currency || 'EUR';
    counts[bc] = (counts[bc] || 0) + 1;
    if (counts[bc] > bestCount) {
      bestCount = counts[bc];
      best = bc;
    }
  });
  return best;
}

// Converts an amount expressed in `fromCurrency` to the current display currency.
function displayAmountInDisplayCurrency(baseAmount, fromCurrency) {
  const displayCurrency = getDisplayCurrency();
  const sourceCurrency = fromCurrency || displayCurrency;
  if (sourceCurrency === displayCurrency) return baseAmount;
  const rate = CurrencyService.getRate(sourceCurrency, displayCurrency, new Date().toISOString().slice(0, 10));
  if (rate == null || rate <= 0) return null;
  return CurrencyService.round(baseAmount * rate, 2);
}

// Formats an amount for display in the active display currency.
function formatDisplayAmount(baseAmount, fromCurrency) {
  const displayVal = displayAmountInDisplayCurrency(baseAmount, fromCurrency);
  return formatCurrency(displayVal != null ? displayVal : baseAmount);
}

// Returns the account's balance converted to the current display currency.
function getAccountBalanceInBase(acc) {
  if (!acc) return 0;
  const balance = parseFloat(acc.balance) || 0;
  const baseCurrency = getDisplayCurrency();
  const accCurrency = acc.currency || baseCurrency;
  if (accCurrency === baseCurrency) return balance;
  const rate = CurrencyService.getRate(accCurrency, baseCurrency, new Date().toISOString().slice(0, 10));
  if (rate == null || rate <= 0) return balance; // Fall back to nominal balance if rate missing (never hide balance)
  return CurrencyService.round(balance / rate, 2);
}

// Computes the total net worth across all accounts in the display currency.
function computeNetWorth() {
  const accounts = state.accounts || [];
  if (accounts.length === 0) return 0;
  let total = 0;
  for (const acc of accounts) {
    const inBase = getAccountBalanceInBase(acc);
    total += (inBase || 0);
  }
  return CurrencyService.round(total, 2);
}

function changeMonthStartSetting(val) {
  localStorage.setItem('app_month_start', val);
  updateSettingsDisplay();
  updateUI();
}

function changeWeekStartSetting(val) {
  localStorage.setItem('app_week_start', val);
  updateSettingsDisplay();
  updateUI();
}

function changeCurrencySetting(val) {
  const userId = state.currentUser ? state.currentUser.id : null;
  if (userId) {
    localStorage.setItem(`app_currency_${userId}`, val);
  }
  localStorage.setItem('app_currency', val);

  if (state.userProfile) {
    state.userProfile.display_currency = val;
    state.userProfile.preferred_currency = val;
    // HARDENING (v1389): Guard against a non-thenable result from the Supabase
    // chain. If the bundled supabase client's .eq() ever returns a plain object
    // (e.g. due to a corrupted/older supabase.js or a version mismatch), calling
    // .then()/.catch() on it would throw "state.supabaseClient.from(...).update(...)
    // .eq(...).then is not a function" and could crash the app. Wrap the whole
    // chain in try/catch and only attach .then/.catch when the result is thenable.
    if (state.supabaseClient && userId) {
      try {
        const chain = state.supabaseClient
          .from('profiles')
          .update({ display_currency: val, base_currency: val })
          .eq('id', userId);
        if (chain && typeof chain.then === 'function') {
          chain.then(() => { }).catch(() => { });
        }
      } catch (e) {
        console.warn('[Currency] Failed to persist display currency to cloud:', e);
      }
    }
  }

  updateSettingsDisplay();
  updateUI();

  if (typeof CurrencyService !== 'undefined' && typeof CurrencyService.fetchTodayRates === 'function') {
    CurrencyService.fetchTodayRates(val).then((ok) => {
      if (ok && typeof recomputePendingAmountBase === 'function') {
        recomputePendingAmountBase();
      }
      updateUI();
    });
  }
}

// ============================================================
// APP SECURITY & AUTO-LOCK SUBSYSTEM (changeAutoLockSetting, _getAutoLockDelayMs, _recordUserActivity, _resetAutoLockTimer, _triggerAutoLock, _initAutoLock)
// Extracted to js/securityLockService.js (Phase 12A Architectural Extraction)
// ============================================================

// Populates the "Νόμισμα εφαρμογής" select in settings with ALL currencies
// (150+), not just the 4 hardcoded ones. Called once on init.
function populateCurrencySelect() {
  const select = document.getElementById('settings-currency');
  if (!select) return;
  const current = localStorage.getItem('app_currency') || 'EUR';
  const currencies = (window.CurrencyService && typeof window.CurrencyService.getCurrencies === 'function')
    ? window.CurrencyService.getCurrencies()
    : [];
  if (!Array.isArray(currencies) || currencies.length === 0) return;
  select.innerHTML = '';
  currencies.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = c.code + ' (' + (c.symbol || '') + ')';
    if (c.code === current) opt.selected = true;
    select.appendChild(opt);
  });
}

function updateSettingsDisplay() {
  // Defensive: ensure CurrencyService is complete (has isEnabled) before use.
  // The bootstrap guard normally guarantees this, but a stale cached
  // js/CurrencyService.js could clobber it after boot. Never crash here.
  if (typeof CurrencyService === 'undefined' || typeof CurrencyService.isEnabled !== 'function') {
    if (typeof window !== 'undefined' && window.CurrencyService && typeof window.CurrencyService.isEnabled === 'function') {
      CurrencyService = window.CurrencyService;
    }
  }
  const monthStart = localStorage.getItem('app_month_start') || '1';
  const weekStart = localStorage.getItem('app_week_start') || '1';
  const currency = localStorage.getItem('app_currency') || 'EUR';
  const theme = localStorage.getItem('app_theme') || 'dark';

  const monthDisplay = document.getElementById('settings-month-start-display');
  const weekDisplay = document.getElementById('settings-week-start-display');
  const currencyDisplay = document.getElementById('settings-currency-display');
  const themeDisplay = document.getElementById('settings-theme-display');

  if (monthDisplay) {
    monthDisplay.textContent = monthStart;
  }
  if (weekDisplay) {
    const weekLabels = {
      '1': state.lang === 'el' ? 'Δευτέρα' : 'Monday',
      '0': state.lang === 'el' ? 'Κυριακή' : 'Sunday',
      '6': state.lang === 'el' ? 'Σάββατο' : 'Saturday'
    };
    weekDisplay.textContent = weekLabels[weekStart] || weekStart;
  }
  if (currencyDisplay) {
    const currencyObj = CurrencyService.getCurrency(currency);
    currencyDisplay.textContent = currencyObj
      ? currencyObj.code + ' (' + (currencyObj.symbol || '') + ')'
      : currency;
  }

  if (themeDisplay) {
    const themeLabels = {
      'dark': 'Premium Dark',
      'oled': 'OLED Black',
      'light': 'Classic Light',
      'pink': 'Blossom Pink',
      'sakura': 'Sakura Pastel',
      'rosegold': 'Rose Gold',
      'emerald': 'Emerald Forest',
      'ocean': 'Ocean Breeze',
      'cyber': 'Cyber Neon'
    };
    themeDisplay.textContent = themeLabels[theme] || theme;
  }
  if (themeDisplay && themeDisplay.parentElement) {
    themeDisplay.parentElement.style.background = "rgba(var(--accent-rgb, 124, 106, 247), 0.12)";
    themeDisplay.parentElement.style.border = "1px solid rgba(var(--accent-rgb, 124, 106, 247), 0.3)";
    themeDisplay.style.color = "var(--accent)";
    const icon = themeDisplay.parentElement.querySelector("i");
    if (icon) icon.style.color = "var(--accent)";
  }
  if (currencyDisplay && currencyDisplay.parentElement) {
    currencyDisplay.parentElement.style.background = "rgba(var(--accent-rgb, 124, 106, 247), 0.12)";
    currencyDisplay.parentElement.style.border = "1px solid rgba(var(--accent-rgb, 124, 106, 247), 0.3)";
    currencyDisplay.style.color = "var(--accent)";
    const icon = currencyDisplay.parentElement.querySelector("i");
    if (icon) icon.style.color = "var(--accent)";
  }

  const autoLockDisplay = document.getElementById('settings-auto-lock-display');
  if (autoLockDisplay) {
    const autoLockDelay = localStorage.getItem('settings_auto_lock_delay') || 'disabled';
    const autoLockLabels = {
      'disabled': state.lang === 'el' ? 'Απενεργοποιημένο' : 'Disabled',
      'immediate': state.lang === 'el' ? 'Άμεσα' : 'Immediately',
      '0': state.lang === 'el' ? 'Άμεσα' : 'Immediately',
      '1': state.lang === 'el' ? '1 λεπτό' : '1 minute',
      '5': state.lang === 'el' ? '5 λεπτά' : '5 minutes',
      '10': state.lang === 'el' ? '10 λεπτά' : '10 minutes'
    };
    autoLockDisplay.textContent = autoLockLabels[autoLockDelay] || autoLockDelay;
    const parentBadge = autoLockDisplay.parentElement;
    const chevron = parentBadge ? parentBadge.querySelector('i') : null;
    if (parentBadge) {
      if (autoLockDelay === 'disabled') {
        parentBadge.style.background = 'rgba(239,68,68,0.10)';
        parentBadge.style.border = '1px solid rgba(239,68,68,0.25)';
        autoLockDisplay.style.color = '#ef4444';
        if (chevron) chevron.style.color = '#ef4444';
      } else {
        parentBadge.style.background = 'rgba(var(--accent-rgb, 46, 196, 182), 0.15)';
        parentBadge.style.border = '1px solid rgba(var(--accent-rgb, 46, 196, 182), 0.35)';
        autoLockDisplay.style.color = 'var(--accent)';
        if (chevron) chevron.style.color = 'var(--accent)';
      }
    }
  }

  const fontSizeDisplay = document.getElementById('settings-font-size-display');
  if (fontSizeDisplay) {
    const fontSize = localStorage.getItem('app_font_size') || 'normal';
    const fontSizeLabels = {
      'small': state.lang === 'el' ? 'Μικρό' : 'Small',
      'normal': state.lang === 'el' ? 'Κανονικό' : 'Normal',
      'large': state.lang === 'el' ? 'Μεγάλο' : 'Large',
      'xlarge': state.lang === 'el' ? 'Πολύ Μεγάλο' : 'Extra Large'
    };
    fontSizeDisplay.textContent = fontSizeLabels[fontSize] || fontSize;
  }
}

function openSettingsPicker(type) {
  if (type === 'currency') {
    openCurrencyPickerModal({ target: 'settings' });
    return;
  }

  const titleEl = document.getElementById('settings-picker-title');
  const container = document.getElementById('settings-picker-list');
  if (!titleEl || !container) return;

  container.innerHTML = '';
  container.className = 'settings-picker-list';

  if (type === 'theme') {
    titleEl.textContent = state.lang === 'el' ? 'Θέμα Εμφάνισης' : 'Appearance Theme';
    container.classList.add('theme-picker-grid');

    const currentVal = localStorage.getItem('app_theme') || 'dark';
    const themes = [
      {
        id: 'dark',
        title: 'Premium Dark',
        desc: state.lang === 'el' ? 'Σκούρο μωβ & γκρι' : 'Dark purple & charcoal',
        colors: ['#181b22', '#38bdf8', '#222731']
      },
      {
        id: 'oled',
        title: 'OLED Black',
        desc: state.lang === 'el' ? 'Απόλυτο μαύρο (OLED)' : 'Pure pitch black',
        colors: ['#000000', '#2ec4b6', '#0d0d0d']
      },
      {
        id: 'light',
        title: 'Classic Light',
        desc: state.lang === 'el' ? 'Καθαρό φωτεινό' : 'Clean & bright light',
        colors: ['#f4f6f9', '#2ec4b6', '#ffffff']
      },
      {
        id: 'emerald',
        title: 'Emerald Forest',
        desc: state.lang === 'el' ? 'Βαθύ πράσινο' : 'Deep emerald green',
        colors: ['#182823', '#2ec4b6', '#0f1916']
      },
      {
        id: 'ocean',
        title: 'Ocean Breeze',
        desc: state.lang === 'el' ? 'Νυχτερινό μπλε & κυανό' : 'Midnight blue & cyan',
        colors: ['#1c2541', '#00b4d8', '#0b1329']
      },
      {
        id: 'pink',
        title: 'Blossom Pink',
        desc: state.lang === 'el' ? 'Σκούρο ματζέντα & ροζ' : 'Dark magenta & pink',
        colors: ['#2d1b24', '#ff758f', '#1f1218']
      },
      {
        id: 'sakura',
        title: 'Sakura Pastel',
        desc: state.lang === 'el' ? 'Φωτεινό παστέλ ροζ' : 'Light pastel sakura pink',
        colors: ['#fff5f7', '#f43f5e', '#ffffff']
      },
      {
        id: 'rosegold',
        title: 'Rose Gold',
        desc: state.lang === 'el' ? 'Πολυτελές ροζ χρυσό' : 'Luxury dark rose gold',
        colors: ['#261720', '#fb7185', '#180e14']
      },
      {
        id: 'cyber',
        title: 'Cyber Neon',
        desc: state.lang === 'el' ? 'Φουτουριστικό νέον βιολετί' : 'Cyberpunk neon violet',
        colors: ['#1c102b', '#a855f7', '#11091c']
      }
    ];

    themes.forEach(t => {
      const isSelected = t.id === currentVal;
      const card = document.createElement('div');
      card.className = `theme-card-option ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="theme-swatch-header">
          <div class="theme-swatch-bubbles">
            <span class="theme-swatch-bubble" style="background:${t.colors[0]};"></span>
            <span class="theme-swatch-bubble" style="background:${t.colors[1]};"></span>
            <span class="theme-swatch-bubble" style="background:${t.colors[2]};"></span>
          </div>
          ${isSelected ? '<i class="fa-solid fa-check settings-card-check" style="opacity:1;"></i>' : ''}
        </div>
        <div class="theme-card-title">${t.title}</div>
        <div class="theme-card-desc">${t.desc}</div>
      `;
      card.onclick = () => {
        changeThemeSetting(t.id);
        updateUI();
        updateSettingsDisplay();
        closeModal('settings-picker-modal');
      };
      container.appendChild(card);
    });

    openModal('settings-picker-modal');
    return;
  }

  const pickerModal = document.getElementById('settings-picker-modal');
  if (pickerModal) {
    if (type === 'month-start' || type === 'week-start') {
      pickerModal.setAttribute('data-theme', 'emerald');
    } else if (type === 'auto-lock') {
      pickerModal.setAttribute('data-theme', 'red');
    } else {
      pickerModal.removeAttribute('data-theme');
    }
  }

  if (type === 'month-start') {
    titleEl.textContent = state.lang === 'el' ? 'Έναρξη Μήνα' : 'Month Start';
    const currentVal = parseInt(localStorage.getItem('app_month_start') || '1');

    const wrapper = document.createElement('div');
    wrapper.className = 'month-start-container';

    const endDay = currentVal === 1 ? 31 : (currentVal - 1);
    const bannerText = state.lang === 'el'
      ? `Ο οικονομικός μήνας θα υπολογίζεται από τις <strong>${currentVal}</strong> έως τις <strong>${endDay}</strong> του επόμενου μήνα.`
      : `Budget month runs from <strong>${currentVal}</strong>th to <strong>${endDay}</strong>th of next month.`;

    wrapper.innerHTML = `
      <div class="month-start-banner">
        <i class="fa-solid fa-calendar-days"></i>
        <span>${bannerText}</span>
      </div>
      <div class="month-picker-circles-grid"></div>
    `;

    container.appendChild(wrapper);
    const gridEl = wrapper.querySelector('.month-picker-circles-grid');

    for (let i = 1; i <= 28; i++) {
      const circle = document.createElement('div');
      circle.className = `month-circle-item ${i === currentVal ? 'selected' : ''}`;
      circle.textContent = i;

      circle.onclick = () => {
        changeMonthStartSetting(String(i));
        closeModal('settings-picker-modal');
      };

      gridEl.appendChild(circle);
    }

    openModal('settings-picker-modal');
    return;
  }

  if (type === 'week-start') {
    titleEl.textContent = state.lang === 'el' ? 'Έναρξη Εβδομάδας' : 'Week Start';
    const currentVal = localStorage.getItem('app_week_start') || '1';

    const options = [
      {
        value: '1',
        title: state.lang === 'el' ? 'Δευτέρα' : 'Monday',
        sub: state.lang === 'el' ? 'Προεπιλογή Ευρώπης & Ελλάδας' : 'Europe & International standard',
        icon: 'fa-calendar-week'
      },
      {
        value: '0',
        title: state.lang === 'el' ? 'Κυριακή' : 'Sunday',
        sub: state.lang === 'el' ? 'Προεπιλογή Αμερικής & Ασίας' : 'US & Asia standard',
        icon: 'fa-sun'
      },
      {
        value: '6',
        title: state.lang === 'el' ? 'Σάββατο' : 'Saturday',
        sub: state.lang === 'el' ? 'Προεπιλογή Μέσης Ανατολής' : 'Middle East standard',
        icon: 'fa-coffee'
      }
    ];

    options.forEach(opt => {
      const isSelected = opt.value === currentVal;
      const card = document.createElement('div');
      card.className = `settings-card-item ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="settings-card-left">
          <div class="settings-card-icon"><i class="fa-solid ${opt.icon}"></i></div>
          <div class="settings-card-info">
            <div class="settings-card-title">${opt.title}</div>
            <div class="settings-card-sub">${opt.sub}</div>
          </div>
        </div>
        <i class="fa-solid fa-check settings-card-check"></i>
      `;
      card.onclick = () => {
        changeWeekStartSetting(opt.value);
        closeModal('settings-picker-modal');
      };
      container.appendChild(card);
    });

    openModal('settings-picker-modal');
    return;
  }

  if (type === 'auto-lock') {
    titleEl.textContent = state.lang === 'el' ? 'Αυτόματο Κλείδωμα' : 'Auto Lock';
    const currentVal = localStorage.getItem('settings_auto_lock_delay') || 'disabled';

    const options = [
      {
        value: 'disabled',
        title: state.lang === 'el' ? 'Απενεργοποιημένο' : 'Disabled',
        sub: state.lang === 'el' ? 'Η εφαρμογή δεν κλειδώνει αυτόματα' : 'App never auto-locks',
        icon: 'fa-lock-open'
      },
      {
        value: 'immediate',
        title: (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auto_lock_immediate']) || (state.lang === 'el' ? 'Άμεσα' : 'Immediately'),
        sub: (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auto_lock_immediate_sub']) || (state.lang === 'el' ? 'Κλείδωμα κατά την έξοδο ή εναλλαγή εφαρμογής' : 'Locks upon exiting or switching apps'),
        icon: 'fa-bolt'
      },
      {
        value: '1',
        title: state.lang === 'el' ? '1 λεπτό' : '1 minute',
        sub: state.lang === 'el' ? 'Κλείδωμα μετά από 1 λεπτό αδράνειας' : 'Locks after 1 min of inactivity',
        icon: 'fa-clock'
      },
      {
        value: '5',
        title: state.lang === 'el' ? '5 λεπτά' : '5 minutes',
        sub: state.lang === 'el' ? 'Κλείδωμα μετά από 5 λεπτά αδράνειας' : 'Locks after 5 mins of inactivity',
        icon: 'fa-clock'
      },
      {
        value: '10',
        title: state.lang === 'el' ? '10 λεπτά' : '10 minutes',
        sub: state.lang === 'el' ? 'Κλείδωμα μετά από 10 λεπτά αδράνειας' : 'Locks after 10 mins of inactivity',
        icon: 'fa-clock'
      }
    ];

    options.forEach(opt => {
      const isSelected = opt.value === currentVal || (opt.value === 'immediate' && currentVal === '0');
      const card = document.createElement('div');
      card.className = `settings-card-item ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="settings-card-left">
          <div class="settings-card-icon"><i class="fa-solid ${opt.icon}"></i></div>
          <div class="settings-card-info">
            <div class="settings-card-title">${opt.title}</div>
            <div class="settings-card-sub">${opt.sub}</div>
          </div>
        </div>
        <i class="fa-solid fa-check settings-card-check"></i>
      `;
      card.onclick = () => {
        changeAutoLockSetting(opt.value);
        closeModal('settings-picker-modal');
      };
      container.appendChild(card);
    });

    openModal('settings-picker-modal');
    return;
  }

  if (type === 'font-size') {
    titleEl.textContent = state.lang === 'el' ? 'Μέγεθος Γραμματοσειράς' : 'Font Size';
    const currentVal = localStorage.getItem('app_font_size') || 'normal';

    const options = [
      {
        value: 'small',
        title: state.lang === 'el' ? 'Μικρό' : 'Small',
        sub: state.lang === 'el' ? '0.9x — συμπαγές κείμενο' : '0.9x — compact text',
        icon: 'fa-text-height',
        sample: 12
      },
      {
        value: 'normal',
        title: state.lang === 'el' ? 'Κανονικό' : 'Normal',
        sub: state.lang === 'el' ? '1.0x — προεπιλογή' : '1.0x — default',
        icon: 'fa-text-height',
        sample: 14
      },
      {
        value: 'large',
        title: state.lang === 'el' ? 'Μεγάλο' : 'Large',
        sub: state.lang === 'el' ? '1.15x — μεγαλύτερο κείμενο' : '1.15x — larger text',
        icon: 'fa-text-height',
        sample: 16
      },
      {
        value: 'xlarge',
        title: state.lang === 'el' ? 'Πολύ Μεγάλο' : 'Extra Large',
        sub: state.lang === 'el' ? '1.3x — μέγιστο μέγεθος' : '1.3x — maximum size',
        icon: 'fa-text-height',
        sample: 18
      }
    ];

    options.forEach(opt => {
      const isSelected = opt.value === currentVal;
      const card = document.createElement('div');
      card.className = `settings-card-item ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="settings-card-left">
          <div class="settings-card-icon"><i class="fa-solid ${opt.icon}"></i></div>
          <div class="settings-card-info">
            <div class="settings-card-title">${opt.title}</div>
            <div class="settings-card-sub">${opt.sub}</div>
            <div class="font-size-sample" style="font-size:${opt.sample}px;">${state.lang === 'el' ? 'Δείγμα κειμένου' : 'Sample text'}</div>
          </div>
        </div>
        <i class="fa-solid fa-check settings-card-check"></i>
      `;
      card.onclick = () => {
        changeFontSizeSetting(opt.value);
        closeModal('settings-picker-modal');
      };
      container.appendChild(card);
    });

    openModal('settings-picker-modal');
    return;
  }
}

function initSettingsFromStorage() {
  const monthStart = localStorage.getItem('app_month_start') || '1';
  const weekStart = localStorage.getItem('app_week_start') || '1';
  const currency = localStorage.getItem('app_currency') || 'EUR';
  const theme = localStorage.getItem('app_theme') || 'dark';
  const fontSize = localStorage.getItem('app_font_size') || 'normal';

  try {
    const savedY = parseInt(localStorage.getItem('selected_year'), 10);
    const savedM = parseInt(localStorage.getItem('selected_month'), 10);
    const appState = (typeof state !== 'undefined' && state) ? state : ((typeof window !== 'undefined' && window.state) ? window.state : null);
    if (appState) {
      if (!isNaN(savedY) && savedY >= 2000 && savedY <= 2100) {
        appState.selectedYear = savedY;
      }
      if (!isNaN(savedM) && savedM >= 0 && savedM <= 11) {
        appState.selectedMonth = savedM;
      }
    }
  } catch (_) {}

  const savedPin = localStorage.getItem('app_pin');
  const validPin = savedPin && savedPin.length === 4;
  if (!validPin) {
    localStorage.removeItem('app_lock_enabled');
    localStorage.removeItem('app_biometrics_enabled');
    localStorage.removeItem('biometric_cred_id');
    localStorage.setItem('settings_auto_lock_delay', 'disabled');
  }

  let appLockEnabled = validPin && localStorage.getItem('app_lock_enabled') === 'true';
  let appBiometricsEnabled = validPin && localStorage.getItem('app_biometrics_enabled') === 'true';
  const autoLockDelay = localStorage.getItem('settings_auto_lock_delay') || 'disabled';

  const appLockCheckbox = document.getElementById('settings-app-lock');
  if (appLockCheckbox) appLockCheckbox.checked = appLockEnabled;

  const autocompleteEnabled = localStorage.getItem('settings_autocomplete_enabled') !== 'false';
  const autocompleteCheckbox = document.getElementById('settings-autocomplete');
  if (autocompleteCheckbox) autocompleteCheckbox.checked = autocompleteEnabled;

  const noteShortcutEnabled = localStorage.getItem('settings_note_shortcut_enabled') === 'true';
  const noteShortcutCheckbox = document.getElementById('settings-note-shortcut');
  if (noteShortcutCheckbox) {
    noteShortcutCheckbox.checked = noteShortcutEnabled;
    if (!noteShortcutCheckbox.dataset.listenerBound) {
      noteShortcutCheckbox.dataset.listenerBound = 'true';
      noteShortcutCheckbox.addEventListener('change', (e) => {
        toggleNoteShortcutSetting(e.target.checked);
      });
    }
  }

  const quickAddEnabled = localStorage.getItem('quick_add_notification_enabled') === 'true';
  const quickAddCheckbox = document.getElementById('settings-quick-add-notification');
  if (quickAddCheckbox) quickAddCheckbox.checked = quickAddEnabled;
  const quickAddSyncCheckbox = document.getElementById('settings-quick-add-notification-sync');
  if (quickAddSyncCheckbox) quickAddSyncCheckbox.checked = quickAddEnabled;

  populateCurrencySelect();

  updateNoteShortcutVisibility();
  updateSettingsDisplay();
  applyTheme(theme);
  applyFontSize(fontSize);
  checkBiometricsSupport();

  if (appLockEnabled || appBiometricsEnabled || (validPin && autoLockDelay !== 'disabled')) {
    showLockScreen();
  }
}


  // Window Bindings
  window.getCurrencySymbol = getCurrencySymbol;
  window.updateCurrencySymbols = updateCurrencySymbols;
  window.updateAmountCurrencySymbol = updateAmountCurrencySymbol;
  window.getTransactionCurrencySymbol = getTransactionCurrencySymbol;
  window.getTxCurrencyCode = getTxCurrencyCode;
  window.getReliabilityBadge = getReliabilityBadge;
  window.getTxCurrencyLabel = getTxCurrencyLabel;
  window.updateDualAmountDisplay = updateDualAmountDisplay;
  window.getDisplayCurrency = getDisplayCurrency;
  window.getTransactionsBaseCurrency = getTransactionsBaseCurrency;
  window.displayAmountInDisplayCurrency = displayAmountInDisplayCurrency;
  window.formatDisplayAmount = formatDisplayAmount;
  window.getAccountBalanceInBase = getAccountBalanceInBase;
  window.computeNetWorth = computeNetWorth;
  window.changeMonthStartSetting = changeMonthStartSetting;
  window.changeWeekStartSetting = changeWeekStartSetting;
  window.changeCurrencySetting = changeCurrencySetting;
  window.populateCurrencySelect = populateCurrencySelect;
  window.updateSettingsDisplay = updateSettingsDisplay;
  window.openSettingsPicker = openSettingsPicker;
  window.initSettingsFromStorage = initSettingsFromStorage;

  return {
    getCurrencySymbol: getCurrencySymbol,
    updateCurrencySymbols: updateCurrencySymbols,
    updateAmountCurrencySymbol: updateAmountCurrencySymbol,
    getTransactionCurrencySymbol: getTransactionCurrencySymbol,
    getTxCurrencyCode: getTxCurrencyCode,
    getReliabilityBadge: getReliabilityBadge,
    getTxCurrencyLabel: getTxCurrencyLabel,
    updateDualAmountDisplay: updateDualAmountDisplay,
    getDisplayCurrency: getDisplayCurrency,
    getTransactionsBaseCurrency: getTransactionsBaseCurrency,
    displayAmountInDisplayCurrency: displayAmountInDisplayCurrency,
    formatDisplayAmount: formatDisplayAmount,
    getAccountBalanceInBase: getAccountBalanceInBase,
    computeNetWorth: computeNetWorth,
    changeMonthStartSetting: changeMonthStartSetting,
    changeWeekStartSetting: changeWeekStartSetting,
    changeCurrencySetting: changeCurrencySetting,
    populateCurrencySelect: populateCurrencySelect,
    updateSettingsDisplay: updateSettingsDisplay,
    openSettingsPicker: openSettingsPicker,
    initSettingsFromStorage: initSettingsFromStorage
  };
}));
