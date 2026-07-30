const fs = require('fs');
let html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

html = html.replace('<div   </div>', '');

const tagRegex = /<(\/?)([a-zA-Z0-9\-]+)([^>]*)>/g;
let stack = [];
let match;
const found = {};

while ((match = tagRegex.exec(html)) !== null) {
  const isClosing = match[1] === '/';
  const tag = match[2].toLowerCase();
  const attrs = match[3];
  
  if (['meta','img','link','br','hr','input'].includes(tag) || attrs.endsWith('/')) {
    continue;
  }
  
  if (isClosing) {
    stack.pop();
  } else {
    let id = '';
    const idMatch = attrs.match(/id=[\"']([^\"']+)[\"']/i);
    if (idMatch) id = idMatch[1];
    
    stack.push({ tag, id });
    if (id) {
      found[id] = stack.map(s => s.id || s.tag).join(' > ');
    }
  }
}

const checkList = ['settings-subscreen-modal', 'category-manager-modal', 'trash-bin-modal', 'user-guide-modal', 'recurring-templates-modal'];
checkList.forEach(id => console.log(`${id}: ${found[id]}`));
