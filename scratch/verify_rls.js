const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co';
const anonKey = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';

async function testColumn(tableName, columnName) {
  try {
    const res = await fetch(`${url}/rest/v1/${tableName}?select=${columnName}&limit=1`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    console.log(`Checking column "${columnName}" in table "${tableName}"... Status: ${res.status}`);
    if (res.status === 200) {
      console.log(`✅ PASS: Column "${columnName}" exists in table "${tableName}".`);
      return true;
    } else {
      const errText = await res.text();
      console.log(`❌ FAIL: Status is not 200 (${res.status}). Response: ${errText}`);
      return false;
    }
  } catch (err) {
    console.error(`Failed to check table ${tableName}:`, err);
    return false;
  }
}

async function verify() {
  console.log('1. Testing anonymous query to check RLS (Should return 0 rows)...');
  try {
    const res = await fetch(`${url}/rest/v1/categories?select=*`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    const data = await res.json();
    console.log(`Anonymous categories query status: ${res.status}`);
    console.log(`Anonymous categories query results count: ${data.length}`);
    if (data.length === 0) {
      console.log('✅ PASS: Anonymous read returned 0 rows (RLS is active!).');
    } else {
      console.log('❌ FAIL: Anonymous read returned data. RLS might not be active or public policies exist!');
    }
  } catch (err) {
    console.error('Failed to query categories anonymously:', err);
  }

  console.log('\n2. Checking column existence for tenant isolation...');
  await testColumn('categories', 'user_id');
  await testColumn('accounts', 'user_id');
  await testColumn('transactions', 'user_id');
}

verify();
