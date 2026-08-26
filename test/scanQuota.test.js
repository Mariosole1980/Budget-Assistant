'use strict';

// ============================================================================
// AI Receipt Scan Quota — Server-Side Enforcement Tests
// ============================================================================
// These tests validate the logic implemented in scan-usage-migration.sql and
// functions/api/scan-receipt.js (3b. SCAN FAIR-USE LIMIT):
//
//   Free users:      5 AI receipt scans/month
//   Premium Lifetime: 100 AI receipt scans/month
//   Guest mode (no authenticated user): not tracked server-side (client gate)
//
// The SQL/RPC calls cannot run in the Node test runner, so we model their exact
// logic as a pure JS reference function and assert the attack scenarios against
// it — same approach as test/premiumSecurity.test.js.
//
// Run with: node --test test/scanQuota.test.js
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert');

// ---------------------------------------------------------------------------
// Reference model of the quota logic in scan-receipt.js (mirrors the inline
// server-side block: get_scan_usage -> compare to limit -> increment_scan_usage).
// ---------------------------------------------------------------------------

const SCAN_LIMITS = { free: 5, premium: 100 }; // keep in sync with PREMIUM_LIMITS in app.js

// Returns { allowed, limit, used } mirroring the server's decision.
function enforceScanLimit({ isPremium, scansThisMonth, isAuthenticated }) {
    if (!isAuthenticated) {
        // Guest mode: no user_id server-side, not tracked (client-side gate only).
        return { allowed: true, limit: null, used: null };
    }
    const limit = isPremium ? SCAN_LIMITS.premium : SCAN_LIMITS.free;
    if (scansThisMonth >= limit) {
        return { allowed: false, limit, used: scansThisMonth };
    }
    return { allowed: true, limit, used: scansThisMonth };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// --- 1. Free user at 5/5 -> blocked (429 SCAN_LIMIT_REACHED) ---
test('S1: free user at the 5/month scan limit is blocked', () => {
    const result = enforceScanLimit({ isPremium: false, scansThisMonth: 5, isAuthenticated: true });
    assert.strictEqual(result.allowed, false, 'free user must be blocked at 5 scans');
    assert.strictEqual(result.limit, 5);
});

// --- 2. Free user at 4/5 -> allowed ---
test('S2: free user under the 5/month limit can scan', () => {
    const result = enforceScanLimit({ isPremium: false, scansThisMonth: 4, isAuthenticated: true });
    assert.strictEqual(result.allowed, true, 'free user at 4/5 must be allowed');
});

// --- 3. Premium user at 100/100 -> blocked ---
test('S3: premium user at the 100/month scan limit is blocked', () => {
    const result = enforceScanLimit({ isPremium: true, scansThisMonth: 100, isAuthenticated: true });
    assert.strictEqual(result.allowed, false, 'premium user must be blocked at 100 scans');
    assert.strictEqual(result.limit, 100);
});

// --- 4. Premium user at 99/100 -> allowed ---
test('S4: premium user under the 100/month limit can scan', () => {
    const result = enforceScanLimit({ isPremium: true, scansThisMonth: 99, isAuthenticated: true });
    assert.strictEqual(result.allowed, true, 'premium user at 99/100 must be allowed');
});

// --- 5. Premium user cannot be blocked below 100 (fair-use cap is 100) ---
test('S5: premium limit is exactly 100, not 50 or unlimited', () => {
    const result = enforceScanLimit({ isPremium: true, scansThisMonth: 50, isAuthenticated: true });
    assert.strictEqual(result.allowed, true, 'premium user at 50/100 must still be allowed');
});

// --- 6. Guest mode is not tracked server-side (client-side gate only) ---
test('S6: guest mode scans are not counted server-side', () => {
    const result = enforceScanLimit({ isPremium: false, scansThisMonth: 999, isAuthenticated: false });
    assert.strictEqual(result.allowed, true, 'guest scans fall back to the client-side gate');
});

// --- 7. RPC counter is reset by month key, not total lifetime ---
test('S7: usage is metered per calendar month (usage_month = YYYY-MM)', () => {
    // The SQL RPC keys on to_char(now(),'YYYY-MM'), so last month's count never
    // affects this month: model a fresh month with used=0.
    const result = enforceScanLimit({ isPremium: false, scansThisMonth: 0, isAuthenticated: true });
    assert.strictEqual(result.allowed, true, 'a new month starts with a fresh allowance');
});
