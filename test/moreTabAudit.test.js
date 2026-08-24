'use strict';

// ===========================================================================
// More-tab audit regression guards (#1-#4 from the More tab bug audit):
//   1. Hardcoded €  -> getCurrencySymbol() + formatDisplayAmount() (non-EUR safe)
//   2. Legacy purple accent in JS-generated HTML -> theme vars / runtime accent
//   3. Dead bindings (settings-daily-reminder-time, settings-auto-lock-delay,
//      hub-row-feedback, trash-bin-count-val) removed
//   4. Missing lifecycle hooks onSubscreenShow_feedback / onSubscreenShow_legal
//      reset the feedback form between openings
//
// app.js is a browser SPA and cannot be require()'d from Node, so these are
// SOURCE-LEVEL regression guards (same approach as bug04CloudPersistence).
// ===========================================================================

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const APP_JS = path.join(__dirname, '..', 'app.js');
const appSrc = fs.readFileSync(APP_JS, 'utf8');

// ---------------------------------------------------------------------------
// #1 — hardcoded € replaced with getCurrencySymbol() + formatDisplayAmount()
// ---------------------------------------------------------------------------
test('#1: no hardcoded `.toFixed(2)}€` remains in app.js', () => {
    const hits = (appSrc.match(/\.toFixed\(2\)\}\s*€/g) || []);
    assert.strictEqual(hits.length, 0, `found hardcoded EUR: ${hits.length}`);
});

test('#1: recurring preset list formats with getCurrencySymbol + formatDisplayAmount', () => {
    assert.match(appSrc, /\$\{presetLabel\} • \$\{getCurrencySymbol\(\)\} \$\{formatDisplayAmount\(t\.amount, t\.currency \|\| state\.mainCurrency \|\| 'EUR'\)\}\$\{endDateLabel\}/);
});

test('#1: trash bin rows format with getCurrencySymbol + formatDisplayAmount', () => {
    // Non-recurring trash transaction row.
    assert.match(appSrc, /\$\{formattedDate\} • \$\{getCurrencySymbol\(\)\} \$\{formatDisplayAmount\(t\.amount, t\.currency \|\| state\.mainCurrency \|\| 'EUR'\)\}/);
    // Recurring-group trash row subtitle.
    assert.match(appSrc, /\|\| 'Επαναλαμβανόμενη'\)\} • \$\{getCurrencySymbol\(\)\} \$\{formatDisplayAmount\(t\.amount, t\.currency \|\| state\.mainCurrency \|\| 'EUR'\)\}/);
});

// ---------------------------------------------------------------------------
// #2 — legacy purple accent removed from the More-tab JS-generated HTML
// ---------------------------------------------------------------------------
test('#2: recurring hover no longer uses rgba(124, 106, 247, ...)', () => {
    // The More-tab recurring buttons (details + edit) must use the theme
    // accent rgb var — exactly 2 buttons carry the accent hover.
    const accentHoverButtons = (appSrc.match(/onmouseover="this\.style\.backgroundColor='rgba\(var\(--accent-rgb\), 0\.15\)'/g) || []);
    assert.strictEqual(accentHoverButtons.length, 2, 'both recurring buttons (details + edit) must use the theme accent hover');
});

test('#2: trash recurring-group badge resolves the active theme accent', () => {
    assert.match(appSrc, /const color = getComputedStyle\(document\.documentElement\)\.getPropertyValue\('--accent'\)\.trim\(\) \|\| '#7c6af7';/);
});

// ---------------------------------------------------------------------------
// #3 — dead bindings removed
// ---------------------------------------------------------------------------
test('#3: no getElementById binding for the removed settings-daily-reminder-time input', () => {
    // Only the -display span and -time-row may be referenced.
    assert.doesNotMatch(appSrc, /getElementById\('settings-daily-reminder-time'\)/);
    assert.doesNotMatch(appSrc, /getElementById\("settings-daily-reminder-time"\)/);
    // The toggle handler must read the saved time from localStorage instead.
    assert.match(appSrc, /const timeVal = localStorage\.getItem\('settings_daily_reminder_time'\) \|\| '21:00';/);
});

test('#3: no getElementById binding for the removed settings-auto-lock-delay select', () => {
    assert.doesNotMatch(appSrc, /getElementById\('settings-auto-lock-delay'\)/);
});

test('#3: no dead hub-row-feedback binding remains', () => {
    // Only a comment may mention the old row; no getElementById/addEventListener.
    assert.doesNotMatch(appSrc, /const rowFeedback = document\.getElementById\('hub-row-feedback'\);/);
});

test('#3: no legacy trash-bin-count-val references remain', () => {
    assert.doesNotMatch(appSrc, /trash-bin-count-val/);
});

// ---------------------------------------------------------------------------
// #4 — lifecycle hooks reset the feedback form between opens
// ---------------------------------------------------------------------------
test('#4: onSubscreenShow_feedback and onSubscreenShow_legal hooks reset the feedback form', () => {
    const feedbackHook = appSrc.match(/window\.onSubscreenShow_feedback = function \(\) \{([\s\S]*?)\n\};/);
    assert.ok(feedbackHook, 'onSubscreenShow_feedback hook not found');
    assert.match(feedbackHook[0], /resetFeedbackForm\(\);/);

    const legalHook = appSrc.match(/window\.onSubscreenShow_legal = function \(\) \{([\s\S]*?)\n\};/);
    assert.ok(legalHook, 'onSubscreenShow_legal hook not found');
    assert.match(legalHook[0], /resetFeedbackForm\(\);/);
});
