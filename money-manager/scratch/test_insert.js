const apiKey = "sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp";
const baseUrl = "https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1";

const headers = {
  "apikey": apiKey,
  "Authorization": `Bearer ${apiKey}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

async function run() {
  const transaction = {
    date: '2026-05-26',
    type: 'expense',
    amount: 5,
    category: '❤️ ΥΓΕΙΑ',
    subcategory: 'Φάρμακα',
    account_from: 'Cash',
    note: 'Test insert',
    description: 'Test description',
    user_id: 'c13f513d-b588-472b-86f8-2f5c1227dd13',
    is_shared: false
  };

  const url = `${baseUrl}/transactions`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify([transaction])
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", data);
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
