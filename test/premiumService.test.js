'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const PremiumService = require('../js/PremiumService.js');

describe('PremiumService Unit Tests', () => {

    describe('isPremium & getPremiumStatus', () => {
        test('returns false for null / undefined / empty userProfile', () => {
            assert.strictEqual(PremiumService.isPremium(null), false);
            assert.strictEqual(PremiumService.isPremium(undefined), false);
            assert.strictEqual(PremiumService.isPremium({}), false);
            assert.strictEqual(PremiumService.isPremium({ premium_active: false }), false);
            assert.strictEqual(PremiumService.isPremium({ premium_active: 0 }), false);
        });

        test('returns true only when premium_active is strictly true', () => {
            assert.strictEqual(PremiumService.isPremium({ premium_active: true }), true);
        });

        test('getPremiumStatus extracts active state and purchase timestamp', () => {
            const inactive = PremiumService.getPremiumStatus({ premium_active: false });
            assert.strictEqual(inactive.active, false);
            assert.strictEqual(inactive.purchasedAt, null);

            const active = PremiumService.getPremiumStatus({
                premium_active: true,
                premium_purchased_at: '2026-08-01T12:00:00Z'
            });
            assert.strictEqual(active.active, true);
            assert.strictEqual(active.purchasedAt, '2026-08-01T12:00:00Z');
        });
    });

    describe('Family Members Gating (canAddFamilyMember)', () => {
        test('Free plan: allows up to 2 members (user + 1), blocks 3rd member', () => {
            const check0 = PremiumService.canAddFamilyMember(0, false);
            assert.strictEqual(check0.allowed, true);
            assert.strictEqual(check0.requiresUpgrade, false);

            const check1 = PremiumService.canAddFamilyMember(1, false);
            assert.strictEqual(check1.allowed, true);
            assert.strictEqual(check1.requiresUpgrade, false);

            const check2 = PremiumService.canAddFamilyMember(2, false);
            assert.strictEqual(check2.allowed, false);
            assert.strictEqual(check2.requiresUpgrade, true);
            assert.strictEqual(check2.limit, 2);
        });

        test('Premium plan: allows unlimited family members', () => {
            const check2 = PremiumService.canAddFamilyMember(2, true);
            assert.strictEqual(check2.allowed, true);
            assert.strictEqual(check2.requiresUpgrade, false);

            const check10 = PremiumService.canAddFamilyMember(10, true);
            assert.strictEqual(check10.allowed, true);
        });
    });

    describe('Budgets Gating (canAddBudget)', () => {
        test('Free plan: allows 0 or 1 existing budgets, blocks 2nd addition (limit 2)', () => {
            assert.strictEqual(PremiumService.canAddBudget(0, false).allowed, true);
            assert.strictEqual(PremiumService.canAddBudget(1, false).allowed, true);

            const checkLimit = PremiumService.canAddBudget(2, false);
            assert.strictEqual(checkLimit.allowed, false);
            assert.strictEqual(checkLimit.requiresUpgrade, true);
        });

        test('Premium plan: allows unlimited category budgets', () => {
            assert.strictEqual(PremiumService.canAddBudget(2, true).allowed, true);
            assert.strictEqual(PremiumService.canAddBudget(50, true).allowed, true);
        });
    });

    describe('Multi-Currency Gating (canAddCurrency)', () => {
        test('Free plan: base currency, EUR and USD are free; others require premium', () => {
            assert.strictEqual(PremiumService.canAddCurrency('EUR', 'EUR', false).allowed, true);
            assert.strictEqual(PremiumService.canAddCurrency('USD', 'EUR', false).allowed, true);
            assert.strictEqual(PremiumService.canAddCurrency('GBP', 'EUR', false).allowed, false);
            assert.strictEqual(PremiumService.canAddCurrency('GBP', 'EUR', false).requiresUpgrade, true);
        });

        test('Premium plan: any currency is allowed', () => {
            assert.strictEqual(PremiumService.canAddCurrency('GBP', 'EUR', true).allowed, true);
            assert.strictEqual(PremiumService.canAddCurrency('JPY', 'EUR', true).allowed, true);
            assert.strictEqual(PremiumService.canAddCurrency('CHF', 'EUR', true).requiresUpgrade, false);
        });
    });

    describe('AI Receipt OCR Gating (canScanReceipt)', () => {
        test('Free plan: 5 scans/month limit', () => {
            const under = PremiumService.canScanReceipt(4, false);
            assert.strictEqual(under.allowed, true);
            assert.strictEqual(under.remaining, 1);
            assert.strictEqual(under.limit, 5);

            const atLimit = PremiumService.canScanReceipt(5, false);
            assert.strictEqual(atLimit.allowed, false);
            assert.strictEqual(atLimit.remaining, 0);
            assert.strictEqual(atLimit.requiresUpgrade, true);
        });

        test('Premium plan: 100 scans/month fair-use limit', () => {
            const under = PremiumService.canScanReceipt(50, true);
            assert.strictEqual(under.allowed, true);
            assert.strictEqual(under.remaining, 50);
            assert.strictEqual(under.limit, 100);

            const atLimit = PremiumService.canScanReceipt(100, true);
            assert.strictEqual(atLimit.allowed, false);
            assert.strictEqual(atLimit.remaining, 0);
        });
    });

    describe('Cloud Sync Gating (canSyncCloudTx)', () => {
        test('Free plan: 75 tx/month limit', () => {
            const under = PremiumService.canSyncCloudTx(74, false);
            assert.strictEqual(under.allowed, true);
            assert.strictEqual(under.remaining, 1);

            const atLimit = PremiumService.canSyncCloudTx(75, false);
            assert.strictEqual(atLimit.allowed, false);
            assert.strictEqual(atLimit.requiresUpgrade, true);
            assert.strictEqual(atLimit.remaining, 0);
        });

        test('Premium plan: unlimited cloud transactions', () => {
            const check = PremiumService.canSyncCloudTx(500, true);
            assert.strictEqual(check.allowed, true);
            assert.strictEqual(check.requiresUpgrade, false);
        });
    });

    describe('Online AI Coach Gating (canUseOnlineCoach)', () => {
        test('Free plan: 10 queries/month', () => {
            assert.strictEqual(PremiumService.canUseOnlineCoach(9, false).allowed, true);
            const atLimit = PremiumService.canUseOnlineCoach(10, false);
            assert.strictEqual(atLimit.allowed, false);
            assert.strictEqual(atLimit.requiresUpgrade, true);
        });

        test('Premium plan: 50 queries/month fair-use', () => {
            assert.strictEqual(PremiumService.canUseOnlineCoach(49, true).allowed, true);
            assert.strictEqual(PremiumService.canUseOnlineCoach(50, true).allowed, false);
        });

        test('Allows when usage is null or undefined (graceful fallback)', () => {
            assert.strictEqual(PremiumService.canUseOnlineCoach(null, false).allowed, true);
            assert.strictEqual(PremiumService.canUseOnlineCoach(undefined, false).allowed, true);
        });
    });

    describe('Unified Entitlement Dispatcher (checkEntitlement)', () => {
        test('Dispatches properly to feature-specific checkers', () => {
            assert.strictEqual(PremiumService.checkEntitlement('family', { currentMemberCount: 1 }, false).allowed, true);
            assert.strictEqual(PremiumService.checkEntitlement('family', { currentMemberCount: 2 }, false).allowed, false);

            assert.strictEqual(PremiumService.checkEntitlement('budgets', { currentBudgetCount: 1 }, false).allowed, true);
            assert.strictEqual(PremiumService.checkEntitlement('budgets', { currentBudgetCount: 2 }, false).allowed, false);

            assert.strictEqual(PremiumService.checkEntitlement('receipts', { scansThisMonth: 4 }, false).allowed, true);
            assert.strictEqual(PremiumService.checkEntitlement('receipts', { scansThisMonth: 5 }, false).allowed, false);

            assert.strictEqual(PremiumService.checkEntitlement('cloudSync', { txCountThisMonth: 50 }, false).allowed, true);
            assert.strictEqual(PremiumService.checkEntitlement('cloudSync', { txCountThisMonth: 75 }, false).allowed, false);
        });
    });

    describe('Family 14-Day Free Trial (getFamilyTrialStatus)', () => {
        test('Household with active Premium is exempt from trial countdown', () => {
            const status = PremiumService.getFamilyTrialStatus('2026-08-01', true);
            assert.strictEqual(status.isPremium, true);
            assert.strictEqual(status.inTrial, false);
            assert.strictEqual(status.expired, false);
        });

        test('New household starts with full 14 days', () => {
            const nowIso = new Date().toISOString();
            const status = PremiumService.getFamilyTrialStatus(nowIso, false);
            assert.strictEqual(status.inTrial, true);
            assert.strictEqual(status.expired, false);
            assert.strictEqual(status.daysRemaining, 14);
        });

        test('Household older than 14 days is marked expired', () => {
            const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
            const status = PremiumService.getFamilyTrialStatus(twentyDaysAgo, false);
            assert.strictEqual(status.inTrial, false);
            assert.strictEqual(status.expired, true);
            assert.strictEqual(status.daysRemaining, 0);
        });
    });
});

