const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');
const startIdx = html.indexOf('id=\"hub-row-categories\"');
if (startIdx !== -1) {
  console.log(html.substring(Math.max(0, startIdx - 150), startIdx + 800));
}
