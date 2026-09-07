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
// Extracted to js/statsDateService.js (Phase 23A Architectural Modularization)
// ============================================================
function getStatsDateRange() { return StatsDateService.getStatsDateRange(); }
function syncStatsDate() { return StatsDateService.syncStatsDate(); }
function formatStatsPeriodTitle(start, end) { return StatsDateService.formatStatsPeriodTitle(start, end); }
function wrapPeriodTitleWithSpans(titleText) { return StatsDateService.wrapPeriodTitleWithSpans(titleText); }

window.getStatsDateRange = getStatsDateRange;
window.syncStatsDate = syncStatsDate;
window.formatStatsPeriodTitle = formatStatsPeriodTitle;
window.wrapPeriodTitleWithSpans = wrapPeriodTitleWithSpans;

// ============================================================
// CATEGORY HELPER, NORMALIZATION & EMOJI RESOLUTION SUBSYSTEM
// Extracted to js/categoryHelperService.js (Phase 23B Architectural Modularization)
// ============================================================
function stripLeadingEmoji(str) { return CategoryHelperService.stripLeadingEmoji(str); }
function getFirstEmojiCodepoint(str) { return CategoryHelperService.getFirstEmojiCodepoint(str); }
function resolveCategoryInfo(rawCategory, transType) { return CategoryHelperService.resolveCategoryInfo(rawCategory, transType); }

window.stripLeadingEmoji = stripLeadingEmoji;
window.getFirstEmojiCodepoint = getFirstEmojiCodepoint;
window.resolveCategoryInfo = resolveCategoryInfo;

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
// LUXURY SPLASH & COLD-START OVERLAY
// Extracted to js/splashLifecycleService.js (Phase 22A Architectural Modularization)
// ============================================================
function _markSplashFrameLoaded() { return SplashLifecycleService._markSplashFrameLoaded(); }
function _markLaunchWindowGone() { return SplashLifecycleService._markLaunchWindowGone(); }
function fadeOutColdStartOverlay() { return SplashLifecycleService.fadeOutColdStartOverlay(); }
function showResumeOverlay() { return SplashLifecycleService.showResumeOverlay(); }
function hideResumeOverlay() { return SplashLifecycleService.hideResumeOverlay(); }
function _notifyNativeContentPainted() { return SplashLifecycleService._notifyNativeContentPainted(); }

window._markSplashFrameLoaded = _markSplashFrameLoaded;
window._markLaunchWindowGone = _markLaunchWindowGone;
window.fadeOutColdStartOverlay = fadeOutColdStartOverlay;
window.showResumeOverlay = showResumeOverlay;
window.hideResumeOverlay = hideResumeOverlay;
window._notifyNativeContentPainted = _notifyNativeContentPainted;

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

// ============================================================
// AUTHENTICATION & SUPABASE AUTH CONTROLLER SUBSYSTEM
// Extracted to js/authService.js (Phase 21A Architectural Modularization)
// ============================================================
function loadConfig() { return AuthService.loadConfig(); }
function initSupabase() { return AuthService.initSupabase(); }
function toggleLoader(show) { return AuthService.toggleLoader(show); }
function initSupabaseAuth() { return AuthService.initSupabaseAuth(); }
function loadUserProfiles(user) { return AuthService.loadUserProfiles(user); }
function showPendingInviteCodePrompt(code) { return AuthService.showPendingInviteCodePrompt(code); }
function showPendingInvitationPrompt(invite) { return AuthService.showPendingInvitationPrompt(invite); }

window.toggleLoader = toggleLoader;

// ============================================================
// TRANSACTION SCOPE & BALANCE ENGINE SUBSYSTEM
// Extracted to js/transactionScopeService.js (Phase 21B Architectural Modularization)
// ============================================================
function applyWalletTheme() { return TransactionScopeService.applyWalletTheme(); }
function getActiveTransactions() { return TransactionScopeService.getActiveTransactions(); }
function isTransferTransaction(t) { return TransactionScopeService.isTransferTransaction(t); }
function calculateInitialBalances() { return TransactionScopeService.calculateInitialBalances(); }

window.applyWalletTheme = applyWalletTheme;
window.getActiveTransactions = getActiveTransactions;
window.isTransferTransaction = isTransferTransaction;
window.calculateInitialBalances = calculateInitialBalances;

