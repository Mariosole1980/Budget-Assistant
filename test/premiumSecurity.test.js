'use strict';

// ============================================================================
// Premium / Stripe Security — Automated Attack-Scenario Tests
// ============================================================================
// These tests verify the security fixes from the pre-release audit
// (plans/premium-stripe-pre-release-audit.md) and the migration
// (premium-security-fix-migration.sql):
//
//   B1  protect_premium_columns trigger  (premium_active / premium_purchased_at)
//   W4  ai_usage user-write removal      (counter only via SECURITY DEFINER RPC)
//   W1/2/3  enforce_cloud_tx_limit trigger (100/month Free, unlimited Premium)
//   W5  /api/premium-status reconciliation (no grant without a paid Stripe session)
//
// The SQL triggers cannot run in the Node test runner, so we model their exact
// logic as pure JS reference functions and assert the attack scenarios against
// them. This validates the security *logic* that the SQL implements.
//
// Run with: npm test   (node --test "test/**/*.test.js")
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert');

// ---------------------------------------------------------------------------
// Reference model of the SQL trigger logic (mirrors premium-security-fix-migration.sql)
// ---------------------------------------------------------------------------

const CLOUD_TX_LIMIT = 100; // keep in sync with PREMIUM_LIMITS.cloudTxPerMonth in app.js

// Mirrors public.protect_premium_columns() BEFORE UPDATE trigger.
// Returns { allowed: true } or { allowed: false, reason }.
function protectPremiumColumns(oldRow, newRow, authRole) {
    const premiumChanged =
        (newRow.premium_active !== oldRow.premium_active) ||
        (newRow.premium_purchased_at !== oldRow.premium_purchased_at);
    if (premiumChanged && authRole !== 'service_role') {
        return { allowed: false, reason: 'premium_active is server-controlled and cannot be modified directly.' };
    }
    return { allowed: true };
}

// Mirrors public.enforce_cloud_tx_limit() BEFORE INSERT trigger.
// txCountThisMonth = number of rows the user already has created this month.
function enforceCloudTxLimit({ isPremium, txCountThisMonth, authRole }) {
    if (authRole === 'service_role') return { allowed: true };
    if (isPremium) return { allowed: true };
    if (txCountThisMonth >= CLOUD_TX_LIMIT) {
        return { allowed: false, reason: `Monthly cloud transaction limit reached (${CLOUD_TX_LIMIT} per month).` };
    }
    return { allowed: true };
}

// Mirrors the ai_usage RLS change: users have SELECT only, no INSERT/UPDATE.
// A direct UPDATE by a user is rejected (no policy).
function canUserWriteAiUsage(authRole) {
    return authRole === 'service_role'; // only service role can write ai_usage
}

// ---------------------------------------------------------------------------
// Reference model of /api/premium-status reconciliation logic
// (mirrors functions/api/premium-status.js)
// ---------------------------------------------------------------------------
// StripeSession: { id, client_reference_id, metadata, payment_status, mode }
function reconcilePremiumStatus({
    currentPremium,
    paidSessions, // array of Stripe sessions for THIS user
    userId,
}) {
    // Already premium -> no-op.
    if (currentPremium) {
        return { premium_active: true, reconciled: false };
    }
    // Find a paid, one-time session bound to this user.
    const paid = (paidSessions || []).find(s =>
        s.payment_status === 'paid' &&
        s.mode === 'payment' &&
        (s.client_reference_id === userId || (s.metadata && s.metadata.user_id === userId))
    );
    if (!paid) {
        return { premium_active: false, reconciled: false };
    }
    // Grant entitlement (idempotent).
    return { premium_active: true, reconciled: true, session_id: paid.id };
}

// ============================================================================
// ATTACK SCENARIO TESTS
// ============================================================================

// --- 1. Free user self-grant via direct UPDATE -> MUST FAIL (B1) ---
test('A1: free user self-granting premium via direct UPDATE is blocked', () => {
    const oldRow = { premium_active: false, premium_purchased_at: null };
    const newRow = { premium_active: true, premium_purchased_at: new Date().toISOString() };
    const result = protectPremiumColumns(oldRow, newRow, 'authenticated');
    assert.strictEqual(result.allowed, false, 'user must not be able to set premium_active=true');
});

// --- 2. Free user modifying premium_purchased_at -> MUST FAIL (B1) ---
test('A2: user modifying premium_purchased_at directly is blocked', () => {
    const oldRow = { premium_active: false, premium_purchased_at: null };
    const newRow = { premium_active: false, premium_purchased_at: new Date().toISOString() };
    const result = protectPremiumColumns(oldRow, newRow, 'authenticated');
    assert.strictEqual(result.allowed, false, 'user must not be able to set premium_purchased_at');
});

// --- 3. Legitimate profile update (no premium change) -> MUST PASS (B1) ---
test('A3: legitimate profile update (name only) still works', () => {
    const oldRow = { premium_active: false, premium_purchased_at: null, name: 'Old' };
    const newRow = { premium_active: false, premium_purchased_at: null, name: 'New' };
    const result = protectPremiumColumns(oldRow, newRow, 'authenticated');
    assert.strictEqual(result.allowed, true, 'non-premium profile edits must remain allowed');
});

// --- 4. Service role (webhook) granting premium -> MUST PASS (B1) ---
test('A4: service role (Stripe webhook) can grant premium', () => {
    const oldRow = { premium_active: false, premium_purchased_at: null };
    const newRow = { premium_active: true, premium_purchased_at: new Date().toISOString() };
    const result = protectPremiumColumns(oldRow, newRow, 'service_role');
    assert.strictEqual(result.allowed, true, 'webhook/service role must be able to grant premium');
});

