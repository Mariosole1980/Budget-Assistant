const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Patch isAuthRedirect popup callback (if not already patched)
const targetRegex = /(const isAuthRedirect = hashStr\.includes\('access_token='\)[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*;)\s*(\/\/ Popup callback detection:)?/;
const match = content.match(targetRegex);
if (match) {
  const targetStr = match[1];
  if (!content.includes("pwa-oauth-channel")) {
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
    const splitIndex = content.indexOf(targetStr) + targetStr.length;
    content = content.substring(0, splitIndex) + replacementCode + content.substring(splitIndex);
    console.log("Success: isAuthRedirect section patched.");
  } else {
    console.log("isAuthRedirect section already patched.");
  }
} else {
  console.log("isAuthRedirect section match failed.");
}

// 2. Patch handleGoogleAuth function
const googleAuthRegex = /async function handleGoogleAuth\(\) \{[\s\S]*?toggleLoader\(false\);\s*showAuthStatus\('❌ Σφάλμα: ' \+ \(err\.message \|\| 'Αποτυχία σύνδεσης με Google\.'\)\);\s*\}\s*\}/;
if (googleAuthRegex.test(content)) {
  const replacementGoogleAuth = `async function handleGoogleAuth() {
  if (!state.supabaseClient) return;
  clearAuthStatus();
  
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  
  if (isStandalone) {
    // Show splash loader on the main standalone screen
    toggleLoader(true);
    
    try {
      // Get OAuth redirect URL from Supabase without redirecting the main page
      const { data, error } = await state.supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
          skipBrowserRedirect: true
        }
      });
      if (error) throw error;
      
      if (data && data.url) {
        // Open the OAuth login flow in a new browser tab/window
        const loginWindow = window.open(data.url, '_blank');
        if (!loginWindow) {
          // If popup is blocked, fallback to normal redirect
          toggleLoader(false);
          await state.supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: window.location.origin + window.location.pathname
            }
          });
        }
      }
    } catch (err) {
      console.error('Google auth standalone flow failed:', err);
      toggleLoader(false);
      showAuthStatus('❌ Σφάλμα: ' + (err.message || 'Αποτυχία σύνδεσης με Google.'));
    }
  } else {
    // Standard browser behavior: redirect current tab
    toggleLoader(true);
    try {
      const { error } = await state.supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error('Google auth redirect failed:', err);
      toggleLoader(false);
      showAuthStatus('❌ Σφάλμα: ' + (err.message || 'Αποτυχία σύνδεσης με Google.'));
    }
  }
}`;

  content = content.replace(googleAuthRegex, replacementGoogleAuth);
  console.log("Success: handleGoogleAuth section patched.");
} else {
  console.log("handleGoogleAuth section match failed (might be already patched).");
}

fs.writeFileSync(filePath, content, 'utf8');
