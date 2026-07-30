const fs = require('fs');
const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

const regex = /hub-row-categories/g;
let match;
while ((match = regex.exec(appJs)) !== null) {
  console.log("Match at pos:", match.index);
  console.log(appJs.substring(Math.max(0, match.index - 100), match.index + 200));
  console.log("------------------------------------------");
}
