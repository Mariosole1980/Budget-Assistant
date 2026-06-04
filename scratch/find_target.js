const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app.js');
const content = fs.readFileSync(filePath, 'utf8');

const targetStr = "const isAuthRedirect";
const index = content.indexOf(targetStr);
if (index !== -1) {
  console.log("Found at index", index);
  console.log("Context:\n", content.substring(index - 100, index + 350));
} else {
  console.log("Not found.");
}
