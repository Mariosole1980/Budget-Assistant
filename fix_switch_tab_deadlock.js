const fs = require('fs');

const appJsPath = 'c:/Users/mario/Desktop/money-manager/app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

const brokenPart = `function switchTab(tab, instant = false) {
  if (state.activeTab !== tab) {
    state.activeTab = tab;
    try {
      history.pushState({ appState: 'active', tab: tab }, '', window.location.pathname + window.location.search);
      state.historyPushed = true;
    } catch (e) {}
  }
  ensureHistoryPushed();
  // Allow re-tapping 'trans' or 'stats' tab to reset month even if already active
  if (state.activeTab === tab) {`;

const fixedPart = `function switchTab(tab, instant = false) {
  // Allow re-tapping 'trans' or 'stats' tab to reset month even if already active
  if (state.activeTab === tab) {`;

if (appJs.includes(brokenPart)) {
  appJs = appJs.replace(brokenPart, fixedPart);
  
  // Now place state.activeTab = tab right after the re-tap check
  const targetCheck = `    return;\n  }\n\n  // Clear expanded categories on active tab change`;
  const targetReplace = `    return;\n  }\n\n  const prevTabName = state.activeTab;\n  state.activeTab = tab;\n  try {\n    history.pushState({ appState: 'active', tab: tab }, '', window.location.pathname + window.location.search);\n    state.historyPushed = true;\n  } catch (e) {}\n\n  // Clear expanded categories on active tab change`;
  
  appJs = appJs.replace(targetCheck, targetReplace);
  console.log("Successfully fixed switchTab deadlock!");
} else {
  console.log("brokenPart pattern not found directly, checking regex replace...");
}

fs.writeFileSync(appJsPath, appJs, 'utf8');
fs.writeFileSync('c:/Users/mario/Desktop/money-manager/www/app.js', appJs, 'utf8');
