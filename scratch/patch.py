import os

file_path = r"c:\Users\mario\Desktop\money-manager\app.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Target block
target = """  const isAuthRedirect = hashStr.includes('access_token=') || 
                         hashStr.includes('id_token=') ||
                         hashStr.includes('error=') ||
                         searchStr.includes('code=') ||
                         searchStr.includes('error=');
                          
  let processingRedirect = isAuthRedirect;
  logAuthDebug(`Is redirect callback: ${isAuthRedirect}`);"""

# Since newlines might be \r\n, let's normalize target and content newlines
normalized_target = target.replace("\r\n", "\n")
normalized_content = content.replace("\r\n", "\n")

replacement = """  const isAuthRedirect = hashStr.includes('access_token=') || 
                         hashStr.includes('id_token=') ||
                         hashStr.includes('error=') ||
                         searchStr.includes('code=') ||
                         searchStr.includes('error=');

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
      logAuthDebug(`Popup auth state change: ${event}`);
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

  let processingRedirect = isAuthRedirect;
  logAuthDebug(`Is redirect callback: ${isAuthRedirect}`);"""

normalized_replacement = replacement.replace("\r\n", "\n")

if normalized_target in normalized_content:
    new_content = normalized_content.replace(normalized_target, normalized_replacement)
    # Write back with original line endings (or default \r\n on Windows)
    with open(file_path, "w", encoding="utf-8", newline="") as f:
        f.write(new_content.replace("\n", "\r\n"))
    print("Success: oauth flow patched.")
else:
    print("Error: Target not found.")
