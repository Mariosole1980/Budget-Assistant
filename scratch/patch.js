const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// Use regex to match the definition of isAuthRedirect and replacement site
const targetRegex = /(const isAuthRedirect = hashStr\.includes\('access_token='\)[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*;)\s*(\/\/ Popup callback detection:)?/;

const match = content.match(targetRegex);
if (match) {
  console.log("Matched: ", match[1]);
  
  const replacementCode = `

  // Popup callback detection: if this window was opened as a popup tab and has auth redirect params
  const isPopupTab = window.opener && window.opener !== window;
  if (isPopupTab && isAuthRedirect) {
    logAuthDebug('Detected popup callback tab. Processing auth...');
    const authChannel = new BroadcastChannel('pwa-oauth-channel');
    
    // Set a timeout to auto-close in case state changes take too long
    const autoCloseTimeout = setTimeout(() => {
      logAuthDebug('Popup close timeout reached. Closing tab.');
      window.close();
    }, 8000);
    
    state.supabaseClient.auth.onAuthStateChange((event, session) => {
      logAuthDebug(\`Popup auth state change: \${event}\`);
      if (session) {
        clearTimeout(autoCloseTimeout);
        authChannel.postMessage({ type: 'OAUTH_SUCCESS' });
        setTimeout(() => {
          window.close();
        }, 300);
      }
    });
    return; // Halt further app initialization in the popup tab
  }

  // Main window: Listen for OAuth success from callback popups
  const authChannel = new BroadcastChannel('pwa-oauth-channel');
  authChannel.onmessage = (event) => {
    if (event.data && event.data.type === 'OAUTH_SUCCESS') {
      logAuthDebug('OAuth successful in popup tab. Reloading PWA window...');
      window.location.reload();
    }
  };
  
  // Storage event listener fallback (for browsers without BroadcastChannel support or safety)
  window.addEventListener('storage', (event) => {
    if (event.key && (event.key === 'sb-money-manager-auth-token' || event.key.includes('auth-token'))) {
      logAuthDebug('Auth token updated in storage. Reloading PWA window...');
      window.location.reload();
    }
  });

`;

  // We replace from the end of match[1]
  const targetStr = match[1];
  if (!content.includes("pwa-oauth-channel")) {
    const splitIndex = content.indexOf(targetStr) + targetStr.length;
    const newContent = content.substring(0, splitIndex) + replacementCode + content.substring(splitIndex);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log("Success: app.js patched successfully.");
  } else {
    console.log("Already patched.");
  }
} else {
  console.log("Regex match failed.");
}