// ============================================================
// DATA INTEGRITY, DEDUPLICATION & TOMBSTONE SUBSYSTEM
// Extracted to js/dataIntegrityService.js (Phase 22B Architectural Modularization)
// ============================================================
const _PERMANENT_DELETED_LS_KEY = (typeof window !== 'undefined' && window._PERMANENT_DELETED_LS_KEY)
  ? window._PERMANENT_DELETED_LS_KEY
  : 'permanent_deleted_tx_ids';

async function cleanDuplicateCategories() { return DataIntegrityService.cleanDuplicateCategories(); }
async function cleanDuplicateTransactions() { return DataIntegrityService.cleanDuplicateTransactions(); }
function getPendingLocalTransactions(cachedTransactions) { return DataIntegrityService.getPendingLocalTransactions(cachedTransactions); }
function collectPermanentlyDeletedTxIds() { return DataIntegrityService.collectPermanentlyDeletedTxIds(); }
function reconcileStaleTombstones(cloudActiveTransactions) { return DataIntegrityService.reconcileStaleTombstones(cloudActiveTransactions); }
function purgePermanentlyDeletedTxIds(ids, options) { return DataIntegrityService.purgePermanentlyDeletedTxIds(ids, options); }
async function autoSyncMissingTransactionsToCloud(cloudTransactions, userId) { return DataIntegrityService.autoSyncMissingTransactionsToCloud(cloudTransactions, userId); }

window.cleanDuplicateTransactions = cleanDuplicateTransactions;
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
// ============================================================
// HIGH-EXPENSE ALERT & MULTI-CURRENCY COMPUTATION ENGINE
// Extracted to js/highExpenseAlertService.js (Phase 18D Architectural Extraction)
// ============================================================
function checkHighExpenseAlert(transaction) { return HighExpenseAlertService.checkHighExpenseAlert(transaction); }
function computeCurrencyFields(t) { return HighExpenseAlertService.computeCurrencyFields(t); }

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

function normalizeCategoryName(name) { return CategoryHelperService.normalizeCategoryName(name); }
function getCategoryInfo(categoryName, transType) { return CategoryHelperService.getCategoryInfo(categoryName, transType); }
function getCategoryDisplayName(categoryName) { return CategoryHelperService.getCategoryDisplayName(categoryName); }
function isDefaultSubcategory(categoryName, subcategoryName) { return CategoryHelperService.isDefaultSubcategory(categoryName, subcategoryName); }
function getSubcategoryDisplayName(subName, categoryName) { return CategoryHelperService.getSubcategoryDisplayName(subName, categoryName); }

window.normalizeCategoryName = normalizeCategoryName;
window.getCategoryInfo = getCategoryInfo;
window.getCategoryDisplayName = getCategoryDisplayName;
window.isDefaultSubcategory = isDefaultSubcategory;
window.getSubcategoryDisplayName = getSubcategoryDisplayName;



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

// ============================================================
// TRANSACTION MODAL & FORM CONTROLLER SUBSYSTEM
// Extracted to js/transactionModalService.js (Phase 20B Architectural Modularization)
// ============================================================
function toggleTransactionFormLock(locked) { return TransactionModalService.toggleTransactionFormLock(locked); }
function openAddTransactionModal(opts) { return TransactionModalService.openAddTransactionModal(opts); }
function openEditTransactionModal(t, opts) { return TransactionModalService.openEditTransactionModal(t, opts); }

window.openAddTransactionModal = openAddTransactionModal;
window.openEditTransactionModal = openEditTransactionModal;

// ============================================================
// RECEIPT PHOTO LIGHTBOX
// Extracted to js/receiptService.js (Phase 15B Architectural Extraction)
// ============================================================

