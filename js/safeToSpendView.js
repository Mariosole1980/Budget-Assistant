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

function getLiquidBalance() {
  if (!state.accounts || state.accounts.length === 0) return 0;
  const accBalance = state.accounts.reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);

  // Calculate available discretionary funds for the current calendar month
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthlyIncome = (state.transactions || []).reduce((sum, t) => {
      if (!t || t.type !== 'income') return sum;
      const d = new Date(t.date);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        return sum + (parseFloat(t.amount) || 0);
      }
      return sum;
    }, 0);

    const totalBudget = (state.budgets || []).reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);

    let qs = null;
    let baseline = 0;
    if (monthlyIncome > 0) {
      baseline = monthlyIncome;
    } else if (totalBudget > 0) {
      baseline = totalBudget;
    } else {
      const qsRaw = localStorage.getItem('ba_quick_start_profile');
      if (qsRaw) {
        qs = JSON.parse(qsRaw);
        if (qs && qs.monthly_income > 0) {
          baseline = parseFloat(qs.monthly_income) || 0;
        }
      }
    }

    if (baseline > 0) {
      const spentThisMonth = (state.transactions || []).reduce((sum, t) => {
        if (!t || t.type !== 'expense') return sum;
        const d = new Date(t.date);
        if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
          return sum + (parseFloat(t.amount) || 0);
        }
        return sum;
      }, 0);

      // Support baseline income fallback (qs.monthly_income - spentThisMonth)
      const remainingFromBaseline = Math.max(0, (qs ? qs.monthly_income - spentThisMonth : baseline - spentThisMonth));
      if (accBalance > 0) {
        return Math.min(accBalance, remainingFromBaseline);
      }
      return remainingFromBaseline;
    }
  } catch (e) { }

  return accBalance;
}

function getUnpaidRecurringBillsThisMonth() {
  if (!state.recurringTemplates || state.recurringTemplates.length === 0) return 0;

  if (typeof SubscriptionEngine !== 'undefined') {
    try {
      const analysis = SubscriptionEngine.analyzeMonthlySubscriptions({
        templates: state.recurringTemplates,
        transactions: state.transactions || [],
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

  let unpaidTotal = 0;
  state.recurringTemplates.forEach(tpl => {
    if (tpl.type !== 'expense') return;
    const dueDay = parseInt(tpl.due_day || tpl.day_of_month || 1, 10);
    if (dueDay >= currentDay && dueDay <= lastDayOfMonth) {
      unpaidTotal += sanitizeFloat(parseFloat(tpl.amount) || 0);
    }
  });
  return unpaidTotal;
}

function getMonthlySavingsGoal() {
  if (state.budgets && state.budgets.length > 0) {
    const savingsBudget = state.budgets.find(b => {
      const name = (b.name || b.category || '').toLowerCase();
      return name.includes('αποταμ') || name.includes('saving');
    });
    if (savingsBudget) return sanitizeFloat(parseFloat(savingsBudget.amount) || 0);
  }
  try {
    const qsRaw = localStorage.getItem('ba_quick_start_profile');
    if (qsRaw) {
      const qs = JSON.parse(qsRaw);
      if (qs && qs.target_savings > 0) return sanitizeFloat(parseFloat(qs.target_savings) || 0);
    }
  } catch (e) { }
  return 0;
}

function updateSafeToSpendUI() {
  if (typeof SafeToSpendEngine === 'undefined') return;

  const balance = getLiquidBalance();
  const unpaidBills = getUnpaidRecurringBillsThisMonth();
  const savingsGoal = getMonthlySavingsGoal();

  const stsResult = SafeToSpendEngine.calculateDailySafeToSpend({
    currentBalance: balance,
    unpaidRecurringBills: unpaidBills,
    savingsGoal: savingsGoal
  });

  state._lastSafeToSpendResult = stsResult;

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
  const modalDaily = document.getElementById('modal-sts-daily-val');
  const modalWeekly = document.getElementById('modal-sts-weekly-val');
  const modalBal = document.getElementById('modal-sts-balance');
  const modalBills = document.getElementById('modal-sts-bills');
  const modalSav = document.getElementById('modal-sts-savings');
  const modalPool = document.getElementById('modal-sts-pool');
  const modalDays = document.getElementById('modal-sts-days');

  if (modalDaily) modalDaily.textContent = `${currSym} ${formatDisplayAmount(sts.safeDaily)}`;
  if (modalWeekly) modalWeekly.textContent = `ή ${currSym} ${formatDisplayAmount(sts.safeWeekly)} για αυτή την εβδομάδα`;
  if (modalBal) modalBal.textContent = `${currSym} ${formatDisplayAmount(sts.currentBalance)}`;
  if (modalBills) modalBills.textContent = `- ${currSym} ${formatDisplayAmount(getUnpaidRecurringBillsThisMonth())}`;
  if (modalSav) modalSav.textContent = `- ${currSym} ${formatDisplayAmount(getMonthlySavingsGoal())}`;
  if (modalPool) modalPool.textContent = `${currSym} ${formatDisplayAmount(sts.discretionaryPool)}`;
  if (modalDays) modalDays.textContent = `${sts.daysRemaining} ημέρες`;

  // Clear previous simulation result
  const resBox = document.getElementById('sts-sim-result-box');
  if (resBox) {
    resBox.style.display = 'none';
    resBox.innerHTML = '';
  }

  openModal('safe-to-spend-modal');
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
  const currState = state._lastSafeToSpendResult || SafeToSpendEngine.calculateDailySafeToSpend({
    currentBalance: getLiquidBalance(),
    unpaidRecurringBills: getUnpaidRecurringBillsThisMonth(),
    savingsGoal: getMonthlySavingsGoal()
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

  const todayStr = (typeof formatISODateLocal === 'function') ? formatISODateLocal(new Date()) : new Date().toISOString().slice(0, 10);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const tx = {
    id: generateUUID(),
    date: todayStr,
    time: timeStr,
    type: 'expense',
    category: tpl.category || 'Bills',
    amount: sanitizeFloat(parseFloat(tpl.amount) || 0),
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
  window.getUnpaidRecurringBillsThisMonth = getUnpaidRecurringBillsThisMonth;
  window.getMonthlySavingsGoal = getMonthlySavingsGoal;
  window.updateSafeToSpendUI = updateSafeToSpendUI;
  window.openSafeToSpendModal = openSafeToSpendModal;
  window.runWhatIfSimulation = runWhatIfSimulation;
  window.openAiAdvisorFromBar = openAiAdvisorFromBar;
  window.openSubscriptionsHubModal = openSubscriptionsHubModal;
  window.renderSubscriptionsHub = renderSubscriptionsHub;
  window.acceptDetectedSubscription = acceptDetectedSubscription;
  window.quickPaySubscription = quickPaySubscription;

  return {
    getLiquidBalance: getLiquidBalance,
    getUnpaidRecurringBillsThisMonth: getUnpaidRecurringBillsThisMonth,
    getMonthlySavingsGoal: getMonthlySavingsGoal,
    updateSafeToSpendUI: updateSafeToSpendUI,
    openSafeToSpendModal: openSafeToSpendModal,
    runWhatIfSimulation: runWhatIfSimulation,
    openAiAdvisorFromBar: openAiAdvisorFromBar,
    openSubscriptionsHubModal: openSubscriptionsHubModal,
    renderSubscriptionsHub: renderSubscriptionsHub,
    acceptDetectedSubscription: acceptDetectedSubscription,
    quickPaySubscription: quickPaySubscription
  };
}));
