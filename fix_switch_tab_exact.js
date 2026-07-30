const fs = require('fs');

const appJsPath = 'c:/Users/mario/Desktop/money-manager/app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

const oldChunk = `function switchTab(tab, instant = false) {
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

const newChunk = `function switchTab(tab, instant = false) {
  ensureHistoryPushed();
  // Allow re-tapping 'trans' or 'stats' tab to reset month even if already active
  if (state.activeTab === tab) {`;

if (appJs.includes(oldChunk)) {
  appJs = appJs.replace(oldChunk, newChunk);
  
  // Now place history.pushState right after if (state.activeTab === tab) { ... return; }
  const afterRetapCheck = `    return;\n  }\n\n  // Clear expanded categories on active tab change`;
  const replacementWithState = `    return;\n  }\n\n  const prevTabName = state.activeTab;\n  state.activeTab = tab;\n  try {\n    history.pushState({ appState: 'active', tab: tab }, '', window.location.pathname + window.location.search);\n    state.historyPushed = true;\n  } catch (e) {}\n\n  // Clear expanded categories on active tab change`;
  
  appJs = appJs.replace(afterRetapCheck, replacementWithState);
  console.log("Successfully replaced broken switchTab logic!");
} else {
  console.log("oldChunk not matched! App.js may differ by line endings.");
  // Normalize CRLF to LF for matching
  const appJsNormalized = appJs.replace(/\r\n/g, '\n');
  if (appJsNormalized.includes(oldChunk.replace(/\r\n/g, '\n'))) {
    appJs = appJsNormalized.replace(oldChunk.replace(/\r\n/g, '\n'), newChunk.replace(/\r\n/g, '\n'));
    const afterRetapNorm = `    return;\n  }\n\n  // Clear expanded categories on active tab change`;
    const replaceNorm = `    return;\n  }\n\n  const prevTabName = state.activeTab;\n  state.activeTab = tab;\n  try {\n    history.pushState({ appState: 'active', tab: tab }, '', window.location.pathname + window.location.search);\n    state.historyPushed = true;\n  } catch (e) {}\n\n  // Clear expanded categories on active tab change`;
    appJs = appJs.replace(afterRetapNorm, replaceNorm);
    console.log("Replaced with normalized line endings!");
  }
}

fs.writeFileSync(appJsPath, appJs, 'utf8');
fs.writeFileSync('c:/Users/mario/Desktop/money-manager/www/app.js', appJs, 'utf8');
