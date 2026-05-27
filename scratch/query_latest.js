const apiKey = "sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp";
const baseUrl = "https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1";

const headers = {
  "apikey": apiKey,
  "Authorization": `Bearer ${apiKey}`,
  "Content-Type": "application/json"
};

async function run() {
  const url = `${baseUrl}/transactions?select=*&limit=10&order=created_at.desc`;
  try {
    const res = await fetch(url, { headers });
    const data = await res.json();
    console.log("Latest 10 transactions:");
    data.forEach(t => {
      console.log(`[${t.created_at}] ID: ${t.id}, Date: ${t.date}, Type: ${t.type}, Amount: ${t.amount}, Category: ${t.category}, Subcategory: ${t.subcategory}, AccountFrom: ${t.account_from}, Note: ${t.note}`);
    });
  } catch (err) {
    console.error("Failed to query transactions:", err);
  }
}

run();
