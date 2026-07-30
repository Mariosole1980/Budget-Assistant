const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

let idx = 0;
while ((idx = html.indexOf('.modal-overlay', idx)) !== -1) {
  console.log(".modal-overlay CSS found around pos:", idx);
  console.log(html.substring(Math.max(0, idx - 50), idx + 350));
  console.log("-----------------------------------------");
  idx += '.modal-overlay'.length;
}
