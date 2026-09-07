/**
 * ============================================================
 * TRANSACTION SCOPE & BALANCE ENGINE SUBSYSTEM
 * ============================================================
 * Handles active transaction scoping (personal vs family wallet, guest mode,
 * identity-based deduplication), transfer detection, multi-currency initial
 * balance calculations, and wallet theme switching.
 *
 * Extracted from app.js (Phase 21B Architectural Modularization)
 * ============================================================
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TransactionScopeService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function _getState() {
    if (typeof state !== 'undefined' && state) return state;
    if (typeof window !== 'undefined' && window.state) return window.state;
    if (typeof globalThis !== 'undefined' && globalThis.state) return globalThis.state;
    return {};
  }

  function applyWalletTheme() {
    const s = _getState();
    if (!s) return;
    if (typeof document === 'undefined' || !document.body) return;

    if (s.partnerProfile) {
      document.body.classList.add('shared-wallet-active');
    } else {
      document.body.classList.remove('shared-wallet-active');
    }

    // IMPORTANT: Always re-apply the user's chosen theme so that shared-wallet-active
    // never overrides the colour scheme. The theme is the single source of truth.
    // Clean ALL theme classes on BOTH <body> and <html> (same set as applyTheme),
    // then re-apply the full token set from the central THEMES config.
    const savedTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('app_theme')) || 'dark';
    const themeClasses = ['theme-oled', 'theme-light', 'theme-emerald', 'theme-ocean', 'theme-pink', 'theme-sakura', 'theme-rosegold', 'theme-cyber'];
    themeClasses.forEach(cls => {
      document.body.classList.remove(cls);
      if (document.documentElement) document.documentElement.classList.remove(cls);
    });
    if (savedTheme !== 'dark') {
      document.body.classList.add(`theme-${savedTheme}`);
      if (document.documentElement) document.documentElement.classList.add(`theme-${savedTheme}`);
    }
    if (typeof applyTheme === 'function') {
      applyTheme(savedTheme);
    } else if (typeof window !== 'undefined' && typeof window.applyTheme === 'function') {
      window.applyTheme(savedTheme);
    }
  }

  function getActiveTransactions() {
    const s = _getState();
    if (!s || !s.transactions) return [];

    let fallbackUid = null;
    try {
      if (typeof localStorage !== 'undefined') {
        const cachedUserStr = localStorage.getItem('cached_current_user');
        if (cachedUserStr) fallbackUid = JSON.parse(cachedUserStr).id;
      }
    } catch (_) {}

    const currentUserId = s.currentUser ? s.currentUser.id : fallbackUid;
    const partnerId = s.partnerProfile ? s.partnerProfile.id : null;
    const familyId = s.userProfile ? s.userProfile.family_id : null;
    const isPersonalMode = s.activeAccountMode === 'personal';

    // Collect all known family member IDs
    const familyMemberIds = new Set();
    if (partnerId) familyMemberIds.add(partnerId);
    if (Array.isArray(s.familyProfiles)) {
      s.familyProfiles.forEach(p => {
        if (p && p.id && p.id !== currentUserId) familyMemberIds.add(p.id);
      });
    }

    const filtered = s.transactions.filter(t => {
      if (!t) return false;
      if (t.user_id === undefined) {
        return true;
      }

      if (currentUserId) {
        if (isPersonalMode) {
          return (t.user_id === currentUserId && (!t.family_id || t.family_id === null)) ||
            (t.id && String(t.id).startsWith('local_') && (!t.family_id || t.family_id === null));
        }

        if (familyId) {
          return t.family_id === familyId ||
            t.user_id === currentUserId ||
            familyMemberIds.has(t.user_id) ||
            (t.id && String(t.id).startsWith('local_'));
        }
        return t.user_id === currentUserId ||
          familyMemberIds.has(t.user_id) ||
          (t.id && String(t.id).startsWith('local_'));
      } else {
        // Guest mode: show unowned/legacy transactions AND guest-owned demo data
        // (user_id === 'guest' or is_demo / demo_ id). Demo transactions created via
        // onboardingAddDemoData() carry user_id 'guest', so without this they would be
        // silently filtered out and Demo Mode would appear empty for guests.
        return t.user_id === null || t.user_id === undefined ||
          t.user_id === 'guest' || t.is_demo === true ||
          (t.id && String(t.id).startsWith('demo_'));
      }
    });

    // Deduplicate by ID only (provable identity).
    const seenIds = new Set();
    return filtered.filter(t => {
      const id = t.id;
      if (!id) return true;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });
  }

  // Central helper that decides whether a transaction is a transfer.
  function isTransferTransaction(t) {
    if (!t) return false;
    if (t.type === 'transfer') return true;
    const cat = t.category ? String(t.category).toLowerCase() : '';
    return cat.includes('μεταφ') || cat.includes('transfer');
  }

  function calculateInitialBalances() {
    const s = _getState();
    if (!s || !s.accounts) return;

    s.accounts.forEach(acc => {
      let netSum = 0;
      // The account balance is stored in the account's own currency (acc.currency),
      // so every transaction must be converted into that currency before being
      // added/subtracted.
      let accCurrency = acc.currency;
      if (!accCurrency) {
        if (typeof getDisplayCurrency === 'function') {
          accCurrency = getDisplayCurrency();
        } else if (typeof window !== 'undefined' && typeof window.getDisplayCurrency === 'function') {
          accCurrency = window.getDisplayCurrency();
        } else {
          accCurrency = 'EUR';
        }
      }

      // For family accounts during Personal Mode, calculate balance using all family transactions to avoid zero/distorted balances
      let activeTrans = getActiveTransactions();
      if (s.activeAccountMode === 'personal' && (acc.scope === 'family' || acc.family_id)) {
        const familyId = s.userProfile ? s.userProfile.family_id : null;
        const currentUserId = s.currentUser ? s.currentUser.id : null;
        const partnerId = s.partnerProfile ? s.partnerProfile.id : null;
        activeTrans = (s.transactions || []).filter(t => {
          if (!t) return false;
          if (familyId) return t.family_id === familyId || t.user_id === currentUserId || t.user_id === partnerId;
          return t.user_id === currentUserId;
        });
      }

      activeTrans.forEach(t => {
        let amt = 0;
        if (typeof CurrencyService !== 'undefined' && typeof CurrencyService.displayAmount === 'function') {
          amt = CurrencyService.displayAmount(t, accCurrency);
        } else if (typeof window !== 'undefined' && window.CurrencyService && typeof window.CurrencyService.displayAmount === 'function') {
          amt = window.CurrencyService.displayAmount(t, accCurrency);
        } else {
          amt = parseFloat(t.amount) || 0;
        }

        if (isTransferTransaction(t)) {
          if (t.account_from === acc.name) netSum -= amt;
          if (t.account_to === acc.name) netSum += amt;
        } else {
          if (t.account_from === acc.name) {
            if (t.type === 'expense') netSum -= amt;
            else if (t.type === 'income') netSum += amt;
          }
        }
      });

      const parsedBalance = parseFloat(acc.balance) || 0;
      const rawInitial = parsedBalance - netSum;
      if (typeof sanitizeFloat === 'function') {
        acc.initial_balance = sanitizeFloat(rawInitial);
      } else if (typeof window !== 'undefined' && typeof window.sanitizeFloat === 'function') {
        acc.initial_balance = window.sanitizeFloat(rawInitial);
      } else {
        acc.initial_balance = Math.round(rawInitial * 100) / 100;
      }
    });
  }

  // Global browser exports
  if (typeof window !== 'undefined') {
    window.applyWalletTheme = applyWalletTheme;
    window.getActiveTransactions = getActiveTransactions;
    window.isTransferTransaction = isTransferTransaction;
    window.calculateInitialBalances = calculateInitialBalances;
  }

  return {
    applyWalletTheme,
    getActiveTransactions,
    isTransferTransaction,
    calculateInitialBalances
  };
}));
