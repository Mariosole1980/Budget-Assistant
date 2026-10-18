// ============================================================
// SAFE-TO-SPEND & SUBSCRIPTIONS HUB VIEW CONTROLLER
// Autonomous UMD Module (Phase 16D Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
    var exports = factory();
    Object.assign(rootObj, exports);
    rootObj.SafeToSpendView = exports;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

// ============================================================
// FEATURE: SAFE-TO-SPEND & WHAT-IF ENGINE UI HOOKS
// ============================================================

// Helper: Safe date parsing without UTC timezone day-shifting
function parseDate(d) {
  if (!d) return new Date();
  if (d instanceof Date) return new Date(d.getTime());
  const str = String(d).trim();
  const parts = str.split('T')[0].split(' ')[0].split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(y, m, day);
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeBudgetKey(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ς/g, 'σ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// A savings / piggy-bank budget is a target, NOT a spending envelope:
// it is deducted once through getMonthlySavingsGoal() and must never inflate
// the monthly baseline (which would double-deduct the same money).
function isSavingsBudget(budget) {
  if (!budget) return false;
  const name = normalizeBudgetKey(budget.name || budget.category);
  if (!name) return false;
  return name.includes('αποταμ') || name.includes('saving') || name.includes('κουμπαρ') || name.includes('piggy');
}

function getDiscretionaryBudgets() {
  const budgets = (state && state.budgets) || [];
  return budgets.filter(b => b && !isSavingsBudget(b) && b.is_deleted !== true);
}

// True when a recurring template belongs to a category that already has a
// spending budget (e.g. rent → "ΣΠΙΤΙ" budget). In budget-baseline mode the
// whole budget is already deducted as committed money, so the same bill must
// not be deducted a second time.
function isRecurringTemplateCoveredByBudget(template) {
  if (!template) return false;
  const budgets = getDiscretionaryBudgets();
  if (budgets.length === 0) return false;

  const templateKeys = [
    normalizeBudgetKey(template.category),
    normalizeBudgetKey(template.note || template.title)
  ].filter(Boolean);
  if (templateKeys.length === 0) return false;

  return budgets.some(b => {
    const budgetKey = normalizeBudgetKey(b.name || b.category);
    if (!budgetKey) return false;
    return templateKeys.some(tplKey => (
      tplKey === budgetKey || tplKey.includes(budgetKey) || budgetKey.includes(tplKey)
    ));
  });
}

/**
 * Computes the discretionary pool of the current month together with the source
 * that produced it ('income' | 'budget' | 'accounts'). The mode matters because
 * budget baselines already cover their recurring bills.
 */
function computeLiquidBalance() {
  // If state.accounts is not yet in memory, attempt reading cached accounts
  if ((!state.accounts || state.accounts.length === 0) && typeof localStorage !== 'undefined') {
    try {
      const cachedAccs = JSON.parse(localStorage.getItem('offline_accounts') || '[]');
      if (Array.isArray(cachedAccs) && cachedAccs.length > 0) {
        state.accounts = cachedAccs;
      }
    } catch (_) {}
  }

  const rawAccounts = (state && state.accounts) || [];
  const accBalance = rawAccounts.reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);

  // Calculate available discretionary funds for the current calendar month
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Source transactions: prefer active/scoped transactions, fallback to offline cache during sync
    let txs = [];
    if (typeof TransactionScopeService !== 'undefined' && typeof TransactionScopeService.getActiveTransactions === 'function') {
      txs = TransactionScopeService.getActiveTransactions((state && state.transactions) || []);
    } else if (typeof getActiveTransactions === 'function') {
      txs = getActiveTransactions((state && state.transactions) || []);
    } else {
      txs = (state && state.transactions) || [];
    }

    if ((!txs || txs.length === 0) && typeof localStorage !== 'undefined') {
      try {
        const cached = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
        if (Array.isArray(cached) && cached.length > 0) {
          if (typeof TransactionScopeService !== 'undefined' && typeof TransactionScopeService.getActiveTransactions === 'function') {
            txs = TransactionScopeService.getActiveTransactions(cached);
          } else {
            txs = cached;
          }
        }
      } catch (_) {}
    }

    const monthlyIncome = (txs || []).reduce((sum, t) => {
      if (!t || t.type !== 'income' || !t.date) return sum;
      if (typeof isTransferTransaction === 'function' && isTransferTransaction(t)) return sum;
      const d = parseDate(t.date);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        return sum + (parseFloat(t.amount) || 0);
      }
      return sum;
    }, 0);

    // Savings/piggy-bank budgets are goals, not spending envelopes: they are
    // deducted separately by getMonthlySavingsGoal() (avoids double-deduction).
    const totalBudget = getDiscretionaryBudgets().reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);

    let qs = null;
    let baseline = 0;
    let baselineMode = 'income';
    if (monthlyIncome > 0) {
      baseline = monthlyIncome;
    } else if (totalBudget > 0) {
      baseline = totalBudget;
      baselineMode = 'budget';
    } else {
      const qsRaw = (typeof localStorage !== 'undefined') ? localStorage.getItem('ba_quick_start_profile') : null;
      if (qsRaw) {
        try {
          qs = JSON.parse(qsRaw);
          if (qs && qs.monthly_income > 0) {
            baseline = parseFloat(qs.monthly_income) || 0;
          }
        } catch (_) {}
      }
    }

    // If current month has no income yet, use average past monthly income of the year
    if (baseline === 0 && txs && txs.length > 0) {
      const monthlyTotals = {};
      txs.forEach(t => {
        if (!t || t.type !== 'income' || !t.date) return;
        if (typeof isTransferTransaction === 'function' && isTransferTransaction(t)) return;
        const d = parseDate(t.date);
        if ((d.getFullYear() === currentYear && d.getMonth() < currentMonth) ||
            (d.getFullYear() === currentYear - 1 && currentMonth === 0)) {
          const mKey = `${d.getFullYear()}_${d.getMonth()}`;
          monthlyTotals[mKey] = (monthlyTotals[mKey] || 0) + (parseFloat(t.amount) || 0);
        }
      });
      const monthsCount = Object.keys(monthlyTotals).length;
      if (monthsCount > 0) {
        const sumPast = Object.values(monthlyTotals).reduce((a, b) => a + b, 0);
        baseline = sumPast / monthsCount;
      }
    }

    if (baseline > 0) {
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const spentThisMonth = (txs || []).reduce((sum, t) => {
        if (!t || t.type !== 'expense' || !t.date) return sum;
        if (typeof isTransferTransaction === 'function' && isTransferTransaction(t)) return sum;
        const d = parseDate(t.date);
        if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
          // Only count expenses incurred up to today (d <= todayEnd).
          // Future recurring expenses are already counted as unpaid bills in getUnpaidRecurringBillsThisMonth().
          // Counting them here too would double-deduct and falsely zero-out the daily margin.
          if (d.getTime() <= todayEnd.getTime()) {
            return sum + (parseFloat(t.amount) || 0);
          }
        }
        return sum;
      }, 0);

      // Support baseline income fallback (qs.monthly_income - spentThisMonth)
      const baselineIncome = (qs && qs.monthly_income > 0) ? parseFloat(qs.monthly_income) : baseline;
      const remainingFromBaseline = Math.max(0, baselineIncome - spentThisMonth);

      // If baseline cashflow yields remaining discretionary funds, use that as the primary pool.
      return { balance: remainingFromBaseline, mode: baselineMode };
    }
  } catch (e) { }

  return { balance: Math.max(0, accBalance), mode: 'accounts' };
}

function getLiquidBalance() {
  return computeLiquidBalance().balance;
}

