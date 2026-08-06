// Diagnostic - read-only
async function run() {
    const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
    const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';

    // Latest 20 transactions regardless of date
    const tRes = await fetch(`${url}/transactions?select=id,date,amount,category,user_id,family_id,status,created_at&order=created_at.desc&limit=20`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const txs = await tRes.json();
    console.log('=== LATEST 20 TRANSACTIONS (anon key) ===');
    if (Array.isArray(txs)) {
        console.log('Count:', txs.length);
        txs.forEach(t => console.log(
            `id=${String(t.id).slice(0, 8)} date=${t.date} amt=${t.amount} cat=${t.category} user=${String(t.user_id || '').slice(0, 8)} family=${String(t.family_id || '').slice(0, 8)} status=${t.status} created=${t.created_at}`
        ));
    } else {
        console.log('Response:', JSON.stringify(txs));
    }

    // Count transactions per status
    const cRes = await fetch(`${url}/transactions?select=status`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const all = await cRes.json();
    if (Array.isArray(all)) {
        const byStatus = {};
        const byUser = {};
        all.forEach(t => {
            byStatus[t.status] = (byStatus[t.status] || 0) + 1;
            byUser[String(t.user_id || 'NULL').slice(0, 8)] = (byUser[String(t.user_id || 'NULL').slice(0, 8)] || 0) + 1;
        });
        console.log('\n=== ALL TRANSACTIONS BY STATUS ===');
        console.log(byStatus);
        console.log('\n=== ALL TRANSACTIONS BY USER ===');
        console.log(byUser);
        console.log('Total:', all.length);
    } else {
        console.log('Count response:', JSON.stringify(all));
    }
}
run().catch(e => { console.error(e); process.exit(1); });
