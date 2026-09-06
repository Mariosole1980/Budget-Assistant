// ============================================================
// COLLABORATION & SHARED FAMILY / PARTNER BUDGET HUB
// Autonomous UMD Module (Phase 12B Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PartnerSyncService = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var windowObj = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
  var window = windowObj;

function renderPartnerSection() {
  const container = document.getElementById('partner-linking-container-modal');
  if (!container) return;

  // Anti-flicker signature check — skip rebuild if state hasn't changed
  // Include a compact transaction signature so the last-activity indicator and
  // presence dots refresh live when a family member adds/updates a transaction.
  let _txSig = '';
  try {
    const _familyId = state.userProfile ? state.userProfile.family_id : null;
    const _me = state.currentUser ? state.currentUser.id : null;
    const _recent = (state.transactions || [])
      .filter(t => t.user_id && t.user_id !== _me && (!t.family_id || t.family_id === _familyId))
      .slice(0, 5)
      .map(t => (t.user_id || '') + ':' + (t.created_at || t.date || '') + ':' + (t.type || ''))
      .join('|');
    _txSig = _recent;
  } catch (e) { _txSig = ''; }
  const _partnerSig = (state.currentUser ? state.currentUser.id : 'none')
    + '||' + (state.userProfile ? (state.userProfile.family_id || '') + '_' + (state.userProfile.role || '') : 'noprof')
    + '||' + (state.familyProfiles || []).map(p => `${p.id}_${p.display_name || ''}_${p.role || ''}`).join(',')
    + '||' + (state.familyGroup ? (state.familyGroup.name || '') + '_' + (state.familyGroup.invite_code || '') : 'nogrp')
    + '||' + (state.lang || 'el')
    + '||tx:' + _txSig;
  if (container._lastRenderSignature === _partnerSig) return;
  container._lastRenderSignature = _partnerSig;

  if (!state.currentUser) {
    container.innerHTML = `
      <div style="text-align:center;padding:10px 0;">
        <div style="font-size:32px;margin-bottom:8px;">🔒</div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;">
          ${state.lang === 'el' ? 'Συνδεθείτε για να ξεκλειδώσετε τον <strong>Οικογενειακό Προϋπολογισμό 👥</strong>' : 'Sign in to unlock <strong>Family Budgeting 👥</strong>'}
        </p>
        <button class="btn btn-primary" onclick="showAuthOverlay()" style="width:100%;padding:12px;font-weight:700;">
          <i class="fa-solid fa-right-to-bracket" style="margin-right:6px;"></i>${state.lang === 'el' ? 'Σύνδεση / Εγγραφή' : 'Sign In / Register'}
        </button>
      </div>
    `;
    return;
  }

  const userProfile = state.userProfile;
  const familyId = userProfile ? userProfile.family_id : null;
  const myRole = userProfile ? userProfile.role : 'member';

  if (familyId) {
    // === CONNECTED FAMILY STATE ===
    let familyName = state.familyGroup ? state.familyGroup.name : '';
    if (!familyName || familyName.toLowerCase() === 'null') {
      // Fallback to "Οικογένεια [Admin Name]" format
      const adminProfile = state.familyProfiles.find(p => p.role === 'admin');
      const adminName = adminProfile ? (adminProfile.display_name || adminProfile.email.split('@')[0]) : '';
      familyName = adminName
        ? (state.lang === 'el' ? `Οικογένεια [${adminName}]` : `Family [${adminName}]`)
        : (state.lang === 'el' ? 'Οικογενειακός Προϋπολογισμός' : 'Family Budget');
    }
    const inviteCode = state.familyGroup ? state.familyGroup.invite_code : '';

    // Build members list HTML
    const membersHtml = renderFamilyMembersList(state.familyProfiles, myRole);

    let nameHtml = `<div style="font-family:'Outfit',sans-serif;font-size:15px;font-weight:800;color:var(--text-primary);">${familyName}</div>`;
    if (myRole === 'admin') {
      nameHtml = `
        <div id="family-group-name-label" style="font-family:'Outfit',sans-serif;font-size:15px;font-weight:800;color:var(--text-primary);cursor:pointer;user-select:none;border-bottom:1px dashed var(--text-muted);display:inline-block;" title="${state.lang === 'el' ? 'Κρατήστε πατημένο για μετονομασία' : 'Long press to rename'}">
          ${familyName}
        </div>
      `;
    }

    // Admin gets an "Add Member" button that opens the invite modal; members get a read-only invite code row
    const addMemberBtnHtml = myRole === 'admin'
      ? `<button type="button" onclick="openInviteModal('${inviteCode}')" style="margin-left:auto;display:flex;align-items:center;gap:5px;padding:6px 12px;font-size:11.5px;font-weight:700;border-radius:20px;background:var(--accent);color:#fff;border:none;cursor:pointer;box-shadow:0 3px 10px rgba(var(--accent-rgb,124,106,247),0.3);white-space:nowrap;">
          <i class="fa-solid fa-user-plus" style="font-size:12px;"></i>${state.lang === 'el' ? 'Προσθήκη Μέλους' : 'Add Member'}
        </button>`
      : `<span style="margin-left:auto;font-size:11px;font-weight:700;color:var(--text-secondary);background:rgba(var(--accent-rgb,124,106,247),0.12);padding:2px 8px;border-radius:20px;">${state.familyProfiles.length}</span>`;

    const memberInviteCodeRowHtml = (myRole !== 'admin' && inviteCode)
      ? renderMemberInviteCode(inviteCode)
      : '';

    // Evaluate Household 14-day trial / Premium status
    const isHouseholdPro = isPremium();
    const familyCreatedAt = state.familyGroup ? state.familyGroup.created_at : null;
    const trialStatus = (typeof window !== 'undefined' && window.PremiumService && typeof window.PremiumService.getFamilyTrialStatus === 'function')
      ? window.PremiumService.getFamilyTrialStatus(familyCreatedAt, isHouseholdPro)
      : { inTrial: true, daysRemaining: 14, expired: false, isPremium: isHouseholdPro };

    let trialBannerHtml = '';
    if (trialStatus.isPremium) {
      trialBannerHtml = `
        <div style="padding: 10px 14px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); border-radius: 14px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-crown" style="color: #fbbf24; font-size: 14px;"></i>
            <div>
              <div style="font-size: 12.5px; font-weight: 700; color: #fbbf24;">${state.lang === 'el' ? 'Κοινό Ταμείο Ενεργό (Premium)' : 'Shared Budget Active (Premium)'}</div>
              <div style="font-size: 10.5px; color: var(--text-secondary);">${state.lang === 'el' ? '1 άδεια καλύπτει όλο το σπίτι' : '1 license covers the entire household'}</div>
            </div>
          </div>
          <span style="font-size: 10px; font-weight: 800; background: rgba(245,158,11,0.2); color: #fbbf24; padding: 3px 8px; border-radius: 6px;">LIFETIME</span>
        </div>
      `;
    } else if (trialStatus.inTrial) {
      trialBannerHtml = `
        <div style="padding: 12px 14px; background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.08)); border: 1px solid rgba(99,102,241,0.3); border-radius: 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 30px; height: 30px; border-radius: 8px; background: rgba(99,102,241,0.2); color: #a5b4fc; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;">
              <i class="fa-solid fa-gift"></i>
            </div>
            <div>
              <div style="font-size: 12.5px; font-weight: 800; color: #fff;">${state.lang === 'el' ? 'Δωρεάν Δοκιμή Κοινού Ταμείου' : 'Family Sync Free Trial'}</div>
              <div style="font-size: 11px; color: #c7d2fe;">${state.lang === 'el' ? `Απομένουν <strong>${trialStatus.daysRemaining} ημέρες</strong> real-time συγχρονισμού` : `<strong>${trialStatus.daysRemaining} days</strong> remaining`}</div>
            </div>
          </div>
          <button type="button" onclick="openPremiumModal('family')" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #0f172a; border: none; padding: 6px 12px; border-radius: 10px; font-size: 11px; font-weight: 800; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 8px rgba(245,158,11,0.3);">
            ${state.lang === 'el' ? '€9,99 Για Πάντα' : '€9.99 Lifetime'}
          </button>
        </div>
      `;
    } else {
      trialBannerHtml = `
        <div style="padding: 12px 14px; background: rgba(244,63,94,0.12); border: 1px solid rgba(244,63,94,0.35); border-radius: 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 30px; height: 30px; border-radius: 8px; background: rgba(244,63,94,0.2); color: #f43f5e; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;">
              <i class="fa-solid fa-lock"></i>
            </div>
            <div>
              <div style="font-size: 12.5px; font-weight: 800; color: #fff;">${state.lang === 'el' ? 'Η Δοκιμή Κοινού Ταμείου Έληξε' : 'Family Sync Trial Expired'}</div>
              <div style="font-size: 11px; color: var(--text-secondary);">${state.lang === 'el' ? 'Κρατήστε το κοινό ταμείο ενεργό' : 'Keep your household synced'}</div>
            </div>
          </div>
          <button type="button" onclick="openPremiumModal('family')" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #0f172a; border: none; padding: 6px 12px; border-radius: 10px; font-size: 11px; font-weight: 800; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 8px rgba(245,158,11,0.3);">
            ${state.lang === 'el' ? 'Ξεκλείδωμα (€9,99)' : 'Unlock (€9.99)'}
          </button>
        </div>
      `;
    }

    // Calculate Couple Settle-Up ("Ποιος χρωστάει σε ποιον")
    let settleUpHtml = '';
    if (state.familyProfiles && state.familyProfiles.length >= 2) {
      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const myId = state.currentUser ? state.currentUser.id : null;

        const p1 = state.familyProfiles.find(p => p.id === myId) || state.familyProfiles[0];
        const p2 = state.familyProfiles.find(p => p.id !== p1.id) || state.familyProfiles[1];
        const members = [
          { id: p1.id, name: p1.display_name || (p1.email ? p1.email.split('@')[0] : (state.lang === 'el' ? 'Εσύ' : 'You')) },
          { id: p2.id, name: p2.display_name || (p2.email ? p2.email.split('@')[0] : (state.lang === 'el' ? 'Σύντροφος' : 'Partner')) }
        ];

        const sharedTxs = (state.transactions || []).filter(t => {
          if (!t || t.type !== 'expense' || t.is_shared === false) return false;
          if (!t.date) return false;
          const dStr = String(t.date).split('T')[0];
          const parts = dStr.split('-');
          if (parts.length !== 3) return false;
          return parseInt(parts[0], 10) === currentYear && (parseInt(parts[1], 10) - 1) === currentMonth;
        });

        const settleData = (typeof SafeToSpendEngine !== 'undefined' && typeof SafeToSpendEngine.calculateCoupleSettleUp === 'function')
          ? SafeToSpendEngine.calculateCoupleSettleUp(sharedTxs, members)
          : null;

        if (settleData) {
          const total = settleData.totalSharedExpenses;
          const m1 = settleData.members[0];
          const m2 = settleData.members[1];
          const settlement = settleData.settlement;
          const isEl = state.lang === 'el';

          let debtText = '';
          const isBalanced = settlement.amount === 0;

          if (isBalanced) {
            debtText = isEl
              ? 'Είστε πάτσι! ⚖️ Κανείς δεν χρωστάει για αυτόν τον μήνα.'
              : 'All settled up! ⚖️ No one owes anything this month.';
          } else if (settlement.from.id === myId) {
            debtText = isEl
              ? `Χρωστάς <span class="settle-up-amount-highlight">€ ${settlement.amount.toFixed(2).replace('.', ',')}</span> στον/στην <strong>${escapeHtml(settlement.to.name)}</strong>`
              : `You owe <span class="settle-up-amount-highlight">€ ${settlement.amount.toFixed(2)}</span> to <strong>${escapeHtml(settlement.to.name)}</strong>`;
          } else {
            debtText = isEl
              ? `Ο/Η <strong>${escapeHtml(settlement.from.name)}</strong> σου χρωστάει <span class="settle-up-amount-highlight">€ ${settlement.amount.toFixed(2).replace('.', ',')}</span>`
              : `<strong>${escapeHtml(settlement.from.name)}</strong> owes you <span class="settle-up-amount-highlight">€ ${settlement.amount.toFixed(2)}</span>`;
          }

          const pct1 = total > 0 ? Math.round((m1.paid / total) * 100) : 50;
          const pct2 = 100 - pct1;

          settleUpHtml = `
            <div class="settle-up-card">
              <div class="settle-up-header">
                <div class="settle-up-title">
                  <i class="fa-solid fa-scale-balanced" style="color: #818cf8; font-size: 15px;"></i>
                  <span>${isEl ? 'Εκκαθάριση Κοινών Εξόδων (50/50)' : 'Shared Settle-Up (50/50)'}</span>
                </div>
                ${isBalanced ? `
                  <span class="settle-up-balanced-badge">
                    <i class="fa-solid fa-check"></i> ${isEl ? 'Πάτσι' : 'Settled'}
                  </span>
                ` : `
                  <span style="font-size: 11px; font-weight: 700; color: #a5b4fc; background: rgba(99,102,241,0.15); padding: 3px 8px; border-radius: 10px;">
                    ${isEl ? 'Εκκρεμεί' : 'Pending'}
                  </span>
                `}
              </div>

              <div class="settle-up-summary-box">
                <div class="settle-up-debt-text">${debtText}</div>
              </div>

              <div>
                <div class="settle-up-members-legend">
                  <span>${escapeHtml(m1.name)}: € ${m1.paid.toFixed(2).replace('.', ',')} (${pct1}%)</span>
                  <span>${escapeHtml(m2.name)}: € ${m2.paid.toFixed(2).replace('.', ',')} (${pct2}%)</span>
                </div>
                <div class="settle-up-comparison-bar" style="margin-top: 5px;">
                  <div class="settle-up-bar-segment-1" style="width: ${pct1}%;"></div>
                  <div class="settle-up-bar-segment-2" style="width: ${pct2}%;"></div>
                </div>
              </div>

              <div class="settle-up-actions">
                <button type="button" onclick="openSettleUpModal()" class="settle-up-btn-primary">
                  <i class="fa-solid fa-magnifying-glass-chart"></i>
                  <span>${isEl ? 'Ανάλυση & Εκκαθάριση' : 'Details & Settle Up'}</span>
                </button>
              </div>
            </div>
          `;
        }
      } catch (err) {
        console.warn('Error calculating couple settle-up:', err);
      }
    }

    // Last-activity indicator ("Ο Άρης πρόσθεσε έξοδο πριν 5 λεπτά")
    const lastActivity = getFamilyLastActivity();
    let lastActivityHtml = '';
    if (lastActivity && lastActivity.memberName) {
      const isEl = state.lang === 'el';
      let actionText = '';
      if (lastActivity.type === 'expense') {
        actionText = isEl ? 'πρόσθεσε έξοδο' : 'added an expense';
      } else if (lastActivity.type === 'income') {
        actionText = isEl ? 'πρόσθεσε έσοδο' : 'added income';
      } else if (lastActivity.type === 'transfer') {
        actionText = isEl ? 'έκανε μεταφορά' : 'made a transfer';
      } else {
        actionText = isEl ? 'ενημέρωσε τα οικονομικά' : 'updated the finances';
      }
      const noteSuffix = lastActivity.note
        ? (isEl ? ` — «${lastActivity.note}»` : ` — "${lastActivity.note}"`)
        : '';
      lastActivityHtml = `
        <div style="background:rgba(var(--accent-rgb,124,106,247),0.06);border:1px solid rgba(var(--accent-rgb,124,106,247),0.18);border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:10px;background:rgba(var(--accent-rgb,124,106,247),0.15);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">
            <i class="fa-solid fa-bolt"></i>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;">
            <div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);">
              ${isEl ? 'Τελευταία Δραστηριότητα' : 'Latest Activity'}
            </div>
            <div style="font-size:12.5px;color:var(--text-primary);font-weight:600;line-height:1.4;overflow-wrap:anywhere;word-break:break-word;max-width:100%;">
              <strong>${lastActivity.memberName}</strong> ${actionText}${noteSuffix}
            </div>
            <div style="font-size:10.5px;color:#4caf50;font-weight:700;">
              ${lastActivity.timeStr}
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;padding:2px 0;">

        <!-- Hero Header Banner Card -->
        <div style="background:linear-gradient(135deg, rgba(var(--accent-rgb, 124, 106, 247), 0.12), rgba(255, 255, 255, 0.02));border:1px solid rgba(var(--accent-rgb, 124, 106, 247), 0.25);border-radius:18px;padding:18px;display:flex;align-items:center;gap:14px;box-shadow:0 6px 20px rgba(0,0,0,0.15);">
          <div style="width:50px;height:50px;border-radius:14px;background:linear-gradient(135deg,var(--accent),#4caf50);color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;box-shadow:0 6px 16px rgba(var(--accent-rgb, 124, 106, 247), 0.35);">
            <i class="fa-solid fa-people-group" style="font-size:24px;"></i>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;">
            <div style="font-family:'Outfit',sans-serif;font-size:15px;font-weight:800;color:var(--text-primary);">
              ${nameHtml}
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#4caf50;font-weight:700;">
              <span style="width:7px;height:7px;border-radius:50%;background:#4caf50;display:inline-block;flex-shrink:0;"></span>
              ${state.lang === 'el' ? 'Κοινό Ιστορικό · Συγχρονισμένο σε πραγματικό χρόνο' : 'Shared History · Real-time Sync Active'}
            </div>
          </div>
          <button id="family-leave-btn" class="btn btn-secondary unlink-btn" onclick="leaveFamilyGroup()" style="padding:8px 12px;font-size:11px;font-weight:700;border-radius:10px;margin-left:0;white-space:nowrap;flex-shrink:0;">
            <i class="fa-solid fa-right-from-bracket" style="margin-right:5px;"></i>${state.lang === 'el' ? 'Αποχώρηση' : 'Leave'}
          </button>
        </div>

        <!-- Household 14-Day Free Trial / Premium Status Banner -->
        ${trialBannerHtml}

        <!-- Couple Settle-Up Card -->
        ${settleUpHtml}

        <!-- Last Activity Indicator -->
        ${lastActivityHtml}

        <!-- Members Card -->
        <div style="background:var(--bg-card, rgba(255,255,255,0.03));border:1px solid var(--border);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:0 4px 14px rgba(0,0,0,0.1);">
          <div style="display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;font-family:'Outfit',sans-serif;color:var(--text-primary);">
            <i class="fa-solid fa-users" style="color:var(--accent);"></i>
            <span>${state.lang === 'el' ? 'Μέλη Οικογένειας' : 'Family Members'}</span>
            ${addMemberBtnHtml}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            ${membersHtml}
          </div>
          ${memberInviteCodeRowHtml}
        </div>

        <!-- Feature Highlights Card -->
        ${renderFamilyFeatures()}

      </div>
    `;

    // Setup long press for renaming family name label (only if admin)
    const familyNameLabel = document.getElementById('family-group-name-label');
    if (familyNameLabel && myRole === 'admin') {
      let pressTimer;
      let isLongPress = false;

      const handleStart = (e) => {
        isLongPress = false;
        pressTimer = setTimeout(() => {
          isLongPress = true;
          if (navigator.vibrate) {
            try { navigator.vibrate(15); } catch (err) { }
          }
          promptRenameFamilyGroup();
        }, 600);
      };

      const handleEnd = () => {
        clearTimeout(pressTimer);
      };

      familyNameLabel.addEventListener('touchstart', handleStart, { passive: true });
      familyNameLabel.addEventListener('touchend', handleEnd, { passive: true });
      familyNameLabel.addEventListener('touchmove', handleEnd, { passive: true });
      familyNameLabel.addEventListener('touchcancel', handleEnd, { passive: true });

      familyNameLabel.addEventListener('mousedown', handleStart);
      familyNameLabel.addEventListener('mouseup', handleEnd);
      familyNameLabel.addEventListener('mouseleave', handleEnd);

      familyNameLabel.onclick = (e) => {
        if (isLongPress) {
          isLongPress = false;
          e.preventDefault();
          e.stopPropagation();
        }
      };
    }
  } else {
    // === SETUP / JOIN / CREATE FAMILY STATE ===
    const isEl = state.lang === 'el';
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;padding:2px 0;">
        
        <!-- Hero Header Banner Card -->
        <div style="background:linear-gradient(135deg, rgba(var(--accent-rgb, 124, 106, 247), 0.12), rgba(255, 255, 255, 0.02));border:1px solid rgba(var(--accent-rgb, 124, 106, 247), 0.25);border-radius:18px;padding:18px;display:flex;align-items:center;gap:14px;box-shadow:0 6px 20px rgba(0,0,0,0.15);">
          <div style="width:50px;height:50px;border-radius:14px;background:var(--accent);color:#ffffff;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;box-shadow:0 6px 16px rgba(var(--accent-rgb, 124, 106, 247), 0.35);">
            <i class="fa-solid fa-people-group" style="font-size:24px;"></i>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;">
            <div style="font-family:'Outfit',sans-serif;font-size:15px;font-weight:800;color:var(--text-primary);">
              ${isEl ? 'Οικογενειακός Προϋπολογισμός' : 'Family Budget & Shared Wallet'}
            </div>
            <div style="font-size:12px;color:var(--text-secondary);line-height:1.45;">
              ${isEl ? 'Διαχειριστείτε τα κοινά οικονομικά του σπιτιού σε πραγματικό χρόνο με τον/την σύντροφό σας.' : 'Manage shared household finances in real-time with your partner or family members.'}
            </div>
          </div>
        </div>

        <!-- Section 1: Join Family via Code -->
        <div style="background:var(--bg-card, rgba(255,255,255,0.03));border:1px solid var(--border);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:0 4px 14px rgba(0,0,0,0.1);">
          <div style="display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;font-family:'Outfit',sans-serif;color:var(--text-primary);">
            <i class="fa-solid fa-link" style="color:var(--accent);"></i>
            <span>${isEl ? 'Σύνδεση σε Οικογένεια με Κωδικό' : 'Join Family Group via Code'}</span>
          </div>
          <div style="display:flex;gap:8px;">
            <input type="text" id="join-family-code-input" class="form-input" placeholder="X1Y2Z3" 
              style="flex:1;font-size:14px;padding:10px 12px;text-transform:uppercase;letter-spacing:2px;font-family:monospace;text-align:center;margin-bottom:0;border-radius:10px;background:rgba(0,0,0,0.25);border:1px solid var(--border);color:var(--text-primary);">
            <button class="btn btn-primary" onclick="joinFamilyGroup()" 
              style="padding:10px 16px;font-size:12.5px;font-weight:700;white-space:nowrap;border-radius:10px;background:var(--accent);color:#fff;border:none;box-shadow:0 3px 10px rgba(var(--accent-rgb, 124, 106, 247), 0.3);cursor:pointer;display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-arrow-right-to-bracket"></i> ${isEl ? 'Σύνδεση' : 'Join'}
            </button>
          </div>
        </div>

        <!-- Section 2: Create New Family -->
        <div style="background:var(--bg-card, rgba(255,255,255,0.03));border:1px solid var(--border);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:0 4px 14px rgba(0,0,0,0.1);">
          <div style="display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;font-family:'Outfit',sans-serif;color:var(--text-primary);">
            <i class="fa-solid fa-square-plus" style="color:var(--accent);"></i>
            <span>${isEl ? 'Δημιουργία Νέας Οικογένειας' : 'Create New Family Group'}</span>
          </div>
          <div style="display:flex;gap:8px;">
            <input type="text" id="create-family-name-input" class="form-input" placeholder="${isEl ? 'Όνομα (π.χ. Οικ. Παπαδόπουλου)' : 'Group Name (e.g. Smith Family)'}" 
              style="flex:1;font-size:13px;padding:10px 12px;margin-bottom:0;border-radius:10px;background:rgba(0,0,0,0.25);border:1px solid var(--border);color:var(--text-primary);">
            <button class="btn btn-primary" onclick="createFamilyGroup()" 
              style="padding:10px 16px;font-size:12.5px;font-weight:700;white-space:nowrap;border-radius:10px;background:var(--accent);color:#fff;border:none;box-shadow:0 3px 10px rgba(var(--accent-rgb, 124, 106, 247), 0.3);cursor:pointer;display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-plus"></i> ${isEl ? 'Δημιουργία' : 'Create'}
            </button>
          </div>
        </div>

        <!-- Section 3: Feature Highlights Card -->
        <div style="background:rgba(0,0,0,0.15);border:1px solid var(--border);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;">
          <div style="font-size:12px;font-weight:800;font-family:'Outfit',sans-serif;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">
            ${isEl ? '✨ Πλεονεκτήματα Οικογενειακού Group' : '✨ Family Group Features'}
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:var(--text-secondary);line-height:1.45;">
            <div style="display:flex;align-items:flex-start;gap:8px;">
              <span style="color:var(--accent);font-size:14px;margin-top:1px;">⚡</span>
              <span><strong>${isEl ? 'Ταυτόχρονος Συγχρονισμός' : 'Real-time Sync'}:</strong> ${isEl ? 'Κάθε έξοδο ή έσοδο εμφανίζεται ακαριαία στις συσκευές όλων των μελών.' : 'Instant synchronization of all expenses and income across family devices.'}</span>
            </div>
            <div style="display:flex;align-items:flex-start;gap:8px;">
              <span style="color:var(--accent);font-size:14px;margin-top:1px;">📊</span>
              <span><strong>${isEl ? 'Κοινοί Προϋπολογισμοί' : 'Shared Budgets'}:</strong> ${isEl ? 'Θέστε κοινά όρια δαπανών για σούπερ μάρκετ, λογαριασμούς & έξοδα σπιτιού.' : 'Set joint spending limits for household, groceries, and utility bills.'}</span>
            </div>
            <div style="display:flex;align-items:flex-start;gap:8px;">
              <span style="color:var(--accent);font-size:14px;margin-top:1px;">🔒</span>
              <span><strong>${isEl ? 'Απόλυτη Ιδιωτικότητα' : 'Full Privacy'}:</strong> ${isEl ? 'Μόνο τα μέλη του δικού σας group έχουν πρόσβαση στα οικονομικά δεδομένα.' : 'Your financial data is encrypted and accessible strictly to your family members.'}</span>
            </div>
          </div>
        </div>

      </div>
    `;
  }
}

// ============================================================
// Family Management helper renderers (refactored from renderPartnerSection)
// ============================================================

// Renders the list of family members (avatars, names, roles, admin actions)
// Relative time helper ("πριν 5 λεπτά" / "2 hours ago")
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const isEl = state.lang === 'el';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return isEl ? 'μόλις τώρα' : 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return isEl ? `πριν ${min} λεπτ${min === 1 ? 'ό' : 'ά'}` : `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return isEl ? `πριν ${hr} ώρ${hr === 1 ? 'α' : 'ες'}` : `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return isEl ? `πριν ${day} ημέρ${day === 1 ? 'α' : 'ες'}` : `${day} day${day === 1 ? '' : 's'} ago`;
  const month = Math.floor(day / 30);
  return isEl ? `πριν ${month} μήν${month === 1 ? 'α' : 'ες'}` : `${month} month${month === 1 ? '' : 's'} ago`;
}

// Presence proxy: a member is considered "online" if they have a transaction within the last 10 minutes.
function getMemberPresence(memberId) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const recent = (state.transactions || []).some(t => {
    if (!t.user_id || t.user_id !== memberId) return false;
    const ts = t.created_at ? new Date(t.created_at).getTime() : (t.date ? new Date(t.date).getTime() : 0);
    if (!ts || isNaN(ts)) return false;
    return (now - ts) <= windowMs;
  });
  return recent;
}

// Find the most recent transaction by a family member (excluding the current user).
function getFamilyLastActivity() {
  const familyId = state.userProfile ? state.userProfile.family_id : null;
  const currentUserId = state.currentUser ? state.currentUser.id : null;
  if (!familyId || !currentUserId) return null;

  const candidates = (state.transactions || []).filter(t => {
    if (!t.user_id || t.user_id === currentUserId) return false;
    if (t.family_id && t.family_id !== familyId) return false;
    return true;
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : (a.date ? new Date(a.date).getTime() : 0);
    const tb = b.created_at ? new Date(b.created_at).getTime() : (b.date ? new Date(b.date).getTime() : 0);
    return (tb || 0) - (ta || 0);
  });

  const latest = candidates[0];
  const member = (state.familyProfiles || []).find(p => p.id === latest.user_id);
  const memberName = member ? (member.display_name || (member.email ? member.email.split('@')[0] : '')) : '';

  return {
    memberName,
    type: latest.type,
    note: latest.note || latest.description || '',
    timeStr: formatRelativeTime(latest.created_at || latest.date)
  };
}

function renderFamilyMembersList(members, myRole) {
  if (!members || !members.length) {
    return `<div style="font-size:12px;color:var(--text-muted);padding:6px 0;">${state.lang === 'el' ? 'Δεν υπάρχουν μέλη ακόμα.' : 'No members yet.'}</div>`;
  }

  // Sort members: Current User (Admin) always first at top, then other admins, then members
  const sortedMembers = [...members].sort((a, b) => {
    const isMeA = a.id === state.currentUser?.id;
    const isMeB = b.id === state.currentUser?.id;
    if (isMeA) return -1;
    if (isMeB) return 1;
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    return (a.display_name || a.email || '').localeCompare(b.display_name || b.email || '');
  });

  let membersHtml = '';
  sortedMembers.forEach(m => {
    const isMe = m.id === state.currentUser.id;
    // Prominent role badge for the current user
    const roleBadge = m.role === 'admin'
      ? (isMe
        ? `<span style="background:var(--accent);color:#fff;font-size:9.5px;padding:2px 7px;border-radius:4px;font-weight:800;margin-left:8px;box-shadow:0 2px 6px rgba(var(--accent-rgb,124,106,247),0.35);">${state.lang === 'el' ? 'Εσείς · Διαχειριστής' : 'You · Admin'}</span>`
        : `<span style="background:var(--accent-light);color:var(--accent);font-size:9.5px;padding:2px 6px;border-radius:4px;font-weight:700;margin-left:8px;">${state.lang === 'el' ? 'Διαχειριστής' : 'Admin'}</span>`)
      : (isMe
        ? `<span style="background:var(--accent);color:#fff;font-size:9.5px;padding:2px 7px;border-radius:4px;font-weight:800;margin-left:8px;box-shadow:0 2px 6px rgba(var(--accent-rgb,124,106,247),0.35);">${state.lang === 'el' ? 'Εσείς · Μέλος' : 'You · Member'}</span>`
        : `<span style="background:rgba(255,255,255,0.06);color:var(--text-secondary);font-size:9.5px;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:8px;">${state.lang === 'el' ? 'Μέλος' : 'Member'}</span>`);

    // Online/offline presence indicator (proxy from recent activity)
    const isOnline = getMemberPresence(m.id);
    const presenceDot = isMe
      ? `<span style="width:8px;height:8px;border-radius:50%;background:#4caf50;display:inline-block;flex-shrink:0;box-shadow:0 0 0 2px rgba(76,175,80,0.25);" title="${state.lang === 'el' ? 'Εσείς' : 'You'}"></span>`
      : (isOnline
        ? `<span style="width:8px;height:8px;border-radius:50%;background:#4caf50;display:inline-block;flex-shrink:0;box-shadow:0 0 0 2px rgba(76,175,80,0.25);" title="${state.lang === 'el' ? 'Ενεργός τώρα' : 'Active now'}"></span>`
        : `<span style="width:8px;height:8px;border-radius:50%;background:#78909c;display:inline-block;flex-shrink:0;opacity:0.5;" title="${state.lang === 'el' ? 'Εκτός σύνδεσης' : 'Offline'}"></span>`);
    const presenceLabel = isMe
      ? `<span style="font-size:9.5px;color:#4caf50;font-weight:700;">${state.lang === 'el' ? 'Ενεργός τώρα' : 'Active now'}</span>`
      : (isOnline
        ? `<span style="font-size:9.5px;color:#4caf50;font-weight:700;">${state.lang === 'el' ? 'Ενεργός τώρα' : 'Active now'}</span>`
        : `<span style="font-size:9.5px;color:var(--text-muted);font-weight:600;">${state.lang === 'el' ? 'Εκτός σύνδεσης' : 'Offline'}</span>`);

    let actionButtons = '';
    if (myRole === 'admin' && !isMe) {
      const demoteText = state.lang === 'el' ? 'Ορισμός ως Μέλος' : 'Set as Member';
      const promoteText = state.lang === 'el' ? 'Ορισμός ως Διαχειριστής' : 'Set as Admin';
      const removeText = state.lang === 'el' ? 'Αφαίρεση από την Οικογένεια' : 'Remove from Family';

      actionButtons = `
        <div style="position:relative;display:inline-block;">
          <button type="button" onclick="toggleMemberMenu(event, '${m.id}')" class="icon-btn" style="color:var(--text-secondary);padding:6px;font-size:14px;cursor:pointer;background:none;border:none;" title="${state.lang === 'el' ? 'Επιλογές' : 'Options'}">
            <i class="fa-solid fa-ellipsis-vertical"></i>
          </button>
          <div id="member-menu-${m.id}" class="member-dropdown-menu" style="display:none;position:absolute;right:0;top:100%;z-index:1000;background:var(--card-bg2, #1f2230);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.4);min-width:180px;padding:4px 0;text-align:left;">
            ${m.role === 'admin' ? `
              <div onclick="changeMemberRole('${m.id}', 'member')"
                   onmouseenter="this.style.background='rgba(255,255,255,0.05)'"
                   onmouseleave="this.style.background=''"
                   style="padding:10px 12px;font-size:12.5px;cursor:pointer;color:var(--text-primary);transition:background 0.2s;white-space:nowrap;">
                <i class="fa-solid fa-user-tag" style="margin-right:8px;width:14px;"></i>${demoteText}
              </div>
            ` : `
              <div onclick="changeMemberRole('${m.id}', 'admin')"
                   onmouseenter="this.style.background='rgba(255,255,255,0.05)'"
                   onmouseleave="this.style.background=''"
                   style="padding:10px 12px;font-size:12.5px;cursor:pointer;color:var(--text-primary);transition:background 0.2s;white-space:nowrap;">
                <i class="fa-solid fa-user-shield" style="margin-right:8px;width:14px;"></i>${promoteText}
              </div>
            `}
            <div onclick="kickFamilyMember('${m.id}')"
                 onmouseenter="this.style.background='rgba(239,83,80,0.08)'"
                 onmouseleave="this.style.background=''"
                 style="padding:10px 12px;font-size:12.5px;cursor:pointer;color:#ef5350;border-top:1px solid var(--border-light);transition:background 0.2s;white-space:nowrap;">
              <i class="fa-solid fa-user-minus" style="margin-right:8px;width:14px;"></i>${removeText}
            </div>
          </div>
        </div>
      `;
    }

    const initials = getMemberInitials(m);
    const gradient = getMemberColorGradient(m.id);
    const avatarImg = m.avatar_url || m.avatar || '';

    const avatarNodeHtml = avatarImg
      ? `<div style="width:36px;height:36px;border-radius:50%;background-image:url(${avatarImg});background-size:cover;background-position:center;border:1.5px solid var(--accent);box-shadow:0 2px 8px rgba(0,0,0,0.3);flex-shrink:0;"></div>`
      : `<div style="width:36px;height:36px;border-radius:50%;background:${gradient};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;text-transform:uppercase;box-shadow:0 1px 4px rgba(0,0,0,0.15);flex-shrink:0;">
          ${initials}
        </div>`;

    membersHtml += `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light);gap:10px;">
        <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
          <div style="position:relative;flex-shrink:0;">
            ${avatarNodeHtml}
            <span style="position:absolute;bottom:-1px;right:-1px;display:flex;">${presenceDot}</span>
          </div>
          <div style="display:flex;flex-direction:column;min-width:0;flex:1;">
            <span style="font-size:12px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${m.display_name || m.email.split('@')[0]}
            </span>
            <span style="font-size:10px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${m.email}
            </span>
            <span style="display:flex;align-items:center;gap:4px;margin-top:2px;">${presenceLabel}</span>
          </div>
          ${roleBadge}
        </div>
        ${actionButtons}
      </div>
    `;
  });
  return membersHtml;
}

// Read-only invite code row shown to non-admin members (copy/share)
function renderMemberInviteCode(inviteCode) {
  if (!inviteCode) return '';
  const isEl = state.lang === 'el';
  return `
    <div style="background:rgba(var(--accent-rgb,124,106,247),0.06);border:1px dashed rgba(var(--accent-rgb,124,106,247),0.35);border-radius:12px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:4px;">
      <div style="display:flex;flex-direction:column;">
        <span style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${isEl ? 'Κωδικός Πρόσκλησης' : 'Invite Code'}</span>
        <span style="font-size:15px;font-weight:800;color:var(--accent);letter-spacing:2px;font-family:monospace;">${inviteCode}</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button onclick="navigator.clipboard.writeText('${inviteCode}').then(()=>showSyncToast('${isEl ? '✓ Αντεγράφη ο κωδικός' : '✓ Code copied'}', 2000))" class="btn btn-secondary" style="padding:6px 10px;font-size:11px;border-radius:20px;line-height:1;font-weight:600;">
          📋 ${isEl ? 'Κωδικός' : 'Code'}
        </button>
        <button onclick="shareFamilyInviteCode('${inviteCode}')" class="btn btn-secondary" style="padding:6px 10px;font-size:11px;border-radius:20px;line-height:1;font-weight:600;">
          🔗 ${isEl ? 'Κοινή χρήση' : 'Share'}
        </button>
      </div>
    </div>
  `;
}

// Feature highlights card (shared with the connected-family view)
function renderFamilyFeatures() {
  const isEl = state.lang === 'el';
  return `
    <div style="background:rgba(0,0,0,0.15);border:1px solid var(--border);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;">
      <div style="font-size:12px;font-weight:800;font-family:'Outfit',sans-serif;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">
        ${isEl ? '✨ Πλεονεκτήματα Οικογενειακού Group' : '✨ Family Group Features'}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:var(--text-secondary);line-height:1.45;">
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <span style="color:var(--accent);font-size:14px;margin-top:1px;">⚡</span>
          <span><strong>${isEl ? 'Ταυτόχρονος Συγχρονισμός' : 'Real-time Sync'}:</strong> ${isEl ? 'Κάθε έξοδο ή έσοδο εμφανίζεται ακαριαία στις συσκευές όλων των μελών.' : 'Instant synchronization of all expenses and income across family devices.'}</span>
        </div>
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <span style="color:var(--accent);font-size:14px;margin-top:1px;">📊</span>
          <span><strong>${isEl ? 'Κοινοί Προϋπολογισμοί' : 'Shared Budgets'}:</strong> ${isEl ? 'Θέστε κοινά όρια δαπανών για σούπερ μάρκετ, λογαριασμούς & έξοδα σπιτιού.' : 'Set joint spending limits for household, groceries, and utility bills.'}</span>
        </div>
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <span style="color:var(--accent);font-size:14px;margin-top:1px;">🔒</span>
          <span><strong>${isEl ? 'Απόλυτη Ιδιωτικότητα' : 'Full Privacy'}:</strong> ${isEl ? 'Μόνο τα μέλη του δικού σας group έχουν πρόσβαση στα οικονομικά δεδομένα.' : 'Your financial data is encrypted and accessible strictly to your family members.'}</span>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// Invite Member Modal (Option B — opens in a modal window)
// ============================================================

function openInviteModal(inviteCode) {
  if (!state.currentUser) return;
  const isEl = state.lang === 'el';

  // Remove any existing instance first
  const existing = document.getElementById('family-invite-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'family-invite-modal';
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '15000';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.setAttribute('onclick', "if(event.target===this)closeInviteModal()");

  overlay.innerHTML = `
    <div class="modal-content" style="max-width:440px;max-height:88vh;overflow-y:auto;display:flex;flex-direction:column;gap:14px;padding:20px;border-radius:18px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,var(--accent),#4caf50);color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;box-shadow:0 4px 12px rgba(var(--accent-rgb,124,106,247),0.35);">
          <i class="fa-solid fa-user-plus"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-family:'Outfit',sans-serif;font-size:16px;font-weight:800;color:var(--text-primary);">${isEl ? 'Πρόσκληση Νέου Μέλους' : 'Invite New Member'}</div>
          <div style="font-size:12px;color:var(--text-muted);">${isEl ? 'Μοιραστείτε τον κωδικό ή τον σύνδεσμο πρόσκλησης' : 'Share the invite code or link'}</div>
        </div>
        <button type="button" onclick="closeInviteModal()" class="icon-btn" style="color:var(--text-secondary);padding:6px;font-size:15px;cursor:pointer;background:none;border:none;flex-shrink:0;" aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- 1. STEP 1: Select Role -->
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:12px;color:var(--text-muted);font-weight:600;margin-bottom:0;">
          ${isEl ? '1. Επιλέξτε Ρόλο Νέου Μέλους:' : '1. Select New Member Role:'}
        </label>
        <div style="display:flex;gap:8px;margin-bottom:2px;">
          <div id="role-card-member" onclick="selectInviteRole('member')" role="button" tabindex="0" style="flex:1;padding:10px 12px;border:2px solid var(--accent);border-radius:10px;background:rgba(var(--accent-rgb,124,106,247),0.10);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px;position:relative;user-select:none;-webkit-user-select:none;box-shadow:0 0 0 3px rgba(var(--accent-rgb,124,106,247),0.18);">
            <span style="font-size:16px;">👤</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:700;color:var(--text-primary);">${isEl ? 'Μέλος' : 'Member'}</div>
              <div style="font-size:11px;color:var(--text-muted);">${isEl ? 'Βλέπει & προσθέτει κινήσεις' : 'View & add transactions'}</div>
            </div>
            <span id="role-check-member" style="font-size:14px;color:var(--accent);flex-shrink:0;">✓</span>
          </div>
          <div id="role-card-admin" onclick="selectInviteRole('admin')" role="button" tabindex="0" style="flex:1;padding:10px 12px;border:2px dashed var(--card-border);border-radius:10px;background:var(--card-bg2,rgba(255,255,255,0.03));cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px;position:relative;user-select:none;-webkit-user-select:none;opacity:0.75;">
            <span style="font-size:16px;">👑</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:700;color:var(--text-primary);">${isEl ? 'Διαχειριστής' : 'Admin'}</div>
              <div style="font-size:11px;color:var(--text-muted);">${isEl ? 'Πλήρης έλεγχος οικογένειας' : 'Full family control'}</div>
            </div>
            <span id="role-check-admin" style="font-size:14px;color:var(--accent);flex-shrink:0;opacity:0;">✓</span>
          </div>
        </div>
        <input type="hidden" id="invite-role-select" value="member">
        <!-- Role permission details -->
        <div id="role-permission-details" style="font-size:11.5px;line-height:1.5;color:var(--text-secondary);background:var(--card-bg2,rgba(255,255,255,0.04));border:1px solid var(--card-border);border-radius:8px;padding:8px 10px;">
          <div id="role-permission-member" style="display:block;">
            <span style="font-weight:700;color:var(--text-primary);">👤 ${isEl ? 'Μέλος:' : 'Member:'}</span>
            <span> ${isEl ? 'Βλέπει όλες τις κινήσεις, προσθέτει/επεξεργάζεται τις δικές του κινήσεις. Δεν μπορεί να προσθέσει ή να αφαιρέσει μέλη.' : 'Views all transactions, adds/edits their own. Cannot add or remove members.'}</span>
          </div>
          <div id="role-permission-admin" style="display:none;">
            <span style="font-weight:700;color:var(--text-primary);">👑 ${isEl ? 'Διαχειριστής:' : 'Admin:'}</span>
            <span> ${isEl ? 'Όλα τα δικαιώματα μέλους, συν: προσθήκη/αφαίρεση μελών, αλλαγή ρόλων και διαχείριση της οικογένειας.' : 'All member rights, plus: add/remove members, change roles and manage the family.'}</span>
          </div>
        </div>
      </div>

      <!-- 2. Code Badge & Quick Copy Chips -->
      <div style="background:var(--card-bg2,rgba(255,255,255,0.04));border:1px solid var(--card-border);border-radius:12px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <div style="display:flex;flex-direction:column;">
          <span style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${isEl ? 'Κωδικός Πρόσκλησης' : 'Invite Code'}</span>
          <span style="font-size:17px;font-weight:800;color:var(--accent);letter-spacing:2px;font-family:monospace;">${inviteCode}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button onclick="navigator.clipboard.writeText('${inviteCode}').then(()=>showSyncToast('${isEl ? '✓ Αντεγράφη ο κωδικός' : '✓ Code copied'}', 2000))" class="btn btn-secondary" style="padding:6px 10px;font-size:12px;border-radius:20px;line-height:1;font-weight:600;">
            📋 ${isEl ? 'Κωδικός' : 'Code'}
          </button>
          <button onclick="copyDirectInviteLink('${inviteCode}')" class="btn btn-secondary" style="padding:6px 10px;font-size:12px;border-radius:20px;line-height:1;font-weight:600;">
            🔗 ${isEl ? 'Σύνδεσμος' : 'Link'}
          </button>
        </div>
      </div>

      <!-- 3. STEP 2: Direct Messaging App Buttons -->
      <div style="background:rgba(var(--accent-rgb,124,106,247),0.04);border:1px solid rgba(var(--accent-rgb,124,106,247),0.15);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;">
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-paper-plane" style="color:var(--accent);"></i>
          <span>${isEl ? '2. Αποστολή σε Εφαρμογή' : '2. Send via App'}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:8px;">
          <button onclick="sendFamilyInviteVia('whatsapp', '${inviteCode}')" style="background:#25D366;color:#fff;border:none;border-radius:10px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 3px 8px rgba(37,211,102,0.25);">
            <i class="fa-brands fa-whatsapp" style="font-size:16px;"></i>
            <span>WhatsApp</span>
          </button>
          <button onclick="sendFamilyInviteVia('viber', '${inviteCode}')" style="background:#7360F2;color:#fff;border:none;border-radius:10px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 3px 8px rgba(115,96,242,0.25);">
            <i class="fa-brands fa-viber" style="font-size:16px;"></i>
            <span>Viber</span>
          </button>
          <button onclick="sendFamilyInviteVia('sms', '${inviteCode}')" style="background:#007AFF;color:#fff;border:none;border-radius:10px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 3px 8px rgba(0,122,255,0.25);">
            <i class="fa-solid fa-comment-sms" style="font-size:15px;"></i>
            <span>SMS</span>
          </button>
          <button onclick="sendFamilyInviteVia('native', '${inviteCode}')" class="btn btn-secondary" style="border-radius:10px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            <i class="fa-solid fa-share-nodes" style="font-size:14px;"></i>
            <span>${isEl ? '📱 Όλες οι Εφαρμογές' : '📱 All Apps'}</span>
          </button>
        </div>
      </div>

      <!-- 4. STEP 3: Email Invite Block -->
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:2px;">
        <label style="font-size:12px;color:var(--text-muted);font-weight:600;margin-bottom:0;">
          ${isEl ? 'Ή Αποστολή Πρόσκλησης μέσω Email:' : 'Or Send Invite via Email:'}
        </label>
        <div style="display:flex;gap:8px;">
          <input type="email" id="invite-email-input" class="form-input" placeholder="email@family.com" style="flex:1;font-size:13.5px;padding:8px 10px;margin-bottom:0;border-radius:8px;">
          <button onclick="inviteMemberByEmail()" class="btn btn-primary" style="padding:8px 14px;font-size:13.5px;font-weight:700;border-radius:8px;white-space:nowrap;">
            <i class="fa-solid fa-paper-plane" style="margin-right:4px;"></i>${isEl ? 'Αποστολή' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  openModal('family-invite-modal', { instant: true });
}

function closeInviteModal() {
  const el = document.getElementById('family-invite-modal');
  if (el) {
    closeModal('family-invite-modal');
    setTimeout(() => { el.remove(); }, 250);
  }
}

window.openInviteModal = openInviteModal;
window.closeInviteModal = closeInviteModal;

function getMemberInitials(m) {
  const name = (m.display_name || m.email.split('@')[0] || '').trim();
  const parts = name.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  if (name.length >= 2) {
    return name.substring(0, 2).toUpperCase();
  }
  return (name.substring(0, 1) || '?').toUpperCase();
}

function getMemberBadgeHTML(t) {
  if (state.userProfile && state.userProfile.family_id && t.user_id) {
    if (!t.family_id) {
      return `<span class="trans-personal-badge" style="background:rgba(255,255,255,0.08);color:var(--text-muted);display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:10px;font-size:9.5px;font-weight:600;margin-left:6px;vertical-align:middle;border:1px solid rgba(255,255,255,0.1);" title="${state.lang === 'el' ? 'Ατομική Κίνηση' : 'Personal Entry'}"><i class="fa-solid fa-lock" style="font-size:8px;"></i> ${state.lang === 'el' ? 'Ατομική' : 'Personal'}</span>`;
    }
    const creator = state.familyProfiles.find(p => p.id === t.user_id);
    if (creator) {
      const initials = getMemberInitials(creator);
      const gradient = getMemberColorGradient(creator.id);
      const creatorName = creator.display_name || creator.email.split('@')[0];
      return `<span class="trans-member-badge" style="background:${gradient};color:white;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;font-size:8px;font-weight:800;text-transform:uppercase;margin-left:6px;vertical-align:middle;box-shadow:0 1px 3px rgba(0,0,0,0.15);border:none;flex-shrink:0;" title="${state.lang === 'el' ? 'Προστέθηκε από: ' : 'Added by: '}${creatorName}">${initials}</span>`;
    }
  }
  const isPartner = state.partnerProfile && t.user_id === state.partnerProfile.id;
  return isPartner ? ` <i class="fa-solid fa-user-group partner-badge-icon" title="${state.lang === 'el' ? 'Προστέθηκε από τον σύντροφο' : 'Added by partner'}"></i>` : '';
}

function getMemberColorGradient(userId) {
  let hash = 0;
  if (userId) {
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
  }
  const gradients = [
    'linear-gradient(135deg, #e05e55 0%, #ff8a80 100%)', // Original Coral/Red-ish
    'linear-gradient(135deg, #2ec4b6 0%, #8fd3f4 100%)', // Emerald Green
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Neon Blue
    'linear-gradient(135deg, #ab47bc 0%, #fccb90 100%)', // Purple/Gold
    'linear-gradient(135deg, #4caf50 0%, #81c784 100%)', // Green
    'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)', // Pink/Purple
    'linear-gradient(135deg, #ffa726 0%, #ffcc80 100%)', // Orange/Peach
    'linear-gradient(135deg, #00b4d8 0%, #90e0ef 100%)'  // Teal/Sky
  ];
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

async function createFamilyGroup() {
  if (!state.supabaseClient || !state.currentUser) return;
  const nameInput = document.getElementById('create-family-name-input');
  if (!nameInput) return;

  let groupName = nameInput.value.trim();
  if (!groupName) {
    groupName = state.lang === 'el' ? 'Οικογενειακός Προϋπολογισμός' : 'Family Budget';
  }

  try {
    const { data: newFamilyId, error } = await state.supabaseClient.rpc('create_family_group', { group_name: groupName });
    if (error) throw error;

    window.showAlert(state.lang === 'el' ? '🎉 Η οικογένεια δημιουργήθηκε με επιτυχία!' : '🎉 Family group created successfully!');
    window.location.reload();
  } catch (err) {
    console.error('Error creating family group:', err);
    window.showAlert(state.lang === 'el' ? 'Σφάλμα κατά τη δημιουργία: ' + err.message : 'Error creating group: ' + err.message);
  }
}

async function joinFamilyGroup() {
  if (!state.supabaseClient || !state.currentUser) return;
  const codeInput = document.getElementById('join-family-code-input');
  if (!codeInput) return;

  const code = codeInput.value.trim().toUpperCase();
  if (!code) {
    window.showAlert(state.lang === 'el' ? 'Παρακαλώ εισάγετε τον κωδικό πρόσκλησης.' : 'Please enter the invite code.');
    return;
  }

  try {
    const { data, error } = await state.supabaseClient.rpc('join_family_group', { invite_code_input: code });
    if (error) throw error;

    window.showAlert(state.lang === 'el' ? '🎉 Συνδεθήκατε επιτυχώς στην οικογένεια!' : '🎉 Joined the family successfully!');
    window.location.reload();
  } catch (err) {
    console.error('Error joining family group:', err);
    window.showAlert(state.lang === 'el' ? 'Σφάλμα κατά τη σύνδεση: ' + err.message : 'Error joining family: ' + err.message);
  }
}

async function leaveFamilyGroup() {
  if (!state.supabaseClient || !state.currentUser) return;
  const isEl = state.lang === 'el';

  // Determine if this user is the last admin AND alone in the family (family will be deleted)
  const myRole = state.userProfile ? state.userProfile.role : 'member';
  const otherMembers = (state.familyProfiles || []).filter(p => p.id !== state.currentUser.id);
  const isLastAdminAlone = myRole === 'admin' && otherMembers.length === 0;

  let confirmMsg;
  if (isLastAdminAlone) {
    confirmMsg = isEl
      ? 'Είστε το μοναδικό μέλος. Με την αποχώρησή σας η οικογένεια θα διαγραφεί οριστικά.'
      : 'You are the only member. Leaving will permanently delete the family.';
  } else {
    confirmMsg = isEl
      ? 'Θα χάσετε την πρόσβαση στα κοινά οικονομικά δεδομένα και στο ιστορικό της ομάδας.'
      : 'You will lose access to the shared financial data and the family history.';
  }

  const confirmed = await showConfirm(confirmMsg, isEl ? 'Αποχώρηση από την οικογένεια' : 'Leave Family', '🚪');
  if (!confirmed) return;

  // Loading state on the Leave button to prevent double-clicks
  const leaveBtn = document.getElementById('family-leave-btn');
  if (leaveBtn) {
    leaveBtn.disabled = true;
    leaveBtn.style.opacity = '0.6';
    leaveBtn.style.pointerEvents = 'none';
    leaveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="margin-right:5px;"></i>${isEl ? 'Αποχώρηση...' : 'Leaving...'}`;
  }

  try {
    const { data, error } = await state.supabaseClient.rpc('leave_family_group');
    if (error) throw error;

    // Update local state to reflect leaving the family (no full page reload)
    if (state.userProfile) {
      state.userProfile.family_id = null;
      state.userProfile.role = 'member';
      localStorage.setItem('cached_user_profile', JSON.stringify(state.userProfile));
    }
    state.familyProfiles = [];
    state.familyGroup = null;
    state.partnerProfile = null;
    localStorage.removeItem('cached_family_profiles');
    localStorage.removeItem('cached_family_group');
    localStorage.removeItem('cached_partner_profile');

    // Re-render the Family Hub into the "Create / Join family" state
    renderPartnerSection();

    showSyncToast(isEl ? '✓ Αποχωρήσατε από την οικογένεια.' : '✓ You left the family.', 2500);
  } catch (err) {
    console.error('Error leaving family group:', err);

    // Restore the Leave button
    if (leaveBtn) {
      leaveBtn.disabled = false;
      leaveBtn.style.opacity = '1';
      leaveBtn.style.pointerEvents = 'auto';
      leaveBtn.innerHTML = `<i class="fa-solid fa-right-from-bracket" style="margin-right:5px;"></i>${isEl ? 'Αποχώρηση' : 'Leave'}`;
    }

    // Friendly Greek message for the "last admin" database safeguard
    const msg = (err && err.message) ? err.message.toLowerCase() : '';
    if (msg.includes('last admin') || msg.includes('promote another member')) {
      showSyncToast(isEl
        ? '⚠️ Δεν μπορείτε να αποχωρήσετε γιατί είστε ο μόνος διαχειριστής. Προωθήστε κάποιο μέλος σε διαχειριστή πρώτα.'
        : '⚠️ You cannot leave because you are the only admin. Promote another member to admin first.', 3500);
    } else {
      showSyncToast(isEl ? '⚠️ Σφάλμα κατά την αποχώρηση: ' + err.message : '⚠️ Error leaving family: ' + err.message, 3500);
    }
  }
}

async function kickFamilyMember(memberId) {
  if (!state.supabaseClient || !state.currentUser) return;
  const isEl = state.lang === 'el';

  const member = (state.familyProfiles || []).find(p => p.id === memberId);
  const memberName = member ? (member.display_name || (member.email ? member.email.split('@')[0] : '')) : '';

  const confirmMsg = isEl
    ? (memberName ? `Θα αφαιρέσετε τον/την ${memberName} από την οικογένεια. Θα χάσει την πρόσβαση στα κοινά οικονομικά δεδομένα.` : 'Θα αφαιρέσετε αυτό το μέλος από την οικογένεια. Θα χάσει την πρόσβαση στα κοινά οικονομικά δεδομένα.')
    : (memberName ? `You are about to remove ${memberName} from the family. They will lose access to the shared financial data.` : 'You are about to remove this member from the family. They will lose access to the shared financial data.');

  const confirmed = await showConfirm(confirmMsg, isEl ? 'Αποβολή Μέλους' : 'Kick Member', '🚪');
  if (!confirmed) return;

  try {
    const { data, error } = await state.supabaseClient.rpc('kick_family_member', { member_id_input: memberId });
    if (error) throw error;

    // Update local state: remove the member from familyProfiles
    state.familyProfiles = (state.familyProfiles || []).filter(p => p.id !== memberId);
    if (state.partnerProfile && state.partnerProfile.id === memberId) {
      state.partnerProfile = null;
      localStorage.removeItem('cached_partner_profile');
    }
    localStorage.setItem('cached_family_profiles', JSON.stringify(state.familyProfiles));

    renderPartnerSection();
    showSyncToast(isEl ? '✓ Το μέλος αφαιρέθηκε από την οικογένεια.' : '✓ Member removed from the family.', 2500);
  } catch (err) {
    console.error('Error kicking member:', err);
    showSyncToast(isEl ? '⚠️ Σφάλμα κατά την αφαίρεση: ' + err.message : '⚠️ Error kicking member: ' + err.message, 3500);
  }
}

async function changeMemberRole(memberId, role) {
  if (!state.supabaseClient || !state.currentUser) return;
  const isEl = state.lang === 'el';

  const member = (state.familyProfiles || []).find(p => p.id === memberId);
  const memberName = member ? (member.display_name || (member.email ? member.email.split('@')[0] : '')) : '';
  const isPromote = role === 'admin';

  const confirmMsg = isEl
    ? (isPromote
      ? (memberName ? `Θα ορίσετε τον/την ${memberName} ως Διαχειριστή. Θα μπορεί να διαχειρίζεται τα μέλη και την οικογένεια.` : 'Θα ορίσετε αυτό το μέλος ως Διαχειριστή.')
      : (memberName ? `Θα ορίσετε τον/την ${memberName} ως απλό Μέλος.` : 'Θα ορίσετε αυτό το μέλος ως απλό Μέλος.'))
    : (isPromote
      ? (memberName ? `You are about to make ${memberName} an Admin. They will be able to manage members and the family.` : 'You are about to make this member an Admin.')
      : (memberName ? `You are about to set ${memberName} as a regular Member.` : 'You are about to set this member as a regular Member.'));

  const confirmed = await showConfirm(confirmMsg, isEl ? 'Αλλαγή Ρόλου' : 'Change Role', '👤');
  if (!confirmed) return;

  try {
    const { data, error } = await state.supabaseClient.rpc('change_member_role', { member_id_input: memberId, new_role: role });
    if (error) throw error;

    // Update local state: change the member's role
    const target = (state.familyProfiles || []).find(p => p.id === memberId);
    if (target) {
      target.role = role;
      localStorage.setItem('cached_family_profiles', JSON.stringify(state.familyProfiles));
    }

    renderPartnerSection();
    showSyncToast(isEl
      ? (isPromote ? '✓ Ο ρόλος άλλαξε σε Διαχειριστής.' : '✓ Ο ρόλος άλλαξε σε Μέλος.')
      : (isPromote ? '✓ Role changed to Admin.' : '✓ Role changed to Member.'), 2500);
  } catch (err) {
    console.error('Error changing role:', err);
    showSyncToast(isEl ? '⚠️ Σφάλμα κατά την αλλαγή ρόλου: ' + err.message : '⚠️ Error updating role: ' + err.message, 3500);
  }
}

async function inviteMemberByEmail() {
  if (!state.supabaseClient || !state.currentUser || !state.familyGroup) return;
  const emailInput = document.getElementById('invite-email-input');
  if (!emailInput) return;

  const email = emailInput.value.trim().toLowerCase();
  if (!email) {
    window.showAlert(state.lang === 'el' ? 'Παρακαλώ εισάγετε ένα έγκυρο email.' : 'Please enter a valid email.');
    return;
  }

  if (email === state.currentUser.email.toLowerCase()) {
    window.showAlert(state.lang === 'el' ? 'Δεν μπορείτε να προσκαλέσετε το δικό σας email!' : 'You cannot invite your own email!');
    return;
  }

  try {
    const isAlreadyMember = state.familyProfiles.some(m => m.email.toLowerCase() === email);
    if (isAlreadyMember) {
      window.showAlert(state.lang === 'el' ? 'Αυτός ο χρήστης είναι ήδη μέλος της οικογένειας!' : 'This user is already a member of your family!');
      return;
    }

    // PREMIUM GATE: Free allows up to 2 members (user + 1). Adding a 3rd member
    // requires Premium. This is a UX check; the authoritative enforcement is
    // server-side in join_family_group / the RPC.
    const currentMemberCount = (state.familyProfiles || []).length;
    if (currentMemberCount >= PREMIUM_LIMITS.familyMembers && !isPremium()) {
      if (typeof openPremiumModal === 'function') {
        openPremiumModal('family');
      }
      showSyncToast(
        state.lang === 'el'
          ? '⭐ Το δωρεάν πλάνο επιτρέπει έως 2 μέλη. Αναβάθμισε σε Premium για περισσότερα.'
          : '⭐ The free plan allows up to 2 members. Upgrade to Premium for more.',
        4000
      );
      return;
    }

    const roleSelect = document.getElementById('invite-role-select');
    const selectedRole = roleSelect ? roleSelect.value : 'member';

    const { error } = await state.supabaseClient
      .from('pending_invitations')
      .insert([{
        family_id: state.familyGroup.id,
        invited_email: email,
        invited_by: state.currentUser.id,
        role: selectedRole
      }]);

    if (error && error.code !== '23505') { // 23505 is unique constraint (already invited)
      throw error;
    }

    const adminName = state.userProfile ? (state.userProfile.display_name || state.currentUser.email.split('@')[0]) : state.currentUser.email.split('@')[0];
    const familyName = state.familyGroup.name;
    const inviteCode = state.familyGroup.invite_code;
    const deepLink = `${window.location.origin}${window.location.pathname}?invite=${inviteCode}&role=${selectedRole}`;

    const subject = state.lang === 'el'
      ? `Πρόσκληση Σύνδεσης στο Budget Assistant`
      : `Invitation to Join Budget Assistant`;

    const body = state.lang === 'el'
      ? `Γεια σου!\n\nΟ/Η ${adminName} σε προσκαλεί να γίνεις μέλος στην οικογένεια «${familyName}» στο Budget Assistant ως ${selectedRole === 'admin' ? 'Διαχειριστής' : 'Μέλος'}.\n\nΚάνε κλικ στον παρακάτω σύνδεσμο για να συνδεθείς αυτόματα:\n${deepLink}\n\nΉ χρησιμοποίησε τον κωδικό πρόσκλησης: ${inviteCode}\n\nΦιλικά,\nΗ ομάδα του Budget Assistant`
      : `Hi!\n\n${adminName} has invited you to join the family group "${familyName}" on Budget Assistant as ${selectedRole === 'admin' ? 'Admin' : 'Member'}.\n\nClick the link below to join automatically:\n${deepLink}\n\nOr use the invite code: ${inviteCode}\n\nBest regards,\nBudget Assistant Team`;

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;

    window.showAlert(state.lang === 'el'
      ? '🎉 Η πρόσκληση καταχωρήθηκε στη βάση! Ανοίγει το πρόγραμμα email σας για την αποστολή του συνδέσμου.'
      : '🎉 Invitation saved! Your email client will now open to send the link.');

    emailInput.value = '';
  } catch (err) {
    console.error('Error inviting member:', err);
    window.showAlert(state.lang === 'el' ? 'Σφάλμα κατά την πρόσκληση: ' + err.message : 'Error sending invitation: ' + err.message);
  }
}

function openRenameFamilyModal() {
  if (!state.currentUser || !state.familyGroup) return;
  const isEl = state.lang === 'el';
  const currentName = state.familyGroup.name || '';

  // Remove any existing instance first
  const existing = document.getElementById('family-rename-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'family-rename-modal';
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '15000';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.setAttribute('onclick', "if(event.target===this)closeRenameFamilyModal()");

  overlay.innerHTML = `
    <div class="modal-content" style="max-width:400px;display:flex;flex-direction:column;gap:16px;padding:24px 20px;border-radius:18px;margin:auto;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,var(--accent),#4caf50);color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;box-shadow:0 4px 12px rgba(var(--accent-rgb,124,106,247),0.35);">
          <i class="fa-solid fa-pen-to-square"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-family:'Outfit',sans-serif;font-size:15px;font-weight:800;color:var(--text-primary);">${isEl ? 'Μετονομασία Οικογένειας' : 'Rename Family'}</div>
          <div style="font-size:11px;color:var(--text-muted);">${isEl ? 'Εισάγετε το νέο όνομα της οικογένειας' : 'Enter the new family name'}</div>
        </div>
        <button type="button" onclick="closeRenameFamilyModal()" class="icon-btn" style="color:var(--text-secondary);padding:6px;font-size:15px;cursor:pointer;background:none;border:none;flex-shrink:0;" aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <input type="text" id="family-rename-input" class="form-input" value="${escapeHtml(currentName)}" maxlength="60" placeholder="${isEl ? 'Όνομα οικογένειας' : 'Family name'}" style="font-size:16px !important;padding:12px 14px;margin:4px 0 6px 0;border-radius:12px;background:rgba(0,0,0,0.25);border:1px solid var(--border);color:var(--text-primary);">

      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" onclick="closeRenameFamilyModal()" class="btn btn-secondary" style="padding:9px 16px;font-size:12.5px;font-weight:700;border-radius:10px;white-space:nowrap;">
          ${isEl ? 'Ακύρωση' : 'Cancel'}
        </button>
        <button type="button" id="family-rename-save-btn" onclick="submitRenameFamily()" class="btn btn-primary" style="padding:9px 16px;font-size:12.5px;font-weight:700;border-radius:10px;white-space:nowrap;background:var(--accent);color:#fff;border:none;box-shadow:0 3px 10px rgba(var(--accent-rgb,124,106,247),0.3);cursor:pointer;">
          <i class="fa-solid fa-check" style="margin-right:4px;"></i>${isEl ? 'Αποθήκευση' : 'Save'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  openModal('family-rename-modal', { instant: true });

  // Focus the input safely without forcing full text selection overlay
  const input = document.getElementById('family-rename-input');
  if (input) {
    setTimeout(() => {
      input.focus();
      try {
        const len = input.value.length;
        input.setSelectionRange(len, len);
      } catch (err) { }
    }, 100);
    // Enter key submits, Escape closes
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitRenameFamily();
      } else if (e.key === 'Escape') {
        closeRenameFamilyModal();
      }
    });
  }
}

function closeRenameFamilyModal() {
  const el = document.getElementById('family-rename-modal');
  if (el) {
    closeModal('family-rename-modal', { instant: true });
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
  }
}

async function submitRenameFamily() {
  if (!state.supabaseClient || !state.currentUser || !state.familyGroup) return;
  const input = document.getElementById('family-rename-input');
  const newName = input ? input.value : '';
  const trimmed = newName.trim();
  if (!trimmed) {
    showSyncToast(state.lang === 'el' ? 'Το όνομα δεν μπορεί να είναι κενό.' : 'Name cannot be empty.', 2500);
    if (input) input.focus();
    return;
  }

  const saveBtn = document.getElementById('family-rename-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.6'; }

  try {
    const { data, error } = await state.supabaseClient.rpc('rename_family_group', { new_name: trimmed });
    if (error) throw error;

    state.familyGroup.name = trimmed;
    closeRenameFamilyModal();
    showSyncToast(state.lang === 'el' ? '✓ Το όνομα ενημερώθηκε' : '✓ Name updated successfully', 2000);
    renderPartnerSection();
  } catch (err) {
    console.error('Error renaming family group:', err);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
    showSyncToast(state.lang === 'el' ? 'Σφάλμα κατά τη μετονομασία: ' + err.message : 'Error renaming family group: ' + err.message, 3000);
  }
}

// Keep the original async entry point name so the long-press handler still works
async function promptRenameFamilyGroup() {
  openRenameFamilyModal();
}

function toggleMemberMenu(event, memberId) {
  event.stopPropagation();
  document.querySelectorAll('.member-dropdown-menu').forEach(menu => {
    if (menu.id !== `member-menu-${memberId}`) {
      menu.style.display = 'none';
    }
  });

  const menu = document.getElementById(`member-menu-${memberId}`);
  if (menu) {
    if (menu.style.display === 'none' || !menu.style.display) {
      menu.style.display = 'block';
    } else {
      menu.style.display = 'none';
    }
  }
}

// Bind to window for HTML accessibility
window.createFamilyGroup = createFamilyGroup;
window.joinFamilyGroup = joinFamilyGroup;
window.leaveFamilyGroup = leaveFamilyGroup;
window.kickFamilyMember = kickFamilyMember;
window.changeMemberRole = changeMemberRole;
window.inviteMemberByEmail = inviteMemberByEmail;
window.renderPartnerSection = renderPartnerSection;
window.promptRenameFamilyGroup = promptRenameFamilyGroup;
window.openRenameFamilyModal = openRenameFamilyModal;
window.closeRenameFamilyModal = closeRenameFamilyModal;
window.submitRenameFamily = submitRenameFamily;
window.toggleMemberMenu = toggleMemberMenu;
window.selectInviteRole = selectInviteRole;

function selectInviteRole(role) {
  const memberCard = document.getElementById('role-card-member');
  const adminCard = document.getElementById('role-card-admin');
  const hiddenInput = document.getElementById('invite-role-select');
  const memberCheck = document.getElementById('role-check-member');
  const adminCheck = document.getElementById('role-check-admin');
  const memberDetails = document.getElementById('role-permission-member');
  const adminDetails = document.getElementById('role-permission-admin');

  const selectCard = (card, selected) => {
    if (!card) return;
    if (selected) {
      card.style.border = '2px solid var(--accent)';
      card.style.background = 'rgba(var(--accent-rgb,124,106,247),0.10)';
      card.style.boxShadow = '0 0 0 3px rgba(var(--accent-rgb,124,106,247),0.18)';
      card.style.opacity = '1';
    } else {
      card.style.border = '2px dashed var(--card-border)';
      card.style.background = 'var(--card-bg2,rgba(255,255,255,0.03))';
      card.style.boxShadow = 'none';
      card.style.opacity = '0.75';
    }
  };

  if (role === 'member') {
    selectCard(memberCard, true);
    selectCard(adminCard, false);
    if (memberCheck) memberCheck.style.opacity = '1';
    if (adminCheck) adminCheck.style.opacity = '0';
    if (memberDetails) memberDetails.style.display = 'block';
    if (adminDetails) adminDetails.style.display = 'none';
    if (hiddenInput) hiddenInput.value = 'member';
  } else {
    selectCard(memberCard, false);
    selectCard(adminCard, true);
    if (memberCheck) memberCheck.style.opacity = '0';
    if (adminCheck) adminCheck.style.opacity = '1';
    if (memberDetails) memberDetails.style.display = 'none';
    if (adminDetails) adminDetails.style.display = 'block';
    if (hiddenInput) hiddenInput.value = 'admin';
  }
}

  // UMD Exports & Window Binding
  window.renderPartnerSection = renderPartnerSection;
  window.renderFamilyMembersList = renderFamilyMembersList;
  window.renderMemberInviteCode = renderMemberInviteCode;
  window.renderFamilyFeatures = renderFamilyFeatures;
  window.openInviteModal = openInviteModal;
  window.closeInviteModal = closeInviteModal;
  window.createFamilyGroup = createFamilyGroup;
  window.joinFamilyGroup = joinFamilyGroup;
  window.leaveFamilyGroup = leaveFamilyGroup;
  window.kickFamilyMember = kickFamilyMember;
  window.changeMemberRole = changeMemberRole;
  window.inviteMemberByEmail = inviteMemberByEmail;
  window.openRenameFamilyModal = openRenameFamilyModal;
  window.closeRenameFamilyModal = closeRenameFamilyModal;
  window.submitRenameFamily = submitRenameFamily;
  window.promptRenameFamilyGroup = promptRenameFamilyGroup;
  window.toggleMemberMenu = toggleMemberMenu;
  window.selectInviteRole = selectInviteRole;

  return {
    renderPartnerSection: renderPartnerSection,
    renderFamilyMembersList: renderFamilyMembersList,
    renderMemberInviteCode: renderMemberInviteCode,
    renderFamilyFeatures: renderFamilyFeatures,
    openInviteModal: openInviteModal,
    closeInviteModal: closeInviteModal,
    createFamilyGroup: createFamilyGroup,
    joinFamilyGroup: joinFamilyGroup,
    leaveFamilyGroup: leaveFamilyGroup,
    kickFamilyMember: kickFamilyMember,
    changeMemberRole: changeMemberRole,
    inviteMemberByEmail: inviteMemberByEmail,
    openRenameFamilyModal: openRenameFamilyModal,
    closeRenameFamilyModal: closeRenameFamilyModal,
    submitRenameFamily: submitRenameFamily,
    promptRenameFamilyGroup: promptRenameFamilyGroup,
    toggleMemberMenu: toggleMemberMenu,
    selectInviteRole: selectInviteRole
  };
}));
