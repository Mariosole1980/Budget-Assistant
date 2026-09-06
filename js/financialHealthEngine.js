// ============================================================
// FINANCIAL HEALTH SCORE (FHS) & FORECASTING ENGINE
// Autonomous UMD Module (Phase 11C Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FinancialHealthEngine = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var windowObj = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
  var window = windowObj;

function classifyCategory(categoryName) {
  const norm = normalizeString(categoryName);
  const essentialKeywords = [
    'ΣΠΙΤΙ', 'HOME', 'RENT', 'ΕΝΟΙΚΙΟ',
    'ΔΙΑΤΡΟΦΗ', 'FOOD', 'SUPERMARKET', 'ΣΟΥΠΕΡ ΜΑΡΚΕΤ', 'ΣΟΥΠΕΡΜΑΡΚΕΤ',
    'ΥΓΕΙΑ', 'HEALTH', 'PHARMACY', 'ΦΑΡΜΑΚΕΙΟ', 'ΓΙΑΤΡΟΣ',
    'ΦΟΡΟΙ', 'TAXES', 'ΛΟΓΙΣΤΗΣ', 'ACCOUNTANT',
    'ΜΕΤΑΚΙΝΗΣΗ', 'TRANSIT', 'METRO', 'ΛΕΩΦΟΡΕΙΟ', 'BUS', 'ΣΥΓΚΟΙΝΩΝΙΕΣ'
  ];
  const isEssential = essentialKeywords.some(kw => norm.includes(kw));
  return {
    isEssential: isEssential,
    isLifestyle: !isEssential
  };
}

/**
 * Calculates the Financial Health Score (1-100)
 */
