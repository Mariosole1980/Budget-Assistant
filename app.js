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
    var self = (this && typeof this.toBase === 'function')
      ? this
      : ((typeof window !== 'undefined' && window.CurrencyService) ? window.CurrencyService : this);
    var txCurrency = tx.currency || 'EUR';
    var baseCurrency = tx.base_currency || 'EUR';
    if (targetCurrency === txCurrency) return Number(tx.amount);
    if (targetCurrency === baseCurrency) return (self && typeof self.toBase === 'function') ? self.toBase(tx) : (parseFloat(tx.amount) || 0);
    var baseAmount = (self && typeof self.toBase === 'function') ? self.toBase(tx) : (parseFloat(tx.amount) || 0);
    var converted = (self && typeof self.convert === 'function') ? self.convert(baseAmount, baseCurrency, targetCurrency, tx.date) : null;
    // Fall back to the base amount when the exchange rate is unavailable, so
    // the UI never shows 0 for a real transaction (e.g. offline, or before
    // today's rates have been fetched).
    return converted != null ? converted : baseAmount;
  };
  FallbackCurrencyService.prototype.convert = function (amount, fromCurrency, toCurrency, date) {
    if (fromCurrency === toCurrency) return amount;
    var self = (this && typeof this.getRate === 'function')
      ? this
      : ((typeof window !== 'undefined' && window.CurrencyService) ? window.CurrencyService : this);
    var rate = (self && typeof self.getRate === 'function') ? self.getRate(fromCurrency, toCurrency, date) : null;
    if (rate == null || rate === 0) return null;
    return (self && typeof self.round === 'function') ? self.round(amount * rate, 4) : Math.round((amount * rate) * 10000) / 10000;
  };
  FallbackCurrencyService.prototype.sumInCurrency = function (transactions, targetCurrency) {
    if (!Array.isArray(transactions) || transactions.length === 0) return 0;
    var self = (this && typeof this.displayAmount === 'function')
      ? this
      : ((typeof window !== 'undefined' && window.CurrencyService) ? window.CurrencyService : this);
    return transactions.reduce(function (sum, tx) {
      var amt = (self && typeof self.displayAmount === 'function')
        ? self.displayAmount(tx, targetCurrency)
        : (parseFloat(tx && tx.amount) || 0);
      return sum + (amt || 0);
    }, 0);
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
window._recentlySavedTxIds = _recentlySavedTxIds;
window._markRecentlySaved = _markRecentlySaved;


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
  selectedYear: (function () {
    try {
      if (typeof localStorage !== 'undefined') {
        const y = parseInt(localStorage.getItem('selected_year'), 10);
        if (!isNaN(y) && y >= 2000 && y <= 2100) return y;
      }
    } catch (_) {}
    return new Date().getFullYear();
  })(),
  selectedMonth: (function () {
    try {
      if (typeof localStorage !== 'undefined') {
        const m = parseInt(localStorage.getItem('selected_month'), 10);
        if (!isNaN(m) && m >= 0 && m <= 11) return m;
      }
    } catch (_) {}
    return new Date().getMonth();
  })(),
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
// PREMIUM ENTITLEMENTS & API RESOLUTION SUBSYSTEM
// Extracted to js/premiumEntitlementService.js (Phase 26A Architectural Modularization)
// ============================================================
const PREMIUM_LIMITS = (typeof PremiumEntitlementService !== 'undefined' && PremiumEntitlementService.PREMIUM_LIMITS) || (typeof window !== 'undefined' && window.PREMIUM_LIMITS) || {};
const PREMIUM_PRICE_EUR = (typeof PremiumEntitlementService !== 'undefined' && PremiumEntitlementService.PREMIUM_PRICE_EUR) || 9.99;

function isPremium() { return PremiumEntitlementService.isPremium(); }
function getPremiumStatus() { return PremiumEntitlementService.getPremiumStatus(); }
function requirePremium(featureKey) { return PremiumEntitlementService.requirePremium(featureKey); }
function getBackendApiUrl(endpoint) { return PremiumEntitlementService.getBackendApiUrl(endpoint); }
function getAiUsageCount() { return PremiumEntitlementService.getAiUsageCount(); }
function getAiUsageLimit() { return PremiumEntitlementService.getAiUsageLimit(); }
function canUseOnlineAI() { return PremiumEntitlementService.canUseOnlineAI(); }
function mapTransactionToDb(t) { return PremiumEntitlementService.mapTransactionToDb(t); }

window.isPremium = isPremium;
window.getPremiumStatus = getPremiumStatus;
window.requirePremium = requirePremium;
window.getBackendApiUrl = getBackendApiUrl;
window.canUseOnlineAI = canUseOnlineAI;
window.mapTransactionToDb = mapTransactionToDb;

function mergeAndDeduplicateTemplates(cloudTemplates = [], localTemplates = []) {
  return TemplateAssociationService.mergeAndDeduplicateTemplates(cloudTemplates, localTemplates);
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
window._deletingTxIds = _deletingTxIds;
window._recentlyDeletedTxIds = _recentlyDeletedTxIds;
window._markRecentlyDeleted = _markRecentlyDeleted;


function deduplicateCategories() { return CategoryManager.deduplicateCategories(); }
window.deduplicateCategories = deduplicateCategories;

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
window.mergeAndDeduplicateTransactions = mergeAndDeduplicateTransactions;

function getPendingLocalTransactions(transactions) {
  if (typeof window.TransactionMerge !== 'undefined' && typeof window.TransactionMerge.getPendingLocalTransactions === 'function') {
    return window.TransactionMerge.getPendingLocalTransactions(transactions);
  }
  return [];
}
window.getPendingLocalTransactions = getPendingLocalTransactions;

function readSyncQueueForMerge() { return window.TransactionMerge.readSyncQueueForMerge(); }
window.readSyncQueueForMerge = readSyncQueueForMerge;


// (GREEK_MONTHS moved to js/constants.js)
const GREEK_MONTHS_SHORT = (typeof I18nService !== 'undefined' && I18nService.GREEK_MONTHS_SHORT) || window.GREEK_MONTHS_SHORT;
const GREEK_WEEKDAYS_SHORT = (typeof I18nService !== 'undefined' && I18nService.GREEK_WEEKDAYS_SHORT) || window.GREEK_WEEKDAYS_SHORT;
const ENGLISH_MONTHS_SHORT = (typeof I18nService !== 'undefined' && I18nService.ENGLISH_MONTHS_SHORT) || window.ENGLISH_MONTHS_SHORT;
const ENGLISH_WEEKDAYS_SHORT = (typeof I18nService !== 'undefined' && I18nService.ENGLISH_WEEKDAYS_SHORT) || window.ENGLISH_WEEKDAYS_SHORT;

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
window._pendingRecurringSettings = _pendingRecurringSettings;

// (DEFAULT_SUBCATEGORIES_MAP moved to js/constants.js)

// ============================================================
// INTERNATIONALIZATION (i18n), LANGUAGE & BUILD LABEL SUBSYSTEM
// Extracted to js/i18nService.js (Phase 24A Architectural Modularization)
// ============================================================
function getMonthName(index, short = false) { return I18nService.getMonthName(index, short); }
function getWeekdayName(index) { return I18nService.getWeekdayName(index); }
function parseBuildNumber(v) { return I18nService.parseBuildNumber(v); }
function getActiveBuildLabel() {
  if (typeof I18nService !== 'undefined' && typeof I18nService.getActiveBuildLabel === 'function') {
    return I18nService.getActiveBuildLabel();
  }
  var build = (typeof CURRENT_BUILD !== 'undefined') ? CURRENT_BUILD : null;
  return ('Έκδοση 1.0.0 (build v' + (build != null ? build : '?') + ')');
}
function applyLanguage(lang) { return I18nService.applyLanguage(lang); }
function updateOTADiagnostic() { return I18nService.updateOTADiagnostic(); }
function toggleLanguageSetting() { return I18nService.toggleLanguageSetting(); }
function detectGeoLanguage() { return I18nService.detectGeoLanguage(); }
function formatGreekDateTime(dateStr) { return I18nService.formatGreekDateTime(dateStr); }

window.getMonthName = getMonthName;
window.getWeekdayName = getWeekdayName;
window.parseBuildNumber = parseBuildNumber;
window.getActiveBuildLabel = getActiveBuildLabel;
window.applyLanguage = applyLanguage;
window.updateOTADiagnostic = updateOTADiagnostic;
window.toggleLanguageSetting = toggleLanguageSetting;
window.detectGeoLanguage = detectGeoLanguage;
window.formatGreekDateTime = formatGreekDateTime;
// evaluateCalcBuffer → extracted to js/calcKeypad.js (Phase 2, Extraction 1)
// hasPendingMathOperator → extracted to js/calcKeypad.js (Phase 2, Extraction 1)

// ============================================================
// CALCULATOR KEYPAD CONTROLLER SUBSYSTEM
// Extracted to js/calculatorKeypadService.js (Phase 26C Architectural Modularization)
// ============================================================
function updateKeypadDoneButton() { return CalculatorKeypadService.updateKeypadDoneButton(); }
window.updateKeypadDoneButton = updateKeypadDoneButton;


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
// ============================================================
// APP BOOT & LIFECYCLE INITIALIZATION SUBSYSTEM
// Extracted to js/appInitService.js (Phase 31B Architectural Modularization)
// ============================================================
async function initApp() { return AppInitService.initApp(); }
function _bootApp() { return AppInitService._bootApp(); }
window.initApp = initApp;
window._bootApp = _bootApp;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _bootApp);
} else {
  setTimeout(_bootApp, 0);
}


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

