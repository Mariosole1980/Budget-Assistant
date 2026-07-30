const fs = require('fs');

const styleCss = fs.readFileSync('c:/Users/mario/Desktop/money-manager/style.css', 'utf8');

let idx = 0;
while ((idx = styleCss.indexOf('subscreen', idx)) !== -1) {
  console.log(styleCss.substring(Math.max(0, idx - 40), idx + 250).replace(/\n/g, ' '));
  console.log("-----------------------------------------------");
  idx += 'subscreen'.length;
}
