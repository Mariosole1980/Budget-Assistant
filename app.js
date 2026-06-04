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

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

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
    app_version: 'Έκδοση 1.0.0 (build v140)',
    fab_add_transaction: 'Προσθήκη Συναλλαγής',
    yearly_savings_title: 'Ετήσια Αποταμίευση',
    period_label: 'Περίοδος',
    sync_now_btn: 'Συγχρονισμός Τώρα',
    search_btn_clear: 'Καθαρισμός',
    search_results_header: 'Αποτελέσματα',
    search_title_type: 'Επιλογή Τύπου',
    search_title_category: 'Επιλογή Κατηγορίας',
    search_title_account: 'Επιλογή Λογαριασμού',
    search_title_member: 'Επιλογή Μέλους',
    search_title_advanced: 'Σύνθετα Φίλτρα',
    search_all_types: 'Όλοι οι τύποι',
    search_chip_type: 'Τύπος',
    search_chip_category: 'Κατηγορία',
    search_chip_account: 'Λογαριασμός',
    search_chip_member: 'Μέλος',
    search_chip_advanced: 'Σύνθετη',
    search_placeholder: 'Αναζήτηση σε κινήσεις, σημειώσεις...',
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
    excel_dep_btn: 'Κατάλαβα'
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
    app_version: 'Version 1.0.0 (build v140)',
    fab_add_transaction: 'Add Transaction',
    yearly_savings_title: 'Yearly Savings',
    period_label: 'Period',
    sync_now_btn: 'Sync Now',
    search_btn_clear: 'Clear',
    search_results_header: 'Results',
    search_title_type: 'Select Type',
    search_title_category: 'Select Category',
    search_title_account: 'Select Account',
    search_title_member: 'Select Member',
    search_title_advanced: 'Advanced Filters',
    search_all_types: 'All types',
    search_chip_type: 'Type',
    search_chip_category: 'Category',
    search_chip_account: 'Account',
    search_chip_member: 'Member',
    search_chip_advanced: 'Advanced',
    search_placeholder: 'Search in transactions, notes...',
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
    excel_dep_btn: 'I Understand'
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

  async save(transactionId, blob) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      tx.objectStore(this.STORE_NAME).put({ id: transactionId, blob, savedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  },

  async load(transactionId) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const req = tx.objectStore(this.STORE_NAME).get(transactionId);
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
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

// Pending receipt file for the current transaction form session
let _pendingReceiptFile = null;
let _pendingReceiptDeleted = false;

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
  if (isIOS) {
    document.body.classList.add('is-ios');
  }
  // Set initial scroll isolation class for default trans tab
  document.body.classList.add('trans-tab-active');
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
      
      // Clear URL parameters so they don't persist or trigger reload loops
      if (window.location.hash || window.location.search) {
        window.history.replaceState(null, null, window.location.pathname);
      }
      
      // Hide auth overlay & reset elements
      if (authOverlay) authOverlay.style.display = 'none';
      toggleLoader(false);
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
    if (typeof updateUI === 'function') {
      updateUI();
    }
  }
}

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

      // Run automatic duplicate / corrupt category cleanup in background
      cleanDuplicateCategories().catch(e => console.warn('Automatic categories cleanup error:', e));

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
  cleanDuplicateCategories().catch(e => console.warn('Offline automatic categories cleanup error:', e));
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