function goToMonth(year, month) {
  if (typeof TransactionListService !== 'undefined' && typeof TransactionListService.goToMonth === 'function') {
    return TransactionListService.goToMonth(year, month);
  }
  state.selectedYear = year;
  state.selectedMonth = month;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('selected_year', year);
      localStorage.setItem('selected_month', month);
    } catch (_) {}
  }
  if (typeof updateUI === 'function') updateUI();
}
window.goToMonth = goToMonth;

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
// ============================================================
// DATA LOADER & OFFLINE CACHE SUBSYSTEM
// Extracted to js/dataLoaderService.js (Phase 28A Architectural Modularization)
// ============================================================
async function loadData() { return DataLoaderService.loadData(); }
function loadOfflineData() { return DataLoaderService.loadOfflineData(); }

window.loadData = loadData;
window.loadOfflineData = loadOfflineData;


function autoRecoverTemplatesFromHistory() { return AppInitService.autoRecoverTemplatesFromHistory(); }
window.autoRecoverTemplatesFromHistory = autoRecoverTemplatesFromHistory;
// getDeletedDatesFromTemplate → extracted to js/recurringDates.js (Phase 2, Extraction 5)
// addDeletedDateToTemplate → extracted to js/recurringDates.js (Phase 2, Extraction 5)

