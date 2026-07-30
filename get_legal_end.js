const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');
const searchString = 'id=\"developer-settings-row\"';
const startIdx = html.indexOf(searchString);
if (startIdx !== -1) {
  console.log(html.substring(startIdx, startIdx + 2000));
}
