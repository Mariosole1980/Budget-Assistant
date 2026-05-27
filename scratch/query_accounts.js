const https = require('https');

const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1/accounts';
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
    console.log("ALL ACCOUNTS:");
    console.log(JSON.stringify(JSON.parse(body), null, 2));
  });
}).on('error', (e) => {
  console.error("Error:", e);
});