// Cross-language and canonical category comparison helper:
// Matches category names across Greek and English translations, emoji prefixes,
// casing, and accents (e.g. "Home" === "Σπίτι", "🏡 Home" === "🏡 ΣΠΙΤΙ").
function isSameCategory(catA, catB) { return TemplateAssociationService.isSameCategory(catA, catB); }
window.isSameCategory = isSameCategory;

function generateDeterministicUUID(templateId, dateString) { return TemplateAssociationService.generateDeterministicUUID(templateId, dateString); }
window.generateDeterministicUUID = generateDeterministicUUID;

function cleanDuplicateTemplates() { return TemplateAssociationService.cleanDuplicateTemplates(); }
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

// ============================================================
// TRANSACTION MUTATION & PERSISTENCE SUBSYSTEM
// Extracted to js/transactionMutationService.js (Phase 28B Architectural Modularization)
// ============================================================
async function saveTransaction(transaction) { return TransactionMutationService.saveTransaction(transaction); }
function saveTransactionOffline(transaction) { return TransactionMutationService.saveTransactionOffline(transaction); }
function deleteTransaction(id) { return TransactionMutationService.deleteTransaction(id); }
function deleteTransactionOffline(id, skipSave = false) { return TransactionMutationService.deleteTransactionOffline(id, skipSave); }

