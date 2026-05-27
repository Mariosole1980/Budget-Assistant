const apiKey = "sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp";
const baseUrl = "https://nnatvvahoeiemkfmzpwp.supabase.co/rest/v1";

const headers = {
  "apikey": apiKey,
  "Authorization": `Bearer ${apiKey}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

async function patchTransactions(filter, body) {
  const url = `${baseUrl}/transactions?${filter}`;
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body)
    });
    const data = await res.json();
    console.log(`Patched filter '${filter}'. Affected rows: ${data.length}`);
  } catch (err) {
    console.error(`Failed on filter '${filter}':`, err);
  }
}

async function run() {
  console.log("--- UPDATING CATEGORIES IN TRANSACTIONS TABLE ---");
  await patchTransactions("category=eq.ΥΓΕΙΑ", { "category": "❤️ ΥΓΕΙΑ" });
  await patchTransactions("category=eq.ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ", { "category": "🎉ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ" });
  await patchTransactions("category=eq.ΕΚΠΑΙΔΕΥΣΗ", { "category": "🎓 ΕΚΠΑΙΔΕΥΣΗ" });
  await patchTransactions("category=eq.ΣΥΝΔΡΟΜΕΣ", { "category": "🎬 ΣΥΝΔΡΟΜΕΣ" });
  await patchTransactions("category=eq.ΓΥΜΝΑΣΤΗΡΙΟ", { "category": "🏋️ΓΥΜΝΑΣΤΗΡΙΟ" });
  await patchTransactions("category=eq.ΜΕΡΙΔΙΟ ΔΟΣΗΣ ΔΑΝΕΙΟΥ (ΓΟΝΕΙΣ)", { "category": "🏛️ΜΕΡΙΔΙΟ ΔΟΣΗΣ ΔΑΝΕΙΟΥ (ΓΟΝΕΙΣ)" });
  await patchTransactions("category=eq.ΓΡΑΦΕΙΟ Β2", { "category": "🏠ΓΡΑΦΕΙΟ Β2" });
  await patchTransactions("category=eq.ΣΠΙΤΙ", { "category": "🏡 ΣΠΙΤΙ" });
  await patchTransactions("category=eq.ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ", { "category": "👕 ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ" });
  await patchTransactions("category=eq.ΕΝΟΙΚΙΟ Β2 (ΈΣΟΔΟ)", { "category": "💶  ΕΝΟΙΚΙΟ Β2 (Έσοδο)" });
  await patchTransactions("category=eq.ΜΙΣΘΟΣ", { "category": "💼 ΜΙΣΘΟΣ" });
  await patchTransactions("category=eq.ΜΕΤΑΚΙΝΗΣΗ", { "category": "🚇 ΜΕΤΑΚΙΝΗΣΗ" });
  await patchTransactions("category=eq.ΑΥΤΟΚΙΝΗΤΟ", { "category": "🚗 ΑΥΤΟΚΙΝΗΤΟ" });
  await patchTransactions("category=eq.ΔΙΑΤΡΟΦΗ", { "category": "🛒 ΔΙΑΤΡΟΦΗ" });
  await patchTransactions("category=eq.ΕΞΤΡΑ ΕΙΣΟΔΗΜΑΤΑ", { "category": "🤑 ΕΞΤΡΑ ΕΙΣΟΔΗΜΑΤΑ" });
  await patchTransactions("category=eq.螺 ΕΞΤΡΑ ΕΙΣΟΔΗΜΑΤΑ", { "category": "🤑 ΕΞΤΡΑ ΕΙΣΟΔΗΜΑΤΑ" });
  await patchTransactions("category=eq.ΔΙΑΦΟΡΑ ΕΞΟΔΑ", { "category": "🧩ΔΙΑΦΟΡΑ ΕΞΟΔΑ" });
  await patchTransactions("category=eq.里ΔΙΑΦΟΡΑ ΕΞΟΔΑ", { "category": "🧩ΔΙΑΦΟΡΑ ΕΞΟΔΑ" });
  await patchTransactions("category=eq.ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ", { "category": "🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ" });

  console.log("\n--- UPDATING SUBCATEGORIES IN TRANSACTIONS TABLE ---");
  await patchTransactions("subcategory=eq.BONUS", { "subcategory": "🏅 BONUS" });
  await patchTransactions("subcategory=eq.VINTED", { "subcategory": "📦VINTED" });
  await patchTransactions("subcategory=eq.ΑΛΛΑ ΕΞΤΡΑ", { "subcategory": "🎁ΑΛΛΑ ΕΞΤΡΑ" });
  await patchTransactions("subcategory=eq.ΙΝΣΤΑ", { "subcategory": "💻ΙΝΣΤΑ" });
  await patchTransactions("subcategory=eq.ΤΟΚΟΙ/CASHBACK/ΤΡΑΠΕΖΕΣ", { "subcategory": "💰ΤΟΚΟΙ/CASHBACK/ΤΡΑΠΕΖΕΣ" });
  await patchTransactions("subcategory=eq.ΕΠΙΔΟΜΑΤΑ/ΣΕΜΙΝΑΡΙΑ", { "subcategory": "🧑‍🎓ΕΠΙΔΟΜΑΤΑ/ΣΕΜΙΝΑΡΙΑ" });
  await patchTransactions("subcategory=eq.六‍ΕΠΙΔΟΜΑΤΑ/ΣΕΜΙΝΑΡΙΑ", { "subcategory": "🧑‍🎓ΕΠΙΔΟΜΑΤΑ/ΣΕΜΙΝΑΡΙΑ" });
  await patchTransactions("subcategory=eq.ΟΙΚΟΓΕΝΕΙΑ/ΒΟΗΘΕΙΑ", { "subcategory": "👨‍👩‍👦ΟΙΚΟΓΕΝΕΙΑ/ΒΟΗΘΕΙΑ" });
  await patchTransactions("subcategory=eq.‍‍ΟΙΚΟΓΕΝΕΙΑ/ΒΟΗΘΕΙΑ", { "subcategory": "👨‍👩‍👦ΟΙΚΟΓΕΝΕΙΑ/ΒΟΗΘΕΙΑ" });

  console.log("\n--- RE-CREATING CATEGORIES TABLE ENTRIES ---");
  try {
    const delUrl = `${baseUrl}/categories?id=not.is.null`;
    await fetch(delUrl, { method: 'DELETE', headers });
    console.log("Deleted existing categories.");

    const newCats = [
      { name: "❤️ ΥΓΕΙΑ", type: "expense", icon: "❤️" },
      { name: "🎉ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ", type: "expense", icon: "🎉" },
      { name: "🎓 ΕΚΠΑΙΔΕΥΣΗ", type: "expense", icon: "🎓" },
      { name: "🎬 ΣΥΝΔΡΟΜΕΣ", type: "expense", icon: "🎬" },
      { name: "🏋️ΓΥΜΝΑΣΤΗΡΙΟ", type: "expense", icon: "🏋️" },
      { name: "🏛️ΜΕΡΙΔΙΟ ΔΟΣΗΣ ΔΑΝΕΙΟΥ (ΓΟΝΕΙΣ)", type: "income", icon: "🏛️" },
      { name: "🏠ΓΡΑΦΕΙΟ Β2", type: "expense", icon: "🏠" },
      { name: "🏡 ΣΠΙΤΙ", type: "expense", icon: "🏡" },
      { name: "👕 ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ", type: "expense", icon: "👕" },
      { name: "💶  ΕΝΟΙΚΙΟ Β2 (Έσοδο)", type: "income", icon: "💶" },
      { name: "💼 ΜΙΣΘΟΣ", type: "income", icon: "💼" },
      { name: "🚇 ΜΕΤΑΚΙΝΗΣΗ", type: "expense", icon: "🚇" },
      { name: "🚗 ΑΥΤΟΚΙΝΗΤΟ", type: "expense", icon: "🚗" },
      { name: "🛒 ΔΙΑΤΡΟΦΗ", type: "expense", icon: "🛒" },
      { name: "🤑 ΕΞΤΡΑ ΕΙΣΟΔΗΜΑΤΑ", type: "income", icon: "🤑" },
      { name: "🧩ΔΙΑΦΟΡΑ ΕΞΟΔΑ", type: "expense", icon: "🧩" },
      { name: "🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ", type: "expense", icon: "🧾" }
    ];

    const insRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newCats)
    });
    console.log("Inserted categories successfully.");
  } catch (err) {
    console.error("Failed categories operations:", err);
  }
}

run();
