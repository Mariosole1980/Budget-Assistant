const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

const rootProperties = {};
const bodyClasses = new Set();
const rootClasses = new Set();

const metaTag = {
  attrs: {},
  setAttribute(k, v) { this.attrs[k] = v; },
  getAttribute(k) { return this.attrs[k]; }
};

const appContainerEl = {
  style: {
    _props: {},
    removeProperty(prop) { delete this._props[prop]; delete this[prop]; },
    setProperty(prop, val) { this._props[prop] = val; this[prop] = val; }
  }
};

global.document = {
  documentElement: {
    classList: {
      add(c) { rootClasses.add(c); },
      remove(c) { rootClasses.delete(c); },
      contains(c) { return rootClasses.has(c); }
    },
    style: {
      setProperty(k, v) { rootProperties[k] = v; },
      getPropertyValue(k) { return rootProperties[k] || ''; }
    }
  },
  body: {
    classList: {
      add(c) { bodyClasses.add(c); },
      remove(c) { bodyClasses.delete(c); },
      contains(c) { return bodyClasses.has(c); }
    }
  },
  querySelector(sel) {
    if (sel === 'meta[name="theme-color"]') return metaTag;
    if (sel === '.app-container') return appContainerEl;
    return null;
  }
};

global.getComputedStyle = () => ({
  getPropertyValue(prop) {
    return rootProperties[prop] || '';
  }
});

global.state = {
  activeTab: 'home'
};

let statsRendered = false;
global.renderStatsTab = () => { statsRendered = true; };

let settingsDisplayUpdated = false;
global.updateSettingsDisplay = () => { settingsDisplayUpdated = true; };

// Load the module
const ThemeEngine = require('../js/themeEngine.js');

test('ThemeEngine: THEMES dictionary contains all 9 expected themes', () => {
  const expectedThemes = ['dark', 'oled', 'light', 'pink', 'sakura', 'rosegold', 'emerald', 'ocean', 'cyber'];
  assert.ok(ThemeEngine.THEMES, 'THEMES is defined');
  expectedThemes.forEach(t => {
    assert.ok(ThemeEngine.THEMES[t], `Theme ${t} must exist`);
    assert.strictEqual(typeof ThemeEngine.THEMES[t].bgMain, 'string');
    assert.strictEqual(typeof ThemeEngine.THEMES[t].bgCard, 'string');
    assert.strictEqual(typeof ThemeEngine.THEMES[t].accent, 'string');
    assert.strictEqual(typeof ThemeEngine.THEMES[t].isLight, 'boolean');
  });
});

test('ThemeEngine: getThemeBgColor returns correct bgMain and defaults to dark', () => {
  assert.strictEqual(ThemeEngine.getThemeBgColor('oled'), '#000000');
  assert.strictEqual(ThemeEngine.getThemeBgColor('dark'), '#181b22');
  assert.strictEqual(ThemeEngine.getThemeBgColor('light'), '#f4f6f9');
  assert.strictEqual(ThemeEngine.getThemeBgColor('unknown_non_existent'), '#181b22');
});

test('ThemeEngine: applyTheme applies CSS variables and classes correctly', () => {
  ThemeEngine.applyTheme('cyber');
  assert.ok(bodyClasses.has('theme-cyber'));
  assert.ok(rootClasses.has('theme-cyber'));
  assert.strictEqual(rootProperties['--bg-main'], ThemeEngine.THEMES.cyber.bgMain);
  assert.strictEqual(rootProperties['--accent'], ThemeEngine.THEMES.cyber.accent);
  assert.strictEqual(metaTag.getAttribute('content'), ThemeEngine.THEMES.cyber.bgMain);

  // Switching back to dark should clear theme-* classes
  ThemeEngine.applyTheme('dark');
  assert.strictEqual(bodyClasses.has('theme-cyber'), false);
  assert.strictEqual(rootClasses.has('theme-cyber'), false);
  assert.strictEqual(rootProperties['--bg-main'], ThemeEngine.THEMES.dark.bgMain);
});

test('ThemeEngine: changeThemeSetting saves to localStorage and applies theme', () => {
  ThemeEngine.changeThemeSetting('emerald');
  assert.strictEqual(localStorage.getItem('app_theme'), 'emerald');
  assert.strictEqual(rootProperties['--bg-main'], ThemeEngine.THEMES.emerald.bgMain);
});

test('ThemeEngine: applyFontSize and changeFontSizeSetting apply zoom safely', () => {
  ThemeEngine.applyFontSize('large');
  assert.strictEqual(appContainerEl.style.zoom, 1.15);

  ThemeEngine.applyFontSize('normal');
  assert.strictEqual(appContainerEl.style.zoom, undefined);

  settingsDisplayUpdated = false;
  ThemeEngine.changeFontSizeSetting('small');
  assert.strictEqual(localStorage.getItem('app_font_size'), 'small');
  assert.strictEqual(appContainerEl.style.zoom, 0.9);
  assert.strictEqual(settingsDisplayUpdated, true);
});