// ============================================================
// CATEGORY & SUBCATEGORY FORM PICKER & MODAL VIEW SUBSYSTEM
// Extracted to js/categoryPickerView.js (Phase 18C Architectural Extraction)
// ============================================================
function updateCategoryDisplay() { return CategoryPickerView.updateCategoryDisplay(); }
function updateSubcategoryRowVisibility() { return CategoryPickerView.updateSubcategoryRowVisibility(); }
function setTransactionFormType(type) { return CategoryPickerView.setTransactionFormType(type); }
function toggleCategoryPickerEditMode() { return CategoryPickerView.toggleCategoryPickerEditMode(); }
function inlineDeleteCustomCategory(catName) { return CategoryPickerView.inlineDeleteCustomCategory(catName); }
function inlineRenameCategory(oldName, newName) { return CategoryPickerView.inlineRenameCategory(oldName, newName); }
function getCustomCategoryOrder(type) { return CategoryPickerView.getCustomCategoryOrder(type); }
function setCustomCategoryOrder(type, order) { return CategoryPickerView.setCustomCategoryOrder(type, order); }
function getCustomSubcategoryOrder(cat) { return CategoryPickerView.getCustomSubcategoryOrder(cat); }
function setCustomSubcategoryOrder(cat, order) { return CategoryPickerView.setCustomSubcategoryOrder(cat, order); }
function updateCategoryDropdowns(activeType, preserveSelected) { return CategoryPickerView.updateCategoryDropdowns(activeType, preserveSelected); }
function selectCategory(categoryName) { return CategoryPickerView.selectCategory(categoryName); }
function selectSubcategory(subcatName) { return CategoryPickerView.selectSubcategory(subcatName); }
function openCategoryModal() { return CategoryPickerView.openCategoryModal(); }
function openEditCategoryDialog(catName, type) { return CategoryPickerView.openEditCategoryDialog(catName, type); }
function openNewCategoryDialog(type) { return CategoryPickerView.openNewCategoryDialog(type); }
function closeNewCategoryDialog() { return CategoryPickerView.closeNewCategoryDialog(); }
function renderCategoryIconDialog(libraryFilter, searchQuery) { return CategoryPickerView.renderCategoryIconDialog(libraryFilter, searchQuery); }
function handleCategoryIconSearch(query) { return CategoryPickerView.handleCategoryIconSearch(query); }
function updateNewCategoryLivePreview() { return CategoryPickerView.updateNewCategoryLivePreview(); }
function renderEditCategorySubcategories(categoryName) { return CategoryPickerView.renderEditCategorySubcategories(categoryName); }
function saveNewCategoryFromPicker() { return CategoryPickerView.saveNewCategoryFromPicker(); }
function openSubcategoryModal() { return CategoryPickerView.openSubcategoryModal(); }

// ============================================================
// ACCOUNT PICKER VIEW SUBSYSTEM
// Extracted to js/accountPickerView.js (Phase 19C Architectural Modularization)
// ============================================================
function getAccountVisualInfo(accOrType) { return AccountPickerView.getAccountVisualInfo(accOrType); }
function getAccountDisplayName(accOrName) { return AccountPickerView.getAccountDisplayName(accOrName); }
function openAccountPickerModal(target) { return AccountPickerView.openAccountPickerModal(target); }
function renderAccountPickerOptions() { return AccountPickerView.renderAccountPickerOptions(); }
function selectAccountOption(name) { return AccountPickerView.selectAccountOption(name); }
function updateAccountTriggerDisplay(target) { return AccountPickerView.updateAccountTriggerDisplay(target); }
function updateAccountDropdowns() { return AccountPickerView.updateAccountDropdowns(); }

window.getAccountDisplayName = getAccountDisplayName;
window.openAccountPickerModal = openAccountPickerModal;
window.updateAccountTriggerDisplay = updateAccountTriggerDisplay;
window.updateAccountDropdowns = updateAccountDropdowns;

