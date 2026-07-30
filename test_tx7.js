async function insertTransaction() {
    const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
    const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';
    try {
        const payload = {
            id: '11111111-1111-1111-1111-111111111111',
            date: '2026-06-21',
            type: 'expense',
            amount: 10,
            category: 'test',
            account_from: 'Cash'
        };
        const res = await fetch(`${url}/transactions`, {
            method: 'POST',
            headers: { 
                'apikey': key, 
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
        });
        
        console.log("Status:", res.status, res.statusText);
        const data = await res.json();
        console.log("Response:", data);
    } catch(e) { console.error(e); }
}
insertTransaction();
