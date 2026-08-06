// Verify which columns exist in transactions table by probing each
async function run() {
    const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
    const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';

    const cols = [
        'id', 'user_id', 'family_id', 'date', 'amount', 'type', 'category', 'subcategory',
        'account_from', 'account_to', 'note', 'description', 'status', 'created_at',
        'is_shared', 'recurring_template_id', 'deleted_at', 'deleted_by',
        'currency', 'amount_base', 'rate_to_base', 'base_currency', 'rate_source',
        'rate_to_base_actual', 'rate_fetched_at', 'transfer_id', 'transfer_rate',
        'fx_snapshot', 'photo_url', 'receipt'
    ];

    for (const c of cols) {
        const res = await fetch(`${url}/transactions?select=id,${c}&limit=1`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        if (res.status === 400) {
            const body = await res.text();
            console.log(`MISSING: ${c} -> ${body.substring(0, 80)}`);
        } else {
            console.log(`EXISTS:  ${c} (status ${res.status})`);
        }
    }
}
run().catch(e => { console.error(e); process.exit(1); });