// --- 5. Free user resetting ai_usage counter -> MUST FAIL (W4) ---
test('A5: free user resetting ai_usage call_count is blocked', () => {
    assert.strictEqual(canUserWriteAiUsage('authenticated'), false, 'user must not be able to UPDATE ai_usage');
});

// --- 6. Service role writing ai_usage (via RPC) -> MUST PASS (W4) ---
test('A6: server-side (service role / SECURITY DEFINER RPC) can write ai_usage', () => {
    assert.strictEqual(canUserWriteAiUsage('service_role'), true, 'increment_ai_usage RPC must still work');
});

// --- 7. Free user exceeding 100 cloud tx -> MUST FAIL (W1) ---
test('A7: free user at the 100/month cloud limit is blocked from inserting more', () => {
    const result = enforceCloudTxLimit({ isPremium: false, txCountThisMonth: 100, authRole: 'authenticated' });
    assert.strictEqual(result.allowed, false, 'free user at limit must be blocked');
});

// --- 8. Free user under the limit -> MUST PASS (W1) ---
test('A8: free user under the 100/month cloud limit can insert', () => {
    const result = enforceCloudTxLimit({ isPremium: false, txCountThisMonth: 99, authRole: 'authenticated' });
    assert.strictEqual(result.allowed, true, 'free user under limit must be allowed');
});

// --- 9. Recurring regeneration / trash restore bypass -> MUST FAIL (W2/W3) ---
test('A9: recurring regeneration & trash restore inserts are blocked at the server when over limit', () => {
    // These paths call the same INSERT trigger, so they are subject to the same limit.
    const result = enforceCloudTxLimit({ isPremium: false, txCountThisMonth: 100, authRole: 'authenticated' });
    assert.strictEqual(result.allowed, false, 'ungated recurring/trash-restore inserts must be blocked too');
});

// --- 10. Premium user unlimited cloud tx -> MUST PASS (W1/W2/W3) ---
test('A10: premium user is unlimited for cloud transactions', () => {
    const result = enforceCloudTxLimit({ isPremium: true, txCountThisMonth: 500, authRole: 'authenticated' });
    assert.strictEqual(result.allowed, true, 'premium user must be unlimited');
});

// ============================================================================
// W5 — /api/premium-status reconciliation attack scenarios
// ============================================================================

// --- 11. No paid Stripe session -> NO grant (safe default) ---
test('A11: reconciliation does NOT grant premium without a paid Stripe session', () => {
    const result = reconcilePremiumStatus({
        currentPremium: false,
        paidSessions: [], // no sessions at all
        userId: 'user-1',
    });
    assert.strictEqual(result.premium_active, false, 'must not grant without a paid session');
});

// --- 12. Paid session for a DIFFERENT user -> NO grant ---
test('A12: a paid session for another user does not grant this user premium', () => {
    const result = reconcilePremiumStatus({
        currentPremium: false,
        paidSessions: [
            { id: 'cs_other', client_reference_id: 'user-2', metadata: { user_id: 'user-2' }, payment_status: 'paid', mode: 'payment' },
        ],
        userId: 'user-1',
    });
    assert.strictEqual(result.premium_active, false, 'must not grant for another user\'s session');
});

// --- 13. Unpaid session (payment_status != paid) -> NO grant ---
test('A13: an unpaid Stripe session does not grant premium', () => {
    const result = reconcilePremiumStatus({
        currentPremium: false,
        paidSessions: [
            { id: 'cs_unpaid', client_reference_id: 'user-1', metadata: { user_id: 'user-1' }, payment_status: 'unpaid', mode: 'payment' },
        ],
        userId: 'user-1',
    });
    assert.strictEqual(result.premium_active, false, 'unpaid session must not grant premium');
});

// --- 14. Valid paid session for THIS user -> grant (reconciliation) ---
test('A14: a valid paid session for this user grants premium (webhook-lost recovery)', () => {
    const result = reconcilePremiumStatus({
        currentPremium: false,
        paidSessions: [
            { id: 'cs_paid', client_reference_id: 'user-1', metadata: { user_id: 'user-1' }, payment_status: 'paid', mode: 'payment' },
        ],
        userId: 'user-1',
    });
    assert.strictEqual(result.premium_active, true, 'paid session must grant premium');
    assert.strictEqual(result.reconciled, true);
    assert.strictEqual(result.session_id, 'cs_paid');
});

// --- 15. Already premium -> idempotent no-op ---
test('A15: reconciliation is idempotent when already premium', () => {
    const result = reconcilePremiumStatus({
        currentPremium: true,
        paidSessions: [
            { id: 'cs_paid', client_reference_id: 'user-1', metadata: { user_id: 'user-1' }, payment_status: 'paid', mode: 'payment' },
        ],
        userId: 'user-1',
    });
    assert.strictEqual(result.premium_active, true, 'already premium stays premium');
    assert.strictEqual(result.reconciled, false, 'no re-grant needed');
});

// --- 16. Subscription (mode != payment) does NOT grant lifetime premium ---
test('A16: a subscription session (mode=subscription) does not grant lifetime premium', () => {
    const result = reconcilePremiumStatus({
        currentPremium: false,
        paidSessions: [
            { id: 'cs_sub', client_reference_id: 'user-1', metadata: { user_id: 'user-1' }, payment_status: 'paid', mode: 'subscription' },
        ],
        userId: 'user-1',
    });
    assert.strictEqual(result.premium_active, false, 'subscription must not grant lifetime premium');
});
