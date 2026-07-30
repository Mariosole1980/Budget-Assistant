const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';

async function searchEnfia() {
    console.log('--- SEARCHING RECURRING TEMPLATES ---');
    const tRes = await fetch(`${url}/recurring_templates?select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const templates = await tRes.json();
    console.log('Templates found:', templates.length);
    templates.filter(t => (t.note || '').toLowerCase().includes('ενφια') || (t.category || '').toLowerCase().includes('ενφια')).forEach(t => console.log('TEMPLATE:', t));

    console.log('\n--- SEARCHING ACTIVE TRANSACTIONS ---');
    const txRes = await fetch(`${url}/transactions?select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const txs = await txRes.json();
    console.log('Active transactions found:', txs.length);
    txs.filter(t => (t.note || '').toLowerCase().includes('ενφια') || (t.subcategory || '').toLowerCase().includes('ενφια')).forEach(t => console.log('TX:', t.id, t.date, t.amount, t.note, t.category, t.subcategory));

    console.log('\n--- SEARCHING DELETED TRANSACTIONS TABLE ---');
    const delRes = await fetch(`${url}/deleted_transactions?select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const delTxs = await delRes.json();
    console.log('Deleted transactions found:', delTxs.length);
    delTxs.filter(t => (t.note || '').toLowerCase().includes('ενφια') || (t.subcategory || '').toLowerCase().includes('ενφια')).forEach(t => console.log('DEL TX:', t.id, t.date, t.amount, t.note, t.category, t.subcategory));
}

searchEnfia().catch(console.error);