/**
 * Monthly unpaid recurring bills (what Safe-to-Spend must still reserve).
 *
 * options.excludeBudgetCovered: skip templates whose category is already part of
 * a spending budget. Used only when the discretionary pool is derived from
 * budgets, because those budgets are deducted in full as committed money.
 */
function getUnpaidRecurringBillsThisMonth(options) {
  const opts = options || {};
  if (!state.recurringTemplates || state.recurringTemplates.length === 0) return 0;

  const activeTemplates = state.recurringTemplates.filter(tpl => tpl && tpl.is_active !== false && tpl.is_deleted !== true);
  if (activeTemplates.length === 0) return 0;

  let templatesToCount = activeTemplates;
  if (opts.excludeBudgetCovered) {
    templatesToCount = activeTemplates.filter(tpl => !isRecurringTemplateCoveredByBudget(tpl));
    if (templatesToCount.length === 0) return 0;
  }

  // Source scoped active transactions
  let txs = [];
  if (typeof TransactionScopeService !== 'undefined' && typeof TransactionScopeService.getActiveTransactions === 'function') {
    txs = TransactionScopeService.getActiveTransactions((state && state.transactions) || []);
  } else if (typeof getActiveTransactions === 'function') {
    txs = getActiveTransactions((state && state.transactions) || []);
  } else {
    txs = (state && state.transactions) || [];
  }

  if (typeof SubscriptionEngine !== 'undefined') {
    try {
      const analysis = SubscriptionEngine.analyzeMonthlySubscriptions({
        templates: templatesToCount,
        transactions: txs,
        referenceDate: new Date()
      });
      return sanitizeFloat(parseFloat(analysis.totalPending) || 0);
    } catch (e) {
      console.warn('SubscriptionEngine analysis error in getUnpaidRecurringBillsThisMonth:', e);
    }
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Fallback (SubscriptionEngine unavailable): count remaining occurrences per preset
  let unpaidTotal = 0;
  templatesToCount.forEach(tpl => {
    if (!tpl || tpl.type !== 'expense') return;
    const amount = sanitizeFloat(parseFloat(tpl.amount) || 0);
    if (amount <= 0) return;

    const preset = String(tpl.preset || 'monthly').toLowerCase();
    const startDateStr = tpl.startDate || tpl.start_date;
    const startDate = startDateStr ? parseDate(startDateStr) : null;
    const startDay = startDate ? startDate.getDate() : null;

    if (preset === 'daily') {
      unpaidTotal += amount * Math.max(0, lastDayOfMonth - currentDay + 1);
      return;
    }
    if (preset === 'weekly') {
      const weekday = startDate ? startDate.getDay() : now.getDay();
      for (let d = currentDay; d <= lastDayOfMonth; d++) {
        if (new Date(currentYear, currentMonth, d).getDay() === weekday) unpaidTotal += amount;
      }
      return;
    }

    let dueDay = startDay;
    if (dueDay === null && Array.isArray(tpl.days) && tpl.days.length > 0) {
      dueDay = parseInt(tpl.days[0], 10);
    }
    if (!dueDay) {
      dueDay = parseInt(tpl.due_day || tpl.day_of_month || 1, 10);
    }
    if (dueDay >= currentDay && dueDay <= lastDayOfMonth) {
      unpaidTotal += amount;
    }
  });
  return unpaidTotal;
}

/**
 * Single source of truth for the Safe-to-Spend inputs, so the card, the modal
 * breakdown and the what-if simulator always agree with each other.
 */
function getSafeToSpendInputs() {
  const liquid = computeLiquidBalance();
  const baseSavingsGoal = getMonthlySavingsGoal();
  const savingsProgress = getYearSavingsProgress();
  const savingsPlan = getEffectiveMonthlySavingsGoal(baseSavingsGoal, savingsProgress);
  return {
    balance: liquid.balance,
    mode: liquid.mode,
    unpaidBills: getUnpaidRecurringBillsThisMonth({ excludeBudgetCovered: liquid.mode === 'budget' }),
    // The amount actually reserved this month (may be prorated when the
    // annual target is already met or nearly met).
    savingsGoal: savingsPlan.effective,
    baseSavingsGoal: savingsPlan.base,
    savingsCapped: savingsPlan.capped,
    savingsProgress: savingsProgress
  };
}

function getMonthlySavingsGoal(options) {
  const opts = options || {};

  // 1. Explicit monthly goal set by user (highest precedence)
  try {
    const explicit = localStorage.getItem('ba_monthly_savings_goal');
    if (explicit !== null && explicit !== undefined && explicit.trim() !== '') {
      const parsed = parseFloat(explicit);
      if (!isNaN(parsed) && parsed >= 0) return sanitizeFloat(parsed);
    }
  } catch (e) { }

  // 2. Budget category for savings / piggy bank
  if (state && state.budgets && state.budgets.length > 0) {
    const savingsBudget = state.budgets.find(b => isSavingsBudget(b));
    if (savingsBudget && parseFloat(savingsBudget.amount) > 0) {
      return sanitizeFloat(parseFloat(savingsBudget.amount) || 0);
    }
  }

  // 3. Quick-Start profile target_savings
  try {
    const qsRaw = localStorage.getItem('ba_quick_start_profile');
    if (qsRaw) {
      const qs = JSON.parse(qsRaw);
      if (qs && qs.target_savings > 0) return sanitizeFloat(parseFloat(qs.target_savings) || 0);
    }
  } catch (e) { }

  // 4. Annual savings target (overview_savings_target / 12)
  try {
    const customTarget = localStorage.getItem('overview_savings_target');
    if (customTarget) {
      const annualVal = parseFloat(customTarget);
      if (!isNaN(annualVal) && annualVal > 0) {
        return sanitizeFloat(Math.round(annualVal / 12));
      }
    }
  } catch (e) { }

  // 5. Intelligent Fallback from Year Savings Rate (Current Year Net Savings / Elapsed Months)
  // CRITICAL FIX: The historical year savings rate is an ESTIMATE / RECOMMENDATION, NOT a committed debt.
  // When calculating Safe-to-Spend, committed expenses should only include real bills and EXPLICIT user goals.
  // If the user never set a savings goal, deducting a phantom historical average drives the discretionary pool
  // below 0 (causing safe-to-spend to jump to 0 and display false "Υπέρβαση" / Over Budget warnings).
  // Therefore, only return this estimate when explicitly requested (opts.includeEstimate === true).
  if (opts.includeEstimate) {
    try {
      const txs = (state && state.transactions) ? state.transactions : [];
      if (txs.length > 0) {
        const now = new Date();
        const currYear = now.getFullYear();
        const currMonth = now.getMonth();
        const elapsedMonths = Math.max(1, currMonth + 1);

        let yearIncome = 0;
        let yearExpense = 0;
        txs.forEach(t => {
          if (!t || !t.date) return;
          if (typeof isTransferTransaction === 'function' && isTransferTransaction(t)) return;
          const d = parseDate(t.date);
          if (d.getFullYear() === currYear) {
            const amt = parseFloat(t.amount) || 0;
            if (t.type === 'income') yearIncome += amt;
            else if (t.type === 'expense') yearExpense += amt;
          }
        });
        const yearNet = yearIncome - yearExpense;
        if (yearNet > 0) {
          return sanitizeFloat(Math.round(yearNet / elapsedMonths));
        }
      }
    } catch (e) { }
  }

  return 0;
}

/**
 * Annual savings target that the Overview card compares against year-to-date
 * net savings. `overview_savings_target` is the source of truth; when it is
 * missing we derive it from an explicitly configured monthly goal (x12) so the
 * Safe-to-Spend row and the Overview progress bar always describe the same plan.
 */
function getAnnualSavingsTarget() {
  try {
    const raw = localStorage.getItem('overview_savings_target');
    if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
      const annual = parseFloat(raw);
      if (!isNaN(annual) && annual > 0) return sanitizeFloat(annual);
    }
  } catch (e) { }

  try {
    const monthlyRaw = localStorage.getItem('ba_monthly_savings_goal');
    if (monthlyRaw !== null && monthlyRaw !== undefined && String(monthlyRaw).trim() !== '') {
      const monthly = parseFloat(monthlyRaw);
      if (!isNaN(monthly) && monthly > 0) return sanitizeFloat(Math.round(monthly * 12));
    }
  } catch (e) { }

  return 0;
}