window.saveTransaction = saveTransaction;
window.saveTransactionOffline = saveTransactionOffline;
window.deleteTransaction = deleteTransaction;
window.deleteTransactionOffline = deleteTransactionOffline;

// ============================================================
// UI UPDATE ENGINE
// ============================================================

// ============================================================
// CENTRAL RENDER SCHEDULER & ANTI-FLICKER TRANSITIONS
// Extracted to js/renderOrchestrationService.js (Phase 30A Architectural Modularization)
// ============================================================
function pushNoTransition() { return RenderOrchestrationService.pushNoTransition(); }
function popNoTransition() { return RenderOrchestrationService.popNoTransition(); }
function _isWithinResumeWindow(ms) { return RenderOrchestrationService._isWithinResumeWindow(ms); }
function _runScheduledRender() { return RenderOrchestrationService._runScheduledRender(); }
function updateUI() { return RenderOrchestrationService.updateUI(); }
function flushUI() { return RenderOrchestrationService.flushUI(); }
function getActiveScrollContainer() { return RenderOrchestrationService.getActiveScrollContainer(); }
function _isAuthenticated() { return RenderOrchestrationService._isAuthenticated(); }
function _updateUIImpl() { return RenderOrchestrationService._updateUIImpl(); }
function updateHeaderAndSync() { return RenderOrchestrationService.updateHeaderAndSync(); }

// Bind to window for global runtime access
window.pushNoTransition = pushNoTransition;
window.popNoTransition = popNoTransition;
window._isWithinResumeWindow = _isWithinResumeWindow;
window._runScheduledRender = _runScheduledRender;
window.updateUI = updateUI;
window.flushUI = flushUI;
window.getActiveScrollContainer = getActiveScrollContainer;
window._isAuthenticated = _isAuthenticated;
window._updateUIImpl = _updateUIImpl;
window.updateHeaderAndSync = updateHeaderAndSync;

// ============================================================
// TAB 1: TRANSACTIONS
// ============================================================
// Resolve the recurring template a transaction belongs to, using recurring_template_id
// when present, otherwise falling back to a content-key match (amount + type + category).
// Returns the matching template object or null. Used by the transaction delete handler
// so the 3-option recurring delete modal reliably appears even when the template link
// is missing on an older cloud-loaded transaction.
function resolveRecurringTemplateForTx(tx) { return TemplateAssociationService.resolveRecurringTemplateForTx(tx); }
window.resolveRecurringTemplateForTx = resolveRecurringTemplateForTx;

function isTransactionRecurring(tx) { return TemplateAssociationService.isTransactionRecurring(tx); }
window.isTransactionRecurring = isTransactionRecurring;

function backfillRecurringTemplateIds() { return TemplateAssociationService.backfillRecurringTemplateIds(); }
window.backfillRecurringTemplateIds = backfillRecurringTemplateIds;

// ============================================================
// TRANSACTIONS TAB LIST RENDERER
// Extracted to js/transactionListService.js (Phase 25B Architectural Modularization)
// ============================================================
function renderTransactionsTab(containerOverride, yearOverride, monthOverride) {
  return TransactionListService.renderTransactionsTab(containerOverride, yearOverride, monthOverride);
}
window.renderTransactionsTab = renderTransactionsTab;

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


// ============================================================
// EVENT BINDING SUBSYSTEM
// Extracted to js/eventBindingService.js (Phase 31A Architectural Modularization)
// ============================================================
function setupEventListeners() { return EventBindingService.setupEventListeners(); }
window.setupEventListeners = setupEventListeners;

