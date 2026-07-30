const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

const targetStr = `        </div>
        </div>
      </div>

    <div id="supabase-modal" class="modal-overlay">`;

const targetStr2 = `        </div>
        </div>
      </div>
    <div id="supabase-modal" class="modal-overlay">`;

let idx = html.indexOf('id=\"supabase-modal\"');
if (idx !== -1) {
    console.log(html.substring(idx - 100, idx + 50));
}
