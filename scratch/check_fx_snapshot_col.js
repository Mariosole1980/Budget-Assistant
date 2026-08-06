// Check if fx_snapshot column exists in transactions table
async function run() {
    const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
    const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';

    // Try selecting fx_snapshot - if column missing, PostgREST returns 400
    const res = await fetch(`${url}/transactions?select=id,fx_snapshot&limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log('fx_snapshot select status:', res.status);
    const body = await res.text();
    console.log('Body:', body.substring(0, 500));

    // Also check the other currency columns exist
    const res2 = await fetch(`${url}/transactions?select=id,currency,amount_base,rate_to_base,base_currency,rate_source&limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log('\ncurrency cols select status:', res2.status);
    const body2 = await res2.text();
    console.log('Body:', body2.substring(0, 500));
}
run().catch(e => { console.error(e); process.exit(1); });
