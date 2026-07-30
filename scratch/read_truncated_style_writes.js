const fs = require('fs');

const content = fs.readFileSync('scratch/style_css_writes_results.txt', 'utf-8');
const truncated = content.substring(40000);
fs.writeFileSync('scratch/style_writes_rest_utf8.txt', truncated, 'utf-8');
console.log("Written successfully in UTF-8");
