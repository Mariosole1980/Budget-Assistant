// Simulate the day-click handler with setMonth rollover edge case
// Scenario: customDatePickerSelectedDate is March 31 (31-day month)
// User navigates to February via BS (safeDay capping) then taps day 15

console.log('=== TEST: BS flow with safeDay capping ===');

// Initial state: March 31, 2026
let customDatePickerSelectedDate = new Date(2026, 2, 31);
let customDatePickerViewingMonth = new Date(2026, 2, 31);
console.log('Initial selected:', customDatePickerSelectedDate.toDateString());

// User selects year 2025 in BS (year onclick handler)
let y = 2025;
let curDay = customDatePickerSelectedDate.getDate(); // 31
let curMonth = customDatePickerViewingMonth.getMonth(); // 2 (March)
let daysInMonth = new Date(y, curMonth + 1, 0).getDate(); // 31 days in March 2025
let safeDay = Math.min(curDay, daysInMonth); // 31
customDatePickerViewingMonth = new Date(y, curMonth, safeDay); // 2025-03-31
customDatePickerSelectedDate = new Date(y, curMonth, safeDay); // 2025-03-31
console.log('After year 2025:', customDatePickerSelectedDate.toDateString());

// User selects month February (m=2) in BS (month onclick handler)
let m = 2;
curDay = customDatePickerSelectedDate.getDate(); // 31
curYear = customDatePickerViewingMonth.getFullYear(); // 2025
daysInMonth = new Date(curYear, m, 0).getDate(); // 28 days in Feb 2025
safeDay = Math.min(curDay, daysInMonth); // 28
customDatePickerViewingMonth = new Date(curYear, m - 1, safeDay); // 2025-02-28
customDatePickerSelectedDate = new Date(curYear, m - 1, safeDay); // 2025-02-28
console.log('After month Feb:', customDatePickerSelectedDate.toDateString());

// User taps day 15 (day-click handler)
let year = customDatePickerViewingMonth.getFullYear(); // 2025
let month = customDatePickerViewingMonth.getMonth(); // 1 (Feb)
let d = 15;
customDatePickerSelectedDate.setFullYear(year);
customDatePickerSelectedDate.setMonth(month);
customDatePickerSelectedDate.setDate(d);
console.log('After day 15:', customDatePickerSelectedDate.toDateString());

// setCustomDatePickerValue output
const yyyy = customDatePickerSelectedDate.getFullYear();
const mm = String(customDatePickerSelectedDate.getMonth() + 1).padStart(2, '0');
const dd = String(customDatePickerSelectedDate.getDate()).padStart(2, '0');
console.log('FINAL VALUE:', `${yyyy}-${mm}-${dd}T00:00`);
console.log('EXPECTED:    2025-02-15T00:00');
console.log('');

console.log('=== TEST 2: Direct setMonth rollover (no safeDay) ===');
// What if customDatePickerSelectedDate is March 31 and we directly setMonth(1)?
let t = new Date(2026, 2, 31);
t.setFullYear(2025);
t.setMonth(1); // Feb - rolls over to March 3!
t.setDate(15);
console.log('Direct setMonth(1) on Mar 31:', t.toDateString(), '=>',
    `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`);
console.log('');

console.log('=== TEST 3: Swipe flow with safeDay ===');
// Initial: March 31, 2026
let s = new Date(2026, 2, 31);
let sv = new Date(2026, 2, 31);
// adjustCustomDatePickerMonth(-1) to go to Feb
let currentDay = s.getDate(); // 31
let targetYear = sv.getFullYear(); // 2026
let targetMonth = sv.getMonth() - 1; // 1 (Feb)
let tempDate = new Date(targetYear, targetMonth, 1);
let daysInTarget = new Date(tempDate.getFullYear(), tempDate.getMonth() + 1, 0).getDate(); // 28
let safeDay2 = Math.min(currentDay, daysInTarget); // 28
sv = new Date(tempDate.getFullYear(), tempDate.getMonth(), safeDay2);
s = new Date(tempDate.getFullYear(), tempDate.getMonth(), safeDay2);
console.log('After swipe to Feb:', s.toDateString());
// tap day 15
s.setFullYear(sv.getFullYear());
s.setMonth(sv.getMonth());
s.setDate(15);
console.log('After day 15:', s.toDateString());
