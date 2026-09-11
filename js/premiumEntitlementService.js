/**
 * PremiumEntitlementService - Premium Limits, Entitlements & API Resolution Subsystem
 *
 * Handles:
 * - Premium limits and pricing (PREMIUM_LIMITS, PREMIUM_PRICE_EUR)
 * - User entitlement checks (isPremium, getPremiumStatus, requirePremium)
 * - Cloudflare backend API endpoint resolution for Capacitor / native / web (getBackendApiUrl)
 * - AI coach usage quotas and client-side guards (getAiUsageCount, getAiUsageLimit, canUseOnlineAI)
 * - Database serialization mapping for transactions (mapTransactionToDb)
 *
 * UMD pattern: Browser global + Node.js module.exports
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PremiumEntitlementService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function _getState() {
    return (typeof state !== 'undefined' ? state : (typeof window !== 'undefined' ? window.state : null)) || {};
  }

  // Premium limits & pricing are defined authoritatively in js/PremiumService.js
  // and exposed globally as window.PremiumService / window.PREMIUM_LIMITS.
  var PREMIUM_LIMITS = (typeof window !== 'undefined' && window.PremiumService)
    ? window.PremiumService.LIMITS
    : {
        familyMembers: 2,        // Free: user + 1. Premium: unlimited (3+)
        cloudTxPerMonth: 75,     // Free: 75 cloud-synced tx/month. Premium: unlimited
        currencies: 1,           // Free: 1 currency. Premium: unlimited
        budgets: 2,              // Free: 2 category budgets. Premium: unlimited
        aiCoachFree: 10,         // Free: 10 online AI calls/month
        aiCoachPremium: 50,      // Premium: 50 online AI calls/month (fair-use)
        aiReceiptsFree: 5,       // Free: 5 AI receipt scans/month
        aiReceiptsPremium: 100   // Premium: 100 AI receipt scans/month (fair-use)
      };

  // Premium price (one-time Lifetime). Sourced from PremiumService.
  var PREMIUM_PRICE_EUR = (typeof window !== 'undefined' && window.PremiumService)
    ? window.PremiumService.PRICE_EUR
    : 9.99;

  /**
   * Returns true if the current user has an active Premium entitlement.
   * Source of truth is the server profile (state.userProfile.premium_active).
   * localStorage is only a cache for faster UI; it is NOT a security boundary.
   */
  function isPremium() {
    var appState = _getState();
    // If connected to family, 1 license covers the whole household
    if (appState.familyProfiles && appState.familyProfiles.length > 0) {
      var anyFamilyPro = appState.familyProfiles.some(function (m) { return m.premium_active === true; });
      if (anyFamilyPro) return true;
    }
    if (typeof window !== 'undefined' && window.PremiumService) {
      if (window.PremiumService.isPremium(appState.userProfile)) return true;
    }
    var p = appState.userProfile;
    if (p && p.premium_active === true) return true;

    // Resilient offline/cache fallback
    if (typeof localStorage !== 'undefined') {
      if (localStorage.getItem('premium_active') === 'true') return true;
      try {
        var cachedProfile = localStorage.getItem('cached_user_profile');
        if (cachedProfile) {
          var parsed = JSON.parse(cachedProfile);
          if (parsed && parsed.premium_active === true) return true;
        }
      } catch (e) {}
      try {
        var cachedFamily = localStorage.getItem('cached_family_profiles');
        if (cachedFamily) {
          var parsedFamily = JSON.parse(cachedFamily);
          if (Array.isArray(parsedFamily) && parsedFamily.some(function (m) { return m && m.premium_active === true; })) return true;
        }
      } catch (e) {}
    }
    return false;
  }

  /**
   * Returns the current user's premium status for UI display.
   */
  function getPremiumStatus() {
    var appState = _getState();
    if (typeof window !== 'undefined' && window.PremiumService) {
      return window.PremiumService.getPremiumStatus(appState.userProfile);
    }
    return {
      active: isPremium(),
      purchasedAt: appState.userProfile ? appState.userProfile.premium_purchased_at : null
    };
  }

  /**
   * Shows the Premium upgrade modal (used by all gated features).
   * If the user is already premium, does nothing.
   */
  function requirePremium(featureKey) {
    if (isPremium()) return true;
    if (typeof openPremiumModal === 'function') {
      openPremiumModal(featureKey);
    } else if (typeof window !== 'undefined' && typeof window.openPremiumModal === 'function') {
      window.openPremiumModal(featureKey);
    }
    return false;
  }

  /**
   * Resolves relative API routes (/api/...) to the Cloudflare Pages backend
   * when running inside Capacitor (native Android/iOS) or local environment.
   */
  function getBackendApiUrl(endpoint) {
    var cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    var isCapacitorOrLocal = (typeof window !== 'undefined' && typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
      (typeof window !== 'undefined' && (
        window.location.protocol === 'capacitor:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      ));
    var base = isCapacitorOrLocal ? 'https://budget-assistant-pwa.pages.dev' : '';
    return base + cleanEndpoint;
  }

  /**
   * Returns the current month's online AI call count for the logged-in user,
   * or null when not authenticated (guest mode) / the RPC is unavailable.
   */
  async function getAiUsageCount() {
    var appState = _getState();
    try {
      if (!appState.supabaseClient || !appState.currentUser) return null;
      var res = await appState.supabaseClient.rpc('get_ai_usage');
      if (res.error) return null;
      return typeof res.data === 'number' ? res.data : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Returns the online AI call limit for the current user (10 free / 50 premium).
   */
  function getAiUsageLimit() {
    return isPremium() ? PREMIUM_LIMITS.aiCoachPremium : PREMIUM_LIMITS.aiCoachFree;
  }

  /**
   * Checks whether the user may make another online AI call. Returns true if allowed.
   */
  async function canUseOnlineAI() {
    var appState = _getState();
    var limit = getAiUsageLimit();
    var usage = await getAiUsageCount();
    if (usage == null) return true;
    if (usage < limit) return true;

    if (typeof openPremiumModal === 'function') {
      openPremiumModal('ai');
    } else if (typeof window !== 'undefined' && typeof window.openPremiumModal === 'function') {
      window.openPremiumModal('ai');
    }

    var toastFn = typeof showSyncToast === 'function' ? showSyncToast : (typeof window !== 'undefined' ? window.showSyncToast : null);
    if (toastFn) {
      toastFn(
        appState.lang === 'el'
          ? 'Έχετε φτάσει το μηνιαίο όριο του Online AI Coach (' + limit + '). Αναβαθμίστε σε Premium για 50/μήνα.'
          : 'You have reached your monthly Online AI Coach limit (' + limit + '). Upgrade to Premium for 50/month.',
        5000
      );
    }
    return false;
  }

  /**
   * Maps an in-memory transaction to database schema format
   */
  function mapTransactionToDb(t) {
    if (!t) return null;
    var appState = _getState();
    var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    var genUuid = typeof generateUUID === 'function' ? generateUUID : (typeof FormatUtils !== 'undefined' && typeof FormatUtils.generateUUID === 'function' ? FormatUtils.generateUUID : null);
    var id = (t.id && uuidRegex.test(String(t.id))) ? String(t.id) : (genUuid ? genUuid() : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'tx_' + Date.now()));
    var userId = t.user_id || (appState.currentUser ? appState.currentUser.id : null);
    var familyId = t.family_id || (appState.userProfile ? appState.userProfile.family_id : null);

    var dbTx = {
      id: id,
      user_id: userId,
      date: t.date ? String(t.date).slice(0, 19).replace(' ', 'T').slice(0, 10) : new Date().toISOString().slice(0, 10),
      type: (t.type === 'income' || t.type === 'transfer') ? t.type : 'expense',
      amount: parseFloat(t.amount) || 0,
      category: t.category || '',
      subcategory: t.subcategory || '',
      account_from: t.account_from || '',
      account_to: t.type === 'transfer' ? (t.account_to || null) : null,
      note: t.note || '',
      status: t.status === 'deleted' ? 'deleted' : 'active'
    };

    if (familyId) dbTx.family_id = familyId;
    if (t.recurring_template_id && uuidRegex.test(String(t.recurring_template_id))) {
      dbTx.recurring_template_id = t.recurring_template_id;
    }
    if (t.currency) dbTx.currency = t.currency;
    if (t.base_currency) dbTx.base_currency = t.base_currency;
    if (t.rate_to_base !== undefined && t.rate_to_base !== null) dbTx.rate_to_base = t.rate_to_base;
    if (t.amount_base !== undefined && t.amount_base !== null) dbTx.amount_base = t.amount_base;
    if (t.rate_source) dbTx.rate_source = t.rate_source;
    if (t.rate_to_base_actual !== undefined && t.rate_to_base_actual !== null) dbTx.rate_to_base_actual = t.rate_to_base_actual;
    if (t.rate_fetched_at) dbTx.rate_fetched_at = t.rate_fetched_at;
    if (t.transfer_id && uuidRegex.test(String(t.transfer_id))) dbTx.transfer_id = t.transfer_id;
    if (t.transfer_rate !== undefined && t.transfer_rate !== null) dbTx.transfer_rate = t.transfer_rate;

    if (t.created_at) dbTx.created_at = t.created_at;
    if (t.updated_at) dbTx.updated_at = t.updated_at;
    if (t.deleted_at) dbTx.deleted_at = t.deleted_at;
    if (t.deleted_by) dbTx.deleted_by = t.deleted_by;

    return dbTx;
  }

  var service = {
    PREMIUM_LIMITS: PREMIUM_LIMITS,
    PREMIUM_PRICE_EUR: PREMIUM_PRICE_EUR,
    isPremium: isPremium,
    getPremiumStatus: getPremiumStatus,
    requirePremium: requirePremium,
    getBackendApiUrl: getBackendApiUrl,
    getAiUsageCount: getAiUsageCount,
    getAiUsageLimit: getAiUsageLimit,
    canUseOnlineAI: canUseOnlineAI,
    mapTransactionToDb: mapTransactionToDb
  };

  if (typeof window !== 'undefined') {
    window.PremiumEntitlementService = service;
    window.PREMIUM_LIMITS = PREMIUM_LIMITS;
    window.PREMIUM_PRICE_EUR = PREMIUM_PRICE_EUR;
    window.isPremium = isPremium;
    window.getPremiumStatus = getPremiumStatus;
    window.requirePremium = requirePremium;
    window.getBackendApiUrl = getBackendApiUrl;
    window.canUseOnlineAI = canUseOnlineAI;
    window.mapTransactionToDb = mapTransactionToDb;
  }

  return service;
}));
