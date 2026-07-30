const fs = require('fs');
const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8').split('\\n');
for (let i = 0; i < appJs.length; i++) {
  if (appJs[i].includes('function openSettingsCategoryManager')) console.log('openSettingsCategoryManager:', i + 1);
  if (appJs[i].includes('function renderCategoryManagerList')) console.log('renderCategoryManagerList:', i + 1);
}
const indexHtml = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8').split('\\n');
for (let i = 0; i < indexHtml.length; i++) {
  if (indexHtml[i].includes('id=\"category-manager-modal\"')) console.log('category-manager-modal:', i + 1);
}
