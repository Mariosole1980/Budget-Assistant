async function testUpdateProfile() {
    const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
    const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';
    
    // Test if we can update marios.ko@hotmail.com to have no family
    try {
        const res = await fetch(`${url}/profiles?email=eq.marios.ko@hotmail.com`, {
            method: 'PATCH',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ family_id: null, partner_id: null })
        });
        console.log("Status:", res.status);
        const data = await res.json();
        console.log("Data:", data);
    } catch(e) {
        console.error(e);
    }
}
testUpdateProfile();
