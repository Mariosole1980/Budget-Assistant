/**
 * Internationalization (i18n), Language & Build Label Subsystem
 * Extracted from app.js (Phase 24A Architectural Modularization)
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.I18nService = factory();
    // Expose on root/window for seamless backward compatibility
    root.GREEK_MONTHS_SHORT = root.I18nService.GREEK_MONTHS_SHORT;
    root.GREEK_WEEKDAYS_SHORT = root.I18nService.GREEK_WEEKDAYS_SHORT;
    root.ENGLISH_MONTHS_SHORT = root.I18nService.ENGLISH_MONTHS_SHORT;
    root.ENGLISH_WEEKDAYS_SHORT = root.I18nService.ENGLISH_WEEKDAYS_SHORT;
    root.getMonthName = root.I18nService.getMonthName;
    root.getWeekdayName = root.I18nService.getWeekdayName;
    root.parseBuildNumber = root.I18nService.parseBuildNumber;
    root.getActiveBuildLabel = root.I18nService.getActiveBuildLabel;
    root.applyLanguage = root.I18nService.applyLanguage;
    root.updateOTADiagnostic = root.I18nService.updateOTADiagnostic;
    root.toggleLanguageSetting = root.I18nService.toggleLanguageSetting;
    root.detectGeoLanguage = root.I18nService.detectGeoLanguage;
    root.formatGreekDateTime = root.I18nService.formatGreekDateTime;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GREEK_MONTHS_SHORT = [
    'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'
  ];
  const GREEK_WEEKDAYS_SHORT = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'];

  const ENGLISH_MONTHS_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const ENGLISH_WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function getState() {
    if (typeof state !== 'undefined') return state;
    if (typeof window !== 'undefined' && window.state) return window.state;
    if (typeof global !== 'undefined' && global.state) return global.state;
    return { lang: 'el' };
  }

  function getTranslations() {
    if (typeof TRANSLATIONS !== 'undefined') return TRANSLATIONS;
    if (typeof window !== 'undefined' && window.TRANSLATIONS) return window.TRANSLATIONS;
    if (typeof global !== 'undefined' && global.TRANSLATIONS) return global.TRANSLATIONS;
    return {};
  }

  function getGreekMonthsLong() {
    if (typeof GREEK_MONTHS !== 'undefined') return GREEK_MONTHS;
    if (typeof window !== 'undefined' && window.GREEK_MONTHS) return window.GREEK_MONTHS;
    if (typeof global !== 'undefined' && global.GREEK_MONTHS) return global.GREEK_MONTHS;
    return ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];
  }

  function getEnglishMonthsLong() {
    if (typeof ENGLISH_MONTHS !== 'undefined') return ENGLISH_MONTHS;
    if (typeof window !== 'undefined' && window.ENGLISH_MONTHS) return window.ENGLISH_MONTHS;
    if (typeof global !== 'undefined' && global.ENGLISH_MONTHS) return global.ENGLISH_MONTHS;
    return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  }

  function getMonthName(index, short = false) {
    const appState = getState();
    if (appState.lang === 'en') {
      const enLong = getEnglishMonthsLong();
      return short ? ENGLISH_MONTHS_SHORT[index] : enLong[index];
    }
    const elLong = getGreekMonthsLong();
    return short ? GREEK_MONTHS_SHORT[index] : elLong[index];
  }

  function getWeekdayName(index) {
    const appState = getState();
    return appState.lang === 'en' ? ENGLISH_WEEKDAYS_SHORT[index] : GREEK_WEEKDAYS_SHORT[index];
  }

  function parseBuildNumber(v) {
    if (v == null) return -1;
    var n = parseInt(String(v).split('.').pop(), 10);
    return isNaN(n) ? -1 : n;
  }

  function getActiveBuildLabel() {
    var active = (typeof window !== 'undefined' && typeof window.OTA_ACTIVE_VERSION !== 'undefined' && window.OTA_ACTIVE_VERSION != null)
      ? window.OTA_ACTIVE_VERSION : null;
    var bundled = (typeof CURRENT_BUILD !== 'undefined')
      ? CURRENT_BUILD
      : ((typeof window !== 'undefined' && window.CURRENT_BUILD) || null);
    var activeBuild = parseBuildNumber(active);
    var build = (activeBuild > 0) ? activeBuild : bundled;
    var appState = getState();
    var trans = getTranslations();
    var label = (trans && trans[appState.lang]) ? trans[appState.lang]['app_version'] : null;
    if (label && build != null) {
      label = label.replace(/v\d+/, 'v' + build);
    }
    return label || ('Έκδοση 1.0.0 (build v' + (build != null ? build : '?') + ')');
  }

  function applyLanguage(lang) {
    const appState = getState();
    appState.lang = lang;
    try {
      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
        localStorage.setItem('app_lang', lang);
      }
    } catch (_) { }

    if (typeof document === 'undefined') return;

    const trans = getTranslations();

    // Update DOM elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = key === 'app_version' ? getActiveBuildLabel() : (trans[lang] ? trans[lang][key] : null);
      if (translation) {
        if (el.children.length === 0) {
          el.textContent = translation;
        } else {
          let updated = false;
          for (let i = 0; i < el.childNodes.length; i++) {
            const node = el.childNodes[i];
            if (node.nodeType === (typeof Node !== 'undefined' ? Node.TEXT_NODE : 3) && node.nodeValue.trim() !== '') {
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
      const translation = trans[lang] ? trans[lang][key] : null;
      if (translation) el.innerHTML = translation;
    });

    // Update elements with data-i18n-title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const translation = trans[lang] ? trans[lang][key] : null;
      if (translation) el.title = translation;
    });

    // Update elements with data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const translation = trans[lang] ? trans[lang][key] : null;
      if (translation) el.placeholder = translation;
    });

    // Update settings subscreen title and subtitle if active
    const titleEl = document.getElementById('settings-subscreen-title');
    if (titleEl && typeof window !== 'undefined' && window._currentSettingsSubscreenTitleKey) {
      const titleKey = window._currentSettingsSubscreenTitleKey;
      titleEl.textContent = (trans[lang] && trans[lang][titleKey]) || titleKey;
    }
    const subtitleEl = document.getElementById('settings-subscreen-subtitle');
    if (subtitleEl && typeof window !== 'undefined' && window._currentSettingsSubscreenId) {
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
      if (subKey && trans[lang] && trans[lang][subKey]) {
        subtitleEl.textContent = trans[lang][subKey];
      }
    }

    // Update Settings Summary Displays
    if (typeof updateSettingsDisplay === 'function') {
      updateSettingsDisplay();
    } else if (typeof window !== 'undefined' && typeof window.updateSettingsDisplay === 'function') {
      window.updateSettingsDisplay();
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

    // Update Header Profile Badge
    if (typeof updateHeaderProfileBadge === 'function') {
      updateHeaderProfileBadge();
    } else if (typeof window !== 'undefined' && typeof window.updateHeaderProfileBadge === 'function') {
      window.updateHeaderProfileBadge();
    }

    // Re-render UI dynamic elements and screens
    if (typeof updateUI === 'function') {
      updateUI();
    } else if (typeof window !== 'undefined' && typeof window.updateUI === 'function') {
      window.updateUI();
    }

    if (typeof translateNotepadUI === 'function') {
      translateNotepadUI();
    } else if (typeof window !== 'undefined' && typeof window.translateNotepadUI === 'function') {
      window.translateNotepadUI();
    }

    // Update OTA diagnostic
    if (typeof updateOTADiagnostic === 'function') {
      updateOTADiagnostic();
    } else if (typeof window !== 'undefined' && typeof window.updateOTADiagnostic === 'function') {
      window.updateOTADiagnostic();
    }
  }

  function updateOTADiagnostic() {
    if (typeof document === 'undefined') return;
    var diag = document.getElementById('ota-diagnostic');
    if (!diag) return;
    var activeEl = document.getElementById('ota-diag-active');
    var bundledEl = document.getElementById('ota-diag-bundled');
    var sourceEl = document.getElementById('ota-diag-source');
    var active = (typeof window !== 'undefined' && typeof window.OTA_ACTIVE_VERSION !== 'undefined' && window.OTA_ACTIVE_VERSION != null)
      ? window.OTA_ACTIVE_VERSION : 'none';
    var bundled = (typeof CURRENT_BUILD !== 'undefined')
      ? CURRENT_BUILD
      : ((typeof window !== 'undefined' && window.CURRENT_BUILD) || '?');
    var source = (active !== 'none' && parseBuildNumber(active) > parseBuildNumber(bundled))
      ? 'OTA (IndexedDB)'
      : 'Bundled (APK)';
    if (activeEl) activeEl.textContent = 'v' + active;
    if (bundledEl) bundledEl.textContent = 'v' + bundled;
    if (sourceEl) sourceEl.textContent = source;
    diag.style.display = 'block';
  }

  function toggleLanguageSetting() {
    const appState = getState();
    const nextLang = appState.lang === 'el' ? 'en' : 'el';
    try {
      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
        localStorage.setItem('app_lang_user_set', 'true');
      }
    } catch (_) { }
    applyLanguage(nextLang);
    const msg = nextLang === 'en' ? '🇬🇧 Switched to English' : '🇬🇷 Αλλαγή σε Ελληνικά';
    if (typeof showSyncToast === 'function') {
      showSyncToast(msg, 2500);
    } else if (typeof window !== 'undefined' && typeof window.showSyncToast === 'function') {
      window.showSyncToast(msg, 2500);
    }
  }

  async function detectGeoLanguage() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage && localStorage.getItem('app_lang_user_set') === 'true') {
        return;
      }
    } catch (_) { }

    try {
      const fetchFn = typeof fetch === 'function' ? fetch : (typeof window !== 'undefined' ? window.fetch : null);
      if (!fetchFn) return;
      const res = await fetchFn('/api/geo', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const appState = getState();
        if (data && data.recommendedLang && data.recommendedLang !== appState.lang) {
          console.log('[Geo-IP] Detected country:', data.country, '-> updating language to:', data.recommendedLang);
          applyLanguage(data.recommendedLang);
        }
      }
    } catch (e) {
      console.warn('[Geo-IP] Detection error:', e);
    }
  }

  function formatGreekDateTime(dateStr) {
    if (!dateStr) return '';
    const dateObj = new Date(String(dateStr).replace(' ', 'T'));
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

  return {
    GREEK_MONTHS_SHORT: GREEK_MONTHS_SHORT,
    GREEK_WEEKDAYS_SHORT: GREEK_WEEKDAYS_SHORT,
    ENGLISH_MONTHS_SHORT: ENGLISH_MONTHS_SHORT,
    ENGLISH_WEEKDAYS_SHORT: ENGLISH_WEEKDAYS_SHORT,
    getMonthName: getMonthName,
    getWeekdayName: getWeekdayName,
    parseBuildNumber: parseBuildNumber,
    getActiveBuildLabel: getActiveBuildLabel,
    applyLanguage: applyLanguage,
    updateOTADiagnostic: updateOTADiagnostic,
    toggleLanguageSetting: toggleLanguageSetting,
    detectGeoLanguage: detectGeoLanguage,
    formatGreekDateTime: formatGreekDateTime
  };
}));
