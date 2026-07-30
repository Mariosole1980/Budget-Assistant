const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

const tagRegex = /<(\/?)([a-zA-Z0-9\-]+)([^>]*)>/g;
let stack = [];
let match;
const foundIds = {};

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
    
    let cls = '';
    const clsMatch = attrs.match(/class=[\"']([^\"']+)[\"']/i);
    if (clsMatch) cls = clsMatch[1];
    
    const nodeInfo = { tag, id, cls };
    stack.push(nodeInfo);
    
    if (id) {
      foundIds[id] = [...stack].map(n => n.id || n.tag).join(' > ');
    }
  }
}

const checkIds = ['category-manager-modal', 'trash-bin-modal', 'recurring-templates-modal', 'settings-subscreen-modal'];
checkIds.forEach(id => {
  console.log(id + ' : ' + foundIds[id]);
});
