window.AIEngine = (function () {
  async function process(input, systemState) {
    window.AIDebugLog = window.AIDebugLog || [];
    const log = (msg) => {
      const time = new Date().toLocaleTimeString();
      window.AIDebugLog.push(`[${time}] [AIEngine] ${msg}`);
      if (window.AI_DEBUG) console.log(`[AIEngine] ${msg}`);
    };

    log(`Processing input: "${input}"`);

    // Check for sum/report queries first
    const normInput = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (normInput.includes('ποσα') || normInput.includes('ποσο') || normInput.includes('how much') || normInput.includes('τι ')) {
      log("Detected sum/report query, running fallback");
      return { action: 'FALLBACK_SUM_QUERY', intent: 'sum_query', entities: null };
    }

    // 1. TRY ONLINE AI FIRST (Gemini)
    if (window.OnlineAIProvider) {
      log("Attempting Online AI Provider...");
      const allCats = systemState.categories || [];
      const allAccounts = systemState.accounts || [];
      const allSubcats = systemState.subcategories || [];
      const todayIso = new Date().toISOString().split('T')[0];
      const onlineResult = await window.OnlineAIProvider.processQuery(input, allCats, allAccounts, allSubcats, todayIso);

      if (onlineResult && onlineResult.amount) {
        log(`Online AI parsed successfully: Amount=${onlineResult.amount}, Merchant=${onlineResult.merchant}, Category=${onlineResult.category}, Type=${onlineResult.type}, Account=${onlineResult.account_from}, Date=${onlineResult.date}`);

        // ONLINE-TO-OFFLINE LEARNING LOOP
        if (onlineResult.merchant && onlineResult.category && window.MemoryEngine && window.MemoryEngine.addTokenToMemory) {
          window.MemoryEngine.addTokenToMemory(onlineResult.merchant, onlineResult.category, 3.0);
          log(`Learned token offline: "${onlineResult.merchant}" -> "${onlineResult.category}"`);
        }

        const inference = window.MemoryEngine ? window.MemoryEngine.inferCategoryProbabilities(onlineResult.merchant || 'Γενικό Έξοδο', onlineResult.amount, systemState) : {};
        // Force the predicted category from the AI, but keep habit UI flow
        if (onlineResult.category) {
          inference[onlineResult.category] = (inference[onlineResult.category] || 0) + 10;
        }

        const decision = window.DecisionEngine ? window.DecisionEngine.getDecisionPolicy(inference) : { action: 'AUTO_ACCEPT', bestCategory: onlineResult.category };
        // Override best category with the one AI found
        decision.bestCategory = onlineResult.category || decision.bestCategory;

        log(`Decision generated: Action=${decision.action}, BestCategory=${decision.bestCategory}`);

        return {
          action: decision.action,
          intent: 'add_transaction',
          entities: {
            amount: onlineResult.amount,
            merchant: onlineResult.merchant,
            type: onlineResult.type || 'expense',
            category: onlineResult.category,
            subcategory: onlineResult.subcategory || null,
            account_from: onlineResult.account_from || null,
            date: onlineResult.date || null
          },
          decision
        };
      } else {
        log("Online AI failed to return a valid result with amount.");
      }
    } else {
      log("OnlineAIProvider is not available.");
    }

    // 2. OFFLINE FALLBACK
    log("Running offline NLP processor fallback...");
    const nlpResult = window.NLPProcessor.detectIntent(input);
    const intent = nlpResult.intent;
    log(`Offline detected intent: ${intent}`);

    if (intent === 'add_transaction') {
      const entities = window.NLPProcessor.extractEntities(input, intent);
      log(`Offline extracted entities: ${JSON.stringify(entities)}`);

      if (entities.amount === null) {
        log("Offline amount is missing.");
        return { action: 'MISSING_AMOUNT', intent, entities };
      }

      if (!entities.merchant) {
        log("Offline merchant is missing.");
        return { action: 'MISSING_MERCHANT', intent, entities };
      }

      const inference = window.MemoryEngine.inferCategoryProbabilities(entities.merchant, entities.amount, systemState);
      const decision = window.DecisionEngine.getDecisionPolicy(inference);
      log(`Offline decision generated: Action=${decision.action}, BestCategory=${decision.bestCategory}`);

      return {
        action: decision.action,
        intent,
        entities,
        decision
      };
    }

    // Default Clarification Needed
    log("Default fallback: CLARIFICATION_NEEDED");
    return { action: 'CLARIFICATION_NEEDED', intent, entities: null };
  }

  return {
    process
  };
})();
