// ============================================================
// CurrencyService BOOTSTRAP (self-sufficiency guard)
// ------------------------------------------------------------
// The OTA engine only downloads app.js + style.css, NOT index.html
// or the other js/ files. Users running an older APK whose bundled
// index.html does NOT load js/CurrencyService.js would crash with
// "CurrencyService is not defined" the moment the OTA app.js (which
// references CurrencyService) runs. This guard guarantees
// window.CurrencyService is ALWAYS available synchronously:
//   1) If the host index.html already loaded it -> use it.
//   2) Otherwise, synchronously load js/CurrencyService.js.
//   3) As a last resort, install a minimal inline fallback so the
//      app never hard-crashes on a missing global.
// ============================================================
(function ensureCurrencyService() {
  // Required public methods that app.js depends on. If window.CurrencyService
  // exists but is missing ANY of these (e.g. a stale js/CurrencyService.js
  // served from the service-worker cache that predates a method), we must NOT
  // trust it — otherwise app.js crashes with "CurrencyService.X is not a
  // function". We replace it with a complete implementation below.
  var REQUIRED_METHODS = [
    'round', 'toDateKey', 'setCurrencies', 'getCurrencies', 'getCurrency',
    'getSymbol', 'getDecimals', 'getCountries', 'getCurrenciesByCountry',
    'convert', 'computeAmountBase', 'toBase',
    'displayAmount', 'sumInCurrency', 'getRate', 'setManualRate',
    'correctActualAmount', 'conversionStatus', 'fetchTodayRates',
    'setRateProvider', 'setRatePersist', 'setManualRateSink',
    'isEnabled', 'setEnabled'
  ];
  function isComplete(cs) {
    if (!cs || typeof cs !== 'object') return false;
    for (var i = 0; i < REQUIRED_METHODS.length; i++) {
      if (typeof cs[REQUIRED_METHODS[i]] !== 'function') return false;
    }
    return true;
  }

  // Minimal inline fallback (only used if the real file cannot load).
  // Provides the same public surface used across app.js so nothing crashes.
  function FallbackCurrencyService() {
    this.rateCache = new Map();
    this.currencies = [
      { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, flag: '🇪🇺', countries: ['Ευρωζώνη', 'Eurozone', 'Γερμανία', 'Germany', 'Γαλλία', 'France', 'Ιταλία', 'Italy', 'Ισπανία', 'Spain', 'Ελλάδα', 'Greece', 'Πορτογαλία', 'Portugal', 'Ολλανδία', 'Netherlands', 'Βέλγιο', 'Belgium', 'Αυστρία', 'Austria', 'Ιρλανδία', 'Ireland', 'Φινλανδία', 'Finland', 'Κύπρος', 'Cyprus', 'Μάλτα', 'Malta', 'Κροατία', 'Croatia'] },
      { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2, flag: '🇺🇸', countries: ['ΗΠΑ', 'USA', 'Αμερική', 'America', 'Ηνωμένες Πολιτείες', 'United States'] },
      { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2, flag: '🇬🇧', countries: ['Ηνωμένο Βασίλειο', 'United Kingdom', 'Βρετανία', 'Britain', 'Αγγλία', 'England'] },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0, flag: '🇯🇵', countries: ['Ιαπωνία', 'Japan'] },
      { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2, flag: '🇨🇭', countries: ['Ελβετία', 'Switzerland'] },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2, flag: '🇨🇦', countries: ['Καναδάς', 'Canada'] },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2, flag: '🇦🇺', countries: ['Αυστραλία', 'Australia'] },
      { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2, flag: '🇨🇳', countries: ['Κίνα', 'China'] },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2, flag: '🇮🇳', countries: ['Ινδία', 'India'] },
      { code: 'RUB', name: 'Russian Ruble', symbol: '₽', decimals: 2, flag: '🇷🇺', countries: ['Ρωσία', 'Russia'] },
      { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2, flag: '🇧🇷', countries: ['Βραζιλία', 'Brazil'] },
      { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimals: 2, flag: '🇹🇷', countries: ['Τουρκία', 'Turkey'] },
      { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2, flag: '🇸🇪', countries: ['Σουηδία', 'Sweden'] },
      { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2, flag: '🇳🇴', countries: ['Νορβηγία', 'Norway'] },
      { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimals: 2, flag: '🇩🇰', countries: ['Δανία', 'Denmark'] },
      { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', decimals: 2, flag: '🇵🇱', countries: ['Πολωνία', 'Poland'] },
      { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', decimals: 2, flag: '🇨🇿', countries: ['Τσεχία', 'Czech Republic'] },
      { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', decimals: 2, flag: '🇭🇺', countries: ['Ουγγαρία', 'Hungary'] },
      { code: 'RON', name: 'Romanian Leu', symbol: 'lei', decimals: 2, flag: '🇷🇴', countries: ['Ρουμανία', 'Romania'] },
      { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', decimals: 2, flag: '🇧🇬', countries: ['Βουλγαρία', 'Bulgaria'] },
      { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴', decimals: 2, flag: '🇺🇦', countries: ['Ουκρανία', 'Ukraine'] },
      { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', decimals: 2, flag: '🇮🇱', countries: ['Ισραήλ', 'Israel'] },
      { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2, flag: '🇦🇪', countries: ['Ηνωμένα Αραβικά Εμιράτα', 'United Arab Emirates', 'UAE'] },
      { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimals: 2, flag: '🇸🇦', countries: ['Σαουδική Αραβία', 'Saudi Arabia'] },
      { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0, flag: '🇰🇷', countries: ['Νότια Κορέα', 'South Korea', 'Κορέα', 'Korea'] },
      { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2, flag: '🇸🇬', countries: ['Σιγκαπούρη', 'Singapore'] },
      { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2, flag: '🇭🇰', countries: ['Χονγκ Κονγκ', 'Hong Kong'] },
      { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2, flag: '🇲🇾', countries: ['Μαλαισία', 'Malaysia'] },
      { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2, flag: '🇹🇭', countries: ['Ταϊλάνδη', 'Thailand'] },
      { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 0, flag: '🇮🇩', countries: ['Ινδονησία', 'Indonesia'] },
      { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2, flag: '🇵🇭', countries: ['Φιλιππίνες', 'Philippines'] },
      { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimals: 0, flag: '🇻🇳', countries: ['Βιετνάμ', 'Vietnam'] },
      { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', decimals: 2, flag: '🇵🇰', countries: ['Πακιστάν', 'Pakistan'] },
      { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', decimals: 2, flag: '🇧🇩', countries: ['Μπανγκλαντές', 'Bangladesh'] },
      { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', decimals: 2, flag: '🇱🇰', countries: ['Σρι Λάνκα', 'Sri Lanka'] },
      { code: 'NPR', name: 'Nepalese Rupee', symbol: '₨', decimals: 2, flag: '🇳🇵', countries: ['Νεπάλ', 'Nepal'] },
      { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸', decimals: 2, flag: '🇰🇿', countries: ['Καζακστάν', 'Kazakhstan'] },
      { code: 'UZS', name: 'Uzbekistani Som', symbol: 'soʻm', decimals: 2, flag: '🇺🇿', countries: ['Ουζμπεκιστάν', 'Uzbekistan'] },
      { code: 'GEL', name: 'Georgian Lari', symbol: '₾', decimals: 2, flag: '🇬🇪', countries: ['Γεωργία', 'Georgia'] },
      { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br', decimals: 2, flag: '🇧🇾', countries: ['Λευκορωσία', 'Belarus'] },
      { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин', decimals: 2, flag: '🇷🇸', countries: ['Σερβία', 'Serbia'] },
      { code: 'MKD', name: 'Macedonian Denar', symbol: 'ден', decimals: 2, flag: '🇲🇰', countries: ['Βόρεια Μακεδονία', 'North Macedonia'] },
      { code: 'ALL', name: 'Albanian Lek', symbol: 'L', decimals: 2, flag: '🇦🇱', countries: ['Αλβανία', 'Albania'] },
      { code: 'BAM', name: 'Bosnian Convertible Mark', symbol: 'KM', decimals: 2, flag: '🇧🇦', countries: ['Βοσνία και Ερζεγοβίνη', 'Bosnia and Herzegovina'] },
      { code: 'ISK', name: 'Icelandic Króna', symbol: 'kr', decimals: 0, flag: '🇮🇸', countries: ['Ισλανδία', 'Iceland'] },
      { code: 'ARS', name: 'Argentine Peso', symbol: '$', decimals: 2, flag: '🇦🇷', countries: ['Αργεντινή', 'Argentina'] },
      { code: 'CLP', name: 'Chilean Peso', symbol: '$', decimals: 0, flag: '🇨🇱', countries: ['Χιλή', 'Chile'] },
      { code: 'COP', name: 'Colombian Peso', symbol: '$', decimals: 2, flag: '🇨🇴', countries: ['Κολομβία', 'Colombia'] },
      { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', decimals: 2, flag: '🇵🇪', countries: ['Περού', 'Peru'] },
      { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U', decimals: 2, flag: '🇺🇾', countries: ['Ουρουγουάη', 'Uruguay'] },
      { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', decimals: 2, flag: '🇲🇽', countries: ['Μεξικό', 'Mexico'] },
      { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2, flag: '🇿🇦', countries: ['Νότια Αφρική', 'South Africa'] },
      { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2, flag: '🇳🇬', countries: ['Νιγηρία', 'Nigeria'] },
      { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2, flag: '🇰🇪', countries: ['Κένυα', 'Kenya'] },
      { code: 'EGP', name: 'Egyptian Pound', symbol: 'ج.م', decimals: 2, flag: '🇪🇬', countries: ['Αίγυπτος', 'Egypt'] },
      { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.', decimals: 2, flag: '🇲🇦', countries: ['Μαρόκο', 'Morocco'] },
      { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت', decimals: 3, flag: '🇹🇳', countries: ['Τυνησία', 'Tunisia'] }
    ];
    this._rateProvider = null;
    this._ratePersist = null;
    this._manualRateSink = null;
  }
  FallbackCurrencyService.prototype.round = function (v, d) {
    d = d == null ? 4 : d;
    var f = Math.pow(10, d);
    return Math.round((v + Number.EPSILON) * f) / f;
  };
  FallbackCurrencyService.prototype.toDateKey = function (date) {
    if (!date) return null;
    if (date instanceof Date) return date.toISOString().slice(0, 10);
    return String(date).slice(0, 10);
  };
  FallbackCurrencyService.prototype.setCurrencies = function (list) {
    if (Array.isArray(list) && list.length) this.currencies = list;
  };
  FallbackCurrencyService.prototype.getCurrencies = function () { return this.currencies; };
  FallbackCurrencyService.prototype.getCurrency = function (code) {
    return this.currencies.find(function (c) { return c.code === code; }) || null;
  };
  FallbackCurrencyService.prototype.getSymbol = function (code) {
    var c = this.getCurrency(code);
    return c ? c.symbol : (code || '');
  };
  FallbackCurrencyService.prototype.getDecimals = function (code) {
    var c = this.getCurrency(code);
    return c && typeof c.decimals === 'number' ? c.decimals : 2;
  };
  FallbackCurrencyService.prototype.getCountries = function (code) {
    var c = this.getCurrency(code);
    return c && Array.isArray(c.countries) ? c.countries : [];
  };
  FallbackCurrencyService.prototype.getCurrenciesByCountry = function (query) {
    if (!query) return [];
    var q = String(query).toLowerCase().trim();
    if (!q) return [];
    var self = this;
    return this.currencies.filter(function (c) {
      return (c.countries || []).some(function (name) { return String(name).toLowerCase().indexOf(q) !== -1; });
    });
  };
  FallbackCurrencyService.prototype.getRate = function (base, quote, date) {
    if (base === quote) return 1;
    var dateKey = this.toDateKey(date) || new Date().toISOString().slice(0, 10);
    var exactKey = base + '_' + quote + '_' + dateKey;
    if (this.rateCache.has(exactKey)) return this.rateCache.get(exactKey).rate;
    if (this._rateProvider) {
      var rate = this._rateProvider(base, quote, dateKey);
      if (rate != null) {
        this.rateCache.set(exactKey, { rate: Number(rate), source: 'cached', fetched_at: Date.now() });
        return rate;
      }
    }
    // Αντιστροφή ισοτιμίας: αν έχουμε μόνο quote→base (π.χ. USD→EUR) αλλά
    // χρειαζόμαστε base→quote (π.χ. EUR→USD), επέστρεψε 1/rate. Συμβαίνει όταν
    // ο χρήστης αλλάζει το νόμισμα εφαρμογής και οι ισοτιμίες φορτώθηκαν με
    // βάση το ΠΡΟΗΓΟΥΜΕΝΟ νόμισμα (π.χ. EUR).
    var inverseKey = quote + '_' + base + '_' + dateKey;
    if (this.rateCache.has(inverseKey)) {
      var inv = this.rateCache.get(inverseKey).rate;
      if (inv != null && inv !== 0) {
        return this.round(1 / inv, 8);
      }
    }
    return null;
  };
  FallbackCurrencyService.prototype.computeAmountBase = function (amount, currency, baseCurrency, date, rateToBaseActual) {
    if (currency === baseCurrency) return this.round(amount, 4);
    var rate = rateToBaseActual != null ? rateToBaseActual : this.getRate(currency, baseCurrency, date);
    if (rate == null || rate === 0) return null;
    return this.round(amount / rate, 4);
  };
  FallbackCurrencyService.prototype.toBase = function (tx) {
    if (!tx) return 0;
    if (tx.amount_base != null) return Number(tx.amount_base);
    return this.computeAmountBase(
      Number(tx.amount),
      tx.currency || 'EUR',
      tx.base_currency || 'EUR',
      tx.date,
      tx.rate_to_base_actual != null ? Number(tx.rate_to_base_actual) : null
    ) || 0;
  };
  FallbackCurrencyService.prototype.displayAmount = function (tx, targetCurrency) {
    if (!tx) return 0;
    var txCurrency = tx.currency || 'EUR';
    var baseCurrency = tx.base_currency || 'EUR';
    if (targetCurrency === txCurrency) return Number(tx.amount);
    if (targetCurrency === baseCurrency) return this.toBase(tx);
    var baseAmount = this.toBase(tx);
    var converted = this.convert(baseAmount, baseCurrency, targetCurrency, tx.date);
    // Fall back to the base amount when the exchange rate is unavailable, so
    // the UI never shows 0 for a real transaction (e.g. offline, or before
    // today's rates have been fetched).
    return converted != null ? converted : baseAmount;
  };
  FallbackCurrencyService.prototype.convert = function (amount, fromCurrency, toCurrency, date) {
    if (fromCurrency === toCurrency) return amount;
    var rate = this.getRate(fromCurrency, toCurrency, date);
    if (rate == null || rate === 0) return null;
    return this.round(amount * rate, 4);
  };
  FallbackCurrencyService.prototype.sumInCurrency = function (transactions, targetCurrency) {
    if (!Array.isArray(transactions)) return 0;
    var self = this;
    return transactions.reduce(function (sum, tx) { return sum + self.displayAmount(tx, targetCurrency); }, 0);
  };
  FallbackCurrencyService.prototype.setManualRate = function (base, quote, date, rate) {
    var dateKey = this.toDateKey(date) || new Date().toISOString().slice(0, 10);
    this.rateCache.set(base + '_' + quote + '_' + dateKey, { rate: Number(rate), source: 'manual', fetched_at: Date.now() });
    if (this._manualRateSink) this._manualRateSink(base, quote, dateKey, rate);
  };
  FallbackCurrencyService.prototype.correctActualAmount = function (tx, actualAmountInBase) {
    if (!tx || actualAmountInBase == null || actualAmountInBase <= 0) return tx;
    var amount = Number(tx.amount);
    tx.rate_to_base_actual = this.round(amount / actualAmountInBase, 8);
    tx.amount_base = this.computeAmountBase(amount, tx.currency || 'EUR', tx.base_currency || 'EUR', tx.date, tx.rate_to_base_actual);
    tx.rate_source = 'manual';
    // Keep fx_snapshot.rate consistent with the corrected actual rate so that
    // displayAmount (which prefers fx_snapshot.rate) matches amount_base/toBase.
    if (tx.fx_snapshot && typeof tx.fx_snapshot === 'object') {
      tx.fx_snapshot.rate = tx.rate_to_base_actual;
      tx.fx_snapshot.source = 'manual';
    }
    return tx;
  };
  FallbackCurrencyService.prototype.conversionStatus = function (tx) {
    if (!tx) return 'confirmed';
    var source = tx.rate_source || 'api';
    if (source === 'manual') return 'manual';
    if (source === 'cached') return 'estimate';
    return 'confirmed';
  };
  FallbackCurrencyService.prototype.fetchTodayRates = function () { return Promise.resolve(false); };
  FallbackCurrencyService.prototype.setRateProvider = function (fn) { this._rateProvider = fn; };
  FallbackCurrencyService.prototype.setRatePersist = function (fn) { this._ratePersist = fn; };
  FallbackCurrencyService.prototype.setManualRateSink = function (fn) { this._manualRateSink = fn; };
  FallbackCurrencyService.prototype.isEnabled = function () {
    try { return localStorage.getItem('multi_currency_enabled') === 'true'; } catch (e) { return false; }
  };
  FallbackCurrencyService.prototype.setEnabled = function (val) {
    try { localStorage.setItem('multi_currency_enabled', val ? 'true' : 'false'); } catch (e) { /* ignore */ }
  };

  // Install the complete inline fallback as window.CurrencyService.
  function installFallback() {
    window.CurrencyService = new FallbackCurrencyService();
  }

  // 1) If a COMPLETE CurrencyService is already present (loaded by index.html),
  //    use it as-is.
  if (typeof window !== 'undefined' && isComplete(window.CurrencyService)) {
    return;
  }

  try {
    // 2) Otherwise, synchronously load the real service (classic script tags
    //    block). NOTE: appendChild does NOT block, so we cannot rely on the
    //    global being set synchronously here — we re-check after the load and
    //    fall through to the inline fallback if it still isn't complete.
    var s = document.createElement('script');
    s.src = 'js/CurrencyService.js';
    document.head.appendChild(s);
    if (isComplete(window.CurrencyService)) return;
  } catch (e) { /* fall through to inline fallback */ }

  // Install the fallback synchronously so window.CurrencyService is ALWAYS
  // complete before any app code runs.
  installFallback();

  // 3) Self-healing watchdog: the async js/CurrencyService.js load above may
  //    complete AFTER this guard and its export may clobber window.CurrencyService
  //    with a stale/incomplete instance (e.g. an old cached file that lacks
  //    isEnabled and predates the self-healing export). Re-verify shortly after
  //    the load and re-install the complete fallback if it was clobbered. This
  //    guarantees "CurrencyService.isEnabled is not a function" can NEVER occur.
  if (typeof window !== 'undefined' && window.document) {
    var watchdogTimer = setTimeout(function () {
      if (!isComplete(window.CurrencyService)) {
        installFallback();
      }
    }, 0);
    // Also re-check after the async script has had a chance to execute.
    var watchdogTimer2 = setTimeout(function () {
      if (!isComplete(window.CurrencyService)) {
        installFallback();
      }
    }, 250);
    // Keep the timers from keeping the page alive in tests.
    if (watchdogTimer && watchdogTimer.unref) watchdogTimer.unref();
    if (watchdogTimer2 && watchdogTimer2.unref) watchdogTimer2.unref();
  }
})();

// Global error boundary: Logs diagnostics without showing blocking modal alerts
window.onerror = function (message, source, lineno, colno, error) {
  console.error("Global Error Boundary Caught:", message, "at", source, ":", lineno, ":", colno, error);
};

window.addEventListener('unhandledrejection', function (event) {
  console.error("Unhandled Rejection:", event.reason);
  try {
    if (event.reason && event.reason.stack) {
      console.error("Unhandled Rejection STACK:\n" + event.reason.stack);
    }
  } catch (e) { /* best-effort logging */ }
});

window.autocompleteJustSelected = false;

// HTML Escaping Utility to prevent XSS
// NOTE: A legacy one-time cache clear (clear_duplicates_v3) that purged the
// offline_transactions cache to remove duplicated local transactions was removed here.
// It was a migration workaround that already executed for all existing users (guarded
// by the clear_duplicates_v3 flag), and it risked wiping a user's offline cache on a
// fresh install. Duplicate handling is now covered by cleanDuplicateTransactions.

// Money Manager App - Rebuilt based on actual Excel data structure
// Excel columns: Date | Account | Category | Subcategory | Note | EUR | Income/Expense | Description | Amount | Currency | Account


// (CATEGORY_EMOJI_MAP, DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS moved to js/constants.js)

// Recently-saved transaction IDs that must survive a re-fetch race AND an app
// reload (OTA deploy, cold start). When a logged-in user saves a transaction, it
// gets a valid UUID + user_id and is dequeued from the sync queue right after a
// successful cloud upsert. If loadData() re-fetches from the cloud before that
// write has propagated, getPendingLocalTransactions() would NOT preserve it (valid
// UUID, user_id set, not in queue) and the transaction would be silently dropped.
//
// FIX (data loss on deploy): Persisted to localStorage so the grace window
// survives app reloads. Extended to 5 minutes to cover OTA reload propagation.
const _RECENTLY_SAVED_LS_KEY = 'recently_saved_tx_ids';
const _RECENTLY_SAVED_GRACE_MS = 5 * 60 * 1000; // 5 minutes (was 60s — too short for OTA)
const _recentlySavedTxIds = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem(_RECENTLY_SAVED_LS_KEY) || '{}');
    const now = Date.now();
    const valid = {};
    for (const [id, ts] of Object.entries(stored)) {
      if (now - ts < _RECENTLY_SAVED_GRACE_MS) valid[id] = ts;
    }
    // Prune expired entries
    if (Object.keys(valid).length !== Object.keys(stored).length) {
      localStorage.setItem(_RECENTLY_SAVED_LS_KEY, JSON.stringify(valid));
    }
    return new Set(Object.keys(valid));
  } catch (_) { return new Set(); }
})();
function _markRecentlySaved(id) {
  if (!id) return;
  const idStr = String(id);
  _recentlySavedTxIds.add(idStr);
  try {
    const stored = JSON.parse(localStorage.getItem(_RECENTLY_SAVED_LS_KEY) || '{}');
    stored[idStr] = Date.now();
    localStorage.setItem(_RECENTLY_SAVED_LS_KEY, JSON.stringify(stored));
  } catch (_) { }
  setTimeout(() => {
    _recentlySavedTxIds.delete(idStr);
    try {
      const stored = JSON.parse(localStorage.getItem(_RECENTLY_SAVED_LS_KEY) || '{}');
      delete stored[idStr];
      localStorage.setItem(_RECENTLY_SAVED_LS_KEY, JSON.stringify(stored));
    } catch (_) { }
  }, _RECENTLY_SAVED_GRACE_MS);
}

// App State
const state = {
  isLoggingOut: false,
  transactions: [],
  trashTransactions: [],
  accounts: [],
  categories: [],
  notes: [],
  activeTab: 'trans',
  hasInitialScrollDone: false,
  syncStatus: 'offline',
  selectedYear: new Date().getFullYear(),
  selectedMonth: new Date().getMonth(),
  overviewYear: new Date().getFullYear(),
  statsType: 'expense',
  statsPeriodType: 'monthly',
  statsDate: new Date(),
  statsCustomStart: new Date().toISOString().split('T')[0],
  statsCustomEnd: new Date().toISOString().split('T')[0],
  supabaseConfig: { url: 'https://nnatvvahoeiemkfmzpwp.supabase.co', key: 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp' },
  isSupabaseEnabled: true,
  excelData: null,
  excelColumns: [],
  supabaseClient: null,
  session: null,
  monthPickerYear: new Date().getFullYear(),
  selectionMode: false,
  selectedIds: new Set(),
  searchSelectMode: false,
  selectedSearchIds: new Set(),
  lang: (function () {
    if (localStorage.getItem('app_lang_user_set') === 'true' && localStorage.getItem('app_lang')) {
      return localStorage.getItem('app_lang');
    }
    const saved = localStorage.getItem('app_lang');
    if (saved) return saved;
    const isGreekBrowser = (navigator.language || navigator.userLanguage || '').toLowerCase().startsWith('el');
    return isGreekBrowser ? 'el' : 'en';
  })(),
  userProfile: null,
  partnerProfile: null,
  familyProfiles: [],
  activeAccountMode: localStorage.getItem('account_view_mode') || 'family',
  selectedFamilyMemberId: localStorage.getItem('selected_family_member_id') || 'all',
  historyPushed: false,
  expandedStatsCategories: new Set(),
  statsSubtab: 'breakdown',
  activeSubcategoryTransactions: null,
  isSwipingMonth: false,
  lastSwipeTime: 0,
  recurringTemplates: [],
  deletedRecurringDates: [],
  lastOpenedTransactionId: null,
  notifications: [],
};

// Expose state on window so the desktop web UI layer (web-ui.js) can read it.
// NOTE: `state` is a top-level `const`, which does NOT become a window property
// automatically (unlike `var`/`function`). web-ui.js reads window.state, so we
// bind it explicitly here.
window.state = state;

// ============================================================
// PREMIUM (Lifetime) — entitlement helpers & limits
// ============================================================
// Premium limits & pricing are defined authoritatively in js/PremiumService.js
// and exposed globally as window.PremiumService / window.PREMIUM_LIMITS.
const PREMIUM_LIMITS = (typeof window !== 'undefined' && window.PremiumService)
  ? window.PremiumService.LIMITS
  : {
      familyMembers: 2,        // Free: user + 1. Premium: unlimited (3+)
      cloudTxPerMonth: 75,     // Free: 75 cloud-synced tx/month. Premium: unlimited
      currencies: 1,           // Free: 1 currency. Premium: unlimited
      budgets: 2,              // Free: 2 category budgets. Premium: unlimited
      aiCoachFree: 10,         // Free: 10 online AI calls/month
      aiCoachPremium: 50,      // Premium: 50 online AI calls/month (fair-use)
      aiReceiptsFree: 5,       // Free: 5 AI receipt scans/month
      aiReceiptsPremium: 100   // Premium: 100 AI receipt scans/month (fair-use)
    };

// Premium price (one-time Lifetime). Sourced from PremiumService.
const PREMIUM_PRICE_EUR = (typeof window !== 'undefined' && window.PremiumService)
  ? window.PremiumService.PRICE_EUR
  : 9.99;

// Returns true if the current user has an active Premium entitlement.
// Source of truth is the server profile (state.userProfile.premium_active).
// localStorage is only a cache for faster UI; it is NOT a security boundary.
function isPremium() {
  // If connected to family, 1 license covers the whole household
  if (state.familyProfiles && state.familyProfiles.length > 0) {
    const anyFamilyPro = state.familyProfiles.some(m => m.premium_active === true);
    if (anyFamilyPro) return true;
  }
  if (typeof window !== 'undefined' && window.PremiumService) {
    return window.PremiumService.isPremium(state.userProfile);
  }
  const p = state.userProfile;
  return !!(p && p.premium_active === true);
}

// Returns the current user's premium status for UI display.
function getPremiumStatus() {
  if (typeof window !== 'undefined' && window.PremiumService) {
    return window.PremiumService.getPremiumStatus(state.userProfile);
  }
  return {
    active: isPremium(),
    purchasedAt: state.userProfile ? state.userProfile.premium_purchased_at : null
  };
}

// Shows the Premium upgrade modal (used by all gated features).
// If the user is already premium, does nothing.
function requirePremium(featureKey) {
  if (isPremium()) return true;
  if (typeof openPremiumModal === 'function') {
    openPremiumModal(featureKey);
  }
  return false;
}

// ---------------------------------------------------------------------------
// BACKEND API ENDPOINT RESOLVER
// Resolves relative API routes (/api/...) to the Cloudflare Pages backend
// when running inside Capacitor (native Android/iOS) or local environment.
// ---------------------------------------------------------------------------
function getBackendApiUrl(endpoint) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  const isCapacitorOrLocal = (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
    window.location.protocol === 'capacitor:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  const base = isCapacitorOrLocal ? 'https://budget-assistant-pwa.pages.dev' : '';
  return `${base}${cleanEndpoint}`;
}

// ---------------------------------------------------------------------------
// AI COACH USAGE (client-side helper)
// Only ONLINE advisor calls count toward the fair-use limit (they cost money).
// The offline NLP fallback is free and unlimited for everyone.
// The authoritative enforcement happens server-side in functions/api/ai.js;
// this client-side helper is used for UX (showing the upgrade modal early).
// ---------------------------------------------------------------------------

// Returns the current month's online AI call count for the logged-in user,
// or null when not authenticated (guest mode) / the RPC is unavailable.
async function getAiUsageCount() {
  try {
    if (!state.supabaseClient || !state.currentUser) return null;
    const { data, error } = await state.supabaseClient.rpc('get_ai_usage');
    if (error) return null;
    return typeof data === 'number' ? data : null;
  } catch (e) {
    return null;
  }
}

// Returns the online AI call limit for the current user (10 free / 50 premium).
function getAiUsageLimit() {
  return isPremium() ? PREMIUM_LIMITS.aiCoachPremium : PREMIUM_LIMITS.aiCoachFree;
}

// Checks whether the user may make another online AI call. Returns true if
// allowed. If at the limit, shows the upgrade modal + toast and returns false.
async function canUseOnlineAI() {
  const limit = getAiUsageLimit();
  const usage = await getAiUsageCount();
  // If we cannot determine usage (guest/offline), allow the call — the
  // server-side enforcement still protects the limit for authenticated users.
  if (usage == null) return true;
  if (usage < limit) return true;
  if (typeof openPremiumModal === 'function') openPremiumModal('ai');
  showSyncToast(
    state.lang === 'el'
      ? `Έχετε φτάσει το μηνιαίο όριο του Online AI Coach (${limit}). Αναβαθμίστε σε Premium για 50/μήνα.`
      : `You have reached your monthly Online AI Coach limit (${limit}). Upgrade to Premium for 50/month.`,
    5000
  );
  return false;
}
// mapTemplateToDb → extracted to js/recurringMappers.js (Phase 2, Extraction 2)
// mapTemplateFromDb → extracted to js/recurringMappers.js (Phase 2, Extraction 2)

function mapTransactionToDb(t) {
  if (!t) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const id = (t.id && uuidRegex.test(String(t.id))) ? String(t.id) : (typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID());
  const userId = t.user_id || (state.currentUser ? state.currentUser.id : null);
  const familyId = t.family_id || (state.userProfile ? state.userProfile.family_id : null);

  const dbTx = {
    id,
    user_id: userId,
    date: t.date ? String(t.date).slice(0, 19).replace(' ', 'T').slice(0, 10) : new Date().toISOString().slice(0, 10),
    type: (t.type === 'income' || t.type === 'transfer') ? t.type : 'expense',
    amount: parseFloat(t.amount) || 0,
    category: t.category || '',
    subcategory: t.subcategory || '',
    account_from: t.account_from || '',
    account_to: t.type === 'transfer' ? (t.account_to || null) : null,
    note: t.note || '',
    status: t.status === 'deleted' ? 'deleted' : 'active'
  };

  if (familyId) dbTx.family_id = familyId;
  if (t.recurring_template_id && uuidRegex.test(String(t.recurring_template_id))) {
    dbTx.recurring_template_id = t.recurring_template_id;
  }
  if (t.currency) dbTx.currency = t.currency;
  if (t.base_currency) dbTx.base_currency = t.base_currency;
  if (t.rate_to_base !== undefined && t.rate_to_base !== null) dbTx.rate_to_base = t.rate_to_base;
  if (t.amount_base !== undefined && t.amount_base !== null) dbTx.amount_base = t.amount_base;
  if (t.rate_source) dbTx.rate_source = t.rate_source;
  if (t.rate_to_base_actual !== undefined && t.rate_to_base_actual !== null) dbTx.rate_to_base_actual = t.rate_to_base_actual;
  if (t.rate_fetched_at) dbTx.rate_fetched_at = t.rate_fetched_at;
  if (t.transfer_id && uuidRegex.test(String(t.transfer_id))) dbTx.transfer_id = t.transfer_id;
  if (t.transfer_rate !== undefined && t.transfer_rate !== null) dbTx.transfer_rate = t.transfer_rate;

  if (t.created_at) dbTx.created_at = t.created_at;
  if (t.updated_at) dbTx.updated_at = t.updated_at;
  if (t.deleted_at) dbTx.deleted_at = t.deleted_at;
  if (t.deleted_by) dbTx.deleted_by = t.deleted_by;

  return dbTx;
}
window.mapTransactionToDb = mapTransactionToDb;

function mergeAndDeduplicateTemplates(cloudTemplates = [], localTemplates = []) {
  const templateMap = new Map();

  // 1. First add all cloud templates
  (cloudTemplates || []).forEach(t => {
    if (t && t.id) {
      templateMap.set(String(t.id), t);
    }
  });

  // 2. Identify sync queue state
  const queueStr = localStorage.getItem('money_manager_sync_queue');
  const queuedTemplateIds = new Set();
  const deletedTemplateIds = new Set();
  if (queueStr) {
    try {
      const q = JSON.parse(queueStr) || [];
      q.forEach(item => {
        if (!item) return;
        if (item.action === 'save_template' && item.payload && item.payload.id) {
          queuedTemplateIds.add(String(item.payload.id));
        } else if (item.action === 'delete_template') {
          deletedTemplateIds.add(String(item.payload.id || item.payload));
        }
      });
    } catch (e) { }
  }

  // 3. Merge local templates: keep if not in cloud yet, or if queued for save
  (localTemplates || []).forEach(t => {
    if (!t || !t.id) return;
    const idStr = String(t.id);
    if (deletedTemplateIds.has(idStr)) return;

    if (!templateMap.has(idStr) || queuedTemplateIds.has(idStr)) {
      templateMap.set(idStr, t);
    }
  });

  // 4. Remove any template that has a pending delete
  deletedTemplateIds.forEach(delId => {
    templateMap.delete(delId);
  });

  // 5. Deduplicate by content (note/title + amount + type + category + preset)
  const normStr = (s) => (typeof normalizeGreekString === 'function') ? normalizeGreekString(s || '') : String(s || '').toLowerCase().trim();
  const rawList = Array.from(templateMap.values());
  const deduped = [];
  const removedDuplicateTemplateIds = new Set();

  rawList.forEach(t => {
    if (!t) return;
    const tNote = normStr(t.note || t.description || t.title || '');
    const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
    const tType = t.type;
    const tCat = t.category;
    const tPreset = t.preset || 'custom';

    const matchIdx = deduped.findIndex(other => {
      if (!other) return false;
      if (String(t.id) === String(other.id)) return true;
      const oNote = normStr(other.note || other.description || other.title || '');
      const oAmount = (parseFloat(other.amount) || 0).toFixed(2);
      const oType = other.type;
      const oCat = other.category;
      const oPreset = other.preset || 'custom';

      const sameNote = (tNote.length > 0 && oNote.length > 0) ? (tNote === oNote) : (tNote.length === 0 && oNote.length === 0);
      const sameAmount = tAmount === oAmount;
      const sameType = tType === oType;
      const sameCat = (typeof isSameCategory === 'function') ? isSameCategory(tCat, oCat) : (tCat === oCat);
      const samePreset = tPreset === oPreset;

      return sameNote && sameAmount && sameType && sameCat && samePreset;
    });

    if (matchIdx === -1) {
      deduped.push(t);
    } else {
      if (t.id) removedDuplicateTemplateIds.add(String(t.id));
    }
  });

  // If duplicate templates were removed, purge synthetic occurrences belonging to the duplicate IDs
  if (removedDuplicateTemplateIds.size > 0 && typeof state !== 'undefined' && Array.isArray(state.transactions)) {
    state.transactions = state.transactions.filter(tx => !removedDuplicateTemplateIds.has(String(tx.recurring_template_id)));
  }

  return deduped;
}
window.mergeAndDeduplicateTemplates = mergeAndDeduplicateTemplates;

// (NEON_PALETTE moved to js/constants.js)

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(navigator.userAgent);

function ensureHistoryPushed() {
  if (!state.historyPushed) {
    history.pushState({ appState: 'active' }, '', window.location.pathname + window.location.search);
    state.historyPushed = true;
  }
}
// getTransactionTime → extracted to js/transactionSorting.js (Phase 2, Extraction 3)
// compareTransactions → extracted to js/transactionSorting.js (Phase 2, Extraction 3)

const _deletingTxIds = new Set();

// IDs that were successfully deleted from the cloud within the last 30 seconds.
// This prevents a race condition where loadData() fetches from Supabase before
// the DB deletion has propagated, bringing deleted transactions back.
//
// FIX (data loss on deploy): Persisted to localStorage so the guard window
// survives app reloads / OTA / cold start — symmetric with _recentlySavedTxIds.
// Without this, a delete followed by an immediate reload could re-fetch the
// still-propagating soft-deleted row and resurrect it in the active list.
const _RECENTLY_DELETED_LS_KEY = 'recently_deleted_tx_ids';
const _RECENTLY_DELETED_GRACE_MS = 30 * 1000; // 30 seconds
const _recentlyDeletedTxIds = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem(_RECENTLY_DELETED_LS_KEY) || '{}');
    const now = Date.now();
    const valid = {};
    for (const [id, ts] of Object.entries(stored)) {
      if (now - ts < _RECENTLY_DELETED_GRACE_MS) valid[id] = ts;
    }
    // Prune expired entries
    if (Object.keys(valid).length !== Object.keys(stored).length) {
      localStorage.setItem(_RECENTLY_DELETED_LS_KEY, JSON.stringify(valid));
    }
    return new Set(Object.keys(valid));
  } catch (_) { return new Set(); }
})();
function _markRecentlyDeleted(id) {
  if (!id) return;
  const idStr = String(id);
  _recentlyDeletedTxIds.add(idStr);
  try {
    const stored = JSON.parse(localStorage.getItem(_RECENTLY_DELETED_LS_KEY) || '{}');
    stored[idStr] = Date.now();
    localStorage.setItem(_RECENTLY_DELETED_LS_KEY, JSON.stringify(stored));
  } catch (_) { }
  setTimeout(() => {
    _recentlyDeletedTxIds.delete(idStr);
    try {
      const stored = JSON.parse(localStorage.getItem(_RECENTLY_DELETED_LS_KEY) || '{}');
      delete stored[idStr];
      localStorage.setItem(_RECENTLY_DELETED_LS_KEY, JSON.stringify(stored));
    } catch (_) { }
  }, _RECENTLY_DELETED_GRACE_MS);
}

function deduplicateCategories() {
  if (!state.categories) return;
  const seen = new Set();
  state.categories = state.categories.filter(c => {
    if (!c || !c.name) return false;
    const key = `${c.type || 'expense'}|${c.name.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeAndDeduplicateTransactions(cloudTransactions, localPendingTransactions) {
  // DATA-INTEGRITY: Deduplication is performed ONLY by primary key `id`
  // (provable identity). Content-based "duplicate" matching was REMOVED because
  // two legitimate, distinct transactions can be identical in every visible
  // field (same date/amount/category/note) — collapsing them destroys real
  // financial data. See js/transactionMerge.js for the tested implementation.
  const deps = {
    deletingTxIds: (typeof _deletingTxIds !== 'undefined' && _deletingTxIds) ? _deletingTxIds : null,
    recentlyDeletedTxIds: (typeof _recentlyDeletedTxIds !== 'undefined' && _recentlyDeletedTxIds) ? _recentlyDeletedTxIds : null,
    syncQueue: readSyncQueueForMerge(),
    // DATA-INTEGRITY FIX: exclude permanently-deleted / trashed IDs from the
    // merge so cachedMissingFromCloud can never reintroduce them into state.
    permanentlyDeletedTxIds: (typeof collectPermanentlyDeletedTxIds === 'function') ? collectPermanentlyDeletedTxIds() : null,
  };
  return window.TransactionMerge.mergeAndDeduplicateTransactions(cloudTransactions, localPendingTransactions, deps);
}

function readSyncQueueForMerge() {
  try {
    const queueStr = localStorage.getItem('money_manager_sync_queue');
    if (queueStr) {
      return JSON.parse(queueStr) || [];
    }
  } catch (e) {
    console.error('Failed to parse sync queue in mergeAndDeduplicateTransactions:', e);
  }
  return [];
}


// (GREEK_MONTHS moved to js/constants.js)
const GREEK_MONTHS_SHORT = [
  'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'
];
const GREEK_WEEKDAYS_SHORT = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'];

// (ENGLISH_MONTHS moved to js/constants.js)
const ENGLISH_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];
const ENGLISH_WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Pending receipt files for the current transaction form session
let _pendingReceiptFiles = [];
let _pendingReceiptDeleted = false;
try {
  Object.defineProperty(window, '_pendingReceiptFiles', {
    get: () => _pendingReceiptFiles,
    set: (v) => { _pendingReceiptFiles = v; },
    configurable: true
  });
  Object.defineProperty(window, '_pendingReceiptDeleted', {
    get: () => _pendingReceiptDeleted,
    set: (v) => { _pendingReceiptDeleted = v; },
    configurable: true
  });
} catch (e) {
  window._pendingReceiptFiles = _pendingReceiptFiles;
  window._pendingReceiptDeleted = _pendingReceiptDeleted;
}
let _pendingRecurringSettings = { isActive: false, days: [], months: [], years: [], preset: 'monthly' };

// (DEFAULT_SUBCATEGORIES_MAP moved to js/constants.js)

function getMonthName(index, short = false) {
  if (state.lang === 'en') {
    return short ? ENGLISH_MONTHS_SHORT[index] : ENGLISH_MONTHS[index];
  }
  return short ? GREEK_MONTHS_SHORT[index] : GREEK_MONTHS[index];
}

function getWeekdayName(index) {
  return state.lang === 'en' ? ENGLISH_WEEKDAYS_SHORT[index] : GREEK_WEEKDAYS_SHORT[index];
}

// Normalize a version value to its numeric build number so comparisons and
// labels work with BOTH the plain numeric format (1615) and the Capgo OTA
// format ("1.0.1615" -> 1615). Returns -1 when the value is not a version.
function parseBuildNumber(v) {
  if (v == null) return -1;
  var n = parseInt(String(v).split('.').pop(), 10);
  return isNaN(n) ? -1 : n;
}

// Returns the active build label for the version display.
// Reads window.OTA_ACTIVE_VERSION (set by the boot loader after OTA load),
// falling back to the bundled CURRENT_BUILD constant from index.html.
function getActiveBuildLabel() {
  var active = (typeof window.OTA_ACTIVE_VERSION !== 'undefined' && window.OTA_ACTIVE_VERSION != null)
    ? window.OTA_ACTIVE_VERSION : null;
  var bundled = (typeof CURRENT_BUILD !== 'undefined') ? CURRENT_BUILD : null;
  var activeBuild = parseBuildNumber(active);
  var build = (activeBuild > 0) ? activeBuild : bundled;
  var label = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[state.lang])
    ? TRANSLATIONS[state.lang]['app_version'] : null;
  if (label && build != null) {
    label = label.replace(/v\d+/, 'v' + build);
  }
  return label || ('Έκδοση 1.0.0 (build v' + (build != null ? build : '?') + ')');
}
window.getActiveBuildLabel = getActiveBuildLabel;

function applyLanguage(lang) {
  state.lang = lang;
  localStorage.setItem('app_lang', lang);

  // Update DOM elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    // The app_version label is dynamic (reflects the active OTA/bundled build).
    const translation = key === 'app_version' ? getActiveBuildLabel() : (TRANSLATIONS[lang] ? TRANSLATIONS[lang][key] : null);
    if (translation) {
      if (el.children.length === 0) {
        el.textContent = translation;
      } else {
        let updated = false;
        for (let i = 0; i < el.childNodes.length; i++) {
          const node = el.childNodes[i];
          if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '') {
            node.nodeValue = translation;
            updated = true;
            break;
          }
        }
        if (!updated) {
          el.textContent = translation;
        }
      }
    }
  });

  // Update DOM elements with data-i18n-html
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const translation = TRANSLATIONS[lang] ? TRANSLATIONS[lang][key] : null;
    if (translation) el.innerHTML = translation;
  });

  // Update elements with data-i18n-title
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const translation = TRANSLATIONS[lang] ? TRANSLATIONS[lang][key] : null;
    if (translation) el.title = translation;
  });

  // Update elements with data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translation = TRANSLATIONS[lang] ? TRANSLATIONS[lang][key] : null;
    if (translation) el.placeholder = translation;
  });

  // Update settings subscreen title and subtitle if active
  const titleEl = document.getElementById('settings-subscreen-title');
  if (titleEl && window._currentSettingsSubscreenTitleKey) {
    const titleKey = window._currentSettingsSubscreenTitleKey;
    titleEl.textContent = (TRANSLATIONS[lang] && TRANSLATIONS[lang][titleKey]) || titleKey;
  }
  const subtitleEl = document.getElementById('settings-subscreen-subtitle');
  if (subtitleEl && window._currentSettingsSubscreenId) {
    const subscreenMeta = {
      preferences: 'settings_pref_desc',
      notifications: 'settings_notif_desc',
      sync: 'settings_data_desc',
      security: 'settings_security_desc',
      family: 'settings_family_desc',
      legal: 'settings_legal_desc',
      feedback: 'settings_feedback_desc'
    };
    const subKey = subscreenMeta[window._currentSettingsSubscreenId];
    if (subKey && TRANSLATIONS[lang] && TRANSLATIONS[lang][subKey]) {
      subtitleEl.textContent = TRANSLATIONS[lang][subKey];
    }
  }

  // Update Settings Summary Displays (Font size, week start, auto lock, etc.)
  if (typeof updateSettingsDisplay === 'function') {
    updateSettingsDisplay();
  }

  // Update Language Settings UI value
  const langValEl = document.getElementById('lang-setting-val');
  if (langValEl) {
    langValEl.textContent = lang === 'en' ? '🇬🇧 English' : '🇬🇷 Ελληνικά';
  }

  // Update auth overlay lang pills active class
  const authLangEl = document.getElementById('auth-lang-el');
  const authLangEn = document.getElementById('auth-lang-en');
  if (authLangEl && authLangEn) {
    authLangEl.classList.toggle('active', lang === 'el');
    authLangEn.classList.toggle('active', lang === 'en');
  }

  // Update Header Language Button flag and label
  const headerFlag = document.getElementById('header-lang-flag');
  const headerLabel = document.getElementById('header-lang-label');
  if (headerFlag && headerLabel) {
    headerFlag.textContent = lang === 'en' ? '🇬🇧' : '🇬🇷';
    headerLabel.textContent = lang === 'en' ? 'EN' : 'EL';
  }

  // Update Header Profile Badge (includes Guest / User names and badges)
  if (typeof updateHeaderProfileBadge === 'function') {
    updateHeaderProfileBadge();
  }

  // Re-render UI dynamic elements and screens
  if (typeof updateUI === 'function') {
    updateUI();
  }

  if (typeof translateNotepadUI === 'function') {
    translateNotepadUI();
  }

  // Update OTA diagnostic (shows active build source)
  if (typeof updateOTADiagnostic === 'function') {
    updateOTADiagnostic();
  }
}

// OTA diagnostic: shows which build is actually active (bundled vs OTA).
// Reads window.OTA_ACTIVE_VERSION (set by the boot loader after OTA load)
// and CURRENT_BUILD (the bundled build constant from index.html).
function updateOTADiagnostic() {
  var diag = document.getElementById('ota-diagnostic');
  if (!diag) return;
  var activeEl = document.getElementById('ota-diag-active');
  var bundledEl = document.getElementById('ota-diag-bundled');
  var sourceEl = document.getElementById('ota-diag-source');
  var active = (typeof window.OTA_ACTIVE_VERSION !== 'undefined' && window.OTA_ACTIVE_VERSION != null)
    ? window.OTA_ACTIVE_VERSION : 'none';
  var bundled = (typeof CURRENT_BUILD !== 'undefined') ? CURRENT_BUILD : '?';
  var source = (active !== 'none' && parseBuildNumber(active) > parseBuildNumber(bundled))
    ? 'OTA (IndexedDB)'
    : 'Bundled (APK)';
  if (activeEl) activeEl.textContent = 'v' + active;
  if (bundledEl) bundledEl.textContent = 'v' + bundled;
  if (sourceEl) sourceEl.textContent = source;
  diag.style.display = 'block';
  // NOTE: Do NOT call applyLanguage() here. applyLanguage() already calls
  // updateOTADiagnostic() at its end, so calling it back here would create
  // infinite mutual recursion -> "Maximum call stack size exceeded".
  // The version display label is already refreshed by applyLanguage() itself
  // via getActiveBuildLabel().
}
window.updateOTADiagnostic = updateOTADiagnostic;

function toggleLanguageSetting() {
  const nextLang = state.lang === 'el' ? 'en' : 'el';
  localStorage.setItem('app_lang_user_set', 'true');
  applyLanguage(nextLang);
  const msg = nextLang === 'en' ? '🇬🇧 Switched to English' : '🇬🇷 Αλλαγή σε Ελληνικά';
  showSyncToast(msg, 2500);
}
window.toggleLanguageSetting = toggleLanguageSetting;
window.applyLanguage = applyLanguage;

async function detectGeoLanguage() {
  // If user has explicitly chosen a language, respect their preference
  if (localStorage.getItem('app_lang_user_set') === 'true') {
    return;
  }
  try {
    const res = await fetch('/api/geo', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.recommendedLang && data.recommendedLang !== state.lang) {
        console.log('[Geo-IP] Detected country:', data.country, '-> updating language to:', data.recommendedLang);
        applyLanguage(data.recommendedLang);
      }
    }
  } catch (e) {
    console.warn('[Geo-IP] Detection error:', e);
  }
}
window.detectGeoLanguage = detectGeoLanguage;

function formatGreekDateTime(dateStr) {
  if (!dateStr) return '';
  const dateObj = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(dateObj.getTime())) return dateStr;

  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();
  const dayOfWeek = dateObj.getDay();
  const hrs = String(dateObj.getHours()).padStart(2, '0');
  const mins = String(dateObj.getMinutes()).padStart(2, '0');

  const shortYear = String(y).slice(-2);
  const shortDay = getWeekdayName(dayOfWeek);

  return `${d}/${m}/${shortYear} (${shortDay}) ${hrs}:${mins}`;
}
// evaluateCalcBuffer → extracted to js/calcKeypad.js (Phase 2, Extraction 1)
// hasPendingMathOperator → extracted to js/calcKeypad.js (Phase 2, Extraction 1)

function updateKeypadDoneButton() {
  const doneBtn = document.getElementById('calc-done-btn');
  const liveFormula = document.getElementById('calc-live-formula');
  const buf = state.calcBuffer || '';
  const isExpression = hasPendingMathOperator(buf);

  if (liveFormula) {
    if (isExpression) {
      const evaluated = evaluateCalcBuffer(buf);
      liveFormula.textContent = `= ${formatCalcDisplay(evaluated)} €`;
      liveFormula.style.display = 'inline';
    } else {
      liveFormula.textContent = '';
      liveFormula.style.display = 'none';
    }
  }

  if (doneBtn) {
    if (isExpression) {
      doneBtn.textContent = '=';
      doneBtn.setAttribute('data-mode', 'equals');
    } else {
      const lang = localStorage.getItem('bg_language') || 'el';
      const label = lang === 'en' ? 'Done' : 'Τέλος';
      doneBtn.textContent = label;
      doneBtn.setAttribute('data-mode', 'done');
    }
  }
}
// formatCalcDisplay → extracted to js/calcKeypad.js (Phase 2, Extraction 1)

// Remove thousands separators ('.' followed by exactly 3 digits) so a formatted
let statsChartInstance = window.statsChartInstance || null;
window.statsChartInstance = statsChartInstance;
if (window.Chart && window.ChartDataLabels) {
  Chart.register(ChartDataLabels);
}

// ============================================================
// STATS DATE AND PERIOD NAVIGATION HELPERS
// ============================================================
function getStatsDateRange() {
  let start, end;
  if (state.statsPeriodType === 'weekly') {
    start = new Date(state.statsDate);
    const day = start.getDay();
    const weekStartDay = parseInt(localStorage.getItem('app_week_start') || '1', 10);
    let diff = day - weekStartDay;
    if (diff < 0) {
      diff += 7;
    }
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);

    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (state.statsPeriodType === 'monthly') {
    const monthStartDay = parseInt(localStorage.getItem('app_month_start') || '1', 10);
    if (monthStartDay === 1) {
      start = new Date(state.statsDate.getFullYear(), state.statsDate.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(state.statsDate.getFullYear(), state.statsDate.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      start = new Date(state.statsDate.getFullYear(), state.statsDate.getMonth(), monthStartDay, 0, 0, 0, 0);
      end = new Date(state.statsDate.getFullYear(), state.statsDate.getMonth() + 1, monthStartDay - 1, 23, 59, 59, 999);
    }
  } else if (state.statsPeriodType === 'annually') {
    start = new Date(state.statsDate.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(state.statsDate.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (state.statsPeriodType === 'period') {
    start = new Date(state.statsCustomStart + 'T00:00:00');
    end = new Date(state.statsCustomEnd + 'T23:59:59');
  }
  return { start, end };
}

function syncStatsDate() {
  state.statsDate.setDate(15);
  state.statsDate.setFullYear(state.selectedYear);
  state.statsDate.setMonth(state.selectedMonth);
}

function formatStatsPeriodTitle(start, end) {
  if (state.statsPeriodType === 'monthly') {
    return `${getMonthName(start.getMonth(), true)} ${start.getFullYear()}`;
  }
  if (state.statsPeriodType === 'annually') {
    return `${start.getFullYear()}`;
  }

  // Weekly or Custom Period
  const startDay = start.getDate();
  const startMonthShort = getMonthName(start.getMonth(), true);
  const startYear = start.getFullYear();

  const endDay = end.getDate();
  const endMonthShort = getMonthName(end.getMonth(), true);
  const endYear = end.getFullYear();

  if (startYear !== endYear) {
    return `${startDay} ${startMonthShort} ${startYear} - ${endDay} ${endMonthShort} ${endYear}`;
  } else if (start.getMonth() !== end.getMonth()) {
    return `${startDay} ${startMonthShort} - ${endDay} ${endMonthShort} ${startYear}`;
  } else {
    return `${startDay} - ${endDay} ${startMonthShort} ${startYear}`;
  }
}

function wrapPeriodTitleWithSpans(titleText) {
  if (!titleText) return '';
  const match = titleText.trim().match(/^(.*?)(?:\s+)?(\d{4})$/);
  if (match && match[1]) {
    const mainPart = match[1].trim();
    const yearPart = match[2];
    return `<span class="month-part">${mainPart}</span><span class="year-part" style="color: var(--text-secondary); margin-left: 6px;">${yearPart}</span>`;
  }
  if (/^\d{4}$/.test(titleText.trim())) {
    return `<span class="year-part">${titleText.trim()}</span>`;
  }
  return `<span class="month-part">${titleText}</span>`;
}

// ============================================================
// EMOJI STRIPPING - handles surrogate pairs correctly
// Excel exports emoji as surrogate pairs (2 UTF-16 code units)
// We need to skip past them to get the Greek text
// ============================================================
function stripLeadingEmoji(str) {
  if (!str) return '';
  let i = 0;
  const codes = [];
  for (let j = 0; j < str.length; j++) {
    codes.push(str.charCodeAt(j));
  }
  while (i < codes.length) {
    const c = codes[i];
    // High surrogate (emoji start)
    if (c >= 0xD800 && c <= 0xDBFF) {
      i += 2; // skip surrogate pair (2 code units)
      // Skip trailing space after emoji
      while (i < codes.length && codes[i] === 0x20) i++;
    }
    // BMP private use area
    else if (c >= 0xE000 && c <= 0xF8FF) {
      i += 1;
      while (i < codes.length && codes[i] === 0x20) i++;
    }
    // BMP symbols / dingbats (like U+2764 heart, etc.)
    else if (c >= 0x2600 && c <= 0x27BF) {
      i += 1;
      while (i < codes.length && codes[i] === 0x20) i++;
    }
    // Variation selector or replacement char
    else if (c === 0xFFFD || (c >= 0xFE00 && c <= 0xFE0F)) {
      i += 1;
      while (i < codes.length && codes[i] === 0x20) i++;
    }
    // Regular character - stop stripping
    else {
      break;
    }
  }
  return str.substring(i).trim();
}

// Get emoji codepoint from first surrogate pair (for category lookup)
function getFirstEmojiCodepoint(str) {
  if (!str || str.length < 2) return null;
  const high = str.charCodeAt(0);
  const low = str.charCodeAt(1);
  if (high >= 0xD800 && high <= 0xDBFF && low >= 0xDC00 && low <= 0xDFFF) {
    const cp = 0x10000 + ((high - 0xD800) * 0x400) + (low - 0xDC00);
    return cp.toString(16).toUpperCase().padStart(5, '0');
  }
  return null;
}

// Resolve category from raw Excel string.
// Strategy: Keep emoji-prefixed names intact to align with user's Excel files.
function resolveCategoryInfo(rawCategory, transType) {
  if (!rawCategory) return null;

  const trimmed = rawCategory.trim();
  const upperName = trimmed.toUpperCase();

  // 1. Find exact match in state.categories
  let cat = state.categories.find(c =>
    c.name && c.name.toUpperCase() === upperName
  );
  if (cat) return cat;

  // 2. Find match in CATEGORY_EMOJI_MAP by codepoint
  const cp = getFirstEmojiCodepoint(trimmed);
  const emojiInfo = cp ? CATEGORY_EMOJI_MAP[cp] : null;
  if (emojiInfo) {
    let mappedCat = state.categories.find(c =>
      c.name && c.name.toUpperCase() === emojiInfo.name.toUpperCase()
    );
    if (mappedCat) return mappedCat;
    return emojiInfo;
  }

  // 3. Not found - return info to create new category
  return {
    name: trimmed,
    type: transType,
    icon: transType === 'income' ? '💰' : '💸',
    color: getRandomColor(),
  };
}

// ============================================================
// NOTIFICATION CENTER & LOCAL NOTIFICATIONS
// Extracted to js/notificationCenter.js (Phase 13D Architectural Extraction)
// ============================================================

// ============================================================
// INIT
// ============================================================
// ============================================================
// App initialization. Runs on DOMContentLoaded, OR immediately if
// DOMContentLoaded has already fired (e.g. when the OTA boot loader
// injects app.js asynchronously via Blob URL AFTER the event fired).
// ============================================================
// COLD-START FADE-IN
// After Android process death / activity recreation, the WebView reloads and
// shows the dark launch background while content renders. This overlay (added
// in index.html) covers the screen with the theme background color and is faded
// out smoothly once the initial content render has painted, so the launch screen
// transitions into the app content without an abrupt black flash.
// ============================================================
// LUXURY SPLASH & COLD-START OVERLAY (smooth branded launch)
// ============================================================
const _splashAppStartTime = (typeof window._pageLoadTimestamp === 'number') ? window._pageLoadTimestamp : Date.now();
let _coldStartFadeDone = false;
// COLD START FIX: On Index cold start the native Android launch window stays on
// screen while the WebView loads index.html + splash.html together, so the branded
// splash is NOT actually visible to the user until considerably later than the
// index.html parse timestamp. The old timer started at _splashAppStartTime
// (index.html), so by the time the splash appeared the 2000ms budget had mostly
// elapsed and the fade-out fired almost immediately by cutting it off abruptly.
// _splashFrameStartMs is recorded by the iframe onload hook in index.html the
// moment the splash sub-document is actually ready to be painted; the countdown
// is anchored to that, so the full mark -> wordmark -> tagline -> loader sequence
// (~1.95s) gets to play out before the handoff begins.
let _splashFrameStartMs = 0;

function _markSplashFrameLoaded() {
  if (!_splashFrameStartMs) _splashFrameStartMs = Date.now();
}
window._markSplashFrameLoaded = _markSplashFrameLoaded;

// LAUNCH-WINDOW-DONE ANCHOR (native Android):
// The native MainActivity signals this the moment its launch window is dismissed
// and the user can actually SEE the WebView (first window focus). The HTML
// splash countdown anchors to the LATEST of (splash-frame-load, launch-window-gone)
// so the animated splash always plays its full sequence once it is truly visible —
// instead of being cut short by a timer that started while the native window
// (system splash on Android 12+) still covered the screen. On web/PWA there is no
// native launch window, so this stays 0 and the iframe onload anchor is used.
// window.__launchGoneAt is set by an inline script in index.html <head> so the
// timestamp survives even if app.js was still loading when the signal arrived.
let _launchWindowGoneMs = 0;
function _markLaunchWindowGone() {
  if (!_launchWindowGoneMs) _launchWindowGoneMs = Date.now();
  if (!window.__launchGoneAt) window.__launchGoneAt = _launchWindowGoneMs;
}
window._markLaunchWindowGone = _markLaunchWindowGone;

function fadeOutColdStartOverlay() {
  if (_coldStartFadeDone) return;
  const frame = document.getElementById('cold-start-frame') || document.getElementById('cold-start-overlay');
  if (!frame) {
    _coldStartFadeDone = true;
    return;
  }

  // Anchor to the real in-page/native load time (fallback: page parse time).
  // On native Android, _launchWindowGoneMs is the moment the native launch window
  // was dismissed and the splash became actually visible to the user — the
  // countdown must start from the LATEST of all candidates (never before the user
  // can see the splash), otherwise the animated splash gets cut short by a timer
  // that started while the native window still covered the screen.
  const anchor = Math.max(
    _splashFrameStartMs || window._splashFrameStartMs || 0,
    _launchWindowGoneMs || window.__launchGoneAt || 0,
    _splashAppStartTime
  );
  const elapsed = Date.now() - anchor;
  // v6_fast splash: full sequence (mark -> wordmark -> tagline -> loader) is ~0.9s.
  // 1500ms lets the loader sweep play briefly before the fade-out starts.
  const minVisibleMs = 1500;
  if (elapsed < minVisibleMs) {
    setTimeout(fadeOutColdStartOverlay, minVisibleMs - elapsed);
    return;
  }

  _coldStartFadeDone = true;
  frame.style.pointerEvents = 'none';
  // Smooth fade-out before removing iframe from DOM
  frame.style.transition = 'opacity 0.45s ease';
  frame.style.opacity = '0';
  setTimeout(() => {
    if (frame.parentNode) frame.parentNode.removeChild(frame);
  }, 450);
}
window.fadeOutColdStartOverlay = fadeOutColdStartOverlay;

// ============================================================
// RESUME OVERLAY (anti blank/black flash on background -> resume)
// ============================================================
// On native Android the WebView surface can be blank for 1-3 frames while it
// recomposites after returning from background. The native MainActivity overlay
// covers that gap at the framework level. This JS overlay is the complementary
// layer: it covers the Web/PWA case (no native layer) and any JS-level re-render
// flash during the resume window. It is shown on resume and faded out after the
// recompositing window so the user never sees a blank/black flash.
let _resumeOverlayTimer = null;
function showResumeOverlay() {
  if (document.documentElement.classList.contains('web-mode')) return; // Web browsers keep DOM alive; no black flash overlay needed
  const overlay = document.getElementById('resume-overlay');
  if (!overlay) return;
  // Sync background to the current theme color in case it changed while backgrounded.
  const savedTheme = localStorage.getItem('app_theme') || 'dark';
  const bgColor = (typeof window.getThemeBgColor === 'function')
    ? window.getThemeBgColor(savedTheme)
    : '#181b22';
  overlay.style.backgroundColor = bgColor;
  // Show instantly (no fade-in) — must be visible before any blank frame.
  overlay.style.transition = 'none';
  overlay.style.opacity = '1';
  overlay.style.visibility = 'visible';
  // Schedule the fade-out (web/PWA only — native hides via JS interface signal).
  if (_resumeOverlayTimer) clearTimeout(_resumeOverlayTimer);
  _resumeOverlayTimer = setTimeout(() => {
    _resumeOverlayTimer = null;
    hideResumeOverlay();
  }, 450);
}
function hideResumeOverlay() {
  const overlay = document.getElementById('resume-overlay');
  if (!overlay) return;
  overlay.style.transition = 'opacity 0.25s ease';
  overlay.style.opacity = '0';
  setTimeout(() => {
    overlay.style.visibility = 'hidden';
  }, 280);
}
window.showResumeOverlay = showResumeOverlay;
window.hideResumeOverlay = hideResumeOverlay;

// CONTENT-PAINTED SIGNAL (native Android): The native MainActivity overlay must
// stay visible until the WebView has actually RENDERED the real UI content
// (transactions, numbers, colors) -- not merely committed a blank first frame.
// A double-rAF alone only confirms the browser committed *a* frame, which may
// still be the blank WebView surface recompositing gap. So we call this ONLY
// after _updateUIImpl() has written the real content into the DOM, then wait a
// double-rAF (so that content frame is composited to screen) plus a small safety
// delay before signalling the native layer to hide the overlay. This guarantees
// the user never sees a black OR a blank/monochrome frame on resume.
function _notifyNativeContentPainted() {
  const _isNativeAndroid = !!(window.Capacitor &&
    window.Capacitor.isNativePlatform &&
    window.Capacitor.isNativePlatform());
  if (!_isNativeAndroid) return;
  if (!window.NativeApp || typeof window.NativeApp.onFirstPaint !== 'function') return;
  // Coalesce multiple render passes in the same resume cycle into one signal.
  // The flag lives on window so _handleAppResumed() can re-arm it each resume.
  if (window._contentPaintNotified) return;
  window._contentPaintNotified = true;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try { window.NativeApp.onFirstPaint(); } catch (e) { /* fail silently */ }
    });
  });
}
window._notifyNativeContentPainted = _notifyNativeContentPainted;

// SAFETY FALLBACK: If initApp() fails before reaching its fade-out trigger
// (and recovery mode doesn't fire), force the cold-start overlay away after a
// maximum delay so it never permanently blocks the UI.
setTimeout(() => {
  fadeOutColdStartOverlay();
}, 5000);

// ============================================================
async function initApp() {
  // NOTE: _appLoaded is intentionally NOT set to true here at the start.
  // It is set to true only AFTER initApp() completes successfully (see the
  // end of this function). This keeps the recovery-mode error handler in
  // index.html armed (it checks `!window._appLoaded`) so that if initApp()
  // throws partway through, the user is shown the Recovery overlay instead
  // of being left stuck in a half-initialized broken state (untranslated nav
  // labels, dead tab switching, frozen scroll) with no way out.
  if (window._startupTimeout) clearTimeout(window._startupTimeout);

  if (isAndroid) {
    document.body.classList.add('is-android');
  }
  if (isIOS) {
    document.body.classList.add('is-ios');

    // Global focusout listener to reset layout viewport panning when any input blurs on iOS
    document.addEventListener('focusout', (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Only reset if focus didn't immediately move to another input/textarea/select
        setTimeout(() => {
          const activeEl = document.activeElement;
          const isAnotherInputFocused = activeEl &&
            (activeEl.tagName === 'INPUT' ||
              activeEl.tagName === 'TEXTAREA' ||
              activeEl.tagName === 'SELECT');
          if (!isAnotherInputFocused) {
            forceViewportReset();
          }
        }, 100);
      }
    });
  }

  // ============================================================
  // FORCE CLOSE ALL MODALS - runs on every load type
  // iOS Safari bfcache: DOMContentLoaded does NOT re-fire on
  // back/forward navigation or OAuth redirects. 'pageshow' does.
  // ============================================================
  function forceCloseAllModals() {
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    document.body.style.removeProperty('position');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('top');
    document.body.style.removeProperty('left');
    document.body.style.removeProperty('width');
    document.body.style.removeProperty('height');
    document.querySelectorAll('.modal-overlay, .tx-modal-overlay').forEach(function (m) {
      m.classList.remove('active');
    });
    // Also reset any inline display:flex on modals
    const txModal = document.getElementById('transaction-modal');
    if (txModal && txModal.style.display === 'flex') txModal.style.display = '';
  }
  // Expose globally so auth handler can call it too
  window.forceCloseAllModals = forceCloseAllModals;

  // Run immediately on DOM ready
  forceCloseAllModals();

  // Set initial scroll isolation class for default trans tab
  document.body.classList.add('trans-tab-active');
  loadConfig();
  initSettingsFromStorage();

  // FIX (overlay placement): Self-heal any full-screen overlay that is nested
  // inside .app-container (position:relative + overflow:hidden) by moving it
  // directly under <body>. This prevents the auth-overlay-style "trapped modal"
  // bug from recurring on any overlay. Must run early, before any overlay shows.
  if (typeof initOverlayPlacement === 'function') {
    initOverlayPlacement();
  }
  // FIX #1: Start the auto-lock inactivity timer (if enabled). This must run
  // AFTER initSettingsFromStorage() so the stored delay is already loaded.
  if (typeof _initAutoLock === 'function') {
    _initAutoLock();
  }
  initMultiCurrency();
  if (typeof loadNotifications === 'function') {
    loadNotifications();
  } else if (typeof window !== 'undefined' && typeof window.loadNotifications === 'function') {
    window.loadNotifications();
  }
  if (typeof initLocalNotifications === 'function') {
    initLocalNotifications();
  } else if (typeof window !== 'undefined' && typeof window.initLocalNotifications === 'function') {
    window.initLocalNotifications();
  }
  initSupabase();
  setupEventListeners();
  if (typeof initPullToRefresh === 'function') {
    initPullToRefresh();
  } else if (typeof window !== 'undefined' && typeof window.initPullToRefresh === 'function') {
    window.initPullToRefresh();
  }
  if (typeof initSwipeToBack === 'function') {
    initSwipeToBack();
  } else if (typeof window !== 'undefined' && typeof window.initSwipeToBack === 'function') {
    window.initSwipeToBack();
  }
  initTabSwipeNavigation();
  resetAllTabScreenStyles();
  initRippleEffects();
  if (typeof initLightboxPinchZoom === 'function') {
    initLightboxPinchZoom();
  } else if (typeof window !== 'undefined' && typeof window.initLightboxPinchZoom === 'function') {
    window.initLightboxPinchZoom();
  }

  // ALWAYS load cached local data immediately so the UI is never blank on refresh.
  // If Supabase is enabled, onAuthStateChange will call loadData() again with fresh cloud data.
  //
  // Self-healing migration for tombstone reconciliation / incremental cache drift.
  // Resets stale sync cursors once so all clients perform a guaranteed full sync
  // and reconcile any transactions hidden by stale localStorage tombstones.
  try {
    const HEAL_KEY = 'tombstone_reconcile_fix_v3';
    if (!localStorage.getItem(HEAL_KEY)) {
      if (typeof resetSyncCursors === 'function') resetSyncCursors();
      localStorage.removeItem('permanent_deleted_tx_ids');
      localStorage.setItem(HEAL_KEY, 'true');
    }
  } catch (_) { }

  loadOfflineData();

  // CRITICAL: Also run on pageshow — this fires for bfcache restores
  // (e.g. after Google OAuth redirect on iOS), unlike DOMContentLoaded
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      // Page restored from bfcache (iOS back navigation or OAuth redirect)
      if (typeof window.restoreActiveModalsWithoutTransition === 'function') {
        window.restoreActiveModalsWithoutTransition();
      }
    }
  });

  // INSTANT COLD-START RENDERING (0ms):
  // Always render cached transactions and balances immediately, regardless of online/offline status.
  // This guarantees the user sees all cached transactions immediately on app launch, instead of an empty
  // screen or partial list while waiting for network auth and cloud synchronization to complete.
  const hasCachedUser = localStorage.getItem('cached_current_user');
  const isGuestMode = localStorage.getItem('auth_guest_mode') === 'true';

  if (hasCachedUser || isGuestMode) {
    hideAuthOverlay();
    if (hasCachedUser && !state.currentUser) {
      try { state.currentUser = JSON.parse(hasCachedUser); } catch (e) { }
    }
    if (isGuestMode) state.guestMode = true;
    window._authConfirmed = true;

    // Suppress transitions so the instant first paint is invisible and smooth
    window._suppressTransitions = true;
    try {
      calculateInitialBalances();
      updateUI();
    } finally {
      setTimeout(() => { window._suppressTransitions = false; }, 1500);
    }
  } else if (!navigator.onLine || !state.supabaseClient) {
    // No cached session and offline — show login
    showAuthOverlay();
  }

  function restoreActiveModalsFromStorage() {
    try {
      // SECURITY: Never restore a previous user's personal-data modal (e.g. the
      // transactions modal) before the session is confirmed valid. _isAuthenticated()
      // is true only after _authConfirmed is set (valid session / guest / offline
      // cached user). Until then, clear any saved modal state so nothing flashes.
      if (!_isAuthenticated()) {
        localStorage.removeItem('bg_active_modal_id');
        localStorage.removeItem('bg_active_modal_tx_id');
        localStorage.removeItem('bg_active_subcat_txs');
        localStorage.removeItem('bg_modal_scroll_top');
        return;
      }

      const activeModalId = null /* startup restore disabled */;
      if (activeModalId) {
        const currentlyActive = document.querySelector('.modal-overlay.active, .tx-modal-overlay.active, .profile-sheet-overlay.active');
        if (currentlyActive && currentlyActive.id === activeModalId) return;
        if (activeModalId === 'transaction-modal') {
          const txId = localStorage.getItem('bg_active_modal_tx_id');
          if (txId) {
            const t = state.transactions.find(item => String(item.id) === String(txId));
            if (t) openEditTransactionModal(t, { instant: true });
          } else {
            openAddTransactionModal({ instant: true });
          }
        } else if (activeModalId === 'advisor-chat-modal') {
          openAdvisorChat();
        } else if (activeModalId === 'profile-settings-modal') {
          openProfileSheet();
        } else {
          openModal(activeModalId, { instant: true });
        }
        localStorage.removeItem('bg_active_modal_tx_id');
        localStorage.removeItem('bg_active_subcat_txs');
      }
    } catch (e) {
      console.warn('Failed to restore UI modal state:', e);
    }
  }
  window.restoreActiveModalsFromStorage = restoreActiveModalsFromStorage;

  function restoreActiveModalsWithoutTransition() {
    try {
      const activeModalId = localStorage.getItem('bg_active_modal_id');
      if (!activeModalId) return;

      const currentlyActive = document.querySelector('.modal-overlay.active, .tx-modal-overlay.active, .profile-sheet-overlay.active');
      if (currentlyActive && currentlyActive.id === activeModalId) {
        // Modal is already correctly open. Do NOT toggle 'no-transition' globally,
        // which would invalidate rendering layers and cause visual flashes on resume.
        return;
      }

      pushNoTransition();
      restoreActiveModalsFromStorage();
      // ANTI-FLICKER: Keep no-transition for the full resume guard window
      // (_RESUME_GUARD_MS, ~1700ms) to cover the deferred updateUI render
      // (700ms baseDelay when _appJustResumed is true) AND the 1500ms
      // foreground sync. This ensures the tab re-render from the deferred
      // updateUI is also invisible to the user, eliminating the second flash
      // on resume. Uses the reference-counted guard so overlapping guards
      // never prematurely remove the class.
      setTimeout(() => {
        popNoTransition();
        document.documentElement.classList.remove('modal-prerender');
        // Optional cleanup of the injected style tag
        const prerenderStyle = document.getElementById('prerender-modal-style');
        if (prerenderStyle) prerenderStyle.remove();
      }, (typeof _RESUME_GUARD_MS === 'number' ? _RESUME_GUARD_MS : 1700));
    } catch (e) {
      console.warn('Failed to restore UI state without transitions:', e);
    }
  }
  window.restoreActiveModalsWithoutTransition = restoreActiveModalsWithoutTransition;

  // Restore active modals on boot instantly without transitions
  restoreActiveModalsWithoutTransition();

  // Safe removal of early tab style block to avoid layout flashes
  const earlyTabStyle = document.getElementById('early-tab-style');
  if (earlyTabStyle) {
    earlyTabStyle.remove();
  }
  // Safe removal of early auth hide style block
  const earlyAuthHideStyle = document.getElementById('early-auth-hide-style');
  if (earlyAuthHideStyle) {
    earlyAuthHideStyle.remove();
  }

  updateHeaderProfileBadge();

  // If device is offline, bypass Supabase auth and render cached data immediately.
  // Ensure early styles are cleaned up if offline
  if (!navigator.onLine || !state.supabaseClient) {
    const earlyStyle = document.getElementById('early-auth-style');
    if (earlyStyle) earlyStyle.remove();
  }

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('trans-date').value = today;
  applyLanguage(state.lang);
  detectGeoLanguage();

  // Remove no-transition class after the first paint is committed.
  // This prevents CSS transitions from flashing during startup.
  // Double-rAF ensures the browser has painted the initial frame before re-enabling.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('no-transition');
    });
  });
  window._appLoaded = true;
  if (window._startupTimeout) clearTimeout(window._startupTimeout);

  // PREMIUM RETURN HANDLER: After Stripe Checkout redirects back with
  // ?premium=success, refresh the profile (server is the source of truth) so
  // the Premium entitlement is reflected immediately. Also clean the URL so a
  // refresh doesn't re-trigger the toast.
  (function handlePremiumReturn() {
    try {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('premium');
      const paypalStatus = params.get('paypal');
      const paypalToken = params.get('token');

      // Handle PayPal return
      if (paypalStatus === 'success' && paypalToken) {
        params.delete('paypal');
        params.delete('token');
        params.delete('PayerID');
        const cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);

        (async () => {
          try {
            let sessionToken = '';
            if (state.supabaseClient) {
              const sRes = state.supabaseClient.auth.session ? { data: { session: state.supabaseClient.auth.session() } } : await state.supabaseClient.auth.getSession();
              sessionToken = (sRes && sRes.data && sRes.data.session) ? sRes.data.session.access_token : '';
            }
            if (sessionToken) {
              const capRes = await fetch(getBackendApiUrl('/api/paypal-capture'), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + sessionToken
                },
                body: JSON.stringify({ orderId: paypalToken })
              });
              const capData = await capRes.json().catch(() => ({}));
              if (capData.success) {
                showSyncToast(state.lang === 'el' ? '🎉 Το Premium ενεργοποιήθηκε μέσω PayPal! Ευχαριστούμε!' : '🎉 Premium activated via PayPal! Thank you!', 5000);
                if (state.currentUser && typeof loadUserProfiles === 'function') {
                  await loadUserProfiles(state.currentUser);
                  updatePremiumUI();
                }
                return;
              }
            }
          } catch (pErr) {
            console.warn('PayPal capture error:', pErr);
          }
        })();
        return;
      }

      if (!status) return;

      // Remove the query param from the URL (history.replaceState keeps the page).
      params.delete('premium');
      const cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);

      if (status === 'success') {
        showSyncToast(state.lang === 'el' ? '🎉 Το Premium ενεργοποιήθηκε! Ευχαριστούμε!' : '🎉 Premium activated! Thank you!', 5000);
        // Refresh the profile once the user is authenticated. First run the
        // server-side reconciliation (/api/premium-status) so the entitlement
        // is granted even if the webhook hasn't processed yet, then re-fetch.
        if (state.currentUser && typeof loadUserProfiles === 'function') {
          (async () => {
            try {
              if (typeof reconcilePremiumPurchase === 'function') {
                await reconcilePremiumPurchase();
              }
            } catch (e) { /* reconciliation is best-effort */ }
            loadUserProfiles(state.currentUser).then(() => {
              updatePremiumUI();
            }).catch(() => { });
          })();
        }
      } else if (status === 'cancelled') {
        showSyncToast(state.lang === 'el' ? 'Η αγορά ακυρώθηκε.' : 'Purchase cancelled.', 3000);
      }
    } catch (e) {
      console.warn('Premium return handler error:', e);
    }
  })();

  // COLD-START FADE-IN: The first updateUI() render is deferred by ~150ms
  // (via _updateUIRAF). Wait for that deferred render to paint (double-rAF +
  // a small buffer) before fading out the cold-start overlay, so the user sees
  // the fully-rendered content fade in smoothly instead of an abrupt black flash.
  //
  // On FIRST LAUNCH (no cached session) the login card is shown via the auth
  // overlay. Because the security guard skips _updateUIImpl() rendering while
  // unauthenticated, the content-painted signal never fires — so we must wait
  // until the auth overlay (login card) is actually VISIBLE before fading out,
  // otherwise the cold-start overlay lifts too early and the user sees a flash
  // of the blank background before the login card appears. We poll for it.
  const _authOverlayEl = document.getElementById('auth-overlay');
  // Detect a genuine first-launch / unauthenticated state (no cached session, not
  // guest, not yet confirmed) rather than relying on the overlay's inline
  // style.display. The early-auth-style CSS rule makes the overlay visible via a
  // stylesheet (display:flex !important), which does NOT update the inline
  // style.display property — so checking style.display here would always read
  // 'none' and fade the cold-start overlay out before the login card is painted,
  // producing a visible blank gap on first open.
  const _hasCachedUserAtBoot = !!localStorage.getItem('cached_current_user');
  const _isGuestModeAtBoot = localStorage.getItem('auth_guest_mode') === 'true';
  const _isFirstLaunchLogin = !!_authOverlayEl &&
    !_hasCachedUserAtBoot &&
    !_isGuestModeAtBoot &&
    !window._authConfirmed;
  if (_isFirstLaunchLogin) {
    // Poll until the login card is actually painted (visible + non-empty), then
    // fade out. A hard cap prevents the overlay from ever blocking the UI.
    const _coldStartPollStart = Date.now();
    const _coldStartPoll = setInterval(() => {
      const authCard = document.getElementById('auth-card');
      const cardVisible = authCard &&
        authCard.offsetParent !== null &&
        authCard.offsetHeight > 0;
      const authVisible = _authOverlayEl.style.display !== 'none' &&
        _authOverlayEl.offsetParent !== null;
      if ((cardVisible || authVisible) || (Date.now() - _coldStartPollStart > 2500)) {
        clearInterval(_coldStartPoll);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => { fadeOutColdStartOverlay(); }, 120);
          });
        });
      }
    }, 80);
  } else {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          fadeOutColdStartOverlay();
        }, 120);
      });
    });
  }

  if (typeof updateNotesTrashBadge === 'function') {
    updateNotesTrashBadge();
  }

  // DESKTOP WEB UX HOOK: Initialize the desktop UI layer (sidebar, topbar,
  // dashboard, keyboard shortcuts) ONLY when running in web-mode (browser/PWA).
  // web-ui.js is loaded with `defer` after app.js, so initDesktopUI is defined.
  // It self-guards on html.web-mode, so Android/iOS native is never affected.
  if (document.documentElement.classList.contains('web-mode')) {
    if (typeof window.initDesktopUI === 'function') {
      try {
        window.initDesktopUI();
      } catch (e) {
        console.error('[DesktopUI] init failed:', e);
      }
    }
  }
}

// ============================================================
// ANTI-ZOOM: Samsung Pass / Autofill zoom prevention (Android)
// ============================================================
// Samsung Pass and other autofill services can trigger an unwanted zoom
// on the WebView when they focus input fields. This listener detects any
// scale change via visualViewport and immediately resets it to 1.0.
(function installAntiZoomGuard() {
  if (!window.visualViewport) return;
  let _resetting = false;
  window.visualViewport.addEventListener('resize', function () {
    if (_resetting) return;
    const scale = window.visualViewport.scale;
    if (scale !== 1) {
      _resetting = true;
      // Re-stamp the viewport meta to force scale back to 1.0
      const vp = document.querySelector('meta[name="viewport"]');
      if (vp) {
        vp.setAttribute('content',
          'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover');
      }
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      setTimeout(function () { _resetting = false; }, 300);
    }
  });
})();

// Run initApp on DOMContentLoaded, OR (if the event has already fired,
// e.g. the async boot loader injects app.js after DOMContentLoaded) run it
// as soon as the rest of this script has executed. We defer with setTimeout(0)
// so all top-level `let`/`const` declarations (e.g. _updateUITimer) are
// initialized before initApp() runs — otherwise they are in the temporal
// dead zone and throw "cannot access before initialization".
//
// RESILIENCE: initApp() is wrapped so that if it throws partway through
// initialization, we do NOT leave the user stuck in a half-initialized broken
// state (untranslated nav labels, dead tab switching, frozen scroll). Instead
// we trigger the Recovery overlay (if present) and log the error. _appLoaded
// is only set true at the very end of initApp(), so the recovery-mode error
// handler in index.html stays armed until initialization fully completes.
function _bootApp() {
  initApp().catch(function (err) {
    console.error('[Boot] initApp() failed:', err);
    if (typeof window.showRecoveryMode === 'function') {
      try {
        window.showRecoveryMode('App initialization failed: ' + (err && err.message ? err.message : String(err)));
      } catch (e) { /* recovery overlay itself failed; nothing more we can do */ }
    }
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _bootApp);
} else {
  setTimeout(_bootApp, 0);
}

// ============================================================
// HALF-INITIALIZED STATE WATCHDOG
// ============================================================
// Even when initApp() does not throw, a critical step can silently fail and
// leave the app in a broken half-initialized state: the nav labels stay as the
// hardcoded HTML fallback (e.g. "Λογαριασμοί" instead of the translated
// "Επισκόπηση"), tab switching is dead, and scroll is frozen. This watchdog
// verifies the app actually finished initializing (nav labels translated +
// tab screens present) shortly after boot. If it detects a broken state, it
// triggers the Recovery overlay so the user is never left stuck.
(function installHalfInitWatchdog() {
  // Only run once, after a generous window that covers the full initApp()
  // sequence (which includes deferred renders and async auth/offline paths).
  setTimeout(function () {
    // If the app fully loaded, _appLoaded is true and we have nothing to do.
    if (window._appLoaded) return;
    // If recovery is already showing, don't double-trigger.
    if (document.getElementById('recovery-overlay')) return;
    // If the auth overlay is legitimately showing (first launch login), the
    // app is NOT broken — it's waiting for the user to log in. Skip.
    var authOverlay = document.getElementById('auth-overlay');
    if (authOverlay && authOverlay.style.display !== 'none') return;

    // Heuristic: the nav accounts label should have been translated by
    // applyLanguage(). If it still equals the hardcoded HTML fallback
    // ("Λογαριασμοί" / "Accounts"), applyLanguage() never ran -> broken state.
    var accountsNav = document.querySelector('#tab-nav-accounts span[data-i18n="nav_accounts"]');
    if (accountsNav) {
      var text = (accountsNav.textContent || '').trim();
      var isFallback = (text === 'Λογαριασμοί' || text === 'Accounts');
      if (isFallback) {
        console.error('[Watchdog] App left in half-initialized state (nav not translated). Triggering recovery.');
        if (typeof window.showRecoveryMode === 'function') {
          try {
            window.showRecoveryMode('App did not finish initializing (nav labels not applied). Please reload.');
          } catch (e) { /* ignore */ }
        }
      }
    }
  }, 6000);
})();


// ============================================================
// ============================================================
// CUSTOM ALERT & CONFIRM MODALS
// Extracted to js/dialogService.js (Phase 5 Architectural Domain Extraction)
// ============================================================
// IN-APP REVIEW & RATING SUBSYSTEM (Prompt after 7 days of usage)
// Extracted to js/feedbackReviewService.js (Phase 13B Architectural Extraction)

function loadConfig() {
  // Database credentials are strictly hardcoded in state.supabaseConfig.
  state.isSupabaseEnabled = true;
}

function initSupabase() {
  if (state.isSupabaseEnabled && window.supabase) {
    try {
      state.supabaseClient = window.supabase.createClient(
        state.supabaseConfig.url,
        state.supabaseConfig.key,
        {
          auth: {
            flowType: 'implicit',
            autoRefreshToken: true,
            persistSession: true
          }
        }
      );
      const syncBadge = document.getElementById('sync-badge');
      if (syncBadge) {
        syncBadge.className = 'sync-badge online';
        syncBadge.textContent = 'Cloud Sync ✓';
      }
      updateHeaderSyncIcon('syncing');
      // Initialize authentication flow
      initSupabaseAuth();
    } catch (err) {
      console.error('Supabase init failed:', err);
      state.isSupabaseEnabled = false;
      const syncBadge = document.getElementById('sync-badge');
      if (syncBadge) {
        syncBadge.className = 'sync-badge offline';
        syncBadge.textContent = 'Offline';
      }
      updateHeaderSyncIcon('error');
    }
  } else {
    const syncBadge = document.getElementById('sync-badge');
    if (syncBadge) {
      syncBadge.className = 'sync-badge offline';
      syncBadge.textContent = 'Local Mode';
    }
    updateHeaderSyncIcon('offline');
  }
}

function toggleLoader(show) {
  const loadingState = document.getElementById('auth-loading-state');
  const authCard = document.getElementById('auth-card');
  if (show) {
    if (loadingState) loadingState.style.display = 'flex';
    if (authCard) authCard.style.display = 'none';
  } else {
    if (loadingState) loadingState.style.display = 'none';
    if (authCard) authCard.style.display = 'flex';
  }
}
window.toggleLoader = toggleLoader;

function initSupabaseAuth() {
  if (!state.supabaseClient) return;

  const urlParams = new URLSearchParams(window.location.search);
  const inviteCode = urlParams.get('invite');
  const inviteRole = urlParams.get('role');
  if (inviteCode) {
    localStorage.setItem('pending_invite_code', inviteCode.trim().toUpperCase());
    if (inviteRole) {
      localStorage.setItem('pending_invite_role', inviteRole.trim().toLowerCase());
    } else {
      localStorage.removeItem('pending_invite_role');
    }
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  // Debug-only auth logging. Disabled in production to reduce console noise and
  // avoid logging potentially sensitive auth/session details.
  const AUTH_DEBUG = false;
  function logAuthDebug(msg) {
    if (AUTH_DEBUG) console.log('[AuthDebug]', msg);
  }

  // Global error handler to capture runtime JS errors and display them in the debug overlay
  window.addEventListener('error', (event) => {
    logAuthDebug(`Runtime Error: ${event.message} at ${event.filename}:${event.lineno}`);
    console.error('Runtime error:', event.error);
  });

  logAuthDebug('Starting auth checks...');

  const hashStr = window.location.hash || '';
  const searchStr = window.location.search || '';

  const urlKeys = [];
  if (hashStr) {
    const hashParams = new URLSearchParams(hashStr.substring(1));
    for (const key of hashParams.keys()) {
      urlKeys.push(`hash:${key}`);
    }
  }
  if (searchStr) {
    const searchParams = new URLSearchParams(searchStr);
    for (const key of searchParams.keys()) {
      urlKeys.push(`query:${key}`);
    }
  }
  logAuthDebug(`URL components: ${urlKeys.join(', ') || 'none'}`);

  const isAuthRedirect = hashStr.includes('access_token=') ||
    hashStr.includes('id_token=') ||
    hashStr.includes('error=') ||
    searchStr.includes('code=') ||
    searchStr.includes('error=');


  let processingRedirect = isAuthRedirect;
  logAuthDebug(`Is redirect callback: ${isAuthRedirect}`);

  const authOverlay = document.getElementById('auth-overlay');
  const loadingState = document.getElementById('auth-loading-state');
  const formsContainer = document.getElementById('auth-forms-container');
  const authCard = document.getElementById('auth-card');

  if (isAuthRedirect) {
    if (authOverlay) authOverlay.style.display = 'flex';
    toggleLoader(true);
    if (formsContainer) formsContainer.style.display = 'none';

    // Safety timeout to prevent getting stuck
    setTimeout(() => {
      if (processingRedirect && !state.currentUser && !state.guestMode) {
        logAuthDebug('TIMEOUT: Auth redirect timed out (6s).');
        console.warn('Auth redirect timed out or failed. Restoring login form.');
        processingRedirect = false;
        toggleLoader(false);
        if (formsContainer) formsContainer.style.display = 'block';
        showAuthStatus(state.lang === 'el'
          ? '⚠️ Η σύνδεση καθυστερεί ή απέτυχε. Δοκιμάστε ξανά.'
          : '⚠️ Login is taking too long or failed. Please try again.');
      }
    }, 6000);
  }

  // We delay early style removal until session verification is fully resolved to prevent background page flashing.

  if (hashStr.includes('error=') || searchStr.includes('error=')) {
    const rawParams = hashStr.includes('error=') ? hashStr.substring(1) : searchStr.substring(1);
    const params = new URLSearchParams(rawParams);
    const error = params.get('error');
    let errorDescription = params.get('error_description') || error;
    if (errorDescription) {
      errorDescription = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
      logAuthDebug(`Error in redirect: ${error} - ${errorDescription}`);
      let errorMsg = '';
      if (error === 'identity_provider_email_conflict') {
        errorMsg = state.lang === 'el'
          ? '❌ Υπάρχει ήδη λογαριασμός με αυτό το email. Δοκιμάστε να συνδεθείτε με email/κωδικό.'
          : '❌ An account with this email already exists. Try logging in with email/password.';
      } else {
        errorMsg = ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_prefix']) || '❌ Σφάλμα: ') + errorDescription;
      }

      processingRedirect = false;
      toggleLoader(false);
      if (formsContainer) formsContainer.style.display = 'block';
      showAuthStatus(errorMsg);
      // Clean URL hash so it doesn't reappear on refresh
      window.history.replaceState(null, null, window.location.pathname);
    }
  }

  // Global unhandled promise rejection handler during authentication
  window.addEventListener('unhandledrejection', (event) => {
    logAuthDebug(`Unhandled promise rejection: ${event.reason}`);
    console.warn('Unhandled promise rejection:', event.reason);
    const reason = event.reason;
    if (reason && (reason.message || reason.error_description || String(reason).includes('Auth') || String(reason).includes('token'))) {
      const msg = reason.message || reason.error_description || String(reason);
      // ONLY show auth error overlay if user is actively in the login flow / redirect
      // and NOT already logged in with cached credentials or guest mode
      const hasCachedUser = !!(localStorage.getItem('cached_current_user') || state.currentUser || state.guestMode);
      if (processingRedirect || !hasCachedUser) {
        processingRedirect = false;
        toggleLoader(false);
        if (formsContainer) formsContainer.style.display = 'block';
        showAuthStatus(((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_unhandled']) || '❌ Σφάλμα (Unhandled): ') + msg);
      }
    }
  });

  logAuthDebug('Fetching current session...');
  // Fetch session explicitly to capture any errors during initialization or OAuth code/hash exchange
  state.supabaseClient.auth.getSession().then(({ data, error }) => {
    const hasCachedUser = !!(localStorage.getItem('cached_current_user') || state.currentUser || state.guestMode);
    if (error) {
      logAuthDebug(`getSession error: ${error.message || error}`);
      console.error('Supabase getSession error:', error);
      // If we have cached credentials / offline session, do NOT show the login overlay on getSession error!
      if (hasCachedUser) {
        logAuthDebug('getSession error ignored; maintaining offline cached session.');
        hideAuthOverlay();
        const earlyStyle = document.getElementById('early-auth-style');
        if (earlyStyle) earlyStyle.remove();
        const earlyHideStyle = document.getElementById('early-auth-hide-style');
        if (earlyHideStyle) earlyHideStyle.remove();
        return;
      }
      processingRedirect = false;
      toggleLoader(false);
      // SECURITY/UX: Even on a session-check error the user is NOT authenticated,
      // so we MUST show the login overlay. Removing early-auth-style without
      // re-showing the overlay left the app on a blank screen with only the lock
      // icon on fresh installs / when no valid session existed.
      if (authOverlay) authOverlay.style.display = 'flex';
      if (formsContainer) formsContainer.style.display = 'block';
      if (authCard) authCard.style.display = 'flex';
      if (loadingState) loadingState.style.display = 'none';
      showAuthStatus(((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_auth']) || '❌ Σφάλμα ταυτοποίησης: ') + (error.message || error));
      const earlyStyle = document.getElementById('early-auth-style');
      if (earlyStyle) earlyStyle.remove();
      const earlyHideStyle = document.getElementById('early-auth-hide-style');
      if (earlyHideStyle) earlyHideStyle.remove();
    } else {
      logAuthDebug(`getSession resolved. Session exists: ${!!(data && data.session)}`);
      if (data && data.session && (window.location.hash || window.location.search)) {
        window.history.replaceState(null, null, window.location.pathname);
      }
      if (!data || !data.session) {
        // If we have cached credentials, keep the offline session active!
        if (hasCachedUser) {
          logAuthDebug('No active network session from getSession, but cached user exists -> keeping offline session active.');
          hideAuthOverlay();
          const earlyStyle = document.getElementById('early-auth-style');
          if (earlyStyle) earlyStyle.remove();
          const earlyHideStyle = document.getElementById('early-auth-hide-style');
          if (earlyHideStyle) earlyHideStyle.remove();
          return;
        }
        // Only show login forms if onAuthStateChange hasn't already logged us in
        if (!state.currentUser && !state.guestMode) {
          showAuthOverlay();
        }
      } else if (data.session && data.session.user) {
        // Fallback for browsers where INITIAL_SESSION event may be delayed/missed
        state.session = data.session;
        state.currentUser = data.session.user;
        // SECURITY: Session verified valid - safe to render this user's data.
        window._authConfirmed = true;
        localStorage.setItem('cached_current_user', JSON.stringify(data.session.user));
        hideAuthOverlay();
        if (!window._initialDataLoaded) {
          loadData().then(() => { window._initialDataLoaded = true;
      if (typeof checkAndPromptAppReview === 'function') checkAndPromptAppReview(); }).catch(console.error);
        }
      }
    }
  }).catch(err => {
    logAuthDebug(`getSession catch error: ${err.message || err}`);
    console.error('Supabase getSession catch error:', err);
    const hasCachedUser = !!(localStorage.getItem('cached_current_user') || state.currentUser || state.guestMode);
    if (hasCachedUser) {
      logAuthDebug('getSession catch error ignored; maintaining offline cached session.');
      hideAuthOverlay();
      const earlyStyle = document.getElementById('early-auth-style');
      if (earlyStyle) earlyStyle.remove();
      const earlyHideStyle = document.getElementById('early-auth-hide-style');
      if (earlyHideStyle) earlyHideStyle.remove();
      return;
    }
    processingRedirect = false;
    toggleLoader(false);
    // SECURITY/UX: Same as the error path above - the user is NOT authenticated,
    // so we MUST show the login overlay instead of leaving a blank screen.
    if (authOverlay) authOverlay.style.display = 'flex';
    if (formsContainer) formsContainer.style.display = 'block';
    if (authCard) authCard.style.display = 'flex';
    if (loadingState) loadingState.style.display = 'none';
    showAuthStatus(((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_auth']) || '❌ Σφάλμα ταυτοποίησης: ') + (err.message || err));
    const earlyStyle = document.getElementById('early-auth-style');
    if (earlyStyle) earlyStyle.remove();
    const earlyHideStyle = document.getElementById('early-auth-hide-style');
    if (earlyHideStyle) earlyHideStyle.remove();
  });

  logAuthDebug('Subscribing to onAuthStateChange...');
  state.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    logAuthDebug(`Auth Event Fired: ${event}, Session: ${!!session}`);

    if (state.isLoggingOut) {
      logAuthDebug('Sign-out in progress, ignoring auth state change.');
      return;
    }

    // ANTI-FLICKER FIX (resume flash): A background TOKEN_REFRESHED is NOT a login.
    // It fires silently whenever the Supabase auth client auto-refreshes a
    // near-expiry access token (e.g. after the app was backgrounded long enough
    // that the token had to be rotated). Running the full login pipeline below
    // (updateUI -> loadUserProfiles -> forceSyncNow) would trigger a full DOM
    // re-render cascade right after resume - exactly when the user is watching -
    // and the CSS transition guard (_RESUME_GUARD_MS) has already expired. For a
    // silent token refresh we only keep the session identity in sync and silently
    // refresh the authoritative profile, WITHOUT any visible re-render.
    if (event === 'TOKEN_REFRESHED') {
      if (session && session.user) {
        state.session = session;
        state.currentUser = session.user;
        window._authConfirmed = true;
        localStorage.setItem('cached_current_user', JSON.stringify(session.user));
        // Silent background refresh of the server-side profile (premium/family
        // status). Updates state + small badge/banner elements only - never a
        // full UI re-render, so it cannot cause a visible flash on resume.
        loadUserProfiles(session.user);
      }
      logAuthDebug('TOKEN_REFRESHED: silent session keep-alive, no re-render.');
      return;
    }

    if (session && session.user) {
      processingRedirect = false;
      state.session = session;
      const cachedRawUser = localStorage.getItem('cached_current_user');
      let previousUserId = null;
      try {
        if (cachedRawUser) previousUserId = JSON.parse(cachedRawUser).id;
      } catch (e) { }

      // ANTI-FLICKER: If this user is ALREADY active with data loaded in memory,
      // subsequent SIGNED_IN / INITIAL_SESSION events (e.g. from tab resume/focus)
      // are keep-alives and must NOT re-trigger the entire cold-boot login sequence
      // or re-run loadData(), which would momentarily wipe and rebuild the DOM.
      const isSameUserAlreadyLoaded = !!(
        window._initialDataLoaded &&
        previousUserId &&
        previousUserId === session.user.id &&
        state.currentUser &&
        state.currentUser.id === session.user.id
      );

      if (isSameUserAlreadyLoaded) {
        logAuthDebug(`${event}: session re-affirmed for active user, skipping full reload.`);
        loadUserProfiles(session.user);
        return;
      }

      if (previousUserId && previousUserId !== session.user.id) {
        window._initialDataLoaded = false;
        // User account changed! Clean previous user's local caches & trash
        state.trashTransactions = [];
        // IMPORTANT: Reset in-memory user/partner/family state immediately so a
        // previous account's cached premium/family data cannot bleed into the
        // new account (isPremium() reads state.userProfile).
        state.userProfile = null;
        state.partnerProfile = null;
        state.familyProfiles = [];
        state.familyGroup = null;
        localStorage.removeItem('deleted_transactions_trash');
        localStorage.removeItem('offline_transactions');
        localStorage.removeItem('cached_partner_profile');
        localStorage.removeItem('cached_user_profile');
        localStorage.removeItem('cached_family_profiles');
        localStorage.removeItem('cached_family_group');
        localStorage.removeItem('sync_cursors_v1');
        localStorage.removeItem('sync_last_full_ts');
      }

      state.currentUser = session.user;
      // SECURITY: Session verified valid - safe to render this user's data.
      window._authConfirmed = true;
      localStorage.setItem('cached_current_user', JSON.stringify(session.user));

      // Force-reset any in-memory profile that does not belong to the CURRENT
      // session user. This is the final guard: even if loadOfflineData restored
      // a previous account's cached premium/family data before the session was
      // confirmed, it is discarded now so isPremium() can never report a stale
      // entitlement for the wrong account.
      if (state.userProfile && state.userProfile.id !== session.user.id) {
        state.userProfile = null;
      }
      if (state.partnerProfile && state.partnerProfile.id === session.user.id) {
        state.partnerProfile = null;
      }

      // Load cached partner and user profile if available
      try {
        const cachedPartner = localStorage.getItem('cached_partner_profile');
        if (cachedPartner) {
          state.partnerProfile = JSON.parse(cachedPartner);
        }
        const cachedUser = localStorage.getItem('cached_user_profile');
        if (cachedUser) {
          try {
            const parsedUser = JSON.parse(cachedUser);
            // CRITICAL: Only restore the cached profile if it belongs to the
            // CURRENT user. Without this check, a previous account's cached
            // premium/family state can leak into a newly logged-in account
            // (e.g. "already PRO" shown on an account that never paid).
            if (parsedUser && parsedUser.id === session.user.id) {
              state.userProfile = parsedUser;
            } else {
              localStorage.removeItem('cached_user_profile');
            }
          } catch (e) {
            localStorage.removeItem('cached_user_profile');
          }
        }
        const cachedFamily = localStorage.getItem('cached_family_profiles');
        if (cachedFamily) {
          state.familyProfiles = JSON.parse(cachedFamily);
        }
        const cachedGroup = localStorage.getItem('cached_family_group');
        if (cachedGroup) {
          state.familyGroup = JSON.parse(cachedGroup);
        }
        const cachedMode = localStorage.getItem('account_view_mode');
        if (cachedMode === 'personal' || cachedMode === 'family') {
          state.activeAccountMode = cachedMode;
        }
        const cachedMember = localStorage.getItem('selected_family_member_id');
        if (cachedMember) {
          state.selectedFamilyMemberId = cachedMember;
        }
      } catch (e) {
        console.error('Failed to parse cached profiles:', e);
      }

      // Clear guest mode state
      state.guestMode = false;
      localStorage.removeItem('auth_guest_mode');

      // Clear URL parameters so they don't persist or trigger reload loops
      if (window.location.hash || window.location.search) {
        window.history.replaceState(null, null, window.location.pathname);
      }

      // Hide auth overlay & reset elements
      hideAuthOverlay();
      // Modals should NOT be force-closed here since we want to restore them on resume/boot
      // if (typeof window.forceCloseAllModals === 'function') window.forceCloseAllModals();

      if (event === 'PASSWORD_RECOVERY') {
        setTimeout(() => {
          if (typeof openChangePasswordModal === 'function') {
            openChangePasswordModal();
            const msg = (state.lang === 'el')
              ? '🔑 Παρακαλώ ορίστε τον νέο σας κωδικό πρόσβασης.'
              : '🔑 Please set your new password.';
            if (typeof showToast === 'function') showToast(msg, 'info');
          }
        }, 400);
      }

      // Show switcher in header
      const switcher = document.getElementById('wallet-switcher-container');
      if (switcher) switcher.style.display = 'inline-block';

      const email = session.user.email || '';
      // Show user badge
      updateHeaderProfileBadge();

      // Show email in the new profile header card (legacy element stays hidden)
      const emailDisplay = document.getElementById('settings-user-email-value');
      if (emailDisplay) {
        emailDisplay.textContent = email;
        emailDisplay.title = email;
      }
      // Note: settings-user-email-item is intentionally kept hidden.
      // The email is displayed in the profile-user-email element instead.

      // Apply correct visual transformation theme.
      // Call updateUI() immediately to display cached transactions on startup
      // instead of leaving the app blank while fetching fresh data from the cloud.
      applyWalletTheme();
      renderPartnerSection();
      // ANTI-FLICKER: The cached render below is deferred by updateUI() (150ms),
      // which runs AFTER the startup double-rAF removes the 'no-transition' class
      // from <html> (~32ms). Without suppression, this cached DOM wipe animates in
      // with transitions enabled, producing a visible flash on a full WebView reload
      // (e.g. after a long background where the OS killed the WebView). Suppress
      // transitions around this deferred render so it is invisible to the user.
      window._suppressTransitions = true;
      try {
        updateUI();
      } finally {
        setTimeout(() => { window._suppressTransitions = false; }, 1500);
      }

      // Trigger background updates and data loading asynchronously
      (async () => {
        try {
          // 1. Load user profile and partner details (network request)
          await loadUserProfiles(session.user);
          // Re-verify any locally-stored Play purchase that previously completed
          // but failed activation (best-effort, capped retries).
          try { await recoverPendingPlayPurchase(); } catch (e) { console.warn('Pending Play purchase recovery:', e); }
          applyWalletTheme();
          renderPartnerSection();

          // 2. Load fresh data from cloud immediately.
          _suppressRealtimeEvents = true;
          try {
            await loadData();

            // Start automatic polling sync
            startPartnerSyncPolling();

            // Start realtime subscription
            setupSupabaseRealtimeSubscription();
          } finally {
            // Re-enable realtime after a delay to let any inflight echo events drain.
            // This prevents the subscription's own INSERT echo from triggering handleRealtimeTransactionChange
            // and causing a 3rd render 3s after login.
            // 10s: Supabase Realtime echo events can take up to 5-8s to arrive, so we need
            // enough margin to absorb them before re-enabling the handler.
            setTimeout(() => { _suppressRealtimeEvents = false; }, 10000);
          }

          // 3. Import locally-saved data from the phone. If there are pending
          // local transactions (e.g. recorded while offline / as guest), ASK the
          // user whether to import them into their account instead of silently
          // syncing. This is the "auto-import saved data" option on entry.
          //
          // FIX (dialog loop): The dialog is remembered after dismissal. We store
          // the guest count the user last saw ("Keep Offline Only" / backdrop tap),
          // so the dialog no longer re-appears on every app open. It only re-appears
          // when NEW offline transactions are recorded (the pending count changes).
          // If a sync/transfer fails for some items (e.g. schema mismatch), the
          // transfer silently retries and only re-prompts when the set changes.
          // 3. Automatic and silent import of any locally-saved / guest transactions into the cloud account.
          // ZERO POPUPS - ZERO USER EFFORT.
          try {
            await syncLocalTransactionsToCloud(session.user.id, { silent: true });
          } catch (err) {
            console.warn('Auto-sync local transactions on login failed:', err);
          }
        } catch (err) {
          console.error('Error during background auth setup:', err);
        }
      })();
    } else {
      // OFFLINE & PERSISTENT SESSION GUARD:
      // When a null-session or SIGNED_OUT auth event fires without an explicit
      // user-initiated logout (state.isLoggingOut is false) and we have a cached
      // user, it is almost always due to an expired token or failed background
      // network refresh while offline, NOT a genuine user logout.
      // Treating it as a logout wipes cached_current_user and locks the user out
      // of the app. Instead, preserve the cached session so the app remains
      // fully usable offline.
      const cachedUserRaw = localStorage.getItem('cached_current_user');
      if (!state.isLoggingOut && cachedUserRaw) {
        logAuthDebug('Null-session event ignored without explicit logout; preserving cached user offline.');
        try {
          state.currentUser = JSON.parse(cachedUserRaw);
        } catch (e) {
          state.currentUser = null;
        }
        // SECURITY: Preserving existing cached session for offline access
        window._authConfirmed = true;
        // Keep the app usable offline: hide the auth overlay and render cached data.
        const authOverlayEl = document.getElementById('auth-overlay');
        if (authOverlayEl) authOverlayEl.style.display = 'none';
        toggleLoader(false);
        const formsContainerEl = document.getElementById('auth-forms-container');
        if (formsContainerEl) formsContainerEl.style.display = 'block';
        updateHeaderSyncIcon('offline');
        const earlyStyle = document.getElementById('early-auth-style');
        if (earlyStyle) earlyStyle.remove();
        const earlyHideStyle = document.getElementById('early-auth-hide-style');
        if (earlyHideStyle) earlyHideStyle.remove();
        window._suppressTransitions = true;
        try {
          updateUI();
        } finally {
          setTimeout(() => { window._suppressTransitions = false; }, 1500);
        }
        return;
      }

      // Stop automatic polling sync
      stopPartnerSyncPolling();

      // Stop realtime subscription
      stopSupabaseRealtimeSubscription();

      state.currentUser = null;
      // SECURITY: The session is no longer valid, so the user is NOT authenticated.
      // Reset _authConfirmed so no personal data can be rendered behind the login
      // screen. (The guest-mode branch below re-confirms auth for guest users.)
      window._authConfirmed = false;
      state.userProfile = null;
      state.partnerProfile = null;
      state.familyProfiles = [];
      state.familyGroup = null;
      state.activeAccountMode = 'family';
      // PRIVACY/ISOLATION: Also wipe the in-memory personal data (including the
      // recurring templates) so no render/generation pass can leak the previous
      // account's data — e.g. processRecurringTemplates() re-creating the main
      // profile's recurring transactions into a later guest session. The cached
      // copy stays in localStorage for offline reuse when the user signs back in.
      state.transactions = [];
      state.budgets = [];
      state.recurringTemplates = [];
      state.deletedRecurringDates = [];
      state.trashTransactions = [];
      state.notifications = [];
      state.notes = [];
      localStorage.removeItem('account_view_mode');
      localStorage.removeItem('cached_current_user');
      localStorage.removeItem('cached_partner_profile');
      localStorage.removeItem('cached_user_profile');
      localStorage.removeItem('cached_family_profiles');
      localStorage.removeItem('cached_family_group');
      localStorage.removeItem('offline_transactions');
      localStorage.removeItem('offline_accounts');
      localStorage.removeItem('offline_categories');
      localStorage.removeItem('offline_transactions_owner');
      updateHeaderSyncIcon('offline');

      if (localStorage.getItem('auth_guest_mode') === 'true') {
        state.guestMode = true;
        // SECURITY: Guest mode is a valid authenticated state (clean slate).
        window._authConfirmed = true;

        const earlyStyle = document.getElementById('early-auth-style');
        if (earlyStyle) earlyStyle.remove();

        // Hide auth overlay & reset elements — UNLESS the user explicitly opened
        // the login card (e.g. by tapping the lock icon). In that case a
        // null-session event must not yank the login form away from under them.
        if (!_authOverlayUserRequested) {
          hideAuthOverlay();
        }
        toggleLoader(false);

        // Hide switcher (guest has no shared wallet)
        const switcher = document.getElementById('wallet-switcher-container');
        if (switcher) switcher.style.display = 'none';

        // Show lock icon user badge
        updateHeaderProfileBadge();

        // Load offline data and render
        window._suppressTransitions = true;
        try {
          await loadData();
          updateUI();
        } finally {
          setTimeout(() => { window._suppressTransitions = false; }, 1500);
        }
        renderPartnerSection();
      } else {
        showAuthOverlay();

        // Hide switcher
        const switcher = document.getElementById('wallet-switcher-container');
        if (switcher) switcher.style.display = 'none';

        // Hide user badge
        const userBadge = document.getElementById('user-profile-badge');
        if (userBadge) userBadge.style.display = 'none';
      }

      // Remove wallet theme active class
      document.body.classList.remove('shared-wallet-active');
      renderPartnerSection();
    }
  });

  // ============================================================
  // FALLBACK SAFETY NET: Guarantee the login screen is shown.
  // ============================================================
  // After the initial auth check (getSession + INITIAL_SESSION) has had time to
  // resolve, if the user is STILL not authenticated (no valid session, not guest,
  // not offline-with-cached-user), force the auth overlay to appear. This catches
  // every edge case that could otherwise leave the app on a blank screen with only
  // the lock icon: a stale/invalid cached_current_user, a getSession error/catch
  // that previously removed early-auth-style without re-showing the overlay, or a
  // delayed/missed INITIAL_SESSION event.
  setTimeout(() => {
    try {
      const isAuthed = !!window._authConfirmed;
      const isGuest = !!state.guestMode;
      const hasCachedUser = !!localStorage.getItem('cached_current_user');
      const isOfflineNow = typeof navigator !== 'undefined' && !navigator.onLine;
      // A user is considered "effectively logged in" if the session was confirmed
      // OR (offline with a cached user / guest mode) - in those cases the overlay
      // must stay hidden.
      const effectivelyLoggedIn = isAuthed || isGuest || (isOfflineNow && hasCachedUser);
      if (effectivelyLoggedIn) return;

      const overlay = document.getElementById('auth-overlay');
      const forms = document.getElementById('auth-forms-container');
      const card = document.getElementById('auth-card');
      const loading = document.getElementById('auth-loading-state');
      if (overlay) overlay.style.display = 'flex';
      if (forms) forms.style.display = 'block';
      if (card) card.style.display = 'flex';
      if (loading) loading.style.display = 'none';
      const earlyStyle = document.getElementById('early-auth-style');
      if (earlyStyle) earlyStyle.remove();
      const earlyHideStyle = document.getElementById('early-auth-hide-style');
      if (earlyHideStyle) earlyHideStyle.remove();
      // Ensure the header shows the lock icon (unauthenticated state).
      updateHeaderProfileBadge();
    } catch (e) {
      console.warn('Auth fallback overlay failed:', e);
    }
  }, 2500);
}

async function loadUserProfiles(user) {
  if (!state.supabaseClient) return;

  try {
    // 1. Fetch current user profile
    const { data: profile, error } = await promiseTimeout(
      state.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(r => r),
      8000
    ).catch(e => ({ data: null, error: e }));

    // Guard against out-of-order responses when switching accounts quickly:
    // if the active user changed while this request was in flight, discard the
    // result so a previous account's premium/family state can't be applied.
    if (!state.currentUser || state.currentUser.id !== user.id) return;

    if (error || !profile) {
      // Insert profile manually if trigger didn't do it
      const { data: newProfile, error: insertError } = await promiseTimeout(
        state.supabaseClient
          .from('profiles')
          .insert([{ id: user.id, email: user.email, display_name: user.email.split('@')[0] }])
          .select()
          .single()
          .then(r => r),
        8000
      ).catch(e => ({ data: null, error: e }));

      if (insertError) {
        console.error('Failed to create profile:', insertError);
      } else {
        state.userProfile = newProfile;
        localStorage.setItem('cached_user_profile', JSON.stringify(newProfile));
        updateHeaderProfileBadge();
      }
    } else {
      state.userProfile = profile;
      localStorage.setItem('cached_user_profile', JSON.stringify(profile));
      updateHeaderProfileBadge();
    }

    // 2. Load family profiles & family group details
    if (state.userProfile && state.userProfile.family_id) {
      const [famRes, groupRes] = await promiseTimeout(
        Promise.all([
          state.supabaseClient.from('profiles').select('*').eq('family_id', state.userProfile.family_id),
          state.supabaseClient.from('family_groups').select('*').eq('id', state.userProfile.family_id).single()
        ]),
        8000
      ).catch(e => [{ data: null, error: e }, { data: null, error: e }]);

      if (famRes && famRes.data) {
        state.familyProfiles = famRes.data;
        localStorage.setItem('cached_family_profiles', JSON.stringify(famRes.data));
        const otherMember = state.familyProfiles.find(p => p.id !== user.id);
        if (state.familyProfiles.length === 2 && otherMember) {
          state.partnerProfile = otherMember;
          localStorage.setItem('cached_partner_profile', JSON.stringify(otherMember));
        } else {
          state.partnerProfile = null;
          localStorage.removeItem('cached_partner_profile');
        }
      } else {
        state.familyProfiles = [];
        localStorage.removeItem('cached_family_profiles');
      }

      if (groupRes && groupRes.data) {
        state.familyGroup = groupRes.data;
        localStorage.setItem('cached_family_group', JSON.stringify(groupRes.data));
      } else {
        state.familyGroup = null;
        localStorage.removeItem('cached_family_group');
      }

      // Re-register realtime subscription so family and partner channels are active
      if (typeof setupSupabaseRealtimeSubscription === 'function' && state.currentUser && state.supabaseClient) {
        setupSupabaseRealtimeSubscription();
      }
    } else {
      state.familyProfiles = [];
      state.familyGroup = null;
      state.partnerProfile = null;
      localStorage.removeItem('cached_partner_profile');
      localStorage.removeItem('cached_family_profiles');
      localStorage.removeItem('cached_family_group');

      // 3. Scan pending invitations for this user's email
      const pendingInviteCode = localStorage.getItem('pending_invite_code');
      if (pendingInviteCode) {
        localStorage.removeItem('pending_invite_code'); // Clear immediately
        setTimeout(() => showPendingInviteCodePrompt(pendingInviteCode), 1000);
      } else if (user.email) {
        const { data: pending } = await promiseTimeout(
          state.supabaseClient
            .from('pending_invitations')
            .select('*, family_groups(name, invite_code)')
            .eq('invited_email', user.email.trim().toLowerCase()),
          8000
        ).catch(e => ({ data: null, error: e }));

        if (pending && pending.length > 0) {
          setTimeout(() => showPendingInvitationPrompt(pending[0]), 1000);
        }
      }
    }
  } catch (e) {
    console.error('Error loading user profiles:', e);
  }

  // Refresh the Premium UI (Settings Hub badge + banner) so it reflects the
  // authoritative server profile on app load / login — not only when the user
  // taps the Premium card. Without this, a premium user would see "Upgrade"
  // until they open the Premium modal.
  if (typeof updatePremiumUI === 'function') {
    updatePremiumUI();
  }
}

function showPendingInviteCodePrompt(inviteCode) {
  if (!state.supabaseClient || !state.currentUser) return;

  state.supabaseClient
    .from('family_groups')
    .select('name')
    .eq('invite_code', inviteCode)
    .single()
    .then(({ data, error }) => {
      if (error || !data) {
        console.warn('Could not find family group for invite code:', inviteCode);
        return;
      }

      const familyName = data.name;
      const confirmMsg = state.lang === 'el'
        ? `📬 Εκκρεμής πρόσκληση!\nΈχετε έναν σύνδεσμο πρόσκλησης για την οικογένεια «${familyName}» (Κωδικός: ${inviteCode}).\n\nΘέλετε να γίνετε μέλος αυτής της οικογένειας;`
        : `📬 Pending invitation!\nYou have an invitation link for the family group "${familyName}" (Code: ${inviteCode}).\n\nDo you want to join this family group?`;

      showConfirm(confirmMsg, state.lang === 'el' ? '📬 Πρόσκληση' : '📬 Invitation', '👥').then((confirmed) => {
        if (confirmed) {
          const inviteRole = localStorage.getItem('pending_invite_role') || 'member';
          localStorage.removeItem('pending_invite_role');

          state.supabaseClient.rpc('join_family_group', { invite_code_input: inviteCode, invite_role_input: inviteRole })
            .then(({ data: joinData, error: joinErr }) => {
              if (joinErr) {
                window.showAlert(state.lang === 'el' ? 'Σφάλμα κατά τη σύνδεση: ' + joinErr.message : 'Error joining family: ' + joinErr.message);
              } else {
                window.showAlert(state.lang === 'el' ? '🎉 Συνδεθήκατε επιτυχώς στην οικογένεια!' : '🎉 Joined the family successfully!');
                window.location.reload();
              }
            });
        }
      });
    });
}

function showPendingInvitationPrompt(invite) {
  if (!state.supabaseClient || !state.currentUser) return;
  const familyName = invite.family_groups ? invite.family_groups.name : 'Οικογένεια';
  const confirmMsg = state.lang === 'el'
    ? `📬 Εκκρεμής πρόσκληση!\nΈχετε προσκληθεί να συνδεθείτε στην οικογένεια «${familyName}».\n\nΘέλετε να γίνετε μέλος αυτής της οικογένειας;`
    : `📬 Pending invitation!\nYou have been invited to join the family group "${familyName}".\n\nDo you want to join this family group?`;

  showConfirm(confirmMsg, state.lang === 'el' ? '📬 Πρόσκληση' : '📬 Invitation', '👥').then((confirmed) => {
    if (confirmed) {
      const inviteCode = invite.family_groups ? invite.family_groups.invite_code : '';
      if (!inviteCode) return;
      const inviteRole = invite.role || 'member';

      state.supabaseClient.rpc('join_family_group', { invite_code_input: inviteCode, invite_role_input: inviteRole })
        .then(async ({ data, error }) => {
          if (error) {
            window.showAlert(state.lang === 'el' ? 'Σφάλμα κατά τη σύνδεση: ' + error.message : 'Error joining family: ' + error.message);
          } else {
            window.showAlert(state.lang === 'el' ? '🎉 Συνδεθήκατε επιτυχώς στην οικογένεια!' : '🎉 Joined the family successfully!');
            window.location.reload();
          }
        });
    } else {
      // Delete the pending invitation from database so they are not prompted again
      state.supabaseClient.from('pending_invitations').delete().eq('id', invite.id).then(() => {
      });
    }
  });
}

// migrateLegacyTransactions removed for security & tenant isolation

function applyWalletTheme() {
  if (state.partnerProfile) {
    document.body.classList.add('shared-wallet-active');
  } else {
    document.body.classList.remove('shared-wallet-active');
  }

  // IMPORTANT: Always re-apply the user's chosen theme so that shared-wallet-active
  // never overrides the colour scheme. The theme is the single source of truth.
  // Clean ALL theme classes on BOTH <body> and <html> (same set as applyTheme),
  // then re-apply the full token set from the central THEMES config.
  const savedTheme = localStorage.getItem('app_theme') || 'dark';
  const themeClasses = ['theme-oled', 'theme-light', 'theme-emerald', 'theme-ocean', 'theme-pink', 'theme-sakura', 'theme-rosegold', 'theme-cyber'];
  themeClasses.forEach(cls => {
    document.body.classList.remove(cls);
    document.documentElement.classList.remove(cls);
  });
  if (savedTheme !== 'dark') {
    document.body.classList.add(`theme-${savedTheme}`);
    document.documentElement.classList.add(`theme-${savedTheme}`);
  }
  if (typeof applyTheme === 'function') applyTheme(savedTheme);
}


// Bind to window
window.applyWalletTheme = applyWalletTheme;

function getActiveTransactions() {
  const cachedUserStr = localStorage.getItem('cached_current_user');
  let fallbackUid = null;
  try { if (cachedUserStr) fallbackUid = JSON.parse(cachedUserStr).id; } catch (_) {}
  const currentUserId = state.currentUser ? state.currentUser.id : fallbackUid;
  const partnerId = state.partnerProfile ? state.partnerProfile.id : null;
  const familyId = state.userProfile ? state.userProfile.family_id : null;
  const isPersonalMode = state.activeAccountMode === 'personal';

  // Collect all known family member IDs
  const familyMemberIds = new Set();
  if (partnerId) familyMemberIds.add(partnerId);
  if (Array.isArray(state.familyProfiles)) {
    state.familyProfiles.forEach(p => {
      if (p && p.id && p.id !== currentUserId) familyMemberIds.add(p.id);
    });
  }

  const filtered = state.transactions.filter(t => {
    if (t.user_id === undefined) {
      return true;
    }

    if (currentUserId) {
      if (isPersonalMode) {
        return (t.user_id === currentUserId && (!t.family_id || t.family_id === null)) ||
          (t.id && String(t.id).startsWith('local_') && (!t.family_id || t.family_id === null));
      }

      if (familyId) {
        return t.family_id === familyId ||
          t.user_id === currentUserId ||
          familyMemberIds.has(t.user_id) ||
          (t.id && String(t.id).startsWith('local_'));
      }
      return t.user_id === currentUserId ||
        familyMemberIds.has(t.user_id) ||
        (t.id && String(t.id).startsWith('local_'));
    } else {
      // Guest mode: show unowned/legacy transactions AND guest-owned demo data
      // (user_id === 'guest' or is_demo / demo_ id). Demo transactions created via
      // onboardingAddDemoData() carry user_id 'guest', so without this they would be
      // silently filtered out and Demo Mode would appear empty for guests.
      return t.user_id === null || t.user_id === undefined ||
        t.user_id === 'guest' || t.is_demo === true ||
        (t.id && String(t.id).startsWith('demo_'));
    }
  });

  // Deduplicate by ID only (provable identity). Content-based dedup was REMOVED:
  // it dropped local_ transactions whose contents matched a cloud transaction,
  // which destroyed legitimate distinct transactions (same date/amount/category).
  // Per data-integrity policy we never drop a record based on content heuristics.
  const seenIds = new Set();
  return filtered.filter(t => {
    const id = t.id;
    if (!id) return true;
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
}

// Central helper that decides whether a transaction is a transfer.
// A transaction is a transfer when its type is 'transfer'. We ALSO treat a
// transaction as a transfer when its category is a transfer category (e.g.
// 'ΜΕΤΑΦΟΡΑ' / 'transfer'), which covers legacy records that were stored with
// type='expense' but a transfer category. Using this single helper everywhere
// keeps the exclusion from income/expense reports consistent across the app.
function isTransferTransaction(t) {
  if (!t) return false;
  if (t.type === 'transfer') return true;
  const cat = t.category ? String(t.category).toLowerCase() : '';
  return cat.includes('μεταφ') || cat.includes('transfer');
}

function calculateInitialBalances() {
  if (!state.accounts) return;
  state.accounts.forEach(acc => {
    let netSum = 0;
    // The account balance is stored in the account's own currency (acc.currency),
    // so every transaction must be converted into that currency before being
    // added/subtracted. Using CurrencyService.toBase(t) here would be wrong for
    // multi-currency accounts, because it returns the amount in the transaction's
    // base_currency rather than the account's currency.
    const accCurrency = acc.currency || getDisplayCurrency();
    // For family accounts during Personal Mode, calculate balance using all family transactions to avoid zero/distorted balances
    let activeTrans = getActiveTransactions();
    if (state.activeAccountMode === 'personal' && (acc.scope === 'family' || acc.family_id)) {
      const familyId = state.userProfile ? state.userProfile.family_id : null;
      const currentUserId = state.currentUser ? state.currentUser.id : null;
      const partnerId = state.partnerProfile ? state.partnerProfile.id : null;
      activeTrans = state.transactions.filter(t => {
        if (familyId) return t.family_id === familyId || t.user_id === currentUserId || t.user_id === partnerId;
        return t.user_id === currentUserId;
      });
    }
    activeTrans.forEach(t => {
      // displayAmount(t, accCurrency) converts the transaction amount into the
      // target account's currency (handles fx_snapshot / amount_base / rates).
      const amt = CurrencyService.displayAmount(t, accCurrency);
      // Use the same isTransferTransaction() helper as the reports so a legacy
      // record stored as type='expense' with a transfer category is treated as a
      // transfer here too (subtract from source, add to destination) instead of
      // being counted as an expense.
      if (isTransferTransaction(t)) {
        if (t.account_from === acc.name) netSum -= amt;
        if (t.account_to === acc.name) netSum += amt;
      } else {
        if (t.account_from === acc.name) {
          if (t.type === 'expense') netSum -= amt;
          else if (t.type === 'income') netSum += amt;
        }
      }
    });
    acc.initial_balance = sanitizeFloat((parseFloat(acc.balance) || 0) - netSum);
  });
}

// ============================================================
// FINANCIAL HEALTH SCORE (FHS) & FORECASTING ENGINE (classifyCategory, calculateFinancialHealthScore, calculateForecasting)
// Extracted to js/financialHealthEngine.js (Phase 11C Architectural Extraction)
// ============================================================


// Bind to window
window.getActiveTransactions = getActiveTransactions;
window.calculateInitialBalances = calculateInitialBalances;

// Scan categories and transactions to clean up duplicates (e.g. Chinese characters)
async function cleanDuplicateCategories() {
  const targetCategoryName = '🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ';

  // Find bad categories in the categories list
  const badCategories = state.categories.filter(c => c.name && (
    c.name.includes('茶') ||
    /[\u4e00-\u9fff]/.test(c.name) ||
    (c.name.includes('ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ') && c.name !== '🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ')
  ));

  // Find bad category names in transactions
  const badCategoryNamesInTrans = new Set();
  state.transactions.forEach(t => {
    if (t.category && (
      t.category.includes('茶') ||
      /[\u4e00-\u9fff]/.test(t.category) ||
      (t.category.includes('ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ') && t.category !== '🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ')
    )) {
      badCategoryNamesInTrans.add(t.category);
    }
  });

  if (badCategories.length === 0 && badCategoryNamesInTrans.size === 0) return;

  let didChange = false;
  const isOnline = state.supabaseClient && state.currentUser;

  // 1. Process bad category names in transactions
  for (const badCatName of badCategoryNamesInTrans) {
    try {
      if (isOnline) {
        await state.supabaseClient
          .from('transactions')
          .update({ category: targetCategoryName })
          .eq('category', badCatName);
      }

      // Update local state transactions
      state.transactions.forEach(t => {
        if (t.category === badCatName) {
          t.category = targetCategoryName;
        }
      });
      didChange = true;
    } catch (e) {
      console.error(`Error during transaction update for category name "${badCatName}":`, e);
    }
  }

  // 2. Process bad category objects from database list
  for (const badCat of badCategories) {
    try {
      if (isOnline) {
        await state.supabaseClient
          .from('transactions')
          .update({ category: targetCategoryName })
          .eq('category', badCat.name);

        await state.supabaseClient
          .from('categories')
          .delete()
          .eq('id', badCat.id);
      }

      // Update local state transactions (just in case)
      state.transactions.forEach(t => {
        if (t.category === badCat.name) {
          t.category = targetCategoryName;
        }
      });

      // Update local state categories
      state.categories = state.categories.filter(c => c.id !== badCat.id);
      didChange = true;
    } catch (e) {
      console.error(`Error cleaning up bad category object "${badCat.name}":`, e);
    }
  }

  if (didChange) {
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
    localStorage.setItem('offline_categories', JSON.stringify(state.categories));
    calculateInitialBalances();
    // Only call updateUI if we're not in the middle of a bulk sync operation
    // (which already schedules its own clean render at the end)
    if (typeof updateUI === 'function' && !_suppressRealtimeEvents) {
      updateUI();
    }
  }
}

// DATA-INTEGRITY SAFETY: This function previously grouped transactions by their
// VISIBLE CONTENTS (date/amount/category/note) and PERMANENTLY DELETED the
// "duplicates" from the cloud. That is unsafe: two legitimate, distinct
// transactions can be identical in every visible field, so content-based
// matching destroys real financial data. Per project policy we NEVER delete or
// overwrite user financial data based on heuristics unless the identity of the
// record is provably established.
//
// The only provable identity is the primary key `id`. Records with DIFFERENT
// ids are never considered duplicates, regardless of identical contents.
// This function now performs a safe, ID-based dedup only (removing records that
// share the exact same id) and NEVER deletes from the cloud.
async function cleanDuplicateTransactions() {
  if (!state.transactions || state.transactions.length === 0) return;

  const seenIds = new Set();
  const localCleaned = [];
  let didChangeLocal = false;

  state.transactions.forEach(t => {
    if (!t) return;
    if (t.id) {
      const idStr = String(t.id);
      if (seenIds.has(idStr)) {
        // Same provable id -> genuine duplicate; keep the first occurrence.
        didChangeLocal = true;
        return;
      }
      seenIds.add(idStr);
    }
    localCleaned.push(t);
  });

  if (didChangeLocal) {
    // Preserve sorting
    localCleaned.sort(compareTransactions);

    state.transactions = localCleaned;
    localStorage.setItem('offline_transactions', JSON.stringify(localCleaned));
    calculateInitialBalances();
    updateUI();
  }

  // NOTE: No cloud deletion is performed here. Cloud-side duplicate cleanup is
  // handled safely by the ID-based merge in js/transactionMerge.js.
}

window.cleanDuplicateTransactions = cleanDuplicateTransactions;

function getPendingLocalTransactions(cachedTransactions) {
  // Delegates to the tested pure implementation in js/transactionMerge.js.
  const deps = {
    syncQueue: readSyncQueueForMerge(),
    recentlySavedTxIds: (typeof _recentlySavedTxIds !== 'undefined' && _recentlySavedTxIds) ? _recentlySavedTxIds : null,
  };
  return window.TransactionMerge.getPendingLocalTransactions(cachedTransactions, deps);
}

// ---------------------------------------------------------------------------
// DATA-INTEGRITY HELPER: collect every transaction ID that must NEVER be
// re-uploaded / re-activated / re-introduced into local state.
//
// Sources:
//   1. The trash bin (deleted_transactions_trash) — the ONLY correct key.
//   2. Any transaction in the offline cache with status='deleted'.
//   3. The in-memory recently-deleted set (30s grace window).
//   4. Any queued 'delete' mutation in the sync queue.
//   5. The durable permanent-delete tombstone list (permanent_deleted_tx_ids).
//
// This is deliberately defensive: if the trash key is missing we log a warning
// rather than silently treating the exclusion set as empty, so a future key
// mismatch can never again silently resurrect deleted transactions.
// ---------------------------------------------------------------------------
const _PERMANENT_DELETED_LS_KEY = 'permanent_deleted_tx_ids';
function collectPermanentlyDeletedTxIds() {
  const excludedIds = new Set();
  const add = (id) => { if (id !== null && id !== undefined && id !== '') excludedIds.add(String(id)); };

  // 1. Trash bin (correct key). Log if the legacy wrong key is present so we
  //    can detect any residual stale data from the old bug.
  try {
    const trash = JSON.parse(localStorage.getItem('deleted_transactions_trash') || '[]') || [];
    trash.forEach(it => { if (it && it.id) add(it.id); });
  } catch (e) { console.warn('[DataIntegrity] Failed to read deleted_transactions_trash:', e); }
  try {
    const legacyTrash = JSON.parse(localStorage.getItem('trash_transactions') || '[]') || [];
    if (legacyTrash.length > 0) {
      console.warn('[DataIntegrity] Legacy trash_transactions key found with', legacyTrash.length, 'items — migrating to deleted_transactions_trash semantics.');
      legacyTrash.forEach(it => { if (it && it.id) add(it.id); });
    }
  } catch (e) { }

  // 2. Offline cache items already marked deleted.
  try {
    const cache = JSON.parse(localStorage.getItem('offline_transactions') || '[]') || [];
    cache.forEach(t => { if (t && t.status === 'deleted' && t.id) add(t.id); });
  } catch (e) { }

  // 3. Recently-deleted in-memory set.
  if (typeof _recentlyDeletedTxIds !== 'undefined' && _recentlyDeletedTxIds) {
    _recentlyDeletedTxIds.forEach(add);
  }

  // 4. Queued 'delete' mutations.
  try {
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]') || [];
    queue.forEach(item => {
      if (item && (item.action === 'delete' || item.action === 'permanent_delete_tx') && item.payload) {
        add(item.payload);
      }
    });
  } catch (e) { }

  // 5. Durable permanent-delete tombstone list.
  try {
    const perm = JSON.parse(localStorage.getItem(_PERMANENT_DELETED_LS_KEY) || '[]') || [];
    perm.forEach(add);
  } catch (e) { }

  return excludedIds;
}

// ---------------------------------------------------------------------------
// DATA-INTEGRITY SELF-HEALING: reconcileStaleTombstones
//
// The cloud is the source of truth for what is ACTIVE. If a transaction is
// reported active by the cloud (status='active') but a stale local tombstone /
// trash entry claims it was permanently deleted, that tombstone is WRONG and
// must be cleaned up. Otherwise the stale tombstone would hide the transaction
// from the UI (the bug that caused "dozens of transactions disappeared from
// web after refresh").
//
// We NEVER clean a tombstone for a transaction that is being deleted RIGHT NOW:
//   * in-flight (_deletingTxIds)
//   * within the recent grace window (_recentlyDeletedTxIds / recently_deleted_tx_ids)
//   * with a pending 'delete' / 'permanent_delete_tx' mutation in the sync queue
//
// Those are legitimate in-progress deletions and must keep their tombstones so
// the cloud soft-delete can propagate. Only STALE tombstones (where the cloud
// still reports the row active and no deletion is in flight) are removed.
//
// @param {Array<{id:string}>} cloudActiveTransactions  transactions the cloud
//        reports as active (status='active')
// @returns {number} number of stale tombstone entries cleaned
// ---------------------------------------------------------------------------
function reconcileStaleTombstones(cloudActiveTransactions) {
  if (!cloudActiveTransactions || !Array.isArray(cloudActiveTransactions) || cloudActiveTransactions.length === 0) {
    return 0;
  }

  // IDs the cloud reports as active.
  const cloudActiveIds = new Set(cloudActiveTransactions.map(t => (t && t.id) ? String(t.id) : null).filter(Boolean));

  // IDs that are legitimately being deleted right now (must keep tombstones).
  const inFlightDeletionIds = new Set();
  const addInFlight = (id) => { if (id !== null && id !== undefined && id !== '') inFlightDeletionIds.add(String(id)); };
  if (typeof _deletingTxIds !== 'undefined' && _deletingTxIds) _deletingTxIds.forEach(addInFlight);
  if (typeof _recentlyDeletedTxIds !== 'undefined' && _recentlyDeletedTxIds) _recentlyDeletedTxIds.forEach(addInFlight);
  try {
    const stored = JSON.parse(localStorage.getItem(_RECENTLY_DELETED_LS_KEY) || '{}');
    Object.keys(stored).forEach(addInFlight);
  } catch (_) { }
  try {
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]') || [];
    queue.forEach(item => {
      if (item && (item.action === 'delete' || item.action === 'permanent_delete_tx') && item.payload) {
        addInFlight(item.payload);
      }
    });
  } catch (_) { }

  // A tombstone ID is stale if the cloud reports it active AND it is not being
  // deleted right now.
  const staleIds = new Set();
  cloudActiveIds.forEach(id => {
    if (!inFlightDeletionIds.has(id)) staleIds.add(id);
  });

  if (staleIds.size === 0) return 0;

  let cleaned = 0;

  // 1. Clean the durable permanent-delete tombstone list.
  try {
    const perm = JSON.parse(localStorage.getItem(_PERMANENT_DELETED_LS_KEY) || '[]') || [];
    const before = perm.length;
    const cleanedPerm = perm.filter(id => !(id && staleIds.has(String(id))));
    if (cleanedPerm.length !== before) {
      localStorage.setItem(_PERMANENT_DELETED_LS_KEY, JSON.stringify(cleanedPerm));
      cleaned += (before - cleanedPerm.length);
    }
  } catch (e) { console.warn('[DataIntegrity] reconcileStaleTombstones: failed to clean permanent_deleted_tx_ids:', e); }

  // 2. Clean the trash bin (deleted_transactions_trash).
  try {
    const trash = JSON.parse(localStorage.getItem('deleted_transactions_trash') || '[]') || [];
    const before = trash.length;
    const cleanedTrash = trash.filter(it => !(it && it.id && staleIds.has(String(it.id))));
    if (cleanedTrash.length !== before) {
      localStorage.setItem('deleted_transactions_trash', JSON.stringify(cleanedTrash));
      cleaned += (before - cleanedTrash.length);
    }
  } catch (e) { console.warn('[DataIntegrity] reconcileStaleTombstones: failed to clean deleted_transactions_trash:', e); }

  // 3. Clean the legacy trash key (trash_transactions) if present.
  try {
    const legacyTrash = JSON.parse(localStorage.getItem('trash_transactions') || '[]') || [];
    const before = legacyTrash.length;
    const cleanedLegacy = legacyTrash.filter(it => !(it && it.id && staleIds.has(String(it.id))));
    if (cleanedLegacy.length !== before) {
      localStorage.setItem('trash_transactions', JSON.stringify(cleanedLegacy));
      cleaned += (before - cleanedLegacy.length);
    }
  } catch (e) { }

  // 4. Clean status='deleted' entries from the offline cache.
  try {
    const cache = JSON.parse(localStorage.getItem('offline_transactions') || '[]') || [];
    const before = cache.length;
    const cleanedCache = cache.filter(t => !(t && t.status === 'deleted' && t.id && staleIds.has(String(t.id))));
    if (cleanedCache.length !== before) {
      localStorage.setItem('offline_transactions', JSON.stringify(cleanedCache));
      cleaned += (before - cleanedCache.length);
    }
  } catch (e) { console.warn('[DataIntegrity] reconcileStaleTombstones: failed to clean offline_transactions:', e); }

  if (cleaned > 0) {
    console.info(`[DataIntegrity] reconcileStaleTombstones: cleaned ${cleaned} stale tombstone/trash entries for cloud-active transactions.`);
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// DATA-INTEGRITY HELPER: purge permanently-deleted transaction IDs from every
// local cache and queue so they can never be re-uploaded or re-introduced.
//
//   * state.transactions (in-memory)
//   * offline_transactions (localStorage cache)
//   * money_manager_sync_queue (stale save/upsert mutations for these IDs)
//   * durable permanent-delete tombstone list (permanent_deleted_tx_ids)
//
// Also writes a durable tombstone to the cloud (sync_tombstones) so other
// devices apply the permanent deletion. Best-effort; never blocks the delete.
// ---------------------------------------------------------------------------
function purgePermanentlyDeletedTxIds(ids, { writeCloudTombstone = false } = {}) {
  if (!ids || ids.length === 0) return;
  const idSet = new Set(ids.map(id => String(id)));

  // 1. Remove from in-memory state.
  if (Array.isArray(state.transactions)) {
    const before = state.transactions.length;
    state.transactions = state.transactions.filter(t => !(t && idSet.has(String(t.id))));
    if (state.transactions.length !== before) {
      console.info(`[DataIntegrity] Purged ${before - state.transactions.length} permanently-deleted tx from state.transactions.`);
    }
  }

  // 2. Remove from offline_transactions cache.
  try {
    const cache = JSON.parse(localStorage.getItem('offline_transactions') || '[]') || [];
    const before = cache.length;
    const cleaned = cache.filter(t => !(t && idSet.has(String(t.id))));
    if (cleaned.length !== before) {
      localStorage.setItem('offline_transactions', JSON.stringify(cleaned));
      console.info(`[DataIntegrity] Purged ${before - cleaned.length} permanently-deleted tx from offline_transactions.`);
    }
  } catch (e) { console.warn('[DataIntegrity] Failed to purge offline_transactions:', e); }

  // 3. Remove stale save/upsert mutations for these IDs from the sync queue.
  try {
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]') || [];
    const before = queue.length;
    const cleaned = queue.filter(item => {
      if (!item) return false;
      const isDelete = item.action === 'delete' || item.action === 'permanent_delete_tx';
      const itemId = isDelete ? item.payload : (item.payload && item.payload.id ? item.payload.id : item.payload);
      return !(itemId && idSet.has(String(itemId)));
    });
    if (cleaned.length !== before) {
      localStorage.setItem('money_manager_sync_queue', JSON.stringify(cleaned));
      console.info(`[DataIntegrity] Purged ${before - cleaned.length} stale sync-queue mutations for permanently-deleted tx.`);
    }
  } catch (e) { console.warn('[DataIntegrity] Failed to purge sync queue:', e); }

  // 4. Record durable permanent-delete tombstones locally.
  try {
    const perm = JSON.parse(localStorage.getItem(_PERMANENT_DELETED_LS_KEY) || '[]') || [];
    const permSet = new Set(perm.map(id => String(id)));
    let changed = false;
    idSet.forEach(id => { if (!permSet.has(id)) { permSet.add(id); changed = true; } });
    if (changed) {
      localStorage.setItem(_PERMANENT_DELETED_LS_KEY, JSON.stringify(Array.from(permSet)));
    }
  } catch (e) { console.warn('[DataIntegrity] Failed to record permanent-delete tombstone:', e); }

  // 5. Write durable tombstones to the cloud (best-effort).
  if (writeCloudTombstone && state.supabaseClient && state.currentUser) {
    writeSyncTombstones('transactions', Array.from(idSet)).catch(err => {
      console.warn('[DataIntegrity] Failed to write permanent-delete tombstone to cloud:', err);
    });
  }
}

async function autoSyncMissingTransactionsToCloud(cloudTransactions, userId) {
  if (!state.supabaseClient || !userId) return [];
  const cloudIds = new Set((cloudTransactions || []).map(t => String(t.id)));

  // Collect deleted IDs from trash and sync queue so we NEVER resurrect deleted items.
  // Uses the defensive helper (correct key + deleted-status cache + tombstones).
  const excludedIds = collectPermanentlyDeletedTxIds();

  // Only consider active transactions currently in state.transactions
  const localTxs = Array.isArray(state.transactions) ? state.transactions : [];
  const missingInCloud = [];
  const seenMissingIds = new Set();
  localTxs.forEach(t => {
    if (t && t.id && !cloudIds.has(String(t.id)) && !seenMissingIds.has(String(t.id)) && !t.is_demo && !String(t.id).startsWith('demo_')) {
      if (t.status !== 'deleted' && !excludedIds.has(String(t.id))) {
        seenMissingIds.add(String(t.id));
        missingInCloud.push(t);
      }
    }
  });

  if (missingInCloud.length > 0) {
    console.info(`[AutoSync] Uploading ${missingInCloud.length} active local transactions to cloud...`);
    const dbPayloads = missingInCloud.map(mapTransactionToDb).filter(Boolean);
    for (let i = 0; i < dbPayloads.length; i += 50) {
      const batch = dbPayloads.slice(i, i + 50);
      try {
        const { error } = await promiseTimeout(
          state.supabaseClient.from('transactions').upsert(batch, { onConflict: 'id' }),
          30000
        );
        if (error) {
          console.error('[AutoSync] Cloud batch upload failed:', error);
        } else {
          console.info(`[AutoSync] Successfully uploaded batch of ${batch.length} transactions.`);
        }
      } catch (err) {
        console.error('[AutoSync] Cloud batch upload exception:', err);
      }
    }
    return missingInCloud;
  }
  return [];
}
window.autoSyncMissingTransactionsToCloud = autoSyncMissingTransactionsToCloud;

// ============================================================
// DATA LOADING
// ============================================================
async function loadData() {
  // Cancel any pending realtime debounce timer to prevent stale DB events
  // from overwriting the fresh data we are about to fetch.
  if (_realtimeDebounceTimer) {
    clearTimeout(_realtimeDebounceTimer);
    _realtimeDebounceTimer = null;
    _pendingRealtimeEvents = [];
  }

  // PRIVACY/ISOLATION: In guest mode, never fetch or load a previous account's
  // personal data from the cloud. Guest mode always starts with a clean slate.
  if (state.guestMode) {
    loadOfflineData();
    updateHeaderSyncIcon('offline');
    return;
  }

  // 1. INSTANT LOCAL CACHE LOAD (0ms):
  // Immediately load cached data into memory and render the UI.
  // The user sees all transactions, accounts, categories, and balances INSTANTLY
  // on cold start without waiting for any network round-trip.
  loadOfflineData();
  calculateInitialBalances();
  updateUI();

  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      updateHeaderSyncIcon('syncing');

      // Process offline queue first (flushes offline deletes/saves) before fetching latest transactions
      await processSyncQueue({ skipReload: true });

      const userId = state.currentUser.id;
      const partnerId = state.partnerProfile ? state.partnerProfile.id : null;

      // Fetch categories & accounts first
      const familyId = state.userProfile ? state.userProfile.family_id : null;
      let catsQuery = state.supabaseClient.from('categories').select('*');
      let accsQuery = state.supabaseClient.from('accounts').select('*');
      let tempsQuery = state.supabaseClient.from('recurring_templates').select('*');

      if (familyId && partnerId) {
        const filter = `family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}`;
        catsQuery = catsQuery.or(filter);
        accsQuery = accsQuery.or(filter);
        tempsQuery = tempsQuery.or(filter);
      } else if (familyId) {
        const filter = `family_id.eq.${familyId},user_id.eq.${userId}`;
        catsQuery = catsQuery.or(filter);
        accsQuery = accsQuery.or(filter);
        tempsQuery = tempsQuery.or(filter);
      } else if (partnerId) {
        const filter = `user_id.eq.${userId},user_id.eq.${partnerId}`;
        catsQuery = catsQuery.or(filter);
        accsQuery = accsQuery.or(filter);
        tempsQuery = tempsQuery.or(filter);
      } else {
        catsQuery = catsQuery.eq('user_id', userId);
        accsQuery = accsQuery.eq('user_id', userId);
        tempsQuery = tempsQuery.eq('user_id', userId);
      }

      const [catsRes, accsRes, tempsRes] = await promiseTimeout(
        Promise.all([
          catsQuery,
          accsQuery,
          tempsQuery.then(r => r, () => ({ data: [], error: null }))
        ]),
        15000
      );
      if (catsRes.error) throw catsRes.error;
      if (accsRes.error) throw accsRes.error;

      // Fetch all transactions with pagination (due to Supabase PostgREST default 1000 limit)
      let allTransactions = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let transQuery = state.supabaseClient
          .from('transactions')
          .select('*')
          .eq('status', 'active')
          .order('date', { ascending: false })
          .order('id', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (familyId) {
          if (partnerId) {
            transQuery = transQuery.or(`family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}`);
          } else {
            transQuery = transQuery.or(`family_id.eq.${familyId},user_id.eq.${userId}`);
          }
        } else if (partnerId) {
          transQuery = transQuery.or(`user_id.eq.${userId},user_id.eq.${partnerId}`);
        } else {
          transQuery = transQuery.eq('user_id', userId);
        }

        const { data: pageData, error: pageErr } = await promiseTimeout(
          transQuery,
          15000
        );
        if (pageErr) throw pageErr;

        if (pageData && pageData.length > 0) {
          allTransactions = allTransactions.concat(pageData);
          if (pageData.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      // DATA-INTEGRITY SELF-HEALING: The cloud is the source of truth for what is
      // active. Clean any stale local tombstone/trash entries that claim a
      // cloud-active transaction was permanently deleted (this is what caused
      // "dozens of transactions disappeared from web after refresh").
      try {
        reconcileStaleTombstones(allTransactions);
      } catch (reconcileErr) {
        console.warn('[DataIntegrity] reconcileStaleTombstones failed in loadData:', reconcileErr);
      }

      let categories = catsRes.data || [];
      let accounts = accsRes.data || [];
      if (tempsRes && tempsRes.data) {
        const cloudTemps = tempsRes.data.map(mapTemplateFromDb);
        state.recurringTemplates = mergeAndDeduplicateTemplates(cloudTemps, state.recurringTemplates);
        cleanDuplicateTemplates();
        localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
      }

      // Pre-populate standard categories in the cloud for this user if they don't have any
      if (!categories || categories.length === 0) {
        const now = new Date().toISOString();
        const catsToInsert = DEFAULT_CATEGORIES.map(c => ({
          id: typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID(),
          name: c.name,
          type: c.type,
          icon: c.icon,
          color: c.color,
          user_id: userId,
          family_id: familyId,
          created_at: now,
          updated_at: now
        }));
        try {
          const { data: newCats, error: catErr } = await state.supabaseClient.from('categories').insert(catsToInsert).select();
          if (!catErr && newCats && newCats.length > 0) {
            categories = newCats;
          } else {
            console.warn('Failed to pre-populate categories:', catErr);
            categories = DEFAULT_CATEGORIES.slice();
          }
        } catch (e) {
          console.warn('Failed to pre-populate categories catch:', e);
          categories = DEFAULT_CATEGORIES.slice();
        }
      }

      // Pre-populate standard accounts in the cloud for this user if they don't have any
      if (!accounts || accounts.length === 0) {
        const now = new Date().toISOString();
        const accsToInsert = DEFAULT_ACCOUNTS.map(a => ({
          id: typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID(),
          name: a.name,
          type: a.type,
          balance: a.balance,
          user_id: userId,
          family_id: familyId,
          created_at: now,
          updated_at: now
        }));
        try {
          const { data: newAccs, error: accErr } = await state.supabaseClient.from('accounts').insert(accsToInsert).select();
          if (!accErr && newAccs && newAccs.length > 0) {
            accounts = newAccs;
          } else {
            console.warn('Failed to pre-populate accounts:', accErr);
            accounts = DEFAULT_ACCOUNTS.slice();
          }
        } catch (e) {
          console.warn('Failed to pre-populate accounts catch:', e);
          accounts = DEFAULT_ACCOUNTS.slice();
        }
      }

      // Preserve pending local transactions that failed to sync (offline fallback),
      // so they are not lost when fresh cloud data overwrites local cache.
      //
      // ACCOUNT-ISOLATION (fix): The offline cache is NOT account-scoped, so when a
      // user signs into a DIFFERENT account, the previous account's unsynced local
      // transactions would otherwise be merged into this account's data (a
      // cross-account data leak). We only preserve/merge pending local transactions
      // when the cache belongs to the current user (or is unowned guest/legacy data).
      const cachedOwner = localStorage.getItem('offline_transactions_owner');
      const cacheBelongsToCurrentUser = !cachedOwner || cachedOwner === userId;
      const pendingLocal = cacheBelongsToCurrentUser
        ? getPendingLocalTransactions(JSON.parse(localStorage.getItem('offline_transactions') || '[]'))
        : [];

      // Auto-rescue & sync any local transactions missing in the cloud
      const missingSynced = await autoSyncMissingTransactionsToCloud(allTransactions, userId);
      if (missingSynced && missingSynced.length > 0) {
        allTransactions = [...allTransactions, ...missingSynced];
      }

      // Deduplicate merged transactions (ID-based only — content-based dedup was
      // removed because it destroyed legitimate identical transactions).
      const cachedForMerge = cacheBelongsToCurrentUser
        ? (JSON.parse(localStorage.getItem('offline_transactions') || '[]') || [])
        : [];
      const updatedCloudIds = new Set(allTransactions.map(t => String(t.id)));
      const cachedMissingFromCloud = cachedForMerge.filter(t =>
        !(t && t.id && updatedCloudIds.has(String(t.id)))
      );
      // Durable tombstone guard: never reintroduce a permanently-deleted transaction
      // from the offline cache into state (defense-in-depth; the merge also excludes
      // these IDs via deps.permanentlyDeletedTxIds).
      let permanentlyDeletedSet = null;
      try {
        permanentlyDeletedSet = new Set(Array.from(collectPermanentlyDeletedTxIds()).map(String));
      } catch (err) {
        console.warn('Failed to collect permanently deleted IDs in loadData merge:', err);
      }
      const safeCachedMissingFromCloud = (permanentlyDeletedSet
        ? cachedMissingFromCloud.filter(t => !(t && t.id && permanentlyDeletedSet.has(String(t.id))))
        : cachedMissingFromCloud
      ).filter(t => {
        if (!t || !t.id) return false;
        const isRecurringOrigin = !!(t.recurring_template_id || String(t.id).startsWith('recurring_') || (typeof isTransactionRecurring === 'function' && isTransactionRecurring(t)));
        if (isRecurringOrigin && t.date) {
          const tMonth = String(t.date).slice(0, 7);
          const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
          const tNote = normalizeGreekString(t.note || t.description || '');
          const hasCloudOccurrenceInSameMonth = allTransactions.some(cTx => {
            if (!cTx || !cTx.date || String(cTx.date).slice(0, 7) !== tMonth) return false;
            if (t.recurring_template_id && cTx.recurring_template_id && String(t.recurring_template_id) === String(cTx.recurring_template_id)) return true;
            const cAmount = (parseFloat(cTx.amount) || 0).toFixed(2);
            const cNote = normalizeGreekString(cTx.note || cTx.description || '');
            return cAmount === tAmount && cTx.type === t.type && isSameCategory(cTx.category, t.category) && tNote.length > 0 && cNote === tNote;
          });
          if (hasCloudOccurrenceInSameMonth) {
            return false;
          }
        }
        return true;
      });
      const mergedTransactions = mergeAndDeduplicateTransactions(allTransactions, [...pendingLocal, ...safeCachedMissingFromCloud]);
      mergedTransactions.sort(compareTransactions);
      state.transactions = mergedTransactions;

      // Merge categories: retain any local custom categories that haven't synced to cloud yet
      const cloudCatNames = new Set((categories || []).map(c => c && c.name ? c.name.trim().toLowerCase() : ''));
      const localCustomCats = (state.categories || []).filter(c => c && c.name && !cloudCatNames.has(c.name.trim().toLowerCase()));
      state.categories = [...(categories || []), ...localCustomCats];
      deduplicateCategories();

      // If there are unsynced local categories, sync them to cloud in background
      if (localCustomCats.length > 0 && state.supabaseClient && userId) {
        localCustomCats.forEach(localCat => {
          const now = new Date().toISOString();
          state.supabaseClient.from('categories').insert({
            id: localCat.id || (typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID()),
            user_id: userId,
            family_id: familyId,
            name: localCat.name,
            type: localCat.type || 'expense',
            icon: localCat.icon || '💸',
            color: localCat.color || '#78909c',
            hidden: !!localCat.hidden,
            created_at: localCat.created_at || now,
            updated_at: localCat.updated_at || now
          }).then(({ error }) => { if (error) console.warn('Background sync category warning:', error); });
        });
      }

      state.accounts = accounts;

      calculateInitialBalances();

      autoRecoverTemplatesFromHistory();

      // Link existing transactions to their recurring templates (content-key
      // backfill) so the recurring delete options appear from the transaction
      // modal even for transactions saved before recurring_template_id was kept.
      backfillRecurringTemplateIds();

      // Clean up any cross-language duplicate templates or duplicate recurring transactions
      cleanCrossLanguageRecurringDuplicates();

      localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
      localStorage.setItem('offline_accounts', JSON.stringify(state.accounts));
      localStorage.setItem('offline_categories', JSON.stringify(state.categories));
      // ACCOUNT-ISOLATION: Attribute the local cache to the current user so a
      // later sign-in with a DIFFERENT account does not import/merge this data.
      localStorage.setItem('offline_transactions_owner', userId);

      // Establish incremental sync cursor baseline from full fetch
      try {
        if (typeof getSyncCursors === 'function' && typeof saveSyncCursors === 'function') {
          const cursors = getSyncCursors();
          const nextCursors = { ...cursors };
          if (allTransactions.length > 0) {
            let maxTs = '';
            let maxId = '';
            for (let i = 0; i < allTransactions.length; i++) {
              const tx = allTransactions[i];
              const txTs = tx.updated_at || tx.created_at || '';
              if (txTs && (!maxTs || txTs > maxTs)) {
                maxTs = txTs;
                maxId = tx.id || '';
              }
            }
            nextCursors.transactions = maxTs ? { ts: maxTs, id: maxId } : { ts: new Date().toISOString(), id: '00000000-0000-0000-0000-000000000000' };
          } else {
            nextCursors.transactions = { ts: new Date(0).toISOString(), id: '00000000-0000-0000-0000-000000000000' };
          }
          saveSyncCursors(nextCursors);
          if (typeof markFullSyncDone === 'function') markFullSyncDone();
        }
      } catch (_) { }

      updateHeaderSyncIcon('synced');
      calculateInitialBalances();
      pushNoTransition();
      updateUI();
      window._initialDataLoaded = true;
      setTimeout(() => {
        popNoTransition();
      }, 1000);

      // Run automatic duplicate / corrupt category cleanup in background
      cleanDuplicateCategories().catch(e => console.warn('Automatic categories cleanup error:', e));

      // NOTE: cleanDuplicateTransactions no longer needed here since we dedup inline above.
      // It is kept available for manual/sync-triggered calls only.

      // Try to flush pending local items in background without blocking UI.
      if (pendingLocal.length > 0) {
        syncLocalTransactionsToCloud(userId, { silent: true }).catch(() => { });
      }
    } catch (err) {
      console.error('Supabase fetch failed, falling back to offline cache:', err);
      // Load from cache and show offline state (not error) so user knows data is still visible
      loadOfflineData();
      updateHeaderSyncIcon('offline');
      updateUI();
      if (err && typeof showSyncToast === 'function') {
        const errorMsg = err.message || (typeof err === 'string' ? err : JSON.stringify(err));
        showSyncToast('⚠️ Σφάλμα συγχρονισμού: ' + errorMsg, 8000);
      }
    }
  } else {
    updateHeaderSyncIcon('offline');
    loadOfflineData();
  }
}

function loadOfflineData() {
  // PRIVACY/ISOLATION: In guest mode, never load a previous account's cached
  // personal data (transactions, accounts, categories, recurring templates,
  // notes, trash, notifications). Guest mode must always start with a clean
  // slate. The cached data stays in localStorage so it is preserved for when
  // the user logs back into their own account.
  const isGuest = !!state.guestMode;

  if (isGuest) {
    state.currentUser = null;
    state.partnerProfile = null;
    state.userProfile = null;
    state.familyProfiles = [];
    state.familyGroup = null;
    // PRIVACY/ISOLATION: Guest mode starts with a clean slate, so we never load a
    // previous account's personal data. However, DEMO data (is_demo / demo_ id) that
    // the guest explicitly added via onboardingAddDemoData() must be preserved — it is
    // guest-owned sample data, not another account's private data. Without this, the
    // demo transactions/budgets are wiped the moment loadData() -> loadOfflineData()
    // runs right after they are created, so the Demo Mode appears broken for guests.
    const isDemoItem = (it) => it && (it.is_demo || (it.id && String(it.id).startsWith('demo_')));
    try {
      const cachedTxs = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
      state.transactions = Array.isArray(cachedTxs) ? cachedTxs.filter(isDemoItem) : [];
    } catch (e) {
      state.transactions = [];
    }
    try {
      const cachedBudgets = JSON.parse(localStorage.getItem('cached_budgets') || '[]');
      state.budgets = Array.isArray(cachedBudgets) ? cachedBudgets.filter(isDemoItem) : [];
    } catch (e) {
      state.budgets = [];
    }
    state.accounts = DEFAULT_ACCOUNTS.slice();
    state.categories = DEFAULT_CATEGORIES.slice();
    state.recurringTemplates = [];
    state.deletedRecurringDates = [];
    state.trashTransactions = [];
    state.notifications = [];
    state.notes = [];
    calculateInitialBalances();
    return;
  }

  try {
    const cachedUser = localStorage.getItem('cached_current_user');
    if (cachedUser) {
      state.currentUser = JSON.parse(cachedUser);
    }
  } catch (e) {
    console.error('Failed to parse cached current user:', e);
  }
  try {
    const cachedPartner = localStorage.getItem('cached_partner_profile');
    if (cachedPartner) {
      state.partnerProfile = JSON.parse(cachedPartner);
    }
  } catch (e) {
    console.error('Failed to parse cached partner profile:', e);
  }
  try {
    const cachedProfile = localStorage.getItem('cached_user_profile');
    if (cachedProfile) {
      const parsedProfile = JSON.parse(cachedProfile);
      // PRIVACY/ISOLATION: Only restore the cached profile if it belongs to the
      // cached current user. A previous account's state must not leak.
      if (parsedProfile && state.currentUser && state.currentUser.id) {
        if (parsedProfile.id === state.currentUser.id) {
          state.userProfile = parsedProfile;
        } else {
          localStorage.removeItem('cached_user_profile');
        }
      } else if (parsedProfile) {
        state.userProfile = parsedProfile;
      }
    }
  } catch (e) {
    console.error('Failed to parse cached user profile:', e);
  }
  try {
    const cachedFamily = localStorage.getItem('cached_family_profiles');
    state.familyProfiles = cachedFamily ? JSON.parse(cachedFamily) : [];
  } catch (e) {
    console.error('Failed to parse cached family profiles:', e);
    state.familyProfiles = [];
  }
  try {
    const cachedGroup = localStorage.getItem('cached_family_group');
    state.familyGroup = cachedGroup ? JSON.parse(cachedGroup) : null;
  } catch (e) {
    console.error('Failed to parse cached family group:', e);
    state.familyGroup = null;
  }

  try {
    if (!state.currentUser && !localStorage.getItem('cached_current_user')) {
      state.transactions = getOfflineGuestTransactions();
    } else {
      const trans = localStorage.getItem('offline_transactions');
      state.transactions = trans ? JSON.parse(trans) : [];
    }
  } catch (e) {
    console.error('Failed to parse offline transactions:', e);
    state.transactions = [];
  }
  try {
    const accs = localStorage.getItem('offline_accounts');
    const parsedAccs = accs ? JSON.parse(accs) : null;
    state.accounts = (Array.isArray(parsedAccs) && parsedAccs.length > 0) ? parsedAccs : DEFAULT_ACCOUNTS.slice();
  } catch (e) {
    console.error('Failed to parse offline accounts:', e);
    state.accounts = DEFAULT_ACCOUNTS.slice();
  }
  try {
    const cats = localStorage.getItem('offline_categories');
    const parsedCats = cats ? JSON.parse(cats) : null;
    state.categories = (Array.isArray(parsedCats) && parsedCats.length > 0) ? parsedCats : DEFAULT_CATEGORIES.slice();
    deduplicateCategories();
  } catch (e) {
    console.error('Failed to parse offline categories:', e);
    state.categories = DEFAULT_CATEGORIES.slice();
    deduplicateCategories();
  }

  // PRIVACY/ISOLATION: Only load recurring templates into memory when there is an
  // actual (cached or active) user. When the app is on the login screen / guest
  // boot, a stale 'recurring_templates' cache from a previous account must never
  // be loaded, otherwise processRecurringTemplates() below would regenerate that
  // account's recurring transactions into the unowned guest cache
  // (offline_guest_transactions) — leaking personal data into the next guest session.
  const hasUserContext = !!(state.currentUser || localStorage.getItem('cached_current_user'));
  try {
    const temps = hasUserContext ? localStorage.getItem('recurring_templates') : null;
    state.recurringTemplates = temps ? JSON.parse(temps) : [];
  } catch (e) {
    console.error('Failed to parse recurring templates:', e);
    state.recurringTemplates = [];
  }
  try {
    const deleted = hasUserContext ? localStorage.getItem('deleted_recurring_dates') : null;
    state.deletedRecurringDates = deleted ? JSON.parse(deleted) : [];
  } catch (e) {
    console.error('Failed to parse deleted recurring dates:', e);
    state.deletedRecurringDates = [];
  }
  try {
    const trash = localStorage.getItem('deleted_transactions_trash');
    const parsedTrash = trash ? JSON.parse(trash) : [];
    const currentUid = state.currentUser ? state.currentUser.id : (localStorage.getItem('cached_current_user') ? JSON.parse(localStorage.getItem('cached_current_user')).id : null);
    if (currentUid) {
      state.trashTransactions = parsedTrash.filter(t => !t || !t.user_id || t.user_id === currentUid || (state.partnerProfile && t.user_id === state.partnerProfile.id) || (state.userProfile && t.family_id && t.family_id === state.userProfile.family_id));
    } else {
      state.trashTransactions = parsedTrash.filter(t => !t || !t.user_id);
    }
  } catch (e) {
    console.error('Failed to parse deleted transactions trash:', e);
    state.trashTransactions = [];
  }
  try {
    const notifs = localStorage.getItem('state_notifications') || localStorage.getItem('money_manager_notifications');
    state.notifications = notifs ? JSON.parse(notifs) : [];
  } catch (e) {
    console.error('Failed to parse notifications:', e);
    state.notifications = [];
  }

  loadNotes();
  loadBudgets();

  cleanCrossLanguageRecurringDuplicates();
  // PRIVACY/ISOLATION: Only generate recurring occurrences when an actual user is
  // present. With no user (logged out / login screen / guest boot) this function
  // would write the generated transactions into the unowned guest cache via
  // saveTransactionOffline(), leaking a previous account's recurring data into the
  // next guest session.
  if (state.currentUser || localStorage.getItem('cached_current_user')) {
    processRecurringTemplates();
  }
  cleanCrossLanguageRecurringDuplicates();
  calculateInitialBalances();
  cleanDuplicateCategories().catch(e => console.warn('Offline automatic categories cleanup error:', e));
}




function autoRecoverTemplatesFromHistory() {
  // Permanently disabled: auto-recovery from historical transactions caused
  // spurious duplicate recurring templates. Guard flag kept for backward compatibility.
  try {
    localStorage.setItem('templates_autorecovered', 'true');
  } catch (e) { }
}
// getDeletedDatesFromTemplate → extracted to js/recurringDates.js (Phase 2, Extraction 5)
// addDeletedDateToTemplate → extracted to js/recurringDates.js (Phase 2, Extraction 5)

// Cross-language and canonical category comparison helper:
// Matches category names across Greek and English translations, emoji prefixes,
// casing, and accents (e.g. "Home" === "Σπίτι", "🏡 Home" === "🏡 ΣΠΙΤΙ").
function isSameCategory(catA, catB) {
  if (!catA && !catB) return true;
  if (!catA || !catB) return false;
  if (catA === catB) return true;

  const normA = normalizeString(stripLeadingEmoji(String(catA)).trim());
  const normB = normalizeString(stripLeadingEmoji(String(catB)).trim());
  if (normA && normB && normA === normB) return true;

  const translations = (typeof CATEGORY_NAME_TRANSLATIONS !== 'undefined')
    ? CATEGORY_NAME_TRANSLATIONS
    : ((typeof window !== 'undefined' && window.CATEGORY_NAME_TRANSLATIONS) || {});

  for (const [elKey, enVal] of Object.entries(translations)) {
    const normEl = normalizeString(stripLeadingEmoji(elKey).trim());
    const normEn = normalizeString(stripLeadingEmoji(enVal).trim());

    const aMatches = (normA === normEl || normA === normEn);
    const bMatches = (normB === normEl || normB === normEn);

    if (aMatches && bMatches) {
      return true;
    }
  }

  return false;
}
window.isSameCategory = isSameCategory;

// Automatically cleans up duplicate recurring installments generated when
// an existing transaction was stored in one language (e.g. English "Home")
// Helper: Generate a deterministic, valid RFC4122 v4 UUID from template ID and date.
// Ensures that generating an installment for a given template+date always produces
// the exact same valid UUID, which Supabase accepts without PostgreSQL type errors.
function generateDeterministicUUID(templateId, dateString) {
  const str = `rec_${templateId}_${dateString}`;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x7fed211a, h4 = 0x12345678;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 3812015801);
    h4 = Math.imul(h4 ^ ch, 2718281829);
  }
  const toHex = (n) => (n >>> 0).toString(16).padStart(8, '0');
  const hex = toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
window.generateDeterministicUUID = generateDeterministicUUID;

// Report-only duplicate inspection for recurring templates (auditing only, zero deletions)
function cleanDuplicateTemplates() {
  if (!state.recurringTemplates || state.recurringTemplates.length < 2) return;

  const deduped = [];
  const removedIds = new Set();

  for (const t of state.recurringTemplates) {
    if (!t) continue;
    const tNote = normalizeGreekString(t.note || t.description || t.title || '');
    const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
    const tType = t.type;
    const tCat = t.category;
    const tPreset = t.preset || 'custom';

    const isDup = deduped.some(other => {
      if (String(t.id) === String(other.id)) return true;
      const oNote = normalizeGreekString(other.note || other.description || other.title || '');
      const oAmount = (parseFloat(other.amount) || 0).toFixed(2);
      const oType = other.type;
      const oCat = other.category;
      const oPreset = other.preset || 'custom';

      const sameNote = (tNote.length > 0 && oNote.length > 0) ? (tNote === oNote) : (tNote.length === 0 && oNote.length === 0);
      const sameAmount = tAmount === oAmount;
      const sameType = tType === oType;
      const sameCat = (typeof isSameCategory === 'function') ? isSameCategory(tCat, oCat) : (tCat === oCat);
      const samePreset = tPreset === oPreset;

      return sameNote && sameAmount && sameType && sameCat && samePreset;
    });

    if (!isDup) {
      deduped.push(t);
    } else {
      if (t.id) removedIds.add(String(t.id));
    }
  }

  state.recurringTemplates = deduped;
  if (removedIds.size > 0 && Array.isArray(state.transactions)) {
    state.transactions = state.transactions.filter(tx => !removedIds.has(String(tx.recurring_template_id)));
  }
}
window.cleanDuplicateTemplates = cleanDuplicateTemplates;

// Automatically cleans up duplicate recurring installments generated when
// an existing transaction was stored in one language (e.g. English "Home")
// while the template was evaluated in another (e.g. Greek "Σπίτι"), or when
// multiple passes / syncs generated extra rows with random/different IDs.
// Fast O(N) duplicate cleaner: groups transactions by date (only ~1-5 txs per date)
function cleanCrossLanguageRecurringDuplicates() {
  cleanDuplicateTemplates();

  if (!state.transactions || state.transactions.length < 2) return;
  const txs = state.transactions;
  const toDeleteIds = new Set();

  // Fast O(N) grouping by date string — completely avoids O(N^2) lag
  const dateGroups = new Map();
  for (let i = 0; i < txs.length; i++) {
    const t = txs[i];
    const dStr = String(t.date || '').split('T')[0].split(' ')[0];
    if (!dStr) continue;
    if (!dateGroups.has(dStr)) dateGroups.set(dStr, []);
    dateGroups.get(dStr).push(t);
  }

  dateGroups.forEach((dayTxs) => {
    if (dayTxs.length < 2) return;

    for (let i = 0; i < dayTxs.length; i++) {
      const t1 = dayTxs[i];
      if (toDeleteIds.has(t1.id)) continue;
      const t1Amount = (parseFloat(t1.amount) || 0).toFixed(2);
      const t1Type = t1.type;
      const t1Note = normalizeGreekString(t1.note || t1.description || '');
      const isRecurringPrefix1 = String(t1.id || '').startsWith('recurring_');
      const isRecurring1 = !!(t1.recurring_template_id || isRecurringPrefix1);

      for (let j = i + 1; j < dayTxs.length; j++) {
        const t2 = dayTxs[j];
        if (toDeleteIds.has(t2.id)) continue;
        const t2Amount = (parseFloat(t2.amount) || 0).toFixed(2);
        const t2Type = t2.type;
        const t2Note = normalizeGreekString(t2.note || t2.description || '');
        const isRecurringPrefix2 = String(t2.id || '').startsWith('recurring_');
        const isRecurring2 = !!(t2.recurring_template_id || isRecurringPrefix2);

        // CRITICAL DATA INTEGRITY: Only evaluate duplicate candidates if BOTH
        // transactions are provably generated from a recurring template or has a legacy recurring prefix.
        // NEVER EVER deduplicate or delete regular/manual user transactions!
        if (!isRecurring1 || !isRecurring2) continue;

        if (t1Amount === t2Amount && t1Type === t2Type) {
          const sameTemplate = t1.recurring_template_id && t2.recurring_template_id && (String(t1.recurring_template_id) === String(t2.recurring_template_id));
          const exactNoteMatch = (t1Note.length > 0 && t1Note === t2Note);
          const legacyPrefixMatch = (isRecurringPrefix1 || isRecurringPrefix2) && (t1Note.length === 0 || t2Note.length === 0 || t1Note === t2Note);

          const isGenuineDuplicate = sameTemplate || exactNoteMatch || legacyPrefixMatch;

          if (isGenuineDuplicate) {
            let duplicate = null;
            if (isRecurringPrefix1 && !isRecurringPrefix2) {
              duplicate = t1;
            } else if (isRecurringPrefix2 && !isRecurringPrefix1) {
              duplicate = t2;
            } else {
              const isT1Newer = (t1.created_at && t2.created_at)
                ? (new Date(t1.created_at) > new Date(t2.created_at))
                : true;
              duplicate = isT1Newer ? t1 : t2;
            }

            if (duplicate) {
              toDeleteIds.add(duplicate.id);
            }
          }
        }
      }
    }
  });

  // Clean legacy "recurring_" non-UUID items ONLY when a canonical UUID counterpart exists
  for (let i = 0; i < txs.length; i++) {
    const t = txs[i];
    const idStr = String(t.id || '');
    if (idStr.startsWith('recurring_') && !toDeleteIds.has(t.id)) {
      const tDate = String(t.date || '').split('T')[0].split(' ')[0];
      const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
      const hasCanonicalCounterpart = txs.some(other => {
        if (other.id === t.id || toDeleteIds.has(other.id)) return false;
        if (String(other.id || '').startsWith('recurring_')) return false;
        const oDate = String(other.date || '').split('T')[0].split(' ')[0];
        const oAmount = (parseFloat(other.amount) || 0).toFixed(2);
        return oDate === tDate && oAmount === tAmount && isSameCategory(other.category, t.category);
      });
      if (hasCanonicalCounterpart) {
        toDeleteIds.add(t.id);
      }
    }
  }

  // =========================================================================
  // MONTHLY RECURRING SINGLE-OCCURRENCE ENFORCEMENT
  // A monthly recurring template (preset === 'monthly' or default) must have
  // at most ONE occurrence per calendar month (YYYY-MM). If multiple occurrences
  // exist in the same month on DIFFERENT dates (e.g. 15 Sep & 24 Sep "Αλλαγή Ελαστικών"),
  // retain only the canonical occurrence matching the template's target day
  // (or the newest) and mark orphaned occurrences for deletion.
  // =========================================================================
  const allTemplates = state.recurringTemplates || [];
  allTemplates.forEach(template => {
    const preset = template.preset || 'monthly';
    if (preset !== 'monthly' && preset !== 'specific_months' && preset !== 'yearly') return;

    let targetDay = null;
    if (template.startDate) {
      const d = new Date(template.startDate);
      if (!isNaN(d.getTime())) targetDay = d.getDate();
    } else if (template.days && template.days.length > 0) {
      targetDay = template.days[0];
    }

    const templIdStr = String(template.id);
    const templAmount = (parseFloat(template.amount) || 0).toFixed(2);
    const templType = template.type;
    const templNote = normalizeGreekString(template.note || template.description || '');

    const occurrences = [];
    for (let i = 0; i < txs.length; i++) {
      const t = txs[i];
      if (toDeleteIds.has(t.id)) continue;
      const isRecurringOrigin = !!(t.recurring_template_id || String(t.id || '').startsWith('recurring_') || (typeof isTransactionRecurring === 'function' && isTransactionRecurring(t)));
      if (!isRecurringOrigin) continue;

      let isMatch = false;
      if (t.recurring_template_id && String(t.recurring_template_id) === templIdStr) {
        isMatch = true;
      } else {
        const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
        const tType = t.type;
        const tNote = normalizeGreekString(t.note || t.description || '');
        if (tAmount === templAmount && tType === templType && isSameCategory(t.category, template.category)) {
          if (templNote.length > 0 && (tNote === templNote || tNote.includes(templNote) || templNote.includes(tNote))) {
            isMatch = true;
          }
        }
      }

      if (isMatch) {
        occurrences.push(t);
      }
    }

    const periodGroups = new Map();
    occurrences.forEach(tx => {
      const dStr = String(tx.date || '').split('T')[0].split(' ')[0];
      if (!dStr) return;
      const periodKey = preset === 'yearly' ? dStr.slice(0, 4) : dStr.slice(0, 7);
      if (!periodGroups.has(periodKey)) periodGroups.set(periodKey, []);
      periodGroups.get(periodKey).push(tx);
    });

    periodGroups.forEach((group) => {
      if (group.length <= 1) return;

      let canonical = null;
      if (targetDay !== null) {
        canonical = group.find(tx => {
          const dStr = String(tx.date || '').split('T')[0].split(' ')[0];
          const txDay = parseInt(dStr.split('-')[2], 10);
          return txDay === targetDay;
        });
      }

      if (!canonical) {
        canonical = group.reduce((prev, curr) => {
          if (!prev) return curr;
          const prevTime = curr.created_at ? new Date(curr.created_at).getTime() : 0;
          const currTime = prev.created_at ? new Date(prev.created_at).getTime() : 0;
          return prevTime >= currTime ? curr : prev;
        }, null);
      }

      group.forEach(tx => {
        if (canonical && tx.id !== canonical.id) {
          toDeleteIds.add(tx.id);
          try {
            const perm = JSON.parse(localStorage.getItem('permanent_deleted_tx_ids') || '[]') || [];
            if (!perm.includes(String(tx.id))) {
              perm.push(String(tx.id));
              localStorage.setItem('permanent_deleted_tx_ids', JSON.stringify(perm));
            }
          } catch (_) {}
          if (typeof _recentlyDeletedTxIds !== 'undefined' && _recentlyDeletedTxIds) {
            _recentlyDeletedTxIds.add(String(tx.id));
          }
        }
      });
    });
  });

  if (toDeleteIds.size > 0) {
    console.log(`[RecurringCleanup] Removing ${toDeleteIds.size} duplicate recurring occurrences`);
    toDeleteIds.forEach(id => {
      // FIX: Do NOT call deleteTransactionOffline(id) — it blacklists
      // recurring dates on templates via addDeletedDateToTemplate(), permanently
      // suppressing legitimate future occurrences the user never asked to delete.
      try {
        const queueStr = localStorage.getItem('money_manager_sync_queue');
        if (queueStr) {
          let q = JSON.parse(queueStr) || [];
          q = q.filter(item => {
            if (!item || !item.payload) return false;
            const itemId = item.payload.id || item.payload;
            if (toDeleteIds.has(itemId) || String(itemId || '').startsWith('recurring_')) return false;
            return true;
          });
          localStorage.setItem('money_manager_sync_queue', JSON.stringify(q));
          state.syncPendingCount = q.length;
        }
      } catch (e) { }
      if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
        if (!String(id).startsWith('recurring_')) {
          // HARD-DELETE from cloud — automated cleanup duplicates must NEVER
          // appear in the user's trash bin. Previously this was a soft-delete
          // (status='deleted') which caused ghost items in the recycle bin.
          state.supabaseClient
            .from('transactions')
            .delete()
            .eq('id', id)
            .then(() => { }, () => { });
        }
      }
    });
    state.transactions = state.transactions.filter(t => !toDeleteIds.has(t.id));
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
  }
}
window.cleanCrossLanguageRecurringDuplicates = cleanCrossLanguageRecurringDuplicates;

// AUTO-RESTORE RECOVERY: Restore any manual (non-recurring) transactions that may have
// been mistakenly soft-deleted.
async function autoRestoreMistakenlyDeletedManualTransactions() {
  // ⚠️ NEUTRALIZED (forensic data-integrity fix).
  //
  // This function was a resurrection vector: it re-activated ALL status='deleted'
  // transactions (from local trash, the /api/restore-transactions backend endpoint,
  // and the cloud trash query), which is exactly how permanently-deleted transactions
  // were coming back. It is now a no-op. The window binding is preserved so any
  // existing callers do not break, but no transaction is ever restored by it.
  //
  // Legitimate restore-from-trash is handled exclusively by restoreTrashGroup() /
  // restoreTransaction(), which operate on the user's explicit intent.
  console.warn('[AutoRestore] autoRestoreMistakenlyDeletedManualTransactions is DISABLED (neutralized) to prevent resurrection of permanently-deleted transactions.');
  return;
}
window.autoRestoreMistakenlyDeletedManualTransactions = autoRestoreMistakenlyDeletedManualTransactions;

// ============================================================================
// 🔒🔒🔒 FROZEN / DO-NOT-TOUCH — RECURRING TRANSACTIONS SUBSYSTEM 🔒🔒🔒
// ============================================================================
// ⚠️  THIS CODE IS FROZEN. DO NOT MODIFY, REFACTOR, "CLEAN UP", OR "OPTIMIZE"
//     ANY RECURRING-TRANSACTIONS CODE UNLESS THE USER EXPLICITLY ASKS FOR IT.
//
// WHY: This subsystem was deeply audited (see plans/recurring-architecture-deep-review.md)
//      and hardened (Build v1400–v1402). It has subtle invariants that are easy to break:
//        • Deterministic UUIDs (generateDeterministicUUID) keep occurrences idempotent.
//        • Deleted-date markers are stored in the template description field.
//        • The 60s grace window (_markRecentlySaved) prevents duplicate re-creation.
//        • endType='date' + endDate drive "delete future occurrences" (NOT untilDate).
//        • _computeRecurringSeriesDates() has a NaN guard + 240-iteration cap.
//      Past "innocent" edits repeatedly broke these invariants and caused user-facing
//      data corruption / crashes. See plans/RECURRING-FROZEN-GUARDRAIL.md for the full
//      list of frozen functions and the exact rules.
//
// RULE: If you are an AI agent or developer making an UNRELATED change, leave this
//       entire block untouched. Only edit when the user explicitly requests a change
//       to recurring transactions.
// ============================================================================
function processRecurringTemplates() {
  if (!state.recurringTemplates || state.recurringTemplates.length === 0) return;

  let transactionsUpdated = false;
  const currentYear = state.selectedYear;

  const today = new Date();
  const realYear = today.getFullYear();
  const realMonth = today.getMonth(); // 0-indexed

  // Limit processing to 12 months in the future from today's real month
  const maxFutureDate = new Date(realYear, realMonth + 12, 1);
  const maxFutureYear = maxFutureDate.getFullYear();
  const maxFutureMonth = maxFutureDate.getMonth();

  // If the user is browsing beyond 12 months in the future, do not process
  if (currentYear > maxFutureYear) return;
  if (currentYear === maxFutureYear && state.selectedMonth > maxFutureMonth) return;

  // For past years: process all months normally (0–11).
  // For current and safe future years: process up to the selected/viewed month.
  const currentMonthLimit = (currentYear < realYear)
    ? 11
    : state.selectedMonth;

  // Helper to get matching dates for a specific month
  function getRecurringDatesForMonth(template, year, monthIdx) {
    const dates = [];
    const monthNum = monthIdx + 1;

    const startDateStr = template.startDate || `${template.startYear || year}-${String(template.startMonth || 1).padStart(2, '0')}-01`;
    const startDate = new Date(startDateStr);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();

    if (year < startYear) return dates;
    if (year === startYear && monthNum < startMonth) return dates;

    if (template.years && template.years.length > 0) {
      if (!template.years.includes(year)) return dates;
    }

    const preset = template.preset || 'custom';
    const lastDay = new Date(year, monthIdx + 1, 0).getDate();

    if (preset === 'daily') {
      for (let d = 1; d <= lastDay; d++) {
        if (year === startYear && monthNum === startMonth && d < startDay) continue;
        dates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }
    } else if (preset === 'weekly') {
      const targetDayOfWeek = startDate.getDay();
      for (let d = 1; d <= lastDay; d++) {
        const dObj = new Date(year, monthIdx, d);
        if (dObj.getDay() === targetDayOfWeek) {
          if (year === startYear && monthNum === startMonth && d < startDay) continue;
          dates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }
      }
    } else if (preset === 'monthly') {
      const day = Math.min(startDay, lastDay);
      if (!(year === startYear && monthNum === startMonth && day < startDay)) {
        dates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
    } else if (preset === 'yearly') {
      if (monthNum === startMonth) {
        const day = Math.min(startDay, lastDay);
        dates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
    } else if (preset === 'specific_months') {
      if (template.months && template.months.includes(monthNum)) {
        const day = Math.min(startDay, lastDay);
        if (!(year === startYear && monthNum === startMonth && day < startDay)) {
          dates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
      }
    } else if (preset === 'custom') {
      if (template.months && template.months.includes(monthNum)) {
        if (template.days) {
          template.days.forEach(day => {
            if (day <= lastDay) {
              if (year === startYear && monthNum === startMonth && day < startDay) return;
              dates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
            }
          });
        }
      }
    }

    if (template.endDate) {
      return dates.filter(dStr => dStr <= template.endDate);
    }

    return dates;
  }

  state.recurringTemplates.forEach(template => {
    const preset = template.preset || 'custom';
    if (preset === 'custom' && (!template.days || !template.months || template.days.length === 0 || template.months.length === 0)) {
      return;
    }
    if (preset === 'specific_months' && (!template.months || template.months.length === 0)) {
      return;
    }

    for (let m = 0; m <= currentMonthLimit; m++) {
      const datesToProcess = getRecurringDatesForMonth(template, currentYear, m);

      datesToProcess.forEach(dateString => {
        const deleteKey = `${template.id}_${dateString}`;

        if ((state.deletedRecurringDates && state.deletedRecurringDates.includes(deleteKey)) ||
          getDeletedDatesFromTemplate(template).includes(dateString)) {
          return;
        }

        const expectedDeterministicId = generateDeterministicUUID(template.id, dateString);

        // Check for duplicates by BOTH recurring_template_id (if stored) AND by content-key / deterministic ID.
        const duplicateExists = state.transactions.some(t => {
          const tDate = String(t.date || '').split('T')[0].split(' ')[0];
          if (tDate !== dateString) return false;

          // 1. Match by deterministic UUID
          if (t.id === expectedDeterministicId) return true;

          // 2. Match by template id
          if (t.recurring_template_id && String(t.recurring_template_id) === String(template.id)) {
            return true;
          }

          // 3. Content-based fallback: same amount + type + (notesMatch or (categoriesMatch and matching notes)).
          //    IMPORTANT: only apply this fallback to transactions that are provably recurring-origin
          //    (they carry recurring_template_id or a legacy 'recurring_' id prefix). Without this guard a
          //    plain MANUAL transaction that happens to share the date + amount + type + category (and an
          //    empty or matching note) would silently suppress a brand-new recurring occurrence: the
          //    template is saved but NO transaction is ever created — the "recurring save did nothing" bug.
          //    This mirrors the hasRecurringOrigin guard already used in cleanCrossLanguageRecurringDuplicates().
          const isRecurringOrigin = !!(t.recurring_template_id || String(t.id || '').startsWith('recurring_'));
          const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
          const templAmount = (parseFloat(template.amount) || 0).toFixed(2);
          if (isRecurringOrigin && tAmount === templAmount && t.type === template.type) {
            const tNote = normalizeGreekString(t.note || t.description || '');
            const templNote = normalizeGreekString(template.note || template.description || '');
            const notesMatch = tNote.length > 0 && templNote.length > 0 && (tNote === templNote || tNote.includes(templNote) || templNote.includes(tNote));
            const categoriesMatch = isSameCategory(t.category, template.category);

            if (notesMatch || (categoriesMatch && (!tNote || !templNote || notesMatch))) {
              return true;
            }
          }
          return false;
        });

        if (!duplicateExists) {
          // In monthly mode, check if a displaced occurrence for this template exists in the same month on an old date
          if (preset === 'monthly') {
            const targetMonth = dateString.slice(0, 7);
            const oldOccurrenceInSameMonth = state.transactions.find(t => {
              const tDate = String(t.date || '').split('T')[0].split(' ')[0];
              if (!tDate || tDate.slice(0, 7) !== targetMonth || tDate === dateString) return false;
              if (t.recurring_template_id && String(t.recurring_template_id) === String(template.id)) return true;
              const isRecurringOrigin = !!(t.recurring_template_id || String(t.id || '').startsWith('recurring_'));
              if (!isRecurringOrigin) return false;
              const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
              const templAmount = (parseFloat(template.amount) || 0).toFixed(2);
              if (tAmount === templAmount && t.type === template.type) {
                const tNote = normalizeGreekString(t.note || t.description || '');
                const templNote = normalizeGreekString(template.note || template.description || '');
                if (tNote.length > 0 && templNote.length > 0 && (tNote === templNote || tNote.includes(templNote) || templNote.includes(tNote))) {
                  return true;
                }
              }
              return false;
            });
            if (oldOccurrenceInSameMonth) {
              state.transactions = state.transactions.filter(t => t.id !== oldOccurrenceInSameMonth.id);
              try {
                const perm = JSON.parse(localStorage.getItem('permanent_deleted_tx_ids') || '[]') || [];
                if (!perm.includes(String(oldOccurrenceInSameMonth.id))) {
                  perm.push(String(oldOccurrenceInSameMonth.id));
                  localStorage.setItem('permanent_deleted_tx_ids', JSON.stringify(perm));
                }
              } catch (_) {}
              if (typeof _recentlyDeletedTxIds !== 'undefined' && _recentlyDeletedTxIds) {
                _recentlyDeletedTxIds.add(String(oldOccurrenceInSameMonth.id));
              }
            }
          }

          const deterministicId = expectedDeterministicId;

          // Also check if this deterministic ID already exists (belt-and-suspenders)
          const idAlreadyExists = state.transactions.some(t => t.id === deterministicId);
          if (idAlreadyExists) return;

          const newTx = {
            id: deterministicId,
            recurring_template_id: template.id,
            date: dateString,
            type: template.type,
            amount: parseFloat(template.amount),
            currency: template.currency || 'EUR',
            category: (() => {
              // Normalize a ghost template category (e.g. "Αυτοκίνητο") to its
              // canonical stored name (e.g. "🚗 ΑΥΤΟΚΙΝΗΤΟ") so generated
              // transactions don't carry a phantom category with a wrong icon.
              const rawCat = template.category;
              if (!rawCat) return rawCat;
              const normCat = normalizeCategoryName(rawCat);
              if (normCat) {
                const canonical = state.categories.find(c => c.name && normalizeCategoryName(c.name) === normCat);
                if (canonical) return canonical.name;
              }
              return rawCat;
            })(),
            subcategory: template.subcategory || '',
            account_from: template.account_from,
            account_to: template.type === 'transfer' ? template.account_to : null,
            note: template.note,
            description: template.description || '',
            user_id: template.user_id || (state.currentUser ? state.currentUser.id : null),
            is_shared: template.is_shared !== undefined ? template.is_shared : (state.partnerProfile !== null),
            family_id: template.family_id || (state.userProfile ? state.userProfile.family_id : null),
            created_at: new Date().toISOString()
          };

          computeCurrencyFields(newTx);

          saveTransactionOffline(newTx);

          // DATA-INTEGRITY (recurring duplicates): Mark this newly created
          // occurrence as "recently saved" so that a loadData() re-fetch that
          // races ahead of the async cloud write propagation does NOT drop it
          // from state.transactions. Without this, the occurrence disappears
          // from state.transactions and the next processRecurringTemplates()
          // call re-creates it, producing a duplicate installment within the
          // same month. The 60s grace window (see _markRecentlySaved) covers
          // the typical cloud write+read round-trip.
          if (typeof _markRecentlySaved === 'function') {
            _markRecentlySaved(newTx.id);
          }

          if (typeof enqueueSyncMutation === 'function') {
            enqueueSyncMutation('save', newTx);
          }

          if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
            const { description, is_shared, photo_local_uri, photo_url, receipt, fx_snapshot, ...dbPayload } = mapTransactionToDb(newTx);
            (async () => {
              try {
                const { error } = await promiseTimeout(
                  state.supabaseClient
                    .from('transactions')
                    .upsert([dbPayload]),
                  12000
                );
                if (error) throw error;
                if (typeof dequeueSyncMutation === 'function') {
                  dequeueSyncMutation('save', newTx.id);
                }
              } catch (err) {
                console.warn(`Cloud save failed for recurring, transaction remains queued: ${newTx.id}`, err);
              }
            })();
          }

          transactionsUpdated = true;
        }
      });
    }
  });

  cleanCrossLanguageRecurringDuplicates();
  if (transactionsUpdated) {
    calculateInitialBalances();
  }
}

// ============================================================
// SAVE / DELETE
// ============================================================
// HIGH-EXPENSE ALERT (Υψηλή Δαπάνη)
// The "Single Expense Alert" setting was previously a UI-only stub:
// the settings (settings_expense_alert_enabled / _limit) were saved to
// localStorage but NO code ever checked them or fired a notification.
// This helper wires the setting to the actual alert. It is called from
// saveTransaction() so it fires for ANY expense added (form, coach, demo).
// ============================================================
function checkHighExpenseAlert(transaction) {
  try {
    // Only expenses (not income/transfers) can trigger the high-expense alert.
    if (!transaction || transaction.type !== 'expense') return;

    const enabled = localStorage.getItem('settings_expense_alert_enabled') === 'true';
    if (!enabled) return;

    const limit = parseFloat(localStorage.getItem('settings_expense_alert_limit')) || 500;
    const amount = parseFloat(transaction.amount) || 0;
    if (amount < limit) return;

    const isPartner = state.currentUser && transaction.user_id && transaction.user_id !== state.currentUser.id;
    let partnerName = '';
    if (isPartner && state.familyProfiles) {
      const p = state.familyProfiles.find(fp => fp.id === transaction.user_id);
      if (p) partnerName = p.display_name || p.email || '';
    }

    const catName = getCategoryDisplayName ? getCategoryDisplayName(transaction.category) : (transaction.category || '');
    const title = state.lang === 'el' ? '⚠️ Υψηλή Δαπάνη' : '⚠️ High Expense Alert';

    let body = '';
    if (isPartner) {
      const who = partnerName ? `Ο/Η ${partnerName}` : (state.lang === 'el' ? 'Μέλος της οικογένειας' : 'A family member');
      body = state.lang === 'el'
        ? `${who} καταχώρησε δαπάνη ${formatCurrency(amount)} (${catName}) που υπερβαίνει το όριο των ${formatCurrency(limit)}.`
        : `${who} logged an expense of ${formatCurrency(amount)} (${catName}), exceeding the limit of ${formatCurrency(limit)}.`;
    } else {
      body = state.lang === 'el'
        ? `Καταχωρήθηκε δαπάνη ${formatCurrency(amount)} (${catName}) που υπερβαίνει το όριο των ${formatCurrency(limit)}.`
        : `An expense of ${formatCurrency(amount)} (${catName}) was recorded, exceeding your limit of ${formatCurrency(limit)}.`;
    }

    // 1. In-app notification (notification center / badge)
    addInAppNotification(title, body, { type: 'open_transactions' });

    // 2. Toast so the user sees it immediately. NOTE: `showToast` is not defined
    // anywhere in the codebase, so the previous guard always failed and the user
    // never saw any immediate feedback. Use the working `showSyncToast` instead.
    if (typeof showSyncToast === 'function') {
      showSyncToast(title + ' — ' + body, 6000);
    }

    // 3. Native push-style notification (works when app is in background)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
      const notifId = Math.floor(Math.random() * 899999) + 100000;
      window.Capacitor.Plugins.LocalNotifications.schedule({
        notifications: [{
          id: notifId,
          title: title,
          body: body,
          smallIcon: 'ic_launcher_round',
            iconColor: '#0F1219',
          schedule: { at: new Date(Date.now() + 50) },
          sound: null,
          attachments: null,
          actionTypeId: '',
          extra: { type: 'high_expense' }
        }]
      }).catch(err => console.warn('Failed to schedule high-expense native notification:', err));
    }

  } catch (err) {
    // Never let a notification failure break the transaction save.
    console.warn('checkHighExpenseAlert error:', err);
  }
}

// Multi-currency: compute base-currency fields (amount_base, rate_to_base, base_currency).
// Always computed so new transactions are consistent with the schema, even when the
// feature flag is off (EUR → 1:1).
// This is the single canonical implementation reused by normal, recurring, and
// imported transactions so they all behave identically.
function computeCurrencyFields(t) {
  const userPreferredCurrency = state.userProfile?.base_currency || state.userProfile?.display_currency || getDisplayCurrency();
  const baseCurrency = userPreferredCurrency;
  const txCurrency = t.currency || 'EUR';
  t.base_currency = baseCurrency;

  let rate = 1;
  if (txCurrency === baseCurrency) {
    t.rate_to_base = 1;
    t.amount_base = CurrencyService.round(Number(t.amount), 4);
    t.rate_source = 'api';
  } else {
    const foundRate = CurrencyService.getRate(txCurrency, baseCurrency, t.date);
    if (foundRate != null && foundRate > 0) {
      rate = foundRate;
      t.rate_to_base = rate;
      t.amount_base = CurrencyService.round(Number(t.amount) / rate, 4);
      t.rate_source = 'api';
    } else {
      t.rate_to_base = null;
      t.amount_base = null;
      t.rate_source = 'cached';
    }
  }

  // Store immutable fx_snapshot on transaction for audit-reproducible historical rendering
  t.fx_snapshot = {
    base: txCurrency,
    quote: baseCurrency,
    rate: t.rate_to_base_actual || t.rate_to_base || rate || 1,
    date: t.date ? String(t.date).split('T')[0] : new Date().toISOString().slice(0, 10),
    source: t.rate_source || 'api'
  };
  return t;
}

async function saveTransaction(transaction) {
  transaction.amount = parseFloat(transaction.amount);

  // HIGH-EXPENSE ALERT: Fire the "Single Expense Alert" notification if this
  // newly saved expense meets/exceeds the configured limit (settings_expense_alert_limit).
  checkHighExpenseAlert(transaction);

  // 1. Generate local UUID if it's a new transaction
  if (!transaction.id) {
    transaction.id = generateUUID();
  }

  // Populate user_id and family_id before saving offline to prevent guest sync duplication
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    if (!transaction.user_id) {
      transaction.user_id = state.currentUser.id;
    }
    if (state.activeAccountMode === 'personal') {
      // In Personal Mode, new transactions default to personal scope (family_id = null)
      if (!transaction.family_id) {
        transaction.family_id = null;
        transaction.is_shared = false;
      }
    } else if (!transaction.family_id && state.userProfile && state.userProfile.family_id) {
      transaction.family_id = state.userProfile.family_id;
    }
  }

  // 2. Optimistically save to local state and local storage immediately
  saveTransactionOffline(transaction);
  // Guard against the re-fetch race: keep this transaction in the "recently saved"
  // set so a loadData() re-fetch that hasn't yet seen the cloud write does NOT drop it.
  _markRecentlySaved(transaction.id);
  calculateInitialBalances();
  updateUI();

  // 3. Save to cloud directly and reliably
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    const { description, is_shared, photo_local_uri, photo_url, receipt, fx_snapshot, ...dbPayload } = mapTransactionToDb(transaction);

    // Enqueue immediately before starting the cloud request to prevent data loss if offline
    enqueueSyncMutation('save', transaction);

    try {
      _suppressRealtimeEvents = true;
      let { error } = await promiseTimeout(
        state.supabaseClient
          .from('transactions')
          .upsert([dbPayload]),
        12000
      );

      // If token expired or auth error, attempt immediate token refresh and retry
      if (error && (error.code === '401' || error.message?.includes('JWT') || error.message?.includes('token') || error.message?.includes('auth'))) {
        try {
          await state.supabaseClient.auth.refreshSession();
          const retryRes = await promiseTimeout(
            state.supabaseClient
              .from('transactions')
              .upsert([dbPayload]),
            12000
          );
          error = retryRes.error;
        } catch (_) {}
      }



      if (error) {
        console.error(`[CloudSave] Supabase upsert error for ${transaction.id}:`, error);
        if (typeof showSyncToast === 'function') {
          showSyncToast(`⚠️ Cloud Sync: ${error.message || error.code || 'Failed to save to cloud'}`, 5000);
        }
        throw error;
      }

      dequeueSyncMutation('save', transaction.id);

      // Notify partner via Cloudflare Function /api/push-notify if transaction is shared
      const partnerUid = state.partnerProfile ? (state.partnerProfile.id || state.partnerProfile.user_id) : null;
      if (partnerUid && transaction.family_id) {
        sendPartnerPushNotification(transaction, partnerUid);
      }
      return true;
    } catch (err) {
      console.warn(`Cloud save failed, keeping in queue: ${transaction.id}`, err);
      return false;
    } finally {
      setTimeout(() => { _suppressRealtimeEvents = false; }, 3000);
    }
  }
  return true;
}

function saveTransactionOffline(transaction) {
  if (!transaction.id) {
    transaction.id = generateUUID();
  }
  if (!transaction.created_at) {
    transaction.created_at = new Date().toISOString();
  }
  // Incremental sync: stamp updated_at on every local write so the local cache
  // carries a valid cursor baseline. The DB trigger also sets it on cloud UPDATEs.
  transaction.updated_at = new Date().toISOString();
  let trans = [...state.transactions];
  const existingIdx = trans.findIndex(t => t.id === transaction.id);
  if (existingIdx !== -1) {
    const oldTx = trans[existingIdx];
    const oldDate = String(oldTx.date || '').split('T')[0].split(' ')[0];
    const newDate = String(transaction.date || '').split('T')[0].split(' ')[0];

    // If it's a recurring transaction and the date changed, mark the old date as deleted
    // so the generator doesn't recreate it on the old date.
    if (oldDate !== newDate && oldTx.recurring_template_id) {
      const key = `${oldTx.recurring_template_id}_${oldDate}`;
      if (!state.deletedRecurringDates.includes(key)) {
        state.deletedRecurringDates.push(key);
        localStorage.setItem('deleted_recurring_dates', JSON.stringify(state.deletedRecurringDates));
      }
    }

    trans[existingIdx] = transaction;
  } else {
    trans.unshift(transaction);
  }
  state.transactions = trans;
  localStorage.setItem('offline_transactions', JSON.stringify(trans));

  if (!state.currentUser) {
    saveOfflineGuestTransactions(trans);
  }

  // Check category budget limit alert
  if (typeof checkOverBudgetNotification === 'function') {
    checkOverBudgetNotification(transaction);
  }
}

function deleteTransaction(id) {
  if (!id) return;

  // Delete only the transaction with this unique id.
  const idsToDelete = [String(id)];

  if (!state.currentUser) {
    const guestTxs = getOfflineGuestTransactions().filter(t => !idsToDelete.includes(String(t.id)));
    saveOfflineGuestTransactions(guestTxs);
  }

  // 1. Mark all these IDs as deleting
  idsToDelete.forEach(dId => _deletingTxIds.add(dId));

  // 2. Clean up local receipt photo from IndexedDB (run in background)
  idsToDelete.forEach(dId => {
    ReceiptStorage.remove(dId).catch(err => {
      console.warn('Failed to remove receipt during transaction delete:', err);
    });
  });

  // Save deleted transactions to Trash
  try {
    const deletedTxs = state.transactions.filter(t => idsToDelete.includes(String(t.id)));
    deletedTxs.forEach(t => {
      state.trashTransactions = state.trashTransactions || [];
      const alreadyInTrash = state.trashTransactions.some(tt => String(tt.id) === String(t.id));
      if (!alreadyInTrash) {
        const trashItem = { ...t, deleted_at: new Date().toISOString() };
        state.trashTransactions.push(trashItem);
      }
    });
    if (state.trashTransactions.length > 100) {
      state.trashTransactions = state.trashTransactions.slice(-100);
    }
    localStorage.setItem('deleted_transactions_trash', JSON.stringify(state.trashTransactions));
  } catch (err) {
    console.warn('Failed to save deleted transactions to trash:', err);
  }

  // 3. Optimistically delete from local state and update UI
  idsToDelete.forEach(dId => deleteTransactionOffline(dId, true));
  localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
  calculateInitialBalances();
  updateUI();

  if (typeof handleSearchChange === 'function') {
    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay && searchOverlay.classList.contains('active')) {
      handleSearchChange(false);
    }
  }

  // 4. Perform background delete (status model: soft-delete via status='deleted')
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    // Enqueue immediately before starting the cloud request to prevent data loss if the app is closed/killed
    idsToDelete.forEach(dId => enqueueSyncMutation('delete', dId));

    (async () => {
      try {
        _suppressRealtimeEvents = true;
        // Instead of hard-deleting, mark the transaction as deleted so it can be
        // restored from the trash and stays consistent across all devices.
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .update({
              status: 'deleted',
              deleted_at: new Date().toISOString(),
              deleted_by: state.currentUser.id
            })
            .in('id', idsToDelete),
          12000
        );
        if (error) throw error;
        // Keep IDs in _recentlyDeletedTxIds for 30s to guard against Supabase propagation race:
        // loadData() may run shortly after and re-fetch the transaction before the DB confirms the delete.
        idsToDelete.forEach(dId => _markRecentlyDeleted(dId));
        idsToDelete.forEach(dId => dequeueSyncMutation('delete', dId));
        // Incremental sync: record a durable tombstone so other devices can apply
        // this deletion without a full re-fetch. Best-effort; never blocks the delete.
        writeSyncTombstones('transactions', idsToDelete).catch(err => {
          console.warn('Failed to write transaction tombstone:', err);
        });
      } catch (err) {
        console.warn(`Cloud delete failed, keeping in queue:`, idsToDelete, err);
      } finally {
        idsToDelete.forEach(dId => _deletingTxIds.delete(dId));
        setTimeout(() => { _suppressRealtimeEvents = false; }, 8000);
      }
    })();
  } else {
    idsToDelete.forEach(dId => _deletingTxIds.delete(dId));
  }
}

function deleteTransactionOffline(id, skipSave = false) {
  const tx = state.transactions.find(t => t.id === id);
  if (tx) {
    let templateId = tx.recurring_template_id;
    const txDate = String(tx.date || '').split('T')[0].split(' ')[0];

    if (!templateId && state.recurringTemplates) {
      // Find template matching by content if recurring_template_id is missing
      const match = state.recurringTemplates.find(template => {
        return (parseFloat(tx.amount) || 0).toFixed(2) === (parseFloat(template.amount) || 0).toFixed(2) &&
          tx.type === template.type &&
          isSameCategory(tx.category, template.category) &&
          (tx.account_from || '') === (template.account_from || '');
      });
      if (match) {
        templateId = match.id;
      }
    }

    if (templateId) {
      const key = `${templateId}_${txDate}`;
      if (!state.deletedRecurringDates.includes(key)) {
        state.deletedRecurringDates.push(key);
        localStorage.setItem('deleted_recurring_dates', JSON.stringify(state.deletedRecurringDates));
      }
      const template = state.recurringTemplates.find(t => t.id === templateId);
      if (template) {
        addDeletedDateToTemplate(template, txDate);
        localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
        if (state.supabaseClient && state.currentUser) {
          enqueueSyncMutation('save_template', template);
          state.supabaseClient
            .from('recurring_templates')
            .upsert([mapTemplateToDb(template)])
            .then(({ error }) => {
              if (!error) {
                dequeueSyncMutation('save_template', template.id);
              }
            });
        }
      }
    }
  }
  // Remove only the transaction with this unique id.
  // Content-based "duplicate" removal was removed because it could delete
  // legitimate identical transactions (same date/amount/category/note).
  state.transactions = state.transactions.filter(t => t.id !== id);
  if (!skipSave) {
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
  }
}

// ============================================================
// UI UPDATE ENGINE
// ============================================================

// ============================================================
// FIX #4 (flicker): Central render scheduler.
// All UI renders funnel through updateUI() which coalesces bursts
// into a single pass. Key improvements over the old scheduler:
//   1. A single updateUI() call flushes on the NEXT animation frame
//      (no artificial 150ms latency for isolated renders).
//   2. A burst of updateUI() calls within the debounce window collapses
//      into ONE render (no more 32+ concurrent DOM mutations racing).
//   3. flushUI() cancels any pending scheduled render and renders
//      immediately — used by switchTab so a tab switch never races
//      against a background-sync render.
// ============================================================
let _updateUITimer = null;
let _updateUIRAF = null;
let _updateUIDirty = false;

// ============================================================
// ANTI-FLICKER: Reference-counted no-transition guard.
//
// PROBLEM: Multiple independent code paths (resume handler, forceSyncNow,
// realtime handlers, modal restore) each add/remove the 'no-transition' class
// on their own setTimeout. When they overlap (e.g. the resume handler's 1700ms
// removal fires while forceSyncNow's deferred render is still pending), one
// path can prematurely remove the class that another path is relying on,
// leaving a deferred re-render UNCOVERED → visible flash on resume.
//
// SOLUTION: A counter. pushNoTransition() increments and adds the class;
// popNoTransition() decrements and only removes the class when the counter
// reaches zero. This guarantees the class stays active until EVERY guard has
// released it, so no deferred render ever runs with transitions enabled.
// ============================================================
let _noTransitionCount = 0;
function pushNoTransition() {
  _noTransitionCount++;
  document.documentElement.classList.add('no-transition');
}
function popNoTransition() {
  _noTransitionCount = Math.max(0, _noTransitionCount - 1);
  if (_noTransitionCount === 0) {
    document.documentElement.classList.remove('no-transition');
  }
}

// ANTI-FLICKER FIX (resume flash): Returns true if the app resumed from the
// background within the last `ms` milliseconds. The realtime handlers debounce
// their re-renders by 5s, so events that arrive well after the short-lived
// _appJustResumed flag (which expires at _RESUME_GUARD_MS) can still be part of
// the resume-cycle reconnect burst - and must render with transitions suppressed.
function _isWithinResumeWindow(ms) {
  const t = window._lastResumeTimestamp || 0;
  return t > 0 && (Date.now() - t) < ms;
}

function _runScheduledRender() {
  _updateUITimer = null;
  _updateUIRAF = null;
  _updateUIDirty = false;
  // ANTI-FLICKER: When _suppressTransitions is set (e.g. during the
  // startup loadData() re-render after a long background where the OS
  // reloaded the WebView), wrap the DOM wipe/re-render in no-transition
  // so the tab content does not visibly flash. This covers the full-reload
  // path that forceSyncNow's own guard cannot reach.
  const suppress = !!window._suppressTransitions;
  if (suppress) pushNoTransition();
  try {
    _updateUIImpl();
  } finally {
    if (suppress) {
      setTimeout(() => {
        popNoTransition();
      }, 1000);
    }
  }
}

function updateUI() {
  // If a render is already scheduled (either the resume-delay timer or the
  // pending animation-frame), just mark it dirty and let the existing
  // scheduled pass handle it — coalescing bursts into a single render.
  if (_updateUITimer || _updateUIRAF) {
    _updateUIDirty = true;
    return;
  }
  _updateUIDirty = true;

  // INSTANT-RESUME: Always flush on the next animation frame so that multiple
  // synchronous updateUI() calls in the same tick still coalesce into a single
  // render (avoids redundant DOM wipes). We deliberately do NOT defer the render
  // on resume — the user wants to return straight to where they were (like
  // Messenger/Facebook) without seeing any background/splash flash. The
  // no-transitions guard (_RESUME_GUARD_MS) already suppresses CSS transitions
  // during the resume window, so an immediate render is flicker-free.
  if (_updateUIRAF) cancelAnimationFrame(_updateUIRAF);
  _updateUIRAF = requestAnimationFrame(_runScheduledRender);
}

// Immediately cancel any pending scheduled render and run the render NOW.
// Used by switchTab() so a tab switch never races against a queued
// background-sync render (which would cause a visible flash/jitter).
function flushUI() {
  if (_updateUITimer) {
    clearTimeout(_updateUITimer);
    _updateUITimer = null;
  }
  if (_updateUIRAF) {
    cancelAnimationFrame(_updateUIRAF);
    _updateUIRAF = null;
  }
  _updateUIDirty = false;
  _runScheduledRender();
}

function getActiveScrollContainer() {
  if (state.activeTab === 'trans') return document.querySelector('.trans-scroll-content');
  if (state.activeTab === 'stats') return document.querySelector('.stats-scroll-content');
  if (state.activeTab === 'accounts') return document.querySelector('.accounts-scroll-content');
  if (state.activeTab === 'more') return document.querySelector('.more-scroll-content');
  return null;
}

// SECURITY GUARD: Returns true only when the user is actually authenticated and
// the auth overlay is hidden. When the auth overlay is visible (the user is being
// asked to log in / sign up), we must NEVER render personal data (transactions,
// stats, accounts) or restore modals - otherwise a previous user's cached data
// would flash on screen before the login card appears.
// SECURITY: _authConfirmed is set to true ONLY once the user's session has been
// verified as valid (or guest mode / offline-with-cached-user is active). Until
// it is true, the app must never render or restore personal data, so a previous
// user's cached transactions can never flash before the login card appears.
function _isAuthenticated() {
  return !!window._authConfirmed || !!state.guestMode || localStorage.getItem('auth_guest_mode') === 'true';
}
window._isAuthenticated = _isAuthenticated;

function _updateUIImpl() {
  updateHeaderAndSync();
  if (typeof updateHeaderDemoBadge === 'function') {
    updateHeaderDemoBadge();
  }

  // SECURITY: If the user is not authenticated (_authConfirmed not yet set), do
  // NOT render any personal data, and DO NOT run recurring-template generation:
  // processRecurringTemplates() creates transactions from state.recurringTemplates,
  // and while unauthenticated (login screen / after logout) that array could still
  // hold a previous account's templates — regenerating those recurring
  // transactions into the offline/guest cache would leak account data into the
  // next guest session. The content behind the login card must stay blank so a
  // previous user's cached transactions/balances are never exposed before the
  // current user logs in. We skip the tab rendering, modal restore, and the
  // content-painted signal. The cached data stays in memory (state) so it
  // renders immediately once the session is confirmed - it is just never
  // written to the DOM while unauthenticated.
  if (!_isAuthenticated()) {
    return;
  }

  processRecurringTemplates();
  cleanCrossLanguageRecurringDuplicates();

  const countEl = document.getElementById('recurring-templates-count-val');
  if (countEl) {
    countEl.textContent = state.recurringTemplates ? state.recurringTemplates.length : 0;
  }
  const trashCount = state.trashTransactions ? state.trashTransactions.length : 0;
  // Update the trash badge used in index.html (hub-trash-count).
  const hubTrashCountEl = document.getElementById('hub-trash-count');
  if (hubTrashCountEl) {
    hubTrashCountEl.textContent = trashCount;
  }

  // Save current month/year to localStorage so they are preserved on app resume/reload
  localStorage.setItem('selected_month', state.selectedMonth);
  localStorage.setItem('selected_year', state.selectedYear);

  // If ANY modal is currently open, skip the full tab re-render.
  // A background sync (forceSyncNow) firing while a modal is visible would otherwise
  // cause the tab content behind the modal to flash/reload — visible and jarring on Android.
  // The re-render will happen naturally the next time the user closes the modal (closeModal
  // calls updateUI) or switches tabs.
  const anyModalOpen = !!document.querySelector(
    '.modal-overlay.active, .tx-modal-overlay.active, .profile-sheet-overlay.active'
  );

  if (!anyModalOpen) {
    // Save current scroll position before rendering to prevent scroll-jump
    const scrollContainer = getActiveScrollContainer();
    const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

    // Render only the active tab to optimize performance and prevent background rendering lag
    if (state.activeTab === 'trans') {
      renderTransactionsTab();
    } else if (state.activeTab === 'stats') {
      renderStatsTab();
    } else if (state.activeTab === 'accounts') {
      renderAccountsTab();
    } else if (state.activeTab === 'more') {
      renderPartnerSection();
      renderNotesList();
      updateOfflineImportSettingsRow();
    }

    // Restore scroll position
    const restoredScrollContainer = getActiveScrollContainer();
    if (restoredScrollContainer) {
      const bgScrollTop = localStorage.getItem('bg_scroll_top');
      if (bgScrollTop !== null) {
        restoredScrollContainer.scrollTop = parseInt(bgScrollTop, 10);
        localStorage.removeItem('bg_scroll_top');
      } else {
        restoredScrollContainer.scrollTop = currentScrollTop;
      }
    }
  }

  // Clear category render cache on UI refresh to pick up updates
  lastRenderedCategoryType = null;

  const activeTypeBtn = document.querySelector('.type-tab-btn.active');
  const currentType = activeTypeBtn ? activeTypeBtn.getAttribute('data-type') : 'expense';

  // FIX #2: Skip rebuilding dropdowns when the transaction modal is open.
  // Rebuilding category/account dropdowns while the modal is visible causes
  // the form fields to flicker (innerHTML reset) even though the modal itself
  // is correctly open. We only need to rebuild them when the modal is closed,
  // or when it is first opened (handled inside openAddTransactionModal /
  // openEditTransactionModal via updateCategoryDropdowns/updateAccountDropdowns).
  const txModalOpen = document.getElementById('transaction-modal') &&
    document.getElementById('transaction-modal').classList.contains('active');
  if (!txModalOpen) {
    updateCategoryDropdowns(currentType);
    updateAccountDropdowns();
  }
  updateCurrencySymbols();

  // Scroll to today on startup once transactions are loaded
  const list = document.getElementById('transactions-list');
  if (!state.hasInitialScrollDone && list && list.children.length > 0) {
    state.hasInitialScrollDone = true;
    setTimeout(() => {
      scrollToToday('auto');
    }, 300);
  }

  // Onboarding auto-trigger
  const authOverlay = document.getElementById('auth-overlay');
  const isAuthVisible = authOverlay && authOverlay.style.display !== 'none';
  if (!isAuthVisible && (!state.transactions || state.transactions.length === 0) && !localStorage.getItem('ba_ftux_status')) {
    setTimeout(() => {
      if (!localStorage.getItem('ba_ftux_status') && (!state.transactions || state.transactions.length === 0)) {
        openQuickStartModal(0);
      }
    }, 800);
  }

  // CONTENT-PAINTED SIGNAL: The real UI content has now been written into the
  // DOM. Signal the native overlay to hide (after the content frame is
  // composited via double-rAF inside _notifyNativeContentPainted). This is the
  // ONLY point we consider the UI "actually painted" — a plain double-rAF in
  // _handleAppResumed could fire on a still-blank frame.
  if (typeof window._notifyNativeContentPainted === 'function') {
    window._notifyNativeContentPainted();
  }
}

function updateHeaderAndSync() {
  const rawText = `${getMonthName(state.selectedMonth, true)} ${state.selectedYear}`;
  const periodEl = document.getElementById('current-period-title');
  if (periodEl) periodEl.innerHTML = wrapPeriodTitleWithSpans(rawText);
  updateHeaderProfileBadge();
  if (typeof updateSyncStatusIndicator === 'function') {
    updateSyncStatusIndicator();
  }
  if (typeof window.updateDesktopSidebarUser === 'function') {
    window.updateDesktopSidebarUser();
  }
}

// ============================================================
// TAB 1: TRANSACTIONS
// ============================================================
// Resolve the recurring template a transaction belongs to, using recurring_template_id
// when present, otherwise falling back to a content-key match (amount + type + category).
// Returns the matching template object or null. Used by the transaction delete handler
// so the 3-option recurring delete modal reliably appears even when the template link
// is missing on an older cloud-loaded transaction.
function resolveRecurringTemplateForTx(tx) {
  if (!tx) return null;
  const templates = state.recurringTemplates || [];
  if (templates.length === 0) return null;

  if (tx.recurring_template_id) {
    const found = templates.find(t => String(t.id) === String(tx.recurring_template_id));
    if (found) return found;
  }

  const txAmount = (parseFloat(tx.amount) || 0).toFixed(2);
  const txType = tx.type;
  const txNote = (tx.note || tx.description || '').trim().toLowerCase();

  return templates.find(template => {
    if (tx.recurring_template_id && String(tx.recurring_template_id) === String(template.id)) return true;
    const tAmount = (parseFloat(template.amount) || 0).toFixed(2);
    const tType = template.type;
    const tNote = (template.note || template.description || '').trim().toLowerCase();

    if (txAmount === tAmount && txType === tType) {
      if (isSameCategory(tx.category, template.category)) return true;
      if (txNote && tNote && txNote === tNote) return true;
    }
    return false;
  }) || null;
}
window.resolveRecurringTemplateForTx = resolveRecurringTemplateForTx;

// Determine whether a transaction belongs to a recurring template.
function isTransactionRecurring(tx) {
  return !!resolveRecurringTemplateForTx(tx);
}
window.isTransactionRecurring = isTransactionRecurring;

// Backfill recurring_template_id on existing transactions that were saved before
// the column was persisted (it was previously stripped before cloud upsert, so
// cloud-loaded transactions arrived with recurring_template_id = null). Linking
// them to their template by content-key makes isTransactionRecurring() work via
// the reliable ID check, so the 3-option recurring delete modal appears from the
// transaction modal in both web and APK.
function backfillRecurringTemplateIds() {
  const templates = state.recurringTemplates || [];
  if (templates.length === 0) return;
  const txs = state.transactions || [];
  if (txs.length === 0) return;

  const toUpdate = [];
  txs.forEach(tx => {
    if (tx.recurring_template_id) return; // already linked
    const txAmount = (parseFloat(tx.amount) || 0).toFixed(2);
    const txType = tx.type;
    const match = templates.find(t => {
      return (parseFloat(t.amount) || 0).toFixed(2) === txAmount &&
        t.type === txType &&
        isSameCategory(t.category, tx.category);
    });
    if (match) {
      tx.recurring_template_id = match.id;
      toUpdate.push({ id: tx.id, recurring_template_id: match.id });
    }
  });

  if (toUpdate.length === 0) return;

  // Persist the link to the cloud (only id + recurring_template_id) so it survives reloads.
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    (async () => {
      try {
        for (let i = 0; i < toUpdate.length; i += 100) {
          const chunk = toUpdate.slice(i, i + 100);
          const { error } = await promiseTimeout(
            state.supabaseClient.from('transactions').upsert(chunk),
            15000
          );
          if (error) console.warn('[backfill] upsert error:', error);
        }
      } catch (e) {
        console.warn('[backfill] failed to persist links:', e);
      }
    })();
  }
}

function renderTransactionsTab(containerOverride, yearOverride, monthOverride) {
  const listContainer = containerOverride || document.getElementById('transactions-list');
  if (!listContainer) return;

  // Allow rendering a specific month/year into a specific container (used by the
  // native pager "peek" during month swipe). Defaults to the current selection.
  const selectedYear = (yearOverride !== undefined && yearOverride !== null) ? yearOverride : state.selectedYear;
  const selectedMonth = (monthOverride !== undefined && monthOverride !== null) ? monthOverride : state.selectedMonth;

  const monthStartDay = parseInt(localStorage.getItem('app_month_start') || '1', 10);
  let start, end;
  if (monthStartDay === 1) {
    start = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
    end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
  } else {
    start = new Date(selectedYear, selectedMonth, monthStartDay, 0, 0, 0, 0);
    end = new Date(selectedYear, selectedMonth + 1, monthStartDay - 1, 23, 59, 59, 999);
  }

  const startISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const endISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

  const walletTrans = getActiveTransactions();
  const filteredTrans = walletTrans.filter(t => {
    if (!t.date) return false;
    const tDatePart = String(t.date).split('T')[0].split(' ')[0];
    return tDatePart >= startISO && tDatePart <= endISO;
  });

  const sortedTrans = [...filteredTrans].sort(compareTransactions);

  // Aggregate directly in the display (app) currency. Each transaction is
  // converted from its own stored base_currency, so when the user changes the
  // app currency the totals correctly reflect the exchange rate (e.g. 1316 € →
  // ~1420 $) instead of just swapping the symbol.
  const displayCurrency = getDisplayCurrency();
  const monthlyIncome = CurrencyService.sumInCurrency(sortedTrans.filter(t => t.type === 'income'), displayCurrency);
  const monthlyExpense = CurrencyService.sumInCurrency(sortedTrans.filter(t => t.type === 'expense'), displayCurrency);
  const groups = {};

  sortedTrans.forEach(t => {
    const amt = CurrencyService.displayAmount(t, displayCurrency);
    const dateKey = String(t.date || '').split('T')[0].split(' ')[0];
    if (!groups[dateKey]) groups[dateKey] = { transactions: [], income: 0, expense: 0 };
    groups[dateKey].transactions.push(t);
    if (t.type === 'income') groups[dateKey].income += amt;
    else if (t.type === 'expense') groups[dateKey].expense += amt;
  });

  // The aggregated totals are already in the display currency, so pass the
  // display currency as the source to avoid a double conversion.
  if (!containerOverride) {
    const incValEl = document.getElementById('summary-income-val');
    const expValEl = document.getElementById('summary-expense-val');
    const totValEl = document.getElementById('summary-total-val');
    if (incValEl) incValEl.textContent = `${getCurrencySymbol()} ${formatDisplayAmount(monthlyIncome, displayCurrency)}`;
    if (expValEl) expValEl.textContent = `${getCurrencySymbol()} ${formatDisplayAmount(monthlyExpense, displayCurrency)}`;
    if (totValEl) totValEl.textContent = `${getCurrencySymbol()} ${formatDisplayAmount(monthlyIncome - monthlyExpense, displayCurrency)}`;
  }

  if (sortedTrans.length === 0) {
    const emptySig = 'empty_' + (state.lang || 'el');
    if (listContainer._lastRenderSignature === emptySig) return;
    listContainer._lastRenderSignature = emptySig;

    const lang = state.lang || 'el';
    const title = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['trans_empty_title']) || (lang === 'el' ? 'Δεν υπάρχουν συναλλαγές για αυτόν τον μήνα' : 'No Transactions This Month');
    const desc = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['trans_empty_desc']) || (lang === 'el'
      ? 'Προσθέστε την πρώτη σας συναλλαγή για να παρακολουθείτε την καθημερινή ροή των χρημάτων σας.'
      : 'Add your first transaction to start tracking your daily cash flow.');
    const addBtnText = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['trans_empty_btn_add']) || (lang === 'el' ? '➕ Προσθήκη Συναλλαγής' : '➕ Add Transaction');
    const demoBtnText = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['trans_empty_btn_demo']) || (lang === 'el' ? '📊 Δοκιμή με Δείγματα (Demo)' : '📊 Try Demo Mode');

    listContainer.innerHTML = `
      <div class="stats-empty-card" style="margin: 28px 14px;">
        <div style="width: 76px; height: 76px; border-radius: 24px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); display: flex; align-items: center; justify-content: center; font-size: 32px; color: var(--accent); box-shadow: 0 0 25px rgba(99, 102, 241, 0.25); margin-bottom: 2px;">
          <i class="fa-solid fa-receipt"></i>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <h3 class="stats-empty-title">${title}</h3>
          <p class="stats-empty-desc">${desc}</p>
        </div>
        <div class="stats-empty-actions" style="display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 320px; margin-top: 10px;">
          <button class="stats-empty-btn-primary" onclick="openQuickStartModal(0)" style="width: 100%; justify-content: center; font-size: 14px; font-weight: 700; padding: 12px 18px; border-radius: 12px; background: linear-gradient(135deg, var(--accent, #6366f1) 0%, #4f46e5 100%); border: none; color: #fff; cursor: pointer; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);">
            <span>${state.lang === 'el' ? 'Υπολογισμός ορίου σε 1′' : 'Calculate limit in 1 min'}</span>
          </button>
          <div style="display: flex; gap: 8px; width: 100%;">
            <button class="stats-empty-btn-secondary" onclick="openAddTransactionModal()" style="flex: 1; justify-content: center; font-size: 12.5px; padding: 10px 10px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary); cursor: pointer;">
              <span>${addBtnText}</span>
            </button>
            <button class="stats-empty-btn-secondary" onclick="onboardingAddDemoData()" style="flex: 1; justify-content: center; font-size: 12.5px; padding: 10px 10px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: var(--text-secondary); cursor: pointer;">
              <span>${demoBtnText}</span>
            </button>
          </div>
        </div>
      </div>`;
    return;
  }

  // Anti-flicker signature check
  const accountsHash = state.accounts.map(a => `${a.id}_${a.name}_${a.balance}`).join('|');
  const categoriesHash = state.categories.map(c => `${c.id}_${c.name}_${c.icon}`).join('|');
  const renderSignature = sortedTrans.map(t => {
    return `${t.id}_${t.date}_${t.amount}_${t.category}_${t.subcategory || ''}_${t.type}_${t.note || ''}_${t.user_id || ''}_${state.selectedIds.has(t.id) ? '1' : '0'}`;
  }).join('|') + `_selMode_${state.selectionMode ? '1' : '0'}_lang_${state.lang || 'el'}_accs_${accountsHash}_cats_${categoriesHash}_curr_${displayCurrency}_hideAmt_${localStorage.getItem('settings_hide_amounts') === 'true' ? '1' : '0'}`;

  if (listContainer._lastRenderSignature === renderSignature) {
    return;
  }
  listContainer._lastRenderSignature = renderSignature;

  // ANTI-FLICKER: Use replaceChildren() instead of innerHTML='' + appendChild().
  // The old two-step approach (empty the container, then append the fragment)
  // left a visible empty/black gap for a frame between the two DOM mutations,
  // which appeared as a black flicker on resume/sync. replaceChildren() swaps
  // the entire content in ONE atomic DOM mutation, so the browser never paints
  // the empty intermediate state.
  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

  const fragment = document.createDocumentFragment();

  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(dateStr => {
    const group = groups[dateStr];
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const dayNum = d;
    const shortDay = getWeekdayName(dayOfWeek);
    const weekendClass = dayOfWeek === 6 ? ' saturday' : dayOfWeek === 0 ? ' sunday' : '';
    const isToday = (dateStr === todayStr);

    let rightTotals = '';
    if (group.income > 0) rightTotals += `<span class="day-group-income">${getCurrencySymbol()} ${formatDisplayAmount(group.income, displayCurrency)}</span>`;
    if (group.expense > 0) rightTotals += `<span class="day-group-expense">${getCurrencySymbol()} ${formatDisplayAmount(group.expense, displayCurrency)}</span>`;

    const header = document.createElement('div');
    header.className = 'day-header' + (isToday ? ' is-today' : '');
    const todayBadge = isToday ? ` <span class="today-badge">${state.lang === 'el' ? 'ΣΗΜΕΡΑ' : 'TODAY'}</span>` : '';
    header.innerHTML = `
      <div class="day-header-left">
        <span class="day-num">${dayNum}</span>
        <div>
          <span class="day-name${weekendClass}">${shortDay}</span>${todayBadge}
          <span class="day-month">${getMonthName(m - 1, true)} ${y}</span>
        </div>
      </div>
      <div class="day-header-right">${rightTotals}</div>`;
    fragment.appendChild(header);

    group.transactions.forEach(t => {
      const catInfo = getCategoryInfo(t.category, t.type);
      const item = document.createElement('div');
      item.className = 'transaction-item';
      item.setAttribute('data-id', t.id);

      const isSelected = state.selectedIds.has(t.id);
      if (state.selectionMode && isSelected) {
        item.classList.add('selected');
      }

      const checkboxHtml = state.selectionMode ? `
        <div class="trans-checkbox ${isSelected ? 'checked' : ''}">
          <i class="fa-solid ${isSelected ? 'fa-circle-check' : 'fa-circle'}"></i>
        </div>
      ` : '';

      let pressTimer;
      let feedbackTimer;
      let isLongPress = false;
      let touchStartX = 0;
      let touchStartY = 0;

      item.addEventListener('touchstart', (e) => {
        isLongPress = false;
        state.touchDidMove = false;
        if (e.touches && e.touches[0]) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }

        // Active visual feedback with 80ms delay to prevent flashing on swipe/scroll
        clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(() => {
          if (!state.touchDidMove && !state.isSwipingMonth) {
            item.classList.add('pressed');
          }
        }, 80);

        if (state.selectionMode) return;
        pressTimer = setTimeout(() => {
          isLongPress = true;
          enterSelectionMode();
          toggleSelection(t.id);
          if (navigator.vibrate) {
            try { navigator.vibrate(15); } catch (err) { }
          }
        }, 600);
      }, { passive: true });

      item.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
          const dx = e.touches[0].clientX - touchStartX;
          const dy = e.touches[0].clientY - touchStartY;
          if (Math.hypot(dx, dy) > 10) {
            clearTimeout(pressTimer);
            clearTimeout(feedbackTimer);
            item.classList.remove('pressed');
            state.touchDidMove = true;
          }
        } else {
          clearTimeout(pressTimer);
          clearTimeout(feedbackTimer);
          item.classList.remove('pressed');
          state.touchDidMove = true;
        }
      }, { passive: true });

      item.addEventListener('touchend', (e) => {
        clearTimeout(pressTimer);
        clearTimeout(feedbackTimer);
        item.classList.remove('pressed');
        if (state.isSwipingMonth || state.touchDidMove) {
          if (e.cancelable) e.preventDefault();
        }
      }, { passive: false });

      item.addEventListener('touchcancel', () => {
        clearTimeout(pressTimer);
        clearTimeout(feedbackTimer);
        item.classList.remove('pressed');
      });

      item.addEventListener('mousedown', (e) => {
        isLongPress = false;
        item.classList.add('pressed');
        if (state.selectionMode) return;
        pressTimer = setTimeout(() => {
          isLongPress = true;
          enterSelectionMode();
          toggleSelection(t.id);
        }, 600);
      });
      item.addEventListener('mouseup', () => {
        clearTimeout(pressTimer);
        item.classList.remove('pressed');
      });
      item.addEventListener('mouseleave', () => {
        clearTimeout(pressTimer);
        item.classList.remove('pressed');
      });

      item.onclick = (e) => {
        if (state.isSwipingMonth || state.touchDidMove || (Date.now() - state.lastSwipeTime < 1500)) {
          isLongPress = false;
          state.touchDidMove = false;
          return;
        }
        if (isLongPress) {
          isLongPress = false;
          return;
        }
        if (state.selectionMode) {
          toggleSelection(t.id);
        } else {
          openEditTransactionModal(t);
        }
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

      const catBadgeHtml = (typeof renderCategoryIconHtml === 'function')
        ? renderCategoryIconHtml(t.category, { size: 'sm', transType: t.type })
        : `<div class="trans-cat-icon">${catInfo.icon || '💰'}</div>`;

      item.innerHTML = `
        ${checkboxHtml}
        <div class="trans-left">
          <div class="trans-category-container">
            ${catBadgeHtml}
            <div class="trans-cat-name">${escapeHtml(translatedCat) || ''}</div>
            ${t.subcategory ? `<div class="trans-sub-name">${escapeHtml(translatedSub)}</div>` : ''}
          </div>
          <div class="trans-details">
            <span class="trans-title">${escapeHtml(displayTitle)}${isTransactionRecurring(t) ? '<i class="fa-solid fa-arrows-rotate recurring-arrows-icon" title="' + (state.lang === 'el' ? 'Επαναλαμβανόμενη κίνηση' : 'Recurring transaction') + '"></i>' : ''}${memberBadge}</span>
            <span class="trans-acc-label">${escapeHtml(accountText)}</span>
          </div>
        </div>
        <div class="${amountClass}">${getCurrencySymbol()} ${formatDisplayAmount(CurrencyService.displayAmount(t, displayCurrency), displayCurrency)}${getTxCurrencyLabel(t)}${getReliabilityBadge(t)}</div>`;
      fragment.appendChild(item);
    });
  });

  listContainer.replaceChildren(fragment);
}

// Get category display info (icon, name, color) from stored category or emoji map
// Normalize a category name for fuzzy matching: strip leading emoji, lowercase,
// remove Greek accents, and trim. Used to match e.g. "Αυτοκίνητο" against "🚗 ΑΥΤΟΚΙΝΗΤΟ".
function normalizeCategoryName(name) {
  if (!name) return '';
  return normalizeString(stripLeadingEmoji(String(name)).trim());
}

function getCategoryInfo(categoryName, transType) {
  if (!categoryName) return { icon: transType === 'income' ? '💰' : '💸', name: '', color: '#78909c' };

  // Try stored categories first (already cleaned)
  const stored = state.categories.find(c =>
    c.name && c.name.toUpperCase() === (categoryName || '').toUpperCase()
  );
  if (stored) return stored;

  // Try emoji map via codepoint
  const cp = getFirstEmojiCodepoint(categoryName);
  if (cp && CATEGORY_EMOJI_MAP[cp]) return CATEGORY_EMOJI_MAP[cp];

  // Strip and match
  const cleaned = stripLeadingEmoji(categoryName).trim();
  const cleaned2 = state.categories.find(c =>
    c.name && c.name.toUpperCase() === cleaned.toUpperCase()
  );
  if (cleaned2) return cleaned2;

  // Fuzzy match: normalize both sides (strip emoji + case/accents) so that
  // "Αυτοκίνητο" matches the stored "🚗 ΑΥΤΟΚΙΝΗΤΟ" category.
  const normInput = normalizeCategoryName(categoryName);
  if (normInput) {
    const fuzzy = state.categories.find(c => c.name && normalizeCategoryName(c.name) === normInput);
    if (fuzzy) return fuzzy;
  }

  return { icon: transType === 'income' ? '💰' : '💸', name: cleaned || categoryName, color: '#78909c' };
}

// (CATEGORY_NAME_TRANSLATIONS moved to js/constants.js)

// Get category display name - translates default categories, preserves custom/user categories
function getCategoryDisplayName(categoryName) {
  if (!categoryName) return '';
  const stripped = stripLeadingEmoji(categoryName).trim();
  const normInput = normalizeCategoryName(categoryName);
  if (!normInput) return stripped;
  const lang = state.lang || 'el';

  const translations = (typeof CATEGORY_NAME_TRANSLATIONS !== 'undefined')
    ? CATEGORY_NAME_TRANSLATIONS
    : ((typeof window !== 'undefined' && window.CATEGORY_NAME_TRANSLATIONS) || {});

  for (const [elKey, enVal] of Object.entries(translations)) {
    const normEl = normalizeCategoryName(elKey);
    const normEn = normalizeCategoryName(enVal);

    if (normInput === normEl || normInput === normEn) {
      const target = lang === 'en' ? enVal : elKey;
      return stripLeadingEmoji(target).trim();
    }
  }
  return stripped;
}

function isDefaultSubcategory(categoryName, subcategoryName) {
  if (!subcategoryName) return false;

  const normSub = normalizeCategoryName(subcategoryName);
  if (!normSub) return false;

  for (const subcats of Object.values(DEFAULT_SUBCATEGORIES_MAP)) {
    const found = subcats.some(s => normalizeCategoryName(s) === normSub);
    if (found) return true;
  }

  return false;
}

function getSubcategoryDisplayName(subName, categoryName) {
  if (!subName) return '';
  const stripped = stripLeadingEmoji(subName).trim();
  const normInput = normalizeCategoryName(subName);
  if (!normInput) return stripped;
  const lang = state.lang || 'el';

  if (!isDefaultSubcategory(categoryName, subName)) {
    return subName; // Custom entries are never translated
  }

  const translations = (typeof SUBCATEGORY_NAME_TRANSLATIONS !== 'undefined')
    ? SUBCATEGORY_NAME_TRANSLATIONS
    : ((typeof window !== 'undefined' && window.SUBCATEGORY_NAME_TRANSLATIONS) || {});

  for (const [elKey, enVal] of Object.entries(translations)) {
    const normEl = normalizeCategoryName(elKey);
    const normEn = normalizeCategoryName(enVal);

    if (normInput === normEl || normInput === normEn) {
      const target = lang === 'en' ? enVal : elKey;
      return stripLeadingEmoji(target).trim();
    }
  }
  return subName;
}



function saveCategoriesToStorage() {
  deduplicateCategories();
  localStorage.setItem('offline_categories', JSON.stringify(state.categories));
  lastRenderedCategoryType = null;
}

// ============================================================
// TAB 2: STATS
// ============================================================
// ============================================================
// MONTHLY STATISTICS & VISUAL ANALYTICS TAB
// Extracted to js/statsView.js (Phase 12C Architectural Extraction)
// ============================================================

// ============================================================
// TAB 3: ACCOUNTS
// ============================================================
// ============================================================
// ACCOUNTS & WALLETS MANAGEMENT TAB
// Extracted to js/accountsView.js (Phase 12D Architectural Extraction)
// ============================================================

// ============================================================
// EVENT LISTENERS
// ============================================================

// Universal forwarders for extracted modular services
function openSettingsCategoryManager() {
  if (typeof CategoryManager !== 'undefined' && typeof CategoryManager.openSettingsCategoryManager === 'function') {
    return CategoryManager.openSettingsCategoryManager.apply(this, arguments);
  }
}
window.openSettingsCategoryManager = openSettingsCategoryManager;

function openTrashBinModal() {
  if (typeof TrashBinService !== 'undefined' && typeof TrashBinService.openTrashBinModal === 'function') {
    return TrashBinService.openTrashBinModal.apply(this, arguments);
  }
}
window.openTrashBinModal = openTrashBinModal;

function openSearchOverlay() {
  if (typeof SearchFilterService !== 'undefined' && typeof SearchFilterService.openSearchOverlay === 'function') {
    return SearchFilterService.openSearchOverlay.apply(this, arguments);
  }
}
window.openSearchOverlay = openSearchOverlay;


function setupEventListeners() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      if (tab === 'trans' && state.activeTab === 'trans') {
        const today = new Date();
        if (state.selectedMonth === today.getMonth() && state.selectedYear === today.getFullYear()) {
          scrollToToday();
        } else {
          switchTab(tab);
        }
      } else {
        switchTab(tab);
      }
    });
  });

  document.getElementById('period-prev').addEventListener('click', () => {
    navigateMonth(-1);
  });
  document.getElementById('period-next').addEventListener('click', () => {
    navigateMonth(1);
  });

  document.getElementById('stats-tab-expense').addEventListener('click', () => toggleStatsType('expense'));
  document.getElementById('stats-tab-income').addEventListener('click', () => toggleStatsType('income'));
  document.getElementById('fab-btn').addEventListener('click', openAddTransactionModal);

  const fabNoteBtn = document.getElementById('fab-note-btn');
  if (fabNoteBtn) {
    fabNoteBtn.addEventListener('click', () => {
      openNotesManager();
    });
  }

  const notesSearchInput = document.getElementById('notes-manager-search-input');
  if (notesSearchInput) {
    notesSearchInput.addEventListener('input', () => {
      renderNotesList();
    });
  }

  const notesManagerAddBtn = document.getElementById('notes-manager-add-btn');
  if (notesManagerAddBtn) {
    notesManagerAddBtn.addEventListener('click', () => {
      openNoteEditor();
    });
  }

  // More screen hub rows
  const rowPref = document.getElementById('hub-row-preferences');
  if (rowPref) rowPref.addEventListener('click', () => openSettingsSubscreen('preferences', 'settings_pref_title'));

  const rowNotifications = document.getElementById('hub-row-notifications');
  if (rowNotifications) rowNotifications.addEventListener('click', () => openSettingsSubscreen('notifications', 'settings_notif_title'));

  const rowRecurring = document.getElementById('hub-row-recurring');
  if (rowRecurring) rowRecurring.addEventListener('click', openRecurringTemplatesModal);

  const rowCategories = document.getElementById('hub-row-categories');
  if (rowCategories) rowCategories.addEventListener('click', openSettingsCategoryManager);

  const rowSecurity = document.getElementById('hub-row-security');
  if (rowSecurity) rowSecurity.addEventListener('click', () => openSettingsSubscreen('security', 'settings_security_title'));

  const rowTrash = document.getElementById('hub-row-trash');
  if (rowTrash) rowTrash.addEventListener('click', openTrashBinModal);

  const rowSync = document.getElementById('hub-row-sync');
  if (rowSync) rowSync.addEventListener('click', () => openSettingsSubscreen('sync', 'settings_data_title'));

  const rowFamily = document.getElementById('hub-row-family');
  if (rowFamily) rowFamily.addEventListener('click', () => openSettingsSubscreen('family', 'settings_family_title'));

  // NOTE: The Feedback & Rating entry point lives inside the Legal subscreen
  // (legal-feedback-row), so there is no hub-row-feedback element to bind here.

  const rowLegal = document.getElementById('hub-row-legal');
  if (rowLegal) rowLegal.addEventListener('click', () => openSettingsSubscreen('legal', 'settings_account_legal_title'));

  // Close modals dynamically using data-close-modal attribute
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetModal = btn.getAttribute('data-close-modal');
      closeModal(targetModal);
    });
  });

  document.querySelectorAll('.type-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => setTransactionFormType(btn.getAttribute('data-type')));
  });

  // Date input change display listener
  const dateField = document.getElementById('trans-date');
  if (dateField) {
    dateField.addEventListener('input', (e) => {
      document.getElementById('trans-date-display').textContent = formatGreekDateTime(e.target.value);
      updateDualAmountDisplay();
    });
  }

  // Keypad keys pointerdown listeners (0ms mobile touch delay optimization)
  document.querySelectorAll('.calc-key-btn').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // Prevents emulated click events and double triggers
      e.stopPropagation();
      const val = btn.getAttribute('data-val');
      handleCalculatorKeyPress(val);
    });
  });

  // Close keypad when other form fields are clicked or focused
  ['trans-note', 'trans-description', 'trans-category', 'trans-account-from', 'trans-account-to', 'trans-date', 'trans-subcategory-custom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const textInputs = ['trans-note', 'trans-description', 'trans-subcategory-custom'];

      el.addEventListener('focus', () => {
        closeCalculatorKeypad();

        const isKeyboardAlreadyActive = document.body.classList.contains('keyboard-active');

        if (textInputs.includes(id)) {

          document.body.classList.add('keyboard-active');

          if (isIOS) {
            const body = el.closest('.modal-body');
            if (body) {
              // Force layout reflow so the padding-bottom takes effect instantly in bounding rects
              body.offsetHeight;
            }
          }
        }

        const scrollIntoViewIfNeeded = (isInstant = false) => {
          const row = el.closest('.form-row') || el.closest('.form-group');
          const body = el.closest('.modal-body');
          if (row && body) {
            const bodyRect = body.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();

            let keyboardHeight = 0;
            if (window.visualViewport && document.body.classList.contains('keyboard-active')) {
              const cssKeyboardHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--keyboard-height')) || 0;
              const vvKeyboardHeight = window.innerHeight - window.visualViewport.height;
              keyboardHeight = Math.max(vvKeyboardHeight, cssKeyboardHeight);
            }

            const visibleHeight = bodyRect.height - keyboardHeight;
            const safetyMargin = 24; // Keep row at least 24px above the keyboard
            const effectiveBottom = bodyRect.top + visibleHeight - safetyMargin;

            if (rowRect.bottom > effectiveBottom) {
              const targetScroll = body.scrollTop + (rowRect.bottom - effectiveBottom);
              body.scrollTo({ top: targetScroll, behavior: isInstant ? 'auto' : 'smooth' });
            } else if (rowRect.top < bodyRect.top + 8) {
              const targetScroll = Math.max(0, body.scrollTop - (bodyRect.top - rowRect.top) - 8);
              body.scrollTo({ top: targetScroll, behavior: isInstant ? 'auto' : 'smooth' });
            }
          }
        };

        if (isIOS) {
          // On iOS, scroll instantly so input is in the safe zone before Safari decides to pan
          scrollIntoViewIfNeeded(true);
        } else {
          if (!isKeyboardAlreadyActive) {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            setTimeout(() => {
              window.scrollTo(0, 0);
              document.body.scrollTop = 0;
              scrollIntoViewIfNeeded(false);
            }, 350);
          } else {
            setTimeout(() => {
              scrollIntoViewIfNeeded(false);
            }, 50);
          }
        }
      });

      el.addEventListener('blur', () => {
        // Guard: if app is backgrounding or hidden, handle blur synchronously to prevent post-resume layout jumps/flicker
        if (document.visibilityState === 'hidden' || window._appIsBackgrounding) {
          if (textInputs.includes(id)) {
            document.body.classList.remove('keyboard-active');
          }
          forceViewportReset(true);
          return;
        }

        if (textInputs.includes(id)) {
          // Delay removal to see if focus transferred to another text input in the same modal
          setTimeout(() => {
            const activeEl = document.activeElement;
            const isAnotherInputFocused = activeEl && textInputs.includes(activeEl.id);
            if (!isAnotherInputFocused) {
              document.body.classList.remove('keyboard-active');

              // Reset scroll when input loses focus and keyboard actually closes
              setTimeout(() => {
                forceViewportReset();
              }, 50);
            }
          }, 80);
        } else {
          // Reset scroll when input loses focus
          setTimeout(() => {
            forceViewportReset();
          }, 50);
        }
      });
    }
  });

  const subcatSelect = document.getElementById('trans-subcategory-select');
  if (subcatSelect) {
    subcatSelect.addEventListener('change', () => {
      if (subcatSelect.value === '__NEW__') {
        showSubcategorySelect();
      }
    });
    subcatSelect.addEventListener('focus', closeCalculatorKeypad);
    subcatSelect.addEventListener('click', closeCalculatorKeypad);
  }

  const customSubcatInput = document.getElementById('trans-subcategory-custom');
  if (customSubcatInput) {
    customSubcatInput.addEventListener('input', updateCategoryDisplay);
  }

  const catSelect = document.getElementById('trans-category');
  if (catSelect) {
    catSelect.addEventListener('change', updateSubcategorySuggestions);
  }

  // Document keydown for calculator keyboard support
  document.addEventListener('keydown', (e) => {
    // Never intercept typing or backspace when the user is focused on an input or textarea
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      return;
    }
    const modal = document.getElementById('transaction-modal');
    const keypad = document.getElementById('custom-calculator-keypad');
    if (modal && modal.classList.contains('active') && keypad && keypad.classList.contains('active')) {
      const key = e.key;
      if (key >= '0' && key <= '9') {
        handleCalculatorKeyPress(key);
      } else if (key === 'Enter') {
        e.preventDefault();
        handleCalculatorKeyPress('done');
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleCalculatorKeyPress('backspace');
      } else if (key === '-') {
        handleCalculatorKeyPress('-');
      } else if (key === '.' || key === ',') {
        handleCalculatorKeyPress('.');
      }
    }
  });

  let _isSubmittingTransaction = false;
  document.getElementById('transaction-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (_isSubmittingTransaction) return;
    _isSubmittingTransaction = true;
    try {
      closeCalculatorKeypad();
      const id = document.getElementById('trans-id').value;
      const type = document.querySelector('.type-tab-btn.active').getAttribute('data-type');

      let rawAmount = document.getElementById('trans-amount').value || '0';
      rawAmount = stripThousandsSeparators(rawAmount);
      rawAmount = rawAmount.replace(/\,/g, '.');
      const evaluatedVal = evaluateCalcBuffer(rawAmount);
      const amountVal = parseFloat(evaluatedVal) || 0;
      let categoryVal = type === 'transfer' ? 'ΜΕΤΑΦΟΡΑ' : document.getElementById('trans-category').value;
      // Normalize a ghost category (e.g. "Αυτοκίνητο") to its canonical stored name
      // (e.g. "🚗 ΑΥΤΟΚΙΝΗΤΟ") so it doesn't create a phantom category with a wrong icon.
      if (type !== 'transfer' && categoryVal) {
        const normCat = normalizeCategoryName(categoryVal);
        if (normCat) {
          const canonical = state.categories.find(c => c.name && normalizeCategoryName(c.name) === normCat);
          if (canonical) categoryVal = canonical.name;
        }
      }
      const noteVal = document.getElementById('trans-note').value.trim();

      // Validation: Amount, Category, Title (note) must be filled
      const lang = state.lang || 'el';
      if (amountVal <= 0) {
        const msg = lang === 'el' ? 'Παρακαλώ εισάγετε ποσό μεγαλύτερο από 0!' : 'Please enter an amount greater than 0!';
        await showCustomDialog({ message: msg, icon: '⚠️' });
        return;
      }

      if (!categoryVal || categoryVal.trim() === '') {
        const msg = lang === 'el' ? 'Παρακαλώ επιλέξτε κατηγορία!' : 'Please select a category!';
        await showCustomDialog({ message: msg, icon: '⚠️' });
        return;
      }

      if (!noteVal || noteVal === '') {
        const msg = lang === 'el' ? 'Παρακαλώ εισάγετε τίτλο!' : 'Please enter a title!';
        await showCustomDialog({ message: msg, icon: '⚠️' });
        return;
      }

      // Transfers must move money between two DIFFERENT accounts. Reject a
      // transfer where the source and destination account are the same, as it
      // would be a meaningless no-op that only distorts account balances.
      if (type === 'transfer') {
        const fromAcc = document.getElementById('trans-account-from').value;
        const toAcc = document.getElementById('trans-account-to').value;
        if (fromAcc && toAcc && fromAcc === toAcc) {
          const msg = lang === 'el' ? 'Η μεταφορά πρέπει να γίνει μεταξύ δύο διαφορετικών λογαριασμών!' : 'A transfer must be between two different accounts!';
          await showCustomDialog({ message: msg, icon: '⚠️' });
          return;
        }
      }

      const isRecurringActive = _pendingRecurringSettings.isActive === true;

      // Recurring "μέχρι ημερομηνία" guard: when the chosen end date is EARLIER than the transaction
      // date, the generator would silently produce ZERO occurrences (the template is saved but no
      // transaction ever appears — the "recurring save did nothing" bug). Detect this up-front and
      // tell the user instead of failing silently.
      if (!id && isRecurringActive && _pendingRecurringSettings.endType === 'date' && _pendingRecurringSettings.endDate) {
        const startStr = String(document.getElementById('trans-date').value || '').split('T')[0].split(' ')[0];
        const endStr = String(_pendingRecurringSettings.endDate).split('T')[0].split(' ')[0];
        if (startStr && endStr && endStr < startStr) {
          const fmt = (s) => s.split('-').reverse().join('/');
          const msg = lang === 'el'
            ? `⚠️ Η επανάληψη δεν θα δημιουργούσε καμία κίνηση: η ημερομηνία λήξης (${fmt(endStr)}) είναι ΠΡΙΝ την ημερομηνία της συναλλαγής (${fmt(startStr)}). Ανοίξτε το Rep/Inst. και επιλέξτε λήξη μετά την έναρξη.`
            : `⚠️ This recurrence would create no transactions: the end date (${fmt(endStr)}) is BEFORE the transaction date (${fmt(startStr)}). Open Rep/Inst. and pick an end date after the start.`;
          await showCustomDialog({ message: msg, icon: '⚠️' });
          return;
        }
      }

      if (!id && isRecurringActive) {
        const template = {
          id: generateUUID(),
          type,
          amount: amountVal,
          currency: getTransactionCurrency(),
          category: categoryVal,
          subcategory: (() => {
            if (type === 'transfer') return '';
            const customInput = document.getElementById('trans-subcategory-custom');
            if (customInput && customInput.style.display !== 'none') {
              return customInput.value.trim();
            }
            const select = document.getElementById('trans-subcategory-select');
            return (select && select.value !== '__NEW__') ? select.value.trim() : '';
          })(),
          account_from: document.getElementById('trans-account-from').value,
          account_to: type === 'transfer' ? document.getElementById('trans-account-to').value : null,
          note: noteVal,
          description: document.getElementById('trans-description').value.trim(),
          days: [..._pendingRecurringSettings.days],
          months: [..._pendingRecurringSettings.months],
          preset: _pendingRecurringSettings.preset || 'monthly',
          years: [...(_pendingRecurringSettings.years || [])],
          endType: _pendingRecurringSettings.endType || 'perpetual',
          endDate: (() => {
            if (_pendingRecurringSettings.endType === 'date') {
              const hiddenInput = document.getElementById('recurring-end-date');
              return (hiddenInput && hiddenInput.value) ? hiddenInput.value : (_pendingRecurringSettings.endDate || null);
            }
            return null;
          })(),
          startDate: document.getElementById('trans-date').value || new Date().toISOString().split('T')[0],
          startYear: (() => {
            const dateElVal = document.getElementById('trans-date').value;
            return dateElVal ? new Date(dateElVal).getFullYear() : new Date().getFullYear();
          })(),
          startMonth: (() => {
            const dateElVal = document.getElementById('trans-date').value;
            return dateElVal ? (new Date(dateElVal).getMonth() + 1) : (new Date().getMonth() + 1);
          })(),
          user_id: state.currentUser ? state.currentUser.id : null,
          is_shared: state.partnerProfile !== null,
          family_id: state.userProfile ? state.userProfile.family_id : null
        };

        state.recurringTemplates.push(template);
        localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
        if (typeof enqueueSyncMutation === 'function') {
          enqueueSyncMutation('save_template', template);
        }

        if (state.supabaseClient && state.currentUser) {
          state.supabaseClient
            .from('recurring_templates')
            .insert([mapTemplateToDb(template)])
            .select()
            .then(({ data, error }) => {
              if (error) {
                console.error('Failed to sync new recurring template to cloud:', error);
              } else {
                if (typeof dequeueSyncMutation === 'function') {
                  dequeueSyncMutation('save_template', template.id);
                }
                if (data && data[0]) {
                  const idx = state.recurringTemplates.findIndex(t => t.id === template.id);
                  if (idx !== -1) {
                    const dbTemplate = mapTemplateFromDb(data[0]);
                    if (dbTemplate && (!dbTemplate.days || dbTemplate.days.length === 0)) {
                      dbTemplate.days = Array.isArray(template.days) ? template.days : [];
                    }
                    if (dbTemplate && (!dbTemplate.months || dbTemplate.months.length === 0)) {
                      dbTemplate.months = Array.isArray(template.months) ? template.months : [];
                    }
                    if (dbTemplate && (!dbTemplate.years || dbTemplate.years.length === 0)) {
                      dbTemplate.years = Array.isArray(template.years) ? template.years : [];
                    }
                    if (dbTemplate && !dbTemplate.preset) {
                      dbTemplate.preset = template.preset || 'monthly';
                    }
                    state.recurringTemplates[idx] = dbTemplate || template;
                    localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
                    processRecurringTemplates();
                    updateUI();
                  }
                }
              }
            }).catch(e => {
              console.warn('Recurring template insert network error:', e);
            });
        }

        processRecurringTemplates();
        updateUI();

        _pendingReceiptFiles.forEach(p => {
          if (p.url && !p.isExisting) URL.revokeObjectURL(p.url);
        });
        _pendingReceiptFiles = [];
        _pendingReceiptDeleted = false;

        if (typeof clearRecurringSettings === 'function') {
          clearRecurringSettings(false);
        }

        closeModal('transaction-modal');
        return;
      }

      let t = {
        date: document.getElementById('trans-date').value,
        type,
        amount: amountVal,
        currency: getTransactionCurrency(),
        category: categoryVal,
        subcategory: (() => {
          if (type === 'transfer') return '';
          const customInput = document.getElementById('trans-subcategory-custom');
          if (customInput && customInput.style.display !== 'none') {
            return customInput.value.trim();
          }
          const select = document.getElementById('trans-subcategory-select');
          return (select && select.value !== '__NEW__') ? select.value.trim() : '';
        })(),
        account_from: document.getElementById('trans-account-from').value,
        account_to: type === 'transfer' ? document.getElementById('trans-account-to').value : null,
        note: noteVal,
        description: document.getElementById('trans-description').value.trim(),
      };
      if (id) {
        const existing = state.transactions.find(item => item.id === id);
        if (existing) {
          t = { ...existing, ...t };
          t.user_id = existing.user_id || (state.currentUser ? state.currentUser.id : null);
          t.is_shared = existing.is_shared !== undefined ? existing.is_shared : (state.partnerProfile !== null);
          t.family_id = existing.family_id || (state.userProfile ? state.userProfile.family_id : null);
        } else {
          t.id = id;
          t.user_id = state.currentUser ? state.currentUser.id : null;
          t.is_shared = state.partnerProfile !== null;
          t.family_id = state.userProfile ? state.userProfile.family_id : null;
        }
      } else {
        t.user_id = state.currentUser ? state.currentUser.id : null;
        t.is_shared = state.partnerProfile !== null;
        t.family_id = state.userProfile ? state.userProfile.family_id : null;
      }

      // Multi-currency: compute base-currency fields (amount_base, rate_to_base, base_currency).
      // Always computed so new transactions are consistent with the schema, even when the
      // feature flag is off (EUR → 1:1).
      computeCurrencyFields(t);

      // Multi-currency: apply the user-entered actual charged amount (base currency)
      // correction, which overrides the estimated rate with the real one (source='manual').
      if (CurrencyService.isEnabled() && t.currency && t.currency !== t.base_currency) {
        t = applyActualAmountCorrection(t);
      }

      await saveTransaction(t);

      // Save or delete receipt photos in IndexedDB
      if (_pendingReceiptFiles.length > 0 && t.id) {
        try {
          const blobsToSave = _pendingReceiptFiles.map(p => p.file).filter(f => f instanceof Blob);
          await ReceiptStorage.save(t.id, blobsToSave);
          t.photo_local_uri = 'local-file://' + t.id;
          saveTransactionOffline(t);
        } catch (err) {
          console.warn('Failed to save receipt photos:', err);
        }
      } else if (_pendingReceiptDeleted && t.id) {
        try {
          await ReceiptStorage.remove(t.id);
          t.photo_local_uri = null;
          saveTransactionOffline(t);
        } catch (err) {
          console.warn('Failed to delete receipt photos:', err);
        }
      }

      _pendingReceiptFiles.forEach(p => {
        if (p.url && !p.isExisting) URL.revokeObjectURL(p.url);
      });
      _pendingReceiptFiles = [];
      _pendingReceiptDeleted = false;

      closeModal('transaction-modal');
    } finally {
      _isSubmittingTransaction = false;
    }
  });

  document.getElementById('trans-delete-btn').addEventListener('click', async () => {
    const id = document.getElementById('trans-id').value;
    const tx = (state.transactions || []).find(t => String(t.id) === String(id));
    // If this is a recurring transaction, route through the scoped delete modal
    // (single / this + future / all repetitions) instead of deleting just this
    // occurrence directly. Use isTransactionRecurring() OR a direct content-key
    // template resolution so the 3-option modal reliably appears even if the
    // recurring_template_id link is missing on an older cloud-loaded transaction.
    const isRecurring = !!(tx && (isTransactionRecurring(tx) || resolveRecurringTemplateForTx(tx)));
    if (isRecurring) {
      closeModal('transaction-modal');
      // Delay opening the recurring delete modal until the transaction modal has
      // fully closed. On mobile (Capacitor WebView) opening a modal synchronously
      // right after closing another can be swallowed by the close animation /
      // viewport reset, so the 3-option modal never appears. A short delay lets the
      // close complete first, matching the working recurring-card delete path.
      setTimeout(() => {
        openRecurringDeleteModal(tx, String(tx.date || '').split('T')[0].split(' ')[0], { instant: true });
      }, 320);
      return;
    }
    const confirmMsg = TRANSLATIONS[state.lang]['confirm_delete_transaction'];
    const confirmed = await showConfirm(confirmMsg, state.lang === 'el' ? 'Διαγραφή Κίνησης' : 'Delete Transaction', '🗑️', { tone: 'cyan' });
    if (id && confirmed) {
      deleteTransaction(id);
      closeModal('transaction-modal');
    }
  });

  // ============================================================
  // RECEIPT PHOTO LISTENERS
  // Extracted to js/receiptService.js (Phase 15B Architectural Extraction)
  // ============================================================
  if (typeof initReceiptEventListeners === 'function') {
    initReceiptEventListeners();
  } else if (typeof window.initReceiptEventListeners === 'function') {
    window.initReceiptEventListeners();
  }

  function openCalculatorKeypad() {
    if (window.autocompleteJustSelected) return;
    const form = document.getElementById('transaction-form');
    if (form && form.getAttribute('data-readonly') === 'true') return;
    ensureHistoryPushed();
    const keypad = document.getElementById('custom-calculator-keypad');
    if (keypad) {
      keypad.classList.add('active');
    }
    const modal = document.getElementById('transaction-modal');
    if (modal) {
      modal.classList.add('keypad-active');
    }
    const amountRow = document.getElementById('form-row-amount');
    if (amountRow) {
      amountRow.querySelector('.form-row-value-container').classList.add('focused');
      // Scroll amount row to center of modal body
      const body = amountRow.closest('.modal-body');
      if (body) {
        setTimeout(() => {
          window.scrollTo(0, 0);
          document.body.scrollTop = 0;
          const bodyRect = body.getBoundingClientRect();
          const rowRect = amountRow.getBoundingClientRect();
          const relativeTop = rowRect.top - bodyRect.top + body.scrollTop;
          const targetScrollTop = relativeTop - (bodyRect.height / 2) + (rowRect.height / 2);
          body.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
          });
        }, 300);
      }
    }
    state.calcBuffer = stripThousandsSeparators(document.getElementById('trans-amount').value).replace(/\,/g, '.') || '';
    updateKeypadDoneButton();
  }

  window.openCalculatorKeypad = openCalculatorKeypad;

  // Routes taps on the amount row: tapping the currency symbol opens the
  // currency picker, tapping anywhere else opens the calculator keypad.
  function handleAmountRowClick(e) {
    if (e && e.target && e.target.closest && (e.target.closest('.currency-symbol-tappable') || e.target.closest('.currency-symbol'))) {
      openCurrencyPickerModal();
    } else {
      openCalculatorKeypad();
    }
  }

  window.handleAmountRowClick = handleAmountRowClick;

  // Robust tap interception for the currency symbol.
  // Note: We intentionally avoid opening the modal during 'pointerdown' because
  // displaying an overlay before finger-up causes the subsequent 'click' event
  // to hit the newly-opened modal backdrop, which would immediately dismiss it
  // on fast taps. Instead, we capture the gesture and open cleanly on 'click'.
  let _symbolTapPending = false;
  const isSymbolTap = (t) => {
    if (!t) return false;
    const form = document.getElementById('transaction-form');
    if (!form) return false;
    if (t.closest && (t.closest('.currency-symbol-tappable') || t.closest('.currency-symbol'))) return true;
    return false;
  };

  function safeOpenCurrencyPicker(e) {
    try {
      openCurrencyPickerModal();
      return true;
    } catch (err) {
      console.error('[CurrencySymbol] openCurrencyPickerModal failed:', err);
      try {
        if (typeof showSyncToast === 'function') {
          showSyncToast('Σφάλμα νομίσματος: ' + (err && err.message ? err.message : err), 3000);
        }
      } catch (_) { /* ignore */ }
      return false;
    }
  }

  document.addEventListener('click', (e) => {
    if (isSymbolTap(e.target)) {
      e.stopPropagation();
      e.preventDefault();
      safeOpenCurrencyPicker(e);
    }
  }, true);

  function closeCalculatorKeypad() {
    const keypad = document.getElementById('custom-calculator-keypad');
    if (keypad) {
      keypad.classList.remove('active');
    }
    const modal = document.getElementById('transaction-modal');
    if (modal) {
      modal.classList.remove('keypad-active');
    }
    const amountRow = document.getElementById('form-row-amount');
    if (amountRow) {
      amountRow.querySelector('.form-row-value-container').classList.remove('focused');
    }
  }

  window.closeCalculatorKeypad = closeCalculatorKeypad;

  function handleCalculatorKeyPress(val) {
    let buf = state.calcBuffer || '0';

    if (val === 'done') {
      const isExpression = hasPendingMathOperator(buf);
      if (isExpression) {
        // Pressing '=' evaluates the math expression first
        buf = evaluateCalcBuffer(buf);
        state.calcBuffer = buf;
        document.getElementById('trans-amount').value = formatCalcDisplay(buf);
        updateAmountCurrencySymbol();
        updateKeypadDoneButton();
        return;
      } else {
        // Clean result: close keypad
        buf = evaluateCalcBuffer(buf);
        document.getElementById('trans-amount').value = formatCalcDisplay(buf);
        state.calcBuffer = buf;
        updateAmountCurrencySymbol();
        closeCalculatorKeypad();
        return;
      }
    }

    if (val === 'backspace') {
      if (buf.length > 0) {
        buf = buf.slice(0, -1);
      }
      if (buf === '') buf = '0';
    } else if (val === '+' || val === '-') {
      if (buf.length > 0 && !['-', '+', '*', '/'].includes(buf.slice(-1))) {
        buf += val;
      }
    } else if (val === 'calc') {
      buf = evaluateCalcBuffer(buf);
    } else if (val === '.') {
      const lastNumPart = buf.split(/[-+*/]/).pop();
      if (!lastNumPart.includes('.')) {
        buf += '.';
      }
    } else {
      if (buf === '0' && val !== '00') {
        buf = val;
      } else {
        buf += val;
      }
    }

    state.calcBuffer = buf;
    document.getElementById('trans-amount').value = formatCalcDisplay(buf);
    updateAmountCurrencySymbol();
    updateKeypadDoneButton();
  }

  // Stats period navigation
  document.getElementById('stats-period-prev').addEventListener('click', () => {
    adjustStatsPeriod(-1);
  });
  document.getElementById('stats-period-next').addEventListener('click', () => {
    adjustStatsPeriod(1);
  });

  // Dropdown period selection
  const dropdownBtn = document.getElementById('stats-period-dropdown-btn');
  const dropdownMenu = document.getElementById('stats-period-dropdown-menu');
  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const familyFilterMenu = document.getElementById('stats-family-dropdown-menu');
    if (familyFilterMenu) familyFilterMenu.classList.remove('active');
    dropdownMenu.classList.toggle('active');
  });

  const familyFilterBtn = document.getElementById('stats-family-dropdown-btn');
  const familyFilterMenu = document.getElementById('stats-family-dropdown-menu');
  if (familyFilterBtn && familyFilterMenu) {
    familyFilterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.remove('active');
      familyFilterMenu.classList.toggle('active');
    });
  }

  document.addEventListener('click', () => {
    dropdownMenu.classList.remove('active');
    if (familyFilterMenu) {
      familyFilterMenu.classList.remove('active');
    }
    document.querySelectorAll('.member-dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  });

  document.querySelectorAll('.stats-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const val = item.getAttribute('data-value');
      if (val === 'period') {
        const { start, end } = getStatsDateRange();
        document.getElementById('custom-period-start').value = start.toISOString().split('T')[0];
        document.getElementById('custom-period-end').value = end.toISOString().split('T')[0];
        openModal('custom-period-modal');
      } else {
        state.expandedStatsCategories.clear();
        state.statsPeriodType = val;
        state.statsDate = new Date();
        renderStatsTab();
      }
    });
  });

  // Search button and Month picker title event listeners
  const searchBtn = document.getElementById('trans-search-btn');
  if (searchBtn) searchBtn.addEventListener('click', openSearchOverlay);

  const currPeriodTitle = document.getElementById('current-period-title');
  if (currPeriodTitle) {
    currPeriodTitle.addEventListener('click', (e) => {
      const isYearClick = e.target.classList.contains('year-part');
      openMonthPicker(isYearClick);
    });
  }

  const statsPeriodTitle = document.getElementById('stats-period-title');
  if (statsPeriodTitle) {
    statsPeriodTitle.addEventListener('click', (e) => {
      const isYearClick = e.target.classList.contains('year-part');
      openMonthPicker(isYearClick);
    });
  }

  // Tapping the Overview year title returns to the current year.
  const overviewYearTitle = document.getElementById('overview-year-title');
  if (overviewYearTitle) {
    overviewYearTitle.addEventListener('click', () => {
      const currentYear = new Date().getFullYear();
      if ((state.overviewYear || currentYear) !== currentYear) {
        state.overviewYear = currentYear;
        renderAccountsTab();
      }
    });
  }

  // Auto-close search overlay when user scrolls down in the main content
  const appContent = document.querySelector('.app-content');
  if (appContent) {
    let lastScrollTop = 0;
    let touchStartY = 0;

    // Desktop scroll (using capturing to catch scroll events from sub-scroll containers)
    appContent.addEventListener('scroll', (e) => {
      const target = e.target;
      const st = target.scrollTop;
      const overlay = document.getElementById('search-overlay');
      if (overlay && overlay.classList.contains('active') && st > lastScrollTop + 8) {
        closeSearchOverlay();
      }
      lastScrollTop = st <= 0 ? 0 : st;
    }, { capture: true, passive: true });

    // Mobile touch: detect downward swipe
    appContent.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    appContent.addEventListener('touchmove', (e) => {
      const dy = touchStartY - e.touches[0].clientY;
      const overlay = document.getElementById('search-overlay');
      // dy > 0 means swiping up (scrolling down)
      if (overlay && overlay.classList.contains('active') && dy > 15) {
        closeSearchOverlay();
      }
    }, { passive: true });
  }

  // Feedback rating emojis clicks with explanatory text
  const ratingTexts = {
    1: { el: '😡 Πολύ κακό', en: '😡 Very Bad' },
    2: { el: '🙁 Χρειάζεται βελτίωση', en: '🙁 Needs Improvement' },
    3: { el: '😐 Μέτριο', en: '😐 Neutral' },
    4: { el: '😊 Καλό', en: '😊 Good' },
    5: { el: '🤩 Εξαιρετικό!', en: '🤩 Love it!' }
  };

  document.querySelectorAll('.emoji-rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.emoji-rate-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const rate = parseInt(btn.getAttribute('data-rate'));
      const labelEl = document.getElementById('emoji-rate-label');
      if (labelEl && ratingTexts[rate]) {
        const lang = state.lang || 'el';
        labelEl.textContent = ratingTexts[rate][lang] || ratingTexts[rate]['el'];
        labelEl.style.opacity = '1';
      }
    });
  });

  // Feedback type chips clicks
  document.querySelectorAll('.feedback-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.feedback-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ============================================================
// OVERLAY POSITIONING GUARD
// ============================================================
// FIX (auth-overlay root cause): A `position: fixed` overlay that lives inside
// an ancestor with `position: relative` + `overflow: hidden` (like .app-container)
// gets trapped and clipped instead of covering the viewport. This helper ensures
// every full-screen overlay is a DIRECT child of <body> so `fixed` always anchors
// to the viewport. It is idempotent and safe to call before showing any overlay.
function ensureOverlayInBody(el) {
  if (!el || !el.id) return;
  // Guard: ONLY move top-level overlay containers, NEVER inner children or inputs
  const isOverlay = el.classList.contains('modal-overlay') ||
    el.classList.contains('auth-overlay') ||
    el.classList.contains('tx-modal-overlay') ||
    el.id === 'lock-screen' ||
    el.id === 'search-overlay';
  if (!isOverlay) return;

  try {
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
      console.warn('[OVERLAY] Moved #' + el.id + ' to <body> (was nested inside a positioned/overflow container).');
    }
  } catch (e) {
    console.warn('[OVERLAY] Failed to reposition #' + el.id + ':', e);
  }
}

// Registry of all full-screen overlays that must be direct children of <body>.
// Used by initOverlayPlacement() to self-heal at startup and by the open paths.
const FULLSCREEN_OVERLAY_IDS = [
  'auth-overlay',
  'app-redirect-overlay',
  'lock-screen',
  'transaction-modal',
  'search-overlay',
  'fhs-details-modal',
  'forecast-details-modal',
  'advisor-chat-modal',
  'profile-settings-modal',
  'settings-subscreen-modal'
];

// Self-healing startup check: move any top-level overlay that is currently
// nested inside .app-container directly under <body>.
function initOverlayPlacement() {
  try {
    document.querySelectorAll('.modal-overlay, .auth-overlay, .tx-modal-overlay, #lock-screen, #search-overlay').forEach(el => {
      ensureOverlayInBody(el);
    });
  } catch (e) {
    console.warn('[OVERLAY] initOverlayPlacement failed:', e);
  }
}

window.ensureOverlayInBody = ensureOverlayInBody;
window.initOverlayPlacement = initOverlayPlacement;

function openModal(id, { instant = false } = {}) {
  ensureHistoryPushed();
  const el = document.getElementById(id);
  if (!el) return;
  // FIX: Ensure ALL modals/overlays are direct children of <body> before showing.
  ensureOverlayInBody(el);
  el._openedAt = Date.now();

  // For the transaction modal, counteract body { zoom: 0.93 } to perfectly fill physical screen.
  // IMPORTANT: Set inline styles BEFORE adding 'active' class so that the layout is
  // already correct when the browser begins the opacity/transform CSS transition.
  // Doing it after causes a layout recalculation mid-transition → visible flicker on Android.
  if (id === 'transaction-modal') {
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.top = '0px';
  }
  if (id === 'fhs-details-modal') {
    const fhsExplainContent = document.getElementById('fhs-explain-content');
    const fhsExplainChevron = document.getElementById('fhs-explain-chevron');
    if (fhsExplainContent) fhsExplainContent.style.display = 'none';
    if (fhsExplainChevron) fhsExplainChevron.style.transform = 'rotate(0deg)';
  }

  const activate = () => {
    el.classList.add('active');
    document.body.classList.add('modal-open');
  };

  if (instant) {
    // Restore path (no-transition): activate synchronously so no-transition class covers it
    activate();
  } else {
    // Normal open path: add 'active' in next animation frame so the browser first commits
    // the inline style layout changes above, then starts the CSS transition from a stable state.
    requestAnimationFrame(activate);
  }
  localStorage.setItem('bg_active_modal_id', id);
}

// Removed initMainScreenSwipeGestures call and adjustMainPeriod

function adjustStatsPeriod(direction, startingDeltaX = 0) {
  animateSwipeTransition(direction, () => {
    if (state.statsPeriodType === 'weekly') {
      state.statsDate.setDate(state.statsDate.getDate() + direction * 7);
    } else if (state.statsPeriodType === 'monthly') {
      state.statsDate.setDate(15);
      state.statsDate.setMonth(state.statsDate.getMonth() + direction);
      state.selectedMonth = state.statsDate.getMonth();
      state.selectedYear = state.statsDate.getFullYear();
      updateHeaderAndSync();
    } else if (state.statsPeriodType === 'annually') {
      state.statsDate.setDate(15);
      state.statsDate.setFullYear(state.statsDate.getFullYear() + direction);
    } else if (state.statsPeriodType === 'period') {
      const start = new Date(state.statsCustomStart + 'T00:00:00');
      const end = new Date(state.statsCustomEnd + 'T23:59:59');
      const durationMs = end - start + 1; // inclusive
      const newStart = new Date(start.getTime() + direction * durationMs);
      const newEnd = new Date(end.getTime() + direction * durationMs);
      state.statsCustomStart = newStart.toISOString().split('T')[0];
      state.statsCustomEnd = newEnd.toISOString().split('T')[0];
    }
    renderStatsTab(true);
  }, startingDeltaX);
}


function handleCustomPeriodSave() {
  const startVal = document.getElementById('custom-period-start').value;
  const endVal = document.getElementById('custom-period-end').value;
  if (startVal && endVal) {
    if (new Date(startVal) > new Date(endVal)) {
      const msg = TRANSLATIONS[state.lang]['alert_date_order'];
      window.showAlert(msg);
      return;
    }
    state.expandedStatsCategories.clear();
    state.statsCustomStart = startVal;
    state.statsCustomEnd = endVal;
    state.statsPeriodType = 'period';
    closeModal('custom-period-modal');
    renderStatsTab();
  }
}

function scrollToToday(behavior = 'smooth') {
  const isMobile = window.innerWidth <= 767;
  const scrollContainer = isMobile
    ? document.querySelector('.trans-scroll-content')
    : document.querySelector('.app-content');
  const list = document.getElementById('transactions-list');
  if (!scrollContainer || !list) return;

  const todayHeader = list.querySelector('.day-header.is-today');
  if (todayHeader) {
    // Calculate layout-independent offset within scroll container using offsetParent chain
    let relativeTop = 0;
    let el = todayHeader;
    while (el && el !== scrollContainer) {
      relativeTop += el.offsetTop;
      el = el.offsetParent;
    }

    const offset = isMobile ? 0 : 105;

    scrollContainer.scrollTo({
      top: Math.max(0, relativeTop - offset),
      behavior: behavior
    });
  } else {
    scrollContainer.scrollTo({
      top: 0,
      behavior: behavior
    });
  }
}

function resetAllTabScreenStyles() {
  document.querySelectorAll('.tab-screen').forEach(screen => {
    screen.style.position = '';
    screen.style.top = '';
    screen.style.left = '';
    screen.style.width = '';
    screen.style.zIndex = '';
    screen.style.transform = '';
    screen.style.opacity = '';
    screen.style.transition = '';
    screen.style.willChange = '';
    screen.style.display = '';
    screen.style.visibility = '';
  });
  // Clear any leftover inline transforms/opacities on month titles and transaction lists
  ['current-period-title', 'stats-period-title', 'transactions-list', 'stats-breakdown-list'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
    }
  });
}
window.resetAllTabScreenStyles = resetAllTabScreenStyles;
let _isTabSwipeAnimating = false;

function switchTab(tab, instant = false) {
  resetAllTabScreenStyles();
  ensureHistoryPushed();
  // Allow re-tapping 'trans' or 'stats' tab to reset month even if already active
  if (state.activeTab === tab) {
    if (tab === 'trans') {
      const today = new Date();
      state.selectedMonth = today.getMonth();
      state.selectedYear = today.getFullYear();
      syncStatsDate();
      updateUI();
      setTimeout(() => scrollToToday('smooth'), 50);
    } else if (tab === 'stats') {
      const today = new Date();
      const isAlreadyCurrent = (state.selectedMonth === today.getMonth() && state.selectedYear === today.getFullYear());
      if (!isAlreadyCurrent) {
        state.selectedMonth = today.getMonth();
        state.selectedYear = today.getFullYear();
        state.statsDate = new Date();
        state.statsDate.setDate(15);
        state.expandedStatsCategories.clear();
        renderStatsTab();
      } else {
        const scrollContainer = document.querySelector('.stats-scroll-content');
        if (scrollContainer) {
          scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    } else if (tab === 'accounts') {
      // Re-tapping the Overview tab returns to the current year.
      const currentYear = new Date().getFullYear();
      if ((state.overviewYear || currentYear) !== currentYear) {
        state.overviewYear = currentYear;
        renderAccountsTab();
      }
      const accountsScroll = document.querySelector('.accounts-scroll-content');
      if (accountsScroll) {
        accountsScroll.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
    return;
  }

  const prevTabName = state.activeTab;
  state.activeTab = tab;
  try {
    history.pushState({ appState: 'active', tab: tab }, '', window.location.pathname + window.location.search);
    state.historyPushed = true;
  } catch (e) { }

  // Clear expanded categories on active tab change
  state.expandedStatsCategories.clear();

  if (tab === 'stats') {
    state.statsSubtab = 'breakdown';
    if (typeof switchStatsSubtab === 'function') {
      switchStatsSubtab('breakdown');
    }
  }

  // Cancel any pending deferred UI rendering for a previous tab switch
  if (state.tabRenderTimeoutId) {
    clearTimeout(state.tabRenderTimeoutId);
    state.tabRenderTimeoutId = null;
  }

  // If there is an active transition in progress, force-complete it immediately to prevent race conditions & jitter
  if (typeof state.activeTransitionCleanup === 'function') {
    try {
      if (state.activeTransitionTimeoutId) {
        clearTimeout(state.activeTransitionTimeoutId);
        state.activeTransitionTimeoutId = null;
      }
      if (state.activeTransitionAnimEndTarget && state.activeTransitionAnimEndListener) {
        state.activeTransitionAnimEndTarget.removeEventListener('animationend', state.activeTransitionAnimEndListener);
      }
      state.activeTransitionCleanup();
    } catch (err) {
      console.error("Error cleaning up active tab transition:", err);
    }
    state.activeTransitionCleanup = null;
    state.activeTransitionAnimEndTarget = null;
    state.activeTransitionAnimEndListener = null;
  }

  if (state.selectionMode) {
    state.selectionMode = false;
    state.selectedIds.clear();
    const bar = document.getElementById('selection-bar');
    if (bar) bar.classList.remove('active');
    const fab = document.getElementById('fab-btn');
    if (fab) fab.classList.remove('hidden');
    updateNoteShortcutVisibility();
  }

  // Fail-safe: Hide back-swipe indicator on tab switch
  const bsInd = document.getElementById('back-swipe-indicator');
  if (bsInd) bsInd.style.display = 'none';

  // FIX #1 (flicker): state.activeTab was already set to the NEW tab at line 8102,
  // so reading it here would make oldTab === tab (oldScreen === newScreen), causing
  // the fade-in-premium animation to re-run on the already-active screen and flicker.
  // Use prevTabName (captured at line 8101) which holds the actual previous tab.
  const oldTab = prevTabName;
  state.activeTab = tab;
  localStorage.setItem('active_tab', tab);

  // Toggle body class for scroll isolation on mobile
  document.body.classList.toggle('trans-tab-active', tab === 'trans');
  document.body.classList.toggle('stats-tab-active', tab === 'stats');
  document.body.classList.toggle('accounts-tab-active', tab === 'accounts');
  document.body.classList.toggle('more-tab-active', tab === 'more');

  const oldScreen = document.getElementById(`${oldTab}-screen`);
  const newScreen = document.getElementById(`${tab}-screen`);

  // Manage FAB visibility based on active tab
  const fab = document.getElementById('fab-btn');
  if (fab) {
    if (tab === 'trans') {
      fab.style.display = 'flex';
    } else {
      fab.style.display = 'none';
    }
  }
  updateNoteShortcutVisibility();

  if (oldScreen && newScreen) {
    // Hide old screen instantly, remove fade-in class from all screens
    document.querySelectorAll('.tab-screen').forEach(s => {
      s.classList.remove('fade-in-premium');
      if (s.id !== `${tab}-screen`) {
        s.classList.remove('active');
        s.style.display = 'none';
        s.style.visibility = 'hidden';
        s.style.opacity = '0';
      }
    });

    if (instant) {
      newScreen.style.display = '';
      newScreen.style.visibility = '';
      newScreen.style.opacity = '';
      newScreen.classList.add('active');
    } else {
      // Display and trigger animation on new screen
      newScreen.style.display = '';
      newScreen.style.visibility = '';
      newScreen.style.opacity = '';
      newScreen.classList.add('active', 'fade-in-premium');

      const cleanupHandler = () => {
        newScreen.classList.remove('fade-in-premium');
        state.activeTransitionCleanup = null;
        state.activeTransitionAnimEndTarget = null;
        state.activeTransitionAnimEndListener = null;
        state.activeTransitionTimeoutId = null;
      };

      state.activeTransitionCleanup = cleanupHandler;
      state.activeTransitionAnimEndTarget = newScreen;

      const onAnimEnd = (e) => {
        if (e.target === newScreen) {
          newScreen.removeEventListener('animationend', onAnimEnd);
          cleanupHandler();
        }
      };
      state.activeTransitionAnimEndListener = onAnimEnd;
      newScreen.addEventListener('animationend', onAnimEnd);

      state.activeTransitionTimeoutId = setTimeout(() => {
        newScreen.removeEventListener('animationend', onAnimEnd);
        cleanupHandler();
      }, 200);
    }
  } else {
    document.querySelectorAll('.tab-screen').forEach(s => s.classList.toggle('active', s.id === `${tab}-screen`));
  }

  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.getAttribute('data-tab') === tab));

  if (tab !== 'trans') {
    ensureHistoryPushed();
  }

  // Render tab contents immediately to guarantee zero lag/blank states.
  // FIX #4: Use flushUI() instead of calling _updateUIImpl() directly so that
  // any pending scheduled render (e.g. from a background sync) is cancelled
  // first — preventing two concurrent DOM mutations from racing and flickering.
  if (tab === 'trans') {
    const today = new Date();
    state.selectedMonth = today.getMonth();
    state.selectedYear = today.getFullYear();
    syncStatsDate();
    flushUI();
    setTimeout(() => scrollToToday('smooth'), 50);
  } else {
    flushUI();
  }

  if (tab === 'more') {
    updateHeaderProfileBadge();
    if (state.currentUser) {
      const emailDisplay = document.getElementById('settings-user-email-value');
      if (emailDisplay) {
        emailDisplay.textContent = state.currentUser.email;
        emailDisplay.title = state.currentUser.email;
      }
    }
    renderNotesList();
  }
}
window.switchTab = switchTab;

function toggleStatsType(type) {
  state.expandedStatsCategories.clear();
  state.statsType = type;
  document.getElementById('stats-tab-expense').classList.toggle('active', type === 'expense');
  document.getElementById('stats-tab-income').classList.toggle('active', type === 'income');
  renderStatsTab();
}

function forceViewportReset(syncOnly = false) {
  if (!isIOS) return;

  // Snap scroll position back to 0
  window.scrollTo(0, 0);
  document.body.scrollTop = 0;

  if (syncOnly) {
    // If backgrounding, DO NOT use async timeouts that will freeze and execute on resume.
    return;
  }

  const hasOffset = window.scrollY > 0 || (window.visualViewport && window.visualViewport.offsetTop > 0);
  if (hasOffset) {
    // Temporarily make body scrollable to force iOS Safari to reset visual viewport panning
    const originalHeight = document.body.style.height;
    document.body.style.setProperty('height', (window.innerHeight + 150) + 'px', 'important');
    window.scrollTo(0, 10);
    setTimeout(() => {
      window.scrollTo(0, 0);
      document.body.style.height = originalHeight || '';
      if (!originalHeight) {
        document.body.style.removeProperty('height');
      }
      document.body.scrollTop = 0;
    }, 100);
  }
}


function closeModal(id, opts) {
  // opts.userInitiated = true when the close comes from a deliberate user action
  // (back arrow tap, backdrop tap, explicit close button). These must ALWAYS work
  // immediately — they should never be blocked by the resume anti-ghost-click guard.
  const userInitiated = !!(opts && opts.userInitiated) || !!window.__userInitiatedClose;
  if (window.__userInitiatedClose) window.__userInitiatedClose = false;

  // Guard: if app just returned from background, ignore spurious close requests
  // (ghost clicks/events from the OS home gesture) for a short window.
  // User-initiated closes (back arrow / backdrop tap) bypass this guard so they
  // respond instantly with no lag.
  if (window._appJustResumed && !userInitiated) {
    return;
  }

  // Guard: if app is backgrounding, hidden, or blurred, ignore close requests
  // to prevent OS swipe gestures or ghost clicks from closing modals during transition.
  if (document.visibilityState === 'hidden') {
    return;
  }

  // Prevent iOS ghost clicks / click penetration on the elements underneath (e.g. FAB button)
  // document.body.style.pointerEvents = 'none'; (disabled to prevent app freeze)
  setTimeout(() => {
    document.body.style.pointerEvents = '';
  }, 100); // Reduced from 350ms to prevent blocking subsequent user actions

  // Force blur any active input/textarea to close keyboard immediately on modal close
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
    document.activeElement.blur();
  }

  const el = document.getElementById(id);
  if (!el) {
    console.warn('[closeModal] Element not found:', id);
    return;
  }
  if (id === 'settings-subscreen-modal') {
    window._currentSettingsSubscreenTitleKey = null;
    window._currentSettingsSubscreenId = null;
    window._settingsSubscreenHistory = [];
  }
  el.classList.remove('active');
  if (id === 'transaction-modal' && el.style) el.style.cssText = '';
  const activeModals = document.querySelectorAll('.modal-overlay.active, .tx-modal-overlay.active, .profile-sheet-overlay.active');
  if (activeModals.length === 0) {
    document.body.classList.remove('modal-open');

    // Snap window scroll back to top to clear iOS visualViewport panning
    setTimeout(() => {
      forceViewportReset();
    }, 50);
    setTimeout(() => {
      forceViewportReset();
    }, 450);

    localStorage.removeItem('bg_active_modal_id');
    localStorage.removeItem('bg_modal_scroll_top');
    localStorage.removeItem('bg_active_modal_tx_id');
    localStorage.removeItem('bg_active_subcat_txs');

    // Refresh UI now that no modal is blocking tab rendering
    updateUI();
  } else {
    const topModal = activeModals[activeModals.length - 1];
    if (topModal && topModal.id) {
      localStorage.setItem('bg_active_modal_id', topModal.id);
    }
  }
  if (id === 'transaction-modal') {
    if (typeof window.closeCalculatorKeypad === 'function') {
      window.closeCalculatorKeypad();
    }
    state.lastOpenedTransactionId = null;
    if (typeof clearRecurringSettings === 'function') {
      clearRecurringSettings(false);
    }
  }
  if (id === 'category-picker-modal') {
    const settingsTabs = document.getElementById('category-picker-settings-tabs');
    if (settingsTabs) settingsTabs.style.display = 'none';
    window._openedCategoryPickerFromSettings = false;
    categoryPickerEditMode = false;
  }
}

function toggleTransactionFormLock(locked) {
  const form = document.getElementById('transaction-form');
  if (!form) return;

  if (locked) {
    form.setAttribute('data-readonly', 'true');
  } else {
    form.removeAttribute('data-readonly');
  }

  const inputsToToggle = [
    'trans-date',
    'trans-note',
    'trans-description',
    'trans-account-from',
    'trans-account-to',
    'trans-subcategory-custom'
  ];
  inputsToToggle.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = locked;
    }
  });

  const pointerContainers = [
    document.querySelector('.type-selector-tabs'),
    document.getElementById('trans-category-trigger'),
    document.getElementById('trans-subcategory-trigger'),
    document.getElementById('form-row-amount')
  ];
  pointerContainers.forEach(el => {
    if (el) {
      if (locked) {
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.6';
      } else {
        el.style.pointerEvents = '';
        el.style.opacity = '';
      }
    }
  });

  const saveBtn = document.getElementById('btn-save-transaction');
  if (saveBtn) {
    saveBtn.style.display = locked ? 'none' : 'block';
  }
  const deletePhotoBtn = document.getElementById('btn-delete-photo');
  if (deletePhotoBtn) {
    deletePhotoBtn.style.display = locked ? 'none' : 'block';
  }
  const cameraBtn = document.getElementById('trans-camera-btn');
  if (cameraBtn) {
    cameraBtn.style.display = locked ? 'none' : 'block';
  }

  let warningEl = document.getElementById('trans-readonly-warning');
  if (locked) {
    if (!warningEl) {
      warningEl = document.createElement('div');
      warningEl.id = 'trans-readonly-warning';
      warningEl.style.padding = '10px 12px';
      warningEl.style.borderRadius = '8px';
      warningEl.style.backgroundColor = 'rgba(239, 83, 80, 0.15)';
      warningEl.style.color = '#ef5350';
      warningEl.style.fontSize = '12px';
      warningEl.style.fontWeight = '500';
      warningEl.style.textAlign = 'center';
      warningEl.style.marginBottom = '8px';
      warningEl.style.display = 'flex';
      warningEl.style.alignItems = 'center';
      warningEl.style.justifyContent = 'center';
      warningEl.style.gap = '8px';
      warningEl.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${TRANSLATIONS[state.lang]['only_creator_edit_warning']}</span>`;

      const form = document.getElementById('transaction-form');
      if (form) {
        form.parentNode.insertBefore(warningEl, form);
      }
    } else {
      warningEl.querySelector('span').textContent = TRANSLATIONS[state.lang]['only_creator_edit_warning'];
      warningEl.style.display = 'flex';
    }
  } else {
    if (warningEl) {
      warningEl.style.display = 'none';
    }
  }
}

function openAddTransactionModal({ instant = false } = {}) {
  if (typeof window.closeCalculatorKeypad === 'function') {
    window.closeCalculatorKeypad();
  }

  clearRecurringSettings(false);
  const repInstBtn = document.getElementById('btn-rep-inst');
  if (repInstBtn) {
    repInstBtn.style.display = 'flex';
    resetRepInstButton();
    repInstBtn.onclick = (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      openRecurringModal(e);
    };
  }

  if (typeof clearRecurringSettings === 'function') {
    clearRecurringSettings(false);
  }

  toggleTransactionFormLock(false);
  document.getElementById('transaction-form').reset();
  if (window.updateDescriptionHeight) window.updateDescriptionHeight();
  document.getElementById('trans-id').value = '';

  // Reset Category
  document.getElementById('trans-category').value = '';
  document.getElementById('trans-category-display').innerHTML = `<span class="custom-select-placeholder">${(TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['label_select']) || 'Επιλέξτε...'}</span>`;

  // Reset Subcategory
  const customInput = document.getElementById('trans-subcategory-custom');
  if (customInput) customInput.value = '';
  hideSubcategorySelect();

  document.getElementById('trans-delete-btn').style.display = 'none';

  const creatorRow = document.getElementById('trans-creator-row');
  if (creatorRow) creatorRow.style.display = 'none';

  // Reset photo state
  _pendingReceiptFiles.forEach(p => {
    if (p.url && !p.isExisting) URL.revokeObjectURL(p.url);
  });
  _pendingReceiptFiles = [];
  _pendingReceiptDeleted = false;
  const photoInput = document.getElementById('trans-photo-input');
  if (photoInput) photoInput.value = '';
  const cameraInput = document.getElementById('trans-camera-input');
  if (cameraInput) cameraInput.value = '';
  const previewContainer = document.getElementById('trans-photo-preview-container');
  if (previewContainer) previewContainer.style.display = 'none';
  const placeholderContainer = document.getElementById('trans-photo-placeholder-container');
  if (placeholderContainer) placeholderContainer.style.display = 'none';

  const aiBanner = document.getElementById('ai-receipt-scanning-banner');
  if (aiBanner) aiBanner.style.display = 'none';
  const aiCard = document.getElementById('ai-receipt-confirmation-card');
  if (aiCard) aiCard.style.display = 'none';
  const aiCamInput = document.getElementById('trans-ai-camera-input');
  if (aiCamInput) aiCamInput.value = '';
  const aiGalInput = document.getElementById('trans-ai-gallery-input');
  if (aiGalInput) aiGalInput.value = '';

  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
  document.getElementById('trans-date').value = localISOTime;
  document.getElementById('trans-date-display').textContent = formatGreekDateTime(localISOTime);

  setTransactionFormType('expense');

  // Set default account values to avoid empty payment methods
  if (!state.accounts || state.accounts.length === 0) {
    state.accounts = DEFAULT_ACCOUNTS.slice();
  }
  const cardAcc = state.accounts.find(acc => acc.type === 'card' || acc.name.toLowerCase().trim() === 'card' || acc.name.trim() === 'Κάρτα');
  const defaultFromAcc = cardAcc || state.accounts[0];
  document.getElementById('trans-account-from').value = defaultFromAcc.name;
  document.getElementById('trans-account-to').value = state.accounts.length > 1 ? (state.accounts.find(acc => acc.name !== defaultFromAcc.name) || state.accounts[0]).name : state.accounts[0].name;
  updateAccountDropdowns();

  // Multi-currency: default currency from selected account (or base currency), show row if enabled
  initTransactionCurrency();

  openModal('transaction-modal', { instant });
  updateAmountCurrencySymbol();
  setTimeout(() => initNoteAutocomplete(), 50);
}
window.openAddTransactionModal = openAddTransactionModal;

function openEditTransactionModal(t, { instant = false } = {}) {
  state.lastOpenedTransactionId = t.id;
  if (typeof window.closeCalculatorKeypad === 'function') {
    window.closeCalculatorKeypad();
  }

  const recTemplate = resolveRecurringTemplateForTx(t);
  const repInstBtn = document.getElementById('btn-rep-inst');
  if (repInstBtn) {
    repInstBtn.style.display = 'flex';
    if (recTemplate) {
      _pendingRecurringSettings = {
        isActive: true,
        templateId: recTemplate.id,
        preset: recTemplate.preset || 'monthly',
        endType: recTemplate.endType || 'perpetual',
        endDate: recTemplate.endDate || null,
        endYear: recTemplate.endYear || null,
        months: Array.isArray(recTemplate.months) ? [...recTemplate.months] : [],
        days: Array.isArray(recTemplate.days) ? [...recTemplate.days] : []
      };
      repInstBtn.style.background = '#3b82f6';
      repInstBtn.style.color = '#ffffff';
      repInstBtn.style.borderColor = '#3b82f6';
      const isEl = (state.lang || 'el') === 'el';
      const preset = recTemplate.preset || 'monthly';
      let presetLabel = '';
      if (preset === 'daily') presetLabel = isEl ? 'Ημερήσια' : 'Daily';
      else if (preset === 'weekly') presetLabel = isEl ? 'Εβδομαδιαία' : 'Weekly';
      else if (preset === 'monthly') presetLabel = isEl ? 'Μηνιαία' : 'Monthly';
      else if (preset === 'yearly') presetLabel = isEl ? 'Ετήσια' : 'Yearly';
      else if (preset === 'specific_months') presetLabel = isEl ? 'Μήνες' : 'Months';
      else presetLabel = isEl ? 'Custom' : 'Custom';
      repInstBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> ${isEl ? 'Επαναλαμβανόμενη' : 'Recurring'} (${presetLabel})`;
      repInstBtn.onclick = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        openRecurringModal(e);
      };
    } else {
      clearRecurringSettings(false);
      resetRepInstButton();
      repInstBtn.onclick = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        openRecurringModal(e);
      };
    }
  }

  const isFamilyMember = state.userProfile && state.userProfile.family_id;
  const isNotAdmin = state.userProfile && state.userProfile.role !== 'admin';
  const isNotOwner = t.user_id && state.currentUser && t.user_id !== state.currentUser.id;
  const shouldLock = !!(isFamilyMember && isNotAdmin && isNotOwner);

  toggleTransactionFormLock(shouldLock);

  document.getElementById('trans-id').value = t.id;

  let dateVal = t.date;
  if (dateVal) {
    if (dateVal.includes('T')) {
      dateVal = dateVal.slice(0, 16);
    } else if (dateVal.length === 10) {
      if (t.created_at) {
        const createdDate = new Date(t.created_at);
        if (!isNaN(createdDate.getTime())) {
          const hrs = String(createdDate.getHours()).padStart(2, '0');
          const mins = String(createdDate.getMinutes()).padStart(2, '0');
          dateVal = `${dateVal}T${hrs}:${mins}`;
        } else {
          dateVal = `${dateVal}T00:00`;
        }
      } else {
        dateVal = `${dateVal}T00:00`;
      }
    }
  }
  document.getElementById('trans-date').value = dateVal;
  document.getElementById('trans-date-display').textContent = formatGreekDateTime(dateVal);

  document.getElementById('trans-amount').value = formatCalcDisplay(String(t.amount));

  // Load note (primary title) and description (secondary) separately
  document.getElementById('trans-note').value = t.note || '';
  document.getElementById('trans-description').value = t.description || '';
  if (window.updateDescriptionHeight) window.updateDescriptionHeight();

  if (shouldLock) {
    document.getElementById('trans-delete-btn').style.display = 'none';
  } else {
    document.getElementById('trans-delete-btn').style.display = 'flex';
  }

  // Reset photo state and load existing photos if available
  _pendingReceiptFiles.forEach(p => {
    if (p.url && !p.isExisting) URL.revokeObjectURL(p.url);
  });
  _pendingReceiptFiles = [];
  _pendingReceiptDeleted = false;
  const photoInput = document.getElementById('trans-photo-input');
  if (photoInput) photoInput.value = '';
  const cameraInput = document.getElementById('trans-camera-input');
  if (cameraInput) cameraInput.value = '';
  const previewContainer = document.getElementById('trans-photo-preview-container');
  const placeholderContainer = document.getElementById('trans-photo-placeholder-container');
  if (previewContainer) previewContainer.style.display = 'none';
  if (placeholderContainer) placeholderContainer.style.display = 'none';

  const aiBanner = document.getElementById('ai-receipt-scanning-banner');
  if (aiBanner) aiBanner.style.display = 'none';
  const aiCard = document.getElementById('ai-receipt-confirmation-card');
  if (aiCard) aiCard.style.display = 'none';
  const aiCamInput = document.getElementById('trans-ai-camera-input');
  if (aiCamInput) aiCamInput.value = '';
  const aiGalInput = document.getElementById('trans-ai-gallery-input');
  if (aiGalInput) aiGalInput.value = '';

  // Load receipt photos from IndexedDB
  if (t.photo_local_uri && t.id) {
    ReceiptStorage.load(t.id).then(blobs => {
      if (blobs && blobs.length > 0) {
        blobs.forEach(blob => {
          const url = URL.createObjectURL(blob);
          _pendingReceiptFiles.push({
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            file: blob,
            url: url,
            isExisting: true
          });
        });
        renderPhotoPreviews();
      } else if (placeholderContainer) {
        // Photo exists in cloud record but not locally (different device)
        placeholderContainer.style.display = 'flex';
        const placeholderText = document.getElementById('trans-photo-placeholder-text');
        if (placeholderText) {
          placeholderText.textContent = TRANSLATIONS[state.lang]['photo_mismatch_warning'] || 'Η εικόνα είναι διαθέσιμη μόνο στη συσκευή που καταχωρήθηκε.';
        }
      }
    }).catch(err => console.warn('Failed to load receipts:', err));
  }

  setTransactionFormType(t.type);
  setTimeout(() => {
    if (t.type !== 'transfer') {
      document.getElementById('trans-category').value = t.category;

      const subcatVal = t.subcategory || '';
      document.getElementById('trans-subcategory-select').value = subcatVal;

      const customInput = document.getElementById('trans-subcategory-custom');
      if (customInput) customInput.value = '';

      updateCategoryDisplay();
      updateSubcategorySuggestions();
      updateSubcategoryRowVisibility();
    }

    document.getElementById('trans-account-from').value = t.account_from;
    if (t.type === 'transfer') {
      document.getElementById('trans-account-to').value = t.account_to || '';
    }
    updateAccountDropdowns();
  }, 10);

  // Show creator info
  const creatorRow = document.getElementById('trans-creator-row');
  const creatorText = document.getElementById('trans-creator-text');
  if (creatorRow && creatorText) {
    let creatorName = null;
    if (state.userProfile && state.userProfile.family_id && t.user_id) {
      const creator = state.familyProfiles.find(p => p.id === t.user_id);
      if (creator) {
        creatorName = creator.display_name || creator.email.split('@')[0];
      }
    }
    if (!creatorName && state.partnerProfile && t.user_id === state.partnerProfile.id) {
      creatorName = state.partnerProfile.display_name || state.partnerProfile.email.split('@')[0];
    }
    if (!creatorName && state.currentUser && t.user_id === state.currentUser.id) {
      creatorName = state.currentUser.email ? state.currentUser.email.split('@')[0] : (state.userProfile?.display_name || '');
    }
    if (creatorName) {
      creatorRow.style.display = 'block';
      creatorText.textContent = (state.lang === 'el' ? 'Καταχωρήθηκε από: ' : 'Added by: ') + creatorName;
    } else {
      creatorRow.style.display = 'none';
    }
  }

  // Multi-currency: set currency from the transaction being edited, show row if enabled
  initTransactionCurrency(t.currency || null);

  // Multi-currency: prefill the "actual amount" correction field (base currency)
  // with the transaction's current base-currency value, if it differs from base.
  const actualInput = document.getElementById('trans-actual-amount');
  if (actualInput) {
    const baseCurrency = localStorage.getItem('app_currency') || 'EUR';
    const txCurrency = getTransactionCurrency();
    if (CurrencyService.isEnabled() && txCurrency !== baseCurrency) {
      const baseVal = CurrencyService.toBase(t);
      actualInput.value = (baseVal != null && !isNaN(baseVal)) ? String(baseVal) : '';
    } else {
      actualInput.value = '';
    }
  }
  syncActualAmountRowVisibility();

  openModal('transaction-modal', { instant });
  updateAmountCurrencySymbol();
  setTimeout(() => initNoteAutocomplete(), 50);
}

// ============================================================
// RECEIPT PHOTO LIGHTBOX
// Extracted to js/receiptService.js (Phase 15B Architectural Extraction)
// ============================================================

function updateCategoryDisplay() {
  const categoryHidden = document.getElementById('trans-category');
  const categoryDisplay = document.getElementById('trans-category-display');
  if (!categoryHidden || !categoryDisplay) return;

  const categoryVal = categoryHidden.value;
  if (!categoryVal) {
    categoryDisplay.innerHTML = `<span class="custom-select-placeholder">${(TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['label_select']) || 'Επιλέξτε...'}</span>`;
    return;
  }

  const type = document.querySelector('.type-tab-btn.active')?.getAttribute('data-type') || 'expense';
  const cleanName = getCategoryDisplayName(categoryVal);
  const iconHtml = (typeof renderCategoryIconHtml === 'function')
    ? renderCategoryIconHtml(categoryVal, { size: 'inline', transType: type })
    : '';

  const subcatSelect = document.getElementById('trans-subcategory-select')?.value || '';
  const subcatCustom = document.getElementById('trans-subcategory-custom')?.value || '';

  let subcatText = '';
  if (subcatSelect === '__NEW__') {
    subcatText = subcatCustom.trim();
  } else if (subcatSelect) {
    subcatText = getSubcategoryDisplayName(subcatSelect.trim(), categoryVal);
  }

  const fullText = subcatText ? `${cleanName} > ${subcatText}` : cleanName;
  const isLongText = fullText.length > 20;
  const fontSizeStyle = isLongText ? 'font-size: 11.5px;' : 'font-size: 13px;';

  if (subcatText) {
    categoryDisplay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 4px; ${fontSizeStyle} min-width: 0; flex: 1; overflow: hidden;">
        <span style="font-size:14px; flex-shrink:0; display:inline-flex; align-items:center;">${iconHtml}</span>
        <span style="font-weight:600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 85px; flex-shrink: 0;">${cleanName}</span>
        <span style="color: var(--text-muted); margin: 0 1px; flex-shrink:0;">&gt;</span>
        <span style="font-weight:600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1;">${subcatText}</span>
      </div>
    `;
  } else {
    categoryDisplay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 5px; ${fontSizeStyle} min-width: 0; flex: 1; overflow: hidden;">
        <span style="font-size:14px; flex-shrink:0; display:inline-flex; align-items:center;">${iconHtml}</span>
        <span style="font-weight:600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1;">${cleanName}</span>
      </div>
    `;
  }
}

function updateSubcategoryRowVisibility() {
  const subcatGroup = document.getElementById('form-row-subcategory');
  if (!subcatGroup) return;
  const type = document.querySelector('.type-tab-btn.active')?.getAttribute('data-type') || 'expense';
  const subcatSelect = document.getElementById('trans-subcategory-select')?.value || '';

  if (type === 'transfer') {
    subcatGroup.style.display = 'none';
  } else {
    if (subcatSelect === '__NEW__') {
      subcatGroup.style.display = 'flex';
    } else {
      subcatGroup.style.display = 'none';
    }
  }
}

function setTransactionFormType(type) {
  try {
    if (!type) type = 'expense';
    const form = document.getElementById('transaction-form');
    if (form && form.getAttribute('data-readonly') === 'true') return;

    document.querySelectorAll('.type-tab-btn').forEach(btn => {
      const btnType = btn.getAttribute('data-type');
      if (btnType) {
        btn.classList.toggle('active', btnType === type);
      }
    });

    const modalEl = document.getElementById('transaction-modal');
    if (modalEl) {
      modalEl.classList.remove('expense', 'income', 'transfer');
      modalEl.classList.add(type);
    }

    const currentLang = state.lang || 'el';
    const langDict = TRANSLATIONS[currentLang] || TRANSLATIONS['el'];
    let typeLabel = langDict['type_tab_expense'] || 'Έξοδο';
    if (type === 'income') typeLabel = langDict['type_tab_income'] || 'Έσοδο';
    else if (type === 'transfer') typeLabel = langDict['type_tab_transfer'] || 'Μεταφορά';

    const titleEl = document.getElementById('modal-trans-title');
    if (titleEl) {
      titleEl.textContent = typeLabel;
    }

    const catGroup = document.getElementById('form-row-category');
    const toAccGroup = document.getElementById('form-row-account-to');
    const fromAccLabel = document.getElementById('label-account-from');

    if (type === 'transfer') {
      if (catGroup) catGroup.style.display = 'none';
      updateSubcategoryRowVisibility();
      if (toAccGroup) toAccGroup.style.display = 'flex';
      if (fromAccLabel) fromAccLabel.textContent = langDict['label_from'] || 'Από';
    } else {
      if (catGroup) catGroup.style.display = 'flex';
      updateSubcategoryRowVisibility();
      if (toAccGroup) toAccGroup.style.display = 'none';
      if (fromAccLabel) fromAccLabel.textContent = langDict['row_account_from'] || langDict['label_account'] || 'Τρόπος πληρωμής';
      updateCategoryDropdowns(type);
      updateSubcategorySuggestions();
    }
  } catch (err) {
    console.error('Error in setTransactionFormType:', err);
  }
}

let categoryPickerEditMode = false;

function toggleCategoryPickerEditMode() {
  categoryPickerEditMode = !categoryPickerEditMode;
  const btn = document.getElementById('btn-toggle-cat-edit');
  if (btn) {
    btn.textContent = categoryPickerEditMode
      ? (TRANSLATIONS[state.lang]['keypad_btn_done'] || 'Τέλος')
      : (TRANSLATIONS[state.lang]['btn_manage'] || 'Διαχείριση');
    if (categoryPickerEditMode) {
      btn.style.borderColor = 'var(--accent)';
      btn.style.color = 'var(--accent)';
    } else {
      btn.style.borderColor = 'var(--border)';
      btn.style.color = 'var(--text-secondary)';
    }
  }
  const currentType = window._openedCategoryPickerFromSettings
    ? (window._categoryPickerSettingsType || 'expense')
    : document.querySelector('.type-tab-btn.active').getAttribute('data-type');
  updateCategoryDropdowns(currentType, true);
}

async function inlineDeleteCustomCategory(categoryName, type) {
  const confirmMsg = state.lang === 'el'
    ? 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την κατηγορία;'
    : 'Are you sure you want to delete this category?';

  const confirmed = await showConfirm(confirmMsg, state.lang === 'el' ? 'Διαγραφή Κατηγορίας' : 'Delete Category', '📂');
  if (!confirmed) {
    return;
  }

  // Also check if any transactions use this category. If yes, inform the user clearly
  const count = (state.transactions || []).filter(t => t && t.category === categoryName).length;
  if (count > 0) {
    const warningMsg = state.lang === 'el'
      ? `Αυτή η κατηγορία χρησιμοποιείται σε ${count} συναλλαγές. Οι συναλλαγές σας θα παραμείνουν αποθηκευμένες κανονικά (δεν διαγράφονται). Θέλετε να αφαιρεθεί η κατηγορία από τη λίστα επιλογών;`
      : `This category is used in ${count} transactions. Your transactions will remain safely stored (they will not be deleted). Do you want to remove the category from the options list?`;

    const warningConfirmed = await showConfirm(warningMsg, state.lang === 'el' ? 'Επιβεβαίωση' : 'Confirmation', '📂');
    if (!warningConfirmed) {
      return;
    }
  }

  // Find the category to get its ID before removing it
  const catToDelete = state.categories.find(c => c.name === categoryName);
  if (!catToDelete) return;

  state.categories = state.categories.filter(c => c.name !== categoryName);
  saveCategoriesToStorage();

  // Sync delete to cloud if enabled
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser && catToDelete.id) {
    try {
      state.supabaseClient
        .from('categories')
        .delete()
        .eq('id', catToDelete.id)
        .then(({ error }) => {
          if (error) console.warn('Cloud category delete warning:', error);
        });
    } catch (e) {
      console.warn('Cloud category delete failed:', e);
    }
  }

  updateCategoryDropdowns(type);
  if (typeof renderCategoryManagerList === 'function') {
    renderCategoryManagerList();
  }
  updateUI();
}

function inlineRenameCategory(categoryName, type) {
  const cat = state.categories.find(c => c.name === categoryName);
  if (!cat) return;

  const currentDisplayName = getCategoryDisplayName(categoryName);
  const newName = prompt(
    state.lang === 'el' ? 'Εισάγετε το νέο όνομα της κατηγορίας:' : 'Enter the new category name:',
    currentDisplayName
  );

  if (newName === null) return; // User cancelled
  const trimmed = newName.trim();
  if (trimmed === '') {
    window.showAlert(state.lang === 'el' ? 'Το όνομα δεν μπορεί να είναι κενό!' : 'Category name cannot be empty!');
    return;
  }

  // If the display name did not change, do nothing
  if (trimmed === currentDisplayName) return;

  // Check if another category with the same name and type already exists
  const exists = state.categories.find(c => c.type === type && getCategoryDisplayName(c.name).toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    window.showAlert(
      state.lang === 'el'
        ? 'Υπάρχει ήδη κατηγορία με αυτό το όνομα!'
        : 'A category with this name already exists!'
    );
    return;
  }

  const oldName = cat.name;
  const now = new Date().toISOString();

  // Update category name
  cat.name = trimmed;
  cat.updated_at = now;

  // Update all transactions that were using the old category name
  let transactionsUpdated = 0;
  state.transactions.forEach(t => {
    if (t.category === oldName) {
      t.category = trimmed;
      transactionsUpdated++;
    }
  });

  saveCategoriesToStorage();

  if (transactionsUpdated > 0) {
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
  }

  // Sync to Cloud if enabled
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      // Update the category in cloud
      state.supabaseClient
        .from('categories')
        .update({
          name: cat.name,
          updated_at: now
        })
        .eq('id', cat.id)
        .then(({ error }) => {
          if (error) console.warn('Cloud category rename warning:', error);
        });

      // 3. Update transactions in Supabase if any were updated locally
      if (transactionsUpdated > 0) {
        state.supabaseClient
          .from('transactions')
          .update({ category: trimmed })
          .match({ user_id: state.currentUser.id, category: oldName })
          .then(({ error: transErr }) => {
            if (transErr) console.warn('Cloud transactions category update warning:', transErr);
          });
      }
    } catch (e) {
      console.warn('Cloud category rename sync failed:', e);
    }
  }

  updateCategoryDropdowns(type, true);
  updateUI();
}

window.inlineRenameCategory = inlineRenameCategory;
window.openEditCategoryDialog = openEditCategoryDialog;
window.openNewCategoryDialog = openNewCategoryDialog;
window.closeNewCategoryDialog = closeNewCategoryDialog;
window.openCategoryModal = openCategoryModal;

function getCustomCategoryOrder(type) { try { return JSON.parse(localStorage.getItem(`custom_category_order_${type}`)) || []; } catch(e) { return []; } }
function setCustomCategoryOrder(type, arr) { localStorage.setItem(`custom_category_order_${type}`, JSON.stringify(arr)); }
function getCustomSubcategoryOrder(cat) { try { return JSON.parse(localStorage.getItem(`custom_subcategory_order_${cat}`)) || []; } catch(e) { return []; } }
function setCustomSubcategoryOrder(cat, arr) { localStorage.setItem(`custom_subcategory_order_${cat}`, JSON.stringify(arr)); }

let lastRenderedCategoryType = null;
let lastRenderedCategoryEditMode = null;

function updateCategoryDropdowns(type = 'expense', force = false) {
  if (!state.categories || state.categories.length === 0) {
    state.categories = DEFAULT_CATEGORIES.slice();
  }
  deduplicateCategories();
  const grid = document.getElementById('category-picker-grid');
  if (!grid) return;

  // Performance optimization to prevent modal opening lag
  if (!force && lastRenderedCategoryType === type && lastRenderedCategoryEditMode === categoryPickerEditMode) {
    return;
  }

  grid.innerHTML = '';
  lastRenderedCategoryType = type;
  lastRenderedCategoryEditMode = categoryPickerEditMode;

  const currentCategory = document.getElementById('trans-category').value;
  let categoryExists = false;

  // Filter by type. In edit mode, show all. Otherwise, hide hidden categories.
  let visibleCategories = state.categories.filter(c => c.type === type && (categoryPickerEditMode || !c.hidden));

  // Fallback: If no categories found for this type, inject defaults for this type
  if (visibleCategories.length === 0) {
    const defaultsForType = DEFAULT_CATEGORIES.filter(c => c.type === type);
    state.categories.push(...defaultsForType);
    deduplicateCategories();
    visibleCategories = state.categories.filter(c => c.type === type && (categoryPickerEditMode || !c.hidden));
  }

  // Sort categories alphabetically based on display name in the active language
  const lang = state.lang || 'el';
    const customOrder = getCustomCategoryOrder(type);
  visibleCategories.sort((a, b) => {
    const idxA = customOrder.indexOf(a.name);
    const idxB = customOrder.indexOf(b.name);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    const nameA = getCategoryDisplayName(a.name);
    const nameB = getCategoryDisplayName(b.name);
    return nameA.localeCompare(nameB, lang === 'el' ? 'el' : 'en', { sensitivity: 'base' });
  });

  visibleCategories.forEach(c => {
    const div = document.createElement('div');
    div.className = 'category-picker-item';
    div.setAttribute('data-category-name', c.name);

    const displayName = getCategoryDisplayName(c.name);
    const catBadge = (typeof renderCategoryIconHtml === 'function')
      ? renderCategoryIconHtml(c, { size: 'sm', transType: type })
      : `<span class="category-picker-icon">${c.icon}</span>`;

    if (categoryPickerEditMode) {
      div.classList.add('in-edit-mode');
      if (c.hidden) div.style.opacity = '0.55';
      div.innerHTML = `
        ${catBadge}
        <span class="category-picker-name">${displayName}</span>
        <span class="category-delete-badge" title="${state.lang === 'el' ? 'Διαγραφή' : 'Delete'}">
          <i class="fa-solid fa-xmark"></i>
        </span>
      `;
      // Tap the badge = delete
      div.querySelector('.category-delete-badge').addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        inlineDeleteCustomCategory(c.name, type);
      });
      // Tap the card body = edit
      div.onclick = () => openEditCategoryDialog(c.name, type);
    } else {
      if (c.name === currentCategory || (currentCategory && normalizeCategoryName(c.name) === normalizeCategoryName(currentCategory))) {
        div.classList.add('selected');
        categoryExists = true;
      }
      div.innerHTML = `${catBadge}<span class="category-picker-name">${displayName}</span>`;
      div.onclick = () => selectCategory(c.name, c.icon, c.color, true);
    }

    grid.appendChild(div);
  });

  // "+" New Category box (always visible, both in normal and edit mode)
  const addBox = document.createElement('div');
  addBox.className = 'category-picker-item category-picker-add';
  addBox.innerHTML = `<div class="cat-vector-badge" style="width:28px; height:28px; border-radius:8px; background:rgba(124,106,247,0.15); border:1px solid rgba(124,106,247,0.3); color:var(--accent); display:inline-flex; align-items:center; justify-content:center; font-size:14px;"><i class="fa-solid fa-plus"></i></div><span class="category-picker-name">${state.lang === 'el' ? 'Νέα Κατηγορία' : 'New Category'}</span>`;
  addBox.onclick = () => openNewCategoryDialog(type);
  grid.appendChild(addBox);

    if (!categoryPickerEditMode && !categoryExists && currentCategory !== '') {
    document.getElementById('trans-category').value = '';
    updateCategoryDisplay();
  }
  if (window.Sortable) {
    if (grid._sortable) { grid._sortable.destroy(); }
    grid._sortable = Sortable.create(grid, {
      animation: 150, delay: 250, delayOnTouchOnly: true, filter: '.category-picker-add',
      onEnd: function (evt) {
        const newOrder = Array.from(grid.children).filter(el => !el.classList.contains('category-picker-add')).map(el => el.getAttribute('data-category-name')).filter(Boolean);
        setCustomCategoryOrder(type, newOrder);
      }
    });
  }
}


function selectCategory(name, icon, color, isManual = false) {
  document.getElementById('trans-category').value = name;
  document.querySelectorAll('.category-picker-item').forEach(item => {
    item.classList.remove('selected');
    if (item.getAttribute('data-category-name') === name) {
      item.classList.add('selected');
    }
  });

  // Reset subcategory selection when category changes
  document.getElementById('trans-subcategory-select').value = '';
  const customInput = document.getElementById('trans-subcategory-custom');
  if (customInput) customInput.value = '';

  updateCategoryDisplay();
  updateSubcategorySuggestions();
  updateSubcategoryRowVisibility();

  if (isManual) {
    closeModal('category-picker-modal');
    openSubcategoryModal();
  } else {
    closeModal('category-picker-modal');
  }
}

function selectSubcategory(name) {
  document.getElementById('trans-subcategory-select').value = name;
  const customInput = document.getElementById('trans-subcategory-custom');
  if (customInput) customInput.value = '';

  updateCategoryDisplay();
  updateSubcategoryRowVisibility();
  closeModal('subcategory-picker-modal');
}

function openCategoryModal() {
  if (window.autocompleteJustSelected) return;
  const form = document.getElementById('transaction-form');
  if (form && form.getAttribute('data-readonly') === 'true') return;
  const activeTypeTab = document.querySelector('.type-tab-btn.active');
  const currentType = activeTypeTab ? activeTypeTab.getAttribute('data-type') : 'expense';

  // Reset edit mode on modal open
  categoryPickerEditMode = false;
  const btn = document.getElementById('btn-toggle-cat-edit');
  if (btn) {
    btn.textContent = state.lang === 'el' ? 'Διαχείριση' : 'Manage';
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--text-secondary)';
  }

  // Force update to prevent any stale flash or lag when switching tabs
  updateCategoryDropdowns(currentType, true);
  closeNewCategoryDialog(); // Reset dialog state
  openModal('category-picker-modal');
}

function openEditCategoryDialog(categoryName, type) {
  const cat = state.categories.find(c => c.name === categoryName);
  if (!cat) return;

  editingCategoryName = categoryName;
  newCategoryDialogType = type || cat.type || 'expense';

  const visual = (typeof getCategoryVisual === 'function')
    ? getCategoryVisual(cat, newCategoryDialogType)
    : { iconClass: 'fa-solid fa-shapes', color: '#f59e0b' };

  newCategorySelectedIcon = visual.iconClass || 'fa-solid fa-shapes';
  newCategorySelectedColor = cat.color || visual.color || '#f59e0b';

  const nameInput = document.getElementById('new-cat-name-input');
  const titleEl = document.getElementById('new-cat-dialog-title');
  const searchInput = document.getElementById('new-cat-icon-search');

  if (titleEl) {
    titleEl.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_edit_title']) || (state.lang === 'el' ? 'Επεξεργασία Κατηγορίας' : 'Edit Category');
  }

  if (searchInput) {
    searchInput.value = '';
    searchInput.placeholder = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_search_placeholder']) || (state.lang === 'el' ? '🔍 Αναζήτηση (π.χ. καφές, burger, car)...' : '🔍 Search (e.g. coffee, burger, car)...');
  }
  if (nameInput) {
    nameInput.value = getCategoryDisplayName(categoryName);
    nameInput.placeholder = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_name_placeholder']) || (state.lang === 'el' ? 'Όνομα κατηγορίας' : 'Category name');
  }

  const modal = document.getElementById('category-editor-modal');
  if (modal) {
    modal.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang][k]) {
        el.textContent = TRANSLATIONS[state.lang][k];
      }
    });
    modal.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const k = el.getAttribute('data-i18n-placeholder');
      if (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang][k]) {
        el.placeholder = TRANSLATIONS[state.lang][k];
      }
    });
  }

  renderCategoryIconDialog('all', '');

  const saveBtn = document.querySelector('#category-editor-modal .btn-primary');
  if (saveBtn) saveBtn.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['btn_save']) || (state.lang === 'el' ? 'Αποθήκευση' : 'Save');
  const cancelBtn = document.querySelector('#category-editor-modal .btn-secondary');
  if (cancelBtn) cancelBtn.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['btn_cancel']) || (state.lang === 'el' ? 'Άκυρο' : 'Cancel');

  renderEditCategorySubcategories(categoryName);
  openModal('category-editor-modal');
  if (nameInput) setTimeout(() => nameInput.focus(), 150);
}

function openNewCategoryDialog(type) {
  editingCategoryName = null; // ensure we are in create mode
  newCategoryDialogType = type || (window._categoryManagerType || 'expense');
  newCategorySelectedIcon = newCategoryDialogType === 'income' ? 'fa-solid fa-wallet' : 'fa-solid fa-basket-shopping';
  newCategorySelectedColor = newCategoryDialogType === 'income' ? '#4caf50' : '#f59e0b';

  const nameInput = document.getElementById('new-cat-name-input');
  const titleEl = document.getElementById('new-cat-dialog-title');
  const searchInput = document.getElementById('new-cat-icon-search');

  if (titleEl) {
    titleEl.textContent = newCategoryDialogType === 'income'
      ? ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_title_income']) || (state.lang === 'el' ? 'Νέα Κατηγορία Εσόδου' : 'New Income Category'))
      : ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_title_expense']) || (state.lang === 'el' ? 'Νέα Κατηγορία Εξόδου' : 'New Expense Category'));
  }

  if (searchInput) {
    searchInput.value = '';
    searchInput.placeholder = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_search_placeholder']) || (state.lang === 'el' ? '🔍 Αναζήτηση (π.χ. καφές, burger, car)...' : '🔍 Search (e.g. coffee, burger, car)...');
  }
  if (nameInput) {
    nameInput.value = '';
    nameInput.placeholder = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_name_placeholder']) || (state.lang === 'el' ? 'Όνομα κατηγορίας' : 'Category name');
  }

  const modal = document.getElementById('category-editor-modal');
  if (modal) {
    modal.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang][k]) {
        el.textContent = TRANSLATIONS[state.lang][k];
      }
    });
    modal.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const k = el.getAttribute('data-i18n-placeholder');
      if (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang][k]) {
        el.placeholder = TRANSLATIONS[state.lang][k];
      }
    });
  }

  renderCategoryIconDialog('all', '');

  const saveBtn = document.querySelector('#category-editor-modal .btn-primary');
  if (saveBtn) {
    saveBtn.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['btn_save']) || (state.lang === 'el' ? 'Αποθήκευση' : 'Save');
  }
  const cancelBtn = document.querySelector('#category-editor-modal .btn-secondary');
  if (cancelBtn) {
    cancelBtn.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['btn_cancel']) || (state.lang === 'el' ? 'Άκυρο' : 'Cancel');
  }

  renderEditCategorySubcategories(null);
  openModal('category-editor-modal');
  if (nameInput) setTimeout(() => nameInput.focus(), 150);
}

function closeNewCategoryDialog() {
  closeModal('category-editor-modal');
  newCategoryDialogType = 'expense';
  newCategorySelectedIcon = 'fa-solid fa-basket-shopping';
  newCategorySelectedColor = '#f59e0b';
  editingCategoryName = null;
  renderEditCategorySubcategories(null);
}

// ═══════════════════════════════════════════════════════════════════════
// Vector Category Icon Dialog – renders library tabs, color palette,
// icon grid, and live preview inside the #category-editor-modal.
// ═══════════════════════════════════════════════════════════════════════

const NEON_BADGE_COLORS = [
  '#f59e0b', '#ef5350', '#ec407a', '#ab47bc', '#7c6af7',
  '#5c6bc0', '#42a5f5', '#26c6da', '#26a69a', '#66bb6a',
  '#8bc34a', '#4caf50', '#ff7043', '#78909c', '#8d6e63'
];

function renderCategoryIconDialog(libraryFilter, searchQuery) {
  const tabsContainer = document.getElementById('new-cat-library-tabs');
  const grid = document.getElementById('new-cat-emoji-grid');
  const colorPalette = document.getElementById('new-cat-color-palette');
  if (!grid) return;

  // ── Library Tabs ──
  if (tabsContainer) {
    tabsContainer.innerHTML = '';
    const lang = state.lang || 'el';
    const libs = (typeof ICON_LIBRARIES !== 'undefined') ? ICON_LIBRARIES : [];
    const allTab = document.createElement('button');
    allTab.type = 'button';
    allTab.textContent = lang === 'el' ? 'Όλα' : 'All';
    allTab.style.cssText = `padding:6px 12px; font-size:11px; font-weight:700; border-radius:8px; cursor:pointer; white-space:nowrap; border:1px solid ${libraryFilter === 'all' ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}; background:${libraryFilter === 'all' ? 'rgba(124,106,247,0.18)' : 'rgba(0,0,0,0.25)'}; color:${libraryFilter === 'all' ? 'var(--accent)' : 'var(--text-secondary)'};`;
    allTab.onclick = () => renderCategoryIconDialog('all', searchQuery || '');
    tabsContainer.appendChild(allTab);

    libs.forEach(lib => {
      const tab = document.createElement('button');
      tab.type = 'button';
      const isActive = libraryFilter === lib.id;
      tab.innerHTML = `<i class="${lib.icon}" style="margin-right:4px;"></i>${lang === 'el' ? lib.labelEl : lib.labelEn}`;
      tab.style.cssText = `padding:6px 12px; font-size:11px; font-weight:600; border-radius:8px; cursor:pointer; white-space:nowrap; border:1px solid ${isActive ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}; background:${isActive ? 'rgba(124,106,247,0.18)' : 'rgba(0,0,0,0.25)'}; color:${isActive ? 'var(--accent)' : 'var(--text-secondary)'};`;
      tab.onclick = () => renderCategoryIconDialog(lib.id, searchQuery || '');
      tabsContainer.appendChild(tab);
    });
  }

  // ── Color Palette ──
  if (colorPalette && colorPalette.children.length === 0) {
    NEON_BADGE_COLORS.forEach(hex => {
      const swatch = document.createElement('div');
      const isSelected = hex === newCategorySelectedColor;
      swatch.style.cssText = `width:28px; height:28px; min-width:28px; border-radius:50%; background:${hex}; cursor:pointer; border:2.5px solid ${isSelected ? 'white' : 'transparent'}; box-shadow:${isSelected ? '0 0 0 2px var(--accent)' : 'none'}; transition:all 0.15s;`;
      swatch.onclick = () => {
        newCategorySelectedColor = hex;
        colorPalette.querySelectorAll('div').forEach(s => {
          s.style.border = '2.5px solid transparent';
          s.style.boxShadow = 'none';
        });
        swatch.style.border = '2.5px solid white';
        swatch.style.boxShadow = '0 0 0 2px var(--accent)';
        updateNewCategoryLivePreview();
      };
      colorPalette.appendChild(swatch);
    });
  }

  // ── Icon Grid ──
  grid.innerHTML = '';
  const searchFn = (typeof searchCategoryIcons === 'function') ? searchCategoryIcons : null;
  const registry = (typeof CATEGORY_ICON_REGISTRY !== 'undefined') ? CATEGORY_ICON_REGISTRY : [];
  let icons;
  if (searchFn) {
    icons = searchFn(searchQuery || '', libraryFilter || 'all');
  } else {
    icons = registry.filter(item => {
      if (libraryFilter && libraryFilter !== 'all' && item.library !== libraryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return item.id.includes(q) || (item.keywords && item.keywords.some(kw => kw.toLowerCase().includes(q)));
      }
      return true;
    });
  }

  if (icons.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:16px; color:var(--text-muted); font-size:12px;">${state.lang === 'el' ? 'Δε βρέθηκαν εικονίδια' : 'No icons found'}</div>`;
    return;
  }

  icons.forEach(item => {
    const btn = document.createElement('div');
    const isSelected = item.icon === newCategorySelectedIcon;
    btn.style.cssText = `display:flex; align-items:center; justify-content:center; width:46px; height:46px; border-radius:9px; cursor:pointer; transition:all 0.15s; font-size:22px; color:${isSelected ? newCategorySelectedColor : 'var(--text-secondary)'}; border:2px solid ${isSelected ? newCategorySelectedColor : 'transparent'}; background:${isSelected ? 'rgba(124,106,247,0.12)' : 'transparent'};`;
    btn.innerHTML = (typeof renderIconGlyph === 'function')
      ? renderIconGlyph(item.icon, '', 'style="pointer-events:none;"')
      : (String(item.icon).startsWith('fa-') ? `<i class="${item.icon}"></i>` : `<span>${item.icon}</span>`);
    btn.title = item.id;
    btn.onclick = () => {
      newCategorySelectedIcon = item.icon;
      grid.querySelectorAll('div').forEach(d => {
        d.style.border = '2px solid transparent';
        d.style.background = 'transparent';
        d.style.color = 'var(--text-secondary)';
      });
      btn.style.border = `2px solid ${newCategorySelectedColor}`;
      btn.style.background = 'rgba(124,106,247,0.12)';
      btn.style.color = newCategorySelectedColor;
      updateNewCategoryLivePreview();
    };
    grid.appendChild(btn);
  });

  updateNewCategoryLivePreview();
}

function handleCategoryIconSearch(value) {
  const tabsContainer = document.getElementById('new-cat-library-tabs');
  // Determine currently active library tab
  let activeLib = 'all';
  if (tabsContainer) {
    const activeBtn = tabsContainer.querySelector('button[style*="accent"]');
    if (activeBtn) {
      const libs = (typeof ICON_LIBRARIES !== 'undefined') ? ICON_LIBRARIES : [];
      const btnText = activeBtn.textContent.trim();
      const match = libs.find(l => l.labelEl === btnText || l.labelEn === btnText);
      if (match) activeLib = match.id;
    }
  }
  renderCategoryIconDialog(activeLib, value || '');
}

function updateNewCategoryLivePreview() {
  const previewContainer = document.getElementById('new-cat-preview-icon-container');
  const previewName = document.getElementById('new-cat-preview-name');
  const previewType = document.getElementById('new-cat-preview-type');
  const nameInput = document.getElementById('new-cat-name-input');

  if (previewContainer) {
    const color = newCategorySelectedColor || '#f59e0b';
    const iconClass = newCategorySelectedIcon || 'fa-solid fa-basket-shopping';
    const hexToRgbaFn = (typeof hexToRgba === 'function') ? hexToRgba : (h, a) => `rgba(120,144,156,${a})`;
    const bgGlow = hexToRgbaFn(color, 0.15);
    const borderGlow = hexToRgbaFn(color, 0.28);
    previewContainer.innerHTML = `<div class="cat-vector-badge" style="width:44px; height:44px; min-width:44px; border-radius:12px; background:${bgGlow}; border:1px solid ${borderGlow}; color:${color}; display:inline-flex; align-items:center; justify-content:center; font-size:22px;">${(typeof renderIconGlyph === 'function') ? renderIconGlyph(iconClass) : (String(iconClass).startsWith('fa-') ? `<i class="${iconClass}"></i>` : `<span>${iconClass}</span>`)}</div>`;
  }

  if (previewName && nameInput) {
    const val = nameInput.value.trim();
    previewName.textContent = val || ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_name_placeholder']) || (state.lang === 'el' ? 'Όνομα κατηγορίας' : 'Category name'));
  }

  if (previewType) {
    const label = newCategoryDialogType === 'income'
      ? ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_preview_type_income']) || (state.lang === 'el' ? 'Κατηγορία Εσόδου' : 'Income Category'))
      : ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_preview_type_expense']) || (state.lang === 'el' ? 'Κατηγορία Εξόδου' : 'Expense Category'));
    previewType.textContent = editingCategoryName
      ? ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['btn_edit']) || (state.lang === 'el' ? 'Επεξεργασία' : 'Editing'))
      : label;
  }
}

function renderEditCategorySubcategories(categoryName) {
  const section = document.getElementById('edit-cat-subcategories-section');
  if (!section) return;

  if (!categoryName) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'flex';
  section.innerHTML = '';

  const lang = state.lang || 'el';
  const stats = (typeof getSubcategoriesStatsForCategory === 'function')
    ? getSubcategoriesStatsForCategory(categoryName)
    : {};
  const subcatKeys = Object.keys(stats);

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; justify-content:space-between;';
  header.innerHTML = `
    <label style="font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">
      ${lang === 'el' ? 'Υποκατηγορίες' : 'Subcategories'}
      <span style="color:var(--accent); font-weight:800; margin-left:4px;">${subcatKeys.length > 0 ? `(${subcatKeys.length})` : ''}</span>
    </label>
  `;
  section.appendChild(header);

  if (subcatKeys.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:12.5px; color:var(--text-muted); padding:16px 12px; text-align:center; line-height:1.5; background:rgba(0,0,0,0.1); border:1px solid rgba(255,255,255,0.04); border-radius:10px;';
    empty.innerHTML = lang === 'el'
      ? 'Δεν υπάρχουν ακόμη υποκατηγορίες.<br><span style="font-size:11px; opacity:0.8;">Οι υποκατηγορίες δημιουργούνται αυτόματα όταν καταχωρείς συναλλαγές.</span>'
      : 'No subcategories yet.<br><span style="font-size:11px; opacity:0.8;">Subcategories are created automatically when you record transactions.</span>';
    section.appendChild(empty);
    return;
  }

  const sortedSubs = subcatKeys.sort((a, b) => {
    const diff = stats[b].count - stats[a].count;
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });

  sortedSubs.forEach(sub => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); border-radius:10px; font-size:13px; color:var(--text-secondary); transition: background 0.2s;';

    const count = stats[sub].count;
    const lastUsed = stats[sub].lastUsedDate;
    let lastUsedStr = '';
    if (lastUsed) {
      const parts = lastUsed.split('-');
      if (parts.length === 3) {
        lastUsedStr = lang === 'el'
          ? ` • Τελ. χρήση: ${parts[2]}/${parts[1]}/${parts[0]}`
          : ` • Last used: ${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    const txLabel = lang === 'el'
      ? (count === 1 ? 'συναλλαγή' : 'συναλλαγές')
      : (count === 1 ? 'transaction' : 'transactions');

    item.innerHTML = `
      <div style="display:flex; flex-direction:column; flex:1; overflow:hidden; margin-right:8px;">
        <span style="font-weight:600; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${sub}</span>
        <span style="font-size:11px; color:var(--text-muted); margin-top:2px;">${count} ${txLabel}${lastUsedStr}</span>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button type="button" class="icon-btn edit-sub-btn" style="color:var(--text-muted); cursor:pointer; font-size:12.5px; background:none; border:none; padding:6px; transition:color 0.2s;"><i class="fa-solid fa-pen"></i></button>
        <button type="button" class="icon-btn delete-sub-btn" style="color:var(--red-negative, #ff4a4a); cursor:pointer; font-size:12.5px; background:none; border:none; padding:6px; transition:color 0.2s;"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `;

    item.querySelector('.edit-sub-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; flex:1; margin-right:8px;">
          <input type="text" class="rename-sub-input" value="${sub}" style="flex:1; padding:6px 10px; font-size:13px; border-radius:8px; background:rgba(0,0,0,0.35); border:1px solid var(--accent, #7c6af7); color:var(--text-primary); outline:none; font-family:'Outfit',sans-serif;">
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button type="button" class="icon-btn save-rename-btn" style="color:var(--accent, #7c6af7); cursor:pointer; font-size:13px; background:none; border:none; padding:6px;"><i class="fa-solid fa-check"></i></button>
          <button type="button" class="icon-btn cancel-rename-btn" style="color:var(--text-muted); cursor:pointer; font-size:13px; background:none; border:none; padding:6px;"><i class="fa-solid fa-xmark"></i></button>
        </div>
      `;

      const input = item.querySelector('.rename-sub-input');
      if (input) {
        input.focus();
        input.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter') {
            evt.preventDefault();
            item.querySelector('.save-rename-btn').click();
          }
        });
      }

      item.querySelector('.save-rename-btn').addEventListener('click', async (evt) => {
        evt.stopPropagation();
        const newName = input.value.trim();
        if (newName === '') {
          showSyncToast(lang === 'el' ? '⚠️ Το όνομα δεν μπορεί να είναι κενό!' : '⚠️ Name cannot be empty!', 2500);
          return;
        }
        if (/^[ \-_\.\*]+$/.test(newName)) {
          showSyncToast(lang === 'el' ? '⚠️ Μη έγκυρο όνομα υποκατηγορίας!' : '⚠️ Invalid subcategory name!', 2500);
          return;
        }
        if (newName === sub) {
          renderEditCategorySubcategories(categoryName);
          return;
        }
        if (stats[newName]) {
          const confirmTitle = lang === 'el' ? 'Συγχώνευση Υποκατηγοριών' : 'Merge Subcategories';
          const confirmMsg = lang === 'el'
            ? `Η υποκατηγορία "${newName}" υπάρχει ήδη. Θέλετε να συγχωνεύσετε όλες τις συναλλαγές της "${sub}" στην "${newName}";`
            : `Subcategory "${newName}" already exists. Do you want to merge all transactions from "${sub}" into "${newName}"?`;
          const confirmed = await showConfirm(confirmMsg, confirmTitle, '🔀');
          if (!confirmed) return;
        }
        await renameSubcategoryGlobally(categoryName, sub, newName);
        renderEditCategorySubcategories(categoryName);
      });

      item.querySelector('.cancel-rename-btn').addEventListener('click', (evt) => {
        evt.stopPropagation();
        renderEditCategorySubcategories(categoryName);
      });
    });

    item.querySelector('.delete-sub-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmTitle = lang === 'el' ? 'Διαγραφή Υποκατηγορίας' : 'Delete Subcategory';
      const confirmMsg = lang === 'el'
        ? `Είστε σίγουροι ότι θέλετε να διαγράψετε την υποκατηγορία "${sub}";\nΘα αφαιρεθεί από όλες τις συναλλαγές.`
        : `Are you sure you want to delete subcategory "${sub}"?\nIt will be removed from all transactions.`;
      const confirmed = await showConfirm(confirmMsg, confirmTitle, '🗑️');
      if (confirmed) {
        await deleteSubcategoryGlobally(categoryName, sub);
        renderEditCategorySubcategories(categoryName);
      }
    });

    section.appendChild(item);
  });
}

function saveNewCategoryFromPicker() {
  const nameInput = document.getElementById('new-cat-name-input');
  const name = nameInput ? nameInput.value.trim() : '';

  if (!name) {
    window.showAlert(TRANSLATIONS[state.lang]['alert_enter_category_name']);
    return;
  }

  // === EDIT MODE: Update existing category ===
  if (editingCategoryName) {
    const cat = state.categories.find(c => c.name === editingCategoryName);
    if (!cat) {
      closeNewCategoryDialog();
      return;
    }

    const oldName = cat.name;
    const currentDisplayName = getCategoryDisplayName(oldName);
    const nameChanged = name !== currentDisplayName;
    const iconChanged = newCategorySelectedIcon !== cat.icon;
    const colorChanged = newCategorySelectedColor !== cat.color;

    if (!nameChanged && !iconChanged && !colorChanged) {
      closeNewCategoryDialog();
      return;
    }

    // Check for name collision with another category (only if name changed)
    if (nameChanged) {
      const collision = state.categories.find(c => c.name !== oldName && getCategoryDisplayName(c.name).toLowerCase() === name.toLowerCase() && c.type === cat.type);
      if (collision) {
        window.showAlert(state.lang === 'el' ? 'Υπάρχει ήδη κατηγορία με αυτό το όνομα!' : 'A category with this name already exists!');
        return;
      }
    }

    const now = new Date().toISOString();
    cat.name = name;
    cat.icon = newCategorySelectedIcon;
    cat.color = newCategorySelectedColor;
    cat.updated_at = now;

    // Update transactions using old name
    let transactionsUpdated = 0;
    if (nameChanged) {
      state.transactions.forEach(t => {
        if (t.category === oldName) {
          t.category = name;
          transactionsUpdated++;
        }
      });
      if (transactionsUpdated > 0) {
        localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
      }
    }

    saveCategoriesToStorage();

    // Cloud sync
    if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
      try {
        if (nameChanged) {
          // Update category name
          state.supabaseClient.from('categories').update({
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            hidden: !!cat.hidden,
            updated_at: now
          }).eq('id', cat.id)
            .then(({ error }) => { if (error) console.warn('Cloud category rename warning:', error); });
            
          if (transactionsUpdated > 0) {
             let query = state.supabaseClient.from('transactions').update({ category: name }).eq('category', oldName);
             if (state.userProfile && state.userProfile.family_id) {
               query = query.eq('family_id', state.userProfile.family_id);
             } else {
               query = query.eq('user_id', state.currentUser.id);
             }
             query.then(({ error }) => { if (error) console.warn('Cloud transactions rename warning:', error); });
          }
        } else {
          // Only icon / color / details changed
          state.supabaseClient.from('categories').update({
            icon: cat.icon,
            color: cat.color,
            hidden: !!cat.hidden,
            updated_at: now
          }).eq('id', cat.id)
            .then(({ error }) => { if (error) console.warn('Cloud category update warning:', error); });
        }
      } catch (e) {
        console.warn('Cloud category edit sync failed:', e);
      }
    }

    closeNewCategoryDialog();
    updateCategoryDropdowns(newCategoryDialogType, true);
    if (typeof renderCategoryManagerList === 'function') {
      renderCategoryManagerList();
    }
    updateUI();
    showSyncToast(state.lang === 'el' ? '✓ Κατηγορία ενημερώθηκε' : '✓ Category updated', 2000);
    return;
  }

  // === CREATE MODE: New category ===
  // Check for duplicate
  const exists = state.categories.find(c =>
    c.name && c.name.toUpperCase() === name.toUpperCase()
  );
  if (exists) {
    window.showAlert(TRANSLATIONS[state.lang]['alert_category_exists']);
    return;
  }

  // Create new category
  const now = new Date().toISOString();
  const newCategory = {
    id: typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID(),
    name: name,
    type: newCategoryDialogType,
    icon: newCategorySelectedIcon,
    color: newCategorySelectedColor,
    user_id: state.currentUser ? state.currentUser.id : null,
    family_id: state.userProfile ? state.userProfile.family_id : null,
    created_at: now,
    updated_at: now
  };

  state.categories.push(newCategory);
  saveCategoriesToStorage();

  // Sync to cloud if enabled
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      state.supabaseClient
        .from('categories')
        .insert({
          id: newCategory.id,
          user_id: state.currentUser.id,
          family_id: state.userProfile ? state.userProfile.family_id : null,
          name: newCategory.name,
          type: newCategory.type,
          icon: newCategory.icon,
          color: newCategory.color,
          created_at: newCategory.created_at,
          updated_at: newCategory.updated_at
        })
        .then(({ error }) => {
          if (error) console.warn('Cloud category insert warning:', error);
        });
    } catch (e) {
      console.warn('Cloud category insert catch:', e);
    }
  }

  // Close dialog
  closeNewCategoryDialog();

  // Refresh grid
  updateCategoryDropdowns(newCategoryDialogType);
  if (typeof renderCategoryManagerList === 'function') {
    renderCategoryManagerList();
  }

  // Auto-select the new category
  document.getElementById('trans-category').value = newCategory.name;
  document.querySelectorAll('.category-picker-item').forEach(item => {
    item.classList.remove('selected');
    if (item.getAttribute('data-category-name') === newCategory.name) {
      item.classList.add('selected');
    }
  });

  updateCategoryDisplay();
  updateSubcategorySuggestions();
  updateSubcategoryRowVisibility();

  // Close the category picker modal
  closeModal('category-picker-modal');
}

function openSubcategoryModal() {
  if (window.autocompleteJustSelected) return;
  const form = document.getElementById('transaction-form');
  if (form && form.getAttribute('data-readonly') === 'true') return;
  if (!document.getElementById('trans-category').value) {
    window.showAlert(TRANSLATIONS[state.lang]['alert_select_category_first']);
    return;
  }
  updateSubcategorySuggestions();
  openModal('subcategory-picker-modal');
}

function getAccountVisualInfo(accOrType) {
  const type = typeof accOrType === 'object' && accOrType ? accOrType.type : accOrType;
  switch (type) {
    case 'cash':
      return { iconClass: 'fa-solid fa-money-bill-wave', emoji: '💵', color: '#10b981', labelEl: 'Μετρητά', labelEn: 'Cash' };
    case 'card':
      return { iconClass: 'fa-solid fa-credit-card', emoji: '💳', color: '#f59e0b', labelEl: 'Κάρτα', labelEn: 'Card' };
    case 'investment':
      return { iconClass: 'fa-solid fa-chart-line', emoji: '📈', color: '#8b5cf6', labelEl: 'Επένδυση', labelEn: 'Investment' };
    case 'bank':
    default:
      return { iconClass: 'fa-solid fa-building-columns', emoji: '🏦', color: '#3b82f6', labelEl: 'Τράπεζα', labelEn: 'Bank' };
  }
}

function getAccountDisplayName(accOrName) {
  if (!accOrName) return '';
  const name = typeof accOrName === 'string' ? accOrName : (accOrName.name || '');
  const type = typeof accOrName === 'object' && accOrName ? (accOrName.type || '') : '';
  const lowerName = name.toLowerCase().trim();
  const lang = state.lang || 'el';

  if (lang === 'el') {
    if (lowerName === 'cash' || lowerName === 'μετρητά' || (!lowerName && type === 'cash')) return 'Μετρητά';
    if (lowerName === 'bank account' || lowerName === 'bank' || lowerName === 'τραπεζικός λογαριασμός' || lowerName === 'τράπεζα' || (!lowerName && type === 'bank')) return 'Τράπεζα';
    if (lowerName === 'card' || lowerName === 'κάρτα' || (!lowerName && type === 'card')) return 'Κάρτα';
  } else {
    if (lowerName === 'cash' || lowerName === 'μετρητά' || (!lowerName && type === 'cash')) return 'Cash';
    if (lowerName === 'bank account' || lowerName === 'bank' || lowerName === 'τραπεζικός λογαριασμός' || lowerName === 'τράπεζα' || (!lowerName && type === 'bank')) return 'Bank Account';
    if (lowerName === 'card' || lowerName === 'κάρτα' || (!lowerName && type === 'card')) return 'Card';
  }
  return name;
}

let _currentAccountPickerTarget = 'from';

function openAccountPickerModal(target) {
  if (window.autocompleteJustSelected) return;
  const form = document.getElementById('transaction-form');
  if (form && form.getAttribute('data-readonly') === 'true') return;
  _currentAccountPickerTarget = target;

  const titleEl = document.getElementById('account-picker-title');
  if (titleEl) {
    const langDict = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[state.lang]) || {};
    titleEl.textContent = langDict['account_picker_title'] || (state.lang === 'el' ? 'Επιλογή τρόπου πληρωμής' : 'Select Payment Method');
  }

  renderAccountPickerOptions();
  openModal('account-picker-modal');
}

function renderAccountPickerOptions() {
  if (!state.accounts || state.accounts.length === 0) {
    state.accounts = (typeof DEFAULT_ACCOUNTS !== 'undefined' ? DEFAULT_ACCOUNTS : [
      { name: 'Cash', type: 'cash', balance: 0 },
      { name: 'Bank Account', type: 'bank', balance: 0 },
      { name: 'Card', type: 'card', balance: 0 }
    ]).slice();
  }
  const container = document.getElementById('account-picker-list');
  if (!container) return;

  container.innerHTML = '';

  const targetInput = document.getElementById(`trans-account-${_currentAccountPickerTarget}`);
  const currentVal = targetInput ? targetInput.value : '';

  state.accounts.filter(a => a.is_active !== false).forEach(acc => {
    const item = document.createElement('div');
    item.className = 'account-picker-item';
    if (acc.name === currentVal) {
      item.classList.add('selected');
    }

    const visual = getAccountVisualInfo(acc);
    const displayName = getAccountDisplayName(acc);

    item.innerHTML = `
      <div style="width: 32px; height: 32px; border-radius: 8px; background: ${visual.color}22; border: 1px solid ${visual.color}44; color: ${visual.color}; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 10px;">
        <i class="${visual.iconClass}"></i>
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 600; font-size: 14px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayName)}</div>
        <div style="font-size: 11px; color: var(--text-muted);">${state.lang === 'el' ? visual.labelEl : visual.labelEn}</div>
      </div>
    `;

    item.onclick = () => selectAccountOption(acc.name);
    container.appendChild(item);
  });

  // + New Account option at the bottom
  const newAccBtn = document.createElement('div');
  newAccBtn.className = 'account-picker-item new-acc-item';
  newAccBtn.style.cssText = 'border-top: 1px dashed var(--border); margin-top: 4px; padding-top: 12px; color: #3b82f6; font-weight: 600; display: flex; align-items: center; cursor: pointer;';
  newAccBtn.innerHTML = `
    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); color: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 10px;">
      <i class="fa-solid fa-plus"></i>
    </div>
    <span style="font-size: 13px;">${(TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['account_picker_new']) || '+ Νέος Λογαριασμός...'}</span>
  `;
  newAccBtn.onclick = () => {
    closeModal('account-picker-modal');
    openAccountEditorModal();
  };
  container.appendChild(newAccBtn);
}

function selectAccountOption(name) {
  const targetId = `trans-account-${_currentAccountPickerTarget}`;
  document.getElementById(targetId).value = name;

  updateAccountTriggerDisplay(_currentAccountPickerTarget);
  closeModal('account-picker-modal');
}

function updateAccountTriggerDisplay(target) {
  const input = document.getElementById(`trans-account-${target}`);
  if (!input) return;
  let value = input.value;
  const triggerDisplay = document.getElementById(`trans-account-${target}-display`);
  if (!triggerDisplay) return;

  if (!value) {
    if (!state.accounts || state.accounts.length === 0) {
      state.accounts = (typeof DEFAULT_ACCOUNTS !== 'undefined' ? DEFAULT_ACCOUNTS : [
        { name: 'Cash', type: 'cash', balance: 0 },
        { name: 'Bank Account', type: 'bank', balance: 0 },
        { name: 'Card', type: 'card', balance: 0 }
      ]).slice();
    }
    const defaultAcc = target === 'to' ? (state.accounts[1] || state.accounts[0]) : state.accounts[0];
    if (defaultAcc) {
      input.value = defaultAcc.name;
      value = defaultAcc.name;
    }
  }

  if (!value) {
    triggerDisplay.innerHTML = `<span class="custom-select-placeholder">${state.lang === 'el' ? 'Επιλογή...' : 'Select...'}</span>`;
  } else {
    if (!state.accounts || state.accounts.length === 0) {
      state.accounts = (typeof DEFAULT_ACCOUNTS !== 'undefined' ? DEFAULT_ACCOUNTS : [
        { name: 'Cash', type: 'cash', balance: 0 },
        { name: 'Bank Account', type: 'bank', balance: 0 },
        { name: 'Card', type: 'card', balance: 0 }
      ]).slice();
    }
    const acc = state.accounts.find(a => a.name === value);
    const visual = acc ? getAccountVisualInfo(acc) : { iconClass: 'fa-solid fa-wallet', color: '#3b82f6' };
    const name = acc ? getAccountDisplayName(acc) : value;
    triggerDisplay.innerHTML = `<span class="custom-select-icon" style="margin-right: 8px; color: ${visual.color};"><i class="${visual.iconClass}"></i></span><span class="custom-select-text">${escapeHtml(name)}</span>`;
  }
}

function updateAccountDropdowns() {
  updateAccountTriggerDisplay('from');
  updateAccountTriggerDisplay('to');
}

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

window.getAccountDisplayName = getAccountDisplayName;
window.openAccountPickerModal = openAccountPickerModal;
window.updateAccountTriggerDisplay = updateAccountTriggerDisplay;
window.updateAccountDropdowns = updateAccountDropdowns;
window.openCurrencyPickerModal = openCurrencyPickerModal;
window.renderCurrencyPickerOptions = renderCurrencyPickerOptions;
window.selectCurrencyOption = selectCurrencyOption;
window.setTransactionCurrency = setTransactionCurrency;

function openSupabaseSettings() {
  updateSupabaseUserModal();
  openModal('supabase-modal');
}

// ============================================================
// ============================================================
// PREMIUM MODAL & PURCHASE FLOW
// Extracted to js/billingService.js (Phase 14A Architectural Extraction)
// ============================================================

// ============================================================
// ============================================================
// ADMIN DASHBOARD (owner-only usage & user overview)
// Extracted to js/adminDashboardService.js (Phase 14B Architectural Extraction)
// ============================================================

// Premium window bindings moved to js/billingService.js

// Floating toast for background sync feedback
let _syncToastTimer = null;
function showSyncToast(message, autoDismissMs = 0) {
  let toast = document.getElementById('sync-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sync-toast';
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 20px; z-index: 99999;
      background: var(--card-bg, #1e1e2e); color: var(--text-primary, #fff);
      border: 1px solid var(--accent, #7c6af7); border-radius: 14px;
      padding: 12px 18px; font-size: 13px; font-weight: 600;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      display: flex; align-items: center; gap: 10px;
      transform: translateY(80px); opacity: 0;
      transition: transform 0.3s cubic-bezier(.34,1.56,.64,1), opacity 0.3s ease;
      max-width: 280px;
    `;
    document.body.appendChild(toast);
  }
  // Animated pulse dot
  toast.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:var(--accent,#7c6af7);display:inline-block;animation:syncPulse 1s infinite;flex-shrink:0;"></span><span>${message}</span>`;
  // Inject keyframes if not already
  if (!document.getElementById('sync-toast-styles')) {
    const s = document.createElement('style');
    s.id = 'sync-toast-styles';
    s.textContent = `@keyframes syncPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.4)} }`;
    document.head.appendChild(s);
  }
  // Show
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });
  // Update header sync icon based on message type
  if (message.startsWith('✅')) {
    updateHeaderSyncIcon('synced');
    const dot = toast.querySelector('span');
    if (dot) dot.style.animation = 'none';
  } else if (message.startsWith('⚠️')) {
    updateHeaderSyncIcon('error');
    const dot = toast.querySelector('span');
    if (dot) dot.style.animation = 'none';
  } else if (message.startsWith('☁️')) {
    updateHeaderSyncIcon('syncing');
  }
  if (_syncToastTimer) clearTimeout(_syncToastTimer);
  if (autoDismissMs > 0) {
    _syncToastTimer = setTimeout(() => {
      toast.style.transform = 'translateY(80px)';
      toast.style.opacity = '0';
    }, autoDismissMs);
  }
}
function updateHeaderSyncIcon(state_) {
  state.syncStatus = state_;
  // state_: 'offline' | 'idle' | 'syncing' | 'synced' | 'success' | 'error'
  const dot = document.getElementById('header-sync-dot');
  const icon = document.getElementById('header-sync-cloud-icon');
  if (!dot || !icon) return;

  // Normalize state for visual elements and translations
  let normalized = state_;
  if (state_ === 'success') normalized = 'synced';
  if (state_ === 'idle') normalized = 'offline';

  const colors = {
    offline: '#9e9e9e',
    syncing: '#ffd600',
    synced: '#4caf50',
    error: '#ef5350'
  };
  dot.style.background = colors[normalized] || '#9e9e9e';

  // Animate dot on sync
  if (normalized === 'syncing') {
    dot.style.animation = 'syncDotPulse 0.8s infinite alternate';
  } else {
    dot.style.animation = 'none';
  }

  // Inject dot keyframes once
  if (!document.getElementById('sync-dot-styles')) {
    const s = document.createElement('style');
    s.id = 'sync-dot-styles';
    s.textContent = `@keyframes syncDotPulse{from{opacity:1;transform:scale(1)}to{opacity:.3;transform:scale(1.6)}}`;
    document.head.appendChild(s);
  }

  // Tooltip
  const btn = document.getElementById('header-sync-icon');
  const lang = state.lang || 'el';
  const labels = lang === 'en' ? {
    offline: 'Local Storage',
    syncing: 'Syncing...',
    synced: 'Synced ✅',
    error: 'Sync Error ⚠️'
  } : {
    offline: 'Τοπική αποθήκευση',
    syncing: 'Συγχρονισμός...',
    synced: 'Συγχρονισμένο ✅',
    error: 'Σφάλμα συγχρονισμού ⚠️'
  };
  if (btn) btn.title = labels[normalized] || (lang === 'en' ? 'Sync' : 'Συγχρονισμός');

  // Update sync status text in settings
  const syncStatusEl = document.getElementById('val_sync_status');
  if (syncStatusEl) {
    const statusLabels = lang === 'en' ? {
      offline: 'Local Storage',
      syncing: 'Syncing...',
      synced: 'Active',
      error: 'Error'
    } : {
      offline: 'Τοπική Αποθήκευση',
      syncing: 'Συγχρονισμός...',
      synced: 'Ενεργός',
      error: 'Σφάλμα'
    };
    syncStatusEl.textContent = statusLabels[normalized] || (lang === 'en' ? 'Local Storage' : 'Τοπική Αποθήκευση');

    // Update color based on status
    if (normalized === 'synced') {
      syncStatusEl.style.color = '#4caf50'; // Green for active
    } else if (normalized === 'error') {
      syncStatusEl.style.color = '#ef5350'; // Red for error
    } else {
      syncStatusEl.style.color = 'var(--text-secondary)';
    }
  }
}

function promiseTimeout(promise, ms) {
  let timeout = new Promise((resolve, reject) => {
    let id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error('Διακοπή λόγω καθυστέρησης (Timeout - Η υπηρεσία Cloud καθυστερεί να απαντήσει)'));
    }, ms);
  });
  return Promise.race([promise, timeout]);
}

// ============================================================
// UTILITIES
// ============================================================
function formatCurrency(val) {
  if (localStorage.getItem('settings_hide_amounts') === 'true') return '*** €';
  if (isNaN(val)) return '0,00';
  return parseFloat(val).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================================
// EXPORT & SHARE ENGINE (Excel, CSV, ODS, JSON, PDF)
// Extracted to js/exportService.js (Phase 3 Architectural Domain Extraction)
// ============================================================

// ============================================================
// FEATURE: TRANSACTION SEARCH AND FILTERS
// Extracted to js/searchFilterService.js (Phase 6 Architectural Domain Extraction)
// ============================================================

// ============================================================
// FEATURE: MONTH GRID PICKER MODAL
// Extracted to js/monthGridPicker.js (Phase 9A Architectural Domain Extraction)
// ============================================================

// Pull-to-Refresh extracted to js/gestureEngine.js (Phase 13C)

// ============================================================
// SELECTION MODE & BATCH ACTIONS
// Extracted to js/selectionService.js (Phase 14C Architectural Extraction)
// ============================================================

// Swipe-to-Back navigation extracted to js/gestureEngine.js (Phase 13C)


function updateSubcategorySuggestions() {
  const categoryHidden = document.getElementById('trans-category');
  const subcatList = document.getElementById('subcategory-picker-list');
  if (!categoryHidden || !subcatList) return;

  const category = categoryHidden.value;
  subcatList.innerHTML = '';

  const currentSubcategory = document.getElementById('trans-subcategory-select').value;

  if (!category) {
    subcatList.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">${(TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['select_category_first']) || 'Επιλέξτε πρώτα κατηγορία'}</div>`;
    return;
  }

  const sortedSubs = getSortedSubcategoriesForCategory(category);

  // Add "No subcategory" option at the top
  const noneOpt = document.createElement('div');
  noneOpt.className = 'subcategory-item none-subcat';
  if (currentSubcategory === '') noneOpt.classList.add('selected');
  noneOpt.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-ban" style="color:var(--text-muted);font-size:12px;"></i> <span style="font-weight: 500; color: var(--text-secondary);">${state.lang === 'en' ? 'No subcategory' : 'Χωρίς υποκατηγορία'}</span></div>`;
  noneOpt.onclick = () => selectSubcategory('');
  subcatList.appendChild(noneOpt);

  sortedSubs.forEach(sub => {
    const div = document.createElement('div');
    div.className = 'subcategory-item';
    div.setAttribute('data-subcat-name', sub);
    if (sub === currentSubcategory) div.classList.add('selected');
    div.innerHTML = `<span>${getSubcategoryDisplayName(sub, category)}</span>`;
    div.onclick = () => selectSubcategory(sub);
    subcatList.appendChild(div);
  });

  const newOpt = document.createElement('div');
  newOpt.className = 'subcategory-item new-subcat';
  newOpt.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-plus"></i> <span>${TRANSLATIONS[state.lang]['option_new_subcategory'] || 'Νέα υποκατηγορία...'}</span></div>`;
  newOpt.onclick = () => {
    closeModal('subcategory-picker-modal');
    showSubcategorySelect();
  };
  subcatList.appendChild(newOpt);

  if (window.Sortable) {
    if (subcatList._sortable) { subcatList._sortable.destroy(); }
    subcatList._sortable = Sortable.create(subcatList, {
      animation: 150, delay: 250, delayOnTouchOnly: true, filter: '.none-subcat, .new-subcat',
      onEnd: function (evt) {
        const newOrder = Array.from(subcatList.children).map(el => el.getAttribute('data-subcat-name')).filter(Boolean);
        setCustomSubcategoryOrder(category, newOrder);
      }
    });
  }
}

function showSubcategorySelect() {
  const trigger = document.getElementById('trans-subcategory-trigger');
  const custom = document.getElementById('trans-subcategory-custom');
  const cancelBtn = document.getElementById('btn-cancel-custom-sub');

  if (trigger && custom && cancelBtn) {
    trigger.style.display = 'none';
    custom.style.display = 'block';
    cancelBtn.style.display = 'block';
    document.getElementById('trans-subcategory-select').value = '__NEW__';
    updateSubcategoryRowVisibility();
    custom.focus();
  }
}

function hideSubcategorySelect() {
  const trigger = document.getElementById('trans-subcategory-trigger');
  const custom = document.getElementById('trans-subcategory-custom');
  const cancelBtn = document.getElementById('btn-cancel-custom-sub');

  if (trigger && custom && cancelBtn) {
    trigger.style.display = 'flex';
    custom.style.display = 'none';
    cancelBtn.style.display = 'none';

    // Clear input
    custom.value = '';
    document.getElementById('trans-subcategory-select').value = '';
    document.getElementById('trans-subcategory-display').innerHTML = `<span class="custom-select-placeholder" data-i18n="placeholder_subcategory">Πατήστε για επιλογή</span>`;
    updateSubcategoryRowVisibility();
  }
}

// Bind to window
window.showSubcategorySelect = showSubcategorySelect;
window.hideSubcategorySelect = hideSubcategorySelect;

window._categoryManagerType = 'expense';
window._categoryManagerSelectedEmoji = '💸';
window._editingCategoryManagerName = null;

// ============================================================
// SUBCATEGORY MANAGER LOGIC (INLINE EDIT, MERGE, SORT, UNDO)
// Extracted to js/subcategoryManager.js (Phase 15A Architectural Extraction)
// ============================================================
// ============================================================
// CATEGORY & SUBCATEGORY SETTINGS MANAGER
// Extracted to js/categoryManager.js (Phase 11D Architectural Extraction)
// ============================================================


// ============================================================
// NOTES & REMINDERS/CHECKLISTS LOGIC
// Extracted to js/notesService.js (Phase 8A Architectural Domain Extraction)
// ============================================================


function initTabSwipeNavigation() {
  const appContent = document.querySelector('.app-content');
  if (!appContent) return;

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let lastMoveX = 0;
  let lastMoveTime = 0;
  let velocity = 0;
  let touchActive = false;
  let isSwipingHorizontal = null;

  const edgeThreshold = 40; // Avoid edge gesture conflicts with system back gesture
  const triggerThreshold = 18; // Instant 18px threshold
  const flingVelocity = 0.22; // Very responsive flick velocity

  appContent.addEventListener('touchstart', (e) => {
    const activeModals = document.querySelectorAll('.modal-overlay.active, .tx-modal-overlay.active');
    const searchOverlay = document.getElementById('search-overlay');
    const isSearchActive = searchOverlay && searchOverlay.classList.contains('active');
    if (state.isSwipingMonth && (Date.now() - (state.lastSwipeTime || 0) > 350)) {
      state.isSwipingMonth = false;
      document.body.classList.remove('is-swiping-month');
    }
    if (activeModals.length > 0 || isSearchActive || state.selectionMode || state.isSwipingMonth) {
      touchActive = false;
      return;
    }

    if (e.target.closest('.category-quick-filters, .quick-filter-chips, .filters-panel-header, #statsChart, canvas, .stats-subcategories-container')) {
      touchActive = false;
      return;
    }

    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    lastMoveX = startX;
    lastMoveTime = Date.now();
    velocity = 0;
    startTime = lastMoveTime;

    if (startX <= edgeThreshold || startX >= window.innerWidth - edgeThreshold) {
      touchActive = false;
      return;
    }

    touchActive = true;
    isSwipingHorizontal = null;
  }, { passive: true });

  appContent.addEventListener('touchmove', (e) => {
    if (!touchActive || state.isSwipingMonth) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (isSwipingHorizontal === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        if (Math.abs(deltaX) > Math.abs(deltaY) * 0.7) {
          if (state.activeTab === 'trans' || state.activeTab === 'stats') {
            isSwipingHorizontal = true;
            state.touchDidMove = true;
          } else {
            isSwipingHorizontal = false;
            touchActive = false;
          }
        } else {
          isSwipingHorizontal = false;
        }
      }
    }

    if (isSwipingHorizontal === true) {
      if (e.cancelable) e.preventDefault();
      const now = Date.now();
      const dt = now - lastMoveTime;
      if (dt > 0) {
        velocity = (touch.clientX - lastMoveX) / dt;
      }
      lastMoveX = touch.clientX;
      lastMoveTime = now;
    }
  }, { passive: false });

  appContent.addEventListener('touchend', (e) => {
    if (!touchActive) return;
    touchActive = false;

    if (isSwipingHorizontal === true && !state.isSwipingMonth) {
      if (e.cancelable) e.preventDefault();
      state.lastSwipeTime = Date.now();
      const touch = e.changedTouches[0] || e.touches[0];
      const deltaX = touch.clientX - startX;
      const absDelta = Math.abs(deltaX);
      const absVelocity = Math.abs(velocity);

      const shouldTrigger = absDelta >= triggerThreshold || absVelocity >= flingVelocity;

      if (shouldTrigger) {
        const direction = deltaX < 0 ? 1 : -1; // 1 = next month, -1 = prev month
        if (state.activeTab === 'trans') {
          navigateMonth(direction);
        } else if (state.activeTab === 'stats') {
          adjustStatsPeriod(direction, 0);
        }
      }
    }

    isSwipingHorizontal = null;
    setTimeout(() => { state.touchDidMove = false; }, 200);
  }, { passive: false });

  appContent.addEventListener('touchcancel', () => {
    touchActive = false;
    isSwipingHorizontal = null;
    setTimeout(() => { state.touchDidMove = false; }, 100);
  }, { passive: true });
}

// Lightweight render for swipe navigation — only updates list + header, skips dropdowns/currency/etc.
function renderTransactionsForSwipe() {
  // Regenerate recurring occurrences for the newly-selected month BEFORE rendering the list.
  // Without this, a recurring the user added only shows up after a full app refresh (and the
  // new month's occurrence would stay missing until refresh every single month). This is the
  // exact call the older builds made here; it was dropped during a later render-refactor.
  processRecurringTemplates();
  updateHeaderAndSync();
  renderTransactionsTab();
  lastRenderedCategoryType = null;
}

// High-performance ultra-snappy GPU transition for month navigation (used by both swipe gestures & chevron buttons)
function animateSwipeTransition(direction, callback) {
  const listEl = state.activeTab === 'trans'
    ? document.getElementById('transactions-list')
    : state.activeTab === 'stats'
      ? document.getElementById('stats-breakdown-list')
      : null;

  state.isSwipingMonth = true;
  document.body.classList.add('is-swiping-month');

  const cleanup = () => {
    state.isSwipingMonth = false;
    state.touchDidMove = false;
    state.lastSwipeTime = Date.now();
    document.body.classList.remove('is-swiping-month');
  };

  // Safety watchdog: ensure swipe lock is always cleared within 300ms even if an error occurs
  const watchdogTimer = setTimeout(cleanup, 300);

  // Immediately execute the state change & render (0ms pre-delay)
  try {
    callback();
  } catch (err) {
    console.error('[animateSwipeTransition] callback failed:', err);
    clearTimeout(watchdogTimer);
    cleanup();
    return;
  }

  const currentListEl = state.activeTab === 'trans'
    ? document.getElementById('transactions-list')
    : document.getElementById('stats-breakdown-list');

  if (!currentListEl) {
    clearTimeout(watchdogTimer);
    cleanup();
    return;
  }

  // Crisp micro-offset on the incoming side
  const inX = direction > 0 ? 36 : -36;

  currentListEl.style.transition = 'none';
  currentListEl.style.transform = `translateX(${inX}px)`;
  currentListEl.style.opacity = '0.75';

  // Instant snap into place (60ms GPU transition)
  requestAnimationFrame(() => {
    currentListEl.style.transition = 'transform 65ms cubic-bezier(0.1, 0.9, 0.2, 1), opacity 65ms ease';
    currentListEl.style.transform = 'translateX(0)';
    currentListEl.style.opacity = '1';

    setTimeout(() => {
      clearTimeout(watchdogTimer);
      currentListEl.style.transition = '';
      currentListEl.style.transform = '';
      currentListEl.style.opacity = '';

      cleanup();

      if (state.activeTab === 'stats') {
        renderStatsTab(false);
      }
    }, 70);
  });
}

// Navigate to an adjacent month (used by the period-prev/next chevron buttons).
function navigateMonth(direction, startingDeltaX = 0) {
  animateSwipeTransition(direction, () => {
    state.selectedMonth += direction;
    if (state.selectedMonth < 0) {
      state.selectedMonth = 11;
      state.selectedYear--;
    } else if (state.selectedMonth > 11) {
      state.selectedMonth = 0;
      state.selectedYear++;
    }
    syncStatsDate();
    renderTransactionsForSwipe();
    setTimeout(() => scrollToToday('auto'), 50);
  }, startingDeltaX);
}

function initRippleEffects() {
  // Pure hardware-accelerated CSS-driven tap feedback for 0ms lag and smooth 60/120 FPS
}

// Lightbox Pinch Zoom extracted to js/gestureEngine.js (Phase 13C)

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

// Bind to window for HTML event accessibility
window.changeMonthStartSetting = changeMonthStartSetting;
window.changeWeekStartSetting = changeWeekStartSetting;
window.changeCurrencySetting = changeCurrencySetting;
window.getCurrencySymbol = getCurrencySymbol;
window.initSettingsFromStorage = initSettingsFromStorage;
window.openSettingsPicker = openSettingsPicker;
window.updateSettingsDisplay = updateSettingsDisplay;
window.applyFontSize = applyFontSize;
window.changeFontSizeSetting = changeFontSizeSetting;

// ============================================================
// THEME & APPEARANCE ENGINE
// Extracted to js/themeEngine.js (Phase 16A Architectural Extraction)
// ============================================================
function applyTheme(theme) { return ThemeEngine.applyTheme(theme); }
function getThemeBgColor(theme) { return ThemeEngine.getThemeBgColor(theme); }
function changeThemeSetting(theme) { return ThemeEngine.changeThemeSetting(theme); }
function applyFontSize(size) { return ThemeEngine.applyFontSize(size); }
function changeFontSizeSetting(size) { return ThemeEngine.changeFontSizeSetting(size); }

// ============================================================
// SECURITY PIN & APP LOCK SERVICE
// Extracted to js/securityPinService.js (Phase 16B Architectural Extraction)
// ============================================================
function showLockScreen() { return SecurityPinService.showLockScreen(); }
function hideLockScreen() { return SecurityPinService.hideLockScreen(); }
function resetLockDots() { return SecurityPinService.resetLockDots(); }
function pressKey(key) { return SecurityPinService.pressKey(key); }
function pressBackspace() { return SecurityPinService.pressBackspace(); }
function verifyEnteredPin() { return SecurityPinService.verifyEnteredPin(); }
function checkBiometricsSupport() { return SecurityPinService.checkBiometricsSupport(); }
function authenticateBiometricsNativeOrWeb() { return SecurityPinService.authenticateBiometricsNativeOrWeb(); }
function verifyWebAuthnBiometrics() { return SecurityPinService.verifyWebAuthnBiometrics(); }
function triggerBiometricAuth() { return SecurityPinService.triggerBiometricAuth(); }
function openPinModal() { return SecurityPinService.openPinModal(); }
function closePinModal() { return SecurityPinService.closePinModal(); }
function submitPinSetup() { return SecurityPinService.submitPinSetup(); }
function openPinVerifyModal() { return SecurityPinService.openPinVerifyModal(); }
function closePinVerifyModal() { return SecurityPinService.closePinVerifyModal(); }
function submitPinVerification() { return SecurityPinService.submitPinVerification(); }
function toggleAppLock(e) { return SecurityPinService.toggleAppLock(e); }
function openBiometricsPinModal() { return SecurityPinService.openBiometricsPinModal(); }
function closeBiometricsPinModal() { return SecurityPinService.closeBiometricsPinModal(); }
function proceedToPinSetup() { return SecurityPinService.proceedToPinSetup(); }
function getSecurityPlugin() { return SecurityPinService.getSecurityPlugin(); }
function getPrivacyScreenPlugin() { return SecurityPinService.getPrivacyScreenPlugin(); }
function applyNativeSecureMode() { return SecurityPinService.applyNativeSecureMode(); }
function toggleHideAmountsSetting(e) { return SecurityPinService.toggleHideAmountsSetting(e); }
function toggleScreenshotBlockSetting(e) { return SecurityPinService.toggleScreenshotBlockSetting(e); }
function toggleBiometrics(e) { return SecurityPinService.toggleBiometrics(e); }

// ============================================================
// AUTHENTICATION & PARTNER LINKING CONTROLLERS
// ============================================================

let currentAuthTab = 'password';
let currentAuthMode = 'login'; // 'login' or 'signup'

function switchAuthTab(tab) {
  currentAuthTab = tab;

  // Update tabs active state
  document.getElementById('tab-btn-password').classList.toggle('active', tab === 'password');
  document.getElementById('tab-btn-magic').classList.toggle('active', tab === 'magic');
  document.getElementById('tab-btn-google').classList.toggle('active', tab === 'google');

  // Show active form
  document.getElementById('auth-password-form').style.display = tab === 'password' ? 'flex' : 'none';
  document.getElementById('auth-magic-form').style.display = tab === 'magic' ? 'flex' : 'none';
  document.getElementById('auth-google-form').style.display = tab === 'google' ? 'block' : 'none';

  // Clear status messages
  clearAuthStatus();
}

function togglePasswordVisibility(inputId, btnEl) {
  const targetId = inputId || 'auth-password';
  const passwordInput = document.getElementById(targetId);
  if (!passwordInput) return;

  const icon = btnEl ? btnEl.querySelector('i') : document.getElementById('toggle-password-icon');

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    if (icon) {
      icon.className = 'fa-solid fa-eye-slash';
    }
  } else {
    passwordInput.type = 'password';
    if (icon) {
      icon.className = 'fa-regular fa-eye';
    }
  }
}

function openForgotPasswordModal() {
  const modal = document.getElementById('forgot-password-modal');
  const emailInput = document.getElementById('auth-email');
  const modalEmailInput = document.getElementById('forgot-modal-email');
  const statusBox = document.getElementById('forgot-modal-status');

  if (statusBox) statusBox.style.display = 'none';

  if (modalEmailInput) {
    modalEmailInput.value = emailInput && emailInput.value ? emailInput.value.trim() : '';
  }

  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
    modal.classList.add('show');
    setTimeout(() => {
      if (modalEmailInput) modalEmailInput.focus();
    }, 150);
  }
}

function closeForgotPasswordModal() {
  const modal = document.getElementById('forgot-password-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
    modal.classList.remove('show');
  }
}

function handleForgotPasswordOverlayClick(e) {
  if (e.target && e.target.id === 'forgot-password-modal') {
    closeForgotPasswordModal();
  }
}

async function submitForgotPasswordModal(e) {
  if (e) e.preventDefault();
  if (!state.supabaseClient) {
    window.showAlert('Supabase is not initialized.');
    return;
  }

  const emailInput = document.getElementById('forgot-modal-email');
  const email = emailInput ? emailInput.value.trim() : '';
  const statusBox = document.getElementById('forgot-modal-status');
  const submitBtn = document.getElementById('forgot-modal-submit-btn');

  if (!email) {
    if (statusBox) {
      statusBox.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_email_label']) + ': ' + 'Παρακαλώ εισάγετε email.';
      statusBox.className = 'auth-status-box';
      statusBox.style.display = 'block';
    }
    return;
  }

  const originalHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['forgot_password_modal_sending']) || 'Αποστολή...';
  }
  if (statusBox) statusBox.style.display = 'none';

  try {
    const { error } = await state.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (error) throw error;

    if (statusBox) {
      statusBox.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['forgot_password_modal_success']) || '✅ Στάλθηκε σύνδεσμος επαναφοράς κωδικού! Ελέγξτε τα εισερχόμενά σας (και τα Ανεπιθύμητα).';
      statusBox.className = 'auth-status-box success';
      statusBox.style.display = 'block';
    }

    setTimeout(() => {
      closeForgotPasswordModal();
      showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['forgot_password_modal_success']) || '✅ Στάλθηκε σύνδεσμος επαναφοράς κωδικού στα εισερχόμενά σας!', 'success');
    }, 2500);
  } catch (err) {
    console.error('Reset password error:', err);
    if (statusBox) {
      statusBox.textContent = ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_prefix']) || '❌ Σφάλμα: ') + formatAuthErrorMessage(err);
      statusBox.className = 'auth-status-box';
      statusBox.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  }
}

function handleForgotPassword() {
  openForgotPasswordModal();
}

// ============================================================
// CHANGE EMAIL & PASSWORD HANDLERS
// ============================================================
function openChangeEmailModal() {
  if (!state.currentUser || state.currentUser.id === 'offline-user' || !state.supabaseClient) {
    const msg = state.lang === 'el'
      ? 'Η λειτουργία αυτή απαιτεί σύνδεση σε λογαριασμό Cloud.'
      : 'This feature requires a signed-in Cloud account.';
    if (typeof showToast === 'function') showToast(msg, 'warning');
    else window.showAlert(msg);
    return;
  }

  const currentEmail = state.currentUser.email || '';
  const currentValEl = document.getElementById('change-email-current-val');
  const inputEl = document.getElementById('change-email-new-input');

  if (currentValEl) currentValEl.textContent = currentEmail;
  if (inputEl) {
    inputEl.value = '';
    setTimeout(() => inputEl.focus(), 150);
  }

  openModal('change-email-modal');
}

async function handleUserEmailChange(event) {
  if (event) event.preventDefault();

  if (!state.currentUser || !state.supabaseClient) {
    const msg = state.lang === 'el' ? 'Απαιτείται ενεργή σύνδεση.' : 'Active session required.';
    if (typeof showToast === 'function') showToast(msg, 'warning');
    return;
  }

  const inputEl = document.getElementById('change-email-new-input');
  const newEmail = (inputEl?.value || '').trim();

  if (!newEmail || !newEmail.includes('@') || !newEmail.includes('.')) {
    const msg = state.lang === 'el' ? 'Παρακαλώ εισάγετε ένα έγκυρο email.' : 'Please enter a valid email address.';
    window.showAlert(msg);
    return;
  }

  const currentEmail = (state.currentUser.email || '').trim().toLowerCase();
  if (newEmail.toLowerCase() === currentEmail) {
    const msg = state.lang === 'el' ? 'Το νέο email είναι ίδιο με το τρέχον.' : 'The new email is identical to your current one.';
    window.showAlert(msg);
    return;
  }

  const submitBtn = document.getElementById('btn-submit-change-email');
  const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (state.lang === 'el' ? 'Αποστολή...' : 'Sending...');
  }

  try {
    const { data, error } = await state.supabaseClient.auth.updateUser({
      email: newEmail
    });

    if (error) throw error;

    closeModal('change-email-modal');

    const successMsg = state.lang === 'el'
      ? `📩 Στάλθηκε σύνδεσμος επιβεβαίωσης στο ${newEmail}. Παρακαλώ επιβεβαιώστε το email σας για να ολοκληρωθεί η αλλαγή.`
      : `📩 A confirmation link was sent to ${newEmail}. Please confirm it to complete the update.`;

    if (typeof showToast === 'function') {
      showToast(successMsg, 'success');
    }
    window.showAlert(successMsg);
  } catch (err) {
    console.error('Email update error:', err);
    const errMsg = (state.lang === 'el' ? 'Σφάλμα αλλαγής email: ' : 'Email update error: ') + (err.message || err);
    window.showAlert(errMsg);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml;
    }
  }
}

function openChangePasswordModal() {
  if (!state.currentUser || state.currentUser.id === 'offline-user' || !state.supabaseClient) {
    const msg = state.lang === 'el'
      ? 'Η λειτουργία αυτή απαιτεί σύνδεση σε λογαριασμό Cloud.'
      : 'This feature requires a signed-in Cloud account.';
    if (typeof showToast === 'function') showToast(msg, 'warning');
    else window.showAlert(msg);
    return;
  }

  const newPwdInput = document.getElementById('change-pwd-new-input');
  const confirmPwdInput = document.getElementById('change-pwd-confirm-input');

  if (newPwdInput) newPwdInput.value = '';
  if (confirmPwdInput) confirmPwdInput.value = '';

  openModal('change-password-modal');
  setTimeout(() => {
    if (newPwdInput) newPwdInput.focus();
  }, 150);
}

async function handleUserPasswordChange(event) {
  if (event) event.preventDefault();

  if (!state.currentUser || !state.supabaseClient) {
    const msg = state.lang === 'el' ? 'Απαιτείται ενεργή σύνδεση.' : 'Active session required.';
    if (typeof showToast === 'function') showToast(msg, 'warning');
    return;
  }

  const newPwdInput = document.getElementById('change-pwd-new-input');
  const confirmPwdInput = document.getElementById('change-pwd-confirm-input');
  const newPwd = (newPwdInput?.value || '').trim();
  const confirmPwd = (confirmPwdInput?.value || '').trim();

  if (newPwd.length < 6) {
    const msg = state.lang === 'el' ? 'Ο κωδικός πρέπει να περιέχει τουλάχιστον 6 χαρακτήρες.' : 'Password must be at least 6 characters long.';
    window.showAlert(msg);
    if (newPwdInput) newPwdInput.focus();
    return;
  }

  if (newPwd !== confirmPwd) {
    const msg = state.lang === 'el' ? 'Οι κωδικοί δεν ταιριάζουν. Παρακαλώ ελέγξτε ξανά.' : 'Passwords do not match. Please verify and try again.';
    window.showAlert(msg);
    if (confirmPwdInput) confirmPwdInput.focus();
    return;
  }

  const submitBtn = document.getElementById('btn-submit-change-pwd');
  const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (state.lang === 'el' ? 'Ενημέρωση...' : 'Updating...');
  }

  try {
    const { data, error } = await state.supabaseClient.auth.updateUser({
      password: newPwd
    });

    if (error) throw error;

    closeModal('change-password-modal');

    const successMsg = state.lang === 'el'
      ? '🔒 Ο κωδικός πρόσβασης άλλαξε με επιτυχία!'
      : '🔒 Password updated successfully!';

    if (typeof showToast === 'function') {
      showToast(successMsg, 'success');
    } else {
      window.showAlert(successMsg);
    }
  } catch (err) {
    console.error('Password update error:', err);
    const errMsg = (state.lang === 'el' ? 'Σφάλμα αλλαγής κωδικού: ' : 'Password update error: ') + (err.message || err);
    window.showAlert(errMsg);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml;
    }
  }
}

window.togglePasswordVisibility = togglePasswordVisibility;
window.handleForgotPassword = handleForgotPassword;
window.openForgotPasswordModal = openForgotPasswordModal;
window.closeForgotPasswordModal = closeForgotPasswordModal;
window.handleForgotPasswordOverlayClick = handleForgotPasswordOverlayClick;
window.submitForgotPasswordModal = submitForgotPasswordModal;
window.openChangeEmailModal = openChangeEmailModal;
window.handleUserEmailChange = handleUserEmailChange;
window.openChangePasswordModal = openChangePasswordModal;
window.handleUserPasswordChange = handleUserPasswordChange;

function setAuthMode(mode) {
  currentAuthMode = mode;
  document.getElementById('btn-auth-mode-login').classList.toggle('active', mode === 'login');
  document.getElementById('btn-auth-mode-signup').classList.toggle('active', mode === 'signup');

  const submitBtn = document.getElementById('auth-password-submit-btn');
  const lang = state.lang || 'el';

  const emailInput = document.getElementById('auth-email');
  const pwdInput = document.getElementById('auth-password');
  if (emailInput) emailInput.value = '';
  if (pwdInput) pwdInput.value = '';

  const forgotContainer = document.getElementById('forgot-password-container');
  if (forgotContainer) {
    forgotContainer.style.display = mode === 'login' ? 'flex' : 'none';
  }

  if (mode === 'login') {
    submitBtn.textContent = TRANSLATIONS[lang]['auth_submit_login'];
    document.getElementById('auth-subtitle').textContent = TRANSLATIONS[lang]['auth_welcome'];
  } else {
    submitBtn.textContent = TRANSLATIONS[lang]['auth_submit_signup'];
    document.getElementById('auth-subtitle').textContent = TRANSLATIONS[lang]['auth_create_account'];
  }
  clearAuthStatus();
  if (emailInput) {
    setTimeout(() => emailInput.focus(), 60);
  }
}

function formatAuthErrorMessage(err) {
  if (!err) return (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_fail_auth']) || 'Αποτυχία ταυτοποίησης.';
  const msg = typeof err === 'string' ? err : (err.message || err.error_description || err.msg || (err.error && (typeof err.error === 'string' ? err.error : err.error.message)) || '');
  const lower = String(msg).toLowerCase();
  if (lower.includes('rate limit') || lower.includes('over_email_send_rate_limit')) {
    return state.lang === 'el'
      ? 'Υπέρβαση ορίου αποστολής email. Παρακαλούμε περιμένετε 60 δευτερόλεπτα ή συνδεθείτε άμεσα με Κωδικό ή Google.'
      : 'Email rate limit reached. Please wait 60 seconds or sign in directly with Password or Google.';
  }
  if (msg && msg !== '{}' && String(msg).trim() !== '') return msg;
  return (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_fail_auth']) || 'Αποτυχία ταυτοποίησης.';
}

function showAuthStatus(msg, type = 'error') {
  const box = document.getElementById('auth-status-message');
  if (!box) return;
  box.textContent = msg;
  box.className = type === 'success' ? 'auth-status-box success' : 'auth-status-box';
  box.style.display = 'block';
}

function clearAuthStatus() {
  const box = document.getElementById('auth-status-message');
  if (box) box.style.display = 'none';
}

async function handlePasswordAuth(e) {
  e.preventDefault();
  if (!state.supabaseClient) {
    window.showAlert('Supabase is not initialized.');
    return;
  }

  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  const submitBtn = document.getElementById('auth-password-submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_please_wait']) || 'Παρακαλώ περιμένετε...';
  clearAuthStatus();

  try {
    if (currentAuthMode === 'login') {
      const { data, error } = await state.supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      if (data && data.session && data.session.user) {
        state.currentUser = data.session.user;
        localStorage.setItem('cached_current_user', JSON.stringify(data.session.user));
        hideAuthOverlay();
        forceSyncNow(true).catch(console.error);
      }
    } else {
      let signedUp = false;
      try {
        const signupRes = await fetch(getBackendApiUrl('/api/auth-signup'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, lang: state.lang })
        });
        const signupData = await signupRes.json().catch(() => ({}));
        if (signupRes.ok && signupData.success) {
          signedUp = true;
          // Auto login immediately
          const { data: loginData, error: loginErr } = await state.supabaseClient.auth.signInWithPassword({
            email,
            password
          });
          if (loginErr) throw loginErr;
          if (loginData && loginData.session && loginData.session.user) {
            state.currentUser = loginData.session.user;
            localStorage.setItem('cached_current_user', JSON.stringify(loginData.session.user));
            hideAuthOverlay();
            forceSyncNow(true).catch(console.error);
            showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_signup_instant_success']) || '🎉 Ο λογαριασμός δημιουργήθηκε και συνδεθήκατε επιτυχώς!', 'success');
            return;
          }
        } else if (signupData?.error) {
          const errMsg = (signupData.error || '').toLowerCase();
          if (errMsg.includes('already registered') || errMsg.includes('already exists') || signupRes.status === 422) {
            showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_email_already_exists']) || '⚠️ Αυτό το email είναι ήδη εγγεγραμμένο. Παρακαλούμε συνδεθείτε με τον κωδικό σας ή πατήστε «Ξεχάσατε τον κωδικό σας;».', 'error');
            setAuthMode('login');
            return;
          }
        }
      } catch (srvErr) {
        console.warn('Backend signup failed, falling back to standard signup:', srvErr);
      }

      if (!signedUp) {
        const redirectUrl = window.location.origin + window.location.pathname;
        const { data, error } = await state.supabaseClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              lang: state.lang
            }
          }
        });

        if (error) {
          const errMsg = (error.message || '').toLowerCase();
          if (errMsg.includes('already registered') || errMsg.includes('already exists') || error.status === 422) {
            showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_email_already_exists']) || '⚠️ Αυτό το email είναι ήδη εγγεγραμμένο. Παρακαλούμε συνδεθείτε με τον κωδικό σας ή πατήστε «Ξεχάσατε τον κωδικό σας;».', 'error');
            setAuthMode('login');
            return;
          }
          throw error;
        }

        // Check if user already exists (Supabase returns user object with identities: [] when email already exists)
        const isExistingUser = data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
        if (isExistingUser) {
          showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_email_already_exists']) || '⚠️ Αυτό το email είναι ήδη εγγεγραμμένο. Παρακαλούμε συνδεθείτε με τον κωδικό σας ή πατήστε «Ξεχάσατε τον κωδικό σας;».', 'error');
          setAuthMode('login');
          return;
        }

        // If user is logged in immediately (email confirmation is off in Supabase)
        if (data && data.session) {
          showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_signup_instant_success']) || '🎉 Ο λογαριασμός δημιουργήθηκε και συνδεθήκατε επιτυχώς!', 'success');
          return;
        }

        // If user is created but awaiting confirmation
        if (data && data.user) {
          showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_signup_success']) || '🎉 Η εγγραφή ολοκληρώθηκε! Ελέγξτε τα εισερχόμενά σας (και τα Ανεπιθύμητα/Spam) για το σύνδεσμο επιβεβαίωσης.', 'success');
        }
      }
    }
  } catch (err) {
    console.error('Password auth failed:', err);
    showAuthStatus(((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_prefix']) || '❌ Σφάλμα: ') + formatAuthErrorMessage(err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function handleMagicAuth(e) {
  e.preventDefault();
  if (!state.supabaseClient) return;

  const email = document.getElementById('auth-magic-email').value.trim();
  const submitBtn = document.getElementById('auth-magic-submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_sending']) || 'Αποστολή...';
  clearAuthStatus();

  try {
    const { error } = await state.supabaseClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) throw error;
    showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_magic_sent']) || '📩 Ο σύνδεσμος σύνδεσης στάλθηκε! Ελέγξτε τα εισερχόμενά σας (και τα Ανεπιθύμητα).', 'success');
  } catch (err) {
    console.error('Magic link failed:', err);
    showAuthStatus(((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_prefix']) || '❌ Σφάλμα: ') + formatAuthErrorMessage(err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function handleGoogleAuth() {
  if (!state.supabaseClient) return;
  clearAuthStatus();

  const googleBtn = document.getElementById('auth-google-submit-btn');
  const origGoogleBtnHtml = googleBtn ? googleBtn.innerHTML : '';
  if (googleBtn) {
    googleBtn.disabled = true;
    googleBtn.innerHTML = `<i class="fa-brands fa-google google-icon"></i> <span>${state.lang === 'el' ? 'Σύνδεση σε εξέλιξη...' : 'Signing in...'}</span>`;
  }

  const clientId = '331220079759-nrguc2ujof9u9mqhbn2mouhpga2iniqj.apps.googleusercontent.com';
  const isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const GoogleAuth = window.Capacitor?.Plugins?.GoogleAuth;

  // 1. Pure Native Android Google Sign-In (Zero Browser, Instant One-Tap, No screen dimming)
  if (isCapacitor && GoogleAuth) {
    try {
      if (!window._googleAuthInitialized) {
        try {
          await GoogleAuth.initialize({
            clientId: clientId,
            serverClientId: clientId,
            scopes: ['profile', 'email'],
            grantOfflineAccess: false,
          });
          window._googleAuthInitialized = true;
        } catch (initErr) {
          console.warn('[GoogleAuth] Native initialize warning:', initErr);
        }
      }

      // Force the native Google account chooser EVERY time the user taps
      // "Sign in with Google". signOut() clears the last-signed-in account;
      // without it, Google silently re-selects the previous account and the
      // user can never switch between multiple Google accounts.
      try {
        await GoogleAuth.signOut();
      } catch (signOutErr) {
        console.warn('[GoogleAuth] best-effort signOut before signIn:', signOutErr);
      }

      const googleUser = await GoogleAuth.signIn();
      const idToken = googleUser?.authentication?.idToken || googleUser?.idToken;

      if (!idToken) {
        throw new Error('Google did not return an ID token.');
      }

      // Authenticate directly with Supabase using the native Google ID token
      const { data, error } = await state.supabaseClient.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;
      if (data && data.session && data.session.user) {
        state.currentUser = data.session.user;
        localStorage.setItem('cached_current_user', JSON.stringify(data.session.user));

        // Load user-scoped notes and chat history for the new account
        loadNotes();

        // INSTANT ENTRY: Dismiss login screen immediately for zero perceived latency
        hideAuthOverlay();
        if (googleBtn) {
          googleBtn.disabled = false;
          googleBtn.innerHTML = origGoogleBtnHtml;
        }
        if (typeof updateUI === 'function') updateUI();
        if (typeof updateHeaderProfileBadge === 'function') updateHeaderProfileBadge();
        if (typeof renderNotesList === 'function') renderNotesList();

        // Background sync so user isn't kept waiting at the login screen
        forceSyncNow(true).catch(e => console.warn('Background post-login sync warning:', e));
      } else {
        if (googleBtn) {
          googleBtn.disabled = false;
          googleBtn.innerHTML = origGoogleBtnHtml;
        }
      }
      return;
    } catch (err) {
      if (googleBtn) {
        googleBtn.disabled = false;
        googleBtn.innerHTML = origGoogleBtnHtml;
      }
      const errMsg = (err?.message || '').toLowerCase();
      // If user explicitly dismissed or canceled the native picker, exit cleanly
      if (
        errMsg.includes('cancel') ||
        errMsg.includes('canceled') ||
        errMsg.includes('cancelled') ||
        errMsg.includes('closed') ||
        errMsg.includes('dismiss') ||
        errMsg.includes('12501') ||
        errMsg.includes('abort')
      ) {
        console.log('[GoogleAuth] User dismissed native prompt.');
        return;
      }
      console.error('[GoogleAuth] Native auth failed:', err);
      showAuthStatus(((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_prefix']) || '❌ Σφάλμα: ') + formatAuthErrorMessage(err));
      return;
    }
  }

  // 2. Web/PWA redirect flow (Only for Desktop / Mobile Web browsers)
  try {
    toggleLoader(true);
    const redirectToUrl = window.location.origin + (window.location.pathname || '/');
    const { error } = await state.supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectToUrl,
        queryParams: { prompt: 'select_account' }
      }
    });
    if (error) throw error;
  } catch (err) {
    toggleLoader(false);
    if (googleBtn) {
      googleBtn.disabled = false;
      googleBtn.innerHTML = origGoogleBtnHtml;
    }
    const errMsg = (err?.message || '').toLowerCase();
    if (
      errMsg.includes('cancel') ||
      errMsg.includes('canceled') ||
      errMsg.includes('cancelled') ||
      errMsg.includes('closed') ||
      errMsg.includes('dismiss') ||
      errMsg.includes('12501') ||
      errMsg.includes('abort')
    ) {
      console.log('[GoogleAuth] User dismissed prompt.');
      return;
    }
    console.error('Google auth flow failed:', err);
    showAuthStatus(((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_prefix']) || '❌ Σφάλμα: ') + formatAuthErrorMessage(err));
  }
}

async function handleLogout() {
  const confirmed = await showConfirm(
    state.lang === 'el' ? 'Είστε σίγουροι ότι θέλετε να αποσυνδεθείτε από το λογαριασμό σας;' : 'Are you sure you want to log out of your account?',
    state.lang === 'el' ? 'Αποσύνδεση' : 'Logout',
    '🚪'
  );
  if (!confirmed) return;
  if (!state.supabaseClient) return;

  try {
    state.isLoggingOut = true;
    window._initialDataLoaded = false;
    try {
      await state.supabaseClient.auth.signOut();
    } catch (signOutErr) {
      console.warn('Supabase signOut network error (probably offline):', signOutErr);
    }

    // Also clear the native Google Sign-In session so the next sign-in shows
    // the account chooser again (otherwise Google silently re-selects the last
    // account used on the device). Best-effort — only when the plugin was
    // initialized earlier by a Google sign-in.
    if (window._googleAuthInitialized && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      const GoogleAuth = window.Capacitor?.Plugins?.GoogleAuth;
      if (GoogleAuth && typeof GoogleAuth.signOut === 'function') {
        try {
          await GoogleAuth.signOut();
        } catch (gErr) {
          console.warn('[GoogleAuth] Native signOut during logout:', gErr);
        }
      }
    }

    // Clear user-specific cached data
    localStorage.removeItem('cached_current_user');
    localStorage.removeItem('cached_user_profile');
    localStorage.removeItem('cached_partner_profile');
    localStorage.removeItem('cached_family_profiles');
    localStorage.removeItem('cached_family_group');
    localStorage.removeItem('offline_transactions');
    localStorage.removeItem('offline_accounts');
    localStorage.removeItem('offline_categories');
    localStorage.removeItem('offline_transactions_owner');
    localStorage.removeItem('deleted_transactions_trash');
    localStorage.removeItem('sync_cursors_v1');
    localStorage.removeItem('sync_last_full_ts');
    localStorage.removeItem('auth_guest_mode');
    localStorage.removeItem('app_theme'); // Reset theme to default (Premium Dark) on logout
    localStorage.removeItem('account_view_mode');
    localStorage.removeItem('offline_notes');
    localStorage.removeItem('deleted_notes_trash');
    localStorage.removeItem('advisor_chat_conversations_v1');
    localStorage.removeItem('advisor_chat_active_id_v1');
    state.activeAccountMode = 'family';
    localStorage.removeItem('bg_active_modal_id');
    localStorage.removeItem('bg_active_modal_tx_id');
    localStorage.removeItem('bg_active_subcat_txs');
    localStorage.removeItem('bg_modal_scroll_top');

    // Instead of forcing a navigation (which fails offline in Android WebView with net::err_failed),
    // manually reset the application state and DOM.
    state.transactions = [];
    state.trashTransactions = [];
    state.accounts = [];
    state.categories = [];
    state.notes = [];
    state.currentUser = null;
    state.userProfile = null;
    state.partnerProfile = null;
    state.familyProfiles = [];
    state.familyGroup = null;
    state.recurringTemplates = [];
    state.deletedRecurringDates = [];
    state.notifications = [];
    state.guestMode = false;
    state.session = null;

    // Reset AI advisor conversation DOM
    const chatLog = document.getElementById('advisor-chat-log');
    if (chatLog) chatLog.innerHTML = '';
    const convList = document.getElementById('advisor-conversation-list');
    if (convList) convList.innerHTML = '';

    // Close any open modals to avoid lingering UI elements
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.tx-modal-overlay').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.profile-sheet-overlay').forEach(m => m.classList.remove('active'));
    document.body.classList.remove('modal-open');

    // Show Auth UI
    const authOverlay = document.getElementById('auth-overlay');
    const formsContainer = document.getElementById('auth-forms-container');
    const authCard = document.getElementById('auth-card');
    const loadingState = document.getElementById('auth-loading-state');

    if (authOverlay) authOverlay.style.display = 'flex';
    if (formsContainer) formsContainer.style.display = 'block';
    if (authCard) authCard.style.display = 'flex';
    if (loadingState) loadingState.style.display = 'none';

    // Update main UI to clear any underlying DOM nodes
    updateUI();
    if (typeof renderNotesList === 'function') renderNotesList();

    state.isLoggingOut = false;
  } catch (err) {
    state.isLoggingOut = false;
    console.error('Sign out error:', err);
  }
}

window.sendFamilyInviteVia = function (channel, inviteCode) {
  const isEl = state.lang === 'el';
  const roleSelect = document.getElementById('invite-role-select');
  const role = roleSelect ? roleSelect.value : 'member';
  const roleTitle = (role === 'admin')
    ? (isEl ? 'Διαχειριστής' : 'Admin')
    : (isEl ? 'Απλό Μέλος' : 'Member');

  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${inviteCode}&role=${role}`;
  const familyName = state.familyGroup ? state.familyGroup.name : '';

  const text = isEl
    ? `👋 Γεια σου! Σε προσκαλώ να συνδεθείς ${familyName ? `στην «${familyName}»` : 'στην οικογένειά μας'} στο Budget Assistant (ως ${roleTitle}) για να διαχειριζόμαστε μαζί τα οικονομικά μας!\n\n🔗 Πατήστε το σύνδεσμο για αποδοχή:\n${inviteUrl}`
    : `👋 Hello! I invite you to join ${familyName ? `"${familyName}"` : 'our family'} on Budget Assistant (as ${roleTitle}) to manage our finances together!\n\n🔗 Tap the link to accept:\n${inviteUrl}`;

  const encodedText = encodeURIComponent(text);

  if (channel === 'whatsapp') {
    const waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(waUrl, '_blank');
  } else if (channel === 'viber') {
    const viberUrl = `viber://forward?text=${encodedText}`;
    window.open(viberUrl, '_blank');
  } else if (channel === 'sms') {
    const smsUrl = `sms:?body=${encodedText}`;
    window.location.href = smsUrl;
  } else {
    if (navigator.share) {
      navigator.share({
        title: isEl ? 'Πρόσκληση στο Budget Assistant' : 'Budget Assistant Invite',
        text: text
      }).catch(err => console.log('Share canceled:', err));
    } else {
      navigator.clipboard.writeText(text).then(() => {
        if (typeof showSyncToast === 'function') {
          showSyncToast(isEl ? '✓ Το μήνυμα πρόσκλησης αντεγράφη στο πρόχειρο!' : '✓ Invite message copied to clipboard!', 2500);
        }
      });
    }
  }
};

window.shareFamilyInviteCode = (inviteCode) => window.sendFamilyInviteVia('native', inviteCode);

window.copyDirectInviteLink = function (inviteCode) {
  const isEl = state.lang === 'el';
  const roleSelect = document.getElementById('invite-role-select');
  const role = roleSelect ? roleSelect.value : 'member';
  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${inviteCode}&role=${role}`;

  navigator.clipboard.writeText(inviteUrl).then(() => {
    if (typeof showSyncToast === 'function') {
      showSyncToast(isEl ? '✓ Αντεγράφη ο απευθείας σύνδεσμος πρόσκλησης!' : '✓ Direct invite link copied!', 2500);
    }
  });
};

// ============================================================
// COLLABORATION & SHARED FAMILY / PARTNER BUDGET HUB
// Extracted to js/partnerSyncService.js (Phase 12B Architectural Extraction)
// ============================================================

async function forceAppUpdate() {
  const confirmMsg = state.lang === 'en' ? 'Force update and reload the app?' : 'Θέλετε να επιβάλλετε ενημέρωση και επαναφόρτωση της εφαρμογής;';
  const confirmed = await showConfirm(confirmMsg, state.lang === 'el' ? 'Αναγκαστική Ενημέρωση' : 'Force Update', '🔄');
  if (!confirmed) return;

  if (typeof showSyncToast === 'function') {
    showSyncToast(state.lang === 'el' ? 'Έλεγχος & λήψη ενημέρωσης...' : 'Checking & downloading update...', 10000);
  }

  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
    try {
      const manifestRes = await fetch("https://budget-assistant-pwa.pages.dev/version.json?_t=" + Date.now());
      const manifest = await manifestRes.json();

      if (!manifest || !manifest.url) {
        throw new Error("Invalid version.json format");
      }

      if (typeof showSyncToast === 'function') {
        showSyncToast((state.lang === 'el' ? 'Λήψη έκδοσης ' : 'Downloading version ') + (manifest.version || 'νέας') + '...', 10000);
      }

      // Wrap the native download in a timeout so it can never hang forever
      // (Capgo's download() has no built-in timeout and can stall silently,
      // leaving the user stuck on "Downloading version...").
      const DOWNLOAD_TIMEOUT_MS = 90000;
      const downloadPromise = window.Capacitor.Plugins.CapacitorUpdater.download({
        url: manifest.url,
        version: manifest.version || Date.now().toString(),
        checksum: manifest.checksum || undefined
      });
      const update = await Promise.race([
        downloadPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Download timed out')), DOWNLOAD_TIMEOUT_MS))
      ]);

      await window.Capacitor.Plugins.CapacitorUpdater.set({ id: update.id });

      if (typeof showSyncToast === 'function') {
        showSyncToast(state.lang === 'el' ? 'Εφαρμογή ενημέρωσης & επανεκκίνηση...' : 'Applying update & reloading...', 3000);
      }

      setTimeout(async () => {
        try {
          if (window.Capacitor.Plugins.CapacitorUpdater.reload) {
            await window.Capacitor.Plugins.CapacitorUpdater.reload();
          } else {
            window.location.reload(true);
          }
        } catch (_) {
          window.location.reload(true);
        }
      }, 500);
      return;
    } catch (e) {
      console.error('[ForceUpdate] Capgo update failed; falling back to classic reload:', e);
    }
  }

  // Classic path (plain web/PWA or no OTA update available): clear SW + cache
  // and reload the bundled app.
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of registrations) {
        await registration.unregister();
      }
    } catch (e) {
      console.error('Failed to unregister SW:', e);
    }
  }
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      for (let key of keys) {
        await caches.delete(key);
      }
    } catch (e) {
      console.error('Failed to clear cache:', e);
    }
  }
  window.location.reload(true);
}

// Bind new functions to window for HTML element access
window.forceAppUpdate = forceAppUpdate;
window.changeThemeSetting = changeThemeSetting;
window.toggleAppLock = toggleAppLock;
window.toggleBiometrics = toggleBiometrics;
window.toggleScreenshotBlockSetting = toggleScreenshotBlockSetting;
window.closePinModal = closePinModal;
window.openPinVerifyModal = openPinVerifyModal;
window.closePinVerifyModal = closePinVerifyModal;
window.submitPinVerification = submitPinVerification;
window.openBiometricsPinModal = openBiometricsPinModal;
window.closeBiometricsPinModal = closeBiometricsPinModal;
window.proceedToPinSetup = proceedToPinSetup;
window.submitPinSetup = submitPinSetup;
window.pressKey = pressKey;
window.pressBackspace = pressBackspace;
window.triggerBiometricAuth = triggerBiometricAuth;
window.switchAuthTab = switchAuthTab;
window.setAuthMode = setAuthMode;
window.handlePasswordAuth = handlePasswordAuth;
window.handleMagicAuth = handleMagicAuth;
window.handleGoogleAuth = handleGoogleAuth;
window.handleLogout = handleLogout;

// ============================================================
// GUEST MODE & OFFLINE CLOUD SYNC
// ============================================================

async function enterGuestMode() {
  state.guestMode = true;
  window._authConfirmed = true;
  localStorage.setItem('auth_guest_mode', 'true');
  // ACCOUNT-ISOLATION: Guest data is unowned — clear any previous account's owner
  // marker so guest transactions can be imported into whichever account the user
  // later signs into (the intended "auto-import saved data" flow).
  localStorage.removeItem('offline_transactions_owner');

  // PRIVACY/ISOLATION (guest = clean slate): Wipe ALL in-memory account data from
  // a previously signed-in user BEFORE the first UI flush. Otherwise the flush
  // inside hideAuthOverlay() runs processRecurringTemplates() while
  // state.recurringTemplates still holds the main profile's templates, which
  // regenerates those recurring transactions into the guest's local cache
  // (offline_guest_transactions) — leaking account data into the guest session.
  state.currentUser = null;
  state.session = null;
  state.userProfile = null;
  state.partnerProfile = null;
  state.familyProfiles = [];
  state.familyGroup = null;
  state.transactions = [];
  state.budgets = [];
  state.recurringTemplates = [];
  state.deletedRecurringDates = [];
  state.trashTransactions = [];
  state.notifications = [];
  state.notes = [];

  // Hide auth overlay cleanly FIRST so anyModalOpen check in _runScheduledRender doesn't block rendering
  hideAuthOverlay();

  // Show premium splash loader immediately
  toggleLoader(true);

  // Hide switcher in header (guest has no shared wallet)
  const switcher = document.getElementById('wallet-switcher-container');
  if (switcher) switcher.style.display = 'none';

  // Show lock icon user badge in header to connect/sign up
  updateHeaderProfileBadge();

  // Load data & update UI
  window._suppressTransitions = true;
  try {
    await loadData();
    flushUI();
  } finally {
    setTimeout(() => { window._suppressTransitions = false; }, 1500);
  }
  renderPartnerSection();
  toggleLoader(false);
}

// Tracks whether the auth overlay was explicitly opened by the user (e.g. by
// tapping the lock icon in the header). When true, a null-session auth event
// (INITIAL_SESSION / SIGNED_OUT) must NOT auto-hide the overlay — the user
// explicitly asked to see the login form, so it must stay until they either
// sign in, dismiss it, or the session is actually restored.
let _authOverlayUserRequested = false;

// ============================================================
// AUTH OVERLAY DIAGNOSTICS
// ------------------------------------------------------------
// When the user taps the lock icon in the header and the login
// overlay fails to open, this mechanism runs a battery of checks
// and displays a detailed diagnostic panel explaining EXACTLY
// what is wrong (missing element, JS error, CSS hiding it, etc.)
// so the problem can be identified and reported precisely.
// ============================================================

// Renders a full-screen diagnostic panel with a list of checks.
function showAuthDiagnosticPanel(checks, thrownError) {
  try {
    // Remove any existing diagnostic panel
    const existing = document.getElementById('auth-diagnostic-panel');
    if (existing) existing.remove();

    const isEl = (state && state.lang === 'el');
    const panel = document.createElement('div');
    panel.id = 'auth-diagnostic-panel';
    panel.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483646;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;';

    const card = document.createElement('div');
    card.style.cssText = 'background:#1e1e2e;color:#e4e4ef;border:1px solid #3a3a52;border-radius:16px;max-width:520px;width:100%;max-height:85vh;overflow-y:auto;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,0.6);';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:18px;font-weight:800;margin-bottom:6px;display:flex;align-items:center;gap:8px;';
    title.innerHTML = '🔍 ' + (isEl ? 'Διαγνωστικά Σύνδεσης' : 'Login Diagnostics');

    const subtitle = document.createElement('div');
    subtitle.style.cssText = 'font-size:13px;color:#9aa0b5;margin-bottom:16px;line-height:1.5;';
    subtitle.textContent = isEl
      ? 'Το λουκέτο σύνδεσης δεν άνοιξε. Παρακάτω φαίνεται τι ακριβώς πήγε στραβά:'
      : 'The login lock did not open. Below is exactly what went wrong:';

    card.appendChild(title);
    card.appendChild(subtitle);

    // Render each check result
    checks.forEach(function (c) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border-radius:10px;margin-bottom:8px;background:' + (c.ok ? 'rgba(46,204,113,0.10)' : 'rgba(239,68,68,0.12)') + ';border:1px solid ' + (c.ok ? 'rgba(46,204,113,0.35)' : 'rgba(239,68,68,0.4)') + ';';
      const icon = document.createElement('span');
      icon.style.cssText = 'font-size:15px;flex-shrink:0;';
      icon.textContent = c.ok ? '✅' : '❌';
      const body = document.createElement('div');
      body.style.cssText = 'font-size:13px;line-height:1.45;';
      const name = document.createElement('div');
      name.style.cssText = 'font-weight:700;color:' + (c.ok ? '#4ade80' : '#f87171') + ';';
      name.textContent = c.label;
      body.appendChild(name);
      if (c.detail) {
        const detail = document.createElement('div');
        detail.style.cssText = 'color:#cbd5e1;font-size:12px;margin-top:2px;word-break:break-word;';
        detail.textContent = c.detail;
        body.appendChild(detail);
      }
      row.appendChild(icon);
      row.appendChild(body);
      card.appendChild(row);
    });

    // Show thrown error if any
    if (thrownError) {
      const errBox = document.createElement('div');
      errBox.style.cssText = 'margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.5);';
      errBox.innerHTML = '<div style="font-weight:700;color:#f87171;font-size:13px;margin-bottom:4px;">⚠️ ' + (isEl ? 'Σφάλμα JavaScript' : 'JavaScript Error') + '</div><div style="font-size:12px;color:#fecaca;word-break:break-word;font-family:monospace;">' + String(thrownError && thrownError.message ? thrownError.message : thrownError) + '</div>';
      card.appendChild(errBox);
    }

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;margin-top:18px;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = isEl ? 'Κλείσιμο' : 'Close';
    closeBtn.style.cssText = 'flex:1;padding:11px;border:none;border-radius:10px;background:#3a3a52;color:#fff;font-weight:700;font-size:14px;cursor:pointer;';
    closeBtn.onclick = function () { panel.remove(); };

    const copyBtn = document.createElement('button');
    copyBtn.textContent = isEl ? '📋 Αντιγραφή Διαγνωστικών' : '📋 Copy Diagnostics';
    copyBtn.style.cssText = 'flex:1;padding:11px;border:none;border-radius:10px;background:#7c6af7;color:#fff;font-weight:700;font-size:14px;cursor:pointer;';
    copyBtn.onclick = function () {
      try {
        const lines = checks.map(function (c) { return (c.ok ? '[OK] ' : '[FAIL] ') + c.label + (c.detail ? ' — ' + c.detail : ''); });
        if (thrownError) lines.push('[ERROR] ' + (thrownError.message || thrownError));
        navigator.clipboard.writeText(lines.join('\n')).then(function () {
          copyBtn.textContent = isEl ? '✅ Αντιγράφηκε!' : '✅ Copied!';
        }).catch(function () {
          copyBtn.textContent = isEl ? '⚠️ Αποτυχία' : '⚠️ Failed';
        });
      } catch (e) { /* ignore */ }
    };

    btnRow.appendChild(closeBtn);
    btnRow.appendChild(copyBtn);
    card.appendChild(btnRow);

    panel.appendChild(card);
    panel.addEventListener('click', function (e) { if (e.target === panel) panel.remove(); });
    document.body.appendChild(panel);
  } catch (e) {
    console.error('[AuthDiag] Failed to render diagnostic panel:', e);
    window.showAlert('Διαγνωστικά σύνδεσης:\n' + JSON.stringify(checks) + '\n' + (thrownError ? thrownError.message : ''));
  }
}

// Runs diagnostics and attempts to open the auth overlay. If it fails,
// shows the diagnostic panel explaining exactly what is wrong.
function openAuthWithDiagnostics() {
  const checks = [];
  const isEl = (state && state.lang === 'el');

  // 1. Check the auth overlay element exists
  const authOverlay = document.getElementById('auth-overlay');
  checks.push({
    ok: !!authOverlay,
    label: isEl ? 'Στοιχείο auth-overlay' : 'auth-overlay element',
    detail: authOverlay ? 'Βρέθηκε (#auth-overlay)' : 'ΔΕΝ βρέθηκε — λείπει από το index.html'
  });

  // 2. Check auth-card exists
  const authCard = document.getElementById('auth-card');
  checks.push({
    ok: !!authCard,
    label: isEl ? 'Στοιχείο auth-card' : 'auth-card element',
    detail: authCard ? 'Βρέθηκε (#auth-card)' : 'ΔΕΝ βρέθηκε — λείπει από το index.html'
  });

  // 3. Check auth-forms-container exists
  const formsContainer = document.getElementById('auth-forms-container');
  checks.push({
    ok: !!formsContainer,
    label: isEl ? 'Στοιχείο auth-forms-container' : 'auth-forms-container element',
    detail: formsContainer ? 'Βρέθηκε (#auth-forms-container)' : 'ΔΕΝ βρέθηκε — λείπει από το index.html'
  });

  // 4. Check showAuthOverlay is defined
  const fnOk = typeof showAuthOverlay === 'function';
  checks.push({
    ok: fnOk,
    label: isEl ? 'Συνάρτηση showAuthOverlay' : 'showAuthOverlay function',
    detail: fnOk ? 'Ορίζεται σωστά' : 'ΔΕΝ ορίζεται — σφάλμα φόρτωσης app.js'
  });

  // 5. Check for early-auth style blocks that might hide the overlay
  const earlyHide = document.getElementById('early-auth-hide-style');
  const earlyStyle = document.getElementById('early-auth-style');
  const hasEarlyHide = !!earlyHide;
  const hasEarlyStyle = !!earlyStyle;
  checks.push({
    ok: !hasEarlyHide && !hasEarlyStyle,
    label: isEl ? 'Προσωρινά style blocks' : 'Temporary style blocks',
    detail: (hasEarlyHide || hasEarlyStyle)
      ? 'Βρέθηκαν blocks που κρύβουν το overlay (early-auth-hide-style' + (hasEarlyHide ? ' ✓' : '') + ', early-auth-style' + (hasEarlyStyle ? ' ✓' : '') + ') — θα αφαιρεθούν'
      : 'Κανένα block που κρύβει το overlay'
  });

  // 6. Check the overlay's current computed display state
  let displayState = 'unknown';
  let visibilityState = 'unknown';
  if (authOverlay) {
    try {
      const cs = window.getComputedStyle(authOverlay);
      displayState = cs.display;
      visibilityState = cs.visibility;
    } catch (e) { /* ignore */ }
  }
  checks.push({
    ok: true,
    label: isEl ? 'Τρέχουσα κατάσταση overlay' : 'Current overlay state',
    detail: 'display=' + displayState + ', visibility=' + visibilityState
  });

  // Attempt to open the overlay, capturing any thrown error
  let thrownError = null;
  let opened = false;
  try {
    showAuthOverlay();
    // Verify it actually became visible
    if (authOverlay) {
      const cs = window.getComputedStyle(authOverlay);
      opened = cs.display !== 'none' && cs.visibility !== 'hidden';
    } else {
      opened = false;
    }
  } catch (err) {
    thrownError = err;
    opened = false;
  }

  checks.push({
    ok: opened,
    label: isEl ? 'Άνοιγμα overlay' : 'Overlay opened',
    detail: opened
      ? (isEl ? 'Το λουκέτο άνοιξε επιτυχώς ✅' : 'The lock opened successfully ✅')
      : (isEl ? 'Το overlay ΔΕΝ εμφανίστηκε' : 'The overlay did NOT appear')
  });

  if (opened) {
    // Success — no need to show the diagnostic panel.
    return;
  }

  // Failure — show the diagnostic panel with all the details.
  showAuthDiagnosticPanel(checks, thrownError);
}
window.openAuthWithDiagnostics = openAuthWithDiagnostics;

// Delegated document-level listener: guarantees the diagnostic fires on the
// lock badge (#user-profile-badge) even if updateHeaderProfileBadge() did not
// set the onclick handler (e.g. stale cache / re-render race on web).
(function ensureLockBadgeDiagnosticListener() {
  try {
    document.addEventListener('click', function (e) {
      try {
        var badge = e.target && e.target.closest ? e.target.closest('#user-profile-badge') : null;
        if (!badge) return;
        // If the overlay is already open, let the normal handler manage it.
        var overlay = document.getElementById('auth-overlay');
        if (overlay && !overlay.classList.contains('hidden')) return;
        // Only intercept if the badge has no working onclick that opens the overlay.
        if (typeof badge.onclick === 'function') return;
        // Fallback: show auth overlay directly.
        if (typeof showAuthOverlay === 'function') {
          showAuthOverlay();
        }
      } catch (err) {
        // Never break other click handling.
      }
    }, true);
  } catch (err) {
    // Ignore — the direct onclick handler remains the primary path.
  }
})();

function showAuthOverlay() {
  try {
    _authOverlayUserRequested = true;
    if (typeof hideLockScreen === 'function') {
      try { hideLockScreen(); } catch (e) { }
    }
    const authOverlay = document.getElementById('auth-overlay');
    if (!authOverlay) return;

    if (authOverlay.parentElement !== document.body) {
      document.body.appendChild(authOverlay);
    }

    const formsContainer = document.getElementById('auth-forms-container');
    const authCard = document.getElementById('auth-card');
    const loadingState = document.getElementById('auth-loading-state');

    // Clean up early styles
    const earlyHideStyle = document.getElementById('early-auth-hide-style');
    if (earlyHideStyle) earlyHideStyle.remove();
    const earlyStyle = document.getElementById('early-auth-style');
    if (earlyStyle) earlyStyle.remove();

    // Also remove any anonymous style blocks in head that hide the overlay
    try {
      document.querySelectorAll('head style').forEach(s => {
        if (s.innerHTML && s.innerHTML.includes('#auth-overlay') && s.innerHTML.includes('none')) {
          s.remove();
        }
      });
    } catch (e) { }

    authOverlay.classList.remove('hidden');
    authOverlay.classList.add('active');
    authOverlay.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 2147483647 !important; pointer-events: auto !important; position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; min-height: 100dvh !important; background: radial-gradient(circle at 50% 30%, #1c2536 0%, #090c13 100%) !important;';

    if (formsContainer) formsContainer.style.setProperty('display', 'block', 'important');
    if (authCard) {
      authCard.style.setProperty('display', 'flex', 'important');
      authCard.style.setProperty('visibility', 'visible', 'important');
      authCard.style.setProperty('opacity', '1', 'important');
    }
    if (loadingState) loadingState.style.setProperty('display', 'none', 'important');

    if (typeof switchAuthTab === 'function') {
      try { switchAuthTab('password'); } catch (e) { }
    }

    // Clear other open modals safely
    try {
      document.querySelectorAll('.modal-overlay:not(#auth-overlay), .tx-modal-overlay, .profile-sheet-overlay').forEach(m => m.classList.remove('active'));
    } catch (err) {
      console.warn("Failed to clear modals", err);
    }

    const txModal = document.getElementById('transaction-modal');
    if (txModal) txModal.style.display = 'none';

    const emailInput = document.getElementById('auth-email');
    if (emailInput && !emailInput.value) {
      setTimeout(() => { try { emailInput.focus(); } catch (e) { } }, 150);
    }
  } catch (err) {
    console.error("Auth Overlay Error:", err);
  }
}
window.showAuthOverlay = showAuthOverlay;

function hideAuthOverlay() {
  _authOverlayUserRequested = false;
  const authOverlay = document.getElementById('auth-overlay');
  const formsContainer = document.getElementById('auth-forms-container');
  const loadingState = document.getElementById('auth-loading-state');
  const earlyStyle = document.getElementById('early-auth-style');
  if (earlyStyle) earlyStyle.remove();

  if (authOverlay) {
    authOverlay.classList.remove('active');
    authOverlay.style.removeProperty('display');
    authOverlay.style.display = 'none';
    authOverlay.style.pointerEvents = '';
  }
  if (loadingState) loadingState.style.display = 'none';
  if (formsContainer) formsContainer.style.display = 'block';
  forceViewportReset();
  if (state.guestMode || state.currentUser) {
    flushUI();
  }
}
window.hideAuthOverlay = hideAuthOverlay;

function closeAuth() {
  hideAuthOverlay();
}
window.closeAuth = closeAuth;

// Re-entrancy guard: prevents the same local transactions from being inserted
// ============================================================
// OFFLINE GUEST DATA MANAGEMENT & IDEMPOTENT CLOUD IMPORT
// ============================================================

function getOfflineGuestTransactions() {
  try {
    const raw = localStorage.getItem('offline_guest_transactions');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Strictly exclude demo sample transactions so new accounts are never prompted for demo data
        const realTxs = parsed.filter(t => t && !t.is_demo && !String(t.id || '').startsWith('demo_'));
        return realTxs;
      }
    }
  } catch (e) {
    console.warn('Failed to parse offline_guest_transactions:', e);
  }
  return [];
}

function saveOfflineGuestTransactions(trans) {
  try {
    if (!Array.isArray(trans) || trans.length === 0) {
      localStorage.removeItem('offline_guest_transactions');
    } else {
      // Exclude demo transactions from guest backup
      const realTxs = trans.filter(t => t && !t.is_demo && !String(t.id || '').startsWith('demo_'));
      if (realTxs.length === 0) {
        localStorage.removeItem('offline_guest_transactions');
      } else {
        localStorage.setItem('offline_guest_transactions', JSON.stringify(realTxs));
      }
    }
  } catch (e) {
    console.error('Failed to save offline_guest_transactions:', e);
  }
  updateOfflineImportSettingsRow();
}

function updateOfflineImportSettingsRow() {
  const row = document.getElementById('settings-offline-import-row');
  if (!row) return;
  const count = getOfflineGuestTransactions().length;
  if (count > 0 && state.currentUser) {
    row.style.display = 'flex';
    const descEl = document.getElementById('settings-offline-import-desc');
    if (descEl) {
      const template = (state.lang === 'el')
        ? `Μεταφορά των ${count} τοπικών κινήσεων στον λογαριασμό σας`
        : `Transfer ${count} local transactions to your account`;
      descEl.textContent = template;
    }
  } else {
    row.style.display = 'none';
  }
}

function ensureOfflineImportModal() {
  let modal = document.getElementById('offline-import-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'offline-import-modal';
  modal.className = 'modal-overlay';
  modal.style.zIndex = '2147483647';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 360px; text-align: center; padding: 26px 20px; border-radius: 24px; background: var(--bg-card); border: 1px solid var(--border); box-shadow: 0 20px 60px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 16px;">
      <div style="width: 56px; height: 56px; border-radius: 18px; background: rgba(99,102,241,0.12); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 26px; margin: 0 auto;">
        <i class="fa-solid fa-cloud-arrow-up"></i>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <h3 id="offline-import-modal-title" style="margin: 0; font-size: 17px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif;">
          Διαχείριση Offline Κινήσεων
        </h3>
        <p id="offline-import-modal-desc" style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.45;">
          Βρέθηκαν offline κινήσεις. Τι θέλετε να κάνετε για τον λογαριασμό σας;
        </p>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 4px;">
        <!-- Option 1: Sync to Cloud -->
        <button id="offline-import-btn-sync" class="btn btn-primary" style="padding: 13px 16px; font-size: 13.5px; font-weight: 700; border-radius: 14px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <span id="offline-import-btn-sync-text">Μεταφορά στον Λογαριασμό</span>
        </button>
        <!-- Option 2: Keep Offline Only -->
        <button id="offline-import-btn-keep" class="btn btn-secondary" style="padding: 12px 16px; font-size: 13px; font-weight: 600; border-radius: 14px; width: 100%; border: 1px solid var(--border); background: rgba(255,255,255,0.04); color: var(--text-primary); display: flex; align-items: center; justify-content: center; gap: 8px;">
          <i class="fa-solid fa-floppy-disk"></i>
          <span id="offline-import-btn-keep-text">Διατήρηση μόνο Offline</span>
        </button>
        <!-- Option 3: Discard / Delete -->
        <button id="offline-import-btn-discard" class="btn btn-danger-outline" style="padding: 10px 16px; font-size: 12.5px; font-weight: 600; border-radius: 14px; width: 100%; border: 1px solid rgba(239,68,68,0.25); background: rgba(239,68,68,0.04); color: #ef4444; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <i class="fa-solid fa-trash"></i>
          <span id="offline-import-btn-discard-text">Διαγραφή</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

let _offlinePromptInFlight = false;

function showOfflineImportPrompt(userId, userEmail, isManual = false) {
  return new Promise((resolve) => {
    if (_offlinePromptInFlight) {
      resolve(null);
      return;
    }

    const guestTxs = getOfflineGuestTransactions();
    const count = guestTxs.length;
    if (count === 0) {
      if (isManual) {
        showToast(state.lang === 'el' ? 'Δεν βρέθηκαν εκκρεμείς offline κινήσεις.' : 'No pending offline transactions found.');
      }
      resolve(null);
      return;
    }

    _offlinePromptInFlight = true;
    const modal = ensureOfflineImportModal();
    const isEl = (state.lang || 'el') === 'el';
    const emailDisplay = userEmail || (state.currentUser?.email || 'Cloud');

    const titleEl = document.getElementById('offline-import-modal-title');
    const descEl = document.getElementById('offline-import-modal-desc');
    const btnSyncText = document.getElementById('offline-import-btn-sync-text');
    const btnKeepText = document.getElementById('offline-import-btn-keep-text');
    const btnDiscardText = document.getElementById('offline-import-btn-discard-text');

    if (titleEl) titleEl.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['modal_offline_import_title']) || 'Διαχείριση Offline Κινήσεων';
    if (descEl) {
      const descTemplate = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['modal_offline_import_desc']) || 'Βρέθηκαν {count} κινήσεις που καταγράψατε σε λειτουργία Offline. Τι θέλετε να κάνετε για τον λογαριασμό {email};';
      descEl.textContent = descTemplate.replace('{count}', count).replace('{email}', emailDisplay);
    }
    if (btnSyncText) btnSyncText.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['btn_sync_to_cloud']) || '☁️ Μεταφορά στον Λογαριασμό';
    if (btnKeepText) btnKeepText.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['btn_keep_offline_only']) || '💾 Διατήρηση μόνο Offline';
    if (btnDiscardText) btnDiscardText.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['btn_discard_offline']) || '🗑️ Διαγραφή';

    const btnSync = document.getElementById('offline-import-btn-sync');
    const btnKeep = document.getElementById('offline-import-btn-keep');
    const btnDiscard = document.getElementById('offline-import-btn-discard');

    let resolved = false;
    const closeModal = (choice) => {
      if (resolved) return;
      resolved = true;
      _offlinePromptInFlight = false;
      // REMEMBER DISMISSAL: "Keep Offline Only" (or closing the dialog via backdrop)
      // intentionally leaves the guest data on the device, so record the count we
      // showed. The login-time prompt then stays silent until the pending set changes.
      if (choice === 'keep') {
        try {
          localStorage.setItem('offline_guest_prompt_dismissed_count', String(count));
        } catch (e) { /* storage unavailable — ignore */ }
      }
      modal.classList.remove('active');
      modal.style.cssText = '';
      document.body.classList.remove('modal-open');
      modal.ontouchstart = null;
      modal.ontouchend = null;
      modal.onclick = null;
      resolve(choice);
    };

    const newBtnSync = btnSync.cloneNode(true);
    const newBtnKeep = btnKeep.cloneNode(true);
    const newBtnDiscard = btnDiscard.cloneNode(true);

    btnSync.parentNode.replaceChild(newBtnSync, btnSync);
    btnKeep.parentNode.replaceChild(newBtnKeep, btnKeep);
    btnDiscard.parentNode.replaceChild(newBtnDiscard, btnDiscard);

    newBtnSync.onclick = async (e) => {
      e.stopPropagation();
      closeModal('sync');
      await transferOfflineDataToAccount(userId, userEmail);
    };

    newBtnKeep.onclick = (e) => {
      e.stopPropagation();
      closeModal('keep');
      updateOfflineImportSettingsRow();
    };

    newBtnDiscard.onclick = async (e) => {
      e.stopPropagation();
      const confirmText = ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['offline_discard_confirm']) || 'Είστε σίγουροι ότι θέλετε να διαγράψετε τις {count} offline κινήσεις;').replace('{count}', count);
      const ok = await showConfirm(confirmText, '', '🗑️');
      if (ok) {
        localStorage.removeItem('offline_guest_transactions');
        localStorage.removeItem('offline_guest_prompt_dismissed_count');
        updateOfflineImportSettingsRow();
        closeModal('discard');
      }
    };

    modal.classList.add('active');
    document.body.classList.add('modal-open');

    let touchStartTarget = null;
    modal.ontouchstart = (e) => {
      touchStartTarget = e.target;
    };
    modal.ontouchend = (e) => {
      if (touchStartTarget === modal && e.target === modal) {
        e.preventDefault();
        e.stopPropagation();
        closeModal('keep');
      }
      touchStartTarget = null;
    };
    modal.onclick = (e) => {
      if (e.target === modal) {
        e.stopPropagation();
        closeModal('keep');
      }
    };
  });
}

function triggerManualOfflineImport() {
  if (!state.currentUser) {
    showAuthOverlay();
    return;
  }
  showOfflineImportPrompt(state.currentUser.id, state.currentUser.email, true);
}

// 100% IDEMPOTENT CLOUD UPSERT (Persistent UUIDs - Zero Duplicates)
async function transferOfflineDataToAccount(userId, userEmail) {
  if (!userId || !state.supabaseClient) return;
  const guestTxs = getOfflineGuestTransactions();
  if (guestTxs.length === 0) return;

  toggleLoader(true);
  try {
    const toUpsert = guestTxs.map(t => {
      const copy = mapTransactionToDb(t);
      delete copy.fx_snapshot;
      return copy;
    }).filter(Boolean);

    _suppressRealtimeEvents = true;
    for (let i = 0; i < toUpsert.length; i += 50) {
      const batch = toUpsert.slice(i, i + 50);
      const { error } = await promiseTimeout(
        state.supabaseClient.from('transactions').upsert(batch, { onConflict: 'id' }).then(r => r),
        60000
      );
      if (error) throw error;
    }

    // ONLY ON 100% SUCCESS: Clean guest storage
    localStorage.removeItem('offline_guest_transactions');
    localStorage.removeItem('offline_guest_prompt_dismissed_count');
    updateOfflineImportSettingsRow();

    // Reload user data & update UI
    await loadData();
    flushUI();

    const successMsg = ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['offline_import_success']) || '🎉 {count} offline κινήσεις μεταφέρθηκαν επιτυχώς στον λογαριασμό σας!').replace('{count}', toUpsert.length);
    showToast(successMsg, 4000);
  } catch (err) {
    console.error('Failed to transfer offline transactions:', err);
    const errorMsg = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['offline_import_error']) || '❌ Προέκυψε σφάλμα κατά τη μεταφορά. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.';
    showToast(errorMsg, 4000);
  } finally {
    toggleLoader(false);
    setTimeout(() => { _suppressRealtimeEvents = false; }, 3000);
  }
}

// Background sync helper for pending local items belonging to the current user
let _syncLocalInFlight = false;

async function syncLocalTransactionsToCloud(userId, options = {}) {
  const silent = !!options.silent;
  const transStr = localStorage.getItem('offline_transactions');
  const guestTxs = (typeof getOfflineGuestTransactions === 'function') ? getOfflineGuestTransactions() : [];
  if (!transStr && guestTxs.length === 0) return;

  if (_syncLocalInFlight) {
    return;
  }
  _syncLocalInFlight = true;

  try {
    let allTrans = [];
    try {
      allTrans = transStr ? (JSON.parse(transStr) || []) : [];
    } catch (e) {
      allTrans = [];
    }
    const combined = [...allTrans, ...guestTxs];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const localTrans = combined.filter(t => {
      if (!t || !t.amount) return false;
      if (!t.id) return true;
      if (String(t.id).startsWith('local_')) return true;
      if (t.user_id === userId || !t.user_id || t.user_id === 'guest') return true;
      if (!uuidRegex.test(String(t.id))) return true;
      return false;
    });

    // Durable tombstone guard: never re-upload a permanently-deleted transaction to
    // the cloud, even if it is still present in the offline cache.
    let permanentlyDeletedSet = null;
    try {
      permanentlyDeletedSet = new Set(Array.from(collectPermanentlyDeletedTxIds()).map(String));
    } catch (err) {
      console.warn('Failed to collect permanently deleted IDs in syncLocalTransactionsToCloud:', err);
    }
    const filteredLocalTrans = permanentlyDeletedSet
      ? localTrans.filter(t => !(t && t.id && permanentlyDeletedSet.has(String(t.id))))
      : localTrans;

    if (filteredLocalTrans.length > 0) {
      const toInsert = filteredLocalTrans.map(t => {
        const copy = mapTransactionToDb(t);
        delete copy.fx_snapshot;
        return copy;
      }).filter(Boolean);

      _suppressRealtimeEvents = true;
      try {
        for (let i = 0; i < toInsert.length; i += 50) {
          const batch = toInsert.slice(i, i + 50);
          const { error } = await promiseTimeout(state.supabaseClient
            .from('transactions')
            .upsert(batch, { onConflict: 'id' }).then(r => r), 60000);
          if (error) throw error;
        }

        const cleanOffline = allTrans.filter(t => !filteredLocalTrans.includes(t));
        localStorage.setItem('offline_transactions', JSON.stringify(cleanOffline));
        localStorage.setItem('offline_transactions_owner', userId);
        localStorage.removeItem('offline_guest_transactions');
        localStorage.removeItem('offline_guest_prompt_dismissed_count');
      } finally {
        setTimeout(() => { _suppressRealtimeEvents = false; }, 5000);
      }
    }
  } catch (err) {
    console.error('Error in syncLocalTransactionsToCloud:', err);
  } finally {
    _syncLocalInFlight = false;
  }
}

window.enterGuestMode = enterGuestMode;
window.showAuthOverlay = showAuthOverlay;
window.syncLocalTransactionsToCloud = syncLocalTransactionsToCloud;
window.triggerManualOfflineImport = triggerManualOfflineImport;
window.showOfflineImportPrompt = showOfflineImportPrompt;

// ============================================================
// REAL-TIME SYNC & OFFLINE QUEUE SYSTEM
// ============================================================
function enqueueSyncMutation(action, payload) {
  try {
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]');
    const isDelete = action === 'delete' || action === 'delete_template' || action === 'delete_note' || action === 'permanent_delete_note';
    const itemId = isDelete ? payload : (payload && payload.id ? payload.id : payload);

    // Clean up duplicate saves/updates in queue if we are now deleting
    let cleanQueue = queue.filter(item => {
      const itemIsDelete = item.action === 'delete' || item.action === 'delete_template' || item.action === 'delete_note' || item.action === 'permanent_delete_note';
      const itemKey = itemIsDelete ? item.payload : (item.payload && item.payload.id ? item.payload.id : item.payload);
      const isSaveAction = item.action === 'save' || item.action === 'save_template' || item.action === 'save_note' || item.action === 'restore_note';
      return !(itemKey === itemId && isSaveAction && isDelete);
    });

    cleanQueue.push({
      id: generateUUID(),
      action,
      payload,
      timestamp: Date.now()
    });

    localStorage.setItem('money_manager_sync_queue', JSON.stringify(cleanQueue));
  } catch (err) {
    console.error('Failed to enqueue sync mutation:', err);
  }
}

function dequeueSyncMutation(action, itemId) {
  try {
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]');
    const cleanQueue = queue.filter(item => {
      const itemIsDelete = item.action === 'delete' || item.action === 'delete_template' || item.action === 'delete_note' || item.action === 'permanent_delete_note' || item.action === 'restore_note' || item.action === 'upsert';
      const itemKey = itemIsDelete ? item.payload : (item.payload && item.payload.id ? item.payload.id : item.payload);
      return !(item.action === action && itemKey === itemId);
    });
    localStorage.setItem('money_manager_sync_queue', JSON.stringify(cleanQueue));
  } catch (err) {
    console.error('Failed to dequeue sync mutation:', err);
  }
}

let _isProcessingSyncQueue = false;

// skipReload: when true, do NOT call loadData/updateUI after processing (used by forceSyncNow
// which handles its own full re-fetch and UI update, preventing double renders).
async function processSyncQueue(options = {}) {
  const skipReload = !!options.skipReload;
  if (_isProcessingSyncQueue) return;
  if (!state.isSupabaseEnabled || !state.supabaseClient || !state.currentUser) return;

  const queueStr = localStorage.getItem('money_manager_sync_queue');
  if (!queueStr) return;

  let queue = [];
  try {
    queue = JSON.parse(queueStr) || [];
  } catch (e) {
    console.error('Failed to parse sync queue:', e);
    return;
  }

  if (queue.length === 0) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  _isProcessingSyncQueue = true;

  // Durable tombstone guard: any queued mutation whose target transaction has been
  // permanently deleted must be dropped, so a stale queued 'save'/'upsert' can never
  // resurrect a permanently-deleted transaction on the cloud.
  let permanentlyDeletedSet = null;
  try {
    permanentlyDeletedSet = new Set(Array.from(collectPermanentlyDeletedTxIds()).map(String));
  } catch (err) {
    console.warn('Failed to collect permanently deleted IDs in processSyncQueue:', err);
  }

  let successCount = 0;
  const remaining = [];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    let itemSucceeded = false;
    try {
      if (item.action === 'save') {
        const transaction = item.payload;
        if (!transaction || !transaction.id) {
          console.warn('Skipping invalid sync queue item (missing payload or id):', item);
          continue;
        }
        // Drop stale save mutations for permanently-deleted transactions.
        if (permanentlyDeletedSet && permanentlyDeletedSet.has(String(transaction.id))) {
          console.warn('Dropping stale sync queue save for permanently-deleted transaction:', transaction.id);
          continue;
        }
        const { description, is_shared, photo_local_uri, photo_url, receipt, fx_snapshot, ...dbPayload } = mapTransactionToDb(transaction);

        // PREMIUM GATE: Free plan allows up to PREMIUM_LIMITS.cloudTxPerMonth
        // cloud-synced transactions per month. If at the limit and not Premium,
        // defer this save (keep it in the queue for later) instead of syncing.
        if (!isPremium()) {
          try {
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            const { count } = await promiseTimeout(
              state.supabaseClient
                .from('transactions')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', state.currentUser.id)
                .eq('status', 'active')
                .gte('created_at', monthStart.toISOString())
                .then(r => r),
              8000
            ).catch(() => ({ count: 0 }));
            if ((count || 0) >= PREMIUM_LIMITS.cloudTxPerMonth) {
              // Keep the item queued for later (do not drop it).
              remaining.push(item);
              showSyncToast(
                state.lang === 'el'
                  ? `⭐ Έφτασες το μηνιαίο όριο cloud (${PREMIUM_LIMITS.cloudTxPerMonth}). Η κίνηση μένει τοπικά. Αναβάθμισε σε Premium για απεριόριστες κινήσεις!`
                  : `⭐ You reached the monthly cloud limit (${PREMIUM_LIMITS.cloudTxPerMonth}). The transaction stays local. Upgrade to Premium for unlimited transactions!`,
                4000
              );
              continue;
            }
          } catch (err) {
            console.warn('Cloud limit check failed in processSyncQueue:', err);
          }
        }

        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .upsert([dbPayload]),
          15000
        );

        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn(`Skipping invalid sync queue item:`, error);
          
          const isFkFamily = error.message && error.message.includes('transactions_family_id_fkey');
          if (isFkFamily && state.currentUser) {
            // Auto-heal: The user's cached family_id is stale (e.g. they left or recreated a family on another device).
            // We fetch their fresh profile, update the transaction to match their real current status, and keep it in the queue to retry.
            console.log('[Auto-Heal] Refreshing profile to fix stale family_id constraint...');
            if (typeof loadUserProfiles === 'function') {
              await loadUserProfiles(state.currentUser);
            }
            // Update the transaction in local memory to use the correct family_id (or null if they have no family anymore)
            const freshFamilyId = state.userProfile ? state.userProfile.family_id : null;
            transaction.family_id = freshFamilyId;
            transaction.is_shared = !!freshFamilyId;
            item.payload = transaction;
            
            // Apply it to the local cache too so the UI updates
            const localIndex = state.transactions.findIndex(t => t.id === transaction.id);
            if (localIndex !== -1) {
              state.transactions[localIndex].family_id = freshFamilyId;
              state.transactions[localIndex].is_shared = !!freshFamilyId;
              localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
              if (typeof flushUI === 'function') flushUI();
            }
            
            // Push back to remaining to retry on the next sync cycle
            remaining.push(item);
            continue;
          }

          // Drop permanent schema / type errors (e.g. invalid UUID 22P02) so they don't block the queue forever
          const isPermanent = error.code === '22P02' ||
            (error.message && (error.message.includes('uuid') || error.message.includes('syntax') || error.message.includes('violates foreign key')));
          
          if (!isPermanent) {
            remaining.push(item);
          } else {
            // It is an unrecoverable permanent error. Drop it from the queue AND remove the "ghost" from the UI.
            console.error('[Sync] Dropping unrecoverable transaction from queue AND local cache:', transaction.id);
            if (typeof deleteTransactionOffline === 'function') {
              deleteTransactionOffline(transaction.id, true);
              if (typeof flushUI === 'function') flushUI();
            }
            if (typeof showSyncToast === 'function') {
              const msg = state.lang === 'el' 
                ? '❌ Σφάλμα: Μία συναλλαγή διαγράφηκε λόγω μη έγκυρων δεδομένων.' 
                : '❌ Sync failed: A transaction was deleted due to invalid data.';
              showSyncToast(msg, 5000);
            }
          }
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'delete') {
        const transId = item.payload;
        if (!transId || String(transId).startsWith('recurring_')) {
          console.warn('Skipping invalid sync queue delete item (missing or non-uuid id):', item);
          continue;
        }
        // Status model: offline deletes soft-delete via status='deleted' so the
        // transaction stays restorable in the trash across all devices.
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .update({
              status: 'deleted',
              deleted_at: new Date().toISOString(),
              deleted_by: state.currentUser.id
            })
            .eq('id', transId),
          15000
        );

        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn(`Skipping invalid sync queue delete item:`, error);
          const isPermanent = error.code === '22P02' || (error.message && error.message.includes('uuid'));
          if (!isPermanent) {
            remaining.push(item);
          }
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'save_template') {
        const template = item.payload;
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('recurring_templates')
            .upsert([mapTemplateToDb(template)]),
          15000
        );
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn(`Skipping invalid save_template queue item:`, error);
          remaining.push(item);
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'delete_template') {
        const templateId = item.payload;
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('recurring_templates')
            .delete()
            .eq('id', templateId),
          15000
        );
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn(`Skipping invalid delete_template queue item:`, error);
          remaining.push(item);
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'upsert') {
        // Restore-from-trash queued action. The payload is the transaction id.
        // The transaction was soft-deleted (status='deleted'); restoring flips it
        // back to 'active' so it reappears on all devices.
        const transId = item.payload;
        if (!transId) {
          console.warn('Skipping invalid sync queue upsert item (missing id):', item);
          continue;
        }
        // Drop stale restore mutations for permanently-deleted transactions — a
        // permanently-deleted transaction must never be re-activated.
        if (permanentlyDeletedSet && permanentlyDeletedSet.has(String(transId))) {
          console.warn('Dropping stale sync queue upsert (restore) for permanently-deleted transaction:', transId);
          continue;
        }
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .update({ status: 'active', deleted_at: null, deleted_by: null })
            .eq('id', transId),
          15000
        );
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn(`Skipping invalid sync queue upsert item:`, error);
          remaining.push(item);
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'save_note') {
        const note = item.payload;
        if (!note || !note.id) {
          console.warn('Skipping invalid save_note queue item:', item);
          continue;
        }
        const familyId = state.userProfile ? state.userProfile.family_id : null;
        const dbRecord = mapNoteToDb(note, state.currentUser.id, familyId);
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('notes')
            .upsert([dbRecord]),
          15000
        );
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn('Skipping invalid save_note queue item:', error);
          remaining.push(item);
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'delete_note') {
        const noteId = item.payload;
        if (!noteId) {
          console.warn('Skipping invalid delete_note queue item:', item);
          continue;
        }
        const now = new Date().toISOString();
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('notes')
            .update({
              status: 'deleted',
              deleted_at: now,
              deleted_by: state.currentUser.id,
              updated_at: now
            })
            .eq('id', noteId),
          15000
        );
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn('Skipping invalid delete_note queue item:', error);
          remaining.push(item);
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'permanent_delete_note') {
        const noteId = item.payload;
        if (!noteId) {
          console.warn('Skipping invalid permanent_delete_note queue item:', item);
          continue;
        }
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('notes')
            .delete()
            .eq('id', noteId),
          15000
        );
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn('Skipping invalid permanent_delete_note queue item:', error);
          remaining.push(item);
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'restore_note') {
        const noteId = item.payload;
        if (!noteId) {
          console.warn('Skipping invalid restore_note queue item:', item);
          continue;
        }
        const now = new Date().toISOString();
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('notes')
            .update({
              status: 'active',
              deleted_at: null,
              deleted_by: null,
              updated_at: now
            })
            .eq('id', noteId),
          15000
        );
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn('Skipping invalid restore_note queue item:', error);
          remaining.push(item);
          continue;
        }
        itemSucceeded = true;
      } else {
        console.warn(`Unknown sync queue action, dropping item:`, item.action);
        continue;
      }
    } catch (err) {
      console.warn(`Network failure during sync queue replay at index ${i}:`, err);
      // Keep this item and all remaining ones for retry to preserve sequence order.
      remaining.push(item);
      for (let j = i + 1; j < queue.length; j++) {
        remaining.push(queue[j]);
      }
      break;
    }

    if (itemSucceeded) {
      successCount++;
    }
  }

  const queueChanged = remaining.length !== queue.length;
  if (successCount > 0 || queueChanged) {
    localStorage.setItem('money_manager_sync_queue', JSON.stringify(remaining));
  }
  state.syncPendingCount = remaining.length;
  updateSyncStatusIndicator();

  // Only reload and render here if the caller didn't request to skip it.
  // When called from forceSyncNow, skipReload=true because forceSyncNow does its own
  // full fetch + UI update immediately after, so we avoid a double render.
  if (successCount > 0 && !skipReload) {
    await loadData();
    updateUI();
  }

  _isProcessingSyncQueue = false;
}

let _supabaseRealtimeChannel = null;
let _realtimeReconnectTimer = null;
let _realtimeWatchdogInterval = null;
let _syncQueueWorkerInterval = null;

function _scheduleRealtimeReconnect(delayMs = 3000) {
  if (_realtimeReconnectTimer) return;
  _realtimeReconnectTimer = setTimeout(() => {
    _realtimeReconnectTimer = null;
    if (state.supabaseClient && state.currentUser && navigator.onLine !== false) {
      console.info('[Realtime] Attempting automatic reconnect...');
      setupSupabaseRealtimeSubscription();
    }
  }, delayMs);
}

function _startRealtimeWatchdog() {
  if (_realtimeWatchdogInterval) return;
  _realtimeWatchdogInterval = setInterval(() => {
    if (!state.supabaseClient || !state.currentUser || navigator.onLine === false) return;
    if (document.visibilityState === 'hidden') return;

    const isJoined = _supabaseRealtimeChannel && _supabaseRealtimeChannel.state === 'joined';
    if (!isJoined) {
      console.info('[RealtimeWatchdog] Channel not joined (state=' + (_supabaseRealtimeChannel ? _supabaseRealtimeChannel.state : 'null') + '), reconnecting...');
      setupSupabaseRealtimeSubscription();
    }
  }, 25000);
}

function _startSyncQueueWorker() {
  if (_syncQueueWorkerInterval) return;
  _syncQueueWorkerInterval = setInterval(async () => {
    if (!state.supabaseClient || !state.currentUser || navigator.onLine === false) return;
    try {
      const queueStr = localStorage.getItem('money_manager_sync_queue');
      if (queueStr) {
        const q = JSON.parse(queueStr) || [];
        if (q.length > 0 && typeof processSyncQueue === 'function' && !_isProcessingSyncQueue) {
          console.info(`[SyncQueueWorker] Flushing ${q.length} pending mutations...`);
          await processSyncQueue({ skipReload: true });
        }
      }
    } catch (_) {}
  }, 12000);
}

function setupSupabaseRealtimeSubscription() {
  if (!state.supabaseClient || !state.currentUser) return;

  if (_supabaseRealtimeChannel) {
    try {
      state.supabaseClient.removeChannel(_supabaseRealtimeChannel);
    } catch (_) {}
    _supabaseRealtimeChannel = null;
  }

  const userId = state.currentUser.id;
  let partnerId = state.partnerProfile ? (state.partnerProfile.id || state.partnerProfile.user_id) : null;
  let familyId = state.userProfile ? state.userProfile.family_id : null;

  // Fallback to cached profiles if not yet loaded in memory
  if (!familyId) {
    try {
      const cached = JSON.parse(localStorage.getItem('cached_user_profile') || '{}');
      if (cached && cached.family_id) familyId = cached.family_id;
    } catch (_) {}
  }
  if (!partnerId) {
    try {
      const cachedPartner = JSON.parse(localStorage.getItem('cached_partner_profile') || '{}');
      if (cachedPartner && (cachedPartner.id || cachedPartner.user_id)) {
        partnerId = cachedPartner.id || cachedPartner.user_id;
      }
    } catch (_) {}
  }

  _supabaseRealtimeChannel = state.supabaseClient.channel('realtime-sync-' + Date.now());

  // 1. Always listen for personal changes by user_id
  _supabaseRealtimeChannel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
    handleRealtimeTransactionChange
  ).on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${userId}` },
    handleRealtimeCategoryChange
  );

  // 2. If in family, also listen for family changes
  if (familyId) {
    _supabaseRealtimeChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions', filter: `family_id=eq.${familyId}` },
      handleRealtimeTransactionChange
    ).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'categories', filter: `family_id=eq.${familyId}` },
      handleRealtimeCategoryChange
    );
  }

  // 3. If partner present, also listen for partner changes
  if (partnerId && partnerId !== userId) {
    _supabaseRealtimeChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${partnerId}` },
      handleRealtimeTransactionChange
    ).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${partnerId}` },
      handleRealtimeCategoryChange
    );
  }

  _supabaseRealtimeChannel.subscribe((status, err) => {
    if (status === 'SUBSCRIBED') {
      console.info('[Realtime] Subscribed to sync channel successfully');
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      console.warn(`[Realtime] Subscription status: ${status}`, err);
      _scheduleRealtimeReconnect(3000);
    }
  });

  _startRealtimeWatchdog();
  _startSyncQueueWorker();
}

function stopSupabaseRealtimeSubscription() {
  if (_supabaseRealtimeChannel && state.supabaseClient) {
    try {
      state.supabaseClient.removeChannel(_supabaseRealtimeChannel);
    } catch (_) {}
    _supabaseRealtimeChannel = null;
  }
  if (_realtimeWatchdogInterval) {
    clearInterval(_realtimeWatchdogInterval);
    _realtimeWatchdogInterval = null;
  }
  if (_realtimeReconnectTimer) {
    clearTimeout(_realtimeReconnectTimer);
    _realtimeReconnectTimer = null;
  }
}

// Debounce timer for realtime changes — prevents rapid-fire UI re-renders when
// multiple INSERT/UPDATE/DELETE events arrive in quick succession (e.g. after bulk upsert).
let _realtimeDebounceTimer = null;
let _pendingRealtimeEvents = [];

// Flag: set to true during internal cleanup (e.g. duplicate deletion) so that
// the resulting DB DELETE events do NOT trigger a UI re-render / flicker.
let _suppressRealtimeEventsCount = 0;
Object.defineProperty(window, '_suppressRealtimeEvents', {
  get: () => _suppressRealtimeEventsCount > 0,
  set: (val) => {
    if (val) {
      _suppressRealtimeEventsCount++;
    } else {
      _suppressRealtimeEventsCount = Math.max(0, _suppressRealtimeEventsCount - 1);
    }
  },
  configurable: true
});

// Increment the suppression counter and ALWAYS schedule a matching decrement
// after delayMs. Safe to call multiple times concurrently — each call adds its
// own independent decrement, so the counter can never get stuck.
function suppressRealtimeFor(delayMs) {
  _suppressRealtimeEvents = true;
  setTimeout(() => {
    _suppressRealtimeEvents = false;
  }, delayMs);
}

function handleRealtimeTransactionChange(payload) {
  const isDelete = payload.eventType === 'DELETE';
  const eventId = isDelete ? (payload.old && payload.old.id) : (payload.new && payload.new.id);

  // 1. If it's a delete event of a transaction we are actively deleting locally, always suppress it
  if (isDelete && eventId && _deletingTxIds.has(String(eventId))) {
    return;
  }

  // 2. If global suppression is active, only suppress our own events, let partner events pass
  if (_suppressRealtimeEvents) {
    const isPartnerEvent = isDelete
      ? true // Since it's a delete and not in our deleting set, it's a partner delete
      : (payload.new && state.currentUser && payload.new.user_id !== state.currentUser.id);

    if (!isPartnerEvent) {
      return;
    }
  }

  // Accumulate events, then apply them all at once after a short delay (150ms for near-instant cross-device updates).
  _pendingRealtimeEvents.push(payload);

  const _realtimeDebounceMs = 150;

  if (_realtimeDebounceTimer) clearTimeout(_realtimeDebounceTimer);
  _realtimeDebounceTimer = setTimeout(() => {
    const events = _pendingRealtimeEvents.slice();
    _pendingRealtimeEvents = [];
    _realtimeDebounceTimer = null;

    let trans = [...state.transactions];
    let changed = false;
    let insertedByPartner = false;

    // Collect active in-flight deletions
    const inFlightDeletionIds = new Set();
    const addInFlight = (id) => { if (id !== null && id !== undefined && id !== '') inFlightDeletionIds.add(String(id)); };
    if (typeof _deletingTxIds !== 'undefined' && _deletingTxIds) _deletingTxIds.forEach(addInFlight);
    if (typeof _recentlyDeletedTxIds !== 'undefined' && _recentlyDeletedTxIds) _recentlyDeletedTxIds.forEach(addInFlight);
    try {
      const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]') || [];
      queue.forEach(item => {
        if (item && (item.action === 'delete' || item.action === 'permanent_delete_tx') && item.payload) {
          addInFlight(item.payload);
        }
      });
    } catch (_) { }

    events.forEach(ev => {
      const eventType = ev.eventType;
      if (eventType === 'INSERT') {
        const newTrans = ev.new;
        if (newTrans && newTrans.id) {
          const idStr = String(newTrans.id);
          if (inFlightDeletionIds.has(idStr)) {
            return;
          }
          // Reconcile stale tombstone
          try {
            reconcileStaleTombstones([newTrans]);
          } catch (_) { }
        }
        if (!trans.some(t => t.id === newTrans.id)) {
          trans.unshift(newTrans);
          changed = true;
          if (newTrans && state.currentUser && newTrans.user_id !== state.currentUser.id) {
            insertedByPartner = true;
            if (newTrans.type === 'expense') {
              checkHighExpenseAlert(newTrans);
            }
          }
        }
      } else if (eventType === 'UPDATE') {
        const updatedTrans = ev.new;
        const idx = trans.findIndex(t => t.id === updatedTrans.id);
        if (idx !== -1) {
          if (updatedTrans.status === 'deleted') {
            trans.splice(idx, 1);
            changed = true;
          } else {
            trans[idx] = updatedTrans;
            changed = true;
            if (updatedTrans && state.currentUser && updatedTrans.user_id !== state.currentUser.id && updatedTrans.type === 'expense') {
              checkHighExpenseAlert(updatedTrans);
            }
          }
        }
      } else if (eventType === 'DELETE') {
        const deletedId = ev.old && ev.old.id;
        if (deletedId && trans.some(t => t.id === deletedId)) {
          trans = trans.filter(t => t.id !== deletedId);
          changed = true;
        }
      }
    });

    // Only update UI if something actually changed
    if (!changed) {
      return;
    }

    trans.sort(compareTransactions);

    state.transactions = trans;
    localStorage.setItem('offline_transactions', JSON.stringify(trans));

    calculateInitialBalances();
    // ANTI-FLICKER FIX (resume flash): Wrap the re-render in no-transition so a
    // realtime event arriving during the resume cycle (after re-subscribing) does
    // not cause a visible flash. Previously this was gated only on the short-lived
    // _appJustResumed flag, which expires at _RESUME_GUARD_MS (~1.7s) while the
    // 5s debounce below still fires - leaving the reconnect batch re-render
    // UNCOVERED with transitions enabled. _isWithinResumeWindow() covers the full
    // reconnect window. Uses the reference-counted guard so guards never race.
    const _inResumeWindow = _isWithinResumeWindow(_REALTIME_RESUME_GUARD_MS);
    if (_inResumeWindow) pushNoTransition();
    updateUI();
    if (_inResumeWindow) {
      setTimeout(() => {
        popNoTransition();
      }, 800);
    }

    if (insertedByPartner) {
      showSyncToast('📥 Νέα κίνηση προστέθηκε από άλλο μέλος', 3000);
    }
  }, _realtimeDebounceMs); // 300ms for partner events (near-instant), 5000ms for own bulk events (anti-flicker batching)
}

function handleRealtimeCategoryChange(payload) {
  // Ignore events generated by our own internal cleanup operations.
  if (_suppressRealtimeEvents) {
    return;
  }

  let cats = [...state.categories];
  const eventType = payload.eventType;

  if (eventType === 'INSERT') {
    const newCat = payload.new;
    if (!cats.some(c => c.id === newCat.id)) {
      cats.push(newCat);
    }
  } else if (eventType === 'UPDATE') {
    const updatedCat = payload.new;
    cats = cats.map(c => c.id === updatedCat.id ? updatedCat : c);
  } else if (eventType === 'DELETE') {
    const deletedId = payload.old.id;
    cats = cats.filter(c => c.id !== deletedId);
  }

  state.categories = cats;
  localStorage.setItem('offline_categories', JSON.stringify(cats));

  // ANTI-FLICKER FIX (resume flash): Same resume-cycle guard as
  // handleRealtimeTransactionChange (see there for details). Covers the full
  // 5s reconnect debounce window instead of the short-lived _appJustResumed flag.
  // Uses the reference-counted guard so overlapping guards never race.
  const _inResumeWindow = _isWithinResumeWindow(_REALTIME_RESUME_GUARD_MS);
  if (_inResumeWindow) pushNoTransition();
  updateUI();
  if (_inResumeWindow) {
    setTimeout(() => {
      popNoTransition();
    }, 800);
  }
}

window.generateUUID = generateUUID;
window.enqueueSyncMutation = enqueueSyncMutation;
window.processSyncQueue = processSyncQueue;
window.setupSupabaseRealtimeSubscription = setupSupabaseRealtimeSubscription;
window.stopSupabaseRealtimeSubscription = stopSupabaseRealtimeSubscription;

// Handle online connectivity restore events
window.addEventListener('online', () => {

  // Re-establish the Supabase session now that we are online again. If the
  // access token expired while offline (which triggered a null-session auth
  // event that we intentionally ignored), this refresh restores a valid
  // session so cloud sync resumes. If the refresh token itself was rejected,
  // getSession() returns no session and the normal auth flow takes over.
  const refreshSessionAndProfile = async () => {
    if (!state.supabaseClient) return;
    try {
      const { data } = await state.supabaseClient.auth.getSession();
      if (data && data.session && data.session.user) {
        state.currentUser = data.session.user;
        localStorage.setItem('cached_current_user', JSON.stringify(data.session.user));
        updateHeaderSyncIcon('synced');
        // PREMIUM FIX: Refresh the authoritative user profile BEFORE replaying
        // the sync queue. Without this, isPremium() can read a stale/null
        // state.userProfile (e.g. from before Premium was activated) and
        // incorrectly trigger the monthly cloud-limit toast for a Premium user.
        if (typeof loadUserProfiles === 'function') {
          await loadUserProfiles(data.session.user);
        }
      }
    } catch (err) {
      // Session refresh failed; fall through to queue replay which will
      // surface any auth errors gracefully.
      console.warn('Online session/profile refresh failed:', err);
    }
  };

  refreshSessionAndProfile().finally(() => {
    processSyncQueue();
    if (typeof setupSupabaseRealtimeSubscription === 'function') {
      setupSupabaseRealtimeSubscription();
    }
  });
});

// ============================================================
// REAL-TIME PARTNER SYNC POLLING
// Every 15 seconds, if logged in, silently refresh data
// ============================================================
let _partnerSyncInterval = null;

// Sync status tracking
state.lastSyncTime = state.lastSyncTime || null;
state.syncStatus = state.syncStatus || 'idle'; // 'idle' | 'syncing' | 'success' | 'error'
state.syncPendingCount = state.syncPendingCount || 0;

function updateSyncStatusIndicator() {
  const dot = document.getElementById('header-sync-dot');
  const icon = document.getElementById('header-sync-cloud-icon');
  const btn = document.getElementById('header-sync-icon');

  if (state.currentUser) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      state.syncStatus = 'offline';
    } else if (state.syncStatus === 'error') {
      if (!state._syncErrorTimestamp) state._syncErrorTimestamp = Date.now();
      if (Date.now() - state._syncErrorTimestamp > 4000) {
        state.syncStatus = 'synced';
        state._syncErrorTimestamp = null;
      }
    } else if (!state.syncStatus || state.syncStatus === 'idle' || state.syncStatus === 'offline') {
      state.syncStatus = 'synced';
    }
  } else {
    state.syncStatus = 'offline';
  }

  const colors = {
    idle: '#9e9e9e',
    offline: '#9e9e9e',
    syncing: '#ffb300',
    success: '#4caf50',
    synced: '#4caf50',
    error: '#e05e55'
  };

  if (dot) {
    dot.style.background = colors[state.syncStatus] || colors.idle;
    // Animate dot on sync
    if (state.syncStatus === 'syncing') {
      dot.style.animation = 'syncDotPulse 0.8s infinite alternate';
    } else {
      dot.style.animation = 'none';
    }

    // Inject dot keyframes once
    if (!document.getElementById('sync-dot-styles')) {
      const s = document.createElement('style');
      s.id = 'sync-dot-styles';
      s.innerHTML = `@keyframes syncDotPulse { from { transform: scale(1); opacity: 0.6; } to { transform: scale(1.4); opacity: 1; } }`;
      document.head.appendChild(s);
    }
  }

  if (icon) {
    if (state.syncStatus === 'syncing') {
      icon.className = 'fa-solid fa-cloud-arrow-up';
    } else if (state.syncStatus === 'error') {
      icon.className = 'fa-solid fa-cloud-bolt';
    } else {
      icon.className = 'fa-solid fa-cloud';
    }
  }

  // Update tooltip with last sync time
  if (btn) {
    let tooltip = state.lang === 'en' ? 'Cloud Account' : 'Λογαριασμός Cloud';
    if (state.lastSyncTime) {
      const d = new Date(state.lastSyncTime);
      const timeStr = d.toLocaleTimeString(state.lang === 'el' ? 'el-GR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
      tooltip += ' • ' + (state.lang === 'en' ? 'Last sync: ' : 'Τελ. συγχρονισμός: ') + timeStr;
    }
    if (state.syncPendingCount > 0) {
      tooltip += ' • ' + state.syncPendingCount + ' ' + (state.lang === 'en' ? 'pending' : 'εκκρεμούν');
    }
    btn.title = tooltip;
  }

  // Update sync status text in settings (check both element IDs)
  const syncStatusEl = document.getElementById('sync-status-label') || document.getElementById('val_sync_status');
  if (syncStatusEl) {
    const lang = state.lang || 'el';
    if (!state.currentUser) {
      syncStatusEl.textContent = lang === 'en' ? 'Local Storage' : 'Τοπική Αποθήκευση';
      syncStatusEl.style.color = 'var(--text-muted)';
    } else {
      const email = state.currentUser.email ? state.currentUser.email.split('@')[0] : '';
      if (state.syncStatus === 'syncing') {
        syncStatusEl.textContent = lang === 'en' ? 'Syncing...' : 'Συγχρονισμός...';
        syncStatusEl.style.color = '#ffb300';
      } else if (state.syncStatus === 'error') {
        syncStatusEl.textContent = lang === 'en' ? 'Sync Error' : 'Σφάλμα Συγχρονισμού';
        syncStatusEl.style.color = '#ef5350';
      } else {
        const userLabel = email ? ` (${email})` : '';
        syncStatusEl.textContent = lang === 'en' ? `Cloud Active${userLabel}` : `Cloud Ενεργός${userLabel}`;
        syncStatusEl.style.color = '#4caf50';
      }
    }
  }
}

// ============================================================
// INCREMENTAL SYNC INFRASTRUCTURE
// ============================================================
// Lossless incremental sync using a composite cursor (updated_at, id) for
// keyset pagination. The full re-fetch in forceSyncNow() remains the durable
// fallback; incremental is an optimization layered on top, gated by a flag.
// ============================================================

const SYNC_CURSORS_KEY = 'sync_cursors_v1';
const SYNC_INCREMENTAL_FLAG = 'sync_incremental_enabled';
const SYNC_FULL_INTERVAL_MS = 24 * 60 * 60 * 1000; // full reconcile every 24h (was 7 days) to self-heal lost realtime events faster

function isIncrementalSyncEnabled() {
  try {
    return localStorage.getItem(SYNC_INCREMENTAL_FLAG) === '1';
  } catch (e) { return false; }
}

function setIncrementalSyncEnabled(enabled) {
  try {
    localStorage.setItem(SYNC_INCREMENTAL_FLAG, enabled ? '1' : '0');
  } catch (e) { /* ignore */ }
}

// Probe whether the live schema supports incremental sync (i.e. the migration
// has been applied and transactions.updated_at exists). If it does, auto-enable
// the flag so rollout is automatic once the migration is deployed. If the probe
// fails or the column is absent, keep the flag off (full sync remains safe).
// Cached per session to avoid a probe on every sync.
let _incrementalCapabilityChecked = false;
async function ensureIncrementalSyncCapability() {
  if (_incrementalCapabilityChecked) return isIncrementalSyncEnabled();
  _incrementalCapabilityChecked = true;
  if (!state.supabaseClient || !state.currentUser) return false;
  try {
    const { data, error } = await promiseTimeout(
      state.supabaseClient
        .from('transactions')
        .select('updated_at')
        .limit(1),
      8000
    );
    // If the column exists, the query succeeds (even with 0 rows). If the
    // migration hasn't been applied, PostgREST returns a 42703 column error.
    if (error) {
      console.warn('[IncrementalSync] schema probe failed, keeping full sync:', error.message || error);
      setIncrementalSyncEnabled(false);
      return false;
    }
    setIncrementalSyncEnabled(true);
    return true;
  } catch (err) {
    console.warn('[IncrementalSync] schema probe error, keeping full sync:', err);
    setIncrementalSyncEnabled(false);
    return false;
  }
}

function getSyncCursors() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_CURSORS_KEY) || '{}');
  } catch (e) { return {}; }
}

function saveSyncCursors(cursors) {
  try {
    localStorage.setItem(SYNC_CURSORS_KEY, JSON.stringify(cursors));
  } catch (e) { /* ignore */ }
}

// A cursor is { ts: <ISO string>, id: <uuid> }. Returns null if not set.
function getTableCursor(cursors, table) {
  const c = cursors && cursors[table];
  if (!c || !c.ts || !c.id) return null;
  return c;
}

// Write durable tombstones for deleted rows so other devices can apply the
// deletion without a full re-fetch. Best-effort; never throws.
async function writeSyncTombstones(tableName, rowIds) {
  if (!state.supabaseClient || !state.currentUser) return;
  if (!Array.isArray(rowIds) || rowIds.length === 0) return;
  const userId = state.currentUser.id;
  const familyId = state.userProfile ? state.userProfile.family_id : null;
  const rows = rowIds.map(rid => ({
    table_name: tableName,
    row_id: rid,
    user_id: userId,
    family_id: familyId
  }));
  try {
    await promiseTimeout(
      state.supabaseClient.from('sync_tombstones').upsert(rows, { onConflict: 'table_name,row_id' }),
      8000
    );
  } catch (err) {
    console.warn('[IncrementalSync] tombstone write failed:', err);
  }
}

function resetSyncCursors() {
  try {
    localStorage.removeItem(SYNC_CURSORS_KEY);
    localStorage.removeItem('sync_last_full_ts');
  } catch (e) { /* ignore */ }
}

// Should we run a full re-fetch this cycle instead of incremental?
function shouldFullSync() {
  // If local transactions array is empty or offline_transactions is missing,
  // incremental sync CANNOT work (there is no local baseline to apply diffs to).
  // A full re-fetch is mandatory to load all transactions from the cloud.
  const offlineTrans = localStorage.getItem('offline_transactions');
  if (!offlineTrans || !Array.isArray(state.transactions) || state.transactions.length === 0) {
    return true;
  }
  // No cursor baseline yet → must full sync to establish it.
  const cursors = getSyncCursors();
  if (!getTableCursor(cursors, 'transactions')) return true;
  // Periodic full reconcile to catch any drift / lost realtime events.
  const lastFull = parseInt(localStorage.getItem('sync_last_full_ts') || '0', 10);
  if (Date.now() - lastFull > SYNC_FULL_INTERVAL_MS) return true;
  return false;
}

function markFullSyncDone() {
  try {
    localStorage.setItem('sync_last_full_ts', String(Date.now()));
  } catch (e) { /* ignore */ }
}

// Build the scope filter string (family/partner/user) reused by incremental
// queries. Returns a PostgREST or-filter string (comma-separated OR list).
function buildIncrementalScopeString() {
  const userId = state.currentUser.id;
  const partnerId = state.partnerProfile ? state.partnerProfile.id : null;
  const familyId = state.userProfile ? state.userProfile.family_id : null;
  if (familyId && partnerId) {
    return `family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}`;
  } else if (familyId) {
    return `family_id.eq.${familyId},user_id.eq.${userId}`;
  } else if (partnerId) {
    return `user_id.eq.${userId},user_id.eq.${partnerId}`;
  }
  return `user_id.eq.${userId}`;
}

// Combine the scope OR-list with an optional keyset predicate into a single
// PostgREST or-filter. The keyset predicate is:
//   updated_at > ts OR (updated_at = ts AND id > lastId)
// ANDed with the scope. PostgREST supports nested and()/or().
function buildIncrementalFilter(scopeStr, tsCol, ts, id) {
  if (!ts || !id) return scopeStr; // first page: scope only
  const keyset = `or(${tsCol}.gt.${ts},and(${tsCol}.eq.${ts},id.gt.${id}))`;
  return `and(${scopeStr},${keyset})`;
}

// Keyset-paginated incremental fetch of transactions changed since the cursor.
// Returns { rows, nextCursor } where nextCursor is the last consumed (updated_at, id).
async function fetchIncrementalTransactions(cursor) {
  const pageSize = 1000;
  let allRows = [];
  let lastTs = cursor ? cursor.ts : null;
  let lastId = cursor ? cursor.id : null;
  let hasMore = true;
  const scopeStr = buildIncrementalScopeString();

  while (hasMore) {
    let q = state.supabaseClient
      .from('transactions')
      .select('*')
      .eq('status', 'active')
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(pageSize);

    q = q.or(buildIncrementalFilter(scopeStr, 'updated_at', lastTs, lastId));

    const { data, error } = await promiseTimeout(q, 15000);
    if (error) throw error;

    const page = data || [];
    if (page.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(page);
      const lastRow = page[page.length - 1];
      lastTs = lastRow.updated_at;
      lastId = lastRow.id;
      if (page.length < pageSize) hasMore = false;
    }
  }

  return {
    rows: allRows,
    nextCursor: allRows.length > 0 ? { ts: lastTs, id: lastId } : (cursor || null)
  };
}

// Pull tombstones newer than the cursor and apply local deletions.
async function fetchIncrementalTombstones(cursor) {
  const pageSize = 1000;
  let allTombstones = [];
  let lastTs = cursor ? cursor.ts : null;
  let lastId = cursor ? cursor.id : null;
  let hasMore = true;
  const scopeStr = buildIncrementalScopeString();

  while (hasMore) {
    let q = state.supabaseClient
      .from('sync_tombstones')
      .select('*')
      .order('deleted_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(pageSize);

    q = q.or(buildIncrementalFilter(scopeStr, 'deleted_at', lastTs, lastId));

    const { data, error } = await promiseTimeout(q, 15000);
    if (error) throw error;

    const page = data || [];
    if (page.length === 0) {
      hasMore = false;
    } else {
      allTombstones = allTombstones.concat(page);
      const lastRow = page[page.length - 1];
      lastTs = lastRow.deleted_at;
      lastId = lastRow.id;
      if (page.length < pageSize) hasMore = false;
    }
  }

  return {
    rows: allTombstones,
    nextCursor: allTombstones.length > 0 ? { ts: lastTs, id: lastId } : (cursor || null)
  };
}

// Apply incremental transaction rows + tombstones into local state.
function applyIncrementalTransactions(newRows, tombstones) {
  const current = Array.isArray(state.transactions) ? state.transactions : [];
  const byId = new Map(current.map(t => [String(t.id), t]));

  // CLOUD-AUTHORITY PRINCIPLE: Rows returned by incremental fetch are active in
  // the cloud (status='active'). Only skip if actively being deleted right now
  // (in-flight, 30s grace window, or pending in sync queue).
  const inFlightDeletionIds = new Set();
  const addInFlight = (id) => { if (id !== null && id !== undefined && id !== '') inFlightDeletionIds.add(String(id)); };
  if (typeof _deletingTxIds !== 'undefined' && _deletingTxIds) _deletingTxIds.forEach(addInFlight);
  if (typeof _recentlyDeletedTxIds !== 'undefined' && _recentlyDeletedTxIds) _recentlyDeletedTxIds.forEach(addInFlight);
  try {
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]') || [];
    queue.forEach(item => {
      if (item && (item.action === 'delete' || item.action === 'permanent_delete_tx') && item.payload) {
        addInFlight(item.payload);
      }
    });
  } catch (_) { }

  // Reconcile stale tombstones for incoming active cloud rows
  if (newRows && newRows.length > 0) {
    try {
      reconcileStaleTombstones(newRows);
    } catch (_) { }
  }

  // Upsert changed/new rows, skipping only those actively being deleted.
  (newRows || []).forEach(t => {
    if (t && t.id && inFlightDeletionIds.has(String(t.id))) {
      return;
    }
    byId.set(String(t.id), t);
  });

  // Apply deletions from tombstones (only for transactions).
  (tombstones || []).forEach(tb => {
    if (tb.table_name === 'transactions') {
      byId.delete(String(tb.row_id));
    }
  });

  const merged = Array.from(byId.values());
  merged.sort(compareTransactions);
  state.transactions = merged;
  localStorage.setItem('offline_transactions', JSON.stringify(merged));
  if (state.currentUser && state.currentUser.id) {
    localStorage.setItem('offline_transactions_owner', state.currentUser.id);
  }
}

let _forceSyncInFlight = null;

async function forceSyncNow(silent = false) {
  if (!state.supabaseClient || !state.currentUser) {
    if (!silent) {
      const msg = (state.lang === 'el')
        ? '☁️ Παρακαλώ συνδεθείτε πρώτα για συγχρονισμό στο Cloud.'
        : '☁️ Please log in first to sync to the Cloud.';
      if (typeof showSyncToast === 'function') {
        showSyncToast(msg, 3500);
      }
      if (typeof openSupabaseSettings === 'function') {
        openSupabaseSettings();
      }
    }
    return false;
  }

  if (_forceSyncInFlight) {
    return _forceSyncInFlight;
  }

  _forceSyncInFlight = (async () => {
    state.syncStatus = 'syncing';
    updateSyncStatusIndicator();

    // Suppress realtime events for the duration of this sync
    suppressRealtimeFor(4000);

    try {
      const userId = state.currentUser.id;

      // Auto-sync any stuck local transactions (e.g. from guest mode or legacy local_ items)
      await syncLocalTransactionsToCloud(userId, { silent: true });

      // Process offline sync queue (applies offline deletes/saves to cloud) before fetching
      await processSyncQueue({ skipReload: true });

      const partnerId = state.partnerProfile ? state.partnerProfile.id : null;
      const familyId = state.userProfile ? state.userProfile.family_id : null;

      let catsQuery = state.supabaseClient.from('categories').select('*');
      let accsQuery = state.supabaseClient.from('accounts').select('*');
      let tempsQuery = state.supabaseClient.from('recurring_templates').select('*');

      if (familyId && partnerId) {
        const filter = `family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}`;
        catsQuery = catsQuery.or(filter);
        accsQuery = accsQuery.or(filter);
        tempsQuery = tempsQuery.or(filter);
      } else if (familyId) {
        const filter = `family_id.eq.${familyId},user_id.eq.${userId}`;
        catsQuery = catsQuery.or(filter);
        accsQuery = accsQuery.or(filter);
        tempsQuery = tempsQuery.or(filter);
      } else if (partnerId) {
        const filter = `user_id.eq.${userId},user_id.eq.${partnerId}`;
        catsQuery = catsQuery.or(filter);
        accsQuery = accsQuery.or(filter);
        tempsQuery = tempsQuery.or(filter);
      } else {
        catsQuery = catsQuery.eq('user_id', userId);
        accsQuery = accsQuery.eq('user_id', userId);
        tempsQuery = tempsQuery.eq('user_id', userId);
      }

      // 1. Fetch categories, accounts, and recurring templates
      const [catsRes, accsRes, tempsRes] = await promiseTimeout(
        Promise.all([
          catsQuery,
          accsQuery,
          tempsQuery.then(r => r, () => ({ data: [], error: null }))
        ]),
        15000
      );

      if (!catsRes.error && catsRes.data) {
        if (Array.isArray(catsRes.data) && catsRes.data.length > 0) {
          // Cloud has categories -> keep cloud categories, and merge any unsynced local custom categories
          const cloudNames = new Set(catsRes.data.map(c => (c && c.name ? c.name.trim().toLowerCase() : '')));
          const localCustom = (state.categories || []).filter(c => c && c.name && !cloudNames.has(c.name.trim().toLowerCase()) && !c.is_deleted);
          state.categories = [...catsRes.data, ...localCustom];
          deduplicateCategories();
        } else {
          // Cloud categories empty (e.g. newly registered account) -> preserve local categories or seed with defaults
          if (!state.categories || state.categories.length === 0) {
            state.categories = DEFAULT_CATEGORIES.slice();
          }
          // Seed defaults in Supabase in background for this new user
          if (state.currentUser && state.currentUser.id && state.categories.length > 0) {
            const now = new Date().toISOString();
            const catsToInsert = state.categories.map(c => ({
              id: c.id || (typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID()),
              name: c.name,
              type: c.type || 'expense',
              icon: c.icon || 'fa-solid fa-shapes',
              color: c.color || '#78909c',
              user_id: state.currentUser.id,
              family_id: state.userProfile ? state.userProfile.family_id : null,
              created_at: c.created_at || now,
              updated_at: now
            }));
            state.supabaseClient.from('categories').insert(catsToInsert).then(({ error }) => {
              if (error) console.warn('Background category seeding warning:', error);
            });
          }
        }
        localStorage.setItem('offline_categories', JSON.stringify(state.categories));
      }
      if (!accsRes.error && accsRes.data) {
        state.accounts = accsRes.data;
        localStorage.setItem('offline_accounts', JSON.stringify(state.accounts));
      }
      if (tempsRes && tempsRes.data) {
        const cloudTemps = tempsRes.data.map(mapTemplateFromDb);
        state.recurringTemplates = mergeAndDeduplicateTemplates(cloudTemps, state.recurringTemplates);
        cleanDuplicateTemplates();
        localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
      }

      // 2. Fetch transactions — INCREMENTAL (fast) or FULL (fallback)
      // Incremental uses a composite cursor (updated_at, id) for lossless
      // keyset pagination. Full re-fetch remains the durable fallback and is
      // used on first run, after N days, or whenever the flag is off.
      let allTransactions = [];
      let usedIncremental = false;

      // Auto-detect incremental capability: if the migration has been applied
      // (transactions.updated_at exists), the probe enables the flag so rollout
      // is automatic. If the probe fails or the column is absent, the flag stays
      // off and we fall through to the durable full re-fetch.
      const incrementalReady = (await ensureIncrementalSyncCapability()) && !shouldFullSync();
      if (incrementalReady) {
        try {
          const cursors = getSyncCursors();
          const txCursor = getTableCursor(cursors, 'transactions');
          const tombCursor = getTableCursor(cursors, 'transactions_tombstones');

          const [txResult, tombResult] = await Promise.all([
            fetchIncrementalTransactions(txCursor),
            fetchIncrementalTombstones(tombCursor)
          ]);

          // Apply incremental changes into local state (upserts + deletions).
          applyIncrementalTransactions(txResult.rows, tombResult.rows);

          // Advance cursors to the last consumed row (composite cursor).
          const nextCursors = { ...cursors };
          nextCursors.transactions = txResult.nextCursor;
          nextCursors.transactions_tombstones = tombResult.nextCursor;
          saveSyncCursors(nextCursors);

          // Keep local pending transactions (never dropped).
          const localPending = getPendingLocalTransactions(state.transactions);
          allTransactions = mergeAndDeduplicateTransactions(state.transactions, localPending);
          usedIncremental = true;
        } catch (incErr) {
          // Any incremental failure → fall back to full re-fetch (data safety).
          console.warn('[IncrementalSync] incremental fetch failed, falling back to full sync:', incErr);
          usedIncremental = false;
        }
      }

      if (!usedIncremental) {
        // FULL re-fetch (existing behavior) — also establishes the cursor baseline.
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          let transQuery = state.supabaseClient
            .from('transactions')
            .select('*')
            .eq('status', 'active')
            .order('date', { ascending: false })
            .order('id', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          // FIX: Use proper Supabase .or() syntax with individual conditions
          if (familyId && partnerId) {
            transQuery = transQuery.or(`family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}`);
          } else if (familyId) {
            transQuery = transQuery.or(`family_id.eq.${familyId},user_id.eq.${userId}`);
          } else if (partnerId) {
            transQuery = transQuery.or(`user_id.eq.${userId},user_id.eq.${partnerId}`);
          } else {
            transQuery = transQuery.eq('user_id', userId);
          }

          const { data: pageData, error: pageErr } = await promiseTimeout(
            transQuery,
            15000
          );
          if (pageErr) throw pageErr;

          if (pageData && pageData.length > 0) {
            allTransactions = allTransactions.concat(pageData);
            page++;
            if (pageData.length < pageSize) hasMore = false;
          } else {
            hasMore = false;
          }
        }

        // Establish the incremental cursor baseline from the full fetch.
        const cursors = getSyncCursors();
        const nextCursors = { ...cursors };
        if (allTransactions.length > 0) {
          let maxTs = '';
          let maxId = '';
          for (let i = 0; i < allTransactions.length; i++) {
            const tx = allTransactions[i];
            const txTs = tx.updated_at || tx.created_at || '';
            if (txTs && (!maxTs || txTs > maxTs)) {
              maxTs = txTs;
              maxId = tx.id || '';
            }
          }
          nextCursors.transactions = maxTs ? { ts: maxTs, id: maxId } : { ts: new Date().toISOString(), id: '00000000-0000-0000-0000-000000000000' };
        } else {
          nextCursors.transactions = { ts: new Date(0).toISOString(), id: '00000000-0000-0000-0000-000000000000' };
        }
        saveSyncCursors(nextCursors);
        markFullSyncDone();
      }

      // DATA-INTEGRITY SELF-HEALING: The cloud is the source of truth for what is
      // active. Clean any stale local tombstone/trash entries that claim a
      // cloud-active transaction was permanently deleted.
      try {
        reconcileStaleTombstones(allTransactions);
      } catch (reconcileErr) {
        console.warn('[DataIntegrity] reconcileStaleTombstones failed in forceSyncNow:', reconcileErr);
      }

      // Auto-rescue & sync any local transactions missing in the cloud
      const missingSynced = await autoSyncMissingTransactionsToCloud(allTransactions, userId);
      if (missingSynced && missingSynced.length > 0) {
        allTransactions = [...allTransactions, ...missingSynced];
      }

      // 4. Keep local pending transactions
      const localPending = getPendingLocalTransactions(state.transactions);

      // 5. Update state
      const cachedForMerge = (JSON.parse(localStorage.getItem('offline_transactions') || '[]') || []);
      const updatedCloudIds = new Set(allTransactions.map(t => String(t.id)));
      let cachedMissingFromCloud = cachedForMerge.filter(t => !(t && t.id && updatedCloudIds.has(String(t.id))));
      // Defense-in-depth: never reintroduce a permanently-deleted transaction from the offline cache.
      const permanentlyDeletedSet = new Set(Array.from(collectPermanentlyDeletedTxIds()).map(id => String(id)));
      if (permanentlyDeletedSet.size > 0) {
        cachedMissingFromCloud = cachedMissingFromCloud.filter(t => !(t && t.id && permanentlyDeletedSet.has(String(t.id))));
      }
      const dedupedCombined = mergeAndDeduplicateTransactions(allTransactions, [...localPending, ...cachedMissingFromCloud]);
      dedupedCombined.sort(compareTransactions);

      // Snapshot IDs that existed BEFORE the sync to detect truly new entries
      const prevIdSet = new Set((state.transactions || []).map(t => String(t.id || '')));

      // === ANTI-FLICKER GUARD ===
      const newIds = dedupedCombined.map(t => t.id || '').join(',');
      const oldIds = (state.transactions || []).map(t => t.id || '').join(',');
      const dataChanged = newIds !== oldIds;

      state.transactions = dedupedCombined;
      cleanCrossLanguageRecurringDuplicates();
      processRecurringTemplates();
      cleanCrossLanguageRecurringDuplicates();
      localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
      if (state.currentUser && state.currentUser.id) {
        localStorage.setItem('offline_transactions_owner', state.currentUser.id);
      }

      // Sync notes, budgets & AI conversations. These are independent of each
      // other, so run them concurrently to cut total sync time (previously they
      // ran sequentially, adding each network round-trip's latency together).
      await Promise.all([
        syncNotes(),
        syncBudgets(),
        syncAdvisorConversations()
      ]);

      // 6. Check sync queue status
      const queueStr = localStorage.getItem('money_manager_sync_queue');
      if (queueStr) {
        try {
          const queue = JSON.parse(queueStr) || [];
          state.syncPendingCount = queue.length;
        } catch (e) { state.syncPendingCount = 0; }
      } else {
        state.syncPendingCount = 0;
      }

      state.lastSyncTime = Date.now();
      state.syncStatus = 'success';
      updateSyncStatusIndicator();

      // Update last sync time display in settings
      const lastSyncEl = document.getElementById('val_last_sync_time');
      if (lastSyncEl) {
        const d = new Date(state.lastSyncTime);
        lastSyncEl.textContent = d.toLocaleTimeString(state.lang === 'el' ? 'el-GR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }

      calculateInitialBalances();
      pushNoTransition();
      updateUI();
      setTimeout(() => {
        popNoTransition();
      }, 1000);

      // Compute how many transactions are genuinely new
      const newCount = dedupedCombined.filter(t => !prevIdSet.has(String(t.id || ''))).length;
      if (!silent && newCount > 0) {
        showSyncToast('✅ +' + newCount + ' ' + (state.lang === 'en' ? 'new transactions synced' : 'νέες κινήσεις συγχρονίστηκαν'), 3000);
      } else if (!silent && newCount === 0) {
        showSyncToast('✅ ' + (state.lang === 'en' ? 'Everything is up to date' : 'Όλα είναι ενημερωμένα'), 2000);
      }

      return true;
    } catch (e) {
      console.error('Force sync failed:', e);
      state.syncStatus = 'error';
      updateSyncStatusIndicator();
      if (!silent) {
        showSyncToast('❌ ' + (state.lang === 'en' ? 'Sync failed: ' : 'Αποτυχία συγχρονισμού: ') + (e.message || e), 4000);
      }
      return false;
    } finally {
      _forceSyncInFlight = null;
      suppressRealtimeFor(4000);
    }
  })();

  return _forceSyncInFlight;
}

function stopPartnerSyncPolling() {
  if (_partnerSyncInterval) {
    clearInterval(_partnerSyncInterval);
    _partnerSyncInterval = null;
  }
}

function startPartnerSyncPolling() {
  if (_partnerSyncInterval) clearInterval(_partnerSyncInterval);
  _partnerSyncInterval = setInterval(async () => {
    if (!state.supabaseClient || !state.currentUser || navigator.onLine === false) return;
    if (document.visibilityState === 'hidden') return;
    // Quiet partner sync: only runs if user is not currently interacting or submitting
    if (typeof _isSubmittingTransaction !== 'undefined' && _isSubmittingTransaction) return;
    if (typeof _isProcessingSyncQueue !== 'undefined' && _isProcessingSyncQueue) return;
    try {
      if (typeof forceSyncNow === 'function') {
        await forceSyncNow(true);
      }
    } catch (_) {}
  }, 90000); // every 90 seconds as gentle fallback
}

function saveCurrentUIStateToStorage() {
  try {
    window._appIsBackgrounding = true;
    const now = Date.now();
    window._lastBackgroundTimestamp = now;
    try {
      localStorage.setItem('app_background_timestamp', String(now));
    } catch (e) {}
    // Ensure last user activity is tracked
    if (!window._lastUserActivity) {
      window._lastUserActivity = now;
    }
    // Blur any focused input so the keyboard doesn't re-appear on resume
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      document.activeElement.blur();
      // Instantly reset the CSS keyboard variable so the UI layout is correct for the background screenshot
      // and doesn't get stuck suspended in mid-air during the 600ms _appJustResumed resume guard on Android.
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    }

    // 1. Scroll Position
    const scrollContainer = getActiveScrollContainer();
    if (scrollContainer) {
      localStorage.setItem('bg_scroll_top', scrollContainer.scrollTop);
    }

    // 2. Open Modals (Match any active overlay)
    const activeModal = document.querySelector('.modal-overlay.active, .tx-modal-overlay.active, .profile-sheet-overlay.active');
    if (activeModal) {
      const modalId = activeModal.id;
      localStorage.setItem('bg_active_modal_id', modalId);

      const modalBody = activeModal.querySelector('.modal-body');
      if (modalBody) {
        localStorage.setItem('bg_modal_scroll_top', modalBody.scrollTop);
      }

      if (modalId === 'transaction-modal') {
        const txId = document.getElementById('trans-id').value;
        localStorage.setItem('bg_active_modal_tx_id', txId || '');
      } else {
        localStorage.removeItem('bg_active_modal_tx_id');
      }

      if (modalId === 'stats-transactions-modal') {
        localStorage.setItem('bg_active_subcat_txs', JSON.stringify(state.activeSubcategoryTransactions));
      } else {
        localStorage.removeItem('bg_active_subcat_txs');
      }
    }
    // NOTE: We intentionally do NOT remove bg_active_modal_id here even if no modal is currently active.
    // The key is managed exclusively by openModal() (sets it) and closeModal() (removes it).
    // Removing it here would erase the record if the OS closed the modal during the background transition.
  } catch (e) {
    console.warn('[STATE] Failed to save UI state:', e);
  } finally {
    window._appIsBackgrounding = false;
  }
}

let _visibilitySyncTimer = null;
// FIX (background auth recovery): After returning from background the Supabase
// access token may have expired (default 1h) or the session may need a refresh.
// Refreshing the session BEFORE forceSyncNow() prevents spurious 401 Unauthorized
// errors that would otherwise set syncStatus='error' (red cloud-bolt) even though
// the network is fine. getSession() triggers an automatic token refresh when the
// access token is near/at expiry, so this is cheap and safe to call on every resume.
async function _refreshSessionIfNeeded() {
  if (!state.supabaseClient || !state.currentUser) return;
  try {
    const { data, error } = await state.supabaseClient.auth.getSession();
    if (error) {
      console.warn('[SYNC] Session refresh failed on resume:', error.message);
      return;
    }
    if (data && data.session) {
      // Keep currentUser in sync with the (possibly refreshed) session identity.
      const sessionUser = data.session.user;
      if (sessionUser && sessionUser.id && state.currentUser.id !== sessionUser.id) {
        state.currentUser = sessionUser;
      }
    }
  } catch (e) {
    console.warn('[SYNC] Session refresh threw on resume:', e);
  }
}
function handleAppForegroundSync() {
  if (state.currentUser && state.supabaseClient) {
    if (_visibilitySyncTimer) clearTimeout(_visibilitySyncTimer);
    const timeSinceLastSync = Date.now() - (state.lastSyncTime || 0);
    if (timeSinceLastSync > 2000) {
      // ANTI-FLICKER: Wait 1.5s after resume to ensure animations are complete
      // before updating UI.
      _visibilitySyncTimer = setTimeout(async () => {
        _visibilitySyncTimer = null;
        // Refresh the Supabase session first so a stale/expired token from the
        // background period does not cause a false sync error on resume.
        await _refreshSessionIfNeeded();
        // ANTI-FLICKER FIX (resume flash): Keep the no-transition guard active
        // until this sync's deferred re-render has actually run. forceSyncNow
        // already wraps its own updateUI(), but this extra guard also covers any
        // other render that happens while the sync is in-flight - so however long
        // the network takes, the final DOM update is invisible to the user.
        // Reference-counted (pushNoTransition/popNoTransition), so it can never
        // race with the other resume guards. Capped at 6s so a hung network can
        // never leave transitions disabled indefinitely.
        pushNoTransition();
        const _syncGuardTimer = setTimeout(() => { popNoTransition(); }, 6000);
        try {
          await forceSyncNow(true);
        } finally {
          clearTimeout(_syncGuardTimer);
          setTimeout(() => { popNoTransition(); }, 500);
        }
      }, 1500);
    }
  }
}

// Sync on visibility change (user switches back to tab/app in Web/PWA)
// FIX #1: Debounce flag so that on Android (where BOTH visibilitychange AND
// Capacitor appStateChange fire simultaneously), the restore + guard logic
// runs only ONCE per resume event instead of 4 times in 150ms.
let _resumeDebounceTimer = null;
// ANTI-FLICKER: The resume guard window must cover the ENTIRE resume sequence,
// not just the first 600ms. The foreground sync runs at 1500ms and realtime
// events can fire at any moment after re-subscribing. If _appJustResumed is
// cleared before those deferred renders run, updateUI() falls back to an
// immediate render WITH transitions enabled → visible flash on resume.
// We keep the guard active until the 1500ms foreground sync has completed.
const _RESUME_GUARD_MS = 1700;

// ANTI-FLICKER FIX (resume flash): The realtime handlers debounce their batch
// re-renders by 5s. The resume-cycle no-transition guard must therefore stay
// armed long enough to cover that debounce (resume happens at t=0, reconnect
// burst ~t=0-1s, batch render ~t=5s), not just the 1.7s _RESUME_GUARD_MS.
const _REALTIME_RESUME_GUARD_MS = 10000;
function _handleAppResumed() {
  // AUTO-LOCK: Check if the app should lock on resume based on user's auto-lock settings.
  try {
    const autoLockSetting = localStorage.getItem('settings_auto_lock_delay') || 'disabled';
    if (autoLockSetting !== 'disabled') {
      const savedPin = localStorage.getItem('app_pin');
      const validPin = savedPin && savedPin.length === 4;
      if (validPin) {
        if (autoLockSetting === 'immediate' || autoLockSetting === '0') {
          if (typeof showLockScreen === 'function') {
            showLockScreen();
          }
        } else {
          const delayMs = (typeof window._getAutoLockDelayMs === 'function')
            ? window._getAutoLockDelayMs()
            : (parseInt(autoLockSetting, 10) * 60 * 1000);
          if (delayMs > 0) {
            const storedActivity = Number(localStorage.getItem('last_user_activity_timestamp')) || 0;
            const lastActivity = storedActivity || window._lastUserActivity || Date.now();
            const elapsed = Date.now() - lastActivity;
            if (elapsed >= delayMs) {
              if (typeof showLockScreen === 'function') {
                showLockScreen();
              }
            } else {
              if (typeof window._resetAutoLockTimer === 'function') {
                window._resetAutoLockTimer();
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[AUTO-LOCK] Resume check failed:', e);
  }

  document.body.classList.add('no-transitions');
  setTimeout(() => {
    document.body.classList.remove('no-transitions');
  }, _RESUME_GUARD_MS);

  // ANTI-BLANK-FLASH:
  // - Native Android: The native overlay (MainActivity) is already VISIBLE (shown
  //   in onPause before backgrounding). The JS overlay runs INSIDE the WebView so
  //   it cannot cover the WebView surface recompositing gap — skip it for native.
  //   Instead, we signal the native layer to hide the overlay after double-rAF
  //   (confirming first paint) via the NativeApp JavascriptInterface.
  // - Web/PWA: No native layer. Use the JS overlay to cover the tab re-paint flash.
  const _isNativeAndroid = !!(window.Capacitor &&
    window.Capacitor.isNativePlatform &&
    window.Capacitor.isNativePlatform());
  const _isWebMode = document.documentElement.classList.contains('web-mode');
  if (!_isNativeAndroid && !_isWebMode && typeof window.showResumeOverlay === 'function') {
    window.showResumeOverlay();
  }

  if (_resumeDebounceTimer) return; // already scheduled this resume cycle
  // Debounce window extended to 800ms so that when visibilitychange AND the
  // Capacitor appStateChange fire in quick succession (Android fires both
  // simultaneously), the restore + guard logic still runs only ONCE per resume.
  _resumeDebounceTimer = setTimeout(() => { _resumeDebounceTimer = null; }, 800);

  // NATIVE SIGNAL: The overlay is hidden by _notifyNativeContentPainted(), which
  // is called at the END of _updateUIImpl() — i.e. only after the real UI content
  // (transactions, numbers, colors) has been written into the DOM and composited
  if (_isNativeAndroid) {
    window._contentPaintNotified = false;
    _notifyNativeContentPainted();
  }

  // Set guard to block spurious closeModal calls during the resume transition.
  window._appJustResumed = true;
  setTimeout(() => { window._appJustResumed = false; }, _RESUME_GUARD_MS);

  // ANTI-FLICKER FIX (resume flash): Record the resume moment so
  // _isWithinResumeWindow() can cover the entire resume cycle (including the 5s
  // realtime debounce), even after the short-lived _appJustResumed flag above
  // has expired.
  window._lastResumeTimestamp = Date.now();

  // ANTI-FLICKER: Suppress CSS transitions during the entire resume window.
  // Uses reference-counted guard so overlapping guards never race.
  pushNoTransition();
  setTimeout(() => {
    popNoTransition();
  }, _RESUME_GUARD_MS);

  // MODAL HEIGHT STABILITY: Force an immediate refresh of the CSS viewport
  // variables (--viewport-height / --keyboard-height) at 0ms, while the native
  // snapshot overlay still covers the screen and no-transition is active.
  // This writes the FINAL correct values before the overlay fades, so the modal
  // is already at its exact final height when revealed — eliminating the
  // vertical re-adjustment that previously happened ~1s after resume (when the
  // _appJustResumed guard cleared and a normal visualViewport event fired with
  // transitions re-enabled). The force flag bypasses the _appJustResumed guard
  // inside updateViewportHeight; the full computation (including keyboard
  // height) runs so the result is idempotent with the next normal update.
  if (typeof window._updateViewportHeight === 'function') {
    window._updateViewportHeight(true);
  }

  // Restore modals that were open before backgrounding.
  const savedModalId = localStorage.getItem('bg_active_modal_id');
  const savedEl = savedModalId ? document.getElementById(savedModalId) : null;
  const needsRestore = savedEl && !savedEl.classList.contains('active');
  if (needsRestore && typeof window.restoreActiveModalsWithoutTransition === 'function') {
    window.restoreActiveModalsWithoutTransition();
  }

  // Re-establish realtime channel in case connection was dropped by OS
  setupSupabaseRealtimeSubscription();

  // Background sync is handled smoothly by handleAppForegroundSync() after 1.5s
  // only if >30s have elapsed. We do NOT call updateUI() synchronously here,
  // because the DOM is already preserved in memory and rebuilding it on every quick
  // app switch caused visible flickering.
  handleAppForegroundSync();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    _handleAppResumed();
  } else if (document.visibilityState === 'hidden') {
    saveCurrentUIStateToStorage();
  }
});

// Register native Capacitor App State listener for mobile client app backgrounding
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
  try {
    const App = window.Capacitor.Plugins.App;
    if (App && typeof App.addListener === 'function') {
      App.addListener('appStateChange', (appState) => {
        if (appState.isActive) {
          _handleAppResumed();
        } else {
          saveCurrentUIStateToStorage();
        }
      });
    }
  } catch (e) {
    console.warn('[Capacitor] Failed to register appStateChange listener:', e);
  }
}

// Start polling when app loads if user is logged in
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (state.currentUser) {
      startPartnerSyncPolling();
      setupSupabaseRealtimeSubscription();
      // skipReload:true because onAuthStateChange already called loadData().
      // We only want to flush pending mutations from the sync queue here,
      // NOT trigger another full loadData() + updateUI() which would cause flicker.
      processSyncQueue({ skipReload: true });
    }
  }, 5000);
});

window.startPartnerSyncPolling = startPartnerSyncPolling;
window.stopPartnerSyncPolling = stopPartnerSyncPolling;
window.forceSyncNow = forceSyncNow;
window.updateSyncStatusIndicator = updateSyncStatusIndicator;

// ============================================================
// PROFILE & SETTINGS SHEET FUNCTIONS
// ============================================================

function updateHeaderProfileBadge() {
  if (typeof updateHeaderDemoBadge === 'function') {
    updateHeaderDemoBadge();
  }

  const userBadge = document.getElementById('user-profile-badge');
  if (!userBadge) return;

  const devSettingsRow = document.getElementById('developer-settings-row');
  if (devSettingsRow) {
    devSettingsRow.style.display = isAdminUser() ? 'flex' : 'none';
  }

  // NOTE: The guest-connect-banner element was removed from index.html (the
  // "Σύνδεση & Συγχρονισμός Cloud" card). Cloud connection happens automatically
  // on app open or via the lock icon, so the banner was redundant.

  const moreAvatar = document.getElementById('more-profile-avatar') || document.querySelector('#more-screen .profile-avatar');
  const moreLetters = document.getElementById('profile-avatar-letters');
  const moreName = document.getElementById('profile-user-name');
  const moreEmail = document.getElementById('profile-user-email');

  if (state.guestMode || !state.currentUser) {
    if (userBadge) {
      userBadge.style.display = 'flex';
      userBadge.style.cursor = 'pointer';
      userBadge.innerHTML = '<i class="fa-solid fa-lock" style="font-size: 11px; pointer-events: none;"></i>';
      userBadge.title = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_signup_title']) || 'Σύνδεση / Εγγραφή';
      userBadge.removeAttribute('onclick');
      userBadge.onclick = function (e) {
        if (e) {
          try { e.preventDefault(); e.stopPropagation(); } catch (err) { }
        }
        showAuthOverlay();
      };
      userBadge.style.backgroundImage = 'none';
      userBadge.className = 'user-profile-badge';
    }
    if (moreAvatar) {
      moreAvatar.style.backgroundImage = 'none';
      moreAvatar.style.background = 'linear-gradient(135deg, var(--accent) 0%, var(--blue-positive) 100%)';
      moreAvatar.innerHTML = '<i class="fa-solid fa-user" style="font-size: 20px;"></i>';
    }
    if (moreName) moreName.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_guest_title']) || (state.lang === 'el' ? 'Επισκέπτης (Offline)' : 'Guest (Offline)');
    if (moreEmail) moreEmail.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_guest_tap_to_signin']) || (state.lang === 'el' ? 'Πατήστε για σύνδεση' : 'Tap to sign in');
    return;
  }

  const email = state.currentUser.email || '';
  const avatarType = localStorage.getItem('avatar_type_' + email) || 'initials';
  const presetId = localStorage.getItem('avatar_preset_id_' + email) || '1';
  const customData = localStorage.getItem('avatar_custom_data_' + email) || '';

  if (moreName) {
    moreName.textContent = state.userProfile?.display_name || state.currentUser?.email?.split('@')[0] || 'User';
  }
  if (moreEmail) {
    moreEmail.textContent = email || 'email@example.com';
  }

  if (userBadge) {
    userBadge.style.display = 'flex';
    userBadge.title = email;
    userBadge.onclick = () => openProfileSheet();
    userBadge.className = 'user-profile-badge';
  }

  if (avatarType === 'preset') {
    const presetIcons = {
      '1': 'fa-user-tie', '2': 'fa-gem', '3': 'fa-crown', '4': 'fa-coins',
      '5': 'fa-chart-line', '6': 'fa-vault', '7': 'fa-rocket', '8': 'fa-robot',
      '9': 'fa-bolt', '10': 'fa-gamepad', '11': 'fa-shield-halved', '12': 'fa-laptop-code',
      '13': 'fa-cat', '14': 'fa-dog', '15': 'fa-dragon', '16': 'fa-dove',
      '17': 'fa-fire', '18': 'fa-heart', '19': 'fa-mask', '20': 'fa-ghost',
      '21': 'fa-star', '22': 'fa-tree', '23': 'fa-globe', '24': 'fa-wand-magic-sparkles'
    };
    const iconClass = presetIcons[presetId] || 'fa-user-tie';

    if (userBadge) {
      userBadge.classList.add('avatar-preset-badge', 'preset-' + presetId);
      userBadge.style.backgroundImage = 'none';
      userBadge.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
    }
    if (moreAvatar) {
      moreAvatar.style.backgroundImage = 'none';
      moreAvatar.className = 'profile-avatar preset-' + presetId;
      moreAvatar.innerHTML = `<i class="fa-solid ${iconClass}" style="font-size: 22px; color: #fff;"></i>`;
    }
  } else if (avatarType === 'custom' && customData) {
    if (userBadge) {
      userBadge.classList.add('avatar-img-badge');
      userBadge.style.backgroundImage = `url(${customData})`;
      userBadge.innerHTML = '';
    }
    if (moreAvatar) {
      moreAvatar.style.backgroundImage = `url(${customData})`;
      moreAvatar.style.backgroundSize = 'cover';
      moreAvatar.style.backgroundPosition = 'center';
      moreAvatar.innerHTML = '';
    }
  } else {
    let initials = '👤';
    if (state.userProfile && state.userProfile.display_name) {
      const parts = state.userProfile.display_name.trim().split(/\s+/).filter(p => p.length > 0);
      if (parts.length > 0) {
        initials = parts.map(p => p[0]).join('').substring(0, 2).toUpperCase();
      }
    } else if (email) {
      initials = email.substring(0, 2).toUpperCase();
    }
    if (userBadge) {
      userBadge.style.backgroundImage = 'none';
      userBadge.textContent = initials;
    }
    if (moreAvatar) {
      moreAvatar.style.backgroundImage = 'none';
      moreAvatar.style.background = 'linear-gradient(135deg, var(--accent) 0%, var(--blue-positive) 100%)';
      moreAvatar.innerHTML = `<span id="profile-avatar-letters">${initials}</span>`;
    }
  }
}

function getMyFamilyRole() {
  if (!state.currentUser) return 'personal';
  if (!state.familyGroup && (!state.userProfile || !state.userProfile.family_id)) return 'personal';

  if (Array.isArray(state.familyProfiles)) {
    const myProf = state.familyProfiles.find(p => p.id === state.currentUser.id);
    if (myProf && myProf.role) return myProf.role;
  }

  if (state.userProfile && state.userProfile.role) {
    return state.userProfile.role;
  }

  return 'member';
}
window.getMyFamilyRole = getMyFamilyRole;

function setAccountViewMode(mode) {
  if (mode !== 'family' && mode !== 'personal') return;
  if (!state.familyGroup && mode === 'family') {
    closeProfileSheet();
    if (typeof openSettingsSubscreen === 'function') {
      openSettingsSubscreen('family', 'settings_family_title');
    }
    if (typeof showSyncToast === 'function') {
      showSyncToast(state.lang === 'el' ? '⚠️ Συνδεθείτε ή δημιουργήστε οικογενειακή ομάδα' : '⚠️ Join or create a family group first', 2500);
    }
    return;
  }
  state.activeAccountMode = mode;
  localStorage.setItem('account_view_mode', mode);

  updateProfileSheetModeButtons();
  calculateInitialBalances();
  updateUI();
  if (typeof window.updateDesktopSidebarUser === 'function') {
    window.updateDesktopSidebarUser();
  }

  if (typeof showSyncToast === 'function') {
    const msg = mode === 'personal'
      ? (state.lang === 'el' ? '👤 Ατομικός Λογαριασμός ενεργός' : '👤 Personal Account Mode active')
      : (state.lang === 'el' ? '👥 Οικογενειακός Λογαριασμός ενεργός' : '👥 Family Account Mode active');
    showSyncToast(msg, 2000);
  }
}
window.setAccountViewMode = setAccountViewMode;

function updateProfileSheetModeButtons() {
  const mode = state.activeAccountMode || 'family';
  const btnPersonal = document.getElementById('profile-mode-btn-personal');
  const btnFamily = document.getElementById('profile-mode-btn-family');
  if (btnPersonal) {
    btnPersonal.classList.toggle('active', mode === 'personal');
  }
  if (btnFamily) {
    btnFamily.classList.toggle('active', mode === 'family');
  }
}
window.updateProfileSheetModeButtons = updateProfileSheetModeButtons;

function openProfileSheet() {
  if (state.guestMode || !state.currentUser) {
    showAuthOverlay();
    return;
  }

  // Ensure all translations are applied to profile sheet elements
  applyLanguage(state.lang);

  const email = state.currentUser.email || '';
  const name = state.userProfile?.display_name || email.split('@')[0];

  const nameInput = document.getElementById('profile-name-input');
  if (nameInput) {
    nameInput.value = name;
    nameInput.placeholder = state.lang === 'el' ? 'Το όνομά σας' : 'Your name';
  }

  const emailDisplay = document.getElementById('profile-email-display');
  if (emailDisplay) emailDisplay.textContent = email;

  // Calculate & populate profile quick stats
  const activeTransactions = (typeof getActiveTransactions === 'function') ? getActiveTransactions() : (state.transactions || []);
  const totalTransCount = activeTransactions.length;
  const activeCatsCount = (state.categories || []).filter(c => c && !c.hidden).length;

  const statTransEl = document.getElementById('profile-stat-transactions');
  if (statTransEl) statTransEl.textContent = totalTransCount;

  const statCatsEl = document.getElementById('profile-stat-categories');
  if (statCatsEl) statCatsEl.textContent = activeCatsCount;

  // Populate Role & Family Badge
  const roleBadgeEl = document.getElementById('profile-role-badge');
  const statGroupEl = document.getElementById('profile-stat-group');
  if (state.familyGroup) {
    const myRole = getMyFamilyRole();
    if (roleBadgeEl) {
      if (myRole === 'admin') {
        roleBadgeEl.className = 'profile-role-badge admin';
        roleBadgeEl.innerHTML = `<i class="fa-solid fa-crown"></i> <span>${state.lang === 'el' ? 'Διαχειριστής Οικογένειας' : 'Family Admin'}</span>`;
      } else {
        roleBadgeEl.className = 'profile-role-badge member';
        roleBadgeEl.innerHTML = `<i class="fa-solid fa-users"></i> <span>${state.lang === 'el' ? 'Μέλος Οικογένειας' : 'Family Member'}</span>`;
      }
    }
    if (statGroupEl) statGroupEl.textContent = state.familyGroup.name || (state.lang === 'el' ? 'Οικογένεια' : 'Family');
  } else {
    if (roleBadgeEl) {
      roleBadgeEl.className = 'profile-role-badge personal';
      roleBadgeEl.innerHTML = `<i class="fa-solid fa-user-shield"></i> <span>${state.lang === 'el' ? 'Ατομικός Λογαριασμός' : 'Personal Account'}</span>`;
    }
    if (statGroupEl) statGroupEl.textContent = state.lang === 'el' ? 'Ατομικό' : 'Personal';
  }

  updateProfileSheetModeButtons();

  // Update cloud sync status
  const cloudStatus = document.getElementById('profile-cloud-status');
  if (cloudStatus) {
    const icon = cloudStatus.querySelector('i');
    const span = cloudStatus.querySelector('span');
    if (navigator.onLine) {
      cloudStatus.className = 'profile-cloud-status online';
      if (icon) icon.className = 'fa-solid fa-cloud-check';
      if (span) span.textContent = state.lang === 'en' ? 'Cloud Sync: Active' : 'Συγχρονισμός Cloud: Ενεργός';
    } else {
      cloudStatus.className = 'profile-cloud-status offline';
      if (icon) icon.className = 'fa-solid fa-cloud-slash';
      if (span) span.textContent = state.lang === 'en' ? 'Cloud Sync: Offline' : 'Συγχρονισμός Cloud: Εκτός σύνδεσης';
    }
  }

  updateProfileSheetAvatarPreview();

  const modal = document.getElementById('profile-settings-modal');
  if (modal) {
    modal.classList.add('active');
    initProfileSheetSwipeDismiss();
  }
}

function closeProfileSheet() {
  const modal = document.getElementById('profile-settings-modal');
  if (modal) {
    modal.classList.remove('active');
  }
  // Re-render the active tab now that the sheet is closed. Without this, changes
  // made inside the sheet (e.g. the Personal/Family account mode switcher) would
  // not be reflected in the underlying tab until a full refresh, because
  // _updateUIImpl() skips the tab re-render while the sheet overlay is open.
  if (typeof updateUI === 'function') updateUI();
}

function handleProfileSheetOverlayClick(e) {
  if (e.target.id === 'profile-settings-modal') {
    closeProfileSheet();
  }
}

function updateProfileSheetAvatarPreview() {
  const preview = document.getElementById('profile-sheet-avatar-preview');
  if (!preview) return;

  const email = state.currentUser?.email || '';
  const avatarType = localStorage.getItem('avatar_type_' + email) || 'initials';
  const presetId = localStorage.getItem('avatar_preset_id_' + email) || '1';
  const customData = localStorage.getItem('avatar_custom_data_' + email) || '';

  preview.className = 'profile-sheet-avatar';
  preview.style.backgroundImage = 'none';
  preview.innerHTML = '';

  document.querySelectorAll('.preset-avatar-option').forEach(opt => {
    opt.classList.remove('active');
    const pid = opt.getAttribute('data-preset');
    if (avatarType === 'preset' && pid === presetId) {
      opt.classList.add('active');
    }
  });

  const customTrigger = document.querySelector('.preset-custom-trigger');
  if (customTrigger) {
    customTrigger.classList.remove('active');
    if (avatarType === 'custom') {
      customTrigger.classList.add('active');
    }
  }

  if (avatarType === 'preset') {
    preview.classList.add('preset-' + presetId);
    const presetIcons = {
      '1': 'fa-user-tie', '2': 'fa-gem', '3': 'fa-crown', '4': 'fa-coins',
      '5': 'fa-chart-line', '6': 'fa-vault', '7': 'fa-rocket', '8': 'fa-robot',
      '9': 'fa-bolt', '10': 'fa-gamepad', '11': 'fa-shield-halved', '12': 'fa-laptop-code',
      '13': 'fa-cat', '14': 'fa-dog', '15': 'fa-dragon', '16': 'fa-dove',
      '17': 'fa-fire', '18': 'fa-heart', '19': 'fa-mask', '20': 'fa-ghost',
      '21': 'fa-star', '22': 'fa-tree', '23': 'fa-globe', '24': 'fa-wand-magic-sparkles'
    };
    const iconClass = presetIcons[presetId] || 'fa-user-tie';
    preview.innerHTML = `<i class="fa-solid ${iconClass}" style="color: #fff;"></i>`;
  } else if (avatarType === 'custom' && customData) {
    preview.style.backgroundImage = `url(${customData})`;
  } else {
    let initials = '👤';
    if (state.userProfile && state.userProfile.display_name) {
      initials = state.userProfile.display_name.substring(0, 2).toUpperCase();
    } else if (email) {
      initials = email.substring(0, 2).toUpperCase();
    }
    preview.textContent = initials;
  }
}

function selectPresetAvatar(id) {
  if (!state.currentUser) return;
  const email = state.currentUser.email || '';
  localStorage.setItem('avatar_type_' + email, 'preset');
  localStorage.setItem('avatar_preset_id_' + email, String(id));

  updateProfileSheetAvatarPreview();
  updateHeaderProfileBadge();
}

function openProfilePhotoSourcePicker(e) {
  if (e) {
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }
  const modalEl = document.getElementById('profile-photo-source-modal');
  if (modalEl) {
    if (typeof ensureOverlayInBody === 'function') ensureOverlayInBody(modalEl);
    if (modalEl.parentElement === document.body) {
      document.body.appendChild(modalEl);
    }
  }
  openModal('profile-photo-source-modal');
}

function triggerProfileCameraCapture(e) {
  if (e) {
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }
  closeModal('profile-photo-source-modal');
  const cameraInput = document.getElementById('profile-avatar-camera-input');
  if (cameraInput) {
    cameraInput.value = '';
    setTimeout(() => {
      cameraInput.click();
    }, 60);
  }
}

function triggerProfileGalleryUpload(e) {
  if (e) {
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }
  closeModal('profile-photo-source-modal');
  const fileInput = document.getElementById('profile-avatar-file-input');
  if (fileInput) {
    fileInput.value = '';
    setTimeout(() => {
      fileInput.click();
    }, 60);
  }
}

function handleProfilePhotoSourceOverlayClick(e) {
  if (e.target.id === 'profile-photo-source-modal') {
    closeModal('profile-photo-source-modal');
  }
}

function triggerAvatarUpload(e) {
  openProfilePhotoSourcePicker(e);
}
window.openProfilePhotoSourcePicker = openProfilePhotoSourcePicker;
window.triggerProfileCameraCapture = triggerProfileCameraCapture;
window.triggerProfileGalleryUpload = triggerProfileGalleryUpload;
window.handleProfilePhotoSourceOverlayClick = handleProfilePhotoSourceOverlayClick;
window.triggerAvatarUpload = triggerAvatarUpload;

function openAvatarViewerModal() {
  const email = state.currentUser ? (state.currentUser.email || '') : '';
  const avatarType = localStorage.getItem('avatar_type_' + email) || 'initials';
  const customData = localStorage.getItem('avatar_custom_data_' + email);
  const presetId = localStorage.getItem('avatar_preset_id_' + email);

  const preview = document.getElementById('avatar-viewer-large-preview');
  const deleteBtn = document.getElementById('avatar-viewer-delete-btn');

  if (preview) {
    preview.className = '';
    preview.style.background = '';
    preview.innerHTML = '';

    if (avatarType === 'custom' && customData) {
      preview.innerHTML = `<img src="${customData}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
      if (deleteBtn) deleteBtn.style.display = 'flex';
    } else if (avatarType === 'preset' && presetId) {
      preview.className = 'preset-' + presetId;
      preview.innerHTML = `<i class="fa-solid fa-user" style="font-size:48px;"></i>`;
      if (deleteBtn) deleteBtn.style.display = 'flex';
    } else {
      let initials = 'BA';
      if (state.userProfile && state.userProfile.display_name) {
        initials = state.userProfile.display_name.substring(0, 2).toUpperCase();
      } else if (email) {
        initials = email.substring(0, 2).toUpperCase();
      }
      preview.style.background = 'linear-gradient(135deg, #7c6af7, #5a48e8)';
      preview.textContent = initials;
      if (deleteBtn) deleteBtn.style.display = 'none';
    }
  }

  openModal('avatar-viewer-modal');
}
window.openAvatarViewerModal = openAvatarViewerModal;

function triggerAvatarUploadFromViewer() {
  closeModal('avatar-viewer-modal');
  setTimeout(() => {
    openProfilePhotoSourcePicker();
  }, 200);
}
window.triggerAvatarUploadFromViewer = triggerAvatarUploadFromViewer;

function deleteCustomAvatar() {
  if (!state.currentUser) return;
  const email = state.currentUser.email || '';
  localStorage.removeItem('avatar_type_' + email);
  localStorage.removeItem('avatar_custom_data_' + email);
  localStorage.removeItem('avatar_preset_id_' + email);

  updateProfileSheetAvatarPreview();
  updateHeaderProfileBadge();
  closeModal('avatar-viewer-modal');
  showSyncToast(state.lang === 'el' ? '✓ Η φωτογραφία αφαιρέθηκε' : '✓ Photo removed', 2000);
}
window.deleteCustomAvatar = deleteCustomAvatar;

function handleCustomAvatarUpload(e) {
  if (!state.currentUser) return;
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    const email = state.currentUser.email || '';
    localStorage.setItem('avatar_type_' + email, 'custom');
    localStorage.setItem('avatar_custom_data_' + email, evt.target.result);

    updateProfileSheetAvatarPreview();
    updateHeaderProfileBadge();
    showSyncToast(state.lang === 'el' ? '✓ Η φωτογραφία ενημερώθηκε' : '✓ Photo updated', 2000);
  };
  reader.readAsDataURL(file);
}

async function saveProfileName() {
  if (!state.currentUser || !state.supabaseClient) return;

  const nameInput = document.getElementById('profile-name-input');
  if (!nameInput) return;

  const newName = nameInput.value.trim();
  const oldName = state.userProfile?.display_name || '';

  if (!newName || newName === oldName) return;

  try {
    const { data, error } = await promiseTimeout(
      state.supabaseClient
        .from('profiles')
        .update({ display_name: newName })
        .eq('id', state.currentUser.id)
        .select()
        .single()
        .then(r => r),
      6000
    ).catch(err => ({ data: null, error: err }));

    if (error) {
      console.error('Failed to update display_name:', error);
      window.showAlert('⚠️ Αποτυχία ενημέρωσης ονόματος στη βάση δεδομένων.');
      nameInput.value = oldName;
    } else if (data) {
      state.userProfile = data;
      updateHeaderProfileBadge();
      updateProfileSheetAvatarPreview();

      localStorage.setItem('cached_current_user', JSON.stringify(data));

      const emailDisplay = document.getElementById('settings-user-email-value');
      if (emailDisplay && state.currentUser) {
        emailDisplay.textContent = `${state.currentUser.email} (${newName})`;
      }
    }
  } catch (err) {
    console.error('Error saving display name:', err);
  }
}

function handleProfileNameKeydown(e) {
  if (e.key === 'Enter') {
    e.target.blur();
  }
}

function openPartnerFromProfile() {
  closeProfileSheet();
  switchTab('more');
  setTimeout(() => {
    const partnerEl = document.getElementById('partner-linking-container');
    if (partnerEl) {
      partnerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      partnerEl.style.outline = '2px solid var(--accent)';
      setTimeout(() => partnerEl.style.outline = '', 2000);
    }
  }, 350);
}

async function triggerProfileSync() {
  const syncBtn = document.getElementById('profile-sync-spinner');
  if (syncBtn) syncBtn.classList.add('fa-spin');
  const modalSyncSpinner = document.getElementById('modal-sync-spinner');
  if (modalSyncSpinner) modalSyncSpinner.classList.add('fa-spin');

  const syncStatus = document.getElementById('profile-sync-status');
  if (syncStatus) syncStatus.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['sync_status_syncing']) || 'Συγχρονισμός...';

  try {
    if (state.currentUser) {
      await loadUserProfiles(state.currentUser);
      await loadData();
      if (typeof checkPartnerActivityAlerts === 'function') {
        checkPartnerActivityAlerts(state.transactions);
      }
      if (typeof checkWeeklyAndMonthlyDigests === 'function') {
        checkWeeklyAndMonthlyDigests();
      }
      updateUI();
      renderPartnerSection();
      if (syncStatus) syncStatus.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['sync_done']) || 'Ολοκληρώθηκε!';
    }
  } catch (err) {
    console.error(err);
    if (syncStatus) syncStatus.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['val_sync_status_error']) || 'Σφάλμα';
  } finally {
    setTimeout(() => {
      if (syncBtn) syncBtn.classList.remove('fa-spin');
      if (modalSyncSpinner) modalSyncSpinner.classList.remove('fa-spin');
      if (syncStatus) syncStatus.textContent = navigator.onLine ? 'Συνδεδεμένο' : 'Εκτός σύνδεσης';
    }, 1000);
  }
}

function triggerProfileExport() {
  closeProfileSheet();
  openExportPeriodSheet();
}

function cycleThemeFromProfile() {
  const themes = ['dark', 'oled', 'light', 'pink', 'sakura', 'rosegold', 'emerald', 'ocean', 'cyber'];
  const currentTheme = localStorage.getItem('app_theme') || 'dark';
  let nextIdx = (themes.indexOf(currentTheme) + 1) % themes.length;
  const nextTheme = themes[nextIdx];

  changeThemeSetting(nextTheme);
  updateSettingsDisplay();

  const themeStatus = document.getElementById('profile-theme-status');
  if (themeStatus) {
    const themeNames = {
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
    themeStatus.textContent = themeNames[nextTheme] || nextTheme;
  }
}

function handleProfileLogout() {
  closeProfileSheet();
  handleLogout();
}

function initProfileSheetSwipeDismiss() {
  const sheetContent = document.getElementById('profile-sheet-content');
  if (!sheetContent) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  const handleTouchStart = (e) => {
    const body = sheetContent.querySelector('.profile-sheet-body');
    if (body && body.scrollTop > 0) return;

    startY = e.touches[0].clientY;
    isDragging = true;
    sheetContent.classList.add('dragging');
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;

    if (deltaY > 0) {
      e.preventDefault();
      sheetContent.style.transform = `translateY(${deltaY}px)`;
    } else {
      sheetContent.style.transform = '';
    }
  };

  const handleTouchEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;
    sheetContent.classList.remove('dragging');
    const deltaY = currentY - startY;

    if (deltaY > 150) {
      sheetContent.style.transform = '';
      closeProfileSheet();
    } else {
      sheetContent.style.transform = '';
    }
    startY = 0;
    currentY = 0;
  };

  sheetContent.addEventListener('touchstart', handleTouchStart, { passive: false });
  sheetContent.addEventListener('touchmove', handleTouchMove, { passive: false });
  sheetContent.addEventListener('touchend', handleTouchEnd);
}

// Year swipe gestures & openCustomDatePicker
// Extracted to js/customDatePicker.js (Phase 14D Architectural Extraction)

window.startPartnerSyncPolling = startPartnerSyncPolling;
window.stopPartnerSyncPolling = stopPartnerSyncPolling;
window.updateHeaderProfileBadge = updateHeaderProfileBadge;
window.openProfileSheet = openProfileSheet;
window.closeProfileSheet = closeProfileSheet;
window.handleProfileSheetOverlayClick = handleProfileSheetOverlayClick;
window.selectPresetAvatar = selectPresetAvatar;
window.triggerAvatarUpload = triggerAvatarUpload;
window.handleCustomAvatarUpload = handleCustomAvatarUpload;
window.saveProfileName = saveProfileName;
window.handleProfileNameKeydown = handleProfileNameKeydown;
window.openPartnerFromProfile = openPartnerFromProfile;
window.triggerProfileSync = triggerProfileSync;
window.triggerProfileExport = triggerProfileExport;
window.cycleThemeFromProfile = cycleThemeFromProfile;
window.handleProfileLogout = handleProfileLogout;
window.initProfileSheetSwipeDismiss = initProfileSheetSwipeDismiss;
// window.openCustomDatePicker bound in js/customDatePicker.js

function updateSupabaseUserModal() {
  const container = document.getElementById('supabase-user-settings');
  if (!container) return;

  const lang = state.lang || 'el';

  if (state.guestMode || !state.currentUser) {
    container.innerHTML = `
      <div style="text-align: center; padding: 10px 0;">
        <div style="font-size: 40px; margin-bottom: 12px;">☁️</div>
        <h4 style="margin-bottom: 8px; font-weight: 700; color: var(--text-main);">
          ${lang === 'en' ? 'Guest Mode (Offline)' : 'Λειτουργία Επισκέπτη (Offline)'}
        </h4>
        <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 20px;">
          ${lang === 'en'
        ? 'Currently, your data is saved only locally on your device. Connect to the Cloud to enable automatic backup and a real-time shared wallet with your partner.'
        : 'Αυτή τη στιγμή τα δεδομένα σας αποθηκεύονται μόνο τοπικά στη συσκευή σας. Συνδεθείτε στο Cloud για να ενεργοποιήσετε αυτόματο backup και κοινό πορτοφόλι σε πραγματικό χρόνο με τον/την συνεργάτη σας.'}
        </p>
        <button type="button" class="btn btn-primary btn-block" onclick="closeModal('supabase-modal'); showAuthOverlay();" style="padding: 12px;">
          <i class="fa-solid fa-right-to-bracket" style="margin-right: 8px;"></i>
          ${lang === 'en' ? 'Login or Register' : 'Σύνδεση ή Εγγραφή'}
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="text-align: center; padding: 10px 0;">
        <div style="font-size: 40px; margin-bottom: 12px;">☁️✅</div>
        <h4 style="margin-bottom: 4px; font-weight: 700; color: var(--text-main);">
          ${lang === 'en' ? 'Connected to Cloud' : 'Συνδεδεμένος στο Cloud'}
        </h4>
        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 20px; word-break: break-all;">
          ${state.currentUser.email}
        </div>

        <div class="ios-settings-group" style="margin-bottom: 20px; text-align: left;">
          <div class="ios-settings-row" onclick="triggerProfileSyncFromModal()">
            <div class="ios-row-left">
              <div class="ios-row-icon icon-sync"><i class="fa-solid fa-cloud-arrow-up"></i></div>
              <span class="ios-row-label">${lang === 'en' ? 'Sync Now' : 'Συγχρονισμός Τώρα'}</span>
            </div>
            <div class="ios-row-right">
              <i class="fa-solid fa-arrows-rotate ios-row-arrow" id="modal-sync-spinner"></i>
            </div>
          </div>
        </div>

        <button type="button" class="btn btn-secondary btn-block" onclick="closeModal('supabase-modal'); handleLogout();" style="color: var(--accent); background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); padding: 11px;">
          <i class="fa-solid fa-right-from-bracket" style="margin-right: 8px;"></i>
          ${lang === 'en' ? 'Logout Account' : 'Αποσύνδεση Λογαριασμού'}
        </button>
      </div>
    `;
  }
}

function triggerProfileSyncFromModal() {
  triggerProfileSync();
}

window.updateSupabaseUserModal = updateSupabaseUserModal;
window.triggerProfileSyncFromModal = triggerProfileSyncFromModal;

// ============================================================
// CUSTOM DROPDOWNS FOR SEARCH FILTERING
// Extracted to js/dropdownFilterService.js (Phase 15C Architectural Extraction)
// ============================================================

// Android safe-area fallback: check if env(safe-area-inset-bottom) returns 0 in standalone mode
document.addEventListener('DOMContentLoaded', () => {
  const isAndroid = /android/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!isAndroid || !isStandalone) return;

  // Check if env() actually returns a value > 0
  const testEl = document.createElement('div');
  testEl.style.position = 'fixed';
  testEl.style.bottom = '0';
  testEl.style.height = 'env(safe-area-inset-bottom, 0px)';
  document.body.appendChild(testEl);
  const safeBottom = testEl.offsetHeight;
  document.body.removeChild(testEl);

  if (safeBottom === 0) {
    // env() returns 0, update --safe-area-bottom to a default fallback of 16px to clear the gesture pill
    document.documentElement.style.setProperty('--safe-area-bottom', '12px');
  }
});

// Overlay Backdrop Tap: Close modals by tapping the dark background above a card.
// Uses touchend (not click) for instant response on Android WebView — click has
// a ~50-100ms delay even with touch-action:manipulation on passive touch listeners.
function initBackdropTapHandlers() {
  // Modals that are FULL-SCREEN (no visible background to tap) should NOT close
  // on backdrop tap. These are the full-screen overlays where the card fills the
  // entire screen, so there is no "empty space on top" showing the background.
  const fullScreenModals = ['transaction-modal', 'profile-settings-modal'];

  // Mark a close as user-initiated so it bypasses the resume anti-ghost-click guard.
  // This makes back arrows and backdrop taps respond INSTANTLY with no lag.
  function markUserInitiated() {
    window.__userInitiatedClose = true;
  }

  function attachBackdropTap(modal) {
    let touchStartTarget = null;

    modal.addEventListener('touchstart', (e) => {
      touchStartTarget = e.target;
    }, { passive: true });

    modal.addEventListener('touchend', (e) => {
      // Only close if the touch both STARTED and ENDED on the overlay itself
      // (not on the .modal-content card). This avoids accidental closes from
      // touch events that started inside the card and drifted out.
      if (touchStartTarget === modal && e.target === modal) {
        // Skip full-screen modals (no visible background to tap)
        if (fullScreenModals.includes(modal.id)) return;
        // ANTI-GHOST-TAP GUARD: Ignore backdrop taps within 350ms of modal opening
        if (modal._openedAt && (Date.now() - modal._openedAt < 350)) return;
        e.preventDefault(); // prevent the synthetic click from also firing
        markUserInitiated();
        closeModal(modal.id);
      }
      touchStartTarget = null;
    }, { passive: false });

    // click fallback for non-touch environments (desktop PWA / browser)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (fullScreenModals.includes(modal.id)) return;
        // ANTI-GHOST-TAP GUARD: Ignore backdrop clicks within 350ms of modal opening
        if (modal._openedAt && (Date.now() - modal._openedAt < 350)) return;
        markUserInitiated();
        closeModal(modal.id);
      }
    });
  }

  // Attach backdrop-tap-to-close to ALL modal overlay types that can show a
  // visible background above the card (bottom-sheet style modals).
  // NOTE: profile-settings-modal is EXCLUDED because it already has its own
  // inline onclick="handleProfileSheetOverlayClick(event)" backdrop handler.
  document.querySelectorAll('.modal-overlay, .tx-modal-overlay, .profile-sheet-overlay').forEach((modal) => {
    if (modal.id === 'profile-settings-modal' || modal.id === 'custom-dialog-modal' || modal.id === 'offline-import-modal') return;
    attachBackdropTap(modal);
  });

  // Delegated listener: any tap on a back-arrow / close button (elements whose
  // onclick calls closeModal) is a deliberate user action. Mark it user-initiated
  // so the resume guard never blocks it → instant, lag-free back arrow response.
  document.addEventListener('click', (e) => {
    const t = e.target;
    // Back arrows use .icon-btn with fa-arrow-left; close buttons use .modal-close
    // or have an onclick that calls closeModal. Detect these to mark user-initiated.
    const isCloseControl =
      (t.closest && t.closest('.icon-btn')) ||
      (t.closest && t.closest('.modal-close')) ||
      (t.closest && t.closest('[onclick*="closeModal"]')) ||
      (t.closest && t.closest('[onclick*="closeProfileSheet"]')) ||
      (t.closest && t.closest('[onclick*="closeSearchOverlay"]'));
    if (isCloseControl) {
      markUserInitiated();
    }
  }, true);
}
// The OTA boot loader injects app.js asynchronously via Blob URL AFTER
// DOMContentLoaded has fired. Use the same readyState fallback as initApp so
// backdrop-tap-to-close is ALWAYS installed regardless of load timing.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBackdropTapHandlers);
} else {
  setTimeout(initBackdropTapHandlers, 0);
}

// Dynamic Visual Viewport Height Adjustment (for virtual keyboard support)
// With interactive-widget=resizes-visual, the layout viewport doesn't shrink on Android.
// We use visualViewport to detect the keyboard height and push the modal above it.
document.addEventListener('DOMContentLoaded', () => {
  let maxViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

  if (window.visualViewport) {
    const updateViewportHeight = (force = false) => {
      // Guard against layout thrashing during resume unfreeze animation.
      // When force === true (called from _handleAppResumed while the native
      // snapshot overlay still covers the screen), we bypass the guard so the
      // CSS variables receive their final values at 0ms — before the overlay
      // fades and reveals the live UI. This eliminates the modal height
      // re-adjustment that previously happened ~1s after resume.
      if (window._appJustResumed && !force) return;

      // FORCED RESUME UPDATE: During resume the keyboard is NOT open (the focused
      // input was blurred in saveCurrentUIStateToStorage on backgrounding), so
      // --keyboard-height must be 0px. We must NOT compute it from visualViewport
      // here: at 0ms the visual viewport has not yet "unfrozen"/finished resizing,
      // so visualViewport.height can be smaller than window.innerHeight, which
      // would yield a spurious non-zero keyboard height → a black empty gap that
      // pushes the modal down and only disappears ~1s later when the normal
      // update runs. So for the forced path we write the known-correct values
      // directly (full viewport height, zero keyboard).
      if (force) {
        document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
        document.documentElement.style.setProperty('--viewport-offset-top', '0px');
        document.documentElement.style.setProperty('--keyboard-height', '0px');
        return;
      }

      const vvHeight = window.visualViewport.height;
      const offsetTop = window.visualViewport.offsetTop;

      // Track the maximum height (when keyboard is hidden) for calculations
      if (vvHeight > maxViewportHeight) {
        maxViewportHeight = vvHeight;
      }

      let rawKeyboardHeight = isIOS ? (window.innerHeight - vvHeight) : (window.innerHeight - vvHeight - offsetTop);

      // Keep keyboard height stable during iOS keyboard animation to prevent modal shaking/collapsing


      // Scale keyboardHeight inversely to counteract body { zoom: 0.93 }
      // This ensures CSS translations perfectly track the physical keyboard.
      const scale = isIOS ? 1.0 : 0.93;
      const keyboardHeight = Math.max(0, rawKeyboardHeight) / scale;

      // --viewport-height: the visible area height (visual viewport)
      // Use window.innerHeight for layout (unchanged with resizes-visual)
      document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
      document.documentElement.style.setProperty('--viewport-offset-top', `${offsetTop}px`);
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);

      // VisualViewport height updated cleanly via --keyboard-height CSS variable
    };

    // Expose the updater so the top-level _handleAppResumed() can force an
    // immediate, transition-free refresh of the CSS variables at resume time
    // (0ms) while the native snapshot overlay still covers the screen.
    window._updateViewportHeight = updateViewportHeight;

    // On iOS, visualViewport fires 'resize' on every frame during keyboard animation,
    // which causes continuous expensive JS + style recalculations and visible lag.
    // Use a RAF-based debounce to coalesce rapid-fire events into one update per frame.
    let _vpRafId = null;
    const debouncedUpdateViewport = isIOS
      ? () => {
        if (_vpRafId) return; // already scheduled this frame
        _vpRafId = requestAnimationFrame(() => {
          _vpRafId = null;
          updateViewportHeight();
        });
      }
      : updateViewportHeight; // Android: fire immediately (no excess events)

    window.visualViewport.addEventListener('resize', debouncedUpdateViewport);
    window.visualViewport.addEventListener('scroll', debouncedUpdateViewport);

    // Track orientation changes or resets when not focused
    window.addEventListener('resize', () => {
      const isInputFocused = document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA');
      if (!isInputFocused && window.visualViewport) {
        maxViewportHeight = window.visualViewport.height;
      }
      updateViewportHeight();
    });

    updateViewportHeight();
  } else {
    document.documentElement.style.setProperty('--viewport-height', '100vh');
    document.documentElement.style.setProperty('--viewport-offset-top', '0px');
    document.documentElement.style.setProperty('--keyboard-height', '0px');
  }

  // Prevent browser window from panning/scrolling up when inputs are focused in modals
  window.addEventListener('scroll', () => {
    if (isIOS) return; // Let iOS Safari handle its viewport panning during focus; we will reset on blur
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    }
  });

  // iOS Safari layout viewport panning is handled in the focus event listeners and visualViewport resize handlers.
});

// Custom Date Picker State Variables & Functions
// Extracted to js/customDatePicker.js (Phase 14D Architectural Extraction)

// ============================================================
// FEATURE: NOTE FIELD SMART AUTOCOMPLETE (GREEKLISH & MULTI-WORD)
// Extracted to js/autocompleteService.js (Phase 7 Architectural Domain Extraction)
// ============================================================

// ============================================================
// SETTINGS SUBSCREENS & FINANCIAL HEALTH CONTROLLER
// Extracted to js/settingsSubscreenManager.js (Phase 15D Architectural Extraction)
// ============================================================
// ============================================================
// RECURRING TRANSACTIONS UI CONTROLLERS
// ============================================================
let _customSelectedEndYear = null;

function openRecurringModal(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const monthsGrid = document.getElementById('recurring-specific-months-grid');
  if (!monthsGrid) return;

  monthsGrid.innerHTML = '';

  // Generate 1-12 months grid inside the Specific Months container
  const monthNames = state.lang === 'en' ? ENGLISH_MONTHS_SHORT : GREEK_MONTHS_SHORT;
  for (let m = 1; m <= 12; m++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'google-picker-btn';
    btn.textContent = monthNames[m - 1];
    if (_pendingRecurringSettings.months && _pendingRecurringSettings.months.includes(m)) {
      btn.classList.add('active');
    }
    btn.onclick = () => {
      toggleRecurringSpecificMonth(m, btn);
    };
    monthsGrid.appendChild(btn);
  }

  // Sync frequency preset and dropdown UI
  const currentPreset = _pendingRecurringSettings.preset || 'monthly';
  const presetInput = document.getElementById('recurring-simple-preset');
  if (presetInput) {
    presetInput.value = currentPreset;
  }

  const lang = state.lang || 'el';
  const freqLabel = document.getElementById('recurring-frequency-label');
  const icon = document.getElementById('recurring-frequency-icon');
  const meta = {
    daily: { icon: '☀️', el: 'Daily (Καθημερινά)', en: 'Daily' },
    weekly: { icon: '📆', el: 'Weekly (Εβδομαδιαία)', en: 'Weekly' },
    monthly: { icon: '📅', el: 'Monthly (Μηνιαία)', en: 'Monthly' },
    yearly: { icon: '🎆', el: 'Yearly (Ετήσια)', en: 'Yearly' },
    specific_months: { icon: '📌', el: 'Specific Months (Συγκεκριμένοι Μήνες)', en: 'Specific Months' }
  }[currentPreset] || { icon: '📅', el: 'Monthly (Μηνιαία)', en: 'Monthly' };

  if (icon) icon.textContent = meta.icon;
  if (freqLabel) freqLabel.textContent = lang === 'el' ? meta.el : meta.en;

  const options = document.querySelectorAll('#recurring-frequency-options-list .freq-option-item');
  options.forEach(opt => {
    const isSelected = opt.getAttribute('data-value') === currentPreset;
    opt.classList.toggle('selected', isSelected);
    opt.style.background = isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent';
    opt.style.border = isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : 'none';
    const check = opt.querySelector('.freq-check-icon');
    if (check) check.style.display = isSelected ? 'block' : 'none';
  });

  const list = document.getElementById('recurring-frequency-options-list');
  const chevron = document.getElementById('recurring-frequency-chevron');
  if (list) list.style.display = 'none';
  if (chevron) chevron.style.transform = 'rotate(0deg)';

  // Show or hide Specific Months container
  const monthsContainer = document.getElementById('recurring-specific-months-container');
  if (monthsContainer) {
    if (currentPreset === 'specific_months') {
      monthsContainer.style.display = 'flex';
    } else {
      monthsContainer.style.display = 'none';
    }
  }

  // Set Expiration UI state
  const btnPerpetual = document.getElementById('recurring-end-type-perpetual');
  const btnDate = document.getElementById('recurring-end-type-date');
  const dateContainer = document.getElementById('recurring-custom-end-date-container');
  const hiddenInput = document.getElementById('recurring-end-date');
  const dateLabel = document.getElementById('recurring-end-date-label');

  if (!_pendingRecurringSettings.endType || _pendingRecurringSettings.endType === 'perpetual') {
    if (btnPerpetual) btnPerpetual.classList.add('active');
    if (btnDate) btnDate.classList.remove('active');
    if (dateContainer) dateContainer.style.display = 'none';
    if (hiddenInput) hiddenInput.value = '';
    if (dateLabel) dateLabel.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['select_date']) || 'Επιλογή ημερομηνίας...';
  } else {
    if (btnPerpetual) btnPerpetual.classList.remove('active');
    if (btnDate) btnDate.classList.add('active');
    if (dateContainer) dateContainer.style.display = 'flex';

    if (_pendingRecurringSettings.endDate) {
      if (hiddenInput) hiddenInput.value = _pendingRecurringSettings.endDate;
      if (dateLabel) {
        const parts = _pendingRecurringSettings.endDate.split('-');
        if (parts.length === 3) {
          dateLabel.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
    }
  }

  updateRecurringSummary();
  openModal('recurring-picker-modal');
}

function toggleRecurringFrequencyList() {
  const list = document.getElementById('recurring-frequency-options-list');
  const chevron = document.getElementById('recurring-frequency-chevron');
  if (!list) return;
  const isHidden = list.style.display === 'none' || getComputedStyle(list).display === 'none';
  list.style.display = isHidden ? 'flex' : 'none';
  if (chevron) {
    chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  }
}
window.toggleRecurringFrequencyList = toggleRecurringFrequencyList;

function selectRecurringFrequencyOption(val) {
  _pendingRecurringSettings.preset = val;
  const input = document.getElementById('recurring-simple-preset');
  if (input) input.value = val;

  const lang = state.lang || 'el';
  const label = document.getElementById('recurring-frequency-label');
  const icon = document.getElementById('recurring-frequency-icon');

  const meta = {
    daily: { icon: '☀️', el: 'Daily (Καθημερινά)', en: 'Daily' },
    weekly: { icon: '📆', el: 'Weekly (Εβδομαδιαία)', en: 'Weekly' },
    monthly: { icon: '📅', el: 'Monthly (Μηνιαία)', en: 'Monthly' },
    yearly: { icon: '🎆', el: 'Yearly (Ετήσια)', en: 'Yearly' },
    specific_months: { icon: '📌', el: 'Specific Months (Συγκεκριμένοι Μήνες)', en: 'Specific Months' }
  }[val] || { icon: '📅', el: 'Monthly (Μηνιαία)', en: 'Monthly' };

  if (icon) icon.textContent = meta.icon;
  if (label) label.textContent = lang === 'el' ? meta.el : meta.en;

  const options = document.querySelectorAll('#recurring-frequency-options-list .freq-option-item');
  options.forEach(opt => {
    const isSelected = opt.getAttribute('data-value') === val;
    opt.classList.toggle('selected', isSelected);
    opt.style.background = isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent';
    opt.style.border = isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : 'none';
    const check = opt.querySelector('.freq-check-icon');
    if (check) check.style.display = isSelected ? 'block' : 'none';
  });

  const monthsContainer = document.getElementById('recurring-specific-months-container');
  if (monthsContainer) {
    if (val === 'specific_months') {
      monthsContainer.style.display = 'flex';
      if (!_pendingRecurringSettings.months || _pendingRecurringSettings.months.length === 0) {
        const transDateVal = document.getElementById('trans-date')?.value;
        const currentMonth = transDateVal ? new Date(transDateVal).getMonth() + 1 : new Date().getMonth() + 1;
        _pendingRecurringSettings.months = [currentMonth];
        openRecurringModal();
        return;
      }
    } else {
      monthsContainer.style.display = 'none';
    }
  }

  const list = document.getElementById('recurring-frequency-options-list');
  const chevron = document.getElementById('recurring-frequency-chevron');
  if (list) list.style.display = 'none';
  if (chevron) chevron.style.transform = 'rotate(0deg)';

  updateRecurringSummary();
}
window.selectRecurringFrequencyOption = selectRecurringFrequencyOption;

function onSimplePresetChange() {
  const select = document.getElementById('recurring-simple-preset');
  if (!select) return;
  const val = select.value;
  _pendingRecurringSettings.preset = val;

  const monthsContainer = document.getElementById('recurring-specific-months-container');
  if (monthsContainer) {
    if (val === 'specific_months') {
      monthsContainer.style.display = 'flex';
      // If specific_months is selected and no months are selected yet, default to current transaction month
      if (!_pendingRecurringSettings.months || _pendingRecurringSettings.months.length === 0) {
        const transDateVal = document.getElementById('trans-date').value;
        const currentMonth = transDateVal ? new Date(transDateVal).getMonth() + 1 : new Date().getMonth() + 1;
        _pendingRecurringSettings.months = [currentMonth];
        openRecurringModal(); // re-render grid
      }
    } else {
      monthsContainer.style.display = 'none';
    }
  }
  updateRecurringSummary();
}

function toggleRecurringSpecificMonth(month, element) {
  if (!_pendingRecurringSettings.months) {
    _pendingRecurringSettings.months = [];
  }
  const idx = _pendingRecurringSettings.months.indexOf(month);
  if (idx > -1) {
    if (_pendingRecurringSettings.months.length > 1) {
      _pendingRecurringSettings.months.splice(idx, 1);
      element.classList.remove('active');
    }
  } else {
    _pendingRecurringSettings.months.push(month);
    element.classList.add('active');
  }
  updateRecurringSummary();
}

function selectRecurringEndType(type) {
  const btnPerpetual = document.getElementById('recurring-end-type-perpetual');
  const btnDate = document.getElementById('recurring-end-type-date');
  const dateContainer = document.getElementById('recurring-custom-end-date-container');

  if (type === 'perpetual') {
    if (btnPerpetual) btnPerpetual.classList.add('active');
    if (btnDate) btnDate.classList.remove('active');
    if (dateContainer) dateContainer.style.display = 'none';
    _pendingRecurringSettings.endType = 'perpetual';
    _pendingRecurringSettings.endDate = null;
    _pendingRecurringSettings.endYear = null;
  } else {
    if (btnPerpetual) btnPerpetual.classList.remove('active');
    if (btnDate) btnDate.classList.add('active');
    if (dateContainer) dateContainer.style.display = 'flex';
    _pendingRecurringSettings.endType = 'date';

    // Default to end of current year if no end date selected
    if (!_pendingRecurringSettings.endDate) {
      const today = new Date();
      const endOfYear = new Date(today.getFullYear(), 11, 31);
      const yyyy = endOfYear.getFullYear();
      const mm = String(endOfYear.getMonth() + 1).padStart(2, '0');
      const dd = String(endOfYear.getDate()).padStart(2, '0');
      const formatted = `${yyyy}-${mm}-${dd}`;

      const hiddenInput = document.getElementById('recurring-end-date');
      if (hiddenInput) hiddenInput.value = formatted;

      const label = document.getElementById('recurring-end-date-label');
      if (label) {
        label.textContent = `${dd}/${mm}/${yyyy}`;
      }
      _pendingRecurringSettings.endDate = formatted;
    }
  }
  updateRecurringSummary();
}
window.selectRecurringEndType = selectRecurringEndType;

function updateRecurringSummary() {
  const summaryText = document.getElementById('recurring-summary-text');
  if (!summaryText) return;

  const lang = state.lang || 'el';
  const preset = _pendingRecurringSettings.preset || 'monthly';
  const endType = _pendingRecurringSettings.endType || 'perpetual';
  const endDate = _pendingRecurringSettings.endDate;

  let freqPart = '';
  if (lang === 'el') {
    if (preset === 'daily') freqPart = 'Καθημερινά';
    else if (preset === 'weekly') freqPart = 'Κάθε εβδομάδα';
    else if (preset === 'monthly') freqPart = 'Κάθε μήνα';
    else if (preset === 'yearly') freqPart = 'Κάθε χρόνο';
    else if (preset === 'specific_months') {
      const shortMonths = _pendingRecurringSettings.months || [];
      const monthNames = GREEK_MONTHS_SHORT;
      const selectedNames = shortMonths.sort((a, b) => a - b).map(m => monthNames[m - 1]).join(', ');
      freqPart = selectedNames ? `Στους μήνες (${selectedNames})` : 'Επιλεγμένους μήνες';
    } else {
      freqPart = 'Προσαρμοσμένα';
    }
  } else {
    if (preset === 'daily') freqPart = 'Daily';
    else if (preset === 'weekly') freqPart = 'Weekly';
    else if (preset === 'monthly') freqPart = 'Monthly';
    else if (preset === 'yearly') freqPart = 'Yearly';
    else if (preset === 'specific_months') {
      const shortMonths = _pendingRecurringSettings.months || [];
      const monthNames = ENGLISH_MONTHS_SHORT;
      const selectedNames = shortMonths.sort((a, b) => a - b).map(m => monthNames[m - 1]).join(', ');
      freqPart = selectedNames ? `In months (${selectedNames})` : 'Selected months';
    } else {
      freqPart = 'Custom';
    }
  }

  let endPart = '';
  if (lang === 'el') {
    if (endType === 'perpetual') {
      endPart = 'για πάντα';
    } else if (endDate) {
      const parts = endDate.split('-');
      if (parts.length === 3) {
        endPart = `μέχρι τις ${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        endPart = `μέχρι ${endDate}`;
      }
    } else {
      endPart = 'για πάντα';
    }
  } else {
    if (endType === 'perpetual') {
      endPart = 'forever';
    } else if (endDate) {
      const parts = endDate.split('-');
      if (parts.length === 3) {
        endPart = `until ${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        endPart = `until ${endDate}`;
      }
    } else {
      endPart = 'forever';
    }
  }

  summaryText.textContent = lang === 'el'
    ? `Θα δημιουργούνται: ${freqPart} ${endPart}`
    : `Will be created: ${freqPart} ${endPart}`;
}
window.updateRecurringSummary = updateRecurringSummary;

function clearRecurringSettings(shouldCloseModal = true) {
  _pendingRecurringSettings = { isActive: false, days: [], months: [], years: [], preset: 'monthly', endType: 'perpetual', endDate: null, endYear: null };

  const select = document.getElementById('recurring-simple-preset');
  if (select) {
    select.value = 'monthly';
  }

  const monthsContainer = document.getElementById('recurring-specific-months-container');
  if (monthsContainer) monthsContainer.style.display = 'none';

  selectRecurringEndType('perpetual');
  resetRepInstButton();

  if (shouldCloseModal) {
    closeModal('recurring-picker-modal');
  }
}

function saveRecurringSettings() {
  _pendingRecurringSettings.isActive = true;
  const lang = state.lang || 'el';
  const hiddenInput = document.getElementById('recurring-end-date');
  if (_pendingRecurringSettings.endType === 'date' && hiddenInput && hiddenInput.value) {
    _pendingRecurringSettings.endDate = hiddenInput.value;
  }

  if (_pendingRecurringSettings.templateId) {
    const template = (state.recurringTemplates || []).find(t => String(t.id) === String(_pendingRecurringSettings.templateId));
    if (template) {
      template.preset = _pendingRecurringSettings.preset || 'monthly';
      template.endType = _pendingRecurringSettings.endType || 'perpetual';
      template.endDate = (_pendingRecurringSettings.endType === 'date') ? (_pendingRecurringSettings.endDate || null) : null;
      template.endYear = _pendingRecurringSettings.endYear || null;
      template.months = Array.isArray(_pendingRecurringSettings.months) ? [..._pendingRecurringSettings.months] : [];
      template.days = Array.isArray(_pendingRecurringSettings.days) ? [..._pendingRecurringSettings.days] : [];
      template.updated_at = new Date().toISOString();
      localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
      if (typeof enqueueSyncMutation === 'function') {
        enqueueSyncMutation('save_template', template);
      }
      if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
        state.supabaseClient
          .from('recurring_templates')
          .upsert([mapTemplateToDb(template)])
          .then(({ error }) => {
            if (error) {
              console.warn('Cloud recurring template update warning:', error);
            } else {
              if (typeof dequeueSyncMutation === 'function') {
                dequeueSyncMutation('save_template', template.id);
              }
            }
          }).catch(() => { });
      }
      processRecurringTemplates();
      updateUI();
      showSyncToast(lang === 'el' ? '✓ Οι ρυθμίσεις επανάληψης αποθηκεύτηκαν' : '✓ Recurring settings saved', 2500);
    }
  }

  const btn = document.getElementById('btn-rep-inst');
  if (btn) {
    const preset = _pendingRecurringSettings.preset || 'monthly';

    let presetLabel = '';
    if (preset === 'daily') presetLabel = lang === 'el' ? 'Ημερήσια' : 'Daily';
    else if (preset === 'weekly') presetLabel = lang === 'el' ? 'Εβδομαδιαία' : 'Weekly';
    else if (preset === 'monthly') presetLabel = lang === 'el' ? 'Μηνιαία' : 'Monthly';
    else if (preset === 'yearly') presetLabel = lang === 'el' ? 'Ετήσια' : 'Yearly';
    else if (preset === 'specific_months') presetLabel = lang === 'el' ? 'Μήνες' : 'Months';
    else presetLabel = lang === 'el' ? 'Custom' : 'Custom';

    btn.style.background = '#3b82f6';
    btn.style.color = '#ffffff';
    btn.style.borderColor = '#3b82f6';
    const isExisting = !!_pendingRecurringSettings.templateId;
    btn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> ${isExisting ? (lang === 'el' ? 'Επαναλαμβανόμενη' : 'Recurring') : (lang === 'el' ? 'Ενεργό' : 'Active')} (${presetLabel})`;
  }
  closeModal('recurring-picker-modal');
}

function resetRepInstButton() {
  const btn = document.getElementById('btn-rep-inst');
  if (btn) {
    btn.style.background = 'rgba(59, 130, 246, 0.15)';
    btn.style.color = '#3b82f6';
    btn.style.borderColor = 'rgba(59, 130, 246, 0.35)';
    btn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Rep/Inst.`;
  }
}

// Bind to window for HTML access
window.openRecurringModal = openRecurringModal;
window.toggleRecurringSpecificMonth = toggleRecurringSpecificMonth;
window.saveRecurringSettings = saveRecurringSettings;
window.clearRecurringSettings = clearRecurringSettings;
window.resetRepInstButton = resetRepInstButton;
window.onSimplePresetChange = onSimplePresetChange;

// ============================================================
// FEATURE: SAFE-TO-SPEND & WHAT-IF ENGINE UI HOOKS
// ============================================================

function getLiquidBalance() {
  if (!state.accounts || state.accounts.length === 0) return 0;
  const accBalance = state.accounts.reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);

  // If accounts have not yet been manually funded (balance <= 0), use Quick-Start baseline income
  try {
    const qsRaw = localStorage.getItem('ba_quick_start_profile');
    if (qsRaw) {
      const qs = JSON.parse(qsRaw);
      if (qs && qs.monthly_income > 0 && accBalance <= 0) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const spentThisMonth = (state.transactions || []).reduce((sum, t) => {
          if (!t || t.type !== 'expense') return sum;
          const d = new Date(t.date);
          if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
            return sum + (parseFloat(t.amount) || 0);
          }
          return sum;
        }, 0);
        return Math.max(0, qs.monthly_income - spentThisMonth);
      }
    }
  } catch (e) { }

  return accBalance;
}

function getUnpaidRecurringBillsThisMonth() {
  if (!state.recurringTemplates || state.recurringTemplates.length === 0) return 0;

  if (typeof SubscriptionEngine !== 'undefined') {
    try {
      const analysis = SubscriptionEngine.analyzeMonthlySubscriptions({
        templates: state.recurringTemplates,
        transactions: state.transactions || [],
        referenceDate: new Date()
      });
      return sanitizeFloat(parseFloat(analysis.totalPending) || 0);
    } catch (e) {
      console.warn('SubscriptionEngine analysis error in getUnpaidRecurringBillsThisMonth:', e);
    }
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  let unpaidTotal = 0;
  state.recurringTemplates.forEach(tpl => {
    if (tpl.type !== 'expense') return;
    const dueDay = parseInt(tpl.due_day || tpl.day_of_month || 1, 10);
    if (dueDay >= currentDay && dueDay <= lastDayOfMonth) {
      unpaidTotal += sanitizeFloat(parseFloat(tpl.amount) || 0);
    }
  });
  return unpaidTotal;
}

function getMonthlySavingsGoal() {
  if (state.budgets && state.budgets.length > 0) {
    const savingsBudget = state.budgets.find(b => {
      const name = (b.name || b.category || '').toLowerCase();
      return name.includes('αποταμ') || name.includes('saving');
    });
    if (savingsBudget) return sanitizeFloat(parseFloat(savingsBudget.amount) || 0);
  }
  try {
    const qsRaw = localStorage.getItem('ba_quick_start_profile');
    if (qsRaw) {
      const qs = JSON.parse(qsRaw);
      if (qs && qs.target_savings > 0) return sanitizeFloat(parseFloat(qs.target_savings) || 0);
    }
  } catch (e) { }
  return 0;
}

function updateSafeToSpendUI() {
  if (typeof SafeToSpendEngine === 'undefined') return;

  const balance = getLiquidBalance();
  const unpaidBills = getUnpaidRecurringBillsThisMonth();
  const savingsGoal = getMonthlySavingsGoal();

  const stsResult = SafeToSpendEngine.calculateDailySafeToSpend({
    currentBalance: balance,
    unpaidRecurringBills: unpaidBills,
    savingsGoal: savingsGoal
  });

  state._lastSafeToSpendResult = stsResult;

  // Overview Card Elements (Επισκόπηση)
  const dailyEl = document.getElementById('sts-daily-val');
  const weeklyEl = document.getElementById('sts-weekly-val');
  const subtitleEl = document.getElementById('sts-subtitle');
  const badgeEl = document.getElementById('sts-badge');

  const currSym = getCurrencySymbol();
  if (dailyEl) dailyEl.textContent = `${currSym} ${formatDisplayAmount(stsResult.safeDaily)}`;
  if (weeklyEl) weeklyEl.textContent = `${currSym} ${formatDisplayAmount(stsResult.safeWeekly)}`;
  if (subtitleEl) {
    subtitleEl.textContent = `${stsResult.daysRemaining} ημέρες απομένουν • Μετά από πάγιες (${currSym} ${formatDisplayAmount(unpaidBills)})`;
  }

  if (badgeEl) {
    if (stsResult.status === 'caution') {
      badgeEl.style.color = '#f59e0b';
      badgeEl.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      badgeEl.style.background = 'rgba(245, 158, 11, 0.15)';
    } else if (stsResult.status === 'critical') {
      badgeEl.style.color = '#f43f5e';
      badgeEl.style.borderColor = 'rgba(244, 63, 94, 0.4)';
      badgeEl.style.background = 'rgba(244, 63, 94, 0.15)';
    } else {
      badgeEl.style.color = '#34d399';
      badgeEl.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      badgeEl.style.background = 'rgba(16, 185, 129, 0.15)';
    }
  }

  // Update Subscriptions & Bills Pill in Safe-to-Spend Hero Card
  const subsPill = document.getElementById('sts-subs-pill');
  const subsPillText = document.getElementById('sts-subs-pill-text');
  if (subsPill && subsPillText) {
    if (typeof SubscriptionEngine !== 'undefined') {
      try {
        const subAnalysis = SubscriptionEngine.analyzeMonthlySubscriptions({
          templates: state.recurringTemplates || [],
          transactions: state.transactions || [],
          referenceDate: new Date()
        });
        if (subAnalysis.countTotal > 0) {
          subsPill.style.display = 'inline-flex';
          const pendingCount = subAnalysis.countPending;
          const pendingAmount = subAnalysis.totalPending;
          const lang = state.lang || 'el';
          if (pendingCount > 0) {
            const pendingLabel = (TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_badge_pending_bills']) || 'Πάγια Εκκρεμούν';
            subsPillText.textContent = `${pendingCount} ${pendingLabel} (${currSym} ${formatDisplayAmount(pendingAmount)})`;
            subsPill.style.color = '#fbbf24';
            subsPill.style.borderColor = 'rgba(251, 191, 36, 0.3)';
            subsPill.style.background = 'rgba(251, 191, 36, 0.12)';
          } else {
            const allPaidLabel = (TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_all_paid']) || 'Όλα τα πάγια πληρώθηκαν';
            subsPillText.textContent = `${allPaidLabel}`;
            subsPill.style.color = '#34d399';
            subsPill.style.borderColor = 'rgba(52, 211, 153, 0.3)';
            subsPill.style.background = 'rgba(52, 211, 153, 0.12)';
          }
        } else {
          subsPill.style.display = 'inline-flex';
          subsPillText.textContent = lang === 'el' ? 'Πάγια & Συνδρομές' : 'Bills & Subscriptions';
          subsPill.style.color = '#a78bfa';
          subsPill.style.borderColor = 'rgba(167, 139, 250, 0.3)';
          subsPill.style.background = 'rgba(167, 139, 250, 0.12)';
        }
      } catch (e) {
        subsPill.style.display = 'none';
      }
    } else {
      subsPill.style.display = 'none';
    }
  }
}

function openSafeToSpendModal() {
  updateSafeToSpendUI();
  const sts = state._lastSafeToSpendResult || {
    safeDaily: 0,
    safeWeekly: 0,
    currentBalance: getLiquidBalance(),
    committedExpenses: getUnpaidRecurringBillsThisMonth(),
    discretionaryPool: 0,
    daysRemaining: 0
  };

  const currSym = getCurrencySymbol();
  const modalDaily = document.getElementById('modal-sts-daily-val');
  const modalWeekly = document.getElementById('modal-sts-weekly-val');
  const modalBal = document.getElementById('modal-sts-balance');
  const modalBills = document.getElementById('modal-sts-bills');
  const modalSav = document.getElementById('modal-sts-savings');
  const modalPool = document.getElementById('modal-sts-pool');
  const modalDays = document.getElementById('modal-sts-days');

  if (modalDaily) modalDaily.textContent = `${currSym} ${formatDisplayAmount(sts.safeDaily)}`;
  if (modalWeekly) modalWeekly.textContent = `ή ${currSym} ${formatDisplayAmount(sts.safeWeekly)} για αυτή την εβδομάδα`;
  if (modalBal) modalBal.textContent = `${currSym} ${formatDisplayAmount(sts.currentBalance)}`;
  if (modalBills) modalBills.textContent = `- ${currSym} ${formatDisplayAmount(getUnpaidRecurringBillsThisMonth())}`;
  if (modalSav) modalSav.textContent = `- ${currSym} ${formatDisplayAmount(getMonthlySavingsGoal())}`;
  if (modalPool) modalPool.textContent = `${currSym} ${formatDisplayAmount(sts.discretionaryPool)}`;
  if (modalDays) modalDays.textContent = `${sts.daysRemaining} ημέρες`;

  // Clear previous simulation result
  const resBox = document.getElementById('sts-sim-result-box');
  if (resBox) {
    resBox.style.display = 'none';
    resBox.innerHTML = '';
  }

  openModal('safe-to-spend-modal');
}

function runWhatIfSimulation() {
  if (typeof SafeToSpendEngine === 'undefined') return;

  const amtInput = document.getElementById('sts-sim-amount');
  const instSelect = document.getElementById('sts-sim-installments');
  const resBox = document.getElementById('sts-sim-result-box');
  if (!amtInput || !resBox) return;

  const amount = parseFloat(amtInput.value);
  if (!amount || isNaN(amount) || amount <= 0) {
    resBox.style.display = 'block';
    resBox.style.background = 'rgba(239, 68, 68, 0.15)';
    resBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    resBox.style.color = '#f87171';
    resBox.innerHTML = 'Παρακαλώ εισάγετε έγκυρο ποσό αγοράς.';
    return;
  }

  const installments = parseInt(instSelect ? instSelect.value : '1', 10) || 1;
  const currState = state._lastSafeToSpendResult || SafeToSpendEngine.calculateDailySafeToSpend({
    currentBalance: getLiquidBalance(),
    unpaidRecurringBills: getUnpaidRecurringBillsThisMonth(),
    savingsGoal: getMonthlySavingsGoal()
  });

  const sim = SafeToSpendEngine.simulatePurchase({
    purchaseAmount: amount,
    installments: installments,
    safeToSpendState: currState
  });

  const currSym = getCurrencySymbol();
  resBox.style.display = 'block';

  if (!sim.isAffordable || sim.verdict === 'unaffordable') {
    resBox.style.background = 'rgba(239, 68, 68, 0.18)';
    resBox.style.border = '1px solid rgba(239, 68, 68, 0.35)';
    resBox.style.color = '#ffffff';
    resBox.innerHTML = `
      <div style="font-weight: 800; color: #f87171; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>Μη Βιώσιμη Αγορά</span>
      </div>
      <div style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.4;">
        ${sim.recommendation}
      </div>
    `;
  } else {
    const isTight = sim.verdict === 'tight';
    const accentColor = isTight ? '#fbbf24' : '#34d399';
    const bg = isTight ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.18)';
    const border = isTight ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)';

    resBox.style.background = bg;
    resBox.style.border = `1px solid ${border}`;
    resBox.style.color = '#ffffff';
    resBox.innerHTML = `
      <div style="font-weight: 800; color: ${accentColor}; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-circle-check"></i>
        <span>${isTight ? 'Εφικτή αλλά απαιτείται προσοχή!' : 'Άνετη Αγορά!'}</span>
      </div>
      <div style="font-size: 11.5px; color: #cbd5e1; line-height: 1.4;">
        Το Safe-to-Spend θα πέσει από <span style="text-decoration: line-through; color: var(--text-muted);">${currSym} ${formatDisplayAmount(currState.safeDaily)}</span> σε <strong style="color: #fff;">${currSym} ${formatDisplayAmount(sim.newSafeDaily)} / ημέρα</strong>.
      </div>
    `;
  }
}

function openAiAdvisorFromBar() {
  if (typeof openAdvisorChat === 'function') {
    openAdvisorChat();
  }
}

window.updateSafeToSpendUI = updateSafeToSpendUI;
window.openSafeToSpendModal = openSafeToSpendModal;
window.runWhatIfSimulation = runWhatIfSimulation;
window.openAiAdvisorFromBar = openAiAdvisorFromBar;

// ============================================================
// FEATURE: SMART RECURRING & SUBSCRIPTIONS HUB
// ============================================================

function openSubscriptionsHubModal() {
  renderSubscriptionsHub();
  openModal('subscriptions-hub-modal');
}
window.openSubscriptionsHubModal = openSubscriptionsHubModal;

function renderSubscriptionsHub() {
  if (typeof SubscriptionEngine === 'undefined') return;

  const lang = state.lang || 'el';
  const currSym = getCurrencySymbol();

  const analysis = SubscriptionEngine.analyzeMonthlySubscriptions({
    templates: state.recurringTemplates || [],
    transactions: state.transactions || [],
    referenceDate: new Date()
  });

  state._lastSubscriptionsAnalysis = analysis;

  // 1. Metric values
  const totalValEl = document.getElementById('sub-hub-total-val');
  const paidValEl = document.getElementById('sub-hub-paid-val');
  const pendingValEl = document.getElementById('sub-hub-pending-val');

  if (totalValEl) totalValEl.textContent = `${currSym} ${formatDisplayAmount(analysis.totalMonthly)}`;
  if (paidValEl) paidValEl.textContent = `${currSym} ${formatDisplayAmount(analysis.totalPaid)}`;
  if (pendingValEl) pendingValEl.textContent = `${currSym} ${formatDisplayAmount(analysis.totalPending)}`;

  // 2. Smart Detection section
  const detectContainer = document.getElementById('sub-hub-detection-container');
  if (detectContainer) {
    const suggestions = SubscriptionEngine.detectRecurringPatterns({
      transactions: state.transactions || [],
      existingTemplates: state.recurringTemplates || [],
      referenceDate: new Date()
    });

    if (suggestions.length > 0) {
      let detectHtml = `
        <div class="sub-detection-box">
          <div class="sub-detection-title">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <span>${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_smart_detection_title']) || 'Έξυπνη Ανίχνευση Συνδρομών'}</span>
          </div>
          <div class="sub-detection-desc">
            ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_smart_detection_desc']) || 'Εντοπίστηκαν επαναλαμβανόμενα έξοδα στο ιστορικό σας:'}
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
      `;

      suggestions.slice(0, 3).forEach((sug, idx) => {
        detectHtml += `
          <div class="sub-detection-item">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
              <span style="font-size: 14px;">⚡</span>
              <div style="display: flex; flex-direction: column; min-width: 0;">
                <span style="font-size: 13px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(sug.note)}</span>
                <span style="font-size: 11px; color: var(--text-secondary);">${currSym} ${formatDisplayAmount(sug.amount)} • Ημέρα ~${sug.suggestedDay}</span>
              </div>
            </div>
            <button type="button" onclick="acceptDetectedSubscription(${idx})"
              style="padding: 5px 10px; border-radius: 8px; background: var(--accent); color: white; border: none; font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap;">
              ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_btn_add_suggested']) || '+ Προσθήκη'}
            </button>
          </div>
        `;
      });

      detectHtml += `</div></div>`;
      detectContainer.innerHTML = detectHtml;
      detectContainer.style.display = 'block';
      window._activeSubscriptionSuggestions = suggestions;
    } else {
      detectContainer.style.display = 'none';
      detectContainer.innerHTML = '';
      window._activeSubscriptionSuggestions = [];
    }
  }

  // 3. Items list
  const listContainer = document.getElementById('sub-hub-items-list');
  if (listContainer) {
    if (analysis.items.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-secondary); font-size: 13.5px;">
          <div style="font-size: 32px; margin-bottom: 8px; opacity: 0.6;">📅</div>
          <div>${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_no_subs']) || 'Δεν υπάρχουν καταχωρημένες πάγιες υποχρεώσεις.'}</div>
          <button type="button" onclick="closeModal('subscriptions-hub-modal'); openModal('recurring-picker-modal');"
            style="margin-top: 12px; padding: 8px 16px; border-radius: 12px; background: rgba(var(--accent-rgb), 0.15); border: 1px solid var(--accent); color: var(--primary); font-size: 12.5px; font-weight: 700; cursor: pointer;">
            ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_btn_add_suggested']) || '+ Προσθήκη Πάγιας Εντολής'}
          </button>
        </div>
      `;
    } else {
      let listHtml = '';
      analysis.items.forEach(item => {
        const catInfo = (typeof getCategoryInfo === 'function') ? getCategoryInfo(item.category, 'expense') : { icon: '💳', color: '#6366f1' };
        const iconHtml = (typeof renderCategoryIconHtml === 'function')
          ? renderCategoryIconHtml(item.category, { size: 'md', customColor: catInfo.color, transType: 'expense' })
          : `<div style="width: 38px; height: 38px; border-radius: 10px; background: ${catInfo.color}20; color: ${catInfo.color}; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">${catInfo.icon || '💳'}</div>`;

        let statusBadge = '';
        let dueTimingText = '';

        if (item.isPaid) {
          statusBadge = `<span class="sub-status-badge paid"><i class="fa-solid fa-check"></i> ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_status_paid']) || 'Πληρώθηκε'}</span>`;
          if (item.matchedTransaction && item.matchedTransaction.date) {
            dueTimingText = `${formatShortDate(item.matchedTransaction.date)}`;
          } else {
            dueTimingText = `${item.dueDay} ${lang === 'el' ? 'μηνός' : 'of month'}`;
          }
        } else if (item.isOverdue) {
          statusBadge = `<span class="sub-status-badge overdue"><i class="fa-solid fa-triangle-exclamation"></i> ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_status_overdue']) || 'Καθυστέρηση'}</span>`;
          dueTimingText = `${item.dueDay} ${lang === 'el' ? 'μηνός' : 'of month'}`;
        } else {
          statusBadge = `<span class="sub-status-badge pending"><i class="fa-regular fa-clock"></i> ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_status_pending']) || 'Εκκρεμεί'}</span>`;
          if (item.daysUntilDue === 0) {
            dueTimingText = lang === 'el' ? 'Σήμερα' : 'Today';
          } else if (item.daysUntilDue === 1) {
            dueTimingText = lang === 'el' ? 'Αύριο' : 'Tomorrow';
          } else {
            dueTimingText = lang === 'el' ? `σε ${item.daysUntilDue} ημ.` : `in ${item.daysUntilDue}d`;
          }
        }

        listHtml += `
          <div class="sub-item-card">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
              ${iconHtml}
              <div style="display: flex; flex-direction: column; min-width: 0;">
                <div style="font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(item.title)}
                </div>
                <div style="font-size: 11.5px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                  <span>${dueTimingText}</span>
                  <span>•</span>
                  <span>${getCategoryDisplayName ? getCategoryDisplayName(item.category) : item.category}</span>
                </div>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0;">
              <div style="font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 800; color: ${item.isPaid ? 'var(--text-secondary)' : '#ffffff'};">
                ${currSym} ${formatDisplayAmount(item.amount)}
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                ${statusBadge}
                ${!item.isPaid ? `
                  <button type="button" class="sub-quick-pay-btn" onclick="quickPaySubscription('${item.id}')">
                    <i class="fa-solid fa-bolt"></i> <span>${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_btn_pay']) || 'Πληρωμή'}</span>
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      });
      listContainer.innerHTML = listHtml;
    }
  }
}
window.renderSubscriptionsHub = renderSubscriptionsHub;

function acceptDetectedSubscription(suggestionIndex) {
  const suggestions = window._activeSubscriptionSuggestions || [];
  const sug = suggestions[suggestionIndex];
  if (!sug) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const dueDay = Math.min(sug.suggestedDay || 1, new Date(year, month + 1, 0).getDate());
  const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;

  const newTemplate = {
    id: generateUUID(),
    category: sug.category || 'Bills',
    note: sug.note,
    amount: sug.amount,
    currency: sug.currency || state.mainCurrency || 'EUR',
    type: 'expense',
    preset: 'monthly',
    days: [dueDay],
    startDate: startDateStr,
    endType: 'perpetual',
    is_shared: false
  };

  if (!state.recurringTemplates) state.recurringTemplates = [];
  state.recurringTemplates.push(newTemplate);
  localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));

  if (state.supabaseClient && state.currentUser) {
    if (typeof mapTemplateToDb === 'function') {
      state.supabaseClient.from('recurring_templates').upsert([mapTemplateToDb(newTemplate)])
        .catch(err => console.warn('Failed to sync accepted subscription template:', err));
    }
  }

  if (typeof showToast === 'function') {
    showToast(state.lang === 'el' ? '✓ Η συνδρομή προστέθηκε στα πάγια!' : '✓ Subscription added to recurring bills!', 'success');
  }
  renderSubscriptionsHub();
  updateSafeToSpendUI();
}
window.acceptDetectedSubscription = acceptDetectedSubscription;

function quickPaySubscription(templateId) {
  const tpl = (state.recurringTemplates || []).find(t => String(t.id) === String(templateId));
  if (!tpl) return;

  const todayStr = (typeof formatISODateLocal === 'function') ? formatISODateLocal(new Date()) : new Date().toISOString().slice(0, 10);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const tx = {
    id: generateUUID(),
    date: todayStr,
    time: timeStr,
    type: 'expense',
    category: tpl.category || 'Bills',
    amount: sanitizeFloat(parseFloat(tpl.amount) || 0),
    note: tpl.note || tpl.category || 'Recurring Payment',
    recurring_template_id: tpl.id,
    is_recurring: true,
    payment_method: tpl.payment_method || (state.accounts && state.accounts[0] ? state.accounts[0].name : 'Cash'),
    user_id: state.currentUser ? state.currentUser.id : null,
    family_id: (tpl.is_shared && state.currentFamilyId) ? state.currentFamilyId : null
  };

  if (!state.transactions) state.transactions = [];
  state.transactions.unshift(tx);
  localStorage.setItem('transactions', JSON.stringify(state.transactions));

  if (state.supabaseClient && state.currentUser) {
    state.supabaseClient.from('transactions').insert([tx])
      .catch(err => console.warn('Failed to insert quick-pay recurring transaction to cloud:', err));
  }

  if (typeof showToast === 'function') {
    showToast(state.lang === 'el' ? `✓ Καταχωρήθηκε η πληρωμή: ${tx.note}` : `✓ Payment logged: ${tx.note}`, 'success');
  }
  renderSubscriptionsHub();
  updateSafeToSpendUI();
  if (typeof updateUI === 'function') {
    updateUI();
  }
}
window.quickPaySubscription = quickPaySubscription;


// ============================================================
// FEATURE: AI FINANCIAL COACH CHAT LOGIC
// Extracted to js/aiCoachService.js (Phase 9B Architectural Domain Extraction)
// ============================================================

function openRecurringTemplatesModal() {
  const container = document.getElementById('recurring-templates-list-container');
  if (!container) return;

  if (!state.recurringTemplates || state.recurringTemplates.length === 0) {
    try {
      const cached = JSON.parse(localStorage.getItem('recurring_templates') || '[]');
      if (Array.isArray(cached) && cached.length > 0) {
        state.recurringTemplates = cached;
      }
    } catch (e) { }
  }

  container.innerHTML = '';
  const templates = state.recurringTemplates || [];
  const lang = state.lang || 'el';

  if (templates.length === 0) {
    const emptyMsg = TRANSLATIONS[lang]['no_recurring_templates'] || 'No active recurring transactions found.';
    container.innerHTML = `
      <div style="text-align: center; padding: 32px 16px; color: var(--text-secondary); font-size: 14px; line-height: 1.5;">
        ${emptyMsg}
      </div>
    `;
  } else {
    templates.forEach(t => {
      // Find category styling using robust getCategoryInfo helper
      const catInfo = getCategoryInfo(t.category, t.type);
      const icon = catInfo.icon || (t.type === 'income' ? '🟢' : '🔴');
      const color = catInfo.color || '#78909c';

      // Format preset type label
      let presetLabel = t.preset || 'custom';
      if (presetLabel === 'monthly') {
        const dayLabel = TRANSLATIONS[lang]['monthly_on_day'] || 'Monthly on day';
        const startDate = t.startDate ? new Date(t.startDate) : null;
        const dayNum = startDate ? startDate.getDate() : 1;
        presetLabel = `${dayLabel} ${dayNum}`;
      } else {
        presetLabel = TRANSLATIONS[lang]['stats_period_' + presetLabel] || presetLabel;
      }

      let endDateLabel = '';
      if (t.endDate) {
        const parts = String(t.endDate).split('T')[0].split('-');
        if (parts.length === 3) {
          const dd = parts[2];
          const mm = parts[1];
          const yyyy = parts[0];
          endDateLabel = lang === 'el' ? ` • Έως ${dd}/${mm}/${yyyy}` : ` • Until ${dd}/${mm}/${yyyy}`;
        } else {
          const endD = new Date(t.endDate);
          if (!isNaN(endD.getTime())) {
            const day = String(endD.getDate()).padStart(2, '0');
            const month = String(endD.getMonth() + 1).padStart(2, '0');
            const year = endD.getFullYear();
            endDateLabel = lang === 'el' ? ` • Έως ${day}/${month}/${year}` : ` • Until ${day}/${month}/${year}`;
          }
        }
      }

      const isIncome = t.type === 'income';
      const amountPrefix = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'recurring-amount-hero income' : 'recurring-amount-hero expense';
      const formattedAmount = `${amountPrefix} ${getCurrencySymbol()} ${formatDisplayAmount(t.amount, t.currency || state.mainCurrency || 'EUR')}`;

      const itemHtml = `
        <div class="recurring-template-card" onclick="openRecurringDetailsModal('${t.id}')">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
            ${(typeof renderCategoryIconHtml === 'function')
          ? renderCategoryIconHtml(t.category, { size: 'md', customColor: color, transType: t.type })
          : `<div class="recurring-card-cat-icon" style="background: ${color}20; color: ${color};">${icon}</div>`}
            <div style="display: flex; flex-direction: column; min-width: 0; text-align: left; flex: 1;">
              <span style="font-weight: 700; color: var(--text-primary); font-size: 14.5px; word-break: break-word; line-height: 1.3;">
                ${escapeHtml(t.note || t.category)}
              </span>
              <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px; flex-wrap: wrap;">
                <span class="recurring-freq-pill"><i class="fa-regular fa-calendar-check" style="font-size: 10px;"></i> ${escapeHtml(presetLabel)}</span>
                ${endDateLabel ? `<span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(endDateLabel.replace('•', '').trim())}</span>` : ''}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <div style="text-align: right;">
              <div class="${amountClass}">${formattedAmount}</div>
              <div style="font-size: 10.5px; color: var(--text-muted); display: flex; align-items: center; justify-content: flex-end; gap: 3px; margin-top: 2px;">
                <span>${lang === 'el' ? 'Λεπτομέρειες' : 'Details'}</span>
                <i class="fa-solid fa-chevron-right" style="font-size: 8.5px; opacity: 0.6;"></i>
              </div>
            </div>
            <button class="recurring-action-delete-btn" onclick="event.stopPropagation(); deleteRecurringTemplate('${t.id}')" title="${lang === 'el' ? 'Διαγραφή' : 'Delete'}">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;

      container.insertAdjacentHTML('beforeend', itemHtml);
    });
  }

  openModal('recurring-templates-modal');
}

// ============================================================
// RECURRING DETAILS: show all repetitions + edit template name
// ============================================================
let activeRecurringDetailsTemplateId = null;

function openRecurringDetailsModal(templateId) {
  const userId = state.userId;
  const partnerId = state.partnerId;
  const familyId = state.familyId;
  const template = (state.recurringTemplates || []).find(t => String(t.id) === String(templateId));
  if (!template) return;
  activeRecurringDetailsTemplateId = template.id;

  const lang = state.lang || 'el';

  // Title
  const titleEl = document.getElementById('recurring-details-title');
  if (titleEl) titleEl.textContent = lang === 'el' ? '🔁 Επαναλήψεις' : '🔁 Repetitions';

  // Name label
  const nameLabel = document.getElementById('recurring-details-name-label');
  if (nameLabel) nameLabel.textContent = lang === 'el' ? 'Όνομα Επανάληψης' : 'Recurring Name';

  // List label
  const listLabel = document.getElementById('recurring-details-list-label');
  if (listLabel) listLabel.textContent = lang === 'el' ? 'Όλες οι Επαναλήψεις' : 'All Repetitions';

  // Name input
  const nameInput = document.getElementById('recurring-details-name-input');
  if (nameInput) nameInput.value = template.note || '';

  // Save button text
  const saveBtn = document.querySelector('#recurring-details-modal .modal-body button[onclick="saveRecurringTemplateName()"]');
  if (saveBtn) {
    saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk" style="font-size: 12px; margin-right: 4px;"></i>${lang === 'el' ? 'Αποθήκευση' : 'Save'}`;
  }

  // Gather all repetitions (transactions linked to this template or belonging to its recurring series)
  const templateIdStr = String(template.id);
  const ctx = {
    templateId: template.id,
    amount: template.amount,
    type: template.type,
    category: template.category
  };
  let updatedAnyLink = false;
  const repetitions = (state.transactions || []).filter(tx => {
    // 1. Direct link by recurring_template_id
    if (String(tx.recurring_template_id || '') === templateIdStr) return true;

    // 2. Belongs to recurring series (amount + type + category + series occurrence date)
    if (typeof _txBelongsToRecurringSeries === 'function' && _txBelongsToRecurringSeries(tx, ctx)) {
      tx.recurring_template_id = template.id;
      updatedAnyLink = true;
      return true;
    }

    // 3. Robust fallback: same amount + type + (matching note or matching category) within template active timeline
    const txAmount = (parseFloat(tx.amount) || 0).toFixed(2);
    const templAmount = (parseFloat(template.amount) || 0).toFixed(2);
    if (txAmount === templAmount && tx.type === template.type) {
      const txNote = normalizeGreekString(tx.note || tx.description || '');
      const templNote = normalizeGreekString(template.note || template.description || '');
      const notesMatch = txNote.length > 0 && templNote.length > 0 && (txNote === templNote || txNote.includes(templNote) || templNote.includes(txNote));
      const catMatch = isSameCategory(tx.category, template.category);
      if (notesMatch || catMatch) {
        const txDate = String(tx.date || '').split('T')[0].split(' ')[0];
        const templateStart = template.startDate ? String(template.startDate).split('T')[0] : '2000-01-01';
        const templateEnd = template.endDate ? String(template.endDate).split('T')[0] : '2099-12-31';
        if (txDate >= templateStart && txDate <= templateEnd) {
          tx.recurring_template_id = template.id;
          updatedAnyLink = true;
          return true;
        }
      }
    }
    return false;
  });

  if (updatedAnyLink) {
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
  }

  // Sort by date ascending
  repetitions.sort((a, b) => {
    const da = String(a.date || '').split('T')[0];
    const db = String(b.date || '').split('T')[0];
    return da.localeCompare(db);
  });

  const listContainer = document.getElementById('recurring-details-list-container');
  if (!listContainer) return;

  listContainer.innerHTML = '';

  if (repetitions.length === 0) {
    const emptyMsg = lang === 'el'
      ? 'Δεν βρέθηκαν κινήσεις για αυτή την επανάληψη.'
      : 'No transactions found for this repetition.';
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 24px 16px; color: var(--text-secondary); font-size: 13.5px; line-height: 1.5;">
        ${emptyMsg}
      </div>
    `;
  } else {
    repetitions.forEach(tx => {
      // Format date
      let formattedDate = tx.date || '';
      try {
        const d = new Date(tx.date);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        }
      } catch (e) { }

      const amount = parseFloat(tx.amount || 0).toFixed(2);
      const catBadge = (typeof renderCategoryIconHtml === 'function')
        ? renderCategoryIconHtml(tx.category, { size: 'sm', transType: tx.type })
        : `<div style="font-size: 15px; flex-shrink: 0;">${tx.type === 'expense' ? '🔴' : '🟢'}</div>`;

      const rowHtml = `
        <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-card); gap: 10px; box-sizing: border-box; width: 100%; cursor: pointer;" onclick="openEditTransactionModalFromDetails('${tx.id}')">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
            ${catBadge}
            <div style="display: flex; flex-direction: column; min-width: 0; text-align: left; flex: 1;">
              <span style="font-weight: 600; color: var(--text-primary); font-size: 13.5px; word-break: break-word; line-height: 1.3;">${formattedDate}</span>
              <span style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; word-break: break-word; line-height: 1.2;">${tx.category || ''}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
            <span style="font-weight: 700; color: var(--text-primary); font-size: 13.5px; white-space: nowrap;">${amount}€</span>
            <button type="button" onclick="event.stopPropagation(); handleDeleteFromRecurringDetails('${tx.id}', '${template.id}', '${String(tx.date || '').split('T')[0]}')" style="background: rgba(239, 83, 80, 0.1); border: 1px solid rgba(239, 83, 80, 0.2); color: var(--danger); font-size: 13px; cursor: pointer; padding: 6px 10px; border-radius: 8px; transition: background-color 0.2s;" title="${lang === 'el' ? 'Διαγραφή' : 'Delete'}">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;
      listContainer.insertAdjacentHTML('beforeend', rowHtml);
    });
  }

  openModal('recurring-details-modal');
}

function openEditTransactionModalFromDetails(txId) {
  const tx = (state.transactions || []).find(t => String(t.id) === String(txId));
  if (tx) {
    closeModal('recurring-details-modal');
    setTimeout(() => {
      openEditTransactionModal(tx, { instant: true });
    }, 320);
  }
}
window.openEditTransactionModalFromDetails = openEditTransactionModalFromDetails;

function handleDeleteFromRecurringDetails(txId, templateId, dateStr) {
  const tx = (state.transactions || []).find(t => String(t.id) === String(txId));
  const target = tx || { id: txId, recurring_template_id: templateId, date: dateStr };
  closeModal('recurring-details-modal');
  setTimeout(() => {
    openRecurringDeleteModal(target, dateStr, { instant: true });
  }, 320);
}
window.handleDeleteFromRecurringDetails = handleDeleteFromRecurringDetails;

function closeRecurringDetailsModal() {
  closeModal('recurring-details-modal');
  activeRecurringDetailsTemplateId = null;
}

async function saveRecurringTemplateName() {
  if (!activeRecurringDetailsTemplateId) return;
  const lang = state.lang || 'el';

  const nameInput = document.getElementById('recurring-details-name-input');
  const newName = nameInput ? nameInput.value.trim() : '';

  const template = (state.recurringTemplates || []).find(t => String(t.id) === String(activeRecurringDetailsTemplateId));
  if (!template) return;

  if (!newName) {
    showSyncToast(lang === 'el' ? '⚠️ Το όνομα δεν μπορεί να είναι κενό.' : '⚠️ The name cannot be empty.', 2500);
    return;
  }

  template.note = newName;

  // Save to localStorage
  localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));

  // Save to Supabase (Cloud Sync)
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      await state.supabaseClient
        .from('recurring_templates')
        .upsert([mapTemplateToDb(template)]);
    } catch (err) {
      console.warn('Failed to sync recurring template name to cloud:', err);
    }
  }

  showSyncToast(lang === 'el' ? '✅ Το όνομα αποθηκεύτηκε.' : '✅ Name saved.', 2500);

  // Refresh the templates list modal behind
  openRecurringTemplatesModal();
  // Re-open details modal to reflect the new name
  openRecurringDetailsModal(template.id);
}

// ============================================================
// RECURRING EDITOR: full management of a recurring template
// (start date, end date, day of month, preset) via calendar
// ============================================================
let activeRecurringEditTemplateId = null;
let _recurringEditMonths = [];

function openRecurringEditModal(templateId) {
  const template = (state.recurringTemplates || []).find(t => String(t.id) === String(templateId));
  if (!template) return;
  activeRecurringEditTemplateId = template.id;

  const lang = state.lang || 'el';

  // Title
  const titleEl = document.getElementById('recurring-edit-title');
  if (titleEl) titleEl.textContent = lang === 'el' ? '✏️ Επεξεργασία Επανάληψης' : '✏️ Edit Recurring';

  // Name
  const nameInput = document.getElementById('recurring-edit-name-input');
  if (nameInput) nameInput.value = template.note || '';

  // Start date
  const startDateStr = template.startDate || `${template.startYear || new Date().getFullYear()}-${String(template.startMonth || 1).padStart(2, '0')}-01`;
  const startInput = document.getElementById('recurring-edit-start');
  const startLabel = document.getElementById('recurring-edit-start-label');
  if (startInput) startInput.value = startDateStr;
  if (startLabel) {
    const parts = startDateStr.split('-');
    if (parts.length === 3) startLabel.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
    else startLabel.textContent = startDateStr;
  }

  // Preset
  const presetSelect = document.getElementById('recurring-edit-preset');
  if (presetSelect) presetSelect.value = template.preset || 'monthly';

  // Months grid
  _recurringEditMonths = Array.isArray(template.months) ? template.months.slice() : [];
  renderRecurringEditMonthsGrid();

  // End type / end date
  const endType = template.endType || 'perpetual';
  const endDate = template.endDate || null;
  const btnPerpetual = document.getElementById('recurring-edit-end-perpetual');
  const btnDate = document.getElementById('recurring-edit-end-date');
  const endContainer = document.getElementById('recurring-edit-end-date-container');
  const endInput = document.getElementById('recurring-edit-end');
  const endLabel = document.getElementById('recurring-edit-end-label');

  if (endType === 'perpetual' || !endDate) {
    if (btnPerpetual) btnPerpetual.classList.add('active');
    if (btnDate) btnDate.classList.remove('active');
    if (endContainer) endContainer.style.display = 'none';
    if (endInput) endInput.value = '';
    if (endLabel) endLabel.textContent = lang === 'el' ? 'Επιλογή ημερομηνίας...' : 'Select date...';
  } else {
    if (btnPerpetual) btnPerpetual.classList.remove('active');
    if (btnDate) btnDate.classList.add('active');
    if (endContainer) endContainer.style.display = 'flex';
    if (endInput) endInput.value = endDate;
    if (endLabel) {
      const parts = endDate.split('-');
      if (parts.length === 3) endLabel.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
      else endLabel.textContent = endDate;
    }
  }

  // Update summary when start/end dates change via the calendar
  const startInputEl = document.getElementById('recurring-edit-start');
  const endInputEl = document.getElementById('recurring-edit-end');
  if (startInputEl) startInputEl.oninput = () => updateRecurringEditSummary();
  if (endInputEl) endInputEl.oninput = () => updateRecurringEditSummary();

  updateRecurringEditSummary();
  openModal('recurring-edit-modal');
}

function closeRecurringEditModal() {
  closeModal('recurring-edit-modal');
  activeRecurringEditTemplateId = null;
}

function renderRecurringEditMonthsGrid() {
  const grid = document.getElementById('recurring-edit-months-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const lang = state.lang || 'el';
  const monthNames = lang === 'en' ? ENGLISH_MONTHS_SHORT : GREEK_MONTHS_SHORT;
  for (let m = 1; m <= 12; m++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'google-picker-btn';
    btn.textContent = monthNames[m - 1];
    if (_recurringEditMonths.includes(m)) btn.classList.add('active');
    btn.onclick = () => {
      const idx = _recurringEditMonths.indexOf(m);
      if (idx > -1) {
        if (_recurringEditMonths.length > 1) {
          _recurringEditMonths.splice(idx, 1);
          btn.classList.remove('active');
        }
      } else {
        _recurringEditMonths.push(m);
        btn.classList.add('active');
      }
      updateRecurringEditSummary();
    };
    grid.appendChild(btn);
  }
}

function onRecurringEditPresetChange() {
  const select = document.getElementById('recurring-edit-preset');
  if (!select) return;
  const val = select.value;
  const monthsContainer = document.getElementById('recurring-edit-months-container');
  if (monthsContainer) {
    if (val === 'specific_months') {
      monthsContainer.style.display = 'flex';
      if (_recurringEditMonths.length === 0) {
        const startVal = document.getElementById('recurring-edit-start').value;
        const currentMonth = startVal ? new Date(startVal).getMonth() + 1 : new Date().getMonth() + 1;
        _recurringEditMonths = [currentMonth];
        renderRecurringEditMonthsGrid();
      }
    } else {
      monthsContainer.style.display = 'none';
    }
  }
  updateRecurringEditSummary();
}

function selectRecurringEditEndType(type) {
  const btnPerpetual = document.getElementById('recurring-edit-end-perpetual');
  const btnDate = document.getElementById('recurring-edit-end-date');
  const endContainer = document.getElementById('recurring-edit-end-date-container');
  const lang = state.lang || 'el';

  if (type === 'perpetual') {
    if (btnPerpetual) btnPerpetual.classList.add('active');
    if (btnDate) btnDate.classList.remove('active');
    if (endContainer) endContainer.style.display = 'none';
    const endInput = document.getElementById('recurring-edit-end');
    if (endInput) endInput.value = '';
  } else {
    if (btnPerpetual) btnPerpetual.classList.remove('active');
    if (btnDate) btnDate.classList.add('active');
    if (endContainer) endContainer.style.display = 'flex';
    const endInput = document.getElementById('recurring-edit-end');
    if (endInput && !endInput.value) {
      const today = new Date();
      const endOfYear = new Date(today.getFullYear(), 11, 31);
      const yyyy = endOfYear.getFullYear();
      const mm = String(endOfYear.getMonth() + 1).padStart(2, '0');
      const dd = String(endOfYear.getDate()).padStart(2, '0');
      endInput.value = `${yyyy}-${mm}-${dd}`;
      const endLabel = document.getElementById('recurring-edit-end-label');
      if (endLabel) endLabel.textContent = `${dd}/${mm}/${yyyy}`;
    }
  }
  updateRecurringEditSummary();
}

function updateRecurringEditSummary() {
  const summaryText = document.getElementById('recurring-edit-summary-text');
  if (!summaryText) return;
  const lang = state.lang || 'el';
  const preset = document.getElementById('recurring-edit-preset') ? document.getElementById('recurring-edit-preset').value : 'monthly';
  const endInput = document.getElementById('recurring-edit-end');
  const endDate = endInput ? endInput.value : '';

  let freqPart = '';
  if (preset === 'daily') freqPart = lang === 'el' ? 'Κάθε μέρα' : 'Daily';
  else if (preset === 'weekly') freqPart = lang === 'el' ? 'Κάθε εβδομάδα' : 'Weekly';
  else if (preset === 'monthly') freqPart = lang === 'el' ? 'Κάθε μήνα' : 'Monthly';
  else if (preset === 'yearly') freqPart = lang === 'el' ? 'Κάθε χρόνο' : 'Yearly';
  else if (preset === 'specific_months') {
    const monthNames = lang === 'en' ? ENGLISH_MONTHS_SHORT : GREEK_MONTHS_SHORT;
    const selectedNames = _recurringEditMonths.map(m => monthNames[m - 1]).join(', ');
    freqPart = selectedNames ? (lang === 'el' ? `Σε μήνες (${selectedNames})` : `In months (${selectedNames})`) : (lang === 'el' ? 'Επιλεγμένοι μήνες' : 'Selected months');
  } else {
    freqPart = 'Custom';
  }

  let endPart = '';
  if (endDate) {
    const parts = endDate.split('-');
    if (parts.length === 3) endPart = lang === 'el' ? `μέχρι τις ${parts[2]}/${parts[1]}/${parts[0]}` : `until ${parts[2]}/${parts[1]}/${parts[0]}`;
    else endPart = lang === 'el' ? `μέχρι ${endDate}` : `until ${endDate}`;
  } else {
    endPart = lang === 'el' ? 'για πάντα' : 'forever';
  }

  summaryText.textContent = lang === 'el'
    ? `Θα δημιουργούνται: ${freqPart} ${endPart}`
    : `Will be created: ${freqPart} ${endPart}`;
}

async function saveRecurringTemplateEdit() {
  if (!activeRecurringEditTemplateId) return;
  const lang = state.lang || 'el';
  const template = (state.recurringTemplates || []).find(t => String(t.id) === String(activeRecurringEditTemplateId));
  if (!template) return;

  const nameInput = document.getElementById('recurring-edit-name-input');
  const newName = nameInput ? nameInput.value.trim() : '';
  if (!newName) {
    showSyncToast(lang === 'el' ? '⚠️ Το όνομα δεν μπορεί να είναι κενό.' : '⚠️ The name cannot be empty.', 2500);
    return;
  }

  const startInput = document.getElementById('recurring-edit-start');
  const startDateStr = startInput ? startInput.value : '';
  if (!startDateStr) {
    showSyncToast(lang === 'el' ? '⚠️ Επιλέξτε ημερομηνία έναρξης.' : '⚠️ Please select a start date.', 2500);
    return;
  }

  const preset = document.getElementById('recurring-edit-preset') ? document.getElementById('recurring-edit-preset').value : 'monthly';
  const endInput = document.getElementById('recurring-edit-end');
  const endDate = endInput ? endInput.value : '';

  // Validate specific_months
  if (preset === 'specific_months' && _recurringEditMonths.length === 0) {
    showSyncToast(lang === 'el' ? '⚠️ Επιλέξτε τουλάχιστον έναν μήνα.' : '⚠️ Please select at least one month.', 2500);
    return;
  }

  // Validate end date >= start date
  if (endDate && endDate < startDateStr) {
    showSyncToast(lang === 'el' ? '⚠️ Η ημερομηνία λήξης πρέπει να είναι μετά την έναρξη.' : '⚠️ End date must be after start date.', 2500);
    return;
  }

  // 1. Remove all existing transactions linked to this template (local + cloud)
  const templateIdStr = String(template.id);
  const linkedTxs = (state.transactions || []).filter(tx => String(tx.recurring_template_id || '') === templateIdStr);
  const linkedIds = linkedTxs.map(tx => tx.id);
  if (linkedIds.length > 0) {
    state.transactions = state.transactions.filter(tx => !linkedIds.includes(tx.id));
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
    if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
      try {
        await state.supabaseClient.from('transactions').delete().in('id', linkedIds);
      } catch (err) {
        console.warn('Failed to delete old recurring transactions from cloud:', err);
      }
    }
  }

  // 2. Update the template fields
  template.note = newName;
  template.preset = preset;
  template.months = preset === 'specific_months' ? _recurringEditMonths.slice() : [];
  template.days = [];
  template.startDate = startDateStr;
  template.startYear = new Date(startDateStr).getFullYear();
  template.startMonth = new Date(startDateStr).getMonth() + 1;
  if (endDate) {
    template.endType = 'date';
    template.endDate = endDate;
  } else {
    template.endType = 'perpetual';
    template.endDate = null;
  }

  // Clear any deleted-dates markers so regeneration is clean
  if (template.description) {
    template.description = (template.description || '').split('||deleted_dates:')[0].trim();
  }

  // 3. Save template locally + cloud
  localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      await state.supabaseClient.from('recurring_templates').upsert([mapTemplateToDb(template)]);
    } catch (err) {
      console.warn('Failed to sync recurring template edit to cloud:', err);
    }
  }

  // 4. Regenerate transactions for this template across all relevant months
  regenerateRecurringTemplateTransactions(template);

  showSyncToast(lang === 'el' ? '✅ Η επανάληψη ενημερώθηκε και αναδημιουργήθηκε.' : '✅ Recurring updated and regenerated.', 3000);

  closeRecurringEditModal();
  openRecurringTemplatesModal();
  openRecurringDetailsModal(template.id);
}

// Regenerate all recurring transactions for a single template across all months
// from its start date up to end date (or forever), skipping deleted dates.
function regenerateRecurringTemplateTransactions(template) {
  if (!template) return;
  const preset = template.preset || 'monthly';
  const startDate = new Date(template.startDate || new Date().toISOString().split('T')[0]);
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth(); // 0-indexed
  const startDay = startDate.getDate();

  const endDateStr = template.endDate || null;
  const endLimit = endDateStr ? new Date(endDateStr) : null;

  // Cap future generation to 12 months from today to avoid runaway creation
  const today = new Date();
  const maxFuture = new Date(today.getFullYear(), today.getMonth() + 12, 1);

  const deletedDates = getDeletedDatesFromTemplate(template);

  let created = 0;
  let year = startYear;
  let month = startMonth;

  while (true) {
    const yearMonth = new Date(year, month, 1);
    if (yearMonth > maxFuture) break;
    if (endLimit && yearMonth > endLimit) break;

    const monthNum = month + 1;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const datesToCreate = [];

    if (preset === 'daily') {
      for (let d = 1; d <= lastDay; d++) {
        if (year === startYear && month === startMonth && d < startDay) continue;
        datesToCreate.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }
    } else if (preset === 'weekly') {
      const targetDayOfWeek = startDate.getDay();
      for (let d = 1; d <= lastDay; d++) {
        const dObj = new Date(year, month, d);
        if (dObj.getDay() === targetDayOfWeek) {
          if (year === startYear && month === startMonth && d < startDay) continue;
          datesToCreate.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }
      }
    } else if (preset === 'monthly') {
      const day = Math.min(startDay, lastDay);
      if (!(year === startYear && month === startMonth && day < startDay)) {
        datesToCreate.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
    } else if (preset === 'yearly') {
      if (month === startMonth) {
        const day = Math.min(startDay, lastDay);
        datesToCreate.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
    } else if (preset === 'specific_months') {
      if (template.months && template.months.includes(monthNum)) {
        const day = Math.min(startDay, lastDay);
        if (!(year === startYear && month === startMonth && day < startDay)) {
          datesToCreate.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
      }
    }

    datesToCreate.forEach(dateString => {
      if (endLimit && dateString > endDateStr) return;
      if (deletedDates.includes(dateString)) return;

      const expectedDeterministicId = generateDeterministicUUID(template.id, dateString);
      const matchingExisting = state.transactions.find(t => {
        const tDate = String(t.date || '').split('T')[0].split(' ')[0];
        if (tDate !== dateString) return false;
        if (t.id === expectedDeterministicId) return true;
        if (t.recurring_template_id && String(t.recurring_template_id) === String(template.id)) return true;
        const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
        const templAmount = (parseFloat(template.amount) || 0).toFixed(2);
        if (tAmount === templAmount && t.type === template.type) {
          const tNote = normalizeGreekString(t.note || t.description || '');
          const templNote = normalizeGreekString(template.note || template.description || '');
          const notesMatch = tNote.length > 0 && templNote.length > 0 && (tNote === templNote || tNote.includes(templNote) || templNote.includes(tNote));
          if (notesMatch) return true;
          if (isSameCategory(t.category, template.category) && (!tNote || !templNote || notesMatch)) return true;
        }
        return false;
      });
      if (matchingExisting) {
        if (!matchingExisting.recurring_template_id) {
          matchingExisting.recurring_template_id = template.id;
        }
        return;
      }

      const newTx = {
        id: expectedDeterministicId,
        recurring_template_id: template.id,
        date: dateString,
        type: template.type,
        amount: parseFloat(template.amount),
        currency: template.currency || 'EUR',
        category: template.category,
        subcategory: template.subcategory || '',
        account_from: template.account_from,
        account_to: template.type === 'transfer' ? template.account_to : null,
        note: template.note,
        description: template.description || '',
        user_id: template.user_id || (state.currentUser ? state.currentUser.id : null),
        is_shared: template.is_shared !== undefined ? template.is_shared : (state.partnerProfile !== null),
        family_id: template.family_id || (state.userProfile ? state.userProfile.family_id : null),
        created_at: new Date().toISOString()
      };
      computeCurrencyFields(newTx);
      // HIGH-EXPENSE ALERT: recurring-generated expenses also respect the
      // "Single Expense Alert" limit (previously only manual saves fired it).
      checkHighExpenseAlert(newTx);
      saveTransactionOffline(newTx);
      if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
        const { description, is_shared, photo_local_uri, photo_url, receipt, fx_snapshot, ...dbPayload } = newTx;
        (async () => {
          try {
            const { error } = await promiseTimeout(
              state.supabaseClient.from('transactions').upsert([dbPayload]),
              12000
            );
            if (error) throw error;
          } catch (err) {
            // If the server-side cloud limit trigger rejected this insert (free
            // user over the monthly limit), keep the transaction locally and
            // queue it for later sync — never drop financial data.
            console.warn('Cloud save failed for regenerated recurring, queueing:', newTx.id, err);
            enqueueSyncMutation('save', newTx);
          }
        })();
      }
      created++;
    });

    // Advance to next month
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
    if (year > maxFuture.getFullYear() + 1) break;
  }

  cleanCrossLanguageRecurringDuplicates();
  calculateInitialBalances();
  updateUI();
  return created;
}

async function deleteRecurringTemplate(id) {
  if (!id) return;
  openRecurringDeleteModal(id);
}

// ============================================================
// TRASH BIN & RECOVERY SUBSYSTEM (openTrashBinModal, fetchTrashFromCloud, renderTrashBinList, restoreTransaction, emptyTrashBin)
// Extracted to js/trashBinService.js (Phase 11A Architectural Extraction)
// ============================================================

// Bind to window for HTML access
window.openAdvisorChat = openAdvisorChat;
window.closeAdvisorChat = closeAdvisorChat;
window.submitCoachInput = submitCoachInput;
window.submitCoachQuery = submitCoachQuery;
window.handleAdvisorChatKeydown = handleAdvisorChatKeydown;
window.startNewAdvisorConversation = startNewAdvisorConversation;
window.showAdvisorConversationList = showAdvisorConversationList;
window.deleteAdvisorConversation = deleteAdvisorConversation;
window.openAdvisorConversation = openAdvisorConversation;

// Delegated fallback for the AI advisor trigger. The inline onclick on
// #advisor-chat-trigger should work, but if for any reason the click/tap does not
// reach the inline handler (e.g. the element was re-rendered, or a parent handler
// swallowed the event), this document-level listener guarantees the chat still opens.
document.addEventListener('click', function _advisorTriggerFallback(e) {
  const t = e.target && e.target.closest ? e.target.closest('#advisor-chat-trigger, .advisor-chat-trigger') : null;
  if (!t) return;
  // Avoid double-opening if the inline onclick already handled it (it stops propagation,
  // so this only fires when the inline handler did NOT run).
  if (window._advisorChatOpening) return;
  window._advisorChatOpening = true;
  try {
    e.stopPropagation();
    openAdvisorChat();
  } finally {
    setTimeout(() => { window._advisorChatOpening = false; }, 400);
  }
});
window.openRecurringTemplatesModal = openRecurringTemplatesModal;
window.deleteRecurringTemplate = deleteRecurringTemplate;
window.openRecurringDetailsModal = openRecurringDetailsModal;
window.closeRecurringDetailsModal = closeRecurringDetailsModal;
window.saveRecurringTemplateName = saveRecurringTemplateName;
window.openRecurringEditModal = openRecurringEditModal;
window.closeRecurringEditModal = closeRecurringEditModal;
window.saveRecurringTemplateEdit = saveRecurringTemplateEdit;
window.onRecurringEditPresetChange = onRecurringEditPresetChange;
window.selectRecurringEditEndType = selectRecurringEditEndType;

// ============================================================
// QUICK-START 60" ONBOARDING WIZARD & BASELINE PROFILE ENGINE
// Extracted to js/onboardingWizard.js (Phase 10 Architectural Domain Extraction)
// ============================================================

// Force snap scroll position to top on page load to fix iOS Safari viewport panning offset
window.addEventListener('load', () => {
  setTimeout(() => {
    forceViewportReset();
  }, 300);
  setTimeout(() => {
    forceViewportReset();
  }, 800);
});


// Handlers for HTML inline onclick attributes
let _devTapCount = 0;
let _devTapTimer = null;
function handleRecoveryTitleTap() {
  _devTapCount++;
  clearTimeout(_devTapTimer);
  _devTapTimer = setTimeout(() => { _devTapCount = 0; }, 3000);
  if (_devTapCount >= 5) {
    _devTapCount = 0;
    const devRow = document.getElementById('hub-row-security');
    if (devRow) devRow.scrollIntoView({ behavior: 'smooth' });
    if (typeof showToast === 'function') showToast(state.lang === 'el' ? '🛠️ Λειτουργίες Προγραμματιστή' : '🛠️ Developer Options');
  }
}
window.handleRecoveryTitleTap = handleRecoveryTitleTap;

// ============================================================
// EXCEL & CSV DATA IMPORT SERVICE
// Extracted to js/importService.js (Phase 11B Architectural Extraction)
// ============================================================

function clearCacheAndReset() {
  if (typeof forceAppUpdate === 'function') {
    forceAppUpdate();
  }
}
window.clearCacheAndReset = clearCacheAndReset;

// ============================================================
// CLEAR DATA & DELETE ACCOUNT (with safety locks)
// ============================================================

// Generic PIN prompt modal -> resolves with the entered PIN string, or null if cancelled.
// ============================================================
// CLEAR DATA & DELETE ACCOUNT SAFETY PROMPTS
// Extracted to js/dialogService.js (Phase 5 Architectural Domain Extraction)
// ============================================================
// 🗑️ Clear Local Data - PIN if exists, otherwise type "ΔΙΑΓΡΑΦΗ"
async function clearLocalDataConfirm() {
  const hasPin = localStorage.getItem('app_pin') && localStorage.getItem('app_lock_enabled') === 'true';

  if (hasPin) {
    const pin = await promptForPin(
      state.lang === 'el' ? 'Εισάγετε το PIN σας για να εκκαθαρίσετε τα τοπικά δεδομένα.' : 'Enter your PIN to clear local data.',
      state.lang === 'el' ? 'Εκκαθάριση Τοπικών Δεδομένων' : 'Clear Local Data'
    );
    if (!pin) return;
    const savedPin = localStorage.getItem('app_pin');
    if (pin !== savedPin) {
      showSyncToast("❌ " + (state.lang === 'el' ? 'Λάθος PIN!' : 'Incorrect PIN!'), 3000);
      return;
    }
  } else {
    const requiredWord = state.lang === 'el' ? 'ΔΙΑΓΡΑΦΗ' : 'DELETE';
    const confirmed = await promptForTypedConfirmation(
      state.lang === 'el'
        ? 'Θα διαγραφούν όλα τα δεδομένα που είναι αποθηκευμένα στη συσκευή. Η ενέργεια δεν μπορεί να αναιρεθεί.'
        : 'All data stored on this device will be deleted. This action cannot be undone.',
      requiredWord,
      state.lang === 'el' ? 'Εκκαθάριση Τοπικών Δεδομένων' : 'Clear Local Data'
    );
    if (!confirmed) return;
  }

  // Perform the local data wipe (keep user logged in)
  try {
    const keysToRemove = [
      'cached_current_user', 'cached_partner_profile',
      'offline_transactions', 'offline_accounts', 'offline_categories', 'offline_transactions_owner',
      'bg_active_modal_id', 'bg_active_modal_tx_id', 'bg_active_subcat_txs', 'bg_modal_scroll_top',
      'advisor_conversations', 'active_advisor_conversation_id',
      'notes_cache', 'recurring_templates_cache', 'trash_cache'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));

    state.transactions = [];
    state.trashTransactions = [];
    state.accounts = [];
    state.categories = [];
    state.notes = [];
    state.recurringTemplates = [];
    state.deletedRecurringDates = [];
    state.notifications = [];

    // Close any open modals
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.tx-modal-overlay').forEach(m => m.classList.remove('active'));
    document.body.classList.remove('modal-open');

    updateUI();
    showSyncToast("🗑️ " + (state.lang === 'el' ? 'Τα τοπικά δεδομένα εκκαθαρίστηκαν.' : 'Local data cleared.'), 3000);

    // Re-sync from cloud if logged in
    if (state.supabaseClient && state.currentUser) {
      setTimeout(() => { forceSyncNow(true); }, 600);
    }
  } catch (err) {
    console.error('Clear local data error:', err);
    showSyncToast("❌ " + (state.lang === 'el' ? 'Σφάλμα κατά την εκκαθάριση.' : 'Error while clearing.'), 3000);
  }
}
window.clearLocalDataConfirm = clearLocalDataConfirm;

// ⚠️ Delete Account - PIN if exists, otherwise type "ΔΙΑΓΡΑΦΗ ΛΟΓΑΡΙΑΣΜΟΥ"
async function deleteAccountConfirm() {
  const hasPin = localStorage.getItem('app_pin') && localStorage.getItem('app_lock_enabled') === 'true';

  if (hasPin) {
    const pin = await promptForPin(
      state.lang === 'el' ? 'Εισάγετε το PIN σας για να διαγράψετε τον λογαριασμό.' : 'Enter your PIN to delete your account.',
      state.lang === 'el' ? 'Διαγραφή Πορτοφολιού' : 'Delete Wallet'
    );
    if (!pin) return;
    const savedPin = localStorage.getItem('app_pin');
    if (pin !== savedPin) {
      showSyncToast("❌ " + (state.lang === 'el' ? 'Λάθος PIN!' : 'Incorrect PIN!'), 3000);
      return;
    }
  } else {
    const requiredWord = state.lang === 'el' ? 'ΔΙΑΓΡΑΦΗ ΛΟΓΑΡΙΑΣΜΟΥ' : 'DELETE ACCOUNT';
    const confirmed = await promptForTypedConfirmation(
      state.lang === 'el'
        ? 'Θα διαγραφεί ο λογαριασμός σας και όλα τα δεδομένα σας από το cloud. Η ενέργεια δεν μπορεί να αναιρεθεί.'
        : 'Your account and all your data will be permanently deleted from the cloud. This action cannot be undone.',
      requiredWord,
      state.lang === 'el' ? 'Διαγραφή Λογαριασμού' : 'Delete Account',
      state.lang === 'el' ? 'Οριστική Διαγραφή' : 'Permanently Delete'
    );
    if (!confirmed) return;
  }

  // Final confirmation
  const finalConfirm = await showConfirm(
    state.lang === 'el'
      ? 'Είστε απόλυτα σίγουροι; Ο λογαριασμός και όλα τα δεδομένα θα διαγραφούν οριστικά.'
      : 'Are you absolutely sure? Your account and all data will be permanently deleted.',
    state.lang === 'el' ? 'Οριστική Διαγραφή' : 'Permanent Deletion',
    '⚠️'
  );
  if (!finalConfirm) return;

  try {
    let session = null;
    if (state.supabaseClient) {
      const { data } = await state.supabaseClient.auth.getSession();
      session = data && data.session;
    }
    if (!session || !session.access_token) {
      showSyncToast("❌ " + (state.lang === 'el' ? 'Δεν υπάρχει ενεργή σύνδεση.' : 'No active session.'), 3000);
      return;
    }

    showSyncToast("⏳ " + (state.lang === 'el' ? 'Διαγραφή λογαριασμού...' : 'Deleting account...'), 0);

    const res = await fetch(getBackendApiUrl('/api/delete-account'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token
      }
    });
    const result = await res.json().catch(() => ({}));

    if (!res.ok || !result.success) {
      // Localize the family-membership block message (server returns it in English only).
      let errorText = result.error || res.status;
      if (result.code === 'FAMILY_MEMBERSHIP_REQUIRED') {
        errorText = state.lang === 'el'
          ? 'Δεν μπορείτε να διαγράψετε τον λογαριασμό σας όσο είστε μέλος μιας οικογενειακής ομάδας. Αποχωρήστε πρώτα από την ομάδα (ή μεταφέρετε τα δικαιώματα διαχειριστή σε άλλο μέλος αν είστε ο μόνος διαχειριστής) και δοκιμάστε ξανά.'
          : 'Cannot delete account while you are a member of a family group. Please leave the family group first (or transfer admin to another member if you are the only admin), then try again.';
      }
      showSyncToast("❌ " + (state.lang === 'el' ? 'Αποτυχία διαγραφής: ' : 'Deletion failed: ') + errorText, 4000);
      return;
    }

    // Clear all local data and log out
    localStorage.clear();
    state.transactions = [];
    state.trashTransactions = [];
    state.accounts = [];
    state.categories = [];
    state.notes = [];
    state.currentUser = null;
    state.userProfile = null;
    state.partnerProfile = null;
    state.familyProfiles = [];
    state.familyGroup = null;
    state.recurringTemplates = [];
    state.deletedRecurringDates = [];
    state.notifications = [];
    state.guestMode = false;

    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.tx-modal-overlay').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.profile-sheet-overlay').forEach(m => m.classList.remove('active'));
    document.body.classList.remove('modal-open');

    updateUI();
    showSyncToast("✅ " + (state.lang === 'el' ? 'Ο λογαριασμός διαγράφηκε.' : 'Account deleted.'), 3000);

    // Show auth UI
    const authOverlay = document.getElementById('auth-overlay');
    const formsContainer = document.getElementById('auth-forms-container');
    const authCard = document.getElementById('auth-card');
    const loadingState = document.getElementById('auth-loading-state');
    if (authOverlay) authOverlay.style.display = 'flex';
    if (formsContainer) formsContainer.style.display = 'block';
    if (authCard) authCard.style.display = 'flex';
    if (loadingState) loadingState.style.display = 'none';
  } catch (err) {
    console.error('Delete account error:', err);
    showSyncToast("❌ " + (state.lang === 'el' ? 'Σφάλμα κατά τη διαγραφή.' : 'Error during deletion.'), 4000);
  }
}
window.deleteAccountConfirm = deleteAccountConfirm;


setTimeout(() => {
  forceViewportReset();
}, 800);

// ============================================================
// BILINGUAL USER GUIDE (ΟΔΗΓΟΣ ΧΡΗΣΗΣ) ENGINE
// Extracted to js/userGuide.js (Phase 2 Modular Domain Extraction)
// ============================================================


// ============================================================================
// 🔒🔒🔒 FROZEN / DO-NOT-TOUCH — RECURRING DELETION & GROUPED TRASH 🔒🔒🔒
// ============================================================================
// ⚠️  THIS CODE IS FROZEN. DO NOT MODIFY, REFACTOR, "CLEAN UP", OR "OPTIMIZE"
//     ANY RECURRING-TRANSACTIONS CODE UNLESS THE USER EXPLICITLY ASKS FOR IT.
//
// WHY: This subsystem was deeply audited (see plans/recurring-architecture-deep-review.md)
//      and hardened (Build v1400–v1402). It has subtle invariants that are easy to break:
//        • "Delete future occurrences" MUST set endType='date' + endDate (NOT untilDate).
//        • _computeRecurringSeriesDates() has a NaN guard + 240-iteration cap.
//        • Grouped trash restore must preserve the recurring series linkage.
//      Past "innocent" edits repeatedly broke these invariants and caused user-facing
//      data corruption / crashes. See plans/RECURRING-FROZEN-GUARDRAIL.md for the full
//      list of frozen functions and the exact rules.
//
// RULE: If you are an AI agent or developer making an UNRELATED change, leave this
//       entire block untouched. Only edit when the user explicitly requests a change
//       to recurring transactions.
// ============================================================================
// ============================================================
// SCOPED RECURRING DELETION & GROUPED TRASH SYSTEM
// ============================================================
window._activeRecurringDeleteContext = null;

function openRecurringDeleteModal(target, occurrenceDateStr, opts) {
  // Bulk selection (array of transaction objects): multiple recurring transactions
  // selected at once. Route through the bulk-aware modal so the 3 options appear.
  if (Array.isArray(target)) {
    openBulkRecurringDeleteModal(target, opts || {});
    return;
  }
  let templateId = null;
  let txId = null;
  let anchorDate = occurrenceDateStr || '';
  let note = '';
  let category = '';
  let amount = 0;
  let type = 'expense';
  let accountFrom = '';

  if (typeof target === 'object' && target !== null) {
    txId = target.id;
    templateId = target.recurring_template_id;
    anchorDate = occurrenceDateStr || String(target.date || '').split('T')[0].split(' ')[0];
    note = target.note || target.description || '';
    category = target.category || '';
    amount = parseFloat(target.amount || 0);
    type = target.type || 'expense';
    accountFrom = target.account_from || '';
  } else if (typeof target === 'string') {
    templateId = target;
    const template = (state.recurringTemplates || []).find(t => String(t.id) === String(target));
    if (template) {
      anchorDate = occurrenceDateStr || String(template.startDate || '').split('T')[0].split(' ')[0];
      note = template.note || '';
      category = template.category || '';
      amount = parseFloat(template.amount || 0);
      type = template.type || 'expense';
      accountFrom = template.account_from || '';
    }
  }

  if (!templateId && txId) {
    const tx = (state.transactions || []).find(t => String(t.id) === String(txId));
    if (tx) {
      const txAmount = (parseFloat(tx.amount) || 0).toFixed(2);
      const txType = tx.type;
      const txCat = normalizeCategoryName(tx.category);

      const match = (state.recurringTemplates || []).find(t => {
        return (parseFloat(t.amount) || 0).toFixed(2) === txAmount &&
          t.type === txType &&
          isSameCategory(t.category, tx.category);
      });
      if (match) templateId = match.id;
    }
  }

  window._activeRecurringDeleteContext = {
    txId,
    templateId,
    anchorDate,
    note,
    category,
    amount,
    type,
    accountFrom
  };

  const lang = state.lang || 'el';
  const dict = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[lang]) ? TRANSLATIONS[lang] : {};
  document.querySelectorAll('#recurring-delete-step1-modal [data-i18n], #recurring-delete-step2-modal [data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (k && dict[k]) {
      el.textContent = dict[k];
    }
  });

  const singleRadio = document.querySelector('input[name="recurring_delete_scope"][value="single"]');
  if (singleRadio) singleRadio.checked = true;

  // When opened right after closing the transaction modal (Capacitor WebView),
  // use the instant path so the modal is activated synchronously and cannot be
  // swallowed by the previous modal's close animation / viewport reset.
  openModal('recurring-delete-step1-modal', { instant: !!(opts && opts.instant) });
}
window.openRecurringDeleteModal = openRecurringDeleteModal;

let _isExecutingRecurringDelete = false;

function handleRecurringDeleteStep1() {
  const selectedScope = document.querySelector('input[name="recurring_delete_scope"]:checked')?.value || 'single';

  const modal1 = document.getElementById('recurring-delete-step1-modal');
  if (modal1) modal1.classList.remove('active');
  closeModal('recurring-delete-step1-modal', { userInitiated: true });

  if (selectedScope === 'all') {
    const btn2 = document.getElementById('recurring-delete-step2-confirm-btn');
    if (btn2) {
      btn2.disabled = false;
      btn2.style.opacity = '1';
      btn2.style.pointerEvents = 'auto';
    }
    openModal('recurring-delete-step2-modal', { instant: true });
  } else {
    executeRecurringDelete(selectedScope);
  }
}
window.handleRecurringDeleteStep1 = handleRecurringDeleteStep1;

function handleRecurringDeleteStep2() {
  if (_isExecutingRecurringDelete) return;
  _isExecutingRecurringDelete = true;

  const btn = document.getElementById('recurring-delete-step2-confirm-btn');
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.pointerEvents = 'none';
  }

  const modal1 = document.getElementById('recurring-delete-step1-modal');
  if (modal1) modal1.classList.remove('active');
  const modal2 = document.getElementById('recurring-delete-step2-modal');
  if (modal2) modal2.classList.remove('active');

  closeModal('recurring-delete-step2-modal', { userInitiated: true });
  closeModal('recurring-delete-step1-modal', { userInitiated: true });

  executeRecurringDelete('all').finally(() => {
    _isExecutingRecurringDelete = false;
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    }
  });
}
window.handleRecurringDeleteStep2 = handleRecurringDeleteStep2;

// Strict membership test: a transaction belongs to the recurring series being
// deleted ONLY if it carries the exact recurring_template_id, OR (as a fallback
// for transactions created before recurring_template_id was stored / where it
// was stripped before cloud upsert) it matches the FULL content-key used by the
// recurring generator: amount + type + category. The old fallback matched only
// amount + category. The account_from check was removed to allow users to move
// recurring transactions between accounts without breaking the series link.
function _txBelongsToRecurringSeries(t, ctx) {
  if (!t || !ctx) return false;
  if (ctx.templateId && String(t.recurring_template_id) === String(ctx.templateId)) {
    return true;
  }
  // Strict content fallback — must match on identifying fields.
  // Category is compared via isSameCategory so a transaction whose
  // category is translated (Greek/English) still matches the series.
  const matchesContent =
    (parseFloat(t.amount || 0).toFixed(2) === (parseFloat(ctx.amount) || 0).toFixed(2)) &&
    (t.type || '') === (ctx.type || '') &&
    isSameCategory(t.category, ctx.category);
  if (!matchesContent) return false;

  // The content fallback alone (amount + type + category) is too loose: it would
  // sweep up unrelated one-off transactions that merely share the same amount,
  // type and category as the series. To keep the fallback safe for legacy
  // transactions whose recurring_template_id was stripped, additionally require
  // that the transaction's date is one of the ACTUAL computed occurrence dates of
  // the series. A genuine recurring occurrence always falls on a series date,
  // whereas a random manual transaction in the same category almost never does.
  const template = (state.recurringTemplates || []).find(tm => String(tm.id) === String(ctx.templateId));
  if (!template) return false;
  const seriesDates = _computeRecurringSeriesDates(template);
  const tDate = String(t.date || '').split('T')[0].split(' ')[0];
  return seriesDates.includes(tDate);
}
// _computeRecurringSeriesDates → extracted to js/recurringDates.js (Phase 2, Extraction 5)

async function executeRecurringDelete(scope) {
  const m1 = document.getElementById('recurring-delete-step1-modal');
  if (m1) m1.classList.remove('active');
  const m2 = document.getElementById('recurring-delete-step2-modal');
  if (m2) m2.classList.remove('active');
  closeModal('recurring-delete-step1-modal', { userInitiated: true });
  closeModal('recurring-delete-step2-modal', { userInitiated: true });

  const ctx = window._activeRecurringDeleteContext;
  if (!ctx) return;

  // Bulk recurring multi-delete (multiple selected recurring transactions):
  // delegate to the bulk executor which applies the chosen scope to every
  // involved recurring series and also deletes the regular selections.
  if (ctx.bulkMode) {
    await executeBulkRecurringDelete(scope, ctx);
    return;
  }

  const { templateId, txId, anchorDate } = ctx;
  const lang = state.lang || 'el';
  const template = (state.recurringTemplates || []).find(t => String(t.id) === String(templateId));
  const templateBackup = template ? JSON.parse(JSON.stringify(template)) : null;
  const deletedRecurringDatesBackup = [...(state.deletedRecurringDates || [])];

  const affectedTransactions = [];
  const affectedTransactionIds = [];

  let subtitleText = '';
  const anchorDateObj = new Date(anchorDate);
  const monthNamesEl = ['Ιανουάριο', 'Φεβρουάριο', 'Μάρτιο', 'Απρίλιο', 'Μάιο', 'Ιούνιο', 'Ιούλιο', 'Αύγουστο', 'Σεπτέμβριο', 'Οκτώβριο', 'Νοέμβριο', 'Δεκέμβριο'];
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthStr = !isNaN(anchorDateObj.getTime())
    ? (lang === 'el' ? monthNamesEl[anchorDateObj.getMonth()] + ' ' + anchorDateObj.getFullYear() : monthNamesEn[anchorDateObj.getMonth()] + ' ' + anchorDateObj.getFullYear())
    : anchorDate;

  if (scope === 'single') {
    subtitleText = lang === 'el'
      ? `🔄 Επαναλαμβανόμενη • Μόνο αυτή η κίνηση (${anchorDate})`
      : `🔄 Recurring • Single occurrence (${anchorDate})`;

    if (templateId && anchorDate) {
      const key = `${templateId}_${anchorDate}`;
      if (!state.deletedRecurringDates.includes(key)) {
        state.deletedRecurringDates.push(key);
        localStorage.setItem('deleted_recurring_dates', JSON.stringify(state.deletedRecurringDates));
      }
      if (template) {
        addDeletedDateToTemplate(template, anchorDate);
        localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
        // Persist the deleted-date marker to the cloud template so a later cloud
        // sync (which overwrites state.recurringTemplates) does not lose it and
        // re-create this occurrence via processRecurringTemplates().
        if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
          state.supabaseClient.from('recurring_templates').upsert([mapTemplateToDb(template)])
            .then(({ error }) => {
              if (error) console.warn('Failed to sync deleted recurring date to cloud:', error);
            });
        }
      }
    }

    state.transactions = state.transactions.filter(t => {
      const tDate = String(t.date || '').split('T')[0];
      const match = (txId && String(t.id) === String(txId)) ||
        (tDate === anchorDate && _txBelongsToRecurringSeries(t, ctx));
      if (match) {
        affectedTransactions.push({ ...t });
        affectedTransactionIds.push(t.id);
        return false;
      }
      return true;
    });

  } else if (scope === 'future') {
    subtitleText = lang === 'el'
      ? `🔄 Επαναλαμβανόμενη • Από ${monthStr} και μετά`
      : `🔄 Recurring • From ${monthStr} onwards`;

    state.transactions = state.transactions.filter(t => {
      const tDate = String(t.date || '').split('T')[0];
      const isFromAnchorOnwards = tDate >= anchorDate;
      const match = isFromAnchorOnwards && _txBelongsToRecurringSeries(t, ctx);
      if (match) {
        affectedTransactions.push({ ...t });
        affectedTransactionIds.push(t.id);
        return false;
      }
      return true;
    });

    if (template) {
      // Terminate the recurring series on the day before the deleted anchorDate
      const anchorD = new Date(anchorDate);
      if (!isNaN(anchorD.getTime())) {
        anchorD.setDate(anchorD.getDate() - 1);
        template.endType = 'date';
        template.endDate = anchorD.toISOString().split('T')[0];
      }
      localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
      // Persist the new end date to the cloud template so a later cloud sync
      // does not resurrect the future occurrences that were just deleted.
      if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
        state.supabaseClient.from('recurring_templates').upsert([mapTemplateToDb(template)])
          .then(() => { }, ({ error }) => {
            if (error) console.warn('Failed to sync recurring end date to cloud:', error);
          });
      }
    }

  } else if (scope === 'all') {
    state.transactions = state.transactions.filter(t => {
      const match = _txBelongsToRecurringSeries(t, ctx);
      if (match) {
        affectedTransactions.push({ ...t });
        affectedTransactionIds.push(t.id);
        return false;
      }
      return true;
    });

    // For a perpetual ("forever") series, also capture the full series of
    // not-yet-materialized future occurrences so the trash reflects the WHOLE
    // series, not just the months already generated in state.transactions.
    // Synthetic entries are marked _synthetic:true and are NOT soft-deleted in
    // the cloud nor re-inserted on restore (the restored template regenerates
    // them). They exist only so the trash shows the complete series.
    if (template) {
      const seriesDates = _computeRecurringSeriesDates(template);
      const existingDates = new Set(affectedTransactions.map(t => String(t.date || '').split('T')[0]));
      seriesDates.forEach(dateStr => {
        if (existingDates.has(dateStr)) return;
        affectedTransactions.push({
          id: 'recurring_future_' + template.id + '_' + dateStr,
          _synthetic: true,
          recurring_template_id: template.id,
          date: dateStr,
          type: template.type,
          amount: parseFloat(template.amount || 0),
          category: template.category,
          subcategory: template.subcategory || '',
          account_from: template.account_from,
          account_to: template.type === 'transfer' ? template.account_to : null,
          note: template.note,
          description: template.description || '',
          user_id: template.user_id || (state.currentUser ? state.currentUser.id : null),
          is_shared: template.is_shared !== undefined ? template.is_shared : (state.partnerProfile !== null),
          family_id: template.family_id || (state.userProfile ? state.userProfile.family_id : null)
        });
      });
    }

    subtitleText = lang === 'el'
      ? `🔄 Επαναλαμβανόμενη • Όλη η σειρά (${affectedTransactions.length} κινήσεις)`
      : `🔄 Recurring • Full series (${affectedTransactions.length} occurrences)`;

    if (templateId) {
      state.recurringTemplates = (state.recurringTemplates || []).filter(t => String(t.id) !== String(templateId));
      localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
    }
  }

  localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));

  const trashGroup = {
    id: 'trash_group_' + Date.now(),
    is_recurring_group: true,
    scope: scope,
    templateId: templateId,
    anchorDate: anchorDate,
    note: ctx.note || ctx.category || (lang === 'el' ? 'Επαναλαμβανόμενη' : 'Recurring'),
    amount: ctx.amount,
    category: ctx.category,
    type: ctx.type,
    subtitle: subtitleText,
    affectedTransactionsSnapshot: affectedTransactions,
    affectedTransactionIds: affectedTransactionIds,
    templateBackup: templateBackup,
    deletedRecurringDatesBackup: deletedRecurringDatesBackup,
    deleted_at: new Date().toISOString()
  };

  if (!state.trashTransactions) state.trashTransactions = [];
  state.trashTransactions.unshift(trashGroup);
  localStorage.setItem('deleted_transactions_trash', JSON.stringify(state.trashTransactions));

  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    if (scope === 'all' && templateId) {
      enqueueSyncMutation('delete_template', templateId);
      state.supabaseClient.from('recurring_templates').delete().eq('id', templateId);
    }
    if (affectedTransactionIds.length > 0) {
      affectedTransactionIds.forEach(dId => {
        _markRecentlyDeleted(dId);
        enqueueSyncMutation('delete', dId);
      });
      // Status model: soft-delete the affected transactions so they stay
      // restorable in the trash across all devices.
      state.supabaseClient.from('transactions')
        .update({
          status: 'deleted',
          deleted_at: new Date().toISOString(),
          deleted_by: state.currentUser.id
        })
        .in('id', affectedTransactionIds);
    }
  }

  if (affectedTransactionIds.length > 0) {
    affectedTransactionIds.forEach(dId => _markRecentlyDeleted(dId));
  }

  window._activeRecurringDeleteContext = null;
  calculateInitialBalances();
  updateUI();

  // Re-run active search if search overlay has a query so deleted items disappear immediately
  if (typeof executeSearch === 'function') {
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value) {
      executeSearch();
    }
  }

  // If the trash bin modal is currently open, re-render it immediately so the
  // newly deleted recurring group appears without requiring the user to leave
  // and re-enter the tab. updateUI() above skips the tab re-render while any
  // modal is open, so the trash list would otherwise stay stale.
  const trashModal = document.getElementById('trash-bin-modal');
  if (trashModal && trashModal.classList.contains('active')) {
    renderTrashBinList();
  }

  const recDetailsModal = document.getElementById('recurring-details-modal');
  if (recDetailsModal && recDetailsModal.classList.contains('active')) {
    if (templateId && (state.recurringTemplates || []).some(t => String(t.id) === String(templateId))) {
      openRecurringDetailsModal(templateId);
    } else {
      closeModal('recurring-details-modal');
      openRecurringTemplatesModal();
    }
  }

  const successMsg = lang === 'el' ? '🗑️ Η διαγραφή πραγματοποιήθηκε.' : '🗑️ Deletion completed.';
  showSyncToast(successMsg, 3000);
}
window.executeRecurringDelete = executeRecurringDelete;

// ============================================================
// BULK RECURRING MULTI-DELETE (multiple selected recurring rows)
// ============================================================
// The 3-option recurring delete modal (single / future / all) is designed around
// ONE recurring series. When the user selects SEVERAL recurring transactions at
// once (or a mix of recurring + regular ones) from the multi-select delete bar,
// we still want the 3 options to appear instead of a plain "delete N" confirm.
// These two helpers bridge the modal to a bulk context:
//   • openBulkRecurringDeleteModal() — builds a bulk _activeRecurringDeleteContext
//     (one entry per selected occurrence + the regular selections).
//   • executeBulkRecurringDelete(scope, ctx) — applies the chosen scope to every
//     involved recurring series and also deletes the regular selections.

function openBulkRecurringDeleteModal(selectedTxns, opts) {
  const lang = state.lang || 'el';
  const entries = [];
  const seenTemplateIds = new Set();

  selectedTxns.forEach(tx => {
    if (!tx) return;
    const template = resolveRecurringTemplateForTx(tx);
    if (!template) return;
    const date = String(tx.date || '').split('T')[0].split(' ')[0];
    if (!date) return;
    seenTemplateIds.add(String(template.id));
    entries.push({ txId: tx.id, templateId: String(template.id), date, tx });
  });

  if (entries.length === 0) return;

  const plainSelectedIds = (opts && opts.plainSelectedIds) || [];
  const anchorDate = entries.map(e => e.date).sort()[0];
  const firstTx = entries[0].tx;

  window._activeRecurringDeleteContext = {
    bulkMode: true,
    bulkEntries: entries.map(({ txId, templateId, date }) => ({ txId, templateId, date })),
    templateId: seenTemplateIds.size === 1 ? entries[0].templateId : null,
    anchorDate: anchorDate,
    note: firstTx.note || firstTx.description || '',
    category: firstTx.category || '',
    amount: parseFloat(firstTx.amount || 0),
    type: firstTx.type || 'expense',
    accountFrom: firstTx.account_from || '',
    plainSelectedIds: plainSelectedIds
  };

  // Apply the standard i18n labels first...
  const dict = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[lang]) ? TRANSLATIONS[lang] : {};
  document.querySelectorAll('#recurring-delete-step1-modal [data-i18n], #recurring-delete-step2-modal [data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (k && dict[k]) el.textContent = dict[k];
  });

  // ...then override the description so it explains the multi-selection.
  const descEl = document.querySelector('#recurring-delete-step1-modal [data-i18n="recurring_delete_desc"]');
  if (descEl) {
    let desc;
    if (seenTemplateIds.size === 1) {
      desc = lang === 'el'
        ? `Επιλέχθηκαν ${entries.length} επαναλαμβανόμενες κινήσεις της ίδιας επανάληψης. Τι ακριβώς θέλετε να διαγραφεί;`
        : `${entries.length} recurring transactions from the same series are selected. What would you like to delete?`;
    } else {
      desc = lang === 'el'
        ? `Επιλέχθηκαν επαναλαμβανόμενες κινήσεις από ${seenTemplateIds.size} διαφορετικές επαναλήψεις. Τι ακριβώς θέλετε να διαγραφεί;`
        : `Recurring transactions from ${seenTemplateIds.size} different series are selected. What would you like to delete?`;
    }
    if (plainSelectedIds.length > 0) {
      desc += lang === 'el'
        ? ` (Θα διαγραφούν επίσης ${plainSelectedIds.length} κανονικές επιλεγμένες κινήσεις.)`
        : ` (Additionally, ${plainSelectedIds.length} selected regular transaction(s) will be deleted.)`;
    }
    descEl.textContent = desc;
  }

  const singleRadio = document.querySelector('input[name="recurring_delete_scope"][value="single"]');
  if (singleRadio) singleRadio.checked = true;

  openModal('recurring-delete-step1-modal', { instant: !!(opts && opts.instant) });
}
window.openBulkRecurringDeleteModal = openBulkRecurringDeleteModal;

async function executeBulkRecurringDelete(scope, ctx) {
  const lang = state.lang || 'el';
  const entries = (ctx.bulkEntries || []).filter(e => e && e.templateId);
  const plainIdSet = new Set((ctx.plainSelectedIds || []).map(String));
  if (!state.deletedRecurringDates) state.deletedRecurringDates = [];

  const affectedTransactions = [];
  const affectedTransactionIds = [];
  const collectedIds = new Set();
  const deletedRecurringDatesBackup = [...(state.deletedRecurringDates || [])];

  const collectAndRemove = (t) => {
    if (!t) return false;
    if (!collectedIds.has(String(t.id))) {
      collectedIds.add(String(t.id));
      affectedTransactions.push({ ...t });
      affectedTransactionIds.push(t.id);
    }
    return false;
  };

  // Group the selected occurrences by recurring series.
  const seriesByTemplate = new Map();
  entries.forEach(entry => {
    if (!seriesByTemplate.has(entry.templateId)) {
      seriesByTemplate.set(entry.templateId, { templateId: entry.templateId, entries: [] });
    }
    seriesByTemplate.get(entry.templateId).entries.push(entry);
  });

  const ctxByTemplate = new Map();
  const templateBackups = new Map();
  seriesByTemplate.forEach(group => {
    const template = (state.recurringTemplates || []).find(t => String(t.id) === String(group.templateId)) || null;
    const sampleTx = (state.transactions || []).find(t => String(t.id) === String(group.entries[0].txId)) || template || {};
    group.template = template;
    group.anchorDate = group.entries.map(e => e.date).sort()[0];
    const seriesCtx = {
      templateId: group.templateId,
      amount: parseFloat(template ? template.amount : (sampleTx.amount || 0)) || 0,
      type: (template ? template.type : sampleTx.type) || 'expense',
      category: (template ? template.category : sampleTx.category) || ''
    };
    group.ctx = seriesCtx;
    ctxByTemplate.set(group.templateId, seriesCtx);
    if (template) {
      templateBackups.set(group.templateId, JSON.parse(JSON.stringify(template)));
    }
  });

  suppressRealtimeFor(8000);

  if (scope === 'single') {
    // Delete ONLY the selected occurrence(s) — one per selected recurring row —
    // and mark each date as deleted on its template so they never regenerate.
    entries.forEach(entry => {
      const key = `${entry.templateId}_${entry.date}`;
      if (!state.deletedRecurringDates.includes(key)) {
        state.deletedRecurringDates.push(key);
      }
      const template = (state.recurringTemplates || []).find(t => String(t.id) === String(entry.templateId));
      if (template) {
        addDeletedDateToTemplate(template, entry.date);
      }
      const seriesCtx = ctxByTemplate.get(entry.templateId);
      state.transactions = (state.transactions || []).filter(t => {
        const tDate = String(t.date || '').split('T')[0].split(' ')[0];
        const match = String(t.id) === String(entry.txId) ||
          (tDate === entry.date && seriesCtx && _txBelongsToRecurringSeries(t, seriesCtx));
        return match ? collectAndRemove(t) : true;
      });
    });
    localStorage.setItem('deleted_recurring_dates', JSON.stringify(state.deletedRecurringDates));
    localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
    if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
      ctxByTemplate.forEach((_, tid) => {
        const template = (state.recurringTemplates || []).find(t => String(t.id) === String(tid));
        if (template) {
          state.supabaseClient.from('recurring_templates').upsert([mapTemplateToDb(template)])
            .then(({ error }) => {
              if (error) console.warn('Failed to sync deleted recurring date to cloud:', error);
            });
        }
      });
    }
  } else if (scope === 'future') {
    // Delete from the earliest selected occurrence onwards for every involved series.
    seriesByTemplate.forEach(group => {
      const anchorDate = group.anchorDate;
      const seriesCtx = group.ctx;
      state.transactions = (state.transactions || []).filter(t => {
        const tDate = String(t.date || '').split('T')[0].split(' ')[0];
        const match = tDate >= anchorDate && seriesCtx && _txBelongsToRecurringSeries(t, seriesCtx);
        return match ? collectAndRemove(t) : true;
      });
      if (group.template) {
        const anchorD = new Date(anchorDate);
        if (!isNaN(anchorD.getTime())) {
          anchorD.setDate(anchorD.getDate() - 1);
          group.template.endType = 'date';
          group.template.endDate = anchorD.toISOString().split('T')[0];
        }
      }
    });
    localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
    if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
      seriesByTemplate.forEach(group => {
        if (group.template) {
          state.supabaseClient.from('recurring_templates').upsert([mapTemplateToDb(group.template)])
            .then(() => { }, ({ error }) => {
              if (error) console.warn('Failed to sync recurring end date to cloud:', error);
            });
        }
      });
    }
  } else if (scope === 'all') {
    // Delete the ENTIRE series for every involved template, including synthetic
    // future occurrences so the trash reflects the full series.
    seriesByTemplate.forEach(group => {
      const seriesCtx = group.ctx;
      state.transactions = (state.transactions || []).filter(t => {
        const match = seriesCtx && _txBelongsToRecurringSeries(t, seriesCtx);
        return match ? collectAndRemove(t) : true;
      });
      if (group.template) {
        const seriesDates = _computeRecurringSeriesDates(group.template);
        const existingDates = new Set(affectedTransactions
          .filter(t => String(t.recurring_template_id) === String(group.template.id))
          .map(t => String(t.date || '').split('T')[0]));
        seriesDates.forEach(dateStr => {
          if (existingDates.has(dateStr)) return;
          affectedTransactions.push({
            id: 'recurring_future_' + group.template.id + '_' + dateStr,
            _synthetic: true,
            recurring_template_id: group.template.id,
            date: dateStr,
            type: group.template.type,
            amount: parseFloat(group.template.amount || 0),
            category: group.template.category,
            subcategory: group.template.subcategory || '',
            account_from: group.template.account_from,
            account_to: group.template.type === 'transfer' ? group.template.account_to : null,
            note: group.template.note,
            description: group.template.description || '',
            user_id: group.template.user_id || (state.currentUser ? state.currentUser.id : null),
            is_shared: group.template.is_shared !== undefined ? group.template.is_shared : (state.partnerProfile !== null),
            family_id: group.template.family_id || (state.userProfile ? state.userProfile.family_id : null)
          });
        });
      }
    });
    // Remove the recurring templates themselves.
    const tidsToRemove = new Set();
    seriesByTemplate.forEach(group => tidsToRemove.add(String(group.templateId)));
    state.recurringTemplates = (state.recurringTemplates || []).filter(t => !tidsToRemove.has(String(t.id)));
    localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
  }

  // Selected regular (non-recurring) transactions are always deleted too.
  if (plainIdSet.size > 0) {
    state.transactions = (state.transactions || []).filter(t => {
      return plainIdSet.has(String(t.id)) ? collectAndRemove(t) : true;
    });
  }

  localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));

  // ---------- Trash group ----------
  const singleTemplateId = ctx.templateId || (seriesByTemplate.size === 1 ? String(seriesByTemplate.keys().next().value) : null);
  const seriesCount = seriesByTemplate.size;
  let subtitleText;
  if (scope === 'single') {
    subtitleText = lang === 'el'
      ? `🔄 Επαναλαμβανόμενες • Μόνο οι ${entries.length} επιλεγμένες κινήσεις`
      : `🔄 Recurring • Only the ${entries.length} selected occurrence(s)`;
  } else if (scope === 'future') {
    subtitleText = lang === 'el'
      ? `🔄 Επαναλαμβανόμενες • Από την επιλογή και μετά (${seriesCount} σειρά/ές)`
      : `🔄 Recurring • From the selection onwards (${seriesCount} series)`;
  } else {
    subtitleText = lang === 'el'
      ? `🔄 Επαναλαμβανόμενες • Ολόκληρες οι σειρές (${seriesCount} σειρά/ές)`
      : `🔄 Recurring • Full series (${seriesCount} series)`;
  }
  if (plainIdSet.size > 0) {
    subtitleText += lang === 'el' ? ` + ${plainIdSet.size} κανονικές` : ` + ${plainIdSet.size} regular`;
  }

  const trashGroup = {
    id: 'trash_group_' + Date.now(),
    is_recurring_group: true,
    scope: scope,
    templateId: singleTemplateId,
    anchorDate: ctx.anchorDate,
    note: ctx.note || ctx.category || (lang === 'el' ? 'Επαναλαμβανόμενες' : 'Recurring'),
    amount: ctx.amount,
    category: ctx.category,
    type: ctx.type,
    subtitle: subtitleText,
    affectedTransactionsSnapshot: affectedTransactions,
    affectedTransactionIds: affectedTransactionIds,
    templateBackup: singleTemplateId && templateBackups.has(singleTemplateId) ? templateBackups.get(singleTemplateId) : null,
    deletedRecurringDatesBackup: deletedRecurringDatesBackup,
    deleted_at: new Date().toISOString()
  };
  if (!state.trashTransactions) state.trashTransactions = [];
  state.trashTransactions.unshift(trashGroup);
  localStorage.setItem('deleted_transactions_trash', JSON.stringify(state.trashTransactions));

  // ---------- Cloud sync ----------
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    if (scope === 'all') {
      seriesByTemplate.forEach(group => {
        enqueueSyncMutation('delete_template', group.templateId);
        state.supabaseClient.from('recurring_templates').delete().eq('id', group.templateId);
      });
    }
    if (affectedTransactionIds.length > 0) {
      affectedTransactionIds.forEach(dId => {
        _markRecentlyDeleted(dId);
        enqueueSyncMutation('delete', dId);
      });
      // Status model: soft-delete the affected transactions so they stay
      // restorable in the trash across all devices.
      state.supabaseClient.from('transactions')
        .update({
          status: 'deleted',
          deleted_at: new Date().toISOString(),
          deleted_by: state.currentUser.id
        })
        .in('id', affectedTransactionIds);
    }
  }
  if (affectedTransactionIds.length > 0) {
    affectedTransactionIds.forEach(dId => _markRecentlyDeleted(dId));
  }

  window._activeRecurringDeleteContext = null;
  calculateInitialBalances();
  updateUI();
  // The recurring-delete modal's close animation can leave it `.active` for a
  // moment, which makes updateUI() skip the tab re-render (see _updateUIImpl's
  // `anyModalOpen` guard). Force the transactions list to reflect the deletion
  // immediately so the bulk delete never leaves stale rows on screen.
  if (typeof renderTransactionsTab === 'function') {
    renderTransactionsTab();
  }



  // Re-run active search if the search overlay has a query so deleted items
  // disappear immediately.
  if (typeof executeSearch === 'function') {
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value) {
      executeSearch();
    }
  }

  // If the trash bin modal is currently open, re-render it immediately.
  const trashModal = document.getElementById('trash-bin-modal');
  if (trashModal && trashModal.classList.contains('active')) {
    renderTrashBinList();
  }

  const successMsg = lang === 'el' ? '🗑️ Η διαγραφή πραγματοποιήθηκε.' : '🗑️ Deletion completed.';
  showSyncToast(successMsg, 3000);
}
window.executeBulkRecurringDelete = executeBulkRecurringDelete;

// ============================================================
// TRASH BIN & RECOVERY SUBSYSTEM (deleteSingleTrashItem, restoreTrashGroup)
// Extracted to js/trashBinService.js (Phase 11A Architectural Extraction)
// ============================================================

// ============================================================
// ============================================================
// CUSTOM CALENDAR & DATE-TIME PICKER UNIFIED REFACTOR
// Extracted to js/customDatePicker.js (Phase 14D Architectural Extraction)
// ============================================================

// OTA boot-OK marker: resets the failure counter so a healthy build never
// rolls back. No-op when the OTA boot loader is absent (plain web/PWA).
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
  window.Capacitor.Plugins.CapacitorUpdater.notifyAppReady();
}

setTimeout(() => {
  if (typeof checkWeeklyAndMonthlyDigests === 'function') {
    checkWeeklyAndMonthlyDigests();
  }
  if (typeof checkRecurringPaymentAlerts === 'function') {
    checkRecurringPaymentAlerts();
  }
}, 2500);


// ============================================================
// ACCOUNT MANAGER & CUSTOM ACCOUNTS LOGIC
// Extracted to js/accountManagerService.js (Phase 16C Architectural Extraction)
// ============================================================
function openSettingsAccountManager() { return AccountManagerService.openSettingsAccountManager(); }
function renderAccountManagerList() { return AccountManagerService.renderAccountManagerList(); }
function openAccountEditorModal(index) { return AccountManagerService.openAccountEditorModal(index); }
function selectAccountEditorType(type) { return AccountManagerService.selectAccountEditorType(type); }
function saveAccountEditor() { return AccountManagerService.saveAccountEditor(); }
function deleteAccountFromManager(index) { return AccountManagerService.deleteAccountFromManager(index); }
function openSettleUpModal() { return AccountManagerService.openSettleUpModal(); }
function recordSettlementTransaction() { return AccountManagerService.recordSettlementTransaction(); }
if (typeof window.getMemberBadgeHTML !== 'function') {
  window.getMemberBadgeHTML = function(t) {
    if (typeof PartnerSyncService !== 'undefined' && typeof PartnerSyncService.getMemberBadgeHTML === 'function') {
      return PartnerSyncService.getMemberBadgeHTML(t);
    }
    return '';
  };
}


// =============================================================================
// PERSISTENT QUICK-ADD NOTIFICATION & VOICE AI ASSISTANT («🎙️ Οικονομικός Βοηθός»)
// Extracted to js/voiceAssistantService.js (Phase 13A Architectural Extraction)
// =============================================================================
