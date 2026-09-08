'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const CashFlowCalendarService = require('../js/cashFlowCalendarService.js');

test('CashFlowCalendarService exports all expected functions', () => {
  assert.strictEqual(typeof CashFlowCalendarService.getMonthCashFlowData, 'function');
  assert.strictEqual(typeof CashFlowCalendarService.getDaysInMonth, 'function');
  assert.strictEqual(typeof CashFlowCalendarService.getMondayFirstWeekday, 'function');
  assert.strictEqual(typeof CashFlowCalendarService.renderCashFlowCalendar, 'function');
  assert.strictEqual(typeof CashFlowCalendarService.selectCashFlowDay, 'function');
  assert.strictEqual(typeof CashFlowCalendarService.quickPayCalendarBill, 'function');
  assert.strictEqual(typeof CashFlowCalendarService.navCashFlowMonth, 'function');
  assert.strictEqual(typeof CashFlowCalendarService.openCashFlowCalendarModal, 'function');
  assert.strictEqual(typeof CashFlowCalendarService.closeCashFlowCalendarModal, 'function');
});

test('getDaysInMonth calculates correct days including leap years', () => {
  // February non-leap (2025)
  assert.strictEqual(CashFlowCalendarService.getDaysInMonth(2025, 1), 28);
  // February leap (2024)
  assert.strictEqual(CashFlowCalendarService.getDaysInMonth(2024, 1), 29);
  // April (30 days)
  assert.strictEqual(CashFlowCalendarService.getDaysInMonth(2026, 3), 30);
  // July (31 days)
  assert.strictEqual(CashFlowCalendarService.getDaysInMonth(2026, 6), 31);
});

test('getMondayFirstWeekday returns 0 for Monday and 6 for Sunday', () => {
  // 2026-09-01 was a Tuesday -> weekday index 1
  assert.strictEqual(CashFlowCalendarService.getMondayFirstWeekday(2026, 8, 1), 1);
  // 2026-09-07 was a Monday -> weekday index 0
  assert.strictEqual(CashFlowCalendarService.getMondayFirstWeekday(2026, 8, 7), 0);
  // 2026-09-06 was a Sunday -> weekday index 6
  assert.strictEqual(CashFlowCalendarService.getMondayFirstWeekday(2026, 8, 6), 6);
});

test('getMonthCashFlowData aggregates transactions accurately by day', () => {
  const transactions = [
    { id: 't1', date: '2026-09-05T10:00:00', type: 'income', amount: 1500, category: 'Μισθός' },
    { id: 't2', date: '2026-09-05T14:30:00', type: 'expense', amount: 50, category: 'Supermarket' },
    { id: 't3', date: '2026-09-12T09:00:00', type: 'expense', amount: 30, category: 'Καφές' },
    // Deleted transaction must be ignored
    { id: 't4', date: '2026-09-12T11:00:00', type: 'expense', amount: 100, is_deleted: true }
  ];

  const data = CashFlowCalendarService.getMonthCashFlowData(2026, 8, transactions, []);

  assert.strictEqual(data.year, 2026);
  assert.strictEqual(data.monthIndex, 8);
  assert.strictEqual(data.daysInMonth, 30);
  assert.strictEqual(data.actualIncome, 1500);
  assert.strictEqual(data.actualExpense, 80);
  assert.strictEqual(data.actualNet, 1420);

  // Day 5 check
  const day5 = data.days.find(d => d.dayNum === 5);
  assert.ok(day5);
  assert.strictEqual(day5.totalIncome, 1500);
  assert.strictEqual(day5.totalExpense, 50);
  assert.strictEqual(day5.netDay, 1450);
  assert.strictEqual(day5.hasIncome, true);
  assert.strictEqual(day5.hasExpense, true);
  assert.strictEqual(day5.transactions.length, 2);

  // Day 12 check
  const day12 = data.days.find(d => d.dayNum === 12);
  assert.ok(day12);
  assert.strictEqual(day12.totalExpense, 30);
  assert.strictEqual(day12.transactions.length, 1);
});

test('getMonthCashFlowData detects unpaid recurring bills and calculates projected month-end balance', () => {
  const recurringTemplates = [
    { id: 'rec1', day_of_month: 15, amount: 12.99, note: 'Netflix', category: 'Συνδρομές' },
    { id: 'rec2', day_of_month: 20, amount: 80.00, note: 'ΔΕΗ', category: 'Λογαριασμοί' }
  ];

  // Netflix already paid on day 15
  const transactions = [
    { id: 't_netflix', date: '2026-09-15', type: 'expense', amount: 12.99, recurring_template_id: 'rec1', note: 'Netflix' }
  ];

  const data = CashFlowCalendarService.getMonthCashFlowData(2026, 8, transactions, recurringTemplates);

  // Day 15 should NOT have upcoming bills since it was already paid
  const day15 = data.days.find(d => d.dayNum === 15);
  assert.strictEqual(day15.upcomingBills.length, 0);

  // Day 20 should have upcoming bill (ΔΕΗ 80€)
  const day20 = data.days.find(d => d.dayNum === 20);
  assert.strictEqual(day20.upcomingBills.length, 1);
  assert.strictEqual(day20.upcomingBills[0].id, 'rec2');
  assert.strictEqual(day20.upcomingBills[0].amount, 80.00);
  assert.strictEqual(day20.hasUpcomingBill, true);
});

test('getMonthCashFlowData handles empty transactions and empty templates gracefully', () => {
  const data = CashFlowCalendarService.getMonthCashFlowData(2026, 0, null, null);
  assert.strictEqual(data.daysInMonth, 31);
  assert.strictEqual(data.actualIncome, 0);
  assert.strictEqual(data.actualExpense, 0);
  assert.strictEqual(data.actualNet, 0);
  assert.strictEqual(data.projectedRemainingBills, 0);
  assert.strictEqual(data.days.length, 31);
});
