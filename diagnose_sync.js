// Diagnostic script - read-only, no modifications
async function diagnose() {
    const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
    const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';

    const mariosGmailId  = '6b57d05e-da24-4ad9-96f0-ca96d3c8ef8a';
    const mariosHotmailId = 'c13f513d-b588-472b-86f8-2f5c1227dd13';
    const vasoulaId      = 'ec86b3d5-eb23-4ecd-bb0e-43f434428138';
    const familyId       = '22b1ff59-f407-4bdb-8506-46a59466e9ad';
    const thisMonth      = '2026-06';

    // 1. All profiles
    const pRes = await fetch(`${url}/profiles?select=id,email,family_id,partner_id,role`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const profiles = await pRes.json();
    console.log('\n=== PROFILES ===');
    profiles.forEach(p => console.log(p.email, '| family:', p.family_id, '| partner:', p.partner_id, '| role:', p.role));

    // 2. Transaction counts per user+family combination
    const tRes = await fetch(`${url}/transactions?select=user_id,family_id&date=gte.${thisMonth}-01`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const txs = await tRes.json();
    console.log('\n=== TRANSACTIONS THIS MONTH (all visible via anon key) ===');
    console.log('Total visible:', txs.length);
    
    const byUser = {};
    txs.forEach(t => {
        const key = `user:${t.user_id?.slice(0,8)}... family:${t.family_id?.slice(0,8) || 'NULL'}`;
        byUser[key] = (byUser[key] || 0) + 1;
    });
    Object.entries(byUser).forEach(([k,v]) => console.log(v, 'txs for', k));

    // 3. Look for duplicates: same date+amount+category+user
    const dupeRes = await fetch(`${url}/transactions?select=id,date,amount,category,user_id,family_id&date=gte.${thisMonth}-01`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const allTx = await dupeRes.json();
    
    const seen = {};
    const dupes = [];
    allTx.forEach(t => {
        const sig = `${t.date}_${t.amount}_${t.category}_${t.user_id}`;
        if (seen[sig]) {
            dupes.push({ original: seen[sig], duplicate: t });
        } else {
            seen[sig] = t;
        }
    });
    
    console.log('\n=== DUPLICATES THIS MONTH ===');
    console.log('Found:', dupes.length, 'potential duplicates');
    dupes.slice(0,10).forEach(d => {
        console.log(`ORIG:  id=${d.original.id.slice(0,8)} date=${d.original.date} amt=${d.original.amount} cat=${d.original.category} family=${d.original.family_id?.slice(0,8) || 'NULL'}`);
        console.log(`DUPL:  id=${d.duplicate.id.slice(0,8)} date=${d.duplicate.date} amt=${d.duplicate.amount} cat=${d.duplicate.category} family=${d.duplicate.family_id?.slice(0,8) || 'NULL'}`);
        console.log('---');
    });

    // 4. Marios Gmail transactions that have NO family_id
    const orphanRes = await fetch(`${url}/transactions?select=id,date,amount,category,user_id,family_id&user_id=eq.${mariosGmailId}&family_id=is.null`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const orphans = await orphanRes.json();
    console.log(`\n=== MARIOS GMAIL ORPHAN TRANSACTIONS (no family_id) ===`);
    console.log('Count:', orphans.length);
}

diagnose().catch(console.error);