/**
 * Year-to-date savings progress (income - expenses, transfers excluded), the
 * same realized-savings metric rendered by the Overview savings progress bar.
 * Only transactions up to today are counted: future (scheduled) entries are not
 * money saved yet.
 */
function getYearSavingsProgress() {
  const now = new Date();
  const year = now.getFullYear();
  const todayEnd = new Date(year, now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const annualTarget = getAnnualSavingsTarget();

  let txs = [];
  if (typeof TransactionScopeService !== 'undefined' && typeof TransactionScopeService.getActiveTransactions === 'function') {
    txs = TransactionScopeService.getActiveTransactions((state && state.transactions) || []);
  } else if (typeof getActiveTransactions === 'function') {
    txs = getActiveTransactions((state && state.transactions) || []);
  } else {
    txs = (state && state.transactions) || [];
  }

  const displayCurrency = (typeof getDisplayCurrency === 'function') ? getDisplayCurrency() : undefined;
  let income = 0;
  let expense = 0;

  (txs || []).forEach(t => {
    if (!t || !t.date) return;
    if (typeof isTransferTransaction === 'function' && isTransferTransaction(t)) return;
    const d = parseDate(t.date);
    if (d.getFullYear() !== year || d.getTime() > todayEnd.getTime()) return;

    let amt = parseFloat(t.amount) || 0;
    if (typeof CurrencyService !== 'undefined' && CurrencyService && typeof CurrencyService.displayAmount === 'function') {
      try {
        const converted = CurrencyService.displayAmount(t, displayCurrency);
        if (typeof converted === 'number' && !isNaN(converted)) amt = converted;
      } catch (e) { }
    }

    if (t.type === 'income') income += amt;
    else if (t.type === 'expense') expense += amt;
  });

  const savedYtd = sanitizeFloat(income - expense);
  const remaining = annualTarget > 0 ? Math.max(0, sanitizeFloat(annualTarget - savedYtd)) : 0;
  const progressPct = annualTarget > 0 ? Math.round((savedYtd / annualTarget) * 100) : 0;
  // The current month can still be saved into, so it counts as remaining.
  const monthsRemaining = Math.max(1, 12 - now.getMonth());

  return {
    year: year,
    annualTarget: annualTarget,
    savedYtd: savedYtd,
    remaining: remaining,
    progressPct: progressPct,
    monthsRemaining: monthsRemaining
  };
}

/**
 * Prorates the monthly reservation against what is still missing from the
 * annual target: min(monthly goal, remaining annual / months left). A user who
 * is ahead of the annual target therefore stops reserving money that is no
 * longer needed instead of seeing an artificial negative pool.
 */
function getEffectiveMonthlySavingsGoal(baseGoal, progress) {
  const base = sanitizeFloat(baseGoal || 0);
  if (base <= 0) return { base: base, effective: 0, capped: false };

  const p = progress || getYearSavingsProgress();
  if (!(p.annualTarget > 0)) return { base: base, effective: base, capped: false };

  const neededPerMonth = sanitizeFloat(p.remaining / p.monthsRemaining);
  const effective = sanitizeFloat(Math.min(base, neededPerMonth));

  return {
    base: base,
    effective: effective,
    capped: effective + 0.005 < base
  };
}

function updateSafeToSpendUI() {
  if (typeof SafeToSpendEngine === 'undefined') return;

  const isSyncInFlight = (typeof SupabaseRealtimeService !== 'undefined' &&
    typeof SupabaseRealtimeService.isForceSyncInFlight === 'function' &&
    SupabaseRealtimeService.isForceSyncInFlight()) || false;

  const stsInputs = getSafeToSpendInputs();
  const balance = stsInputs.balance;
  const unpaidBills = stsInputs.unpaidBills;
  const savingsGoal = stsInputs.savingsGoal;

  const stsResult = SafeToSpendEngine.calculateDailySafeToSpend({
    currentBalance: balance,
    unpaidRecurringBills: unpaidBills,
    savingsGoal: savingsGoal
  });

  // Anti-glitch / anti-flicker guard:
  // If calculation yields 0, but previously we had a valid positive safeDaily result,
  // retain the previous value ONLY while the inputs are genuinely transient
  // (background sync in flight or the local transactions cache momentarily empty).
  // A real zero (balance exhausted, month fully spent) must render as 0/critical —
  // otherwise the UI keeps a stale positive allowance forever.
  const hasLocalTxs = !!(state && state.transactions && state.transactions.length > 0);
  const hadPositiveResult = !!(state._lastSafeToSpendResult && state._lastSafeToSpendResult.safeDaily > 0);
  if (stsResult.safeDaily === 0 && hadPositiveResult) {
    if (isSyncInFlight || !hasLocalTxs) {
      // Retain the last known stable result during background sync / transient reload
      return;
    }
  }

  state._lastSafeToSpendResult = stsResult;
  try {
    if (typeof localStorage !== 'undefined' && stsResult && stsResult.safeDaily > 0) {
      localStorage.setItem('ba_last_sts_daily', String(stsResult.safeDaily));
    }
  } catch (_) {}

  // Overview Card Elements (Επισκόπηση)
  const dailyEl = document.getElementById('sts-daily-val');
  const weeklyEl = document.getElementById('sts-weekly-val');
  const subtitleEl = document.getElementById('sts-subtitle');
  const badgeEl = document.getElementById('sts-badge');

  const currSym = getCurrencySymbol();
  if (dailyEl) dailyEl.textContent = `${currSym} ${formatDisplayAmount(stsResult.safeDaily)}`;
  if (weeklyEl) weeklyEl.textContent = `${currSym} ${formatDisplayAmount(stsResult.safeWeekly)}`;
  if (subtitleEl) {
    subtitleEl.textContent = `${stsResult.daysRemaining} ημέρες απομένουν • Μετά από πάγιες (${currSym} ${formatDisplayAmount(unpaidBills)})`;
  }

  if (badgeEl) {
    if (stsResult.status === 'caution') {
      badgeEl.style.color = '#f59e0b';
      badgeEl.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      badgeEl.style.background = 'rgba(245, 158, 11, 0.15)';
    } else if (stsResult.status === 'critical') {
      badgeEl.style.color = '#f43f5e';
      badgeEl.style.borderColor = 'rgba(244, 63, 94, 0.4)';
      badgeEl.style.background = 'rgba(244, 63, 94, 0.15)';
    } else {
      badgeEl.style.color = '#34d399';
      badgeEl.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      badgeEl.style.background = 'rgba(16, 185, 129, 0.15)';
    }
  }

  // Transactions Tab Status Bar Elements (Option B)
  const transDailyEl = document.getElementById('trans-sts-daily-val');
  const transSubtitleEl = document.getElementById('trans-sts-subtitle');
  const transStatusBadge = document.getElementById('ai-check-status-badge');
  const lang = (state && state.lang) || 'el';
  const translations = (typeof TRANSLATIONS !== 'undefined' ? TRANSLATIONS : (typeof window !== 'undefined' ? window.TRANSLATIONS : null)) || {};
  const t = (translations && translations[lang]) || {};

  if (transDailyEl) {
    transDailyEl.textContent = `${currSym} ${formatDisplayAmount(stsResult.safeDaily)}`;
  }
  if (transSubtitleEl) {
    const dayLabel = lang === 'el' ? 'ημ. απομένουν' : 'days left';
    transSubtitleEl.textContent = `• ${stsResult.daysRemaining} ${dayLabel}`;
  }
  if (transStatusBadge) {
    if (stsResult.status === 'caution') {
      transStatusBadge.textContent = t['sts_status_caution'] || (lang === 'el' ? 'Προσοχή' : 'Caution');
      transStatusBadge.style.color = '#f59e0b';
      transStatusBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      transStatusBadge.style.background = 'rgba(245, 158, 11, 0.15)';
    } else if (stsResult.status === 'critical') {
      transStatusBadge.textContent = t['sts_status_critical'] || (lang === 'el' ? 'Υπέρβαση' : 'Over Budget');
      transStatusBadge.style.color = '#f43f5e';
      transStatusBadge.style.borderColor = 'rgba(244, 63, 94, 0.4)';
      transStatusBadge.style.background = 'rgba(244, 63, 94, 0.15)';
    } else {
      transStatusBadge.textContent = t['sts_status_healthy'] || (lang === 'el' ? 'Εντός στόχου' : 'On Track');
      transStatusBadge.style.color = '#34d399';
      transStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      transStatusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
    }
  }

  // Update Subscriptions & Bills Pill in Safe-to-Spend Hero Card
  const subsPill = document.getElementById('sts-subs-pill');
  const subsPillText = document.getElementById('sts-subs-pill-text');
  if (subsPill && subsPillText) {
    if (typeof SubscriptionEngine !== 'undefined') {
      try {
        const subAnalysis = SubscriptionEngine.analyzeMonthlySubscriptions({
          templates: state.recurringTemplates || [],
          transactions: state.transactions || [],
          referenceDate: new Date()
        });
        if (subAnalysis.countTotal > 0) {
          subsPill.style.display = 'inline-flex';
          const pendingCount = subAnalysis.countPending;
          const pendingAmount = subAnalysis.totalPending;
          const lang = state.lang || 'el';
          if (pendingCount > 0) {
            const pendingLabel = (TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_badge_pending_bills']) || 'Πάγια Εκκρεμούν';
            subsPillText.textContent = `${pendingCount} ${pendingLabel} (${currSym} ${formatDisplayAmount(pendingAmount)})`;
            subsPill.style.color = '#fbbf24';
            subsPill.style.borderColor = 'rgba(251, 191, 36, 0.3)';
            subsPill.style.background = 'rgba(251, 191, 36, 0.12)';
          } else {
            const allPaidLabel = (TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_all_paid']) || 'Όλα τα πάγια πληρώθηκαν';
            subsPillText.textContent = `${allPaidLabel}`;
            subsPill.style.color = '#34d399';
            subsPill.style.borderColor = 'rgba(52, 211, 153, 0.3)';
            subsPill.style.background = 'rgba(52, 211, 153, 0.12)';
          }
        } else {
          subsPill.style.display = 'inline-flex';
          subsPillText.textContent = lang === 'el' ? 'Πάγια & Συνδρομές' : 'Bills & Subscriptions';
          subsPill.style.color = '#a78bfa';
          subsPill.style.borderColor = 'rgba(167, 139, 250, 0.3)';
          subsPill.style.background = 'rgba(167, 139, 250, 0.12)';
        }
      } catch (e) {
        subsPill.style.display = 'none';
      }
    } else {
      subsPill.style.display = 'none';
    }
  }
}

/**
 * Renders the savings-goal row and its annual-target context line:
 * - the value is the amount actually reserved this month (single minus sign),
 * - the sub-line explains target, year-to-date progress and any prorating.
 */
function renderStsSavingsRow(inputs) {
  const data = inputs || getSafeToSpendInputs();
  const currSym = getCurrencySymbol();
  const lang = (state && state.lang) || 'el';
  const translations = (typeof TRANSLATIONS !== 'undefined' ? TRANSLATIONS : (typeof window !== 'undefined' ? window.TRANSLATIONS : null)) || {};
  const t = (translations && translations[lang]) || {};

  const modalSav = document.getElementById('modal-sts-savings');
  if (modalSav) {
    if (data.savingsGoal > 0) {
      modalSav.textContent = `- ${currSym} ${formatDisplayAmount(data.savingsGoal)}`;
      modalSav.style.color = '#60a5fa';
    } else {
      // Nothing is reserved (no goal or annual target already met): no minus.
      modalSav.textContent = `${currSym} ${formatDisplayAmount(0)}`;
      modalSav.style.color = '#34d399';
    }
  }

  const savLabelEl = document.getElementById('modal-sts-savings-label');
  if (savLabelEl) {
    savLabelEl.textContent = t['sts_savings_goal_row_label'] || (lang === 'el' ? 'Στόχος Αποταμίευσης (Μηνιαία δόση):' : 'Savings Goal (Monthly installment):');
  }

  const savBtn = document.getElementById('modal-sts-savings-btn');
  if (savBtn) {
    savBtn.textContent = data.baseSavingsGoal > 0
      ? (t['sts_savings_edit_btn'] || (lang === 'el' ? 'Αλλαγή' : 'Edit'))
      : (t['sts_savings_set_btn'] || (lang === 'el' ? 'Ορισμός' : 'Set'));
  }

  const progressEl = document.getElementById('modal-sts-savings-progress');
  if (!progressEl) return;

  const progress = data.savingsProgress || {};
  if (!(progress.annualTarget > 0)) {
    progressEl.style.display = 'none';
    progressEl.textContent = '';
    return;
  }

  const fmtTarget = `${currSym} ${formatDisplayAmount(progress.annualTarget)}`;
  const fmtSaved = `${currSym} ${formatDisplayAmount(progress.savedYtd)}`;
  const fmtRemaining = `${currSym} ${formatDisplayAmount(progress.remaining)}`;
  const pct = progress.progressPct;

  let text;
  if (lang === 'el') {
    text = `Ετήσιος στόχος ${fmtTarget} • Έχεις ήδη ${fmtSaved} (${pct}%) • Απομένουν ${fmtRemaining}`;
    if (progress.remaining <= 0) {
      text += ' — ✓ Ο ετήσιος στόχος καλύφθηκε, δεν δεσμεύεται μηνιαία δόση.';
    } else if (data.savingsCapped) {
      text += ` • Δεσμεύεται ${currSym} ${formatDisplayAmount(data.savingsGoal)}/μήνα από ${currSym} ${formatDisplayAmount(data.baseSavingsGoal)} για τους ${progress.monthsRemaining} μήνες που απομένουν.`;
    }
  } else {
    text = `Annual target ${fmtTarget} • Already saved ${fmtSaved} (${pct}%) • Remaining ${fmtRemaining}`;
    if (progress.remaining <= 0) {
      text += ' — ✓ Annual target reached, no monthly amount is reserved.';
    } else if (data.savingsCapped) {
      text += ` • Reserving ${currSym} ${formatDisplayAmount(data.savingsGoal)}/month instead of ${currSym} ${formatDisplayAmount(data.baseSavingsGoal)} for the ${progress.monthsRemaining} months left.`;
    }
  }

  progressEl.textContent = text;
  progressEl.style.display = 'block';
  progressEl.style.color = progress.remaining <= 0 ? '#34d399' : '#93c5fd';
  progressEl.style.background = progress.remaining <= 0 ? 'rgba(16, 185, 129, 0.10)' : 'rgba(96, 165, 250, 0.07)';
  progressEl.style.borderColor = progress.remaining <= 0 ? 'rgba(16, 185, 129, 0.30)' : 'rgba(96, 165, 250, 0.22)';
}

function openSafeToSpendModal() {
  updateSafeToSpendUI();
  const sts = state._lastSafeToSpendResult || {
    safeDaily: 0,
    safeWeekly: 0,
    currentBalance: getLiquidBalance(),
    committedExpenses: getUnpaidRecurringBillsThisMonth(),
    discretionaryPool: 0,
    daysRemaining: 0
  };

  const currSym = getCurrencySymbol();
  const stsInputs = getSafeToSpendInputs();
  const modalDaily = document.getElementById('modal-sts-daily-val');
  const modalWeekly = document.getElementById('modal-sts-weekly-val');
  const modalBal = document.getElementById('modal-sts-balance');
  const modalBills = document.getElementById('modal-sts-bills');
  const modalPool = document.getElementById('modal-sts-pool');
  const modalDays = document.getElementById('modal-sts-days');

  if (modalDaily) modalDaily.textContent = `${currSym} ${formatDisplayAmount(sts.safeDaily)}`;
  if (modalWeekly) modalWeekly.textContent = `ή ${currSym} ${formatDisplayAmount(sts.safeWeekly)} για αυτή την εβδομάδα`;
  if (modalBal) modalBal.textContent = `${currSym} ${formatDisplayAmount(stsInputs.balance)}`;
  if (modalBills) modalBills.textContent = `- ${currSym} ${formatDisplayAmount(stsInputs.unpaidBills)}`;
  if (modalPool) modalPool.textContent = `${currSym} ${formatDisplayAmount(sts.discretionaryPool)}`;
  if (modalDays) modalDays.textContent = `${sts.daysRemaining} ημέρες`;

  // The amount below is the month's discretionary pool (income/budgets minus
  // expenses), NOT the cash sitting in accounts. Label it accordingly.
  const balLabelEl = document.getElementById('modal-sts-balance-label');
  if (balLabelEl) {
    const lang = (state && state.lang) || 'el';
    const translations = (typeof TRANSLATIONS !== 'undefined' ? TRANSLATIONS : (typeof window !== 'undefined' ? window.TRANSLATIONS : null)) || {};
    const t = (translations && translations[lang]) || {};
    balLabelEl.textContent = t['sts_liquid_balance'] || (lang === 'el' ? 'Διαθέσιμο Υπόλοιπο Μήνα:' : 'Available Balance This Month:');
  }

  // Savings row + annual-target progress (prorated reservation included).
  renderStsSavingsRow(stsInputs);

  // Ensure editor starts collapsed
  const editorContainer = document.getElementById('sts-savings-editor-container');
  if (editorContainer) {
    editorContainer.style.display = 'none';
  }

  // Clear previous simulation result
  const resBox = document.getElementById('sts-sim-result-box');
  if (resBox) {
    resBox.style.display = 'none';
    resBox.innerHTML = '';
  }

  // Dynamic PRO check: Hide bottom upsell CTA button & update What-If badge when user already has PRO
  try {
    const isPro = (typeof isPremium === 'function')
      ? isPremium()
      : (typeof window !== 'undefined' && typeof window.isPremium === 'function'
        ? window.isPremium()
        : ((typeof localStorage !== 'undefined' && (localStorage.getItem('premium_active') === 'true' || !!(state && state.userProfile && state.userProfile.premium_active))) ? true : false));

    const ctaBtn = document.getElementById('sts-premium-cta-btn');
    if (ctaBtn) {
      ctaBtn.style.display = isPro ? 'none' : 'flex';
    }

    const proBadge = document.getElementById('sts-sim-pro-badge');
    if (proBadge) {
      if (isPro) {
        proBadge.textContent = '✓ PRO';
        proBadge.style.background = '#10b981';
        proBadge.style.color = '#ffffff';
      } else {
        proBadge.textContent = 'PRO';
        proBadge.style.background = '#fbbf24';
        proBadge.style.color = '#0f172a';
      }
    }
  } catch (err) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[SafeToSpendView] PRO status check error:', err);
    }
  }

  openModal('safe-to-spend-modal');
}

function toggleStsSavingsGoalEditor(force) {
  const container = document.getElementById('sts-savings-editor-container');
  if (!container) return;
  const isHidden = container.style.display === 'none' || !container.style.display;
  const shouldOpen = typeof force === 'boolean' ? force : isHidden;

  if (shouldOpen) {
    const currGoal = getMonthlySavingsGoal();
    const input = document.getElementById('sts-savings-input');
    const currSymEl = document.getElementById('sts-savings-curr-symbol');
    if (input) input.value = currGoal > 0 ? currGoal : '';
    if (currSymEl) currSymEl.textContent = getCurrencySymbol();

    const lang = (state && state.lang) || 'el';
    const translations = (typeof TRANSLATIONS !== 'undefined' ? TRANSLATIONS : (typeof window !== 'undefined' ? window.TRANSLATIONS : null)) || {};
    const t = (translations && translations[lang]) || {};
    const titleEl = document.getElementById('sts-savings-editor-title');
    const descEl = document.getElementById('sts-savings-editor-desc');
    const saveLabel = document.getElementById('sts-savings-save-label');
    if (titleEl) titleEl.textContent = t['sts_savings_target_title'] || (lang === 'el' ? 'Στόχος Αποταμίευσης (Μηνιαία Δόση)' : 'Savings Goal (Monthly Installment)');
    if (descEl) descEl.textContent = t['sts_savings_target_desc'] || (lang === 'el' ? 'Ορίστε τον μηνιαίο στόχο αποταμίευσης. Συγχρονίζεται αυτόματα με τον Ετήσιο Στόχο της Επισκόπησης (ποσό × 12) και προσαρμόζεται στους μήνες που απομένουν, ώστε να μη δεσμεύεται δόση όταν ο ετήσιος στόχος έχει καλυφθεί.' : 'Set your monthly savings goal. It syncs automatically with your Annual Savings Goal in Overview (amount × 12) and is prorated across the remaining months, so nothing is reserved once the annual target is met.');
    if (saveLabel) saveLabel.textContent = t['sts_savings_save_btn'] || (lang === 'el' ? 'Αποθήκευση' : 'Save');

    if (input) {
      input.value = currGoal > 0 ? currGoal : '';
      updateStsSavingsAnnualHint(currGoal);
    }
    container.style.display = 'block';
    if (input && typeof input.focus === 'function') setTimeout(() => input.focus(), 50);
  } else {
    container.style.display = 'none';
  }
}

function updateStsSavingsAnnualHint(val) {
  const hintEl = document.getElementById('sts-savings-annual-hint-text');
  if (!hintEl) return;
  const num = parseFloat(val) || 0;
  const currSym = getCurrencySymbol();
  const lang = (state && state.lang) || 'el';
  if (num > 0) {
    const annual = Math.round(num * 12);
    const progress = getYearSavingsProgress();
    let hint = lang === 'el'
      ? `Ισοδυναμεί με ${currSym} ${formatDisplayAmount(annual)} / έτος στον Ετήσιο Στόχο της Επισκόπησης`
      : `Equates to ${currSym} ${formatDisplayAmount(annual)} / year in Annual Overview Target`;
    if (progress.annualTarget > 0) {
      hint += lang === 'el'
        ? ` • Έχεις ήδη ${currSym} ${formatDisplayAmount(progress.savedYtd)} (${progress.progressPct}%)`
        : ` • Already saved ${currSym} ${formatDisplayAmount(progress.savedYtd)} (${progress.progressPct}%)`;
    }
    hintEl.textContent = hint;
  } else {
    const suggested = getMonthlySavingsGoal({ includeEstimate: true });
    if (suggested > 0) {
      hintEl.textContent = lang === 'el'
        ? `Προτεινόμενο: ${currSym} ${formatDisplayAmount(suggested)} / μήνα (βάσει ιστορικού)`
        : `Suggested: ${currSym} ${formatDisplayAmount(suggested)} / month (based on history)`;
    } else {
      hintEl.textContent = lang === 'el'
        ? 'Συγχρονίζεται αυτόματα με την Ετήσια Αποταμίευση στην Επισκόπηση'
        : 'Auto-syncs with Annual Savings in Overview';
    }
  }
}

function setStsSavingsInputValue(val) {
  const input = document.getElementById('sts-savings-input');
  if (input) {
    input.value = val;
    if (typeof input.focus === 'function') {
      try { input.focus(); } catch (e) { }
    }
    updateStsSavingsAnnualHint(val);
  }
}

function saveStsSavingsGoal() {
  const input = document.getElementById('sts-savings-input');
  const val = input ? Math.max(0, sanitizeFloat(parseFloat(input.value) || 0)) : 0;

  try {
    localStorage.setItem('ba_monthly_savings_goal', val.toString());
    if (val > 0) {
      localStorage.setItem('overview_savings_target', Math.round(val * 12).toString());
    }
  } catch (e) {
    console.warn('Unable to persist ba_monthly_savings_goal:', e);
  }
  if (typeof state !== 'undefined' && state) {
    state.monthlySavingsGoal = val;
  }

  // Update Safe-to-Spend UI across dashboard & tabs
  updateSafeToSpendUI();

  // Refresh active modal values with the effective (possibly prorated) goal
  const currSym = getCurrencySymbol();
  const stsInputs = getSafeToSpendInputs();
  const sts = (typeof SafeToSpendEngine !== 'undefined')
    ? SafeToSpendEngine.calculateDailySafeToSpend({
        currentBalance: stsInputs.balance,
        unpaidRecurringBills: stsInputs.unpaidBills,
        savingsGoal: stsInputs.savingsGoal
      })
    : (state && state._lastSafeToSpendResult);

  if (sts) {
    const modalDaily = document.getElementById('modal-sts-daily-val');
    const modalWeekly = document.getElementById('modal-sts-weekly-val');
    const modalPool = document.getElementById('modal-sts-pool');
    const modalDays = document.getElementById('modal-sts-days');

    if (modalDaily) modalDaily.textContent = `${currSym} ${formatDisplayAmount(sts.safeDaily)}`;
    if (modalWeekly) modalWeekly.textContent = `ή ${currSym} ${formatDisplayAmount(sts.safeWeekly)} για αυτή την εβδομάδα`;
    if (modalPool) modalPool.textContent = `${currSym} ${formatDisplayAmount(sts.discretionaryPool)}`;
    if (modalDays) modalDays.textContent = `${sts.daysRemaining} ημέρες`;
  }

  renderStsSavingsRow(stsInputs);

  const lang = (state && state.lang) || 'el';
  const translations = (typeof TRANSLATIONS !== 'undefined' ? TRANSLATIONS : (typeof window !== 'undefined' ? window.TRANSLATIONS : null)) || {};
  const t = (translations && translations[lang]) || {};

  // Close editor smoothly
  toggleStsSavingsGoalEditor(false);

  // Re-render accounts overview if active to keep hero card in sync
  if (typeof renderAccountsTab === 'function') {
    try { renderAccountsTab(); } catch (e) { }
  }

  // Provide user feedback toast
  if (typeof showToast === 'function') {
    const toastPrefix = t['sts_savings_saved_toast'] || (lang === 'el' ? 'Ο μηνιαίος στόχος αποταμίευσης ορίστηκε σε' : 'Monthly savings goal updated to');
    showToast(`${toastPrefix} ${currSym} ${formatDisplayAmount(val)}`);
  }
}

function setStsSimInstallments(val, btn) {
  const input = document.getElementById('sts-sim-installments');
  if (input) input.value = String(val);

  document.querySelectorAll('#sts-sim-inst-group .sts-sim-inst-btn, .sts-sim-inst-btn').forEach(b => {
    b.classList.remove('active');
  });

  if (btn) {
    btn.classList.add('active');
  }

  // If amount is already entered, live re-run simulation
  const amtInput = document.getElementById('sts-sim-amount');
  if (amtInput && parseFloat(amtInput.value) > 0) {
    runWhatIfSimulation();
  }
}

function runWhatIfSimulation() {
  if (typeof SafeToSpendEngine === 'undefined') return;

  const amtInput = document.getElementById('sts-sim-amount');
  const instSelect = document.getElementById('sts-sim-installments');
  const resBox = document.getElementById('sts-sim-result-box');
  if (!amtInput || !resBox) return;

  const amount = parseFloat(amtInput.value);
  if (!amount || isNaN(amount) || amount <= 0) {
    resBox.style.display = 'block';
    resBox.style.background = 'rgba(239, 68, 68, 0.15)';
    resBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    resBox.style.color = '#f87171';
    resBox.innerHTML = 'Παρακαλώ εισάγετε έγκυρο ποσό αγοράς.';
    return;
  }

  const installments = parseInt(instSelect ? instSelect.value : '1', 10) || 1;
  const simInputs = getSafeToSpendInputs();
  const currState = state._lastSafeToSpendResult || SafeToSpendEngine.calculateDailySafeToSpend({
    currentBalance: simInputs.balance,
    unpaidRecurringBills: simInputs.unpaidBills,
    savingsGoal: simInputs.savingsGoal
  });

  const sim = SafeToSpendEngine.simulatePurchase({
    purchaseAmount: amount,
    installments: installments,
    safeToSpendState: currState
  });

  const currSym = getCurrencySymbol();
  resBox.style.display = 'block';

  if (!sim.isAffordable || sim.verdict === 'unaffordable') {
    resBox.style.background = 'rgba(239, 68, 68, 0.18)';
    resBox.style.border = '1px solid rgba(239, 68, 68, 0.35)';
    resBox.style.color = '#ffffff';
    resBox.innerHTML = `
      <div style="font-weight: 800; color: #f87171; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>Μη Βιώσιμη Αγορά</span>
      </div>
      <div style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.4;">
        ${sim.recommendation}
      </div>
    `;
  } else {
    const isTight = sim.verdict === 'tight';
    const accentColor = isTight ? '#fbbf24' : '#34d399';
    const bg = isTight ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.18)';
    const border = isTight ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)';

    resBox.style.background = bg;
    resBox.style.border = `1px solid ${border}`;
    resBox.style.color = '#ffffff';
    resBox.innerHTML = `
      <div style="font-weight: 800; color: ${accentColor}; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-circle-check"></i>
        <span>${isTight ? 'Εφικτή αλλά απαιτείται προσοχή!' : 'Άνετη Αγορά!'}</span>
      </div>
      <div style="font-size: 11.5px; color: #cbd5e1; line-height: 1.4;">
        Το Safe-to-Spend θα πέσει από <span style="text-decoration: line-through; color: var(--text-muted);">${currSym} ${formatDisplayAmount(currState.safeDaily)}</span> σε <strong style="color: #fff;">${currSym} ${formatDisplayAmount(sim.newSafeDaily)} / ημέρα</strong>.
      </div>
    `;
  }
}

