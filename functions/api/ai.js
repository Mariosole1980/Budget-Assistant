import { validateRequest, getSupabasePublicConfig } from './_security.js';

export async function onRequestOptions(context) {
  const { request } = context;
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  // For authenticated users we also capture the user_id so we can enforce the
  // AI Coach fair-use limit server-side (authoritative, cannot be bypassed).
  const authHeader = request.headers.get('Authorization') || '';
  let authenticatedUserId = null;
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
      try {
        const userData = await userRes.json();
        if (userData && userData.id) {
          authenticatedUserId = userData.id;
        }
      } catch (_) { /* ignore parse errors */ }
    } catch (err) {
      console.warn('Session verification error:', err.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: could not verify session' }), {
        status: 401,
        headers: corsHeaders
      });
    }
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const mode = body.mode || 'extract'; // 'extract' or 'advisor'
  const queryText = body.queryText;

  // Request validation: mode whitelist + queryText requirements.
  if (mode !== 'extract' && mode !== 'advisor') {
    return new Response(JSON.stringify({ error: "Invalid mode" }), {
      status: 400,
      headers: corsHeaders
    });
  }
  if (typeof queryText !== 'string' || queryText.trim().length === 0) {
    return new Response(JSON.stringify({ error: "Missing queryText" }), {
      status: 400,
      headers: corsHeaders
    });
  }
  if (queryText.length > 4000) {
    return new Response(JSON.stringify({ error: "queryText too long" }), {
      status: 400,
      headers: corsHeaders
    });
  }

  // --------------------------------------------------------------------------
  // AI COACH FAIR-USE LIMIT (server-side, authoritative)
  // Only online advisor calls count (they cost money). Offline fallback is free.
  // Free: 10/month. Premium: 50/month. Guest mode (no user_id) is not tracked
  // server-side and relies on the client-side gate.
  // --------------------------------------------------------------------------
  if (mode === 'advisor' && authenticatedUserId) {
    const supabase = getSupabasePublicConfig(env);
    if (!supabase) {
      return new Response(JSON.stringify({ error: 'Server configuration error: SUPABASE_URL / SUPABASE_ANON_KEY not configured.' }), {
        status: 500,
        headers: corsHeaders
      });
    }
    const { supabaseUrl, supabaseKey } = supabase;
    const authToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';

    const rpcCall = async (rpcName) => {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: '{}'
      });
      if (!res.ok) return null;
      try { return await res.json(); } catch (_) { return null; }
    };

    // Determine the user's plan limit.
    let premiumActive = false;
    try {
      const profileRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?select=premium_active&id=eq.${authenticatedUserId}&limit=1`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      if (profileRes.ok) {
        const rows = await profileRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          premiumActive = rows[0].premium_active === true;
        }
      }
    } catch (_) { /* ignore profile fetch errors */ }

    const limit = premiumActive ? 50 : 10;
    const currentUsage = await rpcCall('get_ai_usage');

    if (currentUsage != null && currentUsage >= limit) {
      return new Response(JSON.stringify({
        error: 'AI_LIMIT_REACHED',
        message: premiumActive
          ? 'Monthly AI Coach limit (50) reached.'
          : 'Monthly AI Coach limit (10) reached. Upgrade to Premium for 50/month.'
      }), {
        status: 429,
        headers: corsHeaders
      });
    }

    // Increment usage BEFORE calling Gemini so concurrent requests cannot
    // exceed the limit. If the increment fails, still allow the call (best-effort).
    await rpcCall('increment_ai_usage');
  }

  let prompt = '';
  if (mode === 'advisor') {
    const statsStr = body.stats ? JSON.stringify(body.stats) : 'No stats available';
    prompt = `Είσαι ο Οικονομικός Σύμβουλος AI (AI Coach) της εφαρμογής Budget Assistant.
Ο χρήστης σου κάνει μια ερώτηση σχετικά με τα οικονομικά του ή συνομιλεί μαζί σου.
Απάντησε φιλικά, σύντομα και υποστηρικτικά στα Ελληνικά (ή στη γλώσσα της ερώτησης).
Δώσε πρακτικές οικονομικές συμβουλές.
Χρησιμοποίησε τα παρακάτω στατιστικά στοιχεία του χρήστη (αν υπάρχουν) για να δώσεις πιο εξατομικευμένες συμβουλές:
${statsStr}

ΟΔΗΓΙΕΣ ΑΝΑΛΥΣΗΣ:
1. Η σημερινή ημερομηνία της συσκευής του χρήστη ορίζεται στο πεδίο 'currentDate' των στατιστικών. Όταν ο χρήστης αναφέρεται σε σχετικές ημερομηνίες (π.χ. 'αυτόν τον μήνα', 'τον προηγούμενο μήνα', 'χθες'), υπολόγισε ποιος μήνας/έτος είναι με βάση το 'currentDate'. ΑΣΧΕΤΩΣ αν υπάρχουν μελλοντικές συναλλαγές (π.χ. του 2027) καταχωρημένες, ο 'προηγούμενος μήνας' υπολογίζεται ημερολογιακά πριν από το 'currentDate'.
2. Το πεδίο 'allTransactions' περιέχει τις πιο πρόσφατες συναλλαγές του χρήστη (περιορισμένο πλήθος για λόγους μεγέθους). Κάθε συναλλαγή έχει ένα μοναδικό αναγνωριστικό id (UUID string), ημερομηνία (date), τύπο (type: expense/income), ποσό (amount), κατηγορία (category), υποκατηγορία (subcategory) και σημείωση (note). Χρησιμοποίησε το 'allTransactions' για αναζήτηση/επεξεργασία/διαγραφή συγκεκριμένων συναλλαγών (βρες το id) και για ερωτήσεις που αφορούν μόνο τις πρόσφατες συναλλαγές.
3. Για ερωτήσεις που καλύπτουν ΟΛΟ το ιστορικό ή μεγάλες περιόδους (π.χ. 'πόσα ξόδεψα συνολικά σε σούπερ μάρκετ;', 'τι ξόδεψα τον Μάρτιο του 2025;', 'ποια χρονιά ήταν η καλύτερη;'), ΜΗΝ βασίζεσαι μόνο στο 'allTransactions' (είναι περιορισμένο). Χρησιμοποίησε ΑΥΣΤΗΡΑ τα προ-υπολογισμένα αθροίσματα που καλύπτουν ΟΛΟ το ιστορικό:
   - 'monthlyTotals': αντικείμενο με κλειδί "YYYY-MM" και τιμή { income, expense } για κάθε μήνα.
   - 'yearlyTotals': αντικείμενο με κλειδί "YYYY" και τιμή { income, expense } για κάθε έτος.
   - 'categoryTotals': αντικείμενο με κλειδί το όνομα κατηγορίας και τιμή { income, expense } για ΟΛΟ το ιστορικό.
   - 'subcategoryTotals': αντικείμενο με κλειδί "κατηγορία|υποκατηγορία" και τιμή { expense } για ΟΛΟ το ιστορικό.
   Άθροισε τα κατάλληλα κλειδιά με απόλυτη μαθηματική ακρίβεια. Αν η ερώτηση αφορά συγκεκριμένη κατηγορία/υποκατηγορία/μήνα/έτος, βρες το αντίστοιχο κλειδί και χρησιμοποίησε την τιμή του.
4. Στο πεδίο 'budgets' έχεις τα μηνιαία όρια προϋπολογισμού ανά κατηγορία. Σύγκρινε τα έξοδα της αντίστοιχης κατηγορίας (από το 'categoryTotals' ή το 'monthlyTotals' ανάλογα με την περίοδο που ρωτάει) με το budget της αν ο χρήστης ρωτάει για την κατάσταση του budget.
5. Απάντησε με βάση τα πραγματικά δεδομένα που βλέπεις και μην υποθέτεις/φαντάζεσαι συναλλαγές ή κατηγορίες που δεν υπάρχουν.
6. Όταν ο χρήστης ρωτάει γενικά 'Πώς τα πήγα φέτος;' ή για τα ετήσια σύνολα του τρέχοντος έτους, χρησιμοποίησε ΑΥΣΤΗΡΑ τα προ-υπολογισμένα ετήσια στοιχεία 'ytdCurrentYearIncome', 'ytdCurrentYearExpense' και 'ytdCurrentYearNetBalance' από το αντικείμενο stats, τα οποία συμφωνούν 100% με την καρτέλα Επισκόπησης. Για άλλα έτη, χρησιμοποίησε το 'yearlyTotals'.

Η απάντησή σου ΠΡΕΠΕΙ να είναι ΑΥΣΤΗΡΑ ένα έγκυρο JSON object (χωρίς markdown backticks, χωρίς έξτρα κείμενο) με τα εξής πεδία:
{
  "responseHtml": "Η απάντησή σου σε μορφή HTML/markdown (χρησιμοποίησε <strong> για έντονα γράμματα, <br> για αλλαγή γραμμής, • για bullet points). Αν ο χρήστης ζητάει καταγραφή εξόδων ή επεξεργασία, γράψε μια σύντομη επιβεβαίωση (π.χ. 'Φυσικά, ετοίμασα τις αλλαγές για εσένα...').",
  "classifiedIntent": "Η πρόθεση της ερώτησης. Πρέπει να είναι μία από τις εξής τιμές: 'overspending', 'savings_advice', 'forecast', 'category_spending', 'budget_status', 'what_if', 'milestone', 'search_query', 'unknown'.",
  "alternativePhrasings": ["3 διαφορετικοί εναλλακανοί τρόποι (στα Ελληνικά) για να ρωτήσει κανείς το ίδιο ακριβώς πράγμα."],
  "extractedEntities": [
    { "text": "μια λέξη ή φράση-κλειδί από την ερώτηση (π.χ. 'καφέ')", "concept": "η έννοια (π.χ. 'coffee')", "category": "η πιο κατάλληλη κατηγορία εξόδων αν υπάρχει (π.χ. 'ΚΑΦΕΣ' ή 'ΕΣΤΙΑΣΗ')" }
  ],
  "transactionsToAdd": [
    { "amount": 15.0, "note": "βενζίνη", "type": "expense" }
  ],
  "transactionsToUpdate": [
    { "id": "το ID της υπάρχουσας συναλλαγής από το allTransactions", "amount": 2.20, "note": "νέος τίτλος/σημείωση", "category": "νέα κατηγορία αν ζητήθηκε αλλαγή", "subcategory": "νέα υποκατηγορία αν ζητήθηκε", "account_from": "νέος λογαριασμός αν ζητήθηκε", "date": "νέα ημερομηνία σε ISO format (π.χ. 2026-06-27T17:09:52.000Z) αν ζητήθηκε αλλαγή", "type": "expense" }
  ],
  "transactionsToDelete": [
    "το ID της συναλλαγής που πρέπει να διαγραφεί"
  ]
}

Αν ο χρήστης ζήτησε ρητά να προσθέσει/καταγράψει νέα έξοδα/έσοδα, συμπλήρωσε το "transactionsToAdd".
Αν ο χρήστης ζήτησε να επεξεργαστεί, να αλλάξει, να μεταφέρει, να διορθώσει μια υπάρχουσα συναλλαγή (π.χ. "άλλαξε την ημερομηνία του Φούρνου 2.20 στις 27/6"), βρες την αντίστοιχη συναλλαγή στο "allTransactions", πάρε το "id" της και βάλε ένα αντικείμενο στο "transactionsToUpdate" με το σωστό "id" και τις αλλαγές που ζήτησε.
Αν ο χρήστης ζήτησε να διαγράψει/ακυρώσει μια υπάρχουσα συναλλαγή, βρες την στο "allTransactions", πάρε το "id" της και πρόσθεσέ το στο "transactionsToDelete".

Ερώτηση χρήστη: "${queryText}"`;
  } else {
    const categoriesStr = body.categoriesStr || '';
    const SYSTEM_PROMPT = `Είσαι ένας οικονομικός βοηθός (Expense Tracker AI). 
Ο χρήστης θα σου δώσει μια πρόταση (συνήθως στα Ελληνικά) σχετικά με κάποιο έξοδο.
Η δουλειά σου είναι να εξάγεις το ποσό (amount), την τοποθεσία/έμπορο (merchant) και την κατηγορία (category).

ΚΑΝΟΝΕΣ:
1. Το "amount" πρέπει να είναι νούμερο (float). Αν δεν υπάρχει, βάλε null.
2. Το "merchant" πρέπει να είναι ένα μικρό string (π.χ. "Σκλαβενίτης", "ΔΕΗ"). Αν δεν αναφέρεται, βάλε null.
3. Το "category" ΠΡΕΠΕΙ ΟΠΩΣΔΗΠΟΤΕ να είναι μία από τις διαθέσιμες κατηγορίες που θα σου δοθούν. Αν δεν ταιριάζει καμία, διάλεξε την πιο κοντινή ή "Γενικά Έξοδα".
4. Η απάντησή σου ΠΡΕΠΕΙ να είναι ΑΥΣΤΗΡΑ ένα έγκυρο JSON object, χωρίς markdown, χωρίς backticks, χωρίς έξτρα κείμενο. Παράδειγμα: {"amount": 50, "merchant": "Σκλαβενίτης", "category": "ΤΡΟΦΙΜΑ"}
`;
    prompt = `${SYSTEM_PROMPT}\nΔιαθέσιμες κατηγορίες: ${categoriesStr}\n\nΠρόταση χρήστη: "${queryText}"`;
  }

  try {
    if (env.GEMINI_API_KEY) {
      const modelsToTry = [
        'models/gemini-flash-lite-latest',
        'models/gemini-3.1-flash-lite',
        'models/gemini-2.5-flash',
        'models/gemini-3.5-flash'
      ];
      // Build request body dynamically
      const reqBody = {
        generationConfig: {
          responseMimeType: "application/json",
          temperature: mode === 'advisor' ? 0.7 : 0.1
        }
      };

      if (mode === 'advisor') {
        let contents = [];
        if (body.history && Array.isArray(body.history)) {
          contents = body.history.map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content }]
          }));
        }
        contents.push({
          role: 'user',
          parts: [{ text: queryText }]
        });
        reqBody.contents = contents;
        reqBody.systemInstruction = {
          parts: [{ text: prompt }]
        };
      } else {
        reqBody.contents = [{ parts: [{ text: prompt }] }];
      }

      let response;
      let lastErrText = '';

      for (const modelName of modelsToTry) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`;
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify(reqBody)
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            break;
          } else {
            lastErrText = await response.text();
          }
        } catch (e) {
          clearTimeout(timeoutId);
        }
      }

      if (response && response.ok) {
        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        return new Response(text, { headers: corsHeaders });
      } else {
        return new Response(JSON.stringify({ error: "Gemini API failure" }), {
          status: response && response.status ? response.status : 502,
          headers: corsHeaders
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing from environment" }), {
        status: 500,
        headers: corsHeaders
      });
    }
  } catch (err) {
    console.error('AI endpoint error:', err.message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
