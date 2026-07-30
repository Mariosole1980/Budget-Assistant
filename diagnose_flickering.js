/**
 * diagnose_flickering.js
 * Checks the Supabase database for duplicates and total transaction counts
 * that could cause the "flickering numbers" bug.
 * Run: node diagnose_flickering.js
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
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ 
            status: res.statusCode, 
            data: JSON.parse(data),
            count: res.headers['content-range']
          });
        } catch(e) {
          resolve({ status: res.statusCode, data: data, count: null });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== FLICKERING DIAGNOSIS REPORT ===\n');

  // 1. Total transaction count
  const totalRes = await supabaseGet('/rest/v1/transactions?select=id,user_id,date,amount,type,category,account_from,account_to,note&order=date.desc&limit=2000');
  const allTrans = Array.isArray(totalRes.data) ? totalRes.data : [];
  console.log(`Total transactions fetched (max 2000): ${allTrans.length}`);
  console.log(`Content-Range header: ${totalRes.count}`);

  // 2. Group by user_id
  const byUser = {};
  allTrans.forEach(t => {
    const uid = t.user_id || 'unknown';
    byUser[uid] = (byUser[uid] || 0) + 1;
  });
  console.log('\nTransaction count by user_id:');
  Object.entries(byUser).forEach(([uid, cnt]) => {
    console.log(`  ${uid}: ${cnt} transactions`);
  });

  // 3. Check for true duplicates (same user_id + same key fields)
  console.log('\n--- DUPLICATE CHECK (same user_id) ---');
  const keyMap = {};
  const userDups = [];
  allTrans.forEach(t => {
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const key = `${t.user_id}|${datePart}|${(parseFloat(t.amount)||0).toFixed(2)}|${t.type}|${t.category}|${t.account_from}|${t.account_to}|${t.note||''}`;
    if (!keyMap[key]) {
      keyMap[key] = [];
    }
    keyMap[key].push(t.id);
  });
  let dupCount = 0;
  Object.entries(keyMap).forEach(([key, ids]) => {
    if (ids.length > 1) {
      dupCount++;
      userDups.push({ key, ids });
    }
  });
  console.log(`Found ${dupCount} duplicate groups (same user_id, same content)`);
  if (userDups.length > 0) {
    console.log('First 5 duplicates:');
    userDups.slice(0, 5).forEach(d => {
      const parts = d.key.split('|');
      console.log(`  user=${parts[0].substring(0,8)}... date=${parts[1]} amount=${parts[2]} type=${parts[3]} cat=${parts[4]}`);
      console.log(`    IDs: ${d.ids.join(', ')}`);
    });
  }

  // 4. Check for cross-user duplicates (different user_id, same content = family sync)
  console.log('\n--- CROSS-USER DUPLICATE CHECK (different user_id, same content) ---');
  const noUidMap = {};
  const crossDups = [];
  allTrans.forEach(t => {
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const key = `${datePart}|${(parseFloat(t.amount)||0).toFixed(2)}|${t.type}|${t.category}|${t.account_from}|${t.account_to}|${t.note||''}`;
    if (!noUidMap[key]) {
      noUidMap[key] = [];
    }
    noUidMap[key].push({ id: t.id, user_id: t.user_id });
  });
  let crossDupCount = 0;
  Object.entries(noUidMap).forEach(([key, entries]) => {
    const uniqueUsers = new Set(entries.map(e => e.user_id));
    if (uniqueUsers.size > 1) {
      crossDupCount++;
      crossDups.push({ key, entries });
    }
  });
  console.log(`Found ${crossDupCount} cross-user duplicate groups (same content, different users)`);
  if (crossDups.length > 0) {
    console.log('First 5 cross-user duplicates:');
    crossDups.slice(0, 5).forEach(d => {
      const parts = d.key.split('|');
      console.log(`  date=${parts[0]} amount=${parts[1]} type=${parts[2]} cat=${parts[3]}`);
      d.entries.forEach(e => console.log(`    user=${e.user_id.substring(0,8)}... id=${e.id}`));
    });
  }

  // 5. Realtime subscription — this is a browser-only thing, but check for the profile data
  console.log('\n--- PROFILE DATA CHECK ---');
  const profilesRes = await supabaseGet('/rest/v1/profiles?select=id,email,family_id&limit=10');
  if (Array.isArray(profilesRes.data)) {
    profilesRes.data.forEach(p => {
      console.log(`  ${p.email} -> family_id: ${p.family_id} (id: ${p.id ? p.id.substring(0,8) : 'N/A'}...)`);
    });
  } else {
    console.log('  Could not fetch profiles (RLS may be blocking):', JSON.stringify(profilesRes.data).substring(0, 200));
  }

  console.log('\n=== END OF DIAGNOSIS ===');
}

main().catch(console.error);
