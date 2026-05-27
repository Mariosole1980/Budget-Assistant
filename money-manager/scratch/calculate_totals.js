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
      
      const yearly = {};
      txs.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        const year = t.date ? t.date.split('-')[0] : 'No Date';
        if (!yearly[year]) {
          yearly[year] = { income: 0, expense: 0, net: 0, count: 0 };
        }
        yearly[year].count++;
        if (t.type === 'income') {
          yearly[year].income += amt;
          yearly[year].net += amt;
        } else if (t.type === 'expense') {
          yearly[year].expense += amt;
          yearly[year].net -= amt;
        }
      });
      
      console.log("YEARLY BREAKDOWN:");
      console.log(JSON.stringify(yearly, null, 2));
    } catch(e) {
      console.error("Parse error:", e);
    }
  });
}).on('error', (e) => {
  console.error("Error:", e);
});
