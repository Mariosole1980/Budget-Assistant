window.OnlineAIProvider = (function() {
  
  async function processQuery(queryText, categoriesArr) {
    const categoriesStr = categoriesArr.map(c => c.name).join(', ');
    
    window.AIDebugLog = window.AIDebugLog || [];
    const log = (msg) => {
      const time = new Date().toLocaleTimeString();
      window.AIDebugLog.push(`[${time}] ${msg}`);
      console.log(`[OnlineAIProvider] ${msg}`);
    };
    
    log(`Starting AI query: "${queryText}"`);
    
    // Always call the production Cloudflare Pages endpoint to ensure the GEMINI_API_KEY is available
    const targetUrl = 'https://budget-assistant-pwa.pages.dev/api/ai';
    log(`Target URL: ${targetUrl}`);
    
    try {
      const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queryText, categoriesStr })
      });
      
      log(`Response status: ${response.status}`);
      
      if (!response.ok) {
          const errText = await response.text();
          log(`Backend AI failed. Response: ${errText}`);
          return null;
      }
      
      const data = await response.json();
      log(`Successfully parsed JSON: ${JSON.stringify(data)}`);
      return data;
    } catch(e) {
        log(`Network or parsing error: ${e.message || e}`);
        return null;
    }
  }

  return {
    processQuery
  };
})();