async function deleteTransaction(id) {
  // 1. Clean up local receipt photo from IndexedDB
  try {
    await ReceiptStorage.remove(id);
  } catch (err) {
    console.warn('Failed to remove receipt during transaction delete:', err);
  }
  
  // 2. Optimistically delete from local state and update UI
  deleteTransactionOffline(id);
  calculateInitialBalances();
  updateUI();

  // 3. Perform background delete
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
  // Render all tabs sequentially to keep them fully synchronized in the background
  renderTransactionsTab();
  renderStatsTab();
  renderAccountsTab();
  renderPartnerSection();
  
  // Clear category render cache on UI refresh to pick up updates
  lastRenderedCategoryType = null;
  
  const activeTypeBtn = document.querySelector('.type-tab-btn.active');
  const currentType = activeTypeBtn ? activeTypeBtn.getAttribute('data-type') : 'expense';
  
  updateCategoryDropdowns(currentType);
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
  }).sort((a, b) => {
    const dateA = String(a.date || '').split('T')[0];
    const dateB = String(b.date || '').split('T')[0];
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    const timeA = a.created_at ? new Date(a.created_at).getTime() : (a.date ? new Date(a.date).getTime() : 0);
    const timeB = b.created_at ? new Date(b.created_at).getTime() : (b.date ? new Date(b.date).getTime() : 0);
    if (timeA !== timeB) return timeB - timeA;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

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

      const translatedSub = getSubcategoryDisplayName(t.subcategory, t.category);
      const translatedCat = getCategoryDisplayName(t.category);
      const displayTitle = (t.note && t.note.trim()) ? t.note.trim()
                         : (t.description && t.description.trim()) ? t.description.trim()
                         : (translatedSub && translatedSub.trim()) ? translatedSub.trim()
                         : (translatedCat || '');
      
      const isPartner = state.partnerProfile && t.user_id === state.partnerProfile.id;
      const partnerBadge = isPartner ? ` <i class="fa-solid fa-user-group partner-badge-icon" title="Προστέθηκε από τον σύντροφο"></i>` : '';

      item.innerHTML = `
        ${checkboxHtml}
        <div class="trans-left">
          <div class="trans-category-container">
            <div class="trans-cat-icon">${catInfo.icon || '💰'}</div>
            <div class="trans-cat-name">${translatedCat || ''}</div>
            ${t.subcategory ? `<div class="trans-sub-name">${translatedSub}</div>` : ''}
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
  localStorage.setItem('offline_categories', JSON.stringify(state.categories));
  lastRenderedCategoryType = null;
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
    const key = catInfo.name || t.category || (state.lang === 'el' ? 'Άλλα' : 'Other');
    if (!catGroups[key]) catGroups[key] = { amount: 0, icon: catInfo.icon, color: catInfo.color };
    catGroups[key].amount += parseFloat(t.amount || 0);
  });

  const breakdownList = Object.entries(catGroups).map(([name, d]) => ({
    name, amount: d.amount, percentage: totalSum > 0 ? (d.amount / totalSum) * 100 : 0,
    icon: d.icon, color: d.color
  })).sort((a, b) => b.amount - a.amount);

  const displayList = breakdownList;

  const listContainer = document.getElementById('stats-breakdown-list');
  listContainer.innerHTML = '';

  const centerTitleEl = document.getElementById('chart-center-title');
  const centerAmountEl = document.getElementById('chart-center-amount');
  const chartCenterVal = document.getElementById('chart-center-val');

  if (!displayList.length) {
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

  displayList.forEach(item => {
    const row = document.createElement('div');
    row.className = 'stats-row';
    const isIncome = state.statsType === 'income';
    row.innerHTML = `
      <div class="stats-row-left">
        <span class="stats-pct-badge ${isIncome ? 'income' : ''}">${Math.round(item.percentage)}%</span>
        <span class="stats-cat-icon">${item.icon}</span>
        <span class="stats-category-name">${getCategoryDisplayName(stripLeadingEmoji(item.name))}</span>
      </div>
      <div class="stats-row-right">${getCurrencySymbol()} ${formatCurrency(item.amount)}</div>`;
    listContainer.appendChild(row);
  });

  if (state.activeTab === 'stats') {
    renderChart(displayList);
  }
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

        // For current year, use today's date as end date instead of max transaction date
        const currentYear = new Date().getFullYear();
        const yearNum = parseInt(year, 10);
        const endDate = (yearNum === currentYear)
          ? new Date().toISOString().split('T')[0]
          : data.maxDate;

        const label = TRANSLATIONS[state.lang]['period_label'] + ' ' + formatDateStr(data.minDate) + ' - ' + formatDateStr(endDate);
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
          document.body.classList.add('keyboard-active');
        }
        
        const scrollIntoViewIfNeeded = () => {
          const row = el.closest('.form-row');
          const body = el.closest('.modal-body');
          if (row && body) {
            const bodyRect = body.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();
            // If the row is below or above the visible modal body area, scroll it minimally into view
            if (rowRect.bottom > bodyRect.bottom) {
              const targetScroll = body.scrollTop + (rowRect.bottom - bodyRect.bottom) + 8;
              body.scrollTo({ top: targetScroll, behavior: 'smooth' });
            } else if (rowRect.top < bodyRect.top) {
              const targetScroll = Math.max(0, body.scrollTop - (bodyRect.top - rowRect.top) - 8);
              body.scrollTo({ top: targetScroll, behavior: 'smooth' });
            }
          }
        };

        if (!isKeyboardAlreadyActive) {
          // Keep the page at top — prevent Android from panning the page body
          if (!isIOS) {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
          }
          
          // After keyboard animates in, scroll the field into view within the modal body
          setTimeout(() => {
            if (!isIOS) {
              window.scrollTo(0, 0);
              document.body.scrollTop = 0;
            } else {
              // On iOS, snap background scroll back to 0 after keyboard finishes opening
              window.scrollTo(0, 0);
              document.body.scrollTop = 0;
            }
            scrollIntoViewIfNeeded();
          }, 350);
        } else {
          // Keyboard is already open: scroll the new input into view immediately
          setTimeout(() => {
            scrollIntoViewIfNeeded();
          }, 50);
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
              window.scrollTo(0, 0);
              document.body.scrollTop = 0;
            }
          }, 80);
        } else {
          // Reset scroll when input loses focus
          setTimeout(() => {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
          }, 80);
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
      note: document.getElementById('trans-note').value.trim(),
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
    
    // Save or delete receipt photo in IndexedDB
    if (_pendingReceiptFile && t.id) {
      try {
        await ReceiptStorage.save(t.id, _pendingReceiptFile);
        t.photo_local_uri = 'local-file://' + t.id;
        saveTransactionOffline(t);
        console.log('Receipt photo saved locally for:', t.id);
      } catch (err) {
        console.warn('Failed to save receipt photo:', err);
      }
    } else if (_pendingReceiptDeleted && t.id) {
      try {
        await ReceiptStorage.remove(t.id);
        t.photo_local_uri = null;
        saveTransactionOffline(t);
        console.log('Receipt photo deleted for:', t.id);
      } catch (err) {
        console.warn('Failed to delete receipt photo:', err);
      }
    }
    _pendingReceiptFile = null;
    _pendingReceiptDeleted = false;
    
    closeModal('transaction-modal');
  });

  document.getElementById('trans-delete-btn').addEventListener('click', async () => {
    const id = document.getElementById('trans-id').value;
    const confirmMsg = TRANSLATIONS[state.lang]['confirm_delete_transaction'];
    const confirmed = await showConfirm(confirmMsg, state.lang === 'el' ? 'Διαγραφή' : 'Delete', '🗑️');
    if (id && confirmed) {
      await deleteTransaction(id);
      closeModal('transaction-modal');
    }
  });

  // ============================================================
  // RECEIPT PHOTO LISTENERS
  // ============================================================
  const cameraBtnEl = document.getElementById('trans-camera-btn');
  const photoInputEl = document.getElementById('trans-photo-input');
  
  if (cameraBtnEl && photoInputEl) {
    cameraBtnEl.addEventListener('click', () => {
      const form = document.getElementById('transaction-form');
      if (form && form.getAttribute('data-readonly') === 'true') return;
      photoInputEl.click();
    });
    
    photoInputEl.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      _pendingReceiptFile = file;
      _pendingReceiptDeleted = false;
      
      const previewContainer = document.getElementById('trans-photo-preview-container');
      const previewImg = document.getElementById('trans-photo-preview-img');
      const placeholderContainer = document.getElementById('trans-photo-placeholder-container');
      if (placeholderContainer) placeholderContainer.style.display = 'none';
      
      if (previewImg && previewContainer) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          previewImg.src = ev.target.result;
          previewContainer.style.display = 'flex';
        };
        reader.readAsDataURL(file);
      }
    });
  }
  
  // Photo preview click -> open lightbox
  const previewImgEl = document.getElementById('trans-photo-preview-img');
  if (previewImgEl) {
    previewImgEl.addEventListener('click', () => {
      openPhotoLightbox(previewImgEl.src);
    });
  }
  
  // Photo delete button
  const photoDeleteBtn = document.getElementById('btn-delete-photo');
  if (photoDeleteBtn) {
    photoDeleteBtn.addEventListener('click', () => {
      const confirmMsg = TRANSLATIONS[state.lang]['photo_delete_confirm'] || 'Διαγραφή φωτογραφίας απόδειξης;';
      if (confirm(confirmMsg)) {
        _pendingReceiptFile = null;
        _pendingReceiptDeleted = true;
        const photoInput = document.getElementById('trans-photo-input');
        if (photoInput) photoInput.value = '';
        const previewContainer = document.getElementById('trans-photo-preview-container');
        if (previewContainer) previewContainer.style.display = 'none';
      }
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

  const TAB_ORDER = ['trans', 'stats', 'accounts', 'more'];
  const oldTab = state.activeTab;
  const newTab = tab;
  state.activeTab = tab;

  // Toggle body class for scroll isolation on mobile
  document.body.classList.toggle('trans-tab-active', tab === 'trans');
  document.body.classList.toggle('stats-tab-active', tab === 'stats');
  document.body.classList.toggle('accounts-tab-active', tab === 'accounts');
  document.body.classList.toggle('more-tab-active', tab === 'more');

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
      // Clear transition state trackers
      state.activeTransitionCleanup = null;
      state.activeTransitionAnimEndTarget = null;
      state.activeTransitionAnimEndListener = null;
      state.activeTransitionTimeoutId = null;
    };

    state.activeTransitionCleanup = cleanupHandler;
    state.activeTransitionAnimEndTarget = newScreen;

    // Listen for animation end on the NEW screen (slide-in finishes)
    const onAnimEnd = (e) => {
      if (e.target === newScreen) {
        newScreen.removeEventListener('animationend', onAnimEnd);
        cleanupHandler();
      }
    };
    state.activeTransitionAnimEndListener = onAnimEnd;
    newScreen.addEventListener('animationend', onAnimEnd);

    // Safety fallback in case animationend doesn't fire (e.g. display issues)
    state.activeTransitionTimeoutId = setTimeout(() => {
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
  state.tabRenderTimeoutId = setTimeout(() => {
    state.tabRenderTimeoutId = null;
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
  document.body.classList.add('modal-open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  const activeModals = document.querySelectorAll('.modal-overlay.active');
  if (activeModals.length === 0) {
    document.body.classList.remove('modal-open');
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
  
  // Reset photo state
  _pendingReceiptFile = null;
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

  openModal('transaction-modal');
  setTimeout(() => initNoteAutocomplete(), 50);
}

function openEditTransactionModal(t) {
  if (typeof window.closeCalculatorKeypad === 'function') {
    window.closeCalculatorKeypad();
  }
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
  
  // Reset photo state and load existing photo if available
  _pendingReceiptFile = null;
  _pendingReceiptDeleted = false;
  const photoInput = document.getElementById('trans-photo-input');
  if (photoInput) photoInput.value = '';
  const previewContainer = document.getElementById('trans-photo-preview-container');
  const placeholderContainer = document.getElementById('trans-photo-placeholder-container');
  const previewImg = document.getElementById('trans-photo-preview-img');
  if (previewContainer) previewContainer.style.display = 'none';
  if (placeholderContainer) placeholderContainer.style.display = 'none';
  
  // Load receipt photo from IndexedDB
  if (t.photo_local_uri && t.id) {
    ReceiptStorage.load(t.id).then(blob => {
      if (blob && previewImg && previewContainer) {
        const url = URL.createObjectURL(blob);
        previewImg.src = url;
        previewContainer.style.display = 'flex';
      } else if (placeholderContainer) {
        // Photo exists in cloud record but not locally (different device)
        placeholderContainer.style.display = 'flex';
        const placeholderText = document.getElementById('trans-photo-placeholder-text');
        if (placeholderText) {
          placeholderText.textContent = TRANSLATIONS[state.lang]['photo_mismatch_warning'] || 'Η εικόνα είναι διαθέσιμη μόνο στη συσκευή που καταχωρήθηκε.';
        }
      }
    }).catch(err => console.warn('Failed to load receipt:', err));
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
      ? (state.lang === 'el' ? 'Τέλος' : 'Done')
      : (state.lang === 'el' ? 'Διαχείριση' : 'Manage');
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
    titleEl.textContent = state.lang === 'el' ? 'Επιλογή Λογαριασμού' : 'Select Account';
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
        catChip.querySelector('.chip-label').textContent = TRANSLATIONS[state.lang]['search_chip_category'] || 'Κατηγορία';
        catChip.classList.remove('active');
      }
    }
  }
  
  // Update Type Chip UI
  const chip = document.getElementById('search-chip-type');
  const label = chip.querySelector('.chip-label');
  if (val) {
    let text = val === 'expense' ? TRANSLATIONS[state.lang]['type_tab_expense'] : val === 'income' ? TRANSLATIONS[state.lang]['type_tab_income'] : TRANSLATIONS[state.lang]['type_tab_transfer'];
    label.textContent = `✓ ${text}`;
    chip.classList.add('active');
  } else {
    label.textContent = TRANSLATIONS[state.lang]['search_chip_type'] || 'Τύπος';
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
      <span class="option-label">${state.lang === 'el' ? 'Όλοι οι λογαριασμοί' : 'All accounts'}</span>
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

  // Update Account Chip UI
  const chip = document.getElementById('search-chip-account');
  const label = chip.querySelector('.chip-label');
  if (val) {
    label.textContent = `✓ ${getAccountDisplayName(val)}`;
    chip.classList.add('active');
  } else {
    label.textContent = TRANSLATIONS[state.lang]['search_chip_account'] || 'Λογαριασμός';
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

  // Update Category Chip UI
  const chip = document.getElementById('search-chip-category');
  const label = chip.querySelector('.chip-label');
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
    label.textContent = TRANSLATIONS[state.lang]['search_chip_member'] || 'Μέλος';
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
    typeChip.querySelector('.chip-label').textContent = TRANSLATIONS[state.lang]['search_chip_type'] || 'Τύπος';
    typeChip.classList.remove('active');
  }
  const catChip = document.getElementById('search-chip-category');
  if (catChip) {
    catChip.querySelector('.chip-label').textContent = TRANSLATIONS[state.lang]['search_chip_category'] || 'Κατηγορία';
    catChip.classList.remove('active');
  }
  const accChip = document.getElementById('search-chip-account');
  if (accChip) {
    accChip.querySelector('.chip-label').textContent = TRANSLATIONS[state.lang]['search_chip_account'] || 'Λογαριασμός';
    accChip.classList.remove('active');
  }
  const memChip = document.getElementById('search-chip-member');
  if (memChip) {
    memChip.querySelector('.chip-label').textContent = TRANSLATIONS[state.lang]['search_chip_member'] || 'Μέλος';
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
    accSelect.innerHTML = `<option value="">${state.lang === 'el' ? 'Όλοι οι λογαριασμοί' : 'All accounts'}</option>`;
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
  filtered.sort((a, b) => {
    const dateA = String(a.date || '').split('T')[0];
    const dateB = String(b.date || '').split('T')[0];
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    const timeA = a.created_at ? new Date(a.created_at).getTime() : (a.date ? new Date(a.date).getTime() : 0);
    const timeB = b.created_at ? new Date(b.created_at).getTime() : (b.date ? new Date(b.date).getTime() : 0);
    if (timeA !== timeB) return timeB - timeA;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

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

      const translatedSub = getSubcategoryDisplayName(t.subcategory, t.category);
      const translatedCat = getCategoryDisplayName(t.category);
      const displayTitle = (t.note && t.note.trim()) ? t.note.trim()
                         : (t.description && t.description.trim()) ? t.description.trim()
                         : (translatedSub && translatedSub.trim()) ? translatedSub.trim()
                         : (translatedCat || '');

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
            <div class="trans-cat-name">${translatedCat || ''}</div>
            ${t.subcategory ? `<div class="trans-sub-name">${translatedSub}</div>` : ''}
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
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;
  
  const msg = ids.length === 1 ? 'Να διαγραφεί η επιλεγμένη συναλλαγή;' : `Να διαγραφούν οι ${ids.length} επιλεγμένες συναλλαγές;`;
  const confirmed = await showConfirm(msg, state.lang === 'el' ? 'Διαγραφή' : 'Delete', '🗑️');
  if (!confirmed) return;
  
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
        document.body.classList.toggle('trans-tab-active', prevTabName === 'trans');
        document.body.classList.toggle('stats-tab-active', prevTabName === 'stats');
        document.body.classList.toggle('accounts-tab-active', prevTabName === 'accounts');
        document.body.classList.toggle('more-tab-active', prevTabName === 'more');
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
  
  trans.sort((a, b) => {
    const dateA = String(a.date || '').split('T')[0];
    const dateB = String(b.date || '').split('T')[0];
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    const timeA = a.created_at ? new Date(a.created_at).getTime() : (a.date ? new Date(a.date).getTime() : 0);
    const timeB = b.created_at ? new Date(b.created_at).getTime() : (b.date ? new Date(b.date).getTime() : 0);
    if (timeA !== timeB) return timeB - timeA;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  
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
      ? (partnerId ? `family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}` : `family_id.eq.${familyId},user_id.eq.${userId}`)
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
    state.transactions.sort((a, b) => {
      const dateA = String(a.date || '').split('T')[0];
      const dateB = String(b.date || '').split('T')[0];
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      const timeA = a.created_at ? new Date(a.created_at).getTime() : (a.date ? new Date(a.date).getTime() : 0);
      const timeB = b.created_at ? new Date(b.created_at).getTime() : (b.date ? new Date(b.date).getTime() : 0);
      if (timeA !== timeB) return timeB - timeA;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
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
    document.documentElement.style.setProperty('--safe-area-bottom', '12px');
  }
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
      const keyboardHeight = Math.max(0, rawKeyboardHeight);
      
      // --viewport-height: the visible area height (visual viewport)
      // Use window.innerHeight for layout (unchanged with resizes-visual)
      document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
      document.documentElement.style.setProperty('--viewport-offset-top', `${offsetTop}px`);
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    };
    
    window.visualViewport.addEventListener('resize', updateViewportHeight);
    window.visualViewport.addEventListener('scroll', updateViewportHeight);
    
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

function openCustomDatePicker() {
  if (window.autocompleteJustSelected) return;
  const form = document.getElementById('transaction-form');
  if (form && form.getAttribute('data-readonly') === 'true') return;
  ensureHistoryPushed();
  
  const dateInput = document.getElementById('trans-date');
  let currentDate = new Date();
  if (dateInput && dateInput.value) {
    // Timezone-safe manual parsing of local date-time YYYY-MM-DDTHH:MM
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
    } else {
      const parsed = new Date(dateInput.value);
      if (!isNaN(parsed.getTime())) {
        currentDate = parsed;
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
  
  renderCustomDatePickerCalendar();
  
  // Open the modal
  openModal('custom-date-picker-modal');
  
  // Scroll wheels to correct initial values after rendering transition
  setTimeout(() => {
    const hs = document.getElementById('scroll-hours');
    if (hs) {
      hs.scrollTop = currentDate.getHours() * 60;
    }
    const ms = document.getElementById('scroll-minutes');
    if (ms) {
      ms.scrollTop = currentDate.getMinutes() * 60;
    }
  }, 100);
}

window.openCustomDatePicker = openCustomDatePicker;

function renderCustomDatePickerCalendar() {
  const grid = document.getElementById('custom-date-picker-days-grid');
  const monthYearLabel = document.getElementById('custom-date-picker-month-year');
  if (!grid || !monthYearLabel) return;
  
  const year = customDatePickerViewingMonth.getFullYear();
  const month = customDatePickerViewingMonth.getMonth();
  
  // Update Greek Month and Year title
  monthYearLabel.textContent = `${GREEK_MONTHS[month]} ${year}`;
  
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

function setCustomDatePickerValue() {
  const hoursScroll = document.getElementById('scroll-hours');
  const minutesScroll = document.getElementById('scroll-minutes');
  let hours = 0;
  let minutes = 0;
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
  
  customDatePickerSelectedDate.setHours(hours);
  customDatePickerSelectedDate.setMinutes(minutes);
  
  // Format as ISO Local String YYYY-MM-DDTHH:MM
  const yyyy = customDatePickerSelectedDate.getFullYear();
  const mm = String(customDatePickerSelectedDate.getMonth() + 1).padStart(2, '0');
  const dd = String(customDatePickerSelectedDate.getDate()).padStart(2, '0');
  const hh = String(customDatePickerSelectedDate.getHours()).padStart(2, '0');
  const min = String(customDatePickerSelectedDate.getMinutes()).padStart(2, '0');
  
  const isoLocal = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  
  const dateInput = document.getElementById('trans-date');
  if (dateInput) {
    dateInput.value = isoLocal;
    // Dispatch input event to trigger UI formatting update
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
  const sortedTrans = [...allTransactions].sort((a, b) => {
    const da = a.date ? new Date(a.date) : new Date(0);
    const db = b.date ? new Date(b.date) : new Date(0);
    if (db - da !== 0) return db - da;
    return (b.id || 0) - (a.id || 0);
  });
  
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
  
  const q = (query || '').trim().toLowerCase();
  const suggestions = [];
  
  for (const [key, details] of noteDetails.entries()) {
    if (!q || key.includes(q)) {
      suggestions.push(details);
    }
  }
  
  // Sort suggestions: if there is a query, prioritize matches that start with the query
  if (q) {
    suggestions.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
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

window.toggleAutocompleteSetting = toggleAutocompleteSetting;
window.initNoteAutocomplete = initNoteAutocomplete;
window.closeNoteAutocomplete = closeNoteAutocomplete;

// FEATURE: TEXTAREA AUTO-GROW FOR DESCRIPTION/DETAILS
function initDescriptionAutoGrow() {
  const descInput = document.getElementById('trans-description');
  if (!descInput) return;
  
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