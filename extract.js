const fs = require('fs');
const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

function extractFunction(name) {
    const regex = new RegExp('function\\\\s+' + name + '\\\\s*\\\\([^)]*\\\\)\\\\s*\\\\{', 'g');
    const match = regex.exec(appJs);
    if (!match) return 'Function ' + name + ' not found';
    let startIndex = match.index;
    let braceCount = 0;
    let i = startIndex;
    let started = false;
    while (i < appJs.length) {
        if (appJs[i] === '{') {
            braceCount++;
            started = true;
        } else if (appJs[i] === '}') {
            braceCount--;
        }
        i++;
        if (started && braceCount === 0) break;
    }
    return appJs.substring(startIndex, i);
}

const res = {
    openSettingsCategoryManager: extractFunction('openSettingsCategoryManager'),
    renderCategoryManagerList: extractFunction('renderCategoryManagerList'),
    toggleCategoryManagerAccordion: extractFunction('toggleCategoryManagerAccordion')
};
fs.writeFileSync('c:/Users/mario/Desktop/money-manager/debug_funcs.json', JSON.stringify(res, null, 2), 'utf8');

const indexHtml = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');
const modalRegex = /<div[^>]*id=[\"']category-manager-modal[\"'][^>]*>(?:[^<]|<(?!\\/div>)|<div[^>]*>(?:[^<]|<(?!\\/div>))*<\\/div>)*<\\/div>/i;
const modalMatch = indexHtml.match(modalRegex);
fs.writeFileSync('c:/Users/mario/Desktop/money-manager/debug_html.html', modalMatch ? modalMatch[0] : 'Modal not found', 'utf8');
