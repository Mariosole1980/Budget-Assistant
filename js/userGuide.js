/**
 * js/userGuide.js
 *
 * Bilingual User Guide Engine.
 * Extracted from app.js (Phase 2 Architectural Domain Extraction).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    Object.assign(root, exports);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var windowObj = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});

windowObj._userGuideLang = 'el';

function updateUserGuideHeaderBadges() {
  const vBadge = document.getElementById('user-guide-version-badge');
  const currentVer = typeof CURRENT_BUILD !== "undefined" ? CURRENT_BUILD : (typeof getAppBuildVersion === 'function' ? getAppBuildVersion() : (state.version || 1157));
  if (vBadge) vBadge.textContent = `v${currentVer}`;
  const dBadge = document.getElementById('user-guide-date-badge');
  const lang = windowObj._userGuideLang || state.lang || 'el';
  if (dBadge) dBadge.textContent = lang === 'el' ? 'Αύγουστος 2026' : 'August 2026';
  const langLabel = document.getElementById('user-guide-lang-label');
  if (langLabel) langLabel.textContent = windowObj._userGuideLang === 'el' ? 'EN' : 'ΕΛ';
  const searchInput = document.getElementById('user-guide-search-input');
  if (searchInput) {
    searchInput.placeholder = lang === 'el' ? 'Αναζήτηση στον οδηγό (π.χ. Δόσεις, PIN, Cloud)...' : 'Search guide & FAQ (e.g. Recurring, PIN, Cloud)...';
  }
}

windowObj.openUserGuideModal = function () {
  windowObj._userGuideLang = state.lang || 'el';
  updateUserGuideHeaderBadges();
  renderUserGuideContent();
  openModal('user-guide-modal');
};

windowObj.toggleUserGuideLanguage = function () {
  windowObj._userGuideLang = (windowObj._userGuideLang === 'el') ? 'en' : 'el';
  updateUserGuideHeaderBadges();
  renderUserGuideContent();
};

windowObj.filterUserGuide = function (query) {
  const clearBtn = document.getElementById('user-guide-search-clear');
  if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';
  renderUserGuideContent(query);
};

windowObj.clearUserGuideSearch = function () {
  const input = document.getElementById('user-guide-search-input');
  if (input) input.value = '';
  windowObj.filterUserGuide('');
};

windowObj.toggleGuideChapter = function (chapterId) {
  const item = document.getElementById(`guide-chap-${chapterId}`);
  if (item) {
    item.classList.toggle('active');
  }
};

windowObj.jumpToGuideChapter = function (chapterId) {
  const item = document.getElementById(`guide-chap-${chapterId}`);
  if (item) {
    item.classList.add('active');
    item.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

function highlightGuideQuery(text, query) {
  if (!query || !query.trim() || typeof text !== 'string') return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<mark class="guide-highlight">$1</mark>');
}

const USER_GUIDE_DATA = {
  el: {
    tocTitle: '📑 Ευρετήριο Κεφαλαίων',
    chapters: [
      {
        id: 'changelog',
        icon: 'fa-box-archive',
        title: `1. Έκδοση & Τι Νέο Υπάρχει (v${typeof CURRENT_BUILD !== "undefined" ? CURRENT_BUILD : 1715})`,
        content: `
          <p><strong>Τρέχουσα Έκδοση Εφαρμογής:</strong> v${typeof CURRENT_BUILD !== "undefined" ? CURRENT_BUILD : 1715} | <strong>Ενημερώθηκε:</strong> Σεπτέμβριος 2026</p>
          <div class="guide-feature-box">
            <h5 style="margin:0 0 6px; color:var(--accent);">✨ Τι νέο υπάρχει στις τελευταίες εκδόσεις:</h5>
            <ul style="margin:0; padding-left:18px;">
              <li><strong>🏦 Αυτόματη Καταγραφή από Τράπεζες (Android):</strong> Αυτόματη ανάγνωση push ειδοποιήσεων από Eurobank, winbank (Πειραιώς), Alpha Bank, Εθνική Τράπεζα (NBG) και Revolut με έξυπνη συμπλήρωση ποσού, εμπόρου και κατηγορίας με 1 πάτημα (λειτουργεί και με κλειστή εφαρμογή).</li>
              <li><strong>📅 Ημερολόγιο Cash Flow & Πρόβλεψη Ροής:</strong> Οπτική επισκόπηση ημερήσιων εισπράξεων/δαπανών, πρόβλεψη υπολοίπου τέλους μήνα (Projected Balance), παρακολούθηση προσεχών πάγιων οφειλών και ανάλυση κινήσεων ανά ημέρα.</li>
              <li><strong>🛡️ Ασφαλές Ποσό για Έξοδα (Safe-to-Spend) & What-If:</strong> Υπολογισμός πραγματικά διαθέσιμου ποσού για καθημερινές αγορές αφού αφαιρεθούν πάγια και αποταμίευση, με προσομοιωτή μελλοντικών αγορών.</li>
              <li><strong>🔔 Βελτιστοποιημένα Εικονίδια & Ειδοποιήσεις:</strong> Νέο ενιαίο σκούρο εικονίδιο (#0F1217) χωρίς λευκά περιθώρια, μεγεθυμένο σύμβολο και άμεσες ειδοποιήσεις καταγραφής.</li>
              <li><strong>🤖 AI Οικονομικός Σύμβουλος & AI Σάρωση Αποδείξεων:</strong> Έξυπνος ψηφιακός σύμβουλος με ανάλυση των οικονομικών σας και αυτόματη καταχώρηση αποδείξεων σε 2 δευτερόλεπτα.</li>
              <li><strong>📝 Σημειωματάριο & Checklists:</strong> Αυτόνομη διαχείριση προσωπικών σημειώσεων και λιστών αγορών με κουτάκια επιλογής (Checkboxes) και κάδο ανάκτησης.</li>
            </ul>
          </div>
        `
      },
      {
        id: 'intro',
        icon: 'fa-compass',
        title: '2. Εισαγωγή & Σκοπός της Εφαρμογής',
        content: `
          <p>Το <strong>Money Manager (Budget Assistant)</strong> είναι μια σύγχρονη, ασφαλής και πλήρης εφαρμογή προσωπικής και οικογενειακής οικονομικής διαχείρισης.</p>
          <div class="guide-feature-box">
            <strong>🎯 Κύριοι Στόχοι:</strong>
            <ul class="guide-step-list">
              <li><strong>Πλήρης Έλεγχος Ροής Χρημάτων:</strong> Παρακολούθηση εσόδων, εξόδων και μεταφορών μεταξύ λογαριασμών.</li>
              <li><strong>Προϋπολογισμός & Δόσεις:</strong> Αυτόματος προγραμματισμός μηνιαίων υποχρεώσεων, δόσεων και παγίων.</li>
              <li><strong>Κοινή Χρήση (Partner Sync):</strong> Αυτόματος συγχρονισμός σε πραγματικό χρόνο μεταξύ συντρόφων ή οικογένειας.</li>
              <li><strong>Ιδιωτικότητα & Offline Πρώτα:</strong> Πλήρης λειτουργία ακόμα και χωρίς σύνδεση στο Διαδίκτυο.</li>
            </ul>
          </div>
        `
      },
      {
        id: 'navigation',
        icon: 'fa-layer-group',
        title: '3. Πλοήγηση & Βασικές Ενότητες',
        content: `
          <p>Η εφαρμογή αποτελείται από 4 κύριες καρτέλες στο κάτω μέρος της οθόνης:</p>
          <ol class="guide-step-list">
            <li><strong>💸 Κινήσεις (Transactions):</strong> Η κεντρική οθόνη καταγραφής. Εμφανίζει τη λίστα συναλλαγών του επιλεγμένου μήνα, το συνολικό υπόλοιπο, έσοδα και έξοδα.</li>
            <li><strong>📊 Στατιστικά (Stats):</strong> Αναλυτική οπτικοποίηση δαπανών ανά κατηγορία με διαγράμματα (Pie chart), ποσοστά και συγκρίσεις.</li>
            <li><strong>🏦 Λογαριασμοί (Accounts):</strong> Συνολική επισκόπηση τραπεζικών λογαριασμών, καρτών, μετρητών και υπολογισμός καθαρής θέσης (Net Worth).</li>
            <li><strong>⚙️ Περισσότερα (Settings/More):</strong> Διαχείριση προφίλ, ειδοποιήσεων, ασφάλειας PIN, σημειώσεων, κάδου ανακύκλωσης και ρυθμίσεων.</li>
          </ol>
        `
      },
      {
        id: 'transactions',
        icon: 'fa-receipt',
        title: '4. Διαχείριση Συναλλαγών, Δόσεων & Φωτογραφιών',
        content: `
          <div class="guide-feature-box">
            <h5 style="margin:0 0 4px; color:var(--text-main);">➕ Πώς προσθέτετε μια νέα συναλλαγή:</h5>
            <ol class="guide-step-list">
              <li>Πατήστε το στρογγυλό κουμπί συν <strong>(+)</strong> κάτω δεξιά.</li>
              <li>Επιλέξτε τύπο: <strong>Έξοδο</strong>, <strong>Έσοδο</strong> ή <strong>Μεταφορά</strong>.</li>
              <li>Πληκτρολογήστε το ποσό (π.χ. 45.00€) και επιλέξτε Κατηγορία & Λογαριασμό.</li>
              <li>Επιλέξτε Ημερομηνία μέσω του νέου συρόμενου Google-style <strong>Bottom Sheet Ημερολογίου</strong>.</li>
              <li>(Προαιρετικά) Προσθέστε σημείωση (π.χ. <em>🛒 Σούπερ Μάρκετ</em>) ή βγάλτε φωτογραφία την απόδειξη.</li>
              <li>Πατήστε <strong>Αποθήκευση</strong>.</li>
            </ol>
          </div>
          <div class="guide-callout-tip">
            💡 <strong>Αυτόματες Δόσεις & Επαναλαμβανόμενες:</strong> Αν ορίσετε μια συναλλαγή ως επαναλαμβανόμενη με σημείωση δόσεων (π.χ. <em>Δόση ΕΝΦΙΑ 1/12</em>), η εφαρμογή θα αυξάνει αυτόματα τον αριθμό του μήνα (2/12, 3/12... 12/12) κάθε επόμενο μήνα!
          </div>
          <div class="guide-feature-box">
            <strong>📸 Φωτογραφίες & Έξυπνη Σάρωση Αποδείξεων με AI:</strong>
            <ul class="guide-step-list">
              <li><strong>⚡ Αυτόματη Αναγνώριση AI:</strong> Τραβήξτε φωτογραφία την απόδειξή σας ή επιλέξτε την από τη συλλογή και το AI αναγνωρίζει αυτόματα το ποσό, την ημερομηνία και την προτεινόμενη κατηγορία!</li>
              <li><strong>⭐ PRO Προνόμιο:</strong> Οι Free χρήστες έχουν 5 σαρώσεις/μήνα, ενώ οι <strong>PRO χρήστες απολαμβάνουν 100 AI σαρώσεις αποδείξεων κάθε μήνα</strong>.</li>
              <li><strong>🔍 Lightbox Προβολή:</strong> Πλήρης προβολή με δυνατότητα Pinch-to-Zoom και ασφαλής τοπική αποθήκευση.</li>
            </ul>
          </div>
        `
      },
      {
        id: 'ai_advisor',
        icon: 'fa-brain',
        title: '5. AI Οικονομικός Σύμβουλος (Smart Insights)',
        content: `
          <div class="guide-feature-box">
            <h5 style="margin:0 0 6px; color:var(--accent);">🤖 Πώς λειτουργεί ο AI Σύμβουλος:</h5>
            <p style="margin:0 0 6px;">Ο AI Οικονομικός Σύμβουλος αναλύει τις καταχωρημένες συναλλαγές σας και σας προσφέρει εξατομικευμένες συμβουλές βελτιστοποίησης του προϋπολογισμού σας σε φυσική γλώσσα.</p>
            <ul class="guide-step-list">
              <li><strong>Συνομιλία σε Πραγματικό Χρόνο:</strong> Κάντε ερωτήσεις όπως <em>"Πόσα ξόδεψα αυτόν τον μήνα σε Supermarket;"</em> ή <em>"Πώς μπορώ να εξοικονομήσω 100€;"</em>.</li>
              <li><strong>Πλήρης Ιδιωτικότητα:</strong> Το ιστορικό συνομιλιών κρυπτογραφείται και απομονώνεται αυστηρά ανά λογαριασμό χρήστη.</li>
              <li><strong>Αυτόματες Προτάσεις:</strong> Εντοπισμός ασυνήθιστα υψηλών δαπανών και προτάσεις εξοικονόμησης.</li>
            </ul>
          </div>
        `
      },
      {
        id: 'notes_lists',
        icon: 'fa-note-sticky',
        title: '6. Σημειωματάριο & Λίστες Αγορών (Checklists)',
        content: `
          <div class="guide-feature-box">
            <h5 style="margin:0 0 6px; color:var(--text-main);">📝 Διαχείριση Σημειώσεων & To-Do:</h5>
            <p style="margin:0 0 6px;">Στην ενότητα Σημειώσεις μπορείτε να οργανώσετε τις οικονομικές σας σκέψεις, υποχρεώσεις και λίστες αγορών:</p>
            <ul class="guide-step-list">
              <li><strong>Λίστες με Checkboxes:</strong> Δημιουργήστε λίστες για ψώνια ή εκκρεμότητες και τσεκάρετε τα ολοκληρωμένα αντικείμενα.</li>
              <li><strong>Χρωματική Οργάνωση:</strong> Ομαδοποιήστε τις σημειώσεις σας με διαφορετικά χρώματα και ετικέτες.</li>
              <li><strong>Κάδος Σημειώσεων:</strong> Οι διαγραμμένες σημειώσεις μεταφέρονται στον δικό τους κάδο για ασφαλή επαναφορά.</li>
              <li><strong>Προσωπική Απομόνωση:</strong> Οι σημειώσεις είναι 100% προσωπικές και συνδεδεμένες με το μοναδικό σας ID.</li>
            </ul>
          </div>
        `
      },
      {
        id: 'budgeting',
        icon: 'fa-piggy-bank',
        title: '7. Προϋπολογισμός, Safe-to-Spend & Cash Flow',
        content: `
          <div class="guide-feature-box">
            <h5 style="margin:0 0 6px; color:var(--text-main);">🛡️ Ασφαλές Ποσό για Έξοδα (Safe-to-Spend):</h5>
            <p style="margin:0 0 6px;">Το <strong>Safe-to-Spend</strong> υπολογίζει δυναμικά πόσα χρήματα μπορείτε να ξοδεύετε καθημερινά για τον υπόλοιπο μήνα, αφού αφαιρεθούν όλες οι μελλοντικές πάγιες υποχρεώσεις και ο στόχος αποταμίευσης.</p>
            <p style="margin:0;"><strong>🔮 Προσομοιωτής Αγορών (What-If):</strong> Δοκιμάστε ένα υποθετικό έξοδο (π.χ. 120€ για ρούχα) και δείτε άμεσα πώς επηρεάζει το ημερήσιο διαθέσιμο ποσό σας, χωρίς να αλλοιωθούν τα πραγματικά σας δεδομένα!</p>
          </div>
          <div class="guide-feature-box">
            <h5 style="margin:0 0 6px; color:var(--text-main);">📅 Ημερολόγιο Cash Flow & Πρόβλεψη:</h5>
            <p style="margin:0 0 6px;">Πατήστε το εικονίδιο ημερολογίου στην κορυφή για να δείτε αναλυτικά τις ταμειακές ροές κάθε ημέρας του μήνα:</p>
            <ul class="guide-step-list">
              <li><strong>Πρόβλεψη Τέλους Μήνα:</strong> Εκτιμώμενο τελικό ταμειακό υπόλοιπο βάσει πραγματικών κινήσεων και προγραμματισμένων υποχρεώσεων.</li>
              <li><strong>Εκκρεμείς Πάγιες Οφειλές:</strong> Αυτόματος εντοπισμός απλήρωτων λογαριασμών με κουμπί άμεσης εξόφλησης (Quick Pay).</li>
              <li><strong>Ανάλυση Ημέρας:</strong> Πατώντας σε οποιαδήποτε ημέρα, βλέπετε όλες τις κινήσεις που πραγματοποιήθηκαν ή προβλέπονται.</li>
            </ul>
          </div>
          <div class="guide-feature-box">
            <h5 style="margin:0 0 6px; color:var(--text-main);">⚠️ Όριο Μεμονωμένης Δαπάνης (€):</h5>
            <p style="margin:0 0 6px;">Στις <em>Ρυθμίσεις -> Ειδοποιήσεις</em> μπορείτε να ενεργοποιήσετε το Όριο Μεμονωμένης Δαπάνης και να ορίσετε ένα ποσό (π.χ. <strong>500.00€</strong>).</p>
            <p style="margin:0;"><strong>Πώς λειτουργεί:</strong> Όποτε καταχωρείτε ένα έξοδο μεγαλύτερο ή ίσο με το όριο, η εφαρμογή σας προειδοποιεί αμέσως με ειδική σήμανση 🔴!</p>
          </div>
          <div class="guide-callout-tip">
            🎯 <strong>Στόχος Αποταμίευσης:</strong> Στην καρτέλα Λογαριασμοί μπορείτε να θέσετε μηνιαίο στόχο αποταμίευσης και να παρακολουθείτε την πρόοδο της αποταμίευσής σας σε ποσοστό %.
          </div>
        `
      },
      {
        id: 'notifications',
        icon: 'fa-bell',
        title: '8. Ειδοποιήσεις, Υπενθυμίσεις & Αυτόματη Καταγραφή Τραπεζών',
        content: `
          <div class="guide-feature-box">
            <h5 style="margin:0 0 6px; color:var(--accent);">🏦 Αυτόματη Καταγραφή από Push Ειδοποιήσεις Τραπεζών (Android):</h5>
            <p style="margin:0 0 6px;">Το Budget Assistant διαβάζει αυτόματα τις ειδοποιήσεις συναλλαγών από τις μεγαλύτερες ελληνικές τράπεζες και τη Revolut:</p>
            <ul class="guide-step-list">
              <li><strong>Υποστηριζόμενες Τράπεζες:</strong> Eurobank, winbank (Τράπεζα Πειραιώς), Alpha Bank, Εθνική Τράπεζα (NBG) και Revolut.</li>
              <li><strong>Ενεργοποίηση:</strong> Πηγαίνετε στις <em>Ρυθμίσεις -> Ειδοποιήσεις -> Αυτόματη Καταγραφή από Τράπεζες</em> και ενεργοποιήστε το διακόπτη.</li>
              <li><strong>Άδεια Android:</strong> Απαιτείται παραχώρηση της άδειας «Πρόσβαση σε Ειδοποιήσεις» (Notification Access) στις ρυθμίσεις του Android.</li>
              <li><strong>1-Tap Καταγραφή:</strong> Μόλις κάνετε μια αγορά, το app διαβάζει το ποσό, τον έμπορο (π.χ. Σκλαβενίτης, Efood, Wolt, Shell) και προτείνει την κατηγορία με έτοιμη φόρμα για αποθήκευση με 1 κλικ.</li>
              <li><strong>Λειτουργία με Κλειστή Εφαρμογή:</strong> Η ανίχνευση γίνεται στο παρασκήνιο σε επίπεδο συστήματος και λαμβάνετε διακριτική ειδοποίηση στο κινητό σας για άμεσο άνοιγμα.</li>
            </ul>
          </div>
          <p>Επιπλέον μηχανισμοί ειδοποιήσεων:</p>
          <ul class="guide-step-list">
            <li><strong>📝 Καθημερινή Υπενθύμιση:</strong> Σας υπενθυμίζει την ώρα που επιλέγετε (π.χ. 21:00) να καταγράψετε τα σημερινά έξοδα.</li>
            <li><strong>⏳ Ειδοποίηση Πάγιων (1 μέρα πριν):</strong> Σας ειδοποιεί αυτόματα 1 ημέρα πριν την πληρωμή μιας προγραμματισμένης πάγιας δαπάνης.</li>
            <li><strong>⚠️ Προειδοποίηση Υψηλής Δαπάνης:</strong> Ειδοποίηση τη στιγμή καταχώρησης δαπάνης πάνω από το όριο.</li>
          </ul>
          <p>Όλες οι ειδοποιήσεις καταγράφονται στο <strong>Ιστορικό Ειδοποιήσεων</strong> στις Ρυθμίσεις.</p>
        `
      },
      {
        id: 'cloud_offline',
        icon: 'fa-cloud-arrow-up',
        title: '9. Cloud Συγχρονισμός, Σύντροφος & Offline Λειτουργία',
        content: `
          <div class="guide-feature-box">
            <h5 style="margin:0 0 4px; color:var(--text-main);">☁️ Real-time Cloud Sync:</h5>
            <p style="margin:0;">Όλες οι συναλλαγές σας αποθηκεύονται ακαριαία στη συσκευή (Offline) και μόλις υπάρχει σύνδεση στο Διαδίκτυο συγχρονίζονται αυτόματα στο ασφαλές Cloud (Supabase).</p>
          </div>
          <div class="guide-feature-box">
            <h5 style="margin:0 0 4px; color:var(--text-main);">📥 Έξυπνη Μεταφορά από Offline σε Cloud Λογαριασμό:</h5>
            <p style="margin:0 0 6px;">Μπορείτε να ξεκινήσετε άφοβα ως Offline Επισκέπτης. Μόλις συνδεθείτε ή δημιουργήσετε λογαριασμό, η εφαρμογή σας δίνει 3 επιλογές:</p>
            <ul class="guide-step-list" style="margin:0; padding-left:16px;">
              <li><strong>☁️ Μεταφορά στον Λογαριασμό:</strong> Οι offline κινήσεις συγχωνεύονται στον συνδεδεμένο λογαριασμό σας με 100% ασφάλεια και προστασία από διπλότυπα (Persistent UUIDs).</li>
              <li><strong>💾 Διατήρηση μόνο Offline:</strong> Οι κινήσεις μένουν τοπικά στη συσκευή για το offline mode, ενώ ο online λογαριασμός παραμένει καθαρός.</li>
              <li><strong>🗑️ Διαγραφή:</strong> Οριστικός καθαρισμός αν ήταν απλώς δοκιμαστικά δεδομένα.</li>
            </ul>
            <p style="margin:6px 0 0; font-size:12px; color:var(--accent);">💡 <em>Μπορείτε επίσης να εκτελέσετε τη μεταφορά ανά πάσα στιγμή από τις Ρυθμίσεις -> Εισαγωγή Offline Κινήσεων.</em></p>
          </div>
          <div class="guide-feature-box">
            <h5 style="margin:0 0 4px; color:var(--text-main);">👩‍❤️‍👨 Σύνδεση Συντρόφου / Οικογένειας:</h5>
            <p style="margin:0;">Στο Προφίλ μπορείτε να συνδέσετε το λογαριασμό σας με τον/την σύντροφό σας. Όλες οι κοινές συναλλαγές εμφανίζονται αμέσως και στις δύο συσκευές σε πραγματικό χρόνο!</p>
          </div>
          <div class="guide-callout-tip">
            📡 <strong>Τι δουλεύει Offline:</strong> Τα πάντα! Μπορείτε να προσθέσετε, να επεξεργαστείτε ή να διαγράψετε συναλλαγές χωρίς ίντερνετ. Μόλις συνδεθείτε, οι αλλαγές θα ανέβουν αυτόματα στο Cloud.
          </div>
        `
      },
      {
        id: 'security_trash',
        icon: 'fa-shield-halved',
        title: '10. Ασφάλεια, Κάδος Ανακύκλωσης & Αντίγραφα (Backups)',
        content: `
          <div class="guide-feature-box">
            <h5 style="margin:0 0 4px; color:var(--text-main);">🔒 Κλείδωμα Εφαρμογής (PIN & Βιομετρικά):</h5>
            <p style="margin:0;">Στις <em>Ρυθμίσεις -> Ασφάλεια & Απόρρητο</em> μπορείτε να ενεργοποιήσετε 4ψήφιο PIN ή ξεκλείδωμα με Δακτυλικό Αποτύπωμα / FaceID.</p>
          </div>
          <div class="guide-feature-box">
            <h5 style="margin:0 0 4px; color:var(--text-main);">🗑️ Κάδος Ανακύκλωσης (Trash Bin):</h5>
            <p style="margin:0;">Καμία διαγραφή δεν είναι οριστική! Οι διαγραμμένες συναλλαγές μεταφέρονται στον Κάδο Ανακύκλωσης από όπου μπορείτε να τις επαναφέρετε ανά πάσα στιγμή.</p>
          </div>
          <div class="guide-feature-box">
            <h5 style="margin:0 0 4px; color:var(--text-main);">💾 Εξαγωγή & Εισαγωγή Δεδομένων:</h5>
            <p style="margin:0;">Μπορείτε να κάνετε πλήρη εξαγωγή των δεδομένων σας σε αρχείο <strong>JSON</strong> ή <strong>CSV (Excel)</strong> για δημιουργία αντιγράφων ασφαλείας.</p>
          </div>
        `
      },
      {
        id: 'troubleshooting',
        icon: 'fa-wrench',
        title: '11. Αντιμετώπιση Προβλημάτων (Troubleshooting)',
        content: `
          <div class="guide-callout-warning">
            ❓ <strong>"Δεν συγχρονίζουν οι συναλλαγές μου":</strong>
            <ul style="margin:4px 0 0; padding-left:16px;">
              <li>Ελέγξτε αν είστε συνδεδεμένος στο λογαριασμό σας (Ρυθμίσεις -> Λογαριασμός).</li>
              <li>Πατήστε το κουμπί <strong>"Αναγκαστική Ενημέρωση"</strong> στα Νομικά & Πληροφορίες.</li>
            </ul>
          </div>
          <div class="guide-callout-warning">
            ❓ <strong>"Δεν εμφανίζονται οι ειδοποιήσεις":</strong>
            <ul style="margin:4px 0 0; padding-left:16px;">
              <li>Βεβαιωθείτε ότι έχετε δώσει άδεια ειδοποιήσεων στη συσκευή σας Android/iOS.</li>
              <li>Ελέγξτε αν είναι ενεργοποιημένος ο διακόπτης "Καθημερινή Υπενθύμιση" στις Ρυθμίσεις.</li>
            </ul>
          </div>
          <div class="guide-callout-warning">
            ❓ <strong>"Δεν καταγράφονται αυτόματα οι ειδοποιήσεις της τράπεζάς μου":</strong>
            <ul style="margin:4px 0 0; padding-left:16px;">
              <li>Ελέγξτε αν ο διακόπτης "Αυτόματη Καταγραφή από Τράπεζες" είναι ενεργός στις <em>Ρυθμίσεις -> Ειδοποιήσεις</em>.</li>
              <li>Βεβαιωθείτε ότι έχετε δώσει άδεια <strong>«Πρόσβαση σε Ειδοποιήσεις» (Notification Access)</strong> στο Budget Assistant στις Ρυθμίσεις της συσκευής σας Android.</li>
              <li>Σε συσκευές Samsung, Xiaomi, Huawei, ορίστε τη χρήση μπαταρίας της εφαρμογής σε <strong>«Χωρίς περιορισμούς» (Unrestricted)</strong> ώστε το λειτουργικό σύστημα να μην καθυστερεί τις background διεργασίες.</li>
            </ul>
          </div>
          <div class="guide-callout-warning">
            ❓ <strong>"Ξέχασα το PIN κλειδώματος":</strong>
            <ul style="margin:4px 0 0; padding-left:16px;">
              <li>Μπορείτε να χρησιμοποιήσετε τα Βιομετρικά (Δακτυλικό Αποτύπωμα) ή να κάνετε αποσύνδεση/επανασύνδεση λογαριασμού.</li>
            </ul>
          </div>
        `
      },
      {
        id: 'faq',
        icon: 'fa-circle-question',
        title: '12. Συχνές Ερωτήσεις (FAQ)',
        content: `
          <div class="guide-feature-box">
            <strong>Q: Είναι τα δεδομένα μου ασφαλή;</strong>
            <p style="margin:2px 0 8px;">A: Ναι! Όλα τα δεδομένα κρυπτογραφούνται κατά τη μεταφορά και την αποθήκευση στο Supabase Cloud.</p>
            <strong>Q: Πόσο κοστίζει η εφαρμογή;</strong>
            <p style="margin:2px 0 8px;">A: Όλες οι βασικές λειτουργίες παρέχονται δωρεάν, με διαθέσιμες Premium επιλογές.</p>
            <strong>Q: Μπορώ να χρησιμοποιήσω την εφαρμογή σε περισσότερες από μία συσκευές;</strong>
            <p style="margin:2px 0 0;">A: Ναι, συνδεθείτε με το ίδιο email και τα δεδομένα σας θα συγχρονιστούν αυτόματα παντού.</p>
          </div>
        `
      },
      {
        id: 'tips_gestures',
        icon: 'fa-hand-pointer',
        title: '13. Συμβουλές, Χειρονομίες & Προσβασιμότητα',
        content: `
          <div class="guide-feature-box">
            <strong>🖐️ Χειρονομίες (Gestures):</strong>
            <ul class="guide-step-list">
              <li><strong>Edge Swipe Back:</strong> Σύρετε από την αριστερή άκρη της οθόνης προς τα δεξιά για να επιστρέψετε στην προηγούμενη καρτέλα ή να κλείσετε οποιοδήποτε παράθυρο.</li>
              <li><strong>Horizontal Month Swipe:</strong> Σύρετε οριζόντια στη λίστα συναλλαγών για να αλλάξετε μήνα (Προηγούμενος / Επόμενος).</li>
              <li><strong>Pull to Refresh:</strong> Σύρετε προς τα κάτω στην κορυφή της οθόνης για να ανανεώσετε τα δεδομένα.</li>
            </ul>
          </div>
        `
      }
    ]
  },
  en: {
    tocTitle: '📑 Table of Contents',
    chapters: [
      {
        id: 'changelog',
        icon: 'fa-box-archive',
        title: `1. Version & What's New (v${typeof CURRENT_BUILD !== "undefined" ? CURRENT_BUILD : 1715})`,
        content: `
          <p><strong>Guide Version:</strong> v${typeof CURRENT_BUILD !== "undefined" ? CURRENT_BUILD : 1715} | <strong>Updated:</strong> September 2026</p>
          <div class="guide-feature-box">
            <h5 style="margin:0 0 6px; color:var(--primary);">✨ What's new in the latest releases:</h5>
            <ul style="margin:0; padding-left:18px;">
              <li><strong>🏦 Bank Notification Auto-Capture (Android):</strong> Automatic detection of push transaction alerts from Eurobank, winbank (Piraeus), Alpha Bank, NBG, and Revolut with auto-predicted merchant, amount & category, and 1-tap logging (even when the app is closed).</li>
              <li><strong>📅 Cash Flow Calendar & Forecast:</strong> Interactive daily cash flow map, month-end projected balance, upcoming recurring bills tracker, and day drawer breakdown.</li>
              <li><strong>🛡️ Safe-to-Spend & What-If Simulator:</strong> Real-time calculation of daily spending allowance after recurring bills and savings targets, with instant What-If purchase simulator.</li>
              <li><strong>🔔 Redesigned Notification & App Icons:</strong> Clean dark icon design (#0F1217) without white borders, enlarged neon logo symbol, and instant Android notification alerts.</li>
              <li><strong>🤖 AI Advisor & Smart Receipt Scanner:</strong> Intelligent AI financial insights and instant receipt OCR in 2 seconds.</li>
              <li><strong>📝 Notepad & Checklists:</strong> Standalone notes and shopping checklists with checkboxes, custom tags, and dedicated trash bin.</li>
            </ul>
          </div>
        `
      },
      {
        id: 'intro',
        icon: 'fa-compass',
        title: '2. Introduction & Purpose',
        content: `
          <p><strong>Money Manager (Budget Assistant)</strong> is a modern, secure, and comprehensive personal and family financial management application.</p>
          <div class="guide-feature-box">
            <strong>🎯 Key Objectives:</strong>
            <ul class="guide-step-list">
              <li><strong>Full Cashflow Control:</strong> Track income, expenses, and account transfers.</li>
              <li><strong>Budgeting & Installments:</strong> Auto-schedule monthly obligations, recurring bills, and installments.</li>
              <li><strong>Partner & Family Sync:</strong> Real-time automatic synchronization between partners or family members.</li>
              <li><strong>Privacy & Offline First:</strong> Full functionality even without an active internet connection.</li>
            </ul>
          </div>
        `
      },
      {
        id: 'navigation',
        icon: 'fa-layer-group',
        title: '3. Navigation & Core Screens',
        content: `
          <p>The app features 4 main bottom navigation tabs:</p>
          <ol class="guide-step-list">
            <li><strong>💸 Transactions:</strong> The primary logging screen displaying transactions for the selected month, total balance, income, and expenses.</li>
            <li><strong>📊 Analytics:</strong> Visual category breakdown with pie charts, percentages, and period comparisons.</li>
            <li><strong>🏦 Accounts:</strong> Overview of bank accounts, credit cards, cash, and Net Worth calculation.</li>
            <li><strong>⚙️ More (Settings):</strong> Manage profile, notifications, PIN security, notes, trash bin, and preferences.</li>
          </ol>
        `
      },
      {
        id: 'transactions',
        icon: 'fa-receipt',
        title: '4. Managing Transactions, Installments & Photos',
        content: `
          <div class="guide-feature-box">
            <h5 style="margin:0 0 4px; color:var(--text-main);">➕ How to log a new transaction:</h5>
            <ol class="guide-step-list">
              <li>Tap the round plus button <strong>(+)</strong> at the bottom right.</li>
              <li>Select type: <strong>Expense</strong>, <strong>Income</strong>, or <strong>Transfer</strong>.</li>
              <li>Enter amount (e.g. €45.00) and pick Category & Account.</li>
              <li>Select Date using the new Google-style <strong>Bottom Sheet Calendar</strong>.</li>
              <li>(Optional) Add a note (e.g. <em>🛒 Supermarket</em>) or take a receipt photo.</li>
              <li>Tap <strong>Save</strong>.</li>
            </ol>
          </div>
          <div class="guide-callout-tip">
            💡 <strong>Recurring Installments:</strong> Setting a recurring template with installment notes (e.g., <em>Tax Installment 1/12</em>) automatically increments month counters (2/12, 3/12... 12/12) every month!
          </div>
          <div class="guide-feature-box">
            <strong>📸 Receipt Photos & Smart AI Scanning:</strong>
            <ul class="guide-step-list">
              <li><strong>⚡ Smart AI Auto-Fill:</strong> Snap a receipt photo or choose one from your gallery and AI will automatically parse the amount, date, and suggest the right category!</li>
              <li><strong>⭐ PRO Benefit:</strong> Free users get 5 scans/month, while <strong>PRO users enjoy 100 AI receipt scans every month</strong>.</li>
              <li><strong>🔍 Lightbox Zoom:</strong> Full pinch-to-zoom viewer with secure local offline storage.</li>
            </ul>
          </div>
        `
      },
      {
        id: 'ai_advisor',
        icon: 'fa-brain',
        title: '5. AI Financial Advisor (Smart Insights)',
        content: `
          <div class="guide-feature-box">
            <h5 style="margin:0 0 6px; color:var(--primary);">🤖 How the AI Advisor works:</h5>
            <p style="margin:0 0 6px;">The AI Advisor analyzes your logged transactions to offer tailored financial insights and savings advice in natural language.</p>
            <ul class="guide-step-list">
              <li><strong>Interactive Real-Time Chat:</strong> Ask questions like <em>"How much did I spend on groceries this month?"</em> or <em>"How can I save €100?"</em>.</li>
              <li><strong>Complete Privacy:</strong> Chat conversations are encrypted and isolated per user account.</li>
            </ul>
          </div>
        `
      },
      {
        id: 'notes_lists',
        icon: 'fa-note-sticky',
        title: '6. Notepad & Shopping Checklists',
        content: `
          <div class="guide-feature-box">
            <h5 style="margin:0 0 6px; color:var(--text-main);">📝 Notes & Checklists Management:</h5>
            <p style="margin:0 0 6px;">Organize your financial reminders and shopping lists easily:</p>
            <ul class="guide-step-list">
              <li><strong>Checklist Items:</strong> Create to-do lists and check off completed items.</li>
              <li><strong>Color Tags & Trash:</strong> Organize notes with custom colors and recover deleted notes from the Notes Trash.</li>
              <li><strong>User Scoped:</strong> All notes are strictly private to your account ID.</li>
            </ul>
          </div>
        `
      },
      {
        id: 'budgeting',
        icon: 'fa-piggy-bank',
        title: '7. Budgeting, Safe-to-Spend & Cash Flow',
        content: `
          <div class="guide-feature-box">
            <h5 style="margin:0 0 6px; color:var(--text-main);">🛡️ Safe-to-Spend Allowance:</h5>
            <p style="margin:0 0 6px;"><strong>Safe-to-Spend</strong> dynamically calculates how much you can safely spend per day for the rest of the month, after accounting for all scheduled bills and your monthly savings target.</p>
            <p style="margin:0;"><strong>🔮 What-If Simulator:</strong> Test potential purchases (e.g. €120 for clothes) to immediately preview how your daily allowance adjusts—without modifying your actual data!</p>
          </div>
          <div class="guide-feature-box">
            <h5 style="margin:0 0 6px; color:var(--text-main);">📅 Cash Flow Calendar & Forecast:</h5>
            <p style="margin:0 0 6px;">Tap the calendar icon on the top bar to open the Cash Flow Calendar:</p>
            <ul class="guide-step-list">
              <li><strong>Month-End Projection:</strong> See your estimated final balance based on actual cash flows and scheduled obligations.</li>
              <li><strong>Pending Recurring Bills:</strong> Auto-detects unpaid obligations with 1-tap Quick Pay action.</li>
              <li><strong>Day-by-Day Breakdown:</strong> Tap any day to inspect all historical or projected transactions.</li>
            </ul>
          </div>
          <div class="guide-feature-box">
            <h5 style="margin:0 0 6px; color:var(--text-main);">⚠️ Single Expense Alert (€):</h5>
            <p style="margin:0 0 6px;">In <em>Settings -> Notifications</em> enable Single Expense Alert and set a threshold (e.g. <strong>€500.00</strong>).</p>
            <p style="margin:0;"><strong>How it works:</strong> Whenever you record an expense equal to or exceeding your threshold, the app immediately alerts you 🔴!</p>
          </div>
        `
      },
      {
        id: 'notifications',
        icon: 'fa-bell',
        title: '8. Notification Center & Bank Auto-Capture',
        content: `
          <div class="guide-feature-box">
            <h5 style="margin:0 0 6px; color:var(--accent);">🏦 Bank Push Notification Auto-Capture (Android):</h5>
            <p style="margin:0 0 6px;">Budget Assistant automatically captures push payment alerts from Greek banks and Revolut:</p>
            <ul class="guide-step-list">
              <li><strong>Supported Banks:</strong> Eurobank, winbank (Piraeus Bank), Alpha Bank, National Bank of Greece (NBG), and Revolut.</li>
              <li><strong>Activation:</strong> Enable the toggle under <em>Settings -> Notifications -> Bank Notifications Reader</em>.</li>
              <li><strong>Android Permission:</strong> Grant "Notification Access" in Android Settings when prompted.</li>
              <li><strong>1-Tap Review:</strong> When a payment occurs, the app extracts the merchant name, amount, and suggests a category for 1-tap confirmation.</li>
              <li><strong>Background Support:</strong> Operates at the OS system level even when Budget Assistant is completely closed.</li>
            </ul>
          </div>
          <p>Additional notification triggers:</p>
          <ul class="guide-step-list">
            <li><strong>📝 Daily Reminder:</strong> Reminds you at your designated time (e.g. 21:00) to log daily expenses.</li>
            <li><strong>⏳ Recurring Payment Alert (1-day prior):</strong> Automatically notifies you 1 day before a recurring payment is due.</li>
            <li><strong>⚠️ High Expense Alert:</strong> Immediate alert upon logging an expense above your limit.</li>
          </ul>
        `
      },
      {
        id: 'cloud_offline',
        icon: 'fa-cloud-arrow-up',
        title: '9. Cloud Sync, Partner Sharing & Offline Mode',
        content: `
          <div class="guide-feature-box">
            <h5 style="margin:0 0 4px; color:var(--text-main);">☁️ Real-time Cloud Sync:</h5>
            <p style="margin:0;">Transactions are stored instantly on-device (Offline) and automatically synced to Supabase Cloud whenever internet is available.</p>
          </div>
          <div class="guide-feature-box">
            <h5 style="margin:0 0 4px; color:var(--text-main);">📥 Smart Offline-to-Cloud Migration:</h5>
            <p style="margin:0 0 6px;">Feel free to start as an Offline Guest. The moment you sign in or register with an account, the app offers 3 flexible choices:</p>
            <ul class="guide-step-list" style="margin:0; padding-left:16px;">
              <li><strong>☁️ Transfer to Account:</strong> Merges your offline transactions into your cloud account with 100% safety and zero duplicates (Persistent UUIDs).</li>
              <li><strong>💾 Keep Offline Only:</strong> Keeps transactions stored locally on the device for guest mode, leaving the cloud account clean.</li>
              <li><strong>🗑️ Delete / Discard:</strong> Permanently cleans up test data if you don't need it.</li>
            </ul>
            <p style="margin:6px 0 0; font-size:12px; color:var(--accent);">💡 <em>You can also trigger the transfer anytime via Settings -> Import Offline Transactions.</em></p>
          </div>
          <div class="guide-callout-tip">
            📡 <strong>Offline Capability:</strong> Everything works offline! You can add, edit, or delete transactions without internet connection.
          </div>
        `
      },
      {
        id: 'security_trash',
        icon: 'fa-shield-halved',
        title: '10. Security, Trash Bin & Backups',
        content: `
          <div class="guide-feature-box">
            <h5 style="margin:0 0 4px; color:var(--text-main);">🔒 App Lock (PIN & Biometrics):</h5>
            <p style="margin:0;">Enable 4-digit PIN or Fingerprint/FaceID lock under <em>Settings -> Security & Privacy</em>.</p>
          </div>
          <div class="guide-feature-box">
            <h5 style="margin:0 0 4px; color:var(--text-main);">🗑️ Trash Bin & Data Export:</h5>
            <p style="margin:0;">Deleted items move to the Trash Bin for easy recovery. You can also export data to <strong>JSON</strong> or <strong>CSV</strong> anytime.</p>
          </div>
        `
      },
      {
        id: 'troubleshooting',
        icon: 'fa-wrench',
        title: '11. Troubleshooting Guide',
        content: `
          <div class="guide-callout-warning">
            ❓ <strong>"Transactions not syncing":</strong>
            <ul style="margin:4px 0 0; padding-left:16px;">
              <li>Verify you are signed in under Settings -> Account.</li>
              <li>Tap <strong>"Force Update"</strong> in Legal & Info.</li>
            </ul>
          </div>
          <div class="guide-callout-warning">
            ❓ <strong>"Bank notifications are not captured automatically":</strong>
            <ul style="margin:4px 0 0; padding-left:16px;">
              <li>Verify that "Bank Notifications Reader" is enabled in <em>Settings -> Notifications</em>.</li>
              <li>Ensure <strong>"Notification Access"</strong> permission is granted to Budget Assistant in Android Settings.</li>
              <li>On Samsung, Xiaomi, or Huawei devices, set Battery usage to <strong>"Unrestricted"</strong> to prevent OS background suspension.</li>
            </ul>
          </div>
          <div class="guide-callout-warning">
            ❓ <strong>"Notifications not appearing":</strong>
            <ul style="margin:4px 0 0; padding-left:16px;">
              <li>Ensure notification permissions are granted in Android/iOS settings.</li>
            </ul>
          </div>
        `
      },
      {
        id: 'faq',
        icon: 'fa-circle-question',
        title: '12. Frequently Asked Questions (FAQ)',
        content: `
          <div class="guide-feature-box">
            <strong>Q: Is my financial data safe?</strong>
            <p style="margin:2px 0 8px;">A: Yes! All data is encrypted during transit and at rest in Supabase Cloud.</p>
            <strong>Q: Can I use the app across multiple devices?</strong>
            <p style="margin:2px 0 0;">A: Yes, sign in with the same account email to auto-sync everywhere.</p>
          </div>
        `
      },
      {
        id: 'tips_gestures',
        icon: 'fa-hand-pointer',
        title: '13. Tips, Gestures & Accessibility',
        content: `
          <div class="guide-feature-box">
            <strong>🖐️ Gestures:</strong>
            <ul class="guide-step-list">
              <li><strong>Edge Swipe Back:</strong> Drag from left screen edge to go back or close modals.</li>
              <li><strong>Horizontal Month Swipe:</strong> Swipe horizontally on transactions list to change month.</li>
            </ul>
          </div>
        `
      }
    ]
  }
};

function renderUserGuideContent(query = '') {
  const container = document.getElementById('user-guide-body');
  if (!container) return;

  const lang = windowObj._userGuideLang || 'el';
  const data = USER_GUIDE_DATA[lang] || USER_GUIDE_DATA.el;
  const q = (query || '').trim().toLowerCase();

  let html = '';

  // Table of Contents (2-Column Quick Navigation Grid)
  if (!q) {
    const tocTitleText = lang === 'el' ? '📑 Γρήγορη Πλοήγηση' : '📑 Quick Navigation';
    html += `
      <div class="guide-toc-section">
        <div class="guide-toc-title"><i class="fa-solid fa-compass" style="color:var(--accent);"></i> ${tocTitleText}</div>
        <div class="guide-toc-grid">
    `;
    data.chapters.forEach(chap => {
      // Strip chapter numbering for clean card label
      const cardTitle = chap.title.replace(/^\d+\.\s*/, '');
      html += `
        <div class="guide-toc-card" onclick="jumpToGuideChapter('${chap.id}')" title="${chap.title}">
          <div class="guide-toc-icon"><i class="fa-solid ${chap.icon}"></i></div>
          <div class="guide-toc-text">${cardTitle}</div>
        </div>
      `;
    });
    html += `
        </div>
      </div>
    `;
  }

  // Chapters (Accordions)
  data.chapters.forEach((chap, idx) => {
    const rawTitle = chap.title;
    const rawContent = chap.content;
    const isMatch = !q || rawTitle.toLowerCase().includes(q) || rawContent.toLowerCase().includes(q);

    if (!isMatch) return;

    const displayTitle = q ? highlightGuideQuery(rawTitle, q) : rawTitle;
    const displayContent = q ? highlightGuideQuery(rawContent, q) : rawContent;
    const activeClass = (q || idx === 0) ? ' active' : '';

    html += `
      <div class="guide-accordion-item${activeClass}" id="guide-chap-${chap.id}">
        <div class="guide-accordion-header" onclick="toggleGuideChapter('${chap.id}')">
          <span><i class="fa-solid ${chap.icon}" style="margin-right:8px; color:var(--primary);"></i> ${displayTitle}</span>
          <i class="fa-solid fa-chevron-right guide-accordion-icon"></i>
        </div>
        <div class="guide-accordion-content">
          ${displayContent}
        </div>
      </div>
    `;
  });

  if (q && !html) {
    const noResultsText = (lang === 'el')
      ? '❌ Δεν βρέθηκαν αποτελέσματα για την αναζήτησή σας.'
      : '❌ No matching guide topics found.';
    html = `<div style="text-align:center; padding:30px 10px; color:var(--text-muted);">${noResultsText}</div>`;
  }

  container.innerHTML = html;
}

  return {
    USER_GUIDE_DATA: USER_GUIDE_DATA,
    updateUserGuideHeaderBadges: updateUserGuideHeaderBadges,
    openUserGuideModal: windowObj.openUserGuideModal,
    toggleUserGuideLanguage: windowObj.toggleUserGuideLanguage,
    filterUserGuide: windowObj.filterUserGuide,
    clearUserGuideSearch: windowObj.clearUserGuideSearch,
    toggleGuideChapter: windowObj.toggleGuideChapter,
    jumpToGuideChapter: windowObj.jumpToGuideChapter,
    highlightGuideQuery: highlightGuideQuery,
    renderUserGuideContent: renderUserGuideContent
  };
});
