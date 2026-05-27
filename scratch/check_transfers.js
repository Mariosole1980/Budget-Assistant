const https = require('https');

const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1/transactions?user_id=eq.c13f513d-b588-472b-86f8-2f5c1227dd13';
const options = {
  headers: {
    'apikey': 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp',
    'Authorization': 'Bearer sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp'
  }
};

https.get(url, options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const txs = JSON.parse(body);
      console.log(`TOTAL TRANSACTIONS: ${txs.length}`);
      
      const transfers = txs.filter(t => {
        const cat = (t.category || '').toLowerCase();
        const sub = (t.subcategory || '').toLowerCase();
        return cat.includes('μεταφ') || cat.includes('transfer') || sub.includes('μεταφ') || sub.includes('transfer');
      });
      
      console.log(`TRANSACTIONS WITH TRANSFER CATEGORY: ${transfers.length}`);
      transfers.slice(0, 10).forEach((t, i) => {
        console.log(`${i+1}. Date: ${t.date} | AccountFrom: ${t.account_from} | AccountTo: ${t.account_to} | Category: ${t.category} | Type: ${t.type} | Amount: ${t.amount}`);
      });
    } catch(e) {
      console.error("Parse error:", e);
    }
  });
}).on('error', (e) => {
  console.error("Error:", e);
});