function openAiAdvisorFromBar() {
  if (typeof openSafeToSpendModal === 'function') {
    openSafeToSpendModal();
  } else if (typeof window !== 'undefined' && typeof window.openSafeToSpendModal === 'function') {
    window.openSafeToSpendModal();
  } else if (typeof openAdvisorChat === 'function') {
    openAdvisorChat();
  }
}

window.updateSafeToSpendUI = updateSafeToSpendUI;
window.openSafeToSpendModal = openSafeToSpendModal;
window.setStsSimInstallments = setStsSimInstallments;
window.runWhatIfSimulation = runWhatIfSimulation;
window.openAiAdvisorFromBar = openAiAdvisorFromBar;

// ============================================================
// FEATURE: SMART RECURRING & SUBSCRIPTIONS HUB
// ============================================================

function openSubscriptionsHubModal() {
  renderSubscriptionsHub();
  openModal('subscriptions-hub-modal');
}
window.openSubscriptionsHubModal = openSubscriptionsHubModal;

function renderSubscriptionsHub() {
  if (typeof SubscriptionEngine === 'undefined') return;

  const lang = state.lang || 'el';
  const currSym = getCurrencySymbol();

  const analysis = SubscriptionEngine.analyzeMonthlySubscriptions({
    templates: state.recurringTemplates || [],
    transactions: state.transactions || [],
    referenceDate: new Date()
  });

  state._lastSubscriptionsAnalysis = analysis;

  // 1. Metric values
  const totalValEl = document.getElementById('sub-hub-total-val');
  const paidValEl = document.getElementById('sub-hub-paid-val');
  const pendingValEl = document.getElementById('sub-hub-pending-val');

  if (totalValEl) totalValEl.textContent = `${currSym} ${formatDisplayAmount(analysis.totalMonthly)}`;
  if (paidValEl) paidValEl.textContent = `${currSym} ${formatDisplayAmount(analysis.totalPaid)}`;
  if (pendingValEl) pendingValEl.textContent = `${currSym} ${formatDisplayAmount(analysis.totalPending)}`;

  // 2. Smart Detection section
  const detectContainer = document.getElementById('sub-hub-detection-container');
  if (detectContainer) {
    const suggestions = SubscriptionEngine.detectRecurringPatterns({
      transactions: state.transactions || [],
      existingTemplates: state.recurringTemplates || [],
      referenceDate: new Date()
    });

    if (suggestions.length > 0) {
      let detectHtml = `
        <div class="sub-detection-box">
          <div class="sub-detection-title">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <span>${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_smart_detection_title']) || 'Έξυπνη Ανίχνευση Συνδρομών'}</span>
          </div>
          <div class="sub-detection-desc">
            ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_smart_detection_desc']) || 'Εντοπίστηκαν επαναλαμβανόμενα έξοδα στο ιστορικό σας:'}
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
      `;

      suggestions.slice(0, 3).forEach((sug, idx) => {
        detectHtml += `
          <div class="sub-detection-item">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
              <span style="font-size: 14px;">⚡</span>
              <div style="display: flex; flex-direction: column; min-width: 0;">
                <span style="font-size: 13px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(sug.note)}</span>
                <span style="font-size: 11px; color: var(--text-secondary);">${currSym} ${formatDisplayAmount(sug.amount)} • Ημέρα ~${sug.suggestedDay}</span>
              </div>
            </div>
            <button type="button" onclick="acceptDetectedSubscription(${idx})"
              style="padding: 5px 10px; border-radius: 8px; background: var(--accent); color: white; border: none; font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap;">
              ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_btn_add_suggested']) || '+ Προσθήκη'}
            </button>
          </div>
        `;
      });

      detectHtml += `</div></div>`;
      detectContainer.innerHTML = detectHtml;
      detectContainer.style.display = 'block';
      window._activeSubscriptionSuggestions = suggestions;
    } else {
      detectContainer.style.display = 'none';
      detectContainer.innerHTML = '';
      window._activeSubscriptionSuggestions = [];
    }
  }

  // 3. Items list
  const listContainer = document.getElementById('sub-hub-items-list');
  if (listContainer) {
    if (analysis.items.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-secondary); font-size: 13.5px;">
          <div style="font-size: 32px; margin-bottom: 8px; opacity: 0.6;">📅</div>
          <div>${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_no_subs']) || 'Δεν υπάρχουν καταχωρημένες πάγιες υποχρεώσεις.'}</div>
          <button type="button" onclick="closeModal('subscriptions-hub-modal'); openModal('recurring-picker-modal');"
            style="margin-top: 12px; padding: 8px 16px; border-radius: 12px; background: rgba(var(--accent-rgb), 0.15); border: 1px solid var(--accent); color: var(--primary); font-size: 12.5px; font-weight: 700; cursor: pointer;">
            ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_btn_add_suggested']) || '+ Προσθήκη Πάγιας Εντολής'}
          </button>
        </div>
      `;
    } else {
      let listHtml = '';
      analysis.items.forEach(item => {
        const catInfo = (typeof getCategoryInfo === 'function') ? getCategoryInfo(item.category, 'expense') : { icon: '💳', color: '#6366f1' };
        const iconHtml = (typeof renderCategoryIconHtml === 'function')
          ? renderCategoryIconHtml(item.category, { size: 'md', customColor: catInfo.color, transType: 'expense' })
          : `<div style="width: 38px; height: 38px; border-radius: 10px; background: ${catInfo.color}20; color: ${catInfo.color}; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">${catInfo.icon || '💳'}</div>`;

        let statusBadge = '';
        let dueTimingText = '';

        if (item.isPaid) {
          statusBadge = `<span class="sub-status-badge paid"><i class="fa-solid fa-check"></i> ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_status_paid']) || 'Πληρώθηκε'}</span>`;
          if (item.matchedTransaction && item.matchedTransaction.date) {
            dueTimingText = `${formatShortDate(item.matchedTransaction.date)}`;
          } else {
            dueTimingText = `${item.dueDay} ${lang === 'el' ? 'μηνός' : 'of month'}`;
          }
        } else if (item.isOverdue) {
          statusBadge = `<span class="sub-status-badge overdue"><i class="fa-solid fa-triangle-exclamation"></i> ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_status_overdue']) || 'Καθυστέρηση'}</span>`;
          dueTimingText = `${item.dueDay} ${lang === 'el' ? 'μηνός' : 'of month'}`;
        } else {
          statusBadge = `<span class="sub-status-badge pending"><i class="fa-regular fa-clock"></i> ${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_status_pending']) || 'Εκκρεμεί'}</span>`;
          if (item.daysUntilDue === 0) {
            dueTimingText = lang === 'el' ? 'Σήμερα' : 'Today';
          } else if (item.daysUntilDue === 1) {
            dueTimingText = lang === 'el' ? 'Αύριο' : 'Tomorrow';
          } else {
            dueTimingText = lang === 'el' ? `σε ${item.daysUntilDue} ημ.` : `in ${item.daysUntilDue}d`;
          }
        }

        listHtml += `
          <div class="sub-item-card">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
              ${iconHtml}
              <div style="display: flex; flex-direction: column; min-width: 0;">
                <div style="font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(item.title)}
                </div>
                <div style="font-size: 11.5px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                  <span>${dueTimingText}</span>
                  <span>•</span>
                  <span>${getCategoryDisplayName ? getCategoryDisplayName(item.category) : item.category}</span>
                </div>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0;">
              <div style="font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 800; color: ${item.isPaid ? 'var(--text-secondary)' : '#ffffff'};">
                ${currSym} ${formatDisplayAmount(item.amount)}
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                ${statusBadge}
                ${!item.isPaid ? `
                  <button type="button" class="sub-quick-pay-btn" onclick="quickPaySubscription('${item.id}')">
                    <i class="fa-solid fa-bolt"></i> <span>${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['sub_hub_btn_pay']) || 'Πληρωμή'}</span>
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      });
      listContainer.innerHTML = listHtml;
    }
  }
}
window.renderSubscriptionsHub = renderSubscriptionsHub;