// ============================================================
// CURRENCY PICKER VIEW SUBSYSTEM
// Extracted to js/currencyPickerView.js (Phase 17C Architectural Extraction)
// ============================================================
function getRecentCurrencies() { return CurrencyPickerView.getRecentCurrencies(); }
function rememberRecentCurrency(code) { return CurrencyPickerView.rememberRecentCurrency(code); }
function getTransactionCurrency() { return CurrencyPickerView.getTransactionCurrency(); }
function setTransactionCurrency(code) { return CurrencyPickerView.setTransactionCurrency(code); }
function updateCurrencyTriggerDisplay(code) { return CurrencyPickerView.updateCurrencyTriggerDisplay(code); }
function getFlagHtml(flag, code) { return CurrencyPickerView.getFlagHtml(flag, code); }
function openCurrencyPickerModal(options) { return CurrencyPickerView.openCurrencyPickerModal(options); }
function renderCurrencyPickerOptions() { return CurrencyPickerView.renderCurrencyPickerOptions(); }
function appendCurrencyCardItem(grid, c, currentVal, accountCurrency, prefix) { return CurrencyPickerView.appendCurrencyCardItem(grid, c, currentVal, accountCurrency, prefix); }
function getSelectedAccountCurrency() { return CurrencyPickerView.getSelectedAccountCurrency(); }
function selectCurrencyOption(code) { return CurrencyPickerView.selectCurrencyOption(code); }
function initTransactionCurrency() { return CurrencyPickerView.initTransactionCurrency(); }
function syncActualAmountRowVisibility() { return CurrencyPickerView.syncActualAmountRowVisibility(); }
function applyActualAmountCorrection() { return CurrencyPickerView.applyActualAmountCorrection(); }
function initMultiCurrency() { return CurrencyPickerView.initMultiCurrency(); }
function recomputePendingAmountBase() { return CurrencyPickerView.recomputePendingAmountBase(); }

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
// CURRENCY FORMATTING & SETTINGS VIEW SUBSYSTEM
// Extracted to js/currencyFormattingService.js (Phase 18A Architectural Extraction)
// ============================================================
function getCurrencySymbol() { return CurrencyFormattingService.getCurrencySymbol(); }
function updateCurrencySymbols() { return CurrencyFormattingService.updateCurrencySymbols(); }
function updateAmountCurrencySymbol() { return CurrencyFormattingService.updateAmountCurrencySymbol(); }
function getTransactionCurrencySymbol(cur) { return CurrencyFormattingService.getTransactionCurrencySymbol(cur); }
function getTxCurrencyCode(tx) { return CurrencyFormattingService.getTxCurrencyCode(tx); }
function getReliabilityBadge(source) { return CurrencyFormattingService.getReliabilityBadge(source); }
function getTxCurrencyLabel(tx) { return CurrencyFormattingService.getTxCurrencyLabel(tx); }
function updateDualAmountDisplay() { return CurrencyFormattingService.updateDualAmountDisplay(); }
function getDisplayCurrency() { return CurrencyFormattingService.getDisplayCurrency(); }
function getTransactionsBaseCurrency() { return CurrencyFormattingService.getTransactionsBaseCurrency(); }
function displayAmountInDisplayCurrency(amount, cur, date) { return CurrencyFormattingService.displayAmountInDisplayCurrency(amount, cur, date); }
function formatDisplayAmount(amount, cur, date) { return CurrencyFormattingService.formatDisplayAmount(amount, cur, date); }
function getAccountBalanceInBase(acc) { return CurrencyFormattingService.getAccountBalanceInBase(acc); }
function computeNetWorth() { return CurrencyFormattingService.computeNetWorth(); }
function changeMonthStartSetting(val) { return CurrencyFormattingService.changeMonthStartSetting(val); }
function changeWeekStartSetting(val) { return CurrencyFormattingService.changeWeekStartSetting(val); }
function changeCurrencySetting(val) { return CurrencyFormattingService.changeCurrencySetting(val); }
function populateCurrencySelect() { return CurrencyFormattingService.populateCurrencySelect(); }
function updateSettingsDisplay() { return CurrencyFormattingService.updateSettingsDisplay(); }
function openSettingsPicker(type) { return CurrencyFormattingService.openSettingsPicker(type); }
function initSettingsFromStorage() { return CurrencyFormattingService.initSettingsFromStorage(); }
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
// AUTHENTICATION & ACCOUNT CREDENTIALS CONTROLLER
// Extracted to js/authControllerService.js (Phase 17A Architectural Extraction)
// ============================================================
function switchAuthTab(tab) { return AuthControllerService.switchAuthTab(tab); }
function togglePasswordVisibility(inputId, btnEl) { return AuthControllerService.togglePasswordVisibility(inputId, btnEl); }
function openForgotPasswordModal() { return AuthControllerService.openForgotPasswordModal(); }
function closeForgotPasswordModal() { return AuthControllerService.closeForgotPasswordModal(); }
function handleForgotPasswordOverlayClick(e) { return AuthControllerService.handleForgotPasswordOverlayClick(e); }
function submitForgotPasswordModal() { return AuthControllerService.submitForgotPasswordModal(); }
function handleForgotPassword() { return AuthControllerService.handleForgotPassword(); }
function openChangeEmailModal() { return AuthControllerService.openChangeEmailModal(); }
function handleUserEmailChange() { return AuthControllerService.handleUserEmailChange(); }
function openChangePasswordModal() { return AuthControllerService.openChangePasswordModal(); }
function handleUserPasswordChange() { return AuthControllerService.handleUserPasswordChange(); }
function setAuthMode(mode) { return AuthControllerService.setAuthMode(mode); }
function formatAuthErrorMessage(msg, lang) { return AuthControllerService.formatAuthErrorMessage(msg, lang); }
function showAuthStatus(msg, type) { return AuthControllerService.showAuthStatus(msg, type); }
function clearAuthStatus() { return AuthControllerService.clearAuthStatus(); }
function handlePasswordAuth(e) { return AuthControllerService.handlePasswordAuth(e); }
function handleMagicAuth(e) { return AuthControllerService.handleMagicAuth(e); }
function handleGoogleAuth() { return AuthControllerService.handleGoogleAuth(); }
function handleLogout() { return AuthControllerService.handleLogout(); }
function sendFamilyInviteVia(channel, inviteCode) { return AuthControllerService.sendFamilyInviteVia(channel, inviteCode); }
function shareFamilyInviteCode(inviteCode) { return AuthControllerService.shareFamilyInviteCode(inviteCode); }
function copyDirectInviteLink(inviteCode) { return AuthControllerService.copyDirectInviteLink(inviteCode); }
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
// ============================================================
// AUTH OVERLAY & DIAGNOSTICS SUBSYSTEM
// Extracted to js/authOverlayService.js (Phase 18B Architectural Extraction)
// ============================================================
let _authOverlayUserRequested = false;
function showAuthDiagnosticPanel(checks, thrownError) { return AuthOverlayService.showAuthDiagnosticPanel(checks, thrownError); }
function openAuthWithDiagnostics() { return AuthOverlayService.openAuthWithDiagnostics(); }
function showAuthOverlay() {
  _authOverlayUserRequested = true;
  return AuthOverlayService.showAuthOverlay();
}
function hideAuthOverlay() {
  _authOverlayUserRequested = false;
  return AuthOverlayService.hideAuthOverlay();
}
function closeAuth() {
  _authOverlayUserRequested = false;
  return AuthOverlayService.closeAuth();
}

