window.DecisionEngine = (function() {
  function getDecisionPolicy(inference) {
    if (!inference) return { action: 'ASK_CLARIFICATION' };
    
    const { entropy, bestScore, secondBestScore, bestCategory, reasons, habitStrength } = inference;
    
    // 1. High Entropy -> ASK
    if (entropy > 0.7) {
      return { action: 'ASK_CLARIFICATION', bestCategory, reasons, confidence: bestScore, habitStrength };
    }
    
    // 2. Margin Check
    const margin = bestScore - secondBestScore;
    
    if (bestScore > 0.90 && margin > 0.3) {
      return { action: 'SOFT_CONFIRM', bestCategory, reasons, confidence: bestScore, habitStrength };
    }
    
    if (bestScore > 0.60 && margin > 0.1) {
      return { action: 'SUGGEST_HABIT', bestCategory, reasons, confidence: bestScore, habitStrength };
    }
    
    return { action: 'ASK_CLARIFICATION', bestCategory, reasons, confidence: bestScore, habitStrength };
  }

  return {
    getDecisionPolicy
  };
})();
