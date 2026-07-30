async function checkTransactions() {
    const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
    const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';
    try {
        console.log("Fetching profiles...");
        const pRes = await fetch(`${url}/profiles?select=*`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        const profiles = await pRes.json();
        console.log("Profiles:", profiles);

        console.log("Fetching transactions limit 50...");
        const tRes = await fetch(`${url}/transactions?select=*&limit=50&order=created_at.desc`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        const transactions = await tRes.json();
        console.log("Transactions count:", transactions?.length);
        if (transactions && transactions.length > 0) {
            console.log("Sample tx:", transactions[0]);
        }
    } catch(e) { console.error(e); }
}
checkTransactions();
