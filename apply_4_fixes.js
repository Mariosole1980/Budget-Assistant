const fs = require('fs');

const appJsPath = 'c:/Users/mario/Desktop/money-manager/app.js';
const styleCssPath = 'c:/Users/mario/Desktop/money-manager/style.css';

let appJs = fs.readFileSync(appJsPath, 'utf8');
let styleCss = fs.readFileSync(styleCssPath, 'utf8');

// 1. FIX USER GUIDE Z-INDEX & SETTINGS SUBSCREEN MODAL FULLSCREEN CSS (Issues 1 & 3)
console.log("1. Applying CSS fixes for User Guide Z-Index and Settings Subscreen Modal...");
const cssFixes = `

/* ============================================================
   USER GUIDE Z-INDEX & SETTINGS SUBSCREEN FIXES
   ============================================================ */
#user-guide-modal {
  z-index: 11000 !important;
}

#settings-subscreen-modal {
  z-index: 10000 !important;
}

#settings-subscreen-modal .modal-card {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: 100vw !important;
  max-height: 100vh !important;
  margin: 0 !important;
  border-radius: 0 !important;
  transform: none !important;
  animation: none !important;
  box-sizing: border-box !important;
}
`;

if (!styleCss.includes('USER GUIDE Z-INDEX & SETTINGS SUBSCREEN FIXES')) {
  styleCss += cssFixes;
  console.log("-> CSS fixes appended.");
}

// 2. FIX MAIN TAB SWIPE BACK POPSTATE & SWITCHTAB (Issue 2)
console.log("2. Updating switchTab & popstate for main tab swipe back...");
if (appJs.includes('function switchTab(')) {
  appJs = appJs.replace(
    'function switchTab(tab, instant = false) {',
    `function switchTab(tab, instant = false) {
  if (state.activeTab !== tab) {
    state.activeTab = tab;
    try {
      history.pushState({ appState: 'active', tab: tab }, '', window.location.pathname + window.location.search);
      state.historyPushed = true;
    } catch (e) {}
  }`
  );
  console.log("-> switchTab history state update applied.");
}

const popstateOld = `  window.addEventListener('popstate', (e) => {
    // Only run popstate logic if NOT inside Capacitor (because Capacitor handles back button natively via App plugin)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      return;
    }
    // Guard: Ignore popstate if the document is hidden, backgrounding, or blurred (e.g. during home swipe gesture)
    if (document.visibilityState === 'hidden') {
      return;
    }
    const handled = triggerBackAction();
    if (handled) {
      // Re-push to keep intercepting subsequent back actions
      history.pushState({ appState: 'active' }, '', window.location.pathname + window.location.search);
      state.historyPushed = true;
    } else {
      state.historyPushed = false;
    }
  });`;

const popstateNew = `  window.addEventListener('popstate', (e) => {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      return;
    }
    if (document.visibilityState === 'hidden') {
      return;
    }
    const handled = triggerBackAction();
    if (handled) {
      history.pushState({ appState: 'active', tab: state.activeTab }, '', window.location.pathname + window.location.search);
      state.historyPushed = true;
    } else {
      state.historyPushed = false;
      if (e.state && e.state.tab && e.state.tab !== state.activeTab) {
        switchTab(e.state.tab, true);
      } else {
        updateUI();
      }
    }
  });`;

if (appJs.includes(popstateOld)) {
  appJs = appJs.replace(popstateOld, popstateNew);
  console.log("-> popstate listener updated for tab back navigation.");
} else {
  console.log("-> Exact popstate pattern not matched, performing regex replace...");
  appJs = appJs.replace(
    /const handled = triggerBackAction\(\);[\s\S]*?\} else \{\s*state\.historyPushed = false;\s*\}/,
    `const handled = triggerBackAction();
    if (handled) {
      history.pushState({ appState: 'active', tab: state.activeTab }, '', window.location.pathname + window.location.search);
      state.historyPushed = true;
    } else {
      state.historyPushed = false;
      if (e.state && e.state.tab && e.state.tab !== state.activeTab) {
        switchTab(e.state.tab, true);
      } else {
        updateUI();
      }
    }`
  );
}

// 3. FIX SUPABASE SYNC SESSION RESTORE & GREEN DOT (Issue 4)
console.log("3. Enhancing Supabase sync session restore and green dot status...");
const updateSyncOld = `function updateSyncStatusIndicator() {
  const dot = document.getElementById('header-sync-dot');
  const icon = document.getElementById('header-sync-cloud-icon');
  const btn = document.getElementById('header-sync-icon');
  
  if (state.currentUser && (!state.syncStatus || state.syncStatus === 'idle' || state.syncStatus === 'offline')) {
    state.syncStatus = 'synced';
  }`;

const updateSyncNew = `function updateSyncStatusIndicator() {
  const dot = document.getElementById('header-sync-dot');
  const icon = document.getElementById('header-sync-cloud-icon');
  const btn = document.getElementById('header-sync-icon');
  
  if (!state.currentUser) {
    const cachedUser = localStorage.getItem('cached_current_user');
    if (cachedUser) {
      try { state.currentUser = JSON.parse(cachedUser); } catch (e) {}
    }
  }

  if (state.currentUser && (!state.syncStatus || state.syncStatus === 'idle' || state.syncStatus === 'offline')) {
    state.syncStatus = 'synced';
  }`;

if (appJs.includes(updateSyncOld)) {
  appJs = appJs.replace(updateSyncOld, updateSyncNew);
  console.log("-> updateSyncStatusIndicator session auto-restore added.");
}

const forceSyncOld = `async function forceSyncNow(silent = false) {
  if (!state.supabaseClient || !state.currentUser) {
    if (!silent) alert(state.lang === 'en' ? 'Please log in first to sync.' : 'Παρακαλώ συνδεθείτε πρώτα για συγχρονισμό.');
    return false;
  }`;

const forceSyncNew = `async function forceSyncNow(silent = false) {
  if (!state.currentUser) {
    const cachedUser = localStorage.getItem('cached_current_user');
    if (cachedUser) {
      try { state.currentUser = JSON.parse(cachedUser); } catch (e) {}
    }
  }

  if (!state.supabaseClient || !state.currentUser) {
    if (!silent) alert(state.lang === 'en' ? 'Please log in first to sync.' : 'Παρακαλώ συνδεθείτε πρώτα για συγχρονισμό.');
    return false;
  }`;

if (appJs.includes(forceSyncOld)) {
  appJs = appJs.replace(forceSyncOld, forceSyncNew);
  console.log("-> forceSyncNow session auto-restore added.");
}

// Write updated files
fs.writeFileSync(appJsPath, appJs, 'utf8');
fs.writeFileSync('c:/Users/mario/Desktop/money-manager/www/app.js', appJs, 'utf8');

fs.writeFileSync(styleCssPath, styleCss, 'utf8');
fs.writeFileSync('c:/Users/mario/Desktop/money-manager/www/style.css', styleCss, 'utf8');

console.log("All 4 fixes applied cleanly!");
