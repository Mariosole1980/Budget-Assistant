// ============================================================
// ACCOUNTS & WALLETS MANAGEMENT TAB
// Autonomous UMD Module (Phase 12D Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AccountsView = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

function renderAccountsTab() {
  const assetsEl = document.getElementById('accounts-assets-list');
  const liabEl = document.getElementById('accounts-liabilities-list');

  // Anti-flicker signature check — skip full rebuild if data hasn't changed
  const _now = new Date();
  const _acctSig = (state.accounts || []).map(a => `${a.id}_${a.name}_${a.balance}_${a.type}`).join('|')
    + '||' + (state.transactions || []).length
    + '||' + (state.overviewYear || _now.getFullYear())
    + '||' + (state.lang || 'el')
    + '||' + (state.currentUser ? state.currentUser.id : 'none')
    + '||' + (state.customSavingsTarget || '')
    + '||' + `${_now.getFullYear()}-${_now.getMonth()}`
    + '||' + getDisplayCurrency();
  if (assetsEl && assetsEl._lastRenderSignature === _acctSig) return;
  if (assetsEl) assetsEl._lastRenderSignature = _acctSig;

  if (assetsEl) assetsEl.innerHTML = '';
  if (liabEl) liabEl.innerHTML = '';

  // Restore collapsible list preferences
  ['income', 'expense'].forEach(type => {
    const isExpanded = localStorage.getItem(`overview_collapse_${type}`) === 'expanded'; // default to false (collapsed)
    const content = document.getElementById(type === 'income' ? 'accounts-assets-list' : 'accounts-liabilities-list');
    const icon = document.getElementById(type === 'income' ? 'collapse-icon-income' : 'collapse-icon-expense');
    if (content && icon) {
      content.classList.toggle('active', isExpanded);
      icon.classList.toggle('active', isExpanded);
    }
  });

  // 1. Calculate current year history values from transactions (excluding transfers)
  const activeTrans = getActiveTransactions();
  const currentYearOverview = state.overviewYear || new Date().getFullYear();

  const nonTransferTrans = activeTrans.filter(t => {
    if (isTransferTransaction(t)) return false;
    if (!t.date) return false;
    const y = parseInt(String(t.date).split('T')[0].split('-')[0], 10);
    return y === currentYearOverview;
  });

  let overallMinDate = null;
  let overallMaxDate = null;
  let overallIncome = 0;
  let overallExpense = 0;

  // Aggregate directly in the display (app) currency so each transaction is
  // converted from its own stored base_currency with the exchange rate when the
  // app currency changes (e.g. 1316 € → ~1420 $).
  const displayCurrency = getDisplayCurrency();
  // FHS and forecast values are computed via CurrencyService.toBase(t), so they
  // are cached in each transaction's `base_currency` (the OLD app currency after
  // a currency change). Convert them from that source currency to the display
  // currency when rendering.
  const fhsSourceCurrency = getTransactionsBaseCurrency(activeTrans);

  nonTransferTrans.forEach(t => {
    if (!t.date) return;
    if (!overallMinDate || t.date < overallMinDate) overallMinDate = t.date;
    if (!overallMaxDate || t.date > overallMaxDate) overallMaxDate = t.date;

    const amt = CurrencyService.displayAmount(t, displayCurrency);
    if (t.type === 'income') {
      overallIncome += amt;
    } else if (t.type === 'expense') {
      overallExpense += amt;
    }
  });

  const overallNet = overallIncome - overallExpense;

  const titleEl = document.getElementById('dynamic-overview-title');
  if (titleEl) {
    titleEl.textContent = state.lang === 'el' ? 'ΕΠΙΣΚΟΠΗΣΗ' : 'OVERVIEW';
  }
  const subtitleEl = document.getElementById('dynamic-overview-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = state.lang === 'el' ? `Έτος ${currentYearOverview}` : `Year ${currentYearOverview}`;
  }

  // Set selected year title
  const yearTitleEl = document.getElementById('overview-year-title');
  if (yearTitleEl) {
    yearTitleEl.textContent = currentYearOverview;
  }

  // 2. Set the overall history period (From 01/01/YYYY to today)
  const overallDatesEl = document.getElementById('overall-history-dates');
  const overallMathEl = document.getElementById('overall-history-math');

  if (overallDatesEl) {
    overallDatesEl.textContent = state.lang === 'el' ? `Περίοδος: 01/01/${currentYearOverview} - Σήμερα` : `Period: 01/01/${currentYearOverview} - Today`;
  }

  if (overallMathEl) {
    overallMathEl.style.display = 'none';
  }

  // 3. Populate the top card overall columns (Income, Expenses, Net Balance)
  document.getElementById('total-assets-val').textContent = `${getCurrencySymbol()} ${formatDisplayAmount(overallIncome, displayCurrency)}`;
  document.getElementById('total-liabilities-val').textContent = `${getCurrencySymbol()} ${formatDisplayAmount(overallExpense, displayCurrency)}`;
  const netElContainer = document.getElementById('total-net-val-container');
  const netEl = document.getElementById('total-net-val');
  if (netEl) netEl.textContent = `${getCurrencySymbol()} ${formatDisplayAmount(overallNet, displayCurrency)}`;
  if (netElContainer) {
    netElContainer.className = overallNet >= 0 ? 'overview-val' : 'overview-val negative';
  }

  // 3b. Multi-currency: Net Worth across all accounts (converted to base currency).
  // Only shown when multi-currency is enabled AND at least one account uses a
  // different currency than the base currency.
  const netWorthRow = document.getElementById('multi-currency-net-worth-row');
  const netWorthVal = document.getElementById('multi-currency-net-worth-val');
  if (netWorthRow && netWorthVal) {
    const baseCurrency = localStorage.getItem('app_currency') || 'EUR';
    const hasForeignAccounts = (state.accounts || []).some(a => (a.currency || baseCurrency) !== baseCurrency);
    if (hasForeignAccounts) {
      const netWorth = computeNetWorth();
      if (netWorth != null) {
        netWorthRow.style.display = '';
        const displayCurrency = getDisplayCurrency();
        const displayVal = displayAmountInDisplayCurrency(netWorth);
        netWorthVal.textContent = `${CurrencyService.getSymbol(displayCurrency)} ${formatCurrency(displayVal != null ? displayVal : netWorth)}`;
        netWorthVal.style.color = netWorth >= 0 ? 'var(--blue-positive, #10b981)' : 'var(--red-negative, #ff5b5b)';
      } else {
        netWorthRow.style.display = 'none';
      }
    } else {
      netWorthRow.style.display = 'none';
    }
  }

  // --- FINANCIAL HEALTH SCORE CALCULATIONS & RENDERING ---
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const hasHistoricalData = activeTrans.some(t => {
    if (!t.date || isTransferTransaction(t)) return false;
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    // Only check historical months within the current calendar year to prevent score dilution
    return y === currentYear && m < currentMonth;
  });

  const fhs = calculateFinancialHealthScore(activeTrans, state.accounts, hasHistoricalData);
  state.currentFhs = fhs; // Save globally so click listeners can read it

  const scoreEl = document.getElementById('fhs-score-value');
  const labelEl = document.getElementById('fhs-label');
  const hintEl = document.getElementById('fhs-hint');

  const scoreStr = typeof fhs.score === 'number' ? fhs.score.toFixed(1) + '%' : (fhs.displayScore || '--');
  if (scoreEl) scoreEl.textContent = scoreStr;
  if (labelEl) labelEl.textContent = fhs.label;
  if (hintEl) {
    if (fhs.isNoData) {
      hintEl.textContent = state.lang === 'el'
        ? 'Καταχωρήστε τα πρώτα σας έσοδα και έξοδα για να υπολογιστεί το σκορ'
        : 'Add your first income and expenses to calculate your score';
    } else if (fhs.isTemporary) {
      hintEl.textContent = state.lang === 'el'
        ? 'Προσωρινό σκορ βάσει των πρώτων δεδομένων'
        : 'Temporary score based on initial data';
    } else {
      hintEl.textContent = state.lang === 'el'
        ? 'Βασίζεται στο ρυθμό αποταμίευσης και το ταμείο έκτακτης ανάγκης'
        : 'Based on savings rate and emergency fund';
    }
  }

  // Update modal contents dynamically
  const modalScoreCircle = document.getElementById('fhs-modal-score-circle');
  const modalScoreLabel = document.getElementById('fhs-modal-score-label');
  const modalScoreValText = document.getElementById('fhs-modal-score-val-text');

  if (modalScoreValText) {
    modalScoreValText.textContent = scoreStr;
  } else if (modalScoreCircle) {
    modalScoreCircle.textContent = scoreStr;
  }
  if (modalScoreLabel) modalScoreLabel.textContent = fhs.label;

  const savingsValEl = document.getElementById('fhs-breakdown-savings-val');
  const savingsBarEl = document.getElementById('fhs-breakdown-savings-bar');
  const savingsDescEl = document.getElementById('fhs-breakdown-savings-desc');
  if (savingsValEl) savingsValEl.textContent = `${fhs.weightedSavings.toFixed(1)} / 40`;
  if (savingsBarEl) savingsBarEl.style.width = `${fhs.savingsRateScore}%`;
  if (savingsDescEl) {
    const srPct = Math.round(fhs.savingsRate * 1000) / 10;
    savingsDescEl.textContent = state.lang === 'el'
      ? `Τρέχων ρυθμός αποταμίευσης: ${srPct}% (Στόχος: >20% για καλό σκορ, 40% για άριστο)`
      : `Current savings rate: ${srPct}% (Target: >20% for good, 40% for perfect)`;
  }

  const emergencyValEl = document.getElementById('fhs-breakdown-emergency-val');
  const emergencyBarEl = document.getElementById('fhs-breakdown-emergency-bar');
  const emergencyDescEl = document.getElementById('fhs-breakdown-emergency-desc');
  if (emergencyValEl) emergencyValEl.textContent = `${fhs.weightedEmergency.toFixed(1)} / 40`;
  if (emergencyBarEl) emergencyBarEl.style.width = `${fhs.emergencyFundScore}%`;
  if (emergencyDescEl) {
    const survVal = Math.round((fhs.survivalRunway || 0) * 10) / 10;
    const lifeVal = Math.round((fhs.lifestyleRunway || 0) * 10) / 10;
    const survColor = survVal >= 6 ? '#66bb6a' : (survVal >= 3 ? '#ffa726' : '#ff5b5b');
    const lifeColor = lifeVal >= 6 ? '#66bb6a' : (lifeVal >= 3 ? '#ffa726' : '#ff5b5b');

    if (state.lang === 'el') {
      emergencyDescEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px; font-size: 11px; line-height: 1.4;">
          <div>🚨 <strong>Βασική Επιβίωση:</strong> <span style="color: ${survColor}; font-weight: 700;">${survVal.toFixed(1)} μήνες</span> <span style="color: var(--text-secondary); font-size: 9.5px;">(Αν κόψεις τα πάντα)</span></div>
          <div>🛒 <strong>Τρέχουσα Ζωή:</strong> <span style="color: ${lifeColor}; font-weight: 700;">${lifeVal.toFixed(1)} μήνες</span> <span style="color: var(--text-secondary); font-size: 9.5px;">(Αν συνεχίσεις όπως τώρα)</span></div>
        </div>
      `;
    } else {
      emergencyDescEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px; font-size: 11px; line-height: 1.4;">
          <div>🚨 <strong>Basic Survival:</strong> <span style="color: ${survColor}; font-weight: 700;">${survVal.toFixed(1)} months</span> <span style="color: var(--text-secondary); font-size: 9.5px;">(If you cut everything)</span></div>
          <div>🛒 <strong>Current Lifestyle:</strong> <span style="color: ${lifeColor}; font-weight: 700;">${lifeVal.toFixed(1)} months</span> <span style="color: var(--text-secondary); font-size: 9.5px;">(If you continue as now)</span></div>
        </div>
      `;
    }
  }

  const trendValEl = document.getElementById('fhs-breakdown-trend-val');
  const trendBarEl = document.getElementById('fhs-breakdown-trend-bar');
  const trendDescEl = document.getElementById('fhs-breakdown-trend-desc');
  if (trendValEl) trendValEl.textContent = `${fhs.weightedTrend.toFixed(1)} / 20`;
  if (trendBarEl) trendBarEl.style.width = `${fhs.expenseTrendScore}%`;
  if (trendDescEl) {
    if (fhs.isTemporary) {
      trendDescEl.textContent = state.lang === 'el'
        ? `Προσωρινό σκορ λόγω έλλειψης ιστορικού προηγούμενου μήνα.`
        : `Temporary score due to lack of previous month history.`;
    } else {
      trendDescEl.textContent = state.lang === 'el'
        ? `Βασίζεται στη σύγκριση των εξόδων αυτού του μήνα με τον προηγούμενο.`
        : `Based on comparison of this month's expenses with the previous.`;
    }
  }

  // Update collapsible explainability section details
  const explainLiquidEl = document.getElementById('fhs-explain-liquid-balance');
  const explainSurvivalEl = document.getElementById('fhs-explain-survival-months');
  const explainLifestyleEl = document.getElementById('fhs-explain-lifestyle-months');

  if (explainLiquidEl) {
    explainLiquidEl.textContent = formatDisplayAmount(fhs.liquidBalance || 0, fhsSourceCurrency);
  }
  if (explainSurvivalEl) {
    const survVal = Math.round((fhs.survivalRunway || 0) * 10) / 10;
    explainSurvivalEl.textContent = state.lang === 'el' ? `${survVal.toFixed(1)} μήνες` : `${survVal.toFixed(1)} months`;
  }
  if (explainLifestyleEl) {
    const lifeVal = Math.round((fhs.lifestyleRunway || 0) * 10) / 10;
    explainLifestyleEl.textContent = state.lang === 'el' ? `${lifeVal.toFixed(1)} μήνες` : `${lifeVal.toFixed(1)} months`;
  }

  // Populate dynamic bullet points explaining the score
  const bulletsEl = document.getElementById('fhs-explain-bullets');
  if (bulletsEl) {
    bulletsEl.innerHTML = '';

    const srPct = Math.round((fhs.savingsRate || 0) * 1000) / 10;
    const wSavings = (fhs.weightedSavings || 0).toFixed(1);
    const wEmergency = (fhs.weightedEmergency || 0).toFixed(1);
    const wTrend = (fhs.weightedTrend || 0).toFixed(1);
    const mc = (fhs.monthsCovered || 0).toFixed(1);

    let bullet1 = '';
    let bullet2 = '';
    let bullet3 = '';

    if (state.lang === 'el') {
      bullet1 = `<li>📈 <strong>Δείκτης Αποταμίευσης:</strong> Αποταμιεύσατε το <strong>${srPct}%</strong> των εσόδων σας, λαμβάνοντας <strong>${wSavings} / 40</strong> πόντους.</li>`;
      bullet2 = `<li>🛡️ <strong>Ταμείο Έκτακτης Ανάγκης:</strong> Το διαθέσιμο υπόλοιπό σας καλύπτει <strong>${mc}</strong> μήνες τρέχουσας ζωής (Στόχος: 6+ μήνες), λαμβάνοντας <strong>${wEmergency} / 40</strong> πόντους.</li>`;

      if (fhs.isTemporary) {
        bullet3 = `<li>📊 <strong>Τάση Εξόδων:</strong> Προσωρινό σκορ <strong>${wTrend} / 20</strong> λόγω έλλειψης ιστορικού προηγούμενου μήνα.</li>`;
      } else {
        const trendText = fhs.expenseTrendScore >= 100
          ? 'είναι χαμηλότερα από ή ίσα με τον προηγούμενο μήνα'
          : 'αυξήθηκαν σε σχέση με τον προηγούμενο μήνα';
        bullet3 = `<li>📊 <strong>Τάση Εξόδων:</strong> Τα έξοδά σας ${trendText}, λαμβάνοντας <strong>${wTrend} / 20</strong> πόντους.</li>`;
      }
    } else {
      bullet1 = `<li>📈 <strong>Savings Rate:</strong> You saved <strong>${srPct}%</strong> of your income, receiving <strong>${wSavings} / 40</strong> points.</li>`;
      bullet2 = `<li>🛡️ <strong>Emergency Fund:</strong> Your balance covers <strong>${mc}</strong> months of lifestyle expenses (Target: 6+ months), receiving <strong>${wEmergency} / 40</strong> points.</li>`;

      if (fhs.isTemporary) {
        bullet3 = `<li>📊 <strong>Expense Trend:</strong> Temporary score <strong>${wTrend} / 20</strong> due to lack of previous month history.</li>`;
      } else {
        const trendText = fhs.expenseTrendScore >= 100
          ? 'are lower than or equal to the previous month'
          : 'increased compared to the previous month';
        bullet3 = `<li>📊 <strong>Expense Trend:</strong> Your expenses ${trendText}, receiving <strong>${wTrend} / 20</strong> points.</li>`;
      }
    }

    bulletsEl.innerHTML = bullet1 + bullet2 + bullet3;
  }

  // --- SPENDING ADVISOR LOGIC ---
  const todayDate = new Date();
  const currYear = todayDate.getFullYear();
  const currMonth = todayDate.getMonth(); // 0-11

  const prevMonthDate = new Date(currYear, currMonth - 1, 1);
  const prevYearNum = prevMonthDate.getFullYear();
  const prevMonthNum = prevMonthDate.getMonth();

  const currMonthExpenses = {};
  const prevMonthExpenses = {};

  // Aggregate in the display (app) currency so the advisor comparison reflects
  // the exchange rate when the app currency changes.
  // NOTE: `displayCurrency` is already declared earlier in renderAccountsTab.

  activeTrans.forEach(t => {
    if (t.type !== 'expense' || !t.date) return;
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const amt = CurrencyService.displayAmount(t, displayCurrency);
    const cat = t.category || '';

    if (y === currYear && m === currMonth) {
      currMonthExpenses[cat] = (currMonthExpenses[cat] || 0) + amt;
    } else if (y === prevYearNum && m === prevMonthNum) {
      prevMonthExpenses[cat] = (prevMonthExpenses[cat] || 0) + amt;
    }
  });

  // Determine the comparison category: prefer the category with the largest
  // month-over-month increase, otherwise fall back to the top spending
  // category of the current month so the comparison always has content.
  let maxIncreaseCat = null;
  let maxIncreaseAmt = 0;

  Object.keys(currMonthExpenses).forEach(cat => {
    const currAmt = currMonthExpenses[cat] || 0;
    const prevAmt = prevMonthExpenses[cat] || 0;
    const diff = currAmt - prevAmt;
    if (diff > maxIncreaseAmt) {
      maxIncreaseAmt = diff;
      maxIncreaseCat = cat;
    }
  });

  // If there is no increase, fall back to the top current-month category so the
  // comparison bars always render below the advisor.
  if (!maxIncreaseCat || maxIncreaseAmt <= 0) {
    let topCat = null;
    let topAmt = 0;
    Object.keys(currMonthExpenses).forEach(cat => {
      const amt = currMonthExpenses[cat] || 0;
      if (amt > topAmt) {
        topAmt = amt;
        topCat = cat;
      }
    });
    if (topCat) {
      maxIncreaseCat = topCat;
      maxIncreaseAmt = (currMonthExpenses[topCat] || 0) - (prevMonthExpenses[topCat] || 0);
    }
  }

  const hasComparison = !!maxIncreaseCat;

  let advisorText = '';
  const advisorEl = document.getElementById('advisor-text');
  const cardEl = document.getElementById('advisor-card');
  const chevronEl = document.getElementById('advisor-chevron');
  const expandedContentEl = document.getElementById('advisor-expanded-content');

  if (hasComparison) {
    const prevAmt = prevMonthExpenses[maxIncreaseCat] || 0;
    const currAmt = currMonthExpenses[maxIncreaseCat] || 0;
    const diffAmt = currAmt - prevAmt;
    const isIncrease = diffAmt > 0;
    const pctVal = prevAmt > 0 ? Math.round((diffAmt / prevAmt) * 100) : null;
    const pctStr = pctVal !== null ? `${Math.abs(pctVal)}%` : '';

    // Clean emojis from category name for advice matching
    const cleanCat = maxIncreaseCat.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim().toUpperCase();

    // Map keywords to advice
    let grConsequence = "θα μειώσει το ποσοστό αποταμίευσής σου";
    let grAdvice = "έλεγξε τις επιμέρους συναλλαγές για να εντοπίσεις πού οφείλεται η αύξηση";
    let enConsequence = "will lower your savings rate";
    let enAdvice = "review individual transactions to identify what drove the increase";

    if (cleanCat.includes('ΣΠΙΤΙ') || cleanCat.includes('HOME') || cleanCat.includes('HOUSE')) {
      grConsequence = "θα επιβαρύνει σημαντικά τις σταθερές σου υποχρεώσεις";
      grAdvice = "προσπάθησε να ελέγξεις την κατανάλωση ρεύματος/θέρμανσης ή να συγκρίνεις παρόχους";
      enConsequence = "will heavily weigh on your fixed obligations";
      enAdvice = "try checking electricity/heating usage or compare utility providers";
    } else if (cleanCat.includes('ΔΙΑΤΡΟΦΗ') || cleanCat.includes('SUPERMARKET') || cleanCat.includes('MARKET') || cleanCat.includes('FOOD')) {
      grConsequence = "θα επηρεάσει άμεσα το μηνιαίο σου δείκτη αποταμίευσης";
      grAdvice = "σκέψου να προγραμματίσεις τα γεύματα της εβδομάδας (meal prep) ή να περιορίσεις 1-2 παραγγελίες delivery";
      enConsequence = "will directly affect your monthly savings rate";
      enAdvice = "consider planning your weekly meals (meal prep) or cutting 1-2 delivery orders";
    } else if (cleanCat.includes('ΑΥΤΟΚΙΝΗΤΟ') || cleanCat.includes('CAR') || cleanCat.includes('ΜΕΤΑΚΙΝΗΣΗ') || cleanCat.includes('TRANSPORT')) {
      grConsequence = "θα αυξήσει τα πάγια έξοδα μετακίνησής σου";
      grAdvice = "προσπάθησε να ομαδοποιήσεις τις διαδρομές σου ή να επιλέξεις εναλλακτικούς τρόπους μετακίνησης όπου είναι εφικτό";
      enConsequence = "will increase your fixed transportation costs";
      enAdvice = "try bundling your trips or using alternative transportation methods where possible";
    } else if (cleanCat.includes('ΔΙΑΣΚΕΔΑΣΗ') || cleanCat.includes('ΕΞΟΔΟΙ') || cleanCat.includes('ENTERTAINMENT') || cleanCat.includes('LEISURE')) {
      grConsequence = "μειώνει γρήγορα το διαθέσιμο υπόλοιπό σου για αποταμίευση";
      grAdvice = "θέσε ένα σαφές εβδομαδιαίο όριο εξόδων για τις εξόδους σου αυτόν τον μήνα";
      enConsequence = "quickly depletes your available balance for savings";
      enAdvice = "set a clear weekly spending limit for your outings this month";
    } else if (cleanCat.includes('ΠΡΟΣΩΠΙΚΗ') || cleanCat.includes('ΦΡΟΝΤΙΔΑ') || cleanCat.includes('SHOPPING') || cleanCat.includes('CLOTHES') || cleanCat.includes('PERSONAL')) {
      grConsequence = "θα στερήσει πόρους από τους μελλοντικούς σου στόχους";
      grAdvice = "κάνε μια λίστα με τα απολύτως απαραίτητα πριν τις επόμενες αγορές σου και απόφυγε τις παρορμητικές αγορές";
      enConsequence = "will drain resources from your future goals";
      enAdvice = "make a list of absolute essentials before your next purchase and avoid impulsive buying";
    } else if (cleanCat.includes('ΤΕΧΝΟΛΟΓΙΑ') || cleanCat.includes('TECH') || cleanCat.includes('GADGET')) {
      grConsequence = "δημιουργεί μια προσωρινή αλλά μεγάλη πίεση στο ταμείο σου";
      grAdvice = "απόφυγε νέες αγορές τεχνολογίας αυτόν τον μήνα και προτίμησε να αποσβέσεις την τρέχουσα αγορά";
      enConsequence = "creates temporary but high pressure on your funds";
      enAdvice = "avoid new tech purchases this month and allow your current spending to amortize";
    } else if (cleanCat.includes('ΣΥΝΔΡΟΜΕΣ') || cleanCat.includes('SUBSCRIPTION')) {
      grConsequence = "δημιουργεί αθόρυβη, μόνιμη διαρροή χρημάτων";
      grAdvice = "έλεγξε ποιες συνδρομές δεν χρησιμοποιείς συχνά και κάνε προσωρινή ακύρωση/διακοπή";
      enConsequence = "creates a quiet, permanent money leak";
      enAdvice = "review which subscriptions you don't use regularly and cancel/pause them";
    } else if (cleanCat.includes('ΓΥΜΝΑΣΤΗΡΙΟ') || cleanCat.includes('GYM') || cleanCat.includes('ΥΓΕΙΑ') || cleanCat.includes('HEALTH')) {
      grConsequence = "είναι επένδυση, αλλά επηρεάζει τη βραχυπρόθεσμη ρευστότητά σου";
      grAdvice = "αξιολόγησε αν υπάρχουν πιο οικονομικά πακέτα συνδρομών ή οικογενειακά προγράμματα";
      enConsequence = "is an investment, but impacts your short-term liquidity";
      enAdvice = "evaluate if there are cheaper subscription packages or family plans";
    }

    if (state.lang === 'el') {
      if (isIncrease) {
        const pctPart = pctStr ? ` κατά **${pctStr}**` : '';
        advisorText = `Τα έξοδα στην κατηγορία **${maxIncreaseCat}** ανέβηκαν${pctPart} (+${formatDisplayAmount(diffAmt, displayCurrency)}) αυτόν τον μήνα. Αν συνεχιστεί, ${grConsequence} — ${grAdvice}.`;
      } else if (diffAmt < 0) {
        const pctPart = pctStr ? ` κατά **${pctStr}**` : '';
        advisorText = `Τα έξοδα στην κατηγορία **${maxIncreaseCat}** μειώθηκαν${pctPart} (−${formatDisplayAmount(Math.abs(diffAmt), displayCurrency)}) σε σχέση με τον προηγούμενο μήνα. Συνέχισε έτσι!`;
      } else {
        advisorText = `Τα έξοδα στην κατηγορία **${maxIncreaseCat}** παρέμειναν σταθερά σε σχέση με τον προηγούμενο μήνα. Συνέχισε έτσι!`;
      }
    } else {
      if (isIncrease) {
        const pctPart = pctStr ? ` by **${pctStr}**` : '';
        advisorText = `Expenses in **${maxIncreaseCat}** rose${pctPart} (+${formatDisplayAmount(diffAmt, displayCurrency)}) this month. If this continues, it ${enConsequence} — ${enAdvice}.`;
      } else if (diffAmt < 0) {
        const pctPart = pctStr ? ` by **${pctStr}**` : '';
        advisorText = `Expenses in **${maxIncreaseCat}** decreased${pctPart} (−${formatDisplayAmount(Math.abs(diffAmt), displayCurrency)}) compared to last month. Keep it up!`;
      } else {
        advisorText = `Expenses in **${maxIncreaseCat}** stayed flat compared to last month. Keep it up!`;
      }
    }

    // Enable interaction (always expandable so the comparison is reachable)
    if (cardEl) {
      cardEl.classList.add('interactive');
      cardEl.onclick = () => {
        const isExpanded = cardEl.classList.toggle('expanded');
        if (chevronEl) {
          chevronEl.classList.toggle('rotated', isExpanded);
        }
      };
    }
    if (chevronEl) {
      chevronEl.style.display = 'inline-block';
    }

    // Populate Top 3 Transactions list
    const currentMonthTrans = activeTrans.filter(t => {
      if (t.type !== 'expense' || !t.date || t.category !== maxIncreaseCat) return false;
      const datePart = String(t.date || '').split('T')[0].split(' ')[0];
      const parts = datePart.split('-');
      if (parts.length !== 3) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      return y === currYear && m === currMonth;
    });

    const topTrans = currentMonthTrans
      .sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))
      .slice(0, 3);

    const topTransListEl = document.getElementById('advisor-top-transactions-list');
    const transSectionEl = document.getElementById('advisor-transactions-section');
    if (topTransListEl && transSectionEl) {
      if (topTrans.length > 0) {
        transSectionEl.style.display = 'block';
        topTransListEl.innerHTML = topTrans.map(t => {
          const dateObj = new Date(t.date);
          const formattedDate = dateObj.toLocaleDateString(state.lang === 'el' ? 'el-GR' : 'en-US', { day: '2-digit', month: '2-digit' });

          const translatedSub = getSubcategoryDisplayName(t.subcategory, t.category);
          const translatedCat = getCategoryDisplayName(t.category);
          const displayTitle = (t.note && t.note.trim()) ? t.note.trim()
            : (t.description && t.description.trim()) ? t.description.trim()
              : (translatedSub && translatedSub.trim()) ? translatedSub.trim()
                : (translatedCat || '');

          return `
            <div class="advisor-trans-row">
              <span class="advisor-trans-desc">${escapeHtml(formattedDate)} - ${escapeHtml(displayTitle)}</span>
              <span class="advisor-trans-amount">${formatDisplayAmount(CurrencyService.displayAmount(t, displayCurrency), displayCurrency)}</span>
            </div>
          `;
        }).join('');
      } else {
        transSectionEl.style.display = 'none';
        topTransListEl.innerHTML = '';
      }
    }

    // Populate Month comparison bars
    const maxVal = Math.max(prevAmt, currAmt, 1);
    const prevPct = Math.round((prevAmt / maxVal) * 100);
    const currPct = Math.round((currAmt / maxVal) * 100);

    const barsEl = document.getElementById('advisor-comparison-bars');
    if (barsEl) {
      const prevLabel = state.lang === 'el' ? 'Προηγούμενος' : 'Previous';
      const currLabel = state.lang === 'el' ? 'Τρέχων' : 'Current';

      barsEl.innerHTML = `
        <div class="advisor-bar-row previous">
          <span class="advisor-bar-label">${prevLabel}</span>
          <div class="advisor-bar-container">
            <div class="advisor-bar" style="width: ${prevPct}%;"></div>
          </div>
          <span class="advisor-bar-val">${formatDisplayAmount(prevAmt, displayCurrency)}</span>
        </div>
        <div class="advisor-bar-row current">
          <span class="advisor-bar-label">${currLabel}</span>
          <div class="advisor-bar-container">
            <div class="advisor-bar" style="width: ${currPct}%;"></div>
          </div>
          <span class="advisor-bar-val">${formatDisplayAmount(currAmt, displayCurrency)}</span>
        </div>
      `;
    }

    // Setup action button
    const actionBtn = document.getElementById('advisor-action-btn');
    if (actionBtn) {
      actionBtn.onclick = (e) => {
        e.stopPropagation();
        const catFilter = document.getElementById('search-filter-category');
        if (catFilter) {
          catFilter.value = maxIncreaseCat;
          handleSearchChange();
        }
        switchTab('trans');
      };
    }
  } else {
    advisorText = state.lang === 'el'
      ? "Δεν υπάρχουν ακόμη έξοδα αυτόν τον μήνα για σύγκριση."
      : "No expenses yet this month to compare.";

    // Disable interaction
    if (cardEl) {
      cardEl.classList.remove('interactive');
      cardEl.classList.remove('expanded');
      cardEl.onclick = null;
    }
    if (chevronEl) {
      chevronEl.style.display = 'none';
      chevronEl.classList.remove('rotated');
    }
  }

  if (advisorEl) {
    let html = advisorText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    if (hasComparison && maxIncreaseAmt > 0) {
      const discussText = state.lang === 'el' ? '💬 Συζήτησέ το' : '💬 Discuss it';
      const discussQuery = state.lang === 'el'
        ? `Γιατί αυξήθηκαν οι ${maxIncreaseCat} μου αυτόν τον μήνα;`
        : `Why did my ${maxIncreaseCat} increase this month?`;
      html += ` <button type="button" class="advisor-discuss-btn" onclick="event.stopPropagation(); openAdvisorChat('${discussQuery}');">${discussText}</button>`;
    }
    advisorEl.innerHTML = html;
  }

  // --- FORECASTING CALCULATIONS & RENDERING ---
  const forecast = calculateForecasting(activeTrans, hasHistoricalData);
  const targetYearEl = document.getElementById('forecast-target-year');
  if (targetYearEl) targetYearEl.textContent = currentYear;

  // Calculate 2025 savings
  let targetSavings = 15000; // default fallback
  const prevYear = currentYear - 1;
  let prevYearIncome = 0;
  let prevYearExpense = 0;
  activeTrans.forEach(t => {
    if (!t.date || isTransferTransaction(t)) return;
    const parts = String(t.date || '').split('T')[0].split(' ')[0].split('-');
    if (parts.length === 3 && parseInt(parts[0], 10) === prevYear) {
      const amt = CurrencyService.toBase(t);
      if (t.type === 'income') prevYearIncome += amt;
      else if (t.type === 'expense') prevYearExpense += amt;
    }
  });
  const prevYearSavings = prevYearIncome - prevYearExpense;

  // Check localstorage custom target first
  const customTarget = localStorage.getItem('overview_savings_target');
  if (customTarget && parseFloat(customTarget) > 0) {
    targetSavings = parseFloat(customTarget);
  } else if (prevYearSavings > 0) {
    targetSavings = Math.round(prevYearSavings);
  }
  // Convert the target to the display currency so the progress bar and target
  // input stay consistent with `overallNet` (which is aggregated in the display
  // currency). `targetSavings` is derived from prev-year values in the OLD base
  // currency (via CurrencyService.toBase).
  const targetSavingsDisplay = displayAmountInDisplayCurrency(targetSavings, fhsSourceCurrency);
  if (targetSavingsDisplay != null) {
    targetSavings = targetSavingsDisplay;
  }

  const normalStateEl = document.getElementById('forecast-normal-state');
  const yearendStateEl = document.getElementById('forecast-yearend-state');

  if (forecast.isYearEnd) {
    if (normalStateEl) normalStateEl.style.display = 'none';
    if (yearendStateEl) {
      yearendStateEl.style.display = 'block';
      const msgEl = document.getElementById('forecast-yearend-msg');
      if (msgEl) msgEl.textContent = forecast.message;
    }
  } else {
    if (yearendStateEl) yearendStateEl.style.display = 'none';
    if (normalStateEl) {
      normalStateEl.style.display = 'block';

      let progressPct = 0;
      if (targetSavings > 0 && overallNet > 0) {
        progressPct = Math.max(0, Math.min(100, Math.round((overallNet / targetSavings) * 100)));
      }

      const progressBarEl = document.getElementById('forecast-progress-bar');
      if (progressBarEl) progressBarEl.style.width = `${progressPct}%`;

      const progressBadgeEl = document.getElementById('forecast-progress-badge');
      if (progressBadgeEl) {
        progressBadgeEl.textContent = `${progressPct}%`;
        const clampedBadgePct = Math.max(7, Math.min(93, progressPct));
        progressBadgeEl.style.left = `${clampedBadgePct}%`;
      }

      const projectedValEl = document.getElementById('forecast-projected-val');
      if (projectedValEl) {
        projectedValEl.textContent = formatDisplayAmount(forecast.projectedSavings, fhsSourceCurrency);
      }

      // Update forecasting modal elements dynamically
      const explanationEl = document.getElementById('forecast-modal-explanation');
      if (explanationEl) {
        const roundedSavings = Math.round(forecast.currentYearSavings);
        const roundedRate = Math.round(forecast.avgMonthlySavings);
        const roundedProj = Math.round(forecast.projectedSavings);
        const elapsed = currentMonth + 1;
        if (state.lang === 'el') {
          explanationEl.innerHTML = `Έχετε αποταμιεύσει <strong>${formatDisplayAmount(roundedSavings, fhsSourceCurrency)}</strong> κατά τους πρώτους <strong>${elapsed}</strong> μήνες του έτους.<br><br>Με βάση τον τρέχοντα μέσο ρυθμό σας (<strong>${formatDisplayAmount(roundedRate, fhsSourceCurrency)} / μήνα</strong>), η προβλεπόμενη αποταμίευση για το τέλος του έτους είναι <strong>${formatDisplayAmount(roundedProj, fhsSourceCurrency)}</strong>.`;
        } else {
          explanationEl.innerHTML = `You have saved <strong>${formatDisplayAmount(roundedSavings, fhsSourceCurrency)}</strong> during the first <strong>${elapsed}</strong> months of the year.<br><br>Based on your current average rate (<strong>${formatDisplayAmount(roundedRate, fhsSourceCurrency)} / month</strong>), the projected savings for the end of the year is <strong>${formatDisplayAmount(roundedProj, fhsSourceCurrency)}</strong>.`;
        }
      }

      // Update Scenarios
      const bestValEl = document.getElementById('forecast-best-val');
      const expectedValEl = document.getElementById('forecast-expected-val');
      const worstValEl = document.getElementById('forecast-worst-val');

      if (bestValEl) bestValEl.textContent = formatDisplayAmount(forecast.bestCaseSavings, fhsSourceCurrency);
      if (expectedValEl) expectedValEl.textContent = formatDisplayAmount(forecast.projectedSavings, fhsSourceCurrency);
      if (worstValEl) worstValEl.textContent = formatDisplayAmount(forecast.worstCaseSavings, fhsSourceCurrency);

      const targetInputEl = document.getElementById('forecast-target-input');
      if (targetInputEl && !targetInputEl.matches(':focus')) {
        targetInputEl.value = Math.round(targetSavings);
      }

      const remainingTarget = targetSavings - overallNet;

      const requiredMonthlyValEl = document.getElementById('forecast-required-monthly-val');
      if (requiredMonthlyValEl) {
        const remainingMonths = 12 - (currentMonth + 1);
        const requiredMonthly = remainingTarget > 0 && remainingMonths > 0 ? (remainingTarget / remainingMonths) : 0;
        requiredMonthlyValEl.textContent = formatDisplayAmount(requiredMonthly);
      }

      // Update Goal Timeline
      const timelineValEl = document.getElementById('forecast-goal-timeline-val');
      if (timelineValEl) {
        if (remainingTarget <= 0) {
          timelineValEl.textContent = state.lang === 'el' ? 'Επιτεύχθηκε! 🎉' : 'Achieved! 🎉';
          timelineValEl.style.color = '#66bb6a';
        } else if (forecast.avgMonthlySavings <= 0) {
          timelineValEl.textContent = state.lang === 'el' ? 'Μη εφικτό (Έλλειμμα)' : 'Not feasible (Deficit)';
          timelineValEl.style.color = '#ff5b5b';
        } else {
          const monthsNeeded = remainingTarget / forecast.avgMonthlySavings;
          timelineValEl.style.color = 'var(--text-primary)';
          if (monthsNeeded <= 1) {
            timelineValEl.textContent = state.lang === 'el' ? 'Λιγότερο από 1 μήνα' : 'Less than 1 month';
          } else {
            timelineValEl.textContent = state.lang === 'el' ? `${monthsNeeded.toFixed(1)} μήνες` : `${monthsNeeded.toFixed(1)} months`;
          }
        }
      }
    }
  }

  // ============================================================
  // UNIFIED RUNWAY & SAVINGS GOAL CARD + MILESTONES LADDER
  // ============================================================
  const stsOverviewCard = document.getElementById('safe-to-spend-overview-card');
  const runwayCardTitle = document.getElementById('runway-card-title');
  const runwayCardSubtitle = document.getElementById('runway-card-subtitle');
  const runwayHealthBadge = document.getElementById('runway-health-badge');
  const runwayHealthDot = document.getElementById('runway-health-dot');
  const runwayHealthScoreVal = document.getElementById('runway-health-score-val');
  const runwayMonthsLabel = document.getElementById('runway-months-label');
  const runwayMonthsVal = document.getElementById('runway-months-val');
  const runwayMonthsUnit = document.getElementById('runway-months-unit');
  const runwayMonthsSub = document.getElementById('runway-months-sub');
  const runwayGoalLabel = document.getElementById('runway-goal-label');
  const runwaySavedVal = document.getElementById('runway-saved-val');
  const runwayTargetVal = document.getElementById('runway-target-val');
  const runwayTargetSub = document.getElementById('runway-target-sub');
  const runwayProgressBar = document.getElementById('runway-progress-bar');
  const runwayMilestoneIcon = document.getElementById('runway-milestone-icon');
  const runwayMilestoneTitle = document.getElementById('runway-milestone-title');
  const runwayMilestoneStatus = document.getElementById('runway-milestone-status');

  const isHistoricalYear = currentYearOverview < currentYear;

  if (isHistoricalYear) {
    // 1. In historical year (e.g. 2025), hide Safe-to-Spend
    if (stsOverviewCard) {
      stsOverviewCard.style.display = 'none';
    }

    if (runwayCardTitle) {
      runwayCardTitle.textContent = state.lang === 'el' ? `Απολογισμός Έτους ${currentYearOverview}` : `Year Review ${currentYearOverview}`;
    }
    if (runwayCardSubtitle) {
      runwayCardSubtitle.textContent = state.lang === 'el' ? 'Ιστορικό Αποταμίευσης' : 'Historical Savings';
    }
    if (runwayHealthBadge) {
      runwayHealthBadge.style.display = 'none';
    }

    if (runwayMonthsLabel) {
      runwayMonthsLabel.textContent = state.lang === 'el' ? 'Καθαρή Αποταμίευση' : 'Net Savings';
    }
    if (runwayMonthsVal) {
      runwayMonthsVal.textContent = formatDisplayAmount(overallNet, displayCurrency);
      runwayMonthsVal.style.color = overallNet >= 0 ? 'var(--blue-positive)' : 'var(--red-negative)';
    }
    if (runwayMonthsUnit) {
      runwayMonthsUnit.textContent = getCurrencySymbol();
      runwayMonthsUnit.style.color = overallNet >= 0 ? 'var(--blue-positive)' : 'var(--red-negative)';
    }
    if (runwayMonthsSub) {
      runwayMonthsSub.textContent = overallNet >= 0
        ? (state.lang === 'el' ? 'Θετικό κλείσιμο έτους' : 'Positive year close')
        : (state.lang === 'el' ? 'Έλλειμμα έτους' : 'Year deficit');
    }

    if (runwayGoalLabel) {
      runwayGoalLabel.textContent = state.lang === 'el' ? 'Στόχος Έτους' : 'Year Target';
    }
    if (runwaySavedVal) {
      runwaySavedVal.textContent = `${getCurrencySymbol()} ${formatDisplayAmount(overallNet, displayCurrency)}`;
    }
    if (runwayTargetVal) {
      runwayTargetVal.textContent = `/ ${getCurrencySymbol()} ${formatDisplayAmount(targetSavings, displayCurrency)}`;
    }

    const histPct = targetSavings > 0 ? Math.max(0, Math.min(100, Math.round((overallNet / targetSavings) * 100))) : (overallNet > 0 ? 100 : 0);
    if (runwayTargetSub) {
      runwayTargetSub.textContent = `${histPct}% ${state.lang === 'el' ? 'επίτευξη στόχου' : 'goal achieved'}`;
    }
    if (runwayProgressBar) {
      runwayProgressBar.style.width = `${histPct}%`;
    }

    if (runwayMilestoneIcon) {
      runwayMilestoneIcon.textContent = overallNet >= targetSavings ? '🎉' : (overallNet > 0 ? '👍' : '⚠️');
    }
    if (runwayMilestoneTitle) {
      runwayMilestoneTitle.textContent = state.lang === 'el' ? `Απολογισμός ${currentYearOverview}` : `Summary ${currentYearOverview}`;
    }
    if (runwayMilestoneStatus) {
      runwayMilestoneStatus.textContent = overallNet >= targetSavings
        ? (state.lang === 'el' ? 'Επιτεύχθηκε! ✅' : 'Achieved! ✅')
        : (overallNet > 0 ? (state.lang === 'el' ? 'Πλεόνασμα' : 'Surplus') : (state.lang === 'el' ? 'Έλλειμμα' : 'Deficit'));
    }
  } else {
    // 2. Current Year: Safe-to-Spend is visible
    if (stsOverviewCard) {
      stsOverviewCard.style.display = 'flex';
    }

    if (runwayCardTitle) {
      runwayCardTitle.textContent = state.lang === 'el' ? 'Στόχος Αποταμίευσης & Μαξιλάρι' : 'Savings Goal & Runway';
    }
    if (runwayCardSubtitle) {
      runwayCardSubtitle.textContent = state.lang === 'el' ? `Οικονομική Ασφάλεια ${currentYear}` : `Financial Security ${currentYear}`;
    }
    if (runwayHealthBadge) {
      runwayHealthBadge.style.display = 'inline-flex';
    }

    // Financial Health Score
    const scoreVal = typeof fhs.score === 'number' ? Math.round(fhs.score) : null;
    if (runwayHealthScoreVal) {
      runwayHealthScoreVal.textContent = scoreVal != null ? `${scoreVal}/100` : (fhs.displayScore || '--');
      const scoreColor = scoreVal != null ? (scoreVal >= 75 ? '#34d399' : (scoreVal >= 50 ? '#f59e0b' : '#f43f5e')) : '#34d399';
      runwayHealthScoreVal.style.color = scoreColor;
      if (runwayHealthDot) {
        runwayHealthDot.style.background = scoreColor;
        runwayHealthDot.style.boxShadow = `0 0 8px ${scoreColor}`;
      }
    }

    // Runway Months
    const rawRunway = fhs.lifestyleRunway || 0;
    const monthsNum = isFinite(rawRunway) ? Math.min(99, Math.max(0, Math.round(rawRunway * 10) / 10)) : 0;
    if (runwayMonthsLabel) {
      runwayMonthsLabel.textContent = state.lang === 'el' ? 'Μαξιλάρι Ασφαλείας' : 'Safety Runway';
    }
    if (runwayMonthsVal) {
      runwayMonthsVal.textContent = fhs.isNoData ? '--' : monthsNum.toLocaleString(state.lang === 'el' ? 'el-GR' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      runwayMonthsVal.style.color = 'var(--text-primary)';
    }
    if (runwayMonthsUnit) {
      runwayMonthsUnit.textContent = state.lang === 'el' ? 'Μήνες' : 'Months';
      runwayMonthsUnit.style.color = '#818cf8';
    }
    if (runwayMonthsSub) {
      const survMonths = isFinite(fhs.survivalRunway) ? Math.round(fhs.survivalRunway * 10) / 10 : 0;
      runwayMonthsSub.textContent = state.lang === 'el'
        ? `Βασική επιβίωση: ${survMonths.toFixed(1)} μήνες`
        : `Survival: ${survMonths.toFixed(1)} mo`;
    }

    // Savings Goal
    if (runwayGoalLabel) {
      runwayGoalLabel.textContent = state.lang === 'el' ? 'Αποταμίευση Έτους' : 'Year Savings';
    }
    if (runwaySavedVal) {
      runwaySavedVal.textContent = `${getCurrencySymbol()} ${formatDisplayAmount(overallNet, displayCurrency)}`;
    }
    if (runwayTargetVal) {
      runwayTargetVal.textContent = `/ ${getCurrencySymbol()} ${formatDisplayAmount(targetSavings, displayCurrency)}`;
    }

    let progressPct = 0;
    if (targetSavings > 0 && overallNet > 0) {
      progressPct = Math.max(0, Math.min(100, Math.round((overallNet / targetSavings) * 100)));
    }
    if (runwayTargetSub) {
      runwayTargetSub.textContent = `${progressPct}% ${state.lang === 'el' ? 'του ετήσιου στόχου' : 'of annual target'}`;
    }
    if (runwayProgressBar) {
      runwayProgressBar.style.width = `${progressPct}%`;
    }

    // Active Milestone Pill
    let mIcon = '🛡️';
    let mTitle = state.lang === 'el' ? 'Ορόσημο 1: Ταμείο Ανάγκης (3 μήνες)' : 'Milestone 1: Emergency Fund (3 mo)';
    let mStatus = state.lang === 'el' ? 'Σε εξέλιξη' : 'In progress';

    if (monthsNum >= 12) {
      mIcon = '👑';
      mTitle = state.lang === 'el' ? 'Ορόσημο 4: Πλήρης Αυτονομία' : 'Milestone 4: Full Autonomy';
      mStatus = state.lang === 'el' ? 'Εξαιρετικό (>12 μήνες)' : 'Excellent (>12 mo)';
    } else if (monthsNum >= 6) {
      mIcon = '🚀';
      mTitle = state.lang === 'el' ? 'Ορόσημο 3: 1 Έτος Ελευθερίας (12 μήνες)' : 'Milestone 3: 1 Year Runway (12 mo)';
      const pctL3 = Math.min(100, Math.round((monthsNum / 12) * 100));
      mStatus = `${pctL3}% (${monthsNum.toFixed(1)}/12 μ.)`;
    } else if (monthsNum >= 3) {
      mIcon = '🏆';
      mTitle = state.lang === 'el' ? 'Ορόσημο 2: Ισχυρό Μαξιλάρι (6 μήνες)' : 'Milestone 2: Strong Cushion (6 mo)';
      const pctL2 = Math.min(100, Math.round((monthsNum / 6) * 100));
      mStatus = `${pctL2}% (${monthsNum.toFixed(1)}/6 μ.)`;
    } else {
      mIcon = '🛡️';
      mTitle = state.lang === 'el' ? 'Ορόσημο 1: Ταμείο Ανάγκης (3 μήνες)' : 'Milestone 1: Emergency Fund (3 mo)';
      const pctL1 = Math.min(100, Math.round((monthsNum / 3) * 100));
      mStatus = `${pctL1}% (${monthsNum.toFixed(1)}/3 μ.)`;
    }

    if (runwayMilestoneIcon) runwayMilestoneIcon.textContent = mIcon;
    if (runwayMilestoneTitle) runwayMilestoneTitle.textContent = mTitle;
    if (runwayMilestoneStatus) runwayMilestoneStatus.textContent = mStatus;
  }

  // Update Milestones Ladder in Modal
  const m1Card = document.getElementById('milestone-step-1');
  const m1Badge = document.getElementById('milestone-step-1-badge');
  const m2Card = document.getElementById('milestone-step-2');
  const m2Badge = document.getElementById('milestone-step-2-badge');
  const m3Card = document.getElementById('milestone-step-3');
  const m3Badge = document.getElementById('milestone-step-3-badge');
  const m4Card = document.getElementById('milestone-step-4');
  const m4Badge = document.getElementById('milestone-step-4-badge');

  const curMonths = fhs.lifestyleRunway || 0;

  if (m1Card && m1Badge) {
    if (curMonths >= 3) {
      m1Card.className = 'milestone-step-card achieved';
      m1Badge.textContent = '100% ✓';
    } else {
      m1Card.className = 'milestone-step-card active';
      m1Badge.textContent = `${Math.min(100, Math.round((curMonths / 3) * 100))}% ⏳`;
    }
  }

  if (m2Card && m2Badge) {
    if (curMonths >= 6) {
      m2Card.className = 'milestone-step-card achieved';
      m2Badge.textContent = '100% ✓';
    } else if (curMonths >= 3) {
      m2Card.className = 'milestone-step-card active';
      m2Badge.textContent = `${Math.min(100, Math.round((curMonths / 6) * 100))}% ⏳`;
    } else {
      m2Card.className = 'milestone-step-card locked';
      m2Badge.textContent = state.lang === 'el' ? 'Κλειδωμένο 🔒' : 'Locked 🔒';
    }
  }

  if (m3Card && m3Badge) {
    if (curMonths >= 12) {
      m3Card.className = 'milestone-step-card achieved';
      m3Badge.textContent = '100% ✓';
    } else if (curMonths >= 6) {
      m3Card.className = 'milestone-step-card active';
      m3Badge.textContent = `${Math.min(100, Math.round((curMonths / 12) * 100))}% ⏳`;
    } else {
      m3Card.className = 'milestone-step-card locked';
      m3Badge.textContent = state.lang === 'el' ? 'Κλειδωμένο 🔒' : 'Locked 🔒';
    }
  }

  if (m4Card && m4Badge) {
    if (curMonths >= 24) {
      m4Card.className = 'milestone-step-card achieved';
      m4Badge.textContent = '100% ✓';
    } else if (curMonths >= 12) {
      m4Card.className = 'milestone-step-card active';
      m4Badge.textContent = state.lang === 'el' ? 'Σε εξέλιξη ⏳' : 'In progress ⏳';
    } else {
      m4Card.className = 'milestone-step-card locked';
      m4Badge.textContent = state.lang === 'el' ? 'Κλειδωμένο 🔒' : 'Locked 🔒';
    }
  }

  const icons = { cash: '💵', bank: '🏦', card: '💳' };

  // Payment method breakdown removed as requested

  // 4. Render Income section (Cash & Bank Account only)
  state.accounts.forEach(acc => {
    if (acc.type !== 'cash' && acc.type !== 'bank') return;

    // Calculate income and date range for this account
    let accIncome = 0;
    let minAccDate = null;
    let maxAccDate = null;

    activeTrans.forEach(t => {
      if (t.type === 'income' && t.account_from === acc.name) {
        if (!t.date) return;
        const y = parseInt(String(t.date).split('T')[0].split('-')[0], 10);
        if (y === currentYearOverview) {
          accIncome += CurrencyService.displayAmount(t, displayCurrency);
        }
      }
    });

    const row = document.createElement('div');
    row.className = 'account-row';
    const icon = icons[acc.type] || '💳';

    const displayHtml = `
      <div style="display: flex; flex-direction: column;">
        <span class="account-title" style="font-weight: 600;">${getAccountDisplayName(acc)}</span>
      </div>
    `;

    row.innerHTML = `
      <div class="account-name-group">
        <div class="account-icon">${icon}</div>
        ${displayHtml}
      </div>
      <div class="account-value positive">${getCurrencySymbol()} ${formatDisplayAmount(accIncome, displayCurrency)}</div>`;

    if (assetsEl) assetsEl.appendChild(row);
  });

  // 5. Render Expenses section (Cash, Cards & Bank Accounts)
  state.accounts.forEach(acc => {
    if (acc.type !== 'cash' && acc.type !== 'card' && acc.type !== 'bank') return;

    // Calculate expenses and date range for this account
    let accExpense = 0;
    let minAccDate = null;
    let maxAccDate = null;

    activeTrans.forEach(t => {
      if (t.type === 'expense' && t.account_from === acc.name) {
        if (!t.date) return;
        const y = parseInt(String(t.date).split('T')[0].split('-')[0], 10);
        if (y === currentYearOverview) {
          accExpense += CurrencyService.displayAmount(t, displayCurrency);
        }
      }
    });

    const row = document.createElement('div');
    row.className = 'account-row';
    const icon = icons[acc.type] || '💳';

    const displayHtml = `
      <div style="display: flex; flex-direction: column;">
        <span class="account-title" style="font-weight: 600;">${getAccountDisplayName(acc)}</span>
      </div>
    `;

    row.innerHTML = `
      <div class="account-name-group">
        <div class="account-icon">${icon}</div>
        ${displayHtml}
      </div>
      <div class="account-value negative">${getCurrencySymbol()} ${formatDisplayAmount(accExpense, displayCurrency)}</div>`;

    if (liabEl) liabEl.appendChild(row);
  });

  // 6. Period breakdown logic (group active transactions by year and get dates range, excluding transfers)
  const yearlyData = {};

  activeTrans.forEach(t => {
    const amt = CurrencyService.displayAmount(t, displayCurrency);
    if (!t.date) return;
    if (isTransferTransaction(t)) return;

    let year;
    if (t.date) {
      const d = new Date(t.date);
      if (!isNaN(d.getTime())) {
        year = d.getFullYear();
      } else {
        const match = String(t.date).match(/^(\d{4})/);
        if (match) year = parseInt(match[1], 10);
      }
    }
    if (!year || isNaN(year)) return;

    if (!yearlyData[year]) {
      yearlyData[year] = {
        income: 0,
        expense: 0,
        net: 0,
        minDate: t.date,
        maxDate: t.date
      };
    }

    if (t.type === 'income') {
      yearlyData[year].income += amt;
      yearlyData[year].net += amt;
    } else if (t.type === 'expense') {
      yearlyData[year].expense += amt;
      yearlyData[year].net -= amt;
    }

    if (t.date < yearlyData[year].minDate) yearlyData[year].minDate = t.date;
    if (t.date > yearlyData[year].maxDate) yearlyData[year].maxDate = t.date;
  });

  const breakdownEl = document.getElementById('accounts-periods-breakdown');
  const periodsList = document.getElementById('accounts-periods-list');
  const sortedYears = Object.keys(yearlyData).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

  if (breakdownEl && periodsList) {
    periodsList.innerHTML = '';
    let visibleYearIdx = 0;

    if (sortedYears.length > 0) {
      sortedYears.forEach(year => {
        const yearNum = parseInt(year, 10);
        if (yearNum >= currentYearOverview) return; // SKIP current & future years
        const data = yearlyData[year];
        if (data.income === 0 && data.expense === 0) return; // Skip if no transaction data

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.width = '100%';
        if (visibleYearIdx > 0) {
          container.style.borderTop = '1px solid var(--border)';
          container.style.paddingTop = '12px';
          container.style.marginTop = '12px';
        }
        visibleYearIdx++;

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.fontSize = '16px';
        row.style.cursor = 'pointer';
        row.style.padding = '4px 0';
        row.style.userSelect = 'none';
        row.style.fontFamily = "'Outfit', sans-serif";

        const label = TRANSLATIONS[state.lang]['period_label'] + ' ' + yearNum;
        const colorStyle = data.net >= 0
          ? 'color: var(--blue-positive); font-weight: 700; font-family: \'Outfit\', sans-serif;'
          : 'color: var(--red-negative); font-weight: 700; font-family: \'Outfit\', sans-serif;';
        const sign = data.net >= 0 ? '+' : '-';

        row.innerHTML = `
          <span style="color: var(--text-secondary); font-weight: 700; font-size: 16px;">${label}</span>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="${colorStyle} font-size: 16px;">${sign}${getCurrencySymbol()}${formatDisplayAmount(Math.abs(data.net), displayCurrency)}</span>
            <i class="fa-solid fa-chevron-right archive-collapse-icon" style="font-size: 14px; color: var(--text-muted); transition: transform 0.25s;"></i>
          </div>
        `;

        const incomeLabel = state.lang === 'el' ? 'Έσοδα Έτους' : 'Year Income';
        const expenseLabel = state.lang === 'el' ? 'Έξοδα Έτους' : 'Year Expenses';
        const savingsRateLabel = state.lang === 'el' ? 'Ποσοστό Αποταμίευσης' : 'Savings Rate';
        const savingsRate = data.income > 0 ? Math.round((data.net / data.income) * 100) : 0;

        const dropdown = document.createElement('div');
        dropdown.style.maxHeight = '0';
        dropdown.style.overflow = 'hidden';
        dropdown.style.transition = 'max-height 0.25s ease';

        dropdown.innerHTML = `
          <div style="padding: 10px 0 4px 0; display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; color: var(--text-secondary); opacity: 0.9; font-family: 'Outfit', sans-serif;">
            <div style="display: flex; justify-content: space-between;">
              <span>${incomeLabel}:</span>
              <span style="font-weight: 700; color: var(--blue-positive);">${getCurrencySymbol()}${formatDisplayAmount(data.income, displayCurrency)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>${expenseLabel}:</span>
              <span style="font-weight: 700; color: var(--red-negative);">${getCurrencySymbol()}${formatDisplayAmount(data.expense, displayCurrency)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>${savingsRateLabel}:</span>
              <span style="font-weight: 700; color: var(--text-primary);">${savingsRate}%</span>
            </div>
          </div>
        `;

        row.addEventListener('click', (e) => {
          e.stopPropagation();
          const chevron = row.querySelector('.archive-collapse-icon');
          const isCollapsed = !dropdown.style.maxHeight || dropdown.style.maxHeight === '0' || dropdown.style.maxHeight === '0px';
          if (isCollapsed) {
            dropdown.style.maxHeight = dropdown.scrollHeight + 'px';
            if (chevron) chevron.style.transform = 'rotate(90deg)';
          } else {
            dropdown.style.maxHeight = '0px';
            if (chevron) chevron.style.transform = 'rotate(0deg)';
          }
        });

        container.appendChild(row);
        container.appendChild(dropdown);
        periodsList.appendChild(container);
      });
    }

    if (visibleYearIdx > 0) {
      breakdownEl.style.display = 'block';
    } else {
      breakdownEl.style.display = 'none';
    }
  }

  // Update Safe-to-Spend Radar in Επισκόπηση
  if (typeof updateSafeToSpendUI === 'function') {
    updateSafeToSpendUI();
  }

  // Ensure Safe-to-Spend is hidden when browsing historical years
  const stsRadarCard = document.getElementById('safe-to-spend-overview-card');
  if (stsRadarCard) {
    stsRadarCard.style.display = currentYearOverview < currentYear ? 'none' : 'flex';
  }
}

  // UMD Exports & Window Binding
  window.renderAccountsTab = renderAccountsTab;

  return {
    renderAccountsTab: renderAccountsTab
  };
}));
