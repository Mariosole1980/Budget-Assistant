const fs = require('fs');

const appJsPath = 'c:/Users/mario/Desktop/money-manager/app.js';
const styleCssPath = 'c:/Users/mario/Desktop/money-manager/style.css';

let appJs = fs.readFileSync(appJsPath, 'utf8');
let styleCss = fs.readFileSync(styleCssPath, 'utf8');

// 1. FIX USER GUIDE BUILD_VERSION ReferenceError
console.log("1. Fixing User Guide BUILD_VERSION...");
if (appJs.includes('BUILD_VERSION || 889')) {
  appJs = appJs.replace(
    'if (vBadge) vBadge.textContent = `v${BUILD_VERSION || 889}`;',
    'const currentVer = typeof BUILD_VERSION !== "undefined" ? BUILD_VERSION : (state.version || 939);\n  if (vBadge) vBadge.textContent = `v${currentVer}`;'
  );
  console.log("-> BUILD_VERSION fix applied.");
} else {
  console.log("-> BUILD_VERSION target not found or already fixed.");
}

// 2. FIX SWIPE BACK / !document.hasFocus() GUARDS
console.log("2. Removing !document.hasFocus() guards...");
appJs = appJs.replace(/if \(document\.visibilityState === 'hidden' \|\| !document\.hasFocus\(\)\)/g, "if (document.visibilityState === 'hidden')");
console.log("-> document.hasFocus() guards removed.");

// 3. FIX APP FIRST-LAUNCH MODAL ORDER (showAuthModal)
console.log("3. Fixing showAuthModal startup modal cleanup...");
const authModalMatch = 'function showAuthModal() {';
if (appJs.includes(authModalMatch)) {
  appJs = appJs.replace(
    'function showAuthModal() {',
    `function showAuthModal() {
  // Ensure all transaction and subscreen modals are closed when Auth/Setup screen is triggered
  document.querySelectorAll('.modal-overlay, .tx-modal-overlay').forEach(m => m.classList.remove('active'));
  const txModal = document.getElementById('transaction-modal');
  if (txModal) txModal.style.display = 'none';`
  );
  console.log("-> showAuthModal cleanup added.");
}

// 4. FIX BACKGROUND / RESUME FLICKER (_handleAppResumed)
console.log("4. Enhancing _handleAppResumed anti-flicker...");
const resumedMatch = 'function _handleAppResumed() {';
if (appJs.includes(resumedMatch)) {
  appJs = appJs.replace(
    'function _handleAppResumed() {',
    `function _handleAppResumed() {
  document.body.classList.add('no-transitions');
  setTimeout(() => { document.body.classList.remove('no-transitions'); }, 600);`
  );
  console.log("-> _handleAppResumed anti-flicker added.");
}

// 5. CSS FIXES FOR SEARCH TRANSACTION MODAL GAP & PREFERENCES FLICKER
console.log("5. Updating style.css for Search Modal Gap & Preferences Flicker...");
const cssFixes = `

/* ============================================================
   ANTI-FLICKER & MODAL LAYOUT FIXES
   ============================================================ */
.no-transitions * {
  transition: none !important;
  animation: none !important;
}

#transaction-modal,
#transaction-modal .modal-overlay,
.modal-overlay#transaction-modal {
  width: 100vw !important;
  max-width: 100vw !important;
  left: 0 !important;
  right: 0 !important;
  margin: 0 !important;
  box-sizing: border-box !important;
}

#settings-subscreen-modal,
#settings-subscreen-modal .modal-card,
.subscreen-card {
  transform-origin: center center !important;
  box-sizing: border-box !important;
}
`;

if (!styleCss.includes('ANTI-FLICKER & MODAL LAYOUT FIXES')) {
  styleCss += cssFixes;
  console.log("-> CSS fixes appended.");
}

// Save files
fs.writeFileSync(appJsPath, appJs, 'utf8');
fs.writeFileSync('c:/Users/mario/Desktop/money-manager/www/app.js', appJs, 'utf8');

fs.writeFileSync(styleCssPath, styleCss, 'utf8');
fs.writeFileSync('c:/Users/mario/Desktop/money-manager/www/style.css', styleCss, 'utf8');

console.log("All fixes written to app.js and style.css (and synced to www/).");
