'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const SubscriptionEngine = require('../js/SubscriptionEngine.js');

describe('SubscriptionEngine Unit Tests', () => {

    describe('1. analyzeMonthlySubscriptions', () => {
        test('correctly identifies paid vs pending subscriptions in current month', () => {
            const templates = [
                {
                    id: 'rent_tpl',
                    type: 'expense',
                    category: 'Housing',
                    note: 'Rent Apartment',
                    amount: 450,
                    startDate: '2026-09-01',
                    preset: 'monthly',
                    days: [1]
                },
                {
                    id: 'netflix_tpl',
                    type: 'expense',
                    category: 'Entertainment',
                    note: 'Netflix Subscription',
                    amount: 12.99,
                    startDate: '2026-09-15',
                    preset: 'monthly',
                    days: [15]
                },
                {
                    id: 'electricity_tpl',
                    type: 'expense',
                    category: 'Bills',
                    note: 'DEH Power',
                    amount: 80,
                    startDate: '2026-09-20',
                    preset: 'monthly',
                    days: [20]
                }
            ];

            const transactions = [
                {
                    id: 'tx_1',
                    type: 'expense',
                    category: 'Housing',
                    note: 'Rent Apartment',
                    amount: 450,
                    date: '2026-09-01'
                }
            ];

            const result = SubscriptionEngine.analyzeMonthlySubscriptions({
                templates: templates,
                transactions: transactions,
                referenceDate: '2026-09-10' // Reference day 10
            });

            assert.strictEqual(result.countTotal, 3);
            assert.strictEqual(result.countPaid, 1);
            assert.strictEqual(result.countPending, 2);

            assert.strictEqual(result.totalMonthly, 542.99);
            assert.strictEqual(result.totalPaid, 450);
            assert.strictEqual(result.totalPending, 92.99);

            const rentItem = result.items.find(i => i.id === 'rent_tpl');
            assert.strictEqual(rentItem.status, 'paid');
            assert.strictEqual(rentItem.isPaid, true);
            assert.strictEqual(rentItem.matchedTransaction.id, 'tx_1');

            const netflixItem = result.items.find(i => i.id === 'netflix_tpl');
            assert.strictEqual(netflixItem.status, 'pending');
            assert.strictEqual(netflixItem.isPaid, false);
            assert.strictEqual(netflixItem.isOverdue, false);
            assert.strictEqual(netflixItem.daysUntilDue, 5); // 15 - 10 = 5 days
        });

        test('correctly normalizes and matches Greek subscription notes and categories (Tier 2/3 matching)', () => {
            assert.strictEqual(SubscriptionEngine.normalizeText('ΔΟΣΗ ΔΑΝΕΙΟΥ'), 'δοση δανειου');
            assert.strictEqual(SubscriptionEngine.normalizeText('🏡 ΣΠΙΤΙ'), 'σπιτι');
            assert.strictEqual(SubscriptionEngine.normalizeText('Ενοίκιο Γραφείου!'), 'ενοικιο γραφειου');
            assert.strictEqual(SubscriptionEngine.normalizeText('Καφές'), 'καφεσ');

            const templates = [
                {
                    id: 'loan_new_tpl_id',
                    type: 'expense',
                    category: '🏡 ΣΠΙΤΙ',
                    note: 'ΔΟΣΗ ΔΑΝΕΙΟΥ',
                    amount: 524.38,
                    startDate: '2025-06-01',
                    preset: 'monthly',
                    days: [1]
                }
            ];

            // Transaction has a DIFFERENT/OLD recurring_template_id, but note and amount match
            const transactions = [
                {
                    id: 'tx_loan_sept',
                    type: 'expense',
                    category: '🏡 ΣΠΙΤΙ',
                    note: 'ΔΟΣΗ ΔΑΝΕΙΟΥ',
                    amount: 524.38,
                    date: '2026-09-01',
                    recurring_template_id: 'loan_old_deleted_tpl_id'
                }
            ];

            const result = SubscriptionEngine.analyzeMonthlySubscriptions({
                templates: templates,
                transactions: transactions,
                referenceDate: '2026-09-12'
            });

            assert.strictEqual(result.countPaid, 1);
            assert.strictEqual(result.countPending, 0);
            assert.strictEqual(result.totalPending, 0);
            assert.strictEqual(result.items[0].isPaid, true);
            assert.strictEqual(result.items[0].status, 'paid');
            assert.strictEqual(result.items[0].matchedTransaction.id, 'tx_loan_sept');
        });

        test('flags overdue subscriptions when currentDay > dueDay and not paid', () => {
            const templates = [
                {
                    id: 'gym_tpl',
                    type: 'expense',
                    category: 'Fitness',
                    note: 'Gym Membership',
                    amount: 35,
                    startDate: '2026-09-03',
                    preset: 'monthly',
                    days: [3]
                }
            ];

            const result = SubscriptionEngine.analyzeMonthlySubscriptions({
                templates: templates,
                transactions: [],
                referenceDate: '2026-09-10' // Day 10, gym was due on day 3
            });

            assert.strictEqual(result.countPending, 1);
            assert.strictEqual(result.items[0].isOverdue, true);
            assert.strictEqual(result.items[0].daysUntilDue, -7);
        });

        test('ignores income recurring templates from expense budget calculations', () => {
            const templates = [
                {
                    id: 'salary_tpl',
                    type: 'income',
                    category: 'Income',
                    note: 'Monthly Salary',
                    amount: 2000,
                    startDate: '2026-09-01',
                    preset: 'monthly'
                },
                {
                    id: 'spotify_tpl',
                    type: 'expense',
                    category: 'Entertainment',
                    note: 'Spotify',
                    amount: 7.99,
                    startDate: '2026-09-12',
                    preset: 'monthly'
                }
            ];

            const result = SubscriptionEngine.analyzeMonthlySubscriptions({
                templates: templates,
                transactions: [],
                referenceDate: '2026-09-05'
            });

            assert.strictEqual(result.countTotal, 1);
            assert.strictEqual(result.totalMonthly, 7.99);
            assert.strictEqual(result.totalPending, 7.99);
        });
    });

    describe('2. detectRecurringPatterns', () => {
        test('detects repeating monthly expense patterns', () => {
            const transactions = [
                { id: 't1', type: 'expense', note: 'Netflix', category: 'Streaming', amount: 12.99, date: '2026-07-15' },
                { id: 't2', type: 'expense', note: 'Netflix', category: 'Streaming', amount: 12.99, date: '2026-08-15' },
                { id: 't3', type: 'expense', note: 'Coffee', category: 'Food', amount: 3.50, date: '2026-09-02' }
            ];

            const suggestions = SubscriptionEngine.detectRecurringPatterns({
                transactions: transactions,
                existingTemplates: [],
                referenceDate: '2026-09-04'
            });

            assert.strictEqual(suggestions.length, 1);
            assert.strictEqual(suggestions[0].note, 'Netflix');
            assert.strictEqual(suggestions[0].amount, 12.99);
            assert.strictEqual(suggestions[0].suggestedDay, 15);
            assert.strictEqual(suggestions[0].occurrences, 2);
        });

        test('skips candidates that already exist in existing templates', () => {
            const transactions = [
                { id: 't1', type: 'expense', note: 'Spotify Family', category: 'Music', amount: 11.99, date: '2026-07-10' },
                { id: 't2', type: 'expense', note: 'Spotify Family', category: 'Music', amount: 11.99, date: '2026-08-10' }
            ];

            const existing = [
                { id: 'sp1', type: 'expense', note: 'Spotify Family', amount: 11.99 }
            ];

            const suggestions = SubscriptionEngine.detectRecurringPatterns({
                transactions: transactions,
                existingTemplates: existing,
                referenceDate: '2026-09-04'
            });

            assert.strictEqual(suggestions.length, 0);
        });
    });

    describe('3. Cadence presets, multi-occurrence & partial payments', () => {

        test('getDueDaysForMonth honours every cadence preset', () => {
            // Sept 2026: the 1st is a Tuesday
            assert.strictEqual(
                SubscriptionEngine.getDueDaysForMonth({ preset: 'daily', startDate: '2026-09-01' }, 2026, 8).length,
                30
            );
            assert.deepStrictEqual(
                SubscriptionEngine.getDueDaysForMonth({ preset: 'weekly', startDate: '2026-09-02' }, 2026, 8),
                [2, 9, 16, 23, 30]
            );
            assert.deepStrictEqual(
                SubscriptionEngine.getDueDaysForMonth({ preset: 'monthly', startDate: '2026-09-15' }, 2026, 8),
                [15]
            );
            // Yearly only fires in the start month
            assert.deepStrictEqual(
                SubscriptionEngine.getDueDaysForMonth({ preset: 'yearly', startDate: '2026-03-12' }, 2026, 9),
                []
            );
            assert.deepStrictEqual(
                SubscriptionEngine.getDueDaysForMonth({ preset: 'yearly', startDate: '2026-10-12' }, 2026, 9),
                [12]
            );
            // Specific months only fires in the selected month (numeric or string months)
            assert.deepStrictEqual(
                SubscriptionEngine.getDueDaysForMonth({ preset: 'specific_months', startDate: '2026-01-10', months: [10] }, 2026, 8),
                []
            );
            assert.deepStrictEqual(
                SubscriptionEngine.getDueDaysForMonth({ preset: 'specific_months', startDate: '2026-01-10', months: ['10'] }, 2026, 9),
                [10]
            );
            // Custom supports multiple days per month
            assert.deepStrictEqual(
                SubscriptionEngine.getDueDaysForMonth({ preset: 'custom', months: [9], days: [5, 20] }, 2026, 8),
                [5, 20]
            );
            // Legacy monthly wrapper still returns the first due day
            assert.strictEqual(
                SubscriptionEngine.getDueDayForMonth({ preset: 'weekly', startDate: '2026-09-02' }, 2026, 8),
                2
            );
        });

        test('getDueDaysForMonth clamps short months, respects start/end dates and deleted dates', () => {
            // 31st clamped to the last day of February
            assert.deepStrictEqual(
                SubscriptionEngine.getDueDaysForMonth({ preset: 'monthly', startDate: '2026-01-31' }, 2026, 1),
                [28]
            );
            // Occurrences before the start date are dropped
            assert.deepStrictEqual(
                SubscriptionEngine.getDueDaysForMonth({ preset: 'weekly', startDate: '2026-09-16' }, 2026, 8),
                [16, 23, 30]
            );
            // Occurrences after the end date are dropped
            assert.deepStrictEqual(
                SubscriptionEngine.getDueDaysForMonth({ preset: 'weekly', startDate: '2026-09-02', endDate: '2026-09-16' }, 2026, 8),
                [2, 9, 16]
            );
            // Deleted occurrences (inline marker in description) are skipped
            assert.deepStrictEqual(
                SubscriptionEngine.getDueDaysForMonth({
                    preset: 'custom',
                    days: [5, 20],
                    description: 'Pella ||deleted_dates:2026-09-20'
                }, 2026, 8),
                [5]
            );
            // Year restrictions
            assert.deepStrictEqual(
                SubscriptionEngine.getDueDaysForMonth({ preset: 'monthly', startDate: '2026-09-05', years: [2027] }, 2026, 8),
                []
            );
        });

        test('weekly cadence counts the remaining occurrences of the month', () => {
            const templates = [{
                id: 'cleaner_tpl',
                type: 'expense',
                category: 'Bills',
                note: 'Cleaner',
                amount: 20,
                startDate: '2026-09-02',
                preset: 'weekly'
            }];

            const result = SubscriptionEngine.analyzeMonthlySubscriptions({
                templates: templates,
                transactions: [],
                referenceDate: '2026-09-15'
            });

            const item = result.items[0];
            assert.strictEqual(item.preset, 'weekly');
            assert.strictEqual(item.occurrenceCount, 3); // 16, 23, 30 remain (2 & 9 elapsed)
            assert.strictEqual(item.expectedTotal, 60);
            assert.strictEqual(item.pendingAmount, 60);
            assert.strictEqual(item.dueDay, 16);
            assert.strictEqual(item.isOverdue, false);
            assert.strictEqual(result.totalMonthly, 60);
            assert.strictEqual(result.totalPending, 60);
        });

        test('daily cadence budgets the remaining days of the month', () => {
            const templates = [{
                id: 'daily_tpl',
                type: 'expense',
                category: 'Bills',
                note: 'Parking',
                amount: 10,
                startDate: '2026-09-01',
                preset: 'daily'
            }];

            const result = SubscriptionEngine.analyzeMonthlySubscriptions({
                templates: templates,
                transactions: [],
                referenceDate: '2026-09-25'
            });

            const item = result.items[0];
            assert.strictEqual(item.occurrenceCount, 6); // 25..30
            assert.strictEqual(item.pendingAmount, 60);
            assert.strictEqual(result.totalPending, 60);
        });

        test('keeps overdue low-frequency bills pending (monthly/yearly/custom)', () => {
            const templates = [
                { id: 'rent_tpl', type: 'expense', category: 'Housing', note: 'Rent', amount: 450, startDate: '2026-09-01', preset: 'monthly' },
                { id: 'custom_tpl', type: 'expense', category: 'Bills', note: 'Pella', amount: 30, preset: 'custom', months: [9], days: [2, 19] }
            ];

            const result = SubscriptionEngine.analyzeMonthlySubscriptions({
                templates: templates,
                transactions: [],
                referenceDate: '2026-09-25'
            });

            const rent = result.items.find(i => i.id === 'rent_tpl');
            assert.strictEqual(rent.isOverdue, true);
            assert.strictEqual(rent.pendingAmount, 450);

            const custom = result.items.find(i => i.id === 'custom_tpl');
            assert.strictEqual(custom.occurrenceCount, 2);
            assert.strictEqual(custom.expectedTotal, 60);
            assert.strictEqual(custom.pendingAmount, 60);
            assert.strictEqual(custom.isOverdue, true);
        });

        test('pairs one transaction per occurrence and keeps the remainder pending', () => {
            const templates = [{
                id: 'custom_tpl',
                type: 'expense',
                category: 'Bills',
                note: 'Pella',
                amount: 50,
                preset: 'custom',
                months: [9],
                days: [5, 20]
            }];

            const result = SubscriptionEngine.analyzeMonthlySubscriptions({
                templates: templates,
                transactions: [
                    { id: 'tx_1', type: 'expense', category: 'Bills', note: 'Pella', amount: 50, date: '2026-09-07' }
                ],
                referenceDate: '2026-09-25'
            });

            const item = result.items[0];
            assert.strictEqual(item.status, 'partial');
            assert.strictEqual(item.expectedTotal, 100);
            assert.strictEqual(item.paidAmount, 50);
            assert.strictEqual(item.pendingAmount, 50);
            assert.strictEqual(item.matchedTransactions.length, 1);
            assert.strictEqual(result.totalPaid, 50);
            assert.strictEqual(result.totalPending, 50);
        });

        test('matches partial payments of a single bill instead of dropping them', () => {
            const templates = [{
                id: 'loan_tpl',
                type: 'expense',
                category: 'Loans',
                note: 'Δόση Δανείου',
                amount: 100,
                startDate: '2026-09-10',
                preset: 'monthly'
            }];

            const partial = SubscriptionEngine.analyzeMonthlySubscriptions({
                templates: templates,
                transactions: [
                    { id: 'tx_partial', type: 'expense', category: 'Loans', note: 'Δόση Δανείου', amount: 60, date: '2026-09-05' }
                ],
                referenceDate: '2026-09-12'
            });

            const partialItem = partial.items[0];
            assert.strictEqual(partialItem.status, 'partial');
            assert.strictEqual(partialItem.isPaid, false);
            assert.strictEqual(partialItem.expectedTotal, 100);
            assert.strictEqual(partialItem.paidAmount, 60);
            assert.strictEqual(partialItem.pendingAmount, 40);
            assert.strictEqual(partialItem.matchedTransaction.id, 'tx_partial');
            assert.strictEqual(partial.countPaid, 0);
            assert.strictEqual(partial.countPending, 1);

            // Unrelated amounts in the same category must not be treated as this bill
            const unrelated = SubscriptionEngine.analyzeMonthlySubscriptions({
                templates: templates,
                transactions: [
                    { id: 'tx_other', type: 'expense', category: 'Loans', note: 'Κάτι άλλο', amount: 60, date: '2026-09-05' }
                ],
                referenceDate: '2026-09-12'
            });
            assert.strictEqual(unrelated.items[0].paidAmount, 0);
            assert.strictEqual(unrelated.items[0].pendingAmount, 100);
        });

        test('full payment still closes a bill that also has a partial instalment', () => {
            const templates = [{
                id: 'loan_tpl',
                type: 'expense',
                category: 'Loans',
                note: 'Δόση Δανείου',
                amount: 100,
                startDate: '2026-09-10',
                preset: 'monthly'
            }];

            const result = SubscriptionEngine.analyzeMonthlySubscriptions({
                templates: templates,
                transactions: [
                    { id: 'tx_full', type: 'expense', category: 'Loans', note: 'Δόση Δανείου', amount: 100, date: '2026-09-10' },
                    { id: 'tx_partial_noise', type: 'expense', category: 'Loans', note: 'Δόση Δανείου', amount: 60, date: '2026-09-05' }
                ],
                referenceDate: '2026-09-12'
            });

            const item = result.items[0];
            assert.strictEqual(item.status, 'paid');
            assert.strictEqual(item.paidAmount, 100);
            assert.strictEqual(item.pendingAmount, 0);
            assert.strictEqual(result.totalPending, 0);
        });

        test('templates restricted to other months or years are ignored', () => {
            const templates = [
                { id: 'oct_tpl', type: 'expense', category: 'Bills', note: 'Service', amount: 40, preset: 'specific_months', months: [10], startDate: '2026-01-08' },
                { id: 'next_year_tpl', type: 'expense', category: 'Bills', note: 'Insurance', amount: 200, preset: 'yearly', startDate: '2027-09-01', years: [2027] }
            ];

            const result = SubscriptionEngine.analyzeMonthlySubscriptions({
                templates: templates,
                transactions: [],
                referenceDate: '2026-09-25'
            });

            assert.strictEqual(result.countTotal, 0);
            assert.strictEqual(result.totalMonthly, 0);
        });
    });
});
