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
        { name: '🛒 Σούπερ Μάρκετ', type: 'expense', icon: 'fa-solid fa-basket-shopping', color: '#f59e0b' },
        { name: '🍔 Τρόφιμα', type: 'expense', icon: 'fa-solid fa-burger', color: '#ffb300' },
        { name: '🏠 Σπίτι', type: 'expense', icon: 'fa-solid fa-house', color: '#e05e55' },
        { name: '🚗 Μεταφορές', type: 'expense', icon: 'fa-solid fa-car-side', color: '#ffa726' },
        { name: '❤️ Υγεία', type: 'expense', icon: 'fa-solid fa-heart-pulse', color: '#ef5350' },
        { name: '🎓 Εκπαίδευση', type: 'expense', icon: 'fa-solid fa-graduation-cap', color: '#2196f3' },
        { name: '🎉 Διασκέδαση', type: 'expense', icon: 'fa-solid fa-icons', color: '#26a69a' },
        { name: '👕 Αγορές', type: 'expense', icon: 'fa-solid fa-bag-shopping', color: '#7e57c2' },
        { name: '📱 Συνδρομές', type: 'expense', icon: 'fa-solid fa-film', color: '#ec407a' },
        { name: '🧾 Φόροι', type: 'expense', icon: 'fa-solid fa-receipt', color: '#26c6da' },
        { name: '📦 Διάφορα', type: 'expense', icon: 'fa-solid fa-shapes', color: '#78909c' },

        { name: '💼 Μισθός', type: 'income', icon: 'fa-solid fa-briefcase', color: '#4caf50' },
        { name: '💸 Bonus', type: 'income', icon: 'fa-solid fa-award', color: '#ffb300' },
        { name: '🏠 Ενοίκια', type: 'income', icon: 'fa-solid fa-key', color: '#00bcd4' },
        { name: '📈 Επενδύσεις', type: 'income', icon: 'fa-solid fa-chart-line', color: '#8bc34a' },
        { name: '🎁 Δώρα', type: 'income', icon: 'fa-solid fa-gift', color: '#66bb6a' },
        { name: '💰 Cashback / Τόκοι', type: 'income', icon: 'fa-solid fa-coins', color: '#607d8b' },
        { name: '💼 Freelance', type: 'income', icon: 'fa-solid fa-laptop-code', color: '#9e9e9e' },
        { name: '📦 Πωλήσεις', type: 'income', icon: 'fa-solid fa-tags', color: '#26a69a' },
        { name: '➕ Άλλα έσοδα', type: 'income', icon: 'fa-solid fa-plus', color: '#90a4ae' }
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
        // Greek Category Keys
        'ΣΟΥΠΕΡ ΜΑΡΚΕΤ': ['Τρόφιμα', 'Απορρυπαντικά', 'Προσωπική Φροντίδα', 'Μανάβικο', 'Κρεοπωλείο', 'Χαρτικά', 'Κατοικίδια'],
        'ΣΟΥΠΕΡΜΑΡΚΕΤ': ['Τρόφιμα', 'Απορρυπαντικά', 'Προσωπική Φροντίδα', 'Μανάβικο', 'Κρεοπωλείο', 'Χαρτικά', 'Κατοικίδια'],
        'ΣΠΙΤΙ': ['Ενοίκιο', 'Κοινόχρηστα', 'Ρεύμα', 'Νερό', 'Internet / Τηλέφωνο', 'Θέρμανση / Αέριο', 'Συντήρηση / Βλάβες', 'Έπιπλα / Οικιακά'],
        'ΤΡΟΦΙΜΑ': ['Delivery', 'Καφές', 'Εστιατόριο', 'Φούρνος', 'Fast Food', 'Σνακ', 'Μπαρ / Ποτό'],
        'ΦΑΓΗΤΟ': ['Delivery', 'Καφές', 'Εστιατόριο', 'Φούρνος', 'Fast Food', 'Σνακ', 'Μπαρ / Ποτό'],
        'ΦΑΓΗΤΟ / DELIVERY': ['Delivery', 'Καφές', 'Εστιατόριο', 'Φούρνος', 'Fast Food', 'Σνακ', 'Μπαρ / Ποτό'],
        'ΜΕΤΑΦΟΡΕΣ': ['Καύσιμα', 'Parking', 'Service / Συντήρηση', 'Διόδια', 'Ασφάλεια', 'Μέσα Μαζικής Μεταφοράς', 'Ταξί', 'Πλύσιμο'],
        'ΥΓΕΙΑ': ['Φαρμακείο', 'Γιατροί / Εξετάσεις', 'Οδοντίατρος', 'Γυμναστήριο / Fitness', 'Συμπληρώματα', 'Οπτικά'],
        'ΕΚΠΑΙΔΕΥΣΗ': ['Δίδακτρα / Σχολή', 'Σεμινάρια / Courses', 'Βιβλία', 'Γραφική Ύλη', 'Εξετάσεις / Πιστοποιήσεις'],
        'ΔΙΑΣΚΕΔΑΣΗ': ['Σινεμά / Θέατρο', 'Συναυλίες / Εκδηλώσεις', 'Gaming', 'Εκδρομές / Ταξίδια', 'Hobbies', 'Nightlife / Ποτό'],
        'ΑΓΟΡΕΣ': ['Ρούχα & Παπούτσια', 'Ηλεκτρονικά / Gadgets', 'Καλλυντικά / Ομορφιά', 'Δώρα', 'Αξεσουάρ', 'Αθλητικά Είδη'],
        'ΣΥΝΔΡΟΜΕΣ': ['Streaming (Netflix/Spotify)', 'Κινητή Τηλεφωνία', 'Cloud & Software', 'Συνδρομές Γυμναστηρίου', 'Εφημερίδες / Περιοδικά'],
        'ΦΟΡΟΙ': ['ΕΝΦΙΑ', 'Φόρος Εισοδήματος', 'Τέλη Κυκλοφορίας', 'Τραπεζικές Προμήθειες', 'Λογιστής'],
        'ΔΙΑΦΟΡΑ': ['Έκτακτα Έξοδα', 'Δωρεές / Φιλανθρωπία', 'Χαρτζιλίκι', 'Λοιπά'],
        'ΜΙΣΘΟΣ': ['Βασικός Μισθός', 'Υπερωρίες', 'Bonus', 'Αναδρομικά'],
        'BONUS': ['Ετήσιο Bonus', 'Bonus Επίτευξης', 'Tips'],
        'ΕΝΟΙΚΙΑ': ['Ενοίκιο Κατοικίας', 'Ενοίκιο Επαγγελματικού', 'Airbnb'],
        'ΕΠΕΝΔΥΣΕΙΣ': ['Μερίσματα', 'Κρυπτονομίσματα', 'Τόκοι', 'Real Estate'],
        'ΔΩΡΑ': ['Γενέθλια / Γιορτές', 'Γάμος / Βάπτιση', 'Οικονομική Ενίσχυση'],
        'CASHBACK / ΤΟΚΟΙ': ['Τραπεζικοί Τόκοι', 'Cashback Καρτών', 'Επιστροφές Φόρου'],
        'FREELANCE': ['Projects', 'Συμβουλευτική', 'Υπηρεσίες'],
        'ΠΩΛΗΣΕΙΣ': ['Πώληση Αντικειμένων', 'Second Hand', 'Προϊόντα'],
        'ΑΛΛΑ ΕΣΟΔΑ': ['Επιστροφές Χρημάτων', 'Αποζημιώσεις', 'Λοιπά Έσοδα'],
        '➕ ΑΛΛΑ ΕΣΟΔΑ': ['Επιστροφές Χρημάτων', 'Αποζημιώσεις', 'Λοιπά Έσοδα'],

        // English Category Keys (Matching Default/Translated categories)
        'SUPERMARKET': ['Food', 'Detergents', 'Personal Care', 'Produce', 'Meat', 'Paper Goods', 'Pet Supplies'],
        'GROCERIES': ['Food', 'Detergents', 'Personal Care', 'Produce', 'Meat', 'Paper Goods', 'Pet Supplies'],
        'FOOD': ['Delivery', 'Coffee', 'Restaurant', 'Bakery', 'Fast Food', 'Snacks', 'Bars & Drinks'],
        'FOOD/DINING': ['Delivery', 'Coffee', 'Restaurant', 'Bakery', 'Fast Food', 'Snacks', 'Bars & Drinks'],
        'DINING': ['Delivery', 'Coffee', 'Restaurant', 'Bakery', 'Fast Food', 'Snacks', 'Bars & Drinks'],
        'HOME': ['Rent', 'Building Maintenance', 'Electricity', 'Water', 'Internet & Phone', 'Heating & Gas', 'Repairs', 'Furniture & Home'],
        'HOUSING': ['Rent', 'Building Maintenance', 'Electricity', 'Water', 'Internet & Phone', 'Heating & Gas', 'Repairs', 'Furniture & Home'],
        'TRANSPORT': ['Fuel', 'Parking', 'Service & Maintenance', 'Tolls', 'Insurance', 'Public Transit', 'Taxi & Rides', 'Car Wash'],
        'TRANSPORTATION': ['Fuel', 'Parking', 'Service & Maintenance', 'Tolls', 'Insurance', 'Public Transit', 'Taxi & Rides', 'Car Wash'],
        'HEALTH': ['Pharmacy', 'Doctors & Labs', 'Dental', 'Gym & Fitness', 'Supplements', 'Optometry'],
        'HEALTHCARE': ['Pharmacy', 'Doctors & Labs', 'Dental', 'Gym & Fitness', 'Supplements', 'Optometry'],
        'EDUCATION': ['Tuition & School', 'Courses & Seminars', 'Books', 'Stationery', 'Certifications'],
        'ENTERTAINMENT': ['Cinema & Theater', 'Concerts & Events', 'Gaming', 'Trips & Travel', 'Hobbies', 'Nightlife'],
        'LEISURE': ['Cinema & Theater', 'Concerts & Events', 'Gaming', 'Trips & Travel', 'Hobbies', 'Nightlife'],
        'SHOPPING': ['Clothing & Shoes', 'Electronics & Gadgets', 'Beauty & Cosmetics', 'Gifts', 'Accessories', 'Sporting Goods'],
        'SUBSCRIPTIONS': ['Streaming (Netflix/Spotify)', 'Mobile Phone', 'Cloud & Software', 'Gym Membership', 'News & Media'],
        'TAXES': ['Property Tax', 'Income Tax', 'Vehicle Road Tax', 'Bank Fees', 'Accountant'],
        'MISCELLANEOUS': ['Emergency Expenses', 'Donations', 'Pocket Money', 'Other'],
        'OTHER': ['Emergency Expenses', 'Donations', 'Pocket Money', 'Other'],
        'SALARY': ['Base Salary', 'Overtime', 'Bonus'],
        'INVESTMENTS': ['Dividends', 'Crypto', 'Interest', 'Real Estate'],
        'GIFTS': ['Birthdays / Holidays', 'Wedding', 'Financial Aid'],
        'RENT': ['Rental Income', 'Commercial Rent', 'Airbnb']
    };

    // Category name translations for default categories (UI only, never applied to user data)
    const CATEGORY_NAME_TRANSLATIONS = {
        '🛒 ΣΟΥΠΕΡ ΜΑΡΚΕΤ': '🛒 Supermarket',
        'ΣΟΥΠΕΡ ΜΑΡΚΕΤ': 'Supermarket',
        'ΣΟΥΠΕΡΜΑΡΚΕΤ': 'Supermarket',
        '🏠 ΣΠΙΤΙ': '🏠 Home',
        '🏡 ΣΠΙΤΙ': '🏡 Home',
        'ΣΠΙΤΙ': 'Home',
        '🏠ΓΡΑΦΕΙΟ Β2': '🏠 Office B2',
        'ΓΡΑΦΕΙΟ Β2': 'Office B2',
        '🚗 ΑΥΤΟΚΙΝΗΤΟ': '🚗 Car',
        'ΑΥΤΟΚΙΝΗΤΟ': 'Car',
        '🍔 ΤΡΟΦΙΜΑ': '🍔 Food/Dining',
        'ΤΡΟΦΙΜΑ': 'Food/Dining',
        '🛒 ΔΙΑΤΡΟΦΗ': '🛒 Food/Groceries',
        'ΔΙΑΤΡΟΦΗ': 'Food/Groceries',
        '🚗 ΜΕΤΑΦΟΡΕΣ': '🚗 Transport',
        'ΜΕΤΑΦΟΡΕΣ': 'Transport',
        '🚇 ΜΕΤΑΚΙΝΗΣΗ': '🚇 Transport',
        'ΜΕΤΑΚΙΝΗΣΗ': 'Transport',
        '❤️ ΥΓΕΙΑ': '❤️ Health',
        'ΥΓΕΙΑ': 'Health',
        '🎓 ΕΚΠΑΙΔΕΥΣΗ': '🎓 Education',
        'ΕΚΠΑΙΔΕΥΣΗ': 'Education',
        '🎉 ΔΙΑΣΚΕΔΑΣΗ': '🎉 Entertainment',
        '🎉ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ': '🎉 Entertainment',
        'ΔΙΑΣΚΕΔΑΣΗ': 'Entertainment',
        'ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ': 'Entertainment',
        '👕 ΑΓΟΡΕΣ': '👕 Shopping',
        'ΑΓΟΡΕΣ': 'Shopping',
        '👕 ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ': '👕 Personal Care',
        'ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ': 'Personal Care',
        '📱 ΣΥΝΔΡΟΜΕΣ': '📱 Subscriptions',
        '🎬 ΣΥΝΔΡΟΜΕΣ': '🎬 Subscriptions',
        'ΣΥΝΔΡΟΜΕΣ': 'Subscriptions',
        '🧾 ΦΟΡΟΙ': '🧾 Taxes',
        '🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ': '🧾 Taxes/Accountant',
        'ΦΟΡΟΙ': 'Taxes',
        'ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ': 'Taxes/Accountant',
        '📦 ΔΙΑΦΟΡΑ': '📦 Miscellaneous',
        '🧩ΔΙΑΦΟΡΑ ΕΞΟΔΑ': '🧩 Misc Expenses',
        'ΔΙΑΦΟΡΑ': 'Miscellaneous',
        'ΔΙΑΦΟΡΑ ΕΞΟΔΑ': 'Misc Expenses',
        '🏋️ ΓΥΜΝΑΣΤΗΡΙΟ': '🏋️ Gym',
        '🏋️ΓΥΜΝΑΣΤΗΡΙΟ': '🏋️ Gym',
        'ΓΥΜΝΑΣΤΗΡΙΟ': 'Gym',
        '💻 ΤΕΧΝΟΛΟΓΙΑ': '💻 Technology',
        'ΤΕΧΝΟΛΟΓΙΑ': 'Technology',
        '💼 ΜΙΣΘΟΣ': '💼 Salary',
        'ΜΙΣΘΟΣ': 'Salary',
        '💸 BONUS': '💸 Bonus',
        'BONUS': 'Bonus',
        '🏠 ΕΝΟΙΚΙΑ': '🏠 Rent',
        'ΕΝΟΙΚΙΑ': 'Rent',
        '📈 ΕΠΕΝΔΥΣΕΙΣ': '📈 Investments',
        'ΕΠΕΝΔΥΣΕΙΣ': 'Investments',
        '🎁 ΔΩΡΑ': '🎁 Gifts',
        '🎁ΔΩΡΑ/ΕΣΟΔΑ': '🎁 Gifts/Income',
        'ΔΩΡΑ': 'Gifts',
        'ΔΩΡΑ/ΕΣΟΔΑ': 'Gifts/Income',
        '💰 CASHBACK / ΤΟΚΟΙ': '💰 Cashback / Interest',
        'CASHBACK / ΤΟΚΟΙ': 'Cashback / Interest',
        '💼 FREELANCE': '💼 Freelance',
        'FREELANCE': 'Freelance',
        '📦 ΠΩΛΗΣΕΙΣ': '📦 Sales',
        'ΠΩΛΗΣΕΙΣ': 'Sales',
        '🤑 ΕΞΤΡΑ ΕΙΣΟΔΗΜΑΤΑ': '🤑 Extra Income',
        'ΕΞΤΡΑ ΕΙΣΟΔΗΜΑΤΑ': 'Extra Income',
        'ΕΠΙΣΤΡΟΦΕΣ': 'Refunds',
        '➕ ΑΛΛΑ ΕΣΟΔΑ': '➕ Other Income',
        'ΑΛΛΑ ΕΣΟΔΑ': 'Other Income',
        '➕ ΑΛΛΑ ΕΞΟΔΑ': '➕ Other Expenses',
        'ΑΛΛΑ ΕΞΟΔΑ': 'Other Expenses',
        'Άλλα': 'Other',
        'ΑΛΛΑ': 'Other',
        'Γενικά': 'General',
        'ΓΕΝΙΚΑ': 'General',
        '💶  ΕΝΟΙΚΙΟ Β2 (Έσοδο)': '💶 Rent B2 (Income)',
        '🏛️ΜΕΡΙΔΙΟ ΔΟΣΗΣ ΔΑΝΕΙΟΥ (ΓΟΝΕΙΣ)': '🏛️ Loan Share (Parents)'
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
