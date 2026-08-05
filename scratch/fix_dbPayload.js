const fs = require('fs');
const appJsPath = 'c:/Users/mario/Desktop/money-manager/app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

const regex1 = /const \{ description, is_shared, recurring_template_id, \.\.\.dbPayload \} = (transaction|t);/g;
const replace1 = "const { description, is_shared, recurring_template_id, photo_local_uri, photo_url, receipt, currency, base_currency, rate_to_base, amount_base, rate_source, ...dbPayload } = ;";

const regex2 = /const \{ description, \.\.\.dbPayload \} = newTx;/g;
const replace2 = "const { description, is_shared, recurring_template_id, photo_local_uri, photo_url, receipt, currency, base_currency, rate_to_base, amount_base, rate_source, ...dbPayload } = newTx;";

appJs = appJs.replace(regex1, replace1);
appJs = appJs.replace(regex2, replace2);

// Also fix processSyncQueue to not drop silently by throwing error so it doesn't proceed? 
// No, if we fix the payload it won't error.

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Fixed app.js payload destructuring.');

const liveAppJsPath = 'c:/Users/mario/Desktop/money-manager/live_app.js';
if (fs.existsSync(liveAppJsPath)) {
    let liveAppJs = fs.readFileSync(liveAppJsPath, 'utf8');
    liveAppJs = liveAppJs.replace(regex1, replace1);
    liveAppJs = liveAppJs.replace(regex2, replace2);
    fs.writeFileSync(liveAppJsPath, liveAppJs, 'utf8');
    console.log('Fixed live_app.js payload destructuring.');
}
