const fs = require('fs');

const file = 'www/index.html';
let html = fs.readFileSync(file, 'utf8');

const startMarker = '<!-- MODAL: IN-APP PRIVACY POLICY -->';
const endMarker = '<!-- MODAL: SOFTWARE LICENSES -->';

const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    console.error('Markers not found. startIdx=', startIdx, 'endIdx=', endIdx);
    process.exit(1);
}

const newModal = `    <!-- MODAL: IN-APP PRIVACY POLICY (MODERN) -->
    <div id="privacy-policy-modal" class="modal-overlay" style="z-index: 11000; align-items: center; justify-content: center;">
      <div class="modal-content"
        style="max-width: 520px; width: 94%; max-height: calc(var(--viewport-height, 100vh) * 0.92); display: flex; flex-direction: column; border-radius: 24px; overflow: hidden; background: var(--bg-card, #1c1f28); border: 1px solid var(--border); box-shadow: 0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(var(--accent-rgb, 124, 106, 247), 0.12);">
        <!-- Hero Header -->
        <div
          style="position: relative; padding: 22px 20px 18px; background: linear-gradient(135deg, rgba(var(--accent-rgb, 124, 106, 247), 0.22), rgba(var(--accent-rgb, 124, 106, 247), 0.04)); border-bottom: 1px solid var(--border); overflow: hidden;">
          <div style="position: absolute; top: -40px; right: -30px; width: 140px; height: 140px; border-radius: 50%; background: radial-gradient(circle, rgba(var(--accent-rgb, 124, 106, 247), 0.25), transparent 70%);"></div>
          <div style="display: flex; align-items: center; gap: 14px; position: relative;">
            <div
              style="width: 52px; height: 52px; border-radius: 16px; background: linear-gradient(135deg, var(--accent, #7c6af7), rgba(var(--accent-rgb, 124, 106, 247), 0.7)); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 22px rgba(var(--accent-rgb, 124, 106, 247), 0.4); flex-shrink: 0;">
              <i class="fa-solid fa-user-shield" style="font-size: 24px; color: #fff;"></i>
            </div>
            <div style="flex: 1;">
              <h3 class="modal-title" style="margin: 0; font-size: 19px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif; letter-spacing: -0.2px;">Πολιτική Απορρήτου</h3>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-lock" style="font-size: 11px; color: var(--accent);"></i>
                <span>Η ιδιωτικότητά σας προστατεύεται</span>
              </div>
            </div>
            <span class="modal-close" onclick="closeModal('privacy-policy-modal')"
              style="font-size: 22px; color: var(--text-muted); cursor: pointer; line-height: 1; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid var(--border); transition: background 0.2s; flex-shrink: 0;">✕</span>
          </div>
        </div>

        <!-- Body -->
        <div class="modal-body"
          style="padding: 18px 18px 8px; flex: 1; overflow-y: auto; font-size: 13.5px; color: var(--text-secondary); line-height: 1.65; display: flex; flex-direction: column; gap: 12px;">
          <!-- Trust banner -->
          <div
            style="background: linear-gradient(135deg, rgba(var(--accent-rgb, 124, 106, 247), 0.12), rgba(var(--accent-rgb, 124, 106, 247), 0.04)); border: 1px solid rgba(var(--accent-rgb, 124, 106, 247), 0.25); border-radius: 16px; padding: 14px 16px; display: flex; align-items: center; gap: 12px;">
            <i class="fa-solid fa-shield-halved" style="font-size: 22px; color: var(--accent, #7c6af7); flex-shrink: 0;"></i>
            <div>
              <strong style="color: var(--text-primary); display: block; font-size: 14px;">Απόλυτη Ασφάλεια & Ιδιωτικότητα</strong>
              <span style="font-size: 12px; color: var(--text-muted);">Τα δεδομένα σας ανήκουν αποκλειστικά σε εσάς.</span>
            </div>
          </div>

          <!-- Section 1 -->
          <div
            style="background: rgba(255,255,255,0.025); border: 1px solid var(--border); border-radius: 16px; padding: 14px 16px; display: flex; gap: 12px;">
            <div
              style="width: 38px; height: 38px; border-radius: 12px; background: rgba(var(--accent-rgb, 124, 106, 247), 0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(var(--accent-rgb, 124, 106, 247), 0.25);">
              <i class="fa-solid fa-database" style="font-size: 16px; color: var(--accent, #7c6af7);"></i>
            </div>
            <div>
              <h4 style="margin: 0 0 4px; color: var(--text-primary); font-size: 14px; font-weight: 700;">1. Αποθήκευση Δεδομένων</h4>
              <p style="margin: 0; font-size: 12.5px;">Όλες οι συναλλαγές, οι λογαριασμοί και οι ρυθμίσεις σας αποθηκεύονται ακαριαία στη συσκευή σας (Local Storage). Όταν είστε συνδεδεμένοι, συγχρονίζονται με ασφαλή κρυπτογράφηση στο Cloud (Supabase).</p>
            </div>
          </div>

          <!-- Section 2 -->
          <div
            style="background: rgba(255,255,255,0.025); border: 1px solid var(--border); border-radius: 16px; padding: 14px 16px; display: flex; gap: 12px;">
            <div
              style="width: 38px; height: 38px; border-radius: 12px; background: rgba(var(--accent-rgb, 124, 106, 247), 0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(var(--accent-rgb, 124, 106, 247), 0.25);">
              <i class="fa-solid fa-ban" style="font-size: 16px; color: var(--accent, #7c6af7);"></i>
            </div>
            <div>
              <h4 style="margin: 0 0 4px; color: var(--text-primary); font-size: 14px; font-weight: 700;">2. Χρήση & Κοινοποίηση</h4>
              <p style="margin: 0; font-size: 12.5px;">Δεν συλλέγουμε, δεν πωλούμε και δεν κοινοποιούμε τα οικονομικά σας δεδομένα σε κανέναν τρίτο οργανισμό ή διαφημιστική εταιρεία.</p>
            </div>
          </div>

          <!-- Section 3 -->
          <div
            style="background: rgba(255,255,255,0.025); border: 1px solid var(--border); border-radius: 16px; padding: 14px 16px; display: flex; gap: 12px;">
            <div
              style="width: 38px; height: 38px; border-radius: 12px; background: rgba(var(--accent-rgb, 124, 106, 247), 0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(var(--accent-rgb, 124, 106, 247), 0.25);">
              <i class="fa-solid fa-trash-can" style="font-size: 16px; color: var(--accent, #7c6af7);"></i>
            </div>
            <div>
              <h4 style="margin: 0 0 4px; color: var(--text-primary); font-size: 14px; font-weight: 700;">3. Διαγραφή Δεδομένων</h4>
              <p style="margin: 0; font-size: 12.5px;">Έχετε τον πλήρη έλεγχο. Μπορείτε ανά πάσα στιγμή να διαγράψετε τον λογαριασμό σας και όλα τα δεδομένα σας οριστικά από το μενού Ρυθμίσεων.</p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer"
          style="padding: 14px 18px; border-top: 1px solid var(--border); background: rgba(255,255,255,0.02); text-align: center;">
          <button type="button" onclick="closeModal('privacy-policy-modal')"
            style="width: 100%; padding: 13px; border-radius: 14px; font-size: 14px; font-weight: 700; background: linear-gradient(135deg, var(--accent, #7c6af7), rgba(var(--accent-rgb, 124, 106, 247), 0.8)); border: none; color: #fff; cursor: pointer; box-shadow: 0 6px 18px rgba(var(--accent-rgb, 124, 106, 247), 0.3); transition: transform 0.15s ease, box-shadow 0.15s ease;">Κατάλαβα</button>
        </div>
      </div>
    </div>

`;

html = html.slice(0, startIdx) + newModal + html.slice(endIdx);

fs.writeFileSync(file, html, 'utf8');
console.log('www/index.html privacy modal replaced successfully.');
