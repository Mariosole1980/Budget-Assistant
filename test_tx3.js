const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkTransactions() {
    const { data: profiles, error: err1 } = await supabase.from('profiles').select('*');
    console.log("Profiles:", profiles);

    const { data: transactions, error: err2 } = await supabase.from('transactions').select('*');
    console.log("Transactions:", transactions?.length);
    
    if (transactions && transactions.length > 0) {
        console.log("Sample tx:", transactions[0]);
    }
}
checkTransactions();