// Re-entrancy guard: prevents the same local transactions from being inserted
// ============================================================
// OFFLINE GUEST DATA MANAGEMENT & IDEMPOTENT CLOUD IMPORT
// ============================================================
// OFFLINE GUEST DATA MANAGEMENT & IDEMPOTENT CLOUD IMPORT
// Extracted to js/offlineImportService.js (Phase 19A Architectural Modularization)
// ============================================================
function getOfflineGuestTransactions() { return OfflineImportService.getOfflineGuestTransactions(); }
function saveOfflineGuestTransactions(trans) { return OfflineImportService.saveOfflineGuestTransactions(trans); }
function updateOfflineImportSettingsRow() { return OfflineImportService.updateOfflineImportSettingsRow(); }
function ensureOfflineImportModal() { return OfflineImportService.ensureOfflineImportModal(); }
function showOfflineImportPrompt(userId, userEmail, isManual) { return OfflineImportService.showOfflineImportPrompt(userId, userEmail, isManual); }
function triggerManualOfflineImport() { return OfflineImportService.triggerManualOfflineImport(); }
function transferOfflineDataToAccount(userId, userEmail) { return OfflineImportService.transferOfflineDataToAccount(userId, userEmail); }
function syncLocalTransactionsToCloud(userId, options) { return OfflineImportService.syncLocalTransactionsToCloud(userId, options); }

window.enterGuestMode = enterGuestMode;
window.showAuthOverlay = showAuthOverlay;
window.syncLocalTransactionsToCloud = syncLocalTransactionsToCloud;
window.triggerManualOfflineImport = triggerManualOfflineImport;
window.showOfflineImportPrompt = showOfflineImportPrompt;

