// ============================================================
// CURRENCY PICKER VIEW SUBSYSTEM
// Autonomous UMD Module (Phase 17C Architectural Extraction)
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
    rootObj.CurrencyPickerView = exports;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

  let _currencyPickerTarget = 'transaction';

// ============================================================
// CURRENCY PICKER (multi-currency)
// ============================================================
const POPULAR_CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR'];

function getRecentCurrencies() {
  try {
    const raw = localStorage.getItem('recent_currencies');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function rememberRecentCurrency(code) {
  try {
    let arr = getRecentCurrencies().filter(c => c !== code);
    arr.unshift(code);
    arr = arr.slice(0, 5);
    localStorage.setItem('recent_currencies', JSON.stringify(arr));
  } catch (e) { /* ignore */ }
}

function getTransactionCurrency() {
  const input = document.getElementById('trans-currency');
  return (input && input.value) || 'EUR';
}

function setTransactionCurrency(code) {
  const input = document.getElementById('trans-currency');
  if (input) input.value = code || 'EUR';
  updateCurrencyTriggerDisplay();
  updateAmountCurrencySymbol();
}

function updateCurrencyTriggerDisplay() {
  const code = getTransactionCurrency();
  const triggerDisplay = document.getElementById('trans-currency-display');
  if (!triggerDisplay) return;
  const c = CurrencyService.getCurrency(code);
  const flag = c && c.flag ? c.flag : '';
  const name = c ? c.name : code;
  triggerDisplay.innerHTML = `<span class="custom-select-icon" style="margin-right: 8px;">${getFlagHtml(flag, code)}</span><span class="custom-select-text">${escapeHtml(name)}</span>`;
}


function getFlagHtml(flag, code) {
  if (!flag || flag === '🌐' || flag === '🌍') {
    return `<span style="font-size: 20px; line-height: 1;">${flag || '🌐'}</span>`;
  }

  let cc = null;
  try {
    const chars = [...flag];
    if (chars.length >= 2) {
      const c1 = chars[0].codePointAt(0) - 0x1F1E6;
      const c2 = chars[1].codePointAt(0) - 0x1F1E6;
      if (c1 >= 0 && c1 < 26 && c2 >= 0 && c2 < 26) {
        cc = (String.fromCharCode(65 + c1) + String.fromCharCode(65 + c2)).toLowerCase();
      }
    }
  } catch (_) {}

  if (!cc && code) {
    const codeMap = {
      EUR: 'eu', USD: 'us', GBP: 'gb', JPY: 'jp', CHF: 'ch', CAD: 'ca', AUD: 'au',
      NZD: 'nz', CNY: 'cn', INR: 'in', RUB: 'ru', BRL: 'br', MXN: 'mx', ZAR: 'za',
      TRY: 'tr', SEK: 'se', NOK: 'no', DKK: 'dk', PLN: 'pl', CZK: 'cz', HUF: 'hu',
      RON: 'ro', BGN: 'bg', UAH: 'ua', ILS: 'il', AED: 'ae', SAR: 'sa', QAR: 'qa',
      KWD: 'kw', BHD: 'bh', OMR: 'om', JOD: 'jo', LBP: 'lb', EGP: 'eg', MAD: 'ma',
      TND: 'tn', DZD: 'dz', LYD: 'ly', NGN: 'ng', GHS: 'gh', KES: 'ke', TZS: 'tz',
      UGX: 'ug', ETB: 'et', ARS: 'ar', CLP: 'cl', COP: 'co', PEN: 'pe', UYU: 'uy',
      PYG: 'py', BOB: 'bo', VES: 've', CRC: 'cr', PAB: 'pa', DOP: 'do', GTQ: 'gt',
      HNL: 'hn', NIO: 'ni', SVC: 'sv', JMD: 'jm', TTD: 'tt', BSD: 'bs', BBD: 'bb',
      CUP: 'cu', HTG: 'ht', AWG: 'aw', ANG: 'cw', KRW: 'kr', SGD: 'sg', HKD: 'hk',
      TWD: 'tw', MYR: 'my', THB: 'th', IDR: 'id', PHP: 'ph', VND: 'vn', ISK: 'is',
      RSD: 'rs', BAM: 'ba', MKD: 'mk', ALL: 'al', GEL: 'ge', AMD: 'am', AZN: 'az',
      KZT: 'kz', UZS: 'uz', BYN: 'by', MDL: 'md', KGS: 'kg', TJS: 'tj', TMT: 'tm',
      MNT: 'mn', NPR: 'np', LKR: 'lk', BDT: 'bd', PKR: 'pk', AFN: 'af', MMK: 'mm',
      KHR: 'kh', LAK: 'la', BND: 'bn', MOP: 'mo', MVR: 'mv', SYP: 'sy', YER: 'ye',
      IQD: 'iq', IRR: 'ir', NAD: 'na', BWP: 'bw', ZMW: 'zm', MZN: 'mz', AOA: 'ao',
      CDF: 'cd', RWF: 'rw', BIF: 'bi', MWK: 'mw', MGA: 'mg', SCR: 'sc', MUR: 'mu',
      ZWL: 'zw', SOS: 'so', DJF: 'dj', ERN: 'er', GMD: 'gm', SLL: 'sl', LRD: 'lr',
      GNF: 'gn', CVE: 'cv', STD: 'st', STN: 'st', FJD: 'fj', PGK: 'pg', SBD: 'sb',
      VUV: 'vu', WST: 'ws', TOP: 'to', XCD: 'ag', BZD: 'bz', GYD: 'gy', SRD: 'sr',
      FKP: 'fk', GIP: 'gi', SHP: 'sh', JEP: 'je', GGP: 'gg', IMP: 'im',
      XOF: 'sn', XAF: 'cm'
    };
    cc = codeMap[code.toUpperCase()];
  }

  if (cc) {
    return `<img src="https://flagcdn.com/w40/${cc}.png" srcset="https://flagcdn.com/w80/${cc}.png 2x" width="24" height="18" alt="${escapeHtml(flag || code)}" style="border-radius: 3px; object-fit: cover; box-shadow: 0 1px 3px rgba(0,0,0,0.3); vertical-align: middle; display: inline-block;" onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline-block';"><span class="flag-fallback" style="display:none; font-size: 20px; line-height: 1;">${flag || ''}</span>`;
  }

  return `<span style="font-size: 20px; line-height: 1;">${flag || '🌐'}</span>`;
}
window.getFlagHtml = getFlagHtml;


function openCurrencyPickerModal(options = {}) {
  try {
    _currencyPickerTarget = (options && options.target) ? options.target : 'transaction';
    const form = document.getElementById('transaction-form');
    if (_currencyPickerTarget === 'transaction' && form && form.getAttribute('data-readonly') === 'true') return;
    if (_currencyPickerTarget === 'transaction' && typeof window.closeCalculatorKeypad === 'function') {
      window.closeCalculatorKeypad();
    }
    const search = document.getElementById('currency-picker-search');
    if (search) search.value = '';
    renderCurrencyPickerOptions();
    openModal('currency-picker-modal', { instant: true });
    const el = document.getElementById('currency-picker-modal');
    if (el) {
      el._openedAt = Date.now();
      if (!el.classList.contains('active')) {
        el.classList.add('active');
        document.body.classList.add('modal-open');
      }
    }
  } catch (err) {
    console.error('[CurrencySymbol] openCurrencyPickerModal error:', err);
    try {
      const el = document.getElementById('currency-picker-modal');
      if (el) {
        el._openedAt = Date.now();
        el.classList.add('active');
        document.body.classList.add('modal-open');
      }
    } catch (_) { /* ignore */ }
  }
}

function renderCurrencyPickerOptions() {
  const container = document.getElementById('currency-picker-list');
  if (!container) return;
  const search = document.getElementById('currency-picker-search');
  const query = search ? search.value.trim().toLowerCase() : '';

  const allCurrencies = CurrencyService.getCurrencies();
  const currentVal = (_currencyPickerTarget === 'settings')
    ? (localStorage.getItem('app_currency') || 'EUR')
    : getTransactionCurrency();
  const recent = getRecentCurrencies();

  container.innerHTML = '';

  if (query) {
    const matched = allCurrencies.filter(c =>
      c.code.toLowerCase().includes(query) ||
      (c.name || '').toLowerCase().includes(query) ||
      (c.countries || []).some(ct => String(ct).toLowerCase().includes(query))
    );

    if (matched.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 20px;">${state.lang === 'el' ? 'Δεν βρέθηκαν νομίσματα' : 'No currencies found'}</div>`;
      return;
    }

    matched.forEach(c => appendCurrencyCardItem(container, c, currentVal, true, query));
  } else {
    // 1. Popular & Recent Section
    const accountCurrency = (_currencyPickerTarget === 'settings') ? null : getSelectedAccountCurrency();
    const popularCodes = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];
    const topList = [];
    const seen = new Set();
    const pushTop = (code) => {
      if (!code || seen.has(code)) return;
      const c = allCurrencies.find(x => x.code === code);
      if (c) { topList.push(c); seen.add(code); }
    };
    pushTop(accountCurrency);
    recent.forEach(pushTop);
    popularCodes.forEach(pushTop);

    if (topList.length > 0) {
      const topHeader = document.createElement('div');
      topHeader.className = 'currency-section-title';
      topHeader.textContent = state.lang === 'el' ? '⭐ Δημοφιλή & Πρόσφατα' : '⭐ Popular & Recent';
      container.appendChild(topHeader);

      topList.forEach(c => appendCurrencyCardItem(container, c, currentVal, false, ''));
    }

    // 2. All Currencies Section
    const allHeader = document.createElement('div');
    allHeader.className = 'currency-section-title';
    allHeader.textContent = state.lang === 'el' ? '🌍 Όλα τα Νομίσματα' : '🌍 All Currencies';
    container.appendChild(allHeader);

    const sortedAll = [...allCurrencies].sort((a, b) => a.code.localeCompare(b.code));
    sortedAll.forEach(c => appendCurrencyCardItem(container, c, currentVal, false, ''));
  }
}

function appendCurrencyCardItem(container, c, currentVal, showMatchedCountries, query) {
  const isSelected = c.code === currentVal;
  const card = document.createElement('div');
  card.className = `currency-item-card ${isSelected ? 'selected' : ''}`;

  let countryLine = '';
  if (showMatchedCountries && Array.isArray(c.countries) && c.countries.length) {
    const matched = c.countries.filter(ct => String(ct).toLowerCase().includes(query));
    const shown = (matched.length ? matched : c.countries).slice(0, 3);
    countryLine = `<div class="currency-name-sub" style="margin-top:2px;">📍 ${shown.map(ct => escapeHtml(ct)).join(' · ')}</div>`;
  }

  card.innerHTML = `
    <div class="currency-card-left">
      <div class="currency-flag-box">${getFlagHtml(c.flag, c.code)}</div>
      <div class="currency-card-details">
        <div class="currency-card-main">
          <span class="currency-code-badge">${escapeHtml(c.code)}</span>
          <span class="currency-symbol-tag">${escapeHtml(c.symbol || '')}</span>
        </div>
        <div class="currency-name-sub">${escapeHtml(c.name || c.code)}</div>
        ${countryLine}
      </div>
    </div>
    ${isSelected ? '<i class="fa-solid fa-check settings-card-check" style="opacity:1;"></i>' : ''}
  `;

  card.onclick = () => selectCurrencyOption(c.code);
  container.appendChild(card);
}

function getSelectedAccountCurrency() {
  const accName = document.getElementById('trans-account-from')?.value;
  if (accName) {
    const acc = state.accounts.find(a => a.name === accName);
    if (acc && acc.currency) return acc.currency;
  }
  return null;
}

function selectCurrencyOption(code) {
  if (_currencyPickerTarget === 'settings') {
    changeCurrencySetting(code);
  } else {
    // Premium gate: Free users may use only their base currency (1 currency).
    // Selecting a different currency for a transaction means using a 2nd
    // currency, which requires Premium. The base currency itself is always
    // changeable via settings (that is the user's single currency).
    const baseCurrency = localStorage.getItem('app_currency') || 'EUR';
    if (code !== baseCurrency && code !== 'EUR' && code !== 'USD' && !isPremium()) {
      closeModal('currency-picker-modal');
      if (typeof openPremiumModal === 'function') openPremiumModal('currency');
      showSyncToast(
        state.lang === 'el'
          ? 'Μόνο το Ευρώ (€) και το Δολάριο ($) είναι διαθέσιμα δωρεάν. Τα υπόλοιπα νομίσματα απαιτούν Premium.'
          : 'Only Euro (€) and Dollar ($) are free. Other currencies require Premium.',
        4000
      );
      return;
    }
    setTransactionCurrency(code);
    rememberRecentCurrency(code);
    if (typeof window.openCalculatorKeypad === 'function') {
      window.openCalculatorKeypad();
    }
  }
  closeModal('currency-picker-modal');
}

// Initializes the transaction currency when opening the form.
// Priority: explicit currency (editing) > selected account currency > base currency > EUR.
function initTransactionCurrency(explicitCurrency) {
  let code = explicitCurrency;
  if (!code) {
    const accountCurrency = getSelectedAccountCurrency();
    if (accountCurrency) code = accountCurrency;
  }
  if (!code) {
    const baseCurrency = localStorage.getItem('app_currency') || 'EUR';
    code = baseCurrency;
  }
  setTransactionCurrency(code);
  syncActualAmountRowVisibility();
}

// Shows/hides the "actual amount" correction row. It is only relevant when
// editing a transaction whose currency differs from the base currency.
function syncActualAmountRowVisibility() {
  const row = document.getElementById('form-row-actual-amount');
  if (!row) return;
  const baseCurrency = localStorage.getItem('app_currency') || 'EUR';
  const txCurrency = getTransactionCurrency();
  const isEdit = !!document.getElementById('trans-id')?.value;
  const show = isEdit && txCurrency !== baseCurrency;
  row.style.display = show ? '' : 'none';
  if (!show) {
    document.getElementById('trans-actual-amount').value = '';
  }
}

// Applies the user-entered actual charged amount (in base currency) to the
// transaction being edited, using CurrencyService.correctActualAmount().
function applyActualAmountCorrection(t) {
  const input = document.getElementById('trans-actual-amount');
  if (!input) return t;
  const raw = String(input.value || '').trim();
  if (raw === '') return t;
  const actualInBase = parseFloat(raw.replace(',', '.'));
  if (isNaN(actualInBase) || actualInBase <= 0) return t;
  return CurrencyService.correctActualAmount(t, actualInBase);
}

// ============================================================
// MULTI-CURRENCY: RATE FETCHING (Phase 5)
// ============================================================

// Wires the CurrencyService to Supabase (exchange_rates table) and fetches
// today's rates from Frankfurter/ECB when the multi-currency feature is enabled.
// Safe to call on every init — it is idempotent and non-blocking.
function initMultiCurrency() {
  if (!window.CurrencyService) return;

  // 1. Rate provider: read historical rates from Supabase (exchange_rates table).
  //    Returns the rate for base→quote on a given date, or null if not found.
  CurrencyService.setRateProvider((base, quote, dateKey) => {
    if (!state.isSupabaseEnabled || !state.supabaseClient) return null;
    // Synchronous lookup is not possible against Supabase; we rely on the
    // local rateCache populated by fetchTodayRates()/persist. For historical
    // dates we fetch on demand below (async) and cache the result.
    return null;
  });

  // 2. Rate persist: after fetching today's rates, upsert them into Supabase.
  CurrencyService.setRatePersist((base, date, rates) => {
    if (!state.isSupabaseEnabled || !state.supabaseClient) return;
    const rows = Object.entries(rates || {}).map(([quote, rate]) => ({
      base_currency: base,
      quote_currency: quote,
      rate: Number(rate),
      rate_date: date,
      source: 'api',
    }));
    if (rows.length === 0) return;
    state.supabaseClient.from('exchange_rates').upsert(rows, { onConflict: 'base_currency,quote_currency,rate_date' })
      .then(() => { }, (err) => console.warn('[MultiCurrency] Failed to persist rates:', err));
  });

  // 3. Fetch today's rates (non-blocking). Multi-currency is always active
  //    (Invisible Multi-Currency), so rates are always fetched.
  const baseCurrency = localStorage.getItem('app_currency') || 'EUR';
  CurrencyService.fetchTodayRates(baseCurrency).then((ok) => {
    if (ok) {
      // Recompute any pending base-currency fields that were missing a rate.
      recomputePendingAmountBase();
    }
  });
}

// Recomputes amount_base for transactions that were saved without a rate
// (rate_to_base null / rate_source 'cached') now that fresh rates are available.
function recomputePendingAmountBase() {
  if (!Array.isArray(state.transactions)) return;
  const baseCurrency = localStorage.getItem('app_currency') || 'EUR';
  let changed = false;
  state.transactions.forEach((tx) => {
    if (!tx || tx.currency === baseCurrency) return;
    if (tx.rate_to_base != null && tx.amount_base != null) return; // already resolved
    const rate = CurrencyService.getRate(tx.currency, baseCurrency, tx.date);
    if (rate == null || rate <= 0) return;
    tx.rate_to_base = rate;
    tx.amount_base = CurrencyService.round(Number(tx.amount) / rate, 4);
    tx.rate_source = 'api';
    changed = true;
  });
  if (changed) {
    calculateInitialBalances();
    updateUI();
  }
}

  // Window Bindings
  window.POPULAR_CURRENCIES = POPULAR_CURRENCIES;
  window.getRecentCurrencies = getRecentCurrencies;
  window.rememberRecentCurrency = rememberRecentCurrency;
  window.getTransactionCurrency = getTransactionCurrency;
  window.setTransactionCurrency = setTransactionCurrency;
  window.updateCurrencyTriggerDisplay = updateCurrencyTriggerDisplay;
  window.getFlagHtml = getFlagHtml;
  window.openCurrencyPickerModal = openCurrencyPickerModal;
  window.renderCurrencyPickerOptions = renderCurrencyPickerOptions;
  window.appendCurrencyCardItem = appendCurrencyCardItem;
  window.getSelectedAccountCurrency = getSelectedAccountCurrency;
  window.selectCurrencyOption = selectCurrencyOption;
  window.initTransactionCurrency = initTransactionCurrency;
  window.syncActualAmountRowVisibility = syncActualAmountRowVisibility;
  window.applyActualAmountCorrection = applyActualAmountCorrection;
  window.initMultiCurrency = initMultiCurrency;
  window.recomputePendingAmountBase = recomputePendingAmountBase;

  return {
    POPULAR_CURRENCIES: POPULAR_CURRENCIES,
    getRecentCurrencies: getRecentCurrencies,
    rememberRecentCurrency: rememberRecentCurrency,
    getTransactionCurrency: getTransactionCurrency,
    setTransactionCurrency: setTransactionCurrency,
    updateCurrencyTriggerDisplay: updateCurrencyTriggerDisplay,
    getFlagHtml: getFlagHtml,
    openCurrencyPickerModal: openCurrencyPickerModal,
    renderCurrencyPickerOptions: renderCurrencyPickerOptions,
    appendCurrencyCardItem: appendCurrencyCardItem,
    getSelectedAccountCurrency: getSelectedAccountCurrency,
    selectCurrencyOption: selectCurrencyOption,
    initTransactionCurrency: initTransactionCurrency,
    syncActualAmountRowVisibility: syncActualAmountRowVisibility,
    applyActualAmountCorrection: applyActualAmountCorrection,
    initMultiCurrency: initMultiCurrency,
    recomputePendingAmountBase: recomputePendingAmountBase
  };
}));
