// Fix profiles directly via REST API (RLS allows self-update or anon updates depending on policy)
async function fixProfiles() {
    const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
    const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';
    const familyId       = '22b1ff59-f407-4bdb-8506-46a59466e9ad';
    const mariosGmailId  = '6b57d05e-da24-4ad9-96f0-ca96d3c8ef8a';
    const vasoulaId      = 'ec86b3d5-eb23-4ecd-bb0e-43f434428138';

    console.log('Step 1: Fixing Marios Gmail profile -> add to family...');
    const r1 = await fetch(`${url}/profiles?id=eq.${mariosGmailId}`, {
        method: 'PATCH',
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ family_id: familyId, partner_id: vasoulaId, role: 'admin' })
    });
    console.log('Status:', r1.status, await r1.text());

    console.log('Step 2: Check new profile state...');
    const r2 = await fetch(`${url}/profiles?select=id,email,family_id,partner_id,role`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const profiles = await r2.json();
    profiles.forEach(p => console.log(p.email, '| family:', p.family_id?.slice(0,8) || 'NULL', '| partner:', p.partner_id?.slice(0,8) || 'NULL'));
}

fixProfiles().catch(console.error);
