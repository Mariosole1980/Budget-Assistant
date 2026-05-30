// Global error boundary to capture and display initialization or runtime errors
window.onerror = function (message, source, lineno, colno, error) {
  console.error("Global Error Boundary Caught:", message, "at", source, ":", lineno, ":", colno, error);
  alert("❌ " + (state.lang === 'en' ? 'Application Error' : 'Σφάλμα Εφαρμογής') + ":\n" + message + "\n" + (state.lang === 'en' ? 'Line' : 'Γραμμή') + ": " + lineno + ", " + (state.lang === 'en' ? 'Column' : 'Στήλη') + ": " + colno);
};

window.addEventListener('unhandledrejection', function (event) {
  console.error("Unhandled Rejection:", event.reason);
  alert("⚠️ Unhandled Promise Rejection:\n" + (event.reason?.message || event.reason));
});

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
  selectedYear: new Date().getFullYear(),
  selectedMonth: new Date().getMonth(),
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
};

function ensureHistoryPushed() {
  if (!state.historyPushed) {
    history.pushState({ appState: 'active' }, '', window.location.pathname + window.location.search);
    state.historyPushed = true;
  }
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
    nav_accounts: 'Ιστορικό',
    nav_more: 'Περισσότερα',
    section_data_mgmt: 'Διαχείριση Δεδομένων',
    section_settings: 'Ρυθμίσεις',
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
    accounts_header_title: 'Εισόδημα',
    overall_history_title: 'Ιστορικό',
    overall_history_period_label: 'Περίοδος:',
    cards_header_title: 'Έξοδα',
    row_date: 'Ημερομηνία',
    row_amount: 'Ποσό',
    row_category: 'Κατηγορία',
    row_subcategory: 'Υποκατηγορία',
    row_account_from: 'Λογαριασμός',
    row_account_to: 'Προς',
    row_note: 'Σημείωση',
    btn_save: 'Αποθήκευση',
    btn_continue: 'Συνέχεια',
    keypad_title: 'Ποσό',
    keypad_btn_done: 'Τέλος',
    placeholder_subcategory: 'Πατήστε για επιλογή ή πληκτρολόγηση',
    placeholder_note: 'Πατήστε για σημείωση',
    placeholder_description: 'Περιγραφή',
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
    label_account: 'Λογαριασμός',
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
    app_version: 'Έκδοση 1.0.0',
    fab_add_transaction: 'Προσθήκη Συναλλαγής',
    yearly_savings_title: 'Ετήσια Αποταμίευση',
    period_label: 'Περίοδος',
    sync_now_btn: 'Συγχρονισμός Τώρα'
  },
  en: {
    nav_trans: 'Transactions',
    nav_stats: 'Stats',
    nav_accounts: 'History',
    nav_more: 'More',
    section_data_mgmt: 'Data Management',
    section_settings: 'Settings',
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
    accounts_header_title: 'Income',
    overall_history_title: 'Overall History',
    overall_history_period_label: 'Period:',
    cards_header_title: 'Expenses',
    row_date: 'Date',
    row_amount: 'Amount',
    row_category: 'Category',
    row_subcategory: 'Subcategory',
    row_account_from: 'Account',
    row_account_to: 'To',
    row_note: 'Note',
    btn_save: 'Save',
    btn_continue: 'Continue',
    keypad_title: 'Amount',
    keypad_btn_done: 'Done',
    placeholder_subcategory: 'Tap to select or type',
    placeholder_note: 'Tap for note',
    placeholder_description: 'Description',
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
    label_account: 'Account',
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
    app_version: 'Version 1.0.0',
    fab_add_transaction: 'Add Transaction',
    yearly_savings_title: 'Yearly Savings',
    period_label: 'Period',
    sync_now_btn: 'Sync Now'
  }
};

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
  loadConfig();
  initSettingsFromStorage();
  initSupabase();
  setupEventListeners();
  initPullToRefresh();
  initSwipeToBack();
  initSwipeMonthNavigation();
  initRippleEffects();
  
  // ALWAYS load cached local data immediately so the UI is never blank on refresh.
  // If Supabase is enabled, onAuthStateChange will call loadData() again with fresh cloud data.
  loadOfflineData();
  updateUI();
  updateHeaderProfileBadge();
  
  // If Supabase client is NOT initialized, we are in pure local mode — done.
  // If it IS initialized, onAuthStateChange (in initSupabaseAuth) will fire and
  // call loadData() which fetches fresh data from cloud and overwrites the cache.
  
  // App Lock Visibility Check: Locks app when closed/minimized and reopened
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const appLockEnabled = localStorage.getItem('app_lock_enabled') === 'true';
      const lockScreen = document.getElementById('lock-screen');
      if (appLockEnabled && lockScreen && !lockScreen.classList.contains('active')) {
        showLockScreen();
      }
    }
  });
  
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('trans-date').value = today;
  applyLanguage(state.lang);
});

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
            flowType: 'pkce',
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
      logDiv.style.display = 'block';
      const time = new Date().toLocaleTimeString();
      logDiv.innerHTML += `<div>[${time}] ${msg}</div>`;
      logDiv.scrollTop = logDiv.scrollHeight;
    }
  }

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
  
  if (isAuthRedirect) {
    if (authOverlay) authOverlay.style.display = 'flex';
    if (loadingState) loadingState.style.display = 'block';
    if (formsContainer) formsContainer.style.display = 'none';
    
    // Safety timeout to prevent getting stuck
    setTimeout(() => {
      if (processingRedirect && !state.currentUser && !state.guestMode) {
        logAuthDebug('TIMEOUT: Auth redirect timed out (6s).');
        console.warn('Auth redirect timed out or failed. Restoring login form.');
        processingRedirect = false;
        if (loadingState) loadingState.style.display = 'none';
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
      if (loadingState) loadingState.style.display = 'none';
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
      if (loadingState) loadingState.style.display = 'none';
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
      if (loadingState) loadingState.style.display = 'none';
      if (formsContainer) formsContainer.style.display = 'block';
      showAuthStatus('❌ Σφάλμα ταυτοποίησης: ' + (error.message || error));
    } else {
      logAuthDebug(`getSession resolved. Session exists: ${!!(data && data.session)}`);
      if (!data || !data.session) {
        // No session exists, stop showing loader and show the login form
        processingRedirect = false;
        if (loadingState) loadingState.style.display = 'none';
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
    if (loadingState) loadingState.style.display = 'none';
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

      // Load cached partner profile if available
      try {
        const cachedPartner = localStorage.getItem('cached_partner_profile');
        if (cachedPartner) {
          state.partnerProfile = JSON.parse(cachedPartner);
        }
      } catch (e) {
        console.error('Failed to parse cached partner profile:', e);
      }
      
      // Clear guest mode state
      state.guestMode = false;
      localStorage.removeItem('auth_guest_mode');
      
      // Hide auth overlay & reset elements
      if (authOverlay) authOverlay.style.display = 'none';
      if (loadingState) loadingState.style.display = 'none';
      if (formsContainer) formsContainer.style.display = 'block';
      
      // Show switcher in header
      const switcher = document.getElementById('wallet-switcher-container');
      if (switcher) switcher.style.display = 'inline-block';
      
      const email = session.user.email || '';
      // Show user badge
      updateHeaderProfileBadge();
      
      // Show email in settings page
      const emailDisplay = document.getElementById('settings-user-email-value');
      if (emailDisplay) {
        emailDisplay.textContent = email;
        emailDisplay.title = email;
      }
      const emailItem = document.getElementById('settings-user-email-item');
      if (emailItem) emailItem.style.display = 'flex';
      
      // Apply correct visual transformation theme and update UI immediately with cached data
      applyWalletTheme();
      updateUI();
      renderPartnerSection();

      // Trigger background updates and data loading asynchronously
      (async () => {
        try {
          // 1. Load user profile and partner details (network request)
          await loadUserProfiles(session.user);
          applyWalletTheme();
          renderPartnerSection();
          
          // 2. Load fresh data from cloud
          await loadData();
          updateUI();
          
          // Start automatic polling sync
          startPartnerSyncPolling();
          
          // Start realtime subscription
          setupSupabaseRealtimeSubscription();
          
          // Replay offline sync queue if any items are pending
          processSyncQueue();
          
          // 3. Sync guest transactions in the background
          await syncLocalTransactionsToCloud(session.user.id);
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
      localStorage.removeItem('offline_transactions');
      localStorage.removeItem('offline_accounts');
      localStorage.removeItem('offline_categories');
      updateHeaderSyncIcon('offline');
      
      if (localStorage.getItem('auth_guest_mode') === 'true') {
        state.guestMode = true;
        
        // Hide auth overlay & reset elements
        if (authOverlay) authOverlay.style.display = 'none';
        if (loadingState) loadingState.style.display = 'none';
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
          if (loadingState) loadingState.style.display = 'block';
          if (formsContainer) formsContainer.style.display = 'none';
        } else {
          // Show auth overlay normally
          if (authOverlay) authOverlay.style.display = 'flex';
          if (loadingState) loadingState.style.display = 'none';
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
        updateHeaderProfileBadge();
      }
    } else {
      state.userProfile = profile;
      updateHeaderProfileBadge();
    }
    
    // 2. Load family profiles & family group details
    if (state.userProfile && state.userProfile.family_id) {
      const [famRes, groupRes] = await Promise.all([
        state.supabaseClient.from('profiles').select('*').eq('family_id', state.userProfile.family_id),
        state.supabaseClient.from('family_groups').select('*').eq('id', state.userProfile.family_id).single()
      ]);

      if (famRes.data) {
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
      
      if (groupRes.data) {
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
        const { data: pending } = await state.supabaseClient
          .from('pending_invitations')
          .select('*, family_groups(name, invite_code)')
          .eq('invited_email', user.email.trim().toLowerCase());

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

  return state.transactions.filter(t => {
    if (t.user_id === undefined) {
      return true;
    }
    
    if (currentUserId) {
      if (familyId) {
        return t.family_id === familyId || (t.id && String(t.id).startsWith('local_'));
      }
      return t.user_id === currentUserId || 
             t.user_id === partnerId || 
             (t.id && String(t.id).startsWith('local_'));
    } else {
      return t.user_id === null || t.user_id === undefined;
    }
  });
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

// Bind to window
window.getActiveTransactions = getActiveTransactions;
window.calculateInitialBalances = calculateInitialBalances;

// ============================================================
// DATA LOADING
// ============================================================
async function loadData() {
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      updateHeaderSyncIcon('syncing');
      const userId = state.currentUser.id;
      const partnerId = state.partnerProfile ? state.partnerProfile.id : null;

      // Fetch categories & accounts first
      const familyId = state.userProfile ? state.userProfile.family_id : null;
      const userFilter = familyId 
        ? `family_id.eq.${familyId}` 
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
          transQuery = transQuery.eq('family_id', familyId);
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
      const pendingLocal = (() => {
        try {
          const cached = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return cached.filter(t => {
            if (!t || typeof t !== 'object') return false;
            if (!t.id) return true;
            if (String(t.id).startsWith('local_')) return true;
            if (t.user_id === null || t.user_id === undefined) return true;
            return !uuidRegex.test(String(t.id));
          });
        } catch (_) {
          return [];
        }
      })();

      const mergedTransactions = [...allTransactions, ...pendingLocal];
      state.transactions = mergedTransactions;
      state.categories = categories;
      state.accounts = accounts;
      
      calculateInitialBalances();

      localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
      localStorage.setItem('offline_accounts', JSON.stringify(state.accounts));
      localStorage.setItem('offline_categories', JSON.stringify(state.categories));
      
      updateHeaderSyncIcon('synced');

      // Try to flush pending local items in background without blocking UI.
      if (pendingLocal.length > 0) {
        syncLocalTransactionsToCloud(userId, { silent: true }).catch(() => {});
      }
    } catch (err) {
      console.error('Supabase fetch failed, falling back to offline cache:', err);
      // Load from cache and show offline state (not error) so user knows data is still visible
      loadOfflineData();
      updateHeaderSyncIcon('offline');
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
  } catch (e) {
    console.error('Failed to parse offline categories:', e);
    state.categories   = DEFAULT_CATEGORIES;
  }
  
  calculateInitialBalances();
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
  updateUI();

  // 3. Attempt to save to cloud in background
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    if (!transaction.user_id) {
      transaction.user_id = state.currentUser.id;
    }
    if (!transaction.family_id && state.userProfile && state.userProfile.family_id) {
      transaction.family_id = state.userProfile.family_id;
    }

    const { description, ...dbPayload } = transaction;

    (async () => {
      try {
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
      }
    })();
  }
}

function saveTransactionOffline(transaction) {
  if (!transaction.id) {
    transaction.id = generateUUID();
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

async function deleteTransaction(id) {
  // 1. Optimistically delete from local state and update UI
  deleteTransactionOffline(id);
  updateUI();

  // 2. Perform background delete
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    (async () => {
      try {
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .delete()
            .eq('id', id),
          12000
        );
        if (error) throw error;
        console.log(`Cloud delete success for transaction: ${id}`);
      } catch (err) {
        console.warn(`Cloud delete failed, queueing delete: ${id}`, err);
        enqueueSyncMutation('delete', id);
      }
    })();
  }
}

function deleteTransactionOffline(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
}

// ============================================================
// UI UPDATE ENGINE
// ============================================================
function updateUI() {
  updateHeaderAndSync();
  if (state.activeTab === 'trans') renderTransactionsTab();
  else if (state.activeTab === 'stats') renderStatsTab();
  else if (state.activeTab === 'accounts') renderAccountsTab();
  updateCategoryDropdowns();
  updateAccountDropdowns();
  updateCurrencySymbols();
}

function updateHeaderAndSync() {
  document.getElementById('current-period-title').textContent =
    `${getMonthName(state.selectedMonth, true)} ${state.selectedYear}`;
  updateHeaderProfileBadge();
}

// ============================================================
// TAB 1: TRANSACTIONS
// ============================================================
function renderTransactionsTab() {
  const listContainer = document.getElementById('transactions-list');
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

  const walletTrans = getActiveTransactions();
  const filteredTrans = walletTrans.filter(t => {
    if (!t.date) return false;
    const tDate = new Date(String(t.date).replace(' ', 'T'));
    return tDate >= start && tDate <= end;
  }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  let monthlyIncome = 0, monthlyExpense = 0;
  const groups = {};

  filteredTrans.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') monthlyIncome += amt;
    else if (t.type === 'expense') monthlyExpense += amt;
    
    const dateKey = t.date.split('T')[0];
    if (!groups[dateKey]) groups[dateKey] = { transactions: [], income: 0, expense: 0 };
    groups[dateKey].transactions.push(t);
    if (t.type === 'income') groups[dateKey].income += amt;
    else if (t.type === 'expense') groups[dateKey].expense += amt;
  });

  document.getElementById('summary-income-val').textContent  = `${getCurrencySymbol()} ${formatCurrency(monthlyIncome)}`;
  document.getElementById('summary-expense-val').textContent = `${getCurrencySymbol()} ${formatCurrency(monthlyExpense)}`;
  document.getElementById('summary-total-val').textContent   = `${getCurrencySymbol()} ${formatCurrency(monthlyIncome - monthlyExpense)}`;

  if (filteredTrans.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-secondary)">
        <div style="font-size:48px;margin-bottom:16px">📅</div>
        <h3 style="margin-bottom:8px">Δεν υπάρχουν συναλλαγές</h3>
        <p style="font-size:12px">Πατήστε + για να προσθέσετε ή εισάγετε Excel από το More menu</p>
      </div>`;
    return;
  }

  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(dateStr => {
    const group = groups[dateStr];
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const dayNum = d;
    const shortDay = getWeekdayName(dayOfWeek);
    const weekendClass = dayOfWeek === 6 ? ' saturday' : dayOfWeek === 0 ? ' sunday' : '';

    let rightTotals = '';
    if (group.income > 0)  rightTotals += `<span class="day-group-income">${getCurrencySymbol()} ${formatCurrency(group.income)}</span>`;
    if (group.expense > 0) rightTotals += `<span class="day-group-expense">${getCurrencySymbol()} ${formatCurrency(group.expense)}</span>`;

    const header = document.createElement('div');
    header.className = 'day-header';
    header.innerHTML = `
      <div class="day-header-left">
        <span class="day-num">${dayNum}</span>
        <div>
          <span class="day-name${weekendClass}">${shortDay}</span>
          <span class="day-month">${getMonthName(m - 1, true)} ${y}</span>
        </div>
      </div>
      <div class="day-header-right">${rightTotals}</div>`;
    listContainer.appendChild(header);

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
      let isLongPress = false;
      
      item.addEventListener('touchstart', (e) => {
        isLongPress = false;
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

      item.addEventListener('touchend', () => clearTimeout(pressTimer));
      item.addEventListener('touchmove', () => clearTimeout(pressTimer));
      
      item.addEventListener('mousedown', (e) => {
        isLongPress = false;
        if (state.selectionMode) return;
        pressTimer = setTimeout(() => {
          isLongPress = true;
          enterSelectionMode();
          toggleSelection(t.id);
        }, 600);
      });
      item.addEventListener('mouseup', () => clearTimeout(pressTimer));
      item.addEventListener('mouseleave', () => clearTimeout(pressTimer));

      item.onclick = (e) => {
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
      let accountText = t.account_from || '';
      if (t.type === 'expense')       { amountClass += ' expense'; }
      else if (t.type === 'income')   { amountClass += ' income'; }
      else if (t.type === 'transfer') { amountClass += ' transfer'; accountText = `${t.account_from} → ${t.account_to}`; }

      const displayTitle = (t.note && t.note.trim()) ? t.note.trim()
                         : (t.description && t.description.trim()) ? t.description.trim()
                         : (t.subcategory && t.subcategory.trim()) ? t.subcategory.trim()
                         : (t.category || '');
      
      const isPartner = state.partnerProfile && t.user_id === state.partnerProfile.id;
      const partnerBadge = isPartner ? ` <i class="fa-solid fa-user-group partner-badge-icon" title="Προστέθηκε από τον σύντροφο"></i>` : '';

      item.innerHTML = `
        ${checkboxHtml}
        <div class="trans-left">
          <div class="trans-category-container">
            <div class="trans-cat-icon">${catInfo.icon || '💰'}</div>
            <div class="trans-cat-name">${getCategoryDisplayName(catInfo.name) || ''}</div>
            ${t.subcategory ? `<div class="trans-sub-name">${t.subcategory}</div>` : ''}
          </div>
          <div class="trans-details">
            <span class="trans-title">${displayTitle}${partnerBadge}</span>
            <span class="trans-acc-label">${accountText}</span>
          </div>
        </div>
        <div class="${amountClass}">${getCurrencySymbol()} ${formatCurrency(t.amount)}</div>`;
      listContainer.appendChild(item);
    });
  });
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
  '🏛️ΜΕΡΙΔΙΟ ΔΟΣΗΣ ΔΑΝΕΙΟΥ (ΓΟΝΕΙΣ)': '🏛️ Loan Share (Parents)'
};

// Get category display name - translates default categories, preserves custom/user categories
function getCategoryDisplayName(categoryName) {
  if (!categoryName) return '';
  
  // Check if it's a known default category with translation
  if (state.lang === 'en' && CATEGORY_NAME_TRANSLATIONS[categoryName]) {
    return CATEGORY_NAME_TRANSLATIONS[categoryName];
  }
  
  // For custom/user categories, return as-is (never translate user data)
  return categoryName;
}

// Category Manager Functions
function openCategoryManagerModal() {
  openModal('category-manager-modal');
  renderCategoryManagerList();
}

function renderCategoryManagerList() {
  const container = document.getElementById('category-manager-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Combine default categories with custom categories
  const allCategories = [...DEFAULT_CATEGORIES];
  
  // Add custom categories from state
  state.categories.forEach(cat => {
    if (!DEFAULT_CATEGORIES.find(dc => dc.name === cat.name)) {
      allCategories.push(cat);
    }
  });
  
  allCategories.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'settings-list-item';
    item.style.padding = '12px';
    
    const isCustom = !DEFAULT_CATEGORIES.find(dc => dc.name === cat.name);
    
    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
        <span style="font-size: 20px;">${cat.icon}</span>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 13px; font-weight: 600; color: var(--text-main);">${getCategoryDisplayName(cat.name)}</span>
          <span style="font-size: 10px; color: var(--text-muted);">${cat.type === 'income' ? 'Έσοδο' : 'Έξοδο'}</span>
        </div>
      </div>
      ${isCustom ? `
        <div style="display: flex; gap: 8px;">
          <button onclick="toggleCategoryHidden('${cat.name}')" class="icon-btn" style="font-size: 14px;" title="${cat.hidden ? 'Εμφάνιση' : 'Απόκρυψη'}">
            <i class="fa-solid ${cat.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
          <button onclick="deleteCustomCategory('${cat.name}')" class="icon-btn" style="font-size: 14px; color: var(--accent);" title="Διαγραφή">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      ` : ''}
    `;
    
    container.appendChild(item);
  });
}

function toggleCategoryHidden(categoryName) {
  const cat = state.categories.find(c => c.name === categoryName);
  if (cat) {
    cat.hidden = !cat.hidden;
    saveCategoriesToStorage();
    renderCategoryManagerList();
    updateUI();
  }
}

function deleteCustomCategory(categoryName) {
  if (!confirm(TRANSLATIONS[state.lang]['confirm_delete_category'])) {
    return;
  }
  
  state.categories = state.categories.filter(c => c.name !== categoryName);
  saveCategoriesToStorage();
  renderCategoryManagerList();
  updateUI();
}

function addNewCustomCategory() {
  const nameInput = document.getElementById('new-category-name');
  const typeSelect = document.getElementById('new-category-type');
  
  const name = nameInput.value.trim();
  const type = typeSelect.value;
  
  if (!name) {
    alert(TRANSLATIONS[state.lang]['alert_enter_category_name']);
    return;
  }
  
  // Check if category already exists
  if (state.categories.find(c => c.name === name) || DEFAULT_CATEGORIES.find(c => c.name === name)) {
    alert(TRANSLATIONS[state.lang]['alert_category_exists']);
    return;
  }
  
  // Create new category with default icon and color
  const newCategory = {
    name: name,
    type: type,
    icon: type === 'income' ? '💰' : '💸',
    color: type === 'income' ? '#4caf50' : '#e05e55'
  };
  
  state.categories.push(newCategory);
  saveCategoriesToStorage();
  
  nameInput.value = '';
  renderCategoryManagerList();
  updateUI();
}

function saveCategoriesToStorage() {
  localStorage.setItem('offline_categories', JSON.stringify(state.categories));
}

// ============================================================
// TAB 2: STATS
// ============================================================
function renderStatsTab() {
  const { start, end } = getStatsDateRange();
  
  // Set month/period text on the top left
  document.getElementById('stats-period-title').textContent = formatStatsPeriodTitle(start, end);
  
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
    const datePart = t.date.split('T')[0];
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
    const key = catInfo.name || t.category || 'Άλλα';
    if (!catGroups[key]) catGroups[key] = { amount: 0, icon: catInfo.icon, color: catInfo.color };
    catGroups[key].amount += parseFloat(t.amount || 0);
  });

  const breakdownList = Object.entries(catGroups).map(([name, d]) => ({
    name, amount: d.amount, percentage: totalSum > 0 ? (d.amount / totalSum) * 100 : 0,
    icon: d.icon, color: d.color
  })).sort((a, b) => b.amount - a.amount);

  const listContainer = document.getElementById('stats-breakdown-list');
  listContainer.innerHTML = '';

  const centerTitleEl = document.getElementById('chart-center-title');
  const centerAmountEl = document.getElementById('chart-center-amount');
  const chartCenterVal = document.getElementById('chart-center-val');

  if (!breakdownList.length) {
    listContainer.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-secondary)"><h3>Δεν υπάρχουν δεδομένα</h3></div>`;
    if (statsChartInstance) { statsChartInstance.destroy(); statsChartInstance = null; }
    if (chartCenterVal) chartCenterVal.style.display = 'none';
    return;
  }

  // Update high tech doughnut center text
  if (chartCenterVal) {
    chartCenterVal.style.display = 'flex';
    if (centerTitleEl) {
      centerTitleEl.textContent = state.statsType === 'income' ? TRANSLATIONS[state.lang]['summary_income'] : TRANSLATIONS[state.lang]['summary_expense'];
    }
    if (centerAmountEl) {
      centerAmountEl.textContent = `${getCurrencySymbol()} ${formatCurrency(totalSum)}`;
    }
  }

  // Update income vs expense ratio bar
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

  breakdownList.forEach(item => {
    const row = document.createElement('div');
    row.className = 'stats-row';
    const isIncome = state.statsType === 'income';
    row.innerHTML = `
      <div class="stats-row-left">
        <span class="stats-pct-badge ${isIncome ? 'income' : ''}">${Math.round(item.percentage)}%</span>
        <span class="stats-cat-icon">${item.icon}</span>
        <span class="stats-category-name">${getCategoryDisplayName(item.name)}</span>
      </div>
      <div class="stats-row-right">${getCurrencySymbol()} ${formatCurrency(item.amount)}</div>`;
    listContainer.appendChild(row);
  });

  renderChart(breakdownList);
}

function renderChart(dataList) {
  const ctx = document.getElementById('statsChart').getContext('2d');
  if (statsChartInstance) statsChartInstance.destroy();

  // High-tech neon color palette
  const neonPalette = [
    '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6',
    '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
    '#22c55e', '#eab308', '#a855f7', '#ef4444', '#0ea5e9'
  ];

  // Assign neon colors preserving original category color hints
  const colors = dataList.map((d, i) => neonPalette[i % neonPalette.length]);

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

  // 1. Calculate overall history values from transactions (excluding transfers)
  const activeTrans = getActiveTransactions();
  const nonTransferTrans = activeTrans.filter(t => t.type !== 'transfer' && !t.category?.toLowerCase().includes('μεταφ') && !t.category?.toLowerCase().includes('transfer'));
  
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

  // 2. Set the overall history period (From [minDate] to today)
  const overallDatesEl = document.getElementById('overall-history-dates');
  const overallMathEl = document.getElementById('overall-history-math');

  if (overallDatesEl) {
    if (overallMinDate) {
      const formatDateStr = (dStr) => {
        const parts = dStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dStr;
      };
      const startFormatted = formatDateStr(overallMinDate);
      overallDatesEl.textContent = state.lang === 'el' ? `Από ${startFormatted} έως σήμερα` : `From ${startFormatted} to today`;
    } else {
      overallDatesEl.textContent = '-';
    }
  }

  if (overallMathEl) {
    overallMathEl.style.display = 'none';
  }

  // 3. Populate the top card overall columns (Income, Expenses, Net Balance)
  document.getElementById('total-assets-val').textContent      = formatCurrency(overallIncome);
  document.getElementById('total-liabilities-val').textContent = formatCurrency(overallExpense);
  const netElContainer = document.getElementById('total-net-val-container');
  const netEl = document.getElementById('total-net-val');
  netEl.textContent = formatCurrency(overallNet);
  if (netElContainer) {
    netElContainer.className = overallNet >= 0 ? 'overview-val' : 'overview-val negative';
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
        accIncome += parseFloat(t.amount) || 0;
        if (!minAccDate || t.date < minAccDate) minAccDate = t.date;
        if (!maxAccDate || t.date > maxAccDate) maxAccDate = t.date;
      }
    });

    let dateRangeLabel = '';
    if (minAccDate) {
      const formatDateStr = (dStr) => {
        const parts = dStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dStr;
      };
      const start = formatDateStr(minAccDate);
      dateRangeLabel = state.lang === 'el' ? `Από ${start} έως σήμερα` : `From ${start} to today`;
    } else {
      dateRangeLabel = state.lang === 'el' ? 'Δεν υπάρχουν έσοδα' : 'No income transactions';
    }

    const row = document.createElement('div');
    row.className = 'account-row';
    const icon = icons[acc.type] || '💳';

    const displayHtml = `
      <div style="display: flex; flex-direction: column;">
        <span class="account-title" style="font-weight: 600;">${getAccountDisplayName(acc)}</span>
        <span style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${dateRangeLabel}</span>
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

  // 5. Render Expenses section (Cash & Cards only)
  state.accounts.forEach(acc => {
    if (acc.type !== 'cash' && acc.type !== 'card') return;

    // Calculate expenses and date range for this account
    let accExpense = 0;
    let minAccDate = null;
    let maxAccDate = null;

    activeTrans.forEach(t => {
      if (t.type === 'expense' && t.account_from === acc.name) {
        accExpense += parseFloat(t.amount) || 0;
        if (!minAccDate || t.date < minAccDate) minAccDate = t.date;
        if (!maxAccDate || t.date > maxAccDate) maxAccDate = t.date;
      }
    });

    let dateRangeLabel = '';
    if (minAccDate) {
      const formatDateStr = (dStr) => {
        const parts = dStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dStr;
      };
      const start = formatDateStr(minAccDate);
      dateRangeLabel = state.lang === 'el' ? `Από ${start} έως σήμερα` : `From ${start} to today`;
    } else {
      dateRangeLabel = state.lang === 'el' ? 'Δεν υπάρχουν έξοδα' : 'No expense transactions';
    }

    const row = document.createElement('div');
    row.className = 'account-row';
    const icon = icons[acc.type] || '💳';

    const displayHtml = `
      <div style="display: flex; flex-direction: column;">
        <span class="account-title" style="font-weight: 600;">${getAccountDisplayName(acc)}</span>
        <span style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${dateRangeLabel}</span>
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

    const dateParts = t.date.split('-');
    if (dateParts.length !== 3) return;
    const year = parseInt(dateParts[0], 10);
    if (isNaN(year)) return;

    if (!yearlyData[year]) {
      yearlyData[year] = {
        net: 0,
        minDate: t.date,
        maxDate: t.date
      };
    }

    if (t.type === 'income') {
      yearlyData[year].net += amt;
    } else if (t.type === 'expense') {
      yearlyData[year].net -= amt;
    }

    if (t.date < yearlyData[year].minDate) yearlyData[year].minDate = t.date;
    if (t.date > yearlyData[year].maxDate) yearlyData[year].maxDate = t.date;
  });

  const breakdownEl = document.getElementById('accounts-periods-breakdown');
  const periodsList = document.getElementById('accounts-periods-list');
  const sortedYears = Object.keys(yearlyData).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  if (breakdownEl && periodsList) {
    if (sortedYears.length > 0) {
      breakdownEl.style.display = 'block';
      periodsList.innerHTML = '';

      sortedYears.forEach(year => {
        const data = yearlyData[year];
        if (data.net <= 0) return; // Only show surpluses!

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.fontSize = '12px';
        row.style.padding = '2px 0';

        const formatDateStr = (dStr) => {
          const parts = dStr.split('-');
          if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
          return dStr;
        };

        const label = TRANSLATIONS[state.lang]['period_label'] + ' ' + formatDateStr(data.minDate) + ' - ' + formatDateStr(data.maxDate);
        const colorStyle = 'color: var(--blue-positive);'; // Surpluses are positive/green
        const sign = '+';

        row.innerHTML = `
          <span style="color: var(--text-secondary); font-weight: 500;">${label}</span>
          <span style="font-weight: 600; ${colorStyle}">${sign}${getCurrencySymbol()}${formatCurrency(Math.abs(data.net))}</span>
        `;
        periodsList.appendChild(row);
      });
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
      switchTab(item.getAttribute('data-tab'));
    });
  });

  document.getElementById('period-prev').addEventListener('click', () => {
    state.selectedMonth--;
    if (state.selectedMonth < 0) { state.selectedMonth = 11; state.selectedYear--; }
    state.statsDate.setFullYear(state.selectedYear);
    state.statsDate.setMonth(state.selectedMonth);
    updateUI();
  });
  document.getElementById('period-next').addEventListener('click', () => {
    state.selectedMonth++;
    if (state.selectedMonth > 11) { state.selectedMonth = 0; state.selectedYear++; }
    state.statsDate.setFullYear(state.selectedYear);
    state.statsDate.setMonth(state.selectedMonth);
    updateUI();
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

  // Keypad keys click listeners
  document.querySelectorAll('.calc-key-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = btn.getAttribute('data-val');
      handleCalculatorKeyPress(val);
    });
  });

  // Close keypad when other form fields are clicked or focused
  ['trans-note', 'trans-description', 'trans-category', 'trans-account-from', 'trans-account-to', 'trans-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('focus', closeCalculatorKeypad);
      el.addEventListener('click', closeCalculatorKeypad);
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
    customSubcatInput.addEventListener('focus', closeCalculatorKeypad);
    customSubcatInput.addEventListener('click', closeCalculatorKeypad);
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
    
    const t = {
      date: document.getElementById('trans-date').value,
      type,
      amount: parseFloat(evaluatedVal) || 0,
      category: type === 'transfer' ? 'ΜΕΤΑΦΟΡΑ' : document.getElementById('trans-category').value,
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
      note: (() => {
        const descVal = document.getElementById('trans-description').value.trim();
        const noteVal = document.getElementById('trans-note').value.trim();
        if (descVal && noteVal) {
          return `${descVal} (${noteVal})`;
        }
        return descVal || noteVal;
      })(),
      description: '',
    };
    if (id) {
      t.id = id;
      const existing = state.transactions.find(item => item.id === id);
      if (existing) {
        t.user_id = existing.user_id;
        t.is_shared = existing.is_shared;
        t.family_id = existing.family_id;
      }
    } else {
      t.user_id = state.currentUser ? state.currentUser.id : null;
      t.is_shared = state.partnerProfile !== null;
      t.family_id = state.userProfile ? state.userProfile.family_id : null;
    }
    await saveTransaction(t);
    closeModal('transaction-modal');
  });

  document.getElementById('trans-delete-btn').addEventListener('click', async () => {
    const id = document.getElementById('trans-id').value;
    const confirmMsg = TRANSLATIONS[state.lang]['confirm_delete_transaction'];
    if (id && confirm(confirmMsg)) {
      await deleteTransaction(id);
      closeModal('transaction-modal');
    }
  });

  function openCalculatorKeypad() {
    const form = document.getElementById('transaction-form');
    if (form && form.getAttribute('data-readonly') === 'true') return;
    ensureHistoryPushed();
    const keypad = document.getElementById('custom-calculator-keypad');
    if (keypad) {
      keypad.classList.add('active');
    }
    const amountRow = document.getElementById('form-row-amount');
    if (amountRow) {
      amountRow.querySelector('.form-row-value-container').classList.add('focused');
    }
    state.calcBuffer = document.getElementById('trans-amount').value.replace(/\,/g, '.') || '';
  }

  window.openCalculatorKeypad = openCalculatorKeypad;

  function closeCalculatorKeypad() {
    const keypad = document.getElementById('custom-calculator-keypad');
    if (keypad) {
      keypad.classList.remove('active');
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
    dropdownMenu.classList.toggle('active');
  });

  const familyFilterBtn = document.getElementById('stats-family-dropdown-btn');
  const familyFilterMenu = document.getElementById('stats-family-dropdown-menu');
  if (familyFilterBtn && familyFilterMenu) {
    familyFilterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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
  if (currPeriodTitle) currPeriodTitle.addEventListener('click', openMonthPicker);

  const statsPeriodTitle = document.getElementById('stats-period-title');
  if (statsPeriodTitle) statsPeriodTitle.addEventListener('click', openMonthPicker);

  // Auto-close search overlay when user scrolls down in the main content
  const appContent = document.querySelector('.app-content');
  if (appContent) {
    let lastScrollTop = 0;
    let touchStartY = 0;

    // Desktop scroll
    appContent.addEventListener('scroll', () => {
      const st = appContent.scrollTop;
      const overlay = document.getElementById('search-overlay');
      if (overlay && overlay.classList.contains('active') && st > lastScrollTop + 8) {
        closeSearchOverlay();
      }
      lastScrollTop = st <= 0 ? 0 : st;
    }, { passive: true });

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
}

function adjustStatsPeriod(direction, startingDeltaX = 0) {
  animateSwipeTransition(direction, () => {
    if (state.statsPeriodType === 'weekly') {
      state.statsDate.setDate(state.statsDate.getDate() + direction * 7);
    } else if (state.statsPeriodType === 'monthly') {
      state.statsDate.setMonth(state.statsDate.getMonth() + direction);
      state.selectedMonth = state.statsDate.getMonth();
      state.selectedYear = state.statsDate.getFullYear();
      updateHeaderAndSync();
    } else if (state.statsPeriodType === 'annually') {
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
    renderStatsTab();
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
    state.statsCustomStart = startVal;
    state.statsCustomEnd = endVal;
    state.statsPeriodType = 'period';
    closeModal('custom-period-modal');
    renderStatsTab();
  }
}

function switchTab(tab) {
  // Allow re-tapping 'trans' or 'stats' tab to reset month even if already active
  if (state.activeTab === tab) {
    if (tab === 'trans') {
      const today = new Date();
      state.selectedMonth = today.getMonth();
      state.selectedYear = today.getFullYear();
      state.statsDate.setFullYear(state.selectedYear);
      state.statsDate.setMonth(state.selectedMonth);
      updateUI();
    } else if (tab === 'stats') {
      const today = new Date();
      state.selectedMonth = today.getMonth();
      state.selectedYear = today.getFullYear();
      state.statsDate = new Date();
      state.statsPeriodType = 'monthly';
      updateUI();
    }
    return;
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

  const TAB_ORDER = ['trans', 'stats', 'accounts', 'more'];
  const oldTab = state.activeTab;
  const newTab = tab;
  state.activeTab = tab;

  // Determine direction for premium horizontal slide transition
  const oldIdx = TAB_ORDER.indexOf(oldTab);
  const newIdx = TAB_ORDER.indexOf(newTab);
  const isForward = newIdx > oldIdx;

  const oldScreen = document.getElementById(`${oldTab}-screen`);
  const newScreen = document.getElementById(`${newTab}-screen`);

  if (newScreen) {
    newScreen.style.display = ''; // Clear any inline display: none override
    newScreen.style.visibility = '';
    newScreen.style.opacity = '';
  }

  if (oldScreen && newScreen) {
    // Clean up any old transition classes first
    oldScreen.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');
    newScreen.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');

    // Add new slide classes (they apply display: block !important)
    if (isForward) {
      oldScreen.classList.add('slide-out-left');
      newScreen.classList.add('slide-in-right');
    } else {
      oldScreen.classList.add('slide-out-right');
      newScreen.classList.add('slide-in-left');
    }

    // Now safe to remove active class from oldScreen (will stay visible due to slide class)
    oldScreen.classList.remove('active');

    // Manage FAB visibility based on active tab
    const fab = document.getElementById('fab-btn');
    if (fab) {
      if (newTab === 'trans') {
        fab.style.display = 'flex';
      } else {
        fab.style.display = 'none';
      }
    }

    // Use animationend event for reliable cleanup instead of fragile setTimeout
    const cleanupHandler = () => {
      // Immediately hide old screen to prevent any flash-back frames
      oldScreen.style.display = 'none';
      oldScreen.style.visibility = 'hidden';
      oldScreen.style.opacity = '0';
      // Clean up all transition classes
      document.querySelectorAll('.tab-screen').forEach(s => {
        s.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');
        if (s.id === `${newTab}-screen`) {
          s.classList.add('active');
          s.style.display = '';
          s.style.visibility = '';
          s.style.opacity = '';
        }
      });
    };

    // Listen for animation end on the NEW screen (slide-in finishes)
    const onAnimEnd = (e) => {
      if (e.target === newScreen) {
        newScreen.removeEventListener('animationend', onAnimEnd);
        cleanupHandler();
      }
    };
    newScreen.addEventListener('animationend', onAnimEnd);

    // Safety fallback in case animationend doesn't fire (e.g. display issues)
    setTimeout(() => {
      newScreen.removeEventListener('animationend', onAnimEnd);
      cleanupHandler();
    }, 350);
  } else {
    // Fallback if elements are missing
    document.querySelectorAll('.tab-screen').forEach(s => s.classList.toggle('active', s.id === `${tab}-screen`));
  }

  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.getAttribute('data-tab') === tab));
  
  // Ensure dummy history entry is pushed if moving away from home tab ('trans')
  if (tab !== 'trans') {
    ensureHistoryPushed();
  }

  // Defer heavy UI rendering until the horizontal slide transition has completely finished
  const delay = (oldScreen && newScreen) ? 310 : 16;
  setTimeout(() => {
    if (tab === 'trans') {
      // Reset month/year to today's date when opening the transactions screen
      const today = new Date();
      state.selectedMonth = today.getMonth();
      state.selectedYear = today.getFullYear();
      state.statsDate.setFullYear(state.selectedYear);
      state.statsDate.setMonth(state.selectedMonth);
      updateUI();
    }
    else if (tab === 'stats')    renderStatsTab();
    else if (tab === 'accounts') renderAccountsTab();
    else if (tab === 'more') {
      // Refresh partner section every time user opens the More tab
      renderPartnerSection();
      // Also update email display
      if (state.currentUser) {
        const emailDisplay = document.getElementById('settings-user-email-value');
        if (emailDisplay) {
          emailDisplay.textContent = state.currentUser.email;
          emailDisplay.title = state.currentUser.email;
        }
        const emailItem = document.getElementById('settings-user-email-item');
        if (emailItem) emailItem.style.display = 'flex';
      }
    }
  }, delay);
}

function toggleStatsType(type) {
  state.statsType = type;
  document.getElementById('stats-tab-expense').classList.toggle('active', type === 'expense');
  document.getElementById('stats-tab-income').classList.toggle('active',  type === 'income');
  renderStatsTab();
}

function openModal(id)  { 
  ensureHistoryPushed();
  document.getElementById(id).classList.add('active'); 
}
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  if (id === 'excel-modal') {
    document.getElementById('excel-file-input').value = '';
    document.getElementById('excel-mapping-section').style.display = 'none';
    state.excelData = null; state.excelColumns = [];
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
  toggleTransactionFormLock(false);
  document.getElementById('transaction-form').reset();
  document.getElementById('trans-id').value = '';
  
  // Reset Category
  document.getElementById('trans-category').value = '';
  document.getElementById('trans-category-display').innerHTML = `<span class="custom-select-placeholder">Επιλέξτε...</span>`;
  
  // Reset Subcategory
  const customInput = document.getElementById('trans-subcategory-custom');
  if (customInput) customInput.value = '';
  hideSubcategorySelect();
  
  document.getElementById('trans-delete-btn').style.display = 'none';
  
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
  document.getElementById('trans-date').value = localISOTime;
  document.getElementById('trans-date-display').textContent = formatGreekDateTime(localISOTime);
  
  setTransactionFormType('expense');

  openModal('transaction-modal');
}

function openEditTransactionModal(t) {
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
  
  let descVal = t.note || '';
  let noteVal = '';
  const match = descVal.match(/^(.*) \((.*)\)$/);
  if (match) {
    descVal = match[1];
    noteVal = match[2];
  }
  document.getElementById('trans-description').value = descVal;
  document.getElementById('trans-note').value        = noteVal;
  
  if (shouldLock) {
    document.getElementById('trans-delete-btn').style.display = 'none';
  } else {
    document.getElementById('trans-delete-btn').style.display = 'block';
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
  }, 10);
  openModal('transaction-modal');
}

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
  const cleanName = stripLeadingEmoji(categoryVal);
  
  const subcatSelect = document.getElementById('trans-subcategory-select')?.value || '';
  const subcatCustom = document.getElementById('trans-subcategory-custom')?.value || '';
  
  let subcatText = '';
  if (subcatSelect === '__NEW__') {
    subcatText = subcatCustom.trim();
  } else if (subcatSelect) {
    subcatText = subcatSelect.trim();
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
  const form = document.getElementById('transaction-form');
  if (form && form.getAttribute('data-readonly') === 'true') return;
  document.querySelectorAll('.type-tab-btn').forEach(btn =>
    btn.classList.toggle('active', btn.getAttribute('data-type') === type)
  );
  
  const modalEl = document.getElementById('transaction-modal');
  if (modalEl) {
    modalEl.classList.remove('expense', 'income', 'transfer');
    modalEl.classList.add(type);
  }
  
  let typeLabel = TRANSLATIONS[state.lang]['type_tab_expense'];
  if (type === 'income') typeLabel = TRANSLATIONS[state.lang]['type_tab_income'];
  else if (type === 'transfer') typeLabel = TRANSLATIONS[state.lang]['type_tab_transfer'];
  document.getElementById('modal-trans-title').textContent = typeLabel;
  
  const catGroup      = document.getElementById('form-row-category');
  const toAccGroup    = document.getElementById('form-row-account-to');
  const fromAccLabel  = document.getElementById('label-account-from');
  
  if (type === 'transfer') {
    if (catGroup) catGroup.style.display = 'none';
    updateSubcategoryRowVisibility();
    if (toAccGroup) toAccGroup.style.display = 'flex';
    if (fromAccLabel) fromAccLabel.textContent = TRANSLATIONS[state.lang]['label_from'];
  } else {
    if (catGroup) catGroup.style.display = 'flex';
    updateSubcategoryRowVisibility();
    if (toAccGroup) toAccGroup.style.display = 'none';
    if (fromAccLabel) fromAccLabel.textContent = TRANSLATIONS[state.lang]['label_account'];
    updateCategoryDropdowns(type);
    updateSubcategorySuggestions();
  }
}

function updateCategoryDropdowns(type = 'expense') {
  const grid = document.getElementById('category-picker-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const currentCategory = document.getElementById('trans-category').value;
  let categoryExists = false;
  
  // Dynamic categories from state (filter by type, exclude hidden)
  const visibleCategories = state.categories.filter(c => c.type === type && !c.hidden);
  
  visibleCategories.forEach(c => {
    const div = document.createElement('div');
    div.className = 'category-picker-item';
    if (c.name === currentCategory) {
      div.classList.add('selected');
      categoryExists = true;
    }
    div.innerHTML = `<span class="category-picker-icon">${c.icon}</span><span class="category-picker-name">${stripLeadingEmoji(c.name)}</span>`;
    div.onclick = () => selectCategory(c.name, c.icon, c.color, true);
    grid.appendChild(div);
  });
  
  // "+" New Category box at the end of the grid
  const addBox = document.createElement('div');
  addBox.className = 'category-picker-item category-picker-add';
  addBox.innerHTML = `<span class="category-picker-icon" style="font-size:28px;color:var(--accent);">+</span><span class="category-picker-name">${state.lang === 'el' ? 'Νέα Κατηγορία' : 'New Category'}</span>`;
  addBox.onclick = () => openNewCategoryDialog(type);
  grid.appendChild(addBox);
  
  if (!categoryExists && currentCategory !== '') {
    document.getElementById('trans-category').value = '';
    updateCategoryDisplay();
  }
}

function selectCategory(name, icon, color, isManual = false) {
  document.getElementById('trans-category').value = name;
  document.querySelectorAll('.category-picker-item').forEach(item => {
    item.classList.remove('selected');
    if(item.querySelector('.category-picker-name').textContent === stripLeadingEmoji(name)) {
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
    // Check if category has subcategories
    const cleanedCat = stripLeadingEmoji(name).toUpperCase();
    const defaults = DEFAULT_SUBCATEGORIES_MAP[cleanedCat];
    
    let hasTransSubcats = false;
    for (let i = 0; i < state.transactions.length; i++) {
      const t = state.transactions[i];
      if (t.category && stripLeadingEmoji(t.category).toUpperCase() === cleanedCat && t.subcategory && t.subcategory.trim() !== '') {
        hasTransSubcats = true;
        break;
      }
    }
    
    if ((defaults && defaults.length > 0) || hasTransSubcats) {
      closeModal('category-picker-modal');
      openSubcategoryModal();
    } else {
      closeModal('category-picker-modal');
    }
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
  const form = document.getElementById('transaction-form');
  if (form && form.getAttribute('data-readonly') === 'true') return;
  const currentType = document.querySelector('.type-tab-btn.active').getAttribute('data-type');
  updateCategoryDropdowns(currentType);
  closeNewCategoryDialog(); // Reset dialog state
  openModal('category-picker-modal');
}

// New Category inline dialog state
let newCategoryDialogType = 'expense';
let newCategorySelectedEmoji = '💸';

const EMOJI_OPTIONS = ['💰','💸','🏡','🛒','🚗','❤️','🎉','🧾','🏋️','👕','🚇','💻','🎬','🎓','🧩','🤑','🎁','💼','💶','🏛️','📦','🏅','👨','💵','🔧','⭐','🔥','🎯','📱','☕','🎵','✈️','🏖️','📚','🐶','🌱','💡','🗂️','🛠️','🎮'];

function openNewCategoryDialog(type) {
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
}

function saveNewCategoryFromPicker() {
  const nameInput = document.getElementById('new-cat-name-input');
  const name = nameInput ? nameInput.value.trim() : '';
  
  if (!name) {
    alert(TRANSLATIONS[state.lang]['alert_enter_category_name']);
    return;
  }
  
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
    const nameEl = item.querySelector('.category-picker-name');
    if (nameEl && nameEl.textContent === name) {
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
  const form = document.getElementById('transaction-form');
  if (form && form.getAttribute('data-readonly') === 'true') return;
  if(!document.getElementById('trans-category').value) {
    alert(TRANSLATIONS[state.lang]['alert_select_category_first']);
    return;
  }
  updateSubcategorySuggestions();
  openModal('subcategory-picker-modal');
}

function updateAccountDropdowns() {
  ['trans-account-from','trans-account-to'].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = '';
    state.accounts.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.name; opt.textContent = a.name;
      sel.appendChild(opt);
    });
  });
}

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
// Update the permanent cloud icon in the header
function updateHeaderSyncIcon(state_) {
  // state_: 'offline' | 'syncing' | 'synced' | 'error'
  const dot  = document.getElementById('header-sync-dot');
  const icon = document.getElementById('header-sync-cloud-icon');
  if (!dot || !icon) return;
  const colors = { offline:'#9e9e9e', syncing:'#ffd600', synced:'#4caf50', error:'#ef5350' };
  dot.style.background = colors[state_] || '#9e9e9e';
  // Animate dot on sync
  if (state_ === 'syncing') {
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
  const labels = { offline:'Τοπική αποθήκευση', syncing:'Συγχρονισμός...', synced:'Συγχρονισμένο ✅', error:'Σφάλμα συγχρονισμού ⚠️' };
  if (btn) btn.title = labels[state_] || 'Συγχρονισμός';
  
  // Update sync status text in settings
  const syncStatusEl = document.getElementById('val_sync_status');
  if (syncStatusEl) {
    const statusLabels = { 
      offline:'Τοπική Αποθήκευση', 
      syncing:'Συγχρονισμός...', 
      synced:'Ενεργός', 
      error:'Σφάλμα' 
    };
    syncStatusEl.textContent = statusLabels[state_] || 'Τοπική Αποθήκευση';
    
    // Update color based on status
    if (state_ === 'synced') {
      syncStatusEl.style.color = '#4caf50'; // Green for active
    } else if (state_ === 'error') {
      syncStatusEl.style.color = '#ef5350'; // Red for error
    } else {
      syncStatusEl.style.color = 'var(--text-secondary)';
    }
  }
}

// Excel: Date | Account | Category | Subcategory | Note | EUR | Income/Expense | Description | Amount
// ============================================================
function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  console.log('[Excel] Αρχείο:', file.name, '| Μέγεθος:', file.size, 'bytes');

  const fileName = file.name.toLowerCase();
  const reader = new FileReader();

  const isCsv = fileName.endsWith('.csv') || fileName.endsWith('.txt') || file.type === 'text/csv' || file.type === 'text/plain';

  if (isCsv) {
    reader.onload = function(e) {
      try {
        const arrayBuffer = e.target.result;
        let text = '';
        let isGreekWindows = false;

        // Try UTF-8 first
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        try {
          text = utf8Decoder.decode(arrayBuffer);
        } catch (err) {
          isGreekWindows = true;
        }

        if (!isGreekWindows && text.includes('\uFFFD')) {
          isGreekWindows = true;
        }

        if (isGreekWindows) {
          try {
            const greekDecoder = new TextDecoder('windows-1253');
            text = greekDecoder.decode(arrayBuffer);
          } catch (err) {
            const lossyDecoder = new TextDecoder('utf-8');
            text = lossyDecoder.decode(arrayBuffer);
          }
        }

        const rows = parseCSVText(text);
        if (!rows || !rows.length) {
          alert(TRANSLATIONS[state.lang]['alert_csv_empty']);
          return;
        }

        state.excelData = rows;
        state.excelColumns = Object.keys(rows[0]);
        populateExcelMappingOptions();
        document.getElementById('excel-mapping-section').style.display = 'block';
      } catch (err) {
        console.error('[CSV Error]', err);
        alert('❌ ' + (state.lang === 'en' ? 'CSV Error' : 'Σφάλμα CSV') + ':\n' + (err.message || err));
      }
    };
    reader.onerror = function() {
      alert('❌ ' + (state.lang === 'en' ? 'Error reading CSV file' : 'Σφάλμα ανάγνωσης αρχείου CSV'));
    };
    reader.readAsArrayBuffer(file);
  } else {
    // Excel file — check XLSX library loaded
    if (typeof XLSX === 'undefined') {
      alert('❌ ' + (state.lang === 'en' ? 'XLSX library not loaded!\nRefresh the page (Ctrl+Shift+R) and try again.' : 'Η βιβλιοθήκη XLSX δεν φορτώθηκε!\nΑνανεώστε τη σελίδα (Ctrl+Shift+R) και δοκιμάστε ξανά.'));
      return;
    }
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        console.log('[Excel] XLSX.read, bytes:', data.length);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
        console.log('[Excel] Parsed rows:', json.length);
        if (!json.length) { 
          alert(TRANSLATIONS[state.lang]['alert_excel_empty']); 
          return; 
        }
        state.excelData = json;
        state.excelColumns = Object.keys(json[0]);
        populateExcelMappingOptions();
        document.getElementById('excel-mapping-section').style.display = 'block';
      } catch (err) {
        console.error('[Excel Error]', err);
        alert('❌ ' + (state.lang === 'en' ? 'Excel Error' : 'Σφάλμα Excel') + ':\n' + (err.message || err));
      }
    };
    reader.onerror = function() {
      alert('❌ ' + (state.lang === 'en' ? 'Error reading Excel file' : 'Σφάλμα ανάγνωσης αρχείου Excel'));
    };
    reader.readAsArrayBuffer(file);
  }
}

