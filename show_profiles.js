async function diagnose() {
    const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
    const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';

    const res = await fetch(`${url}/profiles?select=id,email,family_id,partner_id,role`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const profiles = await res.json();
    console.log('\n=== ΟΛΑ ΤΑ PROFILES ===');
    profiles.forEach(p => {
        console.log(`\nEmail:     ${p.email}`);
        console.log(`ID:        ${p.id}`);
        console.log(`Family:    ${p.family_id || 'NULL'}`);
        console.log(`Partner:   ${p.partner_id || 'NULL'}`);
        console.log(`Role:      ${p.role}`);
    });
}
diagnose().catch(console.error);
