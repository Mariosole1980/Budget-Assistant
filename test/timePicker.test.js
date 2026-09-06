const { describe, it, before } = require('node:test');
const assert = require('node:assert');

describe('TimePicker Module Tests', () => {
  let timePicker;

  before(() => {
    timePicker = require('../js/timePicker.js');
  });

  it('exports all expected functions and constants', () => {
    assert.strictEqual(typeof timePicker.parseTimeString, 'function');
    assert.strictEqual(typeof timePicker.formatTimeString, 'function');
    assert.strictEqual(typeof timePicker.getTimePresetForTime, 'function');
    assert.strictEqual(typeof timePicker.selectModernTimePreset, 'function');
    assert.strictEqual(typeof timePicker.openModernTimePicker, 'function');
    assert.strictEqual(typeof timePicker.closeModernTimePicker, 'function');
    assert.strictEqual(typeof timePicker.handleModernTimePickerOverlayClick, 'function');
    assert.strictEqual(typeof timePicker.confirmModernTimePicker, 'function');
    assert.strictEqual(typeof timePicker.openModernTimePickerForDailyReminder, 'function');
    assert.strictEqual(timePicker.DRUM_CYCLES, 5);
    assert.strictEqual(timePicker.DRUM_ITEM_HEIGHT, 48);
  });

  describe('1. parseTimeString', () => {
    it('parses valid HH:MM strings into safe numeric hour and minute', () => {
      const res1 = timePicker.parseTimeString('08:30');
      assert.deepStrictEqual(res1, { hour: 8, minute: 30 });

      const res2 = timePicker.parseTimeString('23:59');
      assert.deepStrictEqual(res2, { hour: 23, minute: 59 });

      const res3 = timePicker.parseTimeString('00:00');
      assert.deepStrictEqual(res3, { hour: 0, minute: 0 });
    });

    it('falls back to 21:00 for invalid strings or out-of-bounds values', () => {
      assert.deepStrictEqual(timePicker.parseTimeString(''), { hour: 21, minute: 0 });
      assert.deepStrictEqual(timePicker.parseTimeString(null), { hour: 21, minute: 0 });
      assert.deepStrictEqual(timePicker.parseTimeString('invalid'), { hour: 21, minute: 0 });
      assert.deepStrictEqual(timePicker.parseTimeString('25:00'), { hour: 21, minute: 0 });
      assert.deepStrictEqual(timePicker.parseTimeString('12:65'), { hour: 12, minute: 0 });
    });
  });

  describe('2. formatTimeString', () => {
    it('formats numbers into zero-padded HH:MM strings', () => {
      assert.strictEqual(timePicker.formatTimeString(9, 5), '09:05');
      assert.strictEqual(timePicker.formatTimeString(0, 0), '00:00');
      assert.strictEqual(timePicker.formatTimeString(21, 0), '21:00');
      assert.strictEqual(timePicker.formatTimeString(23, 59), '23:59');
    });

    it('safely handles non-numbers and negatives', () => {
      assert.strictEqual(timePicker.formatTimeString(-1, 30), '00:30');
      assert.strictEqual(timePicker.formatTimeString(10, 75), '10:00');
      assert.strictEqual(timePicker.formatTimeString('abc', 'def'), '00:00');
    });
  });

  describe('3. getTimePresetForTime', () => {
    it('identifies predefined presets accurately', () => {
      assert.strictEqual(timePicker.getTimePresetForTime(9, 0), 'morning');
      assert.strictEqual(timePicker.getTimePresetForTime(20, 0), 'evening');
      assert.strictEqual(timePicker.getTimePresetForTime(22, 30), 'night');
    });

    it('returns null for arbitrary times that do not match presets', () => {
      assert.strictEqual(timePicker.getTimePresetForTime(9, 15), null);
      assert.strictEqual(timePicker.getTimePresetForTime(14, 0), null);
      assert.strictEqual(timePicker.getTimePresetForTime(21, 0), null);
    });
  });
});