function populateExcelMappingOptions() {
  const fieldDefs = [
    { id: 'date',        keywords: ['date', 'ημερομηνία', 'ημερομηνια', 'time', 'χρόνος', 'created', 'timestamp', 'datetime', 'date & time', 'trans_date', 'started date', 'completed date', 'transaction date', 'ημερομηνια συναλλαγης'] },
    { id: 'account',     keywords: ['account', 'λογαριασμός', 'λογαριασμος', 'wallet', 'asset', 'card', 'payment', 'source', 'bank', 'wallet_name', 'payment type', 'payment_type', 'λογαριασμος χρεωσης', 'account name'] },
    { id: 'category',    keywords: ['category', 'κατηγορία', 'κατηγορια', 'group', 'class', 'tag', 'main_category', 'category group/category', 'κατηγορια/υποκατηγορια'] },
    { id: 'subcategory', keywords: ['subcategory', 'υποκατηγορία', 'υποκατηγορια', 'sub-category', 'sub', 'sub_category', 'υπο-κατηγορια'] },
    { id: 'note',        keywords: ['note', 'σημείωση', 'σημειωση', 'memo', 'comment', 'σχόλιο', 'σχολιο', 'remarks', 'transaction note', 'commentary', 'details', 'λεπτομερειες', 'αιτιολογια'] },
    { id: 'amount',      keywords: ['amount', 'eur', 'ποσό', 'ποσο', 'value', 'sum', 'cost', 'price', 'money', 'total', 'summa', 'amount_in', 'amount_out', 'υπολοιπο'] },
    { id: 'inflow',      keywords: ['inflow', 'credit', 'incoming', 'deposit', 'income', 'επιταγη/καταθεση', 'πιστωση', 'εισροη', 'αυξηση'] },
    { id: 'outflow',     keywords: ['outflow', 'debit', 'outgoing', 'withdrawal', 'expense', 'χρεωση/πληρωμη', 'χρεωση', 'εκροη', 'μειωση'] },
    { id: 'type',        keywords: ['income/expense', 'type', 'τύπος', 'τυπος', 'direction', 'kind', 'transaction_type', 'εσοδο/εξοδο', 'product'] },
    { id: 'description', keywords: ['description', 'descr', 'περιγρ', 'περιγραφή', 'merchant', 'payee', 'recipient', 'details', 'title', 'ονομα κίνησης', 'αιτιολογια', 'συναλλαγη'] },
  ];

  fieldDefs.forEach(field => {
    const select = document.getElementById(`map-${field.id}`);
    if (!select) return;
    select.innerHTML = '<option value="">-- Επιλέξτε Στήλη --</option>';

    let bestCol = null, maxScore = 0;
    state.excelColumns.forEach(col => {
      const low = col.toLowerCase();
      let score = 0;
      field.keywords.forEach((kw, i) => {
        if (low === kw) score = Math.max(score, 10 - i);
        else if (low.includes(kw)) score = Math.max(score, 5 - i);
      });
      if (score > maxScore) { maxScore = score; bestCol = col; }
    });

    state.excelColumns.forEach(col => {
      const opt = document.createElement('option');
      opt.value = col; opt.textContent = col;
      if (col === bestCol) opt.selected = true;
      select.appendChild(opt);
    });
  });
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

async function processExcelImport() {
  if (!state.excelData) return;

  const importBtn = document.getElementById('excel-mapping-form');
  const cancelBtn = document.querySelector('#excel-modal .btn-secondary');
  const originalBtnText = importBtn ? importBtn.textContent : '';
  const isEn = state.lang === 'en';
  const clearFirst = document.getElementById('clear-before-import')?.checked;

  // --- Progress bar helpers ---
  const progressSection = document.getElementById('import-progress-section');
  const progressBar     = document.getElementById('import-progress-bar');
  const progressPct     = document.getElementById('import-progress-pct');
  const phaseLabel      = document.getElementById('import-phase-label');
  const phaseSteps      = document.getElementById('import-phase-steps');

  const phases = isEn
    ? ['⚙️ Preparation', '📥 Importing', '✅ Done']
    : ['⚙️ Προετοιμασία', '📥 Εισαγωγή', '✅ Ολοκλήρωση'];

  function showProgress() {
    if (progressSection) progressSection.style.display = 'block';
    if (phaseSteps) {
      phaseSteps.innerHTML = phases.map((p, i) =>
        `<span id="phase-step-${i}" style="padding:3px 8px;border-radius:999px;background:var(--card-border,#eee);color:var(--text-secondary);">${p}</span>`
      ).join('');
    }
  }

  function setPhase(phaseIndex, pct) {
    if (phaseLabel) phaseLabel.textContent = phases[phaseIndex] || '';
    if (progressBar) progressBar.style.width = pct + '%';
    if (progressPct) progressPct.textContent = pct + '%';
    phases.forEach((_, i) => {
      const el = document.getElementById(`phase-step-${i}`);
      if (!el) return;
      if (i < phaseIndex) {
        el.style.background = 'var(--income,#4caf50)'; el.style.color = '#fff'; el.style.fontWeight = '';
      } else if (i === phaseIndex) {
        el.style.background = 'var(--accent)'; el.style.color = '#fff'; el.style.fontWeight = '700';
      } else {
        el.style.background = 'var(--card-border,#eee)'; el.style.color = 'var(--text-secondary)'; el.style.fontWeight = '';
      }
    });
  }

  function hideProgress() {
    if (progressSection) { progressSection.style.display = 'none'; }
    if (progressBar) progressBar.style.width = '0%';
    if (progressPct) progressPct.textContent = '0%';
  }
  // --- End progress helpers ---

  if (importBtn) { importBtn.disabled = true; importBtn.textContent = isEn ? 'Importing...' : 'Εισαγωγή σε εξέλιξη...'; }
  if (cancelBtn) { cancelBtn.disabled = true; }

  showProgress();
  setPhase(0, 5);

  const cleanupButtons = () => {
    if (importBtn) { importBtn.disabled = false; importBtn.textContent = originalBtnText; }
    if (cancelBtn) { cancelBtn.disabled = false; }
    hideProgress();
  };

  const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const dateCol    = get('map-date');
  const accountCol = get('map-account');
  const catCol     = get('map-category');
  const subCatCol  = get('map-subcategory');
  const noteCol    = get('map-note');
  const amtCol     = get('map-amount');
  const inflowCol  = get('map-inflow');
  const outflowCol = get('map-outflow');
  const typeCol    = get('map-type');
  const descCol    = get('map-description');

  if (!dateCol) {
    const msg = TRANSLATIONS[state.lang]['alert_date_required'];
    alert(msg);
    cleanupButtons();
    return;
  }
  if (!amtCol && !inflowCol && !outflowCol) {
    const msg = state.lang === 'en' 
      ? 'You must map either the Amount column or Inflow/Outflow columns!' 
      : 'Πρέπει να ορίσετε είτε τη στήλη Ποσό είτε τις στήλες Εισροή/Εκροή!';
    alert(msg);
    cleanupButtons();
    return;
  }

  const importedTransactions = [];
  const newCategories = [];
  const newAccounts   = [];
  let skipped = 0;

  for (const row of state.excelData) {
    try {
      // 1. Date
      const formattedDate = parseExcelDate(row[dateCol]);
      if (!formattedDate) { skipped++; continue; }

      // 2. Amount and Type detection
      let amount = 0;
      let type = 'expense';

      if (amtCol && row[amtCol] !== undefined && row[amtCol] !== '') {
        const rawAmountVal = parseExcelAmount(row[amtCol]);
        amount = Math.abs(rawAmountVal);
        if (isNaN(amount)) { skipped++; continue; }

        if (typeCol && row[typeCol]) {
          const rawType = String(row[typeCol]).toLowerCase().trim();
          if (rawType === 'income' || rawType.includes('εσοδ') || rawType.includes('έσοδ') || rawType === 'credit' || rawType.includes('deposit') || rawType.includes('in') || rawType.includes('incoming')) {
            type = 'income';
          } else if (rawType.includes('transfer') || rawType.includes('μεταφ') || rawType.includes('internal')) {
            type = 'transfer';
          } else {
            type = 'expense';
          }
        } else {
          // Fallback to sign of amount: negative is expense, positive is income
          type = rawAmountVal < 0 ? 'expense' : 'income';
        }
      } else {
        // We have inflow/outflow columns mapped
        const inflowVal = inflowCol && row[inflowCol] ? parseExcelAmount(row[inflowCol]) : 0;
        const outflowVal = outflowCol && row[outflowCol] ? parseExcelAmount(row[outflowCol]) : 0;

        if (inflowVal > 0) {
          amount = inflowVal;
          type = 'income';
        } else if (outflowVal !== 0) {
          amount = Math.abs(outflowVal);
          type = 'expense';
        } else {
          skipped++;
          continue;
        }
      }

      // 3. Account mapping
      let account = accountCol && row[accountCol] ? String(row[accountCol]).trim() : 'Cash';
      account = stripLeadingEmoji(account);
      // Key mapping: "Accounts" in Excel = "Bank Account" in app
      if (account.toLowerCase() === 'accounts') account = 'Bank Account';

      let matchedAcc = state.accounts.find(a => a.name.toLowerCase() === account.toLowerCase());
      if (!matchedAcc) {
        const newAcc = { 
          name: account, 
          type: 'bank', 
          balance: 0,
          user_id: state.currentUser ? state.currentUser.id : null
        };
        state.accounts.push(newAcc);
        newAccounts.push(newAcc);
        matchedAcc = newAcc;
        localStorage.setItem('offline_accounts', JSON.stringify(state.accounts));
      }
      account = matchedAcc.name;

      // 4. Category
      const rawCategory = catCol && row[catCol] ? String(row[catCol]) : '';
      const catInfo = resolveCategoryInfo(rawCategory, type);
      const categoryName = catInfo
        ? catInfo.name
        : (type === 'income' ? 'ΑΛΛΑ ΕΣΟΔΑ' : 'ΑΛΛΑ ΕΞΟΔΑ');

      // Ensure category exists in state (create if new)
      let matchedCat = state.categories.find(c =>
        c.name && c.name.toUpperCase() === categoryName.toUpperCase()
      );
      if (!matchedCat) {
        // Create new category with proper icon and color
        const newCat = {
          name: categoryName,
          type: catInfo.type || type,
          icon: catInfo.icon || (type === 'income' ? '💰' : '💸'),
          color: catInfo.color || getRandomColor(),
          user_id: state.currentUser ? state.currentUser.id : null
        };
        state.categories.push(newCat);
        newCategories.push(newCat);
        localStorage.setItem('offline_categories', JSON.stringify(state.categories));
        matchedCat = newCat;
      }

      // 5. Subcategory
      const rawSubcat = subCatCol && row[subCatCol] ? String(row[subCatCol]).trim() : '';
      const subcategory = rawSubcat ? rawSubcat.trim() : '';

      // 6. Note display logic
      const rawNote = noteCol && row[noteCol] ? String(row[noteCol]).trim() : '';
      const rawDesc = descCol && row[descCol] ? String(row[descCol]).trim() : '';
      const noteIsMeaningful = rawNote && rawNote.length > 2;
      const finalNote = noteIsMeaningful ? rawNote : (rawDesc || rawNote);

      importedTransactions.push({
        date: formattedDate, type, amount,
        category: categoryName,
        subcategory,
        account_from: account,
        account_to: type === 'transfer' ? account : null,
        note: finalNote,
        user_id: state.currentUser ? state.currentUser.id : null,
        is_shared: state.partnerProfile !== null
      });
    } catch (err) {
      console.warn('Skipping row:', err);
      skipped++;
    }
  }

  if (!importedTransactions.length) {
    alert('Δεν βρέθηκαν έγκυρες συναλλαγές. Ελέγξτε τις στήλες!');
    cleanupButtons();
    return;
  }

  // ═══════════════════════════════════════════════════════
  // STEP 1: SAVE LOCALLY FIRST (instant, never fails)
  // ═══════════════════════════════════════════════════════
  setPhase(1, 40);
  
  const localImported = importedTransactions.map((t, idx) => ({
    ...t,
    id: 'local_pending_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 5)
  }));

  if (clearFirst) {
    state.transactions = [...localImported];
  } else {
    state.transactions = [...state.transactions, ...localImported];
  }
  localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));

  setPhase(1, 50);

  // ═══════════════════════════════════════════════════════
  // STEP 2: TRY CLOUD SYNC (best-effort, won't block)
  // ═══════════════════════════════════════════════════════
  let cloudSuccess = false;
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    let syncPhase = 'init';
    try {
      // Delete old if needed
      if (clearFirst) {
        syncPhase = 'delete-fetch-ids';
        if (phaseLabel) phaseLabel.textContent = isEn ? '☁️ Cloud: Fetching IDs...' : '☁️ Cloud: Ανάκτηση IDs...';
        
        let existingRows = [];
        let fetchPage = 0;
        const fetchPageSize = 1000;
        let fetchHasMore = true;

        while (fetchHasMore) {
          const { data: pageData, error: fetchErr } = await promiseTimeout(
            state.supabaseClient
              .from('transactions')
              .select('id')
              .eq('user_id', state.currentUser.id)
              .range(fetchPage * fetchPageSize, (fetchPage + 1) * fetchPageSize - 1)
              .then(r => r),
            30000
          );
          if (fetchErr) throw fetchErr;

          if (pageData && pageData.length > 0) {
            existingRows = existingRows.concat(pageData);
            if (pageData.length < fetchPageSize) {
              fetchHasMore = false;
            } else {
              fetchPage++;
            }
          } else {
            fetchHasMore = false;
          }
        }

        if (existingRows && existingRows.length > 0) {
          const allIds = existingRows.map(r => r.id);
          const delBatchSize = 30;
          const totalDelBatches = Math.ceil(allIds.length / delBatchSize);
          
          for (let d = 0; d < allIds.length; d += delBatchSize) {
            const idBatch = allIds.slice(d, d + delBatchSize);
            const delBatchNum = Math.floor(d / delBatchSize) + 1;
            syncPhase = `delete-batch-${delBatchNum}/${totalDelBatches}`;

            if (phaseLabel) {
              phaseLabel.textContent = isEn
                ? `🗑️ Cloud: Deleting ${delBatchNum}/${totalDelBatches}...`
                : `🗑️ Cloud: Διαγραφή ${delBatchNum}/${totalDelBatches}...`;
            }
            const delPct = Math.round(50 + (delBatchNum / totalDelBatches) * 15);
            if (progressBar) progressBar.style.width = delPct + '%';
            if (progressPct) progressPct.textContent = delPct + '%';

            await promiseTimeout(
              state.supabaseClient.from('transactions').delete().in('id', idBatch).then(r => r),
              30000
            );
          }
        }
      }

      // Insert Categories & Accounts (Best-effort, will not block transaction import if they fail/timeout)
      if (newCategories.length) {
        syncPhase = 'categories';
        const unique = [...new Map(newCategories.map(c => [`${c.name}|${c.type}`, c])).values()];
        unique.forEach(c => {
          c.user_id = state.currentUser.id;
        });
        console.log('Syncing categories to cloud (best-effort):', unique);
        try {
          const { error: catErr } = await promiseTimeout(
            state.supabaseClient.from('categories').upsert(unique, { onConflict: 'user_id,name,type', ignoreDuplicates: true }).then(r => r),
            15000
          );
          if (catErr) console.warn('Categories sync warning:', catErr);
        } catch (catErr) {
          console.warn('Categories sync timed out or failed:', catErr);
        }
      }
      if (newAccounts.length) {
        syncPhase = 'accounts';
        const unique = [...new Map(newAccounts.map(a => [a.name, a])).values()];
        unique.forEach(a => {
          a.user_id = state.currentUser.id;
        });
        console.log('Syncing accounts to cloud (best-effort):', unique);
        try {
          const { error: accErr } = await promiseTimeout(
            state.supabaseClient.from('accounts').upsert(unique, { onConflict: 'user_id,name', ignoreDuplicates: true }).then(r => r),
            15000
          );
          if (accErr) console.warn('Accounts sync warning:', accErr);
        } catch (accErr) {
          console.warn('Accounts sync timed out or failed:', accErr);
        }
      }

      // Insert transactions in small batches of 20 WITHOUT .select()
      const batchSize = 20;
      const totalRows = importedTransactions.length;
      const totalBatches = Math.ceil(totalRows / batchSize);

      for (let i = 0; i < totalRows; i += batchSize) {
        const batch = importedTransactions.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        syncPhase = `insert-batch-${batchNum}/${totalBatches}`;

        if (phaseLabel) {
          phaseLabel.textContent = isEn
            ? `📥 Cloud: Uploading ${batchNum}/${totalBatches}...`
            : `📥 Cloud: Ανέβασμα ${batchNum}/${totalBatches}...`;
        }
        const subPct = Math.round(65 + ((i + batch.length) / totalRows) * 25);
        if (progressBar) progressBar.style.width = subPct + '%';
        if (progressPct) progressPct.textContent = subPct + '%';

        const { error: insertError } = await promiseTimeout(
          state.supabaseClient.from('transactions').insert(batch).then(r => r),
          30000
        );
        if (insertError) throw insertError;
      }

      // Reload fresh data from cloud
      syncPhase = 'reload';
      if (phaseLabel) phaseLabel.textContent = isEn ? '🔄 Reloading...' : '🔄 Επαναφόρτωση...';
      if (progressBar) progressBar.style.width = '92%';

      const userId = state.currentUser.id;
      const partnerId = state.partnerProfile ? state.partnerProfile.id : null;
      let allFreshTransactions = [];
      let reloadPage = 0;
      const reloadPageSize = 1000;
      let reloadHasMore = true;

      while (reloadHasMore) {
        let reloadQuery = state.supabaseClient
          .from('transactions')
          .select('*')
          .order('date', { ascending: false })
          .range(reloadPage * reloadPageSize, (reloadPage + 1) * reloadPageSize - 1);

        if (partnerId) {
          reloadQuery = reloadQuery.or(`user_id.eq.${userId},user_id.eq.${partnerId}`);
        } else {
          reloadQuery = reloadQuery.eq('user_id', userId);
        }

        const { data: pageData, error: reloadErr } = await promiseTimeout(
          reloadQuery.then(r => r),
          30000
        );
        if (reloadErr) throw reloadErr;

        if (pageData && pageData.length > 0) {
          allFreshTransactions = allFreshTransactions.concat(pageData);
          if (pageData.length < reloadPageSize) {
            reloadHasMore = false;
          } else {
            reloadPage++;
          }
        } else {
          reloadHasMore = false;
        }
      }

      state.transactions = allFreshTransactions;
      localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
      updateHeaderSyncIcon('synced');
      cloudSuccess = true;

    } catch (err) {
      console.error(`Cloud sync failed at phase [${syncPhase}]:`, err);
      // DON'T block! Data is already saved locally
      updateHeaderSyncIcon('error');
      setTimeout(() => {
        alert((isEn 
          ? `⚠️ Data saved locally! Cloud sync failed at step [${syncPhase}]: ` 
          : `⚠️ Τα δεδομένα αποθηκεύτηκαν τοπικά! Το cloud απέτυχε στο βήμα [${syncPhase}]: `) 
          + (err.message || err));
      }, 300);
    }
  } else {
    // OFFLINE MODE
    setPhase(1, 50);
    const localImported = importedTransactions.map((t, idx) => ({
      ...t,
      id: 'local_import_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 5)
    }));
    
    if (clearFirst) {
      state.transactions = [...localImported];
    } else {
      state.transactions = [...state.transactions, ...localImported];
    }
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
    setPhase(2, 100);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 2: UPDATE UI
  // ═══════════════════════════════════════════════════════
  calculateInitialBalances();
  updateUI();
  cleanupButtons();
  closeModal('excel-modal');
  
  if (!state.isSupabaseEnabled || !state.supabaseClient || !state.currentUser) {
    const alertMsg = isEn
      ? `✅ Imported ${importedTransactions.length} transactions locally (Offline Mode)!\n(Skipped: ${skipped})`
      : `✅ Εισήχθησαν ${importedTransactions.length} συναλλαγές τοπικά (Offline Mode)!\n(Παραλείφθηκαν: ${skipped})`;
    alert(alertMsg);
  } else if (cloudSuccess) {
    const alertMsg = isEn
      ? `✅ Imported ${importedTransactions.length} transactions directly to Cloud!\n(Skipped: ${skipped})\n\nShowing: ${getMonthName(state.selectedMonth)} ${state.selectedYear}`
      : `✅ Εισήχθησαν ${importedTransactions.length} συναλλαγές απευθείας στο Cloud!\n(Παραλείφθηκαν: ${skipped})\n\nΕμφάνιση: ${getMonthName(state.selectedMonth)} ${state.selectedYear}`;
    alert(alertMsg);
  }
}

