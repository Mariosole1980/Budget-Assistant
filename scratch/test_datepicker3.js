// Brute-force test: simulate the day-click handler for ALL starting days
// and ALL target months to find any rollover bug.

function simulateDayClick(startDate, targetYear, targetMonth, targetDay) {
    // Clone the day-click handler logic exactly
    let customDatePickerSelectedDate = new Date(startDate);
    customDatePickerSelectedDate.setFullYear(targetYear);
    customDatePickerSelectedDate.setMonth(targetMonth);
    customDatePickerSelectedDate.setDate(targetDay);
    return {
        year: customDatePickerSelectedDate.getFullYear(),
        month: customDatePickerSelectedDate.getMonth(),
        day: customDatePickerSelectedDate.getDate()
    };
}

let failures = [];
// Test all starting days 1-31, all target months 0-11, target day 15
for (let startDay = 1; startDay <= 31; startDay++) {
    for (let targetMonth = 0; targetMonth < 12; targetMonth++) {
        // Start date: use a 31-day month (March) so startDay can be up to 31
        const startDate = new Date(2026, 2, Math.min(startDay, 31));
        const result = simulateDayClick(startDate, 2025, targetMonth, 15);
        const expectedDay = 15;
        if (result.day !== expectedDay || result.month !== targetMonth || result.year !== 2025) {
            failures.push({
                startDay: startDate.getDate(),
                targetMonth,
                result: `${result.year}-${result.month + 1}-${result.day}`,
                expected: `2025-${targetMonth + 1}-15`
            });
        }
    }
}

console.log('Day-click handler rollover failures:', failures.length);
if (failures.length > 0) {
    console.log(JSON.stringify(failures.slice(0, 20), null, 2));
} else {
    console.log('No rollover in day-click handler when target day is 15.');
}

// Now test the FULL navigation flow (year selection -> month selection -> day click)
// with a 31-day starting date
console.log('\n=== Full BS flow with 31-day start ===');
let selected = new Date(2026, 2, 31); // March 31
let viewing = new Date(2026, 2, 31);

// Select year 2025
let y = 2025;
let curDay = selected.getDate(); // 31
let curMonth = viewing.getMonth(); // 2
let daysInMonth = new Date(y, curMonth + 1, 0).getDate(); // 31
let safeDay = Math.min(curDay, daysInMonth); // 31
viewing = new Date(y, curMonth, safeDay);
selected = new Date(y, curMonth, safeDay);
console.log('After year 2025:', selected.toDateString());

// Select month February (m=2)
let m = 2;
curDay = selected.getDate(); // 31
let curYear = viewing.getFullYear(); // 2025
daysInMonth = new Date(curYear, m, 0).getDate(); // 28
safeDay = Math.min(curDay, daysInMonth); // 28
viewing = new Date(curYear, m - 1, safeDay);
selected = new Date(curYear, m - 1, safeDay);
console.log('After month Feb:', selected.toDateString());

// Day click 15
let year = viewing.getFullYear();
let month = viewing.getMonth();
selected.setFullYear(year);
selected.setMonth(month);
selected.setDate(15);
console.log('After day 15:', selected.toDateString());
console.log('FINAL:', `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`);
