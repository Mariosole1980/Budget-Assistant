// Check whether transactions have recurring_template_id populated in the DB
async function run() {
    const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
    const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';

    // Count transactions with recurring_template_id set
    const res = await fetch(`${url}/transactions?select=id,recurring_template_id,amount,type,category&recurring_template_id=not.is.null&limit=20`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log('=== TXS WITH recurring_template_id SET ===');
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Count:', Array.isArray(data) ? data.length : JSON.stringify(data).substring(0, 300));
    if (Array.isArray(data)) {
        data.forEach(t => console.log('-', t.id, '| template:', t.recurring_template_id, '| amt:', t.amount, '| type:', t.type, '| cat:', t.category));
    }

    // Also check recurring_templates table
    const res2 = await fetch(`${url}/recurring_templates?select=id,amount,type,category&limit=20`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log('\n=== RECURRING TEMPLATES ===');
    console.log('Status:', res2.status);
    const data2 = await res2.json();
    console.log('Count:', Array.isArray(data2) ? data2.length : JSON.stringify(data2).substring(0, 300));
    if (Array.isArray(data2)) {
        data2.forEach(t => console.log('-', t.id, '| amt:', t.amount, '| type:', t.type, '| cat:', t.category));
    }
}
run().catch(e => { console.error(e); process.exit(1); });
