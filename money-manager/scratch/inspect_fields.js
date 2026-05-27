const apiKey = "sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp";
const baseUrl = "https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1";

const headers = {
  "apikey": apiKey,
  "Authorization": `Bearer ${apiKey}`,
  "Content-Type": "application/json"
};

async function run() {
  const url = `${baseUrl}/transactions?select=*&limit=1`;
  try {
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (data.length > 0) {
      console.log("Transaction keys:", Object.keys(data[0]));
      console.log("Full Transaction object:", data[0]);
    } else {
      console.log("No transactions found.");
    }
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
