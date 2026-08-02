/**
 * IntentCorpus.js — L1-L3: Intent classification with similarity scoring
 *
 * L1: Seed corpus (15-20 examples per intent)
 * L2: Greek-normalized Jaccard similarity scoring
 * L3: Self-learning via Gemini Teacher (new_examples stored locally)
 */
window.IntentCorpus = (function () {
  const STORAGE_KEY = 'advisor_intent_corpus_v1';

  // ─── SEED CORPUS ──────────────────────────────────────────────────────────
  // Each intent maps to: { examples: [...], fn: "functionName" }
  // The fn maps to IntentRouter's INTENT_FUNCTION_MAP
  const SEED_CORPUS = {
    overspending: {
      fn: 'overspending',
      examples: [
        'που ξοδευω υπερβολικα',
        'που φευγουν τα λεφτα μου',
        'τι μου τρωει τον μισθο',
        'σε ποια κατηγορια χαλαω τα περισσοτερα',
        'που χανω τα χρηματα μου',
        'ποιες ειναι οι μεγαλυτερες δαπανες μου',
        'τι ξοδευω πολυ',
        'πού ξοδεύω τα περισσότερα',
        'where am i overspending',
        'where does my money go',
        'what costs the most',
        'biggest expenses',
        'what drains my budget',
        'spending too much',
        'που παει ο μισθος μου'
      ]
    },
    savings_advice: {
      fn: 'savings_advice',
      examples: [
        'πως να αποταμιευσω περισσοτερο',
        'πως να βαλω λεφτα στην ακρη',
        'πως να εχω περισσοτερα λεφτα',
        'πως να εχω αποταμιευσεις',
        'πως να κοψω εξοδα',
        'πως να εξοικονομησω χρηματα',
        'συμβουλες αποταμιευσης',
        'how can i save more',
        'how to save money',
        'tips to reduce spending',
        'savings advice',
        'how to cut expenses',
        'πως να μην ξοδευω τοσα πολλα',
        'θελω να αποταμιευσω'
      ]
    },
    forecast: {
      fn: 'forecast',
      examples: [
        'αν συνεχισω ετσι που θα ειμαι',
        'που θα ειμαι σε 5 χρονια',
        'τι θα γινει αν συνεχισω ετσι',
        'προβλεψη για το μελλον',
        'μελλοντικη εικονα',
        'if i continue like this where will i be',
        'financial forecast',
        '5 year forecast',
        'future projection',
        'what will my finances look like',
        'που θα φτασω αν κανω τα ιδια',
        'προοπτικη 5 ετων'
      ]
    },
    category_spending: {
      fn: 'category_spending',
      examples: [
        'που ξοδευω τα περισσοτερα',
        'ποιες κατηγοριες εξοδων εχω',
        'τοπ κατηγοριες εξοδων',
        'που παει ο μισθος',
        'ποιες ειναι οι δαπανες μου',
        'where do i spend the most',
        'top spending categories',
        'breakdown of expenses',
        'κατανομη εξοδων',
        'αναλυση κατηγοριων',
        'ποια κατηγορια εχει τα περισσοτερα εξοδα',
        'top categories'
      ]
    },
    budget_status: {
      fn: 'budget_status',
      examples: [
        'πως παει ο προϋπολογισμος μου',
        'οριο δαπανων',
        'budget status',
        'how is my budget',
        'τα ορια μου',
        'πεσα εκτος budget',
        'εχω ξεπερασει το οριο',
        'budget check',
        'προϋπολογισμος',
        'have i exceeded my budget',
        'am i over budget',
        'ποσο μου εχει απομεινει απο τον προϋπολογισμο'
      ]
    },
    what_if: {
      fn: 'what_if',
      examples: [
        'αν αγορασω',
        'αν παρω',
        'τι θα γινει αν αγορασω',
        'μπορω να αγορασω',
        'εχω λεφτα για',
        'what if i buy',
        'can i afford',
        'if i purchase',
        'should i buy',
        'αντεχω να αγορασω',
        'επιπτωσεις αγορας',
        'αν ξοδεψω'
      ]
    },
    milestone: {
      fn: 'milestone',
      examples: [
        'ποτε θα φτασω τα',
        'ποτε θα μαζεψω',
        'ποτε θα εχω',
        'when will i reach',
        'when will i save',
        'how long to save',
        'ποτε θα αποκτησω',
        'ποτε θα φτασω στο στοχο μου',
        'στοχος αποταμιευσης',
        'savings goal',
        'ποτε θα εχω αρκετα'
      ]
    },
    search_query: {
      fn: 'search_query',
      examples: [
        'ποσα ξοδεψα σε',
        'ποσα εχω δωσει για',
        'πόσα έχω ξοδέψει',
        'πόσα στο καφε',
        'how much did i spend on',
        'how much for',
        'show me transactions for',
        'δειξε μου τα εξοδα για',
        'ψαξε για',
        'search for',
        'ποσα φετος',
        'ποσα αυτον τον μηνα'
      ]
    }
  };

  // ─── GREEK NORMALIZATION ───────────────────────────────────────────────────
  function normalize(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/ς/g, 'σ')              // final sigma → sigma
      .replace(/[^a-zα-ω0-9\s]/g, '') // keep only letters/numbers/spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Light stemming: strip common Greek verb/noun endings
  function stem(word) {
    if (word.length <= 4) return word;
    return word
      .replace(/(ω|ει|εις|ετε|ουν|ε|α|ας|ες|οσ|οι|ους|ων|η|ης|ην|ησ)$/, '')
      .replace(/(ζω|σω|σει|σεις|σουν)$/, '') || word;
  }

  function tokenize(text) {
    const STOP = new Set(['στο', 'στη', 'στην', 'στα', 'στον', 'στους', 'στις',
      'για', 'απο', 'σε', 'με', 'και', 'που', 'πως', 'τι', 'τα', 'το', 'τον',
      'την', 'οι', 'τους', 'τις', 'μου', 'μας', 'the', 'a', 'an', 'in', 'on',
      'for', 'to', 'i', 'my', 'me', 'do', 'did', 'can', 'is', 'am', 'are']);
    return normalize(text)
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w))
      .map(stem);
  }

  // Jaccard similarity between two token sets
  function jaccard(tokensA, tokensB) {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    let inter = 0;
    setA.forEach(t => { if (setB.has(t)) inter++; });
    const union = setA.size + setB.size - inter;
    return union === 0 ? 0 : inter / union;
  }

  // ─── CORPUS PERSISTENCE ────────────────────────────────────────────────────
  function getCorpus() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored && typeof stored === 'object') return stored;
    } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(SEED_CORPUS)); // deep clone of seed
  }

  function saveCorpus(corpus) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(corpus));
    } catch (e) { console.warn('[IntentCorpus] Save failed:', e); }
  }

  // ─── L2: INTENT CLASSIFICATION ────────────────────────────────────────────
  // Returns { intent, fn, confidence } or null if below threshold
  function classifyIntent(queryText) {
    const THRESHOLD = 0.28; // Jaccard threshold
    const queryTokens = tokenize(queryText);
    if (queryTokens.length === 0) return null;

    const corpus = getCorpus();
    let bestIntent = null;
    let bestFn = null;
    let bestScore = 0;

    for (const [intent, data] of Object.entries(corpus)) {
      for (const example of data.examples) {
        const exTokens = tokenize(example);
        const score = jaccard(queryTokens, exTokens);
        if (score > bestScore) {
          bestScore = score;
          bestIntent = intent;
          bestFn = data.fn;
        }
      }
    }

    if (bestScore >= THRESHOLD) {
      return { intent: bestIntent, fn: bestFn, confidence: Math.round(bestScore * 100) };
    }
    return null;
  }

  // ─── L3: SELF-LEARNING FROM GEMINI ────────────────────────────────────────
  // Called after a successful Gemini Teacher response
  function learnFromGemini(intent, newExamples) {
    if (!intent || !newExamples || newExamples.length === 0) return;
    const corpus = getCorpus();

    if (!corpus[intent]) {
      corpus[intent] = { fn: intent, examples: [] };
    }

    let added = 0;
    newExamples.forEach(ex => {
      const normEx = normalize(ex);
      if (!normEx || normEx.length < 3) return;

      // Avoid near-duplicates (similarity > 0.85 with existing)
      const exTokens = tokenize(normEx);
      const isDuplicate = corpus[intent].examples.some(existing => {
        return jaccard(tokenize(existing), exTokens) > 0.85;
      });

      if (!isDuplicate) {
        corpus[intent].examples.push(normEx);
        added++;
      }
    });

    if (added > 0) {
      saveCorpus(corpus);
      console.log(`[IntentCorpus] Learned ${added} new examples for intent "${intent}"`);
    }
    return added;
  }

  // ─── L3: SELF-LEARNING FROM USER ─────────────────────────────────────────
  // Called when user explicitly confirms an intent or corrects the system
  // Higher confidence than Gemini — user is ground truth
  function learnFromUser(queryText, intent) {
    if (!queryText || !intent) return;
    const corpus = getCorpus();

    if (!corpus[intent]) {
      corpus[intent] = { fn: intent, examples: [] };
    }

    const normQuery = normalize(queryText);
    const queryTokens = tokenize(normQuery);

    const isDuplicate = corpus[intent].examples.some(ex => {
      return jaccard(tokenize(ex), queryTokens) > 0.75;
    });

    if (!isDuplicate) {
      corpus[intent].examples.push(normQuery);
      saveCorpus(corpus);
      console.log(`[IntentCorpus] User-confirmed: "${normQuery}" → "${intent}"`);
    }
  }

  // ─── STATS ─────────────────────────────────────────────────────────────────
  function getStats() {
    const corpus = getCorpus();
    const intents = Object.keys(corpus);
    const totalExamples = intents.reduce((sum, k) => sum + corpus[k].examples.length, 0);
    const seedTotal = Object.values(SEED_CORPUS).reduce((sum, v) => sum + v.examples.length, 0);
    return {
      totalIntents: intents.length,
      totalExamples,
      learnedExamples: totalExamples - seedTotal,
      intents: intents.map(k => ({ intent: k, count: corpus[k].examples.length }))
    };
  }

  // ─── RESET (debug) ──────────────────────────────────────────────────────────
  function resetToSeed() {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[IntentCorpus] Reset to seed corpus');
  }

  return {
    classifyIntent,
    learnFromGemini,
    learnFromUser,
    getStats,
    resetToSeed
  };
})();
