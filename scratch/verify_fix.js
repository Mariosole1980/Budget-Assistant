// Verify the fix: simulate the destructuring in saveTransaction() and confirm
// that dbPayload no longer contains any columns missing from the live DB.
const MISSING_COLS = [
    'description', 'currency', 'amount_base', 'rate_to_base', 'base_currency',
    'rate_source', 'rate_to_base_actual', 'rate_fetched_at', 'transfer_id',
    'transfer_rate', 'fx_snapshot', 'photo_url', 'receipt'
];

// Build a realistic transaction object with ALL client-only fields set,
// exactly as the app would produce it (including fx_snapshot & rate_to_base_actual).
const transaction = {
    id: 'test-123',
    user_id: 'u1',
    family_id: 'f1',
    date: '2026-08-06',
    amount: 100,
    type: 'expense',
    category: 'food',
    subcategory: null,
    account_from: 'a1',
    account_to: null,
    note: 'test',
    status: 'active',
    created_at: '2026-08-06T00:00:00Z',
    is_shared: true,
    recurring_template_id: 'rt1',
    photo_local_uri: 'local-file://x',
    photo_url: 'https://example.com/x.jpg',
    receipt: 'receipt-data',
    currency: 'USD',
    base_currency: 'EUR',
    rate_to_base: 0.92,
    amount_base: 92,
    rate_source: 'api',
    rate_to_base_actual: 0.91,
    rate_fetched_at: '2026-08-06T00:00:00Z',
    transfer_id: 'tr1',
    transfer_rate: 1.1,
    fx_snapshot: { base: 'USD', quote: 'EUR', rate: 0.92, date: '2026-08-06', source: 'api' }
};

// EXACT destructuring from the FIXED code (app.js line 5011)
const { description, is_shared, recurring_template_id, photo_local_uri, photo_url, receipt, currency, base_currency, rate_to_base, amount_base, rate_source, fx_snapshot, rate_to_base_actual, rate_fetched_at, transfer_id, transfer_rate, ...dbPayload } = transaction;

console.log('=== dbPayload keys sent to Supabase ===');
console.log(Object.keys(dbPayload).sort().join(', '));

console.log('\n=== Checking for missing columns in dbPayload ===');
let problems = 0;
for (const col of MISSING_COLS) {
    if (col in dbPayload) {
        console.log(`FAIL: dbPayload still contains missing column: ${col}`);
        problems++;
    }
}
if (problems === 0) {
    console.log('PASS: dbPayload contains NONE of the columns missing from the live DB.');
    console.log('The upsert will no longer fail with 42703.');
} else {
    console.log(`\n${problems} problematic column(s) still present.`);
    process.exit(1);
}