// ============================================================
// DATE / AMOUNT PARSERS
// ============================================================
function parseCSVText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (!lines.length) return [];

  const firstLine = lines[0];
  const delimiters = [',', ';', '\t', '|'];
  let delimiter = ',';
  let maxCount = -1;
  
  delimiters.forEach(d => {
    const count = (firstLine.match(new RegExp(d === '|' ? '\\|' : d, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      delimiter = d;
    }
  });

  function splitCSVLine(line, delim) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delim && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitCSVLine(lines[0], delimiter).map(h => {
    return h.replace(/^\uFEFF/, '').replace(/^["']|["']$/g, '').trim();
  });

  const parsedRows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i], delimiter).map(v => v.replace(/^["']|["']$/g, '').trim());
    const rowObj = {};
    headers.forEach((header, index) => {
      rowObj[header] = values[index] !== undefined ? values[index] : '';
    });
    parsedRows.push(rowObj);
  }
  return parsedRows;
}

function parseExcelDate(val) {
  if (!val && val !== 0) return null;
  if (typeof val === 'number') {
    // Excel serial date
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  let str = String(val).trim();
  if (!str) return null;
  
  const num = Number(str);
  if (!isNaN(num) && num > 30000 && num < 70000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }

  // Strip time components
  str = str.replace(/\b\d{1,2}:\d{2}(:\d{2})?(\s*(am|pm|AM|PM))?\b/g, '').trim();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const tokens = str.split(/[\s\/\.\,-]+/).filter(t => t);
  if (tokens.length < 2) return null;

  const monthMap = {
    'ιαν': 1, 'φεβ': 2, 'μαρ': 3, 'απρ': 4, 'μαι': 5, 'ιουν': 6, 'ιουλ': 7, 'αυγ': 8, 'σεπ': 9, 'οκτ': 10, 'νοε': 11, 'δεκ': 12,
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
  };

  function cleanToken(t) {
    return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  let day = null, month = null, year = null;

  for (let i = 0; i < tokens.length; i++) {
    const ct = cleanToken(tokens[i]);
    for (const [key, mNum] of Object.entries(monthMap)) {
      if (ct.startsWith(key)) {
        month = mNum;
        tokens.splice(i, 1);
        break;
      }
    }
    if (month !== null) break;
  }

  if (month === null && tokens.length === 3) {
    const t0 = parseInt(tokens[0], 10);
    const t1 = parseInt(tokens[1], 10);
    const t2 = parseInt(tokens[2], 10);

    if (!isNaN(t0) && !isNaN(t1) && !isNaN(t2)) {
      if (t0 > 1000) {
        year = t0;
        month = t1;
        day = t2;
      } else if (t2 > 1000) {
        year = t2;
        if (t1 > 12) {
          month = t0;
          day = t1;
        } else {
          day = t0;
          month = t1;
        }
      } else {
        year = t2 < 50 ? 2000 + t2 : 1900 + t2;
        day = t0;
        month = t1;
      }
    }
  } else if (month !== null && tokens.length === 2) {
    const val1 = parseInt(tokens[0], 10);
    const val2 = parseInt(tokens[1], 10);
    if (!isNaN(val1) && !isNaN(val2)) {
      if (val2 > 31) {
        day = val1;
        year = val2 > 1000 ? val2 : (val2 < 50 ? 2000 + val2 : 1900 + val2);
      } else if (val1 > 31) {
        day = val2;
        year = val1 > 1000 ? val1 : (val1 < 50 ? 2000 + val1 : 1900 + val1);
      } else {
        day = val1;
        year = val2 > 1000 ? val2 : (val2 < 50 ? 2000 + val2 : 1900 + val2);
      }
    }
  }

  if (day !== null && month !== null && year !== null) {
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    const dStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : dStr;
  }

  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().split('T')[0];
  }
  
  return null;
}

function parseExcelAmount(val) {
  if (typeof val === 'number') return val;
  if (!val && val !== 0) return 0;
  
  let str = String(val).trim();
  if (!str) return 0;
  
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.substring(1, str.length - 1).trim();
  }
  
  if (str.endsWith('-')) {
    isNegative = true;
    str = str.substring(0, str.length - 1).trim();
  }
  
  str = str.replace(/[€$£¥\s]/g, '');
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.substring(1);
  } else if (str.startsWith('+')) {
    str = str.substring(1);
  }

  if (str.includes('.') && str.includes(',')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length > 2) {
      str = str.replace(/,/g, '');
    } else {
      const afterComma = parts[1];
      if (afterComma && afterComma.length === 3 && parts[0].length <= 3) {
        str = str.replace(',', '');
      } else {
        str = str.replace(',', '.');
      }
    }
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length > 2) {
      str = str.replace(/\./g, '');
    }
  }

  let parsedVal = parseFloat(str);
  if (isNaN(parsedVal)) return 0;
  return isNegative ? -parsedVal : parsedVal;
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

function exportToExcel() {
  if (!state.transactions.length) {
    const msg = state.lang === 'en' ? 'No transactions to export!' : 'Δεν υπάρχουν συναλλαγές!';
    alert(msg);
    return;
  }
  const rows = state.transactions.map(t => ({
    'Ημερομηνία': t.date, 'Τύπος': t.type === 'expense' ? 'Expense' : (t.type === 'income' ? 'Income' : 'Transfer'),
    'Ποσό': t.amount, 'Κατηγορία': t.category, 'Υποκατηγορία': t.subcategory || '',
    'Λογαριασμός': t.account_from, 'Σημείωση': t.note || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Συναλλαγές');
  XLSX.writeFile(wb, `MoneyManager_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ============================================================
// FEATURE: TRANSACTION SEARCH AND FILTERS
// ============================================================
function openSearchOverlay() {
  ensureHistoryPushed();
  const overlay = document.getElementById('search-overlay');
  if (overlay) overlay.classList.add('active');

  // Populate dynamic dropdown filters
  populateSearchFilterDropdowns();

  // Reset inputs and run initial query to show all
  resetSearchFilters();
}

function closeSearchOverlay() {
  const overlay = document.getElementById('search-overlay');
  if (overlay) overlay.classList.remove('active');
  closeSearchBottomSheet();
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
      document.getElementById('search-filter-date-start-visual').value = document.getElementById('search-filter-date-start').value;
      document.getElementById('search-filter-date-end-visual').value = document.getElementById('search-filter-date-end').value;
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

function selectTypeSearchFilter(val) {
  const hiddenSelect = document.getElementById('search-filter-type');
  if (hiddenSelect) {
    hiddenSelect.value = val;
  }
  
  // Update Type Chip UI
  const chip = document.getElementById('search-chip-type');
  const label = chip.querySelector('.chip-label');
  if (val) {
    let text = val === 'expense' ? 'Έξοδο' : val === 'income' ? 'Έσοδο' : 'Μεταφορά';
    label.textContent = `✓ ${text}`;
    chip.classList.add('active');
  } else {
    label.textContent = 'Τύπος';
    chip.classList.remove('active');
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
      <span class="option-label">Όλοι οι λογαριασμοί</span>
      <i class="fa-solid fa-check option-check-icon"></i>
    </div>
  `;

  state.accounts.forEach(acc => {
    const isActive = acc.name === currentVal;
    html += `
      <div class="bottom-sheet-option ${isActive ? 'active' : ''}" onclick="selectAccountSearchFilter('${acc.name}')">
        <span class="option-label"><i class="fa-solid fa-wallet" style="margin-right: 8px; color: var(--accent);"></i> ${acc.name}</span>
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

  // Update Account Chip UI
  const chip = document.getElementById('search-chip-account');
  const label = chip.querySelector('.chip-label');
  if (val) {
    label.textContent = `✓ ${val}`;
    chip.classList.add('active');
  } else {
    label.textContent = 'Λογαριασμός';
    chip.classList.remove('active');
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

function populateSearchCategorySheet() {
  const container = document.getElementById('search-bottom-sheet-category-list');
  if (!container) return;

  const currentCat = document.getElementById('search-filter-category').value;
  const currentSub = document.getElementById('search-filter-subcategory').value;

  let html = `
    <div class="bottom-sheet-option ${currentCat === '' && currentSub === '' ? 'active' : ''}" onclick="selectCategorySearchFilter('', '')">
      <span class="option-label">Όλες οι κατηγορίες</span>
      <i class="fa-solid fa-check option-check-icon"></i>
    </div>
  `;

  // Get all unique category names
  const allCats = new Set();
  state.categories.forEach(c => allCats.add(c.name));
  state.transactions.forEach(t => { if (t.category) allCats.add(t.category); });
  const sortedCats = Array.from(allCats).sort();

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
            <span class="option-label"><i class="fa-solid fa-turn-up" style="transform: rotate(90deg); margin-right: 8px; color: var(--text-muted); font-size: 10px;"></i> ${subName}</span>
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

  // Update Category Chip UI
  const chip = document.getElementById('search-chip-category');
  const label = chip.querySelector('.chip-label');
  if (cat) {
    if (sub) {
      label.textContent = `✓ ${sub}`;
    } else {
      label.textContent = `✓ ${getCategoryDisplayName(cat)}`;
    }
    chip.classList.add('active');
  } else {
    label.textContent = 'Κατηγορία';
    chip.classList.remove('active');
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

function selectMemberSearchFilter(val) {
  const hiddenInput = document.getElementById('search-filter-member');
  if (hiddenInput) {
    hiddenInput.value = val;
  }

  // Update Member Chip UI
  const chip = document.getElementById('search-chip-member');
  const label = chip.querySelector('.chip-label');
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
    label.textContent = 'Μέλος';
    chip.classList.remove('active');
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

function applyAdvancedSearchFiltersVisual() {
  const minVal = document.getElementById('search-filter-amount-min-visual').value;
  const maxVal = document.getElementById('search-filter-amount-max-visual').value;
  const startVal = document.getElementById('search-filter-date-start-visual').value;
  const endVal = document.getElementById('search-filter-date-end-visual').value;

  document.getElementById('search-filter-amount-min').value = minVal;
  document.getElementById('search-filter-amount-max').value = maxVal;
  document.getElementById('search-filter-date-start').value = startVal;
  document.getElementById('search-filter-date-end').value = endVal;

  // Update Advanced Chip UI
  const chip = document.getElementById('search-chip-advanced');
  const hasValues = minVal || maxVal || startVal || endVal;
  if (hasValues) {
    chip.classList.add('active');
  } else {
    chip.classList.remove('active');
  }

  closeSearchBottomSheet();
  handleSearchChange();
}

function resetAdvancedSearchFiltersVisual() {
  document.getElementById('search-filter-amount-min-visual').value = '';
  document.getElementById('search-filter-amount-max-visual').value = '';
  document.getElementById('search-filter-date-start-visual').value = '';
  document.getElementById('search-filter-date-end-visual').value = '';

  document.getElementById('search-filter-amount-min').value = '';
  document.getElementById('search-filter-amount-max').value = '';
  document.getElementById('search-filter-date-start').value = '';
  document.getElementById('search-filter-date-end').value = '';

  const chip = document.getElementById('search-chip-advanced');
  chip.classList.remove('active');

  closeSearchBottomSheet();
  handleSearchChange();
}

function resetAllSearchChips() {
  const typeChip = document.getElementById('search-chip-type');
  if (typeChip) {
    typeChip.querySelector('.chip-label').textContent = 'Τύπος';
    typeChip.classList.remove('active');
  }
  const catChip = document.getElementById('search-chip-category');
  if (catChip) {
    catChip.querySelector('.chip-label').textContent = 'Κατηγορία';
    catChip.classList.remove('active');
  }
  const accChip = document.getElementById('search-chip-account');
  if (accChip) {
    accChip.querySelector('.chip-label').textContent = 'Λογαριασμός';
    accChip.classList.remove('active');
  }
  const memChip = document.getElementById('search-chip-member');
  if (memChip) {
    memChip.querySelector('.chip-label').textContent = 'Μέλος';
    memChip.classList.remove('active');
  }
  const advChip = document.getElementById('search-chip-advanced');
  if (advChip) {
    advChip.classList.remove('active');
  }
}

// Bind to window to ensure HTML inline onclick works perfectly
window.openSearchBottomSheet = openSearchBottomSheet;
window.closeSearchBottomSheet = closeSearchBottomSheet;
window.selectTypeSearchFilter = selectTypeSearchFilter;
window.selectAccountSearchFilter = selectAccountSearchFilter;
window.selectCategorySearchFilter = selectCategorySearchFilter;
window.selectMemberSearchFilter = selectMemberSearchFilter;
window.applyAdvancedSearchFiltersVisual = applyAdvancedSearchFiltersVisual;
window.resetAdvancedSearchFiltersVisual = resetAdvancedSearchFiltersVisual;
window.resetAllSearchChips = resetAllSearchChips;

function populateSearchFilterDropdowns() {
  // Populate accounts filter
  const accSelect = document.getElementById('search-filter-account');
  if (accSelect) {
    accSelect.innerHTML = '<option value="">Όλοι οι λογαριασμοί</option>';
    state.accounts.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc.name;
      opt.textContent = acc.name;
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
  document.getElementById('search-filter-date-start').value = '';
  document.getElementById('search-filter-date-end').value = '';
  
  // Reset member filter
  const memSel = document.getElementById('search-filter-member');
  if (memSel) memSel.value = '';

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


function handleSearchChange() {
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

  const query = searchInput.value.toLowerCase().trim();
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

  const filtered = state.transactions.filter(t => {
    // 1. Text Query (Search in Note, Category, Subcategory, Description, Account)
    if (query) {
      const note = (t.note || '').toLowerCase();
      const cat = (t.category || '').toLowerCase();
      const sub = (t.subcategory || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const acc = (t.account_from || '').toLowerCase();
      const accTo = (t.account_to || '').toLowerCase();
      
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

    // 5. Amount Range Filter
    const amt = parseFloat(t.amount) || 0;
    if (minAmt !== null && amt < minAmt) return false;
    if (maxAmt !== null && amt > maxAmt) return false;

    // 6. Date Range Filter
    const datePart = t.date.split('T')[0];
    if (dateStart && datePart < dateStart) return false;
    if (dateEnd && datePart > dateEnd) return false;

    return true;
  });

  // Sort transactions by date descending
  filtered.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  // Update Badge Count
  document.getElementById('search-results-count').textContent = filtered.length;

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

  const groups = {};
  transactions.forEach(t => {
    const dateKey = t.date.split('T')[0];
    if (!groups[dateKey]) groups[dateKey] = { transactions: [], income: 0, expense: 0 };
    groups[dateKey].transactions.push(t);
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') groups[dateKey].income += amt;
    else if (t.type === 'expense') groups[dateKey].expense += amt;
  });

  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(dateStr => {
    const group = groups[dateStr];
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const shortDay = getWeekdayName(dayOfWeek);
    const weekendClass = dayOfWeek === 6 ? ' saturday' : dayOfWeek === 0 ? ' sunday' : '';

    let rightTotals = '';
    if (group.income > 0)  rightTotals += `<span class="day-group-income">${getCurrencySymbol()} ${formatCurrency(group.income)}</span>`;
    if (group.expense > 0) rightTotals += `<span class="day-group-expense">${getCurrencySymbol()} ${formatCurrency(group.expense)}</span>`;

    const header = document.createElement('div');
    header.className = 'day-header';
    header.innerHTML = `
      <div class="day-header-left">
        <span class="day-num">${d}</span>
        <div>
          <span class="day-name${weekendClass}">${shortDay}</span>
          <span class="day-month">${getMonthName(m - 1, true)} ${y}</span>
        </div>
      </div>
      <div class="day-header-right">${rightTotals}</div>`;
    container.appendChild(header);

    group.transactions.forEach(t => {
      const catInfo = getCategoryInfo(t.category, t.type);
      const item = document.createElement('div');
      item.className = 'transaction-item';
      item.onclick = () => {
        closeSearchOverlay();
        openEditTransactionModal(t);
      };

      let amountClass = 'trans-amount';
      let accountText = t.account_from || '';
      if (t.type === 'expense')       { amountClass += ' expense'; }
      else if (t.type === 'income')   { amountClass += ' income'; }
      else if (t.type === 'transfer') { amountClass += ' transfer'; accountText = `${t.account_from} → ${t.account_to}`; }

      const displayTitle = (t.note && t.note.trim()) ? t.note.trim()
                         : (t.description && t.description.trim()) ? t.description.trim()
                         : (t.subcategory && t.subcategory.trim()) ? t.subcategory.trim()
                         : (t.category || '');

      let memberBadge = '';
      if (state.userProfile && state.userProfile.family_id && t.user_id) {
        const creator = state.familyProfiles.find(p => p.id === t.user_id);
        if (creator) {
          const initials = getMemberInitials(creator);
          const gradient = getMemberColorGradient(creator.id);
          const creatorName = creator.display_name || creator.email.split('@')[0];
          memberBadge = `
            <span class="trans-member-badge" style="background:${gradient};color:white;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;font-size:7.5px;font-weight:800;text-transform:uppercase;margin-left:6px;vertical-align:middle;box-shadow:0 1px 3px rgba(0,0,0,0.15);border:none;" title="${state.lang === 'el' ? 'Προστέθηκε από: ' : 'Added by: '}${creatorName}">
              ${initials}
            </span>
          `;
        }
      } else {
        const isPartner = state.partnerProfile && t.user_id === state.partnerProfile.id;
        memberBadge = isPartner ? ` <i class="fa-solid fa-user-group partner-badge-icon" title="${state.lang === 'el' ? 'Προστέθηκε από τον σύντροφο' : 'Added by partner'}"></i>` : '';
      }

      item.innerHTML = `
        <div class="trans-left">
          <div class="trans-category-container">
            <div class="trans-cat-icon">${catInfo.icon || '💰'}</div>
            <div class="trans-cat-name">${getCategoryDisplayName(catInfo.name) || ''}</div>
            ${t.subcategory ? `<div class="trans-sub-name">${t.subcategory}</div>` : ''}
          </div>
          <div class="trans-details">
            <span class="trans-title">${displayTitle}${memberBadge}</span>
            <span class="trans-acc-label">${accountText}</span>
          </div>
        </div>
        <div class="${amountClass}">${getCurrencySymbol()} ${formatCurrency(t.amount)}</div>`;
      container.appendChild(item);
    });
  });
}

// ============================================================
// FEATURE: MONTH GRID PICKER MODAL
// ============================================================
function openMonthPicker() {
  state.monthPickerYear = state.selectedYear;
  document.getElementById('month-picker-year').textContent = state.monthPickerYear;
  
  renderMonthPicker();
  openModal('month-picker-modal');
}

function adjustMonthPickerYear(direction) {
  state.monthPickerYear += direction;
  document.getElementById('month-picker-year').textContent = state.monthPickerYear;
  renderMonthPicker();
}

function renderMonthPicker() {
  const container = document.getElementById('month-picker-grid-container');
  if (!container) return;
  container.innerHTML = '';

  for (let index = 0; index < 12; index++) {
    const monLabel = getMonthName(index, true);
    const cell = document.createElement('div');
    cell.className = 'month-picker-item';
    
    // Highlight if active month
    if (state.selectedMonth === index && state.selectedYear === state.monthPickerYear) {
      cell.classList.add('active');
    }
    
    cell.textContent = monLabel;
    cell.onclick = () => selectMonthPickerMonth(index);
    container.appendChild(cell);
  }
}

function selectMonthPickerMonth(monthIndex) {
  state.selectedMonth = monthIndex;
  state.selectedYear = state.monthPickerYear;
  
  // Sync to Stats date
  state.statsDate.setFullYear(state.selectedYear);
  state.statsDate.setMonth(state.selectedMonth);

  // Update UI components
  updateUI();
  
  // Update stats tab (if active or loaded)
  renderStatsTab();

  closeModal('month-picker-modal');
}

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
    if (container.scrollTop === 0) {
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
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;
  
  const msg = ids.length === 1 ? 'Να διαγραφεί η επιλεγμένη συναλλαγή;' : `Να διαγραφούν οι ${ids.length} επιλεγμένες συναλλαγές;`;
  if (!confirm(msg)) return;
  
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      const { error } = await state.supabaseClient.from('transactions').delete().in('id', ids);
      if (error) throw error;
    } catch (err) {
      console.error('Bulk delete failed:', err);
      state.transactions = state.transactions.filter(t => !ids.includes(t.id));
      localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
    }
  } else {
    state.transactions = state.transactions.filter(t => !ids.includes(t.id));
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
  }
  
  await loadData();
  exitSelectionMode();
  updateUI();
}

window.enterSelectionMode = enterSelectionMode;
window.exitSelectionMode = exitSelectionMode;
window.toggleSelectAll = toggleSelectAll;
window.deleteSelectedTransactions = deleteSelectedTransactions;

function initSwipeToBack() {
  const TAB_ORDER = ['trans', 'stats', 'accounts', 'more'];
  let bsStartX = 0, bsStartY = 0, bsActive = false, bsSwiping = null;
  let bsDragging = false;
  const EDGE_ZONE = 35;    // px from left edge to detect back swipe start
  const COMMIT_RATIO = 0.30; // 30% of screen width to commit

  // Setup system history state to prevent exiting the app on system back gesture/button
  history.pushState({ appState: 'active' }, '', window.location.pathname + window.location.search);
  state.historyPushed = true;

  window.addEventListener('popstate', (e) => {
    const handled = triggerBackAction();
    if (handled) {
      // Re-push to keep intercepting subsequent back actions
      history.pushState({ appState: 'active' }, '', window.location.pathname + window.location.search);
      state.historyPushed = true;
    } else {
      state.historyPushed = false;
    }
  });

  function hasActiveOverlay() {
    // Check if any modal, keypad, search, or selection mode is active
    const keypad = document.getElementById('custom-calculator-keypad');
    if (keypad && keypad.classList.contains('active')) return true;
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    if (activeModals.length > 0) return true;
    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay && searchOverlay.classList.contains('active')) return true;
    if (state.selectionMode) return true;
    return false;
  }

  function triggerBackAction() {
    // 1. Close calculator keypad if active
    const keypad = document.getElementById('custom-calculator-keypad');
    if (keypad && keypad.classList.contains('active')) {
      closeCalculatorKeypad();
      return true;
    }

    // 2. Close active modals
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
    
    // 6. On trans tab with nothing to close — exit the app
    return false;
  }

  // --- Interactive drag-to-go-back gesture ---
  let currentScreen = null;
  let prevScreen = null;
  let screenWidth = 0;

  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    bsStartX = touch.clientX;
    bsStartY = touch.clientY;
    bsSwiping = null;
    bsDragging = false;
    bsActive = bsStartX <= EDGE_ZONE;
    currentScreen = null;
    prevScreen = null;
    screenWidth = window.innerWidth;
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

    // If there are overlays active, just show the indicator bubble for closing them
    if (hasActiveOverlay()) {
      // Don't do full-screen drag for overlays, just use visual hint
      return;
    }

    // Start drag: set up screens for interactive slide
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
          prevScreen.style.opacity = '1';
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
    const clampedDx = Math.max(0, Math.min(dx, screenWidth));
    const progress = clampedDx / screenWidth;

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

    const currentTabIdx = TAB_ORDER.indexOf(state.activeTab);

    if (committed && currentTabIdx > 0) {
      // Animate current screen off to the right
      const dur = '0.22s';
      if (currentScreen) {
        currentScreen.style.transition = `transform ${dur} cubic-bezier(0.2, 0.8, 0.3, 1), opacity ${dur} ease`;
        currentScreen.style.transform = `translateX(${screenWidth}px)`;
        currentScreen.style.opacity = '0';
      }
      if (prevScreen) {
        prevScreen.style.transition = `transform ${dur} cubic-bezier(0.2, 0.8, 0.3, 1), opacity ${dur} ease`;
        prevScreen.style.transform = 'translateX(0)';
        prevScreen.style.opacity = '1';
      }

      setTimeout(() => {
        // Clean up styles
        if (currentScreen) {
          currentScreen.style.display = 'none';
          currentScreen.style.visibility = 'hidden';
          currentScreen.classList.remove('active');
          cleanupDragStyles(currentScreen);
        }
        if (prevScreen) {
          cleanupDragStyles(prevScreen);
          prevScreen.classList.add('active');
        }

        // Update state
        const prevTabName = TAB_ORDER[currentTabIdx - 1];
        state.activeTab = prevTabName;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.getAttribute('data-tab') === prevTabName));

        // Ensure history is correct
        if (prevTabName === 'trans') {
          state.historyPushed = false;
        } else {
          ensureHistoryPushed();
        }

        // Render the new tab with deferred heavy rendering to prevent flicker
        if (prevTabName === 'trans') {
          const today = new Date();
          state.selectedMonth = today.getMonth();
          state.selectedYear = today.getFullYear();
          state.statsDate.setFullYear(state.selectedYear);
          state.statsDate.setMonth(state.selectedMonth);
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

        currentScreen = null;
        prevScreen = null;
      }, 230);
    } else if (committed && currentTabIdx === 0) {
      // On trans tab - exit the app
      cleanupDragStyles(currentScreen);
      currentScreen = null;
      prevScreen = null;
      // Let the browser handle the back navigation to exit
      if (state.historyPushed) {
        history.back();
      } else {
        history.back();
      }
    } else {
      // Snap back - not committed
      const dur = '0.2s';
      if (currentScreen) {
        currentScreen.style.transition = `transform ${dur} cubic-bezier(0.2, 0.8, 0.3, 1), opacity ${dur} ease`;
        currentScreen.style.transform = 'translateX(0)';
        currentScreen.style.opacity = '1';
      }
      if (prevScreen) {
        prevScreen.style.transition = `transform ${dur} cubic-bezier(0.2, 0.8, 0.3, 1), opacity ${dur} ease`;
        prevScreen.style.transform = 'translateX(-30%)';
        prevScreen.style.opacity = '0.6';
      }

      setTimeout(() => {
        cleanupDragStyles(currentScreen);
        if (prevScreen) {
          prevScreen.style.display = 'none';
          prevScreen.style.visibility = 'hidden';
          cleanupDragStyles(prevScreen);
        }
        currentScreen = null;
        prevScreen = null;
      }, 210);
    }

    bsDragging = false;
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
      // For full-screen drag: commit if past threshold
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
    div.innerHTML = `<span>${sub}</span>`;
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

function initSwipeMonthNavigation() {
  const appContent = document.querySelector('.app-content');
  if (!appContent) return;

  let startX = 0;
  let startY = 0;
  let touchActive = false;
  let isSwipingHorizontal = null;
  const edgeThreshold = 60; // Ignore swipe starting within 60px of left edge
  const dragThreshold = 70; // Horizontal swipe minimum distance (px) to trigger

  appContent.addEventListener('touchstart', (e) => {
    // Only capture if no modals are active
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    const searchOverlay = document.getElementById('search-overlay');
    const isSearchActive = searchOverlay && searchOverlay.classList.contains('active');
    if (activeModals.length > 0 || isSearchActive) {
      touchActive = false;
      return;
    }
    
    // Only capture if active tab is 'trans' or 'stats'
    if (state.activeTab !== 'trans' && state.activeTab !== 'stats') {
      touchActive = false;
      return;
    }

    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    
    // Ignore if starting from the LEFT EDGE (reserved for back-swipe navigation)
    if (startX < edgeThreshold) {
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
          isSwipingHorizontal = true;
          // Set transition to none on the active tab element for direct tracking
          const activeTab = document.querySelector('.tab-screen.active');
          if (activeTab) {
            activeTab.style.transition = 'none';
          }
        } else {
          isSwipingHorizontal = false;
          touchActive = false;
        }
      }
    }
    
    if (isSwipingHorizontal === true) {
      if (e.cancelable) {
        e.preventDefault();
      }
      // Only track finger on the list content, keep header/summary stable
      const listEl = state.activeTab === 'trans'
        ? document.getElementById('transactions-list')
        : state.activeTab === 'stats'
          ? document.getElementById('stats-breakdown-list')
          : null;
      if (listEl) {
        const cappedDeltaX = Math.sign(deltaX) * Math.min(Math.abs(deltaX), window.innerWidth * 0.5);
        listEl.style.transform = `translateX(${cappedDeltaX}px)`;
        listEl.style.opacity = `${Math.max(0.4, 1 - Math.abs(deltaX) / (window.innerWidth * 1.2))}`;
      }
    }
  }, { passive: false });

  appContent.addEventListener('touchend', (e) => {
    if (!touchActive) return;
    touchActive = false;
    
    if (isSwipingHorizontal === true) {
      const touch = e.changedTouches[0] || e.touches[0];
      const deltaX = touch.clientX - startX;
      
      if (Math.abs(deltaX) >= dragThreshold) {
        const direction = deltaX > 0 ? -1 : 1; // swiping right deltaX > 0 means prev month (-1), swiping left means next month (1)
        if (state.activeTab === 'trans') {
          navigateMonth(direction, deltaX);
        } else if (state.activeTab === 'stats') {
          adjustStatsPeriod(direction, deltaX);
        }
      } else {
        // Cancel swipe - snap the list back to center
        const listEl = state.activeTab === 'trans'
          ? document.getElementById('transactions-list')
          : document.getElementById('stats-breakdown-list');
        if (listEl) {
          listEl.style.transition = 'transform 0.3s cubic-bezier(0.15, 0.85, 0.45, 1), opacity 0.3s cubic-bezier(0.15, 0.85, 0.45, 1)';
          listEl.style.transform = 'translateX(0)';
          listEl.style.opacity = '1';
          setTimeout(() => {
            listEl.style.transition = '';
            listEl.style.transform = '';
            listEl.style.opacity = '';
          }, 300);
        }
      }
    }
    isSwipingHorizontal = null;
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
  const outX = direction > 0 ? -width * 0.55 : width * 0.55;

  function animateEl(el, fromX, toX, opacity, duration, easing, cb) {
    if (!el) { if (cb) cb(); return; }
    el.style.transition = 'none';
    el.style.transform = `translateX(${fromX}px)`;
    el.style.opacity = String(opacity[0]);
    void el.offsetWidth;
    el.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;
    el.style.transform = `translateX(${toX}px)`;
    el.style.opacity = String(opacity[1]);
    setTimeout(() => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; if (cb) cb(); }, duration);
  }

  if (listEl) {
    // Slide current content out
    const startFrom = startingDeltaX !== 0 ? startingDeltaX : 0;
    animateEl(listEl, startFrom, outX, [1, 0], 160, 'cubic-bezier(0.4, 0, 0.6, 1)', () => {
      callback();
      // Slide new content in from opposite direction
      const inX = -outX;
      const newListEl = state.activeTab === 'trans'
        ? document.getElementById('transactions-list')
        : document.getElementById('stats-breakdown-list');
      animateEl(newListEl, inX, 0, [0, 1], 240, 'cubic-bezier(0.2, 0.8, 0.4, 1)', null);
    });
  } else {
    callback();
  }
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
    state.statsDate.setFullYear(state.selectedYear);
    state.statsDate.setMonth(state.selectedMonth);
    updateUI();
  }, startingDeltaX);
}

function initRippleEffects() {
  document.addEventListener('pointerdown', (e) => {
    const target = e.target.closest('button, .nav-item, .transaction-item, .calc-key-btn, .fab, .settings-card, .settings-list-item, .stats-tab-btn, .stats-dropdown-item');
    if (!target) return;

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
  }, { passive: true });
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

function initSettingsFromStorage() {
  const monthStart = localStorage.getItem('app_month_start') || '1';
  const weekStart = localStorage.getItem('app_week_start') || '1';
  const currency = localStorage.getItem('app_currency') || 'EUR';
  const theme = localStorage.getItem('app_theme') || 'dark';
  const appLockEnabled = localStorage.getItem('app_lock_enabled') === 'true';

  const monthSelect = document.getElementById('settings-month-start');
  const weekSelect = document.getElementById('settings-week-start');
  const currencySelect = document.getElementById('settings-currency');
  const themeSelect = document.getElementById('settings-theme');
  const appLockCheckbox = document.getElementById('settings-app-lock');

  if (monthSelect) monthSelect.value = monthStart;
  if (weekSelect) weekSelect.value = weekStart;
  if (currencySelect) currencySelect.value = currency;
  if (themeSelect) themeSelect.value = theme;
  if (appLockCheckbox) appLockCheckbox.checked = appLockEnabled;

  applyTheme(theme);
  checkBiometricsSupport();
  
  if (appLockEnabled) {
    showLockScreen();
  }
}

// Bind to window for HTML event accessibility
window.changeMonthStartSetting = changeMonthStartSetting;
window.changeWeekStartSetting = changeWeekStartSetting;
window.changeCurrencySetting = changeCurrencySetting;
window.getCurrencySymbol = getCurrencySymbol;
window.initSettingsFromStorage = initSettingsFromStorage;

// Theme & Appearance Helpers
function applyTheme(theme) {
  document.body.classList.remove('theme-oled', 'theme-light', 'theme-emerald', 'theme-ocean', 'theme-pink');
  if (theme !== 'dark') {
    document.body.classList.add(`theme-${theme}`);
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
    
    if (localStorage.getItem('app_biometrics_enabled') === 'true') {
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
  if (window.PublicKeyCredential && container && toggle) {
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (available) {
        container.style.display = 'flex';
        const enabled = localStorage.getItem('app_biometrics_enabled') === 'true';
        toggle.checked = enabled;
      }
    } catch (e) {
      console.log('Biometrics support check failed:', e);
    }
  }
}

async function registerBiometrics() {
  try {
    const randomChallenge = new Uint8Array(16);
    window.crypto.getRandomValues(randomChallenge);
    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const credentialOptions = {
      publicKey: {
        challenge: randomChallenge,
        rp: { name: "Budget Assistant" },
        user: {
          id: userId,
          name: "user@moneymanager.local",
          displayName: "Local User"
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: {
          userVerification: "required",
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
  }
  return false;
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
        userVerification: "required",
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
    alert("Το PIN πρέπει να είναι ακριβώς 4 ψηφία!");
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
      alert("✅ Το κλείδωμα ενεργοποιήθηκε επιτυχώς!");
      checkBiometricsSupport();
    } else {
      alert("Τα PIN δεν ταιριάζουν! Προσπαθήστε ξανά.");
      pinSetupStep = 1;
      tempSetupPin = "";
      pinField.value = "";
      document.getElementById('pin-modal-title').textContent = "Ορισμός PIN";
      document.getElementById('pin-modal-desc').textContent = "Εισάγετε ένα 4ψήφιο PIN για το κλείδωμα της εφαρμογής.";
    }
  }
}

function toggleAppLock(checked) {
  if (checked) {
    openPinModal();
  } else {
    const currentPin = localStorage.getItem('app_pin');
    const entered = prompt("Εισάγετε το τρέχον PIN σας για να απενεργοποιήσετε το κλείδωμα:");
    if (entered === currentPin) {
      localStorage.removeItem('app_lock_enabled');
      localStorage.removeItem('app_pin');
      localStorage.removeItem('app_biometrics_enabled');
      localStorage.removeItem('biometric_cred_id');
      document.getElementById('settings-biometrics-container').style.display = 'none';
      document.getElementById('settings-biometrics').checked = false;
      alert("🔓 Το κλείδωμα απενεργοποιήθηκε.");
    } else {
      if (entered !== null) {
        alert("Λάθος PIN!");
      }
      document.getElementById('settings-app-lock').checked = true;
    }
  }
}

async function toggleBiometrics(checked) {
  if (checked) {
    alert("Θα σας ζητηθεί να επιβεβαιώσετε την ταυτότητά σας (Face ID/Αποτύπωμα) στη συσκευή σας για να συνδεθεί με την εφαρμογή.");
    const registered = await registerBiometrics();
    if (registered) {
      localStorage.setItem('app_biometrics_enabled', 'true');
      alert("✅ Το Face ID / Αποτύπωμα ενεργοποιήθηκε επιτυχώς!");
    } else {
      localStorage.removeItem('app_biometrics_enabled');
      document.getElementById('settings-biometrics').checked = false;
      alert("❌ Αποτυχία σύνδεσης βιομετρικών.");
    }
  } else {
    localStorage.removeItem('app_biometrics_enabled');
    localStorage.removeItem('biometric_cred_id');
    alert("🔓 Τα βιομετρικά απενεργοποιήθηκαν.");
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
  try {
    const { error } = await state.supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) throw error;
  } catch (err) {
    console.error('Google auth failed:', err);
    showAuthStatus('❌ Σφάλμα: ' + (err.message || 'Αποτυχία σύνδεσης με Google.'));
  }
}

async function handleLogout() {
  if (!confirm('Είστε σίγουροι ότι θέλετε να αποσυνδεθείτε από το λογαριασμό σας;')) return;
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
    
    alert('👋 Αποσυνδεθήκατε με επιτυχία!');
    // Reload page to clear memory state
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
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="font-size:13px;font-weight:700;color:var(--text-primary);">${familyName}</div>
          <button onclick="promptRenameFamilyGroup()" class="icon-btn" style="color:var(--text-muted);font-size:11px;padding:2px;cursor:pointer;background:none;border:none;" title="${state.lang === 'el' ? 'Μετονομασία' : 'Rename'}">
            <i class="fa-solid fa-pen" style="font-size:10px;"></i>
          </button>
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
  const name = m.display_name || m.email.split('@')[0] || '';
  if (name.length >= 2) {
    return name.substring(0, 2);
  }
  return name.substring(0, 1) || '?';
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

function enterGuestMode() {
  state.guestMode = true;
  localStorage.setItem('auth_guest_mode', 'true');
  
  // Hide auth overlay
  const authOverlay = document.getElementById('auth-overlay');
  if (authOverlay) authOverlay.style.display = 'none';
  
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
  loadData();
  updateUI();
  renderPartnerSection();
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
        if (copy.is_shared === undefined || copy.is_shared === null) {
          copy.is_shared = false;
        }
        return copy;
      });
      
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

async function processSyncQueue() {
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
        const { description, ...dbPayload } = transaction;
        
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
    
    await loadData();
    updateUI();
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

function handleRealtimeTransactionChange(payload) {
  console.log('Realtime transaction event received:', payload.eventType, payload.new, payload.old);
  
  let trans = [...state.transactions];
  const eventType = payload.eventType;
  
  if (eventType === 'INSERT') {
    const newTrans = payload.new;
    if (!trans.some(t => t.id === newTrans.id)) {
      trans.unshift(newTrans);
    }
  } else if (eventType === 'UPDATE') {
    const updatedTrans = payload.new;
    trans = trans.map(t => t.id === updatedTrans.id ? updatedTrans : t);
  } else if (eventType === 'DELETE') {
    const deletedId = payload.old.id;
    trans = trans.filter(t => t.id !== deletedId);
  }
  
  trans.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  state.transactions = trans;
  localStorage.setItem('offline_transactions', JSON.stringify(trans));
  
  calculateInitialBalances();
  updateUI();
  
  if (eventType === 'INSERT' && payload.new.user_id !== state.currentUser.id) {
    showSyncToast('📥 Νέα κίνηση προστέθηκε από άλλο μέλος', 3000);
  }
}

function handleRealtimeCategoryChange(payload) {
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
    syncing: '#ffb300',
    success: '#4caf50',
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
}

async function forceSyncNow(silent = false) {
  if (!state.supabaseClient || !state.currentUser) {
    if (!silent) alert(state.lang === 'en' ? 'Please log in first to sync.' : 'Παρακαλώ συνδεθείτε πρώτα για συγχρονισμό.');
    return false;
  }
  
  state.syncStatus = 'syncing';
  updateSyncStatusIndicator();
  
  try {
    const userId = state.currentUser.id;
    const partnerId = state.partnerProfile ? state.partnerProfile.id : null;
    const familyId = state.userProfile ? state.userProfile.family_id : null;
    
    const userFilter = familyId 
      ? `family_id.eq.${familyId}` 
      : (partnerId ? `user_id.eq.${userId},user_id.eq.${partnerId}` : `user_id.eq.${userId}`);

    // 1. Fetch categories and accounts
    const [catsRes, accsRes] = await Promise.all([
      state.supabaseClient.from('categories').select('*').or(userFilter),
      state.supabaseClient.from('accounts').select('*').or(userFilter),
    ]);
    
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
        
      if (familyId) {
        transQuery = transQuery.eq('family_id', familyId);
      } else if (partnerId) {
        transQuery = transQuery.or(`user_id.eq.${userId},user_id.eq.${partnerId}`);
      } else {
        transQuery = transQuery.eq('user_id', userId);
      }

      const { data: pageData, error: pageErr } = await transQuery;
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
    await processSyncQueue();
    
    // 4. Keep local pending transactions
    const localPending = (state.transactions || []).filter(t => t.id && String(t.id).startsWith('local_'));
    
    // 5. Update state
    const prevCount = (state.transactions || []).filter(t => t.id && !String(t.id).startsWith('local_')).length;
    state.transactions = [...allTransactions, ...localPending];
    state.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
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
    
    calculateInitialBalances();
    updateUI();
    
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
  }
}

function stopPartnerSyncPolling() {
  if (_partnerSyncInterval) {
    clearInterval(_partnerSyncInterval);
    _partnerSyncInterval = null;
  }
}

function startPartnerSyncPolling() {
  if (_partnerSyncInterval) clearInterval(_partnerSyncInterval);
  _partnerSyncInterval = setInterval(() => {
    if (!state.supabaseClient || !state.currentUser) return;
    forceSyncNow(true);
  }, 15000); // every 15 seconds
}

// Sync on visibility change (user switches back to tab/app)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.currentUser && state.supabaseClient) {
    // Small delay to let the browser settle
    setTimeout(() => forceSyncNow(true), 500);
  }
});

// Start polling when app loads if user is logged in
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (state.currentUser) {
      startPartnerSyncPolling();
      setupSupabaseRealtimeSubscription();
      processSyncQueue();
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

  const partnerStatus = document.getElementById('profile-partner-status');
  if (partnerStatus) {
    if (state.userProfile && state.userProfile.partner_id) {
      const partnerEmail = state.partnerProfile?.email || 'Συνδεδεμένος';
      partnerStatus.textContent = partnerEmail;
      partnerStatus.style.color = '#34c759';
    } else {
      partnerStatus.textContent = 'Μη συνδεδεμένος';
      partnerStatus.style.color = 'var(--text-secondary)';
    }
  }

  const syncStatus = document.getElementById('profile-sync-status');
  if (syncStatus) {
    syncStatus.textContent = navigator.onLine ? 'Συνδεδεμένο' : 'Εκτός σύνδεσης';
  }

  const themeStatus = document.getElementById('profile-theme-status');
  if (themeStatus) {
    const currentTheme = localStorage.getItem('app_theme') || 'dark';
    const themeNames = {
      'dark': 'Premium Dark',
      'oled': 'OLED Black',
      'light': 'Classic Light',
      'emerald': 'Emerald Forest',
      'ocean': 'Ocean Breeze',
      'pink': 'Blossom Pink'
    };
    themeStatus.textContent = themeNames[currentTheme] || currentTheme;
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
  exportToExcel();
}

function cycleThemeFromProfile() {
  const themes = ['dark', 'oled', 'light', 'emerald', 'ocean', 'pink'];
  const currentTheme = localStorage.getItem('app_theme') || 'dark';
  let nextIdx = (themes.indexOf(currentTheme) + 1) % themes.length;
  const nextTheme = themes[nextIdx];

  const themeSelect = document.getElementById('settings-theme');
  if (themeSelect) {
    themeSelect.value = nextTheme;
  }
  
  changeThemeSetting(nextTheme);

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

function updateSupabaseUserModal() {
  const container = document.getElementById('supabase-user-settings');
  if (!container) return;

  if (state.guestMode || !state.currentUser) {
    container.innerHTML = `
      <div style="text-align: center; padding: 10px 0;">
        <div style="font-size: 40px; margin-bottom: 12px;">☁️</div>
        <h4 style="margin-bottom: 8px; font-weight: 700; color: var(--text-main);">Λειτουργία Επισκέπτη (Offline)</h4>
        <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 20px;">
          Αυτή τη στιγμή τα δεδομένα σας αποθηκεύονται μόνο τοπικά στη συσκευή σας. Συνδεθείτε στο Cloud για να ενεργοποιήσετε αυτόματο backup και κοινό πορτοφόλι σε πραγματικό χρόνο με τον/την συνεργάτη σας.
        </p>
        <button type="button" class="btn btn-primary btn-block" onclick="closeModal('supabase-modal'); showAuthOverlay();" style="padding: 12px;">
          <i class="fa-solid fa-right-to-bracket" style="margin-right: 8px;"></i>Σύνδεση ή Εγγραφή
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="text-align: center; padding: 10px 0;">
        <div style="font-size: 40px; margin-bottom: 12px;">☁️✅</div>
        <h4 style="margin-bottom: 4px; font-weight: 700; color: var(--text-main);">Συνδεδεμένος στο Cloud</h4>
        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 20px; word-break: break-all;">
          ${state.currentUser.email}
        </div>
        
        <div class="ios-settings-group" style="margin-bottom: 20px; text-align: left;">
          <div class="ios-settings-row" onclick="triggerProfileSyncFromModal()">
            <div class="ios-row-left">
              <div class="ios-row-icon icon-sync"><i class="fa-solid fa-cloud-arrow-up"></i></div>
              <span class="ios-row-label">Συγχρονισμός Τώρα</span>
            </div>
            <div class="ios-row-right">
              <i class="fa-solid fa-arrows-rotate ios-row-arrow" id="modal-sync-spinner"></i>
            </div>
          </div>
        </div>

        <button type="button" class="btn btn-secondary btn-block" onclick="closeModal('supabase-modal'); handleLogout();" style="color: var(--accent); background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); padding: 11px;">
          <i class="fa-solid fa-right-from-bracket" style="margin-right: 8px;"></i>Αποσύνδεση Λογαριασμού
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
    document.documentElement.style.setProperty('--safe-area-bottom', '16px');
  }
});