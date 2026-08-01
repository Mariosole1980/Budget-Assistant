// Verify the FIXED day-click handler eliminates the rollover bug

function fixedDayClick(startDate, targetYear, targetMonth, targetDay) {
    // New logic: create fresh Date object
    let customDatePickerSelectedDate = new Date(startDate);
    customDatePickerSelectedDate = new Date(
        targetYear,
        targetMonth,
        targetDay,
        customDatePickerSelectedDate.getHours(),
        customDatePickerSelectedDate.getMinutes()
    );
    return {
        year: customDatePickerSelectedDate.getFullYear(),
        month: customDatePickerSelectedDate.getMonth(),
        day: customDatePickerSelectedDate.getDate()
    };
}

let failures = [];
for (let startDay = 1; startDay <= 31; startDay++) {
    for (let targetMonth = 0; targetMonth < 12; targetMonth++) {
        const startDate = new Date(2026, 2, Math.min(startDay, 31));
        const result = fixedDayClick(startDate, 2025, targetMonth, 15);
        if (result.day !== 15 || result.month !== targetMonth || result.year !== 2025) {
            failures.push({ startDay, targetMonth, result });
        }
    }
}

console.log('Fixed day-click handler rollover failures:', failures.length);
if (failures.length === 0) {
    console.log('PASS: No rollover in fixed day-click handler for all start days and target months.');
}

// Verify the exact user scenario: navigate to Feb 2025, select day 15
console.log('\n=== User scenario: navigate to Feb 2025, select day 15 ===');
// Start from a 31-day date (March 31, 2026)
let selected = new Date(2026, 2, 31);
// Simulate year selection 2025 (safeDay 31, March has 31 days)
selected = new Date(2025, 2, 31);
// Simulate month selection Feb (safeDay = min(31, 28) = 28)
selected = new Date(2025, 1, 28);
// Day click 15 with FIXED handler
selected = new Date(2025, 1, 15, selected.getHours(), selected.getMinutes());
console.log('FINAL:', `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`);
console.log('EXPECTED: 2025-02-15');