// ============================================================
// REAL-TIME SYNC & OFFLINE QUEUE SYSTEM
// ============================================================
function enqueueSyncMutation(action, payload) { return SyncQueueService.enqueueSyncMutation(action, payload); }
function dequeueSyncMutation(action, itemId) { return SyncQueueService.dequeueSyncMutation(action, itemId); }
function processSyncQueue(options) { return SyncQueueService.processSyncQueue(options); }


// ============================================================
// SUPABASE REALTIME & INCREMENTAL SYNC SUBSYSTEM
// Extracted to js/supabaseRealtimeService.js (Phase 20A Architectural Modularization)
// ============================================================
function setupSupabaseRealtimeSubscription() { return SupabaseRealtimeService.setupSupabaseRealtimeSubscription(); }
function stopSupabaseRealtimeSubscription() { return SupabaseRealtimeService.stopSupabaseRealtimeSubscription(); }
function suppressRealtimeFor(delayMs) { return SupabaseRealtimeService.suppressRealtimeFor(delayMs); }
function handleRealtimeTransactionChange(payload) { return SupabaseRealtimeService.handleRealtimeTransactionChange(payload); }
function handleRealtimeCategoryChange(payload) { return SupabaseRealtimeService.handleRealtimeCategoryChange(payload); }
function updateSyncStatusIndicator() { return SupabaseRealtimeService.updateSyncStatusIndicator(); }
function isIncrementalSyncEnabled() { return SupabaseRealtimeService.isIncrementalSyncEnabled(); }
function setIncrementalSyncEnabled(enabled) { return SupabaseRealtimeService.setIncrementalSyncEnabled(enabled); }
function getSyncCursors() { return SupabaseRealtimeService.getSyncCursors(); }
function saveSyncCursors(cursors) { return SupabaseRealtimeService.saveSyncCursors(cursors); }
function getTableCursor(cursors, table) { return SupabaseRealtimeService.getTableCursor(cursors, table); }
function resetSyncCursors() { return SupabaseRealtimeService.resetSyncCursors(); }
function shouldFullSync() { return SupabaseRealtimeService.shouldFullSync(); }
function markFullSyncDone() { return SupabaseRealtimeService.markFullSyncDone(); }
function buildIncrementalScopeString() { return SupabaseRealtimeService.buildIncrementalScopeString(); }
function buildIncrementalFilter(scopeStr, tsCol, ts, id) { return SupabaseRealtimeService.buildIncrementalFilter(scopeStr, tsCol, ts, id); }
function applyIncrementalTransactions(newRows, tombstones) { return SupabaseRealtimeService.applyIncrementalTransactions(newRows, tombstones); }
function fetchIncrementalTransactions(cursor) { return SupabaseRealtimeService.fetchIncrementalTransactions(cursor); }
function fetchIncrementalTombstones(cursor) { return SupabaseRealtimeService.fetchIncrementalTombstones(cursor); }
function ensureIncrementalSyncCapability() { return SupabaseRealtimeService.ensureIncrementalSyncCapability(); }
function forceSyncNow(silent) { return SupabaseRealtimeService.forceSyncNow(silent); }
function stopPartnerSyncPolling() { return SupabaseRealtimeService.stopPartnerSyncPolling(); }
function startPartnerSyncPolling() { return SupabaseRealtimeService.startPartnerSyncPolling(); }


// ============================================================
// APP LIFECYCLE & RESUME SUBSYSTEM
// Extracted to js/appLifecycleService.js (Phase 19D Architectural Modularization)
// ============================================================
function saveCurrentUIStateToStorage() { return AppLifecycleService.saveCurrentUIStateToStorage(); }
function handleAppForegroundSync() { return AppLifecycleService.handleAppForegroundSync(); }
function _handleAppResumed() { return AppLifecycleService._handleAppResumed(); }

window.startPartnerSyncPolling = startPartnerSyncPolling;
window.stopPartnerSyncPolling = stopPartnerSyncPolling;
window.forceSyncNow = forceSyncNow;
window.updateSyncStatusIndicator = updateSyncStatusIndicator;

