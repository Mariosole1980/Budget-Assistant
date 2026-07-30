const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

const regex = /id="(hub-row-[^"]+)"([^>]*)/g;
let match;
while ((match = regex.exec(html)) !== null) {
  console.log(`ID: ${match[1]}`);
  console.log(`Attrs: ${match[2]}`);
  console.log("---------------------------------------");
}
