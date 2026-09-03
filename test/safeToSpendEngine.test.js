'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const SafeToSpendEngine = require('../js/SafeToSpendEngine.js');

describe('SafeToSpendEngine Unit Tests', () => {

    describe('1. Daily Safe-to-Spend (calculateDailySafeToSpend)', () => {
        test('calculates safe daily and weekly limit correctly in healthy state', () => {
            // Day 11 of a 30-day month (e.g. Sept 11). Days remaining = 30 - 11 + 1 = 20 days.
            const result = SafeToSpendEngine.calculateDailySafeToSpend({
                currentBalance: 1200,
                unpaidRecurringBills: 400,
                savingsGoal: 100,
                referenceDate: '2026-09-11'
            });

            assert.strictEqual(result.currentBalance, 1200);
            assert.strictEqual(result.committedExpenses, 500);
            assert.strictEqual(result.discretionaryPool, 700);
            assert.strictEqual(result.daysRemaining, 20);
            assert.strictEqual(result.safeDaily, 35); // 700 / 20 = 35.00
            assert.strictEqual(result.safeWeekly, 245); // 35 * 7 = 245.00
            assert.strictEqual(result.status, 'healthy');
        });

        test('flags caution when discretionary pool is tight (<10/day)', () => {
            // 10 days remaining in month. Balance 460, bills 400. Pool = 60. Daily = 6.00
            const result = SafeToSpendEngine.calculateDailySafeToSpend({
                currentBalance: 460,
                unpaidRecurringBills: 400,
                savingsGoal: 0,
                referenceDate: '2026-09-21' // 30 - 21 + 1 = 10 days
            });

            assert.strictEqual(result.discretionaryPool, 60);
            assert.strictEqual(result.safeDaily, 6);
            assert.strictEqual(result.status, 'caution');
        });

        test('flags critical status and 0 daily when balance is less than committed bills (deficit risk)', () => {
            const result = SafeToSpendEngine.calculateDailySafeToSpend({
                currentBalance: 300,
                unpaidRecurringBills: 500,
                savingsGoal: 50,
                referenceDate: '2026-09-15'
            });

            assert.strictEqual(result.discretionaryPool, -250);
            assert.strictEqual(result.safeDaily, 0);
            assert.strictEqual(result.safeWeekly, 0);
            assert.strictEqual(result.status, 'critical');
        });

        test('handles last day of the month gracefully', () => {
            // Sept 30 is the last day. Days remaining = 1.
            const result = SafeToSpendEngine.calculateDailySafeToSpend({
                currentBalance: 500,
                unpaidRecurringBills: 200,
                referenceDate: '2026-09-30'
            });

            assert.strictEqual(result.daysRemaining, 1);
            assert.strictEqual(result.discretionaryPool, 300);
            assert.strictEqual(result.safeDaily, 300);
            assert.strictEqual(result.safeWeekly, 300);
        });
    });

    describe('2. Cashflow Forecast & Timeline (calculateCashflowForecast)', () => {
        test('projects timeline accurately without deficit', () => {
            const forecast = SafeToSpendEngine.calculateCashflowForecast({
                currentBalance: 1000,
                projectedIncome: [
                    { date: '2026-09-15', amount: 500, note: 'Freelance payment' }
                ],
                unpaidBills: [
                    { date: '2026-09-10', amount: 300, note: 'Rent share' }
                ],
                avgDailyDiscretionary: 20,
                referenceDate: '2026-09-08'
            });

            assert.strictEqual(forecast.startBalance, 1000);
            assert.strictEqual(forecast.hasDeficit, false);
            assert.strictEqual(forecast.deficitDate, null);
            assert.strictEqual(forecast.daysProjected, 23); // Sept 8 to Sept 30
            assert.ok(forecast.endBalance > 0);
        });

        test('detects mid-month cash crunch before payday', () => {
            // User has 200 today (Sept 5). Rent of 400 is due Sept 10. Payday of 1200 is Sept 15.
            const forecast = SafeToSpendEngine.calculateCashflowForecast({
                currentBalance: 200,
                projectedIncome: [
                    { date: '2026-09-15', amount: 1200, note: 'Salary' }
                ],
                unpaidBills: [
                    { date: '2026-09-10', amount: 400, note: 'Rent' }
                ],
                avgDailyDiscretionary: 15,
                referenceDate: '2026-09-05'
            });

            assert.strictEqual(forecast.hasDeficit, true);
            assert.strictEqual(forecast.deficitDate, '2026-09-10');
            assert.ok(forecast.lowestDip.balance < 0);
        });
    });

    describe('3. What-If Purchase Simulator (simulatePurchase)', () => {
        test('evaluates comfortable purchase', () => {
            const safeState = SafeToSpendEngine.calculateDailySafeToSpend({
                currentBalance: 1500,
                unpaidRecurringBills: 300,
                referenceDate: '2026-09-10' // 21 days remaining
            });

            const simulation = SafeToSpendEngine.simulatePurchase({
                purchaseAmount: 80,
                installments: 1,
                safeToSpendState: safeState
            });

            assert.strictEqual(simulation.isAffordable, true);
            assert.strictEqual(simulation.verdict, 'comfortable');
            assert.ok(simulation.newSafeDaily > 50);
        });

        test('evaluates installment option turning unaffordable purchase into feasible', () => {
            // User has pool of €300 remaining
            const safeState = SafeToSpendEngine.calculateDailySafeToSpend({
                currentBalance: 600,
                unpaidRecurringBills: 300,
                referenceDate: '2026-09-15' // 16 days remaining
            });

            // 1. Upfront €500 purchase is unaffordable
            const upfrontSim = SafeToSpendEngine.simulatePurchase({
                purchaseAmount: 500,
                installments: 1,
                safeToSpendState: safeState
            });
            assert.strictEqual(upfrontSim.isAffordable, false);
            assert.strictEqual(upfrontSim.verdict, 'unaffordable');

            // 2. In 3 installments (€166.67/mo), it is affordable
            const installmentSim = SafeToSpendEngine.simulatePurchase({
                purchaseAmount: 500,
                installments: 3,
                safeToSpendState: safeState
            });
            assert.strictEqual(installmentSim.isAffordable, true);
            assert.strictEqual(installmentSim.verdict, 'tight');
        });
    });

    describe('4. Couple / Family Settle-Up (calculateCoupleSettleUp)', () => {
        const members = [
            { id: 'usr_marios', name: 'Μάριος' },
            { id: 'usr_vasoula', name: 'Βασούλα' }
        ];

        test('calculates 50/50 split and net settlement correctly', () => {
            const transactions = [
                { amount: 120, user_id: 'usr_marios', type: 'expense', is_shared: true }, // Supermarket
                { amount: 80, user_id: 'usr_marios', type: 'expense', is_shared: true },  // Utilities
                { amount: 60, user_id: 'usr_vasoula', type: 'expense', is_shared: true }, // Groceries
                { amount: 40, user_id: 'usr_marios', type: 'expense', is_shared: false }  // Personal (excluded)
            ];

            const result = SafeToSpendEngine.calculateCoupleSettleUp(transactions, members);

            assert.strictEqual(result.totalSharedExpenses, 260); // 120 + 80 + 60 = 260
            assert.strictEqual(result.transactionCount, 3);

            // Marios paid 200, Vasoula paid 60. Fair share: 130 each.
            // Vasoula owes Marios 70.
            assert.strictEqual(result.settlement.amount, 70);
            assert.strictEqual(result.settlement.from.name, 'Βασούλα');
            assert.strictEqual(result.settlement.to.name, 'Μάριος');
        });

        test('reports balanced settlement when expenses are equal', () => {
            const transactions = [
                { amount: 100, user_id: 'usr_marios', type: 'expense', is_shared: true },
                { amount: 100, user_id: 'usr_vasoula', type: 'expense', is_shared: true }
            ];

            const result = SafeToSpendEngine.calculateCoupleSettleUp(transactions, members);
            assert.strictEqual(result.settlement.amount, 0);
            assert.strictEqual(result.settlement.from, null);
        });

        test('supports custom split ratio (e.g. 60/40)', () => {
            const transactions = [
                { amount: 200, user_id: 'usr_marios', type: 'expense', is_shared: true },
                { amount: 100, user_id: 'usr_vasoula', type: 'expense', is_shared: true }
            ];

            // 60% Marios (180), 40% Vasoula (120). Total = 300.
            // Marios paid 200 (overpaid by 20). Vasoula paid 100 (underpaid by 20).
            const result = SafeToSpendEngine.calculateCoupleSettleUp(transactions, members, {
                usr_marios: 0.6,
                usr_vasoula: 0.4
            });

            assert.strictEqual(result.settlement.amount, 20);
            assert.strictEqual(result.settlement.from.name, 'Βασούλα');
            assert.strictEqual(result.settlement.to.name, 'Μάριος');
        });
    });
});
