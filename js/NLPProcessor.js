(function (root) {
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

  function parseLocalizedAmount(rawStr) {
    if (!rawStr) return null;
    let s = rawStr.toString().trim();

    // Check for "k" or "χιλ" multiplier e.g. "50k", "50 k", "50χιλ", "50 χιλιάδες"
    const kMatch = s.match(/(\d+(?:[.,]\d+)?)\s*(?:k|χιλ|χιλιαδες|χιλιάδες|thousand)/i);
    if (kMatch) {
      const base = parseFloat(kMatch[1].replace(',', '.'));
      if (!isNaN(base)) return base * 1000;
    }

    // Extract number candidate string e.g. "50.000,50" or "50,000.00" or "50.000" or "50000" or "50,50"
    const candidateMatch = s.match(/\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?/);
    if (!candidateMatch) return null;
    let numStr = candidateMatch[0];

    // Case 1: EU thousands with dot and optional decimal comma: e.g. "50.000" or "1.500.000" or "50.000,50"
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(numStr)) {
      numStr = numStr.replace(/\./g, '').replace(',', '.');
      const val = parseFloat(numStr);
      return isNaN(val) ? null : val;
    }

    // Case 2: US thousands with comma and optional decimal dot: e.g. "50,000" or "1,500,000" or "50,000.50"
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(numStr)) {
      numStr = numStr.replace(/,/g, '');
      const val = parseFloat(numStr);
      return isNaN(val) ? null : val;
    }

    // Case 3: Simple decimal with comma: e.g. "50,50"
    if (/^\d+,\d+$/.test(numStr)) {
      numStr = numStr.replace(',', '.');
      const val = parseFloat(numStr);
      return isNaN(val) ? null : val;
    }

    // Case 4: Standard integer or float: e.g. "50" or "50000" or "50.5"
    const val = parseFloat(numStr.replace(',', '.'));
    return isNaN(val) ? null : val;
  }

  function extractEntities(queryText, intent) {
    const amount = parseLocalizedAmount(queryText);
    let merchant = null;

    if (intent === 'add_transaction') {
      let noteText = queryText.replace(/\d+/g, '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿€]/g, '').trim();
      const stopWords = ['βαλε', 'προσθεσε', 'καταχωρησε', 'χρεωσε', 'ξοδεψα', 'εδωσα', 'πληρωσα', 'ευρω', 'euro', 'σε', 'στο', 'στην', 'στα', 'στον', 'για', 'απο', 'ενα', 'μια', 'add', 'spent', 'paid', 'for', 'on', 'euros'];
      const words = noteText.split(/\s+/).filter(w => w.length > 1 && !stopWords.includes(normalize(w)));
      merchant = words.join(' ') || null;
    }
    return { amount, merchant, note: merchant };
  }

  root.parseLocalizedAmount = parseLocalizedAmount;
  const instance = {
    detectIntent,
    extractEntities,
    parseLocalizedAmount
  };

  root.NLPProcessor = instance;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = instance;
  }
})(typeof window !== 'undefined' ? window : global);
