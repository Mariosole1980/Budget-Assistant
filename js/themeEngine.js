// ============================================================
// THEME & APPEARANCE ENGINE
// Autonomous UMD Module (Phase 16A Architectural Extraction)
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
    rootObj.ThemeEngine = exports;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

const THEMES = {
  dark: {
    bgMain: '#181b22', bgCard: '#222731', bgInput: '#2b313d',
    textMain: '#e3e8f0', textSecondary: '#8a99ad', textMuted: '#64748b',
    accent: '#38bdf8', accentRgb: '56, 189, 248',
    accentGradient: 'linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%)',
    overlay: 'rgba(255,255,255,0.05)', overlayStrong: 'rgba(255,255,255,0.09)',
    border: '#2e3543', borderLight: '#384152', dayHeader: '#1b1f28',
    shadow: '0 4px 12px rgba(0,0,0,0.3)', shadowLg: '0 10px 25px rgba(0,0,0,0.4)',
    isLight: false
  },
  oled: {
    bgMain: '#000000', bgCard: '#0d0d0d', bgInput: '#151515',
    textMain: '#e3e8f0', textSecondary: '#8a99ad', textMuted: '#64748b',
    accent: '#2ec4b6', accentRgb: '46, 196, 182',
    accentGradient: 'linear-gradient(135deg, #2ec4b6 0%, #10b981 100%)',
    overlay: 'rgba(255,255,255,0.05)', overlayStrong: 'rgba(255,255,255,0.10)',
    border: '#1f1f1f', borderLight: '#262626', dayHeader: '#080808',
    shadow: '0 4px 12px rgba(0,0,0,0.6)', shadowLg: '0 10px 25px rgba(0,0,0,0.8)',
    isLight: false
  },
  light: {
    bgMain: '#f4f6f9', bgCard: '#ffffff', bgInput: '#e9ecef',
    textMain: '#1e293b', textSecondary: '#475569', textMuted: '#64748b',
    accent: '#2ec4b6', accentRgb: '46, 196, 182',
    accentGradient: 'linear-gradient(135deg, #2ec4b6 0%, #2563eb 100%)',
    overlay: 'rgba(15,23,42,0.05)', overlayStrong: 'rgba(15,23,42,0.09)',
    border: '#e2e8f0', borderLight: '#f1f5f9', dayHeader: '#e9ecef',
    shadow: '0 4px 12px rgba(15,23,42,0.08)', shadowLg: '0 10px 25px rgba(15,23,42,0.12)',
    isLight: true
  },
  pink: {
    bgMain: '#1f1218', bgCard: '#2d1b24', bgInput: '#3d2531',
    textMain: '#fdf2f8', textSecondary: '#fbcfe8', textMuted: '#f472b6',
    accent: '#ff758f', accentRgb: '255, 117, 143',
    accentGradient: 'linear-gradient(135deg, #ff758f 0%, #d946ef 100%)',
    overlay: 'rgba(255,255,255,0.06)', overlayStrong: 'rgba(255,255,255,0.10)',
    border: 'rgba(255,117,143,0.25)', borderLight: 'rgba(255,117,143,0.35)', dayHeader: '#261820',
    shadow: '0 4px 12px rgba(0,0,0,0.35)', shadowLg: '0 10px 25px rgba(0,0,0,0.45)',
    isLight: false
  },
  sakura: {
    bgMain: '#fff5f7', bgCard: '#ffffff', bgInput: '#fce7f3',
    textMain: '#831843', textSecondary: '#9d174d', textMuted: '#be185d',
    accent: '#f43f5e', accentRgb: '244, 63, 94',
    accentGradient: 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
    overlay: 'rgba(131,24,67,0.05)', overlayStrong: 'rgba(131,24,67,0.09)',
    border: '#fbcfe8', borderLight: '#f472b6', dayHeader: '#fce7f3',
    shadow: '0 4px 12px rgba(244,63,94,0.08)', shadowLg: '0 10px 25px rgba(244,63,94,0.12)',
    isLight: true
  },

  rosegold: {
    bgMain: '#180e14', bgCard: '#261720', bgInput: '#36202c',
    textMain: '#fff1f2', textSecondary: '#fecdd3', textMuted: '#fda4af',
    accent: '#fb7185', accentRgb: '251, 113, 133',
    accentGradient: 'linear-gradient(135deg, #fb7185 0%, #c2410c 100%)',
    overlay: 'rgba(255,255,255,0.05)', overlayStrong: 'rgba(255,255,255,0.09)',
    border: 'rgba(251,113,133,0.22)', borderLight: 'rgba(251,113,133,0.32)', dayHeader: '#20121a',
    shadow: '0 4px 12px rgba(0,0,0,0.4)', shadowLg: '0 10px 25px rgba(0,0,0,0.5)',
    isLight: false
  },
  emerald: {
    bgMain: '#0f1916', bgCard: '#182823', bgInput: '#20352e',
    textMain: '#e3e8f0', textSecondary: '#8a99ad', textMuted: '#64748b',
    accent: '#2ec4b6', accentRgb: '46, 196, 182',
    accentGradient: 'linear-gradient(135deg, #2ec4b6 0%, #10b981 100%)',
    overlay: 'rgba(255,255,255,0.05)', overlayStrong: 'rgba(255,255,255,0.09)',
    border: '#233d35', borderLight: '#2c4c42', dayHeader: '#13221e',
    shadow: '0 4px 12px rgba(0,0,0,0.35)', shadowLg: '0 10px 25px rgba(0,0,0,0.45)',
    isLight: false
  },
  ocean: {
    bgMain: '#0b132b', bgCard: '#1c2541', bgInput: '#293250',
    textMain: '#e3e8f0', textSecondary: '#8a99ad', textMuted: '#64748b',
    accent: '#00b4d8', accentRgb: '0, 180, 216',
    accentGradient: 'linear-gradient(135deg, #00b4d8 0%, #3b82f6 100%)',
    overlay: 'rgba(255,255,255,0.05)', overlayStrong: 'rgba(255,255,255,0.09)',
    border: '#2b3964', borderLight: '#36487a', dayHeader: '#141c33',
    shadow: '0 4px 12px rgba(0,0,0,0.35)', shadowLg: '0 10px 25px rgba(0,0,0,0.45)',
    isLight: false
  },
  cyber: {
    bgMain: '#11091c', bgCard: '#1c102b', bgInput: '#29183d',
    textMain: '#faf5ff', textSecondary: '#e9d5ff', textMuted: '#c084fc',
    accent: '#a855f7', accentRgb: '168, 85, 247',
    accentGradient: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    overlay: 'rgba(255,255,255,0.05)', overlayStrong: 'rgba(255,255,255,0.09)',
    border: 'rgba(168,85,247,0.25)', borderLight: 'rgba(168,85,247,0.35)', dayHeader: '#170c26',
    shadow: '0 4px 12px rgba(0,0,0,0.4)', shadowLg: '0 10px 25px rgba(0,0,0,0.5)',
    isLight: false
  }
};

