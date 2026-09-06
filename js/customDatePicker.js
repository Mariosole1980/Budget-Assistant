/**
 * Budget Assistant - Custom Date & Time Picker Subsystem
 * Custom Modal Calendar, Dual Wheels / Manual Time Input, Month & Year Pickers
 * Extracted from app.js (Phase 14D Modularization)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    Object.assign(root, exports);
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const _EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const _EL_MONTHS = ['Ιαν','Φεβ','Μαρ','Απρ','Μαϊ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];

  function shiftCustomDatePickerBSYears(delta) {
    const grid = document.getElementById('custom-date-picker-bs-years-view');
    if (grid) {
      grid.scrollTop += delta * 40;
    }
  }

function initYearSwipeGestures() {
  const customGrid = document.getElementById('custom-date-picker-bs-years-view');
  if (customGrid) {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    customGrid.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
      }
    }, { passive: true });

    customGrid.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - startX;
        const deltaY = e.changedTouches[0].clientY - startY;
        const duration = Date.now() - startTime;
        if (duration < 400 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && Math.abs(deltaX) > 40) {
          if (deltaX < 0) {
            shiftCustomDatePickerBSYears(6);
          } else {
            shiftCustomDatePickerBSYears(-6);
          }
        }
      }
    }, { passive: true });
  }

  const monthGrid = document.getElementById('month-picker-bs-years-view');
  if (monthGrid) {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    monthGrid.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
      }
    }, { passive: true });

    monthGrid.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - startX;
        const deltaY = e.changedTouches[0].clientY - startY;
        const duration = Date.now() - startTime;
        if (duration < 400 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && Math.abs(deltaX) > 40) {
          if (deltaX < 0) {
            shiftMonthPickerBSYears(6);
          } else {
            shiftMonthPickerBSYears(-6);
          }
        }
      }
    }, { passive: true });
  }
}

let _customDatePickerTargetInput = 'trans-date';

function openCustomDatePicker(targetInputId = 'trans-date') {
  if (!window._calendarSwipeGesturesInitialized) {
    initCalendarSwipeGestures();
    initYearSwipeGestures();
    window._calendarSwipeGesturesInitialized = true;
  }
  if (window.autocompleteJustSelected) return;

  if (targetInputId === 'trans-date') {
    const form = document.getElementById('transaction-form');
    if (form && form.getAttribute('data-readonly') === 'true') return;
  }

  _customDatePickerTargetInput = targetInputId;
  ensureHistoryPushed();

  const datePickerModal = document.getElementById('custom-date-picker-modal');
  if (datePickerModal) {
    const txModal = document.getElementById('transaction-modal');
    let currentType = 'expense';
    if (txModal && txModal.classList.contains('active')) {
      if (txModal.classList.contains('income') || (typeof state !== 'undefined' && state.activeTab === 'income')) {
        currentType = 'income';
      } else if (txModal.classList.contains('transfer') || (typeof state !== 'undefined' && state.activeTab === 'transfer')) {
        currentType = 'transfer';
      } else {
        currentType = 'expense';
      }
    } else if (typeof state !== 'undefined' && state.activeTab) {
      currentType = state.activeTab;
    }

    if (currentType === 'expense') {
      datePickerModal.style.setProperty('--picker-accent', 'var(--red-negative, #ef4444)');
      datePickerModal.style.setProperty('--picker-btn-bg', 'linear-gradient(135deg, #ef4444, #dc2626)');
      datePickerModal.style.setProperty('--picker-btn-shadow', 'rgba(239, 68, 68, 0.35)');
    } else if (currentType === 'income') {
      datePickerModal.style.setProperty('--picker-accent', 'var(--blue-positive, #10b981)');
      datePickerModal.style.setProperty('--picker-btn-bg', 'linear-gradient(135deg, #10b981, #059669)');
      datePickerModal.style.setProperty('--picker-btn-shadow', 'rgba(16, 185, 129, 0.35)');
    } else if (currentType === 'transfer') {
      datePickerModal.style.setProperty('--picker-accent', 'var(--accent, #3b82f6)');
      datePickerModal.style.setProperty('--picker-btn-bg', 'linear-gradient(135deg, #3b82f6, #2563eb)');
      datePickerModal.style.setProperty('--picker-btn-shadow', 'rgba(59, 130, 246, 0.35)');
    } else {
      datePickerModal.style.setProperty('--picker-accent', 'var(--accent, #38bdf8)');
      datePickerModal.style.setProperty('--picker-btn-bg', 'linear-gradient(135deg, #38bdf8, #0284c7)');
      datePickerModal.style.setProperty('--picker-btn-shadow', 'rgba(56, 189, 248, 0.35)');
    }
  }

  // Close any active inline popups on open
  closeCustomDatePickerBS();

  const timeContainer = document.getElementById('custom-date-picker-time-container');
  if (timeContainer) {
    if (targetInputId === 'trans-date' || targetInputId === 'note-editor-reminder-input') {
      timeContainer.style.display = 'flex';
    } else {
      timeContainer.style.display = 'none';
    }
  }

  const dateInput = document.getElementById(targetInputId);
  let currentDate = new Date();
  if (dateInput && dateInput.value) {
    if (dateInput.value.includes('T')) {
      const parts = dateInput.value.split('T');
      if (parts.length === 2) {
        const dateParts = parts[0].split('-');
        const timeParts = parts[1].split(':');
        if (dateParts.length === 3 && timeParts.length >= 2) {
          currentDate = new Date(
            parseInt(dateParts[0], 10),
            parseInt(dateParts[1], 10) - 1,
            parseInt(dateParts[2], 10),
            parseInt(timeParts[0], 10),
            parseInt(timeParts[1], 10)
          );
        }
      }
    } else {
      const dateParts = dateInput.value.split('-');
      if (dateParts.length === 3) {
        currentDate = new Date(
          parseInt(dateParts[0], 10),
          parseInt(dateParts[1], 10) - 1,
          parseInt(dateParts[2], 10)
        );
      } else {
        const parsed = new Date(dateInput.value);
        if (!isNaN(parsed.getTime())) {
          currentDate = parsed;
        }
      }
    }
  }

  customDatePickerSelectedDate = new Date(currentDate);
  customDatePickerViewingMonth = new Date(currentDate);

  // Populate scroll wheels if empty (5 repeat cycles for infinite circular scrolling)
  const hoursScroll = document.getElementById('scroll-hours');
  if (hoursScroll && hoursScroll.children.length === 0) {
    for (let c = 0; c < 5; c++) {
      for (let i = 0; i < 24; i++) {
        const div = document.createElement('div');
        div.className = 'time-wheel-item';
        div.textContent = String(i).padStart(2, '0');
        const targetScroll = (c * 24 + i) * 60;
        div.onclick = () => {
          hoursScroll.scrollTop = targetScroll;
        };
        hoursScroll.appendChild(div);
      }
    }
  }

  const minutesScroll = document.getElementById('scroll-minutes');
  if (minutesScroll && minutesScroll.children.length === 0) {
    for (let c = 0; c < 5; c++) {
      for (let i = 0; i < 60; i++) {
        const div = document.createElement('div');
        div.className = 'time-wheel-item';
        div.textContent = String(i).padStart(2, '0');
        const targetScroll = (c * 60 + i) * 60;
        div.onclick = () => {
          minutesScroll.scrollTop = targetScroll;
        };
        minutesScroll.appendChild(div);
      }
    }
  }

  // Setup listeners
  setupTimeWheelScrollListeners();
  initTimeInputListeners();

  const wheelsRow = document.getElementById('custom-date-picker-time-wheels-row');
  const inputsRow = document.getElementById('custom-date-picker-time-inputs');
  const toggleBtn = document.getElementById('toggle-time-input-mode');
  if (wheelsRow) wheelsRow.style.display = 'flex';
  if (inputsRow) inputsRow.style.display = 'none';
  if (toggleBtn) {
    toggleBtn.innerHTML = '<i class="fa-regular fa-keyboard"></i>';
    toggleBtn.setAttribute('aria-label', 'Switch to Keyboard Mode');
  }

  renderCustomDatePickerCalendar();

  // Open the modal
  openModal('custom-date-picker-modal');

  // Set input values and scroll wheels to correct initial values
  setTimeout(() => {
    const hs = document.getElementById('scroll-hours');
    if (hs) {
      hs.scrollTop = (2 * 24 + currentDate.getHours()) * 60;
    }
    const ms = document.getElementById('scroll-minutes');
    if (ms) {
      ms.scrollTop = (2 * 60 + currentDate.getMinutes()) * 60;
    }

    const inputHours = document.getElementById('custom-time-input-hours');
    if (inputHours) {
      inputHours.value = String(currentDate.getHours()).padStart(2, '0');
      inputHours.dataset.fresh = 'true';
    }
    const inputMinutes = document.getElementById('custom-time-input-minutes');
    if (inputMinutes) {
      inputMinutes.value = String(currentDate.getMinutes()).padStart(2, '0');
      inputMinutes.dataset.fresh = 'true';
    }
  }, 60);
}

// Custom Date Picker State Variables
let customDatePickerSelectedDate = new Date();
let customDatePickerViewingMonth = new Date();
let timeWheelsInitialized = false;

function setupTimeWheelScrollListeners() {
  if (timeWheelsInitialized) return;

  const setupWheel = (scrollId) => {
    const scrollEl = document.getElementById(scrollId);
    if (!scrollEl) return;

    const itemsPerCycle = scrollId === 'scroll-hours' ? 24 : 60;
    const cycleHeight = itemsPerCycle * 60;
    let isAdjusting = false;

    const updateSelection = () => {
      if (isAdjusting) return;
      const scrollTop = scrollEl.scrollTop;

      // Infinite loop boundary jump
      if (scrollTop < cycleHeight * 0.8) {
        isAdjusting = true;
        scrollEl.scrollTop += cycleHeight * 2;
        (typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb) => setTimeout(cb, 16))(() => { isAdjusting = false; });
        return;
      } else if (scrollTop > cycleHeight * 3.2) {
        isAdjusting = true;
        scrollEl.scrollTop -= cycleHeight * 2;
        (typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb) => setTimeout(cb, 16))(() => { isAdjusting = false; });
        return;
      }

      const totalIdx = Math.round(scrollTop / 60);
      const selectedVal = ((totalIdx % itemsPerCycle) + itemsPerCycle) % itemsPerCycle;
      const items = scrollEl.querySelectorAll('.time-wheel-item');
      items.forEach((item, idx) => {
        if (idx === totalIdx) {
          item.classList.add('selected');
        } else {
          item.classList.remove('selected');
        }
      });

      if (scrollId === 'scroll-hours') {
        const inputHours = document.getElementById('custom-time-input-hours');
        if (inputHours && document.activeElement !== inputHours) {
          inputHours.value = String(selectedVal).padStart(2, '0');
        }
      } else if (scrollId === 'scroll-minutes') {
        const inputMinutes = document.getElementById('custom-time-input-minutes');
        if (inputMinutes && document.activeElement !== inputMinutes) {
          inputMinutes.value = String(selectedVal).padStart(2, '0');
        }
      }
    };

    scrollEl.addEventListener('scroll', updateSelection, { passive: true });
    updateSelection();
  };

  setupWheel('scroll-hours');
  setupWheel('scroll-minutes');
  timeWheelsInitialized = true;
}

function setCustomDatePickerNowTime() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const inputHours = document.getElementById('custom-time-input-hours');
  const inputMinutes = document.getElementById('custom-time-input-minutes');
  if (inputHours) inputHours.value = String(h).padStart(2, '0');
  if (inputMinutes) inputMinutes.value = String(m).padStart(2, '0');
  const hs = document.getElementById('scroll-hours');
  const ms = document.getElementById('scroll-minutes');
  if (hs) hs.scrollTop = (2 * 24 + h) * 60;
  if (ms) ms.scrollTop = (2 * 60 + m) * 60;
}
window.setCustomDatePickerNowTime = setCustomDatePickerNowTime;

let timeInputsInitialized = false;
function initTimeInputListeners() {
  if (timeInputsInitialized) return;

  const inputHours = document.getElementById('custom-time-input-hours');
  const inputMinutes = document.getElementById('custom-time-input-minutes');

  if (!inputHours || !inputMinutes) return;

  inputHours.addEventListener('focus', (e) => {
    e.target.dataset.fresh = 'true';
  });

  inputMinutes.addEventListener('focus', (e) => {
    e.target.dataset.fresh = 'true';
  });

  inputHours.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (e.target.dataset.fresh === 'true' && val.length > 0) {
      val = val.slice(-1);
      e.target.dataset.fresh = 'false';
    }
    if (val.length > 2) val = val.slice(0, 2);
    let num = parseInt(val, 10);
    if (!isNaN(num)) {
      if (num > 23) {
        val = '23';
        num = 23;
      }
      const hs = document.getElementById('scroll-hours');
      if (hs) hs.scrollTop = (2 * 24 + num) * 60;
    }
    e.target.value = val;

    // Auto-focus minutes input when 2 digits are entered or first digit is > 2 (e.g. 3..9)
    if (val.length === 2 || (val.length === 1 && parseInt(val, 10) > 2)) {
      inputMinutes.focus();
      inputMinutes.dataset.fresh = 'true';
    }
  });

  inputMinutes.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (e.target.dataset.fresh === 'true' && val.length > 0) {
      val = val.slice(-1);
      e.target.dataset.fresh = 'false';
    }
    if (val.length > 2) val = val.slice(0, 2);
    let num = parseInt(val, 10);
    if (!isNaN(num)) {
      if (num > 59) {
        val = '59';
        num = 59;
      }
      const ms = document.getElementById('scroll-minutes');
      if (ms) ms.scrollTop = (2 * 60 + num) * 60;
    }
    e.target.value = val;
  });

  inputHours.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setCustomDatePickerValue();
    }
  });

  inputMinutes.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setCustomDatePickerValue();
    } else if (e.key === 'Backspace' && e.target.value === '') {
      inputHours.focus();
      inputHours.dataset.fresh = 'true';
    }
  });

  inputHours.addEventListener('blur', (e) => {
    let val = e.target.value;
    if (val !== '') {
      e.target.value = String(parseInt(val, 10) || 0).padStart(2, '0');
    } else {
      e.target.value = '00';
    }
  });

  inputMinutes.addEventListener('blur', (e) => {
    let val = e.target.value;
    if (val !== '') {
      e.target.value = String(parseInt(val, 10) || 0).padStart(2, '0');
    } else {
      e.target.value = '00';
    }
  });

  timeInputsInitialized = true;
}



function renderCustomDatePickerCalendar() {
  const grid = document.getElementById('custom-date-picker-days-grid');
  const largeLabel = document.getElementById('custom-date-picker-month-large-label');
  if (!grid) return;

  const year = customDatePickerViewingMonth.getFullYear();
  const month = customDatePickerViewingMonth.getMonth();

  // Update Large Month Title
  const yearLabel = document.getElementById('custom-date-picker-year-large-label');
  if (largeLabel) {
    largeLabel.textContent = getMonthName(month, true).toUpperCase();
  }
  if (yearLabel) {
    yearLabel.textContent = year;
  }

  grid.innerHTML = '';

  // Get first day of the month and its weekday (0 = Mon, 6 = Sun)
  const firstDay = new Date(year, month, 1);
  let firstDayIndex = firstDay.getDay(); // 0 = Sun, 1 = Mon ...
  firstDayIndex = (firstDayIndex + 6) % 7; // Convert to Mon=0, Sun=6

  // Get total days in month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Get total days in previous month for padding
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  // Render previous month's padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calendar-day-btn other-month';
    btn.textContent = dayNum;
    grid.appendChild(btn);
  }

  // Render current month's days
  const today = new Date();
  for (let d = 1; d <= totalDays; d++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calendar-day-btn';
    btn.textContent = d;

    // Check if selected
    if (d === customDatePickerSelectedDate.getDate() &&
      month === customDatePickerSelectedDate.getMonth() &&
      year === customDatePickerSelectedDate.getFullYear()) {
      btn.classList.add('active');
    }

    // Check if today
    if (d === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()) {
      btn.classList.add('today');
    }

    // Add click handler to select this day
    btn.addEventListener('click', () => {
      // Create a fresh Date object to avoid the classic JS setMonth() rollover bug.
      // Mutating with setFullYear()/setMonth()/setDate() in sequence can roll over
      // when the current day (e.g. 31) exceeds the target month's day count,
      // producing the wrong date (e.g. selecting Feb 15 yields Mar 15).
      customDatePickerSelectedDate = new Date(
        year,
        month,
        d,
        customDatePickerSelectedDate.getHours(),
        customDatePickerSelectedDate.getMinutes()
      );
      renderCustomDatePickerCalendar();
    });

    grid.appendChild(btn);
  }

  // Render next month's padding days to complete grid (multiples of 7)
  const totalRendered = firstDayIndex + totalDays;
  const remaining = (7 - (totalRendered % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calendar-day-btn other-month';
    btn.textContent = i;
    grid.appendChild(btn);
  }
}

// Replaced by unified calendar refactor

window.adjustCustomDatePickerMonth = adjustCustomDatePickerMonth;

function openCustomDatePickerBS(forceYearView = false) {
  const bs = document.getElementById('custom-date-picker-bs');
  if (bs) {
    bs.style.display = 'flex';
    setTimeout(() => bs.classList.add('active'), 10);
    // Set active year label
    const yearLabel = document.getElementById('custom-date-picker-bs-year-label');
    if (yearLabel) yearLabel.textContent = customDatePickerViewingMonth.getFullYear();

    // Toggle view based on parameter
    toggleCustomDatePickerBSYearView(forceYearView);
    renderCustomDatePickerBSGrids('month');
    renderCustomDatePickerBSGrids('year');
  }
}

function closeCustomDatePickerBS() {
  const bs = document.getElementById('custom-date-picker-bs');
  if (bs) {
    bs.classList.remove('active');
    setTimeout(() => bs.style.display = 'none', 300);
  }
}

function toggleCustomDatePickerBSYearView(forceYearView) {
  const monthsView = document.getElementById('custom-date-picker-bs-months-view');
  const yearsView = document.getElementById('custom-date-picker-bs-years-view');
  const chevron = document.getElementById('custom-date-picker-bs-year-chevron');
  const labelSpan = document.getElementById('custom-date-picker-bs-year-label');
  if (!monthsView || !yearsView) return;

  let showYears = false;
  if (typeof forceYearView === 'boolean') {
    showYears = forceYearView;
  } else {
    showYears = yearsView.style.display === 'none';
  }

  if (showYears) {
    monthsView.style.display = 'none';
    yearsView.style.display = 'grid';
    if (chevron) chevron.style.display = 'none';
    if (labelSpan) {
      labelSpan.textContent = state.lang === 'en' ? 'Select Year' : 'Επιλογή Έτους';
    }
    renderCustomDatePickerBSGrids('year');
  } else {
    monthsView.style.display = 'grid';
    yearsView.style.display = 'none';
    if (chevron) {
      chevron.style.display = 'inline-block';
      chevron.style.transform = 'rotate(0deg)';
    }
    if (labelSpan) {
      labelSpan.textContent = customDatePickerViewingMonth.getFullYear();
    }
  }
}

function renderCustomDatePickerBSGrids(type) {
  if (type === 'month') {
    const grid = document.getElementById('custom-date-picker-bs-months-view');
    if (!grid) return;
    grid.innerHTML = '';
    const currentMonth = customDatePickerViewingMonth.getMonth() + 1; // 1-12
    const monthNames = state.lang === 'en' ? ENGLISH_MONTHS_SHORT : GREEK_MONTHS_SHORT;

    for (let m = 1; m <= 12; m++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'google-picker-btn';
      btn.textContent = monthNames[m - 1];
      if (m === currentMonth) {
        btn.classList.add('active');
      }
      btn.onclick = (e) => {
        e.stopPropagation();
        const curDay = customDatePickerSelectedDate ? customDatePickerSelectedDate.getDate() : 1;
        const curYear = customDatePickerViewingMonth.getFullYear();
        const daysInMonth = new Date(curYear, m, 0).getDate();
        const safeDay = Math.min(curDay, daysInMonth);
        customDatePickerViewingMonth = new Date(curYear, m - 1, safeDay);
        customDatePickerSelectedDate = new Date(curYear, m - 1, safeDay);
        renderCustomDatePickerCalendar();
        closeCustomDatePickerBS();
      };
      grid.appendChild(btn);
    }
  } else if (type === 'year') {
    const grid = document.getElementById('custom-date-picker-bs-years-view');
    if (!grid) return;
    grid.innerHTML = '';

    const currentYear = customDatePickerViewingMonth.getFullYear();
    const systemYear = new Date().getFullYear();

    const startYear = 1970;
    const endYear = 2050;

    for (let y = startYear; y <= endYear; y++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'google-picker-btn';
      btn.textContent = y;
      if (y === currentYear) {
        btn.classList.add('active');
      } else if (y === systemYear) {
        btn.classList.add('today-year');
      }
      btn.onclick = (e) => {
        e.stopPropagation();
        const curDay = customDatePickerSelectedDate ? customDatePickerSelectedDate.getDate() : 1;
        const curMonth = customDatePickerViewingMonth.getMonth();
        const daysInMonth = new Date(y, curMonth + 1, 0).getDate();
        const safeDay = Math.min(curDay, daysInMonth);
        customDatePickerViewingMonth = new Date(y, curMonth, safeDay);
        customDatePickerSelectedDate = new Date(y, curMonth, safeDay);
        toggleCustomDatePickerBSYearView(false);
        renderCustomDatePickerBSGrids('month');
        renderCustomDatePickerCalendar();
      };
      grid.appendChild(btn);
    }

    setTimeout(() => {
      const activeBtn = grid.querySelector('.active') || grid.querySelector('.today-year');
      if (activeBtn) {
        activeBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 50);
  }
}

// Click-away listener to close inline calendar popups
document.addEventListener('click', function (e) {
  const bs = document.getElementById('custom-date-picker-bs');
  const titleBtn = document.getElementById('custom-date-picker-month-title-btn');
  if (bs && bs.classList.contains('active')) {
    if (!bs.contains(e.target) && (!titleBtn || !titleBtn.contains(e.target))) {
      closeCustomDatePickerBS();
    }
  }
});

function toggleTimeInputMode() {
  const wheelsRow = document.getElementById('custom-date-picker-time-wheels-row');
  const inputsRow = document.getElementById('custom-date-picker-time-inputs');
  const toggleBtn = document.getElementById('toggle-time-input-mode');

  if (!wheelsRow || !inputsRow) return;

  const isWheelsMode = wheelsRow.style.display !== 'none';

  if (isWheelsMode) {
    // Switch to Manual INPUT Mode
    wheelsRow.style.display = 'none';
    inputsRow.style.display = 'flex';
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i class="fa-solid fa-clock"></i>';
      toggleBtn.setAttribute('aria-label', 'Switch to Wheels Mode');
    }

    // Sync inputs with wheel values
    const hs = document.getElementById('scroll-hours');
    const ms = document.getElementById('scroll-minutes');
    let h = 0;
    let m = 0;
    if (hs) {
      const totalIdx = Math.round(hs.scrollTop / 60);
      h = ((totalIdx % 24) + 24) % 24;
    }
    if (ms) {
      const totalIdx = Math.round(ms.scrollTop / 60);
      m = ((totalIdx % 60) + 60) % 60;
    }

    const inputHours = document.getElementById('custom-time-input-hours');
    const inputMinutes = document.getElementById('custom-time-input-minutes');
    if (inputHours) {
      inputHours.value = String(h).padStart(2, '0');
      inputHours.dataset.fresh = 'true';
    }
    if (inputMinutes) {
      inputMinutes.value = String(m).padStart(2, '0');
      inputMinutes.dataset.fresh = 'true';
    }
    if (inputHours) {
      setTimeout(() => {
        inputHours.focus();
        if (typeof inputHours.select === 'function') inputHours.select();
      }, 50);
    }
  } else {
    // Switch back to WHEELS Mode
    inputsRow.style.display = 'none';
    wheelsRow.style.display = 'flex';
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i class="fa-regular fa-keyboard"></i>';
      toggleBtn.setAttribute('aria-label', 'Switch to Keyboard Mode');
    }

    const inputHours = document.getElementById('custom-time-input-hours');
    const inputMinutes = document.getElementById('custom-time-input-minutes');
    let h = inputHours ? parseInt(inputHours.value, 10) : 0;
    let m = inputMinutes ? parseInt(inputMinutes.value, 10) : 0;
    if (isNaN(h) || h < 0) h = 0;
    if (h > 23) h = 23;
    if (isNaN(m) || m < 0) m = 0;
    if (m > 59) m = 59;

    const hs = document.getElementById('scroll-hours');
    const ms = document.getElementById('scroll-minutes');
    if (hs) hs.scrollTop = (2 * 24 + h) * 60;
    if (ms) ms.scrollTop = (2 * 60 + m) * 60;
  }
}
window.toggleTimeInputMode = toggleTimeInputMode;

window.openCustomDatePickerBS = openCustomDatePickerBS;
window.closeCustomDatePickerBS = closeCustomDatePickerBS;
window.toggleCustomDatePickerBSYearView = toggleCustomDatePickerBSYearView;

function setCustomDatePickerValue() {
  const inputHours = document.getElementById('custom-time-input-hours');
  const inputMinutes = document.getElementById('custom-time-input-minutes');
  const wheelsRow = document.getElementById('custom-date-picker-time-wheels-row');
  const hs = document.getElementById('scroll-hours');
  const ms = document.getElementById('scroll-minutes');

  let hours = 0;
  let minutes = 0;

  const isWheelsMode = wheelsRow && wheelsRow.style.display !== 'none';

  if (isWheelsMode && hs && ms) {
    const totalH = Math.round(hs.scrollTop / 60);
    hours = ((totalH % 24) + 24) % 24;
    const totalM = Math.round(ms.scrollTop / 60);
    minutes = ((totalM % 60) + 60) % 60;
  } else {
    if (inputHours) {
      hours = parseInt(inputHours.value, 10);
      if (isNaN(hours) || hours < 0) hours = 0;
      if (hours > 23) hours = 23;
    }
    if (inputMinutes) {
      minutes = parseInt(inputMinutes.value, 10);
      if (isNaN(minutes) || minutes < 0) minutes = 0;
      if (minutes > 59) minutes = 59;
    }
  }

  customDatePickerSelectedDate.setHours(hours);
  customDatePickerSelectedDate.setMinutes(minutes);

  const yyyy = customDatePickerSelectedDate.getFullYear();
  const mm = String(customDatePickerSelectedDate.getMonth() + 1).padStart(2, '0');
  const dd = String(customDatePickerSelectedDate.getDate()).padStart(2, '0');

  const targetId = _customDatePickerTargetInput || 'trans-date';
  const dateInput = document.getElementById(targetId);
  if (dateInput) {
    if (targetId === 'trans-date' || targetId === 'note-editor-reminder-input') {
      const hh = String(customDatePickerSelectedDate.getHours()).padStart(2, '0');
      const min = String(customDatePickerSelectedDate.getMinutes()).padStart(2, '0');
      dateInput.value = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
      if (targetId === 'note-editor-reminder-input' && typeof updateNoteEditorReminderDisplay === 'function') {
        updateNoteEditorReminderDisplay();
      }
    } else {
      dateInput.value = `${yyyy}-${mm}-${dd}`;
      const label = document.getElementById(`${targetId}-label`);
      if (label) {
        label.textContent = `${dd}/${mm}/${yyyy}`;
      }
      if (targetId === 'recurring-end-date') {
        _pendingRecurringSettings.endDate = `${yyyy}-${mm}-${dd}`;
        _pendingRecurringSettings.endType = 'date';
        updateRecurringSummary();
      } else if (targetId === 'recurring-edit-end') {
        updateRecurringEditSummary();
      } else if (targetId === 'recurring-edit-start') {
        updateRecurringEditSummary();
      }
    }
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  closeModal('custom-date-picker-modal');
}

window.setCustomDatePickerValue = setCustomDatePickerValue;

// CUSTOM CALENDAR & DATE-TIME PICKER UNIFIED REFACTOR
// ============================================================

function adjustCustomDatePickerMonth(direction) {
  const currentDay = customDatePickerSelectedDate ? customDatePickerSelectedDate.getDate() : 1;
  const targetYear = customDatePickerViewingMonth.getFullYear();
  const targetMonth = customDatePickerViewingMonth.getMonth() + direction;

  const tempDate = new Date(targetYear, targetMonth, 1);
  const daysInTargetMonth = new Date(tempDate.getFullYear(), tempDate.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(currentDay, daysInTargetMonth);

  customDatePickerViewingMonth = new Date(tempDate.getFullYear(), tempDate.getMonth(), safeDay);
  customDatePickerSelectedDate = new Date(tempDate.getFullYear(), tempDate.getMonth(), safeDay);

  renderCustomDatePickerCalendar();
}
window.adjustCustomDatePickerMonth = adjustCustomDatePickerMonth;

function initCalendarSwipeGestures() {
  const container = document.getElementById('custom-date-picker-calendar-view');
  if (!container) return;

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    }
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    // Prevent outer app swipe-back gestures while dragging inside calendar grid
    e.stopPropagation();
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - startX;
      const deltaY = e.changedTouches[0].clientY - startY;
      const duration = Date.now() - startTime;

      if (duration < 400 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && Math.abs(deltaX) > 40) {
        if (deltaX < 0) {
          adjustCustomDatePickerMonth(1);
        } else {
          adjustCustomDatePickerMonth(-1);
        }
      }
    }
  }, { passive: true });
}

function enableDirectTimeTapToEdit() {
  const hoursWheel = document.getElementById('scroll-hours');
  const minutesWheel = document.getElementById('scroll-minutes');
  const wheelsRow = document.getElementById('custom-date-picker-time-wheels-row');
  const inputsRow = document.getElementById('custom-date-picker-time-inputs');
  const inputHours = document.getElementById('custom-time-input-hours');
  const inputMinutes = document.getElementById('custom-time-input-minutes');

  if (!wheelsRow || !inputsRow) return;

  const switchToManualAndFocus = (targetInput) => {
    // Sync values from wheels before switching
    if (hoursWheel && inputHours) {
      const h = Math.round(hoursWheel.scrollTop / 60);
      inputHours.value = String(Math.max(0, Math.min(23, h))).padStart(2, '0');
    }
    if (minutesWheel && inputMinutes) {
      const m = Math.round(minutesWheel.scrollTop / 60);
      inputMinutes.value = String(Math.max(0, Math.min(59, m))).padStart(2, '0');
    }

    wheelsRow.style.display = 'none';
    inputsRow.style.display = 'flex';

    if (targetInput) {
      setTimeout(() => {
        targetInput.focus();
        if (typeof targetInput.select === 'function') targetInput.select();
      }, 50);
    }
  };

  if (hoursWheel && !hoursWheel._tapBound) {
    hoursWheel._tapBound = true;
    hoursWheel.style.cursor = 'pointer';
    hoursWheel.addEventListener('click', () => switchToManualAndFocus(inputHours));
  }

  if (minutesWheel && !minutesWheel._tapBound) {
    minutesWheel._tapBound = true;
    minutesWheel.style.cursor = 'pointer';
    minutesWheel.addEventListener('click', () => switchToManualAndFocus(inputMinutes));
  }
}
window.enableDirectTimeTapToEdit = enableDirectTimeTapToEdit;

function syncTimeInputsBackToWheels() {
  const wheelsRow = document.getElementById('custom-date-picker-time-wheels-row');
  const inputsRow = document.getElementById('custom-date-picker-time-inputs');
  const inputHours = document.getElementById('custom-time-input-hours');
  const inputMinutes = document.getElementById('custom-time-input-minutes');
  const hoursWheel = document.getElementById('scroll-hours');
  const minutesWheel = document.getElementById('scroll-minutes');

  if (!inputHours || !inputMinutes) return;

  let h = parseInt(inputHours.value, 10);
  let m = parseInt(inputMinutes.value, 10);

  if (isNaN(h) || h < 0) h = 0;
  if (h > 23) h = 23;
  if (isNaN(m) || m < 0) m = 0;
  if (m > 59) m = 59;

  inputHours.value = String(h).padStart(2, '0');
  inputMinutes.value = String(m).padStart(2, '0');

  if (hoursWheel) hoursWheel.scrollTop = h * 60;
  if (minutesWheel) minutesWheel.scrollTop = m * 60;
}
window.syncTimeInputsBackToWheels = syncTimeInputsBackToWheels;

  if (typeof window !== 'undefined') {
    window.openCustomDatePicker = openCustomDatePicker;
    window.openCustomDatePickerBS = openCustomDatePickerBS;
    window.closeCustomDatePickerBS = closeCustomDatePickerBS;
    window.toggleCustomDatePickerBSYearView = toggleCustomDatePickerBSYearView;
    window.renderCustomDatePickerBSGrids = renderCustomDatePickerBSGrids;
    window.renderCustomDatePickerCalendar = renderCustomDatePickerCalendar;
    window.setCustomDatePickerValue = setCustomDatePickerValue;
    window.setCustomDatePickerNowTime = setCustomDatePickerNowTime;
    window.toggleTimeInputMode = toggleTimeInputMode;
    window.adjustCustomDatePickerMonth = adjustCustomDatePickerMonth;
    window.initCalendarSwipeGestures = initCalendarSwipeGestures;
    window.initYearSwipeGestures = initYearSwipeGestures;
    window.enableDirectTimeTapToEdit = enableDirectTimeTapToEdit;
    window.syncTimeInputsBackToWheels = syncTimeInputsBackToWheels;
    window.shiftCustomDatePickerBSYears = shiftCustomDatePickerBSYears;
  }

  return {
    openCustomDatePicker: openCustomDatePicker,
    openCustomDatePickerBS: openCustomDatePickerBS,
    closeCustomDatePickerBS: closeCustomDatePickerBS,
    toggleCustomDatePickerBSYearView: toggleCustomDatePickerBSYearView,
    renderCustomDatePickerBSGrids: renderCustomDatePickerBSGrids,
    renderCustomDatePickerCalendar: renderCustomDatePickerCalendar,
    setCustomDatePickerValue: setCustomDatePickerValue,
    setCustomDatePickerNowTime: setCustomDatePickerNowTime,
    toggleTimeInputMode: toggleTimeInputMode,
    adjustCustomDatePickerMonth: adjustCustomDatePickerMonth,
    initCalendarSwipeGestures: initCalendarSwipeGestures,
    initYearSwipeGestures: initYearSwipeGestures,
    enableDirectTimeTapToEdit: enableDirectTimeTapToEdit,
    syncTimeInputsBackToWheels: syncTimeInputsBackToWheels,
    shiftCustomDatePickerBSYears: shiftCustomDatePickerBSYears
  };
}));
