// Full reproduction of the date picker flow
// Current date: Aug 1 2026
let customDatePickerSelectedDate = new Date(2026, 7, 1, 19, 38);
let customDatePickerViewingMonth = new Date(2026, 7, 1);

// User opens bottom sheet, selects YEAR 2025
let y = 2025;
let curDay = customDatePickerSelectedDate.getDate();
let curMonth = customDatePickerViewingMonth.getMonth();
let daysInMonth = new Date(y, curMonth + 1, 0).getDate();
let safeDay = Math.min(curDay, daysInMonth);
customDatePickerViewingMonth = new Date(y, curMonth, safeDay);
customDatePickerSelectedDate = new Date(y, curMonth, safeDay);
console.log('After year 2025:', customDatePickerSelectedDate.getFullYear() + '-' + (customDatePickerSelectedDate.getMonth() + 1) + '-' + customDatePickerSelectedDate.getDate());

// User selects MONTH March (m=3)
let m = 3;
curDay = customDatePickerSelectedDate.getDate();
let curYear = customDatePickerViewingMonth.getFullYear();
daysInMonth = new Date(curYear, m, 0).getDate();
safeDay = Math.min(curDay, daysInMonth);
customDatePickerViewingMonth = new Date(curYear, m - 1, safeDay);
customDatePickerSelectedDate = new Date(curYear, m - 1, safeDay);
console.log('After month March:', customDatePickerSelectedDate.getFullYear() + '-' + (customDatePickerSelectedDate.getMonth() + 1) + '-' + customDatePickerSelectedDate.getDate());

// User taps day 15
let year = customDatePickerViewingMonth.getFullYear();
let month = customDatePickerViewingMonth.getMonth();
let d = 15;
customDatePickerSelectedDate.setFullYear(year);
customDatePickerSelectedDate.setMonth(month);
customDatePickerSelectedDate.setDate(d);
console.log('After day 15:', customDatePickerSelectedDate.getFullYear() + '-' + (customDatePickerSelectedDate.getMonth() + 1) + '-' + customDatePickerSelectedDate.getDate());

// setCustomDatePickerValue
let hh = String(customDatePickerSelectedDate.getHours()).padStart(2, '0');
let min = String(customDatePickerSelectedDate.getMinutes()).padStart(2, '0');
let yyyy = customDatePickerSelectedDate.getFullYear();
let mm = String(customDatePickerSelectedDate.getMonth() + 1).padStart(2, '0');
let dd = String(customDatePickerSelectedDate.getDate()).padStart(2, '0');
console.log('FINAL VALUE:', yyyy + '-' + mm + '-' + dd + 'T' + hh + ':' + min);
