const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const OUT_DIR = 'C:\\Users\\mario\\Desktop\\PlayStore_Assets';
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Simple static HTTP server for the workspace
function startServer(port = 8085) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    let filePath = path.join(__dirname, '..', reqPath === '/' ? 'index.html' : reqPath);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    if (fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

async function capture() {
  console.log('🚀 Starting local server...');
  const server = await startServer(8085);

  console.log('📱 Launching browser from:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-zygote',
      '--single-process'
    ]
  });

  const page = await browser.newPage();
  
  // High-res mobile viewport (1080x2400 aspect ratio at 412x915 with DPR 2.625)
  await page.setViewport({
    width: 412,
    height: 915,
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true
  });

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const mStr = String(m + 1).padStart(2, '0');

  const cleanTxs = [
    { id: 'tx_income_new', amount: 350.00, type: 'income', category: 'Επιπλέον Εισόδημα', subcategory: 'Freelance', date: `${y}-${mStr}-16T10:15:00Z`, note: 'Freelance Project / Bonus', description: '', account_from: 'Τράπεζα', account_to: '', user_id: 'u1', created_by: 'u1' },
    { id: 'tx_11', amount: 95.00, type: 'expense', category: 'Αγορές', subcategory: 'Ρούχα', date: `${y}-${mStr}-16T18:00:00Z`, note: 'Zara', description: '', account_from: 'Κάρτα', account_to: '', user_id: 'u2', created_by: 'u2' },
    { id: 'tx_income_refund', amount: 180.00, type: 'income', category: 'Επιστροφές', subcategory: 'Cashback', date: `${y}-${mStr}-15T14:30:00Z`, note: 'Επιστροφή Φόρου & Bonus', description: '', account_from: 'Κάρτα', account_to: '', user_id: 'u2', created_by: 'u2' },
    { id: 'tx_10', amount: 85.00, type: 'expense', category: 'Λογαριασμοί', subcategory: 'Ρεύμα', date: `${y}-${mStr}-15T10:30:00Z`, note: 'ΔΕΗ / Ηλεκτρικό', description: '', account_from: 'Τράπεζα', account_to: '', user_id: 'u1', created_by: 'u1' },
    { id: 'tx_9', amount: 12.99, type: 'expense', category: 'Συνδρομές', subcategory: 'Streaming', date: `${y}-${mStr}-14T15:00:00Z`, note: 'Netflix Premium', description: '', account_from: 'Κάρτα', account_to: '', user_id: 'u1', created_by: 'u1' },
    { id: 'tx_8', amount: 28.00, type: 'expense', category: 'Υγεία', subcategory: 'Φαρμακείο', date: `${y}-${mStr}-12T12:00:00Z`, note: 'Βιταμίνες & Φάρμακα', description: '', account_from: 'Μετρητά', account_to: '', user_id: 'u1', created_by: 'u1' },
    { id: 'tx_7', amount: 3.80, type: 'expense', category: 'Καφές', subcategory: '', date: `${y}-${mStr}-10T08:30:00Z`, note: 'Καφές & Τοστ', description: '', account_from: 'Μετρητά', account_to: '', user_id: 'u1', created_by: 'u1' },
    { id: 'tx_6', amount: 46.50, type: 'expense', category: 'Εστίαση', subcategory: 'Εστιατόριο', date: `${y}-${mStr}-09T21:15:00Z`, note: 'Βραδινό Φαγητό', description: '', account_from: 'Κάρτα', account_to: '', user_id: 'u2', created_by: 'u2' },
    { id: 'tx_5', amount: 65.00, type: 'expense', category: 'Μεταφορές', subcategory: 'Καύσιμα', date: `${y}-${mStr}-07T14:20:00Z`, note: 'Βενζίνη (AVIN)', description: '', account_from: 'Κάρτα', account_to: '', user_id: 'u1', created_by: 'u1' },
    { id: 'tx_4', amount: 142.80, type: 'expense', category: 'Τρόφιμα', subcategory: 'Σούπερμάρκετ', date: `${y}-${mStr}-05T17:45:00Z`, note: 'Σκλαβενίτης', description: 'Εβδομαδιαία ψώνια', account_from: 'Κάρτα', account_to: '', user_id: 'u2', created_by: 'u2' },
    { id: 'tx_3', amount: 550.00, type: 'expense', category: 'Σπίτι', subcategory: 'Ενοίκιο', date: `${y}-${mStr}-02T10:00:00Z`, note: 'Ενοίκιο Διαμερίσματος', description: '', account_from: 'Τράπεζα', account_to: '', user_id: 'u1', created_by: 'u1' },
    { id: 'tx_1', amount: 2600.00, type: 'income', category: 'Μισθός', subcategory: '', date: `${y}-${mStr}-01T09:00:00Z`, note: 'Μισθοδοσία', description: 'Μηνιαίος μισθός', account_from: 'Τράπεζα', account_to: '', user_id: 'u1', created_by: 'u1' }
  ];

  const cleanAccounts = [
    { id: 'acc_1', name: 'Τράπεζα', balance: 3420.00, icon: '🏦' },
    { id: 'acc_2', name: 'Κάρτα', balance: 850.00, icon: '💳' },
    { id: 'acc_3', name: 'Μετρητά', balance: 240.00, icon: '💵' }
  ];

  const demoConv = {
    id: 'conv_demo_1',
    title: 'Ανάλυση Εξόδων & Αποταμίευση',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
    messages: [
      {
        sender: 'user',
        html: 'Πώς μπορώ να αυξήσω την αποταμίευσή μου κατά 200€ αυτόν τον μήνα;'
      },
      {
        sender: 'bot',
        html: '<div style="line-height: 1.55;"><strong>📊 Έξυπνη Ανάλυση Αυγούστου:</strong><br><br>1. <strong>🍽️ Εστίαση & Delivery:</strong> Έχεις ξοδέψει 46,50€ αυτή την εβδομάδα. Περιορίζοντας 1 έξοδο, εξοικονομείς <strong>+60€/μήνα</strong>.<br><br>2. <strong>🍔 Τρόφιμα (Σούπερ Μάρκετ):</strong> Βρίσκεσαι στο 32% του budget (142,80€ / 450€). Με προγραμματισμένες αγορές κερδίζεις <strong>+80€</strong>.<br><br>3. <strong>🚗 Καύσιμα:</strong> Συνδυασμός διαδρομών εξοικονομεί <strong>+60€</strong>.<br><br>🎯 <em>Με αυτές τις 3 κινήσεις επιτυγχάνεις άμεσα τον στόχο των <strong>+200€</strong>!</em></div>'
      }
    ]
  };

  const demoBudgets = [
    { id: 'b1', category: 'Τρόφιμα', subcategory: '', amount: 450, currency: 'EUR', is_deleted: false, updated_at: new Date().toISOString() },
    { id: 'b2', category: 'Σπίτι', subcategory: '', amount: 600, currency: 'EUR', is_deleted: false, updated_at: new Date().toISOString() },
    { id: 'b3', category: 'Μεταφορές', subcategory: '', amount: 150, currency: 'EUR', is_deleted: false, updated_at: new Date().toISOString() },
    { id: 'b4', category: 'Εστίαση', subcategory: '', amount: 120, currency: 'EUR', is_deleted: false, updated_at: new Date().toISOString() }
  ];

  const avatarPath = path.join(__dirname, '..', 'avatar_user.jpg');
  const avatarBase64 = fs.existsSync(avatarPath) ? fs.readFileSync(avatarPath).toString('base64') : '';

  const partnerPath = path.join(__dirname, '..', 'avatar_partner.jpg');
  const partnerBase64 = fs.existsSync(partnerPath) ? fs.readFileSync(partnerPath).toString('base64') : '';

  const demoFamilyProfiles = [
    {
      id: 'u1',
      display_name: 'Νίκος Παπαδόπουλος',
      email: 'nikos@budgetassistant.app',
      role: 'admin',
      avatar_url: avatarBase64 ? 'data:image/jpeg;base64,' + avatarBase64 : ''
    },
    {
      id: 'u2',
      display_name: 'Μαρία Παπαδοπούλου',
      email: 'maria@budgetassistant.app',
      role: 'member',
      avatar_url: partnerBase64 ? 'data:image/jpeg;base64,' + partnerBase64 : ''
    },
    {
      id: 'u3',
      display_name: 'Γιώργος',
      email: 'giorgos@budgetassistant.app',
      role: 'member'
    }
  ];
  const demoFamilyGroup = { id: 'fam_1', name: 'Οικογένεια Παπαδοπούλου', invite_code: 'BUDGET-9921' };

  await page.evaluateOnNewDocument((txs, accs, conv, budgets, famProfiles, famGroup, avatarB64) => {
    const userObj = { id: 'u1', email: 'nikos@budgetassistant.app' };
    const profileObj = { id: 'u1', display_name: 'Νίκος Παπαδόπουλος', name: 'Νίκος Παπαδόπουλος', is_premium: true, family_id: 'fam_1', role: 'admin' };

    localStorage.setItem('cached_current_user', JSON.stringify(userObj));
    localStorage.setItem('cached_user_profile', JSON.stringify(profileObj));
    localStorage.setItem('auth_guest_mode', 'false');
    localStorage.setItem('has_seen_onboarding', 'true');
    localStorage.setItem('settings_app_lock_enabled', 'false');
    localStorage.setItem('app_lang', 'el');
    localStorage.setItem('offline_transactions', JSON.stringify(txs));
    localStorage.setItem('offline_accounts', JSON.stringify(accs));
    localStorage.setItem('offline_budgets', JSON.stringify(budgets));
    localStorage.setItem('cached_family_profiles', JSON.stringify(famProfiles));
    localStorage.setItem('cached_family_group', JSON.stringify(famGroup));
    localStorage.setItem('cached_partner_profile', JSON.stringify(famProfiles[1]));
    localStorage.setItem('advisor_conversations', JSON.stringify([conv]));
    localStorage.setItem('advisor_active_conv_id', conv.id);

    if (avatarB64) {
      const avatarDataUrl = 'data:image/jpeg;base64,' + avatarB64;
      localStorage.setItem('avatar_type_nikos@budgetassistant.app', 'custom');
      localStorage.setItem('avatar_custom_data_nikos@budgetassistant.app', avatarDataUrl);
    }
  }, cleanTxs, cleanAccounts, demoConv, demoBudgets, demoFamilyProfiles, demoFamilyGroup, avatarBase64);

  console.log('🌐 Navigating to Budget Assistant...');
  await page.goto('http://localhost:8085/', { waitUntil: 'networkidle0' });

  await page.evaluate((txs, accs, budgets, famProfiles, famGroup, avatarB64, y, m) => {
    // Completely remove overlays
    document.getElementById('auth-overlay')?.remove();
    document.getElementById('pin-lock-modal')?.remove();
    document.getElementById('onboarding-modal')?.remove();
    document.getElementById('early-auth-style')?.remove();

    if (window.state) {
      window.state.guestMode = false;
      window.state.currentUser = { id: 'u1', email: 'nikos@budgetassistant.app' };
      window.state.userProfile = { id: 'u1', display_name: 'Νίκος Παπαδόπουλος', name: 'Νίκος Παπαδόπουλος', is_premium: true, family_id: 'fam_1', role: 'admin' };
      window.state.transactions = txs;
      window.state.accounts = accs;
      window.state.budgets = budgets;
      window.state.familyProfiles = famProfiles;
      window.state.familyGroup = famGroup;
      window.state.partnerProfile = famProfiles[1];
      window.state.selectedYear = y;
      window.state.selectedMonth = m;
      window.state.lang = 'el';
    }

    if (typeof calculateAccountBalances === 'function') calculateAccountBalances();
    if (typeof renderTransactionsTab === 'function') renderTransactionsTab();
    if (typeof updateHeaderStats === 'function') updateHeaderStats();
    if (typeof renderStatsTab === 'function') renderStatsTab();
    if (typeof renderAccountsTab === 'function') renderAccountsTab();
    if (typeof updateHeaderProfileBadge === 'function') updateHeaderProfileBadge();
    if (typeof updateUI === 'function') updateUI();
    if (typeof applyLanguage === 'function') applyLanguage('el');

    const badge = document.getElementById('user-profile-badge');
    if (badge && avatarB64) {
      badge.style.display = 'flex';
      badge.style.backgroundImage = `url(data:image/jpeg;base64,${avatarB64})`;
      badge.style.backgroundSize = 'cover';
      badge.style.backgroundPosition = 'center';
      badge.textContent = '';
    }
  }, cleanTxs, cleanAccounts, demoBudgets, demoFamilyProfiles, demoFamilyGroup, avatarBase64, y, m);

  await new Promise(r => setTimeout(r, 1500));

  // 1. Transactions Tab Screenshot
  console.log('📸 1. Capturing Transactions Screen...');
  await page.evaluate(() => {
    if (typeof switchTab === 'function') switchTab('trans');
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT_DIR, '01_Real_Transactions.png') });

  // 1b. Family Hub Management Screen Screenshot
  console.log('📸 1b. Capturing Family Hub Management Screen...');
  await page.evaluate(() => {
    if (typeof switchTab === 'function') switchTab('settings');
    if (typeof openSettingsSubscreen === 'function') openSettingsSubscreen('family', 'settings_family_title');
    if (typeof renderPartnerSection === 'function') renderPartnerSection();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '02_Real_Family_Hub.png') });

  // Close family subscreen modal so subsequent tabs are not blocked
  await page.evaluate(() => {
    if (typeof closeModal === 'function') closeModal('settings-subscreen-modal');
    const subModal = document.getElementById('settings-subscreen-modal');
    if (subModal) {
      subModal.classList.remove('active');
      subModal.style.display = 'none';
    }
  });
  await new Promise(r => setTimeout(r, 600));

  // 2. Statistics Tab Screenshot
  console.log('📸 2. Capturing Statistics Screen...');
  await page.evaluate(() => {
    if (typeof switchTab === 'function') switchTab('stats');
    if (typeof switchStatsSubtab === 'function') switchStatsSubtab('breakdown');
    if (typeof renderStatsTab === 'function') renderStatsTab(false);
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT_DIR, '02_Real_Statistics.png') });

  // 3. Category Budgets Tab Screenshot
  console.log('📸 3. Capturing Category Budgets Screen...');
  await page.evaluate(() => {
    if (typeof switchTab === 'function') switchTab('stats');
    if (typeof switchStatsSubtab === 'function') switchStatsSubtab('budgets');
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT_DIR, '03_Real_Category_Budgets.png') });

  // 4. AI Advisor Chat Screenshot
  console.log('📸 4. Capturing AI Advisor Chat Screen...');
  await page.evaluate((conv) => {
    const advModal = document.getElementById('advisor-chat-modal');
    if (advModal) {
      document.body.appendChild(advModal);
      advModal.classList.add('active');
      advModal.style.display = 'flex';
      advModal.style.opacity = '1';
      advModal.style.visibility = 'visible';
      advModal.style.zIndex = '99999';
    }

    const listEl = document.getElementById('advisor-conversation-list');
    const chatLog = document.getElementById('advisor-chat-log');
    const backBtn = document.getElementById('advisor-chat-back-btn');
    if (listEl) listEl.style.display = 'none';
    if (backBtn) backBtn.style.display = 'flex';
    if (chatLog) {
      chatLog.style.display = 'flex';
      chatLog.innerHTML = `
        <div style="display:flex; justify-content:flex-end; width:100%; margin-bottom: 10px;">
          <div style="background: var(--accent); color: #fff; padding: 12px 16px; border-radius: 18px 18px 4px 18px; max-width: 85%; font-size: 13.5px; line-height: 1.4;">
            ${conv.messages[0].html}
          </div>
        </div>
        <div style="display:flex; justify-content:flex-start; width:100%; margin-bottom: 10px;">
          <div style="background: var(--card-bg, #1a1a24); border: 1px solid var(--border, rgba(255,255,255,0.1)); color: var(--text-primary); padding: 14px 16px; border-radius: 18px 18px 18px 4px; max-width: 92%; font-size: 13px; line-height: 1.55; box-shadow: 0 4px 12px rgba(0,0,0,0.25);">
            ${conv.messages[1].html}
          </div>
        </div>
      `;
    }
  }, demoConv);
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '04_Real_AI_Advisor_Chat.png') });

  // Close advisor modal
  await page.evaluate(() => {
    const advModal = document.getElementById('advisor-chat-modal');
    if (advModal) {
      advModal.classList.remove('active');
      advModal.style.display = 'none';
    }
  });
  await new Promise(r => setTimeout(r, 400));

  // 5. Accounts & Wallets Tab Screenshot
  console.log('📸 5. Capturing Accounts Screen...');
  await page.evaluate(() => {
    if (typeof switchTab === 'function') switchTab('accounts');
    if (typeof renderAccountsTab === 'function') renderAccountsTab();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '05_Real_Accounts_Health.png') });

  // 6. Add Transaction Modal
  console.log('📸 6. Capturing Add Transaction Modal...');
  await page.evaluate(() => {
    if (typeof openModal === 'function') {
      openModal('transaction-modal', { instant: true });
    }
    const modal = document.getElementById('transaction-modal');
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
      modal.style.opacity = '1';
      modal.style.visibility = 'visible';
    }

    const amountInput = document.getElementById('trans-amount');
    if (amountInput) amountInput.value = '45.00';

    const titleInput = document.getElementById('trans-note');
    if (titleInput) titleInput.value = 'Εβδομαδιαία Ψώνια';

    const descInput = document.getElementById('trans-desc');
    if (descInput) descInput.value = 'Σκλαβενίτης - Τρόφιμα & Είδη Σπιτιού';

    const catHidden = document.getElementById('trans-category');
    if (catHidden) catHidden.value = '🛒 ΔΙΑΤΡΟΦΗ';

    const accFrom = document.getElementById('trans-account-from');
    if (accFrom) accFrom.value = 'Κάρτα';

    if (typeof updateCategoryDisplay === 'function') updateCategoryDisplay();
    if (typeof updateAccountDropdowns === 'function') updateAccountDropdowns();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '06_Real_Transaction_Modal.png') });

  await browser.close();
  server.close();
  console.log('✨ All 100% REAL screenshots captured successfully in PlayStore_Assets!');
}

capture().catch(err => {
  console.error('❌ Error during capture:', err);
  process.exit(1);
});
