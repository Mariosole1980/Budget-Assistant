/**
 * SubscriptionEngine.js
 *
 * Core financial intelligence engine for Recurring Expenses & Subscriptions in Budget Assistant.
 *
 * Provides pure, deterministic calculation logic for:
 * 1. Monthly Subscription Status Analysis (Paid vs Pending for the current calendar month)
 * 2. Transaction-to-Recurring matching (checks if an occurrence has been logged)
 * 3. Smart Recurring Pattern Detection (scans past transactions for repeating subscriptions/bills)
 *
 * UMD wrapper: Node.js test runner + window.SubscriptionEngine in browser.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node / CommonJS
        module.exports = factory();
    } else {
        // Browser global
        root.SubscriptionEngine = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function parseDate(d) {
        if (!d) return new Date();
        if (d instanceof Date) return new Date(d.getTime());
        var str = String(d).trim();
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

    function normalizeText(text) {
        if (!text) return '';
        return String(text)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // remove diacritics / accents
            .replace(/[^\w\s]/g, ' ') // replace punctuation with spaces
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Determines the expected due day of the month for a recurring template.
     * Returns null if the template does not apply to the target year/month.
     */
    function getDueDayForMonth(template, year, monthIndex) {
        if (!template) return null;

        var maxDays = getDaysInMonth(year, monthIndex);
        var targetMonthStart = new Date(year, monthIndex, 1);
        var targetMonthEnd = new Date(year, monthIndex, maxDays, 23, 59, 59, 999);

        // Check start date
        var startDateStr = template.startDate || template.start_date;
        if (startDateStr) {
            var startDate = parseDate(startDateStr);
            if (startDate > targetMonthEnd) {
                return null; // Not started yet
            }
        }

        // Check end date
        var endDateStr = template.endDate || template.end_date;
        var endType = template.endType || template.end_type;
        if ((endType === 'date' || endDateStr) && endDateStr) {
            var endDate = parseDate(endDateStr);
            if (endDate < targetMonthStart) {
                return null; // Expired before this month
            }
        }

        var preset = template.preset || 'monthly';

        // Specific months restriction (if array is provided)
        var monthsArray = template.months;
        if (Array.isArray(monthsArray) && monthsArray.length > 0) {
            var hasMonth = monthsArray.some(function (m) {
                return parseInt(m, 10) === monthIndex || parseInt(m, 10) === (monthIndex + 1);
            });
            if (!hasMonth) return null;
        }

        // Yearly preset check
        if (preset === 'yearly' && startDateStr) {
            var sDate = parseDate(startDateStr);
            if (sDate.getMonth() !== monthIndex) {
                return null; // Yearly but not this month
            }
        }

        // Calculate due day
        var rawDay = 1;
        if (Array.isArray(template.days) && template.days.length > 0) {
            rawDay = parseInt(template.days[0], 10) || 1;
        } else if (template.due_day || template.day_of_month) {
            rawDay = parseInt(template.due_day || template.day_of_month, 10) || 1;
        } else if (startDateStr) {
            rawDay = parseDate(startDateStr).getDate();
        }

        if (rawDay < 1) rawDay = 1;
        if (rawDay > maxDays) rawDay = maxDays;

        return rawDay;
    }

    /**
     * Checks if a logged transaction matches a recurring template.
     */
    function isTransactionMatchingTemplate(tx, template, year, monthIndex) {
        if (!tx || !template) return false;

        var txDate = parseDate(tx.date);
        if (txDate.getFullYear() !== year || txDate.getMonth() !== monthIndex) {
            return false;
        }

        // 1. Direct ID match
        var tplId = String(template.id || '');
        var txTplId = String(tx.recurring_template_id || tx.recurringTemplateId || '');
        if (tplId && txTplId && tplId === txTplId) {
            return true;
        }

        // Type match ('expense' vs 'income')
        var tplType = (template.type || 'expense').toLowerCase();
        var txType = (tx.type || 'expense').toLowerCase();
        if (tplType !== txType) return false;

        var tplNoteNorm = normalizeText(template.note || template.title || '');
        var txNoteNorm = normalizeText(tx.note || tx.description || '');
        var tplCatNorm = normalizeText(template.category || '');
        var txCatNorm = normalizeText(tx.category || '');

        var tplAmt = Math.abs(parseFloat(template.amount) || 0);
        var txAmt = Math.abs(parseFloat(tx.amount) || 0);
        var amtDiff = Math.abs(tplAmt - txAmt);

        // 2. Exact note match with close or exact amount
        if (tplNoteNorm && txNoteNorm && (tplNoteNorm === txNoteNorm || txNoteNorm.indexOf(tplNoteNorm) !== -1 || tplNoteNorm.indexOf(txNoteNorm) !== -1)) {
            if (amtDiff <= Math.max(2.0, tplAmt * 0.15)) {
                return true;
            }
        }

        // 3. Category match and exact amount
        if (tplCatNorm && txCatNorm && tplCatNorm === txCatNorm && amtDiff < 0.05) {
            return true;
        }

        return false;
    }

    /**
     * Analyzes monthly subscription status for the current calendar month.
     * Returns total monthly amount, total paid, total pending, and itemized breakdowns.
     */
    function analyzeMonthlySubscriptions(params) {
        params = params || {};
        var templates = Array.isArray(params.templates) ? params.templates : [];
        var transactions = Array.isArray(params.transactions) ? params.transactions : [];
        var refDate = parseDate(params.referenceDate);

        var year = refDate.getFullYear();
        var monthIndex = refDate.getMonth();
        var currentDay = refDate.getDate();
        var maxDays = getDaysInMonth(year, monthIndex);

        var items = [];
        var totalMonthly = 0;
        var totalPaid = 0;
        var totalPending = 0;
        var countPaid = 0;
        var countPending = 0;

        // Used transactions tracker so one transaction doesn't match multiple templates
        var matchedTxIds = new Set();

        templates.forEach(function (tpl) {
            var tplType = (tpl.type || 'expense').toLowerCase();
            if (tplType !== 'expense') return; // Only expense subscriptions count against budget

            var dueDay = getDueDayForMonth(tpl, year, monthIndex);
            if (dueDay === null) return; // Not active this month

            var amount = Math.abs(parseFloat(tpl.amount) || 0);
            totalMonthly += amount;

            // Find matching transaction this month that hasn't been paired yet
            var matchedTx = null;
            for (var i = 0; i < transactions.length; i++) {
                var tx = transactions[i];
                var txId = tx.id ? String(tx.id) : ('tx_' + i);
                if (matchedTxIds.has(txId)) continue;

                if (isTransactionMatchingTemplate(tx, tpl, year, monthIndex)) {
                    matchedTx = tx;
                    matchedTxIds.add(txId);
                    break;
                }
            }

            var isPaid = !!matchedTx;
            var isOverdue = !isPaid && (currentDay > dueDay);
            var daysUntilDue = dueDay - currentDay;

            if (isPaid) {
                var actualPaidAmt = Math.abs(parseFloat(matchedTx.amount) || amount);
                totalPaid += actualPaidAmt;
                countPaid++;
            } else {
                totalPending += amount;
                countPending++;
            }

            var dueDateStr = year + '-' + String(monthIndex + 1).padStart(2, '0') + '-' + String(dueDay).padStart(2, '0');

            items.push({
                id: tpl.id || ('tpl_' + Math.random()),
                template: tpl,
                title: tpl.note || tpl.category || 'Subscription',
                category: tpl.category || 'General',
                amount: amount,
                currency: tpl.currency || 'EUR',
                preset: tpl.preset || 'monthly',
                dueDay: dueDay,
                dueDate: dueDateStr,
                status: isPaid ? 'paid' : 'pending',
                isPaid: isPaid,
                isOverdue: isOverdue,
                daysUntilDue: daysUntilDue,
                matchedTransaction: matchedTx
            });
        });

        // Sort items by dueDay ascending, then unpaid first
        items.sort(function (a, b) {
            if (a.isPaid !== b.isPaid) {
                return a.isPaid ? 1 : -1; // Pending first
            }
            return a.dueDay - b.dueDay;
        });

        return {
            referenceDate: formatDateKey(refDate),
            year: year,
            monthIndex: monthIndex,
            currentDay: currentDay,
            daysInMonth: maxDays,
            totalMonthly: Math.round(totalMonthly * 100) / 100,
            totalPaid: Math.round(totalPaid * 100) / 100,
            totalPending: Math.round(totalPending * 100) / 100,
            countTotal: items.length,
            countPaid: countPaid,
            countPending: countPending,
            items: items
        };
    }

    /**
     * Smart Recurring Pattern Detection (Leak Detector)
     * Scans transaction history for repeating recurring expenses and suggests them as templates.
     */
    function detectRecurringPatterns(params) {
        params = params || {};
        var transactions = Array.isArray(params.transactions) ? params.transactions : [];
        var existingTemplates = Array.isArray(params.existingTemplates) ? params.existingTemplates : [];
        var minOccurrences = typeof params.minOccurrences === 'number' ? params.minOccurrences : 2;

        var existingNotes = new Set();
        existingTemplates.forEach(function (tpl) {
            if (tpl.note) existingNotes.add(normalizeText(tpl.note));
            if (tpl.title) existingNotes.add(normalizeText(tpl.title));
        });

        // 1. Filter expense transactions from last 90 days
        var now = parseDate(params.referenceDate);
        var ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));

        var expenses = transactions.filter(function (t) {
            if (!t || (t.type && t.type !== 'expense')) return false;
            var d = parseDate(t.date);
            return d >= ninetyDaysAgo && d <= now;
        });

        // 2. Group transactions by normalized note / category
        var groups = {};
        expenses.forEach(function (t) {
            var noteNorm = normalizeText(t.note || t.description || '');
            if (!noteNorm || noteNorm.length < 3) return;

            // Skip if already in existing recurring templates
            if (existingNotes.has(noteNorm)) return;

            if (!groups[noteNorm]) {
                groups[noteNorm] = [];
            }
            groups[noteNorm].push(t);
        });

        // 3. Evaluate each candidate group for recurring cadence
        var suggestions = [];

        Object.keys(groups).forEach(function (noteKey) {
            var txList = groups[noteKey];
            if (txList.length < minOccurrences) return;

            // Sort by date
            txList.sort(function (a, b) {
                return parseDate(a.date) - parseDate(b.date);
            });

            // Check amounts consistency
            var amounts = txList.map(function (t) { return Math.abs(parseFloat(t.amount) || 0); });
            var sum = amounts.reduce(function (a, b) { return a + b; }, 0);
            var avgAmount = sum / amounts.length;

            var amountSpread = Math.max.apply(null, amounts) - Math.min.apply(null, amounts);
            if (amountSpread > Math.max(3.0, avgAmount * 0.15)) {
                return;
            }

            // Check intervals
            var intervals = [];
            for (var i = 1; i < txList.length; i++) {
                var prevD = parseDate(txList[i - 1].date);
                var currD = parseDate(txList[i].date);
                var diffDays = Math.round((currD - prevD) / (1000 * 60 * 60 * 24));
                intervals.push(diffDays);
            }

            var isMonthlyCadence = intervals.every(function (days) {
                return days >= 24 && days <= 36;
            });

            if (isMonthlyCadence || (txList.length >= 2 && intervals.length > 0)) {
                var latestTx = txList[txList.length - 1];
                var suggestedDay = parseDate(latestTx.date).getDate();

                suggestions.push({
                    note: latestTx.note || noteKey,
                    category: latestTx.category || 'Bills',
                    amount: Math.round(avgAmount * 100) / 100,
                    currency: latestTx.currency || 'EUR',
                    suggestedDay: suggestedDay,
                    frequency: 'monthly',
                    occurrences: txList.length,
                    sampleTransactions: txList.slice(-3).map(function (t) {
                        return { id: t.id, date: t.date, amount: t.amount };
                    })
                });
            }
        });

        suggestions.sort(function (a, b) {
            return b.occurrences - a.occurrences;
        });

        return suggestions;
    }

    return {
        parseDate: parseDate,
        getDueDayForMonth: getDueDayForMonth,
        isTransactionMatchingTemplate: isTransactionMatchingTemplate,
        analyzeMonthlySubscriptions: analyzeMonthlySubscriptions,
        detectRecurringPatterns: detectRecurringPatterns
    };
});
