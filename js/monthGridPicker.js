/**
 * js/monthGridPicker.js
 *
 * Modern Month Grid Picker Modal Controller.
 * Extracted from app.js (Phase 9A Architectural Domain Extraction).
 *
 * Handles month & year selection grid modal, multi-year range browsing,
 * swipe gestures integration, and date synchronization with views/stats.
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

  const DEFAULT_GREEK_MONTHS_SHORT = [
    'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'
  ];
  const DEFAULT_ENGLISH_MONTHS_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  function openMonthPicker(forceYearView = false) {
    if (!windowObj._monthPickerSwipeGesturesInitialized) {
      if (typeof initYearSwipeGestures === 'function') {
        initYearSwipeGestures();
      } else if (typeof windowObj.initYearSwipeGestures === 'function') {
        windowObj.initYearSwipeGestures();
      }
      windowObj._monthPickerSwipeGesturesInitialized = true;
    }
    var s = (typeof state !== 'undefined' && state) ? state : windowObj.state;
    if (s) {
      s.monthPickerYear = s.selectedYear;
    }
    const yearLabel = typeof document !== 'undefined' ? document.getElementById('month-picker-bs-year-label') : null;
    if (yearLabel && s) yearLabel.textContent = s.monthPickerYear;

    // Toggle view based on parameter
    toggleMonthPickerYearView(forceYearView);
    renderMonthPickerBS();

    if (typeof openModal === 'function') {
      openModal('month-picker-modal');
    } else if (typeof windowObj.openModal === 'function') {
      windowObj.openModal('month-picker-modal');
    }
  }

  function toggleMonthPickerYearView(forceYearView) {
    if (typeof document === 'undefined') return;
    const monthsView = document.getElementById('month-picker-bs-months-view');
    const yearsView = document.getElementById('month-picker-bs-years-view');
    const chevron = document.getElementById('month-picker-bs-year-chevron');
    if (!monthsView || !yearsView) return;

    var s = (typeof state !== 'undefined' && state) ? state : windowObj.state;

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
      var pickerYear = (s && s.monthPickerYear) ? s.monthPickerYear : new Date().getFullYear();
      windowObj.monthPickerBSYearStart = Math.floor((pickerYear - 2020) / 6) * 6 + 2020;
      renderMonthPickerBS();
    } else {
      monthsView.style.display = 'grid';
      yearsView.style.display = 'none';
      if (chevron) {
        chevron.style.display = 'inline-block';
        chevron.style.transform = 'rotate(0deg)';
      }
      const labelSpan = document.getElementById('month-picker-bs-year-label');
      if (labelSpan && s) {
        labelSpan.style.display = '';
        labelSpan.textContent = s.monthPickerYear;
      }
    }
  }

  function shiftMonthPickerBSYears(delta) {
    if (typeof windowObj.monthPickerBSYearStart === 'undefined' || isNaN(windowObj.monthPickerBSYearStart)) {
      var s = (typeof state !== 'undefined' && state) ? state : windowObj.state;
      var pickerYear = (s && s.monthPickerYear) ? s.monthPickerYear : new Date().getFullYear();
      windowObj.monthPickerBSYearStart = Math.floor((pickerYear - 2020) / 6) * 6 + 2020;
    }
    windowObj.monthPickerBSYearStart += delta;
    renderMonthPickerBS();
  }

  function renderMonthPickerBS() {
    if (typeof document === 'undefined') return;
    var s = (typeof state !== 'undefined' && state) ? state : windowObj.state;
    const monthsGrid = document.getElementById('month-picker-bs-months-view');
    if (monthsGrid && s) {
      monthsGrid.innerHTML = '';
      const currentMonth = s.selectedMonth; // 0-11
      const isCurrentYear = s.selectedYear === s.monthPickerYear;
      const gShort = (typeof GREEK_MONTHS_SHORT !== 'undefined' ? GREEK_MONTHS_SHORT : (windowObj.GREEK_MONTHS_SHORT || DEFAULT_GREEK_MONTHS_SHORT));
      const eShort = (typeof ENGLISH_MONTHS_SHORT !== 'undefined' ? ENGLISH_MONTHS_SHORT : (windowObj.ENGLISH_MONTHS_SHORT || DEFAULT_ENGLISH_MONTHS_SHORT));
      const monthNames = s.lang === 'en' ? eShort : gShort;

      for (let m = 0; m < 12; m++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'google-picker-btn';
        btn.textContent = monthNames[m];
        if (m === currentMonth && isCurrentYear) {
          btn.classList.add('active');
        }
        btn.onclick = () => {
          selectMonthPickerMonth(m);
        };
        monthsGrid.appendChild(btn);
      }
    }

    const yearsGrid = document.getElementById('month-picker-bs-years-view');
    if (yearsGrid && s) {
      yearsGrid.innerHTML = '';

      if (!windowObj.monthPickerBSYearStart) {
        windowObj.monthPickerBSYearStart = Math.floor((s.monthPickerYear - 2020) / 6) * 6 + 2020;
      }

      const startY = windowObj.monthPickerBSYearStart;
      const endY = startY + 5;

      const labelSpan = document.getElementById('month-picker-bs-year-label');
      if (labelSpan && yearsGrid.style.display !== 'none') {
        labelSpan.style.display = 'flex';
        labelSpan.style.alignItems = 'center';
        labelSpan.style.justifyContent = 'center';
        labelSpan.innerHTML = `
          <span style="cursor: pointer; padding: 6px 16px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" onclick="event.stopPropagation(); shiftMonthPickerBSYears(-6)">
            <i class="fa-solid fa-chevron-left" style="font-size: 14px; color: var(--accent, #e05e55);"></i>
          </span>
          <span style="margin: 0 8px; font-weight: 700; color: #ffffff; min-width: 110px; text-align: center;">${startY} - ${endY}</span>
          <span style="cursor: pointer; padding: 6px 16px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" onclick="event.stopPropagation(); shiftMonthPickerBSYears(6)">
            <i class="fa-solid fa-chevron-right" style="font-size: 14px; color: var(--accent, #e05e55);"></i>
          </span>
        `;
      }

      const systemYear = new Date().getFullYear();

      for (let y = startY; y <= endY; y++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'google-picker-btn';
        btn.textContent = y;
        if (y === s.monthPickerYear) {
          btn.classList.add('active');
        } else if (y === systemYear) {
          btn.classList.add('today-year');
        }
        btn.onclick = () => {
          s.monthPickerYear = y;
          toggleMonthPickerYearView(false);
          renderMonthPickerBS();
        };
        yearsGrid.appendChild(btn);
      }
    }
  }

  function selectMonthPickerMonth(monthIndex) {
    var s = (typeof state !== 'undefined' && state) ? state : windowObj.state;
    if (s) {
      s.selectedMonth = monthIndex;
      s.selectedYear = s.monthPickerYear;
    }

    // Sync to Stats date
    if (typeof syncStatsDate === 'function') syncStatsDate();
    else if (typeof windowObj.syncStatsDate === 'function') windowObj.syncStatsDate();

    // Update UI components
    if (typeof updateUI === 'function') updateUI();
    else if (typeof windowObj.updateUI === 'function') windowObj.updateUI();

    // Update stats tab (if active or loaded)
    if (typeof renderStatsTab === 'function') renderStatsTab();
    else if (typeof windowObj.renderStatsTab === 'function') windowObj.renderStatsTab();

    if (typeof closeModal === 'function') closeModal('month-picker-modal');
    else if (typeof windowObj.closeModal === 'function') windowObj.closeModal('month-picker-modal');

    setTimeout(() => {
      if (typeof scrollToToday === 'function') scrollToToday('auto');
      else if (typeof windowObj.scrollToToday === 'function') windowObj.scrollToToday('auto');
    }, 50);
  }

  windowObj.openMonthPicker = openMonthPicker;
  windowObj.toggleMonthPickerYearView = toggleMonthPickerYearView;
  windowObj.shiftMonthPickerBSYears = shiftMonthPickerBSYears;
  windowObj.renderMonthPickerBS = renderMonthPickerBS;
  windowObj.selectMonthPickerMonth = selectMonthPickerMonth;

  return {
    openMonthPicker,
    toggleMonthPickerYearView,
    shiftMonthPickerBSYears,
    renderMonthPickerBS,
    selectMonthPickerMonth,
    DEFAULT_GREEK_MONTHS_SHORT,
    DEFAULT_ENGLISH_MONTHS_SHORT
  };
});
