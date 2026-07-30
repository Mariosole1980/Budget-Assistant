// diagnose_duplicates.js - Ελέγχει για duplicate transactions στη DB
const https = require('https');

const SUPABASE_URL = 'https://nnatvvahoeiemkfmzpwp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';
const FAMILY_ID = '22b1ff59-0000-0000-0000-000000000000';

function supabaseRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== DUPLICATE TRANSACTION DIAGNOSTICS ===\n');

  // Fetch all transactions for the family
  const res = await supabaseRequest(
    `/rest/v1/transactions?select=id,user_id,date,amount,type,category,account_from,account_to,note,created_at&family_id=eq.${FAMILY_ID}&order=date.desc&limit=2000`
  );

  if (res.status !== 200) {
    console.log('ERROR fetching transactions:', res.status, res.data);
    return;
  }

  const transactions = res.data;
  console.log(`Total transactions in DB for family: ${transactions.length}`);

  // Group by content key (WITHOUT user_id) to find cross-user duplicates
  const crossUserGroups = {};
  transactions.forEach(t => {
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const amount = parseFloat(t.amount) || 0;
    const key = `${datePart}|${amount.toFixed(2)}|${t.type||''}|${t.category||''}|${t.account_from||''}|${t.account_to||''}|${t.note||''}`;
    if (!crossUserGroups[key]) crossUserGroups[key] = [];
    crossUserGroups[key].push(t);
  });

  const crossUserDupes = Object.entries(crossUserGroups).filter(([k, list]) => {
    // Only flag if there are multiple records AND they have DIFFERENT user_ids
    if (list.length < 2) return false;
    const userIds = [...new Set(list.map(t => t.user_id))];
    return userIds.length > 1;
  });

  console.log(`\nCross-user duplicates (same content, different user_id): ${crossUserDupes.length}`);
  if (crossUserDupes.length > 0) {
    crossUserDupes.slice(0, 10).forEach(([key, list]) => {
      console.log(`\n  Key: ${key}`);
      list.forEach(t => console.log(`    - id=${t.id}, user_id=${t.user_id}, created_at=${t.created_at}`));
    });
  }

  // Group by content key WITH user_id to find same-user duplicates
  const sameUserGroups = {};
  transactions.forEach(t => {
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const amount = parseFloat(t.amount) || 0;
    const key = `${t.user_id}|${datePart}|${amount.toFixed(2)}|${t.type||''}|${t.category||''}|${t.account_from||''}|${t.account_to||''}|${t.note||''}`;
    if (!sameUserGroups[key]) sameUserGroups[key] = [];
    sameUserGroups[key].push(t);
  });

  const sameUserDupes = Object.entries(sameUserGroups).filter(([k, list]) => list.length > 1);
  console.log(`\nSame-user duplicates (identical content + same user_id): ${sameUserDupes.length}`);
  if (sameUserDupes.length > 0) {
    sameUserDupes.slice(0, 10).forEach(([key, list]) => {
      console.log(`\n  Key: ${key}`);
      list.forEach(t => console.log(`    - id=${t.id}, created_at=${t.created_at}`));
    });
  }

  // Count by user
  const byUser = {};
  transactions.forEach(t => {
    byUser[t.user_id] = (byUser[t.user_id] || 0) + 1;
  });
  console.log('\nTransactions per user_id:');
  Object.entries(byUser).forEach(([uid, count]) => {
    console.log(`  ${uid}: ${count} transactions`);
  });

  // Show most recent 5
  console.log('\nMost recent 5 transactions:');
  transactions.slice(0, 5).forEach(t => {
    console.log(`  [${t.date}] ${t.type} ${t.amount} ${t.category} uid=${t.user_id?.substring(0,8)}...`);
  });
}

main().catch(console.error);
