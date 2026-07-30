const fs = require('fs');

const appJsPath = 'c:/Users/mario/Desktop/money-manager/app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

if (appJs.includes('function showAuthOverlay() {')) {
  appJs = appJs.replace(
    'function showAuthOverlay() {',
    `function showAuthOverlay() {
  document.querySelectorAll('.modal-overlay, .tx-modal-overlay').forEach(m => m.classList.remove('active'));
  const txModal = document.getElementById('transaction-modal');
  if (txModal) txModal.style.display = 'none';`
  );
  console.log("-> showAuthOverlay cleanup added successfully.");
}

fs.writeFileSync(appJsPath, appJs, 'utf8');
fs.writeFileSync('c:/Users/mario/Desktop/money-manager/www/app.js', appJs, 'utf8');
