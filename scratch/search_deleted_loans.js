const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';

async function search() {
    // Fetch all active transactions from the database
    const res = await fetch(`${url}/transactions?select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const data = await res.json();
    console.log(`Total active transactions fetched: ${data.length}`);

    const filtered = data.filter(t => {
        const note = (t.note || '').toLowerCase();
        return note.includes('δανει') || note.includes('loan') || note.includes('δοση') || note.includes('δόση');
    });

    console.log(`Found ${filtered.length} matching active transactions:\n`);
    filtered.sort((a,b) => b.date.localeCompare(a.date)).forEach(t => {
        console.log(`ID: ${t.id} | Date: ${t.date} | Amount: ${t.amount} | Cat: ${t.category} | Sub: ${t.subcategory || 'None'} | Note: ${t.note} | User: ${t.user_id}`);
    });
}

search().catch(console.error);
