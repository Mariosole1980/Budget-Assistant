window.MemoryEngine = (function() {
  const SEMANTIC_CATEGORY_MAPPING = {
    '🚗 ΑΥΤΟΚΙΝΗΤΟ': ['βενζινη', 'καυσιμα', 'αμαξι', 'διοδια', 'παρκινγκ', 'πρατηριο', 'fuel', 'gas', 'shell', 'avin', 'bp', 'eko', 'εκο'],
    '🛒 ΔΙΑΤΡΟΦΗ': ['σουπερμαρκετ', 'supermarket', 'market', 'καφε', 'φαγητο', 'delivery', 'ντελιβερι', 'εστιατοριο', 'ταβερνα', 'φαγαδικο', 'γλυκο', 'σουβλακια', 'πιτσα'],
    '🏠 ΣΠΙΤΙ': ['ρευμα', 'δεη', 'νερο', 'ευδαπ', 'τηλεφωνο', 'κοινοχρηστα', 'ενοικιο', 'ιντερνετ', 'internet', 'cosmote', 'vodafone', 'nova', 'σπιτι'],
    '❤️ ΥΓΕΙΑ': ['γιατρο', 'φαρμακειο', 'υγεια', 'εξετασεις', 'νοσοκομειο', 'φαρμακα'],
    '🎉 ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ': ['ποτο', 'μπυρες', 'σινεμα', 'εξοδος', 'ταινια', 'θεατρο', 'μπαρ', 'κλαμπ', 'διασκεδαση'],
    '👕 ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ': ['κομμωτηριο', 'κουρειο', 'νυχια', 'ρουχα', 'παπουτσια'],
    '🏋️ ΓΥΜΝΑΣΤΗΡΙΟ': ['γυμναστηριο', 'συνδρομη', 'αθλητισμος']
  };

  function normalize(str) {
    if (!str) return '';
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿€]/g, "").trim();
  }

  function editDistance(s1, s2) {
    let costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i == 0) costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  function stringSimilarity(s1, s2) {
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;
    return (longer.length - editDistance(longer, shorter)) / parseFloat(longer.length);
  }

  
  function getLearnedMappings() {
    try {
      return JSON.parse(localStorage.getItem('ai_learned_mappings')) || {};
    } catch(e) {
      return {};
    }
  }

  function addTokenToMemory(merchant, category, weight = 3.0) {
    if (!merchant || !category) return;
    const normMerchant = normalize(merchant);
    const mappings = getLearnedMappings();
    
    if (!mappings[normMerchant]) {
      mappings[normMerchant] = {};
    }
    
    // Increment the learned weight
    mappings[normMerchant][category] = (mappings[normMerchant][category] || 0) + weight;
    
    // Cap the weight at a reasonable maximum (e.g., 10) so it doesn't spiral out of control
    if (mappings[normMerchant][category] > 10) {
        mappings[normMerchant][category] = 10;
    }
    
    localStorage.setItem('ai_learned_mappings', JSON.stringify(mappings));
    console.log(`MemoryEngine learned: "${normMerchant}" -> ${category} (weight: ${mappings[normMerchant][category]})`);
  }
  function inferCategoryProbabilities(merchant, amount, systemState) {
    const expenseCats = (systemState.categories || []).filter(c => c.type === 'expense').map(c => c.name);
    if (expenseCats.length === 0) return null;
    
    let scores = {};
    expenseCats.forEach(c => scores[c] = 0.001); // base smooth
  
    let reasons = [];
    
    // 1. Semantic Signal
    const normMerchant = normalize(merchant || '');
    for (const [cat, keywords] of Object.entries(SEMANTIC_CATEGORY_MAPPING)) {
      if (scores[cat] !== undefined) {
        for (const kw of keywords) {
          if (normMerchant.includes(kw)) {
            scores[cat] += 2.0;
            reasons.push({ type: 'semantic', weight: 2.0, text: `Η λέξη "${kw}" υποδεικνύει ${cat}` });
            break;
          }
        }
      }
    }
  
    
    // 1.5 Online-to-Offline Learned Signal
    const learnedMappings = getLearnedMappings();
    if (learnedMappings[normMerchant]) {
      for (const [cat, weight] of Object.entries(learnedMappings[normMerchant])) {
        if (scores[cat] !== undefined) {
          scores[cat] += weight;
          reasons.push({ type: 'learned', weight: weight, text: `To AI το έχει μάθει παλιότερα: +${weight}` });
        }
      }
    }

    // 2. History Signal with Recency Decay
    let hasHistory = false;
    if (merchant && systemState.financialMemory && systemState.financialMemory.merchantTokens) {
      const tokens = merchant.split(' ').filter(w => w.length > 2);
      tokens.push(merchant);
      const storedTokens = Object.keys(systemState.financialMemory.merchantTokens);
      const today = new Date();
      
      for (let st of storedTokens) {
        let maxSim = 0;
        for (let it of tokens) {
          const sim = stringSimilarity(normalize(it), normalize(st));
          if (sim > maxSim) maxSim = sim;
        }
        
        if (maxSim > 0.7) {
          hasHistory = true;
          const entries = systemState.financialMemory.merchantTokens[st];
          entries.forEach(entry => {
            if (scores[entry.category] !== undefined) {
              const daysAgo = (today - new Date(entry.lastUsed)) / (1000 * 60 * 60 * 24);
              const recencyWeight = Math.max(0.1, Math.exp(-daysAgo / 30));
              const scoreBoost = entry.count * recencyWeight * maxSim;
              scores[entry.category] += scoreBoost;
              if (scoreBoost > 0.5) {
                 reasons.push({ type: 'history', weight: scoreBoost, text: `Ιστορικό: Βρέθηκαν ${entry.count} καταχωρήσεις για "${st}"` });
              }
            }
          });
        }
      }
    }
    
    // Normalize
    let totalScore = 0;
    for (let cat in scores) totalScore += scores[cat];
    
    let P = {};
    for (let cat in scores) P[cat] = scores[cat] / totalScore;
    
    // Entropy = -Σ p log(p) / log(N)
    const N = expenseCats.length;
    let entropy = 0;
    for (let cat in P) {
      if (P[cat] > 0) entropy -= P[cat] * Math.log(P[cat]);
    }
    entropy = entropy / Math.log(N);
    
    // Sort
    const sorted = Object.entries(P).sort((a,b) => b[1] - a[1]);
    const bestCategory = sorted[0][0];
    const bestScore = sorted[0][1];
    const secondBestScore = sorted[1] ? sorted[1][1] : 0;
    
    if (hasHistory && bestScore > 0.5) {
       reasons.push({ type: 'habit', weight: bestScore, text: `Habit Strength: ${(bestScore*100).toFixed(0)}%` });
    }
  
    return { probabilities: P, entropy, bestCategory, bestScore, secondBestScore, reasons, habitStrength: bestScore };
  }

  return {
    inferCategoryProbabilities,
    addTokenToMemory
  };
})();
