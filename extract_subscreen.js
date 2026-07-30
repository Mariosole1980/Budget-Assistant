const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

const idToFind = 'settings-subscreen-modal';
const startIndex = html.indexOf('id=\"settings-subscreen-modal\"');
if (startIndex !== -1) {
  const startHtml = html.substring(Math.max(0, startIndex - 50), startIndex + 1500);
  console.log(startHtml);
}
