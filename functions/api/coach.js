export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  let question, lang, financialContext;
  try {
    const body = await request.json();
    question = body.question || '';
    lang = body.lang || 'el';
    financialContext = body.financialContext || {};
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  if (!env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 500,
      headers: corsHeaders
    });
  }

  // Format financial context for the prompt
  const ctxLines = [];
  if (financialContext.monthName) ctxLines.push(`Μήνας: ${financialContext.monthName}`);
  if (financialContext.monthIncome != null) ctxLines.push(`Εισόδημα τρέχοντος μήνα: ${financialContext.monthIncome}€`);
  if (financialContext.monthExpense != null) ctxLines.push(`Έξοδα τρέχοντος μήνα: ${financialContext.monthExpense}€`);
  if (financialContext.savingsRate) ctxLines.push(`Ποσοστό αποταμίευσης: ${financialContext.savingsRate}`);
  if (financialContext.totalBalance != null) ctxLines.push(`Συνολικό υπόλοιπο: ${financialContext.totalBalance}€`);
  if (financialContext.topCategories && financialContext.topCategories.length > 0) {
    ctxLines.push('Κορυφαίες κατηγορίες εξόδων:');
    financialContext.topCategories.forEach(c => ctxLines.push(`  - ${c.name}: ${c.total}€`));
  }
  const contextBlock = ctxLines.length > 0 ? ctxLines.join('\n') : 'Δεν υπάρχουν διαθέσιμα οικονομικά δεδομένα.';

  const SYSTEM_PROMPT = `Είσαι ένας έξυπνος προσωπικός οικονομικός βοηθός ΚΑΙ παραγωγός εκπαιδευτικών δεδομένων για offline AI σύστημα.

Γλώσσα απάντησης: ${lang === 'el' ? 'Ελληνικά' : 'Αγγλικά'}

Οικονομικά δεδομένα χρήστη:
${contextBlock}

ΚΑΝΟΝΕΣ:
1. Βασίσου ΑΠΟΚΛΕΙΣΤΙΚΑ στα παραπάνω δεδομένα. Μην κάνεις υποθέσεις.
2. Απάντα με φιλικό, απλό τόνο. Χρησιμοποίησε συγκεκριμένους αριθμούς από τα δεδομένα.
3. Η απάντησή σου ΔΕΝ πρέπει να ξεπερνά τις 3-4 προτάσεις.
4. Πρέπει να επιστρέψεις ΑΥΣΤΗΡΑ valid JSON (χωρίς markdown, χωρίς backticks).

Το JSON πρέπει να έχει ΑΚΡΙΒΩΣ αυτή τη μορφή:
{
  "answer": "Η απάντησή σου στον χρήστη εδώ",
  "training": {
    "intent": "ένα από: overspending|savings_advice|forecast|category_spending|budget_status|what_if|milestone|search_query|general_advice",
    "new_examples": ["κανονικοποιημένη φράση 1", "κανονικοποιημένη φράση 2", "κανονικοποιημένη φράση 3"],
    "entities": [
      { "text": "ΑΝ υπάρχει αναγνωρισμένος έμπορος/brand στην ερώτηση", "concept": "έννοια", "category": "κατηγορία" }
    ]
  }
}

Για το "new_examples": γράψε 3-5 ΔΙΑΦΟΡΕΤΙΚΕΣ διατυπώσεις της ίδιας ερώτησης, κανονικοποιημένες (χωρίς τόνους, lowercase).
Για το "entities": αν δεν υπάρχουν entities, βάλε κενό array [].`;

  const promptText = `${SYSTEM_PROMPT}\n\nΕρώτηση χρήστη: "${question}"`;

  try {
    let flashModelName = null;

    // Fetch available models dynamically using the API key
    const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`;
    const mRes = await fetch(modelsUrl);
    if (mRes.ok) {
      const mData = await mRes.json();

      // 1. Prefer gemini-flash-latest
      let selectedModel = mData.models.find(m => m.name === "models/gemini-flash-latest" && m.supportedGenerationMethods.includes("generateContent"));
      // 2. Then gemini-1.5-flash
      if (!selectedModel) {
        selectedModel = mData.models.find(m => m.name.includes("gemini-1.5-flash") && m.supportedGenerationMethods.includes("generateContent"));
      }
      // 3. Then gemini-2.0-flash
      if (!selectedModel) {
        selectedModel = mData.models.find(m => m.name.includes("gemini-2.0-flash") && !m.name.includes("lite") && m.supportedGenerationMethods.includes("generateContent"));
      }
      // 4. Then any flash model
      if (!selectedModel) {
        selectedModel = mData.models.find(m => m.name.includes("flash") && m.supportedGenerationMethods.includes("generateContent"));
      }

      if (selectedModel) {
        flashModelName = selectedModel.name;
      }
    }

    // Fallback to a hardcoded standard model if dynamic listing failed or returned nothing
    if (!flashModelName) {
      flashModelName = "models/gemini-1.5-flash";
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/${flashModelName}:generateContent?key=${env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 512
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      // Try fallback to gemini-1.5-flash if we tried something else
      if (flashModelName !== "models/gemini-1.5-flash") {
        const url2 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
        const response2 = await fetch(url2, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 512 }
          })
        });
        if (response2.ok) {
          const data2 = await response2.json();
          const text2 = data2.candidates[0].content.parts[0].text;
          return new Response(text2, { headers: corsHeaders });
        }
      }
      return new Response(JSON.stringify({ error: 'Gemini API error', detail: errText }), { status: 502, headers: corsHeaders });
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    return new Response(text, { headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
