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
            .replace(/ς/g, 'σ') // normalize Greek final sigma
            .replace(/[^\p{L}\p{N}\s]/gu, ' ') // replace punctuation and emojis with spaces, keep unicode letters and digits
            .replace(/\s+/g, ' ')
            .trim();
    }

    var KNOWN_PRESETS = ['daily', 'weekly', 'monthly', 'yearly', 'specific_months', 'custom'];

    /**
     * Resolves the cadence preset of a template (legacy templates default to monthly).
     */
    function getPreset(template) {
        var preset = String((template && template.preset) || 'monthly').toLowerCase();
        return KNOWN_PRESETS.indexOf(preset) !== -1 ? preset : 'monthly';
    }

    /**
     * Parses the inline deleted_dates marker stored in template.description
     * ("... ||deleted_dates:YYYY-MM-DD,..."). Mirrors js/recurringDates.js so the
     * engine agrees with the transaction generator about skipped occurrences.
     */
    function getDeletedDates(template) {
        if (!template) return [];
        var desc = String(template.description || '');
        var match = desc.match(/\|\|deleted_dates:([^\s]+)/);
        return match ? match[1].split(',').filter(function (d) { return !!d; }) : [];
    }

    function toIntArray(value) {
        if (!Array.isArray(value)) return [];
        var out = [];
        value.forEach(function (v) {
            var n = parseInt(v, 10);
            if (!isNaN(n)) out.push(n);
        });
        return out;
    }

    /**
     * Determines ALL due days of the target month for a recurring template.
     *
     * Honours the cadence preset (daily / weekly / monthly / yearly /
     * specific_months / custom), multiple days per month, month & year
     * restrictions, start/end dates and deleted occurrences.
     * Returns [] when the template does not apply to the target month.
     *
     * NOTE: weekly cadence repeats on the weekday of the start date, exactly like
     * the occurrence generator in js/recurringDates.js.
     */
    function getDueDaysForMonth(template, year, monthIndex) {
        if (!template) return [];

        var maxDays = getDaysInMonth(year, monthIndex);
        var monthNum = monthIndex + 1;
        var targetMonthStart = new Date(year, monthIndex, 1);
        var targetMonthEnd = new Date(year, monthIndex, maxDays, 23, 59, 59, 999);

        var startDateStr = template.startDate || template.start_date || null;
        var startDate = startDateStr ? parseDate(startDateStr) : null;
        if (startDate && startDate > targetMonthEnd) {
            return []; // Not started yet
        }

        var endDateStr = template.endDate || template.end_date || null;
        var endType = template.endType || template.end_type;
        if ((endType === 'date' || endDateStr) && endDateStr) {
            var endDate = parseDate(endDateStr);
            if (endDate < targetMonthStart) {
                return []; // Expired before this month
            }
        }

        // Year restriction (templates limited to specific years)
        var years = toIntArray(template.years);
        if (years.length > 0 && years.indexOf(year) === -1) {
            return [];
        }

        var preset = getPreset(template);
        var months = toIntArray(template.months);
        var days = toIntArray(template.days);
        var startDay = startDate ? startDate.getDate() : null;
        var startMonthIndex = startDate ? startDate.getMonth() : null;
        var dueDays = [];

        if (preset === 'monthly') {
            if (months.length > 0 && months.indexOf(monthNum) === -1) return [];
            var monthlyDay = 1;
            if (startDay) {
                monthlyDay = startDay;
            } else if (days.length > 0) {
                monthlyDay = days[0];
            } else if (template.due_day || template.day_of_month) {
                monthlyDay = parseInt(template.due_day || template.day_of_month, 10) || 1;
            }
            // Short months: clamp to the last day, like the occurrence generator does.
            dueDays = [Math.min(monthlyDay, maxDays)];
        } else if (preset === 'yearly') {
            if (startMonthIndex !== null && startMonthIndex !== monthIndex) return [];
            dueDays = [Math.min(startDay || (days.length > 0 ? days[0] : 1), maxDays)];
        } else if (preset === 'specific_months') {
            if (months.length === 0 || months.indexOf(monthNum) === -1) return [];
            dueDays = [Math.min(startDay || (days.length > 0 ? days[0] : 1), maxDays)];
        } else if (preset === 'custom') {
            // Legacy custom templates may not carry a months list; treat those as "every month".
            if (months.length > 0 && months.indexOf(monthNum) === -1) return [];
            var customDays = days.length > 0 ? days : (startDay ? [startDay] : []);
            dueDays = customDays.slice();
        } else if (preset === 'weekly') {
            var weekday = startDate ? startDate.getDay() : parseDate(null).getDay();
            for (var w = 1; w <= maxDays; w++) {
                if (new Date(year, monthIndex, w).getDay() === weekday) dueDays.push(w);
            }
        } else if (preset === 'daily') {
            for (var d = 1; d <= maxDays; d++) dueDays.push(d);
        }

        // Clamp to real month days and drop days before the first occurrence / after the
        // end date / deleted dates
        var deleted = getDeletedDates(template);
        var firstOccurrence = startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()) : null;
        var endDateValue = (endDateStr && (endType === 'date' || endDateStr)) ? parseDate(endDateStr) : null;
        var lastOccurrence = endDateValue ? new Date(endDateValue.getFullYear(), endDateValue.getMonth(), endDateValue.getDate()) : null;
        dueDays = dueDays.filter(function (day) {
            if (!(day >= 1 && day <= maxDays)) return false;
            var dateKey = year + '-' + String(monthNum).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            if (deleted.indexOf(dateKey) !== -1) return false;
            var occurrenceDate = new Date(year, monthIndex, day);
            if (firstOccurrence && occurrenceDate < firstOccurrence) return false;
            if (lastOccurrence && occurrenceDate > lastOccurrence) return false;
            return true;
        });

        dueDays.sort(function (a, b) { return a - b; });
        return dueDays;
    }

    /**
     * Legacy single-day helper: the first due day of the month, or null.
     */
    function getDueDayForMonth(template, year, monthIndex) {
        var dueDays = getDueDaysForMonth(template, year, monthIndex);
        return dueDays.length > 0 ? dueDays[0] : null;
    }

    /**
     * Checks if a logged transaction matches a recurring template.
     */
    function isTransactionMatchingTemplate(tx, template, year, monthIndex, referenceDate, options) {
        if (!tx || !template) return false;

        var txDate = parseDate(tx.date);
        if (txDate.getFullYear() !== year || txDate.getMonth() !== monthIndex) {
            return false;
        }

        // Μην μετράς μελλοντικές συναλλαγές ως "ήδη πληρωμένες" — δεν έχουν γίνει ακόμα
        var refD = (referenceDate instanceof Date && !isNaN(referenceDate)) ? referenceDate : new Date();
        var refDEnd = new Date(refD.getFullYear(), refD.getMonth(), refD.getDate(), 23, 59, 59, 999);
        if (txDate > refDEnd) {
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

        // 4. Partial payment (opt-in): the same bill paid in instalments, e.g.
        //    100 € bill paid 60 €. The analyzer reconciles the remainder via
        //    expectedTotal - paidAmount, so a partial transaction must still be
        //    paired with the template instead of leaving the full bill pending.
        if (options && options.allowPartial) {
            if (tplNoteNorm && txNoteNorm && tplNoteNorm === txNoteNorm && txAmt > 0) {
                return true;
            }
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
            if (!tpl) return;
            if (tpl.is_active === false || tpl.is_deleted === true) return; // Deactivated templates are not obligations

            var tplType = String(tpl.type || 'expense').toLowerCase();
            if (tplType !== 'expense') return; // Only expense subscriptions count against budget

            var dueDays = getDueDaysForMonth(tpl, year, monthIndex);
            if (dueDays.length === 0) return; // Not active this month

            var amount = Math.abs(parseFloat(tpl.amount) || 0);
            if (amount <= 0) return;

            var preset = getPreset(tpl);
            var monthPrefix = year + '-' + String(monthIndex + 1).padStart(2, '0') + '-';
            var todayKey = formatDateKey(refDate);

            // Weekly/daily cadences are budgeting rhythms rather than debts: occurrences
            // already in the past are not re-charged as pending. Low-frequency bills
            // (monthly / yearly / specific months / custom) keep overdue occurrences
            // pending, because those remain real unpaid obligations this month.
            var includePastUnpaid = (preset === 'monthly' || preset === 'yearly' || preset === 'specific_months' || preset === 'custom');
            var allOccurrences = dueDays.map(function (day) {
                var dateKey = monthPrefix + String(day).padStart(2, '0');
                return { day: day, date: dateKey, inFuture: dateKey >= todayKey };
            });
            if (allOccurrences.length === 0) return;

            // Collect candidate transactions: strict matches first, then partial payments
            var candidates = [];
            for (var i = 0; i < transactions.length; i++) {
                var tx = transactions[i];
                if (!tx) continue;
                var txId = tx.id ? String(tx.id) : ('tx_' + i);
                if (matchedTxIds.has(txId)) continue;

                if (isTransactionMatchingTemplate(tx, tpl, year, monthIndex, refDate)) {
                    candidates.push({ tx: tx, id: txId, strict: true });
                } else if (isTransactionMatchingTemplate(tx, tpl, year, monthIndex, refDate, { allowPartial: true })) {
                    candidates.push({ tx: tx, id: txId, strict: false });
                }
            }
            candidates.sort(function (a, b) {
                if (a.strict !== b.strict) return a.strict ? -1 : 1;
                var diffA = Math.abs(Math.abs(parseFloat(a.tx.amount) || 0) - amount);
                var diffB = Math.abs(Math.abs(parseFloat(b.tx.amount) || 0) - amount);
                return diffA - diffB;
            });

            // Pair at most one transaction per occurrence
            var matchedTxs = [];
            var pairCount = Math.min(candidates.length, allOccurrences.length);
            for (var p = 0; p < pairCount; p++) {
                matchedTxIds.add(candidates[p].id);
                matchedTxs.push(candidates[p].tx);
            }

            var paidAmount = 0;
            matchedTxs.forEach(function (tx) {
                paidAmount += Math.min(Math.abs(parseFloat(tx.amount) || amount), amount);
            });

            // Build the month's expected occurrences: every owed occurrence plus the ones
            // already (partially) paid, so totalMonthly === totalPaid + totalPending.
            var occurrences = [];
            var pendingAmount = 0;
            var dueOccurrence = null;
            allOccurrences.forEach(function (occ, idx) {
                var covered = Math.max(0, Math.min(amount, paidAmount - idx * amount));
                var remaining = Math.max(0, amount - covered);
                var isOwed = includePastUnpaid || occ.inFuture;
                if (!isOwed && covered <= 0.005) return; // elapsed cadence day, nothing paid: not part of this plan
                occurrences.push({ day: occ.day, date: occ.date, inFuture: occ.inFuture });
                if (remaining > 0.005 && isOwed) {
                    pendingAmount += remaining;
                    if (!dueOccurrence) dueOccurrence = occ;
                }
            });
            if (occurrences.length === 0) return;

            var expectedTotal = amount * occurrences.length;
            paidAmount = Math.min(paidAmount, expectedTotal);
            var isPaid = pendingAmount <= 0.005;
            if (!dueOccurrence) dueOccurrence = occurrences[occurrences.length - 1];
            var dueDay = dueOccurrence.day;
            var isOverdue = !isPaid && (currentDay > dueDay);
            var daysUntilDue = dueDay - currentDay;

            if (isPaid) {
                countPaid++;
            } else {
                countPending++;
            }
            totalMonthly += expectedTotal;
            totalPaid += paidAmount;
            totalPending += pendingAmount;

            items.push({
                id: tpl.id || ('tpl_' + Math.random()),
                template: tpl,
                title: tpl.note || tpl.category || 'Subscription',
                category: tpl.category || 'General',
                amount: amount,
                currency: tpl.currency || 'EUR',
                preset: preset,
                dueDay: dueDay,
                dueDate: dueOccurrence.date,
                occurrenceCount: occurrences.length,
                occurrences: occurrences,
                expectedTotal: Math.round(expectedTotal * 100) / 100,
                paidAmount: Math.round(paidAmount * 100) / 100,
                pendingAmount: Math.round(pendingAmount * 100) / 100,
                remainingAmount: Math.round(pendingAmount * 100) / 100,
                status: isPaid ? 'paid' : (paidAmount > 0.005 ? 'partial' : 'pending'),
                isPaid: isPaid,
                isOverdue: isOverdue,
                daysUntilDue: daysUntilDue,
                matchedTransaction: matchedTxs[0] || null,
                matchedTransactions: matchedTxs
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
        normalizeText: normalizeText,
        getPreset: getPreset,
        getDeletedDates: getDeletedDates,
        getDueDaysForMonth: getDueDaysForMonth,
        getDueDayForMonth: getDueDayForMonth,
        isTransactionMatchingTemplate: isTransactionMatchingTemplate,
        analyzeMonthlySubscriptions: analyzeMonthlySubscriptions,
        detectRecurringPatterns: detectRecurringPatterns
    };
});
