export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  
  let queryText, categoriesStr;
  try {
    const body = await request.json();
    queryText = body.queryText;
    categoriesStr = body.categoriesStr;
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { 
      status: 400,
      headers: corsHeaders
    });
  }

  const SYSTEM_PROMPT = `Είσαι ένας οικονομικός βοηθός (Expense Tracker AI). 
Ο χρήστης θα σου δώσει μια πρόταση (συνήθως στα Ελληνικά) σχετικά με κάποιο έξοδο.
Η δουλειά σου είναι να εξάγεις το ποσό (amount), την τοποθεσία/έμπορο (merchant) και την κατηγορία (category).

ΚΑΝΟΝΕΣ:
1. Το "amount" πρέπει να είναι νούμερο (float). Αν δεν υπάρχει, βάλε null.
2. Το "merchant" πρέπει να είναι ένα μικρό string (π.χ. "Σκλαβενίτης", "ΔΕΗ"). Αν δεν αναφέρεται, βάλε null.
3. Το "category" ΠΡΕΠΕΙ ΟΠΩΣΔΗΠΟΤΕ να είναι μία από τις διαθέσιμες κατηγορίες που θα σου δοθούν. Αν δεν ταιριάζει καμία, διάλεξε την πιο κοντινή ή "Γενικά Έξοδα".
4. Η απάντησή σου ΠΡΕΠΕΙ να είναι ΑΥΣΤΗΡΑ ένα έγκυρο JSON object, χωρίς markdown, χωρίς backticks, χωρίς έξτρα κείμενο. Παράδειγμα: {"amount": 50, "merchant": "Σκλαβενίτης", "category": "ΤΡΟΦΙΜΑ"}
`;

  let debugInfo = [];

  try {
    if (env.GEMINI_API_KEY) {
        // Fetch available models
        const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`;
        const mRes = await fetch(modelsUrl);
        if (mRes.ok) {
            const mData = await mRes.json();
            
            // Prefer gemini-flash-latest, else any flash model
            let flashModel = mData.models.find(m => m.name === "models/gemini-flash-latest" && m.supportedGenerationMethods.includes("generateContent"));
            if (!flashModel) {
                 flashModel = mData.models.find(m => m.name.includes("flash") && !m.name.includes("lite") && m.supportedGenerationMethods.includes("generateContent"));
            }
            if (!flashModel) {
                 flashModel = mData.models.find(m => m.name.includes("flash") && m.supportedGenerationMethods.includes("generateContent"));
            }
            
            if (flashModel) {
                 // flashModel.name is already "models/modelname", so we use it directly
                 const url = `https://generativelanguage.googleapis.com/v1beta/${flashModel.name}:generateContent?key=${env.GEMINI_API_KEY}`;
                 const prompt = `${SYSTEM_PROMPT}\nΔιαθέσιμες κατηγορίες: ${categoriesStr}\n\nΠρόταση χρήστη: "${queryText}"`;
                 
                 const response = await fetch(url, {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({
                     contents: [{ parts: [{ text: prompt }] }],
                     generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
                   })
                 });
                 
                 if (response.ok) {
                      const data = await response.json();
                      const text = data.candidates[0].content.parts[0].text;
                      return new Response(text, { headers: corsHeaders });
                 } else {
                      debugInfo.push("Dynamic Flash Error: " + await response.text());
                 }
            } else {
                 debugInfo.push("No suitable flash model found.");
            }
        } else {
            debugInfo.push("Failed to list models: " + await mRes.text());
        }
    } else {
        debugInfo.push("GEMINI_API_KEY is not defined in env.");
    }

    return new Response(JSON.stringify({ error: "All AI providers failed or no keys configured", debug: debugInfo }), { 
      status: 500,
      headers: corsHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, debug: debugInfo }), { 
      status: 500,
      headers: corsHeaders
    });
  }
}
