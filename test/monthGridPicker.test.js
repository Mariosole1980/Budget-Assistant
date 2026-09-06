const test = require('node:test');
const assert = require('node:assert/strict');

// Import monthGridPicker in CommonJS Node environment
const monthGridPicker = require('../js/monthGridPicker.js');

test('monthGridPicker Module Tests', async (t) => {

  await t.test('1. exports all expected functions and constants', () => {
    const expectedFns = [
      'openMonthPicker',
      'toggleMonthPickerYearView',
      'shiftMonthPickerBSYears',
      'renderMonthPickerBS',
      'selectMonthPickerMonth'
    ];

    expectedFns.forEach(fn => {
      assert.strictEqual(typeof monthGridPicker[fn], 'function', `Expected ${fn} to be a function`);
    });

    assert.ok(Array.isArray(monthGridPicker.DEFAULT_GREEK_MONTHS_SHORT));
    assert.strictEqual(monthGridPicker.DEFAULT_GREEK_MONTHS_SHORT.length, 12);
    assert.ok(Array.isArray(monthGridPicker.DEFAULT_ENGLISH_MONTHS_SHORT));
    assert.strictEqual(monthGridPicker.DEFAULT_ENGLISH_MONTHS_SHORT.length, 12);
  });

  await t.test('2. shiftMonthPickerBSYears shifts year start correctly', () => {
    global.window = global;
    global.monthPickerBSYearStart = 2020;
    global.state = { monthPickerYear: 2024, selectedYear: 2024, selectedMonth: 5, lang: 'el' };
    global.document = {
      getElementById: () => null
    };

    monthGridPicker.shiftMonthPickerBSYears(6);
    assert.strictEqual(global.monthPickerBSYearStart, 2026);

    monthGridPicker.shiftMonthPickerBSYears(-6);
    assert.strictEqual(global.monthPickerBSYearStart, 2020);
  });

  await t.test('3. selectMonthPickerMonth updates state and triggers callbacks', () => {
    let syncStatsCalled = false;
    let updateUICalled = false;
    let renderStatsCalled = false;
    let closeModalTarget = null;

    global.syncStatsDate = () => { syncStatsCalled = true; };
    global.updateUI = () => { updateUICalled = true; };
    global.renderStatsTab = () => { renderStatsCalled = true; };
    global.closeModal = (id) => { closeModalTarget = id; };
    global.state = {
      selectedMonth: 0,
      selectedYear: 2025,
      monthPickerYear: 2026
    };

    monthGridPicker.selectMonthPickerMonth(8); // September

    assert.strictEqual(global.state.selectedMonth, 8);
    assert.strictEqual(global.state.selectedYear, 2026);
    assert.strictEqual(syncStatsCalled, true);
    assert.strictEqual(updateUICalled, true);
    assert.strictEqual(renderStatsCalled, true);
    assert.strictEqual(closeModalTarget, 'month-picker-modal');
  });

  await t.test('4. toggleMonthPickerYearView calculates base year grid correctly', () => {
    const monthsEl = { style: { display: 'grid' } };
    const yearsEl = { style: { display: 'none' } };
    const chevronEl = { style: { display: 'inline-block', transform: '' } };

    global.document = {
      getElementById: (id) => {
        if (id === 'month-picker-bs-months-view') return monthsEl;
        if (id === 'month-picker-bs-years-view') return yearsEl;
        if (id === 'month-picker-bs-year-chevron') return chevronEl;
        return null;
      },
      createElement: () => ({
        classList: { add: () => {} },
        style: {},
        appendChild: () => {}
      })
    };
    monthsEl.appendChild = () => {};
    yearsEl.appendChild = () => {};

    global.state = { monthPickerYear: 2026, selectedYear: 2026, selectedMonth: 2, lang: 'el' };
    global.monthPickerBSYearStart = 0;

    // Force year view to true
    monthGridPicker.toggleMonthPickerYearView(true);

    assert.strictEqual(monthsEl.style.display, 'none');
    assert.strictEqual(yearsEl.style.display, 'grid');
    // Math.floor((2026 - 2020) / 6) * 6 + 2020 = 1 * 6 + 2020 = 2026
    assert.strictEqual(global.monthPickerBSYearStart, 2026);

    // Toggle back to months view
    monthGridPicker.toggleMonthPickerYearView(false);
    assert.strictEqual(monthsEl.style.display, 'grid');
    assert.strictEqual(yearsEl.style.display, 'none');
  });

});
