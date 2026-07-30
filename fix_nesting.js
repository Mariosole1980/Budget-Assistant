const fs = require('fs');
const path = 'c:/Users/mario/Desktop/money-manager/index.html';
let html = fs.readFileSync(path, 'utf8');

const targetRegex = /        <\/div>\s*<\/div>\s*<\/div>\s*<div id=\"supabase-modal\" class=\"modal-overlay\">/;

const replacement = `        </div>
        </div>
      </div>
    </div>

    <div id=\"supabase-modal\" class=\"modal-overlay\">`;

if (targetRegex.test(html)) {
    html = html.replace(targetRegex, replacement);
    fs.writeFileSync(path, html, 'utf8');
    console.log("Successfully fixed modal nesting.");
} else {
    console.log("Target regex not found!");
}