// ============================================================
// MODAL & OVERLAY SUBSYSTEM
// Extracted to js/modalBackdropService.js (Phase 25A Architectural Modularization)
// ============================================================
function ensureOverlayInBody(el) { return ModalBackdropService.ensureOverlayInBody(el); }
const FULLSCREEN_OVERLAY_IDS = typeof ModalBackdropService !== 'undefined' ? ModalBackdropService.FULLSCREEN_OVERLAY_IDS : [];
function initOverlayPlacement() { return ModalBackdropService.initOverlayPlacement(); }
function openModal(id, opts) {
  if (typeof triggerHaptic === 'function') triggerHaptic('light');
  return ModalBackdropService.openModal(id, opts);
}

window.ensureOverlayInBody = ensureOverlayInBody;
window.initOverlayPlacement = initOverlayPlacement;
window.openModal = openModal;

// Removed initMainScreenSwipeGestures call and adjustMainPeriod

// ============================================================
// STATS PERIOD NAVIGATION SUBSYSTEM
// Extracted to js/statsPeriodService.js (Phase 26B Architectural Modularization)
// ============================================================
function adjustStatsPeriod(direction, startingDeltaX = 0) {
  return StatsPeriodService.adjustStatsPeriod(direction, startingDeltaX);
}
function handleCustomPeriodSave() {
  return StatsPeriodService.handleCustomPeriodSave();
}

window.adjustStatsPeriod = adjustStatsPeriod;
window.handleCustomPeriodSave = handleCustomPeriodSave;
function scrollToToday(behavior = 'smooth') {
  if (typeof TransactionListService !== 'undefined') return TransactionListService.scrollToToday(behavior);
}
window.scrollToToday = scrollToToday;

// ============================================================
// TAB NAVIGATION & SCREEN TRANSITION SUBSYSTEM
// Extracted to js/tabNavigationService.js (Phase 24B Architectural Modularization)
// ============================================================
function resetAllTabScreenStyles() { return TabNavigationService.resetAllTabScreenStyles(); }
function switchTab(tab, instant = false) {
  if (typeof triggerHaptic === 'function') triggerHaptic('light');
  return TabNavigationService.switchTab(tab, instant);
}
function toggleStatsType(type) { return TabNavigationService.toggleStatsType(type); }

window.resetAllTabScreenStyles = resetAllTabScreenStyles;
window.switchTab = switchTab;
window.toggleStatsType = toggleStatsType;

function forceViewportReset(syncOnly = false) { return ModalBackdropService.forceViewportReset(syncOnly); }
function closeModal(id, opts) { return ModalBackdropService.closeModal(id, opts); }

window.forceViewportReset = forceViewportReset;
window.closeModal = closeModal;

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

// ============================================================
// HEADER SYNC & TOAST FEEDBACK SUBSYSTEM
// Extracted to js/statsPeriodService.js (Phase 26B Architectural Modularization)
// ============================================================
function showSyncToast(message, autoDismissMs = 0) {
  return StatsPeriodService.showSyncToast(message, autoDismissMs);
}
function updateHeaderSyncIcon(state_) {
  return StatsPeriodService.updateHeaderSyncIcon(state_);
}

window.showSyncToast = showSyncToast;
window.updateHeaderSyncIcon = updateHeaderSyncIcon;

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


// ============================================================
// SUBCATEGORY SUGGESTIONS & SELECTION UI SUBSYSTEM
// Extracted to js/subcategorySuggestionService.js (Phase 27C Architectural Modularization)
// ============================================================
function updateSubcategorySuggestions() { return SubcategorySuggestionService.updateSubcategorySuggestions(); }
function showSubcategorySelect() { return SubcategorySuggestionService.showSubcategorySelect(); }
function hideSubcategorySelect() { return SubcategorySuggestionService.hideSubcategorySelect(); }

window.updateSubcategorySuggestions = updateSubcategorySuggestions;
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


