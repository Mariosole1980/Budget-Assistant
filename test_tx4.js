const dotenv = require('dotenv');
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

async function checkTransactions() {
    try {
        console.log("Fetching profiles...");
        const pRes = await fetch(`${url}/rest/v1/profiles?select=*`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        const profiles = await pRes.json();
        console.log("Profiles:", profiles);

        console.log("Fetching transactions...");
        const tRes = await fetch(`${url}/rest/v1/transactions?select=*&limit=50&order=created_at.desc`, {
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
