async function run() {
    const url = 'https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1';
    const key = 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';
    const mariosIds = [
        '6b57d05e-da24-4ad9-96f0-ca96d3c8ef8a', // Gmail
        'c13f513d-b588-472b-86f8-2f5c1227dd13'  // Hotmail
    ];
    
    // We cannot query Supabase without a JWT because of RLS.
    // Wait, earlier my test script (test_tx6) got NO transactions.
    // I need to bypass RLS to read transactions. 
    // Is there a way? I have a node script with postgres credentials in database_cleanup.sql maybe?
}
