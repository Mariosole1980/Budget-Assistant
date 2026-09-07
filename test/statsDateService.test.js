const { test } = require('node:test');
const assert = require('node:assert');

const StatsDateService = require('../js/statsDateService.js');

test('StatsDateService exports all expected functions', () => {
  assert.strictEqual(typeof StatsDateService.getStatsDateRange, 'function');
  assert.strictEqual(typeof StatsDateService.syncStatsDate, 'function');
  assert.strictEqual(typeof StatsDateService.formatStatsPeriodTitle, 'function');
  assert.strictEqual(typeof StatsDateService.wrapPeriodTitleWithSpans, 'function');
});

test('StatsDateService.getStatsDateRange calculates weekly range accurately', () => {
  global.state = {
    statsPeriodType: 'weekly',
    statsDate: new Date('2026-09-07T12:00:00') // Monday
  };
  global.localStorage = {
    getItem: (k) => (k === 'app_week_start' ? '1' : null)
  };

  const { start, end } = StatsDateService.getStatsDateRange();
  assert.ok(start instanceof Date);
  assert.ok(end instanceof Date);
  assert.strictEqual(start.getDay(), 1); // Monday
  assert.strictEqual(start.getHours(), 0);
  assert.strictEqual(start.getMinutes(), 0);
  assert.strictEqual(end.getDay(), 0); // Sunday
  assert.strictEqual(end.getHours(), 23);
  assert.strictEqual(end.getMinutes(), 59);
});

test('StatsDateService.getStatsDateRange calculates monthly and annual ranges', () => {
  // Monthly test
  global.state = {
    statsPeriodType: 'monthly',
    statsDate: new Date('2026-09-15T12:00:00')
  };
  global.localStorage = {
    getItem: (k) => (k === 'app_month_start' ? '1' : null)
  };

  const monthlyRange = StatsDateService.getStatsDateRange();
  assert.strictEqual(monthlyRange.start.getFullYear(), 2026);
  assert.strictEqual(monthlyRange.start.getMonth(), 8); // Sep (0-indexed 8)
  assert.strictEqual(monthlyRange.start.getDate(), 1);
  assert.strictEqual(monthlyRange.end.getDate(), 30); // 30 days in Sep

  // Annual test
  global.state.statsPeriodType = 'annually';
  const annualRange = StatsDateService.getStatsDateRange();
  assert.strictEqual(annualRange.start.getMonth(), 0);
  assert.strictEqual(annualRange.start.getDate(), 1);
  assert.strictEqual(annualRange.end.getMonth(), 11);
  assert.strictEqual(annualRange.end.getDate(), 31);

  // Custom period test
  global.state.statsPeriodType = 'period';
  global.state.statsCustomStart = '2026-05-10';
  global.state.statsCustomEnd = '2026-05-20';
  const periodRange = StatsDateService.getStatsDateRange();
  assert.strictEqual(periodRange.start.getDate(), 10);
  assert.strictEqual(periodRange.end.getDate(), 20);
});

test('StatsDateService.syncStatsDate syncs date to year and month selection', () => {
  global.state = {
    statsDate: new Date('2025-01-01T00:00:00'),
    selectedYear: 2026,
    selectedMonth: 8
  };

  StatsDateService.syncStatsDate();
  assert.strictEqual(global.state.statsDate.getFullYear(), 2026);
  assert.strictEqual(global.state.statsDate.getMonth(), 8);
  assert.strictEqual(global.state.statsDate.getDate(), 15);
});

test('StatsDateService.formatStatsPeriodTitle formats title correctly across modes', () => {
  global.getMonthName = (idx, short) => (short ? 'Σεπ' : 'Σεπτέμβριος');

  global.state = { statsPeriodType: 'monthly' };
  const titleMonthly = StatsDateService.formatStatsPeriodTitle(new Date('2026-09-01'), new Date('2026-09-30'));
  assert.strictEqual(titleMonthly, 'Σεπ 2026');

  global.state = { statsPeriodType: 'annually' };
  const titleAnnual = StatsDateService.formatStatsPeriodTitle(new Date('2026-01-01'), new Date('2026-12-31'));
  assert.strictEqual(titleAnnual, '2026');

  global.state = { statsPeriodType: 'weekly' };
  const titleWeekly = StatsDateService.formatStatsPeriodTitle(new Date('2026-09-07'), new Date('2026-09-13'));
  assert.strictEqual(titleWeekly, '7 - 13 Σεπ 2026');
});

test('StatsDateService.wrapPeriodTitleWithSpans adds markup correctly', () => {
  const wrapped = StatsDateService.wrapPeriodTitleWithSpans('Σεπτέμβριος 2026');
  assert.ok(wrapped.includes('<span class="month-part">Σεπτέμβριος</span>'));
  assert.ok(wrapped.includes('<span class="year-part"'));
  assert.ok(wrapped.includes('2026</span>'));

  const empty = StatsDateService.wrapPeriodTitleWithSpans('');
  assert.strictEqual(empty, '');
});
