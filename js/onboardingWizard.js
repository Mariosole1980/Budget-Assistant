/**
 * js/onboardingWizard.js
 *
 * Quick-Start 60-Second Onboarding Wizard & Sample Data Generator.
 * Extracted from app.js (Phase 10 Architectural Domain Extraction).
 *
 * Manages the 60-second baseline profile wizard (income, fixed bills,
 * savings targets), sample/demo transactions & budgets generator,
 * and demo mode lifecycle (header badges, confirmation dialogs, cleanup).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser: attach to root (window)
    var exports = factory();
    Object.assign(root, exports);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

let _qsDraft = {
  monthly_income: 1200,
  is_household: false,
  rent: 450,
  utilities: 150,
  transport: 80,
  subscriptions: 30,
  target_savings: 100
};

function getQuickStartProfile() {
  try {
    const raw = localStorage.getItem('ba_quick_start_profile');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function openQuickStartModal(step = 0) {
  const existing = getQuickStartProfile();
  if (existing) {
    if (typeof existing.monthly_income === 'number') _qsDraft.monthly_income = existing.monthly_income;
    if (typeof existing.is_household === 'boolean') _qsDraft.is_household = existing.is_household;
    if (existing.fixed_bills) {
      if (typeof existing.fixed_bills.rent === 'number') _qsDraft.rent = existing.fixed_bills.rent;
      if (typeof existing.fixed_bills.utilities === 'number') _qsDraft.utilities = existing.fixed_bills.utilities;
      if (typeof existing.fixed_bills.transport === 'number') _qsDraft.transport = existing.fixed_bills.transport;
      if (typeof existing.fixed_bills.subscriptions === 'number') _qsDraft.subscriptions = existing.fixed_bills.subscriptions;
    }
    if (typeof existing.target_savings === 'number') _qsDraft.target_savings = existing.target_savings;
  }
  renderQuickStartStep(step);
  openModal('quick-start-modal');
}

function closeQuickStartModal(markSkipped = false) {
  if (markSkipped) {
    localStorage.setItem('ba_ftux_status', 'skipped');
  }
  closeModal('quick-start-modal');
}

function setQsIncomeChip(amount) {
  _qsDraft.monthly_income = Number(amount) || 0;
  const input = document.getElementById('qs-income-input');
  if (input) input.value = _qsDraft.monthly_income;
  renderQuickStartStep(1);
}

function onQsIncomeInputChange(val) {
  _qsDraft.monthly_income = Math.max(0, parseFloat(val) || 0);
}

function nextQsStepFromIncome() {
  const input = document.getElementById('qs-income-input');
  if (input) {
    _qsDraft.monthly_income = Math.max(0, parseFloat(input.value) || 0);
  }
  const toggle = document.getElementById('qs-household-toggle');
  if (toggle) {
    _qsDraft.is_household = !!toggle.checked;
  }
  if (_qsDraft.monthly_income <= 0) {
    if (typeof showSyncToast === 'function') {
      showSyncToast(state.lang === 'el' ? 'Παρακαλώ συμπληρώστε ένα ποσό εισοδήματος' : 'Please enter an income amount', 3000);
    }
    return;
  }
  openQuickStartModal(2);
}

function updateQsFixedTotal() {
  const rentInput = document.getElementById('qs-rent');
  const utilInput = document.getElementById('qs-utilities');
  const transInput = document.getElementById('qs-transport');
  const subsInput = document.getElementById('qs-subs');
  const savInput = document.getElementById('qs-savings');

  const rent = rentInput ? (parseFloat(rentInput.value) || 0) : _qsDraft.rent;
  const util = utilInput ? (parseFloat(utilInput.value) || 0) : _qsDraft.utilities;
  const trans = transInput ? (parseFloat(transInput.value) || 0) : _qsDraft.transport;
  const subs = subsInput ? (parseFloat(subsInput.value) || 0) : _qsDraft.subscriptions;
  const sav = savInput ? (parseFloat(savInput.value) || 0) : _qsDraft.target_savings;

  const total = rent + util + trans + subs + sav;
  const totalEl = document.getElementById('qs-fixed-total-val');
  if (totalEl) {
    totalEl.textContent = formatDisplayAmount(total) + ' €';
  }
}

function nextQsStepFromFixed() {
  const rentInput = document.getElementById('qs-rent');
  const utilInput = document.getElementById('qs-utilities');
  const transInput = document.getElementById('qs-transport');
  const subsInput = document.getElementById('qs-subs');
  const savInput = document.getElementById('qs-savings');

  if (rentInput) _qsDraft.rent = Math.max(0, parseFloat(rentInput.value) || 0);
  if (utilInput) _qsDraft.utilities = Math.max(0, parseFloat(utilInput.value) || 0);
  if (transInput) _qsDraft.transport = Math.max(0, parseFloat(transInput.value) || 0);
  if (subsInput) _qsDraft.subscriptions = Math.max(0, parseFloat(subsInput.value) || 0);
  if (savInput) _qsDraft.target_savings = Math.max(0, parseFloat(savInput.value) || 0);

  openQuickStartModal(3);
}

function renderQuickStartStep(step) {
  const body = document.getElementById('quick-start-body');
  if (!body) return;

  if (step === 0) {
    // Screen 0: Welcome Gate
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; padding: 6px 4px;">
        <div style="width: 58px; height: 58px; border-radius: 18px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); display: flex; align-items: center; justify-content: center; font-size: 24px; color: var(--accent); margin-top: 4px;">
          <i class="fa-solid fa-calculator"></i>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <h3 style="font-family: 'Outfit', sans-serif; font-size: 20px; font-weight: 800; color: #fff; margin: 0; line-height: 1.3;">Ξέρεις πόσα σου μένουν για ξόδεμα;</h3>
          <p style="font-size: 13.5px; color: var(--text-secondary); margin: 0; line-height: 1.5;">Βάλε τα έσοδα και τα πάγια έξοδά σου. Σε ένα λεπτό θα έχεις ένα καθαρό ημερήσιο όριο για να μην ξεμένεις ποτέ.</p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 10px;">
          <button type="button" onclick="openQuickStartModal(1)" style="width: 100%; padding: 14px 20px; border-radius: 14px; background: linear-gradient(135deg, var(--accent, #6366f1) 0%, #4f46e5 100%); border: none; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);">
            Υπολογισμός σε 1′
          </button>
          <button type="button" onclick="closeQuickStartModal(); onboardingAddDemoData();" style="width: 100%; padding: 13px 20px; border-radius: 14px; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.12); color: var(--text-primary); font-size: 14px; font-weight: 600; cursor: pointer;">
            Δες πώς λειτουργεί (Demo)
          </button>
          <button type="button" onclick="closeQuickStartModal(true)" style="background: transparent; border: none; color: var(--text-muted); font-size: 13px; cursor: pointer; padding: 6px; text-decoration: underline;">
            Όχι τώρα
          </button>
        </div>
      </div>
    `;
    return;
  }

  if (step === 1) {
    // Step 1: Inflow
    const chips = [900, 1200, 1800, 2500];
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 18px; padding: 4px 2px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 12px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;">1 από 3</span>
          <span onclick="closeQuickStartModal(true)" style="cursor: pointer; font-size: 20px; color: var(--text-muted); line-height: 1;">&times;</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 4px;">
          <h3 style="font-family: 'Outfit', sans-serif; font-size: 20px; font-weight: 800; color: #fff; margin: 0;">Πόσα χρήματα μπαίνουν κάθε μήνα;</h3>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">Ο καθαρός μισθός σου ή το κοινό εισόδημα του σπιτιού.</p>
        </div>

        <div style="display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 18px; padding: 16px 20px; gap: 8px;">
          <input id="qs-income-input" type="number" step="10" min="0" value="${_qsDraft.monthly_income || 1200}" placeholder="1200" style="font-family: 'Outfit', sans-serif; font-size: 32px; font-weight: 800; color: #fff; background: transparent; border: none; outline: none; width: 160px; text-align: right;" oninput="onQsIncomeInputChange(this.value)">
          <span style="font-family: 'Outfit', sans-serif; font-size: 26px; font-weight: 700; color: var(--accent);">€</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
          ${chips.map(amt => `
            <button type="button" onclick="setQsIncomeChip(${amt})" style="padding: 9px 4px; border-radius: 10px; background: ${_qsDraft.monthly_income === amt ? 'var(--accent, #6366f1)' : 'rgba(255, 255, 255, 0.06)'}; border: 1px solid ${_qsDraft.monthly_income === amt ? 'var(--accent, #6366f1)' : 'rgba(255, 255, 255, 0.1)'}; color: ${_qsDraft.monthly_income === amt ? '#fff' : 'var(--text-primary)'}; font-size: 13px; font-weight: 700; cursor: pointer;">
              ${amt} €
            </button>
          `).join('')}
        </div>

        <label style="display: flex; align-items: center; gap: 12px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 12px 14px; cursor: pointer;">
          <input type="checkbox" id="qs-household-toggle" ${_qsDraft.is_household ? 'checked' : ''} onchange="_qsDraft.is_household = this.checked" style="width: 18px; height: 18px; accent-color: var(--accent); cursor: pointer;">
          <span style="font-size: 13.5px; font-weight: 600; color: var(--text-primary);">Κοινό ταμείο με σύντροφο</span>
        </label>

        <button type="button" onclick="nextQsStepFromIncome()" style="width: 100%; padding: 14px 20px; border-radius: 14px; background: linear-gradient(135deg, var(--accent, #6366f1) 0%, #4f46e5 100%); border: none; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);">
          Συνέχεια
        </button>
      </div>
    `;
    return;
  }

  if (step === 2) {
    // Step 2: Fixed expenses & savings
    const fixedTotal = _qsDraft.rent + _qsDraft.utilities + _qsDraft.transport + _qsDraft.subscriptions + _qsDraft.target_savings;
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 15px; padding: 4px 2px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 12px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;">2 από 3</span>
          <span onclick="closeQuickStartModal(true)" style="cursor: pointer; font-size: 20px; color: var(--text-muted); line-height: 1;">&times;</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 4px;">
          <h3 style="font-family: 'Outfit', sans-serif; font-size: 20px; font-weight: 800; color: #fff; margin: 0;">Ποια είναι τα σταθερά σου έξοδα;</h3>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">Όσα πληρώνεις στάνταρ κάθε μήνα.</p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 9px;">
          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 10px 14px;">
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--text-primary); font-weight: 600;">
              <span>🏠</span> <span>Ενοίκιο ή δόση</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <input id="qs-rent" type="number" step="10" min="0" value="${_qsDraft.rent}" oninput="updateQsFixedTotal()" style="width: 80px; text-align: right; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); color: #fff; border-radius: 8px; padding: 6px 8px; font-size: 14px; font-weight: 700; outline: none;">
              <span style="color: var(--text-muted); font-size: 13px;">€</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 10px 14px;">
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--text-primary); font-weight: 600;">
              <span>⚡</span> <span>Ρεύμα &amp; λογαριασμοί</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <input id="qs-utilities" type="number" step="5" min="0" value="${_qsDraft.utilities}" oninput="updateQsFixedTotal()" style="width: 80px; text-align: right; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); color: #fff; border-radius: 8px; padding: 6px 8px; font-size: 14px; font-weight: 700; outline: none;">
              <span style="color: var(--text-muted); font-size: 13px;">€</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 10px 14px;">
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--text-primary); font-weight: 600;">
              <span>🚗</span> <span>Μετακίνηση</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <input id="qs-transport" type="number" step="5" min="0" value="${_qsDraft.transport}" oninput="updateQsFixedTotal()" style="width: 80px; text-align: right; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); color: #fff; border-radius: 8px; padding: 6px 8px; font-size: 14px; font-weight: 700; outline: none;">
              <span style="color: var(--text-muted); font-size: 13px;">€</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 10px 14px;">
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--text-primary); font-weight: 600;">
              <span>📱</span> <span>Συνδρομές (Netflix κ.ά.)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <input id="qs-subs" type="number" step="5" min="0" value="${_qsDraft.subscriptions}" oninput="updateQsFixedTotal()" style="width: 80px; text-align: right; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); color: #fff; border-radius: 8px; padding: 6px 8px; font-size: 14px; font-weight: 700; outline: none;">
              <span style="color: var(--text-muted); font-size: 13px;">€</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(52, 211, 153, 0.06); border: 1px solid rgba(52, 211, 153, 0.2); border-radius: 12px; padding: 10px 14px;">
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: #a7f3d0; font-weight: 600;">
              <span>🎯</span> <span>Στόχος αποταμίευσης</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <input id="qs-savings" type="number" step="10" min="0" value="${_qsDraft.target_savings}" oninput="updateQsFixedTotal()" style="width: 80px; text-align: right; background: rgba(0,0,0,0.3); border: 1px solid rgba(52, 211, 153, 0.3); color: #34d399; border-radius: 8px; padding: 6px 8px; font-size: 14px; font-weight: 700; outline: none;">
              <span style="color: #34d399; font-size: 13px;">€</span>
            </div>
          </div>
        </div>

        <div style="padding: 10px 14px; border-radius: 12px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; font-size: 13px;">
          <span style="color: var(--text-secondary);">Σύνολο δεσμευμένων:</span>
          <span id="qs-fixed-total-val" style="font-family: 'Outfit', sans-serif; font-weight: 800; color: #fff; font-size: 15px;">${formatDisplayAmount(fixedTotal)} €</span>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 2px;">
          <button type="button" onclick="openQuickStartModal(1)" style="flex: 1; padding: 13px; border-radius: 12px; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.12); color: var(--text-primary); font-size: 14px; font-weight: 600; cursor: pointer;">
            Πίσω
          </button>
          <button type="button" onclick="nextQsStepFromFixed()" style="flex: 2; padding: 13px; border-radius: 12px; background: linear-gradient(135deg, var(--accent, #6366f1) 0%, #4f46e5 100%); border: none; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);">
            Συνέχεια
          </button>
        </div>
      </div>
    `;
    return;
  }

  if (step === 3) {
    // Step 3: Result
    const now = new Date();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(1, totalDays - now.getDate() + 1);
    const income = _qsDraft.monthly_income;
    const fixedSum = _qsDraft.rent + _qsDraft.utilities + _qsDraft.transport + _qsDraft.subscriptions;
    const savings = _qsDraft.target_savings;
    const committed = fixedSum + savings;
    const pool = Math.max(0, income - committed);
    const dailySafe = Math.round((pool / daysRemaining) * 100) / 100;
    const weeklySafe = Math.round((dailySafe * Math.min(7, daysRemaining)) * 100) / 100;

    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px; text-align: center; padding: 4px 2px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 12px; font-weight: 700; color: #34d399; text-transform: uppercase; letter-spacing: 0.5px;">3 από 3</span>
          <span onclick="closeQuickStartModal(true)" style="cursor: pointer; font-size: 20px; color: var(--text-muted); line-height: 1;">&times;</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 4px;">
          <h3 style="font-family: 'Outfit', sans-serif; font-size: 20px; font-weight: 800; color: #fff; margin: 0;">Αυτό είναι το ημερήσιο όριό σου</h3>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 0; line-height: 1.4;">Αν μένεις σε αυτό το ποσό, καλύπτεις όλα τα πάγια του μήνα και σου μένουν και στην άκρη.</p>
        </div>

        <div style="padding: 18px 16px; border-radius: 20px; background: linear-gradient(145deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.7) 100%); border: 1px solid rgba(16, 185, 129, 0.3); display: flex; flex-direction: column; align-items: center; gap: 6px;">
          <div style="font-family: 'Outfit', sans-serif; font-size: 36px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
            ${formatDisplayAmount(dailySafe)} € <span style="font-size: 16px; font-weight: 600; color: #a7f3d0;">/ μέρα</span>
          </div>
          <div style="font-size: 13px; font-weight: 600; color: #34d399;">
            ή ${formatDisplayAmount(weeklySafe)} € αυτή την εβδομάδα
          </div>
        </div>

        <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; font-size: 13px; text-align: left;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Μηνιαίο εισόδημα:</span>
            <span style="font-weight: 700; color: #34d399;">+${formatDisplayAmount(income)} €</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Σταθερά πάγια:</span>
            <span style="font-weight: 700; color: #f87171;">-${formatDisplayAmount(fixedSum)} €</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Στόχος αποταμίευσης:</span>
            <span style="font-weight: 700; color: #fbbf24;">-${formatDisplayAmount(savings)} €</span>
          </div>
          <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 2px 0;"></div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #fff; font-weight: 600;">Ελεύθερο για τον μήνα:</span>
            <span style="font-weight: 800; color: #fff;">${formatDisplayAmount(pool)} €</span>
          </div>
        </div>

        <button type="button" onclick="applyQuickStartProfile()" style="width: 100%; padding: 15px 20px; border-radius: 14px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; color: #fff; font-size: 15px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);">
          Πάμε στην εφαρμογή
        </button>
      </div>
    `;
    return;
  }
}

function applyQuickStartProfile() {
  const profile = {
    monthly_income: _qsDraft.monthly_income,
    is_household: _qsDraft.is_household,
    fixed_bills: {
      rent: _qsDraft.rent,
      utilities: _qsDraft.utilities,
      transport: _qsDraft.transport,
      subscriptions: _qsDraft.subscriptions
    },
    target_savings: _qsDraft.target_savings,
    updated_at: new Date().toISOString()
  };

  localStorage.setItem('ba_quick_start_profile', JSON.stringify(profile));
  localStorage.setItem('ba_ftux_status', 'completed_wizard');

  // Register Recurring Templates for fixed bills
  if (!state.recurringTemplates) state.recurringTemplates = [];
  state.recurringTemplates = state.recurringTemplates.filter(t => !(t && t.is_quick_start));

  const uid = state.currentUser ? state.currentUser.id : 'guest';
  const nowStr = new Date().toISOString().slice(0, 10);

  if (_qsDraft.rent > 0) {
    state.recurringTemplates.push({
      id: 'qs_tpl_rent_' + Date.now(),
      name: 'Ενοίκιο',
      title: 'Ενοίκιο',
      category: '🏠 Σπίτι',
      subcategory: 'Ενοίκιο',
      amount: _qsDraft.rent,
      type: 'expense',
      preset: 'monthly',
      due_day: 1,
      day_of_month: 1,
      startDate: nowStr,
      endType: 'perpetual',
      user_id: uid,
      is_quick_start: true,
      created_at: new Date().toISOString()
    });
  }

  if (_qsDraft.utilities > 0) {
    state.recurringTemplates.push({
      id: 'qs_tpl_util_' + Date.now(),
      name: 'Ρεύμα & λογαριασμοί',
      title: 'Ρεύμα & λογαριασμοί',
      category: '🏠 Σπίτι',
      subcategory: 'Ρεύμα',
      amount: _qsDraft.utilities,
      type: 'expense',
      preset: 'monthly',
      due_day: 5,
      day_of_month: 5,
      startDate: nowStr,
      endType: 'perpetual',
      user_id: uid,
      is_quick_start: true,
      created_at: new Date().toISOString()
    });
  }

  if (_qsDraft.transport > 0) {
    state.recurringTemplates.push({
      id: 'qs_tpl_trans_' + Date.now(),
      name: 'Μετακίνηση',
      title: 'Μετακίνηση',
      category: '🚗 Μεταφορές',
      subcategory: 'Καύσιμα',
      amount: _qsDraft.transport,
      type: 'expense',
      preset: 'monthly',
      due_day: 1,
      day_of_month: 1,
      startDate: nowStr,
      endType: 'perpetual',
      user_id: uid,
      is_quick_start: true,
      created_at: new Date().toISOString()
    });
  }

  if (_qsDraft.subscriptions > 0) {
    state.recurringTemplates.push({
      id: 'qs_tpl_subs_' + Date.now(),
      name: 'Συνδρομές',
      title: 'Συνδρομές',
      category: '📱 Συνδρομές',
      subcategory: 'Streaming',
      amount: _qsDraft.subscriptions,
      type: 'expense',
      preset: 'monthly',
      due_day: 1,
      day_of_month: 1,
      startDate: nowStr,
      endType: 'perpetual',
      user_id: uid,
      is_quick_start: true,
      created_at: new Date().toISOString()
    });
  }

  localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));

  // If Savings Goal set, ensure a savings budget exists
  if (!state.budgets) state.budgets = [];
  state.budgets = state.budgets.filter(b => !(b && b.is_quick_start));
  if (_qsDraft.target_savings > 0) {
    state.budgets.push({
      id: 'qs_budget_savings_' + Date.now(),
      user_id: uid,
      category: '🎯 Αποταμίευση',
      amount: _qsDraft.target_savings,
      is_quick_start: true,
      created_at: new Date().toISOString()
    });
    localStorage.setItem('cached_budgets', JSON.stringify(state.budgets));
  }

  closeModal('quick-start-modal');
  updateSafeToSpendUI();
  updateUI();

  if (typeof showSyncToast === 'function') {
    showSyncToast(state.lang === 'el' ? '✓ Το ημερήσιο όριο ρυθμίστηκε με επιτυχία' : '✓ Daily spending limit configured', 3500);
  }
}

// Window bindings
window.getQuickStartProfile = getQuickStartProfile;
window.openQuickStartModal = openQuickStartModal;
window.closeQuickStartModal = closeQuickStartModal;
window.setQsIncomeChip = setQsIncomeChip;
window.onQsIncomeInputChange = onQsIncomeInputChange;
window.nextQsStepFromIncome = nextQsStepFromIncome;
window.updateQsFixedTotal = updateQsFixedTotal;
window.nextQsStepFromFixed = nextQsStepFromFixed;
window.renderQuickStartStep = renderQuickStartStep;
window.applyQuickStartProfile = applyQuickStartProfile;

// ============================================================
// ONBOARDING & SAMPLE DATA GENERATOR (15 TX + 5 BUDGETS)
// ============================================================
function hasDemoData() {
  const hasDemoTx = Array.isArray(state.transactions) && state.transactions.some(t => t && (t.is_demo || (t.id && String(t.id).startsWith('demo_'))));
  const hasDemoBudget = Array.isArray(state.budgets) && state.budgets.some(b => b && (b.is_demo || (b.id && String(b.id).startsWith('demo_'))));
  return hasDemoTx || hasDemoBudget;
}

function updateHeaderDemoBadge() {
  const badge = document.getElementById('header-demo-badge');
  const hasDemo = hasDemoData();
  if (badge) {
    badge.style.display = hasDemo ? 'inline-flex' : 'none';
  }
  const clearRow = document.getElementById('sync-demo-clear-row');
  if (clearRow) {
    clearRow.style.display = hasDemo ? 'flex' : 'none';
  }
}

async function handleHeaderDemoClick() {
  const lang = state.lang || 'el';
  const confirmMsg = (TRANSLATIONS[lang] && TRANSLATIONS[lang]['demo_exit_confirm']) ||
    (lang === 'el'
      ? 'Βρίσκεστε σε λειτουργία Demo.\n\nΘέλετε να βγείτε από το Demo και να επιστρέψετε στα πραγματικά σας δεδομένα;'
      : 'You are currently in Demo Mode.\n\nDo you want to exit Demo Mode and return to your real account?');

  const btnText = (TRANSLATIONS[lang] && TRANSLATIONS[lang]['demo_exit_btn']) || (lang === 'el' ? 'Έξοδος από Demo' : 'Exit Demo');

  const confirmed = await showConfirm(
    confirmMsg,
    btnText,
    '⚡'
  );
  if (confirmed) {
    await onboardingClearDemoData(true);
  }
}

async function onboardingAddDemoData() {
  closeModal('onboarding-modal');

  const getDemoDateISO = (day) => {
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth() + 1).padStart(2, '0');
    const d = String(Math.min(Math.max(1, day), 28)).padStart(2, '0');
    return `${y}-${m}-${d}T12:00:00Z`;
  };

  const uid = state.currentUser ? state.currentUser.id : 'guest';

  // 15 Realistic Transactions across current month
  const demoTxs = [
    { amount: 1850, type: 'income', category: '💼 Μισθοδοσία', subcategory: '', date: getDemoDateISO(1), note: 'Μηνιαίος μισθός', description: 'Τακτική μισθοδοσία', account_from: 'Bank Account', account_to: '' },
    { amount: 320, type: 'income', category: '💻 Freelance', subcategory: '', date: getDemoDateISO(12), note: 'Πρόσθετο project', description: 'Έξτρα εργασία & συμβουλευτική', account_from: 'Bank Account', account_to: '' },
    { amount: 450, type: 'expense', category: '🏠 Σπίτι', subcategory: 'Ενοίκιο', date: getDemoDateISO(2), note: 'Μηνιαίο ενοίκιο', description: 'Ενοίκιο κατοικίας', account_from: 'Bank Account', account_to: '' },
    { amount: 115, type: 'expense', category: '🏠 Σπίτι', subcategory: 'Ρεύμα', date: getDemoDateISO(4), note: 'Εκκαθαριστικός ΔΕΗ', description: 'Λογαριασμός ηλεκτρικού ρεύματος', account_from: 'Card', account_to: '' },
    { amount: 84.50, type: 'expense', category: '🍔 Τρόφιμα', subcategory: 'Σουπερμάρκετ', date: getDemoDateISO(5), note: 'Εβδομαδιαία ψώνια', description: 'Σουπερμάρκετ προμήθειες', account_from: 'Card', account_to: '' },
    { amount: 42.30, type: 'expense', category: '🍔 Τρόφιμα', subcategory: 'Μανάβικο', date: getDemoDateISO(10), note: 'Μανάβικο & κρεοπωλείο', description: 'Φρέσκα φρούτα και κρέας', account_from: 'Card', account_to: '' },
    { amount: 18.50, type: 'expense', category: '🍔 Τρόφιμα', subcategory: 'Delivery', date: getDemoDateISO(14), note: 'Delivery πίτσες', description: 'Παραγγελία έτοιμου φαγητού', account_from: 'Card', account_to: '' },
    { amount: 60, type: 'expense', category: '🚗 Μεταφορές', subcategory: 'Καύσιμα', date: getDemoDateISO(7), note: 'Βενζίνη', description: 'Γέμισμα ρεζερβουάρ', account_from: 'Card', account_to: '' },
    { amount: 14, type: 'expense', category: '📦 Διάφορα', subcategory: 'Καφέδες', date: getDemoDateISO(8), note: 'Καφέδες εβδομάδας', description: 'Καθημερινοί καφέδες & σνακ', account_from: 'Cash', account_to: '' },
    { amount: 28, type: 'expense', category: '🎉 Διασκέδαση', subcategory: 'Σινεμά', date: getDemoDateISO(11), note: 'Εισιτήρια σινεμά', description: 'Έξοδος σινεμά & ποπ κορν', account_from: 'Card', account_to: '' },
    { amount: 17.98, type: 'expense', category: '📱 Συνδρομές', subcategory: 'Streaming', date: getDemoDateISO(9), note: 'Netflix & Spotify', description: 'Μηνιαίες ψηφιακές συνδρομές', account_from: 'Card', account_to: '' },
    { amount: 24.50, type: 'expense', category: '💊 Υγεία', subcategory: 'Φαρμακείο', date: getDemoDateISO(13), note: 'Φάρμακα & βιταμίνες', description: 'Εποχιακά φάρμακα', account_from: 'Cash', account_to: '' },
    { amount: 55, type: 'expense', category: '👕 Αγορές', subcategory: 'Ρούχα', date: getDemoDateISO(16), note: 'Αθλητικά ρούχα', description: 'Αγορά αθλητικού εξοπλισμού', account_from: 'Card', account_to: '' },
    { amount: 35, type: 'expense', category: '🏋️ Γυμναστήριο', subcategory: 'Συνδρομή', date: getDemoDateISO(3), note: 'Μηνιαία συνδρομή', description: 'Συνδρομή γυμναστηρίου', account_from: 'Card', account_to: '' },
    { amount: 200, type: 'transfer', category: 'Μεταφορά', subcategory: '', date: getDemoDateISO(18), note: 'Μεταφορά στην Αποταμίευση', description: 'Μηνιαία αποταμίευση', account_from: 'Bank Account', account_to: 'Card' }
  ];

  // 5 Realistic Category Budgets
  const demoBudgets = [
    { category: '🍔 Τρόφιμα', amount: 350 },
    { category: '🏠 Σπίτι', amount: 600 },
    { category: '🚗 Μεταφορές', amount: 150 },
    { category: '🎉 Διασκέδαση', amount: 100 },
    { category: '💊 Υγεία', amount: 80 }
  ];

  try {
    // 1. Save demo transactions
    for (let i = 0; i < demoTxs.length; i++) {
      const item = demoTxs[i];
      const tx = {
        id: 'demo_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substr(2, 6),
        amount: item.amount,
        type: item.type,
        category: item.category,
        subcategory: item.subcategory,
        date: item.date,
        note: item.note,
        description: item.description,
        account_from: item.account_from,
        account_to: item.account_to,
        user_id: uid,
        is_demo: true
      };

      if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
        await saveTransaction(tx);
      } else {
        saveTransactionOffline(tx);
      }
    }

    // 2. Save demo budgets
    if (!state.budgets) state.budgets = [];
    state.budgets = state.budgets.filter(b => !(b && (b.is_demo || (b.id && String(b.id).startsWith('demo_')))));

    for (let i = 0; i < demoBudgets.length; i++) {
      const bItem = demoBudgets[i];
      const budgetRecord = {
        id: 'demo_budget_' + Date.now() + '_' + i,
        user_id: uid,
        family_id: null,
        category: bItem.category,
        subcategory: '',
        amount: bItem.amount,
        currency: getDisplayCurrency(),
        period: 'monthly',
        scope: 'personal',
        notify_threshold: 0.8,
        is_demo: true,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      state.budgets.push(budgetRecord);
    }
    localStorage.setItem('cached_budgets', JSON.stringify(state.budgets));

    // Reload data & refresh UI
    await loadData();
    updateUI();
    updateHeaderDemoBadge();

    const successMsg = state.lang === 'el'
      ? '⚡ Είσοδος σε Demo Mode! (15 κινήσεις & 5 budgets)'
      : '⚡ Entered Demo Mode! (15 transactions & 5 budgets)';
    if (typeof showToast === 'function') showToast(successMsg, 'success');
  } catch (err) {
    console.error('Failed to pre-populate demo data:', err);
  }
}

function onboardingCreateTransaction() {
  closeModal('onboarding-modal');
  openModal('transaction-modal');
}

function onboardingShowGuide() {
  closeModal('onboarding-modal');
  const lang = state.lang || 'el';
  const welcomeText = lang === 'el'
    ? '👋 Γεια σας! Είμαι ο ψηφιακός σας βοηθός για τα οικογενειακά οικονομικά. Ας δούμε γρήγορα πώς λειτουργεί η εφαρμογή:\n\n' +
    '1️⃣ **Γράψτε ένα έξοδο:** Πατήστε το κουμπί **"+"** κάτω-κάτω. Μπορείτε να πληκτρολογήσετε, να μιλήσετε ή ακόμα και να βγάλετε φωτογραφία μια απόδειξη.\n' +
    '2️⃣ **Κοινό πορτοφόλι:** Από το μενού **"Περισσότερα -> Διαχείριση Οικογένειας"** μπορείτε να συνδεθείτε με τον/την σύντροφό σας για να βλέπετε μαζί τα έξοδα της οικογένειας.\n' +
    '3️⃣ **Έξυπνες ερωτήσεις:** Εδώ στο chat μπορείτε να με ρωτήσετε ό,τι θέλετε με απλά λόγια, π.χ. "πόσα δώσαμε για σουπερμάρκετ;" ή "κάνε μου μια πρόβλεψη για τον επόμενο μήνα".\n\n' +
    'Πώς μπορώ να σας βοηθήσω σήμερα;'
    : '👋 Hello! I am your AI Coach. Let\'s do a quick tour:\n\n' +
    '1️⃣ **Tracking:** Tap the **"+"** button at the bottom to quickly log transactions via keypad, voice or receipts.\n' +
    '2️⃣ **Shared Budget:** From **"More -> Family Management"** you can link with your partner for real-time synchronization.\n' +
    '3️⃣ **AI Analysis:** You can ask me anything right here, e.g. "How much did I spend this month?" or "Give me an expense forecast".\n\n' +
    'How can I help you today?';

  openAdvisorChat();
  const chatList = document.getElementById('advisor-chat-messages');
  if (chatList) chatList.innerHTML = '';
  appendChatMessage('advisor', welcomeText);
}

async function onboardingClearDemoData(isSilent = false) {
  if (!isSilent) {
    const lang = state.lang || 'el';
    const confirmed = await showConfirm(
      (TRANSLATIONS[lang] && TRANSLATIONS[lang]['demo_exit_confirm']) ||
      (lang === 'el' ? 'Θέλετε να βγείτε από το Demo και να σβήσετε όλα τα δοκιμαστικά δεδομένα;' : 'Do you want to exit Demo Mode and delete all sample data?'),
      (TRANSLATIONS[lang] && TRANSLATIONS[lang]['demo_exit_btn']) || (lang === 'el' ? 'Έξοδος από Demo' : 'Exit Demo'),
      '🗑️'
    );
    if (!confirmed) return;
  }

  const demoTxs = (state.transactions || []).filter(t => t && (t.is_demo || (t.id && String(t.id).startsWith('demo_'))));

  try {
    if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
      const ids = demoTxs.map(t => t.id).filter(Boolean);
      if (ids.length > 0) {
        await state.supabaseClient.from('transactions').delete().in('id', ids);
      }
    }

    // Delete from local memory/cache
    state.transactions = (state.transactions || []).filter(t => !(t && (t.is_demo || (t.id && String(t.id).startsWith('demo_')))));
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));

    state.budgets = (state.budgets || []).filter(b => !(b && (b.is_demo || (b.id && String(b.id).startsWith('demo_')))));
    localStorage.setItem('cached_budgets', JSON.stringify(state.budgets));

    // Reload & Update UI
    await loadData();
    updateUI();
    updateHeaderDemoBadge();

    const msg = state.lang === 'el'
      ? '👋 Επιστρέψατε στα πραγματικά σας δεδομένα!'
      : '👋 Returned to your real account data!';
    if (typeof showToast === 'function') showToast(msg, 'info');
    else window.showAlert(msg);
  } catch (err) {
    console.error('Failed to delete demo data:', err);
  }
}

window.onSubscreenShow_sync = function () {
  updateHeaderDemoBadge();
};

// Bind to window for HTML access
window.hasDemoData = hasDemoData;
window.updateHeaderDemoBadge = updateHeaderDemoBadge;
window.handleHeaderDemoClick = handleHeaderDemoClick;
window.onboardingAddDemoData = onboardingAddDemoData;
window.onboardingCreateTransaction = onboardingCreateTransaction;
window.onboardingShowGuide = onboardingShowGuide;
window.onboardingClearDemoData = onboardingClearDemoData;

  // Attach all public functions to window / global
  windowObj._qsDraft = _qsDraft;
  windowObj.getQuickStartProfile = getQuickStartProfile;
  windowObj.openQuickStartModal = openQuickStartModal;
  windowObj.closeQuickStartModal = closeQuickStartModal;
  windowObj.setQsIncomeChip = setQsIncomeChip;
  windowObj.onQsIncomeInputChange = onQsIncomeInputChange;
  windowObj.nextQsStepFromIncome = nextQsStepFromIncome;
  windowObj.updateQsFixedTotal = updateQsFixedTotal;
  windowObj.nextQsStepFromFixed = nextQsStepFromFixed;
  windowObj.renderQuickStartStep = renderQuickStartStep;
  windowObj.applyQuickStartProfile = applyQuickStartProfile;
  windowObj.hasDemoData = hasDemoData;
  windowObj.updateHeaderDemoBadge = updateHeaderDemoBadge;
  windowObj.handleHeaderDemoClick = handleHeaderDemoClick;
  windowObj.onboardingAddDemoData = onboardingAddDemoData;
  windowObj.onboardingCreateTransaction = onboardingCreateTransaction;
  windowObj.onboardingShowGuide = onboardingShowGuide;
  windowObj.onboardingClearDemoData = onboardingClearDemoData;
  windowObj.onSubscreenShow_sync = onSubscreenShow_sync;

  return {
    _qsDraft: _qsDraft,
    getQuickStartProfile: getQuickStartProfile,
    openQuickStartModal: openQuickStartModal,
    closeQuickStartModal: closeQuickStartModal,
    setQsIncomeChip: setQsIncomeChip,
    onQsIncomeInputChange: onQsIncomeInputChange,
    nextQsStepFromIncome: nextQsStepFromIncome,
    updateQsFixedTotal: updateQsFixedTotal,
    nextQsStepFromFixed: nextQsStepFromFixed,
    renderQuickStartStep: renderQuickStartStep,
    applyQuickStartProfile: applyQuickStartProfile,
    hasDemoData: hasDemoData,
    updateHeaderDemoBadge: updateHeaderDemoBadge,
    handleHeaderDemoClick: handleHeaderDemoClick,
    onboardingAddDemoData: onboardingAddDemoData,
    onboardingCreateTransaction: onboardingCreateTransaction,
    onboardingShowGuide: onboardingShowGuide,
    onboardingClearDemoData: onboardingClearDemoData,
    onSubscreenShow_sync: onSubscreenShow_sync
  };
});
