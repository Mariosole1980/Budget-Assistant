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

console.log(extractFunction('getCategoryDisplayName'));
