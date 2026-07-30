async function checkJune() {
    const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
    const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';

    // Known IDs
    const mariosHotmail = 'c13f513d-b588-472b-86f8-2f5c1227dd13';
    const vasoulaOutlook = 'baf8e582-e1af-406a-b17d-8cca658ad320';
    const vasoulaGmail = 'ec86b3d5-eb23-4ecd-bb0e-43f434428138';

    // Check profiles first
    const pRes = await fetch(`${url}/profiles?select=email,family_id,partner_id,role`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const profiles = await pRes.json();
    console.log('\n=== PROFILES ΤΩΡΑ ===');
    profiles.filter(p => ['marios.ko@hotmail.com','tsaroucha.vasiliki@outlook.com','vasoula199700@gmail.com'].includes(p.email))
            .forEach(p => console.log(`${p.email}: family=${p.family_id?.slice(0,8)||'NULL'} partner=${p.partner_id?.slice(0,8)||'NULL'} role=${p.role}`));

    // Get all June transactions for all 3 relevant users (using anon key - RLS applies)
    for (const [name, uid] of [['Marios Hotmail', mariosHotmail], ['Vasoula Outlook', vasoulaOutlook], ['Vasoula Gmail', vasoulaGmail]]) {
        const r = await fetch(`${url}/transactions?select=id,date,amount,category,note,family_id&user_id=eq.${uid}&date=gte.2026-06-01&order=date.asc`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        const txs = await r.json();
        console.log(`\n=== ${name} - Ιούνιος 2026 (${txs.length} εγγραφές) ===`);
        if (Array.isArray(txs)) {
            txs.forEach(t => console.log(`  ${t.date} | ${t.amount > 0 ? '+' : ''}${t.amount} | ${t.category} | family=${t.family_id?.slice(0,8)||'NULL'}`));
        } else {
            console.log('  Error or no access:', JSON.stringify(txs));
        }
    }
}
checkJune().catch(console.error);
