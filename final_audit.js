const fs = require('fs');
let html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

const tagRegex = /<(\/?)([a-zA-Z0-9\-]+)([^>]*)>/g;
let stack = [];
let match;
let errors = [];

while ((match = tagRegex.exec(html)) !== null) {
  const isClosing = match[1] === '/';
  const tag = match[2].toLowerCase();
  const attrs = match[3];
  const pos = match.index;
  
  if (['meta','img','link','br','hr','input'].includes(tag) || attrs.endsWith('/')) {
    continue;
  }
  
  if (isClosing) {
    if (stack.length === 0) {
      errors.push(`Unexpected closing tag </${tag}> at pos ${pos}`);
    } else {
      const top = stack.pop();
      if (top.tag !== tag) {
        errors.push(`Mismatched tag: expected </${top.tag}> (opened at pos ${top.pos}), got </${tag}> at pos ${pos}`);
      }
    }
  } else {
    let id = '';
    const idMatch = attrs.match(/id=[\"']([^\"']+)[\"']/i);
    if (idMatch) id = idMatch[1];
    stack.push({ tag, id, attrs, pos });
  }
}

console.log("Final DOM Audit - Error count:", errors.length);
if (errors.length > 0) {
  errors.forEach(e => console.log(e));
} else {
  console.log("DOM Structure is 100% PERFECT!");
}

console.log("Unclosed tags remaining:", stack.length);
if (stack.length > 0) {
  stack.forEach(s => console.log(`Unclosed <${s.tag} id="${s.id}"> at pos ${s.pos}`));
}
