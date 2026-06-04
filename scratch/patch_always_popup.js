const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize newlines to \n
content = content.replace(/\r\n/g, '\n');

// 1. Modify handleGoogleAuth to ALWAYS use the popup flow
const googleAuthRegex = /async function handleGoogleAuth\(\) \{[\s\S]*?showAuthStatus\('❌ Σφάλμα: ' \+ \(err\.message \|\| 'Αποτυχία σύνδεσης με Google\.'\)\);\s*\}\s*\}\s*\}\s*\}/;
const replacementGoogleAuth = `async function handleGoogleAuth() {
  if (!state.supabaseClient) return;
  clearAuthStatus();
  
  // Open a blank window synchronously inside the click handler to bypass popup blocker!
  const loginWindow = window.open('about:blank', '_blank');
  if (!loginWindow) {
    showAuthStatus('⚠️ Παρακαλώ επιτρέψτε τα αναδυόμενα παράθυρα (popups) για τη σύνδεση.');
    return;
  }
  
  // Show splash loader on the main screen
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
    console.error('Google auth flow failed:', err);
    if (loginWindow) loginWindow.close();
    toggleLoader(false);
    showAuthStatus('❌ Σφάλμα: ' + (err.message || 'Αποτυχία σύνδεσης με Google.'));
  }
}`;

if (googleAuthRegex.test(content)) {
  content = content.replace(googleAuthRegex, replacementGoogleAuth);
  console.log("Success: handleGoogleAuth modified to always use popup.");
} else {
  // Try another regex in case it was modified
  const fallbackRegex = /async function handleGoogleAuth\(\) \{[\s\S]*?\}\n\nasync function handleLogout/;
  const replacementGoogleAuthWithWrapper = replacementGoogleAuth + "\n\nasync function handleLogout";
  if (fallbackRegex.test(content)) {
    content = content.replace(fallbackRegex, replacementGoogleAuthWithWrapper);
    console.log("Success: handleGoogleAuth modified using fallback regex.");
  } else {
    console.log("Error: handleGoogleAuth match failed.");
  }
}

fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
