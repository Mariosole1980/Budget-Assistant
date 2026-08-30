import { validateRequest, getSupabasePublicConfig, generateWithGeminiFallback } from './_security.js';

export async function onRequestOptions(context) {
  const { request } = context;
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
    'https://www.budgetassistant.org',
    'https://budgetassistant.org',
    'https://budget-assistant-pwa.pages.dev',
    'capacitor://localhost',
    'http://localhost',
    'https://localhost'
  ];
  if (!origin || !allowedOrigins.includes(origin)) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Shared security: CORS origin check, rate limiting, body size guard.
  const sec = validateRequest(request);
  if (!sec.ok) {
    return new Response(sec.body, { status: sec.status, headers: sec.headers });
  }
  const corsHeaders = sec.headers;

  // JWT Token Verification (Optional - supports Guest Mode & Logged-in users).
  // When a token IS present it must be valid; invalid tokens are rejected.
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const supabase = getSupabasePublicConfig(env);
    if (!supabase) {
      return new Response(JSON.stringify({ error: 'Server configuration error: SUPABASE_URL / SUPABASE_ANON_KEY not configured.' }), {
        status: 500,
        headers: corsHeaders
      });
    }
    const { supabaseUrl, supabaseKey } = supabase;

    try {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`
        }
      });
      if (!userRes.ok) {
        return new Response(JSON.stringify({ error: 'Unauthorized: invalid session token' }), {
          status: 401,
          headers: corsHeaders
        });
      }
    } catch (err) {
      console.warn('Session verification error:', err.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: could not verify session' }), {
        status: 401,
        headers: corsHeaders
      });
    }
  }

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

  // Request validation: question is required and length-capped.
  if (typeof question !== 'string' || question.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Missing question' }), {
      status: 400,
      headers: corsHeaders
    });
  }
  if (question.length > 4000) {
    return new Response(JSON.stringify({ error: 'Question too long' }), {
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

    // Try the discovered model first, then fall back to gemini-1.5-flash.
    // The shared helper tries each model in order and returns the first success.
    const reqBody = {
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 512
      }
    };
    const modelNames = flashModelName === "models/gemini-1.5-flash"
      ? [flashModelName]
      : [flashModelName, "models/gemini-1.5-flash"];

    const result = await generateWithGeminiFallback({ env, modelNames, reqBody });

    if (result.ok) {
      return new Response(result.text, { headers: corsHeaders });
    }
    return new Response(JSON.stringify({ error: 'Gemini API error' }), { status: result.status, headers: corsHeaders });

  } catch (err) {
    console.error('Coach endpoint error:', err.message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
