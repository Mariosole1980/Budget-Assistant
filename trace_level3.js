const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

const tagRegex = /<(\/?)([a-zA-Z0-9\-]+)([^>]*)>/g;
let stack = [];
let match;

while ((match = tagRegex.exec(html)) !== null) {
  const isClosing = match[1] === '/';
  const tag = match[2].toLowerCase();
  const attrs = match[3];
  const pos = match.index;
  
  if (['meta','img','link','br','hr','input'].includes(tag) || attrs.endsWith('/')) {
    continue;
  }
  
  if (isClosing) {
    stack.pop();
  } else {
    stack.push({ tag, attrs, pos });
    if (attrs.includes('category-manager-modal')) {
      console.log("Current Stack when encountering category-manager-modal:");
      stack.forEach((item, idx) => {
        console.log(`Level ${idx}: pos ${item.pos}`);
        console.log(html.substring(item.pos, Math.min(html.length, item.pos + 150)));
        console.log("---");
      });
      break;
    }
  }
}
