/**
 * SafeToSpendEngine.js
 *
 * Core financial intelligence engine for Budget Assistant.
 *
 * Provides pure, deterministic mathematical models for:
 * 1. Daily Safe-to-Spend limit (Free tier)
 * 2. Cashflow Forecast & Timeline (Premium tier)
 * 3. "What-If" Purchase Simulator (Premium tier)
 * 4. Couple / Family Settle-Up calculations (Premium tier)
 *
 * UMD wrapper: CommonJS for Node.js test runner + window.SafeToSpendEngine in browser.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node / CommonJS
        module.exports = factory();
    } else {
        // Browser global
        root.SafeToSpendEngine = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /**
     * Helpers for date and calendar calculations.
     */
    function parseDate(d) {
        if (!d) return new Date();
        if (d instanceof Date) return new Date(d.getTime());
        var str = String(d).trim();
        // Standard YYYY-MM-DD format
        var parts = str.split('T')[0].split(' ')[0].split('-');
        if (parts.length === 3) {
            var y = parseInt(parts[0], 10);
            var m = parseInt(parts[1], 10) - 1;
            var day = parseInt(parts[2], 10);
            return new Date(y, m, day);
        }
        var parsed = new Date(str);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    }

    function formatDateKey(date) {
        var y = date.getFullYear();
        var m = String(date.getMonth() + 1).padStart(2, '0');
        var d = String(date.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    }

    function getDaysInMonth(year, monthIndex) {
        return new Date(year, monthIndex + 1, 0).getDate();
    }

    function getRemainingDaysInMonth(referenceDate) {
        var d = parseDate(referenceDate);
        var totalDays = getDaysInMonth(d.getFullYear(), d.getMonth());
        var currentDay = d.getDate();
        // Includes the current day as an available spending day
        return Math.max(1, totalDays - currentDay + 1);
    }

    /**
     * 1. DAILY SAFE-TO-SPEND (Free Tier)
     * Calculates the safe amount the user can spend today and this week
     * without compromising unpaid recurring bills or their monthly savings goal.
     *
     * @param {Object} params
     * @param {number} params.currentBalance - Liquid available money (cash + checking)
     * @param {number} [params.unpaidRecurringBills=0] - Sum of bills due before month end
     * @param {number} [params.savingsGoal=0] - User's monthly savings target
     * @param {Date|string} [params.referenceDate] - Current date (defaults to today)
     * @returns {Object} Safe-to-spend breakdown
     */
    function calculateDailySafeToSpend(params) {
        params = params || {};
        var balance = typeof params.currentBalance === 'number' && !isNaN(params.currentBalance)
            ? params.currentBalance
            : 0;
        var unpaidBills = typeof params.unpaidRecurringBills === 'number' && !isNaN(params.unpaidRecurringBills)
            ? Math.max(0, params.unpaidRecurringBills)
            : 0;
        var savingsGoal = typeof params.savingsGoal === 'number' && !isNaN(params.savingsGoal)
            ? Math.max(0, params.savingsGoal)
            : 0;

        var refDate = parseDate(params.referenceDate);
        var daysRemaining = getRemainingDaysInMonth(refDate);

        var committedExpenses = unpaidBills + savingsGoal;
        var discretionaryPool = balance - committedExpenses;

        var safeDaily = 0;
        var status = 'healthy';

        if (discretionaryPool <= 0) {
            safeDaily = 0;
            status = 'critical'; // At risk of deficit / overdraft
        } else {
            safeDaily = discretionaryPool / daysRemaining;
            if (safeDaily < 10 || discretionaryPool < committedExpenses * 0.15) {
                status = 'caution';
            } else {
                status = 'healthy';
            }
        }

        var safeWeekly = safeDaily * Math.min(7, daysRemaining);

        return {
            currentBalance: Math.round(balance * 100) / 100,
            unpaidRecurringBills: Math.round(unpaidBills * 100) / 100,
            savingsGoal: Math.round(savingsGoal * 100) / 100,
            committedExpenses: Math.round(committedExpenses * 100) / 100,
            discretionaryPool: Math.round(discretionaryPool * 100) / 100,
            daysRemaining: daysRemaining,
            safeDaily: Math.round(safeDaily * 100) / 100,
            safeWeekly: Math.round(safeWeekly * 100) / 100,
            status: status
        };
    }

    /**
     * 2. CASHFLOW FORECAST & TIMELINE (Premium Tier)
     * Projects the daily bank balance until the end of the month by simulating
     * incoming salaries, outgoing recurring payments on their exact due dates,
     * and daily variable spending.
     *
     * @param {Object} params
     * @param {number} params.currentBalance
     * @param {Array<{ date: string, amount: number, note?: string }>} [params.projectedIncome=[]]
     * @param {Array<{ date: string, amount: number, note?: string }>} [params.unpaidBills=[]]
     * @param {number} [params.avgDailyDiscretionary=0]
     * @param {Date|string} [params.referenceDate]
     * @returns {Object} Cashflow trajectory & risk detection
     */
    function calculateCashflowForecast(params) {
        params = params || {};
        var balance = typeof params.currentBalance === 'number' && !isNaN(params.currentBalance)
            ? params.currentBalance
            : 0;
        var incomeList = Array.isArray(params.projectedIncome) ? params.projectedIncome : [];
        var billsList = Array.isArray(params.unpaidBills) ? params.unpaidBills : [];
        var dailyBurn = typeof params.avgDailyDiscretionary === 'number' && !isNaN(params.avgDailyDiscretionary)
            ? Math.max(0, params.avgDailyDiscretionary)
            : 0;

        var start = parseDate(params.referenceDate);
        var year = start.getFullYear();
        var month = start.getMonth();
        var totalDays = getDaysInMonth(year, month);
        var currentDay = start.getDate();

        // Index scheduled income and bills by YYYY-MM-DD
        var incomeMap = {};
        incomeList.forEach(function (item) {
            if (!item || typeof item.amount !== 'number') return;
            var key = String(item.date).split('T')[0].trim();
            incomeMap[key] = (incomeMap[key] || 0) + item.amount;
        });

        var billsMap = {};
        billsList.forEach(function (item) {
            if (!item || typeof item.amount !== 'number') return;
            var key = String(item.date).split('T')[0].trim();
            billsMap[key] = (billsMap[key] || 0) + item.amount;
        });

        var runningBalance = balance;
        var timeline = [];
        var lowestDip = { date: formatDateKey(start), balance: balance };
        var deficitDate = null;

        for (var day = currentDay; day <= totalDays; day++) {
            var currDate = new Date(year, month, day);
            var dateKey = formatDateKey(currDate);

            var dayIncome = incomeMap[dateKey] || 0;
            var dayBills = billsMap[dateKey] || 0;

            // Apply scheduled transactions
            runningBalance += dayIncome;
            runningBalance -= dayBills;

            // Subtract daily discretionary burn (except for past days)
            if (day > currentDay) {
                runningBalance -= dailyBurn;
            }

            var snapshot = {
                date: dateKey,
                day: day,
                income: dayIncome,
                bills: dayBills,
                discretionaryBurn: day > currentDay ? dailyBurn : 0,
                balance: Math.round(runningBalance * 100) / 100
            };
            timeline.push(snapshot);

            if (runningBalance < lowestDip.balance) {
                lowestDip = { date: dateKey, balance: Math.round(runningBalance * 100) / 100 };
            }

            if (runningBalance < 0 && !deficitDate) {
                deficitDate = dateKey;
            }
        }

        return {
            startBalance: Math.round(balance * 100) / 100,
            endBalance: Math.round(runningBalance * 100) / 100,
            lowestDip: lowestDip,
            hasDeficit: lowestDip.balance < 0,
            deficitDate: deficitDate,
            daysProjected: timeline.length,
            timeline: timeline
        };
    }

    /**
     * 3. "WHAT-IF" PURCHASE SIMULATOR (Premium Tier)
     * Simulates the impact of an immediate purchase (or installment plan)
     * on the user's Safe-to-Spend and cashflow trajectory.
     *
     * @param {Object} params
     * @param {number} params.purchaseAmount - Total price of item
     * @param {number} [params.installments=1] - Number of monthly installments (1 = upfront)
     * @param {Object} params.safeToSpendState - Output from calculateDailySafeToSpend
     * @param {Object} [params.forecastState] - Optional output from calculateCashflowForecast
     * @returns {Object} Affordability assessment & recommendation
     */
    function simulatePurchase(params) {
        params = params || {};
        var amount = typeof params.purchaseAmount === 'number' && !isNaN(params.purchaseAmount)
            ? Math.max(0, params.purchaseAmount)
            : 0;
        var installments = typeof params.installments === 'number' && params.installments > 0
            ? Math.round(params.installments)
            : 1;

        var state = params.safeToSpendState || calculateDailySafeToSpend();
        var monthlyCharge = amount / installments;
        var immediateCharge = monthlyCharge; // Charge for current month

        var currentDiscretionary = state.discretionaryPool;
        var newDiscretionary = currentDiscretionary - immediateCharge;
        var daysRemaining = state.daysRemaining || 1;

        var isAffordable = newDiscretionary >= 0;
        var newDaily = isAffordable ? newDiscretionary / daysRemaining : 0;
        var dailyImpact = Math.max(0, state.safeDaily - newDaily);

        var causesCashDeficit = false;
        var deficitDate = null;

        if (params.forecastState && params.forecastState.timeline) {
            // Check if adding this charge causes any day's balance to dip below 0
            for (var i = 0; i < params.forecastState.timeline.length; i++) {
                var point = params.forecastState.timeline[i];
                if (point.balance - immediateCharge < 0) {
                    causesCashDeficit = true;
                    deficitDate = point.date;
                    break;
                }
            }
        } else {
            causesCashDeficit = !isAffordable;
        }

        var verdict = 'comfortable';
        var recommendation = '';

        if (!isAffordable || causesCashDeficit) {
            verdict = 'unaffordable';
            recommendation = installments === 1 && amount > 150
                ? 'Η άμεση αγορά θα σας οδηγήσει σε έλλειμμα. Εξετάστε αγορά με 3+ άτοκες δόσεις ή αναμονή για τον επόμενο μισθό.'
                : 'Η αγορά αυτή θα δημιουργήσει έλλειμμα στον προϋπολογισμό σας. Συνιστάται αναβολή.';
        } else if (newDaily < 12) {
            verdict = 'tight';
            recommendation = 'Εφικτή αγορά, αλλά το ημερήσιο όριό σας θα μειωθεί σημαντικά. Απαιτείται προσοχή στα έξοδα.';
        } else {
            verdict = 'comfortable';
            recommendation = 'Απόλυτα βιώσιμη αγορά! Το Safe-to-Spend σας παραμένει σε υγιές επίπεδο.';
        }

        return {
            purchaseAmount: amount,
            installments: installments,
            monthlyPayment: Math.round(monthlyCharge * 100) / 100,
            isAffordable: isAffordable && !causesCashDeficit,
            verdict: verdict,
            currentSafeDaily: state.safeDaily,
            newSafeDaily: Math.round(newDaily * 100) / 100,
            dailyDrop: Math.round(dailyImpact * 100) / 100,
            newDiscretionaryPool: Math.round(newDiscretionary * 100) / 100,
            causesCashDeficit: causesCashDeficit,
            deficitDate: deficitDate,
            recommendation: recommendation
        };
    }

    /**
     * 4. COUPLE / FAMILY SETTLE-UP ENGINE (Premium Tier)
     * Calculates shared household expenses between partners and computes
     * the net settlement balance ("Who owes whom").
     *
     * @param {Array<Object>} transactions - List of transactions
     * @param {Array<{ id: string, name: string }>} members - Couple members (2 users)
     * @param {Object} [splitRatio] - Custom split ratio, e.g. { user1: 0.5, user2: 0.5 }
     * @returns {Object} Settle-up balance
     */
    function calculateCoupleSettleUp(transactions, members, splitRatio) {
        transactions = Array.isArray(transactions) ? transactions : [];
        members = Array.isArray(members) ? members : [];

        var member1 = members[0] || { id: 'user_1', name: 'Μέλος 1' };
        var member2 = members[1] || { id: 'user_2', name: 'Μέλος 2' };

        var ratio1 = (splitRatio && typeof splitRatio[member1.id] === 'number') ? splitRatio[member1.id] : 0.5;
        var ratio2 = (splitRatio && typeof splitRatio[member2.id] === 'number') ? splitRatio[member2.id] : 0.5;

        var totalShared = 0;
        var paid1 = 0;
        var paid2 = 0;
        var sharedCount = 0;

        transactions.forEach(function (tx) {
            if (!tx || tx.type !== 'expense') return;
            // Only count if marked as shared or family expense
            if (tx.is_shared === false) return;

            var amt = typeof tx.amount === 'number' ? Math.abs(tx.amount) : parseFloat(tx.amount) || 0;
            totalShared += amt;
            sharedCount++;

            var payer = tx.user_id || tx.paid_by || tx.member_id;
            if (payer === member1.id) {
                paid1 += amt;
            } else if (payer === member2.id) {
                paid2 += amt;
            } else {
                // If payer is unspecified, attribute equally as baseline
                paid1 += amt / 2;
                paid2 += amt / 2;
            }
        });

        var fairShare1 = totalShared * ratio1;
        var fairShare2 = totalShared * ratio2;

        var net1 = paid1 - fairShare1; // positive = paid more than fair share (is owed)
        var net2 = paid2 - fairShare2;

        var settlement = null;
        if (Math.abs(net1) >= 0.01) {
            if (net1 > 0) {
                settlement = {
                    from: member2,
                    to: member1,
                    amount: Math.round(net1 * 100) / 100,
                    message: member2.name + ' χρωστάει ' + (Math.round(net1 * 100) / 100).toFixed(2) + '€ σε ' + member1.name
                };
            } else {
                settlement = {
                    from: member1,
                    to: member2,
                    amount: Math.round(Math.abs(net1) * 100) / 100,
                    message: member1.name + ' χρωστάει ' + (Math.round(Math.abs(net1) * 100) / 100).toFixed(2) + '€ σε ' + member2.name
                };
            }
        } else {
            settlement = {
                from: null,
                to: null,
                amount: 0,
                message: 'Τα κοινά έξοδα είναι απόλυτα ισοσκελισμένα (50-50).'
            };
        }

        return {
            totalSharedExpenses: Math.round(totalShared * 100) / 100,
            transactionCount: sharedCount,
            members: [
                { id: member1.id, name: member1.name, paid: Math.round(paid1 * 100) / 100, fairShare: Math.round(fairShare1 * 100) / 100 },
                { id: member2.id, name: member2.name, paid: Math.round(paid2 * 100) / 100, fairShare: Math.round(fairShare2 * 100) / 100 }
            ],
            settlement: settlement
        };
    }

    return {
        getDaysInMonth: getDaysInMonth,
        getRemainingDaysInMonth: getRemainingDaysInMonth,
        calculateDailySafeToSpend: calculateDailySafeToSpend,
        calculateCashflowForecast: calculateCashflowForecast,
        simulatePurchase: simulatePurchase,
        calculateCoupleSettleUp: calculateCoupleSettleUp
    };
});