// Returns the theme's main background color (used by resume/cold-start overlays).
function getThemeBgColor(theme) {
  return (THEMES[theme] && THEMES[theme].bgMain) || THEMES.dark.bgMain;
}
window.getThemeBgColor = getThemeBgColor;

function applyTheme(theme) {
  const t = THEMES[theme] || THEMES.dark;
  const themeClasses = ['theme-oled', 'theme-light', 'theme-emerald', 'theme-ocean', 'theme-pink', 'theme-sakura', 'theme-rosegold', 'theme-cyber'];
  themeClasses.forEach(cls => {
    document.body.classList.remove(cls);
    document.documentElement.classList.remove(cls);
  });
  if (theme !== 'dark') {
    document.body.classList.add(`theme-${theme}`);
    document.documentElement.classList.add(`theme-${theme}`);
  }

  // FULL token set → every var(--*) consumer follows the theme (not a repaint).
  const rootStyle = document.documentElement.style;
  const tokens = {
    '--bg-main': t.bgMain,
    '--bg-card': t.bgCard,
    '--bg-input': t.bgInput,
    '--text-main': t.textMain,
    '--text-primary': t.textMain,
    '--text-secondary': t.textSecondary,
    '--text-muted': t.textMuted,
    '--text-cat-label': t.isLight ? '#334155' : '#cbd5e1',
    '--text-sub-label': t.isLight ? '#475569' : '#94a3b8',
    '--accent': t.accent,
    '--accent-rgb': t.accentRgb,
    '--accent-gradient': t.accentGradient,
    '--overlay-alpha': t.overlay,
    '--overlay-alpha-strong': t.overlayStrong,
    '--border': t.border,
    '--border-light': t.borderLight,
    '--bg-day-header': t.dayHeader,
    '--shadow': t.shadow,
    '--shadow-lg': t.shadowLg
  };
  Object.keys(tokens).forEach(k => rootStyle.setProperty(k, tokens[k]));

  // Per-alpha theme-aware overlays (replaces inline rgba(255,255,255,A) tints).
  // Derive the RGB base from the theme's own overlay token: white on dark
  // themes, theme-tinted dark on light themes (slate for light, rose for sakura)
  // so the ~120 inline surfaces stay visible everywhere (not a repaint).
  const overlayMatch = t.overlay.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
  const overlayBase = overlayMatch ? overlayMatch[1] + ',' + overlayMatch[2] + ',' + overlayMatch[3] : '255,255,255';
  const overlayAlphas = [0.01, 0.02, 0.025, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.12, 0.14, 0.18, 0.2, 0.22];
  overlayAlphas.forEach(v => {
    rootStyle.setProperty('--overlay-' + String(Math.round(v * 1000)).padStart(3, '0'), `rgba(${overlayBase},${v})`);
  });

  // Sync meta theme-color + native Android window bars (all 9 themes covered).
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) metaThemeColor.setAttribute('content', t.bgMain);
  const bgColor = t.bgMain;
  const statusBarColor = bgColor; // Phase 3: status bar blends with body background (bg-main)
  const navBarColor = bgColor; // Match navigation bar to body background
  const isLight = !!t.isLight;

  if (window.Capacitor) {
    try {
      const NativeTheme = (window.Capacitor.Plugins && window.Capacitor.Plugins.NativeTheme) ||
        (window.Capacitor.registerPlugin && window.Capacitor.registerPlugin('NativeTheme'));
      if (NativeTheme) {
        NativeTheme.setThemeState({
          bgColor: bgColor,
          statusBarColor: statusBarColor,
          navBarColor: navBarColor,
          isLight: isLight
        });
      }
    } catch (e) {
      console.warn('Failed to sync native background theme:', e);
    }
  }

  if (window.Chart) {
    const textSecondary = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#8a99ad';
    Chart.defaults.color = textSecondary;
  }

  if (state.activeTab === 'stats') {
    renderStatsTab();
  }
}

