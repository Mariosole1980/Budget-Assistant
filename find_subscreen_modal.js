const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

let idx = 0;
while ((idx = html.indexOf('settings-subscreen-modal', idx)) !== -1) {
  console.log("Found at pos:", idx);
  console.log(html.substring(Math.max(0, idx - 100), idx + 200));
  console.log("==========================================");
  idx += 'settings-subscreen-modal'.length;
}
