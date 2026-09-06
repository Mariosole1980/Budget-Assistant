/**
 * js/timePicker.js
 *
 * Modern Drum-Roll Clock & Time Picker Controller.
 * Extracted from app.js (Phase 4 Architectural Domain Extraction).
 *
 * Provides iOS/Android-style infinite drum-roll scrolling for hour and minute
 * selection with presets (morning, evening, night) and callback invocation.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser: attach to root (window)
    var exports = factory();
    Object.assign(root, exports);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var windowObj = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});

  /**
   * Pure helper: parse time string (HH:MM) into safe { hour, minute } object.
   * Defaults to 21:00 if invalid or omitted.
   */
  function parseTimeString(str) {
    if (str && typeof str === 'string' && str.includes(':')) {
      const parts = str.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      return {
        hour: (!isNaN(h) && h >= 0 && h <= 23) ? h : 21,
        minute: (!isNaN(m) && m >= 0 && m <= 59) ? m : 0
      };
    }
    return { hour: 21, minute: 0 };
  }

  /**
   * Pure helper: format hour and minute into HH:MM string with zero-padding.
   */
  function formatTimeString(hour, minute) {
    const h = (!isNaN(hour) && hour >= 0 && hour <= 23) ? hour : 0;
    const m = (!isNaN(minute) && minute >= 0 && minute <= 59) ? minute : 0;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  /**
   * Pure helper: returns the preset key ('morning', 'evening', 'night') or null.
   */
  function getTimePresetForTime(hour, minute) {
    if (hour === 9 && minute === 0) return 'morning';
    if (hour === 20 && minute === 0) return 'evening';
    if (hour === 22 && minute === 30) return 'night';
    return null;
  }

// MODERN CLOCK & TIME PICKER CONTROLLER
// ============================================================
let _modernTimePickerCallback = null;
let _modernTimePickerHour = 21;
let _modernTimePickerMinute = 0;
let _modernTimeWheelsInitialized = false;
const DRUM_CYCLES = 5;
const DRUM_ITEM_HEIGHT = 48;

function selectModernTimePreset(hour, minute) {
  _modernTimePickerHour = hour;
  _modernTimePickerMinute = minute;

  updateModernTimePresetActiveState();

  const hs = document.getElementById('modern-scroll-hours');
  const ms = document.getElementById('modern-scroll-minutes');
  if (hs) hs.scrollTo({ top: (2 * 24 + hour) * DRUM_ITEM_HEIGHT, behavior: 'smooth' });
  if (ms) ms.scrollTo({ top: (2 * 60 + minute) * DRUM_ITEM_HEIGHT, behavior: 'smooth' });
}
windowObj.selectModernTimePreset = selectModernTimePreset;

function updateModernTimePresetActiveState() {
  const morning = document.getElementById('preset-morning');
  const evening = document.getElementById('preset-evening');
  const night = document.getElementById('preset-night');
  if (morning) morning.classList.toggle('active', _modernTimePickerHour === 9 && _modernTimePickerMinute === 0);
  if (evening) evening.classList.toggle('active', _modernTimePickerHour === 20 && _modernTimePickerMinute === 0);
  if (night) night.classList.toggle('active', _modernTimePickerHour === 22 && _modernTimePickerMinute === 30);
}

function populateModernTimeWheels() {
  const hoursScroll = document.getElementById('modern-scroll-hours');
  const minutesScroll = document.getElementById('modern-scroll-minutes');

  if (hoursScroll && hoursScroll.children.length === 0) {
    for (let c = 0; c < DRUM_CYCLES; c++) {
      for (let i = 0; i <= 23; i++) {
        const item = document.createElement('div');
        item.className = 'modern-wheel-item';
        item.dataset.val = i;
        item.textContent = String(i).padStart(2, '0');
        const targetScroll = (c * 24 + i) * DRUM_ITEM_HEIGHT;
        item.onclick = () => {
          hoursScroll.scrollTo({ top: targetScroll, behavior: 'smooth' });
        };
        hoursScroll.appendChild(item);
      }
    }
  }

  if (minutesScroll && minutesScroll.children.length === 0) {
    for (let c = 0; c < DRUM_CYCLES; c++) {
      for (let i = 0; i <= 59; i++) {
        const item = document.createElement('div');
        item.className = 'modern-wheel-item';
        item.dataset.val = i;
        item.textContent = String(i).padStart(2, '0');
        const targetScroll = (c * 60 + i) * DRUM_ITEM_HEIGHT;
        item.onclick = () => {
          minutesScroll.scrollTo({ top: targetScroll, behavior: 'smooth' });
        };
        minutesScroll.appendChild(item);
      }
    }
  }
}

function setupModernTimeWheelScrollListeners() {
  if (_modernTimeWheelsInitialized) return;

  const setupWheel = (scrollId) => {
    const scrollEl = document.getElementById(scrollId);
    if (!scrollEl) return;

    const itemsPerCycle = scrollId === 'modern-scroll-hours' ? 24 : 60;
    const cycleHeight = itemsPerCycle * DRUM_ITEM_HEIGHT;
    let isAdjusting = false;

    const updateSelection = () => {
      if (isAdjusting) return;
      const scrollTop = scrollEl.scrollTop;

      // Seamless infinite looping boundary check
      if (scrollTop < cycleHeight * 0.8) {
        isAdjusting = true;
        scrollEl.scrollTop += cycleHeight * 2;
        isAdjusting = false;
        return;
      } else if (scrollTop > cycleHeight * 3.2) {
        isAdjusting = true;
        scrollEl.scrollTop -= cycleHeight * 2;
        isAdjusting = false;
        return;
      }

      const totalIdx = Math.round(scrollTop / DRUM_ITEM_HEIGHT);
      const selectedVal = ((totalIdx % itemsPerCycle) + itemsPerCycle) % itemsPerCycle;
      const items = scrollEl.querySelectorAll('.modern-wheel-item');
      items.forEach((item, idx) => {
        if (idx === totalIdx) {
          item.classList.add('selected');
        } else {
          item.classList.remove('selected');
        }
      });

      if (scrollId === 'modern-scroll-hours') {
        _modernTimePickerHour = selectedVal;
      } else if (scrollId === 'modern-scroll-minutes') {
        _modernTimePickerMinute = selectedVal;
      }
      updateModernTimePresetActiveState();
    };

    scrollEl.addEventListener('scroll', updateSelection, { passive: true });
    updateSelection();
  };

  setupWheel('modern-scroll-hours');
  setupWheel('modern-scroll-minutes');
  _modernTimeWheelsInitialized = true;
}

function openModernTimePicker(initialTime, onConfirmCallback) {
  _modernTimePickerCallback = onConfirmCallback;

  if (initialTime && typeof initialTime === 'string' && initialTime.includes(':')) {
    const parts = initialTime.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    _modernTimePickerHour = (!isNaN(h) && h >= 0 && h <= 23) ? h : 21;
    _modernTimePickerMinute = (!isNaN(m) && m >= 0 && m <= 59) ? m : 0;
  } else {
    _modernTimePickerHour = 21;
    _modernTimePickerMinute = 0;
  }

  // Update translated labels
  const titleEl = document.querySelector('#modern-time-picker-modal [data-i18n="time_picker_title"]');
  const morningLabel = document.querySelector('#preset-morning [data-i18n="time_preset_morning"]');
  const eveningLabel = document.querySelector('#preset-evening [data-i18n="time_preset_evening"]');
  const nightLabel = document.querySelector('#preset-night [data-i18n="time_preset_night"]');
  const setBtnEl = document.querySelector('#modern-time-picker-modal [data-i18n="btn_set_time"]');

  if (typeof t === 'function') {
    if (titleEl) titleEl.textContent = t('time_picker_title');
    if (morningLabel) morningLabel.textContent = t('time_preset_morning');
    if (eveningLabel) eveningLabel.textContent = t('time_preset_evening');
    if (nightLabel) nightLabel.textContent = t('time_preset_night');
    if (setBtnEl) setBtnEl.textContent = t('btn_set_time');
  }

  populateModernTimeWheels();
  setupModernTimeWheelScrollListeners();
  updateModernTimePresetActiveState();

  const modal = document.getElementById('modern-time-picker-modal');
  if (modal) {
    modal.classList.add('active');
  }

  setTimeout(() => {
    const hs = document.getElementById('modern-scroll-hours');
    const ms = document.getElementById('modern-scroll-minutes');
    if (hs) hs.scrollTop = (2 * 24 + _modernTimePickerHour) * DRUM_ITEM_HEIGHT;
    if (ms) ms.scrollTop = (2 * 60 + _modernTimePickerMinute) * DRUM_ITEM_HEIGHT;
  }, 60);
}
windowObj.openModernTimePicker = openModernTimePicker;

function closeModernTimePicker() {
  const modal = document.getElementById('modern-time-picker-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}
windowObj.closeModernTimePicker = closeModernTimePicker;

function handleModernTimePickerOverlayClick(e) {
  if (e.target.id === 'modern-time-picker-modal') {
    closeModernTimePicker();
  }
}
windowObj.handleModernTimePickerOverlayClick = handleModernTimePickerOverlayClick;

function confirmModernTimePicker() {
  const h = _modernTimePickerHour;
  const m = _modernTimePickerMinute;
  const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (typeof _modernTimePickerCallback === 'function') {
    _modernTimePickerCallback(formatted);
  }
  closeModernTimePicker();
}
windowObj.confirmModernTimePicker = confirmModernTimePicker;

function openModernTimePickerForDailyReminder() {
  const currentVal = localStorage.getItem('settings_daily_reminder_time') || '21:00';
  openModernTimePicker(currentVal, (newTime) => {
    const displayEl = document.getElementById('settings-daily-reminder-time-display');
    if (displayEl) displayEl.textContent = newTime;
    if (typeof saveDailyReminderTime === 'function') {
      saveDailyReminderTime(newTime);
    }
  });
}
windowObj.openModernTimePickerForDailyReminder = openModernTimePickerForDailyReminder;

  // CommonJS / Node exports for testing
  return {
    parseTimeString,
    formatTimeString,
    getTimePresetForTime,
    selectModernTimePreset,
    updateModernTimePresetActiveState,
    populateModernTimeWheels,
    setupModernTimeWheelScrollListeners,
    openModernTimePicker,
    closeModernTimePicker,
    handleModernTimePickerOverlayClick,
    confirmModernTimePicker,
    openModernTimePickerForDailyReminder,
    get DRUM_CYCLES() { return DRUM_CYCLES; },
    get DRUM_ITEM_HEIGHT() { return DRUM_ITEM_HEIGHT; }
  };
});