// ============================================================
// PROFILE & USER PREFERENCES SUBSYSTEM
// Extracted to js/userProfileService.js (Phase 17B Architectural Extraction)
// ============================================================
function updateHeaderProfileBadge() { return UserProfileService.updateHeaderProfileBadge(); }
function getMyFamilyRole() { return UserProfileService.getMyFamilyRole(); }
function setAccountViewMode(mode) { return UserProfileService.setAccountViewMode(mode); }
function updateProfileSheetModeButtons() { return UserProfileService.updateProfileSheetModeButtons(); }
function openProfileSheet() { return UserProfileService.openProfileSheet(); }
function closeProfileSheet() { return UserProfileService.closeProfileSheet(); }
function handleProfileSheetOverlayClick(e) { return UserProfileService.handleProfileSheetOverlayClick(e); }
function updateProfileSheetAvatarPreview() { return UserProfileService.updateProfileSheetAvatarPreview(); }
function selectPresetAvatar(avatar) { return UserProfileService.selectPresetAvatar(avatar); }
function openProfilePhotoSourcePicker() { return UserProfileService.openProfilePhotoSourcePicker(); }
function triggerProfileCameraCapture() { return UserProfileService.triggerProfileCameraCapture(); }
function triggerProfileGalleryUpload() { return UserProfileService.triggerProfileGalleryUpload(); }
function handleProfilePhotoSourceOverlayClick(e) { return UserProfileService.handleProfilePhotoSourceOverlayClick(e); }
function triggerAvatarUpload() { return UserProfileService.triggerAvatarUpload(); }
function openAvatarViewerModal() { return UserProfileService.openAvatarViewerModal(); }
function triggerAvatarUploadFromViewer() { return UserProfileService.triggerAvatarUploadFromViewer(); }
function deleteCustomAvatar() { return UserProfileService.deleteCustomAvatar(); }
function handleCustomAvatarUpload(e) { return UserProfileService.handleCustomAvatarUpload(e); }
function saveProfileName() { return UserProfileService.saveProfileName(); }
function handleProfileNameKeydown(e) { return UserProfileService.handleProfileNameKeydown(e); }
function openPartnerFromProfile() { return UserProfileService.openPartnerFromProfile(); }
function triggerProfileSync() { return UserProfileService.triggerProfileSync(); }
function triggerProfileExport() { return UserProfileService.triggerProfileExport(); }
function cycleThemeFromProfile() { return UserProfileService.cycleThemeFromProfile(); }
function handleProfileLogout() { return UserProfileService.handleProfileLogout(); }
function initProfileSheetSwipeDismiss() { return UserProfileService.initProfileSheetSwipeDismiss(); }
function updateSupabaseUserModal() { return UserProfileService.updateSupabaseUserModal(); }
function triggerProfileSyncFromModal() { return UserProfileService.triggerProfileSyncFromModal(); }
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
// SAFE-TO-SPEND & SUBSCRIPTIONS HUB VIEW CONTROLLER
// Extracted to js/safeToSpendView.js (Phase 16D Architectural Extraction)
// ============================================================
function getLiquidBalance() { return SafeToSpendView.getLiquidBalance(); }
function getUnpaidRecurringBillsThisMonth() { return SafeToSpendView.getUnpaidRecurringBillsThisMonth(); }
function getMonthlySavingsGoal() { return SafeToSpendView.getMonthlySavingsGoal(); }
function updateSafeToSpendUI() { return SafeToSpendView.updateSafeToSpendUI(); }
function openSafeToSpendModal() { return SafeToSpendView.openSafeToSpendModal(); }
function runWhatIfSimulation() { return SafeToSpendView.runWhatIfSimulation(); }
function openAiAdvisorFromBar() { return SafeToSpendView.openAiAdvisorFromBar(); }
function openSubscriptionsHubModal() { return SafeToSpendView.openSubscriptionsHubModal(); }
function renderSubscriptionsHub() { return SafeToSpendView.renderSubscriptionsHub(); }
function acceptDetectedSubscription(idx) { return SafeToSpendView.acceptDetectedSubscription(idx); }
function quickPaySubscription(templateId) { return SafeToSpendView.quickPaySubscription(templateId); }


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

// ============================================================
// DANGER ZONE & DESTRUCTIVE ACTIONS SUBSYSTEM
// Extracted to js/dangerZoneService.js (Phase 17D Architectural Extraction)
// ============================================================
function clearCacheAndReset() { return DangerZoneService.clearCacheAndReset(); }
function clearLocalDataConfirm() { return DangerZoneService.clearLocalDataConfirm(); }
function deleteAccountConfirm() { return DangerZoneService.deleteAccountConfirm(); }


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
