const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

const tagRegex = /<(\/?)([a-zA-Z0-9\-]+)([^>]*)>/g;
let stack = [];
let match;
const children = [];

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
    
    const nodeInfo = { tag, id };
    
    // if parent is settings-subscreen-modal
    if (stack.length > 0 && stack[stack.length - 1].id === 'settings-subscreen-modal') {
        children.push(id || tag);
    }
    
    stack.push(nodeInfo);
  }
}

console.log('Direct children of settings-subscreen-modal:');
console.log(children.join(', '));