function changeThemeSetting(theme) {
  localStorage.setItem('app_theme', theme);
  applyTheme(theme);
}

// Font Size Helpers
function applyFontSize(size) {
  const zoomMap = { small: 0.9, normal: 1.0, large: 1.15, xlarge: 1.3 };
  const zoom = zoomMap[size] || 1.0;
  // Εφαρμόζουμε zoom στο .app-container (ΟΧΙ στο body) για να μην σπάσουν
  // τα fixed-position modals. Τα modals έχουν zoom:1 στο CSS.
  const appContainer = document.querySelector('.app-container');
  if (appContainer) {
    if (zoom === 1.0) {
      // FIX (font-size fluctuation): Για το "normal" μέγεθος ΔΕΝ ορίζουμε
      // zoom:1 αλλά αφαιρούμε εντελώς το inline zoom. Το zoom (ακόμα και 1.0)
      // δημιουργεί νέο containing block / ξεχωριστό compositing layer στο
      // .app-container. Στο Android WebView, όταν το .tab-screen κάνει το
      // fade-in-premium animation (transform: translateY), ο compositor
      // επανα-ραστεροποιεί το zoomed layer προκαλώντας ορατή αυξομείωση
      // μεγέθους γραμμάτων κάθε φορά που ανοίγουμε/κλείνουμε ένα tab.
      appContainer.style.removeProperty('zoom');
    } else {
      appContainer.style.zoom = zoom;
    }
  }
}

function changeFontSizeSetting(size) {
  localStorage.setItem('app_font_size', size);
  applyFontSize(size);
  updateSettingsDisplay();
}

  // Window Bindings
  window.THEMES = THEMES;
  window.getThemeBgColor = getThemeBgColor;
  window.applyTheme = applyTheme;
  window.changeThemeSetting = changeThemeSetting;
  window.applyFontSize = applyFontSize;
  window.changeFontSizeSetting = changeFontSizeSetting;

  return {
    THEMES: THEMES,
    getThemeBgColor: getThemeBgColor,
    applyTheme: applyTheme,
    changeThemeSetting: changeThemeSetting,
    applyFontSize: applyFontSize,
    changeFontSizeSetting: changeFontSizeSetting
  };
}));