// ============================================================
// SWIPE & MONTH NAVIGATION SUBSYSTEM
// Extracted to js/swipeNavigationService.js (Phase 27A Architectural Modularization)
// ============================================================
function initTabSwipeNavigation() { return SwipeNavigationService.initTabSwipeNavigation(); }
function renderTransactionsForSwipe() { return SwipeNavigationService.renderTransactionsForSwipe(); }
function animateSwipeTransition(direction, callback, startingDeltaX) { return SwipeNavigationService.animateSwipeTransition(direction, callback, startingDeltaX); }
function navigateMonth(direction, startingDeltaX) { return SwipeNavigationService.navigateMonth(direction, startingDeltaX); }
function initRippleEffects() { return SwipeNavigationService.initRippleEffects(); }

window.initTabSwipeNavigation = initTabSwipeNavigation;
window.renderTransactionsForSwipe = renderTransactionsForSwipe;
window.animateSwipeTransition = animateSwipeTransition;
window.navigateMonth = navigateMonth;
window.initRippleEffects = initRippleEffects;

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

// ============================================================
// APP UPDATE SUBSYSTEM
// Extracted to js/appUpdateService.js (Phase 27B Architectural Modularization)
// ============================================================
async function forceAppUpdate() { return AppUpdateService.forceAppUpdate(); }

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

async function enterGuestMode() { return AppUpdateService.enterGuestMode(); }

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

// ============================================================
// BACKDROP TAP & VISUAL VIEWPORT SUBSYSTEM
// Extracted to js/modalBackdropService.js (Phase 25A Architectural Modularization)
// ============================================================
function initBackdropTapHandlers() { return ModalBackdropService.initBackdropTapHandlers(); }
window.initBackdropTapHandlers = initBackdropTapHandlers;

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
// ============================================================
// RECURRING MODAL & SETTINGS CONTROLLER
// Extracted to js/recurringModalService.js (Phase 29A Architectural Modularization)
// ============================================================
function openRecurringModal(e) { return RecurringModalService.openRecurringModal(e); }
function toggleRecurringFrequencyList() { return RecurringModalService.toggleRecurringFrequencyList(); }
function selectRecurringFrequencyOption(val) { return RecurringModalService.selectRecurringFrequencyOption(val); }
function onSimplePresetChange() { return RecurringModalService.onSimplePresetChange(); }
function toggleRecurringSpecificMonth(month, element) { return RecurringModalService.toggleRecurringSpecificMonth(month, element); }
function selectRecurringEndType(type) { return RecurringModalService.selectRecurringEndType(type); }
function updateRecurringSummary() { return RecurringModalService.updateRecurringSummary(); }
function clearRecurringSettings(shouldCloseModal) { return RecurringModalService.clearRecurringSettings(shouldCloseModal); }
function saveRecurringSettings() { return RecurringModalService.saveRecurringSettings(); }
function resetRepInstButton() { return RecurringModalService.resetRepInstButton(); }

// Bind to window for HTML access
window.openRecurringModal = openRecurringModal;
window.toggleRecurringFrequencyList = toggleRecurringFrequencyList;
window.selectRecurringFrequencyOption = selectRecurringFrequencyOption;
window.onSimplePresetChange = onSimplePresetChange;
window.toggleRecurringSpecificMonth = toggleRecurringSpecificMonth;
window.selectRecurringEndType = selectRecurringEndType;
window.updateRecurringSummary = updateRecurringSummary;
window.clearRecurringSettings = clearRecurringSettings;
window.saveRecurringSettings = saveRecurringSettings;
window.resetRepInstButton = resetRepInstButton;

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

