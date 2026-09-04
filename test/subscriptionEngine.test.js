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
});
