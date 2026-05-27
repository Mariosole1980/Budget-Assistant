const apiKey = "sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp";
const baseUrl = "https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1";

const headers = {
  "apikey": apiKey,
  "Authorization": `Bearer ${apiKey}`,
  "Content-Type": "application/json"
};

async function run() {
  const url = `${baseUrl}/transactions?note=eq.Test insert clean`;
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers
    });
    console.log("Deleted test transactions. Status:", res.status);
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