// ============================================================
// RECURRING TEMPLATES & DETAILS MODAL CONTROLLER
// Extracted to js/recurringTemplateModalService.js (Phase 29B Architectural Modularization)
// ============================================================
function openRecurringTemplatesModal() { return RecurringTemplateModalService.openRecurringTemplatesModal(); }
function openRecurringDetailsModal(templateId) { return RecurringTemplateModalService.openRecurringDetailsModal(templateId); }
function openEditTransactionModalFromDetails(txId) { return RecurringTemplateModalService.openEditTransactionModalFromDetails(txId); }
function handleDeleteFromRecurringDetails(txId, templateId, dateStr) { return RecurringTemplateModalService.handleDeleteFromRecurringDetails(txId, templateId, dateStr); }
function closeRecurringDetailsModal() { return RecurringTemplateModalService.closeRecurringDetailsModal(); }
function saveRecurringTemplateName() { return RecurringTemplateModalService.saveRecurringTemplateName(); }
function openRecurringEditModal(templateId) { return RecurringTemplateModalService.openRecurringEditModal(templateId); }
function closeRecurringEditModal() { return RecurringTemplateModalService.closeRecurringEditModal(); }
function renderRecurringEditMonthsGrid() { return RecurringTemplateModalService.renderRecurringEditMonthsGrid(); }
function onRecurringEditPresetChange() { return RecurringTemplateModalService.onRecurringEditPresetChange(); }
function selectRecurringEditEndType(type) { return RecurringTemplateModalService.selectRecurringEditEndType(type); }
function updateRecurringEditSummary() { return RecurringTemplateModalService.updateRecurringEditSummary(); }
function saveRecurringTemplateEdit() { return RecurringTemplateModalService.saveRecurringTemplateEdit(); }
function regenerateRecurringTemplateTransactions(template) { return RecurringTemplateModalService.regenerateRecurringTemplateTransactions(template); }
function deleteRecurringTemplate(id) { return RecurringTemplateModalService.deleteRecurringTemplate(id); }

// ============================================================
// TRASH BIN & RECOVERY SUBSYSTEM (openTrashBinModal, fetchTrashFromCloud, renderTrashBinList, restoreTransaction, emptyTrashBin)
// Extracted to js/trashBinService.js (Phase 11A Architectural Extraction)
// ============================================================

// Bind to window for HTML access
var _getAiCoach = function () {
  if (typeof AICoachService !== 'undefined' && AICoachService) return AICoachService;
  if (typeof window !== 'undefined' && window.AICoachService) return window.AICoachService;
  return null;
};
function openAdvisorChat(initialQuery) {
  var cs = _getAiCoach();
  if (cs && typeof cs.openAdvisorChat === 'function') return cs.openAdvisorChat(initialQuery);
  if (typeof window !== 'undefined' && typeof window.openModal === 'function') {
    window.openModal('advisor-chat-modal');
  }
}
function closeAdvisorChat() {
  var cs = _getAiCoach();
  if (cs && typeof cs.closeAdvisorChat === 'function') return cs.closeAdvisorChat();
  if (typeof window !== 'undefined' && typeof window.closeModal === 'function') {
    window.closeModal('advisor-chat-modal');
  }
}
function submitCoachInput() { var cs = _getAiCoach(); if (cs && typeof cs.submitCoachInput === 'function') return cs.submitCoachInput(); }
function submitCoachQuery(q) { var cs = _getAiCoach(); if (cs && typeof cs.submitCoachQuery === 'function') return cs.submitCoachQuery(q); }
function handleAdvisorChatKeydown(e) { var cs = _getAiCoach(); if (cs && typeof cs.handleAdvisorChatKeydown === 'function') return cs.handleAdvisorChatKeydown(e); }
function startNewAdvisorConversation() { var cs = _getAiCoach(); if (cs && typeof cs.startNewAdvisorConversation === 'function') return cs.startNewAdvisorConversation(); }
function showAdvisorConversationList() { var cs = _getAiCoach(); if (cs && typeof cs.showAdvisorConversationList === 'function') return cs.showAdvisorConversationList(); }
function deleteAdvisorConversation(id) { var cs = _getAiCoach(); if (cs && typeof cs.deleteAdvisorConversation === 'function') return cs.deleteAdvisorConversation(id); }
function openAdvisorConversation(id) { var cs = _getAiCoach(); if (cs && typeof cs.openAdvisorConversation === 'function') return cs.openAdvisorConversation(id); }
function toggleAdvisorHistory() { var cs = _getAiCoach(); if (cs && typeof cs.toggleAdvisorHistory === 'function') return cs.toggleAdvisorHistory(); }

