const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

const styleStart = html.indexOf('<style>');
const styleEnd = html.indexOf('</style>');

if (styleStart !== -1 && styleEnd !== -1) {
  const styleCss = html.substring(styleStart, styleEnd);
  let idx = 0;
  while ((idx = styleCss.indexOf('modal-overlay', idx)) !== -1) {
    console.log("Found modal-overlay in style tag around pos:", idx);
    console.log(styleCss.substring(Math.max(0, idx - 80), idx + 250));
    console.log("=========================================");
    idx += 'modal-overlay'.length;
  }
} else {
  console.log("Style tag not found!");
}
