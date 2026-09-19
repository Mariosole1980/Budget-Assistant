const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT_DIR = path.resolve(__dirname, '..');
const EN_RAW_DIR = path.join('C:\\Users\\mario\\Desktop', 'PlayStore_Assets_EN');
const EN_MOCKUP_DIR = path.join('C:\\Users\\mario\\Desktop', 'PlayStore-Mockups-EN');

if (!fs.existsSync(EN_RAW_DIR)) fs.mkdirSync(EN_RAW_DIR, { recursive: true });
if (!fs.existsSync(EN_MOCKUP_DIR)) fs.mkdirSync(EN_MOCKUP_DIR, { recursive: true });

function getBase64Image(filePath) {
  const bitmap = fs.readFileSync(filePath);
  return `data:image/png;base64,${bitmap.toString('base64')}`;
}

function startServer(port) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2'
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const filePath = path.join(ROOT_DIR, reqPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found: ' + reqPath);
    }
  });

  return new Promise(resolve => server.listen(port, () => resolve(server)));
}

async function run() {
  console.log('====================================================');
  console.log('🌍 GENERATING 100% ENGLISH PLAY STORE ASSETS & MOCKUPS');
  console.log('====================================================\n');

  console.log('🚀 Starting local server on port 8086...');
  const appServer = await startServer(8086);

  console.log('📱 Launching Chromium...');
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

  const cleanTxsEn = [
    { id: 'tx_income_new', amount: 350.00, type: 'income', category: '💼 ΜΙΣΘΟΣ', subcategory: 'Freelance', date: `${y}-${mStr}-16T10:15:00Z`, note: 'Freelance Design Bonus', description: '', account_from: 'Bank Account', account_to: '', user_id: 'u1', created_by: 'u1' },
    { id: 'tx_11', amount: 95.00, type: 'expense', category: '👕 ΑΓΟΡΕΣ', subcategory: 'Ρούχα', date: `${y}-${mStr}-16T18:00:00Z`, note: 'Zara - Clothes & Shoes', description: '', account_from: 'Card', account_to: '', user_id: 'u2', created_by: 'u2' },
    { id: 'tx_income_refund', amount: 180.00, type: 'income', category: '💸 BONUS', subcategory: 'Cashback', date: `${y}-${mStr}-15T14:30:00Z`, note: 'Tax Refund & Cashback', description: '', account_from: 'Card', account_to: '', user_id: 'u2', created_by: 'u2' },
    { id: 'tx_10', amount: 85.00, type: 'expense', category: '🏠 ΣΠΙΤΙ', subcategory: 'ΔΕΗ', date: `${y}-${mStr}-15T10:30:00Z`, note: 'Electric Utilities Bill', description: '', account_from: 'Bank Account', account_to: '', user_id: 'u1', created_by: 'u1' },
    { id: 'tx_9', amount: 12.99, type: 'expense', category: '📱 ΣΥΝΔΡΟΜΕΣ', subcategory: 'Streaming', date: `${y}-${mStr}-14T15:00:00Z`, note: 'Netflix Premium 4K', description: '', account_from: 'Card', account_to: '', user_id: 'u1', created_by: 'u1' },
    { id: 'tx_8', amount: 28.00, type: 'expense', category: '❤️ ΥΓΕΙΑ', subcategory: 'Φάρμακα', date: `${y}-${mStr}-12T12:00:00Z`, note: 'Vitamins & Healthcare', description: '', account_from: 'Cash', account_to: '', user_id: 'u1', created_by: 'u1' },
    { id: 'tx_7', amount: 3.80, type: 'expense', category: '🛒 ΔΙΑΤΡΟΦΗ', subcategory: 'Καφές', date: `${y}-${mStr}-10T08:30:00Z`, note: 'Morning Espresso & Snack', description: '', account_from: 'Cash', account_to: '', user_id: 'u1', created_by: 'u1' },
    { id: 'tx_6', amount: 46.50, type: 'expense', category: '🎉 ΔΙΑΣΚΕΔΑΣΗ', subcategory: 'Έξοδος/Βόλτα', date: `${y}-${mStr}-09T21:15:00Z`, note: 'Family Dinner Out', description: '', account_from: 'Card', account_to: '', user_id: 'u2', created_by: 'u2' },
    { id: 'tx_5', amount: 65.00, type: 'expense', category: '🚗 ΜΕΤΑΦΟΡΕΣ', subcategory: 'Βενζίνες', date: `${y}-${mStr}-07T14:20:00Z`, note: 'Gasoline Fuel (Shell)', description: '', account_from: 'Card', account_to: '', user_id: 'u1', created_by: 'u1' },
    { id: 'tx_4', amount: 142.80, type: 'expense', category: '🛒 ΔΙΑΤΡΟΦΗ', subcategory: 'Σουπερμάρκετ', date: `${y}-${mStr}-05T17:45:00Z`, note: 'Weekly Groceries Mart', description: 'Whole Foods Market', account_from: 'Card', account_to: '', user_id: 'u2', created_by: 'u2' },
    { id: 'tx_3', amount: 550.00, type: 'expense', category: '🏠 ΣΠΙΤΙ', subcategory: 'Ενοίκιο', date: `${y}-${mStr}-02T10:00:00Z`, note: 'Apartment Monthly Rent', description: '', account_from: 'Bank Account', account_to: '', user_id: 'u1', created_by: 'u1' },
    { id: 'tx_1', amount: 2600.00, type: 'income', category: '💼 ΜΙΣΘΟΣ', subcategory: '', date: `${y}-${mStr}-01T09:00:00Z`, note: 'Main Monthly Salary', description: 'Monthly payroll', account_from: 'Bank Account', account_to: '', user_id: 'u1', created_by: 'u1' }
  ];

  const cleanAccountsEn = [
    { id: 'acc_1', name: 'Bank Account', balance: 3420.00, icon: '🏦' },
    { id: 'acc_2', name: 'Card', balance: 850.00, icon: '💳' },
    { id: 'acc_3', name: 'Cash', balance: 240.00, icon: '💵' }
  ];

  const demoBudgetsEn = [
    { id: 'b1', category: '🛒 ΔΙΑΤΡΟΦΗ', subcategory: '', amount: 450, currency: 'EUR', is_deleted: false, updated_at: new Date().toISOString() },
    { id: 'b2', category: '🏠 ΣΠΙΤΙ', subcategory: '', amount: 650, currency: 'EUR', is_deleted: false, updated_at: new Date().toISOString() },
    { id: 'b3', category: '🚗 ΜΕΤΑΦΟΡΕΣ', subcategory: '', amount: 150, currency: 'EUR', is_deleted: false, updated_at: new Date().toISOString() },
    { id: 'b4', category: '👕 ΑΓΟΡΕΣ', subcategory: '', amount: 180, currency: 'EUR', is_deleted: false, updated_at: new Date().toISOString() },
    { id: 'b5', category: '🎉 ΔΙΑΣΚΕΔΑΣΗ', subcategory: '', amount: 120, currency: 'EUR', is_deleted: false, updated_at: new Date().toISOString() }
  ];

  const demoConvEn = {
    id: 'conv_demo_en',
    title: 'Spending Insights & Savings',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
    messages: [
      {
        sender: 'user',
        html: 'How can I increase my monthly savings by €200 this month?'
      },
      {
        sender: 'bot',
        html: '<div style="line-height: 1.55;"><strong>📊 Smart September Analysis:</strong><br><br>1. <strong>🍽️ Dining & Delivery:</strong> You have spent €46.50 this week. Cutting 1 delivery saves <strong>+€60/month</strong>.<br><br>2. <strong>🍔 Groceries:</strong> You are at 32% of budget (€142.80 / €450). Planning trips saves <strong>+€80</strong>.<br><br>3. <strong>🚗 Fuel:</strong> Combining errands saves <strong>+€60</strong>.<br><br>🎯 <em>With these 3 steps you reach your <strong>+€200</strong> savings target effortlessly!</em></div>'
      }
    ]
  };

  const avatarPath = path.join(ROOT_DIR, 'avatar_user.jpg');
  const avatarBase64 = fs.existsSync(avatarPath) ? fs.readFileSync(avatarPath).toString('base64') : '';

  const partnerPath = path.join(ROOT_DIR, 'avatar_partner.jpg');
  const partnerBase64 = fs.existsSync(partnerPath) ? fs.readFileSync(partnerPath).toString('base64') : '';

  const demoFamilyProfilesEn = [
    {
      id: 'u1',
      display_name: 'Alex Johnson',
      email: 'alex@budgetassistant.app',
      role: 'admin',
      premium_active: true,
      avatar_url: avatarBase64 ? 'data:image/jpeg;base64,' + avatarBase64 : ''
    },
    {
      id: 'u2',
      display_name: 'Sarah Johnson',
      email: 'sarah@budgetassistant.app',
      role: 'member',
      premium_active: true,
      avatar_url: partnerBase64 ? 'data:image/jpeg;base64,' + partnerBase64 : ''
    },
    {
      id: 'u3',
      display_name: 'Leo',
      email: 'leo@budgetassistant.app',
      role: 'member',
      premium_active: true
    }
  ];
  const demoFamilyGroupEn = { id: 'fam_1', name: 'Johnson Family Budget', invite_code: 'BUDGET-9921' };

  await page.evaluateOnNewDocument((txs, accs, conv, budgets, famProfiles, famGroup, avatarB64) => {
    const userObj = { id: 'u1', email: 'alex@budgetassistant.app' };
    const profileObj = { id: 'u1', display_name: 'Alex Johnson', name: 'Alex Johnson', is_premium: true, premium_active: true, family_id: 'fam_1', role: 'admin' };

    localStorage.setItem('cached_current_user', JSON.stringify(userObj));
    localStorage.setItem('cached_user_profile', JSON.stringify(profileObj));
    localStorage.setItem('auth_guest_mode', 'false');
    localStorage.setItem('has_seen_onboarding', 'true');
    localStorage.setItem('settings_app_lock_enabled', 'false');
    localStorage.setItem('app_lang', 'en');
    localStorage.setItem('lang', 'en');
    localStorage.setItem('budget_lang', 'en');
    localStorage.setItem('premium_active', 'true');
    localStorage.setItem('account_view_mode', 'all');
    localStorage.setItem('offline_transactions', JSON.stringify(txs));
    localStorage.setItem('offline_accounts', JSON.stringify(accs));
    localStorage.setItem('cached_budgets', JSON.stringify(budgets));
    localStorage.setItem('money_manager_budgets', JSON.stringify(budgets));
    localStorage.setItem('cached_family_profiles', JSON.stringify(famProfiles));
    localStorage.setItem('cached_family_group', JSON.stringify(famGroup));
    localStorage.setItem('cached_partner_profile', JSON.stringify(famProfiles[1]));
    localStorage.setItem('advisor_conversations', JSON.stringify([conv]));
    localStorage.setItem('advisor_active_conv_id', conv.id);

    if (avatarB64) {
      const avatarDataUrl = 'data:image/jpeg;base64,' + avatarB64;
      localStorage.setItem('avatar_type_alex@budgetassistant.app', 'custom');
      localStorage.setItem('avatar_custom_data_alex@budgetassistant.app', avatarDataUrl);
    }
  }, cleanTxsEn, cleanAccountsEn, demoConvEn, demoBudgetsEn, demoFamilyProfilesEn, demoFamilyGroupEn, avatarBase64);

  console.log('🌐 Loading English app UI...');
  await page.goto('http://localhost:8086/', { waitUntil: 'networkidle0' });

  await page.evaluate((txs, accs, budgets, famProfiles, famGroup, avatarB64, y, m) => {
    document.getElementById('cold-start-frame')?.remove();
    document.getElementById('cold-start-overlay')?.remove();
    document.getElementById('auth-overlay')?.remove();
    document.getElementById('pin-lock-modal')?.remove();
    document.getElementById('onboarding-modal')?.remove();
    document.getElementById('early-auth-style')?.remove();

    if (window.state) {
      window.state.guestMode = false;
      window.state.currentUser = { id: 'u1', email: 'alex@budgetassistant.app' };
      window.state.userProfile = { id: 'u1', display_name: 'Alex Johnson', name: 'Alex Johnson', is_premium: true, premium_active: true, family_id: 'fam_1', role: 'admin' };
      window.state.transactions = txs;
      window.state.accounts = accs;
      window.state.budgets = budgets;
      window.state.accountViewMode = 'all';
      window.state.familyProfiles = famProfiles;
      window.state.familyGroup = famGroup;
      window.state.partnerProfile = famProfiles[1];
      window.state.selectedYear = y;
      window.state.selectedMonth = m;
      window.state.lang = 'en';
    }

    if (typeof applyLanguage === 'function') applyLanguage('en');
    if (typeof calculateAccountBalances === 'function') calculateAccountBalances();
    if (typeof renderTransactionsTab === 'function') renderTransactionsTab();
    if (typeof updateHeaderStats === 'function') updateHeaderStats();
    if (typeof renderStatsTab === 'function') renderStatsTab();
    if (typeof renderAccountsTab === 'function') renderAccountsTab();
    if (typeof updateHeaderProfileBadge === 'function') updateHeaderProfileBadge();
    if (typeof updateUI === 'function') updateUI();

    const badge = document.getElementById('user-profile-badge');
    if (badge && avatarB64) {
      badge.style.display = 'flex';
      badge.style.backgroundImage = `url(data:image/jpeg;base64,${avatarB64})`;
      badge.style.backgroundSize = 'cover';
      badge.style.backgroundPosition = 'center';
      badge.textContent = '';
    }
  }, cleanTxsEn, cleanAccountsEn, demoBudgetsEn, demoFamilyProfilesEn, demoFamilyGroupEn, avatarBase64, y, m);

  await new Promise(r => setTimeout(r, 1200));

  // 1. Transactions
  console.log('📸 Capturing 01_Real_Transactions.png (EN)...');
  await page.evaluate(() => {
    if (typeof switchTab === 'function') switchTab('trans');
    if (typeof renderTransactionsTab === 'function') renderTransactionsTab();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(EN_RAW_DIR, '01_Real_Transactions.png') });

  // 2. Family Hub Management Screen
  console.log('📸 Capturing 02_Real_Family_Hub.png (EN)...');
  await page.evaluate(() => {
    if (typeof switchTab === 'function') switchTab('settings');
    if (typeof openSettingsSubscreen === 'function') openSettingsSubscreen('family', 'settings_family_title');
    if (typeof renderPartnerSection === 'function') renderPartnerSection();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(EN_RAW_DIR, '02_Real_Family_Hub.png') });

  // Close family subscreen modal
  await page.evaluate(() => {
    if (typeof closeModal === 'function') closeModal('settings-subscreen-modal');
    const subModal = document.getElementById('settings-subscreen-modal');
    if (subModal) {
      subModal.classList.remove('active');
      subModal.style.display = 'none';
    }
  });
  await new Promise(r => setTimeout(r, 600));

  // 3. Category Budgets Tab
  console.log('📸 Capturing 03_Real_Category_Budgets.png (EN)...');
  await page.evaluate((budgets) => {
    window.state.budgets = budgets;
    if (typeof switchTab === 'function') switchTab('stats');
    if (typeof switchStatsSubtab === 'function') switchStatsSubtab('budgets');
    if (typeof renderStatsTab === 'function') renderStatsTab(true);
  }, demoBudgetsEn);
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(EN_RAW_DIR, '03_Real_Category_Budgets.png') });

  // 4. AI Advisor Chat Modal
  console.log('📸 Capturing 04_Real_AI_Advisor_Chat.png (EN)...');
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
    const subtitleSpan = advModal ? advModal.querySelector('span[style*="11px"]') : null;
    if (subtitleSpan) subtitleSpan.textContent = 'Personal Financial Guidance';
  }, demoConvEn);
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(EN_RAW_DIR, '04_Real_AI_Advisor_Chat.png') });

  // Close advisor modal
  await page.evaluate(() => {
    const advModal = document.getElementById('advisor-chat-modal');
    if (advModal) {
      advModal.classList.remove('active');
      advModal.style.display = 'none';
    }
  });
  await new Promise(r => setTimeout(r, 500));

  // 5. Statistics Tab (Breakdown)
  console.log('📸 Capturing 02_Real_Statistics.png (EN)...');
  await page.evaluate(() => {
    if (typeof switchTab === 'function') switchTab('stats');
    if (typeof switchStatsSubtab === 'function') switchStatsSubtab('breakdown');
    if (typeof renderStatsTab === 'function') renderStatsTab(false);
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(EN_RAW_DIR, '02_Real_Statistics.png') });

  // 6. Accounts & Financial Health
  console.log('📸 Capturing 05_Real_Accounts_Health.png (EN)...');
  await page.evaluate(() => {
    if (typeof switchTab === 'function') switchTab('accounts');
    if (typeof renderAccountsTab === 'function') renderAccountsTab();

    // Ensure 100% English on Safe-to-Spend & Savings Runway
    const dailySuffix = document.querySelector('.sts-daily-suffix');
    if (dailySuffix) dailySuffix.textContent = '/ day';

    const meterLabel = document.querySelector('.sts-meter-label');
    if (meterLabel) meterLabel.textContent = 'WEEK';

    const actionLink = document.querySelector('.sts-action-link');
    if (actionLink) actionLink.textContent = 'Analysis & What-If ➔';

    const stsSub = document.getElementById('sts-subtitle');
    if (stsSub) stsSub.textContent = '14 days remaining • After bills (€ 0.00)';

    const healthLabel = document.getElementById('runway-health-label');
    if (healthLabel) healthLabel.textContent = 'Score:';

    const runwayMonthsLabel = document.getElementById('runway-months-label');
    if (runwayMonthsLabel) runwayMonthsLabel.textContent = 'Safety Runway';

    const runwayCardTitle = document.getElementById('runway-card-title');
    if (runwayCardTitle) runwayCardTitle.textContent = 'Savings Goal & Runway';

    const runwayCardSubtitle = document.getElementById('runway-card-subtitle');
    if (runwayCardSubtitle) runwayCardSubtitle.textContent = 'Annual Progress & Security';

    document.querySelectorAll('#savings-runway-overview-card *').forEach(el => {
      if (el.children.length === 0) {
        if (el.textContent.includes('Ανάλυση')) el.textContent = el.textContent.replace(/Ανάλυση/g, 'Analysis');
        if (el.textContent.includes('μήνες') || el.textContent.includes('μ.')) el.textContent = el.textContent.replace(/μήνες|μ\./g, 'mos');
      }
    });
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(EN_RAW_DIR, '05_Real_Accounts_Health.png') });

  // 7. Add Transaction Modal
  console.log('📸 Capturing 06_Real_Transaction_Modal.png (EN)...');
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

    const modalTitle = document.getElementById('modal-trans-title');
    if (modalTitle) modalTitle.textContent = 'Expense';

    const dateDisplay = document.getElementById('trans-date-display');
    if (dateDisplay) dateDisplay.textContent = 'Sep 16, 2026 (Wed) 19:38';

    const amountInput = document.getElementById('trans-amount');
    if (amountInput) amountInput.value = '45.00';

    const titleInput = document.getElementById('trans-note');
    if (titleInput) titleInput.value = 'Weekly Groceries & Snacks';

    const descInput = document.getElementById('trans-desc');
    if (descInput) descInput.value = 'Whole Foods - Organic food & snacks';

    const catHidden = document.getElementById('trans-category');
    if (catHidden) catHidden.value = '🛒 ΔΙΑΤΡΟΦΗ';

    const accFrom = document.getElementById('trans-account-from');
    if (accFrom) accFrom.value = 'Card';

    if (typeof updateCategoryDisplay === 'function') updateCategoryDisplay();
    if (typeof updateAccountDropdowns === 'function') updateAccountDropdowns();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(EN_RAW_DIR, '06_Real_Transaction_Modal.png') });

  // 8. Premium Lifetime Modal
  console.log('📸 Capturing 07_Real_Premium_Lifetime.png (EN)...');
  await page.evaluate(() => {
    if (typeof closeModal === 'function') closeModal('transaction-modal');
    const txModal = document.getElementById('transaction-modal');
    if (txModal) {
      txModal.classList.remove('active');
      txModal.style.display = 'none';
    }

    const activeBanner = document.getElementById('premium-active-banner');
    if (activeBanner) activeBanner.style.display = 'none';

    if (typeof openModal === 'function') {
      openModal('premium-modal', { instant: true });
    }
    const premModal = document.getElementById('premium-modal');
    if (premModal) {
      premModal.classList.add('active');
      premModal.style.display = 'flex';
      premModal.style.opacity = '1';
      premModal.style.visibility = 'visible';
    }

    document.querySelectorAll('#premium-modal *').forEach(el => {
      if (el.children.length === 0) {
        if (el.textContent.includes('Safe-to-Spend & Πρόβλεψη Ρευστότητας Μήνα')) {
          el.textContent = 'Safe-to-Spend & Cashflow Forecast';
        }
        if (el.textContent.includes('Αυτόματο Settle-Up ("Ποιος χρωστάει σε ποιον")')) {
          el.textContent = 'Automatic Settle-Up ("Who Owes What")';
        }
      }
    });
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(EN_RAW_DIR, '07_Real_Premium_Lifetime.png') });

  await browser.close();
  appServer.close();
  console.log('✨ All 8 English raw screenshots captured successfully!\n');

  // =========================================================================
  // STAGE 2: GENERATE 8 MARKETING MOCKUPS (1080x2400) IN ENGLISH
  // =========================================================================
  console.log('🎨 Generating 1080x2400 English Marketing Mockups...');

  const slidesEn = [
    {
      file: '01_Real_Transactions.png',
      outName: '01_Marketing_Transactions_EN.png',
      badge: '💰 FINANCIAL CONTROL',
      title: 'EXPENSE TRACKING<br>& NET CASHFLOW',
      subtitle: 'Track income, expenses, and real-time net balance in 1 tap.',
      bgGradient: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0f172a 60%, #050811 100%)',
      accentColor: '#38bdf8'
    },
    {
      file: '02_Real_Family_Hub.png',
      outName: '02_Marketing_Family_Cloud_EN.png',
      badge: '👨‍👩‍👧 FAMILY & CLOUD',
      title: 'SHARED BUDGET<br>& MEMBER WALLETS',
      subtitle: 'Connect your partner & family. Split expenses with live sync on all devices.',
      bgGradient: 'radial-gradient(circle at 50% 20%, #0c4a6e 0%, #0f172a 60%, #050811 100%)',
      accentColor: '#38bdf8'
    },
    {
      file: '04_Real_AI_Advisor_Chat.png',
      outName: '03_Marketing_AI_Advisor_EN.png',
      badge: '🤖 AI FINANCIAL ADVISOR',
      title: 'SMART AI COACH<br>ALWAYS BY YOUR SIDE',
      subtitle: 'Intelligent spending insights and actionable tips to boost your savings.',
      bgGradient: 'radial-gradient(circle at 50% 20%, #2e1065 0%, #0f172a 60%, #050811 100%)',
      accentColor: '#c084fc'
    },
    {
      file: '03_Real_Category_Budgets.png',
      outName: '04_Marketing_Budgets_EN.png',
      badge: '🎯 SMART BUDGETS',
      title: 'CATEGORY BUDGET LIMITS<br>& SAFE-TO-SPEND',
      subtitle: 'Set monthly limits per category and know exactly what you can safely spend daily.',
      bgGradient: 'radial-gradient(circle at 50% 20%, #064e3b 0%, #0f172a 60%, #050811 100%)',
      accentColor: '#34d399'
    },
    {
      file: '02_Real_Statistics.png',
      outName: '05_Marketing_Statistics_EN.png',
      badge: '📊 ADVANCED ANALYTICS',
      title: 'EXPENSE BREAKDOWN<br>& FINANCIAL CHARTS',
      subtitle: 'Detailed charts, monthly trends, and visual category insights at a glance.',
      bgGradient: 'radial-gradient(circle at 50% 20%, #701a75 0%, #0f172a 60%, #050811 100%)',
      accentColor: '#f472b6'
    },
    {
      file: '05_Real_Accounts_Health.png',
      outName: '06_Marketing_Financial_Health_EN.png',
      badge: '🏦 ACCOUNTS & HEALTH',
      title: 'FINANCIAL HEALTH SCORE<br>& WEALTH TRACKER',
      subtitle: 'Manage Banks, Cards & Cash with an automated Financial Health Score (FHS).',
      bgGradient: 'radial-gradient(circle at 50% 20%, #1e293b 0%, #0f172a 60%, #050811 100%)',
      accentColor: '#60a5fa'
    },
    {
      file: '06_Real_Transaction_Modal.png',
      outName: '07_Marketing_Add_Transaction_EN.png',
      badge: '⚡ LIGHTNING FAST ENTRY',
      title: 'QUICK TRANSACTION LOGGING<br>& RECURRING BILLS',
      subtitle: 'Installments, recurring templates, notes and auto-categorization in seconds.',
      bgGradient: 'radial-gradient(circle at 50% 20%, #7c2d12 0%, #0f172a 60%, #050811 100%)',
      accentColor: '#fb923c'
    },
    {
      file: '07_Real_Premium_Lifetime.png',
      outName: '08_Marketing_Lifetime_Deal_EN.png',
      badge: '👑 EARLY BIRD SPECIAL',
      title: 'PREMIUM LIFETIME<br>ONLY €9.99 ONE-TIME',
      subtitle: 'Special launch deal for the first 100 users (regular €29.99). No subscriptions!',
      bgGradient: 'radial-gradient(circle at 50% 20%, #78350f 0%, #0f172a 60%, #050811 100%)',
      accentColor: '#f59e0b'
    }
  ];

  function generateHtml(slide) {
    const imgSrc = getBase64Image(path.join(EN_RAW_DIR, slide.file));
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      width: 1080px;
      height: 2400px;
      background: ${slide.bgGradient};
      font-family: 'Roboto', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      overflow: hidden;
      position: relative;
    }
    .glow-sphere-1 {
      position: absolute;
      top: 4%;
      left: 50%;
      transform: translateX(-50%);
      width: 850px;
      height: 850px;
      background: radial-gradient(circle, ${slide.accentColor}30 0%, rgba(0,0,0,0) 70%);
      pointer-events: none;
      filter: blur(70px);
    }
    .header-section {
      width: 100%;
      padding: 110px 50px 40px 50px;
      text-align: center;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 24px;
      border-radius: 100px;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.16);
      backdrop-filter: blur(14px);
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: ${slide.accentColor};
      margin-bottom: 26px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    .headline {
      font-size: 60px;
      font-weight: 900;
      line-height: 1.22;
      letter-spacing: -0.5px;
      margin-bottom: 20px;
      color: #ffffff;
      text-shadow: 0 4px 24px rgba(0,0,0,0.6);
    }
    .subheadline {
      font-size: 28px;
      font-weight: 400;
      line-height: 1.45;
      color: #94a3b8;
      max-width: 920px;
      letter-spacing: -0.2px;
    }
    .device-container {
      position: absolute;
      bottom: -60px;
      width: 880px;
      height: 1720px;
      z-index: 5;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .phone-frame {
      width: 100%;
      height: 100%;
      background: #0b0f19;
      border-radius: 56px 56px 0 0;
      border: 12px solid #252a38;
      border-bottom: none;
      box-shadow: 
        0 -25px 80px rgba(0, 0, 0, 0.85),
        0 0 0 2px rgba(255, 255, 255, 0.1),
        inset 0 0 0 2px rgba(0, 0, 0, 0.8);
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .screen-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
    }
  </style>
</head>
<body>
  <div class="glow-sphere-1"></div>
  <div class="header-section">
    <div class="badge-pill">${slide.badge}</div>
    <h1 class="headline">${slide.title}</h1>
    <p class="subheadline">${slide.subtitle}</p>
  </div>
  <div class="device-container">
    <div class="phone-frame">
      <img class="screen-image" src="${imgSrc}" alt="App Screen">
    </div>
  </div>
</body>
</html>
    `;
  }

  let currentHtml = '';
  const mockupServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(currentHtml);
  });
  await new Promise(r => mockupServer.listen(8098, r));

  const mockupBrowser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const mPage = await mockupBrowser.newPage();
  await mPage.setViewport({ width: 1080, height: 2400, deviceScaleFactor: 1 });

  for (let i = 0; i < slidesEn.length; i++) {
    const s = slidesEn[i];
    console.log(`🖼️ Rendering slide ${i + 1}/${slidesEn.length}: ${s.outName}`);
    currentHtml = generateHtml(s);
    await mPage.goto('http://localhost:8098/', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const outDest1 = path.join(EN_MOCKUP_DIR, s.outName);
    const outSubdir = path.join(EN_RAW_DIR, 'Marketing_Mockups');
    if (!fs.existsSync(outSubdir)) fs.mkdirSync(outSubdir, { recursive: true });
    const outDest2 = path.join(outSubdir, s.outName);

    await mPage.screenshot({ path: outDest1, type: 'png' });
    fs.copyFileSync(outDest1, outDest2);
  }

  // =========================================================================
  // STAGE 3: GENERATE ENGLISH FEATURE GRAPHIC (1024x500)
  // =========================================================================
  console.log('🎨 Generating 1024x500 English Feature Graphic...');
  const bgArtPath = path.join(ROOT_DIR, 'assets', 'playstore', 'feature_graphic.png');
  const bgArtBase64 = fs.existsSync(bgArtPath) ? getBase64Image(bgArtPath) : '';

  const fgHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800;900&family=Roboto:wght@500;700&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      width: 1024px;
      height: 500px;
      background: #000;
      position: relative;
      overflow: hidden;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .art-bg {
      position: absolute;
      top: 0;
      left: 0;
      width: 1024px;
      height: 500px;
      object-fit: cover;
    }
    .text-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 250px;
      background: linear-gradient(to top, #000000 0%, #000000 78%, rgba(0,0,0,0.92) 88%, rgba(0,0,0,0) 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding-top: 30px;
    }
    .brand {
      font-size: 26px;
      font-weight: 700;
      color: #f1f5f9;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.9);
    }
    .headline {
      font-size: 46px;
      font-weight: 900;
      background: linear-gradient(135deg, #fca5a5 0%, #fef08a 35%, #86efac 70%, #93c5fd 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
      filter: drop-shadow(0 4px 18px rgba(56,189,248,0.3));
    }
  </style>
</head>
<body>
  ${bgArtBase64 ? `<img class="art-bg" src="${bgArtBase64}" />` : ''}
  <div class="text-overlay">
    <div class="brand">Budget Assistant</div>
    <div class="headline">Smart Financial Management</div>
  </div>
</body>
</html>
  `;
  currentHtml = fgHtml;
  await mPage.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
  await mPage.goto('http://localhost:8098/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  const fgDest1 = path.join(EN_MOCKUP_DIR, '00_Feature_Graphic_1024x500_EN.png');
  const fgDest2 = path.join(EN_RAW_DIR, '01_Feature_Graphic_1024x500_EN.png');
  await mPage.screenshot({ path: fgDest1, type: 'png' });
  fs.copyFileSync(fgDest1, fgDest2);

  const iconDest1 = path.join(EN_MOCKUP_DIR, '00_App_Icon_512x512.png');
  const iconDest2 = path.join(EN_RAW_DIR, '00_App_Icon_512x512.png');
  const officialIcon = path.join('C:\\Users\\mario\\Desktop\\PlayStore_Assets', '00_App_Icon_512x512.png');
  if (fs.existsSync(officialIcon)) {
    fs.copyFileSync(officialIcon, iconDest1);
    fs.copyFileSync(officialIcon, iconDest2);
  }

  await mockupBrowser.close();
  mockupServer.close();

  console.log('\n====================================================');
  console.log('🎉 ALL ENGLISH ASSETS & MOCKUPS GENERATED SUCCESSFULLY!');
  console.log('📁 Dedicated English Folder: C:\\Users\\mario\\Desktop\\PlayStore-Mockups-EN');
  console.log('====================================================');
}

run().catch(err => {
  console.error('❌ Error generating English assets:', err);
  process.exit(1);
});