window.openAdvisorChat = openAdvisorChat;
window.closeAdvisorChat = closeAdvisorChat;
window.submitCoachInput = submitCoachInput;
window.submitCoachQuery = submitCoachQuery;
window.handleAdvisorChatKeydown = handleAdvisorChatKeydown;
window.startNewAdvisorConversation = startNewAdvisorConversation;
window.showAdvisorConversationList = showAdvisorConversationList;
window.deleteAdvisorConversation = deleteAdvisorConversation;
window.openAdvisorConversation = openAdvisorConversation;
window.toggleAdvisorHistory = toggleAdvisorHistory;

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
window.openEditTransactionModalFromDetails = openEditTransactionModalFromDetails;
window.handleDeleteFromRecurringDetails = handleDeleteFromRecurringDetails;
window.closeRecurringDetailsModal = closeRecurringDetailsModal;
window.saveRecurringTemplateName = saveRecurringTemplateName;
window.openRecurringEditModal = openRecurringEditModal;
window.closeRecurringEditModal = closeRecurringEditModal;
window.saveRecurringTemplateEdit = saveRecurringTemplateEdit;
window.onRecurringEditPresetChange = onRecurringEditPresetChange;
window.selectRecurringEditEndType = selectRecurringEditEndType;
window.regenerateRecurringTemplateTransactions = regenerateRecurringTemplateTransactions;

// ============================================================
// CASH FLOW CALENDAR & HAPTIC SETTINGS WRAPPERS
// ============================================================
var _getCashFlow = function () {
  if (typeof CashFlowCalendarService !== 'undefined' && CashFlowCalendarService) return CashFlowCalendarService;
  if (typeof window !== 'undefined' && window.CashFlowCalendarService) return window.CashFlowCalendarService;
  return null;
};
function openCashFlowCalendarModal(y, m) {
  var cs = _getCashFlow();
  if (cs && typeof cs.openCashFlowCalendarModal === 'function') return cs.openCashFlowCalendarModal(y, m);
  if (typeof window !== 'undefined' && typeof window.openModal === 'function') window.openModal('cash-flow-calendar-modal');
}
function closeCashFlowCalendarModal() {
  var cs = _getCashFlow();
  if (cs && typeof cs.closeCashFlowCalendarModal === 'function') return cs.closeCashFlowCalendarModal();
  if (typeof window !== 'undefined' && typeof window.closeModal === 'function') window.closeModal('cash-flow-calendar-modal');
}
function navCashFlowMonth(dir) { var cs = _getCashFlow(); if (cs && typeof cs.navCashFlowMonth === 'function') return cs.navCashFlowMonth(dir); }
function selectCashFlowDay(d) { var cs = _getCashFlow(); if (cs && typeof cs.selectCashFlowDay === 'function') return cs.selectCashFlowDay(d); }
function quickPayCalendarBill(id, dt) { var cs = _getCashFlow(); if (cs && typeof cs.quickPayCalendarBill === 'function') return cs.quickPayCalendarBill(id, dt); }

function toggleHapticSetting(forceVal) {
  var hs = (typeof HapticFeedbackService !== 'undefined') ? HapticFeedbackService : (typeof window !== 'undefined' ? window.HapticFeedbackService : null);
  if (hs) {
    var el = document.getElementById('setting-haptic-toggle');
    var newState;
    if (typeof forceVal === 'boolean') {
      newState = forceVal;
    } else if (el) {
      newState = el.checked;
    } else {
      newState = !hs.isEnabled();
    }
    hs.setEnabled(newState);
    if (el) el.checked = newState;
    if (newState && typeof triggerHaptic === 'function') triggerHaptic('success');
  }
}

window.openCashFlowCalendarModal = openCashFlowCalendarModal;
window.closeCashFlowCalendarModal = closeCashFlowCalendarModal;
window.navCashFlowMonth = navCashFlowMonth;
window.selectCashFlowDay = selectCashFlowDay;
window.quickPayCalendarBill = quickPayCalendarBill;
window.toggleHapticSetting = toggleHapticSetting;

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
