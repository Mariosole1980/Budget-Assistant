window.OnlineAIProvider = (function() {
  
  async function getAuthHeader() {
    if (window.state && window.state.supabaseClient) {
      try {
        const { data } = await window.state.supabaseClient.auth.getSession();
        if (data && data.session) {
          return `Bearer ${data.session.access_token}`;
        }
      } catch (e) {
        console.error('Failed to get session for auth header:', e);
      }
    }
    return '';
  }

  function getTargetUrl() {
    if (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' || 
      window.location.protocol.startsWith('capacitor') || 
      (window.location.protocol.startsWith('http') && !window.location.hostname.includes('pages.dev'))
    ) {
      return 'https://budget-assistant-pwa.pages.dev/api/ai';
    }
    return '/api/ai';
  }

  async function processQuery(queryText, categoriesArr) {
    const categoriesStr = categoriesArr.map(c => c.name).join(', ');
    
    window.AIDebugLog = window.AIDebugLog || [];
    const log = (msg) => {
      const time = new Date().toLocaleTimeString();
      window.AIDebugLog.push(`[${time}] ${msg}`);
      console.log(`[OnlineAIProvider] ${msg}`);
    };
    
    log(`Starting AI query: "${queryText}"`);
    const targetUrl = getTargetUrl();
    log(`Target URL: ${targetUrl}`);
    
    try {
      const authHeader = await getAuthHeader();
      const headers = { 'Content-Type': 'application/json' };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      const response = await fetch(targetUrl, {
          method: 'POST',
          headers: headers,
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

  async function processAdvisorQuery(queryText, stats, history = []) {
    window.AIDebugLog = window.AIDebugLog || [];
    const log = (msg) => {
      const time = new Date().toLocaleTimeString();
      window.AIDebugLog.push(`[${time}] ${msg}`);
      console.log(`[OnlineAIProvider] ${msg}`);
    };
    
    log(`Starting AI Advisor query: "${queryText}" with history length: ${history.length}`);
    const targetUrl = getTargetUrl();
    log(`Target URL: ${targetUrl}`);
    
    try {
      const authHeader = await getAuthHeader();
      const headers = { 'Content-Type': 'application/json' };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      const response = await fetch(targetUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ mode: 'advisor', queryText, stats, history })
      });
      
      log(`Advisor Response status: ${response.status}`);
      
      if (!response.ok) {
          const errText = await response.text();
          log(`Backend AI Advisor failed. Response: ${errText}`);
          try {
            return JSON.parse(errText);
          } catch(e) {
            return { error: errText };
          }
      }
      
      const data = await response.json();
      log(`Successfully parsed JSON Advisor response: ${JSON.stringify(data)}`);
      return data;
    } catch(e) {
        log(`Network or parsing error in Advisor: ${e.message || e}`);
        return null;
    }
  }

  return {
    processQuery,
    processAdvisorQuery
  };
})();
