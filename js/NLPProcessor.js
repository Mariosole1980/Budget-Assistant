window.NLPProcessor = (function() {
  const INTENT_CORPORA = {
    add_transaction: ["βαλε", "εδωσα", "εσκασα", "πληρωσα", "εφυγαν", "γεμισα", "αγορασα", "πηρα", "εφαγα", "ξοδεψα", "add", "spent"],
    affordability: ["μπορω", "αντεχω", "να παρω", "φτανουν", "βγαινω", "εξω", "afford", "buy"],
    insights: ["πως παω", "τι εχω", "how am i", "insights"],
    category_correction: ["οχι", "λαθος", "αλλο", "αλλαξε", "ειναι", "ανηκει", "κατηγορια", "wrong", "change", "no"]
  };

  const NEGATION_WORDS = ["δεν", "μη", "μην", "ποτε", "ουτε"];

  // Note: normalizeGreekString should either be duplicated here or we rely on app.js.
  // Since app.js loads after, we'll redefine it locally or use window if we want to be safe,
  // but for strict modularity, NLPProcessor should have its own normalization logic to not depend on app.js.
  function normalize(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿€]/g, "")
      .trim();
  }

  function detectIntent(queryText) {
    const normQuery = normalize(queryText);
    const words = normQuery.split(/\s+/);
    const hasNegation = words.some(w => NEGATION_WORDS.includes(w));
    let bestIntent = 'unknown';
    let intentScore = 0;
    
    for (const [intent, keywords] of Object.entries(INTENT_CORPORA)) {
      let score = 0;
      for (const kw of keywords) {
        if (normQuery.includes(kw)) score += kw.length;
      }
      if (score > intentScore) {
        intentScore = score;
        bestIntent = intent;
      }
    }
    
    if (hasNegation) {
      if (bestIntent === 'add_transaction' || bestIntent === 'affordability') {
        bestIntent = 'clarification_needed';
      }
    }

    if (bestIntent === 'unknown') {
      const hasNumber = words.some(w => !isNaN(parseFloat(w)));
      if (hasNumber && words.length <= 5) {
        bestIntent = 'add_transaction';
      }
    }
    return { intent: bestIntent, confidence: intentScore > 0 ? 80 : 0 };
  }

  function extractEntities(queryText, intent) {
    const numMatch = queryText.replace(/\./g, '').match(/\d+/);
    const amount = numMatch ? parseInt(numMatch[0], 10) : null;
    let merchant = null;

    if (intent === 'add_transaction') {
      let noteText = queryText.replace(/\d+/g, '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿€]/g, '').trim();
      const stopWords = ['βαλε', 'προσθεσε', 'καταχωρησε', 'χρεωσε', 'ξοδεψα', 'εδωσα', 'πληρωσα', 'ευρω', 'euro', 'σε', 'στο', 'στην', 'στα', 'στον', 'για', 'απο', 'ενα', 'μια', 'add', 'spent', 'paid', 'for', 'on', 'euros'];
      const words = noteText.split(/\s+/).filter(w => w.length > 1 && !stopWords.includes(normalize(w)));
      merchant = words.join(' ') || null;
    }
    return { amount, merchant, note: merchant };
  }

  return {
    detectIntent,
    extractEntities
  };
})();
