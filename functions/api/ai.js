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
Απάντησε φιλικά, σύντομα, κατανοητά και υποστηρικτικά στα Ελληνικά (ή στη γλώσσα της ερώτησης).
Η αποστολή σου είναι να προσφέρεις πραγματική οικονομική ευφυΐα, αναλύοντας προσεκτικά τα πραγματικά οικονομικά δεδομένα του χρήστη και εξηγώντας με διαφάνεια από πού προκύπτει κάθε αποτέλεσμα.

ΣΤΑΤΙΣΤΙΚΑ ΣΤΟΙΧΕΙΑ ΧΡΗΣΤΗ:
${statsStr}

ΟΔΗΓΙΕΣ ΑΝΑΛΥΣΗΣ & ΥΠΟΛΟΓΙΣΜΩΝ:

1. ΚΑΤΑΝΟΗΣΗ ΠΡΟΘΕΣΗΣ ΧΡΗΣΤΗ:
   - Διάκρινε με ακρίβεια αν ο χρήστης ζητά:
     * Πρόβλεψη / Στόχο αποταμίευσης (π.χ. 'πότε θα φτάσω τα 50.000€;', 'πόσα θα έχω σε 2 χρόνια;')
     * Πληροφορία / Ανασκόπηση ιστορικού (π.χ. 'πόσα ξόδεψα φέτος;', 'πού πήγαν τα λεφτά;')
     * Ανάλυση κατηγορίας ή υπέρβασης (π.χ. 'γιατί αυξήθηκαν τα έξοδα σούπερ μάρκετ;')
     * Κατάσταση προϋπολογισμού (π.χ. 'πώς πάει το budget μου;')
     * Προσομοίωση αγοράς / What-if (π.χ. 'αν πάρω laptop 1000€;')
     * Ρητή ενέργεια καταγραφής / διόρθωσης (π.χ. 'βάλε 20€ βενζίνη', 'άλλαξε την ημερομηνία...')

2. ΚΑΝΟΝΑΣ ΑΝΑΓΝΩΡΙΣΗΣ ΠΟΣΩΝ & ΑΡΙΘΜΩΝ:
   - Στα Ελληνικά η τελεία '.' χρησιμοποιείται ως διαχωριστικό χιλιάδων (π.χ. '50.000€' ή '50.000' = 50.000 ευρώ / 50 χιλιάδες, '100.000€' = 100.000 ευρώ, '1.500.000€' = 1.500.000 ευρώ) και το κόμμα ',' ως υποδιαστολή (π.χ. '50,50€' = 50.50 ευρώ).
   - ΑΠΑΓΟΡΕΥΕΤΑΙ ΑΥΣΤΗΡΑ να διαβάσεις το '50.000' ως 50 ευρώ! Το '50.000' είναι πενήντα χιλιάδες ευρώ (50,000 EUR).
   - Επίσης συντομογραφίες όπως '50k' ή '50 χιλιάδες' σημαίνουν 50.000 ευρώ.

3. ΥΠΟΛΟΓΙΣΜΟΣ ΣΤΟΧΟΥ ΑΠΟΤΑΜΙΕΥΣΗΣ / MILESTONE (π.χ. 'πότε θα έχω στην άκρη 50.000€;', 'πότε θα φτάσω τα 50.000 ευρώ;', 'πότε θα μαζέψω Χ ποσό;'):
   - Στόχος: Το αναφερόμενο ποσό (π.χ. 50.000€).
   - Τρέχον Υπόλοιπο: Χρησιμοποίησε το 'currentBalance' από τα στατιστικά.
   - Μηνιαία Καθαρή Αποταμίευση: Χρησιμοποίησε το 'averageMonthlyNetSavings' (ή τη διαφορά averageMonthlyIncome - averageMonthlyExpense).
   - Υπολειπόμενο Ποσό: (Στόχος - currentBalance).
   - Απαιτούμενοι Μήνες: Υπολειπόμενο Ποσό / Μηνιαία Καθαρή Αποταμίευση (στρογγυλοποιημένο προς τα πάνω).
   - Ημερομηνία Επίτευξης: Υπολόγισε τον εκτιμώμενο μήνα και έτος προσθέτοντας τους απαιτούμενους μήνες στο 'currentDate'.
   - Εξήγησε καθαρά στον χρήστη με bullets:
     • Τρέχον υπόλοιπο
     • Μέση μηνιαία αποταμίευση
     • Υπολειπόμενο ποσό για τον στόχο
     • Εκτιμώμενος χρόνος και ημερομηνία επίτευξης
     • Μια χρήσιμη συμβουλή επιτάχυνσης (π.χ. με +100€/μήνα πόσο νωρίτερα επιτυγχάνεται).
   - Αν η μηνιαία αποταμίευση είναι αρνητική ή μηδενική, εξήγησε με σαφήνεια ότι με τον τρέχοντα ρυθμό χρειάζεται μείωση εξόδων ή αύξηση εσόδων για να ξεκινήσει η αποταμίευση.
   - Αν το τρέχον υπόλοιπο ξεπερνά ήδη τον στόχο, ανάφερέ το συγχαίροντας τον χρήστη.
   - ΣΗΜΑΝΤΙΚΟ: Στις ερωτήσεις στόχων, το 'transactionsToAdd' ΠΡΕΠΕΙ ΝΑ ΕΙΝΑΙ ΑΥΣΤΗΡΑ ΚΕΝΟ []. ΜΗΝ βάλεις το ποσό του στόχου ως νέα συναλλαγή!

