'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const APP_JS = path.join(__dirname, '..', 'app.js');
const appSrc = fs.readFileSync(APP_JS, 'utf8');

test('autoLock: _getAutoLockDelayMs handles immediate, intervals, and disabled', () => {
    assert.match(appSrc, /function _getAutoLockDelayMs\(\)/);
    assert.match(appSrc, /case 'immediate':\s*case '0':\s*return 0;/);
    assert.match(appSrc, /case '1':\s*return 60 \* 1000;/);
    assert.match(appSrc, /case '5':\s*return 5 \* 60 \* 1000;/);
    assert.match(appSrc, /case '10':\s*return 10 \* 60 \* 1000;/);
    assert.match(appSrc, /default:\s*return -1;/);
});

test('autoLock: changeAutoLockSetting prompts for PIN if not configured', () => {
    assert.match(appSrc, /function changeAutoLockSetting\(val\)/);
    assert.match(appSrc, /const savedPin = localStorage\.getItem\('app_pin'\);/);
    assert.match(appSrc, /const validPin = savedPin && savedPin\.length === 4;/);
    assert.match(appSrc, /window\._pendingAutoLockVal = val;/);
    assert.match(appSrc, /openPinModal\(\);/);
});

test('autoLock: changeAutoLockSetting sets app_lock_enabled when PIN is valid', () => {
    assert.match(appSrc, /localStorage\.setItem\('app_lock_enabled', 'true'\);/);
});

test('autoLock: submitPinSetup applies pending auto-lock setting', () => {
    assert.match(appSrc, /if \(window\._pendingAutoLockVal\) \{/);
    assert.match(appSrc, /localStorage\.setItem\('settings_auto_lock_delay', window\._pendingAutoLockVal\);/);
    assert.match(appSrc, /window\._pendingAutoLockVal = null;/);
});

test('autoLock: showLockScreen checks valid PIN and auto-lock setting', () => {
    assert.match(appSrc, /const autoLockDelay = localStorage\.getItem\('settings_auto_lock_delay'\) \|\| 'disabled';/);
    assert.match(appSrc, /if \(!validPin \|\| \(!appLockEnabled && !biometricsEnabled && autoLockDelay === 'disabled'\)\) \{/);
});

test('autoLock: hideLockScreen resets auto-lock timer upon unlock', () => {
    assert.match(appSrc, /function hideLockScreen\(\) \{[\s\S]*?_resetAutoLockTimer\(\);[\s\S]*?\}/);
});

test('autoLock: _handleAppResumed supports immediate and elapsed inactivity lock', () => {
    assert.match(appSrc, /if \(autoLockSetting === 'immediate' \|\| autoLockSetting === '0'\) \{/);
    assert.match(appSrc, /showLockScreen\(\);/);
    assert.match(appSrc, /const storedActivity = Number\(localStorage\.getItem\('last_user_activity_timestamp'\)\) \|\| 0;/);
    assert.match(appSrc, /if \(elapsed >= delayMs\) \{/);
});

test('autoLock: settings picker includes immediate option', () => {
    assert.match(appSrc, /value: 'immediate'/);
    assert.match(appSrc, /auto_lock_immediate/);
});

test('autoLock: updateSettingsDisplay styles auto-lock badge based on enabled state', () => {
    assert.match(appSrc, /const autoLockDelay = localStorage\.getItem\('settings_auto_lock_delay'\) \|\| 'disabled';/);
    assert.match(appSrc, /parentBadge\.style\.background = 'rgba\(var\(--accent-rgb/);
});
