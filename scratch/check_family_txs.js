const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';

async function fetchFamilyTx() {
    const familyId = '22b1ff59-f407-4bdb-8506-46a59466e9ad';
    
    // 1. Fetch transactions by family_id
    const res = await fetch(`${url}/transactions?family_id=eq.${familyId}&select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const txs = await res.json();
    console.log('Transactions fetched by family_id:', txs.length);
    if (Array.isArray(txs)) {
        txs.slice(0, 20).forEach(t => console.log(`[${t.date}] ${t.note || t.category} | ${t.amount}€ | cat: ${t.category} | sub: ${t.subcategory} | account: ${t.account_from}`));
    } else {
        console.log('Error/Response:', txs);
    }

    // 2. Fetch all transactions without filter
    const res2 = await fetch(`${url}/transactions?select=*&limit=50`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const txs2 = await res2.json();
    console.log('\nTransactions fetched without filter:', txs2.length);
    if (Array.isArray(txs2)) {
        txs2.slice(0, 20).forEach(t => console.log(`[${t.date}] ${t.note || t.category} | ${t.amount}€ | cat: ${t.category} | user: ${t.user_id}`));
    }
}

fetchFamilyTx().catch(console.error);