function acceptDetectedSubscription(suggestionIndex) {
  const suggestions = window._activeSubscriptionSuggestions || [];
  const sug = suggestions[suggestionIndex];
  if (!sug) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const dueDay = Math.min(sug.suggestedDay || 1, new Date(year, month + 1, 0).getDate());
  const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;

  const newTemplate = {
    id: generateUUID(),
    category: sug.category || 'Bills',
    note: sug.note,
    amount: sug.amount,
    currency: sug.currency || state.mainCurrency || 'EUR',
    type: 'expense',
    preset: 'monthly',
    days: [dueDay],
    startDate: startDateStr,
    endType: 'perpetual',
    is_shared: false
  };

  if (!state.recurringTemplates) state.recurringTemplates = [];
  state.recurringTemplates.push(newTemplate);
  localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));

  if (state.supabaseClient && state.currentUser) {
    if (typeof mapTemplateToDb === 'function') {
      state.supabaseClient.from('recurring_templates').upsert([mapTemplateToDb(newTemplate)])
        .catch(err => console.warn('Failed to sync accepted subscription template:', err));
    }
  }

  if (typeof showToast === 'function') {
    showToast(state.lang === 'el' ? '✓ Η συνδρομή προστέθηκε στα πάγια!' : '✓ Subscription added to recurring bills!', 'success');
  }
  renderSubscriptionsHub();
  updateSafeToSpendUI();
}
window.acceptDetectedSubscription = acceptDetectedSubscription;

