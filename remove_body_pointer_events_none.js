const fs = require('fs');

const appJsPath = 'c:/Users/mario/Desktop/money-manager/app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

// Safely remove document.body.style.pointerEvents = 'none';
appJs = appJs.replace(/document\.body\.style\.pointerEvents\s*=\s*'none';/g, "// document.body.style.pointerEvents = 'none'; (disabled to prevent app freeze)");
appJs = appJs.replace(/document\.body\.style\.pointerEvents\s*=\s*'';/g, "document.body.style.pointerEvents = '';");

// Also ensure document.body.style.pointerEvents is cleared on init/start
if (appJs.includes('function initApp()')) {
  appJs = appJs.replace('function initApp() {', 'function initApp() {\n  document.body.style.pointerEvents = "";');
}

fs.writeFileSync(appJsPath, appJs, 'utf8');
fs.writeFileSync('c:/Users/mario/Desktop/money-manager/www/app.js', appJs, 'utf8');

console.log("Safely removed document.body.style.pointerEvents = 'none' from app.js and www/app.js!");
