/**
 * check_schema.js
 * Checks if recurring_template_id column exists in transactions table
 */
const https = require('https');

const SUPABASE_URL = 'https://nnatvvahoeiemkfmzpwp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';

function supabaseGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch(e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== SCHEMA CHECK ===\n');
  
  // Check by trying to filter on recurring_template_id
  const res = await supabaseGet('/rest/v1/transactions?select=id,recurring_template_id&limit=1&recurring_template_id=not.is.null');
  console.log('Status:', res.status);
  if (res.status === 400 || (res.status === 200 && Array.isArray(res.data))) {
    if (res.status === 400) {
      console.log('ERROR (column likely missing):', JSON.stringify(res.data));
    } else {
      console.log('Column EXISTS - returned:', JSON.stringify(res.data));
    }
  } else {
    console.log('Response:', JSON.stringify(res.data).substring(0, 500));
  }

  // Also check is_shared  
  const res2 = await supabaseGet('/rest/v1/transactions?select=id,is_shared&limit=1&is_shared=not.is.null');
  console.log('\nis_shared column check - Status:', res2.status);
  if (res2.status === 400) {
    console.log('ERROR (is_shared likely missing):', JSON.stringify(res2.data));
  } else {
    console.log('is_shared EXISTS - returned:', JSON.stringify(res2.data));
  }
  
  // Also check family_id
  const res3 = await supabaseGet('/rest/v1/transactions?select=id,family_id&limit=1&family_id=not.is.null');
  console.log('\nfamily_id column check - Status:', res3.status);
  if (res3.status === 400) {
    console.log('ERROR (family_id likely missing):', JSON.stringify(res3.data));
  } else {
    console.log('family_id EXISTS - returned:', JSON.stringify(res3.data));
  }
}

main().catch(console.error);
