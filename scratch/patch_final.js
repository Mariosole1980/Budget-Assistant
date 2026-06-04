const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace the popup detection block inside initSupabaseAuth
const oldPopupBlock = `  // Popup callback detection: if this window was opened as a popup tab and has auth redirect params
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
  });`;

const newPopupBlock = `  // Popup callback detection: if this window is a callback window redirect tab
  const isPopupTab = window.location.search.includes('oauth_callback=true');
  if (isPopupTab && isAuthRedirect) {
    logAuthDebug('Detected PWA OAuth callback tab. Processing auth...');
    const authChannel = new BroadcastChannel('pwa-oauth-channel');
    
    // Set a timeout to auto-close in case state changes take too long
    const autoCloseTimeout = setTimeout(() => {
      logAuthDebug('Popup callback close timeout reached. Closing tab.');
      window.close();
    }, 15000);
    
    state.supabaseClient.auth.onAuthStateChange((event, session) => {
      logAuthDebug(\`Popup auth state change: \${event}\`);
      if (session) {
        clearTimeout(autoCloseTimeout);
        authChannel.postMessage({ type: 'OAUTH_SUCCESS' });
        // Set fallback in localStorage to trigger storage event on opener
        localStorage.setItem('pwa_oauth_success', Date.now().toString());
        setTimeout(() => {
          window.close();
        }, 600);
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
  
  // Storage event listener fallback (handles cross-process localStorage changes)
  window.addEventListener('storage', (event) => {
    if (event.key === 'pwa_oauth_success') {
      logAuthDebug('OAuth success via storage event. Reloading PWA window...');
      localStorage.removeItem('pwa_oauth_success');
      window.location.reload();
    }
  });`;

// Normalize content and blocks
content = content.replace(/\r\n/g, '\n');
const normOldBlock = oldPopupBlock.replace(/\r\n/g, '\n');
const normNewBlock = newPopupBlock.replace(/\r\n/g, '\n');

if (content.includes(normOldBlock)) {
  content = content.replace(normOldBlock, normNewBlock);
  console.log("Success: initSupabaseAuth section replaced.");
} else {
  console.log("Error: initSupabaseAuth target block not found.");
}

// 2. Replace handleGoogleAuth block
const googleAuthRegex = /async function handleGoogleAuth\(\) \{[\s\S]*?showAuthStatus\('❌ Σφάλμα: ' \+ \(err\.message \|\| 'Αποτυχία σύνδεσης με Google\.'\)\);\s*\}\s*\}\s*\}/;
const replacementGoogleAuth = `async function handleGoogleAuth() {
  if (!state.supabaseClient) return;
  clearAuthStatus();
  
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  
  if (isStandalone) {
    // Open a blank window synchronously inside the click handler to bypass popup blocker!
    const loginWindow = window.open('about:blank', '_blank');
    if (!loginWindow) {
      showAuthStatus('⚠️ Παρακαλώ επιτρέψτε τα αναδυόμενα παράθυρα (popups) για τη σύνδεση.');
      return;
    }
    
    // Show splash loader on the main standalone screen
    toggleLoader(true);
    
    try {
      // Get OAuth redirect URL from Supabase without redirecting the main page
      const { data, error } = await state.supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname + '?oauth_callback=true',
          skipBrowserRedirect: true
        }
      });
      if (error) throw error;
      
      if (data && data.url) {
        // Redirect the blank window to the Google auth URL
        loginWindow.location.href = data.url;
      } else {
        loginWindow.close();
        throw new Error('No redirect URL returned');
      }
    } catch (err) {
      console.error('Google auth standalone flow failed:', err);
      if (loginWindow) loginWindow.close();
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

if (googleAuthRegex.test(content)) {
  content = content.replace(googleAuthRegex, replacementGoogleAuth);
  console.log("Success: handleGoogleAuth section replaced.");
} else {
  console.log("Error: handleGoogleAuth target regex not found.");
}

// Write back with CRLF Windows newlines
fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
