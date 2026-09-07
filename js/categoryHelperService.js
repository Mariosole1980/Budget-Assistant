/**
 * Category Helper, Normalization & Emoji Resolution Subsystem
 * Extracted from app.js (Phase 23B Architectural Modularization)
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CategoryHelperService = factory();
    // Expose on root/window for seamless global accessibility
    root.stripLeadingEmoji = root.CategoryHelperService.stripLeadingEmoji;
    root.getFirstEmojiCodepoint = root.CategoryHelperService.getFirstEmojiCodepoint;
    root.resolveCategoryInfo = root.CategoryHelperService.resolveCategoryInfo;
    root.normalizeCategoryName = root.CategoryHelperService.normalizeCategoryName;
    root.getCategoryInfo = root.CategoryHelperService.getCategoryInfo;
    root.getCategoryDisplayName = root.CategoryHelperService.getCategoryDisplayName;
    root.isDefaultSubcategory = root.CategoryHelperService.isDefaultSubcategory;
    root.getSubcategoryDisplayName = root.CategoryHelperService.getSubcategoryDisplayName;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getState() {
    if (typeof state !== 'undefined') return state;
    if (typeof window !== 'undefined' && window.state) return window.state;
    if (typeof global !== 'undefined' && global.state) return global.state;
    return {};
  }

  function getNormalizeStringFn() {
    if (typeof normalizeString === 'function') return normalizeString;
    if (typeof window !== 'undefined' && typeof window.normalizeString === 'function') return window.normalizeString;
    if (typeof global !== 'undefined' && typeof global.normalizeString === 'function') return global.normalizeString;
    return function (s) {
      return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    };
  }

  function getRandomColorSafe() {
    if (typeof getRandomColor === 'function') return getRandomColor();
    if (typeof window !== 'undefined' && typeof window.getRandomColor === 'function') return window.getRandomColor();
    if (typeof global !== 'undefined' && typeof global.getRandomColor === 'function') return global.getRandomColor();
    return '#78909c';
  }

  function getCategoryEmojiMap() {
    if (typeof CATEGORY_EMOJI_MAP !== 'undefined') return CATEGORY_EMOJI_MAP;
    if (typeof window !== 'undefined' && window.CATEGORY_EMOJI_MAP) return window.CATEGORY_EMOJI_MAP;
    if (typeof global !== 'undefined' && global.CATEGORY_EMOJI_MAP) return global.CATEGORY_EMOJI_MAP;
    return {};
  }

  function getCategoryTranslations() {
    if (typeof CATEGORY_NAME_TRANSLATIONS !== 'undefined') return CATEGORY_NAME_TRANSLATIONS;
    if (typeof window !== 'undefined' && window.CATEGORY_NAME_TRANSLATIONS) return window.CATEGORY_NAME_TRANSLATIONS;
    if (typeof global !== 'undefined' && global.CATEGORY_NAME_TRANSLATIONS) return global.CATEGORY_NAME_TRANSLATIONS;
    return {};
  }

  function getSubcategoryTranslations() {
    if (typeof SUBCATEGORY_NAME_TRANSLATIONS !== 'undefined') return SUBCATEGORY_NAME_TRANSLATIONS;
    if (typeof window !== 'undefined' && window.SUBCATEGORY_NAME_TRANSLATIONS) return window.SUBCATEGORY_NAME_TRANSLATIONS;
    if (typeof global !== 'undefined' && global.SUBCATEGORY_NAME_TRANSLATIONS) return global.SUBCATEGORY_NAME_TRANSLATIONS;
    return {};
  }

  function getDefaultSubcategoriesMap() {
    if (typeof DEFAULT_SUBCATEGORIES_MAP !== 'undefined') return DEFAULT_SUBCATEGORIES_MAP;
    if (typeof window !== 'undefined' && window.DEFAULT_SUBCATEGORIES_MAP) return window.DEFAULT_SUBCATEGORIES_MAP;
    if (typeof global !== 'undefined' && global.DEFAULT_SUBCATEGORIES_MAP) return global.DEFAULT_SUBCATEGORIES_MAP;
    return {};
  }

  // ============================================================
  // EMOJI STRIPPING - handles surrogate pairs correctly
  // Excel exports emoji as surrogate pairs (2 UTF-16 code units)
  // We need to skip past them to get the Greek text
  // ============================================================
  function stripLeadingEmoji(str) {
    if (!str) return '';
    var i = 0;
    var codes = [];
    for (var j = 0; j < str.length; j++) {
      codes.push(str.charCodeAt(j));
    }
    while (i < codes.length) {
      var c = codes[i];
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
    var high = str.charCodeAt(0);
    var low = str.charCodeAt(1);
    if (high >= 0xD800 && high <= 0xDBFF && low >= 0xDC00 && low <= 0xDFFF) {
      var cp = 0x10000 + ((high - 0xD800) * 0x400) + (low - 0xDC00);
      return cp.toString(16).toUpperCase().padStart(5, '0');
    }
    return null;
  }

  // Resolve category from raw Excel string.
  // Strategy: Keep emoji-prefixed names intact to align with user's Excel files.
  function resolveCategoryInfo(rawCategory, transType) {
    if (!rawCategory) return null;

    var trimmed = rawCategory.trim();
    var upperName = trimmed.toUpperCase();
    var appState = getState();
    var categories = appState.categories || [];

    // 1. Find exact match in state.categories
    var cat = categories.find(function (c) {
      return c.name && c.name.toUpperCase() === upperName;
    });
    if (cat) return cat;

    // 2. Find match in CATEGORY_EMOJI_MAP by codepoint
    var emojiMap = getCategoryEmojiMap();
    var cp = getFirstEmojiCodepoint(trimmed);
    var emojiInfo = cp ? emojiMap[cp] : null;
    if (emojiInfo) {
      var mappedCat = categories.find(function (c) {
        return c.name && c.name.toUpperCase() === emojiInfo.name.toUpperCase();
      });
      if (mappedCat) return mappedCat;
      return emojiInfo;
    }

    // 3. Not found - return info to create new category
    return {
      name: trimmed,
      type: transType,
      icon: transType === 'income' ? '💰' : '💸',
      color: getRandomColorSafe()
    };
  }

  // Normalize a category name for fuzzy matching: strip leading emoji, lowercase,
  // remove Greek accents, and trim. Used to match e.g. "Αυτοκίνητο" against "🚗 ΑΥΤΟΚΙΝΗΤΟ".
  function normalizeCategoryName(name) {
    if (!name) return '';
    var normFn = getNormalizeStringFn();
    return normFn(stripLeadingEmoji(String(name)).trim());
  }

  function getCategoryInfo(categoryName, transType) {
    if (!categoryName) return { icon: transType === 'income' ? '💰' : '💸', name: '', color: '#78909c' };

    var appState = getState();
    var categories = appState.categories || [];

    // Try stored categories first (already cleaned)
    var stored = categories.find(function (c) {
      return c.name && c.name.toUpperCase() === (categoryName || '').toUpperCase();
    });
    if (stored) return stored;

    // Try emoji map via codepoint
    var emojiMap = getCategoryEmojiMap();
    var cp = getFirstEmojiCodepoint(categoryName);
    if (cp && emojiMap[cp]) return emojiMap[cp];

    // Strip and match
    var cleaned = stripLeadingEmoji(categoryName).trim();
    var cleaned2 = categories.find(function (c) {
      return c.name && c.name.toUpperCase() === cleaned.toUpperCase();
    });
    if (cleaned2) return cleaned2;

    // Fuzzy match: normalize both sides (strip emoji + case/accents) so that
    // "Αυτοκίνητο" matches the stored "🚗 ΑΥΤΟΚΙΝΗΤΟ" category.
    var normInput = normalizeCategoryName(categoryName);
    if (normInput) {
      var fuzzy = categories.find(function (c) {
        return c.name && normalizeCategoryName(c.name) === normInput;
      });
      if (fuzzy) return fuzzy;
    }

    return { icon: transType === 'income' ? '💰' : '💸', name: cleaned || categoryName, color: '#78909c' };
  }

  // Get category display name - translates default categories, preserves custom/user categories
  function getCategoryDisplayName(categoryName) {
    if (!categoryName) return '';
    var stripped = stripLeadingEmoji(categoryName).trim();
    var normInput = normalizeCategoryName(categoryName);
    if (!normInput) return stripped;
    var appState = getState();
    var lang = appState.lang || 'el';

    var translations = getCategoryTranslations();

    for (var entry of Object.entries(translations)) {
      var elKey = entry[0];
      var enVal = entry[1];
      var normEl = normalizeCategoryName(elKey);
      var normEn = normalizeCategoryName(enVal);

      if (normInput === normEl || normInput === normEn) {
        var target = lang === 'en' ? enVal : elKey;
        return stripLeadingEmoji(target).trim();
      }
    }
    return stripped;
  }

  function isDefaultSubcategory(categoryName, subcategoryName) {
    if (!subcategoryName) return false;

    var normSub = normalizeCategoryName(subcategoryName);
    if (!normSub) return false;

    var defaultMap = getDefaultSubcategoriesMap();
    for (var subcats of Object.values(defaultMap)) {
      if (Array.isArray(subcats)) {
        var found = subcats.some(function (s) {
          return normalizeCategoryName(s) === normSub;
        });
        if (found) return true;
      }
    }

    return false;
  }

  function getSubcategoryDisplayName(subName, categoryName) {
    if (!subName) return '';
    var stripped = stripLeadingEmoji(subName).trim();
    var normInput = normalizeCategoryName(subName);
    if (!normInput) return stripped;
    var appState = getState();
    var lang = appState.lang || 'el';

    if (!isDefaultSubcategory(categoryName, subName)) {
      return subName; // Custom entries are never translated
    }

    var translations = getSubcategoryTranslations();

    for (var entry of Object.entries(translations)) {
      var elKey = entry[0];
      var enVal = entry[1];
      var normEl = normalizeCategoryName(elKey);
      var normEn = normalizeCategoryName(enVal);

      if (normInput === normEl || normInput === normEn) {
        var target = lang === 'en' ? enVal : elKey;
        return stripLeadingEmoji(target).trim();
      }
    }
    return subName;
  }

  return {
    stripLeadingEmoji: stripLeadingEmoji,
    getFirstEmojiCodepoint: getFirstEmojiCodepoint,
    resolveCategoryInfo: resolveCategoryInfo,
    normalizeCategoryName: normalizeCategoryName,
    getCategoryInfo: getCategoryInfo,
    getCategoryDisplayName: getCategoryDisplayName,
    isDefaultSubcategory: isDefaultSubcategory,
    getSubcategoryDisplayName: getSubcategoryDisplayName
  };
}));
