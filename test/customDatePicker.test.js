const test = require('node:test');
const assert = require('node:assert/strict');

const mockElement = (tag = 'div') => ({
  style: {
    display: '',
    setProperty: () => {}
  },
  classList: {
    add: () => {},
    remove: () => {},
    contains: () => false
  },
  children: [],
  dataset: {},
  appendChild: () => {},
  addEventListener: () => {},
  querySelectorAll: () => [],
  querySelector: () => null,
  setAttribute: () => {},
  getAttribute: () => '',
  scrollTop: 0,
  value: ''
});

global.window = global;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.document = {
  getElementById: (id) => mockElement(id),
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: (tag) => mockElement(tag),
  addEventListener: () => {}
};
global.state = {
  lang: 'el',
  activeTab: 'expense'
};
global.openModal = () => {};
global.closeModal = () => {};
global.ensureHistoryPushed = () => {};
global.getMonthName = (m) => ['Ιαν','Φεβ','Μαρ','Απρ','Μαϊ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'][m];
global.ENGLISH_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
global.GREEK_MONTHS_SHORT = ['Ιαν','Φεβ','Μαρ','Απρ','Μαϊ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];

const customDatePicker = require('../js/customDatePicker.js');

test('CustomDatePicker exports expected functions', () => {
  assert.equal(typeof customDatePicker.openCustomDatePicker, 'function');
  assert.equal(typeof customDatePicker.openCustomDatePickerBS, 'function');
  assert.equal(typeof customDatePicker.closeCustomDatePickerBS, 'function');
  assert.equal(typeof customDatePicker.toggleCustomDatePickerBSYearView, 'function');
  assert.equal(typeof customDatePicker.renderCustomDatePickerBSGrids, 'function');
  assert.equal(typeof customDatePicker.renderCustomDatePickerCalendar, 'function');
  assert.equal(typeof customDatePicker.setCustomDatePickerValue, 'function');
  assert.equal(typeof customDatePicker.setCustomDatePickerNowTime, 'function');
  assert.equal(typeof customDatePicker.toggleTimeInputMode, 'function');
  assert.equal(typeof customDatePicker.adjustCustomDatePickerMonth, 'function');
  assert.equal(typeof customDatePicker.initCalendarSwipeGestures, 'function');
  assert.equal(typeof customDatePicker.initYearSwipeGestures, 'function');
  assert.equal(typeof customDatePicker.enableDirectTimeTapToEdit, 'function');
  assert.equal(typeof customDatePicker.syncTimeInputsBackToWheels, 'function');
});

test('openCustomDatePicker executes safely', () => {
  assert.doesNotThrow(() => {
    customDatePicker.openCustomDatePicker('trans-date');
  });
});

test('adjustCustomDatePickerMonth shifts month safely', () => {
  assert.doesNotThrow(() => {
    customDatePicker.adjustCustomDatePickerMonth(1);
    customDatePicker.adjustCustomDatePickerMonth(-1);
  });
});
