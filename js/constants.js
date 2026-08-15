/**
 * constants.js
 *
 * Pure-data constants extracted from app.js (Phase 1 of the modularization plan).
 * Zero dependencies — no state, no DOM, no Supabase, no other app.js functions.
 *
 * UMD wrapper (same proven pattern as js/transactionMerge.js):
 *   - Node / CommonJS: module.exports (used by node:test)
 *   - Browser: window.BAConstants + global aliases (so app.js needs no changes)
 *
 * Loaded BEFORE app.js via <script src="js/constants.js"> in index.html.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node / CommonJS (used by node:test)
        module.exports = factory();
    } else {
        // Browser global
        root.BAConstants = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ============================================================
    // CATEGORY MAP: Maps emoji codepoint -> { greekName, icon, color }
    // Discovered from actual Excel data analysis
    // ============================================================
    const CATEGORY_EMOJI_MAP = {
        // Expense categories
        '1F3E1': { name: '🏠 Σπίτι', icon: '🏠', color: '#e05e55', type: 'expense' },
        '1F3E0': { name: '🏠 Σπίτι', icon: '🏠', color: '#ffd54f', type: 'expense' },
        '1F697': { name: '🚗 Μεταφορές', icon: '🚗', color: '#ffa726', type: 'expense' },
        '1F6D2': { name: '🍔 Τρόφιμα', icon: '🍔', color: '#ffb300', type: 'expense' },
        '1F3CB': { name: '🎉 Διασκέδαση', icon: '🎉', color: '#42a5f5', type: 'expense' },
        '1F389': { name: '🎉 Διασκέδαση', icon: '🎉', color: '#26a69a', type: 'expense' },
        '1F9FE': { name: '🧾 Φόροι', icon: '🧾', color: '#26c6da', type: 'expense' },
        '1F455': { name: '👕 Αγορές', icon: '👕', color: '#7e57c2', type: 'expense' },
        '1F687': { name: '🚗 Μεταφορές', icon: '🚗', color: '#ab47bc', type: 'expense' },
        '1F4BB': { name: '📦 Διάφορα', icon: '📦', color: '#5c6bc0', type: 'expense' },
        '1F4BC': { name: '💼 Μισθός', icon: '💼', color: '#4caf50', type: 'income' },
        '1F9E9': { name: '📦 Διάφορα', icon: '📦', color: '#78909c', type: 'expense' },
        '1F3AC': { name: '📱 Συνδρομές', icon: '📱', color: '#ec407a', type: 'expense' },
        '2764': { name: '❤️ Υγεία', icon: '❤️', color: '#ef5350', type: 'expense' },
        '1F489': { name: '❤️ Υγεία', icon: '❤️', color: '#ef5350', type: 'expense' },
        '1F48A': { name: '❤️ Υγεία', icon: '❤️', color: '#ef5350', type: 'expense' },
        '1F527': { name: '📦 Διάφορα', icon: '📦', color: '#78909c', type: 'expense' },

        // Income categories
        '1F911': { name: '➕ Άλλα έσοδα', icon: '➕', color: '#607d8b', type: 'income' },
        '1F4B0': { name: '💼 Μισθός', icon: '💼', color: '#4caf50', type: 'income' },
        '1F381': { name: '🎁 Δώρα', icon: '🎁', color: '#66bb6a', type: 'income' },
        '1F9D1': { name: '➕ Άλλα έσοδα', icon: '➕', color: '#009688', type: 'income' },
        '1F4E6': { name: '📦 Πωλήσεις', icon: '📦', color: '#26a69a', type: 'income' },
        '1F3C5': { name: '💸 Bonus', icon: '💸', color: '#ffb300', type: 'income' },
        '1F468': { name: '➕ Άλλα έσοδα', icon: '➕', color: '#9e9e9e', type: 'income' },
        '1F393': { name: '🎓 Εκπαίδευση', icon: '🎓', color: '#2196f3', type: 'expense' },
        '1F47D': { name: '➕ Άλλα έσοδα', icon: '➕', color: '#607d8b', type: 'income' },
        '1F4B6': { name: '🏠 Ενοίκια', icon: '🏠', color: '#00bcd4', type: 'income' },
        '1F3DB': { name: '➕ Άλλα έσοδα', icon: '➕', color: '#8bc34a', type: 'income' },
    };

    // Fallback categories for any that don't match
    const DEFAULT_CATEGORIES = [
        { name: '🏠 Σπίτι', type: 'expense', icon: '🏠', color: '#e05e55' },
        { name: '🍔 Τρόφιμα', type: 'expense', icon: '🍔', color: '#ffb300' },
        { name: '🚗 Μεταφορές', type: 'expense', icon: '🚗', color: '#ffa726' },
        { name: '❤️ Υγεία', type: 'expense', icon: '❤️', color: '#ef5350' },
        { name: '🎓 Εκπαίδευση', type: 'expense', icon: '🎓', color: '#2196f3' },
        { name: '🎉 Διασκέδαση', type: 'expense', icon: '🎉', color: '#26a69a' },
        { name: '👕 Αγορές', type: 'expense', icon: '👕', color: '#7e57c2' },
        { name: '📱 Συνδρομές', type: 'expense', icon: '📱', color: '#ec407a' },
        { name: '🧾 Φόροι', type: 'expense', icon: '🧾', color: '#26c6da' },
        { name: '📦 Διάφορα', type: 'expense', icon: '📦', color: '#78909c' },

        { name: '💼 Μισθός', type: 'income', icon: '💼', color: '#4caf50' },
        { name: '💸 Bonus', type: 'income', icon: '💸', color: '#ffb300' },
        { name: '🏠 Ενοίκια', type: 'income', icon: '🏠', color: '#00bcd4' },
        { name: '📈 Επενδύσεις', type: 'income', icon: '📈', color: '#8bc34a' },
        { name: '🎁 Δώρα', type: 'income', icon: '🎁', color: '#66bb6a' },
        { name: '💰 Cashback / Τόκοι', type: 'income', icon: '💰', color: '#607d8b' },
        { name: '💼 Freelance', type: 'income', icon: '💼', color: '#9e9e9e' },
        { name: '📦 Πωλήσεις', type: 'income', icon: '📦', color: '#26a69a' },
        { name: '➕ Άλλα έσοδα', type: 'income', icon: '➕', color: '#90a4ae' }
    ];

    // Default Accounts - 3 real accounts from Excel: Cash, Card, Accounts (= Bank Account)
    const DEFAULT_ACCOUNTS = [
        { name: 'Cash', type: 'cash', balance: 0 },
        { name: 'Bank Account', type: 'bank', balance: 0 },
        { name: 'Card', type: 'card', balance: 0 },
    ];

    const NEON_PALETTE = [
        '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6',
        '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
        '#22c55e', '#eab308', '#a855f7', '#ef4444', '#0ea5e9'
    ];

    const GREEK_MONTHS = [
        'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
        'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'
    ];

    const ENGLISH_MONTHS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const DEFAULT_SUBCATEGORIES_MAP = {
        'ΣΠΙΤΙ': ['Ενοίκιο', 'Ρεύμα', 'Νερό', 'Internet', 'Συντήρηση', 'Έπιπλα'],
        'ΤΡΟΦΙΜΑ': ['Super Market', 'Delivery', 'Καφές', 'Φούρνος'],
        'ΜΕΤΑΦΟΡΕΣ': ['Καύσιμα', 'Parking', 'Service', 'Ασφάλεια', 'Μέσα Μαζικής Μεταφοράς'],
        'ΥΓΕΙΑ': [],
        'ΕΚΠΑΙΔΕΥΣΗ': [],
        'ΔΙΑΣΚΕΔΑΣΗ': [],
        'ΑΓΟΡΕΣ': [],
        'ΣΥΝΔΡΟΜΕΣ': [],
        'ΦΟΡΟΙ': [],
        'ΔΙΑΦΟΡΑ': [],
        'ΜΙΣΘΟΣ': [],
        'BONUS': [],
        'ΕΝΟΙΚΙΑ': [],
        'ΕΠΕΝΔΥΣΕΙΣ': [],
        'ΔΩΡΑ': [],
        'CASHBACK / ΤΟΚΟΙ': [],
        'FREELANCE': [],
        'ΠΩΛΗΣΕΙΣ': [],
        '➕ ΑΛΛΑ ΕΣΟΔΑ': []
    };

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
        'ΑΛΛΑ ΕΣΟΔΑ': 'Other Income',
        'Γενικά': 'General'
    };

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

    const BAConstants = {
        CATEGORY_EMOJI_MAP: CATEGORY_EMOJI_MAP,
        DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
        DEFAULT_ACCOUNTS: DEFAULT_ACCOUNTS,
        NEON_PALETTE: NEON_PALETTE,
        GREEK_MONTHS: GREEK_MONTHS,
        ENGLISH_MONTHS: ENGLISH_MONTHS,
        DEFAULT_SUBCATEGORIES_MAP: DEFAULT_SUBCATEGORIES_MAP,
        CATEGORY_NAME_TRANSLATIONS: CATEGORY_NAME_TRANSLATIONS,
        SUBCATEGORY_NAME_TRANSLATIONS: SUBCATEGORY_NAME_TRANSLATIONS
    };

    // Browser global aliases (so app.js needs no changes — pure cut-paste)
    if (typeof window !== 'undefined') {
        window.CATEGORY_EMOJI_MAP = CATEGORY_EMOJI_MAP;
        window.DEFAULT_CATEGORIES = DEFAULT_CATEGORIES;
        window.DEFAULT_ACCOUNTS = DEFAULT_ACCOUNTS;
        window.NEON_PALETTE = NEON_PALETTE;
        window.GREEK_MONTHS = GREEK_MONTHS;
        window.ENGLISH_MONTHS = ENGLISH_MONTHS;
        window.DEFAULT_SUBCATEGORIES_MAP = DEFAULT_SUBCATEGORIES_MAP;
        window.CATEGORY_NAME_TRANSLATIONS = CATEGORY_NAME_TRANSLATIONS;
        window.SUBCATEGORY_NAME_TRANSLATIONS = SUBCATEGORY_NAME_TRANSLATIONS;
    }

    return BAConstants;
});
