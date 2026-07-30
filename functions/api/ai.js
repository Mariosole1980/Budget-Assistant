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

  // JWT Token Verification Check (Optional - supports Guest Mode & Logged-in users)
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const supabaseUrl = env.SUPABASE_URL || 'https://nnatvvahoeiemkfmzpwp.supabase.co';
    const supabaseKey = env.SUPABASE_ANON_KEY || 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp';
    
    try {
      await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (err) {
      console.warn('Session verification warning:', err.message);
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
  
  if (!queryText && mode !== 'test_models') {
    return new Response(JSON.stringify({ error: "Missing queryText" }), { 
      status: 400,
      headers: corsHeaders
    });
  }

  if (mode === 'test_models') {
    if (!env.GEMINI_API_KEY) return new Response('No key', { status: 400, headers: corsHeaders });
    try {
      let models = [];
      let pageToken = '';
      do {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}${pageToken ? '&pageToken='+pageToken : ''}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.models) models = models.concat(data.models.map(m => m.name));
        pageToken = data.nextPageToken;
      } while (pageToken);
      return new Response(JSON.stringify({ models }), { headers: corsHeaders });
    } catch (e) {
      return new Response(e.message, { status: 500, headers: corsHeaders });
    }
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
2. Στο πεδίο 'allTransactions' έχεις όλο το ιστορικό συναλλαγών του χρήστη. Κάθε συναλλαγή έχει ένα μοναδικό αναγνωριστικό id (UUID string), ημερομηνία (date), τύπο (type: expense/income), ποσό (amount), κατηγορία (category), υποκατηγορία (subcategory) και σημείωση (note).
3. Όταν ο χρήστης ρωτάει για μια συγκεκριμένη κατηγορία (category) ή υποκατηγορία (subcategory) ή συγκεκριμένο μήνα, φιλτράρισε και υπολόγισε το άθροισμα χρησιμοποιώντας ΑΥΣΤΗΡΑ μόνο τις συναλλαγές που έχουν την αντίστοιχη τιμή στο πεδίο 'category' ή 'subcategory'. Μην συμπεριλαμβάνεις συναλλαγές άλλων κατηγοριών επειδή ταιριάζει η σημείωση (note) με το όνομα της κατηγορίας (π.χ. αν μια συναλλαγή έχει category 'Διάφορα' με note 'Lidl', μην τη μετρήσεις στο 'Σούπερ Μάρκετ' εκτός αν το ζητήσει ρητά ο χρήστης). Υπολόγισε το άθροισμα με απόλυτη μαθηματική ακρίβεια.
4. Στο πεδίο 'budgets' έχεις τα μηνιαία όρια προϋπολογισμού ανά κατηγορία. Σύγκρινε τα έξοδα της αντίστοιχης κατηγορίας με το budget της αν ο χρήστης ρωτάει για την κατάσταση του budget.
5. Απάντησε με βάση τα πραγματικά δεδομένα που βλέπεις και μην υποθέτεις/φαντάζεσαι συναλλαγές ή κατηγορίες που δεν υπάρχουν.
6. Όταν ο χρήστης ρωτάει γενικά 'Πώς τα πήγα φέτος;' ή για τα ετήσια σύνολα του τρέχοντος έτους, χρησιμοποίησε ΑΥΣΤΗΡΑ τα προ-υπολογισμένα ετήσια στοιχεία 'ytdCurrentYearIncome', 'ytdCurrentYearExpense' και 'ytdCurrentYearNetBalance' από το αντικείμενο stats, τα οποία συμφωνούν 100% με την καρτέλα Επισκόπησης.

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

  let debugInfo = [];

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
            debugInfo.push(`${modelName} Error: ` + lastErrText);
          }
        } catch (e) {
          clearTimeout(timeoutId);
          debugInfo.push(`${modelName} Exception: ` + e.message);
        }
      }
      
      if (response && response.ok) {
        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        return new Response(text, { headers: corsHeaders });
      } else {
        return new Response(JSON.stringify({ error: "Gemini API failure", debug: debugInfo }), { 
          status: response && response.status ? response.status : 500, 
          headers: corsHeaders 
        });
      }
    } else {
      debugInfo.push("GEMINI_API_KEY is not defined in env.");
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing from environment", debug: debugInfo }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, debug: debugInfo }), { 
      status: 500,
      headers: corsHeaders
    });
  }
}
