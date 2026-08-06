// List actual columns of transactions table via OpenAPI schema
async function run() {
    const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co';
    const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';

    // Fetch the OpenAPI spec to see actual columns
    const res = await fetch(`${url}/rest/v1/`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Accept': 'application/openapi+json' }
    });
    const spec = await res.json();
    const txSchema = spec.components && spec.components.schemas && spec.components.schemas.transactions;
    if (txSchema && txSchema.properties) {
        console.log('=== TRANSACTIONS TABLE COLUMNS ===');
        Object.keys(txSchema.properties).forEach(c => console.log('-', c));
    } else {
        console.log('Could not parse schema. Status:', res.status);
        console.log(JSON.stringify(spec).substring(0, 1000));
    }
}
run().catch(e => { console.error(e); process.exit(1); });
