const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');
const indexHtml = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');
const styleCss = fs.readFileSync('c:/Users/mario/Desktop/money-manager/style.css', 'utf8');

console.log("=== Resume / Background Handlers ===");
let idx = 0;
while ((idx = appJs.indexOf('visibilitychange', idx)) !== -1) {
  console.log(appJs.substring(Math.max(0, idx - 50), idx + 400));
  console.log("-----------------------------------------------");
  idx += 'visibilitychange'.length;
}

idx = 0;
while ((idx = appJs.indexOf('appStateChange', idx)) !== -1) {
  console.log(appJs.substring(Math.max(0, idx - 50), idx + 400));
  console.log("-----------------------------------------------");
  idx += 'appStateChange'.length;
}

console.log("=== Transaction Modal Width / Gap in Search ===");
// Inspect transaction modal container CSS in style.css or inline style
idx = 0;
while ((idx = styleCss.indexOf('#transaction-modal', idx)) !== -1) {
  console.log(styleCss.substring(idx, idx + 400));
  console.log("-----------------------------------------------");
  idx += '#transaction-modal'.length;
}

idx = 0;
while ((idx = styleCss.indexOf('.modal-card', idx)) !== -1) {
  console.log(styleCss.substring(idx, idx + 300));
  console.log("-----------------------------------------------");
  idx += '.modal-card'.length;
}