function calculateFinancialHealthScore(transactions, accounts, hasHistoricalData) {
  const lang = state.lang || 'el';
  const hasAnyActivity = Array.isArray(transactions) && transactions.some(t => t && t.date && !isTransferTransaction(t) && (t.type === 'income' || t.type === 'expense'));

  if (!hasAnyActivity) {
    return {
      score: null,
      displayScore: '--',
      label: lang === 'el' ? 'Αναμονή Δεδομένων' : 'Awaiting Data',
      isNoData: true,
      isTemporary: true,
      savingsRateScore: 0,
      emergencyFundScore: 0,
      expenseTrendScore: 0,
      weightedSavings: 0,
      weightedEmergency: 0,
      weightedTrend: 0,
      monthsCovered: 0,
      savingsRate: 0,
      survivalRunway: 0,
      lifestyleRunway: 0,
      liquidBalance: 0
    };
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11

  // Filter current month transactions (excluding transfers)
  const currentMonthTrans = transactions.filter(t => {
    if (!t.date || isTransferTransaction(t)) return false;
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1; // 0-11
    return y === currentYear && m === currentMonth;
  });

  // Calculate current month's income and expense
  let currentMonthIncome = 0;
  let currentMonthExpense = 0;
  currentMonthTrans.forEach(t => {
    const amt = CurrencyService.toBase(t);
    if (t.type === 'income') currentMonthIncome += amt;
    if (t.type === 'expense') currentMonthExpense += amt;
  });

  // --- CRITERION 1: Savings Rate (40%) ---
  let savingsRateScore = 0;
  let savingsRate = 0;
  if (currentMonthIncome > 0) {
    savingsRate = (currentMonthIncome - currentMonthExpense) / currentMonthIncome;
    if (savingsRate >= 0.40) {
      savingsRateScore = 100;
    } else if (savingsRate > 0) {
      if (savingsRate <= 0.10) {
        savingsRateScore = (savingsRate / 0.10) * 50;
      } else if (savingsRate <= 0.20) {
        savingsRateScore = 50 + ((savingsRate - 0.10) / 0.10) * 30;
      } else {
        savingsRateScore = 80 + ((savingsRate - 0.20) / 0.20) * 20;
      }
    } else {
      savingsRateScore = 0;
    }
  } else {
    savingsRateScore = currentMonthExpense > 0 ? 0 : 50; // Neutral if no activity
  }

  // --- CRITERION 2: Emergency Fund (40%) ---
  // Calculate liquid balance as the net balance (income - expense) of the target year (currentYear)
  const targetYearTrans = transactions.filter(t => {
    if (!t.date || isTransferTransaction(t)) return false;
    const parts = String(t.date).split('T')[0].split(' ')[0].split('-');
    if (parts.length !== 3) return false;
    return parseInt(parts[0], 10) === currentYear;
  });

  let targetYearIncome = 0;
  let targetYearExpense = 0;
  targetYearTrans.forEach(t => {
    const amt = CurrencyService.toBase(t);
    if (t.type === 'income') targetYearIncome += amt;
    if (t.type === 'expense') targetYearExpense += amt;
  });

  const currentBankBalance = targetYearIncome - targetYearExpense;

  // Compute average monthly expenses (all and essential)
  let avgMonthlyExpense = 0;
  let avgEssentialMonthlyExpense = 0;

  // Let's compute current month's essential expenses
  let currentMonthEssentialExpense = 0;
  currentMonthTrans.forEach(t => {
    const amt = CurrencyService.toBase(t);
    if (t.type === 'expense') {
      const cls = classifyCategory(t.category);
      if (cls.isEssential) {
        currentMonthEssentialExpense += amt;
      }
    }
  });

  if (hasHistoricalData) {
    const monthlyExpensesMap = {};
    const monthlyEssentialMap = {};

    transactions.forEach(t => {
      if (t.type !== 'expense' || !t.date) return;
      const datePart = String(t.date || '').split('T')[0].split(' ')[0];
      const parts = datePart.split('-');
      if (parts.length !== 3) return;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;

      // Restrict historical data strictly to current calendar year
      if (y !== currentYear) return;
      // Exclude current month
      if (y === currentYear && m === currentMonth) return;

      const key = `${y}-${m}`;
      const amt = CurrencyService.toBase(t);

      monthlyExpensesMap[key] = (monthlyExpensesMap[key] || 0) + amt;

      const cls = classifyCategory(t.category);
      if (cls.isEssential) {
        monthlyEssentialMap[key] = (monthlyEssentialMap[key] || 0) + amt;
      }
    });

    // Stable divisor: count actual elapsed months since the first expense of the current year up to the previous month
    let firstActiveMonth = currentMonth;
    transactions.forEach(t => {
      if (!t.date || t.type !== 'expense') return;
      const datePart = String(t.date || '').split('T')[0].split(' ')[0];
      const parts = datePart.split('-');
      if (parts.length !== 3) return;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (y === currentYear && m < firstActiveMonth) {
        firstActiveMonth = m;
      }
    });

    const elapsedMonthsInYear = currentMonth - firstActiveMonth;
    const monthsCount = Math.max(1, elapsedMonthsInYear);

    const totalHistoricalExpense = Object.values(monthlyExpensesMap).reduce((a, b) => a + b, 0);
    avgMonthlyExpense = totalHistoricalExpense / monthsCount;

    const totalHistoricalEssential = Object.values(monthlyEssentialMap).reduce((a, b) => a + b, 0);
    avgEssentialMonthlyExpense = totalHistoricalEssential / monthsCount;
  } else {
    avgMonthlyExpense = currentMonthExpense;
    avgEssentialMonthlyExpense = currentMonthEssentialExpense;
  }

  if (avgMonthlyExpense <= 0) avgMonthlyExpense = 1000; // reasonable fallback
  if (avgEssentialMonthlyExpense <= 0) avgEssentialMonthlyExpense = avgMonthlyExpense * 0.75; // fallback to 75%
  if (avgEssentialMonthlyExpense > avgMonthlyExpense) avgEssentialMonthlyExpense = avgMonthlyExpense;

  const monthsCovered = currentBankBalance / avgMonthlyExpense;
  const survivalRunway = currentBankBalance / avgEssentialMonthlyExpense;
  const lifestyleRunway = monthsCovered;

  let emergencyFundScore = 0;
  if (monthsCovered >= 12) {
    emergencyFundScore = 100;
  } else if (monthsCovered > 0) {
    if (monthsCovered <= 3) {
      emergencyFundScore = (monthsCovered / 3) * 50;
    } else if (monthsCovered <= 6) {
      emergencyFundScore = 50 + ((monthsCovered - 3) / 3) * 30;
    } else {
      emergencyFundScore = 80 + ((monthsCovered - 6) / 6) * 20;
    }
  } else {
    emergencyFundScore = 0;
  }

  // --- CRITERION 3: Expense Trend (20%) ---
  let expenseTrendScore = 0;
  let isTemporary = false;

  if (hasHistoricalData) {
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevYearNum = prevMonthDate.getFullYear();
    const prevMonthNum = prevMonthDate.getMonth();

    let prevMonthExpense = 0;
    transactions.forEach(t => {
      if (t.type === 'expense' && t.date) {
        const datePart = String(t.date || '').split('T')[0].split(' ')[0];
        const parts = datePart.split('-');
        if (parts.length !== 3) return;
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (y === prevYearNum && m === prevMonthNum) {
          prevMonthExpense += CurrencyService.toBase(t);
        }
      }
    });

    if (prevMonthExpense > 0) {
      if (currentMonthExpense <= prevMonthExpense) {
        expenseTrendScore = 100;
      } else {
        const pctIncrease = (currentMonthExpense - prevMonthExpense) / prevMonthExpense;
        expenseTrendScore = Math.max(0, 100 - (pctIncrease * 200));
      }
    } else {
      expenseTrendScore = currentMonthExpense <= currentMonthIncome ? 100 : 50;
    }
  } else {
    isTemporary = true;
    if (currentMonthExpense < currentMonthIncome) {
      expenseTrendScore = 100;
    } else {
      expenseTrendScore = 30;
    }
  }

  let finalScore = (savingsRateScore * 0.40) + (emergencyFundScore * 0.40) + (expenseTrendScore * 0.20);
  finalScore = Math.min(100, Math.max(0, finalScore));

  let label = '';
  if (lang === 'el') {
    if (finalScore >= 85) label = 'Εξαιρετική Οικονομική Υγεία';
    else if (finalScore >= 70) label = 'Καλή Οικονομική Υγεία';
    else if (finalScore >= 50) label = 'Μέτρια Οικονομική Υγεία';
    else label = 'Χρειάζεται Προσοχή';
  } else {
    if (finalScore >= 85) label = 'Excellent Financial Health';
    else if (finalScore >= 70) label = 'Good Financial Health';
    else if (finalScore >= 50) label = 'Average Financial Health';
    else label = 'Needs Attention';
  }

  return {
    score: finalScore,
    label: label,
    isTemporary: isTemporary,
    savingsRateScore: savingsRateScore,
    emergencyFundScore: emergencyFundScore,
    expenseTrendScore: expenseTrendScore,
    weightedSavings: savingsRateScore * 0.4,
    weightedEmergency: emergencyFundScore * 0.4,
    weightedTrend: expenseTrendScore * 0.2,
    monthsCovered: monthsCovered,
    savingsRate: savingsRate,
    survivalRunway: survivalRunway,
    lifestyleRunway: lifestyleRunway,
    liquidBalance: currentBankBalance
  };
}

/**
 * Calculates Year-End Forecasting (Run-Rate)
 */
function calculateForecasting(transactions, hasHistoricalData) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11

  // Filter current year transactions (excluding transfers)
  const currentYearTrans = transactions.filter(t => {
    if (!t.date || isTransferTransaction(t)) return false;
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    return y === currentYear;
  });

  let currentYearIncome = 0;
  let currentYearExpense = 0;
  currentYearTrans.forEach(t => {
    const amt = CurrencyService.toBase(t);
    if (t.type === 'income') currentYearIncome += amt;
    if (t.type === 'expense') currentYearExpense += amt;
  });

  const currentYearSavings = currentYearIncome - currentYearExpense;
  const lang = state.lang || 'el';

  // Handle December case (Year-End Review)
  if (currentMonth === 11) {
    if (!hasHistoricalData) {
      const juneTrans = currentYearTrans.filter(t => {
        const datePart = String(t.date || '').split('T')[0].split(' ')[0];
        const parts = datePart.split('-');
        if (parts.length !== 3) return false;
        const m = parseInt(parts[1], 10) - 1;
        return m <= 5; // Jan to Jun
      });

      let juneIncome = 0;
      let juneExpense = 0;
      juneTrans.forEach(t => {
        const amt = CurrencyService.toBase(t);
        if (t.type === 'income') juneIncome += amt;
        if (t.type === 'expense') juneExpense += amt;
      });

      const juneSavings = juneIncome - juneExpense;
      const juneAvgMonthly = juneSavings / 6;
      const juneForecastProjection = juneSavings + (juneAvgMonthly * 6);

      const msg = lang === 'el'
        ? `Ολοκληρώθηκε ο πρώτος σας χρόνος! Η αρχική εκτίμηση του Ιουνίου προέβλεπε αποταμίευση € ${formatCurrency(juneForecastProjection)} και καταφέρατε να φτάσετε τα € ${formatCurrency(currentYearSavings)}. Είστε εντός στόχων!`
        : `Your first year is complete! The initial projection in June was € ${formatCurrency(juneForecastProjection)} and you achieved € ${formatCurrency(currentYearSavings)}. You are on track!`;

      return {
        isYearEnd: true,
        isNewUser: true,
        actualSavings: currentYearSavings,
        projectedSavings: juneForecastProjection,
        diff: currentYearSavings - juneForecastProjection,
        message: msg
      };
    } else {
      const prevYear = currentYear - 1;
      const prevYearTrans = transactions.filter(t => {
        if (!t.date || isTransferTransaction(t)) return false;
        const datePart = String(t.date || '').split('T')[0].split(' ')[0];
        const parts = datePart.split('-');
        if (parts.length !== 3) return false;
        const y = parseInt(parts[0], 10);
        return y === prevYear;
      });

      let prevYearIncome = 0;
      let prevYearExpense = 0;
      prevYearTrans.forEach(t => {
        const amt = CurrencyService.toBase(t);
        if (t.type === 'income') prevYearIncome += amt;
        if (t.type === 'expense') prevYearExpense += amt;
      });

      const prevYearSavings = prevYearIncome - prevYearExpense;
      const pctDiff = prevYearSavings > 0
        ? ((currentYearSavings - prevYearSavings) / prevYearSavings) * 100
        : 0;

      const sign = pctDiff >= 0 ? '+' : '';
      const msg = lang === 'el'
        ? `Το ${prevYear} είχατε αποταμιεύσει € ${formatCurrency(prevYearSavings)}. Φέτος κλείσατε στα € ${formatCurrency(currentYearSavings)} (${sign}${pctDiff.toFixed(1)}%). Εξαιρετική εξέλιξη!`
        : `In ${prevYear} you saved € ${formatCurrency(prevYearSavings)}. This year you closed at € ${formatCurrency(currentYearSavings)} (${sign}${pctDiff.toFixed(1)}%). Great progress!`;

      return {
        isYearEnd: true,
        isNewUser: false,
        actualSavings: currentYearSavings,
        prevYearSavings: prevYearSavings,
        pctDiff: pctDiff,
        message: msg
      };
    }
  }

  const elapsedMonths = currentMonth + 1; // 1-indexed (June = 6)
  const avgMonthlyIncome = currentYearIncome / elapsedMonths;
  const avgMonthlyExpense = currentYearExpense / elapsedMonths;
  const avgMonthlySavings = currentYearSavings / elapsedMonths;
  const remainingMonths = 12 - elapsedMonths;
  const projectedYearEndSavings = currentYearSavings + (avgMonthlySavings * remainingMonths);

  // Best Case: expenses reduced by 15% for the remaining months
  const bestMonthlySavings = avgMonthlyIncome - (avgMonthlyExpense * 0.85);
  const bestCaseSavings = currentYearSavings + (bestMonthlySavings * remainingMonths);

  // Worst Case: expenses increased by 15% for the remaining months
  const worstMonthlySavings = avgMonthlyIncome - (avgMonthlyExpense * 1.15);
  const worstCaseSavings = currentYearSavings + (worstMonthlySavings * remainingMonths);

  return {
    isYearEnd: false,
    currentYearSavings: currentYearSavings,
    avgMonthlySavings: avgMonthlySavings,
    projectedSavings: projectedYearEndSavings,
    bestCaseSavings: bestCaseSavings,
    worstCaseSavings: worstCaseSavings,
    remainingMonths: remainingMonths
  };
}

  // UMD Exports & Window Binding
  window.classifyCategory = classifyCategory;
  window.calculateFinancialHealthScore = calculateFinancialHealthScore;
  window.calculateForecasting = calculateForecasting;

  return {
    classifyCategory: classifyCategory,
    calculateFinancialHealthScore: calculateFinancialHealthScore,
    calculateForecasting: calculateForecasting
  };
}));
