/**
 * PremiumService.js
 *
 * Authoritative, pure client-side entitlement and gating engine for Budget Assistant.
 *
 * Gating Architecture:
 * - Authoritative enforcement: Server-side (Supabase RLS triggers, Cloudflare Workers).
 * - Client-side enforcement: UX layer to guide users with upgrade modals before hitting server rejections.
 * - Source of truth: userProfile.premium_active === true.
 *
 * Works in both Node.js (for automated unit testing) and Browser environments (as window.PremiumService).
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node / CommonJS (used by test runner)
        module.exports = factory();
    } else {
        // Browser environment
        var service = factory();
        root.PremiumService = service;
        // Global aliases for zero-regression backward compatibility with legacy app.js callers
        root.PREMIUM_LIMITS = service.LIMITS;
        root.PREMIUM_PRICE_EUR = service.PRICE_EUR;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /**
     * Tier limits definition for Free and Premium tiers.
     */
    var LIMITS = Object.freeze({
        familyMembers: 2,        // Free: user + 1. Premium: unlimited (3+)
        cloudTxPerMonth: 75,     // Free: 75 cloud-synced tx/month. Premium: unlimited
        currencies: 1,           // Free: 1 active currency. Premium: unlimited
        budgets: 2,              // Free: 2 category budgets. Premium: unlimited
        aiCoachFree: 10,         // Free: 10 online AI calls/month
        aiCoachPremium: 50,      // Premium: 50 online AI calls/month (fair-use)
        aiReceiptsFree: 5,       // Free: 5 AI receipt scans/month
        aiReceiptsPremium: 100   // Premium: 100 AI receipt scans/month (fair-use)
    });

    var PRICE_EUR = 9.99;

    /**
     * Evaluates whether a given user profile has active Premium entitlement.
     * @param {Object|null|undefined} userProfile
     * @returns {boolean}
     */
    function isPremium(userProfile) {
        if (!userProfile || typeof userProfile !== 'object') {
            return false;
        }
        return userProfile.premium_active === true;
    }

    /**
     * Returns structured premium status for UI presentation.
     * @param {Object|null|undefined} userProfile
     * @returns {{ active: boolean, purchasedAt: string|null }}
     */
    function getPremiumStatus(userProfile) {
        var active = isPremium(userProfile);
        return {
            active: active,
            purchasedAt: (active && userProfile && userProfile.premium_purchased_at) ? userProfile.premium_purchased_at : null
        };
    }

    /**
     * Evaluates permission to add another family member.
     * @param {number} currentMemberCount
     * @param {boolean} premium
     * @returns {{ allowed: boolean, limit: number, requiresUpgrade: boolean }}
     */
    function canAddFamilyMember(currentMemberCount, premium) {
        var count = typeof currentMemberCount === 'number' && !isNaN(currentMemberCount) ? currentMemberCount : 0;
        if (premium) {
            return { allowed: true, limit: Infinity, requiresUpgrade: false };
        }
        var allowed = count < LIMITS.familyMembers;
        return {
            allowed: allowed,
            limit: LIMITS.familyMembers,
            requiresUpgrade: !allowed
        };
    }

    /**
     * Evaluates permission to create another category budget.
     * @param {number} currentBudgetCount
     * @param {boolean} premium
     * @returns {{ allowed: boolean, limit: number, requiresUpgrade: boolean }}
     */
    function canAddBudget(currentBudgetCount, premium) {
        var count = typeof currentBudgetCount === 'number' && !isNaN(currentBudgetCount) ? currentBudgetCount : 0;
        if (premium) {
            return { allowed: true, limit: Infinity, requiresUpgrade: false };
        }
        var allowed = count < LIMITS.budgets;
        return {
            allowed: allowed,
            limit: LIMITS.budgets,
            requiresUpgrade: !allowed
        };
    }

    /**
     * Evaluates permission to enable a secondary currency.
     * EUR and USD are standard currencies allowed on Free plan; other secondary currencies require Premium.
     * @param {string} currencyCode
     * @param {string} baseCurrency
     * @param {boolean} premium
     * @returns {{ allowed: boolean, requiresUpgrade: boolean }}
     */
    function canAddCurrency(currencyCode, baseCurrency, premium) {
        if (premium) {
            return { allowed: true, requiresUpgrade: false };
        }
        var code = (currencyCode || '').toUpperCase().trim();
        var base = (baseCurrency || 'EUR').toUpperCase().trim();
        if (code === base || code === 'EUR' || code === 'USD') {
            return { allowed: true, requiresUpgrade: false };
        }
        return { allowed: false, requiresUpgrade: true };
    }

    /**
     * Evaluates permission to scan a receipt with OCR.
     * @param {number} scansThisMonth
     * @param {boolean} premium
     * @returns {{ allowed: boolean, limit: number, remaining: number, requiresUpgrade: boolean }}
     */
    function canScanReceipt(scansThisMonth, premium) {
        var count = typeof scansThisMonth === 'number' && !isNaN(scansThisMonth) ? scansThisMonth : 0;
        var limit = premium ? LIMITS.aiReceiptsPremium : LIMITS.aiReceiptsFree;
        var allowed = count < limit;
        return {
            allowed: allowed,
            limit: limit,
            remaining: Math.max(0, limit - count),
            requiresUpgrade: !allowed
        };
    }

    /**
     * Evaluates permission to sync another transaction to cloud storage this month.
     * @param {number} txCountThisMonth
     * @param {boolean} premium
     * @returns {{ allowed: boolean, limit: number, remaining: number, requiresUpgrade: boolean }}
     */
    function canSyncCloudTx(txCountThisMonth, premium) {
        var count = typeof txCountThisMonth === 'number' && !isNaN(txCountThisMonth) ? txCountThisMonth : 0;
        if (premium) {
            return { allowed: true, limit: Infinity, remaining: Infinity, requiresUpgrade: false };
        }
        var allowed = count < LIMITS.cloudTxPerMonth;
        return {
            allowed: allowed,
            limit: LIMITS.cloudTxPerMonth,
            remaining: Math.max(0, LIMITS.cloudTxPerMonth - count),
            requiresUpgrade: !allowed
        };
    }

    /**
     * Evaluates permission to execute an online AI advisor query.
     * @param {number|null|undefined} usageCount
     * @param {boolean} premium
     * @returns {{ allowed: boolean, limit: number, remaining: number, requiresUpgrade: boolean }}
     */
    function canUseOnlineCoach(usageCount, premium) {
        var limit = premium ? LIMITS.aiCoachPremium : LIMITS.aiCoachFree;
        // Offline or indeterminate usage is allowed client-side (server will verify)
        if (usageCount == null || typeof usageCount !== 'number' || isNaN(usageCount)) {
            return {
                allowed: true,
                limit: limit,
                remaining: limit,
                requiresUpgrade: false
            };
        }
        var allowed = usageCount < limit;
        return {
            allowed: allowed,
            limit: limit,
            remaining: Math.max(0, limit - usageCount),
            requiresUpgrade: !allowed
        };
    }

    /**
     * Generic entitlement checker dispatcher for any feature key.
     * @param {string} featureKey
     * @param {Object} context
     * @param {boolean} premium
     * @returns {{ allowed: boolean, requiresUpgrade: boolean, limit?: number }}
     */
    function checkEntitlement(featureKey, context, premium) {
        context = context || {};
        switch (featureKey) {
            case 'family':
            case 'familyMembers':
                return canAddFamilyMember(context.currentMemberCount || 0, premium);
            case 'budgets':
                return canAddBudget(context.currentBudgetCount || 0, premium);
            case 'currency':
            case 'currencies':
                return canAddCurrency(context.currencyCode, context.baseCurrency, premium);
            case 'receipts':
            case 'aiReceipts':
                return canScanReceipt(context.scansThisMonth || 0, premium);
            case 'cloudSync':
            case 'cloudTx':
                return canSyncCloudTx(context.txCountThisMonth || 0, premium);
            case 'ai':
            case 'aiCoach':
                return canUseOnlineCoach(context.usageCount, premium);
            default:
                // If feature key is unknown, premium users get access, free users require upgrade
                return {
                    allowed: !!premium,
                    requiresUpgrade: !premium
                };
        }
    }

    /**
     * Evaluates the 14-day family sync trial for a household.
     * @param {string|Date|null} familyCreatedAt
     * @param {boolean} isHouseholdPremium
     * @returns {{ inTrial: boolean, daysRemaining: number, expired: boolean, isPremium: boolean }}
     */
    function getFamilyTrialStatus(familyCreatedAt, isHouseholdPremium) {
        if (isHouseholdPremium) {
            return { inTrial: false, daysRemaining: 0, expired: false, isPremium: true };
        }
        if (!familyCreatedAt) {
            return { inTrial: true, daysRemaining: 14, expired: false, isPremium: false };
        }
        var created = new Date(familyCreatedAt);
        if (isNaN(created.getTime())) {
            return { inTrial: true, daysRemaining: 14, expired: false, isPremium: false };
        }
        var now = new Date();
        var diffMs = now.getTime() - created.getTime();
        var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        var daysRemaining = Math.max(0, 14 - diffDays);
        return {
            inTrial: daysRemaining > 0,
            daysRemaining: daysRemaining,
            expired: daysRemaining === 0,
            isPremium: false
        };
    }

    return {
        LIMITS: LIMITS,
        PRICE_EUR: PRICE_EUR,
        isPremium: isPremium,
        getPremiumStatus: getPremiumStatus,
        getFamilyTrialStatus: getFamilyTrialStatus,
        canAddFamilyMember: canAddFamilyMember,
        canAddBudget: canAddBudget,
        canAddCurrency: canAddCurrency,
        canScanReceipt: canScanReceipt,
        canSyncCloudTx: canSyncCloudTx,
        canUseOnlineCoach: canUseOnlineCoach,
        checkEntitlement: checkEntitlement
    };
});
