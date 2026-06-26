// Global error boundary to capture and display initialization or runtime errors
window.onerror = function (message, source, lineno, colno, error) {
  console.error("Global Error Boundary Caught:", message, "at", source, ":", lineno, ":", colno, error);
  alert("❌ " + (state.lang === 'en' ? 'Application Error' : 'Σφάλμα Εφαρμογής') + ":\n" + message + "\n" + (state.lang === 'en' ? 'Line' : 'Γραμμή') + ": " + lineno + ", " + (state.lang === 'en' ? 'Column' : 'Στήλη') + ": " + colno);
};

window.addEventListener('unhandledrejection', function (event) {
  console.error("Unhandled Rejection:", event.reason);
  alert("⚠️ Unhandled Promise Rejection:\n" + (event.reason?.message || event.reason));
});

window.autocompleteJustSelected = false;

// Money Manager App - Rebuilt based on actual Excel data structure
// Excel columns: Date | Account | Category | Subcategory | Note | EUR | Income/Expense | Description | Amount | Currency | Account


// ============================================================
// CATEGORY MAP: Maps emoji codepoint -> { greekName, icon, color }
// Discovered from actual Excel data analysis
// ============================================================
const CATEGORY_EMOJI_MAP = {
  // Expense categories
  '1F3E1': { name: '🏡 ΣΠΙΤΙ',                  icon: '🏡', color: '#e05e55', type: 'expense' },
  '1F3E0': { name: '🏠ΓΡΑΦΕΙΟ Β2',             icon: '🏠', color: '#ffd54f', type: 'expense' },
  '1F697': { name: '🚗 ΑΥΤΟΚΙΝΗΤΟ',             icon: '🚗', color: '#ffa726', type: 'expense' },
  '1F6D2': { name: '🛒 ΔΙΑΤΡΟΦΗ',               icon: '🛒', color: '#ffb300', type: 'expense' },
  '1F3CB': { name: '🏋️ΓΥΜΝΑΣΤΗΡΙΟ',            icon: '🏋️', color: '#42a5f5', type: 'expense' },
  '1F389': { name: '🎉ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ',      icon: '🎉', color: '#26a69a', type: 'expense' },
  '1F9FE': { name: '🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ',         icon: '🧾', color: '#26c6da', type: 'expense' },
  '1F455': { name: '👕 ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ',     icon: '👕', color: '#7e57c2', type: 'expense' },
  '1F687': { name: '🚇 ΜΕΤΑΚΙΝΗΣΗ',             icon: '🚇', color: '#ab47bc', type: 'expense' },
  '1F4BB': { name: '💻 ΤΕΧΝΟΛΟΓΙΑ',             icon: '💻', color: '#5c6bc0', type: 'expense' },
  '1F4BC': { name: '💼 ΜΙΣΘΟΣ',                 icon: '💼', color: '#4caf50', type: 'income' },
  '1F9E9': { name: '🧩ΔΙΑΦΟΡΑ ΕΞΟΔΑ',          icon: '🧩', color: '#78909c', type: 'expense' },
  '1F3AC': { name: '🎬 ΣΥΝΔΡΟΜΕΣ',              icon: '🎬', color: '#ec407a', type: 'expense' },
  '2764':  { name: '❤️ ΥΓΕΙΑ',                  icon: '❤️', color: '#ef5350', type: 'expense' },
  '1F489': { name: '❤️ ΥΓΕΙΑ',                  icon: '❤️', color: '#ef5350', type: 'expense' },
  '1F48A': { name: '❤️ ΥΓΕΙΑ',                  icon: '❤️', color: '#ef5350', type: 'expense' },
  '1F527': { name: '🧩ΔΙΑΦΟΡΑ ΕΞΟΔΑ',          icon: '🧩', color: '#78909c', type: 'expense' },

  // Income categories
  '1F911': { name: '🤑 ΕΞΤΡΑ ΕΙΣΟΔΗΜΑΤΑ',       icon: '🤑', color: '#607d8b', type: 'income' },
  '1F4B0': { name: '💼 ΜΙΣΘΟΣ',                 icon: '💼', color: '#4caf50', type: 'income' },
  '1F381': { name: '🎁ΔΩΡΑ/ΕΣΟΔΑ',             icon: '🎁', color: '#66bb6a', type: 'income' },
  '1F9D1': { name: 'ΕΠΙΣΤΡΟΦΕΣ',             icon: '💵', color: '#009688', type: 'income' },
  '1F4E6': { name: 'ΠΩΛΗΣΕΙΣ',               icon: '📦', color: '#26a69a', type: 'income' },
  '1F3C5': { name: 'BONUS',                  icon: '🏅', color: '#ffb300', type: 'income' },
  '1F468': { name: 'ΑΛΛΑ ΕΣΟΔΑ',             icon: '👨', color: '#9e9e9e', type: 'income' },
  '1F393': { name: '🎓 ΕΚΠΑΙΔΕΥΣΗ',             icon: '🎓', color: '#2196f3', type: 'expense' },
  '1F47D': { name: '🤑 ΕΞΤΡΑ ΕΙΣΟΔΗΜΑΤΑ',       icon: '🤑', color: '#607d8b', type: 'income' },
  '1F4B6': { name: '💶  ΕΝΟΙΚΙΟ Β2 (Έσοδο)',    icon: '💶', color: '#00bcd4', type: 'income' },
  '1F3DB': { name: '🏛️ΜΕΡΙΔΙΟ ΔΟΣΗΣ ΔΑΝΕΙΟΥ (ΓΟΝΕΙΣ)', icon: '🏛️', color: '#8bc34a', type: 'income' },
};

// Fallback categories for any that don't match
const DEFAULT_CATEGORIES = [
  { name: '🏡 ΣΠΙΤΙ',                  type: 'expense', icon: '🏡', color: '#e05e55' },
  { name: '🛒 ΔΙΑΤΡΟΦΗ',               type: 'expense', icon: '🛒', color: '#ffb300' },
  { name: '🏠ΓΡΑΦΕΙΟ Β2',             type: 'expense', icon: '🏠', color: '#ffd54f' },
  { name: '🚗 ΑΥΤΟΚΙΝΗΤΟ',             type: 'expense', icon: '🚗', color: '#ffa726' },
  { name: '❤️ ΥΓΕΙΑ',                  type: 'expense', icon: '❤️', color: '#ef5350' },
  { name: '🎉ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ',      type: 'expense', icon: '🎉', color: '#26a69a' },
  { name: '🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ',         type: 'expense', icon: '🧾', color: '#26c6da' },
  { name: '🏋️ΓΥΜΝΑΣΤΗΡΙΟ',            type: 'expense', icon: '🏋️', color: '#42a5f5' },
  { name: '👕 ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ',     type: 'expense', icon: '👕', color: '#7e57c2' },
  { name: '🚇 ΜΕΤΑΚΙΝΗΣΗ',             type: 'expense', icon: '🚇', color: '#ab47bc' },
  { name: '🧩ΔΙΑΦΟΡΑ ΕΞΟΔΑ',          type: 'expense', icon: '🧩', color: '#78909c' },
  { name: '🎬 ΣΥΝΔΡΟΜΕΣ',              type: 'expense', icon: '🎬', color: '#ec407a' },
  { name: '🎓 ΕΚΠΑΙΔΕΥΣΗ',             type: 'expense', icon: '🎓', color: '#2196f3' },

  { name: '💼 ΜΙΣΘΟΣ',                 type: 'income',  icon: '💼', color: '#4caf50' },
  { name: '🤑 ΕΞΤΡΑ ΕΙΣΟΔΗΜΑΤΑ',       type: 'income',  icon: '🤑', color: '#607d8b' },
  { name: '💶  ΕΝΟΙΚΙΟ Β2 (Έσοδο)',    type: 'income',  icon: '💶', color: '#00bcd4' },
  { name: '🏛️ΜΕΡΙΔΙΟ ΔΟΣΗΣ ΔΑΝΕΙΟΥ (ΓΟΝΕΙΣ)', type: 'income', icon: '🏛️', color: '#8bc34a' }
];

// Default Accounts - 3 real accounts from Excel: Cash, Card, Accounts (= Bank Account)
const DEFAULT_ACCOUNTS = [
  { name: 'Cash',         type: 'cash',       balance: 0 },
  { name: 'Bank Account', type: 'bank',        balance: 0 },
  { name: 'Card',         type: 'card',        balance: 0 },
];

// App State
const state = {
  transactions: [],
  accounts: [],
  categories: [],
  activeTab: 'trans',
  hasInitialScrollDone: false,
  syncStatus: 'offline',
  selectedYear: new Date().getFullYear(),
  selectedMonth: new Date().getMonth(),
  overviewYear: new Date().getFullYear(),
  statsType: 'expense',
  statsPeriodType: 'monthly',
  statsDate: new Date(),
  statsCustomStart: new Date().toISOString().split('T')[0],
  statsCustomEnd: new Date().toISOString().split('T')[0],
  supabaseConfig: { url: 'https://nnatvvahoeiemkfmzpwp.supabase.co', key: 'sb_publishable_voBLw0kwLF07IWssRb4Q2w_sPlTUQNp' },
  isSupabaseEnabled: true,
  excelData: null,
  excelColumns: [],
  supabaseClient: null,
  monthPickerYear: new Date().getFullYear(),
  selectionMode: false,
  selectedIds: new Set(),
  lang: localStorage.getItem('app_lang') || 'el',
  currentUser: null,
  userProfile: null,
  partnerProfile: null,
  familyProfiles: [],
  selectedFamilyMemberId: 'all',
  historyPushed: false,
  expandedStatsCategories: new Set(),
  activeSubcategoryTransactions: null,
  isSwipingMonth: false,
  lastSwipeTime: 0,
  recurringTemplates: [],
  deletedRecurringDates: [],
};

const NEON_PALETTE = [
  '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
  '#22c55e', '#eab308', '#a855f7', '#ef4444', '#0ea5e9'
];

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(navigator.userAgent);

function ensureHistoryPushed() {
  if (!state.historyPushed) {
    history.pushState({ appState: 'active' }, '', window.location.pathname + window.location.search);
    state.historyPushed = true;
  }
}

function getTransactionTime(t) {
  if (!t) return 0;
  const ref = t.created_at || t.date;
  if (!ref) return 0;
  if (typeof ref === 'number') return ref;
  if (ref instanceof Date) return ref.getTime();
  
  let str = String(ref).trim()
    .replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T') // Normalize space separator
    .replace(/\s+([+-])/, '$1') // Remove spaces before timezone offset
    .replace(/\s+([Zz])/, '$1'); // Remove spaces before Z/z offset
  
  if (!str) return 0;
  
  // Check if it has any valid timezone offset (Z, z, +HH:MM, -HH:MM, +HHMM, -HHMM, +HH, -HH)
  const hasTZ = /[Zz]|[+-]\d{2}(?::?\d{2})?$/.test(str);
  
  // Force UTC parsing by appending Z if no timezone is present
  if (!hasTZ) {
    str += 'Z';
  } else if (str.endsWith('z')) {
    str = str.slice(0, -1) + 'Z';
  }
  
  // Normalize timezone offsets to +HH:MM / -HH:MM format
  str = str.replace(/([+-]\d{2})$/, '$1:00');
  str = str.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  
  // Robust regex-based manual parsing fallback for Safari compatibility and microsecond handling
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const hour = match[4] ? parseInt(match[4], 10) : 0;
    const minute = match[5] ? parseInt(match[5], 10) : 0;
    const second = match[6] ? parseInt(match[6], 10) : 0;
    
    let ms = 0;
    if (match[7]) {
      const msStr = match[7].substring(0, 3).padEnd(3, '0');
      ms = parseInt(msStr, 10);
    }
    
    const tzStr = match[8];
    let utcMs = Date.UTC(year, month, day, hour, minute, second, ms);
    
    if (tzStr !== 'Z') {
      const tzSign = tzStr.charAt(0) === '+' ? 1 : -1;
      const tzHours = parseInt(tzStr.substring(1, 3), 10);
      const tzMinutes = parseInt(tzStr.substring(4, 6), 10);
      const offsetMs = (tzHours * 60 + tzMinutes) * 60 * 1000;
      utcMs -= tzSign * offsetMs;
    }
    return utcMs;
  }
  
  // Fallback to standard Date.parse if regex doesn't match
  const fallback = Date.parse(str);
  return isNaN(fallback) ? 0 : fallback;
}

function compareTransactions(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  
  // Level 1: date descending (locale-independent string comparison)
  const dateA = String(a.date || '').split('T')[0].split(' ')[0];
  const dateB = String(b.date || '').split('T')[0].split(' ')[0];
  if (dateA !== dateB) {
    return dateA < dateB ? 1 : -1;
  }
  
  // Level 2: created_at timestamp descending (UTC epoch ms)
  const timeA = getTransactionTime(a);
  const timeB = getTransactionTime(b);
  if (timeA !== timeB) {
    return timeB - timeA;
  }
  
  // Level 3: id ascending (unique fallback)
  const idA = String(a.id || '');
  const idB = String(b.id || '');
  if (idA !== idB) {
    return idA < idB ? -1 : 1;
  }
  
  return 0;
}

const _deletingTxIds = new Set();

function deduplicateCategories() {
  if (!state.categories) return;
  const seen = new Set();
  state.categories = state.categories.filter(c => {
    if (!c || !c.name) return false;
    const key = `${c.type || 'expense'}|${c.name.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeAndDeduplicateTransactions(cloudTransactions, localPendingTransactions) {
  const deletedIds = new Set();
  
  _deletingTxIds.forEach(id => deletedIds.add(String(id)));
  
  try {
    const queueStr = localStorage.getItem('money_manager_sync_queue');
    if (queueStr) {
      const queue = JSON.parse(queueStr) || [];
      queue.forEach(item => {
        if (item.action === 'delete' && item.payload) {
          deletedIds.add(String(item.payload));
        }
      });
    }
  } catch (e) {
    console.error('Failed to parse sync queue in mergeAndDeduplicateTransactions:', e);
  }

  const idMap = {};
  
  (cloudTransactions || []).forEach(t => {
    if (t && t.id && !deletedIds.has(String(t.id))) {
      idMap[t.id] = t;
    }
  });
  
  (localPendingTransactions || []).forEach(t => {
    if (t && t.id && !deletedIds.has(String(t.id))) {
      idMap[t.id] = t;
    }
  });
  
  const uniqueById = Object.values(idMap);
  const dedupMap = {};
  const result = [];
  
  uniqueById.forEach(t => {
    if (!t) return;
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const uid = t.user_id || 'unknown';
    const amountVal = (parseFloat(t.amount) || 0).toFixed(2);
    const key = `${uid}|${datePart}|${amountVal}|${t.type || ''}|${t.category || ''}|${t.account_from || ''}|${t.account_to || ''}|${t.note || ''}`;
    if (!dedupMap[key]) {
      dedupMap[key] = true;
      result.push(t);
    }
  });
  
  return result;
}


const GREEK_MONTHS = [
  'Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος',
  'Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'
];
const GREEK_MONTHS_SHORT = [
  'Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'
];
const GREEK_WEEKDAYS_SHORT = ['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'];

const ENGLISH_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const ENGLISH_MONTHS_SHORT = [
  'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
];
const ENGLISH_WEEKDAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const TRANSLATIONS = {
  el: {
    nav_trans: 'Κινήσεις',
    nav_stats: 'Στατιστικά',
    nav_accounts: 'Επισκόπηση',
    nav_more: 'Περισσότερα',
    section_data_mgmt: 'Διαχείριση Δεδομένων',
    section_settings: 'Ρυθμίσεις',
    settings_pref_title: '⚙️ Προτιμήσεις Εφαρμογής',
    settings_data_title: '☁️ Δεδομένα & Συγχρονισμός',
    settings_family_title: '👥 Διαχείριση Οικογένειας',
    settings_feedback_title: '💬 Σχόλια & Αξιολόγηση',
    card_sync: 'Συγχρονισμός',
    card_import_excel: 'Εισαγωγή Excel',
    card_export_excel: 'Εξαγωγή Excel',
    item_language: 'Γλώσσα',
    item_month_start: 'Έναρξη Μήνα',
    item_week_start: 'Έναρξη Εβδομάδας',
    item_currency: 'Κύριο Νόμισμα',
    item_sync_status: 'Κατάσταση Συγχρονισμού',
    val_month_start: 'Κάθε 1',
    val_week_start: 'Δευτέρα',
    val_week_start_sun: 'Κυριακή',
    val_week_start_sat: 'Σάββατο',
    val_currency: 'EUR (€)',
    val_sync_status_off: 'Ρύθμιση',
    val_sync_status_on: 'Ενεργό',
    val_sync_status_error: 'Σφάλμα',
    summary_income: 'Έσοδα',
    summary_expense: 'Έξοδα',
    summary_total: 'Υπόλοιπο',
    stats_tab_expense: 'Έξοδα',
    stats_tab_income: 'Έσοδα',
    stats_tab_net_label: 'Υπόλοιπο:',
    assets_title: 'Έσοδα',
    liabilities_title: 'Έξοδα',
    total_title: 'Υπόλοιπο',
    accounts_header_title: 'Λογαριασμοί',
    overall_history_title: 'Επισκόπηση',
    overall_history_period_label: 'Περίοδος:',
    cards_header_title: 'Έξοδα',
    row_date: 'Ημερομηνία',
    row_amount: 'Ποσό',
    row_category: 'Κατηγορία',
    row_subcategory: 'Υποκατηγορία',
    row_account_from: 'Τρόπος πληρωμής',
    row_account_to: 'Προς',
    row_note: 'Τίτλος',
    row_description: 'Λεπτομέρειες',
    item_autocomplete: 'Έξυπνος Τίτλος (Autocomplete)',
    btn_save: 'Αποθήκευση',
    btn_continue: 'Ακύρωση',
    keypad_title: 'Ποσό',
    keypad_btn_done: 'Τέλος',
    placeholder_subcategory: 'Πατήστε για επιλογή ή πληκτρολόγηση',
    placeholder_note: 'Πατήστε για τίτλο',
    placeholder_description: 'Λεπτομέρειες',
    placeholder_type_new_sub: 'Πληκτρολογήστε νέα υποκατηγορία',
    status_local_mode: 'Local Mode',
    status_cloud_mode: 'Cloud Mode',
    option_new_subcategory: '+ Νέα υποκατηγορία...',
    option_select_subcategory: 'Επιλέξτε υποκατηγορία',
    stats_period_weekly: 'Εβδομαδιαία',
    stats_period_monthly: 'Μηνιαία',
    stats_period_annually: 'Ετήσια',
    stats_period_custom: 'Περίοδος',
    type_tab_income: 'Έσοδο',
    type_tab_expense: 'Έξοδο',
    type_tab_transfer: 'Μεταφορά',
    selection_count_text: 'επιλεγμένα',
    selection_select_all: 'Επιλογή όλων',
    selection_delete: 'Διαγραφή',
    auth_welcome: 'Καλώς ορίσατε! Συνδεθείτε για συγχρονισμό',
    auth_create_account: 'Δημιουργήστε έναν νέο λογαριασμό',
    auth_tab_password: 'Κωδικός',
    auth_tab_magic: 'Magic Link',
    auth_tab_google: 'Google',
    auth_mode_login: 'Σύνδεση',
    auth_mode_signup: 'Εγγραφή',
    auth_email_label: 'Email',
    auth_password_label: 'Κωδικός',
    auth_forgot_password: 'Ξεχάσατε τον κωδικό σας;',
    auth_submit_login: 'Είσοδος',
    auth_submit_signup: 'Δημιουργία Λογαριασμού',
    auth_magic_desc: 'Εισάγετε το email σας για να λάβετε έναν σύνδεσμο σύνδεσης (Magic Link) ή OTP στα εισερχόμενά σας.',
    auth_magic_submit: 'Αποστολή Συνδέσμου',
    auth_google_desc: 'Συνδεθείτε γρήγορα και με ασφάλεια χρησιμοποιώντας τον Google λογαριασμό σας.',
    auth_google_submit: 'Σύνδεση με Google',
    auth_btn_guest: '👤 Χρήση ως Επισκέπτης (Offline)',
    auth_signup_success: '🎉 Η εγγραφή ολοκληρώθηκε! Ελέγξτε το email σας για το σύνδεσμο επιβεβαίωσης.',
    auth_loading_title: 'Σύνδεση σε εξέλιξη',
    auth_loading_desc: 'Παρακαλώ περιμένετε όσο ολοκληρώνεται η ταυτοποίηση με το λογαριασμό σας...',
    modal_sync_title: 'Συγχρονισμός',
    family_management_title: 'Διαχείριση Οικογένειας',
    create_family_btn: 'Δημιουργία Οικογένειας',
    join_family_btn: 'Εισαγωγή Κωδικού',
    role_admin: 'Διαχειριστής',
    role_member: 'Μέλος',
    invite_code_label: 'Κωδικός Πρόσκλησης:',
    invite_email_placeholder: 'email@family.com',
    invite_email_btn: 'Αποστολή Πρόσκλησης',
    stats_filter_member: 'Μέλος Οικογένειας',
    only_creator_edit_warning: 'Μόνο ο δημιουργός ή ο διαχειριστής μπορεί να επεξεργαστεί αυτή την κίνηση',
    item_category_manager: 'Διαχείριση Κατηγοριών',
    item_theme: 'Θέμα Εμφάνισης',
    item_app_lock: 'Κλείδωμα Εφαρμογής (PIN)',
    item_biometrics: 'Face ID / Αποτύπωμα',
    item_user_account: 'Λογαριασμός Χρήστη',
    item_logout: 'Αποσύνδεση',
    item_delete_account: 'Διαγραφή Λογαριασμού',
    item_export_data: 'Εξαγωγή Δεδομένων',
    item_clear_data: 'Καθαρισμός Δεδομένων',
    item_about: 'Σχετικά',
    item_privacy: 'Πολιτική Απορρήτου',
    modal_category_title: 'Επιλογή Κατηγορίας',
    modal_subcategory_title: 'Επιλογή Υποκατηγορίας',
    modal_category_manager_title: 'Διαχείριση Κατηγοριών',
    modal_excel_title: 'Εισαγωγή Ιστορικού από Excel / CSV',
    modal_excel_mapping: 'Αντιστοίχιση Στηλών',
    modal_excel_mapping_desc: 'Αντιστοιχίστε τις στήλες του δικού σας αρχείου Excel με τα πεδία της εφαρμογής.',
    modal_pin_title: 'Ορισμός PIN',
    modal_pin_desc: 'Εισάγετε ένα 4ψήφιο PIN για το κλείδωμα της εφαρμογής.',
    modal_period_title: 'Επιλογή Περιόδου',
    modal_profile_title: 'Προφίλ & Ρυθμίσεις',
    new_category_label: 'Νέα Κατηγορία',
    new_category_title_expense: 'Νέα Κατηγορία Εξόδου',
    new_category_title_income: 'Νέα Κατηγορία Εσόδου',
    new_category_name_placeholder: 'Όνομα κατηγορίας',
    new_category_icon_label: 'Εικονίδιο',
    new_category_add_title: 'Προσθήκη Νέας Κατηγορίας',
    new_category_list_title: 'Λίστα Κατηγοριών',
    btn_cancel: 'Άκυρο',
    btn_add: 'Προσθήκη',
    btn_delete: 'Διαγραφή',
    btn_edit: 'Επεξεργασία',
    btn_close: 'Κλείσιμο',
    btn_back: 'Πίσω',
    btn_export: 'Εξαγωγή',
    btn_import: 'Εισαγωγή',
    btn_select_file: 'Επιλογή Αρχείου',
    btn_start_import: 'Έναρξη Εισαγωγής',
    error_app: 'Σφάλμα Εφαρμογής',
    error_csv: 'Σφάλμα CSV',
    error_csv_read: 'Σφάλμα ανάγνωσης αρχείου CSV',
    error_excel: 'Σφάλμα Excel',
    error_excel_read: 'Σφάλμα ανάγνωσης αρχείου Excel',
    error_xlsx_lib: 'Η βιβλιοθήκη XLSX δεν φορτώθηκε!\nΑνανεώστε τη σελίδα (Ctrl+Shift+R) και δοκιμάστε ξανά.',
    error_line: 'Γραμμή',
    error_column: 'Στήλη',
    sync_status_offline: 'Τοπική Αποθήκευση',
    sync_status_syncing: 'Συγχρονισμός...',
    sync_status_synced: 'Ενεργός',
    confirm_delete_transaction: 'Να διαγραφεί η συναλλαγή;',
    confirm_delete_category: 'Είστε σίγουρος ότι θέλετε να διαγράψετε αυτή την κατηγορία;',
    alert_enter_category_name: 'Παρακαλώ εισάγετε όνομα κατηγορίας',
    alert_category_exists: 'Αυτή η κατηγορία υπάρχει ήδη',
    alert_select_category_first: 'Παρακαλώ επιλέξτε πρώτα Κατηγορία!',
    alert_csv_empty: 'Το αρχείο CSV είναι άδειο ή μη έγκυρο!',
    alert_excel_empty: 'Το αρχείο Excel είναι άδειο!',
    alert_date_required: 'Η στήλη Ημερομηνία είναι υποχρεωτική!',
    alert_date_order: 'Η ημερομηνία έναρξης πρέπει να είναι προγενέστερη της ημερομηνίας λήξης!',
    label_from: 'Από',
    label_to: 'Προς',
    label_account: 'Τρόπος πληρωμής',
    label_select: 'Επιλέξτε...',
    label_search: 'Αναζήτηση',
    label_cloud_account: 'Λογαριασμός Cloud',
    label_loading: 'Φόρτωση στοιχείων...',
    theme_dark: 'Premium Dark',
    theme_oled: 'OLED Black',
    theme_light: 'Classic Light',
    theme_emerald: 'Emerald Forest',
    theme_ocean: 'Ocean Breeze',
    theme_pink: 'Blossom Pink',
    logged_in_as: 'Συνδεδεμένος ως',
    force_update: 'Αναγκαστική Ενημέρωση (Καθαρισμός Cache)',
    section_legal: 'Νομικά',
    app_version: 'u{0395}u{03BA}u{03B4}u{03BF}u{03C3}u{03B7} 1.0.0 (build v428 - 22/06/2026)',
    fab_add_transaction: 'Προσθήκη Συναλλαγής',
    yearly_savings_title: 'Ιστορικό Προηγούμενων Ετών',
    period_label: 'Περίοδος',
    sync_now_btn: 'Συγχρονισμός Τώρα',
    search_btn_clear: 'Καθαρισμός',
    search_results_header: 'Αποτελέσματα',
    search_title_type: 'Επιλογή Τύπου',
    search_title_category: 'Επιλογή Κατηγορίας',
    search_title_account: 'Επιλογή τρόπου πληρωμής',
    search_title_member: 'Επιλογή Μέλους',
    search_title_advanced: 'Σύνθετα Φίλτρα',
    search_all_types: 'Όλοι οι τύποι',
    search_chip_type: 'Τύπος',
    search_chip_category: 'Κατηγορία',
    search_chip_account: 'Τρόπος πληρωμής',
    search_chip_member: 'Μέλος',
    search_chip_advanced: 'Σύνθετη',
    search_placeholder: 'Αναζήτηση σε έξοδα, λογαριασμούς ή ημερομηνία...',
    adv_amount_from: 'Ποσό από (€)',
    adv_amount_to: 'Ποσό έως (€)',
    adv_date_from: 'Από ημερομηνία',
    adv_date_to: 'Έως ημερομηνία',
    btn_apply: 'Εφαρμογή',
    export_sheet_title: 'Εξαγωγή Excel',
    export_opt_current_month: 'Τρέχων Μήνας',
    export_opt_prev_month: 'Προηγούμενος Μήνας',
    export_opt_current_year: 'Τρέχων Έτος',
    export_opt_prev_year: 'Προηγούμενο Έτος',
    export_opt_all: 'Όλα τα δεδομένα',
    export_opt_custom: 'Επιλογή συγκεκριμένων ημερομηνιών',
    export_label_from: 'Από:',
    export_label_to: 'Έως:',
    export_btn_confirm: 'Επιβεβαίωση Εξαγωγής',
    export_no_data_range: 'Δεν υπάρχουν συναλλαγές σε αυτή την περίοδο!',
    row_receipt_photo: 'Φωτογραφία Απόδειξης',
    photo_mismatch_warning: 'Η εικόνα είναι διαθέσιμη μόνο στη συσκευή που καταχωρήθηκε.',
    photo_delete_confirm: 'Διαγραφή φωτογραφίας απόδειξης;',
    excel_dep_title: 'Εισαγωγή Excel/CSV (Υπό κατάργηση)',
    excel_dep_text: 'Η εισαγωγή δεδομένων από αρχεία Excel ή CSV δεν υποστηρίζεται πλέον. Παρακαλώ εισάγετε τις συναλλαγές σας χειροκίνητα για την αποφυγή διπλότυπων και την καλύτερη συμβατότητα με τις νέες κατηγορίες.',
    excel_dep_btn: 'Κατάλαβα',
    section_feedback: '💬 Σχόλια & Αξιολόγηση',
    feedback_rating_title: 'Πώς θα βαθμολογούσατε την εφαρμογή;',
    feedback_type_label: 'Τύπος Σχολίου',
    feedback_type_bug: 'Σφάλμα (Bug)',
    feedback_type_feature: 'Νέα Λειτουργία',
    feedback_type_other: 'Άλλο',
    feedback_comment_placeholder: 'Γράψτε τα σχόλιά σας εδώ...',
    feedback_submit_btn: 'Αποστολή Σχολίων',
    feedback_success_msg: 'Σας ευχαριστούμε για τα σχόλιά σας!',
    feedback_reset_btn: 'Νέα Αξιολόγηση',
    search_chip_photo: 'Απόδειξη',
    search_title_photo: 'Φίλτρο Απόδειξης',
    photo_all: 'Όλες οι συναλλαγές',
    photo_with: 'Με απόδειξη',
    photo_without: 'Χωρίς απόδειξη',
    settings_account_legal_title: 'ℹ️ Λογαριασμός & Νομικά',
    btn_manage: 'Διαχείριση',
    btn_set: 'Ορισμός',
    date_picker_title: 'Ορισμός ημερομηνίας και ώρας',
    date_picker_time_label: 'ΩΡΑ',
    forecast_title: 'Εκτίμηση Έτους',
    forecast_projected_savings: 'Προβλεπόμενη Αποταμίευση:',
    forecast_modal_title: '🔮 Ανάλυση & Σενάρια',
    forecast_current_status_title: 'Τρέχουσα Πορεία',
    forecast_scenarios_title: '🔮 ΣΕΝΑΡΙΑ ΕΞΕΛΙΞΗΣ (ΕΩΣ ΔΕΚΕΜΒΡΙΟ)',
    forecast_best_case: 'Βέλτιστο Σενάριο (-15% έξοδα):',
    forecast_expected_case: 'Αναμενόμενο (Τρέχουσα πορεία):',
    forecast_worst_case: 'Απαισιόδοξο Σενάριο (+15% έξοδα):',
    forecast_target_title: 'ΠΡΟΣΩΠΙΚΟΣ ΣΤΟΧΟΣ ΑΠΟΤΑΜΙΕΥΣΗΣ',
    forecast_target_save_btn: 'Αποθήκευση',
    forecast_required_monthly_label: 'Απαιτούμενη Μηνιαία Αποταμίευση:',
    forecast_goal_timeline_label: 'Εκτιμώμενος Χρόνος Επίτευξης:',
    fhs_modal_title: '📊 Οικονομική Υγεία',
    fhs_tab_breakdown: 'Ανάλυση',
    fhs_tab_methodology: 'Μεθοδολογία',
    fhs_savings_rate_title: 'Δείκτης Αποταμίευσης (40%)',
    fhs_emergency_fund_title: 'Ταμείο Έκτακτης Ανάγκης (40%)',
    fhs_expense_trend_title: 'Έλεγχος Ρίσκου & Τάση (20%)',
    fhs_explain_title: '💡 Πώς υπολογίστηκε;',
    fhs_explain_liquid_balance_label: 'Διαθέσιμο Υπόλοιπο:',
    fhs_explain_survival_title: '🛡️ Βασική Επιβίωση:',
    fhs_explain_survival_desc: '(Πόσο αντέχεις αν κόψεις τα περιττά και κρατήσεις μόνο ενοίκιο, λογαριασμούς, super market)',
    fhs_explain_lifestyle_title: '🛒 Τρέχουσα Ζωή:',
    fhs_explain_lifestyle_desc: '(Πόσο αντέχεις αν συνεχίσεις να ζεις και να ξοδεύεις ακριβώς όπως τώρα)',
    fhs_explain_target_title: '🎯 Στόχος Ασφαλείας:',
    fhs_explain_target_months: '6.0 μήνες Τρέχουσας Ζωής',
    fhs_methodology_title: '📈 Μεθοδολογία Financial Health Score',
    fhs_methodology_intro: 'Το σκορ οικονομικής υγείας υπολογίζεται με βάση τα διεθνή πρότυπα του <strong>Financial Health Network (FHN)</strong> και του <strong>Consumer Financial Protection Bureau (CFPB)</strong>, χρησιμοποιώντας 3 βασικούς πυλώνες:',
    fhs_methodology_savings_title: '• Δείκτης Αποταμίευσης (Savings Rate) — 40%:',
    fhs_methodology_savings_desc: 'Βασίζεται στον κανόνα <strong>50/30/20</strong> (Harvard Law School). Η διατήρηση αποταμίευσης άνω του 20% των καθαρών εσόδων είναι ο θεμέλιος λίθος για τη μακροχρόνια οικονομική ελευθερία.',
    fhs_methodology_emergency_title: '• Ταμείο Έκτακτης Ανάγκης (Emergency Fund) — 40%:',
    fhs_methodology_emergency_desc: 'Μελέτες του <strong>CFPB</strong> δείχνουν ότι η ύπαρξη ρευστότητας για την κάλυψη <strong>3 έως 6 μηνών σταθερών εξόδων</strong> μειώνει κατά 85% την πιθανότητα δημιουργίας προβληματικού χρέους.',
    fhs_methodology_trend_title: '• Τάση & Έλεγχος Ρίσκου (Expense Trend) — 20%:',
    fhs_methodology_trend_desc: 'Επιβραβεύει τη σταθερότητα και τη διατήρηση των μηνιαίων εξόδων κάτω από το όριο των εσόδων.',
    fhs_methodology_note: '(Σημείωση: Για νέους χρήστες εφαρμόζεται προσαρμοσμένο μοντέλο εκκίνησης βάσει των πρώτων δεδομένων, το οποίο ωριμάζει μετά το πέρας του πρώτου τριμήνου).',
    excel_select_file_label: 'Επιλέξτε Αρχείο Excel (.xlsx, .xls) ή CSV',
    excel_clear_data_warning: '⚠️ Διαγραφή παλιών δεδομένων πριν την εισαγωγή (καθαρή επανεισαγωγή)',
    excel_field_app: 'Πεδίο Εφαρμογής',
    excel_column_file: 'Στήλη Excel',
    excel_field_date: 'Ημερομηνία *',
    excel_field_note: 'Σημείωση / Note',
    excel_field_amount: 'Ποσό (Amount)',
    excel_field_inflow: 'Εισροή / Credit (Inflow)',
    excel_field_outflow: 'Εκροή / Debit (Outflow)',
    excel_field_type: 'Τύπος (Expense/Income)',
    excel_field_description: 'Περιγραφή (Description)'
  },
  en: {
    nav_trans: 'Transactions',
    nav_stats: 'Stats',
    nav_accounts: 'Overview',
    nav_more: 'More',
    section_data_mgmt: 'Data Management',
    section_settings: 'Settings',
    settings_pref_title: '⚙️ App Preferences',
    settings_data_title: '☁️ Data & Sync',
    settings_family_title: '👥 Family Management',
    settings_feedback_title: '💬 Feedback & Rating',
    card_sync: 'Sync',
    card_import_excel: 'Import Excel',
    card_export_excel: 'Export Excel',
    item_language: 'Language',
    item_month_start: 'Month Start',
    item_week_start: 'Week Start',
    item_currency: 'Main Currency',
    item_sync_status: 'Sync Status',
    val_month_start: 'Every 1st',
    val_week_start: 'Monday',
    val_week_start_sun: 'Sunday',
    val_week_start_sat: 'Saturday',
    val_currency: 'EUR (€)',
    val_sync_status_off: 'Setup',
    val_sync_status_on: 'Active',
    val_sync_status_error: 'Error',
    summary_income: 'Income',
    summary_expense: 'Expenses',
    summary_total: 'Total',
    stats_tab_expense: 'Expenses',
    stats_tab_income: 'Income',
    stats_tab_net_label: 'Net Balance:',
    assets_title: 'Income',
    liabilities_title: 'Expenses',
    total_title: 'Balance',
    accounts_header_title: 'Accounts',
    overall_history_title: 'Overview',
    overall_history_period_label: 'Period:',
    cards_header_title: 'Expenses',
    row_date: 'Date',
    row_amount: 'Amount',
    row_category: 'Category',
    row_subcategory: 'Subcategory',
    row_account_from: 'Payment Method',
    row_account_to: 'To',
    row_note: 'Title',
    row_description: 'Details',
    item_autocomplete: 'Smart Title (Autocomplete)',
    btn_save: 'Save',
    btn_continue: 'Cancel',
    keypad_title: 'Amount',
    keypad_btn_done: 'Done',
    placeholder_subcategory: 'Tap to select or type',
    placeholder_note: 'Tap for title',
    placeholder_description: 'Details',
    placeholder_type_new_sub: 'Type new subcategory',
    status_local_mode: 'Local Mode',
    status_cloud_mode: 'Cloud Mode',
    option_new_subcategory: '+ New subcategory...',
    option_select_subcategory: 'Select subcategory',
    stats_period_weekly: 'Weekly',
    stats_period_monthly: 'Monthly',
    stats_period_annually: 'Annually',
    stats_period_custom: 'Custom Period',
    type_tab_income: 'Income',
    type_tab_expense: 'Expense',
    type_tab_transfer: 'Transfer',
    selection_count_text: 'selected',
    selection_select_all: 'Select All',
    selection_delete: 'Delete',
    auth_welcome: 'Welcome! Sign in to sync your data',
    auth_create_account: 'Create a new account',
    auth_tab_password: 'Password',
    auth_tab_magic: 'Magic Link',
    auth_tab_google: 'Google',
    auth_mode_login: 'Log In',
    auth_mode_signup: 'Sign Up',
    auth_email_label: 'Email',
    auth_password_label: 'Password',
    auth_forgot_password: 'Forgot your password?',
    auth_submit_login: 'Log In',
    auth_submit_signup: 'Create Account',
    auth_magic_desc: 'Enter your email to receive a login link (Magic Link) or OTP in your inbox.',
    auth_magic_submit: 'Send Magic Link',
    auth_google_desc: 'Log in quickly and securely using your Google account.',
    auth_google_submit: 'Sign in with Google',
    auth_btn_guest: '👤 Continue as Guest (Offline)',
    auth_signup_success: '🎉 Registration completed! Check your email for the confirmation link.',
    auth_loading_title: 'Signing in',
    auth_loading_desc: 'Please wait while we complete the authentication with your account...',
    modal_sync_title: 'Cloud Sync',
    family_management_title: 'Family Management',
    create_family_btn: 'Create Family Group',
    join_family_btn: 'Enter Invite Code',
    role_admin: 'Admin',
    role_member: 'Member',
    invite_code_label: 'Invite Code:',
    invite_email_placeholder: 'email@family.com',
    invite_email_btn: 'Send Invitation',
    stats_filter_member: 'Family Member',
    only_creator_edit_warning: 'Only the creator or admin can edit this transaction',
    item_category_manager: 'Category Manager',
    item_theme: 'Appearance Theme',
    item_app_lock: 'App Lock (PIN)',
    item_biometrics: 'Face ID / Fingerprint',
    item_user_account: 'User Account',
    item_logout: 'Log Out',
    item_delete_account: 'Delete Account',
    item_export_data: 'Export Data',
    item_clear_data: 'Clear Data',
    item_about: 'About',
    item_privacy: 'Privacy Policy',
    modal_category_title: 'Select Category',
    modal_subcategory_title: 'Select Subcategory',
    modal_category_manager_title: 'Category Manager',
    modal_excel_title: 'Import History from Excel / CSV',
    modal_excel_mapping: 'Column Mapping',
    modal_excel_mapping_desc: 'Map your Excel columns to the application fields.',
    modal_pin_title: 'Set PIN',
    modal_pin_desc: 'Enter a 4-digit PIN to lock the application.',
    modal_period_title: 'Select Period',
    modal_profile_title: 'Profile & Settings',
    new_category_label: 'New Category',
    new_category_title_expense: 'New Expense Category',
    new_category_title_income: 'New Income Category',
    new_category_name_placeholder: 'Category name',
    new_category_icon_label: 'Icon',
    new_category_add_title: 'Add New Category',
    new_category_list_title: 'Category List',
    btn_cancel: 'Cancel',
    btn_add: 'Add',
    btn_delete: 'Delete',
    btn_edit: 'Edit',
    btn_close: 'Close',
    btn_back: 'Back',
    btn_export: 'Export',
    btn_import: 'Import',
    btn_select_file: 'Select File',
    btn_start_import: 'Start Import',
    error_app: 'Application Error',
    error_csv: 'CSV Error',
    error_csv_read: 'Error reading CSV file',
    error_excel: 'Excel Error',
    error_excel_read: 'Error reading Excel file',
    error_xlsx_lib: 'XLSX library not loaded!\nRefresh the page (Ctrl+Shift+R) and try again.',
    error_line: 'Line',
    error_column: 'Column',
    sync_status_offline: 'Local Storage',
    sync_status_syncing: 'Syncing...',
    sync_status_synced: 'Active',
    confirm_delete_transaction: 'Delete this transaction?',
    confirm_delete_category: 'Are you sure you want to delete this category?',
    alert_enter_category_name: 'Please enter a category name',
    alert_category_exists: 'This category already exists',
    alert_select_category_first: 'Please select a Category first!',
    alert_csv_empty: 'CSV file is empty or invalid!',
    alert_excel_empty: 'Excel file is empty!',
    alert_date_required: 'Date column is required!',
    alert_date_order: 'Start date must be earlier than end date!',
    label_from: 'From',
    label_to: 'To',
    label_account: 'Payment Method',
    label_select: 'Select...',
    label_search: 'Search',
    label_cloud_account: 'Cloud Account',
    label_loading: 'Loading...',
    theme_dark: 'Premium Dark',
    theme_oled: 'OLED Black',
    theme_light: 'Classic Light',
    theme_emerald: 'Emerald Forest',
    theme_ocean: 'Ocean Breeze',
    theme_pink: 'Blossom Pink',
    logged_in_as: 'Logged in as',
    force_update: 'Force Update (Clear Cache)',
    section_legal: 'Legal',
    app_version: 'Version 1.0.0 (build v428 - 22/06/2026)',
    fab_add_transaction: 'Add Transaction',
    yearly_savings_title: 'Previous Years History',
    period_label: 'Period',
    sync_now_btn: 'Sync Now',
    search_btn_clear: 'Clear',
    search_results_header: 'Results',
    search_title_type: 'Select Type',
    search_title_category: 'Select Category',
    search_title_account: 'Select Payment Method',
    search_title_member: 'Select Member',
    search_title_advanced: 'Advanced Filters',
    search_all_types: 'All types',
    search_chip_type: 'Type',
    search_chip_category: 'Category',
    search_chip_account: 'Payment Method',
    search_chip_member: 'Member',
    search_chip_advanced: 'Advanced',
    search_placeholder: 'Search Expenses, Accounts, or date...',
    adv_amount_from: 'Min Amount (€)',
    adv_amount_to: 'Max Amount (€)',
    adv_date_from: 'From Date',
    adv_date_to: 'To Date',
    btn_apply: 'Apply',
    export_sheet_title: 'Export Excel',
    export_opt_current_month: 'Current Month',
    export_opt_prev_month: 'Previous Month',
    export_opt_current_year: 'Current Year',
    export_opt_prev_year: 'Previous Year',
    export_opt_all: 'All data',
    export_opt_custom: 'Custom Date Range',
    export_label_from: 'From:',
    export_label_to: 'To:',
    export_btn_confirm: 'Confirm Export',
    export_no_data_range: 'No transactions found in this period!',
    row_receipt_photo: 'Receipt Photo',
    photo_mismatch_warning: 'Image is only available on the device where it was recorded.',
    photo_delete_confirm: 'Delete receipt photo?',
    excel_dep_title: 'Excel/CSV Import (Deprecated)',
    excel_dep_text: 'Importing data from Excel or CSV files is no longer supported. Please input your transactions manually to avoid duplicates and ensure better compatibility with the new categories.',
    excel_dep_btn: 'I Understand',
    section_feedback: '💬 Feedback & Rating',
    feedback_rating_title: 'How would you rate the app?',
    feedback_type_label: 'Feedback Type',
    feedback_type_bug: 'Bug Report',
    feedback_type_feature: 'Feature Request',
    feedback_type_other: 'Other',
    feedback_comment_placeholder: 'Write your feedback here...',
    feedback_submit_btn: 'Submit Feedback',
    feedback_success_msg: 'Thank you for your feedback!',
    feedback_reset_btn: 'New Feedback',
    search_chip_photo: 'Receipt',
    search_title_photo: 'Receipt Filter',
    photo_all: 'All transactions',
    photo_with: 'With receipt',
    photo_without: 'Without receipt',
    settings_account_legal_title: 'ℹ️ Account & Legal',
    btn_manage: 'Manage',
    btn_set: 'Set',
    date_picker_title: 'Set Date and Time',
    date_picker_time_label: 'TIME',
    forecast_title: 'Year-End Forecast',
    forecast_projected_savings: 'Projected Savings:',
    forecast_modal_title: '🔮 Analysis & Scenarios',
    forecast_current_status_title: 'Current Status',
    forecast_scenarios_title: '🔮 PROJECTION SCENARIOS (UNTIL DECEMBER)',
    forecast_best_case: 'Best Case Scenario (-15% expenses):',
    forecast_expected_case: 'Expected Case (Current path):',
    forecast_worst_case: 'Worst Case Scenario (+15% expenses):',
    forecast_target_title: 'PERSONAL SAVINGS TARGET',
    forecast_target_save_btn: 'Save',
    forecast_required_monthly_label: 'Required Monthly Savings:',
    forecast_goal_timeline_label: 'Estimated Time to Achieve:',
    fhs_modal_title: '📊 Financial Health',
    fhs_tab_breakdown: 'Breakdown',
    fhs_tab_methodology: 'Methodology',
    fhs_savings_rate_title: 'Savings Rate (40%)',
    fhs_emergency_fund_title: 'Emergency Fund (40%)',
    fhs_expense_trend_title: 'Expense Trend & Risk (20%)',
    fhs_explain_title: '💡 How was it calculated?',
    fhs_explain_liquid_balance_label: 'Available Balance:',
    fhs_explain_survival_title: '🛡️ Basic Survival:',
    fhs_explain_survival_desc: '(How long you can last if you cut all discretionary spending and keep only rent, bills, groceries)',
    fhs_explain_lifestyle_title: '🛒 Current Lifestyle:',
    fhs_explain_lifestyle_desc: '(How long you can last if you continue to live and spend exactly as you do now)',
    fhs_explain_target_title: '🎯 Safety Target:',
    fhs_explain_target_months: '6.0 months of Current Lifestyle',
    fhs_methodology_title: '📈 Financial Health Score Methodology',
    fhs_methodology_intro: 'The financial health score is calculated based on international standards of the <strong>Financial Health Network (FHN)</strong> and the <strong>Consumer Financial Protection Bureau (CFPB)</strong>, using 3 key pillars:',
    fhs_methodology_savings_title: '• Savings Rate — 40%:',
    fhs_methodology_savings_desc: 'Based on the <strong>50/30/20 rule</strong> (Harvard Law School). Maintaining savings above 20% of net income is the cornerstone of long-term financial freedom.',
    fhs_methodology_emergency_title: '• Emergency Fund — 40%:',
    fhs_methodology_emergency_desc: 'Studies by the <strong>CFPB</strong> show that having liquidity to cover <strong>3 to 6 months of fixed expenses</strong> reduces the probability of problematic debt by 85%.',
    fhs_methodology_trend_title: '• Expense Trend & Risk Control — 20%:',
    fhs_methodology_trend_desc: 'Rewards stability and keeping monthly expenses below net income limits.',
    fhs_methodology_note: '(Note: For new users, a customized start model is applied based on initial data, which matures after the end of the first quarter).',
    excel_select_file_label: 'Select Excel File (.xlsx, .xls) or CSV',
    excel_clear_data_warning: '⚠️ Clear old data before import (clean re-import)',
    excel_field_app: 'Application Field',
    excel_column_file: 'Excel Column',
    excel_field_date: 'Date *',
    excel_field_note: 'Note',
    excel_field_amount: 'Amount',
    excel_field_inflow: 'Credit (Inflow)',
    excel_field_outflow: 'Debit (Outflow)',
    excel_field_type: 'Type (Expense/Income)',
    excel_field_description: 'Description'
  }
};

// ============================================================
// LOCAL RECEIPT PHOTO STORAGE (IndexedDB)
// 100% free, no Supabase Storage costs
// ============================================================
const ReceiptStorage = {
  _db: null,
  DB_NAME: 'BudgetReceiptsDB',
  STORE_NAME: 'receipts',

  async _getDB() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
      req.onerror = (e) => { console.error('ReceiptStorage DB error:', e); reject(e); };
    });
  },

  async save(transactionId, blobs) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      tx.objectStore(this.STORE_NAME).put({ id: transactionId, blobs, savedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  },

  async load(transactionId) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const req = tx.objectStore(this.STORE_NAME).get(transactionId);
      req.onsuccess = () => {
        if (!req.result) {
          resolve([]);
        } else if (req.result.blobs) {
          resolve(req.result.blobs);
        } else if (req.result.blob) {
          resolve([req.result.blob]); // Backward compatibility for single blob
        } else {
          resolve([]);
        }
      };
      req.onerror = (e) => reject(e);
    });
  },

  async remove(transactionId) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      tx.objectStore(this.STORE_NAME).delete(transactionId);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  }
};

// Pending receipt files for the current transaction form session
let _pendingReceiptFiles = [];
let _pendingReceiptDeleted = false;
let _pendingRecurringSettings = { days: [], months: [], years: [], preset: 'monthly' };

const DEFAULT_SUBCATEGORIES_MAP = {
  'ΥΓΕΙΑ': ['Γιατρός', 'Εξετάσεις', 'Συμπληρώματα διατροφής', 'Φάρμακα'],
  'ΑΥΤΟΚΙΝΗΤΟ': ['Parking', 'Service/Ανταλλακτικά', 'Αγορά αυτοκινήτου/Δόσεις', 'Ασφάλεια αυτοκινήτου', 'Βενζίνες', 'Διόδια e-pass', 'Τέλη κυκλοφορίας'],
  'ΓΡΑΦΕΙΟ Β2': ['ΔΙΑΦΟΡΑ Β2', 'ΕΝΟΙΚΙΟ Β2', 'ΦΟΡΟΛΟΓΊΑ Β2'],
  'ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ': ['Έξοδος/Βόλτα', 'Ταξίδια'],
  'ΔΙΑΤΡΟΦΗ': ['Delivery/φαγητό απέξω/γλυκά', 'Κρεοπωλείο', 'Λαϊκή', 'Νερό rainbow', 'Σουπερμάρκετ'],
  'ΔΙΑΦΟΡΑ ΕΞΟΔΑ': ['Tips/Προμήθειες', 'Διαφήμιση', 'Μικροέξοδα', 'Μισθώματα Αποθήκης Ι. Σούτσου 18', 'Στοίχημα/Καζίνο'],
  'ΑΛΛΑ ΕΞΟΔΑ': ['Tips/Προμήθειες', 'Διαφήμιση', 'Μικροέξοδα', 'Μισθώματα Αποθήκης Ι. Σούτσου 18', 'Στοίχημα/Καζίνο'],
  'ΕΚΠΑΙΔΕΥΣΗ': ['Βιβλία'],
  'ΕΞΤΡΑ ΕΙΣΟΔΗΜΑΤΑ': ['🎁ΑΛΛΑ ΕΞΤΡΑ', '🏅 BONUS', '👨‍👩‍👦ΟΙΚΟΓΕΝΕΙΑ/ΒΟΗΘΕΙΑ', '💰ΤΟΚΟΙ/CASHBACK/ΤΡΑΠΕΖΕΣ', '💻ΙΝΣΤΑ', '📦VINTED', '🧑‍🎓ΕΠΙΔΟΜΑΤΑ/ΣΕΜΙΝΑΡΙΑ'],
  'ΜΕΤΑΚΙΝΗΣΗ': ['Taxi', 'Μετρό - Λεωφορείο'],
  'ΜΙΣΘΟΣ': ['ΜΙΣΘΟΣ ΒΑΣΟΥΛΑ', 'ΜΙΣΘΟΣ ΓΡΑΦΕΙΩΝ ΒΑΣΟΥΛΑ', 'ΜΙΣΘΟΣ ΜΑΡΙΟΣ'],
  'ΜΙΣΘΟΣ/ΕΣΟΔΑ': ['ΜΙΣΘΟΣ ΒΑΣΟΥΛΑ', 'ΜΙΣΘΟΣ ΓΡΑΦΕΙΩΝ ΒΑΣΟΥΛΑ', 'ΜΙΣΘΟΣ ΜΑΡΙΟΣ'],
  'ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ': ['Accessories', 'Makeup', 'Εσώρουχα', 'Καλλυντικά', 'Κομμωτήριο', 'Παπούτσια', 'Ρούχα', 'Τσάντες/Τσαντάκια', 'Υπηρεσίες'],
  'ΣΠΙΤΙ': ['Vodafone', 'ΔΕΗ', 'Έπιπλα/Διακόσμηση', 'ΕΥΔΑΠ', 'Οικιακά Είδη', 'Στεγαστικό Δάνειο', 'Συντήρηση Σπιτιού', 'Συσκευές Σπιτιού'],
  'ΣΥΝΔΡΟΜΕΣ': ['Apple Music', 'Icloud', 'Streaming', 'Διάφορες', 'Εφαρμογές/Appstore', 'Συνδρομές Τραπεζικών Καρτών'],
  'ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ': ['ΕΝΦΙΑ', 'ΛΟΓΙΣΤΗΣ', 'ΠΑΡΑΒΟΛΑ/ΚΡΑΤΗΣΕΙΣ']
};

function getMonthName(index, short = false) {
  if (state.lang === 'en') {
    return short ? ENGLISH_MONTHS_SHORT[index] : ENGLISH_MONTHS[index];
  }
  return short ? GREEK_MONTHS_SHORT[index] : GREEK_MONTHS[index];
}

function getWeekdayName(index) {
  return state.lang === 'en' ? ENGLISH_WEEKDAYS_SHORT[index] : GREEK_WEEKDAYS_SHORT[index];
}

function applyLanguage(lang) {
  state.lang = lang;
  localStorage.setItem('app_lang', lang);

  // Update DOM elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = TRANSLATIONS[lang][key];
    if (translation) {
      if (el.children.length === 0) {
        el.textContent = translation;
      } else {
        let updated = false;
        for (let i = 0; i < el.childNodes.length; i++) {
          const node = el.childNodes[i];
          if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '') {
            node.nodeValue = translation;
            updated = true;
            break;
          }
        }
        if (!updated) {
          el.textContent = translation;
        }
      }
    }
  });

  // Update elements with data-i18n-title
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const translation = TRANSLATIONS[lang][key];
    if (translation) el.title = translation;
  });

  // Update Language Settings UI value
  const langValEl = document.getElementById('lang-setting-val');
  if (langValEl) {
    langValEl.textContent = lang === 'en' ? 'English' : 'Ελληνικά';
  }

  // Update auth overlay lang pills active class
  const authLangEl = document.getElementById('auth-lang-el');
  const authLangEn = document.getElementById('auth-lang-en');
  if (authLangEl && authLangEn) {
    authLangEl.classList.toggle('active', lang === 'el');
    authLangEn.classList.toggle('active', lang === 'en');
  }

  // Update auth subtitle based on mode
  const subtitleEl = document.getElementById('auth-subtitle');
  if (subtitleEl) {
    const authMode = (typeof currentAuthMode !== 'undefined') ? currentAuthMode : 'login';
    subtitleEl.textContent = authMode === 'login' 
      ? TRANSLATIONS[lang]['auth_welcome'] 
      : TRANSLATIONS[lang]['auth_create_account'];
  }

  const submitBtn = document.getElementById('auth-password-submit-btn');
  if (submitBtn) {
    if (!submitBtn.disabled) {
      const authMode = (typeof currentAuthMode !== 'undefined') ? currentAuthMode : 'login';
      submitBtn.textContent = authMode === 'login' 
        ? TRANSLATIONS[lang]['auth_submit_login'] 
        : TRANSLATIONS[lang]['auth_submit_signup'];
    }
  }

  // Update sync-badge offline/online text
  const syncBadge = document.getElementById('sync-badge');
  if (syncBadge) {
    const isOffline = syncBadge.classList.contains('offline');
    if (isOffline) {
      syncBadge.innerHTML = `<i class="fa-solid fa-wallet" style="color: var(--accent);"></i> Budget Assistant <span class="sync-badge-val">${TRANSLATIONS[lang]['status_local_mode']}</span>`;
    } else {
      syncBadge.innerHTML = `<i class="fa-solid fa-wallet" style="color: var(--accent);"></i> Budget Assistant <span class="sync-badge-val">${TRANSLATIONS[lang]['status_cloud_mode']}</span>`;
    }
  }

  // Update placeholders in transaction form
  const customSubInput = document.getElementById('trans-subcategory-custom');
  if (customSubInput) {
    customSubInput.placeholder = TRANSLATIONS[lang]['placeholder_type_new_sub'];
  }
  const noteInput = document.getElementById('trans-note');
  if (noteInput) {
    noteInput.placeholder = TRANSLATIONS[lang]['placeholder_note'];
  }
  const descInput = document.getElementById('trans-description');
  if (descInput) {
    descInput.placeholder = TRANSLATIONS[lang]['placeholder_description'];
  }
  const feedbackCommentInput = document.getElementById('feedback-comment');
  if (feedbackCommentInput) {
    feedbackCommentInput.placeholder = TRANSLATIONS[lang]['feedback_comment_placeholder'] || 'Γράψτε τα σχόλιά σας εδώ...';
  }

  // Update category name input placeholders
  const newCategoryNameInput = document.getElementById('new-category-name');
  if (newCategoryNameInput) {
    newCategoryNameInput.placeholder = TRANSLATIONS[lang]['new_category_name_placeholder'] || 'Όνομα κατηγορίας';
  }

  // Update custom date picker weekdays initials
  const weekdaysEl = document.getElementById('custom-date-picker-weekdays');
  if (weekdaysEl) {
    const elInitials = ['Δε','Τρ','Τε','Πε','Πα','Σα','Κυ'];
    const enInitials = ['Mo','Tu','We','Th','Fr','Sa','Su'];
    const initials = lang === 'en' ? enInitials : elInitials;
    weekdaysEl.innerHTML = initials.map(day => `<span>${day}</span>`).join('');
  }

  // Update search overlay input placeholder
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.placeholder = TRANSLATIONS[lang]['search_placeholder'] || 'Αναζήτηση σε κινήσεις, σημειώσεις...';
  }

  // Update search reset/clear visual button and titles
  const searchResetBtn = document.querySelector('.search-reset-btn-modern');
  if (searchResetBtn) {
    searchResetBtn.textContent = TRANSLATIONS[lang]['search_btn_clear'] || 'Καθαρισμός';
  }
  const searchClearBtn = document.getElementById('search-clear-btn');
  if (searchClearBtn) {
    searchClearBtn.title = TRANSLATIONS[lang]['search_btn_clear'] || 'Καθαρισμός';
  }

  // Update Advanced search chip title
  const advChip = document.getElementById('search-chip-advanced');
  if (advChip) {
    advChip.title = TRANSLATIONS[lang]['search_title_advanced'] || 'Σύνθετα Φίλτρα';
  }

  // Update Type search chip
  const typeChip = document.getElementById('search-chip-type');
  if (typeChip) {
    const val = document.getElementById('search-filter-type')?.value;
    const label = typeChip.querySelector('.chip-label');
    if (label) {
      if (val) {
        let text = val === 'expense' ? TRANSLATIONS[lang]['type_tab_expense'] : val === 'income' ? TRANSLATIONS[lang]['type_tab_income'] : TRANSLATIONS[lang]['type_tab_transfer'];
        label.textContent = `✓ ${text}`;
      } else {
        label.textContent = TRANSLATIONS[lang]['search_chip_type'] || 'Τύπος';
      }
    }
  }

  // Update Category search chip
  const catChip = document.getElementById('search-chip-category');
  if (catChip) {
    const cat = document.getElementById('search-filter-category')?.value;
    const sub = document.getElementById('search-filter-subcategory')?.value;
    const label = catChip.querySelector('.chip-label');
    if (label) {
      if (cat) {
        if (sub) {
          label.textContent = `✓ ${getSubcategoryDisplayName(sub, cat)}`;
        } else {
          label.textContent = `✓ ${getCategoryDisplayName(cat)}`;
        }
      } else {
        label.textContent = TRANSLATIONS[lang]['search_chip_category'] || 'Κατηγορία';
      }
    }
  }

  // Update Account search chip
  const accChip = document.getElementById('search-chip-account');
  if (accChip) {
    const val = document.getElementById('search-filter-account')?.value;
    const label = accChip.querySelector('.chip-label');
    if (label) {
      if (val) {
        label.textContent = `✓ ${val}`;
      } else {
        label.textContent = TRANSLATIONS[lang]['search_chip_account'] || 'Λογαριασμός';
      }
    }
  }

  // Update Member search chip
  const memChip = document.getElementById('search-chip-member');
  if (memChip) {
    const val = document.getElementById('search-filter-member')?.value;
    const label = memChip.querySelector('.chip-label');
    if (label) {
      if (val) {
        let name = '';
        const myId = state.currentUser?.id || '';
        if (val === myId) {
          name = state.userProfile?.display_name || state.currentUser?.email?.split('@')[0] || (lang === 'el' ? 'Εσείς' : 'You');
        } else if (state.partnerProfile && val === state.partnerProfile.id) {
          name = state.partnerProfile.display_name || state.partnerProfile.email.split('@')[0] || (lang === 'el' ? 'Σύντροφος' : 'Partner');
        }
        label.textContent = `✓ ${name}`;
      } else {
        label.textContent = TRANSLATIONS[lang]['search_chip_member'] || 'Μέλος';
      }
    }
  }

  // Update new search filter row text values
  const searchValPeriod = document.getElementById('search-val-period');
  if (searchValPeriod) {
    const sp = state.searchPeriod || 'all';
    if (sp === 'all') {
      searchValPeriod.textContent = lang === 'el' ? 'Όλη η περίοδος' : 'All period';
    } else if (sp === 'weekly') {
      searchValPeriod.textContent = lang === 'el' ? 'Εβδομαδιαία' : 'Weekly';
    } else if (sp === 'monthly') {
      searchValPeriod.textContent = lang === 'el' ? 'Μηνιαία' : 'Monthly';
    } else if (sp === 'annually') {
      searchValPeriod.textContent = lang === 'el' ? 'Ετήσια' : 'Annually';
    } else if (sp === 'custom') {
      const startVal = document.getElementById('search-filter-date-start')?.value;
      const endVal = document.getElementById('search-filter-date-end')?.value;
      if (startVal && endVal) {
        searchValPeriod.textContent = `${startVal} ~ ${endVal}`;
      } else {
        searchValPeriod.textContent = lang === 'el' ? 'Όλη η περίοδος' : 'All period';
      }
    }
  }

  const searchValAccount = document.getElementById('search-val-account');
  if (searchValAccount) {
    const val = document.getElementById('search-filter-account')?.value;
    if (val) {
      searchValAccount.textContent = getAccountDisplayName(val);
    } else {
      searchValAccount.textContent = lang === 'el' ? 'Όλοι' : 'All';
    }
  }

  const searchValCategory = document.getElementById('search-val-category');
  if (searchValCategory) {
    const cat = document.getElementById('search-filter-category')?.value;
    const sub = document.getElementById('search-filter-subcategory')?.value;
    if (cat) {
      if (sub) {
        searchValCategory.textContent = `${getCategoryDisplayName(cat)} > ${getSubcategoryDisplayName(sub, cat)}`;
      } else {
        searchValCategory.textContent = getCategoryDisplayName(cat);
      }
    } else {
      searchValCategory.textContent = lang === 'el' ? 'Όλες' : 'All';
    }
  }

  const searchValAmount = document.getElementById('search-val-amount');
  if (searchValAmount) {
    const minVal = document.getElementById('search-filter-amount-min')?.value;
    const maxVal = document.getElementById('search-filter-amount-max')?.value;
    if (minVal || maxVal) {
      const minText = minVal ? `${minVal} €` : 'Min.';
      const maxText = maxVal ? `${maxVal} €` : 'Max.';
      searchValAmount.textContent = `${minText} ~ ${maxText}`;
    } else {
      searchValAmount.textContent = 'Min. ~ Max.';
    }
  }


  // Update period dropdown choice labels in stats screen dropdown menu
  document.querySelectorAll('.stats-dropdown-item').forEach(item => {
    const val = item.getAttribute('data-value');
    if (val === 'weekly') item.textContent = TRANSLATIONS[lang]['stats_period_weekly'];
    else if (val === 'monthly') item.textContent = TRANSLATIONS[lang]['stats_period_monthly'];
    else if (val === 'annually') item.textContent = TRANSLATIONS[lang]['stats_period_annually'];
    else if (val === 'period') item.textContent = TRANSLATIONS[lang]['stats_period_custom'];
  });

  // Update stats period dropdown button text
  const periodBtn = document.getElementById('stats-period-dropdown-btn');
  if (periodBtn) {
    const currentPeriod = state.statsPeriodType || 'monthly';
    const periodLabels = {
      weekly: TRANSLATIONS[lang]['stats_period_weekly'],
      monthly: TRANSLATIONS[lang]['stats_period_monthly'],
      annually: TRANSLATIONS[lang]['stats_period_annually'],
      period: TRANSLATIONS[lang]['stats_period_custom']
    };
    periodBtn.childNodes[0].nodeValue = periodLabels[currentPeriod] + ' ';
  }

  // Update stats tab labels
  const statsTabIncome = document.querySelector('#stats-tab-income .stats-tab-label');
  const statsTabExpense = document.querySelector('#stats-tab-expense .stats-tab-label');
  if (statsTabIncome) statsTabIncome.textContent = TRANSLATIONS[lang]['stats_tab_income'];
  if (statsTabExpense) statsTabExpense.textContent = TRANSLATIONS[lang]['stats_tab_expense'];

  // Update chart center title
  const chartCenterTitle = document.getElementById('chart-center-title');
  if (chartCenterTitle) {
    chartCenterTitle.textContent = state.statsType === 'income' 
      ? TRANSLATIONS[lang]['stats_tab_income'] 
      : TRANSLATIONS[lang]['stats_tab_expense'];
  }

  // Update selection bar text
  const selectionCount = document.getElementById('selection-count');
  if (selectionCount && state.selectionMode) {
    const count = state.selectedIds.size;
    selectionCount.textContent = count + ' ' + TRANSLATIONS[lang]['selection_count_text'];
  }
  const selectAllBtn = document.getElementById('selection-select-all-btn');
  if (selectAllBtn) selectAllBtn.title = TRANSLATIONS[lang]['selection_select_all'];
  const deleteBtn = document.getElementById('selection-delete-btn');
  if (deleteBtn) deleteBtn.title = TRANSLATIONS[lang]['selection_delete'];

  // Update header sync icon tooltip
  const headerSyncIcon = document.getElementById('header-sync-icon');
  if (headerSyncIcon) headerSyncIcon.title = TRANSLATIONS[lang]['label_cloud_account'];

  // Update transaction form type labels
  const typeTabBtns = document.querySelectorAll('.type-tab-btn');
  typeTabBtns.forEach(btn => {
    const type = btn.getAttribute('data-type');
    if (type === 'income') btn.textContent = TRANSLATIONS[lang]['type_tab_income'];
    else if (type === 'expense') btn.textContent = TRANSLATIONS[lang]['type_tab_expense'];
    else if (type === 'transfer') btn.textContent = TRANSLATIONS[lang]['type_tab_transfer'];
  });

  // Update transaction form labels
  const fromAccLabel = document.getElementById('label-account-from');
  if (fromAccLabel) {
    const activeType = document.querySelector('.type-tab-btn.active')?.getAttribute('data-type');
    if (activeType === 'transfer') fromAccLabel.textContent = TRANSLATIONS[lang]['label_from'];
    else fromAccLabel.textContent = TRANSLATIONS[lang]['label_account'];
  }

  // Update modal titles
  const catPickerTitle = document.querySelector('#category-picker-modal .modal-title');
  if (catPickerTitle) catPickerTitle.textContent = TRANSLATIONS[lang]['modal_category_title'];
  const subcatPickerTitle = document.querySelector('#subcategory-picker-modal .modal-title');
  if (subcatPickerTitle) subcatPickerTitle.textContent = TRANSLATIONS[lang]['modal_subcategory_title'];
  const catManagerTitle = document.querySelector('#category-manager-modal .modal-title');
  if (catManagerTitle) catManagerTitle.textContent = TRANSLATIONS[lang]['modal_category_manager_title'];
  const excelTitle = document.querySelector('#excel-modal .modal-title');
  if (excelTitle) excelTitle.textContent = TRANSLATIONS[lang]['modal_excel_title'];
  const pinTitle = document.querySelector('#pin-modal .modal-title');
  if (pinTitle) pinTitle.textContent = TRANSLATIONS[lang]['modal_pin_title'];
  const periodTitle = document.querySelector('#period-modal .modal-title');
  if (periodTitle) periodTitle.textContent = TRANSLATIONS[lang]['modal_period_title'];
  const profileTitle = document.querySelector('#profile-modal .modal-title');
  if (profileTitle) profileTitle.textContent = TRANSLATIONS[lang]['modal_profile_title'];

  // Update category manager add section
  const catAddTitle = document.querySelector('#category-manager-modal .settings-section-title');
  if (catAddTitle) catAddTitle.textContent = TRANSLATIONS[lang]['new_category_add_title'];
  const catListTitle = document.querySelectorAll('#category-manager-modal .settings-section-title')[1];
  if (catListTitle) catListTitle.textContent = TRANSLATIONS[lang]['new_category_list_title'];

  // Update new category dialog in picker
  const newCatDialogTitle = document.getElementById('new-cat-dialog-title');
  if (newCatDialogTitle) {
    const dialogType = newCategoryDialogType || 'expense';
    newCatDialogTitle.textContent = dialogType === 'income' 
      ? TRANSLATIONS[lang]['new_category_title_income']
      : TRANSLATIONS[lang]['new_category_title_expense'];
  }
  const newCatNameInput = document.getElementById('new-cat-name-input');
  if (newCatNameInput) newCatNameInput.placeholder = TRANSLATIONS[lang]['new_category_name_placeholder'];
  const newCatIconLabel = document.querySelector('#new-category-inline-dialog label');
  if (newCatIconLabel) newCatIconLabel.textContent = TRANSLATIONS[lang]['new_category_icon_label'];

  // Update "+" New Category box text in grid
  const addBoxName = document.querySelector('.category-picker-add .category-picker-name');
  if (addBoxName) addBoxName.textContent = TRANSLATIONS[lang]['new_category_label'];

  // Update category type labels in category manager
  document.querySelectorAll('#category-manager-list .settings-list-item').forEach(item => {
    const typeSpan = item.querySelector('span[style*="color: var(--text-muted)"]');
    if (typeSpan) {
      const catType = typeSpan.textContent;
      if (catType === 'Έσοδο' || catType === 'Income') typeSpan.textContent = TRANSLATIONS[lang]['type_tab_income'];
      else if (catType === 'Έξοδο' || catType === 'Expense') typeSpan.textContent = TRANSLATIONS[lang]['type_tab_expense'];
    }
  });

  if (state.activeTab === 'more') {
    renderPartnerSection();
  }
  if (state.syncStatus) {
    updateHeaderSyncIcon(state.syncStatus);
    updateSyncStatusIndicator();
  }
  updateUI();
}

function toggleLanguageSetting() {
  const nextLang = state.lang === 'el' ? 'en' : 'el';
  applyLanguage(nextLang);
}

// Bind toggleLanguageSetting to window
window.toggleLanguageSetting = toggleLanguageSetting;
window.applyLanguage = applyLanguage;

function formatGreekDateTime(dateStr) {
  if (!dateStr) return '';
  const dateObj = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(dateObj.getTime())) return dateStr;
  
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();
  const dayOfWeek = dateObj.getDay();
  const hrs = String(dateObj.getHours()).padStart(2, '0');
  const mins = String(dateObj.getMinutes()).padStart(2, '0');
  
  const shortYear = String(y).slice(-2);
  const shortDay = getWeekdayName(dayOfWeek);
  
  return `${d}/${m}/${shortYear} (${shortDay}) ${hrs}:${mins}`;
}

function evaluateCalcBuffer(buf) {
  if (!buf) return '0';
  let cleanBuf = String(buf).trim();
  while (cleanBuf.length > 0 && ['-', '+', '*', '/'].includes(cleanBuf.slice(-1))) {
    cleanBuf = cleanBuf.slice(0, -1);
  }
  if (!cleanBuf) return '0';
  try {
    const parts = cleanBuf.split('-');
    let result = parseFloat(parts[0]) || 0;
    for (let i = 1; i < parts.length; i++) {
      result -= parseFloat(parts[i]) || 0;
    }
    return String(Math.round(result * 100) / 100);
  } catch (e) {
    console.error('Calculation error:', e);
    return cleanBuf;
  }
}

let statsChartInstance = null;
if (window.Chart && window.ChartDataLabels) {
  Chart.register(ChartDataLabels);
}

// ============================================================
// STATS DATE AND PERIOD NAVIGATION HELPERS
// ============================================================
function getStatsDateRange() {
  let start, end;
  if (state.statsPeriodType === 'weekly') {
    start = new Date(state.statsDate);
    const day = start.getDay();
    const weekStartDay = parseInt(localStorage.getItem('app_week_start') || '1', 10);
    let diff = day - weekStartDay;
    if (diff < 0) {
      diff += 7;
    }
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (state.statsPeriodType === 'monthly') {
    const monthStartDay = parseInt(localStorage.getItem('app_month_start') || '1', 10);
    if (monthStartDay === 1) {
      start = new Date(state.statsDate.getFullYear(), state.statsDate.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(state.statsDate.getFullYear(), state.statsDate.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      start = new Date(state.statsDate.getFullYear(), state.statsDate.getMonth(), monthStartDay, 0, 0, 0, 0);
      end = new Date(state.statsDate.getFullYear(), state.statsDate.getMonth() + 1, monthStartDay - 1, 23, 59, 59, 999);
    }
  } else if (state.statsPeriodType === 'annually') {
    start = new Date(state.statsDate.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(state.statsDate.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (state.statsPeriodType === 'period') {
    start = new Date(state.statsCustomStart + 'T00:00:00');
    end = new Date(state.statsCustomEnd + 'T23:59:59');
  }
  return { start, end };
}

function syncStatsDate() {
  state.statsDate.setDate(15);
  state.statsDate.setFullYear(state.selectedYear);
  state.statsDate.setMonth(state.selectedMonth);
}

function formatStatsPeriodTitle(start, end) {
  if (state.statsPeriodType === 'monthly') {
    return `${getMonthName(start.getMonth(), true)} ${start.getFullYear()}`;
  }
  if (state.statsPeriodType === 'annually') {
    return `${start.getFullYear()}`;
  }
  
  // Weekly or Custom Period
  const startDay = start.getDate();
  const startMonthShort = getMonthName(start.getMonth(), true);
  const startYear = start.getFullYear();

  const endDay = end.getDate();
  const endMonthShort = getMonthName(end.getMonth(), true);
  const endYear = end.getFullYear();

  if (startYear !== endYear) {
    return `${startDay} ${startMonthShort} ${startYear} - ${endDay} ${endMonthShort} ${endYear}`;
  } else if (start.getMonth() !== end.getMonth()) {
    return `${startDay} ${startMonthShort} - ${endDay} ${endMonthShort} ${startYear}`;
  } else {
    return `${startDay} - ${endDay} ${startMonthShort} ${startYear}`;
  }
}

function wrapPeriodTitleWithSpans(titleText) {
  const match = titleText.match(/^(.*)\b(\d{4})$/);
  if (match) {
    const mainPart = match[1].trim();
    const yearPart = match[2];
    return `<span class="month-part">${mainPart}</span> <span class="year-part" style="color: var(--text-secondary);">${yearPart}</span>`;
  }
  if (/^\d{4}$/.test(titleText.trim())) {
    return `<span class="year-part">${titleText.trim()}</span>`;
  }
  return `<span class="month-part">${titleText}</span>`;
}

// ============================================================
// EMOJI STRIPPING - handles surrogate pairs correctly
// Excel exports emoji as surrogate pairs (2 UTF-16 code units)
// We need to skip past them to get the Greek text
// ============================================================
function stripLeadingEmoji(str) {
  if (!str) return '';
  let i = 0;
  const codes = [];
  for (let j = 0; j < str.length; j++) {
    codes.push(str.charCodeAt(j));
  }
  while (i < codes.length) {
    const c = codes[i];
    // High surrogate (emoji start)
    if (c >= 0xD800 && c <= 0xDBFF) {
      i += 2; // skip surrogate pair (2 code units)
      // Skip trailing space after emoji
      while (i < codes.length && codes[i] === 0x20) i++;
    }
    // BMP private use area
    else if (c >= 0xE000 && c <= 0xF8FF) {
      i += 1;
      while (i < codes.length && codes[i] === 0x20) i++;
    }
    // BMP symbols / dingbats (like U+2764 heart, etc.)
    else if (c >= 0x2600 && c <= 0x27BF) {
      i += 1;
      while (i < codes.length && codes[i] === 0x20) i++;
    }
    // Variation selector or replacement char
    else if (c === 0xFFFD || (c >= 0xFE00 && c <= 0xFE0F)) {
      i += 1;
      while (i < codes.length && codes[i] === 0x20) i++;
    }
    // Regular character - stop stripping
    else {
      break;
    }
  }
  return str.substring(i).trim();
}

// Get emoji codepoint from first surrogate pair (for category lookup)
function getFirstEmojiCodepoint(str) {
  if (!str || str.length < 2) return null;
  const high = str.charCodeAt(0);
  const low = str.charCodeAt(1);
  if (high >= 0xD800 && high <= 0xDBFF && low >= 0xDC00 && low <= 0xDFFF) {
    const cp = 0x10000 + ((high - 0xD800) * 0x400) + (low - 0xDC00);
    return cp.toString(16).toUpperCase().padStart(5, '0');
  }
  return null;
}

// Resolve category from raw Excel string.
// Strategy: Keep emoji-prefixed names intact to align with user's Excel files.
function resolveCategoryInfo(rawCategory, transType) {
  if (!rawCategory) return null;

  const trimmed = rawCategory.trim();
  const upperName = trimmed.toUpperCase();

  // 1. Find exact match in state.categories
  let cat = state.categories.find(c =>
    c.name && c.name.toUpperCase() === upperName
  );
  if (cat) return cat;

  // 2. Find match in CATEGORY_EMOJI_MAP by codepoint
  const cp = getFirstEmojiCodepoint(trimmed);
  const emojiInfo = cp ? CATEGORY_EMOJI_MAP[cp] : null;
  if (emojiInfo) {
    let mappedCat = state.categories.find(c =>
      c.name && c.name.toUpperCase() === emojiInfo.name.toUpperCase()
    );
    if (mappedCat) return mappedCat;
    return emojiInfo;
  }

  // 3. Not found - return info to create new category
  return {
    name: trimmed,
    type: transType,
    icon: transType === 'income' ? '💰' : '💸',
    color: getRandomColor(),
  };
}

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', async () => {
  if (isAndroid) {
    document.body.classList.add('is-android');
  }
  if (isIOS) {
    document.body.classList.add('is-ios');
    
    // Global focusout listener to reset layout viewport panning when any input blurs on iOS
    document.addEventListener('focusout', (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Only reset if focus didn't immediately move to another input/textarea/select
        setTimeout(() => {
          const activeEl = document.activeElement;
          const isAnotherInputFocused = activeEl && 
            (activeEl.tagName === 'INPUT' || 
             activeEl.tagName === 'TEXTAREA' || 
             activeEl.tagName === 'SELECT');
          if (!isAnotherInputFocused) {
            forceViewportReset();
          }
        }, 100);
      }
    });
  }

  // ============================================================
  // FORCE CLOSE ALL MODALS - runs on every load type
  // iOS Safari bfcache: DOMContentLoaded does NOT re-fire on
  // back/forward navigation or OAuth redirects. 'pageshow' does.
  // ============================================================
  function forceCloseAllModals() {
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    document.body.style.removeProperty('position');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('top');
    document.body.style.removeProperty('left');
    document.body.style.removeProperty('width');
    document.body.style.removeProperty('height');
    document.querySelectorAll('.modal-overlay, .tx-modal-overlay').forEach(function(m) {
      m.classList.remove('active');
    });
    // Also reset any inline display:flex on modals
    const txModal = document.getElementById('transaction-modal');
    if (txModal && txModal.style.display === 'flex') txModal.style.display = '';
    console.log('[Init] All modals force-closed');
  }
  // Expose globally so auth handler can call it too
  window.forceCloseAllModals = forceCloseAllModals;

  // Run immediately on DOM ready
  forceCloseAllModals();

  // CRITICAL: Also run on pageshow — this fires for bfcache restores
  // (e.g. after Google OAuth redirect on iOS), unlike DOMContentLoaded
  window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
      // Page restored from bfcache (iOS back navigation or OAuth redirect)
      console.log('[pageshow] bfcache restore detected — force-closing modals');
      forceCloseAllModals();
    }
  });

  // Set initial scroll isolation class for default trans tab
  document.body.classList.add('trans-tab-active');
  loadConfig();
  initSettingsFromStorage();
  initSupabase();
  setupEventListeners();
  initPullToRefresh();
  initSwipeToBack();
  initTabSwipeNavigation();
  initRippleEffects();
  initLightboxPinchZoom();
  
  // ALWAYS load cached local data immediately so the UI is never blank on refresh.
  // If Supabase is enabled, onAuthStateChange will call loadData() again with fresh cloud data.
  loadOfflineData();
  
  // Restore active tab from localStorage if it exists
  const savedTab = localStorage.getItem('active_tab');
  if (savedTab && ['trans', 'stats', 'accounts', 'more'].includes(savedTab) && savedTab !== 'trans') {
    switchTab(savedTab, true);
  }
  
  updateUI();
  updateHeaderProfileBadge();
  
  // If Supabase client is NOT initialized, we are in pure local mode — done.
  // If it IS initialized, onAuthStateChange (in initSupabaseAuth) will fire and
  // call loadData() which fetches fresh data from cloud and overwrites the cache.
  
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('trans-date').value = today;
  applyLanguage(state.lang);
});


// ============================================================
// CUSTOM ALERT & CONFIRM MODALS
// ============================================================
function showCustomDialog({ message, title = '', icon = '💬', showCancel = false }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-dialog-modal');
    if (!modal) {
      const res = showCancel ? confirm(message) : (alert(message), true);
      resolve(res);
      return;
    }
    
    document.getElementById('custom-dialog-title').textContent = title || (showCancel ? (state.lang === 'el' ? 'Επιβεβαίωση' : 'Confirm') : (state.lang === 'el' ? 'Ειδοποίηση' : 'Alert'));
    document.getElementById('custom-dialog-message').innerHTML = message;
    document.getElementById('custom-dialog-icon').textContent = icon;
    
    const btnCancel = document.getElementById('custom-dialog-btn-cancel');
    const btnOk = document.getElementById('custom-dialog-btn-ok');
    
    btnCancel.style.display = showCancel ? 'block' : 'none';
    
    const newBtnCancel = btnCancel.cloneNode(true);
    const newBtnOk = btnOk.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    
    modal.classList.add('active');
    
    newBtnCancel.addEventListener('click', () => {
      modal.classList.remove('active');
      resolve(false);
    });
    
    newBtnOk.addEventListener('click', () => {
      modal.classList.remove('active');
      resolve(true);
    });
  });
}

window.showConfirm = (message, title = '', icon = '❓') => showCustomDialog({ message, title, icon, showCancel: true });
window.showAlert = (message, title = '', icon = 'ℹ️') => showCustomDialog({ message, title, icon, showCancel: false });

function loadConfig() {
  // Database credentials are strictly hardcoded in state.supabaseConfig.
  state.isSupabaseEnabled = true;
}

function initSupabase() {
  if (state.isSupabaseEnabled && window.supabase) {
    try {
      state.supabaseClient = window.supabase.createClient(
        state.supabaseConfig.url,
        state.supabaseConfig.key,
        {
          auth: {
            flowType: 'implicit',
            autoRefreshToken: true,
            persistSession: true
          }
        }
      );
      const syncBadge = document.getElementById('sync-badge');
      if (syncBadge) {
        syncBadge.className = 'sync-badge online';
        syncBadge.textContent = 'Cloud Sync ✓';
      }
      updateHeaderSyncIcon('syncing');
      // Initialize authentication flow
      initSupabaseAuth();
    } catch (err) {
      console.error('Supabase init failed:', err);
      state.isSupabaseEnabled = false;
      const syncBadge = document.getElementById('sync-badge');
      if (syncBadge) {
        syncBadge.className = 'sync-badge offline';
        syncBadge.textContent = 'Offline';
      }
      updateHeaderSyncIcon('error');
    }
  } else {
    const syncBadge = document.getElementById('sync-badge');
    if (syncBadge) {
      syncBadge.className = 'sync-badge offline';
      syncBadge.textContent = 'Local Mode';
    }
    updateHeaderSyncIcon('offline');
  }
}

function toggleLoader(show) {
  const loadingState = document.getElementById('auth-loading-state');
  const authCard = document.getElementById('auth-card');
  if (show) {
    if (loadingState) loadingState.style.display = 'flex';
    if (authCard) authCard.style.display = 'none';
  } else {
    if (loadingState) loadingState.style.display = 'none';
    if (authCard) authCard.style.display = 'flex';
  }
}
window.toggleLoader = toggleLoader;

function initSupabaseAuth() {
  if (!state.supabaseClient) return;

  const urlParams = new URLSearchParams(window.location.search);
  const inviteCode = urlParams.get('invite');
  const inviteRole = urlParams.get('role');
  if (inviteCode) {
    localStorage.setItem('pending_invite_code', inviteCode.trim().toUpperCase());
    if (inviteRole) {
      localStorage.setItem('pending_invite_role', inviteRole.trim().toLowerCase());
    } else {
      localStorage.removeItem('pending_invite_role');
    }
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  function logAuthDebug(msg) {
    console.log('[AuthDebug]', msg);
    const logDiv = document.getElementById('auth-debug-logs');
    if (logDiv) {
      // Keep logs in developer console; do not show to end users
      // logDiv.style.display = 'block';
      const time = new Date().toLocaleTimeString();
      logDiv.innerHTML += `<div>[${time}] ${msg}</div>`;
      logDiv.scrollTop = logDiv.scrollHeight;
    }
  }

  // Global error handler to capture runtime JS errors and display them in the debug overlay
  window.addEventListener('error', (event) => {
    logAuthDebug(`Runtime Error: ${event.message} at ${event.filename}:${event.lineno}`);
    console.error('Runtime error:', event.error);
  });

  logAuthDebug('Starting auth checks...');

  const hashStr = window.location.hash || '';
  const searchStr = window.location.search || '';
  
  const urlKeys = [];
  if (hashStr) {
    const hashParams = new URLSearchParams(hashStr.substring(1));
    for (const key of hashParams.keys()) {
      urlKeys.push(`hash:${key}`);
    }
  }
  if (searchStr) {
    const searchParams = new URLSearchParams(searchStr);
    for (const key of searchParams.keys()) {
      urlKeys.push(`query:${key}`);
    }
  }
  logAuthDebug(`URL components: ${urlKeys.join(', ') || 'none'}`);

  const isAuthRedirect = hashStr.includes('access_token=') || 
                         hashStr.includes('id_token=') ||
                         hashStr.includes('error=') ||
                         searchStr.includes('code=') ||
                         searchStr.includes('error=');

                         
  let processingRedirect = isAuthRedirect;
  logAuthDebug(`Is redirect callback: ${isAuthRedirect}`);
  
  const authOverlay = document.getElementById('auth-overlay');
  const loadingState = document.getElementById('auth-loading-state');
  const formsContainer = document.getElementById('auth-forms-container');
  const authCard = document.getElementById('auth-card');

  // Remove early style to allow JS style control
  const earlyStyle = document.getElementById('early-auth-style');
  if (earlyStyle) earlyStyle.remove();

  function toggleLoader(show) {
    if (show) {
      if (loadingState) loadingState.style.display = 'flex';
      if (authCard) authCard.style.display = 'none';
    } else {
      if (loadingState) loadingState.style.display = 'none';
      if (authCard) authCard.style.display = 'flex';
    }
  }
  
  if (isAuthRedirect) {
    if (authOverlay) authOverlay.style.display = 'flex';
    toggleLoader(true);
    if (formsContainer) formsContainer.style.display = 'none';
    
    // Safety timeout to prevent getting stuck
    setTimeout(() => {
      if (processingRedirect && !state.currentUser && !state.guestMode) {
        logAuthDebug('TIMEOUT: Auth redirect timed out (6s).');
        console.warn('Auth redirect timed out or failed. Restoring login form.');
        processingRedirect = false;
        toggleLoader(false);
        if (formsContainer) formsContainer.style.display = 'block';
        showAuthStatus(state.lang === 'el' 
          ? '⚠️ Η σύνδεση καθυστερεί ή απέτυχε. Δοκιμάστε ξανά.' 
          : '⚠️ Login is taking too long or failed. Please try again.');
      }
    }, 6000);
  }

  if (hashStr.includes('error=') || searchStr.includes('error=')) {
    const rawParams = hashStr.includes('error=') ? hashStr.substring(1) : searchStr.substring(1);
    const params = new URLSearchParams(rawParams);
    const error = params.get('error');
    let errorDescription = params.get('error_description') || error;
    if (errorDescription) {
      errorDescription = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
      logAuthDebug(`Error in redirect: ${error} - ${errorDescription}`);
      let errorMsg = '';
      if (error === 'identity_provider_email_conflict') {
        errorMsg = state.lang === 'el'
          ? '❌ Υπάρχει ήδη λογαριασμός με αυτό το email. Δοκιμάστε να συνδεθείτε με email/κωδικό.'
          : '❌ An account with this email already exists. Try logging in with email/password.';
      } else {
        errorMsg = `❌ Σφάλμα: ${errorDescription}`;
      }
      
      processingRedirect = false;
      toggleLoader(false);
      if (formsContainer) formsContainer.style.display = 'block';
      showAuthStatus(errorMsg);
      // Clean URL hash so it doesn't reappear on refresh
      window.history.replaceState(null, null, window.location.pathname);
    }
  }

  // Global unhandled promise rejection handler during authentication
  window.addEventListener('unhandledrejection', (event) => {
    logAuthDebug(`Unhandled promise rejection: ${event.reason}`);
    console.warn('Unhandled promise rejection:', event.reason);
    const reason = event.reason;
    if (reason && (reason.message || reason.error_description || String(reason).includes('Auth') || String(reason).includes('token'))) {
      const msg = reason.message || reason.error_description || String(reason);
      processingRedirect = false;
      toggleLoader(false);
      if (formsContainer) formsContainer.style.display = 'block';
      showAuthStatus('❌ Σφάλμα (Unhandled): ' + msg);
    }
  });

  logAuthDebug('Fetching current session...');
  // Fetch session explicitly to capture any errors during initialization or OAuth code/hash exchange
  state.supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      logAuthDebug(`getSession error: ${error.message || error}`);
      console.error('Supabase getSession error:', error);
      processingRedirect = false;
      toggleLoader(false);
      if (formsContainer) formsContainer.style.display = 'block';
      showAuthStatus('❌ Σφάλμα ταυτοποίησης: ' + (error.message || error));
    } else {
      logAuthDebug(`getSession resolved. Session exists: ${!!(data && data.session)}`);
      if (data && data.session && (window.location.hash || window.location.search)) {
        window.history.replaceState(null, null, window.location.pathname);
      }
      if (!data || !data.session) {
        // No session exists, stop showing loader and show the login form
        processingRedirect = false;
        toggleLoader(false);
        if (formsContainer) formsContainer.style.display = 'block';
      } else if (data.session && data.session.user) {
        // Fallback for browsers where INITIAL_SESSION event may be delayed/missed
        state.currentUser = data.session.user;
        localStorage.setItem('cached_current_user', JSON.stringify(data.session.user));
        updateHeaderSyncIcon('synced');
      }
    }
  }).catch(err => {
    logAuthDebug(`getSession catch error: ${err.message || err}`);
    console.error('Supabase getSession catch error:', err);
    processingRedirect = false;
    toggleLoader(false);
    if (formsContainer) formsContainer.style.display = 'block';
    showAuthStatus('❌ Σφάλμα ταυτοποίησης: ' + (err.message || err));
  });

  logAuthDebug('Subscribing to onAuthStateChange...');
  state.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    logAuthDebug(`Auth Event Fired: ${event}, Session: ${!!session}`);
    console.log('Supabase Auth Event:', event, session);
    
    if (session && session.user) {
      processingRedirect = false;
      state.currentUser = session.user;
      localStorage.setItem('cached_current_user', JSON.stringify(session.user));

      // Load cached partner and user profile if available
      try {
        const cachedPartner = localStorage.getItem('cached_partner_profile');
        if (cachedPartner) {
          state.partnerProfile = JSON.parse(cachedPartner);
        }
        const cachedUser = localStorage.getItem('cached_user_profile');
        if (cachedUser) {
          state.userProfile = JSON.parse(cachedUser);
        }
      } catch (e) {
        console.error('Failed to parse cached profiles:', e);
      }
      
      // Clear guest mode state
      state.guestMode = false;
      localStorage.removeItem('auth_guest_mode');
      
      // Clear URL parameters so they don't persist or trigger reload loops
      if (window.location.hash || window.location.search) {
        window.history.replaceState(null, null, window.location.pathname);
      }
      
      // Hide auth overlay & reset elements
      if (authOverlay) {
        // Prevent click penetration (ghost clicks) to elements underneath (like the FAB button)
        authOverlay.style.pointerEvents = 'none';
        document.body.style.pointerEvents = 'none';
        setTimeout(() => {
          authOverlay.style.display = 'none';
          authOverlay.style.pointerEvents = '';
          document.body.style.pointerEvents = '';
          forceViewportReset();
        }, 350);
      }
      toggleLoader(false);
      if (formsContainer) formsContainer.style.display = 'block';
      // Force-close any modals that bfcache may have restored
      if (typeof window.forceCloseAllModals === 'function') window.forceCloseAllModals();
      
      // Show switcher in header
      const switcher = document.getElementById('wallet-switcher-container');
      if (switcher) switcher.style.display = 'inline-block';
      
      const email = session.user.email || '';
      // Show user badge
      updateHeaderProfileBadge();
      
      // Show email in the new profile header card (legacy element stays hidden)
      const emailDisplay = document.getElementById('settings-user-email-value');
      if (emailDisplay) {
        emailDisplay.textContent = email;
        emailDisplay.title = email;
      }
      // Note: settings-user-email-item is intentionally kept hidden.
      // The email is displayed in the profile-user-email element instead.
      
      // Apply correct visual transformation theme.
      // NOTE: We intentionally do NOT call updateUI() here with cached data
      // because it would show stale numbers that then jump when cloud data
      // arrives (the "fairground" effect). The single authoritative updateUI()
      // call happens after loadData() completes below.
      applyWalletTheme();
      renderPartnerSection();

      // Trigger background updates and data loading asynchronously
      (async () => {
        try {
          // 1. Load user profile and partner details (network request)
          await loadUserProfiles(session.user);
          applyWalletTheme();
          renderPartnerSection();
          
          // 2. Load fresh data from cloud.
          // Suppress realtime during the fetch so that echo/bounce events from the
          // subscription setup don't trigger a second render on top of our clean one.
          _suppressRealtimeEvents = true;
          try {
            await loadData();
            updateUI();
            
            // Start automatic polling sync
            startPartnerSyncPolling();
            
            // Start realtime subscription
            setupSupabaseRealtimeSubscription();
          } finally {
            // Re-enable realtime after a delay to let any inflight echo events drain.
            // This prevents the subscription's own INSERT echo from triggering handleRealtimeTransactionChange
            // and causing a 3rd render 3s after login.
            // 10s: Supabase Realtime echo events can take up to 5-8s to arrive, so we need
            // enough margin to absorb them before re-enabling the handler.
            setTimeout(() => { _suppressRealtimeEvents = false; }, 10000);
          }
          
          // Replay offline sync queue — skipReload:true because loadData() was already called above.
          // This prevents a redundant second full fetch + UI re-render.
          processSyncQueue({ skipReload: true });
          
          // 3. Sync guest transactions in the background (silent, no extra render)
          await syncLocalTransactionsToCloud(session.user.id, { silent: true });
        } catch (err) {
          console.error('Error during background auth setup:', err);
        }
      })();
    } else {
      // Stop automatic polling sync
      stopPartnerSyncPolling();
      
      // Stop realtime subscription
      stopSupabaseRealtimeSubscription();
      
      state.currentUser = null;
      state.userProfile = null;
      state.partnerProfile = null;
      localStorage.removeItem('cached_current_user');
      localStorage.removeItem('cached_partner_profile');
      localStorage.removeItem('cached_user_profile');
      localStorage.removeItem('offline_transactions');
      localStorage.removeItem('offline_accounts');
      localStorage.removeItem('offline_categories');
      updateHeaderSyncIcon('offline');
      
      if (localStorage.getItem('auth_guest_mode') === 'true') {
        state.guestMode = true;
        
        // Hide auth overlay & reset elements
        if (authOverlay) {
          // Prevent click penetration (ghost clicks) to elements underneath (like the FAB button)
          authOverlay.style.pointerEvents = 'none';
          document.body.style.pointerEvents = 'none';
          setTimeout(() => {
            authOverlay.style.display = 'none';
            authOverlay.style.pointerEvents = '';
            document.body.style.pointerEvents = '';
            forceViewportReset();
          }, 350);
        }
        toggleLoader(false);
        if (formsContainer) formsContainer.style.display = 'block';
        
        // Hide switcher (guest has no shared wallet)
        const switcher = document.getElementById('wallet-switcher-container');
        if (switcher) switcher.style.display = 'none';
        
        // Show lock icon user badge
        updateHeaderProfileBadge();
        
        // Load offline data and render
        await loadData();
        updateUI();
        renderPartnerSection();
      } else {
        // If we are currently processing a redirect, do not show the forms container yet
        if (processingRedirect) {
          if (authOverlay) authOverlay.style.display = 'flex';
          toggleLoader(true);
          if (formsContainer) formsContainer.style.display = 'none';
        } else {
          // Show auth overlay normally
          if (authOverlay) authOverlay.style.display = 'flex';
          toggleLoader(false);
          if (formsContainer) formsContainer.style.display = 'block';
        }
        
        // Hide switcher
        const switcher = document.getElementById('wallet-switcher-container');
        if (switcher) switcher.style.display = 'none';
        
        // Hide user badge
        const userBadge = document.getElementById('user-profile-badge');
        if (userBadge) userBadge.style.display = 'none';
      }
      
      // Remove wallet theme active class
      document.body.classList.remove('shared-wallet-active');
      renderPartnerSection();
    }
  });
}

async function loadUserProfiles(user) {
  if (!state.supabaseClient) return;
  
  try {
    // 1. Fetch current user profile
    const { data: profile, error } = await promiseTimeout(
      state.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(r => r),
      8000
    ).catch(e => ({ data: null, error: e }));
       
    if (error || !profile) {
      console.log('Profile not found, inserting profile for user...');
      // Insert profile manually if trigger didn't do it
      const { data: newProfile, error: insertError } = await promiseTimeout(
        state.supabaseClient
          .from('profiles')
          .insert([{ id: user.id, email: user.email, display_name: user.email.split('@')[0] }])
          .select()
          .single()
          .then(r => r),
        8000
      ).catch(e => ({ data: null, error: e }));
         
      if (insertError) {
        console.error('Failed to create profile:', insertError);
      } else {
        state.userProfile = newProfile;
        localStorage.setItem('cached_user_profile', JSON.stringify(newProfile));
        updateHeaderProfileBadge();
      }
    } else {
      state.userProfile = profile;
      localStorage.setItem('cached_user_profile', JSON.stringify(profile));
      updateHeaderProfileBadge();
    }
    
    // 2. Load family profiles & family group details
    if (state.userProfile && state.userProfile.family_id) {
      const [famRes, groupRes] = await promiseTimeout(
        Promise.all([
          state.supabaseClient.from('profiles').select('*').eq('family_id', state.userProfile.family_id),
          state.supabaseClient.from('family_groups').select('*').eq('id', state.userProfile.family_id).single()
        ]),
        8000
      ).catch(e => [{ data: null, error: e }, { data: null, error: e }]);

      if (famRes && famRes.data) {
        state.familyProfiles = famRes.data;
        const otherMember = state.familyProfiles.find(p => p.id !== user.id);
        if (state.familyProfiles.length === 2 && otherMember) {
          state.partnerProfile = otherMember;
          localStorage.setItem('cached_partner_profile', JSON.stringify(otherMember));
        } else {
          state.partnerProfile = null;
          localStorage.removeItem('cached_partner_profile');
        }
      } else {
        state.familyProfiles = [];
      }
      
      if (groupRes && groupRes.data) {
        state.familyGroup = groupRes.data;
      } else {
        state.familyGroup = null;
      }
    } else {
      state.familyProfiles = [];
      state.familyGroup = null;
      state.partnerProfile = null;
      localStorage.removeItem('cached_partner_profile');

      // 3. Scan pending invitations for this user's email
      const pendingInviteCode = localStorage.getItem('pending_invite_code');
      if (pendingInviteCode) {
        localStorage.removeItem('pending_invite_code'); // Clear immediately
        setTimeout(() => showPendingInviteCodePrompt(pendingInviteCode), 1000);
      } else if (user.email) {
        const { data: pending } = await promiseTimeout(
          state.supabaseClient
            .from('pending_invitations')
            .select('*, family_groups(name, invite_code)')
            .eq('invited_email', user.email.trim().toLowerCase()),
          8000
        ).catch(e => ({ data: null, error: e }));

        if (pending && pending.length > 0) {
          setTimeout(() => showPendingInvitationPrompt(pending[0]), 1000);
        }
      }
    }
  } catch(e) {
    console.error('Error loading user profiles:', e);
  }
}

function showPendingInviteCodePrompt(inviteCode) {
  if (!state.supabaseClient || !state.currentUser) return;
  
  state.supabaseClient
    .from('family_groups')
    .select('name')
    .eq('invite_code', inviteCode)
    .single()
    .then(({ data, error }) => {
      if (error || !data) {
        console.warn('Could not find family group for invite code:', inviteCode);
        return;
      }
      
      const familyName = data.name;
      const confirmMsg = state.lang === 'el'
        ? `📬 Εκκρεμής πρόσκληση!\nΈχετε έναν σύνδεσμο πρόσκλησης για την οικογένεια «${familyName}» (Κωδικός: ${inviteCode}).\n\nΘέλετε να γίνετε μέλος αυτής της οικογένειας;`
        : `📬 Pending invitation!\nYou have an invitation link for the family group "${familyName}" (Code: ${inviteCode}).\n\nDo you want to join this family group?`;
        
      if (confirm(confirmMsg)) {
        const inviteRole = localStorage.getItem('pending_invite_role') || 'member';
        localStorage.removeItem('pending_invite_role');
        
        state.supabaseClient.rpc('join_family_group', { invite_code_input: inviteCode, invite_role_input: inviteRole })
          .then(({ data: joinData, error: joinErr }) => {
            if (joinErr) {
              alert(state.lang === 'el' ? 'Σφάλμα κατά τη σύνδεση: ' + joinErr.message : 'Error joining family: ' + joinErr.message);
            } else {
              alert(state.lang === 'el' ? '🎉 Συνδεθήκατε επιτυχώς στην οικογένεια!' : '🎉 Joined the family successfully!');
              window.location.reload();
            }
          });
      }
    });
}

function showPendingInvitationPrompt(invite) {
  if (!state.supabaseClient || !state.currentUser) return;
  const familyName = invite.family_groups ? invite.family_groups.name : 'Οικογένεια';
  const confirmMsg = state.lang === 'el' 
    ? `📬 Εκκρεμής πρόσκληση!\nΈχετε προσκληθεί να συνδεθείτε στην οικογένεια «${familyName}».\n\nΘέλετε να γίνετε μέλος αυτής της οικογένειας;`
    : `📬 Pending invitation!\nYou have been invited to join the family group "${familyName}".\n\nDo you want to join this family group?`;
    
  if (confirm(confirmMsg)) {
    const inviteCode = invite.family_groups ? invite.family_groups.invite_code : '';
    if (!inviteCode) return;
    const inviteRole = invite.role || 'member';
    
    state.supabaseClient.rpc('join_family_group', { invite_code_input: inviteCode, invite_role_input: inviteRole })
      .then(async ({ data, error }) => {
        if (error) {
          alert(state.lang === 'el' ? 'Σφάλμα κατά τη σύνδεση: ' + error.message : 'Error joining family: ' + error.message);
        } else {
          alert(state.lang === 'el' ? '🎉 Συνδεθήκατε επιτυχώς στην οικογένεια!' : '🎉 Joined the family successfully!');
          window.location.reload();
        }
      });
  } else {
    // Delete the pending invitation from database so they are not prompted again
    state.supabaseClient.from('pending_invitations').delete().eq('id', invite.id).then(() => {
      console.log('Rejected and deleted pending invitation:', invite.id);
    });
  }
}

// migrateLegacyTransactions removed for security & tenant isolation

function applyWalletTheme() {
  if (state.partnerProfile) {
    document.body.classList.add('shared-wallet-active');

    // Replace wallet icon in header with user group
    const icon = document.getElementById('header-wallet-icon');
    if (icon) {
      icon.className = 'fa-solid fa-people-roof';
    }
  } else {
    document.body.classList.remove('shared-wallet-active');

    // Restore wallet icon in header
    const icon = document.getElementById('header-wallet-icon');
    if (icon) {
      icon.className = 'fa-solid fa-wallet';
    }
  }

  // IMPORTANT: Always re-apply the user's chosen theme so that shared-wallet-active
  // never overrides the colour scheme. The theme is the single source of truth for colours.
  const savedTheme = localStorage.getItem('app_theme') || 'dark';
  document.body.classList.remove('theme-oled', 'theme-light', 'theme-emerald', 'theme-ocean', 'theme-pink');
  if (savedTheme !== 'dark') {
    document.body.classList.add(`theme-${savedTheme}`);
  }
}


// Bind to window
window.applyWalletTheme = applyWalletTheme;

function getActiveTransactions() {
  const currentUserId = state.currentUser ? state.currentUser.id : null;
  const partnerId = state.partnerProfile ? state.partnerProfile.id : null;
  const familyId = state.userProfile ? state.userProfile.family_id : null;

  const filtered = state.transactions.filter(t => {
    if (t.user_id === undefined) {
      return true;
    }
    
    if (currentUserId) {
      if (familyId) {
        return t.family_id === familyId || 
               t.user_id === currentUserId || 
               t.user_id === partnerId || 
               (t.id && String(t.id).startsWith('local_'));
      }
      return t.user_id === currentUserId || 
             t.user_id === partnerId || 
             (t.id && String(t.id).startsWith('local_'));
    } else {
      return t.user_id === null || t.user_id === undefined;
    }
  });

  // Deduplicate: (1) ID-based to remove exact duplicates, then
  // (2) content-based to remove local_ copies that were synced to cloud
  const seenIds = new Set();
  const idDeduped = filtered.filter(t => {
    const id = t.id;
    if (!id) return true;
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });

  const cloudKeys = new Set();
  const locals = [];
  const others = [];
  idDeduped.forEach(t => {
    if (t.id && String(t.id).startsWith('local_')) {
      locals.push(t);
    } else {
      // Include user_id so that Marios & Vasoula identical transactions are NOT merged
      const key = `${t.user_id || 'unknown'}|${t.amount || 0}|${String(t.date || '').split('T')[0]}|${t.type || ''}|${t.category || ''}|${t.account_from || ''}`;
      cloudKeys.add(key);
      others.push(t);
    }
  });
  const dedupedLocals = locals.filter(t => {
    const key = `${t.user_id || 'unknown'}|${t.amount || 0}|${String(t.date || '').split('T')[0]}|${t.type || ''}|${t.category || ''}|${t.account_from || ''}`;
    return !cloudKeys.has(key);
  });
  return [...others, ...dedupedLocals];
}

function calculateInitialBalances() {
  if (!state.accounts) return;
  state.accounts.forEach(acc => {
    let netSum = 0;
    // Base balance is calculated from all active transactions going backwards
    const activeTrans = getActiveTransactions();
    activeTrans.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'transfer') {
        if (t.account_from === acc.name) netSum -= amt;
        if (t.account_to === acc.name) netSum += amt;
      } else {
        if (t.account_from === acc.name) {
          if (t.type === 'expense') netSum -= amt;
          else if (t.type === 'income') netSum += amt;
        }
      }
    });
    acc.initial_balance = (parseFloat(acc.balance) || 0) - netSum;
  });
}

function normalizeString(str) {
  if (!str) return '';
  let s = String(str).toLowerCase().trim();
  const map = {
    'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
    'ΐ': 'ι', 'ΰ': 'υ', 'ϊ': 'ι', 'ϋ': 'υ'
  };
  let res = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    res += map[c] || c;
  }
  return res.toUpperCase();
}

function classifyCategory(categoryName) {
  const norm = normalizeString(categoryName);
  const essentialKeywords = [
    'ΣΠΙΤΙ', 'HOME', 'RENT', 'ΕΝΟΙΚΙΟ',
    'ΔΙΑΤΡΟΦΗ', 'FOOD', 'SUPERMARKET', 'ΣΟΥΠΕΡ ΜΑΡΚΕΤ', 'ΣΟΥΠΕΡΜΑΡΚΕΤ',
    'ΥΓΕΙΑ', 'HEALTH', 'PHARMACY', 'ΦΑΡΜΑΚΕΙΟ', 'ΓΙΑΤΡΟΣ',
    'ΦΟΡΟΙ', 'TAXES', 'ΛΟΓΙΣΤΗΣ', 'ACCOUNTANT',
    'ΜΕΤΑΚΙΝΗΣΗ', 'TRANSIT', 'METRO', 'ΛΕΩΦΟΡΕΙΟ', 'BUS', 'ΣΥΓΚΟΙΝΩΝΙΕΣ'
  ];
  const isEssential = essentialKeywords.some(kw => norm.includes(kw));
  return {
    isEssential: isEssential,
    isLifestyle: !isEssential
  };
}

/**
 * Calculates the Financial Health Score (1-100)
 */
function calculateFinancialHealthScore(transactions, accounts, hasHistoricalData) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11
  
  // Filter current month transactions (excluding transfers)
  const currentMonthTrans = transactions.filter(t => {
    if (!t.date || t.type === 'transfer') return false;
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1; // 0-11
    return y === currentYear && m === currentMonth;
  });

  // Calculate current month's income and expense
  let currentMonthIncome = 0;
  let currentMonthExpense = 0;
  currentMonthTrans.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') currentMonthIncome += amt;
    if (t.type === 'expense') currentMonthExpense += amt;
  });

  // --- CRITERION 1: Savings Rate (40%) ---
  let savingsRateScore = 0;
  let savingsRate = 0;
  if (currentMonthIncome > 0) {
    savingsRate = (currentMonthIncome - currentMonthExpense) / currentMonthIncome;
    if (savingsRate >= 0.40) {
      savingsRateScore = 100;
    } else if (savingsRate > 0) {
      if (savingsRate <= 0.10) {
        savingsRateScore = (savingsRate / 0.10) * 50;
      } else if (savingsRate <= 0.20) {
        savingsRateScore = 50 + ((savingsRate - 0.10) / 0.10) * 30;
      } else {
        savingsRateScore = 80 + ((savingsRate - 0.20) / 0.20) * 20;
      }
    } else {
      savingsRateScore = 0;
    }
  } else {
    savingsRateScore = currentMonthExpense > 0 ? 0 : 50; // Neutral if no activity
  }

  // --- CRITERION 2: Emergency Fund (40%) ---
  // Calculate liquid balance as the net balance (income - expense) of the target year (currentYear)
  const targetYearTrans = transactions.filter(t => {
    if (!t.date || t.type === 'transfer') return false;
    const parts = String(t.date).split('T')[0].split(' ')[0].split('-');
    if (parts.length !== 3) return false;
    return parseInt(parts[0], 10) === currentYear;
  });

  let targetYearIncome = 0;
  let targetYearExpense = 0;
  targetYearTrans.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') targetYearIncome += amt;
    if (t.type === 'expense') targetYearExpense += amt;
  });

  const currentBankBalance = targetYearIncome - targetYearExpense;

  // Compute average monthly expenses (all and essential)
  let avgMonthlyExpense = 0;
  let avgEssentialMonthlyExpense = 0;

  // Let's compute current month's essential expenses
  let currentMonthEssentialExpense = 0;
  currentMonthTrans.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'expense') {
      const cls = classifyCategory(t.category);
      if (cls.isEssential) {
        currentMonthEssentialExpense += amt;
      }
    }
  });

  if (hasHistoricalData) {
    const monthlyExpensesMap = {};
    const monthlyEssentialMap = {};
    
    transactions.forEach(t => {
      if (t.type !== 'expense' || !t.date) return;
      const datePart = String(t.date || '').split('T')[0].split(' ')[0];
      const parts = datePart.split('-');
      if (parts.length !== 3) return;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      
      // Restrict historical data strictly to current calendar year
      if (y !== currentYear) return;
      // Exclude current month
      if (y === currentYear && m === currentMonth) return;
      
      const key = `${y}-${m}`;
      const amt = parseFloat(t.amount) || 0;
      
      monthlyExpensesMap[key] = (monthlyExpensesMap[key] || 0) + amt;
      
      const cls = classifyCategory(t.category);
      if (cls.isEssential) {
        monthlyEssentialMap[key] = (monthlyEssentialMap[key] || 0) + amt;
      }
    });

    // Stable divisor: count actual elapsed months since the first expense of the current year up to the previous month
    let firstActiveMonth = currentMonth;
    transactions.forEach(t => {
      if (!t.date || t.type !== 'expense') return;
      const datePart = String(t.date || '').split('T')[0].split(' ')[0];
      const parts = datePart.split('-');
      if (parts.length !== 3) return;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (y === currentYear && m < firstActiveMonth) {
        firstActiveMonth = m;
      }
    });

    const elapsedMonthsInYear = currentMonth - firstActiveMonth;
    const monthsCount = Math.max(1, elapsedMonthsInYear);

    const totalHistoricalExpense = Object.values(monthlyExpensesMap).reduce((a, b) => a + b, 0);
    avgMonthlyExpense = totalHistoricalExpense / monthsCount;
    
    const totalHistoricalEssential = Object.values(monthlyEssentialMap).reduce((a, b) => a + b, 0);
    avgEssentialMonthlyExpense = totalHistoricalEssential / monthsCount;
  } else {
    avgMonthlyExpense = currentMonthExpense;
    avgEssentialMonthlyExpense = currentMonthEssentialExpense;
  }

  if (avgMonthlyExpense <= 0) avgMonthlyExpense = 1000; // reasonable fallback
  if (avgEssentialMonthlyExpense <= 0) avgEssentialMonthlyExpense = avgMonthlyExpense * 0.75; // fallback to 75%
  if (avgEssentialMonthlyExpense > avgMonthlyExpense) avgEssentialMonthlyExpense = avgMonthlyExpense;

  const monthsCovered = currentBankBalance / avgMonthlyExpense;
  const survivalRunway = currentBankBalance / avgEssentialMonthlyExpense;
  const lifestyleRunway = monthsCovered;

  let emergencyFundScore = 0;
  if (monthsCovered >= 12) {
    emergencyFundScore = 100;
  } else if (monthsCovered > 0) {
    if (monthsCovered <= 3) {
      emergencyFundScore = (monthsCovered / 3) * 50;
    } else if (monthsCovered <= 6) {
      emergencyFundScore = 50 + ((monthsCovered - 3) / 3) * 30;
    } else {
      emergencyFundScore = 80 + ((monthsCovered - 6) / 6) * 20;
    }
  } else {
    emergencyFundScore = 0;
  }

  // --- CRITERION 3: Expense Trend (20%) ---
  let expenseTrendScore = 0;
  let isTemporary = false;

  if (hasHistoricalData) {
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevYearNum = prevMonthDate.getFullYear();
    const prevMonthNum = prevMonthDate.getMonth();

    let prevMonthExpense = 0;
    transactions.forEach(t => {
      if (t.type === 'expense' && t.date) {
        const datePart = String(t.date || '').split('T')[0].split(' ')[0];
        const parts = datePart.split('-');
        if (parts.length !== 3) return;
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (y === prevYearNum && m === prevMonthNum) {
          prevMonthExpense += parseFloat(t.amount) || 0;
        }
      }
    });

    if (prevMonthExpense > 0) {
      if (currentMonthExpense <= prevMonthExpense) {
        expenseTrendScore = 100;
      } else {
        const pctIncrease = (currentMonthExpense - prevMonthExpense) / prevMonthExpense;
        expenseTrendScore = Math.max(0, 100 - (pctIncrease * 200));
      }
    } else {
      expenseTrendScore = currentMonthExpense <= currentMonthIncome ? 100 : 50;
    }
  } else {
    isTemporary = true;
    if (currentMonthExpense < currentMonthIncome) {
      expenseTrendScore = 100;
    } else {
      expenseTrendScore = 30;
    }
  }

  let finalScore = (savingsRateScore * 0.40) + (emergencyFundScore * 0.40) + (expenseTrendScore * 0.20);
  finalScore = Math.min(100, Math.max(0, finalScore));

  let label = '';
  const lang = state.lang || 'el';
  if (lang === 'el') {
    if (finalScore >= 85) label = 'Εξαιρετική Οικονομική Υγεία';
    else if (finalScore >= 70) label = 'Καλή Οικονομική Υγεία';
    else if (finalScore >= 50) label = 'Μέτρια Οικονομική Υγεία';
    else label = 'Χρειάζεται Προσοχή';
  } else {
    if (finalScore >= 85) label = 'Excellent Financial Health';
    else if (finalScore >= 70) label = 'Good Financial Health';
    else if (finalScore >= 50) label = 'Average Financial Health';
    else label = 'Needs Attention';
  }

  return {
    score: finalScore,
    label: label,
    isTemporary: isTemporary,
    savingsRateScore: savingsRateScore,
    emergencyFundScore: emergencyFundScore,
    expenseTrendScore: expenseTrendScore,
    weightedSavings: savingsRateScore * 0.4,
    weightedEmergency: emergencyFundScore * 0.4,
    weightedTrend: expenseTrendScore * 0.2,
    monthsCovered: monthsCovered,
    savingsRate: savingsRate,
    survivalRunway: survivalRunway,
    lifestyleRunway: lifestyleRunway,
    liquidBalance: currentBankBalance
  };
}

/**
 * Calculates Year-End Forecasting (Run-Rate)
 */
function calculateForecasting(transactions, hasHistoricalData) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11
  
  // Filter current year transactions (excluding transfers)
  const currentYearTrans = transactions.filter(t => {
    if (!t.date || t.type === 'transfer') return false;
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    return y === currentYear;
  });

  let currentYearIncome = 0;
  let currentYearExpense = 0;
  currentYearTrans.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') currentYearIncome += amt;
    if (t.type === 'expense') currentYearExpense += amt;
  });

  const currentYearSavings = currentYearIncome - currentYearExpense;
  const lang = state.lang || 'el';
  
  // Handle December case (Year-End Review)
  if (currentMonth === 11) {
    if (!hasHistoricalData) {
      const juneTrans = currentYearTrans.filter(t => {
        const datePart = String(t.date || '').split('T')[0].split(' ')[0];
        const parts = datePart.split('-');
        if (parts.length !== 3) return false;
        const m = parseInt(parts[1], 10) - 1;
        return m <= 5; // Jan to Jun
      });

      let juneIncome = 0;
      let juneExpense = 0;
      juneTrans.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'income') juneIncome += amt;
        if (t.type === 'expense') juneExpense += amt;
      });

      const juneSavings = juneIncome - juneExpense;
      const juneAvgMonthly = juneSavings / 6;
      const juneForecastProjection = juneSavings + (juneAvgMonthly * 6);

      const msg = lang === 'el' 
        ? `Ολοκληρώθηκε ο πρώτος σας χρόνος! Η αρχική εκτίμηση του Ιουνίου προέβλεπε αποταμίευση € ${formatCurrency(juneForecastProjection)} και καταφέρατε να φτάσετε τα € ${formatCurrency(currentYearSavings)}. Είστε εντός στόχων!`
        : `Your first year is complete! The initial projection in June was € ${formatCurrency(juneForecastProjection)} and you achieved € ${formatCurrency(currentYearSavings)}. You are on track!`;

      return {
        isYearEnd: true,
        isNewUser: true,
        actualSavings: currentYearSavings,
        projectedSavings: juneForecastProjection,
        diff: currentYearSavings - juneForecastProjection,
        message: msg
      };
    } else {
      const prevYear = currentYear - 1;
      const prevYearTrans = transactions.filter(t => {
        if (!t.date || t.type === 'transfer') return false;
        const datePart = String(t.date || '').split('T')[0].split(' ')[0];
        const parts = datePart.split('-');
        if (parts.length !== 3) return false;
        const y = parseInt(parts[0], 10);
        return y === prevYear;
      });

      let prevYearIncome = 0;
      let prevYearExpense = 0;
      prevYearTrans.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'income') prevYearIncome += amt;
        if (t.type === 'expense') prevYearExpense += amt;
      });

      const prevYearSavings = prevYearIncome - prevYearExpense;
      const pctDiff = prevYearSavings > 0 
        ? ((currentYearSavings - prevYearSavings) / prevYearSavings) * 100 
        : 0;

      const sign = pctDiff >= 0 ? '+' : '';
      const msg = lang === 'el'
        ? `Το ${prevYear} είχατε αποταμιεύσει € ${formatCurrency(prevYearSavings)}. Φέτος κλείσατε στα € ${formatCurrency(currentYearSavings)} (${sign}${pctDiff.toFixed(1)}%). Εξαιρετική εξέλιξη!`
        : `In ${prevYear} you saved € ${formatCurrency(prevYearSavings)}. This year you closed at € ${formatCurrency(currentYearSavings)} (${sign}${pctDiff.toFixed(1)}%). Great progress!`;

      return {
        isYearEnd: true,
        isNewUser: false,
        actualSavings: currentYearSavings,
        prevYearSavings: prevYearSavings,
        pctDiff: pctDiff,
        message: msg
      };
    }
  }

  const elapsedMonths = currentMonth + 1; // 1-indexed (June = 6)
  const avgMonthlyIncome = currentYearIncome / elapsedMonths;
  const avgMonthlyExpense = currentYearExpense / elapsedMonths;
  const avgMonthlySavings = currentYearSavings / elapsedMonths;
  const remainingMonths = 12 - elapsedMonths;
  const projectedYearEndSavings = currentYearSavings + (avgMonthlySavings * remainingMonths);

  // Best Case: expenses reduced by 15% for the remaining months
  const bestMonthlySavings = avgMonthlyIncome - (avgMonthlyExpense * 0.85);
  const bestCaseSavings = currentYearSavings + (bestMonthlySavings * remainingMonths);

  // Worst Case: expenses increased by 15% for the remaining months
  const worstMonthlySavings = avgMonthlyIncome - (avgMonthlyExpense * 1.15);
  const worstCaseSavings = currentYearSavings + (worstMonthlySavings * remainingMonths);

  return {
    isYearEnd: false,
    currentYearSavings: currentYearSavings,
    avgMonthlySavings: avgMonthlySavings,
    projectedSavings: projectedYearEndSavings,
    bestCaseSavings: bestCaseSavings,
    worstCaseSavings: worstCaseSavings,
    remainingMonths: remainingMonths
  };
}

// Bind to window
window.getActiveTransactions = getActiveTransactions;
window.calculateInitialBalances = calculateInitialBalances;
window.calculateFinancialHealthScore = calculateFinancialHealthScore;
window.calculateForecasting = calculateForecasting;

// Scan categories and transactions to clean up duplicates (e.g. Chinese characters)
async function cleanDuplicateCategories() {
  const targetCategoryName = '🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ';
  
  // Find bad categories in the categories list
  const badCategories = state.categories.filter(c => c.name && (
    c.name.includes('茶') || 
    /[\u4e00-\u9fff]/.test(c.name) ||
    (c.name.includes('ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ') && c.name !== '🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ')
  ));
  
  // Find bad category names in transactions
  const badCategoryNamesInTrans = new Set();
  state.transactions.forEach(t => {
    if (t.category && (
      t.category.includes('茶') || 
      /[\u4e00-\u9fff]/.test(t.category) ||
      (t.category.includes('ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ') && t.category !== '🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ')
    )) {
      badCategoryNamesInTrans.add(t.category);
    }
  });

  if (badCategories.length === 0 && badCategoryNamesInTrans.size === 0) return;

  console.log('Duplicate categories cleanup: found bad categories in list:', badCategories, 'and in transactions:', Array.from(badCategoryNamesInTrans));

  let didChange = false;
  const isOnline = state.supabaseClient && state.currentUser;

  // 1. Process bad category names in transactions
  for (const badCatName of badCategoryNamesInTrans) {
    try {
      if (isOnline) {
        console.log(`Updating transactions from bad category name "${badCatName}" to "${targetCategoryName}" in Cloud`);
        await state.supabaseClient
          .from('transactions')
          .update({ category: targetCategoryName })
          .eq('category', badCatName);
      }
      
      // Update local state transactions
      state.transactions.forEach(t => {
        if (t.category === badCatName) {
          t.category = targetCategoryName;
        }
      });
      didChange = true;
    } catch (e) {
      console.error(`Error during transaction update for category name "${badCatName}":`, e);
    }
  }

  // 2. Process bad category objects from database list
  for (const badCat of badCategories) {
    try {
      if (isOnline) {
        console.log(`Updating transactions from bad category object name "${badCat.name}" to "${targetCategoryName}" in Cloud`);
        await state.supabaseClient
          .from('transactions')
          .update({ category: targetCategoryName })
          .eq('category', badCat.name);

        console.log(`Deleting bad category "${badCat.name}" (ID: ${badCat.id}) from Cloud`);
        await state.supabaseClient
          .from('categories')
          .delete()
          .eq('id', badCat.id);
      }

      // Update local state transactions (just in case)
      state.transactions.forEach(t => {
        if (t.category === badCat.name) {
          t.category = targetCategoryName;
        }
      });

      // Update local state categories
      state.categories = state.categories.filter(c => c.id !== badCat.id);
      didChange = true;
    } catch (e) {
      console.error(`Error cleaning up bad category object "${badCat.name}":`, e);
    }
  }

  if (didChange) {
    console.log('Cleanup completed successfully. Saving to offline storage and updating UI.');
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
    localStorage.setItem('offline_categories', JSON.stringify(state.categories));
    calculateInitialBalances();
    // Only call updateUI if we're not in the middle of a bulk sync operation
    // (which already schedules its own clean render at the end)
    if (typeof updateUI === 'function' && !_suppressRealtimeEvents) {
      updateUI();
    }
  }
}

// Scan transactions list and delete duplicate entries (both locally and in Cloud)
async function cleanDuplicateTransactions() {
  if (!state.transactions || state.transactions.length === 0) return;
  
  const groups = {};
  const localCleaned = [];
  const cloudDeleteIds = [];
  let didChangeLocal = false;
  
  // Group all transactions by their visual contents.
  // IMPORTANT: user_id is included in the key so that transactions from different
  // family members with the same amount/date/category are NOT treated as duplicates.
  state.transactions.forEach(t => {
    if (!t) return;
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const amount = parseFloat(t.amount) || 0;
    const type = t.type || '';
    const category = t.category || '';
    const accountFrom = t.account_from || '';
    const accountTo = t.account_to || '';
    const note = t.note || '';
    // Include user_id so family members' identical transactions are NOT merged
    const userId = t.user_id || 'unknown';
    const key = `${userId}|${datePart}|${amount.toFixed(2)}|${type}|${category}|${accountFrom}|${accountTo}|${note}`;
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(t);
  });
  
  // Process groups to identify duplicates
  Object.keys(groups).forEach(key => {
    const list = groups[key];
    if (list.length === 1) {
      localCleaned.push(list[0]);
    } else {
      // Sort to determine which one to keep
      // Local pending items (starting with local_) come first because they are not yet synced.
      // Otherwise, keep the earliest created_at, or fallback to alphabetical ID comparison.
      list.sort((a, b) => {
        const aIsLocal = a.id && String(a.id).startsWith('local_');
        const bIsLocal = b.id && String(b.id).startsWith('local_');
        if (aIsLocal && !bIsLocal) return -1;
        if (!aIsLocal && bIsLocal) return 1;
        
        const timeA = a.created_at ? getTransactionTime({ created_at: a.created_at }) : 0;
        const timeB = b.created_at ? getTransactionTime({ created_at: b.created_at }) : 0;
        if (timeA !== timeB) return timeA - timeB;
        
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
      
      const canonical = list[0];
      localCleaned.push(canonical);
      
      // All others are duplicates to be deleted
      for (let i = 1; i < list.length; i++) {
        const dupe = list[i];
        if (dupe.id) {
          if (!String(dupe.id).startsWith('local_')) {
            cloudDeleteIds.push(dupe.id);
          }
          didChangeLocal = true;
        }
      }
    }
  });
  
  if (didChangeLocal) {
    console.log(`[DEDUPLICATION] Cleaned up local transactions state. Removed ${cloudDeleteIds.length} duplicates from local cache.`);
    
    // Preserve sorting
    localCleaned.sort(compareTransactions);
    
    state.transactions = localCleaned;
    localStorage.setItem('offline_transactions', JSON.stringify(localCleaned));
    calculateInitialBalances();
    updateUI();
  }
  
  if (cloudDeleteIds.length > 0 && state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    // Suppress realtime events during cleanup to prevent the DELETE operations
    // from triggering UI re-renders (flickering numbers).
    _suppressRealtimeEvents = true;
    try {
      console.log(`[DEDUPLICATION] Deleting ${cloudDeleteIds.length} duplicate transaction records from Cloud Database...`);
      for (let i = 0; i < cloudDeleteIds.length; i += 50) {
        const batch = cloudDeleteIds.slice(i, i + 50);
        const { error } = await state.supabaseClient
          .from('transactions')
          .delete()
          .in('id', batch)
          .eq('user_id', state.currentUser.id); // safety: only delete own transactions
        if (error) {
          console.error('[DEDUPLICATION] Cloud delete error:', error);
        } else {
          console.log(`[DEDUPLICATION] Successfully deleted batch of ${batch.length} duplicates from Cloud.`);
        }
      }
    } catch (e) {
      console.error('[DEDUPLICATION] Exception during cloud delete:', e);
    } finally {
      // Re-enable realtime events after a short delay (to let any in-flight events pass)
      setTimeout(() => { _suppressRealtimeEvents = false; }, 5000);
    }
  }
}

window.cleanDuplicateTransactions = cleanDuplicateTransactions;

function getPendingLocalTransactions(cachedTransactions) {
  if (!cachedTransactions || !Array.isArray(cachedTransactions)) return [];
  try {
    const queueStr = localStorage.getItem('money_manager_sync_queue');
    const queuedIds = new Set();
    if (queueStr) {
      const queue = JSON.parse(queueStr) || [];
      queue.forEach(item => {
        if (item.action === 'save' && item.payload && item.payload.id) {
          queuedIds.add(item.payload.id);
        }
      });
    }

    return cachedTransactions.filter(t => {
      if (!t || typeof t !== 'object') return false;
      if (!t.id) return true;
      if (String(t.id).startsWith('local_')) return true;
      if (t.user_id === null || t.user_id === undefined) return true;
      
      // Keep if in the offline sync queue (not yet successfully uploaded)
      if (queuedIds.has(t.id)) return true;
      
      // If it is not a valid UUID, it is local
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(String(t.id))) return true;
      
      return false;
    });
  } catch (e) {
    console.error('Error getting pending local transactions:', e);
    return [];
  }
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadData() {
  // Cancel any pending realtime debounce timer to prevent stale DB events
  // from overwriting the fresh data we are about to fetch.
  if (_realtimeDebounceTimer) {
    clearTimeout(_realtimeDebounceTimer);
    _realtimeDebounceTimer = null;
    _pendingRealtimeEvents = [];
    console.log('[loadData] Cancelled stale realtime debounce before fetch.');
  }

  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      updateHeaderSyncIcon('syncing');
      const userId = state.currentUser.id;
      const partnerId = state.partnerProfile ? state.partnerProfile.id : null;

      // Fetch categories & accounts first
      const familyId = state.userProfile ? state.userProfile.family_id : null;
      const userFilter = familyId 
        ? (partnerId ? `family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}` : `family_id.eq.${familyId},user_id.eq.${userId}`)
        : (partnerId ? `user_id.eq.${userId},user_id.eq.${partnerId}` : `user_id.eq.${userId}`);

      const [catsRes, accsRes] = await promiseTimeout(
        Promise.all([
          state.supabaseClient.from('categories').select('*').or(userFilter),
          state.supabaseClient.from('accounts').select('*').or(userFilter),
        ]),
        15000
      );
      if (catsRes.error) throw catsRes.error;
      if (accsRes.error) throw accsRes.error;

      // Fetch all transactions with pagination (due to Supabase PostgREST default 1000 limit)
      let allTransactions = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let transQuery = state.supabaseClient
          .from('transactions')
          .select('*')
          .order('date', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (familyId) {
          if (partnerId) {
            transQuery = transQuery.or(`family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}`);
          } else {
            transQuery = transQuery.or(`family_id.eq.${familyId},user_id.eq.${userId}`);
          }
        } else if (partnerId) {
          transQuery = transQuery.or(`user_id.eq.${userId},user_id.eq.${partnerId}`);
        } else {
          transQuery = transQuery.eq('user_id', userId);
        }

        const { data: pageData, error: pageErr } = await promiseTimeout(
          transQuery,
          15000
        );
        if (pageErr) throw pageErr;

        if (pageData && pageData.length > 0) {
          allTransactions = allTransactions.concat(pageData);
          if (pageData.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      let categories = catsRes.data || [];
      let accounts = accsRes.data || [];

      // Pre-populate standard categories in the cloud for this user if they don't have any
      if (categories.length === 0) {
        const catsToInsert = DEFAULT_CATEGORIES.map(c => ({
          name: c.name,
          type: c.type,
          icon: c.icon,
          color: c.color,
          user_id: userId,
          family_id: familyId
        }));
        try {
          const { data: newCats, error: catErr } = await state.supabaseClient.from('categories').insert(catsToInsert).select();
          if (!catErr && newCats) {
            categories = newCats;
          } else {
            console.warn('Failed to pre-populate categories:', catErr);
            categories = DEFAULT_CATEGORIES;
          }
        } catch (e) {
          console.warn('Failed to pre-populate categories catch:', e);
          categories = DEFAULT_CATEGORIES;
        }
      }

      // Pre-populate standard accounts in the cloud for this user if they don't have any
      if (accounts.length === 0) {
        const accsToInsert = DEFAULT_ACCOUNTS.map(a => ({
          name: a.name,
          type: a.type,
          balance: a.balance,
          user_id: userId,
          family_id: familyId
        }));
        try {
          const { data: newAccs, error: accErr } = await state.supabaseClient.from('accounts').insert(accsToInsert).select();
          if (!accErr && newAccs) {
            accounts = newAccs;
          } else {
            console.warn('Failed to pre-populate accounts:', accErr);
            accounts = DEFAULT_ACCOUNTS;
          }
        } catch (e) {
          console.warn('Failed to pre-populate accounts catch:', e);
          accounts = DEFAULT_ACCOUNTS;
        }
      }

      // Preserve pending local transactions that failed to sync (offline fallback),
      // so they are not lost when fresh cloud data overwrites local cache.
      const pendingLocal = getPendingLocalTransactions(JSON.parse(localStorage.getItem('offline_transactions') || '[]'));

      // 4.5. RECOVERY: Rescue local transactions that were dropped from the sync queue due to schema errors (e.g., recurring_template_id)
      const cloudIds = new Set(allTransactions.map(t => t.id));
      /*
      const toRecover = (() => {
        try {
          const cached = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
          return cached.filter(t => {
            if (!t.id || String(t.id).startsWith('local_')) return false;
            if (t.user_id !== user.id) return false;
            if (cloudIds.has(t.id)) return false;
            // Only recover transactions from the last 30 days
            if (!t.created_at || new Date(t.created_at).getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000) return false;
            return true;
          });
        } catch (_) {
          return [];
        }
      })();
      */

      // 4.5. RECOVERY: Disabled - was causing infinite loops and duplicate clutter
      /*
      if (toRecover.length > 0) {
        console.log(`Recovering ${toRecover.length} silently dropped transactions during loadData...`);
        const payloads = toRecover.map(t => {
          const { description, is_shared, recurring_template_id, ...dbPayload } = t;
          return dbPayload;
        });
        try {
          for (let i = 0; i < payloads.length; i += 50) {
            await state.supabaseClient.from('transactions').upsert(payloads.slice(i, i + 50));
          }
        } catch (recoverErr) {
          console.error("Failed to recover dropped transactions:", recoverErr);
        }
      }
      */

      // Deduplicate merged transactions (ID-based first, then content-based)
      const mergedTransactions = mergeAndDeduplicateTransactions(allTransactions, pendingLocal);
      mergedTransactions.sort(compareTransactions);
      state.transactions = mergedTransactions;
      state.categories = categories;
      deduplicateCategories();
      state.accounts = accounts;
      
      calculateInitialBalances();

      localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
      localStorage.setItem('offline_accounts', JSON.stringify(state.accounts));
      localStorage.setItem('offline_categories', JSON.stringify(state.categories));
      
      updateHeaderSyncIcon('synced');

      // Run automatic duplicate / corrupt category cleanup in background
      cleanDuplicateCategories().catch(e => console.warn('Automatic categories cleanup error:', e));

      // NOTE: cleanDuplicateTransactions no longer needed here since we dedup inline above.
      // It is kept available for manual/sync-triggered calls only.

      // Try to flush pending local items in background without blocking UI.
      if (pendingLocal.length > 0) {
        syncLocalTransactionsToCloud(userId, { silent: true }).catch(() => {});
      }
    } catch (err) {
      console.error('Supabase fetch failed, falling back to offline cache:', err);
      // Load from cache and show offline state (not error) so user knows data is still visible
      loadOfflineData();
      updateHeaderSyncIcon('offline');
      updateUI();
    }
  } else {
    updateHeaderSyncIcon('offline');
    loadOfflineData();
  }
}

function loadOfflineData() {
  try {
    const cachedUser = localStorage.getItem('cached_current_user');
    if (cachedUser) {
      state.currentUser = JSON.parse(cachedUser);
    }
  } catch (e) {
    console.error('Failed to parse cached current user:', e);
  }
  try {
    const cachedPartner = localStorage.getItem('cached_partner_profile');
    if (cachedPartner) {
      state.partnerProfile = JSON.parse(cachedPartner);
    }
  } catch (e) {
    console.error('Failed to parse cached partner profile:', e);
  }
  try {
    const cachedProfile = localStorage.getItem('cached_user_profile');
    if (cachedProfile) {
      state.userProfile = JSON.parse(cachedProfile);
    }
  } catch (e) {
    console.error('Failed to parse cached user profile:', e);
  }

  try {
    const trans = localStorage.getItem('offline_transactions');
    state.transactions = trans ? JSON.parse(trans) : [];
  } catch (e) {
    console.error('Failed to parse offline transactions:', e);
    state.transactions = [];
  }
  try {
    const accs  = localStorage.getItem('offline_accounts');
    state.accounts     = accs  ? JSON.parse(accs)  : DEFAULT_ACCOUNTS;
  } catch (e) {
    console.error('Failed to parse offline accounts:', e);
    state.accounts     = DEFAULT_ACCOUNTS;
  }
  try {
    const cats  = localStorage.getItem('offline_categories');
    state.categories   = cats  ? JSON.parse(cats)  : DEFAULT_CATEGORIES;
    deduplicateCategories();
  } catch (e) {
    console.error('Failed to parse offline categories:', e);
    state.categories   = DEFAULT_CATEGORIES;
    deduplicateCategories();
  }

  try {
    const temps = localStorage.getItem('recurring_templates');
    state.recurringTemplates = temps ? JSON.parse(temps) : [];
  } catch (e) {
    console.error('Failed to parse recurring templates:', e);
    state.recurringTemplates = [];
  }
  try {
    const deleted = localStorage.getItem('deleted_recurring_dates');
    state.deletedRecurringDates = deleted ? JSON.parse(deleted) : [];
  } catch (e) {
    console.error('Failed to parse deleted recurring dates:', e);
    state.deletedRecurringDates = [];
  }
  
  processRecurringTemplates();
  calculateInitialBalances();
  cleanDuplicateCategories().catch(e => console.warn('Offline automatic categories cleanup error:', e));
}

function processRecurringTemplates() {
  if (!state.recurringTemplates || state.recurringTemplates.length === 0) return;

  let transactionsUpdated = false;
  const currentYear = state.selectedYear;
  const currentMonthLimit = state.selectedMonth; // 0-indexed (0 = Jan, 11 = Dec)

  // Helper to get matching dates for a specific month
  function getRecurringDatesForMonth(template, year, monthIdx) {
    const dates = [];
    const monthNum = monthIdx + 1;

    const startDateStr = template.startDate || `${template.startYear || year}-${String(template.startMonth || 1).padStart(2, '0')}-01`;
    const startDate = new Date(startDateStr);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();

    if (year < startYear) return dates;
    if (year === startYear && monthNum < startMonth) return dates;
    
    if (template.years && template.years.length > 0) {
      if (!template.years.includes(year)) return dates;
    } else if (template.endYear !== null && year > template.endYear) {
      return dates;
    }

    const preset = template.preset || 'custom';
    const lastDay = new Date(year, monthIdx + 1, 0).getDate();

    if (preset === 'daily') {
      for (let d = 1; d <= lastDay; d++) {
        if (year === startYear && monthNum === startMonth && d < startDay) continue;
        dates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }
    } else if (preset === 'weekly') {
      const targetDayOfWeek = startDate.getDay();
      for (let d = 1; d <= lastDay; d++) {
        const dObj = new Date(year, monthIdx, d);
        if (dObj.getDay() === targetDayOfWeek) {
          if (year === startYear && monthNum === startMonth && d < startDay) continue;
          dates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }
      }
    } else if (preset === 'monthly') {
      const day = Math.min(startDay, lastDay);
      if (!(year === startYear && monthNum === startMonth && day < startDay)) {
        dates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
    } else if (preset === 'yearly') {
      if (monthNum === startMonth) {
        const day = Math.min(startDay, lastDay);
        dates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
    } else if (preset === 'specific_months') {
      if (template.months && template.months.includes(monthNum)) {
        const day = Math.min(startDay, lastDay);
        if (!(year === startYear && monthNum === startMonth && day < startDay)) {
          dates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
      }
    } else if (preset === 'custom') {
      if (template.months && template.months.includes(monthNum)) {
        if (template.days) {
          template.days.forEach(day => {
            if (day <= lastDay) {
              if (year === startYear && monthNum === startMonth && day < startDay) return;
              dates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
            }
          });
        }
      }
    }

    if (template.endDate) {
      return dates.filter(dStr => dStr <= template.endDate);
    }

    return dates;
  }

  state.recurringTemplates.forEach(template => {
    const preset = template.preset || 'custom';
    if (preset === 'custom' && (!template.days || !template.months || template.days.length === 0 || template.months.length === 0)) {
      return;
    }
    if (preset === 'specific_months' && (!template.months || template.months.length === 0)) {
      return;
    }

    for (let m = 0; m <= currentMonthLimit; m++) {
      const datesToProcess = getRecurringDatesForMonth(template, currentYear, m);
      
      datesToProcess.forEach(dateString => {
        const deleteKey = `${template.id}_${dateString}`;
        
        if (state.deletedRecurringDates && state.deletedRecurringDates.includes(deleteKey)) {
          return;
        }

        // Check for duplicates by BOTH recurring_template_id (if stored) AND by content-key.
        // The content-key fallback is critical because the recurring_template_id column may not
        // exist in the database, so fetched transactions arrive with recurring_template_id=null,
        // causing false negatives in the ID-only check and infinite re-creation loops.
        const duplicateExists = state.transactions.some(t => {
          const tDate = String(t.date || '').split('T')[0].split(' ')[0];
          if (t.recurring_template_id && t.recurring_template_id === template.id && tDate === dateString) {
            return true;
          }
          // Content-based fallback: same date + amount + type + category + account_from
          if (tDate === dateString &&
              (parseFloat(t.amount) || 0).toFixed(2) === (parseFloat(template.amount) || 0).toFixed(2) &&
              t.type === template.type &&
              t.category === template.category &&
              (t.account_from || '') === (template.account_from || '')) {
            return true;
          }
          return false;
        });

        if (!duplicateExists) {
          const newTx = {
            id: generateUUID(),
            recurring_template_id: template.id,
            date: dateString,
            type: template.type,
            amount: parseFloat(template.amount),
            category: template.category,
            subcategory: template.subcategory || '',
            account_from: template.account_from,
            account_to: template.type === 'transfer' ? template.account_to : null,
            note: template.note,
            description: template.description || '',
            user_id: template.user_id || (state.currentUser ? state.currentUser.id : null),
            is_shared: template.is_shared !== undefined ? template.is_shared : (state.partnerProfile !== null),
            family_id: template.family_id || (state.userProfile ? state.userProfile.family_id : null),
            created_at: new Date().toISOString()
          };

          saveTransactionOffline(newTx);

          if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
            const { description, ...dbPayload } = newTx;
            (async () => {
              try {
                const { error } = await promiseTimeout(
                  state.supabaseClient
                    .from('transactions')
                    .upsert([dbPayload]),
                  12000
                );
                if (error) throw error;
                console.log(`Cloud sync success for recurring transaction: ${newTx.id}`);
              } catch (err) {
                console.warn(`Cloud save failed for recurring, queueing transaction: ${newTx.id}`, err);
                enqueueSyncMutation('save', newTx);
              }
            })();
          }

          transactionsUpdated = true;
        }
      });
    }
  });

  if (transactionsUpdated) {
    calculateInitialBalances();
  }
}

// ============================================================
// SAVE / DELETE
// ============================================================
async function saveTransaction(transaction) {
  transaction.amount = parseFloat(transaction.amount);

  // 1. Generate local UUID if it's a new transaction
  if (!transaction.id) {
    transaction.id = generateUUID();
  }

  // 2. Optimistically save to local state and local storage immediately
  saveTransactionOffline(transaction);
  calculateInitialBalances();
  updateUI();

  // 3. Attempt to save to cloud in background
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    if (!transaction.user_id) {
      transaction.user_id = state.currentUser.id;
    }
    if (!transaction.family_id && state.userProfile && state.userProfile.family_id) {
      transaction.family_id = state.userProfile.family_id;
    }

    // Note: description and is_shared are client-only fields. recurring_template_id
    // is kept if the column exists in the DB (it won't cause errors if missing — upsert will ignore it).
    // However if it throws a 400, remove it too. For now we keep it to prevent duplicate re-creation.
    const { description, is_shared, ...dbPayload } = transaction;

    (async () => {
      try {
        // Suppress realtime echo of our own upsert to prevent a second UI render ~5s after save.
        _suppressRealtimeEvents = true;
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .upsert([dbPayload]),
          12000
        );
        if (error) throw error;
        console.log(`Cloud sync success for transaction: ${transaction.id}`);
      } catch (err) {
        console.warn(`Cloud save failed, queueing transaction: ${transaction.id}`, err);
        enqueueSyncMutation('save', transaction);
      } finally {
        // Re-enable realtime after enough time for the echo to arrive and be discarded.
        setTimeout(() => { _suppressRealtimeEvents = false; }, 8000);
      }
    })();
  }
}

function saveTransactionOffline(transaction) {
  if (!transaction.id) {
    transaction.id = generateUUID();
  }
  if (!transaction.created_at) {
    transaction.created_at = new Date().toISOString();
  }
  let trans = [...state.transactions];
  const existingIdx = trans.findIndex(t => t.id === transaction.id);
  if (existingIdx !== -1) {
    trans[existingIdx] = transaction;
  } else {
    trans.unshift(transaction);
  }
  state.transactions = trans;
  localStorage.setItem('offline_transactions', JSON.stringify(trans));
}

function deleteTransaction(id) {
  if (!id) return;
  
  // Find duplicates of this transaction to delete them too (prevents them from reappearing due to Supabase sync)
  const tx = state.transactions.find(t => t.id === id);
  const idsToDelete = [String(id)];
  
  if (tx) {
    const txDate = String(tx.date || '').split('T')[0].split(' ')[0];
    const txAmount = (parseFloat(tx.amount) || 0).toFixed(2);
    state.transactions.forEach(t => {
      if (t.id && t.id !== id) {
        const tDate = String(t.date || '').split('T')[0].split(' ')[0];
        const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
        const isDupe = tDate === txDate &&
                       tAmount === txAmount &&
                       t.type === tx.type &&
                       t.category === tx.category &&
                       (t.account_from || '') === (tx.account_from || '') &&
                       (t.account_to || '') === (tx.account_to || '') &&
                       (t.note || '') === (tx.note || '') &&
                       (t.user_id || '') === (tx.user_id || '');
        if (isDupe) {
          idsToDelete.push(String(t.id));
        }
      }
    });
  }

  // 1. Mark all these IDs as deleting
  idsToDelete.forEach(dId => _deletingTxIds.add(dId));

  // 2. Clean up local receipt photo from IndexedDB (run in background)
  idsToDelete.forEach(dId => {
    ReceiptStorage.remove(dId).catch(err => {
      console.warn('Failed to remove receipt during transaction delete:', err);
    });
  });
  
  // 3. Optimistically delete from local state and update UI
  idsToDelete.forEach(dId => deleteTransactionOffline(dId, true));
  localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
  calculateInitialBalances();
  updateUI();

  // 4. Perform background delete
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    (async () => {
      try {
        _suppressRealtimeEvents = true;
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .delete()
            .in('id', idsToDelete),
          12000
        );
        if (error) throw error;
        console.log(`Cloud delete success for transaction (and duplicates):`, idsToDelete);
      } catch (err) {
        console.warn(`Cloud delete failed, queueing delete:`, idsToDelete, err);
        idsToDelete.forEach(dId => enqueueSyncMutation('delete', dId));
      } finally {
        idsToDelete.forEach(dId => _deletingTxIds.delete(dId));
        setTimeout(() => { _suppressRealtimeEvents = false; }, 8000);
      }
    })();
  } else {
    idsToDelete.forEach(dId => _deletingTxIds.delete(dId));
  }
}

function deleteTransactionOffline(id, skipSave = false) {
  const tx = state.transactions.find(t => t.id === id);
  if (tx) {
    let templateId = tx.recurring_template_id;
    const txDate = String(tx.date || '').split('T')[0].split(' ')[0];
    
    if (!templateId && state.recurringTemplates) {
      // Find template matching by content if recurring_template_id is missing
      const match = state.recurringTemplates.find(template => {
        return (parseFloat(tx.amount) || 0).toFixed(2) === (parseFloat(template.amount) || 0).toFixed(2) &&
               tx.type === template.type &&
               tx.category === template.category &&
               (tx.account_from || '') === (template.account_from || '');
      });
      if (match) {
        templateId = match.id;
      }
    }
    
    if (templateId) {
      const key = `${templateId}_${txDate}`;
      if (!state.deletedRecurringDates.includes(key)) {
        state.deletedRecurringDates.push(key);
        localStorage.setItem('deleted_recurring_dates', JSON.stringify(state.deletedRecurringDates));
      }
    }
    
    // Also remove any content-based duplicates from local state
    const txAmount = (parseFloat(tx.amount) || 0).toFixed(2);
    state.transactions = state.transactions.filter(t => {
      if (t.id === tx.id) return false;
      const tDate = String(t.date || '').split('T')[0].split(' ')[0];
      const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
      const isDupe = tDate === txDate &&
                     tAmount === txAmount &&
                     t.type === tx.type &&
                     t.category === tx.category &&
                     (t.account_from || '') === (tx.account_from || '') &&
                     (t.account_to || '') === (tx.account_to || '') &&
                     (t.note || '') === (tx.note || '') &&
                     (t.user_id || '') === (tx.user_id || '');
      return !isDupe;
    });
  }
  state.transactions = state.transactions.filter(t => t.id !== id);
  if (!skipSave) {
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
  }
}

// ============================================================
// UI UPDATE ENGINE
// ============================================================

// Debounce for updateUI — prevents 32+ concurrent calls from all hammering the DOM at once.
// Any burst of updateUI() calls within 150 ms will collapse into a single render.
let _updateUITimer = null;
let _updateUIRAF = null;
function updateUI() {
  if (_updateUITimer) clearTimeout(_updateUITimer);
  _updateUITimer = setTimeout(() => {
    _updateUITimer = null;
    if (_updateUIRAF) cancelAnimationFrame(_updateUIRAF);
    _updateUIRAF = requestAnimationFrame(() => {
      _updateUIRAF = null;
      _updateUIImpl();
    });
  }, 150);
}

function _updateUIImpl() {
  processRecurringTemplates();
  updateHeaderAndSync();
  // Render only the active tab to optimize performance and prevent background rendering lag
  if (state.activeTab === 'trans') {
    renderTransactionsTab();
  } else if (state.activeTab === 'stats') {
    renderStatsTab();
  } else if (state.activeTab === 'accounts') {
    renderAccountsTab();
  } else if (state.activeTab === 'more') {
    renderPartnerSection();
  }
  
  // Clear category render cache on UI refresh to pick up updates
  lastRenderedCategoryType = null;
  
  const activeTypeBtn = document.querySelector('.type-tab-btn.active');
  const currentType = activeTypeBtn ? activeTypeBtn.getAttribute('data-type') : 'expense';
  
  updateCategoryDropdowns(currentType);
  updateAccountDropdowns();
  updateCurrencySymbols();
  
  // Scroll to today on startup once transactions are loaded
  const list = document.getElementById('transactions-list');
  if (!state.hasInitialScrollDone && list && list.children.length > 0) {
    state.hasInitialScrollDone = true;
    setTimeout(() => {
      scrollToToday('auto');
    }, 300);
  }
}

function updateHeaderAndSync() {
  const rawText = `${getMonthName(state.selectedMonth, true)} ${state.selectedYear}`;
  document.getElementById('current-period-title').innerHTML = wrapPeriodTitleWithSpans(rawText);
  updateHeaderProfileBadge();
}

// ============================================================
// TAB 1: TRANSACTIONS
// ============================================================
function renderTransactionsTab() {
  const listContainer = document.getElementById('transactions-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  const monthStartDay = parseInt(localStorage.getItem('app_month_start') || '1', 10);
  let start, end;
  if (monthStartDay === 1) {
    start = new Date(state.selectedYear, state.selectedMonth, 1, 0, 0, 0, 0);
    end = new Date(state.selectedYear, state.selectedMonth + 1, 0, 23, 59, 59, 999);
  } else {
    start = new Date(state.selectedYear, state.selectedMonth, monthStartDay, 0, 0, 0, 0);
    end = new Date(state.selectedYear, state.selectedMonth + 1, monthStartDay - 1, 23, 59, 59, 999);
  }

  const startISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const endISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

  const walletTrans = getActiveTransactions();
  const filteredTrans = walletTrans.filter(t => {
    if (!t.date) return false;
    const tDatePart = String(t.date).split('T')[0].split(' ')[0];
    return tDatePart >= startISO && tDatePart <= endISO;
  });

  const sortedTrans = [...filteredTrans].sort(compareTransactions);

  let monthlyIncome = 0, monthlyExpense = 0;
  const groups = {};

  sortedTrans.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') monthlyIncome += amt;
    else if (t.type === 'expense') monthlyExpense += amt;
    
    const dateKey = String(t.date || '').split('T')[0].split(' ')[0];
    if (!groups[dateKey]) groups[dateKey] = { transactions: [], income: 0, expense: 0 };
    groups[dateKey].transactions.push(t);
    if (t.type === 'income') groups[dateKey].income += amt;
    else if (t.type === 'expense') groups[dateKey].expense += amt;
  });

  document.getElementById('summary-income-val').textContent  = `${getCurrencySymbol()} ${formatCurrency(monthlyIncome)}`;
  document.getElementById('summary-expense-val').textContent = `${getCurrencySymbol()} ${formatCurrency(monthlyExpense)}`;
  document.getElementById('summary-total-val').textContent   = `${getCurrencySymbol()} ${formatCurrency(monthlyIncome - monthlyExpense)}`;

  if (sortedTrans.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-secondary)">
        <div style="font-size:48px;margin-bottom:16px">📅</div>
        <h3 style="margin-bottom:8px">Δεν υπάρχουν συναλλαγές</h3>
        <p style="font-size:12px">Πατήστε + για να προσθέσετε ή εισάγετε Excel από το More menu</p>
      </div>`;
    return;
  }

  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

  const fragment = document.createDocumentFragment();

  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(dateStr => {
    const group = groups[dateStr];
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const dayNum = d;
    const shortDay = getWeekdayName(dayOfWeek);
    const weekendClass = dayOfWeek === 6 ? ' saturday' : dayOfWeek === 0 ? ' sunday' : '';
    const isToday = (dateStr === todayStr);

    let rightTotals = '';
    if (group.income > 0)  rightTotals += `<span class="day-group-income">${getCurrencySymbol()} ${formatCurrency(group.income)}</span>`;
    if (group.expense > 0) rightTotals += `<span class="day-group-expense">${getCurrencySymbol()} ${formatCurrency(group.expense)}</span>`;

    const header = document.createElement('div');
    header.className = 'day-header' + (isToday ? ' is-today' : '');
    const todayBadge = isToday ? ` <span class="today-badge">${state.lang === 'el' ? 'ΣΗΜΕΡΑ' : 'TODAY'}</span>` : '';
    header.innerHTML = `
      <div class="day-header-left">
        <span class="day-num">${dayNum}</span>
        <div>
          <span class="day-name${weekendClass}">${shortDay}</span>${todayBadge}
          <span class="day-month">${getMonthName(m - 1, true)} ${y}</span>
        </div>
      </div>
      <div class="day-header-right">${rightTotals}</div>`;
    fragment.appendChild(header);

    group.transactions.forEach(t => {
      const catInfo = getCategoryInfo(t.category, t.type);
      const item = document.createElement('div');
      item.className = 'transaction-item';
      
      const isSelected = state.selectedIds.has(t.id);
      if (state.selectionMode && isSelected) {
        item.classList.add('selected');
      }
      
      const checkboxHtml = state.selectionMode ? `
        <div class="trans-checkbox ${isSelected ? 'checked' : ''}">
          <i class="fa-solid ${isSelected ? 'fa-circle-check' : 'fa-circle'}"></i>
        </div>
      ` : '';

      let pressTimer;
      let feedbackTimer;
      let isLongPress = false;
      
      item.addEventListener('touchstart', (e) => {
        isLongPress = false;
        state.touchDidMove = false;
        
        // Active visual feedback with 80ms delay to prevent flashing on swipe/scroll
        clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(() => {
          if (!state.touchDidMove && !state.isSwipingMonth) {
            item.classList.add('pressed');
          }
        }, 80);
        
        if (state.selectionMode) return;
        pressTimer = setTimeout(() => {
          isLongPress = true;
          enterSelectionMode();
          toggleSelection(t.id);
          if (navigator.vibrate) {
            try { navigator.vibrate(15); } catch(err) {}
          }
        }, 600);
      }, { passive: true });

      item.addEventListener('touchmove', (e) => {
        clearTimeout(pressTimer);
        clearTimeout(feedbackTimer);
        item.classList.remove('pressed');
        state.touchDidMove = true;
      }, { passive: true });

      item.addEventListener('touchend', (e) => {
        clearTimeout(pressTimer);
        clearTimeout(feedbackTimer);
        item.classList.remove('pressed');
        if (state.isSwipingMonth || state.touchDidMove) {
          if (e.cancelable) e.preventDefault();
        }
      }, { passive: false });

      item.addEventListener('touchcancel', () => {
        clearTimeout(pressTimer);
        clearTimeout(feedbackTimer);
        item.classList.remove('pressed');
      });
      
      item.addEventListener('mousedown', (e) => {
        isLongPress = false;
        item.classList.add('pressed');
        if (state.selectionMode) return;
        pressTimer = setTimeout(() => {
          isLongPress = true;
          enterSelectionMode();
          toggleSelection(t.id);
        }, 600);
      });
      item.addEventListener('mouseup', () => {
        clearTimeout(pressTimer);
        item.classList.remove('pressed');
      });
      item.addEventListener('mouseleave', () => {
        clearTimeout(pressTimer);
        item.classList.remove('pressed');
      });

      item.onclick = (e) => {
        if (state.isSwipingMonth || state.touchDidMove || (Date.now() - state.lastSwipeTime < 1500)) {
          isLongPress = false;
          state.touchDidMove = false;
          return;
        }
        if (isLongPress) {
          isLongPress = false;
          return;
        }
        if (state.selectionMode) {
          toggleSelection(t.id);
        } else {
          openEditTransactionModal(t);
        }
      };

      let amountClass = 'trans-amount';
      let accountText = t.account_from ? getAccountDisplayName(t.account_from) : '';
      if (t.type === 'expense')       { amountClass += ' expense'; }
      else if (t.type === 'income')   { amountClass += ' income'; }
      else if (t.type === 'transfer') {
        const fromDisp = getAccountDisplayName(t.account_from);
        const toDisp = getAccountDisplayName(t.account_to);
        amountClass += ' transfer';
        accountText = `${fromDisp} → ${toDisp}`;
      }

      const translatedSub = getSubcategoryDisplayName(t.subcategory, t.category);
      const translatedCat = getCategoryDisplayName(t.category);
      const displayTitle = (t.note && t.note.trim()) ? t.note.trim()
                         : (t.description && t.description.trim()) ? t.description.trim()
                         : (translatedSub && translatedSub.trim()) ? translatedSub.trim()
                         : (translatedCat || '');
      
      const memberBadge = getMemberBadgeHTML(t);

      item.innerHTML = `
        ${checkboxHtml}
        <div class="trans-left">
          <div class="trans-category-container">
            <div class="trans-cat-icon">${catInfo.icon || '💰'}</div>
            <div class="trans-cat-name">${translatedCat || ''}</div>
            ${t.subcategory ? `<div class="trans-sub-name">${translatedSub}</div>` : ''}
          </div>
          <div class="trans-details">
            <span class="trans-title">${displayTitle}${memberBadge}</span>
            <span class="trans-acc-label">${accountText}</span>
          </div>
        </div>
        <div class="${amountClass}">${getCurrencySymbol()} ${formatCurrency(t.amount)}</div>`;
      fragment.appendChild(item);
    });
  });

  listContainer.appendChild(fragment);
}

// Get category display info (icon, name, color) from stored category or emoji map
function getCategoryInfo(categoryName, transType) {
  if (!categoryName) return { icon: transType === 'income' ? '💰' : '💸', name: '', color: '#78909c' };

  // Try stored categories first (already cleaned)
  const stored = state.categories.find(c =>
    c.name && c.name.toUpperCase() === (categoryName || '').toUpperCase()
  );
  if (stored) return stored;

  // Try emoji map via codepoint
  const cp = getFirstEmojiCodepoint(categoryName);
  if (cp && CATEGORY_EMOJI_MAP[cp]) return CATEGORY_EMOJI_MAP[cp];

  // Strip and match
  const cleaned = stripLeadingEmoji(categoryName).trim();
  const cleaned2 = state.categories.find(c =>
    c.name && c.name.toUpperCase() === cleaned.toUpperCase()
  );
  if (cleaned2) return cleaned2;

  return { icon: transType === 'income' ? '💰' : '💸', name: cleaned || categoryName, color: '#78909c' };
}

// Category name translations for default categories (UI only, never applied to user data)
const CATEGORY_NAME_TRANSLATIONS = {
  '🏡 ΣΠΙΤΙ': '🏡 Home',
  '🏠ΓΡΑΦΕΙΟ Β2': '🏠 Office B2',
  '🚗 ΑΥΤΟΚΙΝΗΤΟ': '🚗 Car',
  '🛒 ΔΙΑΤΡΟΦΗ': '🛒 Food/Groceries',
  '🏋️ΓΥΜΝΑΣΤΗΡΙΟ': '🏋️ Gym',
  '🎉ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ': '🎉 Entertainment',
  '🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ': '🧾 Taxes/Accountant',
  '👕 ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ': '👕 Personal Care',
  '🚇 ΜΕΤΑΚΙΝΗΣΗ': '🚇 Transport',
  '💻 ΤΕΧΝΟΛΟΓΙΑ': '💻 Technology',
  '💼 ΜΙΣΘΟΣ': '💼 Salary',
  '🧩ΔΙΑΦΟΡΑ ΕΞΟΔΑ': '🧩 Misc Expenses',
  '🎬 ΣΥΝΔΡΟΜΕΣ': '🎬 Subscriptions',
  '❤️ ΥΓΕΙΑ': '❤️ Health',
  '🤑 ΕΞΤΡΑ ΕΙΣΟΔΗΜΑΤΑ': '🤑 Extra Income',
  '🎁ΔΩΡΑ/ΕΣΟΔΑ': '🎁 Gifts/Income',
  'ΕΠΙΣΤΡΟΦΕΣ': 'Refunds',
  'ΠΩΛΗΣΕΙΣ': 'Sales',
  'BONUS': 'Bonus',
  'ΑΛΛΑ ΕΣΟΔΑ': 'Other Income',
  '🎓 ΕΚΠΑΙΔΕΥΣΗ': '🎓 Education',
  '💶  ΕΝΟΙΚΙΟ Β2 (Έσοδο)': '💶 Rent B2 (Income)',
  '🏛️ΜΕΡΙΔΙΟ ΔΟΣΗΣ ΔΑΝΕΙΟΥ (ΓΟΝΕΙΣ)': '🏛️ Loan Share (Parents)',
  'ΑΛΛΑ ΕΞΟΔΑ': 'Other Expenses',
  'Άλλα': 'Other',
  'ΑΛΛΑ': 'Other',
  'ΑΛΛΑ ΕΣΟΔΑ': 'Other Income'
};

// Get category display name - translates default categories, preserves custom/user categories
function getCategoryDisplayName(categoryName) {
  if (!categoryName) return '';
  const stripped = stripLeadingEmoji(categoryName).trim();
  const lang = state.lang || 'el';
  
  for (const [elKey, enVal] of Object.entries(CATEGORY_NAME_TRANSLATIONS)) {
    const strippedEl = stripLeadingEmoji(elKey).trim().toUpperCase();
    const strippedEn = stripLeadingEmoji(enVal).trim().toUpperCase();
    
    if (stripped.toUpperCase() === strippedEl || stripped.toUpperCase() === strippedEn) {
      const target = lang === 'en' ? enVal : elKey;
      return stripLeadingEmoji(target).trim();
    }
  }
  return stripped;
}

const SUBCATEGORY_NAME_TRANSLATIONS = {
  'Γιατρός': 'Doctor',
  'Εξετάσεις': 'Medical Exams',
  'Συμπληρώματα διατροφής': 'Supplements',
  'Φάρμακα': 'Medicines',
  'Parking': 'Parking',
  'Service/Ανταλλακτικά': 'Service/Parts',
  'Αγορά αυτοκινήτου/Δόσεις': 'Car Purchase/Installments',
  'Ασφάλεια αυτοκινήτου': 'Car Insurance',
  'Βενζίνες': 'Gas',
  'Διόδια e-pass': 'Tolls e-pass',
  'Τέλη κυκλορίσας': 'Road Tax',
  'ΔΙΑΦΟΡΑ Β2': 'Misc B2',
  'ΕΝΟΙΚΙΟ Β2': 'Rent B2',
  'ΦΟΡΟΛΟΓΊΑ Β2': 'Tax B2',
  'Έξοδος/Βόλτα': 'Going Out',
  'Ταξίδια': 'Travel',
  'Delivery/φαγητό απέξω/γλυκά': 'Delivery/Takeout',
  'Κρεοπωλείο': 'Butcher',
  'Λαϊκή': 'Farmers Market',
  'Νερό rainbow': 'Water Rainbow',
  'Σουπερμάρκετ': 'Supermarket',
  'Tips/Προμήθειες': 'Tips/Fees',
  'Διαφήμιση': 'Advertising',
  'Μικροέξοδα': 'Petty Cash',
  'Μισθώματα Αποθήκης Ι. Σούτσου 18': 'Warehouse Rent I. Soutsou 18',
  'Στοίχημα/Καζίνο': 'Betting/Casino',
  'Βιβλία': 'Books',
  '🎁ΑΛΛΑ ΕΞΤΡΑ': '🎁 Other Extras',
  '🎁 ΑΛΛΑ ΕΞΤΡΑ': '🎁 Other Extras',
  '🏅 BONUS': '🏅 Bonus',
  '👨‍👩‍👦ΟΙΚΟΓΕΝΕΙΑ/ΒΟΗΘΕΙΑ': '👨‍👩‍👦 Family Help',
  '👨‍👩‍👦 ΟΙΚΟΓΕΝΕΙΑ/ΒΟΗΘΕΙΑ': '👨‍👩‍👦 Family Help',
  '💰ΤΟΚΟΙ/CASHBACK/ΤΡΑΠΕΖΕΣ': '💰 Interests/Cashback/Banks',
  '💰 ΤΟΚΟΙ/CASHBACK/ΤΡΑΠΕΖΕΣ': '💰 Interests/Cashback/Banks',
  '💻ΙΝΣΤΑ': '💻 Instagram',
  '💻 ΙΝΣΤΑ': '💻 Instagram',
  '📦VINTED': '📦 Vinted',
  '📦 VINTED': '📦 Vinted',
  '🧑‍🎓ΕΠΙΔΟΜΑΤΑ/ΣΕΜΙΝΑΡΙΑ': '🧑‍🎓 Allowances/Seminars',
  '🧑‍🎓 ΕΠΙΔΟΜΑΤΑ/ΣΕΜΙΝΑΡΙΑ': '🧑‍🎓 Allowances/Seminars',
  'Taxi': 'Taxi',
  'Μετρό - Λεωφορείο': 'Metro - Bus',
  'ΜΙΣΘΟΣ ΒΑΣΟΥΛΑ': 'Salary Vasoula',
  'ΜΙΣΘΟΣ ΓΡΑΦΕΙΩΝ ΒΑΣΟΥΛΑ': 'Office Salary Vasoula',
  'ΜΙΣΘΟΣ ΜΑΡΙΟΣ': 'Salary Marios',
  'Accessories': 'Accessories',
  'Makeup': 'Makeup',
  'Εσώρουχα': 'Underwear',
  'Καλλυντικά': 'Cosmetics',
  'Κομμωτήριο': 'Hair Salon',
  'Παπούτσια': 'Shoes',
  'Ρούχα': 'Clothing',
  'Τσάντες/Τσαντάκια': 'Bags',
  'Υπηρεσίες': 'Services',
  'Vodafone': 'Vodafone',
  'ΔΕΗ': 'Electricity (PPC)',
  'Έπιπλα/Διακόσμηση': 'Furniture/Decor',
  'ΕΥΔΑΠ': 'Water (EYDAP)',
  'Οικιακά Είδη': 'Household Goods',
  'Στεγαστικό Δάνειο': 'Mortgage',
  'Συντήρηση Σπιτιού': 'Home Maintenance',
  'Συσκευές Σπιτιού': 'Home Appliances',
  'Apple Music': 'Apple Music',
  'Icloud': 'iCloud',
  'Streaming': 'Streaming',
  'Διάφορες': 'Various',
  'Εφαρμογές/Appstore': 'Apps/Appstore',
  'Συνδρομές Τραπεζικών Καρτών': 'Bank Card Subscriptions',
  'ΕΝΦΙΑ': 'ENFIA (Property Tax)',
  'ΛΟΓΙΣΤΗΣ': 'Accountant',
  'ΠΑΡΑΒΟΛΑ/ΚΡΑΤΗΣΕΙΣ': 'Government Fees'
};

function isDefaultSubcategory(categoryName, subcategoryName) {
  if (!subcategoryName) return false;
  
  // Normalize categoryName to Greek default category name key
  let greekCategoryName = categoryName || '';
  if (categoryName) {
    const stripped = stripLeadingEmoji(categoryName).trim().toUpperCase();
    for (const [elKey, enVal] of Object.entries(CATEGORY_NAME_TRANSLATIONS)) {
      const strippedEl = stripLeadingEmoji(elKey).trim().toUpperCase();
      const strippedEn = stripLeadingEmoji(enVal).trim().toUpperCase();
      if (stripped === strippedEl || stripped === strippedEn) {
        greekCategoryName = elKey;
        break;
      }
    }
  }
  
  const cleanedCat = stripLeadingEmoji(greekCategoryName).trim().toUpperCase();
  const subcats = DEFAULT_SUBCATEGORIES_MAP[cleanedCat];
  const normSub = stripLeadingEmoji(subcategoryName).trim().toUpperCase();
  
  if (subcats) {
    const found = subcats.some(s => {
      return s.trim().toUpperCase() === subcategoryName.trim().toUpperCase() ||
             stripLeadingEmoji(s).trim().toUpperCase() === normSub;
    });
    if (found) return true;
  }
  
  for (const subcats of Object.values(DEFAULT_SUBCATEGORIES_MAP)) {
    const found = subcats.some(s => {
      return s.trim().toUpperCase() === subcategoryName.trim().toUpperCase() ||
             stripLeadingEmoji(s).trim().toUpperCase() === normSub;
    });
    if (found) return true;
  }
  
  return false;
}

function getSubcategoryDisplayName(subName, categoryName) {
  if (!subName) return '';
  const stripped = stripLeadingEmoji(subName).trim();
  const lang = state.lang || 'el';
  
  if (!isDefaultSubcategory(categoryName, subName)) {
    return subName; // Custom entries are never translated
  }
  
  for (const [elKey, enVal] of Object.entries(SUBCATEGORY_NAME_TRANSLATIONS)) {
    const strippedEl = stripLeadingEmoji(elKey).trim().toUpperCase();
    const strippedEn = stripLeadingEmoji(enVal).trim().toUpperCase();
    
    if (stripped.toUpperCase() === strippedEl || stripped.toUpperCase() === strippedEn) {
      const target = lang === 'en' ? enVal : elKey;
      return stripLeadingEmoji(target).trim();
    }
  }
  return subName;
}



function saveCategoriesToStorage() {
  deduplicateCategories();
  localStorage.setItem('offline_categories', JSON.stringify(state.categories));
  lastRenderedCategoryType = null;
}

// ============================================================
// TAB 2: STATS
// ============================================================
function renderStatsTab(skipChart = false) {
  const { start, end } = getStatsDateRange();
  
  // Set month/period text on the top left
  const rawStatsTitle = formatStatsPeriodTitle(start, end);
  document.getElementById('stats-period-title').innerHTML = wrapPeriodTitleWithSpans(rawStatsTitle);
  
  // Update dropdown button text
  let periodLabel = TRANSLATIONS[state.lang]['stats_period_monthly'];
  if (state.statsPeriodType === 'weekly') periodLabel = TRANSLATIONS[state.lang]['stats_period_weekly'];
  else if (state.statsPeriodType === 'annually') periodLabel = TRANSLATIONS[state.lang]['stats_period_annually'];
  else if (state.statsPeriodType === 'period') periodLabel = TRANSLATIONS[state.lang]['stats_period_custom'];
  
  document.getElementById('stats-period-dropdown-btn').innerHTML = 
    `${periodLabel} <i class="fa-solid fa-chevron-down" style="font-size: 9px; margin-left: 4px;"></i>`;
    
  // Highlight active dropdown choice
  document.querySelectorAll('.stats-dropdown-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-value') === state.statsPeriodType);
  });

  // Dynamically populate Family Member Filter Dropdown
  const familyFilterContainer = document.getElementById('stats-family-dropdown-container');
  const familyFilterMenu = document.getElementById('stats-family-dropdown-menu');
  const familyFilterBtn = document.getElementById('stats-family-dropdown-btn');

  if (state.userProfile && state.userProfile.family_id) {
    if (familyFilterContainer) familyFilterContainer.style.display = 'block';
    
    if (familyFilterMenu) {
      familyFilterMenu.innerHTML = '';
      
      const allText = state.lang === 'el' ? 'Όλη η Οικογένεια' : 'All Family';
      const allItem = document.createElement('div');
      allItem.className = 'stats-dropdown-item' + (state.selectedFamilyMemberId === 'all' ? ' active' : '');
      allItem.setAttribute('data-value', 'all');
      allItem.textContent = allText;
      allItem.addEventListener('click', (e) => {
        e.stopPropagation();
        state.selectedFamilyMemberId = 'all';
        familyFilterMenu.classList.remove('active');
        renderStatsTab();
      });
      familyFilterMenu.appendChild(allItem);
      
      const members = state.familyProfiles || [];
      members.forEach(member => {
        const isMe = member.id === state.currentUser.id;
        const meSuffix = isMe ? ` (${state.lang === 'el' ? 'Εσείς' : 'You'})` : '';
        const name = (member.display_name || member.email.split('@')[0]) + meSuffix;
        
        const item = document.createElement('div');
        item.className = 'stats-dropdown-item' + (state.selectedFamilyMemberId === member.id ? ' active' : '');
        item.setAttribute('data-value', member.id);
        item.textContent = name;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          state.selectedFamilyMemberId = member.id;
          familyFilterMenu.classList.remove('active');
          renderStatsTab();
        });
        familyFilterMenu.appendChild(item);
      });
    }
    
    if (familyFilterBtn) {
      let activeText = state.lang === 'el' ? 'Όλη η Οικογένεια' : 'All Family';
      if (state.selectedFamilyMemberId !== 'all') {
        const activeMember = (state.familyProfiles || []).find(m => m.id === state.selectedFamilyMemberId);
        if (activeMember) {
          const isMe = activeMember.id === state.currentUser.id;
          const meSuffix = isMe ? ` (${state.lang === 'el' ? 'Εσείς' : 'You'})` : '';
          activeText = (activeMember.display_name || activeMember.email.split('@')[0]) + meSuffix;
        }
      }
      familyFilterBtn.innerHTML = `${activeText} <i class="fa-solid fa-chevron-down" style="font-size: 9px; margin-left: 4px;"></i>`;
    }
  } else {
    if (familyFilterContainer) familyFilterContainer.style.display = 'none';
    state.selectedFamilyMemberId = 'all';
  }

  const walletTrans = getActiveTransactions();
  
  // Filter by selected family member
  let memberFilteredTrans = walletTrans;
  if (state.userProfile && state.userProfile.family_id && state.selectedFamilyMemberId !== 'all') {
    memberFilteredTrans = walletTrans.filter(t => t.user_id === state.selectedFamilyMemberId);
  }

  const filteredTrans = memberFilteredTrans.filter(t => {
    if (!t.date) return false;
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const tDate = new Date(datePart + 'T00:00:00');
    return tDate >= start && tDate <= end;
  });

  const monthlyIncome  = filteredTrans.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const monthlyExpense = filteredTrans.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  document.getElementById('stats-tab-income-amt').textContent  = `${getCurrencySymbol()} ${formatCurrency(monthlyIncome)}`;
  document.getElementById('stats-tab-expense-amt').textContent = `${getCurrencySymbol()} ${formatCurrency(monthlyExpense)}`;

  // Calculate and display Net Savings
  const netSavings = monthlyIncome - monthlyExpense;
  const netValEl = document.getElementById('stats-net-savings-val');
  if (netValEl) {
    netValEl.textContent = `${netSavings >= 0 ? '+' : ''}${getCurrencySymbol()} ${formatCurrency(netSavings)}`;
    netValEl.className = 'stats-net-val ' + (netSavings >= 0 ? 'positive' : 'negative');
  }

  const activeTrans = filteredTrans.filter(t => t.type === state.statsType);
  const totalSum = activeTrans.reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  const catGroups = {};
  activeTrans.forEach(t => {
    const catInfo = getCategoryInfo(t.category, t.type);
    const key = catInfo.name || t.category || (state.lang === 'el' ? 'Άλλα' : 'Other');
    if (!catGroups[key]) {
      catGroups[key] = { 
        amount: 0, 
        icon: catInfo.icon, 
        color: catInfo.color,
        subcategories: {}
      };
    }
    catGroups[key].amount += parseFloat(t.amount || 0);

    const subcatName = t.subcategory || '';
    if (!catGroups[key].subcategories[subcatName]) {
      catGroups[key].subcategories[subcatName] = 0;
    }
    catGroups[key].subcategories[subcatName] += parseFloat(t.amount || 0);
  });

  const breakdownList = Object.entries(catGroups).map(([name, d]) => ({
    name, 
    amount: d.amount, 
    percentage: totalSum > 0 ? (d.amount / totalSum) * 100 : 0,
    icon: d.icon, 
    color: d.color,
    subcategories: Object.entries(d.subcategories)
      .map(([subName, subAmt]) => ({
        name: subName,
        amount: subAmt,
        percentage: d.amount > 0 ? (subAmt / d.amount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
  })).sort((a, b) => b.amount - a.amount);

  const displayList = breakdownList;

  const listContainer = document.getElementById('stats-breakdown-list');
  listContainer.innerHTML = '';

  const centerTitleEl = document.getElementById('chart-center-title');
  const centerAmountEl = document.getElementById('chart-center-amount');
  const chartCenterVal = document.getElementById('chart-center-val');

  if (!displayList.length) {
    listContainer.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-secondary)"><h3>Δεν υπάρχουν δεδομένα</h3></div>`;
    if (!skipChart) {
      if (statsChartInstance) { statsChartInstance.destroy(); statsChartInstance = null; }
      if (chartCenterVal) chartCenterVal.style.display = 'none';
    }
    return;
  }

  // Update high tech doughnut center text
  if (!skipChart && chartCenterVal) {
    chartCenterVal.style.display = 'flex';
    if (centerTitleEl) {
      centerTitleEl.textContent = state.statsType === 'income' ? TRANSLATIONS[state.lang]['summary_income'] : TRANSLATIONS[state.lang]['summary_expense'];
    }
    if (centerAmountEl) {
      centerAmountEl.textContent = `${getCurrencySymbol()} ${formatCurrency(totalSum)}`;
    }
  }

  // Update income vs expense ratio bar
  if (!skipChart) {
    const ratioWrapper = document.getElementById('chart-ratio-wrapper');
    const ratioIncomeFill = document.getElementById('ratio-fill-income');
    const ratioExpenseFill = document.getElementById('ratio-fill-expense');
    const ratioIncomePct = document.getElementById('ratio-income-pct');
    const ratioExpensePct = document.getElementById('ratio-expense-pct');
    const totalIE = monthlyIncome + monthlyExpense;
    if (ratioWrapper && totalIE > 0) {
      ratioWrapper.style.display = 'block';
      const iPct = Math.round((monthlyIncome / totalIE) * 100);
      const ePct = 100 - iPct;
      ratioIncomeFill.style.width = iPct + '%';
      ratioExpenseFill.style.width = ePct + '%';
      ratioIncomePct.textContent = iPct + '%';
      ratioExpensePct.textContent = ePct + '%';
    } else if (ratioWrapper) {
      ratioWrapper.style.display = 'none';
    }
  }

  displayList.forEach((item, idx) => {
    const catId = `stats-cat-${idx}-${Date.now()}`;
    const row = document.createElement('div');
    row.className = 'stats-row';
    const hasSubcats = item.subcategories.length > 0 && item.subcategories.some(s => s.name);
    const catColor = NEON_PALETTE[idx % NEON_PALETTE.length];

    row.innerHTML = `
      <div class="stats-row-left">
        <span class="stats-pct-badge" style="background-color: ${catColor};">${Math.round(item.percentage)}%</span>
        <span class="stats-cat-icon">${item.icon}</span>
        <span class="stats-category-name">${getCategoryDisplayName(stripLeadingEmoji(item.name))}</span>
      </div>
      <div class="stats-row-right">${getCurrencySymbol()} ${formatCurrency(item.amount)}</div>`;
    listContainer.appendChild(row);

    if (hasSubcats) {
      const subContainer = document.createElement('div');
      subContainer.id = catId;
      subContainer.className = 'stats-subcategories-container';

      // Restore expanded state if previously expanded
      const isExpanded = state.expandedStatsCategories.has(item.name);
      if (isExpanded) {
        row.classList.add('expanded');
        subContainer.classList.add('active');
      }

      item.subcategories.forEach(sub => {
        const subDisplayName = sub.name ? getSubcategoryDisplayName(sub.name, item.name) : (state.lang === 'el' ? 'Χωρίς υποκατηγορία' : 'Uncategorized');
        const subRow = document.createElement('div');
        subRow.className = 'stats-sub-row';
        
        // Dynamically style subcategory percentage with parent category theme color (low opacity fill + solid text/border)
        subRow.innerHTML = `
          <div class="stats-sub-left">
            <span class="stats-sub-pct" style="background-color: ${catColor}26; color: ${catColor}; border: 1px solid ${catColor}33;">${Math.round(sub.percentage)}%</span>
            <span class="stats-sub-name">${subDisplayName}</span>
          </div>
          <div class="stats-sub-right">${getCurrencySymbol()} ${formatCurrency(sub.amount)}</div>
        `;
        
        let subFeedbackTimer;
        let subTouchStartX = 0;
        let subTouchStartY = 0;
        let subTouchMoved = false;

        subRow.addEventListener('touchstart', (e) => {
          subTouchMoved = false;
          const touch = e.touches[0];
          subTouchStartX = touch.clientX;
          subTouchStartY = touch.clientY;

          clearTimeout(subFeedbackTimer);
          subFeedbackTimer = setTimeout(() => {
            if (!subTouchMoved && !state.isSwipingMonth) {
              subRow.classList.add('pressed');
            }
          }, 100);
        }, { passive: true });

        subRow.addEventListener('touchmove', (e) => {
          const touch = e.touches[0];
          const dx = touch.clientX - subTouchStartX;
          const dy = touch.clientY - subTouchStartY;
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            subTouchMoved = true;
            clearTimeout(subFeedbackTimer);
            subRow.classList.remove('pressed');
          }
        }, { passive: true });

        subRow.addEventListener('touchend', (e) => {
          clearTimeout(subFeedbackTimer);
          subRow.classList.remove('pressed');
          if (state.isSwipingMonth || subTouchMoved) {
            if (e.cancelable) e.preventDefault();
          }
        }, { passive: false });

        subRow.addEventListener('touchcancel', () => {
          clearTimeout(subFeedbackTimer);
          subRow.classList.remove('pressed');
        });

        subRow.addEventListener('click', (e) => {
          e.stopPropagation();
          if (state.isSwipingMonth || subTouchMoved || (Date.now() - state.lastSwipeTime < 1500)) {
            return;
          }
          openStatsTransactionsModal(item.name, sub.name);
        });

        subContainer.appendChild(subRow);
      });

      listContainer.appendChild(subContainer);

      let rowFeedbackTimer;
      let rowTouchStartX = 0;
      let rowTouchStartY = 0;
      let rowTouchMoved = false;

      row.addEventListener('touchstart', (e) => {
        rowTouchMoved = false;
        const touch = e.touches[0];
        rowTouchStartX = touch.clientX;
        rowTouchStartY = touch.clientY;

        clearTimeout(rowFeedbackTimer);
        rowFeedbackTimer = setTimeout(() => {
          if (!rowTouchMoved && !state.isSwipingMonth) {
            row.classList.add('pressed');
          }
        }, 100);
      }, { passive: true });

      row.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        const dx = touch.clientX - rowTouchStartX;
        const dy = touch.clientY - rowTouchStartY;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          rowTouchMoved = true;
          clearTimeout(rowFeedbackTimer);
          row.classList.remove('pressed');
        }
      }, { passive: true });

      row.addEventListener('touchend', (e) => {
        clearTimeout(rowFeedbackTimer);
        row.classList.remove('pressed');
        if (state.isSwipingMonth || rowTouchMoved) {
          if (e.cancelable) e.preventDefault();
        }
      }, { passive: false });

      row.addEventListener('touchcancel', () => {
        clearTimeout(rowFeedbackTimer);
        row.classList.remove('pressed');
      });

      row.addEventListener('click', () => {
        if (state.isSwipingMonth || rowTouchMoved || (Date.now() - state.lastSwipeTime < 1500)) {
          return;
        }
        const expanded = row.classList.toggle('expanded');
        subContainer.classList.toggle('active', expanded);
        if (expanded) {
          state.expandedStatsCategories.add(item.name);
        } else {
          state.expandedStatsCategories.delete(item.name);
        }
      });
    }
  });

  if (state.activeTab === 'stats' && !skipChart) {
    renderChart(displayList);
  }

  if (state.activeSubcategoryTransactions) {
    renderSubcategoryTransactions(state.activeSubcategoryTransactions.category, state.activeSubcategoryTransactions.subcategory);
  }
}

function openStatsTransactionsModal(category, subcategory) {
  state.activeSubcategoryTransactions = { category, subcategory };
  renderSubcategoryTransactions(category, subcategory);
  openModal('stats-transactions-modal');
}

function closeStatsTransactionsModal() {
  state.activeSubcategoryTransactions = null;
  closeModal('stats-transactions-modal');
}

function renderSubcategoryTransactions(category, subcategory) {
  const titleEl = document.getElementById('stats-transactions-title');
  const listContainer = document.getElementById('stats-transactions-list');
  if (!listContainer) return;

  const subDisplayName = subcategory ? getSubcategoryDisplayName(subcategory, category) : (state.lang === 'el' ? 'Χωρίς υποκατηγορία' : 'Uncategorized');
  const catDisplayName = getCategoryDisplayName(category);
  if (titleEl) {
    titleEl.textContent = `${catDisplayName} · ${subDisplayName}`;
  }

  listContainer.innerHTML = '';

  const { start, end } = getStatsDateRange();
  const walletTrans = getActiveTransactions();
  
  let memberFilteredTrans = walletTrans;
  if (state.userProfile && state.userProfile.family_id && state.selectedFamilyMemberId !== 'all') {
    memberFilteredTrans = walletTrans.filter(t => t.user_id === state.selectedFamilyMemberId);
  }

  const periodTrans = memberFilteredTrans.filter(t => {
    if (!t.date) return false;
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const tDate = new Date(datePart + 'T00:00:00');
    return tDate >= start && tDate <= end;
  });

  const subcatTrans = periodTrans.filter(t => {
    if (t.type !== state.statsType) return false;
    
    const catInfo = getCategoryInfo(t.category, t.type);
    const catName = catInfo.name || t.category || (state.lang === 'el' ? 'Άλλα' : 'Other');
    if (catName.toUpperCase() !== category.toUpperCase()) return false;
    
    const tSub = t.subcategory || '';
    return tSub.toUpperCase() === subcategory.toUpperCase();
  }).sort(compareTransactions);

  if (subcatTrans.length === 0) {
    closeStatsTransactionsModal();
    return;
  }

  subcatTrans.forEach(t => {
    const catInfo = getCategoryInfo(t.category, t.type);
    const item = document.createElement('div');
    item.className = 'transaction-item';
    
    let modalTouchStartX = 0;
    let modalTouchStartY = 0;
    let modalTouchMoved = false;
    let modalFeedbackTimer;

    item.addEventListener('touchstart', (e) => {
      modalTouchMoved = false;
      const touch = e.touches[0];
      modalTouchStartX = touch.clientX;
      modalTouchStartY = touch.clientY;

      clearTimeout(modalFeedbackTimer);
      modalFeedbackTimer = setTimeout(() => {
        if (!modalTouchMoved && !state.isSwipingMonth) {
          item.classList.add('pressed');
        }
      }, 100);
    }, { passive: true });

    item.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const dx = touch.clientX - modalTouchStartX;
      const dy = touch.clientY - modalTouchStartY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        modalTouchMoved = true;
        clearTimeout(modalFeedbackTimer);
        item.classList.remove('pressed');
      }
    }, { passive: true });

    item.addEventListener('touchend', (e) => {
      clearTimeout(modalFeedbackTimer);
      item.classList.remove('pressed');
      if (state.isSwipingMonth || modalTouchMoved) {
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    item.addEventListener('touchcancel', () => {
      clearTimeout(modalFeedbackTimer);
      item.classList.remove('pressed');
    });

    item.onclick = () => {
      if (state.isSwipingMonth || modalTouchMoved || (Date.now() - state.lastSwipeTime < 1500)) return;
      openEditTransactionModal(t);
    };

    let amountClass = 'trans-amount';
    let accountText = t.account_from ? getAccountDisplayName(t.account_from) : '';
    if (t.type === 'expense')       { amountClass += ' expense'; }
    else if (t.type === 'income')   { amountClass += ' income'; }
    else if (t.type === 'transfer') {
      const fromDisp = getAccountDisplayName(t.account_from);
      const toDisp = getAccountDisplayName(t.account_to);
      amountClass += ' transfer';
      accountText = `${fromDisp} → ${toDisp}`;
    }

    const translatedSub = getSubcategoryDisplayName(t.subcategory, t.category);
    const translatedCat = getCategoryDisplayName(t.category);
    const displayTitle = (t.note && t.note.trim()) ? t.note.trim()
                       : (t.description && t.description.trim()) ? t.description.trim()
                       : (translatedSub && translatedSub.trim()) ? translatedSub.trim()
                       : (translatedCat || '');
    
    const memberBadge = getMemberBadgeHTML(t);
    
    // Format short date
    let dateLabel = '';
    if (t.date) {
      const datePart = String(t.date).split('T')[0].split(' ')[0];
      const [y, m, d] = datePart.split('-');
      dateLabel = `${d}/${m}/${y.substring(2)}`;
    }

    item.innerHTML = `
      <div class="trans-left">
        <div class="trans-category-container">
          <div class="trans-cat-icon">${catInfo.icon || '💰'}</div>
        </div>
        <div class="trans-details">
          <span class="trans-title">${displayTitle}${memberBadge}</span>
          <span class="trans-acc-label">${dateLabel} · ${accountText}</span>
        </div>
      </div>
      <div class="${amountClass}">${getCurrencySymbol()} ${formatCurrency(t.amount)}</div>`;
    listContainer.appendChild(item);
  });
}

window.openStatsTransactionsModal = openStatsTransactionsModal;
window.closeStatsTransactionsModal = closeStatsTransactionsModal;

function renderChart(dataList) {
  const ctx = document.getElementById('statsChart').getContext('2d');
  if (statsChartInstance) statsChartInstance.destroy();

  // Assign neon colors preserving original category color hints
  const colors = dataList.map((d, i) => NEON_PALETTE[i % NEON_PALETTE.length]);

  // Build gradient-aware colors for glow effect
  const bgColors = colors.map(c => c);
  const hoverColors = colors.map(c => c + 'dd');

  statsChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: dataList.map(d => `${d.icon} ${getCategoryDisplayName(d.name)}`),
      datasets: [{
        data: dataList.map(d => d.amount),
        backgroundColor: bgColors,
        hoverBackgroundColor: hoverColors,
        borderWidth: 2,
        borderColor: 'rgba(15,18,28,0.9)',
        borderRadius: 6,
        spacing: 4,
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      animation: {
        animateRotate: true,
        animateScale: false,
        duration: 700,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,18,28,0.97)',
          titleFont: { family: 'Outfit', size: 13, weight: '800' },
          bodyFont: { family: 'Inter', size: 13, weight: '600' },
          padding: 14,
          cornerRadius: 14,
          borderColor: 'rgba(99,102,241,0.4)',
          borderWidth: 1,
          displayColors: true,
          boxWidth: 10,
          boxHeight: 10,
          boxPadding: 4,
          callbacks: {
            label: ctx => {
              const val = ctx.raw;
              const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = sum > 0 ? Math.round((val / sum) * 100) : 0;
              return `  ${getCurrencySymbol()} ${formatCurrency(val)}  (${pct}%)`;
            }
          }
        },
        datalabels: { display: false }
      }
    }
  });

  // Also update the stats breakdown list colors to match neon palette
  const rows = document.querySelectorAll('.stats-pct-badge');
  rows.forEach((badge, i) => {
    badge.style.background = colors[i % colors.length];
    badge.style.boxShadow = `0 0 8px ${colors[i % colors.length]}60`;
  });
}

// ============================================================
// TAB 3: ACCOUNTS
// ============================================================
function renderAccountsTab() {
  const assetsEl = document.getElementById('accounts-assets-list');
  const liabEl   = document.getElementById('accounts-liabilities-list');
  
  if (assetsEl) assetsEl.innerHTML = '';
  if (liabEl) liabEl.innerHTML = '';

  // Restore collapsible list preferences
  ['income', 'expense'].forEach(type => {
    const isExpanded = localStorage.getItem(`overview_collapse_${type}`) === 'expanded'; // default to false (collapsed)
    const content = document.getElementById(type === 'income' ? 'accounts-assets-list' : 'accounts-liabilities-list');
    const icon = document.getElementById(type === 'income' ? 'collapse-icon-income' : 'collapse-icon-expense');
    if (content && icon) {
      content.classList.toggle('active', isExpanded);
      icon.classList.toggle('active', isExpanded);
    }
  });

  // 1. Calculate current year history values from transactions (excluding transfers)
  const activeTrans = getActiveTransactions();
  const currentYearOverview = state.overviewYear || new Date().getFullYear();
  
  const nonTransferTrans = activeTrans.filter(t => {
    if (t.type === 'transfer' || t.category?.toLowerCase().includes('μεταφ') || t.category?.toLowerCase().includes('transfer')) return false;
    if (!t.date) return false;
    const y = parseInt(String(t.date).split('T')[0].split('-')[0], 10);
    return y === currentYearOverview;
  });
  
  let overallMinDate = null;
  let overallMaxDate = null;
  let overallIncome = 0;
  let overallExpense = 0;

  nonTransferTrans.forEach(t => {
    if (!t.date) return;
    if (!overallMinDate || t.date < overallMinDate) overallMinDate = t.date;
    if (!overallMaxDate || t.date > overallMaxDate) overallMaxDate = t.date;

    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') {
      overallIncome += amt;
    } else if (t.type === 'expense') {
      overallExpense += amt;
    }
  });

  const overallNet = overallIncome - overallExpense;

  const titleEl = document.getElementById('dynamic-overview-title');
  if (titleEl) {
    titleEl.textContent = state.lang === 'el' ? 'ΕΠΙΣΚΟΠΗΣΗ' : 'OVERVIEW';
  }
  const subtitleEl = document.getElementById('dynamic-overview-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = state.lang === 'el' ? `Έτος ${currentYearOverview}` : `Year ${currentYearOverview}`;
  }

  // Set selected year title
  const yearTitleEl = document.getElementById('overview-year-title');
  if (yearTitleEl) {
    yearTitleEl.textContent = currentYearOverview;
  }

  // 2. Set the overall history period (From 01/01/YYYY to today)
  const overallDatesEl = document.getElementById('overall-history-dates');
  const overallMathEl = document.getElementById('overall-history-math');

  if (overallDatesEl) {
    overallDatesEl.textContent = state.lang === 'el' ? `Περίοδος: 01/01/${currentYearOverview} - Σήμερα` : `Period: 01/01/${currentYearOverview} - Today`;
  }

  if (overallMathEl) {
    overallMathEl.style.display = 'none';
  }

  // 3. Populate the top card overall columns (Income, Expenses, Net Balance)
  document.getElementById('total-assets-val').textContent      = formatCurrency(overallIncome);
  document.getElementById('total-liabilities-val').textContent = formatCurrency(overallExpense);
  const netElContainer = document.getElementById('total-net-val-container');
  const netEl = document.getElementById('total-net-val');
  if (netEl) netEl.textContent = formatCurrency(overallNet);
  if (netElContainer) {
    netElContainer.className = overallNet >= 0 ? 'overview-val' : 'overview-val negative';
  }

  // --- FINANCIAL HEALTH SCORE CALCULATIONS & RENDERING ---
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const hasHistoricalData = activeTrans.some(t => {
    if (!t.date || t.type === 'transfer') return false;
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    // Only check historical months within the current calendar year to prevent score dilution
    return y === currentYear && m < currentMonth;
  });

  const fhs = calculateFinancialHealthScore(activeTrans, state.accounts, hasHistoricalData);
  state.currentFhs = fhs; // Save globally so click listeners can read it

  const scoreEl = document.getElementById('fhs-score-value');
  const labelEl = document.getElementById('fhs-label');
  const hintEl = document.getElementById('fhs-hint');
  
  const scoreStr = typeof fhs.score === 'number' ? fhs.score.toFixed(1) + '%' : fhs.score;
  if (scoreEl) scoreEl.textContent = scoreStr;
  if (labelEl) labelEl.textContent = fhs.label;
  if (hintEl) {
    if (fhs.isTemporary) {
      hintEl.textContent = state.lang === 'el' 
        ? 'Προσωρινό σκορ βάσει των πρώτων δεδομένων' 
        : 'Temporary score based on initial data';
    } else {
      hintEl.textContent = state.lang === 'el'
        ? 'Βασίζεται στο ρυθμό αποταμίευσης και το ταμείο έκτακτης ανάγκης'
        : 'Based on savings rate and emergency fund';
    }
  }

  // Update modal contents dynamically
  const modalScoreCircle = document.getElementById('fhs-modal-score-circle');
  const modalScoreLabel = document.getElementById('fhs-modal-score-label');
  const modalScoreValText = document.getElementById('fhs-modal-score-val-text');
  
  if (modalScoreValText) {
    modalScoreValText.textContent = scoreStr;
  } else if (modalScoreCircle) {
    modalScoreCircle.textContent = scoreStr;
  }
  if (modalScoreLabel) modalScoreLabel.textContent = fhs.label;
  
  const savingsValEl = document.getElementById('fhs-breakdown-savings-val');
  const savingsBarEl = document.getElementById('fhs-breakdown-savings-bar');
  const savingsDescEl = document.getElementById('fhs-breakdown-savings-desc');
  if (savingsValEl) savingsValEl.textContent = `${fhs.weightedSavings.toFixed(1)} / 40`;
  if (savingsBarEl) savingsBarEl.style.width = `${fhs.savingsRateScore}%`;
  if (savingsDescEl) {
    const srPct = Math.round(fhs.savingsRate * 1000) / 10;
    savingsDescEl.textContent = state.lang === 'el'
      ? `Τρέχων ρυθμός αποταμίευσης: ${srPct}% (Στόχος: >20% για καλό σκορ, 40% για άριστο)`
      : `Current savings rate: ${srPct}% (Target: >20% for good, 40% for perfect)`;
  }
  
  const emergencyValEl = document.getElementById('fhs-breakdown-emergency-val');
  const emergencyBarEl = document.getElementById('fhs-breakdown-emergency-bar');
  const emergencyDescEl = document.getElementById('fhs-breakdown-emergency-desc');
  if (emergencyValEl) emergencyValEl.textContent = `${fhs.weightedEmergency.toFixed(1)} / 40`;
  if (emergencyBarEl) emergencyBarEl.style.width = `${fhs.emergencyFundScore}%`;
  if (emergencyDescEl) {
    const survVal = Math.round((fhs.survivalRunway || 0) * 10) / 10;
    const lifeVal = Math.round((fhs.lifestyleRunway || 0) * 10) / 10;
    const survColor = survVal >= 6 ? '#66bb6a' : (survVal >= 3 ? '#ffa726' : '#ff5b5b');
    const lifeColor = lifeVal >= 6 ? '#66bb6a' : (lifeVal >= 3 ? '#ffa726' : '#ff5b5b');
    
    if (state.lang === 'el') {
      emergencyDescEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px; font-size: 11px; line-height: 1.4;">
          <div>🚨 <strong>Βασική Επιβίωση:</strong> <span style="color: ${survColor}; font-weight: 700;">${survVal.toFixed(1)} μήνες</span> <span style="color: var(--text-secondary); font-size: 9.5px;">(Αν κόψεις τα πάντα)</span></div>
          <div>🛒 <strong>Τρέχουσα Ζωή:</strong> <span style="color: ${lifeColor}; font-weight: 700;">${lifeVal.toFixed(1)} μήνες</span> <span style="color: var(--text-secondary); font-size: 9.5px;">(Αν συνεχίσεις όπως τώρα)</span></div>
        </div>
      `;
    } else {
      emergencyDescEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px; font-size: 11px; line-height: 1.4;">
          <div>🚨 <strong>Basic Survival:</strong> <span style="color: ${survColor}; font-weight: 700;">${survVal.toFixed(1)} months</span> <span style="color: var(--text-secondary); font-size: 9.5px;">(If you cut everything)</span></div>
          <div>🛒 <strong>Current Lifestyle:</strong> <span style="color: ${lifeColor}; font-weight: 700;">${lifeVal.toFixed(1)} months</span> <span style="color: var(--text-secondary); font-size: 9.5px;">(If you continue as now)</span></div>
        </div>
      `;
    }
  }
  
  const trendValEl = document.getElementById('fhs-breakdown-trend-val');
  const trendBarEl = document.getElementById('fhs-breakdown-trend-bar');
  const trendDescEl = document.getElementById('fhs-breakdown-trend-desc');
  if (trendValEl) trendValEl.textContent = `${fhs.weightedTrend.toFixed(1)} / 20`;
  if (trendBarEl) trendBarEl.style.width = `${fhs.expenseTrendScore}%`;
  if (trendDescEl) {
    if (fhs.isTemporary) {
      trendDescEl.textContent = state.lang === 'el'
        ? `Προσωρινό σκορ λόγω έλλειψης ιστορικού προηγούμενου μήνα.`
        : `Temporary score due to lack of previous month history.`;
    } else {
      trendDescEl.textContent = state.lang === 'el'
        ? `Βασίζεται στη σύγκριση των εξόδων αυτού του μήνα με τον προηγούμενο.`
        : `Based on comparison of this month's expenses with the previous.`;
    }
  }

  // Update collapsible explainability section details
  const explainLiquidEl = document.getElementById('fhs-explain-liquid-balance');
  const explainSurvivalEl = document.getElementById('fhs-explain-survival-months');
  const explainLifestyleEl = document.getElementById('fhs-explain-lifestyle-months');
  
  if (explainLiquidEl) {
    explainLiquidEl.textContent = formatCurrency(fhs.liquidBalance || 0);
  }
  if (explainSurvivalEl) {
    const survVal = Math.round((fhs.survivalRunway || 0) * 10) / 10;
    explainSurvivalEl.textContent = state.lang === 'el' ? `${survVal.toFixed(1)} μήνες` : `${survVal.toFixed(1)} months`;
  }
  if (explainLifestyleEl) {
    const lifeVal = Math.round((fhs.lifestyleRunway || 0) * 10) / 10;
    explainLifestyleEl.textContent = state.lang === 'el' ? `${lifeVal.toFixed(1)} μήνες` : `${lifeVal.toFixed(1)} months`;
  }

  // Populate dynamic bullet points explaining the score
  const bulletsEl = document.getElementById('fhs-explain-bullets');
  if (bulletsEl) {
    bulletsEl.innerHTML = '';
    
    const srPct = Math.round((fhs.savingsRate || 0) * 1000) / 10;
    const wSavings = (fhs.weightedSavings || 0).toFixed(1);
    const wEmergency = (fhs.weightedEmergency || 0).toFixed(1);
    const wTrend = (fhs.weightedTrend || 0).toFixed(1);
    const mc = (fhs.monthsCovered || 0).toFixed(1);
    
    let bullet1 = '';
    let bullet2 = '';
    let bullet3 = '';
    
    if (state.lang === 'el') {
      bullet1 = `<li>📈 <strong>Δείκτης Αποταμίευσης:</strong> Αποταμιεύσατε το <strong>${srPct}%</strong> των εσόδων σας, λαμβάνοντας <strong>${wSavings} / 40</strong> πόντους.</li>`;
      bullet2 = `<li>🛡️ <strong>Ταμείο Έκτακτης Ανάγκης:</strong> Το διαθέσιμο υπόλοιπό σας καλύπτει <strong>${mc}</strong> μήνες τρέχουσας ζωής (Στόχος: 6+ μήνες), λαμβάνοντας <strong>${wEmergency} / 40</strong> πόντους.</li>`;
      
      if (fhs.isTemporary) {
        bullet3 = `<li>📊 <strong>Τάση Εξόδων:</strong> Προσωρινό σκορ <strong>${wTrend} / 20</strong> λόγω έλλειψης ιστορικού προηγούμενου μήνα.</li>`;
      } else {
        const trendText = fhs.expenseTrendScore >= 100 
          ? 'είναι χαμηλότερα από ή ίσα με τον προηγούμενο μήνα' 
          : 'αυξήθηκαν σε σχέση με τον προηγούμενο μήνα';
        bullet3 = `<li>📊 <strong>Τάση Εξόδων:</strong> Τα έξοδά σας ${trendText}, λαμβάνοντας <strong>${wTrend} / 20</strong> πόντους.</li>`;
      }
    } else {
      bullet1 = `<li>📈 <strong>Savings Rate:</strong> You saved <strong>${srPct}%</strong> of your income, receiving <strong>${wSavings} / 40</strong> points.</li>`;
      bullet2 = `<li>🛡️ <strong>Emergency Fund:</strong> Your balance covers <strong>${mc}</strong> months of lifestyle expenses (Target: 6+ months), receiving <strong>${wEmergency} / 40</strong> points.</li>`;
      
      if (fhs.isTemporary) {
        bullet3 = `<li>📊 <strong>Expense Trend:</strong> Temporary score <strong>${wTrend} / 20</strong> due to lack of previous month history.</li>`;
      } else {
        const trendText = fhs.expenseTrendScore >= 100 
          ? 'are lower than or equal to the previous month' 
          : 'increased compared to the previous month';
        bullet3 = `<li>📊 <strong>Expense Trend:</strong> Your expenses ${trendText}, receiving <strong>${wTrend} / 20</strong> points.</li>`;
      }
    }
    
    bulletsEl.innerHTML = bullet1 + bullet2 + bullet3;
  }

  // --- SPENDING ADVISOR LOGIC ---
  const todayDate = new Date();
  const currYear = todayDate.getFullYear();
  const currMonth = todayDate.getMonth(); // 0-11
  
  const prevMonthDate = new Date(currYear, currMonth - 1, 1);
  const prevYearNum = prevMonthDate.getFullYear();
  const prevMonthNum = prevMonthDate.getMonth();

  const currMonthExpenses = {};
  const prevMonthExpenses = {};

  activeTrans.forEach(t => {
    if (t.type !== 'expense' || !t.date) return;
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const amt = parseFloat(t.amount) || 0;
    const cat = t.category || '';

    if (y === currYear && m === currMonth) {
      currMonthExpenses[cat] = (currMonthExpenses[cat] || 0) + amt;
    } else if (y === prevYearNum && m === prevMonthNum) {
      prevMonthExpenses[cat] = (prevMonthExpenses[cat] || 0) + amt;
    }
  });

  // Calculate MoM increases
  let maxIncreaseCat = null;
  let maxIncreaseAmt = 0;

  Object.keys(currMonthExpenses).forEach(cat => {
    const currAmt = currMonthExpenses[cat] || 0;
    const prevAmt = prevMonthExpenses[cat] || 0;
    const diff = currAmt - prevAmt;
    if (diff > maxIncreaseAmt) {
      maxIncreaseAmt = diff;
      maxIncreaseCat = cat;
    }
  });

  let advisorText = '';
  const advisorEl = document.getElementById('advisor-text');
  const cardEl = document.getElementById('advisor-card');
  const chevronEl = document.getElementById('advisor-chevron');
  const expandedContentEl = document.getElementById('advisor-expanded-content');
  
  if (maxIncreaseCat && maxIncreaseAmt > 0) {
    const prevAmt = prevMonthExpenses[maxIncreaseCat] || 0;
    const pctVal = prevAmt > 0 ? Math.round((maxIncreaseAmt / prevAmt) * 100) : null;
    const pctStr = pctVal !== null ? `${pctVal}%` : '';

    // Clean emojis from category name for advice matching
    const cleanCat = maxIncreaseCat.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim().toUpperCase();

    // Map keywords to advice
    let grConsequence = "θα μειώσει το ποσοστό αποταμίευσής σου";
    let grAdvice = "έλεγξε τις επιμέρους συναλλαγές για να εντοπίσεις πού οφείλεται η αύξηση";
    let enConsequence = "will lower your savings rate";
    let enAdvice = "review individual transactions to identify what drove the increase";

    if (cleanCat.includes('ΣΠΙΤΙ') || cleanCat.includes('HOME') || cleanCat.includes('HOUSE')) {
      grConsequence = "θα επιβαρύνει σημαντικά τις σταθερές σου υποχρεώσεις";
      grAdvice = "προσπάθησε να ελέγξεις την κατανάλωση ρεύματος/θέρμανσης ή να συγκρίνεις παρόχους";
      enConsequence = "will heavily weigh on your fixed obligations";
      enAdvice = "try checking electricity/heating usage or compare utility providers";
    } else if (cleanCat.includes('ΔΙΑΤΡΟΦΗ') || cleanCat.includes('SUPERMARKET') || cleanCat.includes('MARKET') || cleanCat.includes('FOOD')) {
      grConsequence = "θα επηρεάσει άμεσα το μηνιαίο σου δείκτη αποταμίευσης";
      grAdvice = "σκέψου να προγραμματίσεις τα γεύματα της εβδομάδας (meal prep) ή να περιορίσεις 1-2 παραγγελίες delivery";
      enConsequence = "will directly affect your monthly savings rate";
      enAdvice = "consider planning your weekly meals (meal prep) or cutting 1-2 delivery orders";
    } else if (cleanCat.includes('ΑΥΤΟΚΙΝΗΤΟ') || cleanCat.includes('CAR') || cleanCat.includes('ΜΕΤΑΚΙΝΗΣΗ') || cleanCat.includes('TRANSPORT')) {
      grConsequence = "θα αυξήσει τα πάγια έξοδα μετακίνησής σου";
      grAdvice = "προσπάθησε να ομαδοποιήσεις τις διαδρομές σου ή να επιλέξεις εναλλακτικούς τρόπους μετακίνησης όπου είναι εφικτό";
      enConsequence = "will increase your fixed transportation costs";
      enAdvice = "try bundling your trips or using alternative transportation methods where possible";
    } else if (cleanCat.includes('ΔΙΑΣΚΕΔΑΣΗ') || cleanCat.includes('ΕΞΟΔΟΙ') || cleanCat.includes('ENTERTAINMENT') || cleanCat.includes('LEISURE')) {
      grConsequence = "μειώνει γρήγορα το διαθέσιμο υπόλοιπό σου για αποταμίευση";
      grAdvice = "θέσε ένα σαφές εβδομαδιαίο όριο εξόδων για τις εξόδους σου αυτόν τον μήνα";
      enConsequence = "quickly depletes your available balance for savings";
      enAdvice = "set a clear weekly spending limit for your outings this month";
    } else if (cleanCat.includes('ΠΡΟΣΩΠΙΚΗ') || cleanCat.includes('ΦΡΟΝΤΙΔΑ') || cleanCat.includes('SHOPPING') || cleanCat.includes('CLOTHES') || cleanCat.includes('PERSONAL')) {
      grConsequence = "θα στερήσει πόρους από τους μελλοντικούς σου στόχους";
      grAdvice = "κάνε μια λίστα με τα απολύτως απαραίτητα πριν τις επόμενες αγορές σου και απόφυγε τις παρορμητικές αγορές";
      enConsequence = "will drain resources from your future goals";
      enAdvice = "make a list of absolute essentials before your next purchase and avoid impulsive buying";
    } else if (cleanCat.includes('ΤΕΧΝΟΛΟΓΙΑ') || cleanCat.includes('TECH') || cleanCat.includes('GADGET')) {
      grConsequence = "δημιουργεί μια προσωρινή αλλά μεγάλη πίεση στο ταμείο σου";
      grAdvice = "απόφυγε νέες αγορές τεχνολογίας αυτόν τον μήνα και προτίμησε να αποσβέσεις την τρέχουσα αγορά";
      enConsequence = "creates temporary but high pressure on your funds";
      enAdvice = "avoid new tech purchases this month and allow your current spending to amortize";
    } else if (cleanCat.includes('ΣΥΝΔΡΟΜΕΣ') || cleanCat.includes('SUBSCRIPTION')) {
      grConsequence = "δημιουργεί αθόρυβη, μόνιμη διαρροή χρημάτων";
      grAdvice = "έλεγξε ποιες συνδρομές δεν χρησιμοποιείς συχνά και κάνε προσωρινή ακύρωση/διακοπή";
      enConsequence = "creates a quiet, permanent money leak";
      enAdvice = "review which subscriptions you don't use regularly and cancel/pause them";
    } else if (cleanCat.includes('ΓΥΜΝΑΣΤΗΡΙΟ') || cleanCat.includes('GYM') || cleanCat.includes('ΥΓΕΙΑ') || cleanCat.includes('HEALTH')) {
      grConsequence = "είναι επένδυση, αλλά επηρεάζει τη βραχυπρόθεσμη ρευστότητά σου";
      grAdvice = "αξιολόγησε αν υπάρχουν πιο οικονομικά πακέτα συνδρομών ή οικογενειακά προγράμματα";
      enConsequence = "is an investment, but impacts your short-term liquidity";
      enAdvice = "evaluate if there are cheaper subscription packages or family plans";
    }

    if (state.lang === 'el') {
      const pctPart = pctStr ? ` κατά **${pctStr}**` : '';
      advisorText = `Τα έξοδα στην κατηγορία **${maxIncreaseCat}** ανέβηκαν${pctPart} (+${formatCurrency(maxIncreaseAmt)}) αυτόν τον μήνα. Αν συνεχιστεί, ${grConsequence} — ${grAdvice}.`;
    } else {
      const pctPart = pctStr ? ` by **${pctStr}**` : '';
      advisorText = `Expenses in **${maxIncreaseCat}** rose${pctPart} (+${formatCurrency(maxIncreaseAmt)}) this month. If this continues, it ${enConsequence} — ${enAdvice}.`;
    }

    // Enable interaction
    if (cardEl) {
      cardEl.classList.add('interactive');
      cardEl.onclick = () => {
        const isExpanded = cardEl.classList.toggle('expanded');
        if (chevronEl) {
          chevronEl.classList.toggle('rotated', isExpanded);
        }
      };
    }
    if (chevronEl) {
      chevronEl.style.display = 'inline-block';
    }

    // Populate Top 3 Transactions list
    const currentMonthTrans = activeTrans.filter(t => {
      if (t.type !== 'expense' || !t.date || t.category !== maxIncreaseCat) return false;
      const datePart = String(t.date || '').split('T')[0].split(' ')[0];
      const parts = datePart.split('-');
      if (parts.length !== 3) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      return y === currYear && m === currMonth;
    });

    const topTrans = currentMonthTrans
      .sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))
      .slice(0, 3);

    const topTransListEl = document.getElementById('advisor-top-transactions-list');
    const transSectionEl = document.getElementById('advisor-transactions-section');
    if (topTransListEl && transSectionEl) {
      if (topTrans.length > 0) {
        transSectionEl.style.display = 'block';
        topTransListEl.innerHTML = topTrans.map(t => {
          const dateObj = new Date(t.date);
          const formattedDate = dateObj.toLocaleDateString(state.lang === 'el' ? 'el-GR' : 'en-US', { day: '2-digit', month: '2-digit' });
          
          const translatedSub = getSubcategoryDisplayName(t.subcategory, t.category);
          const translatedCat = getCategoryDisplayName(t.category);
          const displayTitle = (t.note && t.note.trim()) ? t.note.trim()
                             : (t.description && t.description.trim()) ? t.description.trim()
                             : (translatedSub && translatedSub.trim()) ? translatedSub.trim()
                             : (translatedCat || '');
          
          return `
            <div class="advisor-trans-row">
              <span class="advisor-trans-desc">${formattedDate} - ${displayTitle}</span>
              <span class="advisor-trans-amount">${formatCurrency(t.amount)}</span>
            </div>
          `;
        }).join('');
      } else {
        transSectionEl.style.display = 'none';
        topTransListEl.innerHTML = '';
      }
    }

    // Populate Month comparison bars
    const currAmt = currMonthExpenses[maxIncreaseCat] || 0;
    const maxVal = Math.max(prevAmt, currAmt, 1);
    const prevPct = Math.round((prevAmt / maxVal) * 100);
    const currPct = Math.round((currAmt / maxVal) * 100);

    const barsEl = document.getElementById('advisor-comparison-bars');
    if (barsEl) {
      const prevLabel = state.lang === 'el' ? 'Προηγούμενος' : 'Previous';
      const currLabel = state.lang === 'el' ? 'Τρέχων' : 'Current';
      
      barsEl.innerHTML = `
        <div class="advisor-bar-row previous">
          <span class="advisor-bar-label">${prevLabel}</span>
          <div class="advisor-bar-container">
            <div class="advisor-bar" style="width: ${prevPct}%;"></div>
          </div>
          <span class="advisor-bar-val">${formatCurrency(prevAmt)}</span>
        </div>
        <div class="advisor-bar-row current">
          <span class="advisor-bar-label">${currLabel}</span>
          <div class="advisor-bar-container">
            <div class="advisor-bar" style="width: ${currPct}%;"></div>
          </div>
          <span class="advisor-bar-val">${formatCurrency(currAmt)}</span>
        </div>
      `;
    }

    // Setup action button
    const actionBtn = document.getElementById('advisor-action-btn');
    if (actionBtn) {
      actionBtn.onclick = (e) => {
        e.stopPropagation();
        const catFilter = document.getElementById('search-filter-category');
        if (catFilter) {
          catFilter.value = maxIncreaseCat;
          handleSearchChange();
        }
        switchTab('trans');
      };
    }
  } else {
    advisorText = state.lang === 'el'
      ? "Η οικονομική σου συμπεριφορά είναι απόλυτα σταθερή αυτόν τον μήνα. Συνέχισε έτσι!"
      : "Your financial behavior is perfectly stable this month. Keep it up!";

    // Disable interaction
    if (cardEl) {
      cardEl.classList.remove('interactive');
      cardEl.classList.remove('expanded');
      cardEl.onclick = null;
    }
    if (chevronEl) {
      chevronEl.style.display = 'none';
      chevronEl.classList.remove('rotated');
    }
  }

  if (advisorEl) {
    let html = advisorText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    if (maxIncreaseCat && maxIncreaseAmt > 0) {
      const discussText = state.lang === 'el' ? '💬 Συζήτησέ το' : '💬 Discuss it';
      const discussQuery = state.lang === 'el'
        ? `Γιατί αυξήθηκαν οι ${maxIncreaseCat} μου αυτόν τον μήνα;`
        : `Why did my ${maxIncreaseCat} increase this month?`;
      html += ` <button type="button" class="advisor-discuss-btn" onclick="event.stopPropagation(); openAdvisorChat('${discussQuery}');">${discussText}</button>`;
    }
    advisorEl.innerHTML = html;
  }

  // --- FORECASTING CALCULATIONS & RENDERING ---
  const forecast = calculateForecasting(activeTrans, hasHistoricalData);
  const targetYearEl = document.getElementById('forecast-target-year');
  if (targetYearEl) targetYearEl.textContent = currentYear;

  // Calculate 2025 savings
  let targetSavings = 15000; // default fallback
  const prevYear = currentYear - 1;
  let prevYearIncome = 0;
  let prevYearExpense = 0;
  activeTrans.forEach(t => {
    if (!t.date || t.type === 'transfer') return;
    const parts = String(t.date || '').split('T')[0].split(' ')[0].split('-');
    if (parts.length === 3 && parseInt(parts[0], 10) === prevYear) {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') prevYearIncome += amt;
      else if (t.type === 'expense') prevYearExpense += amt;
    }
  });
  const prevYearSavings = prevYearIncome - prevYearExpense;
  
  // Check localstorage custom target first
  const customTarget = localStorage.getItem('overview_savings_target');
  if (customTarget && parseFloat(customTarget) > 0) {
    targetSavings = parseFloat(customTarget);
  } else if (prevYearSavings > 0) {
    targetSavings = Math.round(prevYearSavings);
  }

  const normalStateEl = document.getElementById('forecast-normal-state');
  const yearendStateEl = document.getElementById('forecast-yearend-state');
  
  if (forecast.isYearEnd) {
    if (normalStateEl) normalStateEl.style.display = 'none';
    if (yearendStateEl) {
      yearendStateEl.style.display = 'block';
      const msgEl = document.getElementById('forecast-yearend-msg');
      if (msgEl) msgEl.textContent = forecast.message;
    }
  } else {
    if (yearendStateEl) yearendStateEl.style.display = 'none';
    if (normalStateEl) {
      normalStateEl.style.display = 'block';
      
      let progressPct = 0;
      if (targetSavings > 0 && overallNet > 0) {
        progressPct = Math.max(0, Math.min(100, Math.round((overallNet / targetSavings) * 100)));
      }
      
      const progressBarEl = document.getElementById('forecast-progress-bar');
      if (progressBarEl) progressBarEl.style.width = `${progressPct}%`;
      
      const progressBadgeEl = document.getElementById('forecast-progress-badge');
      if (progressBadgeEl) {
        progressBadgeEl.textContent = `${progressPct}%`;
        const clampedBadgePct = Math.max(7, Math.min(93, progressPct));
        progressBadgeEl.style.left = `${clampedBadgePct}%`;
      }
      
      const projectedValEl = document.getElementById('forecast-projected-val');
      if (projectedValEl) {
        projectedValEl.textContent = formatCurrency(forecast.projectedSavings);
      }

      // Update forecasting modal elements dynamically
      const explanationEl = document.getElementById('forecast-modal-explanation');
      if (explanationEl) {
        const roundedSavings = Math.round(forecast.currentYearSavings);
        const roundedRate = Math.round(forecast.avgMonthlySavings);
        const roundedProj = Math.round(forecast.projectedSavings);
        const elapsed = currentMonth + 1;
        if (state.lang === 'el') {
          explanationEl.innerHTML = `Έχετε αποταμιεύσει <strong>${formatCurrency(roundedSavings)}</strong> κατά τους πρώτους <strong>${elapsed}</strong> μήνες του έτους.<br><br>Με βάση τον τρέχοντα μέσο ρυθμό σας (<strong>${formatCurrency(roundedRate)} / μήνα</strong>), η προβλεπόμενη αποταμίευση για το τέλος του έτους είναι <strong>${formatCurrency(roundedProj)}</strong>.`;
        } else {
          explanationEl.innerHTML = `You have saved <strong>${formatCurrency(roundedSavings)}</strong> during the first <strong>${elapsed}</strong> months of the year.<br><br>Based on your current average rate (<strong>${formatCurrency(roundedRate)} / month</strong>), the projected savings for the end of the year is <strong>${formatCurrency(roundedProj)}</strong>.`;
        }
      }

      // Update Scenarios
      const bestValEl = document.getElementById('forecast-best-val');
      const expectedValEl = document.getElementById('forecast-expected-val');
      const worstValEl = document.getElementById('forecast-worst-val');
      
      if (bestValEl) bestValEl.textContent = formatCurrency(forecast.bestCaseSavings);
      if (expectedValEl) expectedValEl.textContent = formatCurrency(forecast.projectedSavings);
      if (worstValEl) worstValEl.textContent = formatCurrency(forecast.worstCaseSavings);

      const targetInputEl = document.getElementById('forecast-target-input');
      if (targetInputEl && !targetInputEl.matches(':focus')) {
        targetInputEl.value = Math.round(targetSavings);
      }

      const remainingTarget = targetSavings - overallNet;

      const requiredMonthlyValEl = document.getElementById('forecast-required-monthly-val');
      if (requiredMonthlyValEl) {
        const remainingMonths = 12 - (currentMonth + 1);
        const requiredMonthly = remainingTarget > 0 && remainingMonths > 0 ? (remainingTarget / remainingMonths) : 0;
        requiredMonthlyValEl.textContent = formatCurrency(requiredMonthly);
      }

      // Update Goal Timeline
      const timelineValEl = document.getElementById('forecast-goal-timeline-val');
      if (timelineValEl) {
        if (remainingTarget <= 0) {
          timelineValEl.textContent = state.lang === 'el' ? 'Επιτεύχθηκε! 🎉' : 'Achieved! 🎉';
          timelineValEl.style.color = '#66bb6a';
        } else if (forecast.avgMonthlySavings <= 0) {
          timelineValEl.textContent = state.lang === 'el' ? 'Μη εφικτό (Έλλειμμα)' : 'Not feasible (Deficit)';
          timelineValEl.style.color = '#ff5b5b';
        } else {
          const monthsNeeded = remainingTarget / forecast.avgMonthlySavings;
          timelineValEl.style.color = 'var(--text-primary)';
          if (monthsNeeded <= 1) {
            timelineValEl.textContent = state.lang === 'el' ? 'Λιγότερο από 1 μήνα' : 'Less than 1 month';
          } else {
            timelineValEl.textContent = state.lang === 'el' ? `${monthsNeeded.toFixed(1)} μήνες` : `${monthsNeeded.toFixed(1)} months`;
          }
        }
      }
    }
  }


  // Helper function to translate account display names
  const getAccountDisplayName = (acc) => {
    if (state.lang === 'el') {
      if (acc.type === 'cash') return 'Μετρητά';
      if (acc.type === 'bank') return 'Τράπεζα';
      if (acc.type === 'card') return 'Κάρτα';
    } else {
      if (acc.type === 'cash') return 'Cash';
      if (acc.type === 'bank') return 'Bank';
      if (acc.type === 'card') return 'Card';
    }
    return acc.name;
  };

  const icons = { cash: '💵', bank: '🏦', card: '💳' };

  // Payment method breakdown removed as requested

  // 4. Render Income section (Cash & Bank Account only)
  state.accounts.forEach(acc => {
    if (acc.type !== 'cash' && acc.type !== 'bank') return;

    // Calculate income and date range for this account
    let accIncome = 0;
    let minAccDate = null;
    let maxAccDate = null;

    activeTrans.forEach(t => {
      if (t.type === 'income' && t.account_from === acc.name) {
        if (!t.date) return;
        const y = parseInt(String(t.date).split('T')[0].split('-')[0], 10);
        if (y === currentYearOverview) {
          accIncome += parseFloat(t.amount) || 0;
        }
      }
    });

    const row = document.createElement('div');
    row.className = 'account-row';
    const icon = icons[acc.type] || '💳';

    const displayHtml = `
      <div style="display: flex; flex-direction: column;">
        <span class="account-title" style="font-weight: 600;">${getAccountDisplayName(acc)}</span>
      </div>
    `;

    row.innerHTML = `
      <div class="account-name-group">
        <div class="account-icon">${icon}</div>
        ${displayHtml}
      </div>
      <div class="account-value positive">${getCurrencySymbol()} ${formatCurrency(accIncome)}</div>`;

    if (assetsEl) assetsEl.appendChild(row);
  });

  // 5. Render Expenses section (Cash, Cards & Bank Accounts)
  state.accounts.forEach(acc => {
    if (acc.type !== 'cash' && acc.type !== 'card' && acc.type !== 'bank') return;

    // Calculate expenses and date range for this account
    let accExpense = 0;
    let minAccDate = null;
    let maxAccDate = null;

    activeTrans.forEach(t => {
      if (t.type === 'expense' && t.account_from === acc.name) {
        if (!t.date) return;
        const y = parseInt(String(t.date).split('T')[0].split('-')[0], 10);
        if (y === currentYearOverview) {
          accExpense += parseFloat(t.amount) || 0;
        }
      }
    });

    const row = document.createElement('div');
    row.className = 'account-row';
    const icon = icons[acc.type] || '💳';

    const displayHtml = `
      <div style="display: flex; flex-direction: column;">
        <span class="account-title" style="font-weight: 600;">${getAccountDisplayName(acc)}</span>
      </div>
    `;

    row.innerHTML = `
      <div class="account-name-group">
        <div class="account-icon">${icon}</div>
        ${displayHtml}
      </div>
      <div class="account-value negative">${getCurrencySymbol()} ${formatCurrency(accExpense)}</div>`;

    if (liabEl) liabEl.appendChild(row);
  });

  // 6. Period breakdown logic (group active transactions by year and get dates range, excluding transfers)
  const yearlyData = {};

  activeTrans.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (!t.date) return;
    if (t.type === 'transfer' || t.category === 'ΜΕΤΑΦΟΡΑ' || t.category?.toLowerCase().includes('μεταφ') || t.category?.toLowerCase().includes('transfer')) return;

    let year;
    if (t.date) {
      const d = new Date(t.date);
      if (!isNaN(d.getTime())) {
        year = d.getFullYear();
      } else {
        const match = String(t.date).match(/^(\d{4})/);
        if (match) year = parseInt(match[1], 10);
      }
    }
    if (!year || isNaN(year)) return;

    if (!yearlyData[year]) {
      yearlyData[year] = {
        income: 0,
        expense: 0,
        net: 0,
        minDate: t.date,
        maxDate: t.date
      };
    }

    if (t.type === 'income') {
      yearlyData[year].income += amt;
      yearlyData[year].net += amt;
    } else if (t.type === 'expense') {
      yearlyData[year].expense += amt;
      yearlyData[year].net -= amt;
    }

    if (t.date < yearlyData[year].minDate) yearlyData[year].minDate = t.date;
    if (t.date > yearlyData[year].maxDate) yearlyData[year].maxDate = t.date;
  });

  const breakdownEl = document.getElementById('accounts-periods-breakdown');
  const periodsList = document.getElementById('accounts-periods-list');
  const sortedYears = Object.keys(yearlyData).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

  if (breakdownEl && periodsList) {
    periodsList.innerHTML = '';
    let visibleYearIdx = 0;

    if (sortedYears.length > 0) {
      sortedYears.forEach(year => {
        const yearNum = parseInt(year, 10);
        if (yearNum >= currentYearOverview) return; // SKIP current & future years
        const data = yearlyData[year];
        if (data.income === 0 && data.expense === 0) return; // Skip if no transaction data

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.width = '100%';
        if (visibleYearIdx > 0) {
          container.style.borderTop = '1px solid var(--border)';
          container.style.paddingTop = '12px';
          container.style.marginTop = '12px';
        }
        visibleYearIdx++;

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.fontSize = '16px';
        row.style.cursor = 'pointer';
        row.style.padding = '4px 0';
        row.style.userSelect = 'none';
        row.style.fontFamily = "'Outfit', sans-serif";

        const label = TRANSLATIONS[state.lang]['period_label'] + ' ' + yearNum;
        const colorStyle = data.net >= 0 
          ? 'color: var(--blue-positive); font-weight: 700; font-family: \'Outfit\', sans-serif;'
          : 'color: var(--red-negative); font-weight: 700; font-family: \'Outfit\', sans-serif;';
        const sign = data.net >= 0 ? '+' : '-';

        row.innerHTML = `
          <span style="color: var(--text-secondary); font-weight: 700; font-size: 16px;">${label}</span>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="${colorStyle} font-size: 16px;">${sign}${getCurrencySymbol()}${formatCurrency(Math.abs(data.net))}</span>
            <i class="fa-solid fa-chevron-right archive-collapse-icon" style="font-size: 14px; color: var(--text-muted); transition: transform 0.25s;"></i>
          </div>
        `;

        const incomeLabel = state.lang === 'el' ? 'Έσοδα Έτους' : 'Year Income';
        const expenseLabel = state.lang === 'el' ? 'Έξοδα Έτους' : 'Year Expenses';
        const savingsRateLabel = state.lang === 'el' ? 'Ποσοστό Αποταμίευσης' : 'Savings Rate';
        const savingsRate = data.income > 0 ? Math.round((data.net / data.income) * 100) : 0;

        const dropdown = document.createElement('div');
        dropdown.style.maxHeight = '0';
        dropdown.style.overflow = 'hidden';
        dropdown.style.transition = 'max-height 0.25s ease';
        
        dropdown.innerHTML = `
          <div style="padding: 10px 0 4px 0; display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; color: var(--text-secondary); opacity: 0.9; font-family: 'Outfit', sans-serif;">
            <div style="display: flex; justify-content: space-between;">
              <span>${incomeLabel}:</span>
              <span style="font-weight: 700; color: var(--blue-positive);">${getCurrencySymbol()}${formatCurrency(data.income)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>${expenseLabel}:</span>
              <span style="font-weight: 700; color: var(--red-negative);">${getCurrencySymbol()}${formatCurrency(data.expense)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>${savingsRateLabel}:</span>
              <span style="font-weight: 700; color: var(--text-primary);">${savingsRate}%</span>
            </div>
          </div>
        `;
        
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          const chevron = row.querySelector('.archive-collapse-icon');
          const isCollapsed = !dropdown.style.maxHeight || dropdown.style.maxHeight === '0' || dropdown.style.maxHeight === '0px';
          if (isCollapsed) {
            dropdown.style.maxHeight = dropdown.scrollHeight + 'px';
            if (chevron) chevron.style.transform = 'rotate(90deg)';
          } else {
            dropdown.style.maxHeight = '0px';
            if (chevron) chevron.style.transform = 'rotate(0deg)';
          }
        });

        container.appendChild(row);
        container.appendChild(dropdown);
        periodsList.appendChild(container);
      });
    }

    if (visibleYearIdx > 0) {
      breakdownEl.style.display = 'block';
    } else {
      breakdownEl.style.display = 'none';
    }
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      if (tab === 'trans' && state.activeTab === 'trans') {
        const today = new Date();
        if (state.selectedMonth === today.getMonth() && state.selectedYear === today.getFullYear()) {
          scrollToToday();
        } else {
          switchTab(tab);
        }
      } else {
        switchTab(tab);
      }
    });
  });

  document.getElementById('period-prev').addEventListener('click', () => {
    navigateMonth(-1);
  });
  document.getElementById('period-next').addEventListener('click', () => {
    navigateMonth(1);
  });

  document.getElementById('stats-tab-expense').addEventListener('click', () => toggleStatsType('expense'));
  document.getElementById('stats-tab-income').addEventListener('click',  () => toggleStatsType('income'));
  document.getElementById('fab-btn').addEventListener('click', openAddTransactionModal);

  document.querySelectorAll('.type-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => setTransactionFormType(btn.getAttribute('data-type')));
  });

  // Date input change display listener
  const dateField = document.getElementById('trans-date');
  if (dateField) {
    dateField.addEventListener('input', (e) => {
      document.getElementById('trans-date-display').textContent = formatGreekDateTime(e.target.value);
    });
  }

  // Keypad keys pointerdown listeners (0ms mobile touch delay optimization)
  document.querySelectorAll('.calc-key-btn').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // Prevents emulated click events and double triggers
      e.stopPropagation();
      const val = btn.getAttribute('data-val');
      handleCalculatorKeyPress(val);
    });
  });

  // Close keypad when other form fields are clicked or focused
  ['trans-note', 'trans-description', 'trans-category', 'trans-account-from', 'trans-account-to', 'trans-date', 'trans-subcategory-custom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const textInputs = ['trans-note', 'trans-description', 'trans-subcategory-custom'];

      el.addEventListener('focus', () => {
        closeCalculatorKeypad();
        
        const isKeyboardAlreadyActive = document.body.classList.contains('keyboard-active');
        
        if (textInputs.includes(id)) {
          if (isIOS && !isKeyboardAlreadyActive) {
            // Apply estimated keyboard height instantly BEFORE class is added & layout is checked
            document.documentElement.style.setProperty('--keyboard-height', '320px');
          }
          document.body.classList.add('keyboard-active');
          
          if (isIOS) {
            const body = el.closest('.modal-body');
            if (body) {
              // Force layout reflow so the padding-bottom takes effect instantly in bounding rects
              body.offsetHeight;
            }
          }
        }
        
        const scrollIntoViewIfNeeded = (isInstant = false) => {
          const row = el.closest('.form-row') || el.closest('.form-group');
          const body = el.closest('.modal-body');
          if (row && body) {
            const bodyRect = body.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();
            
            let keyboardHeight = 0;
            if (window.visualViewport && document.body.classList.contains('keyboard-active')) {
              const cssKeyboardHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--keyboard-height')) || 0;
              const vvKeyboardHeight = window.innerHeight - window.visualViewport.height;
              keyboardHeight = Math.max(vvKeyboardHeight, cssKeyboardHeight);
            }
            
            const visibleHeight = bodyRect.height - keyboardHeight;
            const safetyMargin = 24; // Keep row at least 24px above the keyboard
            const effectiveBottom = bodyRect.top + visibleHeight - safetyMargin;
            
            if (rowRect.bottom > effectiveBottom) {
              const targetScroll = body.scrollTop + (rowRect.bottom - effectiveBottom);
              body.scrollTo({ top: targetScroll, behavior: isInstant ? 'auto' : 'smooth' });
            } else if (rowRect.top < bodyRect.top + 8) {
              const targetScroll = Math.max(0, body.scrollTop - (bodyRect.top - rowRect.top) - 8);
              body.scrollTo({ top: targetScroll, behavior: isInstant ? 'auto' : 'smooth' });
            }
          }
        };

        if (isIOS) {
          // On iOS, scroll instantly so input is in the safe zone before Safari decides to pan
          scrollIntoViewIfNeeded(true);
        } else {
          if (!isKeyboardAlreadyActive) {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            setTimeout(() => {
              window.scrollTo(0, 0);
              document.body.scrollTop = 0;
              scrollIntoViewIfNeeded(false);
            }, 350);
          } else {
            setTimeout(() => {
              scrollIntoViewIfNeeded(false);
            }, 50);
          }
        }
      });

      el.addEventListener('blur', () => {
        if (textInputs.includes(id)) {
          // Delay removal to see if focus transferred to another text input in the same modal
          setTimeout(() => {
            const activeEl = document.activeElement;
            const isAnotherInputFocused = activeEl && textInputs.includes(activeEl.id);
            if (!isAnotherInputFocused) {
              document.body.classList.remove('keyboard-active');
              
              // Reset scroll when input loses focus and keyboard actually closes
              setTimeout(() => {
                forceViewportReset();
              }, 50);
            }
          }, 80);
        } else {
          // Reset scroll when input loses focus
          setTimeout(() => {
            forceViewportReset();
          }, 50);
        }
      });
    }
  });

  const subcatSelect = document.getElementById('trans-subcategory-select');
  if (subcatSelect) {
    subcatSelect.addEventListener('change', () => {
      if (subcatSelect.value === '__NEW__') {
        showSubcategorySelect();
      }
    });
    subcatSelect.addEventListener('focus', closeCalculatorKeypad);
    subcatSelect.addEventListener('click', closeCalculatorKeypad);
  }

  const customSubcatInput = document.getElementById('trans-subcategory-custom');
  if (customSubcatInput) {
    customSubcatInput.addEventListener('input', updateCategoryDisplay);
  }

  const catSelect = document.getElementById('trans-category');
  if (catSelect) {
    catSelect.addEventListener('change', updateSubcategorySuggestions);
  }

  // Document keydown for calculator keyboard support
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('transaction-modal');
    const keypad = document.getElementById('custom-calculator-keypad');
    if (modal && modal.classList.contains('active') && keypad && keypad.classList.contains('active')) {
      const key = e.key;
      if (key >= '0' && key <= '9') {
        handleCalculatorKeyPress(key);
      } else if (key === 'Enter') {
        e.preventDefault();
        handleCalculatorKeyPress('done');
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleCalculatorKeyPress('backspace');
      } else if (key === '-') {
        handleCalculatorKeyPress('-');
      } else if (key === '.' || key === ',') {
        handleCalculatorKeyPress('.');
      }
    }
  });

  document.getElementById('transaction-form').addEventListener('submit', async e => {
    e.preventDefault();
    closeCalculatorKeypad();
    const id   = document.getElementById('trans-id').value;
    const type = document.querySelector('.type-tab-btn.active').getAttribute('data-type');
    
    let rawAmount = document.getElementById('trans-amount').value || '0';
    rawAmount = rawAmount.replace(/\,/g, '.');
    const evaluatedVal = evaluateCalcBuffer(rawAmount);
    const amountVal = parseFloat(evaluatedVal) || 0;
    const categoryVal = type === 'transfer' ? 'ΜΕΤΑΦΟΡΑ' : document.getElementById('trans-category').value;
    const noteVal = document.getElementById('trans-note').value.trim();
    
    // Validation: Amount, Category, Title (note) must be filled
    const lang = state.lang || 'el';
    if (amountVal <= 0) {
      const msg = lang === 'el' ? 'Παρακαλώ εισάγετε ποσό μεγαλύτερο από 0!' : 'Please enter an amount greater than 0!';
      await showCustomDialog({ message: msg, icon: '⚠️' });
      return;
    }
    
    if (!categoryVal || categoryVal.trim() === '') {
      const msg = lang === 'el' ? 'Παρακαλώ επιλέξτε κατηγορία!' : 'Please select a category!';
      await showCustomDialog({ message: msg, icon: '⚠️' });
      return;
    }
    
    if (!noteVal || noteVal === '') {
      const msg = lang === 'el' ? 'Παρακαλώ εισάγετε τίτλο!' : 'Please enter a title!';
      await showCustomDialog({ message: msg, icon: '⚠️' });
      return;
    }

    const isRecurringActive = _pendingRecurringSettings.preset !== 'custom' || 
      (_pendingRecurringSettings.days.length > 0 && _pendingRecurringSettings.months.length > 0);

    if (!id && isRecurringActive) {
      const template = {
        id: generateUUID(),
        type,
        amount: amountVal,
        category: categoryVal,
        subcategory: (() => {
          if (type === 'transfer') return '';
          const customInput = document.getElementById('trans-subcategory-custom');
          if (customInput && customInput.style.display !== 'none') {
            return customInput.value.trim();
          }
          const select = document.getElementById('trans-subcategory-select');
          return (select && select.value !== '__NEW__') ? select.value.trim() : '';
        })(),
        account_from: document.getElementById('trans-account-from').value,
        account_to: type === 'transfer' ? document.getElementById('trans-account-to').value : null,
        note: noteVal,
        description: document.getElementById('trans-description').value.trim(),
        days: [..._pendingRecurringSettings.days],
        months: [..._pendingRecurringSettings.months],
        preset: _pendingRecurringSettings.preset || 'monthly',
        years: [...(_pendingRecurringSettings.years || [])],
        endType: _pendingRecurringSettings.endType || 'perpetual',
        endDate: _pendingRecurringSettings.endDate || null,
        startDate: document.getElementById('trans-date').value || new Date().toISOString().split('T')[0],
        startYear: (() => {
          const dateElVal = document.getElementById('trans-date').value;
          return dateElVal ? new Date(dateElVal).getFullYear() : new Date().getFullYear();
        })(),
        startMonth: (() => {
          const dateElVal = document.getElementById('trans-date').value;
          return dateElVal ? (new Date(dateElVal).getMonth() + 1) : (new Date().getMonth() + 1);
        })(),
        user_id: state.currentUser ? state.currentUser.id : null,
        is_shared: state.partnerProfile !== null,
        family_id: state.userProfile ? state.userProfile.family_id : null
      };

      state.recurringTemplates.push(template);
      localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
      
      processRecurringTemplates();
      updateUI();

      _pendingReceiptFiles.forEach(p => {
        if (p.url && !p.isExisting) URL.revokeObjectURL(p.url);
      });
      _pendingReceiptFiles = [];
      _pendingReceiptDeleted = false;

      closeModal('transaction-modal');
      return;
    }
    
    const t = {
      date: document.getElementById('trans-date').value,
      type,
      amount: amountVal,
      category: categoryVal,
      subcategory: (() => {
        if (type === 'transfer') return '';
        const customInput = document.getElementById('trans-subcategory-custom');
        if (customInput && customInput.style.display !== 'none') {
          return customInput.value.trim();
        }
        const select = document.getElementById('trans-subcategory-select');
        return (select && select.value !== '__NEW__') ? select.value.trim() : '';
      })(),
      account_from: document.getElementById('trans-account-from').value,
      account_to: type === 'transfer' ? document.getElementById('trans-account-to').value : null,
      note: noteVal,
      description: document.getElementById('trans-description').value.trim(),
    };
    if (id) {
      t.id = id;
      const existing = state.transactions.find(item => item.id === id);
      if (existing) {
        t.user_id = existing.user_id;
        t.is_shared = existing.is_shared;
        t.family_id = existing.family_id;
        t.created_at = existing.created_at;
      }
    } else {
      t.user_id = state.currentUser ? state.currentUser.id : null;
      t.is_shared = state.partnerProfile !== null;
      t.family_id = state.userProfile ? state.userProfile.family_id : null;
    }
    await saveTransaction(t);
    
    // Save or delete receipt photos in IndexedDB
    if (_pendingReceiptFiles.length > 0 && t.id) {
      try {
        const blobsToSave = _pendingReceiptFiles.map(p => p.file).filter(f => f instanceof Blob);
        await ReceiptStorage.save(t.id, blobsToSave);
        t.photo_local_uri = 'local-file://' + t.id;
        saveTransactionOffline(t);
        console.log('Receipt photos saved locally for:', t.id);
      } catch (err) {
        console.warn('Failed to save receipt photos:', err);
      }
    } else if (_pendingReceiptDeleted && t.id) {
      try {
        await ReceiptStorage.remove(t.id);
        t.photo_local_uri = null;
        saveTransactionOffline(t);
        console.log('Receipt photos deleted for:', t.id);
      } catch (err) {
        console.warn('Failed to delete receipt photos:', err);
      }
    }
    
    _pendingReceiptFiles.forEach(p => {
      if (p.url && !p.isExisting) URL.revokeObjectURL(p.url);
    });
    _pendingReceiptFiles = [];
    _pendingReceiptDeleted = false;
    
    closeModal('transaction-modal');
  });

  document.getElementById('trans-delete-btn').addEventListener('click', async () => {
    const id = document.getElementById('trans-id').value;
    const confirmMsg = TRANSLATIONS[state.lang]['confirm_delete_transaction'];
    const confirmed = await showConfirm(confirmMsg, state.lang === 'el' ? 'Διαγραφή' : 'Delete', '🗑️');
    if (id && confirmed) {
      deleteTransaction(id);
      closeModal('transaction-modal');
    }
  });

  // ============================================================
  // RECEIPT PHOTO LISTENERS
  // ============================================================
  const cameraBtnEl = document.getElementById('trans-camera-btn');
  const photoInputEl = document.getElementById('trans-photo-input');

  function renderPhotoPreviews() {
    const container = document.getElementById('trans-photo-preview-container');
    const list = document.getElementById('trans-photo-previews-list');
    if (!container || !list) return;

    list.innerHTML = '';

    if (_pendingReceiptFiles.length === 0) {
      container.style.display = 'none';
      return;
    }

    const form = document.getElementById('transaction-form');
    const isReadOnly = form && form.getAttribute('data-readonly') === 'true';

    _pendingReceiptFiles.forEach(photo => {
      const wrapper = document.createElement('div');
      wrapper.className = 'photo-thumbnail-wrapper';
      wrapper.style.cssText = 'position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); background: rgba(0,0,0,0.2);';

      const img = document.createElement('img');
      img.src = photo.url;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; cursor: pointer;';
      img.addEventListener('click', () => openPhotoLightbox(photo.url));

      wrapper.appendChild(img);

      if (!isReadOnly) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.style.cssText = 'position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #ff5555; padding: 0;';
        deleteBtn.innerHTML = '<i class="fa-solid fa-xmark" style="font-size: 11px;"></i>';
        deleteBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          removePendingPhoto(photo.id);
        });
        wrapper.appendChild(deleteBtn);
      }

      list.appendChild(wrapper);
    });

    container.style.display = 'flex';
  }

  function removePendingPhoto(id) {
    const index = _pendingReceiptFiles.findIndex(p => p.id === id);
    if (index !== -1) {
      const photo = _pendingReceiptFiles[index];
      const confirmMsg = TRANSLATIONS[state.lang]['photo_delete_confirm'] || 'Διαγραφή φωτογραφίας απόδειξης;';
      if (confirm(confirmMsg)) {
        if (photo.url && !photo.isExisting) {
          URL.revokeObjectURL(photo.url);
        }
        _pendingReceiptFiles.splice(index, 1);
        if (_pendingReceiptFiles.length === 0) {
          _pendingReceiptDeleted = true;
        }
        renderPhotoPreviews();
      }
    }
  }

  window.removePendingPhoto = removePendingPhoto;
  window.renderPhotoPreviews = renderPhotoPreviews;

  if (cameraBtnEl && photoInputEl) {
    cameraBtnEl.addEventListener('click', () => {
      const form = document.getElementById('transaction-form');
      if (form && form.getAttribute('data-readonly') === 'true') return;
      photoInputEl.click();
    });

    photoInputEl.addEventListener('change', (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = URL.createObjectURL(file);
        _pendingReceiptFiles.push({
          id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          file: file,
          url: url,
          isExisting: false
        });
      }
      _pendingReceiptDeleted = false;

      const placeholderContainer = document.getElementById('trans-photo-placeholder-container');
      if (placeholderContainer) placeholderContainer.style.display = 'none';

      renderPhotoPreviews();
      photoInputEl.value = ''; // Reset file input
    });
  }

  function openCalculatorKeypad() {
    if (window.autocompleteJustSelected) return;
    const form = document.getElementById('transaction-form');
    if (form && form.getAttribute('data-readonly') === 'true') return;
    ensureHistoryPushed();
    const keypad = document.getElementById('custom-calculator-keypad');
    if (keypad) {
      keypad.classList.add('active');
    }
    const modal = document.getElementById('transaction-modal');
    if (modal) {
      modal.classList.add('keypad-active');
    }
    const amountRow = document.getElementById('form-row-amount');
    if (amountRow) {
      amountRow.querySelector('.form-row-value-container').classList.add('focused');
      // Scroll amount row to center of modal body
      const body = amountRow.closest('.modal-body');
      if (body) {
        setTimeout(() => {
          window.scrollTo(0, 0);
          document.body.scrollTop = 0;
          const bodyRect = body.getBoundingClientRect();
          const rowRect = amountRow.getBoundingClientRect();
          const relativeTop = rowRect.top - bodyRect.top + body.scrollTop;
          const targetScrollTop = relativeTop - (bodyRect.height / 2) + (rowRect.height / 2);
          body.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
          });
        }, 300);
      }
    }
    state.calcBuffer = document.getElementById('trans-amount').value.replace(/\,/g, '.') || '';
  }

  window.openCalculatorKeypad = openCalculatorKeypad;

  function closeCalculatorKeypad() {
    const keypad = document.getElementById('custom-calculator-keypad');
    if (keypad) {
      keypad.classList.remove('active');
    }
    const modal = document.getElementById('transaction-modal');
    if (modal) {
      modal.classList.remove('keypad-active');
    }
    const amountRow = document.getElementById('form-row-amount');
    if (amountRow) {
      amountRow.querySelector('.form-row-value-container').classList.remove('focused');
    }
  }

  window.closeCalculatorKeypad = closeCalculatorKeypad;

  function handleCalculatorKeyPress(val) {
    let buf = state.calcBuffer;
    
    if (val === 'done') {
      buf = evaluateCalcBuffer(buf);
      document.getElementById('trans-amount').value = buf;
      state.calcBuffer = buf;
      closeCalculatorKeypad();
      return;
    }
    
    if (val === 'backspace') {
      if (buf.length > 0) {
        buf = buf.slice(0, -1);
      }
    } else if (val === '-') {
      if (buf.length > 0 && !['-', '+', '*', '/'].includes(buf.slice(-1))) {
        buf += '-';
      }
    } else if (val === 'calc') {
      buf = evaluateCalcBuffer(buf);
    } else if (val === '.') {
      const lastNumPart = buf.split(/[-+*/]/).pop();
      if (!lastNumPart.includes('.')) {
        buf += '.';
      }
    } else {
      if (buf === '0' && val !== '00') {
        buf = val;
      } else {
        buf += val;
      }
    }
    
    state.calcBuffer = buf;
    document.getElementById('trans-amount').value = buf;
  }

  // Stats period navigation
  document.getElementById('stats-period-prev').addEventListener('click', () => {
    adjustStatsPeriod(-1);
  });
  document.getElementById('stats-period-next').addEventListener('click', () => {
    adjustStatsPeriod(1);
  });

  // Dropdown period selection
  const dropdownBtn = document.getElementById('stats-period-dropdown-btn');
  const dropdownMenu = document.getElementById('stats-period-dropdown-menu');
  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const familyFilterMenu = document.getElementById('stats-family-dropdown-menu');
    if (familyFilterMenu) familyFilterMenu.classList.remove('active');
    dropdownMenu.classList.toggle('active');
  });

  const familyFilterBtn = document.getElementById('stats-family-dropdown-btn');
  const familyFilterMenu = document.getElementById('stats-family-dropdown-menu');
  if (familyFilterBtn && familyFilterMenu) {
    familyFilterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.remove('active');
      familyFilterMenu.classList.toggle('active');
    });
  }

  document.addEventListener('click', () => {
    dropdownMenu.classList.remove('active');
    if (familyFilterMenu) {
      familyFilterMenu.classList.remove('active');
    }
    document.querySelectorAll('.member-dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  });

  document.querySelectorAll('.stats-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const val = item.getAttribute('data-value');
      if (val === 'period') {
        const { start, end } = getStatsDateRange();
        document.getElementById('custom-period-start').value = start.toISOString().split('T')[0];
        document.getElementById('custom-period-end').value = end.toISOString().split('T')[0];
        openModal('custom-period-modal');
      } else {
        state.expandedStatsCategories.clear();
        state.statsPeriodType = val;
        state.statsDate = new Date();
        renderStatsTab();
      }
    });
  });

  // Search button and Month picker title event listeners
  const searchBtn = document.getElementById('trans-search-btn');
  if (searchBtn) searchBtn.addEventListener('click', openSearchOverlay);

  const currPeriodTitle = document.getElementById('current-period-title');
  if (currPeriodTitle) {
    currPeriodTitle.addEventListener('click', (e) => {
      const isYearClick = e.target.classList.contains('year-part');
      openMonthPicker(isYearClick);
    });
  }

  const statsPeriodTitle = document.getElementById('stats-period-title');
  if (statsPeriodTitle) {
    statsPeriodTitle.addEventListener('click', (e) => {
      const isYearClick = e.target.classList.contains('year-part');
      openMonthPicker(isYearClick);
    });
  }

  // Auto-close search overlay when user scrolls down in the main content
  const appContent = document.querySelector('.app-content');
  if (appContent) {
    let lastScrollTop = 0;
    let touchStartY = 0;

    // Desktop scroll (using capturing to catch scroll events from sub-scroll containers)
    appContent.addEventListener('scroll', (e) => {
      const target = e.target;
      const st = target.scrollTop;
      const overlay = document.getElementById('search-overlay');
      if (overlay && overlay.classList.contains('active') && st > lastScrollTop + 8) {
        closeSearchOverlay();
      }
      lastScrollTop = st <= 0 ? 0 : st;
    }, { capture: true, passive: true });

    // Mobile touch: detect downward swipe
    appContent.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    appContent.addEventListener('touchmove', (e) => {
      const dy = touchStartY - e.touches[0].clientY;
      const overlay = document.getElementById('search-overlay');
      // dy > 0 means swiping up (scrolling down)
      if (overlay && overlay.classList.contains('active') && dy > 15) {
        closeSearchOverlay();
      }
    }, { passive: true });
  }

  // Feedback rating emojis clicks
  document.querySelectorAll('.emoji-rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.emoji-rate-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Feedback type chips clicks
  document.querySelectorAll('.feedback-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.feedback-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// Removed initMainScreenSwipeGestures call and adjustMainPeriod

function adjustStatsPeriod(direction, startingDeltaX = 0) {
  state.expandedStatsCategories.clear();
  animateSwipeTransition(direction, () => {
    if (state.statsPeriodType === 'weekly') {
      state.statsDate.setDate(state.statsDate.getDate() + direction * 7);
    } else if (state.statsPeriodType === 'monthly') {
      state.statsDate.setDate(15);
      state.statsDate.setMonth(state.statsDate.getMonth() + direction);
      state.selectedMonth = state.statsDate.getMonth();
      state.selectedYear = state.statsDate.getFullYear();
      updateHeaderAndSync();
    } else if (state.statsPeriodType === 'annually') {
      state.statsDate.setDate(15);
      state.statsDate.setFullYear(state.statsDate.getFullYear() + direction);
    } else if (state.statsPeriodType === 'period') {
      const start = new Date(state.statsCustomStart + 'T00:00:00');
      const end = new Date(state.statsCustomEnd + 'T23:59:59');
      const durationMs = end - start + 1; // inclusive
      const newStart = new Date(start.getTime() + direction * durationMs);
      const newEnd = new Date(end.getTime() + direction * durationMs);
      state.statsCustomStart = newStart.toISOString().split('T')[0];
      state.statsCustomEnd = newEnd.toISOString().split('T')[0];
    }
    renderStatsTab(true);
  }, startingDeltaX);
}


function handleCustomPeriodSave() {
  const startVal = document.getElementById('custom-period-start').value;
  const endVal = document.getElementById('custom-period-end').value;
  if (startVal && endVal) {
    if (new Date(startVal) > new Date(endVal)) {
      const msg = TRANSLATIONS[state.lang]['alert_date_order'];
      alert(msg);
      return;
    }
    state.expandedStatsCategories.clear();
    state.statsCustomStart = startVal;
    state.statsCustomEnd = endVal;
    state.statsPeriodType = 'period';
    closeModal('custom-period-modal');
    renderStatsTab();
  }
}

function scrollToToday(behavior = 'smooth') {
  const isMobile = window.innerWidth <= 767;
  const scrollContainer = isMobile
    ? document.querySelector('.trans-scroll-content')
    : document.querySelector('.app-content');
  const list = document.getElementById('transactions-list');
  if (!scrollContainer || !list) return;
  
  const todayHeader = list.querySelector('.day-header.is-today');
  if (todayHeader) {
    // Calculate layout-independent offset within scroll container using offsetParent chain
    let relativeTop = 0;
    let el = todayHeader;
    while (el && el !== scrollContainer) {
      relativeTop += el.offsetTop;
      el = el.offsetParent;
    }
    
    const offset = isMobile ? 0 : 105;
    
    scrollContainer.scrollTo({
      top: Math.max(0, relativeTop - offset),
      behavior: behavior
    });
  } else {
    scrollContainer.scrollTo({
      top: 0,
      behavior: behavior
    });
  }
}

function switchTab(tab, instant = false) {
  ensureHistoryPushed();
  // Allow re-tapping 'trans' or 'stats' tab to reset month even if already active
  if (state.activeTab === tab) {
    if (tab === 'trans') {
      const today = new Date();
      state.selectedMonth = today.getMonth();
      state.selectedYear = today.getFullYear();
      syncStatsDate();
      updateUI();
      setTimeout(() => scrollToToday('smooth'), 50);
    } else if (tab === 'stats') {
      const today = new Date();
      const isAlreadyCurrent = (state.selectedMonth === today.getMonth() && state.selectedYear === today.getFullYear());
      if (!isAlreadyCurrent) {
        state.selectedMonth = today.getMonth();
        state.selectedYear = today.getFullYear();
        state.statsDate = new Date();
        state.statsDate.setDate(15);
        state.expandedStatsCategories.clear();
        renderStatsTab();
      } else {
        const scrollContainer = document.querySelector('.stats-scroll-content');
        if (scrollContainer) {
          scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }
    return;
  }

  // Clear expanded categories on active tab change
  state.expandedStatsCategories.clear();

  // Cancel any pending deferred UI rendering for a previous tab switch
  if (state.tabRenderTimeoutId) {
    clearTimeout(state.tabRenderTimeoutId);
    state.tabRenderTimeoutId = null;
  }

  // If there is an active transition in progress, force-complete it immediately to prevent race conditions & jitter
  if (typeof state.activeTransitionCleanup === 'function') {
    try {
      if (state.activeTransitionTimeoutId) {
        clearTimeout(state.activeTransitionTimeoutId);
        state.activeTransitionTimeoutId = null;
      }
      if (state.activeTransitionAnimEndTarget && state.activeTransitionAnimEndListener) {
        state.activeTransitionAnimEndTarget.removeEventListener('animationend', state.activeTransitionAnimEndListener);
      }
      state.activeTransitionCleanup();
    } catch (err) {
      console.error("Error cleaning up active tab transition:", err);
    }
    state.activeTransitionCleanup = null;
    state.activeTransitionAnimEndTarget = null;
    state.activeTransitionAnimEndListener = null;
  }

  if (state.selectionMode) {
    state.selectionMode = false;
    state.selectedIds.clear();
    const bar = document.getElementById('selection-bar');
    if (bar) bar.classList.remove('active');
    const fab = document.getElementById('fab-btn');
    if (fab) fab.classList.remove('hidden');
  }

  // Fail-safe: Hide back-swipe indicator on tab switch
  const bsInd = document.getElementById('back-swipe-indicator');
  if (bsInd) bsInd.style.display = 'none';

  const oldTab = state.activeTab;
  state.activeTab = tab;
  localStorage.setItem('active_tab', tab);

  // Toggle body class for scroll isolation on mobile
  document.body.classList.toggle('trans-tab-active', tab === 'trans');
  document.body.classList.toggle('stats-tab-active', tab === 'stats');
  document.body.classList.toggle('accounts-tab-active', tab === 'accounts');
  document.body.classList.toggle('more-tab-active', tab === 'more');

  const oldScreen = document.getElementById(`${oldTab}-screen`);
  const newScreen = document.getElementById(`${tab}-screen`);

  // Manage FAB visibility based on active tab
  const fab = document.getElementById('fab-btn');
  if (fab) {
    if (tab === 'trans') {
      fab.style.display = 'flex';
    } else {
      fab.style.display = 'none';
    }
  }

  if (oldScreen && newScreen) {
    // Hide old screen instantly, remove fade-in class from all screens
    document.querySelectorAll('.tab-screen').forEach(s => {
      s.classList.remove('fade-in-premium');
      if (s.id !== `${tab}-screen`) {
        s.classList.remove('active');
        s.style.display = 'none';
        s.style.visibility = 'hidden';
        s.style.opacity = '0';
      }
    });

    if (instant) {
      newScreen.style.display = '';
      newScreen.style.visibility = '';
      newScreen.style.opacity = '';
      newScreen.classList.add('active');
    } else {
      // Display and trigger animation on new screen
      newScreen.style.display = '';
      newScreen.style.visibility = '';
      newScreen.style.opacity = '';
      newScreen.classList.add('active', 'fade-in-premium');

      const cleanupHandler = () => {
        newScreen.classList.remove('fade-in-premium');
        state.activeTransitionCleanup = null;
        state.activeTransitionAnimEndTarget = null;
        state.activeTransitionAnimEndListener = null;
        state.activeTransitionTimeoutId = null;
      };

      state.activeTransitionCleanup = cleanupHandler;
      state.activeTransitionAnimEndTarget = newScreen;

      const onAnimEnd = (e) => {
        if (e.target === newScreen) {
          newScreen.removeEventListener('animationend', onAnimEnd);
          cleanupHandler();
        }
      };
      state.activeTransitionAnimEndListener = onAnimEnd;
      newScreen.addEventListener('animationend', onAnimEnd);

      state.activeTransitionTimeoutId = setTimeout(() => {
        newScreen.removeEventListener('animationend', onAnimEnd);
        cleanupHandler();
      }, 200);
    }
  } else {
    document.querySelectorAll('.tab-screen').forEach(s => s.classList.toggle('active', s.id === `${tab}-screen`));
  }

  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.getAttribute('data-tab') === tab));
  
  if (tab !== 'trans') {
    ensureHistoryPushed();
  }

  // Render tab contents immediately to guarantee zero lag/blank states
  if (tab === 'trans') {
    const today = new Date();
    state.selectedMonth = today.getMonth();
    state.selectedYear = today.getFullYear();
    syncStatsDate();
    updateUI();
    setTimeout(() => scrollToToday('smooth'), 50);
  }
  else if (tab === 'stats')    renderStatsTab();
  else if (tab === 'accounts') renderAccountsTab();
  else if (tab === 'more') {
    renderPartnerSection();
    if (state.currentUser) {
      const emailDisplay = document.getElementById('settings-user-email-value');
      if (emailDisplay) {
        emailDisplay.textContent = state.currentUser.email;
        emailDisplay.title = state.currentUser.email;
      }
      // Keep legacy emailItem hidden - email is shown in profile header card instead
    }

    // Dynamically populate Profile Header Card
    const headerName = document.getElementById('profile-user-name');
    const headerEmail = document.getElementById('profile-user-email');
    const headerAvatar = document.getElementById('profile-avatar-letters');
    if (headerName) {
      headerName.textContent = state.userProfile?.display_name || state.currentUser?.email?.split('@')[0] || 'User';
    }
    if (headerEmail) {
      headerEmail.textContent = state.currentUser ? state.currentUser.email : 'email@example.com';
    }
    if (headerAvatar) {
      const nameVal = state.userProfile?.display_name || state.currentUser?.email?.split('@')[0] || 'U';
      const parts = nameVal.trim().split(/\s+/).filter(p => p.length > 0);
      let initials = 'U';
      if (parts.length > 0) {
        initials = parts.map(p => p[0]).join('').substring(0, 2).toUpperCase();
      }
      headerAvatar.textContent = initials;
    }
  }
}

function toggleStatsType(type) {
  state.expandedStatsCategories.clear();
  state.statsType = type;
  document.getElementById('stats-tab-expense').classList.toggle('active', type === 'expense');
  document.getElementById('stats-tab-income').classList.toggle('active',  type === 'income');
  renderStatsTab();
}

function forceViewportReset() {
  if (!isIOS) return;
  
  // Snap scroll position back to 0
  window.scrollTo(0, 0);
  document.body.scrollTop = 0;
  
  const hasOffset = window.scrollY > 0 || (window.visualViewport && window.visualViewport.offsetTop > 0);
  if (hasOffset) {
    // Temporarily make body scrollable to force iOS Safari to reset visual viewport panning
    const originalHeight = document.body.style.height;
    document.body.style.setProperty('height', (window.innerHeight + 150) + 'px', 'important');
    window.scrollTo(0, 10);
    setTimeout(() => {
      window.scrollTo(0, 0);
      document.body.style.height = originalHeight || '';
      if (!originalHeight) {
        document.body.style.removeProperty('height');
      }
      document.body.scrollTop = 0;
    }, 100);
  }
}

function openModal(id)  { 
  ensureHistoryPushed();
  const el = document.getElementById(id);
  // For the transaction modal, counteract body { zoom: 0.93 } to perfectly fill physical screen
  if (id === 'transaction-modal') {
    const scale = isIOS ? 1.0 : 0.93;
    el.style.setProperty('width', (window.innerWidth / scale) + 'px', 'important');
    el.style.setProperty('height', (window.innerHeight / scale) + 'px', 'important');
    el.style.setProperty('top', '0px', 'important');
    
    if (!isIOS) {
      const modalContent = el.querySelector('.modal-content');
      if (modalContent) {
        const vvHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const offsetTop = window.visualViewport ? window.visualViewport.offsetTop : 0;
        const rawKeyboardHeight = window.visualViewport ? (window.innerHeight - vvHeight - offsetTop) : 0;
        if (rawKeyboardHeight > 30) {
          modalContent.style.setProperty('height', (vvHeight / scale) + 'px', 'important');
          modalContent.style.setProperty('top', (offsetTop / scale) + 'px', 'important');
        } else {
          modalContent.style.setProperty('height', (window.innerHeight / scale) + 'px', 'important');
          modalContent.style.setProperty('top', '0px', 'important');
        }
      }
    }
  }
  if (id === 'fhs-details-modal') {
    const fhsExplainContent = document.getElementById('fhs-explain-content');
    const fhsExplainChevron = document.getElementById('fhs-explain-chevron');
    if (fhsExplainContent) fhsExplainContent.style.display = 'none';
    if (fhsExplainChevron) fhsExplainChevron.style.transform = 'rotate(0deg)';
  }
  el.classList.add('active'); 
  document.body.classList.add('modal-open');
}
function closeModal(id) {
  // Prevent iOS ghost clicks / click penetration on the elements underneath (e.g. FAB button)
  document.body.style.pointerEvents = 'none';
  setTimeout(() => {
    document.body.style.pointerEvents = '';
  }, 350);

  // Force blur any active input/textarea to close keyboard immediately on modal close
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
    document.activeElement.blur();
  }

  const el = document.getElementById(id);
  if (!el) {
    console.warn('[closeModal] Element not found:', id);
    return;
  }
  el.classList.remove('active');
  const activeModals = document.querySelectorAll('.modal-overlay.active, #transaction-modal.active');
  if (activeModals.length === 0) {
    document.body.classList.remove('modal-open');
    
    // Snap window scroll back to top to clear iOS visualViewport panning
    setTimeout(() => {
      forceViewportReset();
    }, 50);
    setTimeout(() => {
      forceViewportReset();
    }, 450);
  }
  if (id === 'transaction-modal' && typeof window.closeCalculatorKeypad === 'function') {
    window.closeCalculatorKeypad();
  }
}

function toggleTransactionFormLock(locked) {
  const form = document.getElementById('transaction-form');
  if (!form) return;
  
  if (locked) {
    form.setAttribute('data-readonly', 'true');
  } else {
    form.removeAttribute('data-readonly');
  }
  
  const inputsToToggle = [
    'trans-date',
    'trans-note',
    'trans-description',
    'trans-account-from',
    'trans-account-to',
    'trans-subcategory-custom'
  ];
  inputsToToggle.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = locked;
    }
  });

  const pointerContainers = [
    document.querySelector('.type-selector-tabs'),
    document.getElementById('trans-category-trigger'),
    document.getElementById('trans-subcategory-trigger'),
    document.getElementById('form-row-amount')
  ];
  pointerContainers.forEach(el => {
    if (el) {
      if (locked) {
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.6';
      } else {
        el.style.pointerEvents = '';
        el.style.opacity = '';
      }
    }
  });

  const saveBtn = document.getElementById('btn-save-transaction');
  if (saveBtn) {
    saveBtn.style.display = locked ? 'none' : 'block';
  }
  const deletePhotoBtn = document.getElementById('btn-delete-photo');
  if (deletePhotoBtn) {
    deletePhotoBtn.style.display = locked ? 'none' : 'block';
  }
  const cameraBtn = document.getElementById('trans-camera-btn');
  if (cameraBtn) {
    cameraBtn.style.display = locked ? 'none' : 'block';
  }

  let warningEl = document.getElementById('trans-readonly-warning');
  if (locked) {
    if (!warningEl) {
      warningEl = document.createElement('div');
      warningEl.id = 'trans-readonly-warning';
      warningEl.style.padding = '10px 12px';
      warningEl.style.borderRadius = '8px';
      warningEl.style.backgroundColor = 'rgba(239, 83, 80, 0.15)';
      warningEl.style.color = '#ef5350';
      warningEl.style.fontSize = '12px';
      warningEl.style.fontWeight = '500';
      warningEl.style.textAlign = 'center';
      warningEl.style.marginBottom = '8px';
      warningEl.style.display = 'flex';
      warningEl.style.alignItems = 'center';
      warningEl.style.justifyContent = 'center';
      warningEl.style.gap = '8px';
      warningEl.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${TRANSLATIONS[state.lang]['only_creator_edit_warning']}</span>`;
      
      const form = document.getElementById('transaction-form');
      if (form) {
        form.parentNode.insertBefore(warningEl, form);
      }
    } else {
      warningEl.querySelector('span').textContent = TRANSLATIONS[state.lang]['only_creator_edit_warning'];
      warningEl.style.display = 'flex';
    }
  } else {
    if (warningEl) {
      warningEl.style.display = 'none';
    }
  }
}

function openAddTransactionModal() {
  if (typeof window.closeCalculatorKeypad === 'function') {
    window.closeCalculatorKeypad();
  }
  
  clearRecurringSettings(false);
  const repInstBtn = document.getElementById('btn-rep-inst');
  if (repInstBtn) repInstBtn.style.display = 'flex';

  toggleTransactionFormLock(false);
  document.getElementById('transaction-form').reset();
  if (window.updateDescriptionHeight) window.updateDescriptionHeight();
  document.getElementById('trans-id').value = '';
  
  // Reset Category
  document.getElementById('trans-category').value = '';
  document.getElementById('trans-category-display').innerHTML = `<span class="custom-select-placeholder">Επιλέξτε...</span>`;
  
  // Reset Subcategory
  const customInput = document.getElementById('trans-subcategory-custom');
  if (customInput) customInput.value = '';
  hideSubcategorySelect();
  
  document.getElementById('trans-delete-btn').style.display = 'none';
  
  const creatorRow = document.getElementById('trans-creator-row');
  if (creatorRow) creatorRow.style.display = 'none';
  
  // Reset photo state
  _pendingReceiptFiles.forEach(p => {
    if (p.url && !p.isExisting) URL.revokeObjectURL(p.url);
  });
  _pendingReceiptFiles = [];
  _pendingReceiptDeleted = false;
  const photoInput = document.getElementById('trans-photo-input');
  if (photoInput) photoInput.value = '';
  const previewContainer = document.getElementById('trans-photo-preview-container');
  if (previewContainer) previewContainer.style.display = 'none';
  const placeholderContainer = document.getElementById('trans-photo-placeholder-container');
  if (placeholderContainer) placeholderContainer.style.display = 'none';
  
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
  document.getElementById('trans-date').value = localISOTime;
  document.getElementById('trans-date-display').textContent = formatGreekDateTime(localISOTime);
  
  setTransactionFormType('expense');

  // Set default account values to avoid empty payment methods
  if (state.accounts && state.accounts.length > 0) {
    const cardAcc = state.accounts.find(acc => acc.type === 'card' || acc.name.toLowerCase().trim() === 'card' || acc.name.trim() === 'Κάρτα');
    const defaultFromAcc = cardAcc || state.accounts[0];
    document.getElementById('trans-account-from').value = defaultFromAcc.name;
    document.getElementById('trans-account-to').value = state.accounts.length > 1 ? (state.accounts.find(acc => acc.name !== defaultFromAcc.name) || state.accounts[0]).name : state.accounts[0].name;
  } else {
    document.getElementById('trans-account-from').value = 'Card';
    document.getElementById('trans-account-to').value = 'Bank Account';
  }
  updateAccountDropdowns();

  openModal('transaction-modal');
  setTimeout(() => initNoteAutocomplete(), 50);
}

function openEditTransactionModal(t) {
  if (typeof window.closeCalculatorKeypad === 'function') {
    window.closeCalculatorKeypad();
  }
  
  clearRecurringSettings(false);
  const repInstBtn = document.getElementById('btn-rep-inst');
  if (repInstBtn) repInstBtn.style.display = 'none';

  const isFamilyMember = state.userProfile && state.userProfile.family_id;
  const isNotAdmin = state.userProfile && state.userProfile.role !== 'admin';
  const isNotOwner = t.user_id && state.currentUser && t.user_id !== state.currentUser.id;
  const shouldLock = !!(isFamilyMember && isNotAdmin && isNotOwner);

  toggleTransactionFormLock(shouldLock);

  document.getElementById('trans-id').value     = t.id;
  
  let dateVal = t.date;
  if (dateVal && dateVal.length === 10) {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    dateVal = `${dateVal}T${hrs}:${mins}`;
  }
  document.getElementById('trans-date').value   = dateVal;
  document.getElementById('trans-date-display').textContent = formatGreekDateTime(dateVal);
  
  document.getElementById('trans-amount').value = String(t.amount);
  
  // Load note (primary title) and description (secondary) separately
  document.getElementById('trans-note').value        = t.note || '';
  document.getElementById('trans-description').value = t.description || '';
  if (window.updateDescriptionHeight) window.updateDescriptionHeight();
  
  if (shouldLock) {
    document.getElementById('trans-delete-btn').style.display = 'none';
  } else {
    document.getElementById('trans-delete-btn').style.display = 'block';
  }
  
  // Reset photo state and load existing photos if available
  _pendingReceiptFiles.forEach(p => {
    if (p.url && !p.isExisting) URL.revokeObjectURL(p.url);
  });
  _pendingReceiptFiles = [];
  _pendingReceiptDeleted = false;
  const photoInput = document.getElementById('trans-photo-input');
  if (photoInput) photoInput.value = '';
  const previewContainer = document.getElementById('trans-photo-preview-container');
  const placeholderContainer = document.getElementById('trans-photo-placeholder-container');
  if (previewContainer) previewContainer.style.display = 'none';
  if (placeholderContainer) placeholderContainer.style.display = 'none';
  
  // Load receipt photos from IndexedDB
  if (t.photo_local_uri && t.id) {
    ReceiptStorage.load(t.id).then(blobs => {
      if (blobs && blobs.length > 0) {
        blobs.forEach(blob => {
          const url = URL.createObjectURL(blob);
          _pendingReceiptFiles.push({
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            file: blob,
            url: url,
            isExisting: true
          });
        });
        renderPhotoPreviews();
      } else if (placeholderContainer) {
        // Photo exists in cloud record but not locally (different device)
        placeholderContainer.style.display = 'flex';
        const placeholderText = document.getElementById('trans-photo-placeholder-text');
        if (placeholderText) {
          placeholderText.textContent = TRANSLATIONS[state.lang]['photo_mismatch_warning'] || 'Η εικόνα είναι διαθέσιμη μόνο στη συσκευή που καταχωρήθηκε.';
        }
      }
    }).catch(err => console.warn('Failed to load receipts:', err));
  }
  
  setTransactionFormType(t.type);
  setTimeout(() => {
    if (t.type !== 'transfer') {
      document.getElementById('trans-category').value = t.category;
      
      const subcatVal = t.subcategory || '';
      document.getElementById('trans-subcategory-select').value = subcatVal;
      
      const customInput = document.getElementById('trans-subcategory-custom');
      if (customInput) customInput.value = '';
      
      updateCategoryDisplay();
      updateSubcategorySuggestions();
      updateSubcategoryRowVisibility();
    }

    document.getElementById('trans-account-from').value = t.account_from;
    if (t.type === 'transfer') {
      document.getElementById('trans-account-to').value = t.account_to || '';
    }
    updateAccountDropdowns();
  }, 10);

  // Show creator info
  const creatorRow = document.getElementById('trans-creator-row');
  const creatorText = document.getElementById('trans-creator-text');
  if (creatorRow && creatorText) {
    let creatorName = null;
    if (state.userProfile && state.userProfile.family_id && t.user_id) {
      const creator = state.familyProfiles.find(p => p.id === t.user_id);
      if (creator) {
        creatorName = creator.display_name || creator.email.split('@')[0];
      }
    }
    if (!creatorName && state.partnerProfile && t.user_id === state.partnerProfile.id) {
      creatorName = state.partnerProfile.display_name || state.partnerProfile.email.split('@')[0];
    }
    if (!creatorName && state.currentUser && t.user_id === state.currentUser.id) {
      creatorName = state.currentUser.email ? state.currentUser.email.split('@')[0] : (state.userProfile?.display_name || '');
    }
    if (creatorName) {
      creatorRow.style.display = 'block';
      creatorText.textContent = (state.lang === 'el' ? 'Καταχωρήθηκε από: ' : 'Added by: ') + creatorName;
    } else {
      creatorRow.style.display = 'none';
    }
  }

  openModal('transaction-modal');
  setTimeout(() => initNoteAutocomplete(), 50);
}

// ============================================================
// RECEIPT PHOTO LIGHTBOX
// ============================================================
function openPhotoLightbox(src) {
  const modal = document.getElementById('photo-lightbox-modal');
  const img = document.getElementById('photo-lightbox-img');
  if (modal && img && src) {
    img.src = src;
    modal.style.display = 'flex';
  }
}

function closePhotoLightbox() {
  const modal = document.getElementById('photo-lightbox-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

window.openPhotoLightbox = openPhotoLightbox;
window.closePhotoLightbox = closePhotoLightbox;

function updateCategoryDisplay() {
  const categoryHidden = document.getElementById('trans-category');
  const categoryDisplay = document.getElementById('trans-category-display');
  if (!categoryHidden || !categoryDisplay) return;
  
  const categoryVal = categoryHidden.value;
  if (!categoryVal) {
    categoryDisplay.innerHTML = `<span class="custom-select-placeholder">Επιλέξτε...</span>`;
    return;
  }
  
  const type = document.querySelector('.type-tab-btn.active')?.getAttribute('data-type') || 'expense';
  const catInfo = getCategoryInfo(categoryVal, type);
  const icon = catInfo.icon || '';
  const cleanName = getCategoryDisplayName(categoryVal);
  
  const subcatSelect = document.getElementById('trans-subcategory-select')?.value || '';
  const subcatCustom = document.getElementById('trans-subcategory-custom')?.value || '';
  
  let subcatText = '';
  if (subcatSelect === '__NEW__') {
    subcatText = subcatCustom.trim();
  } else if (subcatSelect) {
    subcatText = getSubcategoryDisplayName(subcatSelect.trim(), categoryVal);
  }
  
  if (subcatText) {
    categoryDisplay.innerHTML = `
      <span class="category-picker-icon" style="font-size:16px;">${icon}</span>
      <span style="font-weight:600;">${cleanName}</span>
      <span style="color: var(--text-muted); margin: 0 4px;">&gt;</span>
      <span style="font-weight:600;">${subcatText}</span>
    `;
  } else {
    categoryDisplay.innerHTML = `
      <span class="category-picker-icon" style="font-size:16px;">${icon}</span>
      <span style="font-weight:600;">${cleanName}</span>
    `;
  }
}

function updateSubcategoryRowVisibility() {
  const subcatGroup = document.getElementById('form-row-subcategory');
  if (!subcatGroup) return;
  const type = document.querySelector('.type-tab-btn.active')?.getAttribute('data-type') || 'expense';
  const subcatSelect = document.getElementById('trans-subcategory-select')?.value || '';
  
  if (type === 'transfer') {
    subcatGroup.style.display = 'none';
  } else {
    if (subcatSelect === '__NEW__') {
      subcatGroup.style.display = 'flex';
    } else {
      subcatGroup.style.display = 'none';
    }
  }
}

function setTransactionFormType(type) {
  try {
    if (!type) type = 'expense';
    const form = document.getElementById('transaction-form');
    if (form && form.getAttribute('data-readonly') === 'true') return;
    
    document.querySelectorAll('.type-tab-btn').forEach(btn => {
      const btnType = btn.getAttribute('data-type');
      if (btnType) {
        btn.classList.toggle('active', btnType === type);
      }
    });
    
    const modalEl = document.getElementById('transaction-modal');
    if (modalEl) {
      modalEl.classList.remove('expense', 'income', 'transfer');
      modalEl.classList.add(type);
    }
    
    const currentLang = state.lang || 'el';
    const langDict = TRANSLATIONS[currentLang] || TRANSLATIONS['el'];
    let typeLabel = langDict['type_tab_expense'] || 'Έξοδο';
    if (type === 'income') typeLabel = langDict['type_tab_income'] || 'Έσοδο';
    else if (type === 'transfer') typeLabel = langDict['type_tab_transfer'] || 'Μεταφορά';
    
    const titleEl = document.getElementById('modal-trans-title');
    if (titleEl) {
      titleEl.textContent = typeLabel;
    }
    
    const catGroup      = document.getElementById('form-row-category');
    const toAccGroup    = document.getElementById('form-row-account-to');
    const fromAccLabel  = document.getElementById('label-account-from');
    
    if (type === 'transfer') {
      if (catGroup) catGroup.style.display = 'none';
      updateSubcategoryRowVisibility();
      if (toAccGroup) toAccGroup.style.display = 'flex';
      if (fromAccLabel) fromAccLabel.textContent = langDict['label_from'] || 'Από';
    } else {
      if (catGroup) catGroup.style.display = 'flex';
      updateSubcategoryRowVisibility();
      if (toAccGroup) toAccGroup.style.display = 'none';
      if (fromAccLabel) fromAccLabel.textContent = langDict['label_account'] || 'Λογαριασμός';
      updateCategoryDropdowns(type);
      updateSubcategorySuggestions();
    }
  } catch (err) {
    console.error('Error in setTransactionFormType:', err);
  }
}

let categoryPickerEditMode = false;

function toggleCategoryPickerEditMode() {
  categoryPickerEditMode = !categoryPickerEditMode;
  const btn = document.getElementById('btn-toggle-cat-edit');
  if (btn) {
    btn.textContent = categoryPickerEditMode 
      ? (TRANSLATIONS[state.lang]['keypad_btn_done'] || 'Τέλος')
      : (TRANSLATIONS[state.lang]['btn_manage'] || 'Διαχείριση');
    if (categoryPickerEditMode) {
      btn.style.borderColor = 'var(--accent)';
      btn.style.color = 'var(--accent)';
    } else {
      btn.style.borderColor = 'var(--border)';
      btn.style.color = 'var(--text-secondary)';
    }
  }
  const currentType = document.querySelector('.type-tab-btn.active').getAttribute('data-type');
  updateCategoryDropdowns(currentType);
}

function inlineToggleCategoryHidden(categoryName, type) {
  const cat = state.categories.find(c => c.name === categoryName);
  if (cat) {
    cat.hidden = !cat.hidden;
    saveCategoriesToStorage();
    
    // Sync to cloud if enabled
    if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
      try {
        state.supabaseClient
          .from('categories')
          .upsert({
            user_id: state.currentUser.id,
            name: cat.name,
            type: cat.type,
            icon: cat.icon,
            color: cat.color,
            hidden: cat.hidden
          }, { onConflict: 'user_id,name' })
          .then(({ error }) => {
            if (error) console.warn('Cloud category sync warning:', error);
          });
      } catch (e) {
        console.warn('Cloud category sync failed:', e);
      }
    }
    
    updateCategoryDropdowns(type);
    updateUI();
  }
}

function inlineDeleteCustomCategory(categoryName, type) {
  const confirmMsg = state.lang === 'el' 
    ? 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την κατηγορία;' 
    : 'Are you sure you want to delete this category?';
  if (!confirm(confirmMsg)) {
    return;
  }
  
  // Also check if any transactions use this category. If yes, warn the user
  const count = state.transactions.filter(t => t.category === categoryName).length;
  if (count > 0) {
    const warningMsg = state.lang === 'el'
      ? `Αυτή η κατηγορία χρησιμοποιείται σε ${count} συναλλαγές. Αν τη διαγράψετε, οι συναλλαγές θα παραμείνουν αλλά η κατηγορία δεν θα υπάρχει. Θέλετε να συνεχίσετε;`
      : `This category is used in ${count} transactions. If you delete it, the transactions will remain but the category will not exist. Do you want to continue?`;
    if (!confirm(warningMsg)) {
      return;
    }
  }
  
  state.categories = state.categories.filter(c => c.name !== categoryName);
  saveCategoriesToStorage();
  
  // Sync delete to cloud if enabled
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      state.supabaseClient
        .from('categories')
        .delete()
        .match({ user_id: state.currentUser.id, name: categoryName })
        .then(({ error }) => {
          if (error) console.warn('Cloud category delete warning:', error);
        });
    } catch (e) {
      console.warn('Cloud category delete failed:', e);
    }
  }
  
  updateCategoryDropdowns(type);
  updateUI();
}

function inlineRenameCategory(categoryName, type) {
  const cat = state.categories.find(c => c.name === categoryName);
  if (!cat) return;
  
  const currentDisplayName = getCategoryDisplayName(categoryName);
  const newName = prompt(
    state.lang === 'el' ? 'Εισάγετε το νέο όνομα της κατηγορίας:' : 'Enter the new category name:',
    currentDisplayName
  );
  
  if (newName === null) return; // User cancelled
  const trimmed = newName.trim();
  if (trimmed === '') {
    alert(state.lang === 'el' ? 'Το όνομα δεν μπορεί να είναι κενό!' : 'Category name cannot be empty!');
    return;
  }
  
  // If the display name did not change, do nothing
  if (trimmed === currentDisplayName) return;
  
  // Check if another category with the same name and type already exists
  const exists = state.categories.find(c => c.type === type && getCategoryDisplayName(c.name).toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    alert(
      state.lang === 'el' 
        ? 'Υπάρχει ήδη κατηγορία με αυτό το όνομα!' 
        : 'A category with this name already exists!'
    );
    return;
  }
  
  const oldName = cat.name;
  
  // Update category name
  cat.name = trimmed;
  
  // Update all transactions that were using the old category name
  let transactionsUpdated = 0;
  state.transactions.forEach(t => {
    if (t.category === oldName) {
      t.category = trimmed;
      transactionsUpdated++;
    }
  });
  
  saveCategoriesToStorage();
  
  if (transactionsUpdated > 0) {
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
  }
  
  // Sync to Cloud if enabled
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      // 1. Delete the old category from cloud
      state.supabaseClient
        .from('categories')
        .delete()
        .match({ user_id: state.currentUser.id, name: oldName })
        .then(({ error }) => {
          if (error) console.warn('Cloud category old name delete warning:', error);
          
          // 2. Upsert the renamed category
          state.supabaseClient
            .from('categories')
            .upsert({
              user_id: state.currentUser.id,
              name: cat.name,
              type: cat.type,
              icon: cat.icon,
              color: cat.color,
              hidden: cat.hidden
            }, { onConflict: 'user_id,name' })
            .then(({ error: upsertErr }) => {
              if (upsertErr) console.warn('Cloud category renamed sync warning:', upsertErr);
            });
        });
        
      // 3. Update transactions in Supabase if any were updated locally
      if (transactionsUpdated > 0) {
        state.supabaseClient
          .from('transactions')
          .update({ category: trimmed })
          .match({ user_id: state.currentUser.id, category: oldName })
          .then(({ error: transErr }) => {
            if (transErr) console.warn('Cloud transactions category update warning:', transErr);
          });
      }
    } catch (e) {
      console.warn('Cloud category rename sync failed:', e);
    }
  }
  
  updateCategoryDropdowns(type, true);
  updateUI();
}

window.inlineRenameCategory = inlineRenameCategory;
window.openEditCategoryDialog = openEditCategoryDialog;

let lastRenderedCategoryType = null;
let lastRenderedCategoryEditMode = null;

function updateCategoryDropdowns(type = 'expense', force = false) {
  deduplicateCategories();
  const grid = document.getElementById('category-picker-grid');
  if (!grid) return;
  
  // Performance optimization to prevent modal opening lag
  if (!force && lastRenderedCategoryType === type && lastRenderedCategoryEditMode === categoryPickerEditMode) {
    return;
  }
  
  grid.innerHTML = '';
  lastRenderedCategoryType = type;
  lastRenderedCategoryEditMode = categoryPickerEditMode;
  
  const currentCategory = document.getElementById('trans-category').value;
  let categoryExists = false;
  
  // Filter by type. In edit mode, show all. Otherwise, hide hidden categories.
  const visibleCategories = state.categories.filter(c => c.type === type && (categoryPickerEditMode || !c.hidden));
  
  // Sort categories alphabetically based on display name in the active language
  const lang = state.lang || 'el';
  visibleCategories.sort((a, b) => {
    const nameA = getCategoryDisplayName(a.name);
    const nameB = getCategoryDisplayName(b.name);
    return nameA.localeCompare(nameB, lang === 'el' ? 'el' : 'en', { sensitivity: 'base' });
  });
  
  visibleCategories.forEach(c => {
    const div = document.createElement('div');
    div.className = 'category-picker-item';
    div.setAttribute('data-category-name', c.name);
    
    const displayName = getCategoryDisplayName(c.name);
    
    if (categoryPickerEditMode) {
      div.classList.add('in-edit-mode');
      if (c.hidden) div.style.opacity = '0.55';
      div.innerHTML = `
        <span class="category-picker-icon">${c.icon}</span>
        <span class="category-picker-name">${displayName}</span>
        <span class="category-delete-badge" title="${state.lang === 'el' ? 'Διαγραφή' : 'Delete'}">
          <i class="fa-solid fa-xmark"></i>
        </span>
      `;
      // Tap the badge = delete
      div.querySelector('.category-delete-badge').addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        inlineDeleteCustomCategory(c.name, type);
      });
      // Tap the card body = edit
      div.onclick = () => openEditCategoryDialog(c.name, type);
    } else {
      if (c.name === currentCategory) {
        div.classList.add('selected');
        categoryExists = true;
      }
      div.innerHTML = `<span class="category-picker-icon">${c.icon}</span><span class="category-picker-name">${displayName}</span>`;
      div.onclick = () => selectCategory(c.name, c.icon, c.color, true);
    }
    
    grid.appendChild(div);
  });
  
  // "+" New Category box (always visible, both in normal and edit mode)
  const addBox = document.createElement('div');
  addBox.className = 'category-picker-item category-picker-add';
  if (categoryPickerEditMode) {
    addBox.innerHTML = `<span class="category-picker-icon" style="font-size:28px;color:var(--accent);">+</span><span class="category-picker-name">${state.lang === 'el' ? 'Νέα Κατηγορία' : 'New Category'}</span>`;
    addBox.onclick = () => openNewCategoryDialog(type);
  } else {
    addBox.innerHTML = `<span class="category-picker-icon" style="font-size:28px;color:var(--accent);">+</span><span class="category-picker-name">${state.lang === 'el' ? 'Νέα Κατηγορία' : 'New Category'}</span>`;
    addBox.onclick = () => openNewCategoryDialog(type);
  }
  grid.appendChild(addBox);
  
  if (!categoryPickerEditMode && !categoryExists && currentCategory !== '') {
    document.getElementById('trans-category').value = '';
    updateCategoryDisplay();
  }
}


function selectCategory(name, icon, color, isManual = false) {
  document.getElementById('trans-category').value = name;
  document.querySelectorAll('.category-picker-item').forEach(item => {
    item.classList.remove('selected');
    if (item.getAttribute('data-category-name') === name) {
      item.classList.add('selected');
    }
  });
  
  // Reset subcategory selection when category changes
  document.getElementById('trans-subcategory-select').value = '';
  const customInput = document.getElementById('trans-subcategory-custom');
  if (customInput) customInput.value = '';
  
  updateCategoryDisplay();
  updateSubcategorySuggestions();
  updateSubcategoryRowVisibility();
  
  if (isManual) {
    closeModal('category-picker-modal');
    openSubcategoryModal();
  } else {
    closeModal('category-picker-modal');
  }
}

function selectSubcategory(name) {
  document.getElementById('trans-subcategory-select').value = name;
  const customInput = document.getElementById('trans-subcategory-custom');
  if (customInput) customInput.value = '';
  
  updateCategoryDisplay();
  updateSubcategoryRowVisibility();
  closeModal('subcategory-picker-modal');
}

function openCategoryModal() {
  if (window.autocompleteJustSelected) return;
  const form = document.getElementById('transaction-form');
  if (form && form.getAttribute('data-readonly') === 'true') return;
  const currentType = document.querySelector('.type-tab-btn.active').getAttribute('data-type');
  
  // Reset edit mode on modal open
  categoryPickerEditMode = false;
  const btn = document.getElementById('btn-toggle-cat-edit');
  if (btn) {
    btn.textContent = state.lang === 'el' ? 'Διαχείριση' : 'Manage';
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--text-secondary)';
  }
  
  // Force update to prevent any stale flash or lag when switching tabs
  updateCategoryDropdowns(currentType, true);
  closeNewCategoryDialog(); // Reset dialog state
  openModal('category-picker-modal');
}

// New Category inline dialog state
let newCategoryDialogType = 'expense';
let newCategorySelectedEmoji = '💸';
let editingCategoryName = null; // null = new, string = editing existing

const EMOJI_OPTIONS = ['💰','💸','🏡','🛒','🚗','❤️','🎉','🧾','🏋️','👕','🚇','💻','🎬','🎓','🧩','🤑','🎁','💼','💶','🏛️','📦','🏅','👨','💵','🔧','⭐','🔥','🎯','📱','☕','🎵','✈️','🏖️','📚','🐶','🌱','💡','🗂️','🛠️','🎮'];

function openEditCategoryDialog(categoryName, type) {
  const cat = state.categories.find(c => c.name === categoryName);
  if (!cat) return;
  
  editingCategoryName = categoryName;
  newCategoryDialogType = type;
  newCategorySelectedEmoji = cat.icon || (type === 'income' ? '💰' : '💸');
  
  const dialog = document.getElementById('new-category-inline-dialog');
  const nameInput = document.getElementById('new-cat-name-input');
  const titleEl = document.getElementById('new-cat-dialog-title');
  
  if (!dialog || !nameInput) return;
  
  if (titleEl) {
    titleEl.textContent = state.lang === 'el' ? 'Επεξεργασία Κατηγορίας' : 'Edit Category';
  }
  
  nameInput.value = getCategoryDisplayName(categoryName);
  nameInput.placeholder = state.lang === 'el' ? 'Όνομα κατηγορίας' : 'Category name';
  
  // Render emoji grid with the current icon pre-selected
  const emojiGrid = document.getElementById('new-cat-emoji-grid');
  if (emojiGrid) {
    emojiGrid.innerHTML = '';
    // Ensure the current emoji is available
    const emojiList = EMOJI_OPTIONS.includes(cat.icon) ? EMOJI_OPTIONS : [cat.icon, ...EMOJI_OPTIONS];
    emojiList.forEach(emoji => {
      const btn = document.createElement('span');
      btn.textContent = emoji;
      btn.style.cssText = `font-size:22px; padding:6px 8px; cursor:pointer; border-radius:8px; transition:all 0.15s; border:2px solid ${emoji === newCategorySelectedEmoji ? 'var(--accent)' : 'transparent'}; background:${emoji === newCategorySelectedEmoji ? 'var(--accent-light)' : 'transparent'};`;
      btn.onclick = () => {
        newCategorySelectedEmoji = emoji;
        emojiGrid.querySelectorAll('span').forEach(s => {
          s.style.borderColor = 'transparent';
          s.style.background = 'transparent';
        });
        btn.style.borderColor = 'var(--accent)';
        btn.style.background = 'var(--accent-light)';
      };
      emojiGrid.appendChild(btn);
    });
  }
  
  const saveBtn = dialog.querySelector('.btn-primary');
  if (saveBtn) saveBtn.textContent = state.lang === 'el' ? 'Αποθήκευση' : 'Save';
  const cancelBtn = dialog.querySelector('.btn-secondary');
  if (cancelBtn) cancelBtn.textContent = state.lang === 'el' ? 'Άκυρο' : 'Cancel';
  
  dialog.style.display = 'block';
  setTimeout(() => nameInput.focus(), 100);
}


function openNewCategoryDialog(type) {
  editingCategoryName = null; // ensure we are in create mode
  newCategoryDialogType = type;
  newCategorySelectedEmoji = type === 'income' ? '💰' : '💸';
  
  const dialog = document.getElementById('new-category-inline-dialog');
  const nameInput = document.getElementById('new-cat-name-input');
  const titleEl = document.getElementById('new-cat-dialog-title');
  
  if (!dialog || !nameInput) return;
  
  // Update title based on type
  if (titleEl) {
    titleEl.textContent = type === 'income' 
      ? (state.lang === 'el' ? 'Νέα Κατηγορία Εσόδου' : 'New Income Category')
      : (state.lang === 'el' ? 'Νέα Κατηγορία Εξόδου' : 'New Expense Category');
  }
  
  nameInput.value = '';
  nameInput.placeholder = state.lang === 'el' ? 'Όνομα κατηγορίας' : 'Category name';
  
  // Render emoji grid
  const emojiGrid = document.getElementById('new-cat-emoji-grid');
  if (emojiGrid) {
    emojiGrid.innerHTML = '';
    EMOJI_OPTIONS.forEach(emoji => {
      const btn = document.createElement('span');
      btn.textContent = emoji;
      btn.style.cssText = `font-size:22px; padding:6px 8px; cursor:pointer; border-radius:8px; transition:all 0.15s; border:2px solid ${emoji === newCategorySelectedEmoji ? 'var(--accent)' : 'transparent'}; background:${emoji === newCategorySelectedEmoji ? 'var(--accent-light)' : 'transparent'};`;
      btn.onclick = () => {
        newCategorySelectedEmoji = emoji;
        emojiGrid.querySelectorAll('span').forEach(s => {
          s.style.borderColor = 'transparent';
          s.style.background = 'transparent';
        });
        btn.style.borderColor = 'var(--accent)';
        btn.style.background = 'var(--accent-light)';
      };
      emojiGrid.appendChild(btn);
    });
  }
  
  // Update save button text
  const saveBtn = dialog.querySelector('.btn-primary');
  if (saveBtn) {
    saveBtn.textContent = state.lang === 'el' ? 'Αποθήκευση' : 'Save';
  }
  const cancelBtn = dialog.querySelector('.btn-secondary');
  if (cancelBtn) {
    cancelBtn.textContent = state.lang === 'el' ? 'Άκυρο' : 'Cancel';
  }
  
  dialog.style.display = 'block';
  setTimeout(() => nameInput.focus(), 100);
}

function closeNewCategoryDialog() {
  const dialog = document.getElementById('new-category-inline-dialog');
  if (dialog) dialog.style.display = 'none';
  newCategoryDialogType = 'expense';
  newCategorySelectedEmoji = '💸';
  editingCategoryName = null;
}

function saveNewCategoryFromPicker() {
  const nameInput = document.getElementById('new-cat-name-input');
  const name = nameInput ? nameInput.value.trim() : '';
  
  if (!name) {
    alert(TRANSLATIONS[state.lang]['alert_enter_category_name']);
    return;
  }
  
  // === EDIT MODE: Update existing category ===
  if (editingCategoryName) {
    const cat = state.categories.find(c => c.name === editingCategoryName);
    if (!cat) {
      closeNewCategoryDialog();
      return;
    }
    
    const oldName = cat.name;
    const currentDisplayName = getCategoryDisplayName(oldName);
    const nameChanged = name !== currentDisplayName;
    const iconChanged = newCategorySelectedEmoji !== cat.icon;
    
    if (!nameChanged && !iconChanged) {
      closeNewCategoryDialog();
      return;
    }
    
    // Check for name collision with another category (only if name changed)
    if (nameChanged) {
      const collision = state.categories.find(c => c.name !== oldName && getCategoryDisplayName(c.name).toLowerCase() === name.toLowerCase() && c.type === cat.type);
      if (collision) {
        alert(state.lang === 'el' ? 'Υπάρχει ήδη κατηγορία με αυτό το όνομα!' : 'A category with this name already exists!');
        return;
      }
    }
    
    // Update name and icon
    cat.name = name;
    cat.icon = newCategorySelectedEmoji;
    
    // Update transactions using old name
    let transactionsUpdated = 0;
    if (nameChanged) {
      state.transactions.forEach(t => {
        if (t.category === oldName) {
          t.category = name;
          transactionsUpdated++;
        }
      });
      if (transactionsUpdated > 0) {
        localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
      }
    }
    
    saveCategoriesToStorage();
    
    // Cloud sync
    if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
      try {
        if (nameChanged) {
          // Delete old, upsert new
          state.supabaseClient.from('categories').delete().match({ user_id: state.currentUser.id, name: oldName })
            .then(() => {
              state.supabaseClient.from('categories').upsert({ user_id: state.currentUser.id, name: cat.name, type: cat.type, icon: cat.icon, color: cat.color, hidden: cat.hidden }, { onConflict: 'user_id,name' })
                .then(({ error }) => { if (error) console.warn('Cloud category rename sync warning:', error); });
            });
          if (transactionsUpdated > 0) {
            state.supabaseClient.from('transactions').update({ category: name }).match({ user_id: state.currentUser.id, category: oldName })
              .then(({ error }) => { if (error) console.warn('Cloud transactions rename warning:', error); });
          }
        } else {
          // Only icon changed
          state.supabaseClient.from('categories').upsert({ user_id: state.currentUser.id, name: cat.name, type: cat.type, icon: cat.icon, color: cat.color, hidden: cat.hidden }, { onConflict: 'user_id,name' })
            .then(({ error }) => { if (error) console.warn('Cloud category icon sync warning:', error); });
        }
      } catch (e) {
        console.warn('Cloud category edit sync failed:', e);
      }
    }
    
    closeNewCategoryDialog();
    updateCategoryDropdowns(newCategoryDialogType, true);
    updateUI();
    showSyncToast(state.lang === 'el' ? '✓ Κατηγορία ενημερώθηκε' : '✓ Category updated', 2000);
    return;
  }
  
  // === CREATE MODE: New category ===
  // Check for duplicate
  const exists = state.categories.find(c => 
    c.name && c.name.toUpperCase() === name.toUpperCase()
  );
  if (exists) {
    alert(TRANSLATIONS[state.lang]['alert_category_exists']);
    return;
  }
  
  // Create new category
  const newCategory = {
    name: name,
    type: newCategoryDialogType,
    icon: newCategorySelectedEmoji,
    color: getRandomColor(),
    user_id: state.currentUser ? state.currentUser.id : null
  };
  
  state.categories.push(newCategory);
  saveCategoriesToStorage();
  
  // Sync to cloud if enabled
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      state.supabaseClient
        .from('categories')
        .upsert({
          user_id: state.currentUser.id,
          name: newCategory.name,
          type: newCategory.type,
          icon: newCategory.icon,
          color: newCategory.color
        }, { onConflict: 'user_id,name' })
        .then(({ error }) => {
          if (error) console.warn('Cloud category sync warning:', error);
        });
    } catch (e) {
      console.warn('Cloud category sync failed:', e);
    }
  }
  
  // Close dialog
  closeNewCategoryDialog();
  
  // Refresh grid
  updateCategoryDropdowns(newCategoryDialogType);
  
  // Auto-select the new category
  document.getElementById('trans-category').value = newCategory.name;
  document.querySelectorAll('.category-picker-item').forEach(item => {
    item.classList.remove('selected');
    if (item.getAttribute('data-category-name') === newCategory.name) {
      item.classList.add('selected');
    }
  });
  
  updateCategoryDisplay();
  updateSubcategorySuggestions();
  updateSubcategoryRowVisibility();
  
  // Close the category picker modal
  closeModal('category-picker-modal');
}

function openSubcategoryModal() {
  if (window.autocompleteJustSelected) return;
  const form = document.getElementById('transaction-form');
  if (form && form.getAttribute('data-readonly') === 'true') return;
  if(!document.getElementById('trans-category').value) {
    alert(TRANSLATIONS[state.lang]['alert_select_category_first']);
    return;
  }
  updateSubcategorySuggestions();
  openModal('subcategory-picker-modal');
}

function getAccountDisplayName(accOrName) {
  if (!accOrName) return '';
  const name = typeof accOrName === 'string' ? accOrName : accOrName.name;
  const type = typeof accOrName === 'object' ? accOrName.type : null;
  const lowerName = name.toLowerCase().trim();
  const lang = state.lang || 'el';
  
  if (lang === 'el') {
    if (lowerName === 'cash' || lowerName === 'μετρητά' || type === 'cash') return 'Μετρητά';
    if (lowerName === 'bank account' || lowerName === 'bank' || lowerName === 'τράπεζα' || type === 'bank') return 'Τράπεζα';
    if (lowerName === 'card' || lowerName === 'κάρτα' || type === 'card') return 'Κάρτα';
  } else {
    if (lowerName === 'cash' || lowerName === 'μετρητά' || type === 'cash') return 'Cash';
    if (lowerName === 'bank account' || lowerName === 'bank' || lowerName === 'τράπεζα' || type === 'bank') return 'Bank Account';
    if (lowerName === 'card' || lowerName === 'κάρτα' || type === 'card') return 'Card';
  }
  return name;
}

let _currentAccountPickerTarget = 'from';

function openAccountPickerModal(target) {
  if (window.autocompleteJustSelected) return;
  const form = document.getElementById('transaction-form');
  if (form && form.getAttribute('data-readonly') === 'true') return;
  _currentAccountPickerTarget = target;
  
  const titleEl = document.getElementById('account-picker-title');
  if (titleEl) {
    titleEl.textContent = state.lang === 'el' ? 'Επιλογή τρόπου πληρωμής' : 'Select Payment Method';
  }
  
  renderAccountPickerOptions();
  openModal('account-picker-modal');
}

function renderAccountPickerOptions() {
  const container = document.getElementById('account-picker-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  const currentVal = document.getElementById(`trans-account-${_currentAccountPickerTarget}`).value;
  const icons = { cash: '💵', bank: '🏦', card: '💳' };
  
  state.accounts.forEach(acc => {
    const item = document.createElement('div');
    item.className = 'account-picker-item';
    if (acc.name === currentVal) {
      item.classList.add('selected');
    }
    
    const icon = icons[acc.type] || '💳';
    const displayName = getAccountDisplayName(acc);
    
    item.innerHTML = `
      <span class="account-picker-item-icon">${icon}</span>
      <span class="account-picker-item-name">${displayName}</span>
    `;
    
    item.onclick = () => selectAccountOption(acc.name);
    container.appendChild(item);
  });
}

function selectAccountOption(name) {
  const targetId = `trans-account-${_currentAccountPickerTarget}`;
  document.getElementById(targetId).value = name;
  
  updateAccountTriggerDisplay(_currentAccountPickerTarget);
  closeModal('account-picker-modal');
}

function updateAccountTriggerDisplay(target) {
  const input = document.getElementById(`trans-account-${target}`);
  if (!input) return;
  const value = input.value;
  const triggerDisplay = document.getElementById(`trans-account-${target}-display`);
  if (!triggerDisplay) return;
  
  if (!value) {
    triggerDisplay.innerHTML = `<span class="custom-select-placeholder">${state.lang === 'el' ? 'Επιλέξτε...' : 'Select...'}</span>`;
  } else {
    const acc = state.accounts.find(a => a.name === value);
    const icons = { cash: '💵', bank: '🏦', card: '💳' };
    const icon = acc ? (icons[acc.type] || '💳') : '💳';
    const name = acc ? getAccountDisplayName(acc) : value;
    triggerDisplay.innerHTML = `<span class="custom-select-icon" style="margin-right: 8px;">${icon}</span><span class="custom-select-text">${name}</span>`;
  }
}

function updateAccountDropdowns() {
  updateAccountTriggerDisplay('from');
  updateAccountTriggerDisplay('to');
}

window.getAccountDisplayName = getAccountDisplayName;
window.openAccountPickerModal = openAccountPickerModal;
window.updateAccountTriggerDisplay = updateAccountTriggerDisplay;
window.updateAccountDropdowns = updateAccountDropdowns;

function openSupabaseSettings() {
  updateSupabaseUserModal();
  openModal('supabase-modal');
}

// Floating toast for background sync feedback
let _syncToastTimer = null;
function showSyncToast(message, autoDismissMs = 0) {
  let toast = document.getElementById('sync-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sync-toast';
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 20px; z-index: 99999;
      background: var(--card-bg, #1e1e2e); color: var(--text-primary, #fff);
      border: 1px solid var(--accent, #7c6af7); border-radius: 14px;
      padding: 12px 18px; font-size: 13px; font-weight: 600;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      display: flex; align-items: center; gap: 10px;
      transform: translateY(80px); opacity: 0;
      transition: transform 0.3s cubic-bezier(.34,1.56,.64,1), opacity 0.3s ease;
      max-width: 280px;
    `;
    document.body.appendChild(toast);
  }
  // Animated pulse dot
  toast.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:var(--accent,#7c6af7);display:inline-block;animation:syncPulse 1s infinite;flex-shrink:0;"></span><span>${message}</span>`;
  // Inject keyframes if not already
  if (!document.getElementById('sync-toast-styles')) {
    const s = document.createElement('style');
    s.id = 'sync-toast-styles';
    s.textContent = `@keyframes syncPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.4)} }`;
    document.head.appendChild(s);
  }
  // Show
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });
  // Update header sync icon based on message type
  if (message.startsWith('✅')) {
    updateHeaderSyncIcon('synced');
    const dot = toast.querySelector('span');
    if (dot) dot.style.animation = 'none';
  } else if (message.startsWith('⚠️')) {
    updateHeaderSyncIcon('error');
    const dot = toast.querySelector('span');
    if (dot) dot.style.animation = 'none';
  } else if (message.startsWith('☁️')) {
    updateHeaderSyncIcon('syncing');
  }
  if (_syncToastTimer) clearTimeout(_syncToastTimer);
  if (autoDismissMs > 0) {
    _syncToastTimer = setTimeout(() => {
      toast.style.transform = 'translateY(80px)';
      toast.style.opacity = '0';
    }, autoDismissMs);
  }
}
function updateHeaderSyncIcon(state_) {
  state.syncStatus = state_;
  // state_: 'offline' | 'idle' | 'syncing' | 'synced' | 'success' | 'error'
  const dot  = document.getElementById('header-sync-dot');
  const icon = document.getElementById('header-sync-cloud-icon');
  if (!dot || !icon) return;

  // Normalize state for visual elements and translations
  let normalized = state_;
  if (state_ === 'success') normalized = 'synced';
  if (state_ === 'idle') normalized = 'offline';

  const colors = { 
    offline: '#9e9e9e', 
    syncing: '#ffd600', 
    synced: '#4caf50', 
    error: '#ef5350' 
  };
  dot.style.background = colors[normalized] || '#9e9e9e';
  
  // Animate dot on sync
  if (normalized === 'syncing') {
    dot.style.animation = 'syncDotPulse 0.8s infinite alternate';
  } else {
    dot.style.animation = 'none';
  }
  
  // Inject dot keyframes once
  if (!document.getElementById('sync-dot-styles')) {
    const s = document.createElement('style');
    s.id = 'sync-dot-styles';
    s.textContent = `@keyframes syncDotPulse{from{opacity:1;transform:scale(1)}to{opacity:.3;transform:scale(1.6)}}`;
    document.head.appendChild(s);
  }
  
  // Tooltip
  const btn = document.getElementById('header-sync-icon');
  const lang = state.lang || 'el';
  const labels = lang === 'en' ? {
    offline: 'Local Storage',
    syncing: 'Syncing...',
    synced: 'Synced ✅',
    error: 'Sync Error ⚠️'
  } : {
    offline: 'Τοπική αποθήκευση',
    syncing: 'Συγχρονισμός...',
    synced: 'Συγχρονισμένο ✅',
    error: 'Σφάλμα συγχρονισμού ⚠️'
  };
  if (btn) btn.title = labels[normalized] || (lang === 'en' ? 'Sync' : 'Συγχρονισμός');
  
  // Update sync status text in settings
  const syncStatusEl = document.getElementById('val_sync_status');
  if (syncStatusEl) {
    const statusLabels = lang === 'en' ? {
      offline: 'Local Storage',
      syncing: 'Syncing...',
      synced: 'Active',
      error: 'Error'
    } : {
      offline: 'Τοπική Αποθήκευση',
      syncing: 'Συγχρονισμός...',
      synced: 'Ενεργός',
      error: 'Σφάλμα'
    };
    syncStatusEl.textContent = statusLabels[normalized] || (lang === 'en' ? 'Local Storage' : 'Τοπική Αποθήκευση');
    
    // Update color based on status
    if (normalized === 'synced') {
      syncStatusEl.style.color = '#4caf50'; // Green for active
    } else if (normalized === 'error') {
      syncStatusEl.style.color = '#ef5350'; // Red for error
    } else {
      syncStatusEl.style.color = 'var(--text-secondary)';
    }
  }
}

function promiseTimeout(promise, ms) {
  let timeout = new Promise((resolve, reject) => {
    let id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error('Διακοπή λόγω καθυστέρησης (Timeout - Η υπηρεσία Cloud καθυστερεί να απαντήσει)'));
    }, ms);
  });
  return Promise.race([promise, timeout]);
}

// ============================================================
// UTILITIES
// ============================================================
function formatCurrency(val) {
  if (isNaN(val)) return '0,00';
  return parseFloat(val).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getRandomColor() {
  const colors = ['#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3','#03a9f4','#00bcd4','#009688','#4caf50','#8bc34a','#ffc107','#ff9800','#ff5722','#607d8b'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function formatISODateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatShortDate(date) {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = String(date.getFullYear()).slice(-2);
  return `${d}.${m}.${y}`;
}

function updateExportSheetDateLabels() {
  const now = new Date();
  
  const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const curMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const curMonthEl = document.getElementById('export-range-current-month');
  if (curMonthEl) curMonthEl.textContent = `(${formatShortDate(curMonthStart)} ~ ${formatShortDate(curMonthEnd)})`;
    
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const prevMonthEl = document.getElementById('export-range-prev-month');
  if (prevMonthEl) prevMonthEl.textContent = `(${formatShortDate(prevMonthStart)} ~ ${formatShortDate(prevMonthEnd)})`;
    
  const curYearStart = new Date(now.getFullYear(), 0, 1);
  const curYearEnd = now;
  const curYearEl = document.getElementById('export-range-current-year');
  if (curYearEl) curYearEl.textContent = `(${formatShortDate(curYearStart)} ~ ${formatShortDate(curYearEnd)})`;
    
  const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const prevYearEnd = new Date(now.getFullYear() - 1, 11, 31);
  const prevYearEl = document.getElementById('export-range-prev-year');
  if (prevYearEl) prevYearEl.textContent = `(${formatShortDate(prevYearStart)} ~ ${formatShortDate(prevYearEnd)})`;
}

let selectedExportPeriod = 'current-month';

function openExportPeriodSheet() {
  if (typeof closeSearchBottomSheet === 'function') {
    closeSearchBottomSheet(true);
  }
  
  updateExportSheetDateLabels();
  
  const backdrop = document.getElementById('export-period-backdrop');
  if (backdrop) backdrop.classList.add('active');
  
  const sheet = document.getElementById('export-period-bottom-sheet');
  if (sheet) sheet.classList.add('active');
  
  selectExportOption('current-month');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const fromEl = document.getElementById('export-custom-from');
  const toEl = document.getElementById('export-custom-to');
  if (fromEl) fromEl.value = todayStr;
  if (toEl) toEl.value = todayStr;
}

function closeExportPeriodSheet() {
  const sheet = document.getElementById('export-period-bottom-sheet');
  if (sheet) sheet.classList.remove('active');
  
  const backdrop = document.getElementById('export-period-backdrop');
  if (backdrop) backdrop.classList.remove('active');
}

function selectExportOption(option) {
  selectedExportPeriod = option;
  
  const options = ['current-month', 'prev-month', 'current-year', 'prev-year', 'all', 'custom'];
  options.forEach(opt => {
    const el = document.getElementById(`export-opt-${opt}`);
    if (el) {
      el.classList.toggle('active', opt === option);
    }
  });
  
  const customContainer = document.getElementById('export-custom-range-container');
  if (customContainer) {
    customContainer.style.display = option === 'custom' ? 'flex' : 'none';
  }
}

function confirmExcelExport() {
  const now = new Date();
  let startDate = null;
  let endDate = null;
  
  if (selectedExportPeriod === 'current-month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (selectedExportPeriod === 'prev-month') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (selectedExportPeriod === 'current-year') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = now;
  } else if (selectedExportPeriod === 'prev-year') {
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    endDate = new Date(now.getFullYear() - 1, 11, 31);
  } else if (selectedExportPeriod === 'custom') {
    const fromStr = document.getElementById('export-custom-from').value;
    const toStr = document.getElementById('export-custom-to').value;
    if (!fromStr || !toStr) {
      alert(state.lang === 'en' ? 'Please select both start and end dates!' : 'Παρακαλώ επιλέξτε ημερομηνία έναρξης και λήξης!');
      return;
    }
    if (fromStr > toStr) {
      alert(state.lang === 'en' ? 'Start date must be before end date!' : 'Η ημερομηνία έναρξης πρέπει να είναι προγενέστερη της ημερομηνίας λήξης!');
      return;
    }
    exportToExcel(fromStr, toStr);
    return;
  }
  
  const startStr = startDate ? formatISODateLocal(startDate) : null;
  const endStr = endDate ? formatISODateLocal(endDate) : null;
  
  exportToExcel(startStr, endStr);
}

function exportToExcel(startDate = null, endDate = null) {
  if (!state.transactions.length) {
    const msg = state.lang === 'en' ? 'No transactions to export!' : 'Δεν υπάρχουν συναλλαγές!';
    alert(msg);
    return;
  }
  
  let transactionsToExport = state.transactions;
  if (startDate || endDate) {
    transactionsToExport = state.transactions.filter(t => {
      if (!t.date) return false;
      const tDate = t.date.split('T')[0].split(' ')[0];
      if (startDate && tDate < startDate) return false;
      if (endDate && tDate > endDate) return false;
      return true;
    });
  }
  
  if (!transactionsToExport.length) {
    const msg = TRANSLATIONS[state.lang]['export_no_data_range'] || 'Δεν υπάρχουν συναλλαγές σε αυτή την περίοδο!';
    alert(msg);
    return;
  }
  
  const rows = transactionsToExport.map(t => ({
    'Ημερομηνία': t.date, 'Τύπος': t.type === 'expense' ? 'Expense' : (t.type === 'income' ? 'Income' : 'Transfer'),
    'Ποσό': t.amount, 'Κατηγορία': t.category, 'Υποκατηγορία': t.subcategory || '',
    'Λογαριασμός': t.account_from, 'Σημείωση': t.note || '',
  }));
  
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Συναλλαγές');
  XLSX.writeFile(wb, `Budget_Assistant_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  closeExportPeriodSheet();
}

// ============================================================
// FEATURE: TRANSACTION SEARCH AND FILTERS
// ============================================================
let searchResultLimit = 50;

function loadMoreSearchResults() {
  searchResultLimit += 100;
  handleSearchChange(false);
}

function toggleSearchFiltersPanel() {
  const panel = document.getElementById('search-filters-panel');
  const btn = document.getElementById('search-toggle-btn');
  if (!panel) {
    console.warn('[filters] panel element not found!');
    return;
  }
  const isActive = panel.classList.toggle('active');
  console.log('[filters] toggled, active=', isActive);
  if (btn) btn.classList.toggle('active', isActive);
}

function openSearchOverlay() {
  ensureHistoryPushed();
  const overlay = document.getElementById('search-overlay');
  if (overlay) overlay.classList.add('active');

  searchResultLimit = 50;

  // Collapse filters panel by default
  const panel = document.getElementById('search-filters-panel');
  if (panel) panel.classList.remove('active');
  const btn = document.querySelector('.search-settings-btn-modern');
  if (btn) btn.classList.remove('active');

  // Populate dynamic dropdown filters
  populateSearchFilterDropdowns();

  // Reset inputs and run initial query to show all
  resetSearchFilters();

  // Trigger initial search to show all transactions
  handleSearchChange();
}

function closeSearchOverlay() {
  const overlay = document.getElementById('search-overlay');
  if (overlay) overlay.classList.remove('active');
  closeSearchBottomSheet();
}

// State for custom slider dragging
let sliderMinVal = 0;
let sliderMaxVal = 1000;
let currentMinVal = 0;
let currentMaxVal = 1000;
let isDraggingMin = false;
let isDraggingMax = false;

// 1. Period selection logic
function selectPeriodFilter(periodType, element) {
  const chips = document.querySelectorAll('#period-chips-container .filter-chip');
  chips.forEach(c => c.classList.remove('active', 'active-blue'));
  
  const customInputs = document.getElementById('custom-date-inputs');
  
  if (element && element.getAttribute('data-active') === 'true') {
    element.removeAttribute('data-active');
    const startEl = document.getElementById('search-filter-date-start');
    if (startEl) startEl.value = '';
    const endEl = document.getElementById('search-filter-date-end');
    if (endEl) endEl.value = '';
    if (customInputs) customInputs.style.display = 'none';
  } else {
    chips.forEach(c => c.removeAttribute('data-active'));
    if (element) {
      element.classList.add(periodType === 'Custom Period' || periodType === 'Προσαρμοσμένο' ? 'active-blue' : 'active');
      element.setAttribute('data-active', 'true');
    }
    
    const today = new Date();
    let dateStart = '';
    let dateEnd = '';
    
    if (periodType === 'Weekly' || periodType === 'Εβδομάδα') {
      const start = new Date();
      start.setDate(today.getDate() - 7);
      dateStart = start.toISOString().split('T')[0];
      dateEnd = today.toISOString().split('T')[0];
      if (customInputs) customInputs.style.display = 'none';
    } else if (periodType === 'Monthly' || periodType === 'Μήνας') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      dateStart = start.toISOString().split('T')[0];
      dateEnd = today.toISOString().split('T')[0];
      if (customInputs) customInputs.style.display = 'none';
    } else if (periodType === 'Annually' || periodType === 'Έτος') {
      const start = new Date(today.getFullYear(), 0, 1);
      dateStart = start.toISOString().split('T')[0];
      dateEnd = today.toISOString().split('T')[0];
      if (customInputs) customInputs.style.display = 'none';
    } else if (periodType === 'Custom Period' || periodType === 'Προσαρμοσμένο') {
      if (customInputs) customInputs.style.display = 'flex';
      const customStart = document.getElementById('custom-date-start');
      if (customStart) dateStart = customStart.value;
      const customEnd = document.getElementById('custom-date-end');
      if (customEnd) dateEnd = customEnd.value;
    }
    
    const startEl = document.getElementById('search-filter-date-start');
    if (startEl) startEl.value = dateStart;
    const endEl = document.getElementById('search-filter-date-end');
    if (endEl) endEl.value = dateEnd;
  }
  
  handleSearchChange();
}

function applyCustomDates() {
  const customStart = document.getElementById('custom-date-start');
  const customEnd = document.getElementById('custom-date-end');
  const startVal = customStart ? customStart.value : '';
  const endVal = customEnd ? customEnd.value : '';
  
  const startEl = document.getElementById('search-filter-date-start');
  if (startEl) startEl.value = startVal;
  const endEl = document.getElementById('search-filter-date-end');
  if (endEl) endEl.value = endVal;
  
  handleSearchChange();
}

function resetPeriodFilter() {
  const chips = document.querySelectorAll('#period-chips-container .filter-chip');
  chips.forEach(c => {
    c.classList.remove('active', 'active-blue');
    c.removeAttribute('data-active');
  });
  
  const startEl = document.getElementById('search-filter-date-start');
  if (startEl) startEl.value = '';
  const endEl = document.getElementById('search-filter-date-end');
  if (endEl) endEl.value = '';
  
  const customStart = document.getElementById('custom-date-start');
  if (customStart) customStart.value = '';
  const customEnd = document.getElementById('custom-date-end');
  if (customEnd) customEnd.value = '';
  
  const customInputs = document.getElementById('custom-date-inputs');
  if (customInputs) customInputs.style.display = 'none';
  
  handleSearchChange();
}

// 2. Account selection logic
function selectAccountChipFilter(accName, element) {
  const chips = document.querySelectorAll('#account-chips-container .filter-chip');
  const filterInput = document.getElementById('search-filter-account');
  
  if (element && element.classList.contains('active')) {
    element.classList.remove('active');
    filterInput.value = '';
  } else {
    chips.forEach(c => c.classList.remove('active'));
    if (element) element.classList.add('active');
    filterInput.value = accName;
  }
  handleSearchChange();
}

// 3. Category selection logic
let currentCategoryType = 'expense';

function setCategoryTypeFilter(type) {
  currentCategoryType = type;
  
  const segExpense = document.getElementById('seg-tab-expense');
  const segIncome = document.getElementById('seg-tab-income');
  if (type === 'expense') {
    if (segExpense) segExpense.className = 'segmented-tab active';
    if (segIncome) segIncome.className = 'segmented-tab';
    document.getElementById('category-segmented-control')?.style.setProperty('--segmented-active-bg', 'var(--red-negative, #ef5350)');
  } else {
    if (segExpense) segExpense.className = 'segmented-tab';
    if (segIncome) segIncome.className = 'segmented-tab active income-active';
    document.getElementById('category-segmented-control')?.style.setProperty('--segmented-active-bg', 'var(--blue-positive, #3b82f6)');
  }
  
  document.getElementById('search-filter-type').value = type;
  resetCategoryFilter(false);
  renderCategoryChips();
  handleSearchChange();
}

function selectCategoryChipFilter(catName, element) {
  const chips = document.querySelectorAll('#category-chips-container .filter-chip');
  const filterInput = document.getElementById('search-filter-category');
  
  if (element && element.classList.contains('active')) {
    element.classList.remove('active');
    filterInput.value = '';
    
    const subWrapper1 = document.getElementById('subcategory-chips-wrapper');
    if (subWrapper1) subWrapper1.style.display = 'none';
    const subFilter1 = document.getElementById('search-filter-subcategory');
    if (subFilter1) subFilter1.value = '';
  } else {
    chips.forEach(c => c.classList.remove('active'));
    if (element) element.classList.add('active');
    filterInput.value = catName;
    
    const categoryObj = state.categories.find(c => c.name === catName && c.type === currentCategoryType);
    if (categoryObj && categoryObj.subcategories && categoryObj.subcategories.length > 0) {
      renderSubcategoryChips(categoryObj.subcategories);
    } else {
      const subWrapper2 = document.getElementById('subcategory-chips-wrapper');
      if (subWrapper2) subWrapper2.style.display = 'none';
      const subFilter2 = document.getElementById('search-filter-subcategory');
      if (subFilter2) subFilter2.value = '';
    }
  }
  handleSearchChange();
}

// Category tag checkmark helper
function getCategorySelectionIconHTML(catName) {
  const selectedCat = document.getElementById('search-filter-category').value;
  return selectedCat === catName ? ' <i class="fa-solid fa-check" style="font-size:10px; margin-left: 2px;"></i>' : '';
}

function selectSubcategoryChipFilter(subName, element) {
  const chips = document.querySelectorAll('#subcategory-chips-container .filter-chip');
  const filterInput = document.getElementById('search-filter-subcategory');
  
  chips.forEach(c => c.classList.remove('active'));
  if (element) element.classList.add('active');
  
  filterInput.value = (subName === 'all' || subName === 'Όλες') ? '' : subName;
  handleSearchChange();
}

function resetCategoryFilter(triggerSearch = true) {
  const chips = document.querySelectorAll('#category-chips-container .filter-chip');
  chips.forEach(c => c.classList.remove('active'));
  const catFilter = document.getElementById('search-filter-category');
  if (catFilter) catFilter.value = '';
  
  const subWrapper = document.getElementById('subcategory-chips-wrapper');
  if (subWrapper) subWrapper.style.display = 'none';
  const subFilter = document.getElementById('search-filter-subcategory');
  if (subFilter) subFilter.value = '';
  
  if (triggerSearch) handleSearchChange();
}

// 4. Renderers
function renderPeriodChips() {
  const container = document.getElementById('period-chips-container');
  if (!container) return;
  
  const lang = state.lang || 'el';
  const periodOptions = lang === 'en' 
    ? ['Weekly', 'Monthly', 'Annually', 'Custom Period']
    : ['Εβδομάδα', 'Μήνας', 'Έτος', 'Προσαρμοσμένο'];
    
  container.innerHTML = periodOptions.map(p => {
    return `<button type="button" class="filter-chip" onclick="selectPeriodFilter('${p}', this)">${p}</button>`;
  }).join('');
}

function renderAccountChips() {
  const container = document.getElementById('account-chips-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  const getAccIcon = (type) => {
    if (type === 'cash') return '💵';
    if (type === 'card') return '💳';
    if (type === 'bank') return '🏦';
    return '💳';
  };
  
  state.accounts.forEach(acc => {
    const icon = getAccIcon(acc.type);
    const displayName = getAccountDisplayName(acc);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip';
    chip.innerHTML = `${icon} ${displayName}`;
    chip.onclick = function() {
      selectAccountChipFilter(acc.name, this);
    };
    container.appendChild(chip);
  });
}

function renderCategoryChips() {
  const container = document.getElementById('category-chips-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  const filteredCats = state.categories.filter(c => c.type === currentCategoryType);
  
  filteredCats.forEach(cat => {
    const icon = cat.icon || '📁';
    const hasSubcats = cat.subcategories && cat.subcategories.length > 0;
    const arrow = hasSubcats ? ' <i class="fa-solid fa-chevron-down" style="font-size:8px; opacity:0.7;"></i>' : '';
    
    // Check if selected
    const selectedCat = document.getElementById('search-filter-category').value;
    const isSelected = selectedCat === cat.name;
    const checkmark = isSelected ? ' <i class="fa-solid fa-check" style="font-size:9px; margin-left:2px; color:var(--accent);"></i>' : '';
    
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `filter-chip ${isSelected ? 'active' : ''}`;
    chip.innerHTML = `${icon} ${cat.name}${arrow}${checkmark}`;
    chip.onclick = function() {
      selectCategoryChipFilter(cat.name, this);
    };
    container.appendChild(chip);
  });
}

function renderSubcategoryChips(subcategories) {
  const container = document.getElementById('subcategory-chips-container');
  const wrapper = document.getElementById('subcategory-chips-wrapper');
  if (!container || !wrapper) return;
  
  container.innerHTML = '';
  
  const allText = state.lang === 'en' ? 'All' : 'Όλες';
  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = 'filter-chip active';
  allChip.textContent = allText;
  allChip.onclick = function() {
    selectSubcategoryChipFilter('all', this);
  };
  container.appendChild(allChip);
  
  subcategories.forEach(sub => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip';
    chip.textContent = sub;
    chip.onclick = function() {
      selectSubcategoryChipFilter(sub, this);
    };
    container.appendChild(chip);
  });
  
  wrapper.style.display = 'block';
}

function initAmountRangeSlider() {
  const track = document.getElementById('slider-track');
  const thumbMin = document.getElementById('slider-thumb-min');
  const thumbMax = document.getElementById('slider-thumb-max');
  const slider = document.getElementById('amount-dual-slider');
  const valDisplay = document.getElementById('amount-range-val');
  
  if (!track || !thumbMin || !thumbMax || !slider) return;
  
  const amounts = state.transactions.map(t => parseFloat(t.amount) || 0);
  const maxVal = amounts.length > 0 ? Math.ceil(Math.max(...amounts)) : 1000;
  
  sliderMinVal = 0;
  sliderMaxVal = maxVal;
  currentMinVal = 0;
  currentMaxVal = maxVal;
  
  let pctMin = 0;
  let pctMax = 100;
  
  updateSliderUI();
  
  function onStart(e, isMin) {
    e.preventDefault();
    if (isMin) isDraggingMin = true;
    else isDraggingMax = true;
    
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }
  
  function onMove(e) {
    if (!isDraggingMin && !isDraggingMax) return;
    if (e.cancelable) e.preventDefault();
    
    const rect = slider.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));
    
    if (isDraggingMin) {
      if (pct > pctMax - 5) pct = pctMax - 5;
      pctMin = pct;
      currentMinVal = Math.round(sliderMinVal + (pctMin / 100) * (sliderMaxVal - sliderMinVal));
    } else {
      if (pct < pctMin + 5) pct = pctMin + 5;
      pctMax = pct;
      currentMaxVal = Math.round(sliderMinVal + (pctMax / 100) * (sliderMaxVal - sliderMinVal));
    }
    
    updateSliderUI();
    
    document.getElementById('search-filter-amount-min').value = currentMinVal;
    document.getElementById('search-filter-amount-max').value = (pctMax >= 99) ? '' : currentMaxVal;
    
    handleSearchChange();
  }
  
  function onEnd() {
    isDraggingMin = false;
    isDraggingMax = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
  }
  
  function updateSliderUI() {
    thumbMin.style.left = pctMin + '%';
    thumbMax.style.left = pctMax + '%';
    track.style.left = pctMin + '%';
    track.style.right = (100 - pctMax) + '%';
    
    const maxText = (pctMax >= 99) ? 'Max.' : currentMaxVal + ' €';
    if (valDisplay) valDisplay.textContent = `${currentMinVal} € ~ ${maxText}`;
  }
  
  thumbMin.addEventListener('mousedown', (e) => onStart(e, true));
  thumbMin.addEventListener('touchstart', (e) => onStart(e, true), { passive: false });
  
  thumbMax.addEventListener('mousedown', (e) => onStart(e, false));
  thumbMax.addEventListener('touchstart', (e) => onStart(e, false), { passive: false });
}

// Bind to window
window.selectPeriodFilter = selectPeriodFilter;
window.applyCustomDates = applyCustomDates;
window.resetPeriodFilter = resetPeriodFilter;
window.selectAccountChipFilter = selectAccountChipFilter;
window.setCategoryTypeFilter = setCategoryTypeFilter;
window.selectCategoryChipFilter = selectCategoryChipFilter;
window.selectSubcategoryChipFilter = selectSubcategoryChipFilter;
window.resetCategoryFilter = resetCategoryFilter;
window.renderPeriodChips = renderPeriodChips;
window.renderAccountChips = renderAccountChips;
window.renderCategoryChips = renderCategoryChips;
window.renderSubcategoryChips = renderSubcategoryChips;
window.initAmountRangeSlider = initAmountRangeSlider;


function openSearchPeriodSheet() {
  openSearchBottomSheet('period');
}

function selectPeriodSearchFilter(val) {
  const today = new Date();
  let dateStart = '';
  let dateEnd = '';
  let labelText = '';

  state.searchPeriod = val;

  if (val === 'all') {
    dateStart = '';
    dateEnd = '';
    labelText = state.lang === 'el' ? 'Όλη η περίοδος' : 'All period';
    document.getElementById('search-filter-date-start').value = '';
    document.getElementById('search-filter-date-end').value = '';
    const valEl = document.getElementById('search-val-period');
    if (valEl) valEl.textContent = labelText;
    closeSearchBottomSheet();
    handleSearchChange();
  } else if (val === 'weekly') {
    const start = new Date();
    start.setDate(today.getDate() - 7);
    dateStart = start.toISOString().split('T')[0];
    dateEnd = today.toISOString().split('T')[0];
    labelText = state.lang === 'el' ? 'Εβδομαδιαία' : 'Weekly';
    document.getElementById('search-filter-date-start').value = dateStart;
    document.getElementById('search-filter-date-end').value = dateEnd;
    const valEl = document.getElementById('search-val-period');
    if (valEl) valEl.textContent = labelText;
    closeSearchBottomSheet();
    handleSearchChange();
  } else if (val === 'monthly') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    dateStart = start.toISOString().split('T')[0];
    dateEnd = today.toISOString().split('T')[0];
    labelText = state.lang === 'el' ? 'Μηνιαία' : 'Monthly';
    document.getElementById('search-filter-date-start').value = dateStart;
    document.getElementById('search-filter-date-end').value = dateEnd;
    const valEl = document.getElementById('search-val-period');
    if (valEl) valEl.textContent = labelText;
    closeSearchBottomSheet();
    handleSearchChange();
  } else if (val === 'annually') {
    const start = new Date(today.getFullYear(), 0, 1);
    dateStart = start.toISOString().split('T')[0];
    dateEnd = today.toISOString().split('T')[0];
    labelText = state.lang === 'el' ? 'Ετήσια' : 'Annually';
    document.getElementById('search-filter-date-start').value = dateStart;
    document.getElementById('search-filter-date-end').value = dateEnd;
    const valEl = document.getElementById('search-val-period');
    if (valEl) valEl.textContent = labelText;
    closeSearchBottomSheet();
    handleSearchChange();
  } else if (val === 'custom') {
    closeSearchBottomSheet(false);
    openModal('search-custom-period-modal');
    const startVal = document.getElementById('search-filter-date-start').value;
    const endVal = document.getElementById('search-filter-date-end').value;
    document.getElementById('search-custom-period-start').value = startVal || today.toISOString().split('T')[0];
    document.getElementById('search-custom-period-end').value = endVal || today.toISOString().split('T')[0];
  }
}

function applySearchCustomPeriod() {
  const startVal = document.getElementById('search-custom-period-start').value;
  const endVal = document.getElementById('search-custom-period-end').value;

  document.getElementById('search-filter-date-start').value = startVal;
  document.getElementById('search-filter-date-end').value = endVal;

  state.searchPeriod = 'custom';

  const valEl = document.getElementById('search-val-period');
  if (valEl) {
    if (startVal && endVal) {
      valEl.textContent = `${startVal} ~ ${endVal}`;
    } else {
      valEl.textContent = state.lang === 'el' ? 'Όλη η περίοδος' : 'All period';
    }
  }

  closeModal('search-custom-period-modal');
  handleSearchChange();
}

function openSearchBottomSheet(type) {
  // Hide all bottom sheets first
  closeSearchBottomSheet(false);

  // Show backdrop
  const backdrop = document.getElementById('search-bottom-sheet-backdrop');
  if (backdrop) backdrop.classList.add('active');

  // Show target sheet
  const sheet = document.getElementById(`search-bottom-sheet-${type}`);
  if (sheet) {
    sheet.classList.add('active');
    
    // Dynamic populating based on type
    if (type === 'category') {
      populateSearchCategorySheet();
    } else if (type === 'account') {
      populateSearchAccountSheet();
    } else if (type === 'member') {
      populateSearchMemberSheet();
    } else if (type === 'advanced') {
      // Sync visual inputs with the hidden ones
      document.getElementById('search-filter-amount-min-visual').value = document.getElementById('search-filter-amount-min').value;
      document.getElementById('search-filter-amount-max-visual').value = document.getElementById('search-filter-amount-max').value;
      const startVis = document.getElementById('search-filter-date-start-visual');
      const startHid = document.getElementById('search-filter-date-start');
      if (startVis && startHid) startVis.value = startHid.value;
      const endVis = document.getElementById('search-filter-date-end-visual');
      const endHid = document.getElementById('search-filter-date-end');
      if (endVis && endHid) endVis.value = endHid.value;
    }
  }
}

function closeSearchBottomSheet(hideBackdrop = true) {
  document.querySelectorAll('.search-bottom-sheet').forEach(sheet => {
    sheet.classList.remove('active');
  });
  if (hideBackdrop) {
    const backdrop = document.getElementById('search-bottom-sheet-backdrop');
    if (backdrop) backdrop.classList.remove('active');
  }
}

// Get category type ('expense' or 'income') for search category filtering
function getCategoryType(catName) {
  if (!catName) return '';
  const catObj = state.categories.find(c => c.name === catName);
  if (catObj) return catObj.type;
  
  const trans = state.transactions.find(t => t.category === catName);
  if (trans) return trans.type;
  
  return '';
}

function selectTypeSearchFilter(val) {
  const hiddenSelect = document.getElementById('search-filter-type');
  if (hiddenSelect) {
    hiddenSelect.value = val;
  }
  
  // If the currently selected category doesn't match the new selected type, clear the category selection
  const currentCat = document.getElementById('search-filter-category')?.value;
  if (currentCat && val) {
    const catType = getCategoryType(currentCat);
    if (catType && catType !== val) {
      const hiddenCat = document.getElementById('search-filter-category');
      const hiddenSub = document.getElementById('search-filter-subcategory');
      if (hiddenCat) hiddenCat.value = '';
      if (hiddenSub) hiddenSub.value = '';
      
      const catChip = document.getElementById('search-chip-category');
      if (catChip) {
        const label = catChip.querySelector('.chip-label');
        if (label) {
          label.textContent = TRANSLATIONS[state.lang]['search_chip_category'] || 'Κατηγορία';
        }
        catChip.classList.remove('active');
      }
    }
  }
  
  const valDisplay = document.getElementById('search-val-type');
  if (valDisplay) {
    if (val) {
      valDisplay.textContent = val === 'expense' ? (state.lang === 'el' ? 'Έξοδο' : 'Expense')
                             : val === 'income' ? (state.lang === 'el' ? 'Έσοδο' : 'Income')
                             : (state.lang === 'el' ? 'Μεταφορά' : 'Transfer');
    } else {
      valDisplay.textContent = state.lang === 'el' ? 'Όλοι οι τύποι' : 'All types';
    }
  }

  // Update Type Chip UI
  const chip = document.getElementById('search-chip-type');
  if (chip) {
    const label = chip.querySelector('.chip-label');
    if (label) {
      if (val) {
        let text = val === 'expense' ? TRANSLATIONS[state.lang]['type_tab_expense'] : val === 'income' ? TRANSLATIONS[state.lang]['type_tab_income'] : TRANSLATIONS[state.lang]['type_tab_transfer'];
        label.textContent = `✓ ${text}`;
        chip.classList.add('active');
      } else {
        label.textContent = TRANSLATIONS[state.lang]['search_chip_type'] || 'Τύπος';
        chip.classList.remove('active');
      }
    }
  }
  
  // Update active option styling in sheet
  const sheet = document.getElementById('search-bottom-sheet-type');
  if (sheet) {
    sheet.querySelectorAll('.bottom-sheet-option').forEach(opt => {
      opt.classList.toggle('active', opt.getAttribute('data-value') === val);
    });
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

function populateSearchAccountSheet() {
  const container = document.getElementById('search-bottom-sheet-account-list');
  if (!container) return;

  const currentVal = document.getElementById('search-filter-account').value;

  let html = `
    <div class="bottom-sheet-option ${currentVal === '' ? 'active' : ''}" onclick="selectAccountSearchFilter('')">
      <span class="option-label">${state.lang === 'el' ? 'Όλοι οι τρόποι πληρωμής' : 'All accounts'}</span>
      <i class="fa-solid fa-check option-check-icon"></i>
    </div>
  `;

  state.accounts.forEach(acc => {
    const isActive = acc.name === currentVal;
    html += `
      <div class="bottom-sheet-option ${isActive ? 'active' : ''}" onclick="selectAccountSearchFilter('${acc.name}')">
        <span class="option-label"><i class="fa-solid fa-wallet" style="margin-right: 8px; color: var(--accent);"></i> ${getAccountDisplayName(acc)}</span>
        <i class="fa-solid fa-check option-check-icon"></i>
      </div>
    `;
  });

  container.innerHTML = html;
}

function selectAccountSearchFilter(val) {
  const hiddenSelect = document.getElementById('search-filter-account');
  if (hiddenSelect) {
    hiddenSelect.value = val;
  }

  // Update Account UI Row
  const valDisplay = document.getElementById('search-val-account');
  if (valDisplay) {
    if (val) {
      valDisplay.textContent = getAccountDisplayName(val);
    } else {
      valDisplay.textContent = state.lang === 'el' ? 'Όλοι' : 'All';
    }
  }

  // Fallback update to Account Chip UI if it exists
  const chip = document.getElementById('search-chip-account');
  if (chip) {
    const label = chip.querySelector('.chip-label');
    if (label) {
      if (val) {
        label.textContent = `✓ ${getAccountDisplayName(val)}`;
        chip.classList.add('active');
      } else {
        label.textContent = TRANSLATIONS[state.lang]['search_chip_account'] || 'Λογαριασμός';
        chip.classList.remove('active');
      }
    }
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

function populateSearchCategorySheet() {
  const container = document.getElementById('search-bottom-sheet-category-list');
  if (!container) return;

  const currentCat = document.getElementById('search-filter-category').value;
  const currentSub = document.getElementById('search-filter-subcategory').value;
  const searchType = document.getElementById('search-filter-type')?.value || '';

  let html = `
    <div class="bottom-sheet-option ${currentCat === '' && currentSub === '' ? 'active' : ''}" onclick="selectCategorySearchFilter('', '')">
      <span class="option-label">${state.lang === 'el' ? 'Όλες οι κατηγορίες' : 'All categories'}</span>
      <i class="fa-solid fa-check option-check-icon"></i>
    </div>
  `;

  // Get all unique category names
  const allCats = new Set();
  state.categories.forEach(c => allCats.add(c.name));
  state.transactions.forEach(t => { if (t.category) allCats.add(t.category); });

  // Map category name to type
  const catTypeMap = {};
  state.categories.forEach(c => {
    if (c.name) catTypeMap[c.name] = c.type;
  });
  state.transactions.forEach(t => {
    if (t.category && !catTypeMap[t.category]) {
      catTypeMap[t.category] = t.type;
    }
  });

  let sortedCats = Array.from(allCats);
  if (searchType === 'income' || searchType === 'expense') {
    sortedCats = sortedCats.filter(catName => {
      const type = catTypeMap[catName];
      return type === searchType;
    });
  }
  sortedCats.sort();

  sortedCats.forEach(catName => {
    const isCatActive = catName === currentCat && !currentSub;
    const catObj = state.categories.find(c => c.name === catName);
    const emoji = catObj?.icon || '📁';

    html += `
      <div class="bottom-sheet-option ${isCatActive ? 'active' : ''}" onclick="selectCategorySearchFilter('${catName}', '')">
        <span class="option-label">${emoji} ${getCategoryDisplayName(catName)}</span>
        <i class="fa-solid fa-check option-check-icon"></i>
      </div>
    `;

    // Find subcategories for this category
    const subcats = new Set();
    state.transactions.forEach(t => {
      if (t.category === catName && t.subcategory && t.subcategory.trim()) {
        subcats.add(t.subcategory.trim());
      }
    });

    if (catObj?.subcategories) {
      catObj.subcategories.forEach(s => subcats.add(s.trim()));
    }

    if (subcats.size > 0) {
      Array.from(subcats).sort().forEach(subName => {
        const isSubActive = catName === currentCat && subName === currentSub;
        html += `
          <div class="bottom-sheet-option subcategory-option ${isSubActive ? 'active' : ''}" onclick="selectCategorySearchFilter('${catName}', '${subName}')" style="padding-left: 36px; font-size: 12.5px; opacity: 0.9;">
            <span class="option-label"><i class="fa-solid fa-turn-up" style="transform: rotate(90deg); margin-right: 8px; color: var(--text-muted); font-size: 10px;"></i> ${getSubcategoryDisplayName(subName, catName)}</span>
            <i class="fa-solid fa-check option-check-icon"></i>
          </div>
        `;
      });
    }
  });

  container.innerHTML = html;
}

function selectCategorySearchFilter(cat, sub) {
  const hiddenCat = document.getElementById('search-filter-category');
  const hiddenSub = document.getElementById('search-filter-subcategory');
  if (hiddenCat) hiddenCat.value = cat;
  if (hiddenSub) hiddenSub.value = sub;

  // Update Category UI Row
  const valDisplay = document.getElementById('search-val-category');
  if (valDisplay) {
    if (cat) {
      if (sub) {
        valDisplay.textContent = `${getCategoryDisplayName(cat)} > ${getSubcategoryDisplayName(sub, cat)}`;
      } else {
        valDisplay.textContent = getCategoryDisplayName(cat);
      }
    } else {
      valDisplay.textContent = state.lang === 'el' ? 'Όλες' : 'All';
    }
  }

  // Fallback update to Category Chip UI if it exists
  const chip = document.getElementById('search-chip-category');
  if (chip) {
    const label = chip.querySelector('.chip-label');
    if (label) {
      if (cat) {
        if (sub) {
          label.textContent = `✓ ${getSubcategoryDisplayName(sub, cat)}`;
        } else {
          label.textContent = `✓ ${getCategoryDisplayName(cat)}`;
        }
        chip.classList.add('active');
      } else {
        label.textContent = TRANSLATIONS[state.lang]['search_chip_category'] || 'Κατηγορία';
        chip.classList.remove('active');
      }
    }
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

function populateSearchMemberSheet() {
  const container = document.getElementById('search-bottom-sheet-member-list');
  if (!container) return;

  const currentVal = document.getElementById('search-filter-member').value;

  const myName = state.userProfile?.display_name || state.currentUser?.email?.split('@')[0] || (state.lang === 'el' ? 'Εσείς' : 'You');
  const myId = state.currentUser?.id || '';

  let html = `
    <div class="bottom-sheet-option ${currentVal === '' ? 'active' : ''}" onclick="selectMemberSearchFilter('')">
      <span class="option-label">${state.lang === 'el' ? 'Όλα τα μέλη' : 'All members'}</span>
      <i class="fa-solid fa-check option-check-icon"></i>
    </div>
  `;

  // My option
  html += `
    <div class="bottom-sheet-option ${currentVal === myId ? 'active' : ''}" onclick="selectMemberSearchFilter('${myId}')">
      <span class="option-label"><i class="fa-solid fa-user" style="margin-right: 8px; color: var(--accent);"></i> ${myName}</span>
      <i class="fa-solid fa-check option-check-icon"></i>
    </div>
  `;

  // Partner option if exists
  if (state.partnerProfile) {
    const partnerName = state.partnerProfile.display_name || state.partnerProfile.email.split('@')[0] || (state.lang === 'el' ? 'Σύντροφος' : 'Partner');
    const partnerId = state.partnerProfile.id;
    html += `
      <div class="bottom-sheet-option ${currentVal === partnerId ? 'active' : ''}" onclick="selectMemberSearchFilter('${partnerId}')">
        <span class="option-label"><i class="fa-solid fa-user-group" style="margin-right: 8px; color: var(--accent);"></i> ${partnerName}</span>
        <i class="fa-solid fa-check option-check-icon"></i>
      </div>
    `;
  }

  container.innerHTML = html;
}

function syncAmountFiltersFromInline() {
  const minVal = document.getElementById('search-amount-min-inline')?.value || '';
  const maxVal = document.getElementById('search-amount-max-inline')?.value || '';
  const hiddenMin = document.getElementById('search-filter-amount-min');
  const hiddenMax = document.getElementById('search-filter-amount-max');
  if (hiddenMin) hiddenMin.value = minVal;
  if (hiddenMax) hiddenMax.value = maxVal;
  handleSearchChange();
}

function selectMemberSearchFilter(val) {
  const hiddenInput = document.getElementById('search-filter-member');
  if (hiddenInput) {
    hiddenInput.value = val;
  }

  // Update Member Row display UI
  const valDisplay = document.getElementById('search-val-member');
  if (valDisplay) {
    if (val) {
      let name = '';
      const myId = state.currentUser?.id || '';
      if (val === myId) {
        name = state.userProfile?.display_name || state.currentUser?.email?.split('@')[0] || (state.lang === 'el' ? 'Εσείς' : 'You');
      } else if (state.partnerProfile && val === state.partnerProfile.id) {
        name = state.partnerProfile.display_name || state.partnerProfile.email.split('@')[0] || (state.lang === 'el' ? 'Σύντροφος' : 'Partner');
      }
      valDisplay.textContent = name;
    } else {
      valDisplay.textContent = state.lang === 'el' ? 'Όλα τα μέλη' : 'All members';
    }
  }

  // Update Member Chip UI if exists
  const chip = document.getElementById('search-chip-member');
  if (chip) {
    const label = chip.querySelector('.chip-label');
    if (label) {
      if (val) {
        let name = '';
        const myId = state.currentUser?.id || '';
        if (val === myId) {
          name = state.userProfile?.display_name || state.currentUser?.email?.split('@')[0] || (state.lang === 'el' ? 'Εσείς' : 'You');
        } else if (state.partnerProfile && val === state.partnerProfile.id) {
          name = state.partnerProfile.display_name || state.partnerProfile.email.split('@')[0] || (state.lang === 'el' ? 'Σύντροφος' : 'Partner');
        }
        label.textContent = `✓ ${name}`;
        chip.classList.add('active');
      } else {
        label.textContent = TRANSLATIONS[state.lang]['search_chip_member'] || 'Μέλος';
        chip.classList.remove('active');
      }
    }
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

function selectPhotoSearchFilter(val) {
  const hiddenInput = document.getElementById('search-filter-photo');
  if (hiddenInput) {
    hiddenInput.value = val;
  }

  // Update Photo row display UI
  const valDisplay = document.getElementById('search-val-photo');
  if (valDisplay) {
    if (val === 'has_photo') {
      valDisplay.textContent = state.lang === 'el' ? 'Με απόδειξη' : 'With receipt';
    } else if (val === 'no_photo') {
      valDisplay.textContent = state.lang === 'el' ? 'Χωρίς απόδειξη' : 'Without receipt';
    } else {
      valDisplay.textContent = state.lang === 'el' ? 'Όλες' : 'All';
    }
  }

  // Update Photo Chip UI if exists
  const chip = document.getElementById('search-chip-photo');
  if (chip) {
    const label = chip.querySelector('.chip-label');
    if (label) {
      if (val) {
        let text = val === 'has_photo' ? (state.lang === 'el' ? 'Με απόδειξη' : 'With receipt') : (state.lang === 'el' ? 'Χωρίς απόδειξη' : 'Without receipt');
        label.textContent = `✓ ${text}`;
        chip.classList.add('active');
      } else {
        label.textContent = TRANSLATIONS[state.lang]['search_chip_photo'] || 'Απόδειξη';
        chip.classList.remove('active');
      }
    }
  }

  // Update active option styling in sheet
  const sheet = document.getElementById('search-bottom-sheet-photo');
  if (sheet) {
    sheet.querySelectorAll('.bottom-sheet-option').forEach(opt => {
      const optVal = opt.getAttribute('data-value') || '';
      opt.classList.toggle('active', optVal === val);
    });
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

function applyAdvancedSearchFiltersVisual() {
  const minVal = document.getElementById('search-filter-amount-min-visual').value;
  const maxVal = document.getElementById('search-filter-amount-max-visual').value;
  const startVis = document.getElementById('search-filter-date-start-visual');
  const endVis = document.getElementById('search-filter-date-end-visual');

  document.getElementById('search-filter-amount-min').value = minVal;
  document.getElementById('search-filter-amount-max').value = maxVal;
  if (startVis) document.getElementById('search-filter-date-start').value = startVis.value;
  if (endVis) document.getElementById('search-filter-date-end').value = endVis.value;

  // Update Amount UI Row
  const valDisplay = document.getElementById('search-val-amount');
  if (valDisplay) {
    if (minVal || maxVal) {
      const minText = minVal ? `${minVal} €` : 'Min.';
      const maxText = maxVal ? `${maxVal} €` : 'Max.';
      valDisplay.textContent = `${minText} ~ ${maxText}`;
    } else {
      valDisplay.textContent = 'Min. ~ Max.';
    }
  }

  // Update Advanced Chip UI if exists
  const chip = document.getElementById('search-chip-advanced');
  if (chip) {
    const hasValues = minVal || maxVal || (startVis && startVis.value) || (endVis && endVis.value);
    if (hasValues) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

// Clear visual dashboard filters if initialized
function resetAdvancedSearchFiltersVisual() {
  document.getElementById('search-filter-amount-min-visual').value = '';
  document.getElementById('search-filter-amount-max-visual').value = '';
  const startVis = document.getElementById('search-filter-date-start-visual');
  if (startVis) startVis.value = '';
  const endVis = document.getElementById('search-filter-date-end-visual');
  if (endVis) endVis.value = '';

  document.getElementById('search-filter-amount-min').value = '';
  document.getElementById('search-filter-amount-max').value = '';
  document.getElementById('search-filter-date-start').value = '';
  document.getElementById('search-filter-date-end').value = '';

  // Update Amount UI Row
  const valDisplay = document.getElementById('search-val-amount');
  if (valDisplay) {
    valDisplay.textContent = 'Min. ~ Max.';
  }

  const chip = document.getElementById('search-chip-advanced');
  if (chip) chip.classList.remove('active');

  closeSearchBottomSheet();
  handleSearchChange();
}

function resetAllSearchChips() {
  const typeChip = document.getElementById('search-chip-type');
  if (typeChip) {
    const label = typeChip.querySelector('.chip-label');
    if (label) label.textContent = TRANSLATIONS[state.lang]['search_chip_type'] || 'Τύπος';
    typeChip.classList.remove('active');
  }
  const catChip = document.getElementById('search-chip-category');
  if (catChip) {
    const label = catChip.querySelector('.chip-label');
    if (label) label.textContent = TRANSLATIONS[state.lang]['search_chip_category'] || 'Κατηγορία';
    catChip.classList.remove('active');
  }
  const accChip = document.getElementById('search-chip-account');
  if (accChip) {
    const label = accChip.querySelector('.chip-label');
    if (label) label.textContent = TRANSLATIONS[state.lang]['search_chip_account'] || 'Λογαριασμός';
    accChip.classList.remove('active');
  }
  const memChip = document.getElementById('search-chip-member');
  if (memChip) {
    const label = memChip.querySelector('.chip-label');
    if (label) label.textContent = TRANSLATIONS[state.lang]['search_chip_member'] || 'Μέλος';
    memChip.classList.remove('active');
  }
  const photoChip = document.getElementById('search-chip-photo');
  if (photoChip) {
    const label = photoChip.querySelector('.chip-label');
    if (label) label.textContent = TRANSLATIONS[state.lang]['search_chip_photo'] || 'Απόδειξη';
    photoChip.classList.remove('active');
  }
  const advChip = document.getElementById('search-chip-advanced');
  if (advChip) {
    advChip.classList.remove('active');
  }

  // Reset new search val elements
  const periodVal = document.getElementById('search-val-period');
  if (periodVal) periodVal.textContent = state.lang === 'el' ? 'Όλη η περίοδος' : 'All period';

  const accountVal = document.getElementById('search-val-account');
  if (accountVal) accountVal.textContent = state.lang === 'el' ? 'Όλοι' : 'All';

  const categoryVal = document.getElementById('search-val-category');
  if (categoryVal) categoryVal.textContent = state.lang === 'el' ? 'Όλες' : 'All';

  const memberVal = document.getElementById('search-val-member');
  if (memberVal) memberVal.textContent = state.lang === 'el' ? 'Όλα τα μέλη' : 'All members';

  const photoVal = document.getElementById('search-val-photo');
  if (photoVal) photoVal.textContent = state.lang === 'el' ? 'Όλες' : 'All';

  const amountVal = document.getElementById('search-val-amount');
  if (amountVal) amountVal.textContent = 'Min. ~ Max.';

  // Reset active checkmark in sheets
  const memSheet = document.getElementById('search-bottom-sheet-member');
  if (memSheet) {
    memSheet.querySelectorAll('.bottom-sheet-option').forEach(opt => {
      opt.classList.toggle('active', opt.getAttribute('data-value') === '' || !opt.hasAttribute('data-value'));
    });
  }
  const photoSheet = document.getElementById('search-bottom-sheet-photo');
  if (photoSheet) {
    photoSheet.querySelectorAll('.bottom-sheet-option').forEach(opt => {
      const optVal = opt.getAttribute('data-value') || '';
      opt.classList.toggle('active', optVal === '');
    });
  }

  state.searchPeriod = 'all';
}

// Bind to window to ensure HTML inline onclick works perfectly
window.openSearchOverlay = openSearchOverlay;
window.closeSearchOverlay = closeSearchOverlay;
window.openSearchBottomSheet = openSearchBottomSheet;
window.closeSearchBottomSheet = closeSearchBottomSheet;
window.syncAmountFiltersFromInline = syncAmountFiltersFromInline;
window.resetSearchFilters = resetSearchFilters;
window.clearSearchInput = clearSearchInput;
window.selectTypeSearchFilter = selectTypeSearchFilter;
window.selectAccountSearchFilter = selectAccountSearchFilter;
window.selectCategorySearchFilter = selectCategorySearchFilter;
window.selectMemberSearchFilter = selectMemberSearchFilter;
window.selectPhotoSearchFilter = selectPhotoSearchFilter;
window.handleSearchChange = handleSearchChange;
window.loadMoreSearchResults = loadMoreSearchResults;
window.toggleSearchFiltersPanel = toggleSearchFiltersPanel;
window.applyAdvancedSearchFiltersVisual = applyAdvancedSearchFiltersVisual;
window.resetAdvancedSearchFiltersVisual = resetAdvancedSearchFiltersVisual;
window.resetAllSearchChips = resetAllSearchChips;
window.openSearchPeriodSheet = openSearchPeriodSheet;
window.selectPeriodSearchFilter = selectPeriodSearchFilter;
window.applySearchCustomPeriod = applySearchCustomPeriod;


function populateSearchFilterDropdowns() {
  // Populate accounts filter
  const accSelect = document.getElementById('search-filter-account');
  if (accSelect) {
    accSelect.innerHTML = `<option value="">${state.lang === 'el' ? 'Όλοι οι τρόποι πληρωμής' : 'All accounts'}</option>`;
    state.accounts.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc.name;
      opt.textContent = getAccountDisplayName(acc);
      accSelect.appendChild(opt);
    });
  }

  // Populate categories filter
  const catSelect = document.getElementById('search-filter-category');
  if (catSelect) {
    catSelect.innerHTML = '<option value="">Όλες οι κατηγορίες</option>';
    const allCats = new Set();
    state.categories.forEach(c => allCats.add(c.name));
    state.transactions.forEach(t => { if (t.category) allCats.add(t.category); });
    Array.from(allCats).sort().forEach(catName => {
      const opt = document.createElement('option');
      opt.value = catName;
      opt.textContent = catName;
      catSelect.appendChild(opt);
    });
    // Wire up category change to update subcategory dropdown
    catSelect.onchange = function() {
      handleSearchChange();
      populateSearchSubcategoryDropdown(this.value);
    };
  }

  // Sync custom dropdowns!
  syncCustomSelect('type');
  syncCustomSelect('account');
  syncCustomSelect('category');

  // Populate subcategory filter (all subcats initially)
  populateSearchSubcategoryDropdown('');
}

function populateSearchSubcategoryDropdown(filterByCat) {
  const subSelect = document.getElementById('search-filter-subcategory');
  if (!subSelect) return;
  subSelect.innerHTML = '<option value="">Όλες</option>';
  const allSubs = new Set();
  state.transactions.forEach(t => {
    if (t.subcategory && t.subcategory.trim()) {
      // If a category is selected, only show subcats from that cat
      if (!filterByCat || t.category === filterByCat) {
        allSubs.add(t.subcategory.trim());
      }
    }
  });
  Array.from(allSubs).sort().forEach(subName => {
    const opt = document.createElement('option');
    opt.value = subName;
    opt.textContent = subName;
    subSelect.appendChild(opt);
  });

  // Sync subcategory custom select!
  syncCustomSelect('subcategory');
}


function resetSearchFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('search-filter-type').value = '';
  document.getElementById('search-filter-account').value = '';
  document.getElementById('search-filter-category').value = '';
  const subSel = document.getElementById('search-filter-subcategory');
  if (subSel) subSel.value = '';
  document.getElementById('search-filter-amount-min').value = '';
  document.getElementById('search-filter-amount-max').value = '';
  // Also clear inline amount inputs
  const inlineMin = document.getElementById('search-amount-min-inline');
  const inlineMax = document.getElementById('search-amount-max-inline');
  if (inlineMin) inlineMin.value = '';
  if (inlineMax) inlineMax.value = '';
  document.getElementById('search-filter-date-start').value = '';
  document.getElementById('search-filter-date-end').value = '';
  
  // Reset member filter
  const memSel = document.getElementById('search-filter-member');
  if (memSel) memSel.value = '';

  // Reset photo filter
  const photoSel = document.getElementById('search-filter-photo');
  if (photoSel) photoSel.value = '';

  // Reset visual dashboard filters if initialized
  if (typeof resetPeriodFilter === 'function') {
    resetPeriodFilter();
  }
  if (typeof resetCategoryFilter === 'function') {
    resetCategoryFilter(false);
  }
  
  // Reset segmented switcher
  const segExpense = document.getElementById('seg-tab-expense');
  const segIncome = document.getElementById('seg-tab-income');
  if (segExpense && segIncome) {
    segExpense.className = 'segmented-tab active';
    segIncome.className = 'segmented-tab';
    document.getElementById('category-segmented-control')?.style.setProperty('--segmented-active-bg', 'var(--red-negative, #ef5350)');
  }
  currentCategoryType = 'expense';
  document.getElementById('search-filter-type').value = '';
  const typeVal = document.getElementById('search-val-type');
  if (typeVal) typeVal.textContent = state.lang === 'el' ? 'Όλοι οι τύποι' : 'All types';
  
  if (typeof renderCategoryChips === 'function') {
    renderCategoryChips();
  }
  if (typeof initAmountRangeSlider === 'function') {
    initAmountRangeSlider();
  }

  populateSearchSubcategoryDropdown('');
  
  // Sync the custom UI trigger labels and selections
  updateCustomSelectTriggers();

  // Reset visual chip elements to default labels
  resetAllSearchChips();
  
  handleSearchChange();
}

function clearSearchInput() {
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  if (clearBtn) clearBtn.classList.remove('visible');
  handleSearchChange();
}


function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function handleSearchChange(resetLimit = true) {
  if (resetLimit === true) {
    searchResultLimit = 50;
  }
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  
  // Show/hide the clear button based on input
  if (clearBtn) {
    if (searchInput && searchInput.value.length > 0) {
      clearBtn.classList.add('visible');
    } else {
      clearBtn.classList.remove('visible');
    }
  }

  const query = normalizeText(searchInput.value);
  const filterType = document.getElementById('search-filter-type').value;
  const filterAcc = document.getElementById('search-filter-account').value;
  const filterCat = document.getElementById('search-filter-category').value;
  const filterSubEl = document.getElementById('search-filter-subcategory');
  const filterSub = filterSubEl ? filterSubEl.value : '';
  const minAmt = parseFloat(document.getElementById('search-filter-amount-min').value) || null;
  const maxAmt = parseFloat(document.getElementById('search-filter-amount-max').value) || null;
  const dateStart = document.getElementById('search-filter-date-start').value;
  const dateEnd = document.getElementById('search-filter-date-end').value;
  
  // Member Filter value
  const filterMember = document.getElementById('search-filter-member')?.value || '';
  const filterPhoto = document.getElementById('search-filter-photo')?.value || '';

  const filtered = state.transactions.filter(t => {
    // 1. Text Query (Search in Note, Category, Subcategory, Description, Account)
    if (query) {
      const note = normalizeText(t.note);
      const cat = normalizeText(t.category);
      const sub = normalizeText(t.subcategory);
      const desc = normalizeText(t.description);
      const acc = normalizeText(t.account_from);
      const accTo = normalizeText(t.account_to);
      
      if (!note.includes(query) && !cat.includes(query) && !sub.includes(query) && !desc.includes(query) && !acc.includes(query) && !accTo.includes(query)) {
        return false;
      }
    }

    // 2. Type Filter
    if (filterType && t.type !== filterType) return false;

    // 3. Account Filter
    if (filterAcc && t.account_from !== filterAcc && t.account_to !== filterAcc) return false;

    // 4. Category Filter
    if (filterCat && t.category !== filterCat) return false;

    // 4b. Subcategory Filter
    if (filterSub && (t.subcategory || '').trim() !== filterSub) return false;

    // 4c. Member Filter (user_id matching)
    if (filterMember && t.user_id !== filterMember) return false;

    // 4d. Photo/Receipt Filter
    if (filterPhoto) {
      const hasPhoto = !!(t.photo_local_uri || t.photo_url);
      if (filterPhoto === 'has_photo' && !hasPhoto) return false;
      if (filterPhoto === 'no_photo' && hasPhoto) return false;
    }

    // 5. Amount Range Filter
    const amt = parseFloat(t.amount) || 0;
    if (minAmt !== null && amt < minAmt) return false;
    if (maxAmt !== null && amt > maxAmt) return false;

    // 6. Date Range Filter
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];
    if (dateStart && datePart < dateStart) return false;
    if (dateEnd && datePart > dateEnd) return false;

    return true;
  });

  // Sort transactions by date descending
  filtered.sort(compareTransactions);

  // Update Badge Count if exists
  const countBadge = document.getElementById('search-results-count');
  if (countBadge) {
    countBadge.textContent = filtered.length;
  }

  // Calculate Totals for search summary bar
  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransfer = 0;

  filtered.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') {
      totalIncome += amt;
    } else if (t.type === 'expense') {
      totalExpense += amt;
    } else if (t.type === 'transfer') {
      totalTransfer += amt;
    }
  });

  const currencySymbol = getCurrencySymbol();
  const incomeValEl = document.getElementById('search-summary-income-val');
  const expenseValEl = document.getElementById('search-summary-expense-val');
  const transferValEl = document.getElementById('search-summary-transfer-val');

  if (incomeValEl) incomeValEl.textContent = `${currencySymbol} ${formatCurrency(totalIncome)}`;
  if (expenseValEl) expenseValEl.textContent = `${currencySymbol} ${formatCurrency(totalExpense)}`;
  if (transferValEl) transferValEl.textContent = `${currencySymbol} ${formatCurrency(totalTransfer)}`;

  // Render Day-Grouped search results
  const resultsContainer = document.getElementById('search-results-list');
  renderGroupedTransactions(filtered, resultsContainer);

}

function renderGroupedTransactions(transactions, container) {
  container.innerHTML = '';

  if (transactions.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 10px;color:var(--text-secondary)">
        <h4 style="margin-bottom:4px; font-weight:700;">Δεν βρέθηκαν συναλλαγές</h4>
        <p style="font-size:11px">Δοκιμάστε άλλα φίλτρα ή λέξεις-κλειδιά</p>
      </div>`;
    return;
  }

  const itemsToRender = transactions.slice(0, searchResultLimit);

  // Flat list matching the screenshot layout
  itemsToRender.forEach(t => {
    const catInfo = getCategoryInfo(t.category, t.type);
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.onclick = () => {
      closeSearchOverlay();
      openEditTransactionModal(t);
    };

    let amountClass = 'search-item-amount';
    let accountText = t.account_from || '';
    if (t.type === 'expense')       { amountClass += ' expense'; }
    else if (t.type === 'income')   { amountClass += ' income'; }
    else if (t.type === 'transfer') { amountClass += ' transfer'; accountText = `${t.account_from} → ${t.account_to}`; }

    const translatedSub = getSubcategoryDisplayName(t.subcategory, t.category);
    const translatedCat = getCategoryDisplayName(t.category);
    const displayTitle = (t.note && t.note.trim()) ? t.note.trim()
                       : (t.description && t.description.trim()) ? t.description.trim()
                       : (translatedSub && translatedSub.trim()) ? translatedSub.trim()
                       : (translatedCat || '');

    const memberBadge = getMemberBadgeHTML(t);

    const datePart = (t.date || '').split('T')[0];
    const catSubLine = t.subcategory
      ? `${catInfo.icon || ''} ${translatedCat}/${translatedSub}`
      : `${catInfo.icon || ''} ${translatedCat}`;

    item.innerHTML = `
      <div class="search-item-left">
        <span class="search-item-date">${datePart}</span>
        <div class="search-item-info">
          <span class="search-item-title">${displayTitle}${memberBadge}</span>
          <span class="search-item-sub">${catSubLine}&nbsp;&nbsp;${accountText}</span>
        </div>
      </div>
      <div class="${amountClass}">${getCurrencySymbol()} ${formatCurrency(t.amount)}</div>`;
    container.appendChild(item);
  });

  if (transactions.length > searchResultLimit) {
    const remaining = transactions.length - searchResultLimit;
    const loadMoreDiv = document.createElement('div');
    loadMoreDiv.className = 'search-load-more-container';
    loadMoreDiv.style.cssText = 'padding: 16px 20px; text-align: center;';
    
    const btnText = state.lang === 'el'
      ? `Φόρτωση Περισσότερων (${remaining} ακόμα)`
      : `Load More (${remaining} remaining)`;

    loadMoreDiv.innerHTML = `
      <button class="btn btn-secondary search-load-more-btn" onclick="loadMoreSearchResults()" style="width: 100%; border-radius: 12px; font-size: 13px; font-weight: 600; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: var(--text-main);">
        ${btnText}
      </button>
    `;
    container.appendChild(loadMoreDiv);
  }
}

// ============================================================
// FEATURE: MONTH GRID PICKER MODAL
// ============================================================
function openMonthPicker(forceYearView = false) {
  if (!window._monthPickerSwipeGesturesInitialized) {
    initYearSwipeGestures();
    window._monthPickerSwipeGesturesInitialized = true;
  }
  state.monthPickerYear = state.selectedYear;
  const yearLabel = document.getElementById('month-picker-bs-year-label');
  if (yearLabel) yearLabel.textContent = state.monthPickerYear;
  
  // Toggle view based on parameter
  toggleMonthPickerYearView(forceYearView);
  renderMonthPickerBS();
  
  openModal('month-picker-modal');
}

function toggleMonthPickerYearView(forceYearView) {
  const monthsView = document.getElementById('month-picker-bs-months-view');
  const yearsView = document.getElementById('month-picker-bs-years-view');
  const chevron = document.getElementById('month-picker-bs-year-chevron');
  if (!monthsView || !yearsView) return;

  let showYears = false;
  if (typeof forceYearView === 'boolean') {
    showYears = forceYearView;
  } else {
    showYears = yearsView.style.display === 'none';
  }

  if (showYears) {
    monthsView.style.display = 'none';
    yearsView.style.display = 'grid';
    if (chevron) chevron.style.display = 'none';
    window.monthPickerBSYearStart = Math.floor((state.monthPickerYear - 2020) / 6) * 6 + 2020;
    renderMonthPickerBS();
  } else {
    monthsView.style.display = 'grid';
    yearsView.style.display = 'none';
    if (chevron) {
      chevron.style.display = 'inline-block';
      chevron.style.transform = 'rotate(0deg)';
    }
    const labelSpan = document.getElementById('month-picker-bs-year-label');
    if (labelSpan) {
      labelSpan.style.display = '';
      labelSpan.textContent = state.monthPickerYear;
    }
  }
}

function shiftMonthPickerBSYears(delta) {
  window.monthPickerBSYearStart += delta;
  renderMonthPickerBS();
}
window.shiftMonthPickerBSYears = shiftMonthPickerBSYears;

function renderMonthPickerBS() {
  const monthsGrid = document.getElementById('month-picker-bs-months-view');
  if (monthsGrid) {
    monthsGrid.innerHTML = '';
    const currentMonth = state.selectedMonth; // 0-11
    const isCurrentYear = state.selectedYear === state.monthPickerYear;
    const monthNames = state.lang === 'en' ? ENGLISH_MONTHS_SHORT : GREEK_MONTHS_SHORT;

    for (let m = 0; m < 12; m++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'google-picker-btn';
      btn.textContent = monthNames[m];
      if (m === currentMonth && isCurrentYear) {
        btn.classList.add('active');
      }
      btn.onclick = () => {
        selectMonthPickerMonth(m);
      };
      monthsGrid.appendChild(btn);
    }
  }

  const yearsGrid = document.getElementById('month-picker-bs-years-view');
  if (yearsGrid) {
    yearsGrid.innerHTML = '';
    
    if (!window.monthPickerBSYearStart) {
      window.monthPickerBSYearStart = Math.floor((state.monthPickerYear - 2020) / 6) * 6 + 2020;
    }
    
    const startY = window.monthPickerBSYearStart;
    const endY = startY + 5;
    
    const labelSpan = document.getElementById('month-picker-bs-year-label');
    if (labelSpan && yearsGrid.style.display !== 'none') {
      labelSpan.style.display = 'flex';
      labelSpan.style.alignItems = 'center';
      labelSpan.style.justifyContent = 'center';
      labelSpan.innerHTML = `
        <span style="cursor: pointer; padding: 6px 16px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" onclick="event.stopPropagation(); shiftMonthPickerBSYears(-6)">
          <i class="fa-solid fa-chevron-left" style="font-size: 14px; color: var(--accent, #e05e55);"></i>
        </span>
        <span style="margin: 0 8px; font-weight: 700; color: #ffffff; min-width: 110px; text-align: center;">${startY} - ${endY}</span>
        <span style="cursor: pointer; padding: 6px 16px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" onclick="event.stopPropagation(); shiftMonthPickerBSYears(6)">
          <i class="fa-solid fa-chevron-right" style="font-size: 14px; color: var(--accent, #e05e55);"></i>
        </span>
      `;
    }

    const systemYear = new Date().getFullYear();

    for (let y = startY; y <= endY; y++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'google-picker-btn';
      btn.textContent = y;
      if (y === state.monthPickerYear) {
        btn.classList.add('active');
      } else if (y === systemYear) {
        btn.classList.add('today-year');
      }
      btn.onclick = () => {
        state.monthPickerYear = y;
        toggleMonthPickerYearView(false);
        renderMonthPickerBS();
      };
      yearsGrid.appendChild(btn);
    }
  }
}

function selectMonthPickerMonth(monthIndex) {
  state.selectedMonth = monthIndex;
  state.selectedYear = state.monthPickerYear;
  
  // Sync to Stats date
  syncStatsDate();

  // Update UI components
  updateUI();
  
  // Update stats tab (if active or loaded)
  renderStatsTab();

  closeModal('month-picker-modal');
  setTimeout(() => scrollToToday('auto'), 50);
}

window.toggleMonthPickerYearView = toggleMonthPickerYearView;

function initPullToRefresh() {
  const container = document.querySelector('.app-content');
  const ptr = document.getElementById('pull-to-refresh');
  if (!container || !ptr) return;
  
  const ptrIcon = ptr.querySelector('.pull-to-refresh-icon');
  const ptrContent = ptr.querySelector('.pull-to-refresh-content');
  
  let startX = 0;
  let startY = 0;
  let currentY = 0;
  let pulling = false; // false, true, or null (undetermined)
  const threshold = 60; // px to trigger refresh
  const maxPull = 100; // max px to pull container
  
  // Helper to update pull state visually
  function updatePull(diff) {
    if (diff <= 0) {
      ptr.style.height = '0px';
      ptrContent.style.opacity = '0';
      ptrContent.style.transform = 'scale(0.8)';
      return;
    }
    // simple rubber band effect
    const pullHeight = Math.min(maxPull, diff * 0.4);
    ptr.style.height = `${pullHeight}px`;
    
    const progress = Math.min(1, pullHeight / threshold);
    ptrContent.style.opacity = progress.toString();
    ptrContent.style.transform = `scale(${0.8 + progress * 0.2})`;
    
    if (pullHeight >= threshold) {
      ptrIcon.style.transform = 'rotate(180deg)';
      ptrIcon.style.color = 'var(--blue-positive)';
    } else {
      ptrIcon.style.transform = 'rotate(0deg)';
      ptrIcon.style.color = 'var(--accent)';
    }
  }

  // Helper to start the refresh process
  async function triggerRefresh() {
    ptr.classList.remove('pulling');
    ptr.classList.add('refreshing');
    ptr.style.height = '55px';
    ptrContent.style.opacity = '1';
    ptrContent.style.transform = 'scale(1)';
    
    if (navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch (err) {}
    }
    
    try {
      await loadData();
      updateUI();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      // Keep showing spinner for a brief moment for smooth visual confirmation
      setTimeout(() => {
        ptr.style.transition = 'height 0.3s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.3s ease';
        ptr.style.height = '0px';
        ptrContent.style.opacity = '0';
        ptr.classList.remove('refreshing');
        setTimeout(() => {
          ptr.style.transition = '';
          ptrIcon.style.transform = '';
          ptrIcon.style.display = '';
          ptrIcon.style.color = '';
        }, 300);
      }, 800);
    }
  }

  // Helper to cancel the pull and snap back
  function cancelPull() {
    ptr.classList.remove('pulling');
    ptr.style.transition = 'height 0.3s cubic-bezier(0.19, 1, 0.22, 1)';
    ptr.style.height = '0px';
    ptrContent.style.opacity = '0';
    ptrContent.style.transform = 'scale(0.8)';
    setTimeout(() => {
      ptr.style.transition = '';
      ptrIcon.style.transform = '';
      ptrIcon.style.display = '';
      ptrIcon.style.color = '';
    }, 300);
  }

  // TOUCH EVENTS
  container.addEventListener('touchstart', (e) => {
    const activeScrollEl = document.querySelector(`.tab-screen.active .${state.activeTab}-scroll-content`);
    let isScrollAtTop = activeScrollEl ? (activeScrollEl.scrollTop === 0) : (container.scrollTop === 0);

    if (isScrollAtTop) {
      const touch = e.touches[0];
      startX = touch.pageX;
      startY = touch.pageY;
      currentY = startY;
      pulling = null; // Undetermined at first touch
    } else {
      pulling = false;
    }
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (pulling === false) return;
    
    const touch = e.touches[0];
    const dx = touch.pageX - startX;
    const dy = touch.pageY - startY;

    if (pulling === null) {
      // Must drag at least 10px to determine intention
      if (Math.abs(dy) > 10 || Math.abs(dx) > 10) {
        if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
          pulling = true;
          ptr.classList.add('pulling');
          ptr.classList.remove('refreshing');
          ptrIcon.style.display = 'flex';
          ptr.querySelector('.pull-to-refresh-spinner').style.display = 'none';
        } else {
          pulling = false;
          return;
        }
      } else {
        return;
      }
    }

    if (pulling === true) {
      currentY = touch.pageY;
      const diff = currentY - startY;
      if (diff > 0) {
        if (e.cancelable) {
          e.preventDefault();
        }
        updatePull(diff);
      } else {
        pulling = false;
        cancelPull();
      }
    }
  }, { passive: false });

  container.addEventListener('touchend', () => {
    if (pulling !== true) {
      pulling = false;
      return;
    }
    pulling = false;
    const diff = currentY - startY;
    const pullHeight = Math.min(maxPull, diff * 0.4);
    if (pullHeight >= threshold) {
      triggerRefresh();
    } else {
      cancelPull();
    }
  }, { passive: true });

  container.addEventListener('touchcancel', () => {
    pulling = false;
    cancelPull();
  }, { passive: true });
}

function enterSelectionMode() {
  ensureHistoryPushed();
  state.selectionMode = true;
  state.selectedIds.clear();
  
  const bar = document.getElementById('selection-bar');
  if (bar) bar.classList.add('active');
  
  const fab = document.getElementById('fab-btn');
  if (fab) fab.classList.add('hidden');
  
  updateSelectionHeader();
  renderTransactionsTab();
}

function exitSelectionMode() {
  state.selectionMode = false;
  state.selectedIds.clear();
  
  const bar = document.getElementById('selection-bar');
  if (bar) bar.classList.remove('active');
  
  const fab = document.getElementById('fab-btn');
  if (fab) fab.classList.remove('hidden');
  
  renderTransactionsTab();
}

function toggleSelection(id) {
  if (state.selectedIds.has(id)) {
    state.selectedIds.delete(id);
  } else {
    state.selectedIds.add(id);
  }
  updateSelectionHeader();
  renderTransactionsTab();
}

function updateSelectionHeader() {
  const countSpan = document.getElementById('selection-count');
  if (countSpan) {
    countSpan.textContent = `${state.selectedIds.size} επιλεγμένα`;
  }
}

function getVisibleTransactionIds() {
  const monthStartDay = parseInt(localStorage.getItem('app_month_start') || '1', 10);
  let start, end;
  if (monthStartDay === 1) {
    start = new Date(state.selectedYear, state.selectedMonth, 1, 0, 0, 0, 0);
    end = new Date(state.selectedYear, state.selectedMonth + 1, 0, 23, 59, 59, 999);
  } else {
    start = new Date(state.selectedYear, state.selectedMonth, monthStartDay, 0, 0, 0, 0);
    end = new Date(state.selectedYear, state.selectedMonth + 1, monthStartDay - 1, 23, 59, 59, 999);
  }

  return state.transactions.filter(t => {
    if (!t.date) return false;
    const tDate = new Date(String(t.date).replace(' ', 'T'));
    return tDate >= start && tDate <= end;
  }).map(t => t.id);
}

function toggleSelectAll() {
  const visibleIds = getVisibleTransactionIds();
  const allSelected = visibleIds.every(id => state.selectedIds.has(id));
  
  if (allSelected) {
    visibleIds.forEach(id => state.selectedIds.delete(id));
  } else {
    visibleIds.forEach(id => state.selectedIds.add(id));
  }
  updateSelectionHeader();
  renderTransactionsTab();
}

async function deleteSelectedTransactions() {
  const selectedIds = Array.from(state.selectedIds);
  if (selectedIds.length === 0) return;
  
  const msg = selectedIds.length === 1 ? 'Να διαγραφεί η επιλεγμένη συναλλαγή;' : `Να διαγραφούν οι ${selectedIds.length} επιλεγμένες συναλλαγές;`;
  const confirmed = await showConfirm(msg, state.lang === 'el' ? 'Διαγραφή' : 'Delete', '🗑️');
  if (!confirmed) return;
  
  // Find duplicates of all selected transactions to delete them too
  const idsToDeleteSet = new Set(selectedIds.map(String));
  
  selectedIds.forEach(id => {
    const tx = state.transactions.find(t => t.id === id);
    if (tx) {
      const txDate = String(tx.date || '').split('T')[0].split(' ')[0];
      const txAmount = (parseFloat(tx.amount) || 0).toFixed(2);
      state.transactions.forEach(t => {
        if (t.id && t.id !== id) {
          const tDate = String(t.date || '').split('T')[0].split(' ')[0];
          const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
          const isDupe = tDate === txDate &&
                         tAmount === txAmount &&
                         t.type === tx.type &&
                         t.category === tx.category &&
                         (t.account_from || '') === (tx.account_from || '') &&
                         (t.account_to || '') === (tx.account_to || '') &&
                         (t.note || '') === (tx.note || '') &&
                         (t.user_id || '') === (tx.user_id || '');
          if (isDupe) {
            idsToDeleteSet.add(String(t.id));
          }
        }
      });
    }
  });

  const idsToDelete = Array.from(idsToDeleteSet);

  // 1. Suppress realtime events
  _suppressRealtimeEvents = true;

  // 2. Process each transaction deletion locally & trigger background sync/delete
  for (const id of idsToDelete) {
    _deletingTxIds.add(String(id));
    
    // Clean up local receipt photo from IndexedDB
    ReceiptStorage.remove(id).catch(err => {
      console.warn('Failed to remove receipt during transaction delete:', err);
    });

    // Optimistically delete from local state (updates state.transactions and deletedRecurringDates)
    deleteTransactionOffline(id, true);
  }
  localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));

  // Perform background delete in bulk
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    (async () => {
      try {
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .delete()
            .in('id', idsToDelete),
          12000
        );
        if (error) throw error;
        console.log(`Cloud delete success for selected transactions (and dupes):`, idsToDelete);
      } catch (err) {
        console.warn(`Cloud delete failed for selected, queueing deletes:`, idsToDelete, err);
        idsToDelete.forEach(id => enqueueSyncMutation('delete', id));
      } finally {
        idsToDelete.forEach(id => _deletingTxIds.delete(String(id)));
      }
    })();
  } else {
    idsToDelete.forEach(id => _deletingTxIds.delete(String(id)));
  }

  // 3. Clear selection and exit selection mode
  exitSelectionMode();

  // 4. Update calculations and render UI once
  calculateInitialBalances();
  updateUI();

  // 5. Re-enable realtime after enough time
  setTimeout(() => { _suppressRealtimeEvents = false; }, 8000);
}

window.enterSelectionMode = enterSelectionMode;
window.exitSelectionMode = exitSelectionMode;
window.toggleSelectAll = toggleSelectAll;
window.deleteSelectedTransactions = deleteSelectedTransactions;

function initSwipeToBack() {
  const TAB_ORDER = ['trans', 'stats', 'accounts', 'more'];
  let bsStartX = 0, bsStartY = 0, bsActive = false, bsSwiping = null;
  let bsDragging = false;
  const COMMIT_RATIO = 0.30; // 30% of screen width to commit

  let activeOverlayEl = null;
  let activeOverlayParent = null;

  // Setup system history state to prevent exiting the app on system back gesture/button (PWA fallback)
  history.pushState({ appState: 'active' }, '', window.location.pathname + window.location.search);
  state.historyPushed = true;

  window.addEventListener('popstate', (e) => {
    // Only run popstate logic if NOT inside Capacitor (because Capacitor handles back button natively via App plugin)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      return;
    }
    const handled = triggerBackAction();
    if (handled) {
      // Re-push to keep intercepting subsequent back actions
      history.pushState({ appState: 'active' }, '', window.location.pathname + window.location.search);
      state.historyPushed = true;
    } else {
      state.historyPushed = false;
    }
  });

  // Native Capacitor Back Button Interception
  function registerCapacitorBackButton() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      const App = window.Capacitor.Plugins.App;
      if (App && typeof App.addListener === 'function') {
        App.addListener('backButton', () => {
          const handled = triggerBackAction();
          if (!handled) {
            App.exitApp();
          }
        });
        return true;
      }
    }
    return false;
  }

  if (!registerCapacitorBackButton()) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (registerCapacitorBackButton() || attempts > 50) {
        clearInterval(interval);
      }
    }, 100);
  }

  function hasActiveOverlay() {
    // Check if any modal, keypad, search, or selection mode is active
    const lightbox = document.getElementById('photo-lightbox-modal');
    if (lightbox && lightbox.style.display === 'flex') return true;
    const keypad = document.getElementById('custom-calculator-keypad');
    if (keypad && keypad.classList.contains('active')) return true;
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    if (activeModals.length > 0) return true;
    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay && searchOverlay.classList.contains('active')) return true;
    if (state.selectionMode) return true;
    return false;
  }

  function getActiveOverlayElement() {
    const lightbox = document.getElementById('photo-lightbox-modal');
    if (lightbox && lightbox.style.display === 'flex') return lightbox;

    const keypad = document.getElementById('custom-calculator-keypad');
    if (keypad && keypad.classList.contains('active')) return null; // do not drag keypad horizontally
    
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    if (activeModals.length > 0) {
      return activeModals[activeModals.length - 1].querySelector('.modal-content');
    }
    
    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay && searchOverlay.classList.contains('active')) return searchOverlay;
    
    return null;
  }

  function cleanupOverlayStyles(el, parent) {
    if (el) {
      el.style.transform = '';
      el.style.transition = '';
      el.style.willChange = '';
    }
    if (parent) {
      parent.style.opacity = '';
      parent.style.transition = '';
      parent.style.willChange = '';
    }
  }

  function triggerBackAction() {
    // 0. Close photo lightbox if active
    const lightbox = document.getElementById('photo-lightbox-modal');
    if (lightbox && lightbox.style.display === 'flex') {
      closePhotoLightbox();
      return true;
    }

    // 1. Close calculator keypad if active
    const keypad = document.getElementById('custom-calculator-keypad');
    if (keypad && keypad.classList.contains('active')) {
      closeCalculatorKeypad();
      return true;
    }

    // 2. Close active modals (including transaction modal)
    const txModal = document.getElementById('transaction-modal');
    if (txModal && txModal.classList.contains('active')) {
      closeModal('transaction-modal');
      return true;
    }
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    if (activeModals.length > 0) {
      const topModal = activeModals[activeModals.length - 1];
      if (topModal.id) {
        closeModal(topModal.id);
      }
      return true;
    }

    // 3. Close search overlay if active
    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay && searchOverlay.classList.contains('active')) {
      closeSearchOverlay();
      return true;
    }

    // 4. Cancel selection mode
    if (state.selectionMode) {
      exitSelectionMode();
      return true;
    }

    // 5. Navigate to previous tab in order
    const currentIdx = TAB_ORDER.indexOf(state.activeTab);
    if (currentIdx > 0) {
      switchTab(TAB_ORDER[currentIdx - 1]);
      return true;
    }
    
    // 6. On trans tab with nothing to close — return false to let app exit
    return false;
  }

  // --- Interactive drag-to-go-back gesture ---
  let currentScreen = null;
  let prevScreen = null;
  let screenWidth = 0;

  document.addEventListener('touchstart', (e) => {
    // Check if touch starts in scrollable elements to ignore
    if (e.target.closest('#trans-photo-previews-list, .lightbox-zoom-container, #statsChart, canvas')) {
      bsActive = false;
      return;
    }
    
    // Also ignore if lightbox is zoomed in
    const img = document.getElementById('photo-lightbox-img');
    const isZoomed = img && parseFloat(img.dataset.scale || '1') > 1;
    if (isZoomed) {
      bsActive = false;
      return;
    }

    const touch = e.touches[0];
    bsStartX = touch.clientX;
    bsStartY = touch.clientY;
    bsSwiping = null;
    bsDragging = false;
    
    // If an overlay/modal is active, allow swiping back starting from the left 150px
    // If no overlay is active, only allow starting from the left 60px
    const activeZone = hasActiveOverlay() ? 150 : 60;
    bsActive = bsStartX <= activeZone;
    
    currentScreen = null;
    prevScreen = null;
    screenWidth = window.innerWidth;
    activeOverlayEl = null;
    activeOverlayParent = null;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!bsActive) return;
    const touch = e.touches[0];
    const dx = touch.clientX - bsStartX;
    const dy = touch.clientY - bsStartY;

    // Determine if this is a horizontal swipe
    if (bsSwiping === null) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        bsSwiping = Math.abs(dx) > Math.abs(dy) && dx > 0;
        if (!bsSwiping) { bsActive = false; return; }
      } else return;
    }

    if (e.cancelable) e.preventDefault();

    const clampedDx = Math.max(0, Math.min(dx, screenWidth));
    const progress = clampedDx / screenWidth;

    // If there are overlays active, slide the active overlay horizontally
    if (hasActiveOverlay()) {
      if (!bsDragging) {
        bsDragging = true;
        activeOverlayEl = getActiveOverlayElement();
        if (activeOverlayEl) {
          activeOverlayParent = activeOverlayEl.closest('.modal-overlay') || activeOverlayEl;
          activeOverlayEl.style.transition = 'none';
          activeOverlayEl.style.willChange = 'transform';
          if (activeOverlayParent) {
            activeOverlayParent.style.transition = 'none';
            activeOverlayParent.style.willChange = 'opacity';
          }
        }
      }

      if (activeOverlayEl) {
        activeOverlayEl.style.transform = `translateX(${clampedDx}px)`;
        if (activeOverlayParent) {
          activeOverlayParent.style.opacity = String(1 - progress * 0.5);
        }
      }
      return;
    }

    // Start drag: set up screens for interactive slide (when no overlays)
    if (!bsDragging) {
      bsDragging = true;
      const currentTabIdx = TAB_ORDER.indexOf(state.activeTab);
      currentScreen = document.getElementById(`${state.activeTab}-screen`);

      if (currentTabIdx > 0) {
        const prevTabName = TAB_ORDER[currentTabIdx - 1];
        prevScreen = document.getElementById(`${prevTabName}-screen`);
        
        // Prepare prev screen: show it behind current, shifted left
        if (prevScreen) {
          prevScreen.style.display = 'block';
          prevScreen.style.visibility = 'visible';
          prevScreen.classList.remove('active', 'slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');
          prevScreen.style.position = 'absolute';
          prevScreen.style.top = '0';
          prevScreen.style.left = '0';
          prevScreen.style.width = '100%';
          prevScreen.style.zIndex = '1';
          prevScreen.style.transform = 'translateX(-30%)';
          prevScreen.style.transition = 'none';
        }
      }

      if (currentScreen) {
        currentScreen.style.position = 'absolute';
        currentScreen.style.top = '0';
        currentScreen.style.left = '0';
        currentScreen.style.width = '100%';
        currentScreen.style.zIndex = '5';
        currentScreen.style.transition = 'none';
        currentScreen.style.willChange = 'transform';
      }
    }

    // Move current screen with finger
    if (currentScreen) {
      currentScreen.style.transform = `translateX(${clampedDx}px)`;
      currentScreen.style.opacity = String(1 - progress * 0.3);
    }
    if (prevScreen) {
      // Prev screen parallax: from -30% to 0%
      const prevOffset = -30 + (progress * 30);
      prevScreen.style.transform = `translateX(${prevOffset}%)`;
      prevScreen.style.opacity = String(0.6 + progress * 0.4);
    }
  }, { passive: false });

  function cleanupDragStyles(screen) {
    if (!screen) return;
    screen.style.position = '';
    screen.style.top = '';
    screen.style.left = '';
    screen.style.width = '';
    screen.style.zIndex = '';
    screen.style.transition = '';
    screen.style.transform = '';
    screen.style.opacity = '';
    screen.style.willChange = '';
  }

  function finishDrag(committed) {
    if (!bsDragging) return;

    // Capture screen references immediately in local variables to avoid race conditions 
    // with touchstart resetting outer scope variables before our timeout runs.
    const currScreen = currentScreen;
    const pScreen = prevScreen;
    const activeEl = activeOverlayEl;
    const parentEl = activeOverlayParent;

    // Reset outer references immediately
    activeOverlayEl = null;
    activeOverlayParent = null;
    currentScreen = null;
    prevScreen = null;
    bsDragging = false;

    if (activeEl) {
      const dur = '0.22s';
      if (committed) {
        activeEl.style.transition = `transform ${dur} cubic-bezier(0.2, 0.8, 0.3, 1)`;
        activeEl.style.transform = `translateX(${screenWidth}px)`;
        if (parentEl) {
          parentEl.style.transition = `opacity ${dur} ease`;
          parentEl.style.opacity = '0';
        }
        setTimeout(() => {
          triggerBackAction();
          cleanupOverlayStyles(activeEl, parentEl);
        }, 230);
      } else {
        activeEl.style.transition = `transform ${dur} cubic-bezier(0.2, 0.8, 0.3, 1)`;
        activeEl.style.transform = '';
        if (parentEl) {
          parentEl.style.transition = `opacity ${dur} ease`;
          parentEl.style.opacity = '';
        }
        setTimeout(() => {
          cleanupOverlayStyles(activeEl, parentEl);
        }, 210);
      }
      return;
    }

    const currentTabIdx = TAB_ORDER.indexOf(state.activeTab);

    if (committed && currentTabIdx > 0) {
      // Animate current screen off to the right
      const dur = '0.22s';
      if (currScreen) {
        currScreen.style.transition = `transform ${dur} cubic-bezier(0.2, 0.8, 0.3, 1), opacity ${dur} ease`;
        currScreen.style.transform = `translateX(${screenWidth}px)`;
        currScreen.style.opacity = '0';
      }
      if (pScreen) {
        pScreen.style.transition = `transform ${dur} cubic-bezier(0.2, 0.8, 0.3, 1), opacity ${dur} ease`;
        pScreen.style.transform = 'translateX(0)';
        pScreen.style.opacity = '1';
      }

      setTimeout(() => {
        // Clean up styles
        if (currScreen) {
          currScreen.style.display = 'none';
          currScreen.style.visibility = 'hidden';
          currScreen.classList.remove('active');
          cleanupDragStyles(currScreen);
        }
        if (pScreen) {
          cleanupDragStyles(pScreen);
          pScreen.classList.add('active');
        }

        // Update state
        const prevTabName = TAB_ORDER[currentTabIdx - 1];
        state.activeTab = prevTabName;
        document.body.classList.toggle('trans-tab-active', prevTabName === 'trans');
        document.body.classList.toggle('stats-tab-active', prevTabName === 'stats');
        document.body.classList.toggle('accounts-tab-active', prevTabName === 'accounts');
        document.body.classList.toggle('more-tab-active', prevTabName === 'more');
        document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.getAttribute('data-tab') === prevTabName));

        // Ensure history is correct
        ensureHistoryPushed();

        // Render the new tab with deferred heavy rendering to prevent flicker
        if (prevTabName === 'trans') {
          const today = new Date();
          state.selectedMonth = today.getMonth();
          state.selectedYear = today.getFullYear();
          syncStatsDate();
          requestAnimationFrame(() => {
            setTimeout(() => {
              updateUI();
            }, 50);
          });
        } else if (prevTabName === 'stats') {
          // Defer heavy chart rendering until transition settles
          requestAnimationFrame(() => {
            setTimeout(() => {
              renderStatsTab();
            }, 50);
          });
        } else if (prevTabName === 'accounts') renderAccountsTab();
        else if (prevTabName === 'more') renderPartnerSection();
      }, 230);
    } else if (committed && currentTabIdx === 0) {
      // On trans tab - snap back instead of exiting
      const dur = '0.2s';
      if (currScreen) {
        currScreen.style.transition = `transform ${dur} cubic-bezier(0.2, 0.8, 0.3, 1), opacity ${dur} ease`;
        currScreen.style.transform = 'translateX(0)';
        currScreen.style.opacity = '1';
      }
      setTimeout(() => {
        cleanupDragStyles(currScreen);
      }, 210);
    } else {
      // Snap back - not committed
      const dur = '0.2s';
      if (currScreen) {
        currScreen.style.transition = `transform ${dur} cubic-bezier(0.2, 0.8, 0.3, 1), opacity ${dur} ease`;
        currScreen.style.transform = 'translateX(0)';
        currScreen.style.opacity = '1';
      }
      if (pScreen) {
        pScreen.style.transition = `transform ${dur} cubic-bezier(0.2, 0.8, 0.3, 1), opacity ${dur} ease`;
        pScreen.style.transform = 'translateX(-30%)';
        pScreen.style.opacity = '0.6';
      }

      setTimeout(() => {
        cleanupDragStyles(currScreen);
        if (pScreen) {
          pScreen.style.display = 'none';
          pScreen.style.visibility = 'hidden';
          cleanupDragStyles(pScreen);
        }
      }, 210);
    }
  }

  document.addEventListener('touchend', (e) => {
    if (!bsActive || !bsSwiping) {
      bsActive = false; bsSwiping = null;
      if (bsDragging) finishDrag(false);
      return;
    }

    const touch = e.changedTouches[0] || e.touches[0];
    const dx = touch.clientX - bsStartX;
    bsActive = false; bsSwiping = null;

    if (bsDragging) {
      // For drag: commit if past threshold
      const committed = dx >= screenWidth * COMMIT_RATIO;
      finishDrag(committed);
    } else if (dx >= 72) {
      // Quick swipe past threshold without full drag (overlay mode)
      triggerBackAction();
    }
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    if (bsDragging) finishDrag(false);
    bsActive = false;
    bsSwiping = null;
  }, { passive: true });
}


function updateSubcategorySuggestions() {
  const categoryHidden = document.getElementById('trans-category');
  const subcatList = document.getElementById('subcategory-picker-list');
  if (!categoryHidden || !subcatList) return;
  
  const category = categoryHidden.value;
  subcatList.innerHTML = '';
  
  const currentSubcategory = document.getElementById('trans-subcategory-select').value;
  
  if (!category) {
    subcatList.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">Επιλέξτε πρώτα κατηγορία</div>`;
    return;
  }
  
  const cleanedCat = stripLeadingEmoji(category).toUpperCase();
  const uniqueSubcats = new Set();
  
  const defaults = DEFAULT_SUBCATEGORIES_MAP[cleanedCat];
  if (defaults) {
    defaults.forEach(sub => uniqueSubcats.add(sub));
  }
  
  state.transactions.forEach(t => {
    if (t.category && stripLeadingEmoji(t.category).toUpperCase() === cleanedCat) {
      if (t.subcategory && t.subcategory.trim() !== '') {
        uniqueSubcats.add(t.subcategory.trim());
      }
    }
  });
  
  // Add "No subcategory" option at the top
  const noneOpt = document.createElement('div');
  noneOpt.className = 'subcategory-item none-subcat';
  if (currentSubcategory === '') noneOpt.classList.add('selected');
  noneOpt.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-ban" style="color:var(--text-muted);font-size:12px;"></i> <span style="font-weight: 500; color: var(--text-secondary);">${state.lang === 'en' ? 'No subcategory' : 'Χωρίς υποκατηγορία'}</span></div>`;
  noneOpt.onclick = () => selectSubcategory('');
  subcatList.appendChild(noneOpt);

  Array.from(uniqueSubcats).sort().forEach(sub => {
    const div = document.createElement('div');
    div.className = 'subcategory-item';
    if (sub === currentSubcategory) div.classList.add('selected');
    div.innerHTML = `<span>${getSubcategoryDisplayName(sub, category)}</span>`;
    div.onclick = () => selectSubcategory(sub);
    subcatList.appendChild(div);
  });
  
  const newOpt = document.createElement('div');
  newOpt.className = 'subcategory-item new-subcat';
  newOpt.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-plus"></i> <span>${TRANSLATIONS[state.lang]['option_new_subcategory'] || 'Νέα υποκατηγορία...'}</span></div>`;
  newOpt.onclick = () => {
    closeModal('subcategory-picker-modal');
    showSubcategorySelect();
  };
  subcatList.appendChild(newOpt);
}

function showSubcategorySelect() {
  const trigger = document.getElementById('trans-subcategory-trigger');
  const custom = document.getElementById('trans-subcategory-custom');
  const cancelBtn = document.getElementById('btn-cancel-custom-sub');
  
  if (trigger && custom && cancelBtn) {
    trigger.style.display = 'none';
    custom.style.display = 'block';
    cancelBtn.style.display = 'block';
    document.getElementById('trans-subcategory-select').value = '__NEW__';
    setTimeout(() => custom.focus(), 50);
  }
}

function hideSubcategorySelect() {
  const trigger = document.getElementById('trans-subcategory-trigger');
  const custom = document.getElementById('trans-subcategory-custom');
  const cancelBtn = document.getElementById('btn-cancel-custom-sub');
  
  if (trigger && custom && cancelBtn) {
    trigger.style.display = 'flex';
    custom.style.display = 'none';
    cancelBtn.style.display = 'none';
    
    // Clear input
    custom.value = '';
    document.getElementById('trans-subcategory-select').value = '';
    document.getElementById('trans-subcategory-display').innerHTML = `<span class="custom-select-placeholder" data-i18n="placeholder_subcategory">Πατήστε για επιλογή</span>`;
  }
}

// Bind to window
window.showSubcategorySelect = showSubcategorySelect;
window.hideSubcategorySelect = hideSubcategorySelect;

function initTabSwipeNavigation() {
  const appContent = document.querySelector('.app-content');
  if (!appContent) return;

  const TAB_ORDER = ['trans', 'stats', 'accounts', 'more'];
  let startX = 0;
  let startY = 0;
  let touchActive = false;
  let isSwipingHorizontal = null;
  const dragThreshold = 80; // Minimum drag in px to trigger tab switch
  const edgeThreshold = 50; // Ignore starts within 50px of left edge (reserved for back swipe)

  appContent.addEventListener('touchstart', (e) => {
    // Only capture if no modals are active, not in selection mode, and not already swiping
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    const searchOverlay = document.getElementById('search-overlay');
    const isSearchActive = searchOverlay && searchOverlay.classList.contains('active');
    if (activeModals.length > 0 || isSearchActive || state.selectionMode || state.isSwipingMonth) {
      touchActive = false;
      return;
    }

    // Ignore horizontal scroll containers
    if (e.target.closest('.category-quick-filters, .quick-filter-chips, .filters-panel-header, #statsChart, canvas, .stats-subcategories-container')) {
      touchActive = false;
      return;
    }

    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    
    // Ignore edge starts so they don't double-trigger with edge-swipe-to-back
    if (startX <= edgeThreshold) {
      touchActive = false;
      return;
    }
    
    touchActive = true;
    isSwipingHorizontal = null;
  }, { passive: true });

  appContent.addEventListener('touchmove', (e) => {
    if (!touchActive) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (isSwipingHorizontal === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Only enable horizontal swipes on Transactions and Stats tabs
          if (state.activeTab === 'trans' || state.activeTab === 'stats') {
            isSwipingHorizontal = true;
            state.isSwipingMonth = true;
            document.body.classList.add('is-swiping-month');
          } else {
            isSwipingHorizontal = false;
            touchActive = false;
          }
        } else {
          isSwipingHorizontal = false;
          touchActive = false;
        }
      }
    }

    if (isSwipingHorizontal === true) {
      // Prevent vertical scrolling while swiping months
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });

  appContent.addEventListener('touchend', (e) => {
    if (!touchActive) return;
    touchActive = false;

    if (isSwipingHorizontal === true) {
      if (e.cancelable) e.preventDefault();
      state.lastSwipeTime = Date.now();
      const touch = e.changedTouches[0] || e.touches[0];
      const deltaX = touch.clientX - startX;

      if (Math.abs(deltaX) >= dragThreshold) {
        if (state.activeTab === 'trans') {
          if (deltaX > 0) {
            navigateMonth(-1, deltaX);
          } else {
            navigateMonth(1, deltaX);
          }
        } else if (state.activeTab === 'stats') {
          if (deltaX > 0) {
            adjustStatsPeriod(-1, deltaX);
          } else {
            adjustStatsPeriod(1, deltaX);
          }
        }
      } else {
        // Cancelled swipe: clear state after 100ms to ignore delayed click events
        setTimeout(() => {
          state.isSwipingMonth = false;
          state.touchDidMove = false;
          state.lastSwipeTime = Date.now();
          document.body.classList.remove('is-swiping-month');
        }, 100);
      }
    } else {
      state.isSwipingMonth = false;
      // If no horizontal swipe detected, reset touchDidMove after brief delay
      // so any phantom click can still be blocked if movement was detected
      setTimeout(() => { state.touchDidMove = false; }, 350);
      document.body.classList.remove('is-swiping-month');
    }
    isSwipingHorizontal = null;
  }, { passive: false });

  appContent.addEventListener('touchcancel', () => {
    touchActive = false;
    isSwipingHorizontal = null;
    setTimeout(() => {
      state.isSwipingMonth = false;
      state.touchDidMove = false;
      state.lastSwipeTime = Date.now();
      document.body.classList.remove('is-swiping-month');
    }, 100);
  }, { passive: true });
}


function animateSwipeTransition(direction, callback, startingDeltaX = 0) {
  // Only slide the scrollable content list, not the entire screen
  // This keeps the header, summary bar, and stats header stable
  const listEl = state.activeTab === 'trans'
    ? document.getElementById('transactions-list')
    : state.activeTab === 'stats'
      ? document.getElementById('stats-breakdown-list')
      : null;

  const width = window.innerWidth;
  const outX = direction > 0 ? -width * 0.5 : width * 0.5;

  // Use rAF instead of forced reflow to avoid blocking the main thread
  function animateEl(el, fromX, toX, opacity, duration, easing, cb) {
    if (!el) { if (cb) cb(); return; }
    el.style.transition = 'none';
    el.style.transform = `translateX(${fromX}px)`;
    el.style.opacity = String(opacity[0]);
    // rAF to allow browser to paint before starting transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;
        el.style.transform = `translateX(${toX}px)`;
        el.style.opacity = String(opacity[1]);
        setTimeout(() => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; if (cb) cb(); }, duration);
      });
    });
  }

  // Ensure isSwipingMonth is active during the animation
  state.isSwipingMonth = true;
  document.body.classList.add('is-swiping-month');

  if (listEl) {
    // Slide current content out — faster exit (100ms)
    const startFrom = startingDeltaX !== 0 ? startingDeltaX : 0;
    animateEl(listEl, startFrom, outX, [1, 0], 100, 'cubic-bezier(0.4, 0, 0.6, 1)', () => {
      callback();
      // Slide new content in from opposite direction — snappy entrance (160ms)
      const inX = -outX;
      const newListEl = state.activeTab === 'trans'
        ? document.getElementById('transactions-list')
        : document.getElementById('stats-breakdown-list');
      animateEl(newListEl, inX, 0, [0, 1], 160, 'cubic-bezier(0.2, 0.8, 0.4, 1)', () => {
        // Clear swiping state immediately after animations complete to allow consecutive fast swipes
        state.isSwipingMonth = false;
        state.touchDidMove = false;
        state.lastSwipeTime = Date.now();
        document.body.classList.remove('is-swiping-month');
        if (state.activeTab === 'stats') {
          renderStatsTab(false);
        }
      });
    });
  } else {
    callback();
    state.isSwipingMonth = false;
    state.touchDidMove = false;
    state.lastSwipeTime = Date.now();
    document.body.classList.remove('is-swiping-month');
  }
}

// Lightweight render for swipe navigation — only updates list + header, skips dropdowns/currency/etc.
function renderTransactionsForSwipe() {
  processRecurringTemplates();
  updateHeaderAndSync();
  renderTransactionsTab();
  lastRenderedCategoryType = null;
}

function navigateMonth(direction, startingDeltaX = 0) {
  animateSwipeTransition(direction, () => {
    state.selectedMonth += direction;
    if (state.selectedMonth < 0) {
      state.selectedMonth = 11;
      state.selectedYear--;
    } else if (state.selectedMonth > 11) {
      state.selectedMonth = 0;
      state.selectedYear++;
    }
    syncStatsDate();
    // Use lightweight render during swipe — skips dropdowns, currency symbols etc.
    renderTransactionsForSwipe();
    setTimeout(() => scrollToToday('auto'), 50);
  }, startingDeltaX);
}

function initRippleEffects() {
  document.addEventListener('pointerdown', (e) => {
    const target = e.target.closest('button, .nav-item, .transaction-item, .calc-key-btn, .fab, .settings-card, .settings-list-item, .stats-tab-btn, .stats-dropdown-item');
    if (!target) return;

    const isScrollable = target.classList.contains('transaction-item') || 
                         target.classList.contains('settings-list-item') || 
                         target.classList.contains('stats-sub-row');

    const createRipple = () => {
      // Check if element has relative positioning to contain the ripple
      const rect = target.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(target);
      if (computedStyle.position === 'static') {
        target.style.position = 'relative';
      }
      
      // Ensure overflow is hidden to clip the ripple
      const originalOverflow = target.style.overflow;
      if (computedStyle.overflow !== 'hidden') {
        target.style.overflow = 'hidden';
      }

      // Create ripple element
      const ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      
      // Calculate ripple size (diameter should cover the diagonal of the element)
      const size = Math.max(rect.width, rect.height) * 1.5;
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;

      // Position ripple relative to touch/click coordinates
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      
      const x = clientX - rect.left - size / 2;
      const y = clientY - rect.top - size / 2;
      
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      
      // Add to target
      target.appendChild(ripple);
      
      // Trigger animation frame
      requestAnimationFrame(() => {
        ripple.classList.add('active');
      });
      
      // Remove ripple after animation finishes
      setTimeout(() => {
        ripple.remove();
        // Restore overflow if it was originally set differently
        if (originalOverflow) {
          target.style.overflow = originalOverflow;
        }
      }, 450);
    };

    if (e.pointerType === 'touch' && isScrollable) {
      // Delay ripple on touch of scrollable items to prevent ripple during swipe/scroll
      let didMove = false;
      const onMove = () => { didMove = true; };
      const onCleanup = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onCleanup);
        document.removeEventListener('pointercancel', onCleanup);
      };
      document.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerup', onCleanup, { passive: true });
      document.addEventListener('pointercancel', onCleanup, { passive: true });

      setTimeout(() => {
        onCleanup();
        if (!didMove && !state.isSwipingMonth) {
          createRipple();
        }
      }, 80);
    } else {
      createRipple();
    }
  }, { passive: true });
}

function initLightboxPinchZoom() {
  const img = document.getElementById('photo-lightbox-img');
  const modal = document.getElementById('photo-lightbox-modal');
  if (!img || !modal) return;

  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  let startDist = 0;
  let startScale = 1;
  let startCenter = { x: 0, y: 0 };
  let startTx = 0;
  let startTy = 0;
  
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  
  let lastTapTime = 0;

  function getDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }

  img.addEventListener('touchstart', (e) => {
    const now = Date.now();
    
    // Double tap to zoom/reset
    if (e.touches.length === 1 && now - lastTapTime < 300) {
      e.preventDefault();
      if (scale > 1) {
        resetTransform();
      } else {
        const touch = e.touches[0];
        const rect = img.getBoundingClientRect();
        const baseWidth = rect.width;
        const baseHeight = rect.height;
        const viewWidth = window.innerWidth;
        const viewHeight = window.innerHeight;
        
        scale = 2.5;
        const originX = viewWidth / 2;
        const originY = viewHeight / 2;
        translateX = (touch.clientX - originX) * (1 - scale);
        translateY = (touch.clientY - originY) * (1 - scale);
        
        // Clamp translations
        const maxTx = Math.max(0, (baseWidth * scale - viewWidth) / 2);
        const maxTy = Math.max(0, (baseHeight * scale - viewHeight) / 2);
        translateX = Math.max(-maxTx, Math.min(translateX, maxTx));
        translateY = Math.max(-maxTy, Math.min(translateY, maxTy));
        
        img.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)';
        img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      }
      lastTapTime = 0;
      return;
    }
    
    if (e.touches.length === 1) {
      lastTapTime = now;
      if (scale > 1) {
        isDragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTx = translateX;
        startTy = translateY;
      }
    } else if (e.touches.length === 2) {
      isDragging = false;
      e.preventDefault();
      startDist = getDistance(e.touches);
      startScale = scale;
      startCenter = getCenter(e.touches);
      startTx = translateX;
      startTy = translateY;
    }
  }, { passive: false });

  img.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isDragging && scale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      
      translateX = startTx + dx;
      translateY = startTy + dy;
      
      // Boundaries with visual resistance
      const rect = img.getBoundingClientRect();
      const baseWidth = rect.width / scale;
      const baseHeight = rect.height / scale;
      const viewWidth = window.innerWidth;
      const viewHeight = window.innerHeight;
      
      const maxTx = Math.max(0, (baseWidth * scale - viewWidth) / 2);
      const maxTy = Math.max(0, (baseHeight * scale - viewHeight) / 2);
      
      if (translateX > maxTx) translateX = maxTx + (translateX - maxTx) * 0.3;
      if (translateX < -maxTx) translateX = -maxTx + (translateX + maxTx) * 0.3;
      if (translateY > maxTy) translateY = maxTy + (translateY - maxTy) * 0.3;
      if (translateY < -maxTy) translateY = -maxTy + (translateY + maxTy) * 0.3;
      
      applyTransform();
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getDistance(e.touches);
      if (dist > 10 && startDist > 10) {
        const factor = dist / startDist;
        const targetScale = startScale * factor;
        
        scale = Math.max(0.8, Math.min(targetScale, 5));
        
        const currentCenter = getCenter(e.touches);
        const scaleRatio = scale / startScale;
        translateX = currentCenter.x - (startCenter.x - startTx) * scaleRatio;
        translateY = currentCenter.y - (startCenter.y - startTy) * scaleRatio;
        
        applyTransform();
      }
    }
  }, { passive: false });

  img.addEventListener('touchend', (e) => {
    isDragging = false;
    
    // Snapping back transitions
    if (scale < 1) {
      resetTransform();
    } else if (scale > 1) {
      const rect = img.getBoundingClientRect();
      const baseWidth = rect.width / scale;
      const baseHeight = rect.height / scale;
      const viewWidth = window.innerWidth;
      const viewHeight = window.innerHeight;
      
      const maxTx = Math.max(0, (baseWidth * scale - viewWidth) / 2);
      const maxTy = Math.max(0, (baseHeight * scale - viewHeight) / 2);
      
      let targetTx = translateX;
      let targetTy = translateY;
      let needsSnap = false;
      
      if (translateX > maxTx) { targetTx = maxTx; needsSnap = true; }
      else if (translateX < -maxTx) { targetTx = -maxTx; needsSnap = true; }
      
      if (translateY > maxTy) { targetTy = maxTy; needsSnap = true; }
      else if (translateY < -maxTy) { targetTy = -maxTy; needsSnap = true; }
      
      if (needsSnap) {
        translateX = targetTx;
        translateY = targetTy;
        img.style.transition = 'transform 0.2s ease-out';
        img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      }
    }
  });

  function applyTransform() {
    img.style.transition = 'none';
    img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    img.dataset.scale = scale;
  }

  function resetTransform() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    img.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)';
    img.style.transform = `translate(0px, 0px) scale(1)`;
    img.dataset.scale = 1;
  }
  
  window.resetLightboxPinchZoom = resetTransform;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'style') {
        const display = modal.style.display;
        if (display === 'none') {
          resetTransform();
        }
      }
    });
  });
  observer.observe(modal, { attributes: true });
}

// ============================================================
// SETTINGS AND LOCALIZATION HELPERS
// ============================================================
function getCurrencySymbol() {
  const currency = localStorage.getItem('app_currency') || 'EUR';
  switch (currency) {
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'JPY': return '¥';
    case 'EUR':
    default:
      return '€';
  }
}

function updateCurrencySymbols() {
  const symbol = getCurrencySymbol();
  document.querySelectorAll('.currency-symbol').forEach(el => {
    el.textContent = symbol;
  });
}

function changeMonthStartSetting(val) {
  localStorage.setItem('app_month_start', val);
  updateUI();
}

function changeWeekStartSetting(val) {
  localStorage.setItem('app_week_start', val);
  updateUI();
}

function changeCurrencySetting(val) {
  localStorage.setItem('app_currency', val);
  updateUI();
}

function updateSettingsDisplay() {
  const monthStart = localStorage.getItem('app_month_start') || '1';
  const weekStart = localStorage.getItem('app_week_start') || '1';
  const currency = localStorage.getItem('app_currency') || 'EUR';
  const theme = localStorage.getItem('app_theme') || 'dark';

  const monthDisplay = document.getElementById('settings-month-start-display');
  const weekDisplay = document.getElementById('settings-week-start-display');
  const currencyDisplay = document.getElementById('settings-currency-display');
  const themeDisplay = document.getElementById('settings-theme-display');

  if (monthDisplay) {
    monthDisplay.textContent = monthStart;
  }
  if (weekDisplay) {
    const weekLabels = {
      '1': state.lang === 'el' ? 'Δευτέρα' : 'Monday',
      '0': state.lang === 'el' ? 'Κυριακή' : 'Sunday',
      '6': state.lang === 'el' ? 'Σάββατο' : 'Saturday'
    };
    weekDisplay.textContent = weekLabels[weekStart] || weekStart;
  }
  if (currencyDisplay) {
    const currencyLabels = {
      'EUR': 'EUR (€)',
      'USD': 'USD ($)',
      'GBP': 'GBP (£)',
      'JPY': 'JPY (¥)'
    };
    currencyDisplay.textContent = currencyLabels[currency] || currency;
  }
  if (themeDisplay) {
    const themeLabels = {
      'dark': 'Premium Dark',
      'oled': 'OLED Black',
      'light': 'Classic Light',
      'emerald': 'Emerald Forest',
      'ocean': 'Ocean Breeze',
      'pink': 'Blossom Pink'
    };
    themeDisplay.textContent = themeLabels[theme] || theme;
  }
}

function openSettingsPicker(type) {
  const titleEl = document.getElementById('settings-picker-title');
  const container = document.getElementById('settings-picker-list');
  if (!titleEl || !container) return;

  container.innerHTML = '';

  let title = '';
  let options = [];
  let currentVal = '';
  let onSelect = null;

  if (type === 'currency') {
    title = state.lang === 'el' ? 'Κύριο Νόμισμα' : 'Primary Currency';
    currentVal = localStorage.getItem('app_currency') || 'EUR';
    options = [
      { value: 'EUR', label: 'EUR (€)' },
      { value: 'USD', label: 'USD ($)' },
      { value: 'GBP', label: 'GBP (£)' },
      { value: 'JPY', label: 'JPY (¥)' }
    ];
    onSelect = (val) => {
      changeCurrencySetting(val);
    };
  } else if (type === 'week-start') {
    title = state.lang === 'el' ? 'Έναρξη Εβδομάδας' : 'Week Start';
    currentVal = localStorage.getItem('app_week_start') || '1';
    options = [
      { value: '1', label: state.lang === 'el' ? 'Δευτέρα' : 'Monday' },
      { value: '0', label: state.lang === 'el' ? 'Κυριακή' : 'Sunday' },
      { value: '6', label: state.lang === 'el' ? 'Σάββατο' : 'Saturday' }
    ];
    onSelect = (val) => {
      changeWeekStartSetting(val);
    };
  } else if (type === 'month-start') {
    title = state.lang === 'el' ? 'Έναρξη Μήνα' : 'Month Start';
    currentVal = localStorage.getItem('app_month_start') || '1';
    for (let i = 1; i <= 28; i++) {
      options.push({ value: String(i), label: String(i) });
    }
    onSelect = (val) => {
      changeMonthStartSetting(val);
    };
  } else if (type === 'theme') {
    title = state.lang === 'el' ? 'Θέμα Εμφάνισης' : 'Appearance Theme';
    currentVal = localStorage.getItem('app_theme') || 'dark';
    options = [
      { value: 'dark', label: 'Premium Dark' },
      { value: 'oled', label: 'OLED Black' },
      { value: 'light', label: 'Classic Light' },
      { value: 'emerald', label: 'Emerald Forest' },
      { value: 'ocean', label: 'Ocean Breeze' },
      { value: 'pink', label: 'Blossom Pink' }
    ];
    onSelect = (val) => {
      changeThemeSetting(val);
      updateUI();
    };
  }

  titleEl.textContent = title;

  options.forEach(opt => {
    const item = document.createElement('div');
    item.className = 'settings-picker-item';
    if (opt.value === currentVal) {
      item.classList.add('selected');
    }

    item.innerHTML = `
      <span class="settings-picker-item-label">${opt.label}</span>
      ${opt.value === currentVal ? '<i class="fa-solid fa-check settings-picker-item-check"></i>' : ''}
    `;

    item.onclick = () => {
      onSelect(opt.value);
      closeModal('settings-picker-modal');
    };

    container.appendChild(item);
  });

  openModal('settings-picker-modal');
}

function initSettingsFromStorage() {
  const monthStart = localStorage.getItem('app_month_start') || '1';
  const weekStart = localStorage.getItem('app_week_start') || '1';
  const currency = localStorage.getItem('app_currency') || 'EUR';
  const theme = localStorage.getItem('app_theme') || 'dark';
  
  let appLockEnabled = localStorage.getItem('app_lock_enabled') === 'true';
  let appBiometricsEnabled = localStorage.getItem('app_biometrics_enabled') === 'true';

  // Force state consistency between PIN lock and Biometrics
  if (appBiometricsEnabled) {
    const savedPin = localStorage.getItem('app_pin');
    if (!savedPin) {
      // If biometrics are active but no PIN is saved as a backup, disable both to prevent lockout
      localStorage.removeItem('app_biometrics_enabled');
      localStorage.removeItem('biometric_cred_id');
      localStorage.removeItem('app_lock_enabled');
      appBiometricsEnabled = false;
      appLockEnabled = false;
    } else if (!appLockEnabled) {
      // If biometrics are active and backup PIN exists, ensure PIN lock is marked enabled
      localStorage.setItem('app_lock_enabled', 'true');
      appLockEnabled = true;
    }
  }

  const appLockCheckbox = document.getElementById('settings-app-lock');
  if (appLockCheckbox) appLockCheckbox.checked = appLockEnabled;

  const autocompleteEnabled = localStorage.getItem('settings_autocomplete_enabled') !== 'false';
  const autocompleteCheckbox = document.getElementById('settings-autocomplete');
  if (autocompleteCheckbox) autocompleteCheckbox.checked = autocompleteEnabled;

  updateSettingsDisplay();
  applyTheme(theme);
  checkBiometricsSupport();
  
  if (appLockEnabled || appBiometricsEnabled) {
    showLockScreen();
  }
}

// Bind to window for HTML event accessibility
window.changeMonthStartSetting = changeMonthStartSetting;
window.changeWeekStartSetting = changeWeekStartSetting;
window.changeCurrencySetting = changeCurrencySetting;
window.getCurrencySymbol = getCurrencySymbol;
window.initSettingsFromStorage = initSettingsFromStorage;
window.openSettingsPicker = openSettingsPicker;
window.updateSettingsDisplay = updateSettingsDisplay;

// Theme & Appearance Helpers
function applyTheme(theme) {
  const themeClasses = ['theme-oled', 'theme-light', 'theme-emerald', 'theme-ocean', 'theme-pink'];
  themeClasses.forEach(cls => {
    document.body.classList.remove(cls);
    document.documentElement.classList.remove(cls);
  });
  if (theme !== 'dark') {
    document.body.classList.add(`theme-${theme}`);
    document.documentElement.classList.add(`theme-${theme}`);
  }
  
  // Dynamically update meta theme-color to match theme's card/header background
  const themeColors = {
    'dark': '#222731',
    'oled': '#0d0d0d',
    'light': '#ffffff',
    'emerald': '#182823',
    'ocean': '#1c2541',
    'pink': '#2d1b24'
  };
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', themeColors[theme] || '#222731');
  }
  
  if (window.Chart) {
    const textSecondary = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#8a99ad';
    Chart.defaults.color = textSecondary;
  }
  
  if (state.activeTab === 'stats') {
    renderStatsTab();
  }
}

function changeThemeSetting(theme) {
  localStorage.setItem('app_theme', theme);
  applyTheme(theme);
}

// Security App Lock Logic
let enteredPin = [];
let pinSetupStep = 0; // 1 = enter pin, 2 = confirm pin
let tempSetupPin = "";

function showLockScreen() {
  const lockScreen = document.getElementById('lock-screen');
  if (lockScreen) {
    lockScreen.classList.add('active');
    enteredPin = [];
    resetLockDots();
    
    // Show/hide biometric button based on settings
    const biometricBtn = document.getElementById('btn-biometric');
    const biometricsEnabled = localStorage.getItem('app_biometrics_enabled') === 'true';
    if (biometricBtn) {
      biometricBtn.style.display = biometricsEnabled ? 'flex' : 'none';
    }
    
    // Auto-trigger biometric auth if enabled
    if (biometricsEnabled) {
      setTimeout(() => {
        triggerBiometricAuth();
      }, 300);
    }
  }
}

function hideLockScreen() {
  const lockScreen = document.getElementById('lock-screen');
  if (lockScreen) {
    lockScreen.classList.remove('active');
  }
}

function resetLockDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (dot) dot.classList.remove('active');
  }
}

function pressKey(num) {
  if (enteredPin.length < 4) {
    enteredPin.push(num);
    const dot = document.getElementById(`dot-${enteredPin.length - 1}`);
    if (dot) dot.classList.add('active');
    
    if (enteredPin.length === 4) {
      setTimeout(() => {
        verifyEnteredPin();
      }, 100);
    }
  }
}

function pressBackspace() {
  if (enteredPin.length > 0) {
    const dot = document.getElementById(`dot-${enteredPin.length - 1}`);
    if (dot) dot.classList.remove('active');
    enteredPin.pop();
  }
}

function verifyEnteredPin() {
  const pin = enteredPin.join('');
  const savedPin = localStorage.getItem('app_pin');
  
  if (pin === savedPin) {
    hideLockScreen();
  } else {
    const subtitle = document.getElementById('lock-subtitle');
    const oldText = subtitle.textContent;
    subtitle.textContent = "Λάθος PIN! Προσπαθήστε ξανά.";
    subtitle.style.color = "var(--accent)";
    
    const dotsContainer = document.querySelector('.lock-dots');
    dotsContainer.style.transform = 'translateX(10px)';
    setTimeout(() => { dotsContainer.style.transform = 'translateX(-10px)'; }, 70);
    setTimeout(() => { dotsContainer.style.transform = 'translateX(10px)'; }, 140);
    setTimeout(() => { dotsContainer.style.transform = 'translateX(0)'; }, 210);
    
    setTimeout(() => {
      enteredPin = [];
      resetLockDots();
      subtitle.textContent = oldText;
      subtitle.style.color = "";
    }, 1000);
  }
}

// Biometrics (WebAuthn Platform Authenticator API)
async function checkBiometricsSupport() {
  const container = document.getElementById('settings-biometrics-container');
  const toggle = document.getElementById('settings-biometrics');
  if (!container || !toggle) return;
  
  if (window.PublicKeyCredential) {
    container.style.display = 'flex';
    const enabled = localStorage.getItem('app_biometrics_enabled') === 'true';
    toggle.checked = enabled;
  } else {
    container.style.display = 'none';
  }
}

async function registerBiometrics() {
  try {
    const randomChallenge = new Uint8Array(16);
    window.crypto.getRandomValues(randomChallenge);
    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const rpId = window.location.hostname;
    const credentialOptions = {
      publicKey: {
        challenge: randomChallenge,
        rp: { 
          name: "Budget Assistant",
          id: rpId
        },
        user: {
          id: userId,
          name: "user@moneymanager.local",
          displayName: "Local User"
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },   // ES256
          { type: "public-key", alg: -257 }  // RS256
        ],
        authenticatorSelection: {
          userVerification: "preferred", // preferred instead of required to maximize compatibility
          authenticatorAttachment: "platform"
        },
        timeout: 60000
      }
    };

    const credential = await navigator.credentials.create(credentialOptions);
    if (credential) {
      const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem('biometric_cred_id', credentialId);
      return true;
    }
  } catch (err) {
    console.error("Biometrics registration failed:", err);
    return err.name || err.message || String(err);
  }
  return "Unknown error";
}

async function verifyBiometrics() {
  const credIdBase64 = localStorage.getItem('biometric_cred_id');
  if (!credIdBase64) return false;
  
  try {
    const rawId = new Uint8Array(atob(credIdBase64).split("").map(c => c.charCodeAt(0)));
    const randomChallenge = new Uint8Array(16);
    window.crypto.getRandomValues(randomChallenge);

    const assertionOptions = {
      publicKey: {
        challenge: randomChallenge,
        allowCredentials: [{
          id: rawId,
          type: "public-key"
        }],
        userVerification: "preferred", // preferred instead of required to match registration
        timeout: 60000
      }
    };

    const assertion = await navigator.credentials.get(assertionOptions);
    return !!assertion;
  } catch (err) {
    console.error("Biometrics verification failed:", err);
    return false;
  }
}

async function triggerBiometricAuth() {
  if (localStorage.getItem('app_biometrics_enabled') !== 'true') return;
  const verified = await verifyBiometrics();
  if (verified) {
    hideLockScreen();
  }
}

// PIN Setup Modal Methods
function openPinModal() {
  const modal = document.getElementById('pin-modal');
  if (modal) {
    modal.classList.add('active');
    document.getElementById('pin-modal-title').textContent = "Ορισμός PIN";
    document.getElementById('pin-modal-desc').textContent = "Εισάγετε ένα 4ψήφιο PIN για το κλείδωμα της εφαρμογής.";
    document.getElementById('pin-input-field').value = "";
    pinSetupStep = 1;
    tempSetupPin = "";
  }
}

function closePinModal() {
  const modal = document.getElementById('pin-modal');
  if (modal) modal.classList.remove('active');
  
  if (!localStorage.getItem('app_lock_enabled')) {
    document.getElementById('settings-app-lock').checked = false;
  }
}

function submitPinSetup() {
  const pinField = document.getElementById('pin-input-field');
  const pin = pinField.value;
  
  if (pin.length !== 4 || isNaN(pin)) {
    showSyncToast("❌ " + (state.lang === 'el' ? "Το PIN πρέπει να είναι ακριβώς 4 ψηφία!" : "PIN must be exactly 4 digits!"), 3000);
    return;
  }
  
  if (pinSetupStep === 1) {
    tempSetupPin = pin;
    pinField.value = "";
    document.getElementById('pin-modal-title').textContent = "Επιβεβαίωση PIN";
    document.getElementById('pin-modal-desc').textContent = "Πληκτρολογήστε ξανά το PIN για επιβεβαίωση.";
    pinSetupStep = 2;
  } else if (pinSetupStep === 2) {
    if (pin === tempSetupPin) {
      localStorage.setItem('app_pin', pin);
      localStorage.setItem('app_lock_enabled', 'true');
      closePinModal();
      showSyncToast("✅ " + (state.lang === 'el' ? "Το κλείδωμα ενεργοποιήθηκε επιτυχώς!" : "App lock activated successfully!"), 3000);
      checkBiometricsSupport();
    } else {
      showSyncToast("❌ " + (state.lang === 'el' ? "Τα PIN δεν ταιριάζουν! Προσπαθήστε ξανά." : "PINs do not match! Try again."), 3000);
      pinSetupStep = 1;
      tempSetupPin = "";
      pinField.value = "";
      document.getElementById('pin-modal-title').textContent = "Ορισμός PIN";
      document.getElementById('pin-modal-desc').textContent = "Εισάγετε ένα 4ψήφιο PIN για το κλείδωμα της εφαρμογής.";
    }
  }
}

function openPinVerifyModal() {
  const modal = document.getElementById('pin-verify-modal');
  if (modal) {
    modal.classList.add('active');
    const input = document.getElementById('pin-verify-input');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 50);
    }
  }
}

function closePinVerifyModal() {
  const modal = document.getElementById('pin-verify-modal');
  if (modal) modal.classList.remove('active');
}

function submitPinVerification() {
  const input = document.getElementById('pin-verify-input');
  const entered = input ? input.value : '';
  const currentPin = localStorage.getItem('app_pin');
  
  if (entered === currentPin) {
    localStorage.removeItem('app_lock_enabled');
    localStorage.removeItem('app_pin');
    localStorage.removeItem('app_biometrics_enabled');
    localStorage.removeItem('biometric_cred_id');
    
    // Hide biometric settings container
    const bioContainer = document.getElementById('settings-biometrics-container');
    if (bioContainer) bioContainer.style.display = 'none';
    
    const bioCheckbox = document.getElementById('settings-biometrics');
    if (bioCheckbox) bioCheckbox.checked = false;
    
    // Uncheck app lock checkbox
    const lockCheckbox = document.getElementById('settings-app-lock');
    if (lockCheckbox) lockCheckbox.checked = false;
    
    closePinVerifyModal();
    showSyncToast("🔓 " + (state.lang === 'el' ? "Το κλείδωμα απενεργοποιήθηκε." : "App lock disabled."), 3000);
  } else {
    showSyncToast("❌ " + (state.lang === 'el' ? "Λάθος PIN!" : "Incorrect PIN!"), 3000);
    if (input) {
      input.value = '';
      input.focus();
    }
  }
}

function toggleAppLock(checked) {
  if (checked) {
    openPinModal();
  } else {
    // Keep it checked visually until verified
    const lockCheckbox = document.getElementById('settings-app-lock');
    if (lockCheckbox) lockCheckbox.checked = true;
    openPinVerifyModal();
  }
}

function openBiometricsPinModal() {
  const modal = document.getElementById('biometrics-pin-modal');
  if (modal) modal.classList.add('active');
}

function closeBiometricsPinModal() {
  const modal = document.getElementById('biometrics-pin-modal');
  if (modal) modal.classList.remove('active');
}

function proceedToPinSetup() {
  closeBiometricsPinModal();
  const appLockCheckbox = document.getElementById('settings-app-lock');
  if (appLockCheckbox) {
    appLockCheckbox.checked = true;
  }
  openPinModal();
}

async function toggleBiometrics(checked) {
  if (checked) {
    const appLockEnabled = localStorage.getItem('app_lock_enabled') === 'true';
    if (!appLockEnabled) {
      document.getElementById('settings-biometrics').checked = false;
      openBiometricsPinModal();
      return;
    }
    const result = await registerBiometrics();
    if (result === true) {
      localStorage.setItem('app_biometrics_enabled', 'true');
      const msg = state.lang === 'el' ? 'Το Face ID / Αποτύπωμα ενεργοποιήθηκε επιτυχώς!' : 'Face ID / Fingerprint activated successfully!';
      showSyncToast("✅ " + msg, 3000);
    } else {
      localStorage.removeItem('app_biometrics_enabled');
      document.getElementById('settings-biometrics').checked = false;
      const msg = state.lang === 'el' ? 'Αποτυχία σύνδεσης βιομετρικών. Αιτία: ' : 'Biometrics failed: ';
      showSyncToast("❌ " + msg + result, 4000);
    }
  } else {
    localStorage.removeItem('app_biometrics_enabled');
    localStorage.removeItem('biometric_cred_id');
    const msg = state.lang === 'el' ? 'Τα βιομετρικά απενεργοποιήθηκαν.' : 'Biometrics deactivated.';
    showSyncToast("🔓 " + msg, 3000);
  }
}

// ============================================================
// AUTHENTICATION & PARTNER LINKING CONTROLLERS
// ============================================================

let currentAuthTab = 'password';
let currentAuthMode = 'login'; // 'login' or 'signup'

function switchAuthTab(tab) {
  currentAuthTab = tab;
  
  // Update tabs active state
  document.getElementById('tab-btn-password').classList.toggle('active', tab === 'password');
  document.getElementById('tab-btn-magic').classList.toggle('active', tab === 'magic');
  document.getElementById('tab-btn-google').classList.toggle('active', tab === 'google');
  
  // Show active form
  document.getElementById('auth-password-form').style.display = tab === 'password' ? 'flex' : 'none';
  document.getElementById('auth-magic-form').style.display = tab === 'magic' ? 'flex' : 'none';
  document.getElementById('auth-google-form').style.display = tab === 'google' ? 'block' : 'none';

  // Clear status messages
  clearAuthStatus();
}

function togglePasswordVisibility() {
  const passwordInput = document.getElementById('auth-password');
  const icon = document.getElementById('toggle-password-icon');
  if (!passwordInput || !icon) return;
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    icon.className = 'fa-solid fa-eye-slash';
  } else {
    passwordInput.type = 'password';
    icon.className = 'fa-solid fa-eye';
  }
}

async function handleForgotPassword() {
  if (!state.supabaseClient) {
    alert('Supabase is not initialized.');
    return;
  }
  
  const emailInput = document.getElementById('auth-email');
  const email = emailInput ? emailInput.value.trim() : '';
  const lang = state.lang || 'el';
  
  const promptMsg = lang === 'el' 
    ? 'Εισάγετε το email σας για να λάβετε σύνδεσμο επαναφοράς κωδικού:' 
    : 'Enter your email to receive a password reset link:';
    
  const successMsg = lang === 'el'
    ? '✅ Στάλθηκε σύνδεσμος επαναφοράς κωδικού στα εισερχόμενά σας!'
    : '✅ Password reset link has been sent to your inbox!';
    
  const enterEmailMsg = lang === 'el'
    ? 'Παρακαλώ πληκτρολογήστε το email σας πρώτα.'
    : 'Please enter your email first.';
    
  const userEmail = prompt(promptMsg, email);
  if (userEmail === null) return; // User cancelled
  
  if (!userEmail.trim()) {
    alert(enterEmailMsg);
    return;
  }
  
  try {
    const { error } = await state.supabaseClient.auth.resetPasswordForEmail(userEmail.trim(), {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (error) throw error;
    showAuthStatus(successMsg, 'success');
  } catch (err) {
    console.error('Reset password error:', err);
    showAuthStatus('❌ Σφάλμα: ' + (err.message || err));
  }
}

window.togglePasswordVisibility = togglePasswordVisibility;
window.handleForgotPassword = handleForgotPassword;

function setAuthMode(mode) {
  currentAuthMode = mode;
  document.getElementById('btn-auth-mode-login').classList.toggle('active', mode === 'login');
  document.getElementById('btn-auth-mode-signup').classList.toggle('active', mode === 'signup');
  
  const submitBtn = document.getElementById('auth-password-submit-btn');
  const lang = state.lang || 'el';
  
  const forgotContainer = document.getElementById('forgot-password-container');
  if (forgotContainer) {
    forgotContainer.style.display = mode === 'login' ? 'flex' : 'none';
  }
  
  if (mode === 'login') {
    submitBtn.textContent = TRANSLATIONS[lang]['auth_submit_login'];
    document.getElementById('auth-subtitle').textContent = TRANSLATIONS[lang]['auth_welcome'];
  } else {
    submitBtn.textContent = TRANSLATIONS[lang]['auth_submit_signup'];
    document.getElementById('auth-subtitle').textContent = TRANSLATIONS[lang]['auth_create_account'];
  }
  clearAuthStatus();
}

function showAuthStatus(msg, type = 'error') {
  const box = document.getElementById('auth-status-message');
  if (!box) return;
  box.textContent = msg;
  box.className = type === 'success' ? 'auth-status-box success' : 'auth-status-box';
  box.style.display = 'block';
}

function clearAuthStatus() {
  const box = document.getElementById('auth-status-message');
  if (box) box.style.display = 'none';
}

async function handlePasswordAuth(e) {
  e.preventDefault();
  if (!state.supabaseClient) {
    alert('Supabase is not initialized.');
    return;
  }
  
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  
  const submitBtn = document.getElementById('auth-password-submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Παρακαλώ περιμένετε...';
  clearAuthStatus();
  
  try {
    if (currentAuthMode === 'login') {
      const { data, error } = await state.supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
    } else {
      const { data, error } = await state.supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            lang: state.lang
          }
        }
      });
      if (error) throw error;
      
      // If user is not logged in immediately (needs confirmation), show status
      if (data && data.user && !data.session) {
        showAuthStatus(TRANSLATIONS[state.lang]['auth_signup_success'], 'success');
      }
    }
  } catch (err) {
    console.error('Password auth failed:', err);
    showAuthStatus('❌ Σφάλμα: ' + (err.message || 'Αποτυχία ταυτοποίησης.'));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function handleMagicAuth(e) {
  e.preventDefault();
  if (!state.supabaseClient) return;
  
  const email = document.getElementById('auth-magic-email').value.trim();
  const submitBtn = document.getElementById('auth-magic-submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Αποστολή...';
  clearAuthStatus();
  
  try {
    const { error } = await state.supabaseClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) throw error;
    showAuthStatus('📩 Ο σύνδεσμος σύνδεσης στάλθηκε! Ελέγξτε τα εισερχόμενά σας (και τα Ανεπιθύμητα).', 'success');
  } catch (err) {
    console.error('Magic link failed:', err);
    showAuthStatus('❌ Σφάλμα: ' + (err.message || 'Αποτυχία αποστολής συνδέσμου.'));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function handleGoogleAuth() {
  if (!state.supabaseClient) return;
  clearAuthStatus();
  
  // Show splash loader on the main screen
  toggleLoader(true);
  
  try {
    // Standard redirect flow — stays in the SAME window (no popup, no new tab)
    // This keeps the standalone PWA context on Android, avoiding the browser bar
    const { error } = await state.supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + (window.location.pathname || '/'),
      }
    });
    if (error) throw error;
    // The page will redirect to Google — on return, initSupabaseAuth handles the session
  } catch (err) {
    console.error('Google auth flow failed:', err);
    toggleLoader(false);
    showAuthStatus('❌ Σφάλμα: ' + (err.message || 'Αποτυχία σύνδεσης με Google.'));
  }
}

async function handleLogout() {
  const confirmed = await showConfirm(
    state.lang === 'el' ? 'Είστε σίγουροι ότι θέλετε να αποσυνδεθείτε από το λογαριασμό σας;' : 'Are you sure you want to log out of your account?',
    state.lang === 'el' ? 'Αποσύνδεση' : 'Logout',
    '🚪'
  );
  if (!confirmed) return;
  if (!state.supabaseClient) return;
  
  try {
    await state.supabaseClient.auth.signOut();
    
    // Clear user-specific cached data
    localStorage.removeItem('cached_current_user');
    localStorage.removeItem('cached_partner_profile');
    localStorage.removeItem('offline_transactions');
    localStorage.removeItem('offline_accounts');
    localStorage.removeItem('offline_categories');
    localStorage.removeItem('auth_guest_mode');
    localStorage.removeItem('app_theme'); // Reset theme to default (Premium Dark) on logout
    
    // Reload page immediately to clear memory state and land on login screen instantly
    window.location.reload();
  } catch(err) {
    console.error('Sign out error:', err);
  }
}

function renderPartnerSection() {
  const container = document.getElementById('partner-linking-container');
  if (!container) return;

  if (!state.currentUser) {
    container.innerHTML = `
      <div style="text-align:center;padding:10px 0;">
        <div style="font-size:32px;margin-bottom:8px;">🔒</div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;">
          ${state.lang === 'el' ? 'Συνδεθείτε για να ξεκλειδώσετε τον <strong>Οικογενειακό Προϋπολογισμό 👥</strong>' : 'Sign in to unlock <strong>Family Budgeting 👥</strong>'}
        </p>
        <button class="btn btn-primary" onclick="showAuthOverlay()" style="width:100%;padding:12px;font-weight:700;">
          <i class="fa-solid fa-right-to-bracket" style="margin-right:6px;"></i>${state.lang === 'el' ? 'Σύνδεση / Εγγραφή' : 'Sign In / Register'}
        </button>
      </div>
    `;
    return;
  }

  const userProfile = state.userProfile;
  const familyId = userProfile ? userProfile.family_id : null;
  const myRole = userProfile ? userProfile.role : 'member';

  if (familyId) {
    // === CONNECTED FAMILY STATE ===
    let familyName = state.familyGroup ? state.familyGroup.name : '';
    if (!familyName || familyName.toLowerCase() === 'null') {
      // Fallback to "Οικογένεια [Admin Name]" format
      const adminProfile = state.familyProfiles.find(p => p.role === 'admin');
      const adminName = adminProfile ? (adminProfile.display_name || adminProfile.email.split('@')[0]) : '';
      familyName = adminName 
        ? (state.lang === 'el' ? `Οικογένεια [${adminName}]` : `Family [${adminName}]`)
        : (state.lang === 'el' ? 'Οικογενειακός Προϋπολογισμός' : 'Family Budget');
    }
    const inviteCode = state.familyGroup ? state.familyGroup.invite_code : '';
    
    // Build members list HTML
    let membersHtml = '';
    state.familyProfiles.forEach(m => {
      const isMe = m.id === state.currentUser.id;
      const meSuffix = isMe ? ` (${state.lang === 'el' ? 'Εσείς' : 'You'})` : '';
      const roleBadge = m.role === 'admin' 
        ? `<span style="background:var(--accent-light);color:var(--accent);font-size:9.5px;padding:2px 6px;border-radius:4px;font-weight:700;margin-left:8px;">${state.lang === 'el' ? 'Διαχειριστής' : 'Admin'}</span>`
        : `<span style="background:rgba(255,255,255,0.06);color:var(--text-secondary);font-size:9.5px;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:8px;">${state.lang === 'el' ? 'Μέλος' : 'Member'}</span>`;
      
      let actionButtons = '';
      if (myRole === 'admin' && !isMe) {
        const demoteText = state.lang === 'el' ? 'Ορισμός ως Μέλος' : 'Set as Member';
        const promoteText = state.lang === 'el' ? 'Ορισμός ως Διαχειριστής' : 'Set as Admin';
        const removeText = state.lang === 'el' ? 'Αφαίρεση από την Οικογένεια' : 'Remove from Family';
        
        actionButtons = `
          <div style="position:relative;display:inline-block;">
            <button type="button" onclick="toggleMemberMenu(event, '${m.id}')" class="icon-btn" style="color:var(--text-secondary);padding:6px;font-size:14px;cursor:pointer;background:none;border:none;" title="${state.lang === 'el' ? 'Επιλογές' : 'Options'}">
              <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>
            <div id="member-menu-${m.id}" class="member-dropdown-menu" style="display:none;position:absolute;right:0;top:100%;z-index:1000;background:var(--card-bg2, #1f2230);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.4);min-width:180px;padding:4px 0;text-align:left;">
              ${m.role === 'admin' ? `
                <div onclick="changeMemberRole('${m.id}', 'member')" 
                     onmouseenter="this.style.background='rgba(255,255,255,0.05)'" 
                     onmouseleave="this.style.background=''" 
                     style="padding:10px 12px;font-size:12.5px;cursor:pointer;color:var(--text-primary);transition:background 0.2s;white-space:nowrap;">
                  <i class="fa-solid fa-user-tag" style="margin-right:8px;width:14px;"></i>${demoteText}
                </div>
              ` : `
                <div onclick="changeMemberRole('${m.id}', 'admin')" 
                     onmouseenter="this.style.background='rgba(255,255,255,0.05)'" 
                     onmouseleave="this.style.background=''" 
                     style="padding:10px 12px;font-size:12.5px;cursor:pointer;color:var(--text-primary);transition:background 0.2s;white-space:nowrap;">
                  <i class="fa-solid fa-user-shield" style="margin-right:8px;width:14px;"></i>${promoteText}
                </div>
              `}
              <div onclick="kickFamilyMember('${m.id}')" 
                   onmouseenter="this.style.background='rgba(239,83,80,0.08)'" 
                   onmouseleave="this.style.background=''" 
                   style="padding:10px 12px;font-size:12.5px;cursor:pointer;color:#ef5350;border-top:1px solid var(--border-light);transition:background 0.2s;white-space:nowrap;">
                <i class="fa-solid fa-user-minus" style="margin-right:8px;width:14px;"></i>${removeText}
              </div>
            </div>
          </div>
        `;
      }

      const initials = getMemberInitials(m);
      const gradient = getMemberColorGradient(m.id);

      membersHtml += `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-light);gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
            <div style="width:28px;height:28px;border-radius:50%;background:${gradient};color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;text-transform:uppercase;box-shadow:0 1px 4px rgba(0,0,0,0.15);flex-shrink:0;">
              ${initials}
            </div>
            <div style="display:flex;flex-direction:column;min-width:0;flex:1;">
              <span style="font-size:12px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${m.display_name || m.email.split('@')[0]}${meSuffix}
              </span>
              <span style="font-size:10px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${m.email}
              </span>
            </div>
            ${roleBadge}
          </div>
          ${actionButtons}
        </div>
      `;
    });

    // Admin invite block
    let inviteBlockHtml = '';
    if (myRole === 'admin') {
      inviteBlockHtml = `
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:10px;">
          <div style="font-size:12px;font-weight:700;">👤 ${state.lang === 'el' ? 'Πρόσκληση Νέου Μέλους' : 'Invite New Member'}</div>
          
          <div style="background:var(--card-bg2,rgba(255,255,255,0.04));border:1px solid var(--card-border);border-radius:8px;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span style="font-size:12px;font-weight:700;color:var(--accent);letter-spacing:1.5px;font-family:monospace;">${inviteCode}</span>
            <div style="display:flex;gap:4px;">
              <button onclick="navigator.clipboard.writeText('${inviteCode}').then(()=>showSyncToast('${state.lang === 'el' ? '✓ Αντεγράφη ο κωδικός' : '✓ Code copied'}', 2000))" class="btn btn-secondary" style="padding:4px 8px;font-size:10px;border-radius:6px;line-height:1;">
                📋 ${state.lang === 'el' ? 'Κωδικός' : 'Code'}
              </button>
              <button onclick="navigator.clipboard.writeText('${window.location.origin + window.location.pathname}?invite=${inviteCode}').then(()=>showSyncToast('${state.lang === 'el' ? '✓ Αντεγράφη ο σύνδεσμος' : '✓ Link copied'}', 2000))" class="btn btn-secondary" style="padding:4px 8px;font-size:10px;border-radius:6px;line-height:1;">
                🔗 ${state.lang === 'el' ? 'Σύνδεσμος' : 'Link'}
              </button>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
            <label style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:2px;">
              ${state.lang === 'el' ? 'Ρόλος Νέου Μέλους' : 'New Member Role'}
            </label>
            <div style="display:flex;gap:10px;margin-bottom:6px;">
              <div id="role-card-member" onclick="selectInviteRole('member')" style="flex:1;padding:12px;border:2px solid var(--accent);border-radius:8px;background:var(--card-bg2,rgba(255,255,255,0.04));cursor:pointer;transition:all 0.2s;">
                <div style="font-size:16px;margin-bottom:4px;">👤</div>
                <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:2px;">${state.lang === 'el' ? 'Μέλος' : 'Member'}</div>
                <div style="font-size:10px;color:var(--text-muted);">${state.lang === 'el' ? 'Μόνο δικές του κινήσεις' : 'Own transactions only'}</div>
              </div>
              <div id="role-card-admin" onclick="selectInviteRole('admin')" style="flex:1;padding:12px;border:2px solid var(--border);border-radius:8px;background:var(--card-bg2,rgba(255,255,255,0.04));cursor:pointer;transition:all 0.2s;">
                <div style="font-size:16px;margin-bottom:4px;">👑</div>
                <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:2px;">${state.lang === 'el' ? 'Διαχειριστής' : 'Admin'}</div>
                <div style="font-size:10px;color:var(--text-muted);">${state.lang === 'el' ? 'Πλήρη δικαιώματα' : 'Full permissions'}</div>
              </div>
            </div>
            <input type="hidden" id="invite-role-select" value="member">
            <div style="display:flex;gap:6px;">
              <input type="email" id="invite-email-input" class="form-input" placeholder="${state.lang === 'el' ? 'email@family.com' : 'email@family.com'}" style="flex:1;font-size:12.5px;padding:8px 10px;margin-bottom:0;border-radius:8px;">
              <button onclick="inviteMemberByEmail()" class="btn btn-primary" style="padding:8px 14px;font-size:12.5px;font-weight:700;border-radius:8px;white-space:nowrap;">
                <i class="fa-solid fa-paper-plane" style="margin-right:4px;"></i>${state.lang === 'el' ? 'Πρόσκληση' : 'Invite'}
              </button>
            </div>
          </div>
        </div>
      `;
    }

    let nameHtml = `<div style="font-size:13px;font-weight:700;color:var(--text-primary);">${familyName}</div>`;
    if (myRole === 'admin') {
      nameHtml = `
        <div id="family-group-name-label" style="font-size:13px;font-weight:700;color:var(--text-primary);cursor:pointer;user-select:none;border-bottom:1px dashed var(--text-muted);display:inline-block;" title="${state.lang === 'el' ? 'Κρατήστε πατημένο για μετονομασία' : 'Long press to rename'}">
          ${familyName}
        </div>
      `;
    }

    container.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(var(--accent-rgb,124,106,247),0.06),rgba(255,255,255,0.01));border:1px solid var(--border);border-radius:16px;padding:16px;box-shadow:var(--shadow);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#4caf50);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">👥</div>
            <div>
              ${nameHtml}
              <div style="font-size:10px;color:#4caf50;font-weight:600;">● ${state.lang === 'el' ? 'Κοινό Ιστορικό' : 'Shared History'}</div>
            </div>
          </div>
          <button class="btn btn-secondary unlink-btn" onclick="leaveFamilyGroup()" style="padding:6px 10px;font-size:11px;border-radius:8px;margin-left:0;">
            <i class="fa-solid fa-right-from-bracket" style="margin-right:5px;"></i>${state.lang === 'el' ? 'Αποχώρηση' : 'Leave'}
          </button>
        </div>
        
        <div style="font-size:12px;font-weight:700;margin-bottom:8px;color:var(--text-secondary);">
          👥 ${state.lang === 'el' ? 'Μέλη Οικογένειας' : 'Family Members'} (${state.familyProfiles.length})
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          ${membersHtml}
        </div>

        ${inviteBlockHtml}
      </div>
    `;

    // Setup long press for renaming family name label (only if admin)
    const familyNameLabel = document.getElementById('family-group-name-label');
    if (familyNameLabel && myRole === 'admin') {
      let pressTimer;
      let isLongPress = false;

      const handleStart = (e) => {
        isLongPress = false;
        pressTimer = setTimeout(() => {
          isLongPress = true;
          if (navigator.vibrate) {
            try { navigator.vibrate(15); } catch(err) {}
          }
          promptRenameFamilyGroup();
        }, 600);
      };

      const handleEnd = () => {
        clearTimeout(pressTimer);
      };

      familyNameLabel.addEventListener('touchstart', handleStart, { passive: true });
      familyNameLabel.addEventListener('touchend', handleEnd, { passive: true });
      familyNameLabel.addEventListener('touchmove', handleEnd, { passive: true });
      familyNameLabel.addEventListener('touchcancel', handleEnd, { passive: true });

      familyNameLabel.addEventListener('mousedown', handleStart);
      familyNameLabel.addEventListener('mouseup', handleEnd);
      familyNameLabel.addEventListener('mouseleave', handleEnd);

      familyNameLabel.onclick = (e) => {
        if (isLongPress) {
          isLongPress = false;
          e.preventDefault();
          e.stopPropagation();
        }
      };
    }
  } else {
    // === SETUP / JOIN / CREATE FAMILY STATE ===
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;padding:4px 0;">
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">
          ${state.lang === 'el' 
            ? 'Διαχειριστείτε τα κοινά οικονομικά του σπιτιού δημιουργώντας ένα Οικογενειακό Group, ή συνδεθείτε σε ένα υπάρχον με κωδικό πρόσκλησης.' 
            : 'Manage shared household finances by creating a Family Group, or join an existing one using an invite code.'}
        </div>

        <!-- Section A: Create Family -->
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;">
          <div style="font-size:12px;font-weight:700;color:var(--text-primary);">⭐ ${state.lang === 'el' ? 'Δημιουργία Νέας Οικογένειας' : 'Create New Family Group'}</div>
          <div style="display:flex;gap:6px;">
            <input type="text" id="create-family-name-input" class="form-input" placeholder="${state.lang === 'el' ? 'Όνομα Οικογένειας (π.χ. Οικ. Παπαδόπουλου)' : 'Family Name (e.g. Smith Family)'}" style="flex:1;font-size:13px;padding:8px 10px;margin-bottom:0;">
            <button class="btn btn-primary" onclick="createFamilyGroup()" style="padding:8px 14px;font-size:12.5px;font-weight:700;white-space:nowrap;">
              ${state.lang === 'el' ? 'Δημιουργία' : 'Create'}
            </button>
          </div>
        </div>

        <!-- Section B: Join Family -->
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;">
          <div style="font-size:12px;font-weight:700;color:var(--text-primary);">👥 ${state.lang === 'el' ? 'Σύνδεση σε Οικογένεια με Κωδικό' : 'Join Family Group via Code'}</div>
          <div style="display:flex;gap:6px;">
            <input type="text" id="join-family-code-input" class="form-input" placeholder="X1Y2Z3" style="flex:1;font-size:13px;padding:8px 10px;text-transform:uppercase;letter-spacing:1.5px;font-family:monospace;text-align:center;margin-bottom:0;">
            <button class="btn btn-primary" onclick="joinFamilyGroup()" style="padding:8px 14px;font-size:12.5px;font-weight:700;white-space:nowrap;">
              ${state.lang === 'el' ? 'Σύνδεση' : 'Join'}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

function getMemberInitials(m) {
  const name = (m.display_name || m.email.split('@')[0] || '').trim();
  const parts = name.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  if (name.length >= 2) {
    return name.substring(0, 2).toUpperCase();
  }
  return (name.substring(0, 1) || '?').toUpperCase();
}

function getMemberBadgeHTML(t) {
  if (state.userProfile && state.userProfile.family_id && t.user_id) {
    const creator = state.familyProfiles.find(p => p.id === t.user_id);
    if (creator) {
      const initials = getMemberInitials(creator);
      const gradient = getMemberColorGradient(creator.id);
      const creatorName = creator.display_name || creator.email.split('@')[0];
      return `<span class="trans-member-badge" style="background:${gradient};color:white;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;font-size:8px;font-weight:800;text-transform:uppercase;margin-left:6px;vertical-align:middle;box-shadow:0 1px 3px rgba(0,0,0,0.15);border:none;flex-shrink:0;" title="${state.lang === 'el' ? 'Προστέθηκε από: ' : 'Added by: '}${creatorName}">${initials}</span>`;
    }
  }
  const isPartner = state.partnerProfile && t.user_id === state.partnerProfile.id;
  return isPartner ? ` <i class="fa-solid fa-user-group partner-badge-icon" title="${state.lang === 'el' ? 'Προστέθηκε από τον σύντροφο' : 'Added by partner'}"></i>` : '';
}

function getMemberColorGradient(userId) {
  let hash = 0;
  if (userId) {
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
  }
  const gradients = [
    'linear-gradient(135deg, #e05e55 0%, #ff8a80 100%)', // Original Coral/Red-ish
    'linear-gradient(135deg, #2ec4b6 0%, #8fd3f4 100%)', // Emerald Green
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Neon Blue
    'linear-gradient(135deg, #ab47bc 0%, #fccb90 100%)', // Purple/Gold
    'linear-gradient(135deg, #4caf50 0%, #81c784 100%)', // Green
    'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)', // Pink/Purple
    'linear-gradient(135deg, #ffa726 0%, #ffcc80 100%)', // Orange/Peach
    'linear-gradient(135deg, #00b4d8 0%, #90e0ef 100%)'  // Teal/Sky
  ];
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

async function createFamilyGroup() {
  if (!state.supabaseClient || !state.currentUser) return;
  const nameInput = document.getElementById('create-family-name-input');
  if (!nameInput) return;
  
  let groupName = nameInput.value.trim();
  if (!groupName) {
    groupName = state.lang === 'el' ? 'Οικογενειακός Προϋπολογισμός' : 'Family Budget';
  }

  try {
    const { data: newFamilyId, error } = await state.supabaseClient.rpc('create_family_group', { group_name: groupName });
    if (error) throw error;
    
    alert(state.lang === 'el' ? '🎉 Η οικογένεια δημιουργήθηκε με επιτυχία!' : '🎉 Family group created successfully!');
    window.location.reload();
  } catch (err) {
    console.error('Error creating family group:', err);
    alert(state.lang === 'el' ? 'Σφάλμα κατά τη δημιουργία: ' + err.message : 'Error creating group: ' + err.message);
  }
}

async function joinFamilyGroup() {
  if (!state.supabaseClient || !state.currentUser) return;
  const codeInput = document.getElementById('join-family-code-input');
  if (!codeInput) return;
  
  const code = codeInput.value.trim().toUpperCase();
  if (!code) {
    alert(state.lang === 'el' ? 'Παρακαλώ εισάγετε τον κωδικό πρόσκλησης.' : 'Please enter the invite code.');
    return;
  }

  try {
    const { data, error } = await state.supabaseClient.rpc('join_family_group', { invite_code_input: code });
    if (error) throw error;

    alert(state.lang === 'el' ? '🎉 Συνδεθήκατε επιτυχώς στην οικογένεια!' : '🎉 Joined the family successfully!');
    window.location.reload();
  } catch (err) {
    console.error('Error joining family group:', err);
    alert(state.lang === 'el' ? 'Σφάλμα κατά τη σύνδεση: ' + err.message : 'Error joining family: ' + err.message);
  }
}

async function leaveFamilyGroup() {
  if (!state.supabaseClient || !state.currentUser) return;
  
  const confirmMsg = state.lang === 'el' 
    ? 'Είστε σίγουροι ότι θέλετε να αποχωρήσετε από τον οικογενειακό προϋπολογισμό; Οι κινήσεις σας θα παραμείνουν στην οικογένεια.' 
    : 'Are you sure you want to leave the family budget? Your transactions will remain in the family group.';
    
  if (!confirm(confirmMsg)) return;

  try {
    const { data, error } = await state.supabaseClient.rpc('leave_family_group');
    if (error) throw error;

    alert(state.lang === 'el' ? 'Αποχωρήσατε με επιτυχία!' : 'Left the family successfully!');
    window.location.reload();
  } catch (err) {
    console.error('Error leaving family group:', err);
    alert(state.lang === 'el' ? 'Σφάλμα κατά την αποχώρηση: ' + err.message : 'Error leaving family: ' + err.message);
  }
}

async function kickFamilyMember(memberId) {
  if (!state.supabaseClient || !state.currentUser) return;
  
  const confirmMsg = state.lang === 'el'
    ? 'Είστε σίγουροι ότι θέλετε να αποβάλλετε αυτό το μέλος από την οικογένεια;'
    : 'Are you sure you want to kick this member from the family?';
    
  if (!confirm(confirmMsg)) return;

  try {
    const { data, error } = await state.supabaseClient.rpc('kick_family_member', { member_id_input: memberId });
    if (error) throw error;

    alert(state.lang === 'el' ? 'Το μέλος αφαιρέθηκε με επιτυχία!' : 'Member kicked successfully!');
    window.location.reload();
  } catch (err) {
    console.error('Error kicking member:', err);
    alert(state.lang === 'el' ? 'Σφάλμα κατά την αφαίρεση: ' + err.message : 'Error kicking member: ' + err.message);
  }
}

async function changeMemberRole(memberId, role) {
  if (!state.supabaseClient || !state.currentUser) return;
  
  const confirmMsg = state.lang === 'el'
    ? `Είστε σίγουροι ότι θέλετε να αλλάξετε το ρόλο αυτού του μέλους σε ${role === 'admin' ? 'Διαχειριστή' : 'Μέλος'};`
    : `Are you sure you want to change this member's role to ${role === 'admin' ? 'Admin' : 'Member'}?`;
    
  if (!confirm(confirmMsg)) return;

  try {
    const { data, error } = await state.supabaseClient.rpc('change_member_role', { member_id_input: memberId, new_role: role });
    if (error) throw error;

    alert(state.lang === 'el' ? 'Ο ρόλος άλλαξε με επιτυχία!' : 'Role updated successfully!');
    window.location.reload();
  } catch (err) {
    console.error('Error changing role:', err);
    alert(state.lang === 'el' ? 'Σφάλμα κατά την αλλαγή ρόλου: ' + err.message : 'Error updating role: ' + err.message);
  }
}

async function inviteMemberByEmail() {
  if (!state.supabaseClient || !state.currentUser || !state.familyGroup) return;
  const emailInput = document.getElementById('invite-email-input');
  if (!emailInput) return;

  const email = emailInput.value.trim().toLowerCase();
  if (!email) {
    alert(state.lang === 'el' ? 'Παρακαλώ εισάγετε ένα έγκυρο email.' : 'Please enter a valid email.');
    return;
  }

  if (email === state.currentUser.email.toLowerCase()) {
    alert(state.lang === 'el' ? 'Δεν μπορείτε να προσκαλέσετε το δικό σας email!' : 'You cannot invite your own email!');
    return;
  }

  try {
    const isAlreadyMember = state.familyProfiles.some(m => m.email.toLowerCase() === email);
    if (isAlreadyMember) {
      alert(state.lang === 'el' ? 'Αυτός ο χρήστης είναι ήδη μέλος της οικογένειας!' : 'This user is already a member of your family!');
      return;
    }

    const roleSelect = document.getElementById('invite-role-select');
    const selectedRole = roleSelect ? roleSelect.value : 'member';

    const { error } = await state.supabaseClient
      .from('pending_invitations')
      .insert([{
        family_id: state.familyGroup.id,
        invited_email: email,
        invited_by: state.currentUser.id,
        role: selectedRole
      }]);

    if (error && error.code !== '23505') { // 23505 is unique constraint (already invited)
      throw error;
    }

    const adminName = state.userProfile ? (state.userProfile.display_name || state.currentUser.email.split('@')[0]) : state.currentUser.email.split('@')[0];
    const familyName = state.familyGroup.name;
    const inviteCode = state.familyGroup.invite_code;
    const deepLink = `${window.location.origin}${window.location.pathname}?invite=${inviteCode}&role=${selectedRole}`;

    const subject = state.lang === 'el'
      ? `Πρόσκληση Σύνδεσης στο Budget Assistant`
      : `Invitation to Join Budget Assistant`;

    const body = state.lang === 'el'
      ? `Γεια σου!\n\nΟ/Η ${adminName} σε προσκαλεί να γίνεις μέλος στην οικογένεια «${familyName}» στο Budget Assistant ως ${selectedRole === 'admin' ? 'Διαχειριστής' : 'Μέλος'}.\n\nΚάνε κλικ στον παρακάτω σύνδεσμο για να συνδεθείς αυτόματα:\n${deepLink}\n\nΉ χρησιμοποίησε τον κωδικό πρόσκλησης: ${inviteCode}\n\nΦιλικά,\nΗ ομάδα του Budget Assistant`
      : `Hi!\n\n${adminName} has invited you to join the family group "${familyName}" on Budget Assistant as ${selectedRole === 'admin' ? 'Admin' : 'Member'}.\n\nClick the link below to join automatically:\n${deepLink}\n\nOr use the invite code: ${inviteCode}\n\nBest regards,\nBudget Assistant Team`;

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;

    alert(state.lang === 'el' 
      ? '🎉 Η πρόσκληση καταχωρήθηκε στη βάση! Ανοίγει το πρόγραμμα email σας για την αποστολή του συνδέσμου.' 
      : '🎉 Invitation saved! Your email client will now open to send the link.');
      
    emailInput.value = '';
  } catch (err) {
    console.error('Error inviting member:', err);
    alert(state.lang === 'el' ? 'Σφάλμα κατά την πρόσκληση: ' + err.message : 'Error sending invitation: ' + err.message);
  }
}

async function promptRenameFamilyGroup() {
  if (!state.supabaseClient || !state.currentUser || !state.familyGroup) return;
  const currentName = state.familyGroup.name || '';
  const newName = prompt(state.lang === 'el' ? 'Εισάγετε το νέο όνομα της οικογένειας:' : 'Enter new family name:', currentName);
  if (newName === null) return;
  const trimmed = newName.trim();
  if (!trimmed) {
    alert(state.lang === 'el' ? 'Το όνομα δεν μπορεί να είναι κενό.' : 'Name cannot be empty.');
    return;
  }
  
  try {
    const { data, error } = await state.supabaseClient.rpc('rename_family_group', { new_name: trimmed });
    if (error) throw error;
    
    state.familyGroup.name = trimmed;
    showSyncToast(state.lang === 'el' ? '✓ Το όνομα ενημερώθηκε' : '✓ Name updated successfully', 2000);
    renderPartnerSection();
  } catch (err) {
    console.error('Error renaming family group:', err);
    alert(state.lang === 'el' ? 'Σφάλμα κατά τη μετονομασία: ' + err.message : 'Error renaming family group: ' + err.message);
  }
}

function toggleMemberMenu(event, memberId) {
  event.stopPropagation();
  document.querySelectorAll('.member-dropdown-menu').forEach(menu => {
    if (menu.id !== `member-menu-${memberId}`) {
      menu.style.display = 'none';
    }
  });
  
  const menu = document.getElementById(`member-menu-${memberId}`);
  if (menu) {
    if (menu.style.display === 'none' || !menu.style.display) {
      menu.style.display = 'block';
    } else {
      menu.style.display = 'none';
    }
  }
}

// Bind to window for HTML accessibility
window.createFamilyGroup = createFamilyGroup;
window.joinFamilyGroup = joinFamilyGroup;
window.leaveFamilyGroup = leaveFamilyGroup;
window.kickFamilyMember = kickFamilyMember;
window.changeMemberRole = changeMemberRole;
window.inviteMemberByEmail = inviteMemberByEmail;
window.renderPartnerSection = renderPartnerSection;
window.promptRenameFamilyGroup = promptRenameFamilyGroup;
window.toggleMemberMenu = toggleMemberMenu;
window.selectInviteRole = selectInviteRole;

function selectInviteRole(role) {
  const memberCard = document.getElementById('role-card-member');
  const adminCard = document.getElementById('role-card-admin');
  const hiddenInput = document.getElementById('invite-role-select');
  
  if (role === 'member') {
    memberCard.style.borderColor = 'var(--accent)';
    adminCard.style.borderColor = 'var(--border)';
    hiddenInput.value = 'member';
  } else {
    memberCard.style.borderColor = 'var(--border)';
    adminCard.style.borderColor = 'var(--accent)';
    hiddenInput.value = 'admin';
  }
}
async function forceAppUpdate() {
  if (confirm(state.lang === 'en' ? 'Force update and reload the app?' : 'Θέλετε να επιβάλλετε ενημέρωση και επαναφόρτωση της εφαρμογής;')) {
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      } catch (e) {
        console.error('Failed to unregister SW:', e);
      }
    }
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        for (let key of keys) {
          await caches.delete(key);
        }
      } catch (e) {
        console.error('Failed to clear cache:', e);
      }
    }
    window.location.reload(true);
  }
}

// Bind new functions to window for HTML element access
window.forceAppUpdate = forceAppUpdate;
window.changeThemeSetting = changeThemeSetting;
window.toggleAppLock = toggleAppLock;
window.toggleBiometrics = toggleBiometrics;
window.closePinModal = closePinModal;
window.openPinVerifyModal = openPinVerifyModal;
window.closePinVerifyModal = closePinVerifyModal;
window.submitPinVerification = submitPinVerification;
window.openBiometricsPinModal = openBiometricsPinModal;
window.closeBiometricsPinModal = closeBiometricsPinModal;
window.proceedToPinSetup = proceedToPinSetup;
window.submitPinSetup = submitPinSetup;
window.pressKey = pressKey;
window.pressBackspace = pressBackspace;
window.triggerBiometricAuth = triggerBiometricAuth;
window.switchAuthTab = switchAuthTab;
window.setAuthMode = setAuthMode;
window.handlePasswordAuth = handlePasswordAuth;
window.handleMagicAuth = handleMagicAuth;
window.handleGoogleAuth = handleGoogleAuth;
window.handleLogout = handleLogout;

// ============================================================
// GUEST MODE & OFFLINE CLOUD SYNC
// ============================================================

async function enterGuestMode() {
  state.guestMode = true;
  localStorage.setItem('auth_guest_mode', 'true');
  
  // Show premium splash loader immediately
  toggleLoader(true);
  
  // Hide switcher in header (guest has no shared wallet)
  const switcher = document.getElementById('wallet-switcher-container');
  if (switcher) switcher.style.display = 'none';
  
  // Show lock icon user badge in header to connect/sign up
  const userBadge = document.getElementById('user-profile-badge');
  if (userBadge) {
    userBadge.style.display = 'flex';
    userBadge.innerHTML = '<i class="fa-solid fa-lock" style="font-size: 11px;"></i>';
    userBadge.title = 'Σύνδεση / Sign Up';
    userBadge.onclick = () => showAuthOverlay();
  }
  
  // Load data & update UI
  await loadData();
  updateUI();
  renderPartnerSection();
  
  // Hide auth overlay after UI updates
  const authOverlay = document.getElementById('auth-overlay');
  if (authOverlay) {
    // Prevent click penetration (ghost clicks) to elements underneath (like the FAB button)
    authOverlay.style.pointerEvents = 'none';
    document.body.style.pointerEvents = 'none';
    setTimeout(() => {
      authOverlay.style.display = 'none';
      authOverlay.style.pointerEvents = '';
      document.body.style.pointerEvents = '';
      forceViewportReset();
    }, 350);
  }
  toggleLoader(false);
}

function showAuthOverlay() {
  const authOverlay = document.getElementById('auth-overlay');
  if (authOverlay) {
    authOverlay.style.display = 'flex';
  }
}

async function syncLocalTransactionsToCloud(userId, options = {}) {
  const silent = !!options.silent;
  const transStr = localStorage.getItem('offline_transactions');
  if (!transStr) return;
  
  try {
    const allTrans = JSON.parse(transStr) || [];
    
    // Identify unsynced transactions (local_ prefix, no id, null user_id, or non-UUID id)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const localTrans = allTrans.filter(t => {
      if (!t.id) return true;
      if (String(t.id).startsWith('local_')) return true;
      if (t.user_id === null || t.user_id === undefined) return true;
      if (!uuidRegex.test(String(t.id))) return true;
      return false;
    });
    
    if (localTrans.length > 0) {
      console.log(`Syncing ${localTrans.length} guest/local transactions to cloud...`);
      
      const toInsert = localTrans.map(t => {
        const copy = { ...t };
        delete copy.id; // Let Supabase auto-generate UUIDs
        delete copy.description; // Strip description from DB payload as database doesn't have it
        copy.user_id = userId;
        if (state.userProfile && state.userProfile.family_id) {
          copy.family_id = state.userProfile.family_id;
        }
        delete copy.is_shared; // Ensure is_shared is not sent to DB
        delete copy.recurring_template_id; // Ensure recurring_template_id is not sent to DB
        return copy;
      });
      
      // Suppress realtime events during batch insert so the resulting INSERT
      // events don't trigger handleRealtimeTransactionChange and cause flicker.
      _suppressRealtimeEvents = true;
      try {
        // Batch sync in groups of 50 to avoid timeouts
        let hasError = false;
        let lastErr = null;
        for (let i = 0; i < toInsert.length; i += 50) {
          const batch = toInsert.slice(i, i + 50);
          const { error } = await promiseTimeout(state.supabaseClient
            .from('transactions')
            .insert(batch).then(r => r), 60000);
          if (error) {
            hasError = true;
            lastErr = error;
            break;
          }
        }
          
        if (hasError) {
          console.error('Failed to sync guest transactions:', lastErr);
        } else {
          console.log('Successfully synced guest transactions!');
          // Remove synced transactions from offline cache
          const cleanOffline = allTrans.filter(t => !localTrans.includes(t));
          localStorage.setItem('offline_transactions', JSON.stringify(cleanOffline));
          
          if (!silent) {
            alert(`🎉 ${localTrans.length} τοπικές κινήσεις που είχατε καταγράψει μεταφέρθηκαν αυτόματα στον λογαριασμό σας!`);
          }
        }
      } finally {
        // Re-enable realtime events after a short delay to let in-flight events drain
        setTimeout(() => { _suppressRealtimeEvents = false; }, 5000);
      }
    }
  } catch (err) {
    console.error('Error in syncLocalTransactionsToCloud:', err);
  }
}

window.enterGuestMode = enterGuestMode;
window.showAuthOverlay = showAuthOverlay;
window.syncLocalTransactionsToCloud = syncLocalTransactionsToCloud;

// ============================================================
// REAL-TIME SYNC & OFFLINE QUEUE SYSTEM
// ============================================================
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function enqueueSyncMutation(action, payload) {
  try {
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]');
    const itemId = action === 'delete' ? payload : payload.id;
    
    // Clean up duplicate saves/updates in queue if we are now deleting
    let cleanQueue = queue.filter(item => {
      const itemKey = item.action === 'delete' ? item.payload : item.payload.id;
      return !(itemKey === itemId && item.action === 'save' && action === 'delete');
    });
    
    cleanQueue.push({
      id: generateUUID(),
      action,
      payload,
      timestamp: Date.now()
    });
    
    localStorage.setItem('money_manager_sync_queue', JSON.stringify(cleanQueue));
    console.log(`Enqueued offline mutation: ${action} for ${itemId}`);
  } catch (err) {
    console.error('Failed to enqueue sync mutation:', err);
  }
}

let _isProcessingSyncQueue = false;

// skipReload: when true, do NOT call loadData/updateUI after processing (used by forceSyncNow
// which handles its own full re-fetch and UI update, preventing double renders).
async function processSyncQueue(options = {}) {
  const skipReload = !!options.skipReload;
  if (_isProcessingSyncQueue) return;
  if (!state.isSupabaseEnabled || !state.supabaseClient || !state.currentUser) return;
  
  const queueStr = localStorage.getItem('money_manager_sync_queue');
  if (!queueStr) return;
  
  let queue = [];
  try {
    queue = JSON.parse(queueStr) || [];
  } catch (e) {
    console.error('Failed to parse sync queue:', e);
    return;
  }
  
  if (queue.length === 0) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  
  _isProcessingSyncQueue = true;
  console.log(`Processing offline sync queue of ${queue.length} items...`);
  
  let successCount = 0;
  
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      if (item.action === 'save') {
        const transaction = item.payload;
        const { description, is_shared, recurring_template_id, ...dbPayload } = transaction;
        
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .upsert([dbPayload]),
          15000
        );
        
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn(`Skipping invalid sync queue item:`, error);
        }
      } else if (item.action === 'delete') {
        const transId = item.payload;
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .delete()
            .eq('id', transId),
          15000
        );
        
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn(`Skipping invalid sync queue delete item:`, error);
        }
      }
      
      successCount++;
    } catch (err) {
      console.warn(`Network failure during sync queue replay at index ${i}:`, err);
      break; // Abort and retry later to preserve sequence order
    }
  }
  
  if (successCount > 0) {
    const remaining = queue.slice(successCount);
    localStorage.setItem('money_manager_sync_queue', JSON.stringify(remaining));
    console.log(`Synced ${successCount} mutations. ${remaining.length} remaining.`);
    
    // Only reload and render here if the caller didn't request to skip it.
    // When called from forceSyncNow, skipReload=true because forceSyncNow does its own
    // full fetch + UI update immediately after, so we avoid a double render.
    if (!skipReload) {
      await loadData();
      updateUI();
    }
  }
  
  _isProcessingSyncQueue = false;
}

let _supabaseRealtimeChannel = null;

function setupSupabaseRealtimeSubscription() {
  if (!state.supabaseClient || !state.currentUser) return;
  
  if (_supabaseRealtimeChannel) {
    state.supabaseClient.removeChannel(_supabaseRealtimeChannel);
    _supabaseRealtimeChannel = null;
  }
  
  const userId = state.currentUser.id;
  const partnerId = state.partnerProfile ? state.partnerProfile.id : null;
  const familyId = state.userProfile ? state.userProfile.family_id : null;
  
  console.log('Setting up Supabase Realtime channel subscription...');
  
  _supabaseRealtimeChannel = state.supabaseClient.channel('family-changes-channel');
  
  if (familyId) {
    _supabaseRealtimeChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions', filter: `family_id=eq.${familyId}` },
      handleRealtimeTransactionChange
    ).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'categories', filter: `family_id=eq.${familyId}` },
      handleRealtimeCategoryChange
    );
  } else {
    _supabaseRealtimeChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
      handleRealtimeTransactionChange
    ).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${userId}` },
      handleRealtimeCategoryChange
    );
    
    if (partnerId) {
      _supabaseRealtimeChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${partnerId}` },
        handleRealtimeTransactionChange
      ).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${partnerId}` },
        handleRealtimeCategoryChange
      );
    }
  }
  
  _supabaseRealtimeChannel.subscribe((status) => {
    console.log(`Supabase Realtime subscription status: ${status}`);
  });
}

function stopSupabaseRealtimeSubscription() {
  if (_supabaseRealtimeChannel && state.supabaseClient) {
    state.supabaseClient.removeChannel(_supabaseRealtimeChannel);
    _supabaseRealtimeChannel = null;
    console.log('Removed Supabase Realtime channel subscription.');
  }
}

// Debounce timer for realtime changes — prevents rapid-fire UI re-renders when
// multiple INSERT/UPDATE/DELETE events arrive in quick succession (e.g. after bulk upsert).
let _realtimeDebounceTimer = null;
let _pendingRealtimeEvents = [];

// Flag: set to true during internal cleanup (e.g. duplicate deletion) so that
// the resulting DB DELETE events do NOT trigger a UI re-render / flicker.
let _suppressRealtimeEventsCount = 0;
Object.defineProperty(window, '_suppressRealtimeEvents', {
  get: () => _suppressRealtimeEventsCount > 0,
  set: (val) => {
    if (val) {
      _suppressRealtimeEventsCount++;
      console.log(`[REALTIME] Suppression enabled (count: ${_suppressRealtimeEventsCount})`);
    } else {
      _suppressRealtimeEventsCount = Math.max(0, _suppressRealtimeEventsCount - 1);
      console.log(`[REALTIME] Suppression disabled (count: ${_suppressRealtimeEventsCount})`);
    }
  },
  configurable: true
});

function handleRealtimeTransactionChange(payload) {
  const isDelete = payload.eventType === 'DELETE';
  const eventId = isDelete ? (payload.old && payload.old.id) : (payload.new && payload.new.id);

  // 1. If it's a delete event of a transaction we are actively deleting locally, always suppress it
  if (isDelete && eventId && _deletingTxIds.has(String(eventId))) {
    console.log('[REALTIME] Delete event suppressed (active local delete):', eventId);
    return;
  }

  // 2. If global suppression is active, only suppress our own events, let partner events pass
  if (_suppressRealtimeEvents) {
    const isPartnerEvent = isDelete
      ? true // Since it's a delete and not in our deleting set, it's a partner delete
      : (payload.new && state.currentUser && payload.new.user_id !== state.currentUser.id);

    if (!isPartnerEvent) {
      console.log('[REALTIME] Own event suppressed during active suppression:', payload.eventType, eventId);
      return;
    } else {
      console.log('[REALTIME] Partner event allowed during active suppression:', payload.eventType, eventId);
    }
  }
  
  console.log('Realtime transaction event received:', payload.eventType);
  
  // Accumulate events, then apply them all at once after a short delay
  _pendingRealtimeEvents.push(payload);
  
  if (_realtimeDebounceTimer) clearTimeout(_realtimeDebounceTimer);
  _realtimeDebounceTimer = setTimeout(() => {
    const events = _pendingRealtimeEvents.slice();
    _pendingRealtimeEvents = [];
    _realtimeDebounceTimer = null;
    
    let trans = [...state.transactions];
    let changed = false;
    let insertedByPartner = false;
    
    events.forEach(ev => {
      const eventType = ev.eventType;
      if (eventType === 'INSERT') {
        const newTrans = ev.new;
        if (!trans.some(t => t.id === newTrans.id)) {
          trans.unshift(newTrans);
          changed = true;
          if (newTrans.user_id !== state.currentUser.id) insertedByPartner = true;
        }
      } else if (eventType === 'UPDATE') {
        const updatedTrans = ev.new;
        const idx = trans.findIndex(t => t.id === updatedTrans.id);
        if (idx !== -1) {
          trans[idx] = updatedTrans;
          changed = true;
        }
      } else if (eventType === 'DELETE') {
        const deletedId = ev.old && ev.old.id;
        if (deletedId && trans.some(t => t.id === deletedId)) {
          trans = trans.filter(t => t.id !== deletedId);
          changed = true;
        }
      }
    });
    
    // Only update UI if something actually changed
    if (!changed) {
      console.log('[REALTIME] No effective changes — skipping UI refresh.');
      return;
    }
    
    trans.sort(compareTransactions);
    
    state.transactions = trans;
    localStorage.setItem('offline_transactions', JSON.stringify(trans));
    
    calculateInitialBalances();
    updateUI();
    
    if (insertedByPartner) {
      showSyncToast('📥 Νέα κίνηση προστέθηκε από άλλο μέλος', 3000);
    }
  }, 5000); // wait 5s before applying, to batch rapid events and prevent flickering
}

function handleRealtimeCategoryChange(payload) {
  // Ignore events generated by our own internal cleanup operations.
  if (_suppressRealtimeEvents) {
    console.log('[REALTIME] Category event suppressed (internal operation in progress):', payload.eventType);
    return;
  }
  console.log('Realtime category event received:', payload.eventType, payload.new, payload.old);
  
  let cats = [...state.categories];
  const eventType = payload.eventType;
  
  if (eventType === 'INSERT') {
    const newCat = payload.new;
    if (!cats.some(c => c.id === newCat.id)) {
      cats.push(newCat);
    }
  } else if (eventType === 'UPDATE') {
    const updatedCat = payload.new;
    cats = cats.map(c => c.id === updatedCat.id ? updatedCat : c);
  } else if (eventType === 'DELETE') {
    const deletedId = payload.old.id;
    cats = cats.filter(c => c.id !== deletedId);
  }
  
  state.categories = cats;
  localStorage.setItem('offline_categories', JSON.stringify(cats));
  
  updateUI();
}

window.generateUUID = generateUUID;
window.enqueueSyncMutation = enqueueSyncMutation;
window.processSyncQueue = processSyncQueue;
window.setupSupabaseRealtimeSubscription = setupSupabaseRealtimeSubscription;
window.stopSupabaseRealtimeSubscription = stopSupabaseRealtimeSubscription;

// Handle online connectivity restore events
window.addEventListener('online', () => {
  console.log('Connection restored! Replaying sync queue...');
  processSyncQueue();
});

// ============================================================
// REAL-TIME PARTNER SYNC POLLING
// Every 15 seconds, if logged in, silently refresh data
// ============================================================
let _partnerSyncInterval = null;

// Sync status tracking
state.lastSyncTime = state.lastSyncTime || null;
state.syncStatus = state.syncStatus || 'idle'; // 'idle' | 'syncing' | 'success' | 'error'
state.syncPendingCount = state.syncPendingCount || 0;

function updateSyncStatusIndicator() {
  const dot = document.getElementById('header-sync-dot');
  const icon = document.getElementById('header-sync-cloud-icon');
  const btn = document.getElementById('header-sync-icon');
  if (!dot || !icon) return;
  
  const colors = {
    idle: '#9e9e9e',
    offline: '#9e9e9e',
    syncing: '#ffb300',
    success: '#4caf50',
    synced: '#4caf50',
    error: '#e05e55'
  };
  
  dot.style.background = colors[state.syncStatus] || colors.idle;
  
  if (state.syncStatus === 'syncing') {
    icon.className = 'fa-solid fa-cloud-arrow-up';
  } else if (state.syncStatus === 'error') {
    icon.className = 'fa-solid fa-cloud-bolt';
  } else {
    icon.className = 'fa-solid fa-cloud';
  }
  
  // Update tooltip with last sync time
  if (btn) {
    let tooltip = state.lang === 'en' ? 'Cloud Account' : 'Λογαριασμός Cloud';
    if (state.lastSyncTime) {
      const d = new Date(state.lastSyncTime);
      const timeStr = d.toLocaleTimeString(state.lang === 'el' ? 'el-GR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
      tooltip += ' • ' + (state.lang === 'en' ? 'Last sync: ' : 'Τελ. συγχρονισμός: ') + timeStr;
    }
    if (state.syncPendingCount > 0) {
      tooltip += ' • ' + state.syncPendingCount + ' ' + (state.lang === 'en' ? 'pending' : 'εκκρεμούν');
    }
    btn.title = tooltip;
  }

  // Update sync status text in settings
  const syncStatusEl = document.getElementById('val_sync_status');
  if (syncStatusEl) {
    const lang = state.lang || 'el';
    const statusLabels = lang === 'en' ? {
      offline: 'Local Storage',
      idle: 'Local Storage',
      syncing: 'Syncing...',
      synced: 'Active',
      success: 'Active',
      error: 'Error'
    } : {
      offline: 'Τοπική Αποθήκευση',
      idle: 'Τοπική Αποθήκευση',
      syncing: 'Συγχρονισμός...',
      synced: 'Ενεργός',
      success: 'Ενεργός',
      error: 'Σφάλμα'
    };
    const statusKey = state.syncStatus || 'offline';
    syncStatusEl.textContent = statusLabels[statusKey] || (lang === 'en' ? 'Local Storage' : 'Τοπική Αποθήκευση');
    
    // Update color based on status
    if (statusKey === 'synced' || statusKey === 'success') {
      syncStatusEl.style.color = '#4caf50'; // Green for active
    } else if (statusKey === 'error') {
      syncStatusEl.style.color = '#ef5350'; // Red for error
    } else {
      syncStatusEl.style.color = 'var(--text-secondary)';
    }
  }
}

async function forceSyncNow(silent = false) {
  if (!state.supabaseClient || !state.currentUser) {
    if (!silent) alert(state.lang === 'en' ? 'Please log in first to sync.' : 'Παρακαλώ συνδεθείτε πρώτα για συγχρονισμό.');
    return false;
  }
  
  state.syncStatus = 'syncing';
  updateSyncStatusIndicator();
  
  // Suppress realtime events for the duration of this sync to prevent
  // DB mutations (upserts/inserts from queue flush) from firing handleRealtimeTransactionChange
  // and causing flickering numbers. We will do a single clean render at the end.
  _suppressRealtimeEvents = true;
  
  try {
    const userId = state.currentUser.id;
    
    // Auto-sync any stuck local transactions (e.g. from guest mode or legacy local_ items)
    await syncLocalTransactionsToCloud(userId, { silent: true });
    
    const partnerId = state.partnerProfile ? state.partnerProfile.id : null;
    const familyId = state.userProfile ? state.userProfile.family_id : null;
    
    const userFilter = familyId 
      ? (partnerId ? `family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}` : `family_id.eq.${familyId},user_id.eq.${userId}`)
      : (partnerId ? `user_id.eq.${userId},user_id.eq.${partnerId}` : `user_id.eq.${userId}`);

    // 1. Fetch categories and accounts
    const [catsRes, accsRes] = await promiseTimeout(
      Promise.all([
        state.supabaseClient.from('categories').select('*').or(userFilter),
        state.supabaseClient.from('accounts').select('*').or(userFilter),
      ]),
      15000
    );
    
    if (!catsRes.error && catsRes.data) {
      state.categories = catsRes.data;
      localStorage.setItem('offline_categories', JSON.stringify(state.categories));
    }
    if (!accsRes.error && accsRes.data) {
      state.accounts = accsRes.data;
      localStorage.setItem('offline_accounts', JSON.stringify(state.accounts));
    }

    // 2. Fetch ALL transactions (paginated)
    let allTransactions = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let transQuery = state.supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
        
      // FIX: Use proper Supabase .or() syntax with individual conditions
      if (familyId && partnerId) {
        transQuery = transQuery.or(`family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}`);
      } else if (familyId) {
        transQuery = transQuery.or(`family_id.eq.${familyId},user_id.eq.${userId}`);
      } else if (partnerId) {
        transQuery = transQuery.or(`user_id.eq.${userId},user_id.eq.${partnerId}`);
      } else {
        transQuery = transQuery.eq('user_id', userId);
      }

      const { data: pageData, error: pageErr } = await promiseTimeout(
        transQuery,
        15000
      );
      if (pageErr) throw pageErr;

      if (pageData && pageData.length > 0) {
        allTransactions = allTransactions.concat(pageData);
        page++;
        if (pageData.length < pageSize) hasMore = false;
      } else {
        hasMore = false;
      }
    }

    // 3. Process offline queue first (push local changes to cloud)
    // skipReload=true: forceSyncNow does its own full re-fetch below, so we don't
    // want processSyncQueue to also call loadData+updateUI (would cause double render).
    await processSyncQueue({ skipReload: true });
    
    // 4. Keep local pending transactions
    const localPending = getPendingLocalTransactions(state.transactions);
    
    // 4.5. RECOVERY: Disabled - was causing infinite upsert loops when RLS filtered out partner transactions

    // 5. Update state — deduplicate combined result before storing (ID-based first, then content-based)
    const prevCount = (state.transactions || []).filter(t => t.id && !String(t.id).startsWith('local_')).length;
    const dedupedCombined = mergeAndDeduplicateTransactions(allTransactions, localPending);
    dedupedCombined.sort(compareTransactions);
    
    // === ANTI-FLICKER GUARD ===
    // Only update UI if the data has actually changed (compare transaction IDs)
    const newIds = dedupedCombined.map(t => t.id || '').join(',');
    const oldIds = (state.transactions || []).map(t => t.id || '').join(',');
    const dataChanged = newIds !== oldIds;
    
    state.transactions = dedupedCombined;
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
    
    // 6. Check sync queue status
    const queueStr = localStorage.getItem('money_manager_sync_queue');
    if (queueStr) {
      try {
        const queue = JSON.parse(queueStr) || [];
        state.syncPendingCount = queue.length;
      } catch(e) { state.syncPendingCount = 0; }
    } else {
      state.syncPendingCount = 0;
    }
    
    state.lastSyncTime = Date.now();
    state.syncStatus = state.syncPendingCount > 0 ? 'error' : 'success';
    updateSyncStatusIndicator();
    
    // Update last sync time display in settings
    const lastSyncEl = document.getElementById('val_last_sync_time');
    if (lastSyncEl) {
      const d = new Date(state.lastSyncTime);
      lastSyncEl.textContent = d.toLocaleTimeString(state.lang === 'el' ? 'el-GR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    
    if (dataChanged) {
      console.log('[SYNC] Data changed — refreshing balances and UI.');
      calculateInitialBalances();
      updateUI();
    } else {
      console.log('[SYNC] No data change detected — skipping UI refresh to prevent flickering.');
    }
    
    const newCount = allTransactions.length - prevCount;
    if (!silent && newCount > 0) {
      showSyncToast('✅ +' + newCount + ' ' + (state.lang === 'en' ? 'new transactions synced' : 'νέες κινήσεις συγχρονίστηκαν'), 3000);
    } else if (!silent && newCount === 0) {
      showSyncToast('✅ ' + (state.lang === 'en' ? 'Everything is up to date' : 'Όλα είναι ενημερωμένα'), 2000);
    }
    
    return true;
  } catch(e) {
    console.error('Force sync failed:', e);
    state.syncStatus = 'error';
    updateSyncStatusIndicator();
    if (!silent) {
      showSyncToast('❌ ' + (state.lang === 'en' ? 'Sync failed: ' : 'Αποτυχία συγχρονισμού: ') + (e.message || e), 4000);
    }
    return false;
  } finally {
    // Always re-enable realtime events after sync completes (or fails),
    // with a short delay to let any already-inflight Realtime events drain first.
    setTimeout(() => { _suppressRealtimeEvents = false; }, 4000);
  }
}

function stopPartnerSyncPolling() {
  if (_partnerSyncInterval) {
    clearInterval(_partnerSyncInterval);
    _partnerSyncInterval = null;
  }
}

function startPartnerSyncPolling() {
  // DISABLED: Background polling was causing flickering numbers.
  // Sync only happens on: (1) login, (2) manual tap of sync button, (3) tab visibility change.
  // if (_partnerSyncInterval) clearInterval(_partnerSyncInterval);
  // _partnerSyncInterval = setInterval(() => {
  //   if (!state.supabaseClient || !state.currentUser) return;
  //   forceSyncNow(true);
  // }, 300000); // every 5 minutes
  console.log('[SYNC] Background polling disabled to prevent flickering.');
}

// Sync on visibility change (user switches back to tab/app)
// Uses a longer delay and a guard to prevent rapid repeated syncs
let _visibilitySyncTimer = null;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.currentUser && state.supabaseClient) {
    if (_visibilitySyncTimer) clearTimeout(_visibilitySyncTimer);
    // Only sync if we haven't synced in the last 2 minutes (120s).
    // Shorter cooldowns caused the "fairground" effect where numbers jumped
    // every time the user switched tabs or minimized the app.
    const timeSinceLastSync = Date.now() - (state.lastSyncTime || 0);
    if (timeSinceLastSync > 120000) {
      _visibilitySyncTimer = setTimeout(() => {
        _visibilitySyncTimer = null;
        forceSyncNow(true);
      }, 3000);
    }
  }
});

// Start polling when app loads if user is logged in
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (state.currentUser) {
      startPartnerSyncPolling();
      setupSupabaseRealtimeSubscription();
      // skipReload:true because onAuthStateChange already called loadData().
      // We only want to flush pending mutations from the sync queue here,
      // NOT trigger another full loadData() + updateUI() which would cause flicker.
      processSyncQueue({ skipReload: true });
    }
  }, 5000);
});

window.startPartnerSyncPolling = startPartnerSyncPolling;
window.stopPartnerSyncPolling = stopPartnerSyncPolling;
window.forceSyncNow = forceSyncNow;
window.updateSyncStatusIndicator = updateSyncStatusIndicator;

// ============================================================
// PROFILE & SETTINGS SHEET FUNCTIONS
// ============================================================

function updateHeaderProfileBadge() {
  const userBadge = document.getElementById('user-profile-badge');
  if (!userBadge) return;

  if (state.guestMode || !state.currentUser) {
    userBadge.style.display = 'flex';
    userBadge.innerHTML = '<i class="fa-solid fa-lock" style="font-size: 11px;"></i>';
    userBadge.title = 'Σύνδεση / Sign Up';
    userBadge.onclick = () => showAuthOverlay();
    userBadge.style.backgroundImage = 'none';
    userBadge.className = 'user-profile-badge';
    return;
  }

  const email = state.currentUser.email || '';
  const avatarType = localStorage.getItem('avatar_type_' + email) || 'initials';
  const presetId = localStorage.getItem('avatar_preset_id_' + email) || '1';
  const customData = localStorage.getItem('avatar_custom_data_' + email) || '';

  userBadge.style.display = 'flex';
  userBadge.title = email;
  userBadge.onclick = () => openProfileSheet();

  userBadge.className = 'user-profile-badge';

  if (avatarType === 'preset') {
    userBadge.classList.add('avatar-preset-badge', 'preset-' + presetId);
    userBadge.style.backgroundImage = 'none';
    const presetIcons = {
      '1': 'fa-user',
      '2': 'fa-rocket',
      '3': 'fa-gem',
      '4': 'fa-cat',
      '5': 'fa-heart',
      '6': 'fa-crown'
    };
    const iconClass = presetIcons[presetId] || 'fa-user';
    userBadge.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
  } else if (avatarType === 'custom' && customData) {
    userBadge.classList.add('avatar-img-badge');
    userBadge.style.backgroundImage = `url(${customData})`;
    userBadge.innerHTML = '';
  } else {
    userBadge.style.backgroundImage = 'none';
    let initials = '👤';
    if (state.userProfile && state.userProfile.display_name) {
      initials = state.userProfile.display_name.substring(0, 2).toUpperCase();
    } else if (email) {
      initials = email.substring(0, 2).toUpperCase();
    }
    userBadge.textContent = initials;
  }
}

function openProfileSheet() {
  if (state.guestMode || !state.currentUser) {
    showAuthOverlay();
    return;
  }

  const email = state.currentUser.email || '';
  const name = state.userProfile?.display_name || email.split('@')[0];
  
  const nameInput = document.getElementById('profile-name-input');
  if (nameInput) nameInput.value = name;
  
  const emailDisplay = document.getElementById('profile-email-display');
  if (emailDisplay) emailDisplay.textContent = email;

  // Update cloud sync status
  const cloudStatus = document.getElementById('profile-cloud-status');
  if (cloudStatus) {
    const icon = cloudStatus.querySelector('i');
    const span = cloudStatus.querySelector('span');
    if (navigator.onLine) {
      cloudStatus.className = 'profile-cloud-status online';
      if (icon) icon.className = 'fa-solid fa-cloud-check';
      if (span) span.textContent = state.lang === 'en' ? 'Cloud Sync: Active' : 'Συγχρονισμός Cloud: Ενεργός';
    } else {
      cloudStatus.className = 'profile-cloud-status offline';
      if (icon) icon.className = 'fa-solid fa-cloud-slash';
      if (span) span.textContent = state.lang === 'en' ? 'Cloud Sync: Offline' : 'Συγχρονισμός Cloud: Εκτός σύνδεσης';
    }
  }

  updateProfileSheetAvatarPreview();
  
  const modal = document.getElementById('profile-settings-modal');
  if (modal) {
    modal.classList.add('active');
    initProfileSheetSwipeDismiss();
  }
}

function closeProfileSheet() {
  const modal = document.getElementById('profile-settings-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function handleProfileSheetOverlayClick(e) {
  if (e.target.id === 'profile-settings-modal') {
    closeProfileSheet();
  }
}

function updateProfileSheetAvatarPreview() {
  const preview = document.getElementById('profile-sheet-avatar-preview');
  if (!preview) return;

  const email = state.currentUser?.email || '';
  const avatarType = localStorage.getItem('avatar_type_' + email) || 'initials';
  const presetId = localStorage.getItem('avatar_preset_id_' + email) || '1';
  const customData = localStorage.getItem('avatar_custom_data_' + email) || '';

  preview.className = 'profile-sheet-avatar';
  preview.style.backgroundImage = 'none';
  preview.innerHTML = '';

  document.querySelectorAll('.preset-avatar-option').forEach(opt => {
    opt.classList.remove('active');
    const pid = opt.getAttribute('data-preset');
    if (avatarType === 'preset' && pid === presetId) {
      opt.classList.add('active');
    }
  });

  const customTrigger = document.querySelector('.preset-custom-trigger');
  if (customTrigger) {
    customTrigger.classList.remove('active');
    if (avatarType === 'custom') {
      customTrigger.classList.add('active');
    }
  }

  if (avatarType === 'preset') {
    preview.classList.add('preset-' + presetId);
    const presetIcons = {
      '1': 'fa-user',
      '2': 'fa-rocket',
      '3': 'fa-gem',
      '4': 'fa-cat',
      '5': 'fa-heart',
      '6': 'fa-crown'
    };
    const iconClass = presetIcons[presetId] || 'fa-user';
    preview.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
  } else if (avatarType === 'custom' && customData) {
    preview.style.backgroundImage = `url(${customData})`;
  } else {
    let initials = '👤';
    if (state.userProfile && state.userProfile.display_name) {
      initials = state.userProfile.display_name.substring(0, 2).toUpperCase();
    } else if (email) {
      initials = email.substring(0, 2).toUpperCase();
    }
    preview.textContent = initials;
  }
}

function selectPresetAvatar(id) {
  if (!state.currentUser) return;
  const email = state.currentUser.email || '';
  localStorage.setItem('avatar_type_' + email, 'preset');
  localStorage.setItem('avatar_preset_id_' + email, String(id));
  
  updateProfileSheetAvatarPreview();
  updateHeaderProfileBadge();
}

function triggerAvatarUpload() {
  const fileInput = document.getElementById('profile-avatar-file-input');
  if (fileInput) fileInput.click();
}

function handleCustomAvatarUpload(e) {
  if (!state.currentUser) return;
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const email = state.currentUser.email || '';
    localStorage.setItem('avatar_type_' + email, 'custom');
    localStorage.setItem('avatar_custom_data_' + email, evt.target.result);
    
    updateProfileSheetAvatarPreview();
    updateHeaderProfileBadge();
  };
  reader.readAsDataURL(file);
}

async function saveProfileName() {
  if (!state.currentUser || !state.supabaseClient) return;
  
  const nameInput = document.getElementById('profile-name-input');
  if (!nameInput) return;
  
  const newName = nameInput.value.trim();
  const oldName = state.userProfile?.display_name || '';
  
  if (!newName || newName === oldName) return;

  try {
    const { data, error } = await promiseTimeout(
      state.supabaseClient
        .from('profiles')
        .update({ display_name: newName })
        .eq('id', state.currentUser.id)
        .select()
        .single()
        .then(r => r),
      6000
    ).catch(err => ({ data: null, error: err }));

    if (error) {
      console.error('Failed to update display_name:', error);
      alert('⚠️ Αποτυχία ενημέρωσης ονόματος στη βάση δεδομένων.');
      nameInput.value = oldName;
    } else if (data) {
      state.userProfile = data;
      updateHeaderProfileBadge();
      updateProfileSheetAvatarPreview();
      
      localStorage.setItem('cached_current_user', JSON.stringify(data));
      
      const emailDisplay = document.getElementById('settings-user-email-value');
      if (emailDisplay && state.currentUser) {
        emailDisplay.textContent = `${state.currentUser.email} (${newName})`;
      }
    }
  } catch (err) {
    console.error('Error saving display name:', err);
  }
}

function handleProfileNameKeydown(e) {
  if (e.key === 'Enter') {
    e.target.blur();
  }
}

function openPartnerFromProfile() {
  closeProfileSheet();
  switchTab('more');
  setTimeout(() => {
    const partnerEl = document.getElementById('partner-linking-container');
    if (partnerEl) {
      partnerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      partnerEl.style.outline = '2px solid var(--accent)';
      setTimeout(() => partnerEl.style.outline = '', 2000);
    }
  }, 350);
}

async function triggerProfileSync() {
  const syncBtn = document.getElementById('profile-sync-spinner');
  if (syncBtn) syncBtn.classList.add('fa-spin');
  const modalSyncSpinner = document.getElementById('modal-sync-spinner');
  if (modalSyncSpinner) modalSyncSpinner.classList.add('fa-spin');

  const syncStatus = document.getElementById('profile-sync-status');
  if (syncStatus) syncStatus.textContent = 'Συγχρονισμός...';

  try {
    if (state.currentUser) {
      await loadUserProfiles(state.currentUser);
      await loadData();
      updateUI();
      renderPartnerSection();
      if (syncStatus) syncStatus.textContent = 'Ολοκληρώθηκε!';
    }
  } catch (err) {
    console.error(err);
    if (syncStatus) syncStatus.textContent = 'Σφάλμα';
  } finally {
    setTimeout(() => {
      if (syncBtn) syncBtn.classList.remove('fa-spin');
      if (modalSyncSpinner) modalSyncSpinner.classList.remove('fa-spin');
      if (syncStatus) syncStatus.textContent = navigator.onLine ? 'Συνδεδεμένο' : 'Εκτός σύνδεσης';
    }, 1000);
  }
}

function triggerProfileExport() {
  closeProfileSheet();
  openExportPeriodSheet();
}

function cycleThemeFromProfile() {
  const themes = ['dark', 'oled', 'light', 'emerald', 'ocean', 'pink'];
  const currentTheme = localStorage.getItem('app_theme') || 'dark';
  let nextIdx = (themes.indexOf(currentTheme) + 1) % themes.length;
  const nextTheme = themes[nextIdx];

  changeThemeSetting(nextTheme);
  updateSettingsDisplay();

  const themeStatus = document.getElementById('profile-theme-status');
  if (themeStatus) {
    const themeNames = {
      'dark': 'Premium Dark',
      'oled': 'OLED Black',
      'light': 'Classic Light',
      'emerald': 'Emerald Forest',
      'ocean': 'Ocean Breeze',
      'pink': 'Blossom Pink'
    };
    themeStatus.textContent = themeNames[nextTheme] || nextTheme;
  }
}

function handleProfileLogout() {
  closeProfileSheet();
  handleLogout();
}

function initProfileSheetSwipeDismiss() {
  const sheetContent = document.getElementById('profile-sheet-content');
  if (!sheetContent) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  const handleTouchStart = (e) => {
    const body = sheetContent.querySelector('.profile-sheet-body');
    if (body && body.scrollTop > 0) return;

    startY = e.touches[0].clientY;
    isDragging = true;
    sheetContent.classList.add('dragging');
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;

    if (deltaY > 0) {
      e.preventDefault();
      sheetContent.style.transform = `translateY(${deltaY}px)`;
    } else {
      sheetContent.style.transform = '';
    }
  };

  const handleTouchEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;
    sheetContent.classList.remove('dragging');
    const deltaY = currentY - startY;

    if (deltaY > 150) {
      sheetContent.style.transform = '';
      closeProfileSheet();
    } else {
      sheetContent.style.transform = '';
    }
    startY = 0;
    currentY = 0;
  };

  sheetContent.addEventListener('touchstart', handleTouchStart, { passive: false });
  sheetContent.addEventListener('touchmove', handleTouchMove, { passive: false });
  sheetContent.addEventListener('touchend', handleTouchEnd);
}

function initYearSwipeGestures() {
  const customGrid = document.getElementById('custom-date-picker-bs-years-view');
  if (customGrid) {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    customGrid.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
      }
    }, { passive: true });
    
    customGrid.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - startX;
        const deltaY = e.changedTouches[0].clientY - startY;
        const duration = Date.now() - startTime;
        if (duration < 400 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && Math.abs(deltaX) > 40) {
          if (deltaX < 0) {
            shiftCustomDatePickerBSYears(6);
          } else {
            shiftCustomDatePickerBSYears(-6);
          }
        }
      }
    }, { passive: true });
  }

  const monthGrid = document.getElementById('month-picker-bs-years-view');
  if (monthGrid) {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    monthGrid.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
      }
    }, { passive: true });
    
    monthGrid.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - startX;
        const deltaY = e.changedTouches[0].clientY - startY;
        const duration = Date.now() - startTime;
        if (duration < 400 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && Math.abs(deltaX) > 40) {
          if (deltaX < 0) {
            shiftMonthPickerBSYears(6);
          } else {
            shiftMonthPickerBSYears(-6);
          }
        }
      }
    }, { passive: true });
  }
}

function initCalendarSwipeGestures() {
  const container = document.getElementById('custom-date-picker-calendar-view');
  if (!container) return;

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    }
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - startX;
      const deltaY = e.changedTouches[0].clientY - startY;
      const duration = Date.now() - startTime;

      if (duration < 400 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && Math.abs(deltaX) > 40) {
        if (deltaX < 0) {
          adjustCustomDatePickerMonth(1);
        } else {
          adjustCustomDatePickerMonth(-1);
        }
      }
    }
  }, { passive: true });
}


let _customDatePickerTargetInput = 'trans-date';

function openCustomDatePicker(targetInputId = 'trans-date') {
  if (!window._calendarSwipeGesturesInitialized) {
    initCalendarSwipeGestures();
    initYearSwipeGestures();
    window._calendarSwipeGesturesInitialized = true;
  }
  if (window.autocompleteJustSelected) return;
  
  if (targetInputId === 'trans-date') {
    const form = document.getElementById('transaction-form');
    if (form && form.getAttribute('data-readonly') === 'true') return;
  }
  
  _customDatePickerTargetInput = targetInputId;
  ensureHistoryPushed();

  const txModal = document.getElementById('transaction-form');
  const datePickerModal = document.getElementById('custom-date-picker-modal');
  if (datePickerModal) {
    if (txModal && document.getElementById('transaction-modal').classList.contains('active')) {
      const modalParent = document.getElementById('transaction-modal');
      if (modalParent.classList.contains('expense')) {
        datePickerModal.style.setProperty('--picker-accent', 'var(--red-negative)');
      } else if (modalParent.classList.contains('income')) {
        datePickerModal.style.setProperty('--picker-accent', 'var(--blue-positive)');
      } else {
        datePickerModal.style.setProperty('--picker-accent', 'var(--text-secondary)');
      }
    } else {
      datePickerModal.style.removeProperty('--picker-accent');
    }
  }

  // Close any active inline popups on open
  closeCustomDatePickerBS();
  
  const timeContainer = document.getElementById('custom-date-picker-time-container');
  if (timeContainer) {
    if (targetInputId === 'trans-date') {
      timeContainer.style.display = 'flex';
    } else {
      timeContainer.style.display = 'none';
    }
  }

  const dateInput = document.getElementById(targetInputId);
  let currentDate = new Date();
  if (dateInput && dateInput.value) {
    if (dateInput.value.includes('T')) {
      const parts = dateInput.value.split('T');
      if (parts.length === 2) {
        const dateParts = parts[0].split('-');
        const timeParts = parts[1].split(':');
        if (dateParts.length === 3 && timeParts.length >= 2) {
          currentDate = new Date(
            parseInt(dateParts[0], 10),
            parseInt(dateParts[1], 10) - 1,
            parseInt(dateParts[2], 10),
            parseInt(timeParts[0], 10),
            parseInt(timeParts[1], 10)
          );
        }
      }
    } else {
      const dateParts = dateInput.value.split('-');
      if (dateParts.length === 3) {
        currentDate = new Date(
          parseInt(dateParts[0], 10),
          parseInt(dateParts[1], 10) - 1,
          parseInt(dateParts[2], 10)
        );
      } else {
        const parsed = new Date(dateInput.value);
        if (!isNaN(parsed.getTime())) {
          currentDate = parsed;
        }
      }
    }
  }
  
  customDatePickerSelectedDate = new Date(currentDate);
  customDatePickerViewingMonth = new Date(currentDate);
  
  // Populate scroll wheels if empty
  const hoursScroll = document.getElementById('scroll-hours');
  if (hoursScroll && hoursScroll.children.length === 0) {
    for (let i = 0; i < 24; i++) {
      const div = document.createElement('div');
      div.className = 'time-wheel-item';
      div.textContent = String(i).padStart(2, '0');
      hoursScroll.appendChild(div);
    }
  }
  
  const minutesScroll = document.getElementById('scroll-minutes');
  if (minutesScroll && minutesScroll.children.length === 0) {
    for (let i = 0; i < 60; i++) {
      const div = document.createElement('div');
      div.className = 'time-wheel-item';
      div.textContent = String(i).padStart(2, '0');
      minutesScroll.appendChild(div);
    }
  }
  
  // Setup listeners
  setupTimeWheelScrollListeners();
  initTimeInputListeners();
  
  // Reset time picker mode to Wheels by default on open
  const wheelsRow = document.getElementById('custom-date-picker-time-wheels-row');
  const inputsRow = document.getElementById('custom-date-picker-time-inputs');
  const toggleBtn = document.getElementById('toggle-time-input-mode');
  if (wheelsRow) wheelsRow.style.display = 'flex';
  if (inputsRow) inputsRow.style.display = 'none';
  if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-regular fa-keyboard"></i>';
  
  renderCustomDatePickerCalendar();
  
  // Open the modal
  openModal('custom-date-picker-modal');
  
  // Scroll wheels and set input values to correct initial values after rendering transition
  setTimeout(() => {
    const hs = document.getElementById('scroll-hours');
    if (hs) {
      hs.scrollTop = currentDate.getHours() * 60;
    }
    const ms = document.getElementById('scroll-minutes');
    if (ms) {
      ms.scrollTop = currentDate.getMinutes() * 60;
    }
    
    // Set manual input values
    const inputHours = document.getElementById('custom-time-input-hours');
    if (inputHours) {
      inputHours.value = String(currentDate.getHours()).padStart(2, '0');
    }
    const inputMinutes = document.getElementById('custom-time-input-minutes');
    if (inputMinutes) {
      inputMinutes.value = String(currentDate.getMinutes()).padStart(2, '0');
    }
  }, 100);
}

window.startPartnerSyncPolling = startPartnerSyncPolling;
window.stopPartnerSyncPolling = stopPartnerSyncPolling;
window.updateHeaderProfileBadge = updateHeaderProfileBadge;
window.openProfileSheet = openProfileSheet;
window.closeProfileSheet = closeProfileSheet;
window.handleProfileSheetOverlayClick = handleProfileSheetOverlayClick;
window.selectPresetAvatar = selectPresetAvatar;
window.triggerAvatarUpload = triggerAvatarUpload;
window.handleCustomAvatarUpload = handleCustomAvatarUpload;
window.saveProfileName = saveProfileName;
window.handleProfileNameKeydown = handleProfileNameKeydown;
window.openPartnerFromProfile = openPartnerFromProfile;
window.triggerProfileSync = triggerProfileSync;
window.triggerProfileExport = triggerProfileExport;
window.cycleThemeFromProfile = cycleThemeFromProfile;
window.handleProfileLogout = handleProfileLogout;
window.initProfileSheetSwipeDismiss = initProfileSheetSwipeDismiss;
window.openCustomDatePicker = openCustomDatePicker;

function updateSupabaseUserModal() {
  const container = document.getElementById('supabase-user-settings');
  if (!container) return;

  const lang = state.lang || 'el';

  if (state.guestMode || !state.currentUser) {
    container.innerHTML = `
      <div style="text-align: center; padding: 10px 0;">
        <div style="font-size: 40px; margin-bottom: 12px;">☁️</div>
        <h4 style="margin-bottom: 8px; font-weight: 700; color: var(--text-main);">
          ${lang === 'en' ? 'Guest Mode (Offline)' : 'Λειτουργία Επισκέπτη (Offline)'}
        </h4>
        <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 20px;">
          ${lang === 'en' 
            ? 'Currently, your data is saved only locally on your device. Connect to the Cloud to enable automatic backup and a real-time shared wallet with your partner.' 
            : 'Αυτή τη στιγμή τα δεδομένα σας αποθηκεύονται μόνο τοπικά στη συσκευή σας. Συνδεθείτε στο Cloud για να ενεργοποιήσετε αυτόματο backup και κοινό πορτοφόλι σε πραγματικό χρόνο με τον/την συνεργάτη σας.'}
        </p>
        <button type="button" class="btn btn-primary btn-block" onclick="closeModal('supabase-modal'); showAuthOverlay();" style="padding: 12px;">
          <i class="fa-solid fa-right-to-bracket" style="margin-right: 8px;"></i>
          ${lang === 'en' ? 'Login or Register' : 'Σύνδεση ή Εγγραφή'}
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="text-align: center; padding: 10px 0;">
        <div style="font-size: 40px; margin-bottom: 12px;">☁️✅</div>
        <h4 style="margin-bottom: 4px; font-weight: 700; color: var(--text-main);">
          ${lang === 'en' ? 'Connected to Cloud' : 'Συνδεδεμένος στο Cloud'}
        </h4>
        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 20px; word-break: break-all;">
          ${state.currentUser.email}
        </div>
        
        <div class="ios-settings-group" style="margin-bottom: 20px; text-align: left;">
          <div class="ios-settings-row" onclick="triggerProfileSyncFromModal()">
            <div class="ios-row-left">
              <div class="ios-row-icon icon-sync"><i class="fa-solid fa-cloud-arrow-up"></i></div>
              <span class="ios-row-label">${lang === 'en' ? 'Sync Now' : 'Συγχρονισμός Τώρα'}</span>
            </div>
            <div class="ios-row-right">
              <i class="fa-solid fa-arrows-rotate ios-row-arrow" id="modal-sync-spinner"></i>
            </div>
          </div>
        </div>

        <button type="button" class="btn btn-secondary btn-block" onclick="closeModal('supabase-modal'); handleLogout();" style="color: var(--accent); background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); padding: 11px;">
          <i class="fa-solid fa-right-from-bracket" style="margin-right: 8px;"></i>
          ${lang === 'en' ? 'Logout Account' : 'Αποσύνδεση Λογαριασμού'}
        </button>
      </div>
    `;
  }
}

function triggerProfileSyncFromModal() {
  triggerProfileSync();
}

window.updateSupabaseUserModal = updateSupabaseUserModal;
window.triggerProfileSyncFromModal = triggerProfileSyncFromModal;

// ============================================================
// CUSTOM DROPDOWNS FOR SEARCH FILTERING
// ============================================================

function toggleCustomDropdown(event, type) {
  event.stopPropagation();
  
  // Close all other dropdowns
  const allContainers = document.querySelectorAll('.custom-select-container');
  allContainers.forEach(container => {
    if (container.id !== `custom-select-container-${type}`) {
      container.classList.remove('dropdown-open');
    }
  });

  const container = document.getElementById(`custom-select-container-${type}`);
  if (container) {
    container.classList.toggle('dropdown-open');
  }
}

function selectCustomDropdownOption(type, value, label) {
  const nativeSelect = document.getElementById(`search-filter-${type}`);
  if (!nativeSelect) return;
  
  nativeSelect.value = value;
  
  const container = document.getElementById(`custom-select-container-${type}`);
  if (container) {
    const triggerText = container.querySelector('.custom-select-trigger-text');
    if (triggerText) {
      triggerText.textContent = label;
    }
    
    // Update active state in UI list
    const options = container.querySelectorAll('.custom-select-option');
    options.forEach(opt => {
      if (opt.getAttribute('data-value') === value) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });

    container.classList.remove('dropdown-open');
  }
  
  // Dispatch native change event
  if (nativeSelect.onchange) {
    nativeSelect.onchange();
  } else {
    nativeSelect.dispatchEvent(new Event('change'));
  }
}

function syncCustomSelect(type) {
  const nativeSelect = document.getElementById(`search-filter-${type}`);
  const optionsContainer = document.getElementById(`custom-options-${type}`);
  if (!nativeSelect || !optionsContainer) return;
  
  optionsContainer.innerHTML = '';
  const selectedValue = nativeSelect.value;
  let activeLabel = '';

  Array.from(nativeSelect.options).forEach(opt => {
    const isSelected = opt.value === selectedValue;
    if (isSelected) {
      activeLabel = opt.textContent;
    }

    const div = document.createElement('div');
    div.className = `custom-select-option${isSelected ? ' active' : ''}`;
    div.setAttribute('data-value', opt.value);
    div.innerHTML = `
      <span>${opt.textContent}</span>
      <i class="fa-solid fa-check check-icon"></i>
    `;
    
    div.onclick = function(e) {
      e.stopPropagation();
      selectCustomDropdownOption(type, opt.value, opt.textContent);
    };
    
    optionsContainer.appendChild(div);
  });

  const container = document.getElementById(`custom-select-container-${type}`);
  if (container && activeLabel) {
    const triggerText = container.querySelector('.custom-select-trigger-text');
    if (triggerText) {
      triggerText.textContent = activeLabel;
    }
  }
}

function updateCustomSelectTriggers() {
  ['type', 'account', 'category', 'subcategory'].forEach(type => {
    const nativeSelect = document.getElementById(`search-filter-${type}`);
    if (nativeSelect) {
      const selectedOpt = nativeSelect.options[nativeSelect.selectedIndex];
      const label = selectedOpt ? selectedOpt.textContent : '';
      const container = document.getElementById(`custom-select-container-${type}`);
      if (container) {
        const triggerText = container.querySelector('.custom-select-trigger-text');
        if (triggerText) {
          triggerText.textContent = label;
        }
        
        const optionDivs = container.querySelectorAll('.custom-select-option');
        optionDivs.forEach(opt => {
          if (opt.getAttribute('data-value') === nativeSelect.value) {
            opt.classList.add('active');
          } else {
            opt.classList.remove('active');
          }
        });
      }
    }
  });
}

// Global outside click handler to close open custom selects
window.addEventListener('click', function(e) {
  if (!e.target.closest('.custom-select-container')) {
    const allContainers = document.querySelectorAll('.custom-select-container');
    allContainers.forEach(container => {
      container.classList.remove('dropdown-open');
    });
  }
});

// Bind custom functions to window so they work from inline HTML event attributes
window.toggleCustomDropdown = toggleCustomDropdown;
window.selectCustomDropdownOption = selectCustomDropdownOption;
window.syncCustomSelect = syncCustomSelect;
window.updateCustomSelectTriggers = updateCustomSelectTriggers;

// Android safe-area fallback: check if env(safe-area-inset-bottom) returns 0 in standalone mode
document.addEventListener('DOMContentLoaded', () => {
  const isAndroid = /android/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!isAndroid || !isStandalone) return;
  
  // Check if env() actually returns a value > 0
  const testEl = document.createElement('div');
  testEl.style.position = 'fixed';
  testEl.style.bottom = '0';
  testEl.style.height = 'env(safe-area-inset-bottom, 0px)';
  document.body.appendChild(testEl);
  const safeBottom = testEl.offsetHeight;
  document.body.removeChild(testEl);
  
    if (safeBottom === 0) {
      // env() returns 0, update --safe-area-bottom to a default fallback of 16px to clear the gesture pill
      document.documentElement.style.setProperty('--safe-area-bottom', '12px');
    }
});

// Android Overlay Click: Close picker modals by clicking on the background backdrop
document.addEventListener('DOMContentLoaded', () => {
  const isAndroid = /android/i.test(navigator.userAgent);
  if (!isAndroid) return;
  
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });
});

// Dynamic Visual Viewport Height Adjustment (for virtual keyboard support)
// With interactive-widget=resizes-visual, the layout viewport doesn't shrink on Android.
// We use visualViewport to detect the keyboard height and push the modal above it.
document.addEventListener('DOMContentLoaded', () => {
  let maxViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

  if (window.visualViewport) {
    const updateViewportHeight = () => {
      const vvHeight = window.visualViewport.height;
      const offsetTop = window.visualViewport.offsetTop;
      
      // Track the maximum height (when keyboard is hidden) for calculations
      if (vvHeight > maxViewportHeight) {
        maxViewportHeight = vvHeight;
      }
      
      // Keyboard height = difference between full screen and visual viewport
      // Subtract offsetTop ONLY on Android (where it is 0). On iOS, do NOT subtract offsetTop
      // to keep keyboardHeight stable when iOS Safari pans the layout viewport.
      const rawKeyboardHeight = isIOS ? (window.innerHeight - vvHeight) : (window.innerHeight - vvHeight - offsetTop);
      
      // Scale keyboardHeight inversely to counteract body { zoom: 0.93 }
      // This ensures CSS translations perfectly track the physical keyboard.
      const scale = isIOS ? 1.0 : 0.93;
      const keyboardHeight = Math.max(0, rawKeyboardHeight) / scale;
      
      // --viewport-height: the visible area height (visual viewport)
      // Use window.innerHeight for layout (unchanged with resizes-visual)
      document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
      document.documentElement.style.setProperty('--viewport-offset-top', `${offsetTop}px`);
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);

      // Adjust transaction modal content height and top to match visual viewport
      const txModal = document.getElementById('transaction-modal');
      if (txModal && txModal.classList.contains('active')) {
        if (!isIOS) {
          txModal.style.setProperty('height', (window.innerHeight / scale) + 'px', 'important');
          txModal.style.setProperty('top', '0px', 'important');
          
          const modalContent = txModal.querySelector('.modal-content');
          if (modalContent) {
            if (rawKeyboardHeight > 30) {
              modalContent.style.setProperty('height', (vvHeight / scale) + 'px', 'important');
              modalContent.style.setProperty('top', (offsetTop / scale) + 'px', 'important');
            } else {
              modalContent.style.setProperty('height', (window.innerHeight / scale) + 'px', 'important');
              modalContent.style.setProperty('top', '0px', 'important');
            }
          }
        }
      }
    };

    // On iOS, visualViewport fires 'resize' on every frame during keyboard animation,
    // which causes continuous expensive JS + style recalculations and visible lag.
    // Use a RAF-based debounce to coalesce rapid-fire events into one update per frame.
    let _vpRafId = null;
    const debouncedUpdateViewport = isIOS
      ? () => {
          if (_vpRafId) return; // already scheduled this frame
          _vpRafId = requestAnimationFrame(() => {
            _vpRafId = null;
            updateViewportHeight();
          });
        }
      : updateViewportHeight; // Android: fire immediately (no excess events)
    
    window.visualViewport.addEventListener('resize', debouncedUpdateViewport);
    window.visualViewport.addEventListener('scroll', debouncedUpdateViewport);
    
    // Track orientation changes or resets when not focused
    window.addEventListener('resize', () => {
      const isInputFocused = document.activeElement && 
                             (document.activeElement.tagName === 'INPUT' || 
                              document.activeElement.tagName === 'TEXTAREA');
      if (!isInputFocused && window.visualViewport) {
        maxViewportHeight = window.visualViewport.height;
      }
      updateViewportHeight();
    });
    
    updateViewportHeight();
  } else {
    document.documentElement.style.setProperty('--viewport-height', '100vh');
    document.documentElement.style.setProperty('--viewport-offset-top', '0px');
    document.documentElement.style.setProperty('--keyboard-height', '0px');
  }

  // Prevent browser window from panning/scrolling up when inputs are focused in modals
  window.addEventListener('scroll', () => {
    if (isIOS) return; // Let iOS Safari handle its viewport panning during focus; we will reset on blur
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    }
  });

  // iOS Safari layout viewport panning is handled in the focus event listeners and visualViewport resize handlers.
});

// Custom Date Picker State Variables
let customDatePickerSelectedDate = new Date();
let customDatePickerViewingMonth = new Date();
let timeWheelsInitialized = false;

function setupTimeWheelScrollListeners() {
  if (timeWheelsInitialized) return;
  
  const setupWheel = (scrollId) => {
    const scrollEl = document.getElementById(scrollId);
    if (!scrollEl) return;
    
    const updateSelection = () => {
      const scrollTop = scrollEl.scrollTop;
      const selectedIndex = Math.round(scrollTop / 60);
      const items = scrollEl.querySelectorAll('.time-wheel-item');
      items.forEach((item, idx) => {
        if (idx === selectedIndex) {
          item.classList.add('selected');
        } else {
          item.classList.remove('selected');
        }
      });
    };
    
    scrollEl.addEventListener('scroll', updateSelection);
    // Initial call
    updateSelection();
  };
  
  setupWheel('scroll-hours');
  setupWheel('scroll-minutes');
  timeWheelsInitialized = true;
}

function toggleTimeInputMode() {
  const wheelsRow = document.getElementById('custom-date-picker-time-wheels-row');
  const inputsRow = document.getElementById('custom-date-picker-time-inputs');
  const toggleBtn = document.getElementById('toggle-time-input-mode');
  
  if (!wheelsRow || !inputsRow || !toggleBtn) return;
  
  const isWheelsMode = wheelsRow.style.display !== 'none';
  
  if (isWheelsMode) {
    // Switch to Manual INPUT Mode
    wheelsRow.style.display = 'none';
    inputsRow.style.display = 'flex';
    toggleBtn.innerHTML = '<i class="fa-solid fa-clock"></i>';
    
    // Sync inputs with wheel values
    const hs = document.getElementById('scroll-hours');
    const ms = document.getElementById('scroll-minutes');
    let h = 0;
    let m = 0;
    if (hs) h = Math.round(hs.scrollTop / 60);
    if (ms) m = Math.round(ms.scrollTop / 60);
    
    const inputHours = document.getElementById('custom-time-input-hours');
    const inputMinutes = document.getElementById('custom-time-input-minutes');
    if (inputHours) {
      inputHours.value = String(h).padStart(2, '0');
      inputHours.focus();
      setTimeout(() => inputHours.select(), 50);
    }
    if (inputMinutes) {
      inputMinutes.value = String(m).padStart(2, '0');
    }
  } else {
    // Switch to WHEELS Mode
    wheelsRow.style.display = 'flex';
    inputsRow.style.display = 'none';
    toggleBtn.innerHTML = '<i class="fa-regular fa-keyboard"></i>';
    
    // Sync wheels with typed values
    const inputHours = document.getElementById('custom-time-input-hours');
    const inputMinutes = document.getElementById('custom-time-input-minutes');
    
    let h = parseInt(inputHours.value, 10);
    let m = parseInt(inputMinutes.value, 10);
    
    if (isNaN(h) || h < 0) h = 0;
    if (h > 23) h = 23;
    if (isNaN(m) || m < 0) m = 0;
    if (m > 59) m = 59;
    
    const hs = document.getElementById('scroll-hours');
    if (hs) hs.scrollTop = h * 60;
    const ms = document.getElementById('scroll-minutes');
    if (ms) ms.scrollTop = m * 60;
  }
}
window.toggleTimeInputMode = toggleTimeInputMode;

let timeInputsInitialized = false;
function initTimeInputListeners() {
  if (timeInputsInitialized) return;
  
  const inputHours = document.getElementById('custom-time-input-hours');
  const inputMinutes = document.getElementById('custom-time-input-minutes');
  
  if (!inputHours || !inputMinutes) return;
  
  inputHours.addEventListener('input', (e) => {
    let val = e.target.value;
    if (val.length > 2) {
      val = val.slice(0, 2);
    }
    let num = parseInt(val, 10);
    if (!isNaN(num)) {
      if (num > 23) {
        val = '23';
      } else if (num < 0) {
        val = '00';
      }
    }
    e.target.value = val;
    
    // Auto-focus minutes input when 2 digits are entered
    if (val.length === 2) {
      inputMinutes.focus();
      setTimeout(() => inputMinutes.select(), 50);
    }
  });

  inputMinutes.addEventListener('input', (e) => {
    let val = e.target.value;
    if (val.length > 2) {
      val = val.slice(0, 2);
    }
    let num = parseInt(val, 10);
    if (!isNaN(num)) {
      if (num > 59) {
        val = '59';
      } else if (num < 0) {
        val = '00';
      }
    }
    e.target.value = val;
  });

  inputHours.addEventListener('blur', (e) => {
    let val = e.target.value;
    if (val !== '') {
      e.target.value = String(parseInt(val, 10)).padStart(2, '0');
    } else {
      e.target.value = '00';
    }
  });

  inputMinutes.addEventListener('blur', (e) => {
    let val = e.target.value;
    if (val !== '') {
      e.target.value = String(parseInt(val, 10)).padStart(2, '0');
    } else {
      e.target.value = '00';
    }
  });
  
  timeInputsInitialized = true;
}



function renderCustomDatePickerCalendar() {
  const grid = document.getElementById('custom-date-picker-days-grid');
  const largeLabel = document.getElementById('custom-date-picker-month-large-label');
  if (!grid) return;
  
  const year = customDatePickerViewingMonth.getFullYear();
  const month = customDatePickerViewingMonth.getMonth();
  
  // Update Large Month Title
  if (largeLabel) {
    largeLabel.textContent = getMonthName(month, true).toUpperCase();
  }
  
  grid.innerHTML = '';
  
  // Get first day of the month and its weekday (0 = Mon, 6 = Sun)
  const firstDay = new Date(year, month, 1);
  let firstDayIndex = firstDay.getDay(); // 0 = Sun, 1 = Mon ...
  firstDayIndex = (firstDayIndex + 6) % 7; // Convert to Mon=0, Sun=6
  
  // Get total days in month
  const totalDays = new Date(year, month + 1, 0).getDate();
  
  // Get total days in previous month for padding
  const prevMonthTotalDays = new Date(year, month, 0).getDate();
  
  // Render previous month's padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calendar-day-btn other-month';
    btn.textContent = dayNum;
    grid.appendChild(btn);
  }
  
  // Render current month's days
  const today = new Date();
  for (let d = 1; d <= totalDays; d++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calendar-day-btn';
    btn.textContent = d;
    
    // Check if selected
    if (d === customDatePickerSelectedDate.getDate() && 
        month === customDatePickerSelectedDate.getMonth() && 
        year === customDatePickerSelectedDate.getFullYear()) {
      btn.classList.add('active');
    }
    
    // Check if today
    if (d === today.getDate() && 
        month === today.getMonth() && 
        year === today.getFullYear()) {
      btn.classList.add('today');
    }
    
    // Add click handler to select this day
    btn.addEventListener('click', () => {
      customDatePickerSelectedDate.setFullYear(year);
      customDatePickerSelectedDate.setMonth(month);
      customDatePickerSelectedDate.setDate(d);
      renderCustomDatePickerCalendar();
    });
    
    grid.appendChild(btn);
  }
  
  // Render next month's padding days to complete grid (multiples of 7)
  const totalRendered = firstDayIndex + totalDays;
  const remaining = (7 - (totalRendered % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calendar-day-btn other-month';
    btn.textContent = i;
    grid.appendChild(btn);
  }
}

function adjustCustomDatePickerMonth(direction) {
  customDatePickerViewingMonth.setMonth(customDatePickerViewingMonth.getMonth() + direction);
  renderCustomDatePickerCalendar();
}

window.adjustCustomDatePickerMonth = adjustCustomDatePickerMonth;

function openCustomDatePickerBS(forceYearView = false) {
  const bs = document.getElementById('custom-date-picker-bs');
  if (bs) {
    bs.style.display = 'flex';
    setTimeout(() => bs.classList.add('active'), 10);
    // Set active year label
    const yearLabel = document.getElementById('custom-date-picker-bs-year-label');
    if (yearLabel) yearLabel.textContent = customDatePickerViewingMonth.getFullYear();
    
    // Toggle view based on parameter
    toggleCustomDatePickerBSYearView(forceYearView);
    renderCustomDatePickerBSGrids('month');
    renderCustomDatePickerBSGrids('year');
  }
}

function closeCustomDatePickerBS() {
  const bs = document.getElementById('custom-date-picker-bs');
  if (bs) {
    bs.classList.remove('active');
    setTimeout(() => bs.style.display = 'none', 300);
  }
}

function toggleCustomDatePickerBSYearView(forceYearView) {
  const monthsView = document.getElementById('custom-date-picker-bs-months-view');
  const yearsView = document.getElementById('custom-date-picker-bs-years-view');
  const chevron = document.getElementById('custom-date-picker-bs-year-chevron');
  if (!monthsView || !yearsView) return;

  let showYears = false;
  if (typeof forceYearView === 'boolean') {
    showYears = forceYearView;
  } else {
    showYears = yearsView.style.display === 'none';
  }

  if (showYears) {
    monthsView.style.display = 'none';
    yearsView.style.display = 'grid';
    if (chevron) chevron.style.display = 'none';
    const selectedYear = customDatePickerViewingMonth.getFullYear();
    window.customDatePickerBSYearStart = Math.floor((selectedYear - 2020) / 6) * 6 + 2020;
    renderCustomDatePickerBSGrids('year');
  } else {
    monthsView.style.display = 'grid';
    yearsView.style.display = 'none';
    if (chevron) {
      chevron.style.display = 'inline-block';
      chevron.style.transform = 'rotate(0deg)';
    }
    const labelSpan = document.getElementById('custom-date-picker-bs-year-label');
    if (labelSpan) {
      labelSpan.style.display = '';
      labelSpan.textContent = customDatePickerViewingMonth.getFullYear();
    }
  }
}

function shiftCustomDatePickerBSYears(delta) {
  window.customDatePickerBSYearStart += delta;
  renderCustomDatePickerBSGrids('year');
}
window.shiftCustomDatePickerBSYears = shiftCustomDatePickerBSYears;

function renderCustomDatePickerBSGrids(type) {
  if (type === 'month') {
    const grid = document.getElementById('custom-date-picker-bs-months-view');
    if (!grid) return;
    grid.innerHTML = '';
    const currentMonth = customDatePickerViewingMonth.getMonth() + 1; // 1-12
    const monthNames = state.lang === 'en' ? ENGLISH_MONTHS_SHORT : GREEK_MONTHS_SHORT;

    for (let m = 1; m <= 12; m++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'google-picker-btn';
      btn.textContent = monthNames[m - 1];
      if (m === currentMonth) {
        btn.classList.add('active');
      }
      btn.onclick = (e) => {
        e.stopPropagation();
        customDatePickerViewingMonth.setMonth(m - 1);
        renderCustomDatePickerCalendar();
        closeCustomDatePickerBS();
      };
      grid.appendChild(btn);
    }
  } else if (type === 'year') {
    const grid = document.getElementById('custom-date-picker-bs-years-view');
    if (!grid) return;
    grid.innerHTML = '';
    
    if (!window.customDatePickerBSYearStart) {
      const selectedYear = customDatePickerViewingMonth.getFullYear();
      window.customDatePickerBSYearStart = Math.floor((selectedYear - 2020) / 6) * 6 + 2020;
    }
    
    const startY = window.customDatePickerBSYearStart;
    const endY = startY + 5;
    
    const labelSpan = document.getElementById('custom-date-picker-bs-year-label');
    if (labelSpan) {
      labelSpan.style.display = 'flex';
      labelSpan.style.alignItems = 'center';
      labelSpan.style.justifyContent = 'center';
      labelSpan.innerHTML = `
        <span style="cursor: pointer; padding: 6px 16px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" onclick="event.stopPropagation(); shiftCustomDatePickerBSYears(-6)">
          <i class="fa-solid fa-chevron-left" style="font-size: 14px; color: var(--accent, #e05e55);"></i>
        </span>
        <span style="margin: 0 8px; font-weight: 700; color: #ffffff; min-width: 110px; text-align: center;">${startY} - ${endY}</span>
        <span style="cursor: pointer; padding: 6px 16px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" onclick="event.stopPropagation(); shiftCustomDatePickerBSYears(6)">
          <i class="fa-solid fa-chevron-right" style="font-size: 14px; color: var(--accent, #e05e55);"></i>
        </span>
      `;
    }

    const currentYear = customDatePickerViewingMonth.getFullYear();
    const systemYear = new Date().getFullYear();

    for (let y = startY; y <= endY; y++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'google-picker-btn';
      btn.textContent = y;
      if (y === currentYear) {
        btn.classList.add('active');
      } else if (y === systemYear) {
        btn.classList.add('today-year');
      }
      btn.onclick = (e) => {
        e.stopPropagation();
        customDatePickerViewingMonth.setFullYear(y);
        toggleCustomDatePickerBSYearView(false);
        renderCustomDatePickerBSGrids('month');
      };
      grid.appendChild(btn);
    }
  }
}

// Click-away listener to close inline calendar popups
document.addEventListener('click', function(e) {
  const bs = document.getElementById('custom-date-picker-bs');
  const titleBtn = document.getElementById('custom-date-picker-month-title-btn');
  if (bs && bs.classList.contains('active')) {
    if (!bs.contains(e.target) && (!titleBtn || !titleBtn.contains(e.target))) {
      closeCustomDatePickerBS();
    }
  }
});

window.openCustomDatePickerBS = openCustomDatePickerBS;
window.closeCustomDatePickerBS = closeCustomDatePickerBS;
window.toggleCustomDatePickerBSYearView = toggleCustomDatePickerBSYearView;

function setCustomDatePickerValue() {
  const hoursScroll = document.getElementById('scroll-hours');
  const minutesScroll = document.getElementById('scroll-minutes');
  const inputsRow = document.getElementById('custom-date-picker-time-inputs');
  
  let hours = 0;
  let minutes = 0;
  
  const isManualMode = inputsRow && inputsRow.style.display === 'flex';
  
  if (isManualMode) {
    const inputHours = document.getElementById('custom-time-input-hours');
    const inputMinutes = document.getElementById('custom-time-input-minutes');
    hours = parseInt(inputHours.value, 10);
    minutes = parseInt(inputMinutes.value, 10);
    
    if (isNaN(hours) || hours < 0) hours = 0;
    if (hours > 23) hours = 23;
    if (isNaN(minutes) || minutes < 0) minutes = 0;
    if (minutes > 59) minutes = 59;
  } else {
    if (hoursScroll) {
      hours = Math.round(hoursScroll.scrollTop / 60);
      if (hours < 0) hours = 0;
      if (hours > 23) hours = 23;
    }
    if (minutesScroll) {
      minutes = Math.round(minutesScroll.scrollTop / 60);
      if (minutes < 0) minutes = 0;
      if (minutes > 59) minutes = 59;
    }
  }
  
  customDatePickerSelectedDate.setHours(hours);
  customDatePickerSelectedDate.setMinutes(minutes);
  
  const yyyy = customDatePickerSelectedDate.getFullYear();
  const mm = String(customDatePickerSelectedDate.getMonth() + 1).padStart(2, '0');
  const dd = String(customDatePickerSelectedDate.getDate()).padStart(2, '0');
  
  const targetId = _customDatePickerTargetInput || 'trans-date';
  const dateInput = document.getElementById(targetId);
  if (dateInput) {
    if (targetId === 'trans-date') {
      const hh = String(customDatePickerSelectedDate.getHours()).padStart(2, '0');
      const min = String(customDatePickerSelectedDate.getMinutes()).padStart(2, '0');
      dateInput.value = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    } else {
      dateInput.value = `${yyyy}-${mm}-${dd}`;
      const label = document.getElementById(`${targetId}-label`);
      if (label) {
        label.textContent = `${dd}/${mm}/${yyyy}`;
      }
    }
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  closeModal('custom-date-picker-modal');
}

window.setCustomDatePickerValue = setCustomDatePickerValue;

// ============================================================
// FEATURE: NOTE FIELD SMART AUTOCOMPLETE
// ============================================================

function highlightMatch(text, query) {
  if (!query) return text;
  // Escape special regex chars
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<span class="note-match-highlight">$1</span>');
}

function getAdvancedNotes(query) {
  const allTransactions = state.transactions || [];
  const noteDetails = new Map();
  
  // Sort transactions by date (desc) and time/id (desc) to get the most recent first
  const sortedTrans = [...allTransactions].sort(compareTransactions);
  
  for (const t of sortedTrans) {
    const title = (t.note || '').trim();
    if (!title) continue;
    const titleLower = title.toLowerCase();
    if (!noteDetails.has(titleLower)) {
      noteDetails.set(titleLower, {
        title: title,
        category: t.category || '',
        subcategory: t.subcategory || '',
        account: t.account_from || t.account || ''
      });
    }
  }
  
  const q = normalizeText(query);
  const suggestions = [];
  
  for (const [key, details] of noteDetails.entries()) {
    const normKey = normalizeText(details.title);
    if (!q || normKey.includes(q)) {
      suggestions.push(details);
    }
  }
  
  // Sort suggestions: if there is a query, prioritize matches that start with the query
  if (q) {
    suggestions.sort((a, b) => {
      const aTitle = normalizeText(a.title);
      const bTitle = normalizeText(b.title);
      const aStarts = aTitle.startsWith(q);
      const bStarts = bTitle.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aTitle.localeCompare(bTitle);
    });
  }
  
  return suggestions.slice(0, 7);
}

function renderNoteAutocomplete(query) {
  const dropdown = document.getElementById('note-autocomplete-dropdown');
  if (!dropdown) return;

  // Respect setting switch
  const autocompleteEnabled = localStorage.getItem('settings_autocomplete_enabled') !== 'false';
  if (!autocompleteEnabled) {
    dropdown.style.display = 'none';
    return;
  }

  const q = (query || '').trim();
  
  // Always hide if empty query
  if (q.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  const filtered = getAdvancedNotes(q);

  if (filtered.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  dropdown.innerHTML = '';
  filtered.forEach(suggestion => {
    const item = document.createElement('div');
    item.className = 'note-autocomplete-item';
    
    // Find category details to show badge
    let categoryBadgeHTML = '';
    if (suggestion.category) {
      const catObj = state.categories.find(c => c.name === suggestion.category);
      const icon = catObj ? catObj.icon : '🧩';
      const catCleanName = stripLeadingEmoji(suggestion.category);
      categoryBadgeHTML = `<span class="note-category-pill" style="font-size: 10px; opacity: 0.7; padding: 2px 6px; background: rgba(255,255,255,0.06); border-radius: 8px; margin-left: auto; flex-shrink: 0; display: flex; align-items: center; gap: 4px;">${icon} ${catCleanName}</span>`;
    }
    
    item.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="color:var(--text-muted);font-size:11px;flex-shrink:0;"></i>
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px;">${highlightMatch(suggestion.title, q)}</span>
                      ${categoryBadgeHTML}`;
                      
    // Use pointerdown only to prevent focus loss (prevent blur from closing dropdown)
    item.addEventListener('pointerdown', (e) => {
      e.preventDefault();
    });

    // Handle click to perform the actual selection, fill fields, and close the dropdown safely
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      window.autocompleteJustSelected = true;
      setTimeout(() => {
        window.autocompleteJustSelected = false;
      }, 400);

      const noteInput = document.getElementById('trans-note');
      if (noteInput) {
        noteInput.value = suggestion.title;
        noteInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      // Auto-select Category, Subcategory, and Account
      if (suggestion.category) {
        let catObj = state.categories.find(c => c.name === suggestion.category);
        if (!catObj) {
          // Robust matching: clean emojis & uppercase comparisons
          const cleanSug = stripLeadingEmoji(suggestion.category).trim().toUpperCase();
          catObj = state.categories.find(c => stripLeadingEmoji(c.name).trim().toUpperCase() === cleanSug);
        }
        if (catObj) {
          selectCategory(catObj.name, catObj.icon, catObj.color, false);
        } else {
          selectCategory(suggestion.category, '🧩', 'var(--accent)', false);
        }
      }
      if (suggestion.subcategory) {
        const cleanedCat = stripLeadingEmoji(suggestion.category).toUpperCase();
        const defaults = DEFAULT_SUBCATEGORIES_MAP[cleanedCat] || [];
        const isDefault = defaults.includes(suggestion.subcategory);
        
        if (isDefault) {
          hideSubcategorySelect();
          selectSubcategory(suggestion.subcategory);
        } else {
          showSubcategorySelect();
          const customInput = document.getElementById('trans-subcategory-custom');
          if (customInput) {
            customInput.value = suggestion.subcategory;
            customInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }
      if (suggestion.account) {
        const accInput = document.getElementById('trans-account-from');
        if (accInput) {
          accInput.value = suggestion.account;
          updateAccountTriggerDisplay('from');
        }
      }
      
      closeNoteAutocomplete();
    });
    dropdown.appendChild(item);
  });

  dropdown.style.display = 'block';
}

function closeNoteAutocomplete() {
  const dropdown = document.getElementById('note-autocomplete-dropdown');
  if (dropdown) dropdown.style.display = 'none';
}

function initNoteAutocomplete() {
  const noteInput = document.getElementById('trans-note');
  const dropdown = document.getElementById('note-autocomplete-dropdown');
  if (!noteInput || !dropdown) return;

  if (noteInput.dataset.autocompleteBound === 'true') {
    return;
  }
  noteInput.dataset.autocompleteBound = 'true';

  noteInput.addEventListener('focus', () => {
    renderNoteAutocomplete(noteInput.value);
  });

  noteInput.addEventListener('input', () => {
    renderNoteAutocomplete(noteInput.value);
  });

  noteInput.addEventListener('blur', () => {
    // Small delay to allow pointerdown on dropdown item to fire first
    setTimeout(closeNoteAutocomplete, 150);
  });

  // Close if user presses Escape
  noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNoteAutocomplete();
  });
}

function toggleAutocompleteSetting(enabled) {
  localStorage.setItem('settings_autocomplete_enabled', enabled ? 'true' : 'false');
}

function changeOverviewYear(dir) {
  state.overviewYear = (state.overviewYear || new Date().getFullYear()) + dir;
  renderAccountsTab();
}

function saveCustomSavingsTarget() {
  const inputEl = document.getElementById('forecast-target-input');
  if (inputEl) {
    const val = parseFloat(inputEl.value);
    if (!isNaN(val) && val >= 0) {
      localStorage.setItem('overview_savings_target', val.toString());
      closeModal('forecast-details-modal');
      renderAccountsTab();
    }
  }
}

window.saveCustomSavingsTarget = saveCustomSavingsTarget;
window.changeOverviewYear = changeOverviewYear;
window.toggleAutocompleteSetting = toggleAutocompleteSetting;
window.initNoteAutocomplete = initNoteAutocomplete;
window.closeNoteAutocomplete = closeNoteAutocomplete;

// FEATURE: TEXTAREA AUTO-GROW FOR DESCRIPTION/DETAILS
function initDescriptionAutoGrow() {
  const descInput = document.getElementById('trans-description');
  if (!descInput || descInput.tagName !== 'TEXTAREA') return;
  
  if (descInput.dataset.autogrowBound === 'true') {
    return;
  }
  descInput.dataset.autogrowBound = 'true';

  const updateHeight = () => {
    descInput.style.height = '24px';
    const newHeight = Math.max(24, descInput.scrollHeight);
    descInput.style.height = newHeight + 'px';
  };

  descInput.addEventListener('input', updateHeight);
  descInput.addEventListener('focus', updateHeight);
  
  window.updateDescriptionHeight = updateHeight;
}

document.addEventListener('DOMContentLoaded', () => {
  initDescriptionAutoGrow();
});

window.initDescriptionAutoGrow = initDescriptionAutoGrow;

// ============================================================
// USER FEEDBACK SUBMISSION LOGIC
// ============================================================
async function submitUserFeedback() {
  const ratingBtn = document.querySelector('.emoji-rate-btn.active');
  const rating = ratingBtn ? parseInt(ratingBtn.getAttribute('data-rate')) : null;
  const chipBtn = document.querySelector('.feedback-chip.active');
  const type = chipBtn ? chipBtn.getAttribute('data-type') : 'suggestion';
  const commentVal = document.getElementById('feedback-comment').value.trim();
  
  if (!rating) {
    alert(state.lang === 'el' ? 'Παρακαλώ επιλέξτε μια βαθμολογία!' : 'Please select a rating!');
    return;
  }
  
  const submitBtn = document.getElementById('feedback-submit-btn');
  const textSpan = document.getElementById('feedback-btn-text');
  const spinnerDiv = document.getElementById('feedback-btn-spinner');
  
  if (submitBtn) submitBtn.disabled = true;
  if (textSpan) textSpan.style.opacity = '0.3';
  if (spinnerDiv) spinnerDiv.style.display = 'block';
  
  const feedbackData = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    rating,
    type,
    comment: commentVal,
    user_email: state.currentUser ? state.currentUser.email : 'guest',
    created_at: new Date().toISOString()
  };
  
  // Save locally first
  const existingFeedback = JSON.parse(localStorage.getItem('user_feedback') || '[]');
  existingFeedback.push(feedbackData);
  localStorage.setItem('user_feedback', JSON.stringify(existingFeedback));
  
  // Try sending to Supabase if logged in
  if (state.supabaseClient && state.currentUser) {
    try {
      const { error } = await state.supabaseClient
        .from('feedback')
        .insert([{
          rating: feedbackData.rating,
          type: feedbackData.type,
          comment: feedbackData.comment,
          user_email: feedbackData.user_email
        }]);
        
      if (error) {
        console.warn('Supabase feedback insert failed (table might not exist):', error);
      } else {
        console.log('Feedback synced to Supabase!');
      }
    } catch (err) {
      console.warn('Error syncing feedback to Supabase:', err);
    }
  }
  
  // Wait a small amount for a smooth premium loading state
  setTimeout(() => {
    if (spinnerDiv) spinnerDiv.style.display = 'none';
    if (textSpan) textSpan.style.opacity = '1';
    if (submitBtn) submitBtn.disabled = false;
    
    // Transition UI to success state
    const cardContainer = document.getElementById('feedback-card-container');
    
    if (cardContainer) {
      // Clear inputs
      document.getElementById('feedback-comment').value = '';
      document.querySelectorAll('.emoji-rate-btn').forEach(btn => btn.classList.remove('active'));
      
      // Toggle views inside card container
      const formContents = cardContainer.querySelectorAll('.feedback-rating-container, .feedback-form-group, #feedback-submit-btn');
      formContents.forEach(el => el.style.display = 'none');
      
      // Insert success elements inside card container if not already there
      let successEl = document.getElementById('feedback-success-el');
      if (!successEl) {
        successEl = document.createElement('div');
        successEl.id = 'feedback-success-el';
        successEl.className = 'feedback-success-container';
        successEl.innerHTML = `
          <div class="success-icon-wrapper">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <div class="success-message" data-i18n="feedback_success_msg">${TRANSLATIONS[state.lang]['feedback_success_msg']}</div>
          <button type="button" class="feedback-reset-btn" onclick="resetFeedbackForm()" data-i18n="feedback_reset_btn">${TRANSLATIONS[state.lang]['feedback_reset_btn'] || 'Νέα Αξιολόγηση'}</button>
        `;
        cardContainer.appendChild(successEl);
      } else {
        successEl.style.display = 'flex';
      }
    }
  }, 800);
}

function resetFeedbackForm() {
  const cardContainer = document.getElementById('feedback-card-container');
  if (cardContainer) {
    const successEl = document.getElementById('feedback-success-el');
    if (successEl) successEl.style.display = 'none';
    
    const formContents = cardContainer.querySelectorAll('.feedback-rating-container, .feedback-form-group, #feedback-submit-btn');
    formContents.forEach(el => {
      el.style.display = '';
    });
    
    // Reset inputs
    document.getElementById('feedback-comment').value = '';
    document.querySelectorAll('.emoji-rate-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.feedback-chip').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === 0);
    });
  }
}

window.submitUserFeedback = submitUserFeedback;
window.resetFeedbackForm = resetFeedbackForm;

document.addEventListener('DOMContentLoaded', () => {
  // ── Robust collapsible helper ──────────────────────────────────────────
  // Uses explicit scrollHeight so the content is NEVER clipped regardless
  // of how tall the inner HTML grows (dynamic family / feedback content).
  function toggleCollapsible(content, icon) {
    if (!content || !icon) return;
    const isOpen = content.classList.contains('active');
    if (isOpen) {
      // Animate close: pin current height first, then transition to 0
      content.style.maxHeight = content.scrollHeight + 'px';
      // Force reflow so the browser registers the start value
      void content.offsetHeight;
      content.style.maxHeight = '0px';
      content.classList.remove('active');
      icon.classList.remove('active');
    } else {
      // Animate open: CSS class sets display; measure then expand
      content.classList.add('active');
      icon.classList.add('active');
      // Measure real height (CSS max-height:3000px is the ceiling)
      const targetH = content.scrollHeight;
      content.style.maxHeight = '0px';
      void content.offsetHeight; // force reflow
      content.style.maxHeight = targetH + 'px';
      // Once the transition ends, let height be 'auto' so dynamic
      // content (re-renders) never clips
      content.addEventListener('transitionend', function onEnd() {
        content.removeEventListener('transitionend', onEnd);
        if (content.classList.contains('active')) {
          content.style.maxHeight = 'none'; // fully open, no limit
        }
      }, { once: true });
    }
  }

  // Setup collapsible sections for Overview (income / expense)
  ['income', 'expense'].forEach(type => {
    const trigger = document.getElementById(`collapse-trigger-${type}`);
    if (trigger) {
      trigger.addEventListener('click', () => {
        const content = document.getElementById(type === 'income' ? 'accounts-assets-list' : 'accounts-liabilities-list');
        const icon = document.getElementById(`collapse-icon-${type}`);
        toggleCollapsible(content, icon);
        // Save preference
        const willBeOpen = content && content.classList.contains('active');
        localStorage.setItem(`overview_collapse_${type}`, willBeOpen ? 'expanded' : 'collapsed');
      });
    }
  });

  // Setup collapsible sections for Settings (sync, family, feedback)
  ['sync', 'family', 'feedback'].forEach(type => {
    const trigger = document.getElementById(`collapse-trigger-${type}`);
    if (trigger) {
      trigger.addEventListener('click', () => {
        const contentId = type === 'sync' ? 'settings-sync-content'
                        : type === 'family' ? 'partner-linking-container'
                        : 'feedback-card-container';
        const content = document.getElementById(contentId);
        const icon = document.getElementById(`collapse-icon-${type}`);
        toggleCollapsible(content, icon);
      });
    }
  });

  // Click handler for FHS card & "?" help icon
  const fhsCard = document.querySelector('.fhs-card');
  const fhsHelpTrigger = document.getElementById('fhs-help-trigger');
  
  if (fhsHelpTrigger) {
    fhsHelpTrigger.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevents the card click from firing
      showFhsTab('methodology');
      openModal('fhs-details-modal');
    });
  }
  
  if (fhsCard) {
    fhsCard.addEventListener('click', (e) => {
      if (!e.target.closest('#fhs-help-trigger')) {
        showFhsTab('breakdown');
        openModal('fhs-details-modal');
      }
    });
  }

  // FHS Modal tab switching
  const breakdownTabBtn = document.getElementById('fhs-tab-breakdown');
  const methodologyTabBtn = document.getElementById('fhs-tab-methodology');
  if (breakdownTabBtn) {
    breakdownTabBtn.addEventListener('click', () => showFhsTab('breakdown'));
  }
  if (methodologyTabBtn) {
    methodologyTabBtn.addEventListener('click', () => showFhsTab('methodology'));
  }
  // FHS explain trigger collapsible toggle
  const fhsExplainTrigger = document.getElementById('fhs-explain-trigger');
  const fhsExplainContent = document.getElementById('fhs-explain-content');
  const fhsExplainChevron = document.getElementById('fhs-explain-chevron');
  if (fhsExplainTrigger && fhsExplainContent) {
    fhsExplainTrigger.addEventListener('click', () => {
      const isHidden = fhsExplainContent.style.display === 'none';
      if (isHidden) {
        fhsExplainContent.style.display = 'block';
        if (fhsExplainChevron) fhsExplainChevron.style.transform = 'rotate(180deg)';
      } else {
        fhsExplainContent.style.display = 'none';
        if (fhsExplainChevron) fhsExplainChevron.style.transform = 'rotate(0deg)';
      }
    });
  }

});

// Helper for FHS Tab switching
function showFhsTab(tabName) {
  const breakdownBtn = document.getElementById('fhs-tab-breakdown');
  const methodologyBtn = document.getElementById('fhs-tab-methodology');
  const breakdownContent = document.getElementById('fhs-content-breakdown');
  const methodologyContent = document.getElementById('fhs-content-methodology');
  
  if (tabName === 'breakdown') {
    if (breakdownBtn) {
      breakdownBtn.style.color = 'var(--text-primary)';
      breakdownBtn.style.borderBottom = '2px solid var(--accent)';
      breakdownBtn.classList.add('active');
    }
    if (methodologyBtn) {
      methodologyBtn.style.color = 'var(--text-secondary)';
      methodologyBtn.style.borderBottom = 'none';
      methodologyBtn.classList.remove('active');
    }
    if (breakdownContent) breakdownContent.style.display = 'block';
    if (methodologyContent) methodologyContent.style.display = 'none';
  } else {
    if (breakdownBtn) {
      breakdownBtn.style.color = 'var(--text-secondary)';
      breakdownBtn.style.borderBottom = 'none';
      breakdownBtn.classList.remove('active');
    }
    if (methodologyBtn) {
      methodologyBtn.style.color = 'var(--text-primary)';
      methodologyBtn.style.borderBottom = '2px solid var(--accent)';
      methodologyBtn.classList.add('active');
    }
    if (breakdownContent) breakdownContent.style.display = 'none';
    if (methodologyContent) methodologyContent.style.display = 'block';
  }
}

// ============================================================
// RECURRING TRANSACTIONS UI CONTROLLERS
// ============================================================
let _customSelectedEndYear = null;

function openRecurringModal() {
  const monthsGrid = document.getElementById('recurring-specific-months-grid');
  if (!monthsGrid) return;

  monthsGrid.innerHTML = '';

  // Generate 1-12 months grid inside the Specific Months container
  const monthNames = state.lang === 'en' ? ENGLISH_MONTHS_SHORT : GREEK_MONTHS_SHORT;
  for (let m = 1; m <= 12; m++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'google-picker-btn';
    btn.textContent = monthNames[m - 1];
    if (_pendingRecurringSettings.months && _pendingRecurringSettings.months.includes(m)) {
      btn.classList.add('active');
    }
    btn.onclick = () => {
      toggleRecurringSpecificMonth(m, btn);
    };
    monthsGrid.appendChild(btn);
  }

  // Populate preset dropdown
  const select = document.getElementById('recurring-simple-preset');
  if (select) {
    select.value = _pendingRecurringSettings.preset || 'monthly';
  }

  // Show or hide Specific Months container
  const monthsContainer = document.getElementById('recurring-specific-months-container');
  if (monthsContainer) {
    if (_pendingRecurringSettings.preset === 'specific_months') {
      monthsContainer.style.display = 'flex';
    } else {
      monthsContainer.style.display = 'none';
    }
  }

  // Set Expiration UI state
  const btnPerpetual = document.getElementById('recurring-end-type-perpetual');
  const btnDate = document.getElementById('recurring-end-type-date');
  const dateContainer = document.getElementById('recurring-custom-end-date-container');
  const hiddenInput = document.getElementById('recurring-end-date');
  const label = document.getElementById('recurring-end-date-label');

  if (!_pendingRecurringSettings.endType || _pendingRecurringSettings.endType === 'perpetual') {
    if (btnPerpetual) btnPerpetual.classList.add('active');
    if (btnDate) btnDate.classList.remove('active');
    if (dateContainer) dateContainer.style.display = 'none';
    if (hiddenInput) hiddenInput.value = '';
    if (label) label.textContent = 'Επιλογή ημερομηνίας...';
  } else {
    if (btnPerpetual) btnPerpetual.classList.remove('active');
    if (btnDate) btnDate.classList.add('active');
    if (dateContainer) dateContainer.style.display = 'flex';
    
    if (_pendingRecurringSettings.endDate) {
      if (hiddenInput) hiddenInput.value = _pendingRecurringSettings.endDate;
      if (label) {
        const parts = _pendingRecurringSettings.endDate.split('-');
        if (parts.length === 3) {
          label.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
    }
  }

  updateRecurringSummary();
  openModal('recurring-picker-modal');
}

function onSimplePresetChange() {
  const select = document.getElementById('recurring-simple-preset');
  if (!select) return;
  const val = select.value;
  _pendingRecurringSettings.preset = val;

  const monthsContainer = document.getElementById('recurring-specific-months-container');
  if (monthsContainer) {
    if (val === 'specific_months') {
      monthsContainer.style.display = 'flex';
      // If specific_months is selected and no months are selected yet, default to current transaction month
      if (!_pendingRecurringSettings.months || _pendingRecurringSettings.months.length === 0) {
        const transDateVal = document.getElementById('trans-date').value;
        const currentMonth = transDateVal ? new Date(transDateVal).getMonth() + 1 : new Date().getMonth() + 1;
        _pendingRecurringSettings.months = [currentMonth];
        openRecurringModal(); // re-render grid
      }
    } else {
      monthsContainer.style.display = 'none';
    }
  }
  updateRecurringSummary();
}

function toggleRecurringSpecificMonth(month, element) {
  if (!_pendingRecurringSettings.months) {
    _pendingRecurringSettings.months = [];
  }
  const idx = _pendingRecurringSettings.months.indexOf(month);
  if (idx > -1) {
    if (_pendingRecurringSettings.months.length > 1) {
      _pendingRecurringSettings.months.splice(idx, 1);
      element.classList.remove('active');
    }
  } else {
    _pendingRecurringSettings.months.push(month);
    element.classList.add('active');
  }
  updateRecurringSummary();
}

function selectRecurringEndType(type) {
  const btnPerpetual = document.getElementById('recurring-end-type-perpetual');
  const btnDate = document.getElementById('recurring-end-type-date');
  const dateContainer = document.getElementById('recurring-custom-end-date-container');
  
  if (type === 'perpetual') {
    if (btnPerpetual) btnPerpetual.classList.add('active');
    if (btnDate) btnDate.classList.remove('active');
    if (dateContainer) dateContainer.style.display = 'none';
    _pendingRecurringSettings.endType = 'perpetual';
    _pendingRecurringSettings.endDate = null;
    _pendingRecurringSettings.endYear = null;
  } else {
    if (btnPerpetual) btnPerpetual.classList.remove('active');
    if (btnDate) btnDate.classList.add('active');
    if (dateContainer) dateContainer.style.display = 'flex';
    _pendingRecurringSettings.endType = 'date';
    
    // Default to end of current year if no end date selected
    if (!_pendingRecurringSettings.endDate) {
      const today = new Date();
      const endOfYear = new Date(today.getFullYear(), 11, 31);
      const yyyy = endOfYear.getFullYear();
      const mm = String(endOfYear.getMonth() + 1).padStart(2, '0');
      const dd = String(endOfYear.getDate()).padStart(2, '0');
      const formatted = `${yyyy}-${mm}-${dd}`;
      
      const hiddenInput = document.getElementById('recurring-end-date');
      if (hiddenInput) hiddenInput.value = formatted;
      
      const label = document.getElementById('recurring-end-date-label');
      if (label) {
        label.textContent = `${dd}/${mm}/${yyyy}`;
      }
      _pendingRecurringSettings.endDate = formatted;
    }
  }
  updateRecurringSummary();
}
window.selectRecurringEndType = selectRecurringEndType;

function updateRecurringSummary() {
  const summaryText = document.getElementById('recurring-summary-text');
  if (!summaryText) return;

  const lang = state.lang || 'el';
  const preset = _pendingRecurringSettings.preset || 'monthly';
  const endType = _pendingRecurringSettings.endType || 'perpetual';
  const endDate = _pendingRecurringSettings.endDate;

  let freqPart = '';
  if (lang === 'el') {
    if (preset === 'daily') freqPart = 'Καθημερινά';
    else if (preset === 'weekly') freqPart = 'Κάθε εβδομάδα';
    else if (preset === 'monthly') freqPart = 'Κάθε μήνα';
    else if (preset === 'yearly') freqPart = 'Κάθε χρόνο';
    else if (preset === 'specific_months') {
      const shortMonths = _pendingRecurringSettings.months || [];
      const monthNames = GREEK_MONTHS_SHORT;
      const selectedNames = shortMonths.sort((a,b) => a-b).map(m => monthNames[m - 1]).join(', ');
      freqPart = selectedNames ? `Στους μήνες (${selectedNames})` : 'Επιλεγμένους μήνες';
    } else {
      freqPart = 'Προσαρμοσμένα';
    }
  } else {
    if (preset === 'daily') freqPart = 'Daily';
    else if (preset === 'weekly') freqPart = 'Weekly';
    else if (preset === 'monthly') freqPart = 'Monthly';
    else if (preset === 'yearly') freqPart = 'Yearly';
    else if (preset === 'specific_months') {
      const shortMonths = _pendingRecurringSettings.months || [];
      const monthNames = ENGLISH_MONTHS_SHORT;
      const selectedNames = shortMonths.sort((a,b) => a-b).map(m => monthNames[m - 1]).join(', ');
      freqPart = selectedNames ? `In months (${selectedNames})` : 'Selected months';
    } else {
      freqPart = 'Custom';
    }
  }

  let endPart = '';
  if (lang === 'el') {
    if (endType === 'perpetual') {
      endPart = 'για πάντα';
    } else if (endDate) {
      const parts = endDate.split('-');
      if (parts.length === 3) {
        endPart = `μέχρι τις ${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        endPart = `μέχρι ${endDate}`;
      }
    } else {
      endPart = 'για πάντα';
    }
  } else {
    if (endType === 'perpetual') {
      endPart = 'forever';
    } else if (endDate) {
      const parts = endDate.split('-');
      if (parts.length === 3) {
        endPart = `until ${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        endPart = `until ${endDate}`;
      }
    } else {
      endPart = 'forever';
    }
  }

  summaryText.textContent = lang === 'el' 
    ? `Θα δημιουργούνται: ${freqPart} ${endPart}` 
    : `Will be created: ${freqPart} ${endPart}`;
}
window.updateRecurringSummary = updateRecurringSummary;

function clearRecurringSettings(shouldCloseModal = true) {
  _pendingRecurringSettings = { days: [], months: [], years: [], preset: 'monthly', endType: 'perpetual', endDate: null, endYear: null };
  
  const select = document.getElementById('recurring-simple-preset');
  if (select) {
    select.value = 'monthly';
  }

  const monthsContainer = document.getElementById('recurring-specific-months-container');
  if (monthsContainer) monthsContainer.style.display = 'none';

  selectRecurringEndType('perpetual');
  resetRepInstButton();

  if (shouldCloseModal) {
    closeModal('recurring-picker-modal');
  }
}

function saveRecurringSettings() {
  const btn = document.getElementById('btn-rep-inst');
  if (btn) {
    const lang = state.lang || 'el';
    const preset = _pendingRecurringSettings.preset || 'monthly';

    let presetLabel = '';
    if (preset === 'daily') presetLabel = lang === 'el' ? 'Ημερήσια' : 'Daily';
    else if (preset === 'weekly') presetLabel = lang === 'el' ? 'Εβδομαδιαία' : 'Weekly';
    else if (preset === 'monthly') presetLabel = lang === 'el' ? 'Μηνιαία' : 'Monthly';
    else if (preset === 'yearly') presetLabel = lang === 'el' ? 'Ετήσια' : 'Yearly';
    else if (preset === 'specific_months') presetLabel = lang === 'el' ? 'Μήνες' : 'Months';
    else presetLabel = lang === 'el' ? 'Custom' : 'Custom';

    btn.style.background = '#f43f5e';
    btn.style.color = '#ffffff';
    btn.style.borderColor = '#f43f5e';
    btn.innerHTML = `<i class="fa-solid fa-arrows-spin"></i> ${lang === 'el' ? 'Ενεργό' : 'Active'} (${presetLabel})`;
  }
  closeModal('recurring-picker-modal');
}

function resetRepInstButton() {
  const btn = document.getElementById('btn-rep-inst');
  if (btn) {
    btn.style.background = 'rgba(244, 63, 94, 0.1)';
    btn.style.color = '#f43f5e';
    btn.style.borderColor = 'rgba(244, 63, 94, 0.3)';
    btn.innerHTML = `<i class="fa-solid fa-arrows-spin"></i> Rep/Inst.`;
  }
}

// Bind to window for HTML access
window.openRecurringModal = openRecurringModal;
window.toggleRecurringSpecificMonth = toggleRecurringSpecificMonth;
window.saveRecurringSettings = saveRecurringSettings;
window.clearRecurringSettings = clearRecurringSettings;
window.resetRepInstButton = resetRepInstButton;
window.onSimplePresetChange = onSimplePresetChange;

// ============================================================
// FEATURE: AI FINANCIAL COACH CHAT LOGIC
// ============================================================

function openAdvisorChat(initialQuery = null) {
  const modalId = 'advisor-chat-modal';
  openModal(modalId);
  
  const chatLog = document.getElementById('advisor-chat-log');
  if (chatLog && chatLog.children.length === 0) {
    const welcome = state.lang === 'el'
      ? "Γεια σου! Είμαι ο προσωπικός σου **Οικονομικός Σύμβουλος AI**. 🤖<br><br>Μπορώ να αναλύσω τις συναλλαγές σου και να σε βοηθήσω να αποταμιεύσεις περισσότερο. Επιλέξτε μία από τις παρακάτω προτάσεις ή ρωτήστε με ό,τι θέλετε!"
      : "Hello! I am your personal **AI Financial Coach**. 🤖<br><br>I can analyze your transactions and help you save more. Select one of the suggestions below or ask me anything!";
    appendChatMessage('advisor', welcome);
  }
  
  setTimeout(() => {
    const inp = document.getElementById('advisor-chat-input');
    if (inp) inp.focus();
  }, 300);
  
  if (initialQuery) {
    setTimeout(() => {
      submitCoachQuery(initialQuery);
    }, 500);
  }
}

function closeAdvisorChat() {
  closeModal('advisor-chat-modal');
}

function appendChatMessage(sender, htmlContent) {
  const chatLog = document.getElementById('advisor-chat-log');
  if (!chatLog) return;
  
  const row = document.createElement('div');
  row.className = `chat-msg-row ${sender}`;
  
  const bubble = document.createElement('div');
  bubble.className = 'chat-msg-bubble';
  bubble.innerHTML = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  row.appendChild(bubble);
  chatLog.appendChild(row);
  
  chatLog.scrollTop = chatLog.scrollHeight;
}

function submitCoachInput() {
  const inp = document.getElementById('advisor-chat-input');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) return;
  inp.value = '';
  submitCoachQuery(val);
}

function handleAdvisorChatKeydown(e) {
  if (e.key === 'Enter') {
    submitCoachInput();
  }
}

function submitCoachQuery(queryText) {
  let userDisplay = queryText;
  if (queryText === 'overspending') {
    userDisplay = state.lang === 'el' ? "Πού ξοδεύω υπερβολικά;" : "Where am I overspending?";
  } else if (queryText === 'savings') {
    userDisplay = state.lang === 'el' ? "Πώς μπορώ να αποταμιεύσω περισσότερο;" : "How can I save more?";
  } else if (queryText === 'forecast_5y') {
    userDisplay = state.lang === 'el' ? "Αν συνεχίσω έτσι, πού θα είμαι σε 5 χρόνια;" : "If I continue like this, where will I be in 5 years?";
  } else if (queryText === 'milestone_50k') {
    userDisplay = state.lang === 'el' ? "Πότε θα φτάσω τα 50.000€;" : "When will I reach €50,000?";
  }
  
  appendChatMessage('user', userDisplay);
  
  const suggestions = document.getElementById('advisor-chat-suggestions-container');
  if (suggestions) suggestions.style.display = 'none';
  
  const chatLog = document.getElementById('advisor-chat-log');
  const typingIndicatorRow = document.createElement('div');
  typingIndicatorRow.className = 'chat-msg-row advisor typing-temp';
  typingIndicatorRow.innerHTML = `
    <div class="chat-msg-bubble">
      <div class="chat-typing-indicator">
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
      </div>
    </div>
  `;
  if (chatLog) {
    chatLog.appendChild(typingIndicatorRow);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  
  setTimeout(() => {
    const temp = document.querySelector('.typing-temp');
    if (temp) temp.remove();
    
    const responseHtml = processCoachQuery(queryText);
    appendChatMessage('advisor', responseHtml);
    
    if (suggestions) suggestions.style.display = 'block';
  }, 650);
}

function getCoachAveragePacing() {
  const trans = state.transactions || [];
  const monthlyData = {};
  
  trans.forEach(t => {
    if (!t.date || t.type === 'transfer') return;
    const datePart = String(t.date).split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const amt = parseFloat(t.amount) || 0;
    
    if (!monthlyData[key]) {
      monthlyData[key] = { income: 0, expense: 0 };
    }
    if (t.type === 'income') monthlyData[key].income += amt;
    if (t.type === 'expense') monthlyData[key].expense += amt;
  });
  
  const keys = Object.keys(monthlyData).sort();
  if (keys.length === 0) {
    return { avgIncome: 0, avgExpense: 0, avgSavings: 0, totalBalance: 0 };
  }
  
  const lastKeys = keys.slice(-3);
  let sumIncome = 0;
  let sumExpense = 0;
  lastKeys.forEach(k => {
    sumIncome += monthlyData[k].income;
    sumExpense += monthlyData[k].expense;
  });
  
  const monthsCount = lastKeys.length;
  const avgIncome = sumIncome / monthsCount;
  const avgExpense = sumExpense / monthsCount;
  const avgSavings = avgIncome - avgExpense;
  
  const totalBalance = (state.accounts || []).reduce((sum, acc) => sum + (parseFloat(acc.balance) || 0), 0);
  
  return { avgIncome, avgExpense, avgSavings, totalBalance };
}

function runCoachOverspendingAnalysis() {
  const today = new Date();
  const currYear = today.getFullYear();
  const currMonth = today.getMonth();
  
  const currMonthExpenses = {};
  const prevExpenses = {};
  const monthsSeen = new Set();
  
  const trans = state.transactions || [];
  trans.forEach(t => {
    if (t.type !== 'expense' || !t.date) return;
    const datePart = String(t.date).split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const amt = parseFloat(t.amount) || 0;
    const cat = t.category || 'Other';
    
    if (y === currYear && m === currMonth) {
      currMonthExpenses[cat] = (currMonthExpenses[cat] || 0) + amt;
    } else {
      const diffMonths = (currYear - y) * 12 + (currMonth - m);
      if (diffMonths > 0 && diffMonths <= 3) {
        monthsSeen.add(`${y}-${m}`);
        if (!prevExpenses[cat]) prevExpenses[cat] = {};
        const monthKey = `${y}-${m}`;
        prevExpenses[cat][monthKey] = (prevExpenses[cat][monthKey] || 0) + amt;
      }
    }
  });
  
  const numPrevMonths = Math.max(1, monthsSeen.size);
  const overspentCats = [];
  
  Object.keys(currMonthExpenses).forEach(cat => {
    const currAmt = currMonthExpenses[cat] || 0;
    let sumPrev = 0;
    if (prevExpenses[cat]) {
      Object.keys(prevExpenses[cat]).forEach(mk => {
        sumPrev += prevExpenses[cat][mk];
      });
    }
    const avgPrev = sumPrev / numPrevMonths;
    const diff = currAmt - avgPrev;
    
    if (diff > 0) {
      const pct = avgPrev > 0 ? Math.round((diff / avgPrev) * 100) : 100;
      overspentCats.push({ cat, currAmt, avgPrev, diff, pct });
    }
  });
  
  overspentCats.sort((a, b) => b.diff - a.diff);
  
  if (overspentCats.length === 0) {
    return state.lang === 'el'
      ? "✅ **Όλα υπό έλεγχο!** Δεν εντοπίστηκε υπέρβαση εξόδων σε καμία κατηγορία αυτόν τον μήνα σε σχέση με τους προηγούμενους. Συνέχισε την εξαιρετική δουλειά! 👏"
      : "✅ **All under control!** No overspending was detected in any category this month compared to previous months. Keep up the great work! 👏";
  }
  
  let html = state.lang === 'el'
    ? "⚠️ **Εντοπίστηκε υπέρβαση εξόδων στις εξής κατηγορίες:**<br><br>"
    : "⚠️ **Overspending detected in the following categories:**<br><br>";
     
  overspentCats.slice(0, 3).forEach(item => {
    const dispCat = getCategoryDisplayName(item.cat);
    const pctStr = item.avgPrev > 0 ? ` (+${item.pct}%)` : ' (νέο έξοδο)';
    html += `• **${dispCat}**: Ξόδεψες **${formatCurrency(item.currAmt)}** αυτόν τον μήνα, ενώ ο προηγούμενος μέσος όρος σου ήταν **${formatCurrency(item.avgPrev)}**.<br>&nbsp;&nbsp;&nbsp;&nbsp;📈 Αύξηση: **+${formatCurrency(item.diff)}**${pctStr}.<br>`;
  });
  
  html += state.lang === 'el'
    ? "<br>💡 *Συμβουλή: Πατήστε στο κουμπί 'Συζήτησέ το' δίπλα από την κατηγορία στην κάρτα του συμβούλου για να δεις ποιες συναλλαγές προκάλεσαν την αύξηση.*"
    : "<br>💡 *Tip: Tap the 'Discuss it' button next to the category in the advisor card to see which transactions caused the increase.*";
     
  return html;
}

function runCoachSavingsAdvice() {
  const today = new Date();
  const currYear = today.getFullYear();
  const currMonth = today.getMonth();
  
  const nonEssentials = ['SUPERMARKET', 'MARKET', 'FOOD', 'ΔΙΑΤΡΟΦΗ', 'ΔΙΑΣΚΕΔΑΣΗ', 'ΕΞΟΔΟΙ', 'ENTERTAINMENT', 'LEISURE', 'SHOPPING', 'CLOTHES', 'ΠΡΟΣΩΠΙΚΗ', 'ΦΡΟΝΤΙΔΑ', 'PERSONAL', 'ΤΕΧΝΟΛΟΓΙΑ', 'TECH', 'GADGET', 'ΣΥΝΔΡΟΜΕΣ', 'SUBSCRIPTION'];
  
  const trans = state.transactions || [];
  const catTotals = {};
  
  trans.forEach(t => {
    if (t.type !== 'expense' || !t.date) return;
    const datePart = String(t.date).split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const amt = parseFloat(t.amount) || 0;
    
    if (y === currYear && m === currMonth) {
      const cat = t.category || 'Other';
      catTotals[cat] = (catTotals[cat] || 0) + amt;
    }
  });
  
  const matches = [];
  Object.keys(catTotals).forEach(cat => {
    const clean = cat.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim().toUpperCase();
    const isNonEssential = nonEssentials.some(keyword => clean.includes(keyword));
    if (isNonEssential && catTotals[cat] > 20) {
      matches.push({ cat, amt: catTotals[cat] });
    }
  });
  
  matches.sort((a, b) => b.amt - a.amt);
  
  if (matches.length === 0) {
    return state.lang === 'el'
      ? "🎯 **Εξαιρετική οικονομία!** Δεν ξοδεύεις υπερβολικά σε προαιρετικά έξοδα αυτόν τον μήνα. Για να αποταμιεύσεις ακόμα περισσότερο, σκέψου να θέσεις έναν αυτόματο στόχο αποταμίευσης στην αρχή του μήνα."
      : "🎯 **Great economy!** You aren't spending excessively on discretionary categories this month. To save even more, consider setting an automatic savings goal at the start of the month.";
  }
  
  let html = state.lang === 'el'
    ? "💡 **Ιδέες για να αυξήσεις την αποταμίευσή σου άμεσα:**<br><br>"
    : "💡 **Ideas to boost your savings immediately:**<br><br>";
     
  matches.slice(0, 2).forEach(item => {
    const dispCat = getCategoryDisplayName(item.cat);
    const save10 = item.amt * 0.1;
    const save20 = item.amt * 0.2;
    
    html += state.lang === 'el'
      ? `• **${dispCat}**: Έχεις ξοδέψει **${formatCurrency(item.amt)}** αυτόν τον μήνα.<br>&nbsp;&nbsp;&nbsp;&nbsp;📉 Μείωση 10%: Κέρδος **+${formatCurrency(save10)}** / μήνα (€${Math.round(save10 * 12)}/έτος).<br>&nbsp;&nbsp;&nbsp;&nbsp;📉 Μείωση 20%: Κέρδος **+${formatCurrency(save20)}** / μήνα (€${Math.round(save20 * 12)}/έτος).<br>`
      : `• **${dispCat}**: You spent **${formatCurrency(item.amt)}** this month.<br>&nbsp;&nbsp;&nbsp;&nbsp;📉 Cut 10%: Saves **+${formatCurrency(save10)}** / month (€${Math.round(save10 * 12)}/year).<br>&nbsp;&nbsp;&nbsp;&nbsp;📉 Cut 20%: Saves **+${formatCurrency(save20)}** / month (€${Math.round(save20 * 12)}/year).<br>`;
  });
  
  html += state.lang === 'el'
    ? "<br>⚡ *Tip: Μπορείς να ορίσεις Budgets για αυτές τις κατηγορίες ώστε να λαμβάνεις ειδοποίηση μόλις πλησιάσεις το όριο!*"
    : "<br>⚡ *Tip: You can set Budgets for these categories to receive alerts when you approach your limit!*";
     
  return html;
}

function runCoachFiveYearForecast() {
  const pacing = getCoachAveragePacing();
  const startBalance = pacing.totalBalance;
  const monthlySavings = pacing.avgSavings;
  
  let html = "";
  if (state.lang === 'el') {
    html += `📈 **Πρόβλεψη Εξέλιξης 5ετίας:**<br><br>`;
    html += `• Τρέχον Υπόλοιπο: **${formatCurrency(startBalance)}**<br>`;
    html += `• Μέση Μηνιαία Αποταμίευση: **${formatCurrency(monthlySavings)}**/μήνα<br><br>`;
    
    if (monthlySavings <= 0) {
      html += `⚠️ **Προσοχή!** Ο μέσος ρυθμός αποταμίευσής σου είναι αρνητικός ή μηδενικός. Αν συνεχίσεις έτσι, η περιουσία σου δεν θα αυξηθεί και ενδέχεται να έχεις απώλειες. Προσπάθησε να μειώσεις τα έξοδά σου.`;
      return html;
    }
    
    for (let year = 1; year <= 5; year++) {
      const projected = startBalance + (year * 12 * monthlySavings);
      html += `• **Έτος ${year}**: ${formatCurrency(projected)} (+${formatCurrency(year * 12 * monthlySavings)})<br>`;
    }
    html += `<br>🔮 *Οι υπολογισμοί βασίζονται στον μέσο ρυθμό αποταμίευσης των τελευταίων 3 μηνών.*`;
  } else {
    html += `📈 **5-Year Financial Projection:**<br><br>`;
    html += `• Current Balance: **${formatCurrency(startBalance)}**<br>`;
    html += `• Average Monthly Savings: **${formatCurrency(monthlySavings)}**/month<br><br>`;
    
    if (monthlySavings <= 0) {
      html += `⚠️ **Warning!** Your average monthly savings rate is negative or zero. If this continues, your net worth will not grow and you might experience losses. Try to reduce your spending.`;
      return html;
    }
    
    for (let year = 1; year <= 5; year++) {
      const projected = startBalance + (year * 12 * monthlySavings);
      html += `• **Year ${year}**: ${formatCurrency(projected)} (+${formatCurrency(year * 12 * monthlySavings)})<br>`;
    }
    html += `<br>🔮 *Projections are based on your average savings rate from the last 3 months.*`;
  }
  
  return html;
}

function runCoachTargetMilestone(targetAmount = 50000) {
  const pacing = getCoachAveragePacing();
  const startBalance = pacing.totalBalance;
  const monthlySavings = pacing.avgSavings;
  
  let html = "";
  if (state.lang === 'el') {
    html += `🎯 **Ανάλυση Στόχου: ${formatCurrency(targetAmount)}**<br><br>`;
    html += `• Τρέχον Υπόλοιπο: **${formatCurrency(startBalance)}**<br>`;
    html += `• Υπολειπόμενο Ποσό: **${formatCurrency(Math.max(0, targetAmount - startBalance))}**<br>`;
    
    if (startBalance >= targetAmount) {
      return `🎉 **Συγχαρητήρια!** Έχεις ήδη επιτύχει αυτόν τον στόχο! Το τρέχον υπόλοιπό σου είναι **${formatCurrency(startBalance)}**.`;
    }
    
    if (monthlySavings <= 0) {
      return `⚠️ **Αδύνατη Πρόβλεψη**: Με τον τρέχοντα μέσο ρυθμό αποταμίευσής σου (**${formatCurrency(monthlySavings)}**/μήνα), δεν είναι δυνατή η επίτευξη του στόχου. Χρειάζεται να αυξήσεις τη μηνιαία αποταμίευσή σου για να ξεκινήσει η πρόοδος.`;
    }
    
    const months = Math.ceil((targetAmount - startBalance) / monthlySavings);
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + months);
    const dateStr = targetDate.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' });
    
    html += `• Εκτιμώμενος Χρόνος: **${months} μήνες**<br>`;
    html += `• Ημερομηνία Επίτευξης: **${dateStr}**<br><br>`;
    html += `💡 *Συμβουλή: Αν αυξήσεις την αποταμίευσή σου κατά **€100/μήνα**, θα φτάσεις τον στόχο **${Math.max(1, Math.round(months - ((targetAmount - startBalance) / (monthlySavings + 100))))} μήνες νωρίτερα**!*`;
  } else {
    html += `🎯 **Target Analysis: ${formatCurrency(targetAmount)}**<br><br>`;
    html += `• Current Balance: **${formatCurrency(startBalance)}**<br>`;
    html += `• Remaining Amount: **${formatCurrency(Math.max(0, targetAmount - startBalance))}**<br>`;
    
    if (startBalance >= targetAmount) {
      return `🎉 **Congratulations!** You have already reached this target! Your current balance is **${formatCurrency(startBalance)}**.`;
    }
    
    if (monthlySavings <= 0) {
      return `⚠️ **Projection Impossible**: With your current average monthly savings rate (**${formatCurrency(monthlySavings)}**/month), you cannot reach this target. You need to increase your savings rate to make progress.`;
    }
    
    const months = Math.ceil((targetAmount - startBalance) / monthlySavings);
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + months);
    const dateStr = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    html += `• Estimated Time: **${months} months**<br>`;
    html += `• Milestone Date: **${dateStr}**<br><br>`;
    html += `💡 *Tip: If you increase your savings by **€100/month**, you will reach your goal **${Math.max(1, Math.round(months - ((targetAmount - startBalance) / (monthlySavings + 100))))} months faster**!*`;
  }
  
  return html;
}

function runCoachCategoryAnalysis(categoryName) {
  const today = new Date();
  const currYear = today.getFullYear();
  const currMonth = today.getMonth();
  
  const trans = state.transactions || [];
  const currMonthTrans = trans.filter(t => {
    if (t.type !== 'expense' || !t.date) return false;
    const datePart = String(t.date).split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    
    const cleanT = t.category.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim().toLowerCase();
    const cleanQuery = categoryName.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim().toLowerCase();
    
    return y === currYear && m === currMonth && (cleanT.includes(cleanQuery) || cleanQuery.includes(cleanT));
  });
  
  if (currMonthTrans.length === 0) {
    return state.lang === 'el'
      ? `Δεν βρήκα έξοδα στην κατηγορία **${categoryName}** για αυτόν τον μήνα.`
      : `No expenses found in the **${categoryName}** category for this month.`;
  }
  
  const totalAmt = currMonthTrans.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const top3 = currMonthTrans.sort((a,b) => (parseFloat(b.amount)||0) - (parseFloat(a.amount)||0)).slice(0, 3);
  
  let html = "";
  if (state.lang === 'el') {
    html += `📋 **Ανάλυση Εξόδων κατηγορίας: ${categoryName}**<br><br>`;
    html += `• Συνολικά έξοδα μήνα: **${formatCurrency(totalAmt)}**<br>`;
    html += `• Πλήθος συναλλαγών: **${currMonthTrans.length}**<br><br>`;
    html += `🔍 **Οι 3 μεγαλύτερες συναλλαγές:**<br>`;
    
    top3.forEach((t, idx) => {
      const dateObj = new Date(t.date);
      const formattedDate = dateObj.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit' });
      const translatedSub = getSubcategoryDisplayName(t.subcategory, t.category);
      const translatedCat = getCategoryDisplayName(t.category);
      const displayTitle = (t.note && t.note.trim()) ? t.note.trim()
                         : (t.description && t.description.trim()) ? t.description.trim()
                         : (translatedSub && translatedSub.trim()) ? translatedSub.trim()
                         : (translatedCat || '');
                         
      html += `${idx+1}. **${formattedDate}**: ${displayTitle} — **${formatCurrency(t.amount)}**<br>`;
    });
  } else {
    html += `📋 **Expense Analysis for: ${categoryName}**<br><br>`;
    html += `• Total monthly expenses: **${formatCurrency(totalAmt)}**<br>`;
    html += `• Total transactions count: **${currMonthTrans.length}**<br><br>`;
    html += `🔍 **Top 3 largest transactions:**<br>`;
    
    top3.forEach((t, idx) => {
      const dateObj = new Date(t.date);
      const formattedDate = dateObj.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' });
      const translatedSub = getSubcategoryDisplayName(t.subcategory, t.category);
      const translatedCat = getCategoryDisplayName(t.category);
      const displayTitle = (t.note && t.note.trim()) ? t.note.trim()
                         : (t.description && t.description.trim()) ? t.description.trim()
                         : (translatedSub && translatedSub.trim()) ? translatedSub.trim()
                         : (translatedCat || '');
                         
      html += `${idx+1}. **${formattedDate}**: ${displayTitle} — **${formatCurrency(t.amount)}**<br>`;
    });
  }
  
  return html;
}

function normalizeGreekString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Removes accents
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿€]/g, "") // Removes punctuation
    .trim();
}

function predictCategoryFromHistory(noteText) {
  const cleanNote = normalizeGreekString(noteText);
  if (!cleanNote) return null;
  
  const trans = state.transactions || [];
  const categoryCounts = {};
  
  trans.forEach(t => {
    if (t.type !== 'expense') return;
    const cNote = normalizeGreekString(t.note || '');
    const cDesc = normalizeGreekString(t.description || '');
    if ((cNote && cleanNote.includes(cNote)) || (cDesc && cleanNote.includes(cDesc)) || (cNote && cNote.includes(cleanNote)) || (cDesc && cDesc.includes(cleanNote))) {
      if ((cNote && cNote.length > 2) || (cDesc && cDesc.length > 2) || cleanNote.length > 2) {
         categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
      }
    }
  });
  
  const sorted = Object.keys(categoryCounts).sort((a,b) => categoryCounts[b] - categoryCounts[a]);
  return sorted.length > 0 ? sorted[0] : null;
}

function runCoachTransactionEntry(amount, noteText) {
  if (isNaN(amount) || amount <= 0) {
    return state.lang === 'el' ? "🤖 Παρακαλώ δώσε ένα έγκυρο ποσό (π.χ. 'βάλε 40 για ρεύμα')." : "🤖 Please provide a valid amount (e.g., 'add 40 for electric bill').";
  }
  
  let predictedCat = predictCategoryFromHistory(noteText);
  
  if (!predictedCat) {
    const cleanNote = normalizeGreekString(noteText);
    if (cleanNote.includes('βενζινη') || cleanNote.includes('αμαξι') || cleanNote.includes('διοδια') || cleanNote.includes('παρκινγκ')) predictedCat = '🚗 ΑΥΤΟΚΙΝΗΤΟ';
    else if (cleanNote.includes('σουπερ') || cleanNote.includes('super') || cleanNote.includes('καφε') || cleanNote.includes('φαγητο') || cleanNote.includes('delivery') || cleanNote.includes('ντελιβερι') || cleanNote.includes('εστιατοριο') || cleanNote.includes('ταβερνα')) predictedCat = '🛒 ΔΙΑΤΡΟΦΗ';
    else if (cleanNote.includes('ρευμα') || cleanNote.includes('δεη') || cleanNote.includes('νερο') || cleanNote.includes('τηλεφωνο') || cleanNote.includes('κοινοχρηστα') || cleanNote.includes('ενοικιο')) predictedCat = '🏡 ΣΠΙΤΙ';
    else if (cleanNote.includes('γιατρο') || cleanNote.includes('φαρμακειο') || cleanNote.includes('υγεία') || cleanNote.includes('εξετασεις')) predictedCat = '❤️ ΥΓΕΙΑ';
    else if (cleanNote.includes('ποτο') || cleanNote.includes('μπυρες') || cleanNote.includes('σινεμα') || cleanNote.includes('εξοδος')) predictedCat = '🎉ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ';
    else if (cleanNote.includes('κομμωτηριο') || cleanNote.includes('κουρειο') || cleanNote.includes('νυχια')) predictedCat = '👕 ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ';
    else if (cleanNote.includes('γυμναστηριο')) predictedCat = '🏋️ΓΥΜΝΑΣΤΗΡΙΟ';
  }
  
  const expenseCats = (state.categories || []).filter(c => c.type === 'expense');
  if (expenseCats.length === 0) expenseCats.push({ name: '🧩ΔΙΑΦΟΡΑ ΕΞΟΔΑ' });
  
  if (predictedCat && !expenseCats.some(c => c.name === predictedCat)) {
    predictedCat = null;
  }
  
  if (!predictedCat) {
    predictedCat = expenseCats[0].name;
  }
  
  const selectId = 'coach-tx-select-' + Date.now();
  const btnId = 'coach-tx-btn-' + Date.now();
  
  let optionsHtml = '';
  expenseCats.forEach(c => {
    const selected = c.name === predictedCat ? 'selected' : '';
    optionsHtml += `<option value="${c.name}" ${selected}>${getCategoryDisplayName(c.name)}</option>`;
  });
  
  let html = "";
  const displayNote = noteText ? ` "${noteText}"` : '';
  if (state.lang === 'el') {
    html += `🤖 **Νέα Συναλλαγή:**<br><br>`;
    html += `Θέλεις να προσθέσω **-${formatCurrency(amount)}**${displayNote};<br><br>`;
    html += `<select id="${selectId}" style="width:100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); margin-bottom: 12px; font-family: inherit; font-size: 1rem;">
               ${optionsHtml}
             </select>`;
    html += `<button id="${btnId}" class="btn btn-primary" style="width:100%;" onclick="window.submitCoachTransaction(${amount}, 'expense', document.getElementById('${selectId}').value, '${noteText}', this.id)">
               ✅ Καταχώρηση
             </button>`;
  } else {
    html += `🤖 **New Transaction:**<br><br>`;
    html += `Do you want to add **-${formatCurrency(amount)}**${displayNote}?<br><br>`;
    html += `<select id="${selectId}" style="width:100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); margin-bottom: 12px; font-family: inherit; font-size: 1rem;">
               ${optionsHtml}
             </select>`;
    html += `<button id="${btnId}" class="btn btn-primary" style="width:100%;" onclick="window.submitCoachTransaction(${amount}, 'expense', document.getElementById('${selectId}').value, '${noteText}', this.id)">
               ✅ Save Transaction
             </button>`;
  }
  return html;
}

function runCoachTopCategories() {
  const today = new Date();
  const currYear = today.getFullYear();
  const currMonth = today.getMonth();
  const trans = state.transactions || [];
  const totals = {};
  
  trans.forEach(t => {
    if (t.type !== 'expense' || !t.date) return;
    const parts = String(t.date).split('T')[0].split(' ')[0].split('-');
    if (parts.length !== 3) return;
    if (parseInt(parts[0], 10) === currYear && (parseInt(parts[1], 10) - 1) === currMonth) {
      totals[t.category] = (totals[t.category] || 0) + (parseFloat(t.amount) || 0);
    }
  });
  
  const sorted = Object.keys(totals).map(cat => ({ cat, amt: totals[cat] })).sort((a,b) => b.amt - a.amt);
  if (sorted.length === 0) {
    return state.lang === 'el' ? "📊 Δεν βρέθηκαν έξοδα για αυτόν τον μήνα." : "📊 No expenses found for this month.";
  }
  
  let html = state.lang === 'el' ? "📊 **Οι κατηγορίες με τα περισσότερα έξοδα αυτόν τον μήνα:**<br><br>" : "📊 **Your top spending categories this month:**<br><br>";
  sorted.slice(0, 3).forEach((item, idx) => {
    html += `${idx+1}. **${getCategoryDisplayName(item.cat)}**: **${formatCurrency(item.amt)}**<br>`;
  });
  return html;
}

function runCoachWhatIfSimulation(amount, itemName = null) {
  const pacing = getCoachAveragePacing();
  const startBalance = pacing.totalBalance;
  const monthlySavings = pacing.avgSavings;
  
  if (isNaN(amount) || amount <= 0) {
    return state.lang === 'el' ? "Παρακαλώ δώσε ένα έγκυρο ποσό για την προσομοίωση." : "Please provide a valid amount for the simulation.";
  }
  
  const nameStr = itemName ? `**${itemName}**` : (state.lang === 'el' ? "αυτή την αγορά" : "this purchase");
  const remainingBalance = startBalance - amount;
  
  let html = "";
  if (state.lang === 'el') {
    html += `🔮 **Προσομοίωση Αγοράς (What-If): ${formatCurrency(amount)}**<br><br>`;
    html += `Αν προχωρήσεις στην αγορά για ${nameStr} αξίας **${formatCurrency(amount)}**:<br><br>`;
    html += `• Το τρέχον υπόλοιπό σου θα μειωθεί από **${formatCurrency(startBalance)}** σε **${formatCurrency(remainingBalance)}**.<br>`;
    
    if (remainingBalance < 0) {
      html += `🔴 **Προσοχή!** Το υπόλοιπό σου θα γίνει αρνητικό (**${formatCurrency(remainingBalance)}**). Αυτή η αγορά ξεπερνά τις οικονομικές σου δυνατότητες αυτή τη στιγμή.<br>`;
    } else {
      html += `🟢 Διατηρείς θετικό υπόλοιπο ασφαλείας (**${formatCurrency(remainingBalance)}**).<br>`;
    }
    
    if (monthlySavings > 0) {
      const monthsDelay = Math.ceil(amount / monthlySavings);
      html += `• Θα χρειαστείς **${monthsDelay} μήνες** αποταμίευσης για να αναπληρώσεις αυτό το ποσό.<br>`;
      
      const targetAmount = 50000;
      if (startBalance < targetAmount) {
        const originalMonths = Math.ceil((targetAmount - startBalance) / monthlySavings);
        const newMonths = Math.ceil((targetAmount - remainingBalance) / monthlySavings);
        html += `• Η επίτευξη του στόχου των ${formatCurrency(targetAmount)} θα καθυστερήσει κατά **${newMonths - originalMonths} μήνες**.<br>`;
      }
    }
  } else {
    html += `🔮 **What-If Purchase Simulation: ${formatCurrency(amount)}**<br><br>`;
    html += `If you purchase ${nameStr} for **${formatCurrency(amount)}**:<br><br>`;
    html += `• Your balance will decrease from **${formatCurrency(startBalance)}** to **${formatCurrency(remainingBalance)}**.<br>`;
    
    if (remainingBalance < 0) {
      html += `🔴 **Warning!** Your balance will drop to negative (**${formatCurrency(remainingBalance)}**). This purchase is beyond your current financial limit.<br>`;
    } else {
      html += `🟢 You maintain a positive buffer of **${formatCurrency(remainingBalance)}**.<br>`;
    }
    
    if (monthlySavings > 0) {
      const monthsDelay = Math.ceil(amount / monthlySavings);
      html += `• It will take you **${monthsDelay} months** of savings to recover this amount.<br>`;
      
      const targetAmount = 50000;
      if (startBalance < targetAmount) {
        const originalMonths = Math.ceil((targetAmount - startBalance) / monthlySavings);
        const newMonths = Math.ceil((targetAmount - remainingBalance) / monthlySavings);
        html += `• Reaching your ${formatCurrency(targetAmount)} goal will be delayed by **${newMonths - originalMonths} months**.<br>`;
      }
    }
  }
  return html;
}

function runCoachSearchQuery(keyword) {
  const cleanKeyword = normalizeGreekString(keyword);
  const trans = state.transactions || [];
  const today = new Date();
  const currentYear = today.getFullYear();
  
  const matchedTrans = trans.filter(t => {
    if (!t.date || t.type === 'transfer') return false;
    
    const datePart = String(t.date).split('T')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    if (y !== currentYear) return false;
    
    const cleanCat = normalizeGreekString(t.category);
    const cleanSub = normalizeGreekString(t.subcategory || '');
    const cleanNote = normalizeGreekString(t.note || '');
    const cleanDesc = normalizeGreekString(t.description || '');
    
    return cleanCat.includes(cleanKeyword) || 
           cleanSub.includes(cleanKeyword) || 
           cleanNote.includes(cleanKeyword) || 
           cleanDesc.includes(cleanKeyword);
  });
  
  if (matchedTrans.length === 0) {
    return state.lang === 'el'
      ? `Δεν βρήκα καμία συναλλαγή φέτος με τον όρο **"${keyword}"**.`
      : `No transactions found this year with the term **"${keyword}"**.`;
  }
  
  const totalAmt = matchedTrans.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const count = matchedTrans.length;
  const avg = totalAmt / count;
  
  let html = "";
  if (state.lang === 'el') {
    html += `🔍 **Αποτελέσματα Αναζήτησης για: "${keyword}"**<br><br>`;
    html += `• Βρέθηκαν **${count} συναλλαγές** φέτος.<br>`;
    html += `• Συνολικό ποσό: **${formatCurrency(totalAmt)}**<br>`;
    html += `• Μέσος όρος ανά συναλλαγή: **${formatCurrency(avg)}**<br><br>`;
    html += `💡 *Συμβουλή: Προσπαθήστε να κρατάτε σημειώσεις (notes) σε κάθε συναλλαγή για να μπορείτε να τις αναζητάτε ακόμα πιο εύκολα!*`;
  } else {
    html += `🔍 **Search Results for: "${keyword}"**<br><br>`;
    html += `• Found **${count} transactions** this year.<br>`;
    html += `• Total amount: **${formatCurrency(totalAmt)}**<br>`;
    html += `• Average per transaction: **${formatCurrency(avg)}**<br><br>`;
    html += `💡 *Tip: Try adding notes to your transactions to search for specific items even easier!*`;
  }
  return html;
}

function processCoachQuery(queryText) {
  const normQuery = normalizeGreekString(queryText);
  const cleanQuery = queryText.toLowerCase().trim();
  
  if (cleanQuery === 'overspending') {
    return runCoachOverspendingAnalysis();
  }
  if (cleanQuery === 'savings') {
    return runCoachSavingsAdvice();
  }
  if (cleanQuery === 'forecast_5y') {
    return runCoachFiveYearForecast();
  }
  if (cleanQuery.startsWith('milestone_')) {
    const amt = parseInt(cleanQuery.replace('milestone_', ''), 10) || 50000;
    return runCoachTargetMilestone(amt);
  }
  
  // 0. Action commands (add transaction)
  const isAddCommand = normQuery.includes('βαλε') || normQuery.includes('προσθεσε') || normQuery.includes('καταχωρησε') || normQuery.includes('χρεωσε') || normQuery.includes('ξοδεψα') || normQuery.includes('εδωσα') || normQuery.includes('πληρωσα') || normQuery.includes('add') || normQuery.includes('spent');
  const numMatchAction = cleanQuery.replace(/\./g, '').match(/\d+/);
  if (isAddCommand && numMatchAction) {
    const amount = parseInt(numMatchAction[0], 10);
    let noteText = queryText.replace(/\d+/g, '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿€]/g, '').trim();
    const stopWords = ['βαλε', 'προσθεσε', 'καταχωρησε', 'χρεωσε', 'ξοδεψα', 'εδωσα', 'πληρωσα', 'ευρω', 'ευρω', 'euro', 'σε', 'στο', 'στην', 'στα', 'στον', 'για', 'απο', 'ενα', 'μια', 'add', 'spent', 'paid', 'for', 'on', 'euros'];
    const words = noteText.split(/\s+/).filter(w => w.length > 1 && !stopWords.includes(normalizeGreekString(w)));
    const cleanNote = words.join(' ') || '';
    
    // Distinguish between sum search "ποσα ξοδεψα" and action "ξοδεψα 40"
    if (!normQuery.includes('ποσα') && !normQuery.includes('ποσο') && !normQuery.includes('how much') && !normQuery.includes('τι ')) {
      return runCoachTransactionEntry(amount, cleanNote);
    }
  }
  
  // 1. Discuss Category Increase
  if (normQuery.includes('γιατι αυξηθηκαν') || normQuery.includes('why did my') || normQuery.includes('αυξηθηκαν') || normQuery.includes('did my') || normQuery.includes('αυξηση')) {
    let catName = "";
    const grMatch = queryText.match(/οι\s+([α-ωΑ-Ωa-zA-Z\s]+?)\s+μου/i);
    const enMatch = queryText.match(/my\s+([a-zA-Z\s]+?)\s+rose/i) || queryText.match(/did\s+([a-zA-Z\s]+?)\s+increase/i);
    
    if (grMatch && grMatch[1]) catName = grMatch[1].trim();
    else if (enMatch && enMatch[1]) catName = enMatch[1].trim();
    else {
      const words = normQuery.split(/\s+/);
      const stopWords = ['γιατι', 'αυξηθηκαν', 'οι', 'μου', 'αυτον', 'τον', 'μηνα', 'why', 'did', 'my', 'increase', 'this', 'month', 'expense', 'expenses', 'αυξηση', 'εξοδα', 'εξοδων'];
      const possibleCats = words.filter(w => w.length > 2 && !stopWords.includes(w));
      if (possibleCats.length > 0) catName = possibleCats[0];
    }
    
    if (catName) {
      return runCoachCategoryAnalysis(catName);
    }
  }
  
  // 2. What-If Simulator
  const numMatch = cleanQuery.replace(/\./g, '').match(/\d+/);
  const isSimulation = normQuery.includes('αγορασ') || normQuery.includes('αγορα') || normQuery.includes('παρω') || normQuery.includes('buy') || normQuery.includes('purchase');
  if (isSimulation && numMatch) {
    const amount = parseInt(numMatch[0], 10);
    let itemName = queryText.replace(/\d+/g, '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿€]/g, '').trim();
    const stopWords = ['αν', 'να', 'αγορασω', 'αγοράσω', 'παρω', 'πάρω', 'αγορα', 'αγορά', 'για', 'ευρω', 'ευρώ', 'euro', 'buy', 'purchase', 'a', 'an', 'the', 'what', 'if', 'i'];
    const words = itemName.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(normalizeGreekString(w)));
    const cleanItemName = words.join(' ') || null;
    return runCoachWhatIfSimulation(amount, cleanItemName);
  }
  
  // 3. Milestone Target
  if (normQuery.includes('φτασω') || normQuery.includes('reach') || normQuery.includes('αποκτησω') || normQuery.includes('στοχο') || normQuery.includes('target') || normQuery.includes('μαζεψω') || normQuery.includes('εχω')) {
    if (numMatch) {
      const amt = parseInt(numMatch[0], 10);
      return runCoachTargetMilestone(amt);
    }
  }
  
  // 4. Budgets Status
  if (normQuery.includes('προϋπολογισμ') || normQuery.includes('προϋπολογισμο') || normQuery.includes('προϋπολογισμοι') || normQuery.includes('προϋπολογισμους') || normQuery.includes('proypologism') || normQuery.includes('budget') || normQuery.includes('οριο') || normQuery.includes('ορια')) {
    const budgets = state.budgets || {};
    const activeExpenses = state.transactions.filter(t => {
      const datePart = String(t.date || '').split('T')[0];
      const parts = datePart.split('-');
      if (parts.length !== 3) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const today = new Date();
      return t.type === 'expense' && y === today.getFullYear() && m === today.getMonth();
    });
    
    const expenseTotals = {};
    activeExpenses.forEach(t => {
      expenseTotals[t.category] = (expenseTotals[t.category] || 0) + (parseFloat(t.amount) || 0);
    });
    
    let html = state.lang === 'el' ? "📊 **Κατάσταση Προϋπολογισμών (Budgets):**<br><br>" : "📊 **Budget Status:**<br><br>";
    let hasBudgets = false;
    
    Object.keys(budgets).forEach(cat => {
      const limit = parseFloat(budgets[cat]) || 0;
      if (limit > 0) {
        hasBudgets = true;
        const spent = expenseTotals[cat] || 0;
        const pct = Math.round((spent / limit) * 100);
        const dispCat = getCategoryDisplayName(cat);
        const indicator = pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢';
        html += `${indicator} **${dispCat}**: ${formatCurrency(spent)} / ${formatCurrency(limit)} (**${pct}%**)<br>`;
      }
    });
    
    if (!hasBudgets) {
      return state.lang === 'el'
        ? "📊 Δεν έχεις ορίσει προϋπολογισμούς ακόμα. Μπορείς να ορίσεις Budgets πηγαίνοντας στα **Περισσότερα -> Όρια Κατηγοριών**."
        : "📊 You haven't set any budgets yet. You can set them in **More -> Category Limits**.";
    }
    return html;
  }
  
  // 5. Top categories breakdown
  if (normQuery.includes('που ξοδευω τα περισσοτερα') || normQuery.includes('που ξοδευω τα') || normQuery.includes('που πανε τα λεφτα') || normQuery.includes('μεγαλυτερα εξοδα') || normQuery.includes('where do i spend') || normQuery.includes('top spending')) {
    return runCoachTopCategories();
  }
  
  // 6. Conversational Sum Search (e.g. "πόσα ξόδεψα σε καφέ", "πόσα λεφτά έχω χαλάσει στο κομμωτήριο φέτος")
  const isSpendingQuery = normQuery.includes('ποσα') || normQuery.includes('ποσο') || normQuery.includes('how much') || normQuery.includes('how many') || normQuery.includes('spent') || normQuery.includes('xodepsa') || normQuery.includes('xodepsame') || normQuery.includes('xalasa') || normQuery.includes('xalasame');
  if (isSpendingQuery) {
    let keyword = "";
    const grMatch = queryText.match(/(?:σε|για|στο|στη|στην|στα|στον|στους|στις)\s+([α-ωΑ-Ωa-zA-Z\s]+)/i);
    const enMatch = queryText.match(/(?:on|for|at|in)\s+([a-zA-Z\s]+)/i);
    
    if (grMatch && grMatch[1]) {
      keyword = grMatch[1].trim();
    } else if (enMatch && enMatch[1]) {
      keyword = enMatch[1].trim();
    } else {
      const stopWords = [
        'ποσα', 'ποσο', 'ποσα λεφτα', 'ποσο λεφτα', 'λεφτα', 'χρηματα', 'εχω', 'εχουμε', 'χαλασει', 'χαλασα', 
        'χαλασαμε', 'ξοδεψει', 'ξοδεψα', 'ξοδεψαμε', 'εδωσα', 'εδωσαμε', 'δωσει', 'πληρωσα', 'πληρωσαμε', 
        'πληρωσει', 'φετος', 'μηνα', 'ετος', 'σημερα', 'χθες', 'how', 'much', 'did', 'i', 'spend', 'spent', 
        'on', 'for', 'this', 'year', 'month', 'today', 'yesterday'
      ];
      const words = normQuery.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
      if (words.length > 0) {
        keyword = words[0];
      }
    }
    
    if (keyword) {
      keyword = keyword.replace(/(?:φετος|φέτος|αυτον|τον|μηνα|μήνα|αυτο|το|ετος|έτος|this year|this month|year|month)/gi, '').trim();
      if (keyword) {
        return runCoachSearchQuery(keyword);
      }
    }
  }
  
  // 7. General search fallback
  const cleanKeyword = cleanQuery.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim();
  if (cleanKeyword.length >= 2) {
    return runCoachSearchQuery(cleanKeyword);
  }
  
  return state.lang === 'el'
    ? `🤖 **Δεν μπόρεσα να κατανοήσω πλήρως την ερώτηση.**<br><br>Μπορείς να δοκιμάσεις κάποια από τις έτοιμες προτάσεις από κάτω, ή να ρωτήσεις για μια συγκεκριμένη κατηγορία/λέξη (π.χ. «καφέ», «φαγητό», «βενζίνη», «υπερβολικά», «αποταμίευση»).`
    : `🤖 **I couldn't quite understand the question.**<br><br>You can try using one of the suggestion chips below, or ask about a specific category or search term (e.g., 'coffee', 'food', 'petrol', 'overspending', 'savings').`;
}

window.submitCoachTransaction = async function(amount, type, category, note, btnId) {
  const transaction = {
    id: generateUUID(),
    type: type,
    amount: parseFloat(amount),
    category: category,
    subcategory: '',
    note: note,
    date: new Date().toISOString(),
    user_id: state.userId
  };
  
  await saveTransaction(transaction);
  
  const btn = document.getElementById(btnId);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = state.lang === 'el' ? '✅ Καταχωρήθηκε!' : '✅ Saved!';
    btn.style.backgroundColor = 'var(--success)';
  }
};

// Bind to window for HTML access
window.openAdvisorChat = openAdvisorChat;
window.closeAdvisorChat = closeAdvisorChat;
window.submitCoachInput = submitCoachInput;
window.submitCoachQuery = submitCoachQuery;
window.handleAdvisorChatKeydown = handleAdvisorChatKeydown;

// Force snap scroll position to top on page load to fix iOS Safari viewport panning offset
window.addEventListener('load', () => {
  setTimeout(() => {
    forceViewportReset();
  }, 300);
  setTimeout(() => {
    forceViewportReset();
  }, 800);
});
