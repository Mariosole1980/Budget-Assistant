const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize newlines to \n
content = content.replace(/\r\n/g, '\n');

// 1. Replace the popup detection block to inject the gorgeous success button UI
const targetRegex = /\/\/ Popup callback detection: if this window is a callback window redirect tab[\s\S]*?\/\/ Main window: Listen for OAuth success from callback popups/;

const newPopupUIBlock = `// Popup callback detection: if this window is a callback window redirect tab
  const isPopupTab = window.location.search.includes('oauth_callback=true');
  if (isPopupTab && isAuthRedirect) {
    logAuthDebug('Detected PWA OAuth callback tab. Processing auth...');
    const authChannel = new BroadcastChannel('pwa-oauth-channel');
    
    // Set a timeout to auto-close in case state changes take too long
    const autoCloseTimeout = setTimeout(() => {
      logAuthDebug('Popup callback close timeout reached. Closing tab.');
      window.close();
    }, 20000);
    
    state.supabaseClient.auth.onAuthStateChange((event, session) => {
      logAuthDebug(\`Popup auth state change: \${event}\`);
      if (session) {
        clearTimeout(autoCloseTimeout);
        authChannel.postMessage({ type: 'OAUTH_SUCCESS' });
        // Set fallback in localStorage to trigger storage event on opener
        localStorage.setItem('pwa_oauth_success', Date.now().toString());
        
        // Render a premium success UI inside the loader overlay with a guided button
        const loaderDiv = document.getElementById('auth-loading-state');
        if (loaderDiv) {
          loaderDiv.innerHTML = \`
            <style>
              @keyframes pulseBtn {
                0%, 100% { transform: scale(1); box-shadow: 0 4px 15px rgba(67, 97, 238, 0.4); }
                50% { transform: scale(1.05); box-shadow: 0 6px 22px rgba(67, 97, 238, 0.6); }
              }
              .success-pulse-icon {
                font-size: 4.5rem;
                color: #06d6a0;
                text-shadow: 0 0 20px rgba(6, 214, 160, 0.4);
                margin-bottom: 20px;
                animation: pulseLogo 1.5s infinite ease-in-out;
              }
            </style>
            <div class="success-pulse-icon"><i class="fa-solid fa-circle-check"></i></div>
            <h3 style="color: #fff; margin-bottom: 12px; font-weight: 700; font-size: 22px; text-align: center;">Σύνδεση Επιτυχής!</h3>
            <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin-bottom: 26px; text-align: center; max-width: 280px; line-height: 1.5;">Είστε έτοιμοι! Πατήστε το κουμπί για να επιστρέψετε στην εφαρμογή σας.</p>
            <a href="index.html" target="_self" style="display: inline-block; background: var(--accent); color: #fff; padding: 12px 30px; border-radius: 50px; font-weight: 600; text-decoration: none; font-size: 15px; box-shadow: 0 4px 15px rgba(67, 97, 238, 0.4); animation: pulseBtn 1.5s infinite ease-in-out; transition: all 0.2s;" onclick="setTimeout(() => window.close(), 1200)">Επιστροφή στην Εφαρμογή</a>
          \`;
        }
      }
    });
    return; // Halt further app initialization in the popup tab
  }

  // Main window: Listen for OAuth success from callback popups`;

if (targetRegex.test(content)) {
  content = content.replace(targetRegex, newPopupUIBlock);
  console.log("Success: popup callback UI injected.");
} else {
  console.log("Error: Target regex for popup callback block not found.");
}

fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