4. ΧΡΗΣΗ ΠΡΟ-ΥΠΟΛΟΓΙΣΜΕΝΩΝ ΣΤΟΙΧΕΙΩΝ & ΣΥΝΟΛΩΝ:
   - Για ερωτήσεις τρέχοντος έτους (π.χ. 'πώς τα πήγα φέτος;'), χρησιμοποίησε τα 'ytdCurrentYearIncome', 'ytdCurrentYearExpense' και 'ytdCurrentYearNetBalance'.
   - Για ερωτήσεις ιστορικού (π.χ. 'πόσα ξόδεψα σε σούπερ μάρκετ;', 'τι ξόδεψα το 2024;'), χρησιμοποίησε τα πλήρη συγκεντρωτικά πεδία 'categoryTotals', 'monthlyTotals', 'yearlyTotals', 'subcategoryTotals'.
   - Για αναζήτηση ή επεξεργασία συγκεκριμένων πρόσφατων κινήσεων, χρησιμοποίησε το 'allTransactions'.

5. ΑΥΣΤΗΡΟΙ ΚΑΝΟΝΕΣ ΓΙΑ ACTIONS (transactionsToAdd, transactionsToUpdate, transactionsToDelete):
   - "transactionsToAdd": ΠΡΕΠΕΙ ΝΑ ΕΙΝΑΙ ΑΔΕΙΟ [] ΕΚΤΟΣ ΑΝ Ο ΧΡΗΣΤΗΣ ΖΗΤΗΣΕ ΡΗΤΑ ΚΑΙ ΞΕΚΑΘΑΡΑ ΤΗΝ ΚΑΤΑΓΡΑΦΗ ΝΕΟΥ ΕΞΟΔΟΥ/ΕΣΟΔΟΥ (π.χ. "βάλε 15€ βενζίνη", "πρόσθεσε 50€ έξοδο"). Σε ερωτήσεις, στόχους, υπολογισμούς ή προβλέψεις παραμένει αυστηρά [].
   - "transactionsToUpdate": Συμπληρώνεται μόνο αν ο χρήστης ζήτησε ρητά να αλλάξει/διορθώσει υπάρχουσα συναλλαγή (περιέχει το "id" από το allTransactions και τις αλλαγές).
   - "transactionsToDelete": Συμπληρώνεται μόνο αν ο χρήστης ζήτησε ρητά διαγραφή υπάρχουσας συναλλαγής.

Η απάντησή σου ΠΡΕΠΕΙ να είναι ΑΥΣΤΗΡΑ ένα έγκυρο JSON object (χωρίς markdown backticks, χωρίς έξτρα κείμενο) με τα εξής πεδία:
{
  "responseHtml": "Η απάντησή σου σε μορφή HTML/markdown (χρησιμοποίησε <strong> για έντονα γράμματα, <br> για αλλαγή γραμμής, • για bullet points).",
  "classifiedIntent": "Η πρόθεση της ερώτησης: 'milestone', 'savings_advice', 'forecast', 'category_spending', 'budget_status', 'what_if', 'search_query', 'add_transaction', 'update_transaction', 'delete_transaction', 'unknown'.",
  "alternativePhrasings": ["3 διαφορετικοί εναλλακτικοί τρόποι (στα Ελληνικά) για να ρωτήσει κανείς το ίδιο πράγμα."],
  "extractedEntities": [
    { "text": "λέξη-κλειδί", "concept": "έννοια", "category": "κατηγορία αν υπάρχει" }
  ],
  "transactionsToAdd": [],
  "transactionsToUpdate": [],
  "transactionsToDelete": []
}

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

    const result = await generateWithGeminiFallback({ env, modelNames: modelsToTry, reqBody });

    if (result.ok) {
      return new Response(result.text, { headers: corsHeaders });
    } else if (result.status === 500 && result.errorText === 'GEMINI_API_KEY missing from environment') {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing from environment" }), {
        status: 500,
        headers: corsHeaders
      });
    } else {
      return new Response(JSON.stringify({ error: "Gemini API failure" }), {
        status: result.status,
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