function quickPaySubscription(templateId) {
  const tpl = (state.recurringTemplates || []).find(t => String(t.id) === String(templateId));
  if (!tpl) return;

  // Pay the next uncovered occurrence only: an occurrence amount capped by the
  // analyzed remaining amount (supports partial payments and multi-occurrence
  // cadences such as weekly/daily without overpaying the whole month at once).
  const analysis = state._lastSubscriptionsAnalysis;
  const analysisItem = (analysis && Array.isArray(analysis.items))
    ? analysis.items.find(item => String(item.id) === String(templateId))
    : null;
  const occurrenceAmount = sanitizeFloat(parseFloat(tpl.amount) || 0);
  const amountToPay = analysisItem && analysisItem.remainingAmount > 0
    ? sanitizeFloat(Math.min(occurrenceAmount, analysisItem.remainingAmount))
    : occurrenceAmount;

  const todayStr = (typeof formatISODateLocal === 'function') ? formatISODateLocal(new Date()) : new Date().toISOString().slice(0, 10);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const tx = {
    id: generateUUID(),
    date: todayStr,
    time: timeStr,
    type: 'expense',
    category: tpl.category || 'Bills',
    amount: amountToPay,
    note: tpl.note || tpl.category || 'Recurring Payment',
    recurring_template_id: tpl.id,
    is_recurring: true,
    payment_method: tpl.payment_method || (state.accounts && state.accounts[0] ? state.accounts[0].name : 'Cash'),
    user_id: state.currentUser ? state.currentUser.id : null,
    family_id: (tpl.is_shared && state.currentFamilyId) ? state.currentFamilyId : null
  };

  if (!state.transactions) state.transactions = [];
  state.transactions.unshift(tx);
  localStorage.setItem('transactions', JSON.stringify(state.transactions));

  if (state.supabaseClient && state.currentUser) {
    state.supabaseClient.from('transactions').insert([tx])
      .catch(err => console.warn('Failed to insert quick-pay recurring transaction to cloud:', err));
  }

  if (typeof showToast === 'function') {
    showToast(state.lang === 'el' ? `✓ Καταχωρήθηκε η πληρωμή: ${tx.note}` : `✓ Payment logged: ${tx.note}`, 'success');
  }
  renderSubscriptionsHub();
  updateSafeToSpendUI();
  if (typeof updateUI === 'function') {
    updateUI();
  }
}
window.quickPaySubscription = quickPaySubscription;

  // Window Bindings
  window.getLiquidBalance = getLiquidBalance;
  window.computeLiquidBalance = computeLiquidBalance;
  window.getSafeToSpendInputs = getSafeToSpendInputs;
  window.getDiscretionaryBudgets = getDiscretionaryBudgets;
  window.isSavingsBudget = isSavingsBudget;
  window.isRecurringTemplateCoveredByBudget = isRecurringTemplateCoveredByBudget;
  window.getUnpaidRecurringBillsThisMonth = getUnpaidRecurringBillsThisMonth;
  window.getMonthlySavingsGoal = getMonthlySavingsGoal;
  window.getAnnualSavingsTarget = getAnnualSavingsTarget;
  window.getYearSavingsProgress = getYearSavingsProgress;
  window.getEffectiveMonthlySavingsGoal = getEffectiveMonthlySavingsGoal;
  window.renderStsSavingsRow = renderStsSavingsRow;
  window.updateSafeToSpendUI = updateSafeToSpendUI;
  window.openSafeToSpendModal = openSafeToSpendModal;
  window.setStsSimInstallments = setStsSimInstallments;
  window.runWhatIfSimulation = runWhatIfSimulation;
  window.openAiAdvisorFromBar = openAiAdvisorFromBar;
  window.openSubscriptionsHubModal = openSubscriptionsHubModal;
  window.renderSubscriptionsHub = renderSubscriptionsHub;
  window.acceptDetectedSubscription = acceptDetectedSubscription;
  window.quickPaySubscription = quickPaySubscription;
  window.toggleStsSavingsGoalEditor = toggleStsSavingsGoalEditor;
  window.setStsSavingsInputValue = setStsSavingsInputValue;
  window.saveStsSavingsGoal = saveStsSavingsGoal;
  window.updateStsSavingsAnnualHint = updateStsSavingsAnnualHint;

  return {
    getLiquidBalance: getLiquidBalance,
    computeLiquidBalance: computeLiquidBalance,
    getSafeToSpendInputs: getSafeToSpendInputs,
    getDiscretionaryBudgets: getDiscretionaryBudgets,
    isSavingsBudget: isSavingsBudget,
    isRecurringTemplateCoveredByBudget: isRecurringTemplateCoveredByBudget,
    getUnpaidRecurringBillsThisMonth: getUnpaidRecurringBillsThisMonth,
    getMonthlySavingsGoal: getMonthlySavingsGoal,
    getAnnualSavingsTarget: getAnnualSavingsTarget,
    getYearSavingsProgress: getYearSavingsProgress,
    getEffectiveMonthlySavingsGoal: getEffectiveMonthlySavingsGoal,
    renderStsSavingsRow: renderStsSavingsRow,
    updateSafeToSpendUI: updateSafeToSpendUI,
    openSafeToSpendModal: openSafeToSpendModal,
    setStsSimInstallments: setStsSimInstallments,
    runWhatIfSimulation: runWhatIfSimulation,
    openAiAdvisorFromBar: openAiAdvisorFromBar,
    openSubscriptionsHubModal: openSubscriptionsHubModal,
    renderSubscriptionsHub: renderSubscriptionsHub,
    acceptDetectedSubscription: acceptDetectedSubscription,
    quickPaySubscription: quickPaySubscription,
    toggleStsSavingsGoalEditor: toggleStsSavingsGoalEditor,
    setStsSavingsInputValue: setStsSavingsInputValue,
    saveStsSavingsGoal: saveStsSavingsGoal,
    updateStsSavingsAnnualHint: updateStsSavingsAnnualHint
  };
}));
