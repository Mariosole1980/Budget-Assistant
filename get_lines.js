const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8').split('\\n');
for(let i = 0; i < html.length; i++) {
  if (html[i].includes('id=\"supabase-modal\"')) {
    for (let j = i-4; j <= i+2; j++) {
      console.log((j+1) + ': ' + html[j]);
    }
    break;
  }
}
