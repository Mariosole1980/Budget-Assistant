/**
 * categoryIcons.js
 *
 * Centralized Category Vector Icon Design System & Registry for Budget Assistant.
 * Built with FontAwesome 6 Solid icons, Neon palette glow badges, thematic libraries,
 * and live Greek/English keyword search.
 *
 * UMD wrapper:
 *   - CommonJS/Node: module.exports
 *   - Browser: window.BACategoryIcons + global aliases
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BACategoryIcons = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 10 Thematic Libraries
  const ICON_LIBRARIES = [
    { id: 'food', labelEl: 'Φαγητό', labelEn: 'Food', icon: 'fa-solid fa-burger' },
    { id: 'shopping', labelEl: 'Αγορές', labelEn: 'Shopping', icon: 'fa-solid fa-cart-shopping' },
    { id: 'transport', labelEl: 'Μεταφορές', labelEn: 'Transport', icon: 'fa-solid fa-car' },
    { id: 'home', labelEl: 'Σπίτι', labelEn: 'Home', icon: 'fa-solid fa-house' },
    { id: 'health', labelEl: 'Υγεία', labelEn: 'Health', icon: 'fa-solid fa-heart-pulse' },
    { id: 'finance', labelEl: 'Οικονομικά', labelEn: 'Finance', icon: 'fa-solid fa-wallet' },
    { id: 'entertainment', labelEl: 'Διασκέδαση', labelEn: 'Fun', icon: 'fa-solid fa-gamepad' },
    { id: 'tech', labelEl: 'Τεχνολογία', labelEn: 'Tech', icon: 'fa-solid fa-laptop' },
    { id: 'education', labelEl: 'Παιδεία & Pets', labelEn: 'Education', icon: 'fa-solid fa-graduation-cap' },
    { id: 'general', labelEl: 'Γενικά', labelEn: 'General', icon: 'fa-solid fa-star' }
  ];

  // 215 Verified FontAwesome 6 Solid Icons (Zero Missing, Zero Cross-Library Duplication)
  const CATEGORY_ICON_REGISTRY = [
    // 🍔 FOOD & DRINKS (30 icons)
    { id: 'burger', icon: 'fa-solid fa-burger', library: 'food', keywords: ['burger', 'φαγητό', 'μπέργκερ', 'fast food', 'food', 'snack'] },
    { id: 'pizza-slice', icon: 'fa-solid fa-pizza-slice', library: 'food', keywords: ['pizza', 'πίτσα', 'delivery', 'φαγητό', 'food'] },
    { id: 'utensils', icon: 'fa-solid fa-utensils', library: 'food', keywords: ['restaurant', 'εστιατόριο', 'μαχαιροπίρουνο', 'food', 'dining'] },
    { id: 'mug-hot', icon: 'fa-solid fa-mug-hot', library: 'food', keywords: ['coffee', 'καφές', 'tea', 'τσάι', 'ρόφημα', 'cafe'] },
    { id: 'basket-shopping', icon: 'fa-solid fa-basket-shopping', library: 'food', keywords: ['supermarket', 'σουπερμαρκετ', 'σουπερ μαρκετ', 'καλάθι', 'τρόφιμα', 'groceries', 'market'] },
    { id: 'bowl-food', icon: 'fa-solid fa-bowl-food', library: 'food', keywords: ['bowl', 'γεύμα', 'σαλάτα', 'μαγειρευτό', 'food', 'salad'] },
    { id: 'apple-whole', icon: 'fa-solid fa-apple-whole', library: 'food', keywords: ['apple', 'μήλο', 'φρούτα', 'μανάβικο', 'fruit'] },
    { id: 'carrot', icon: 'fa-solid fa-carrot', library: 'food', keywords: ['carrot', 'καρότο', 'λαχανικά', 'λαϊκή', 'vegetables'] },
    { id: 'fish', icon: 'fa-solid fa-fish', library: 'food', keywords: ['fish', 'ψάρι', 'ψαράδικο', 'seafood'] },
    { id: 'drumstick-bite', icon: 'fa-solid fa-drumstick-bite', library: 'food', keywords: ['chicken', 'κοτόπουλο', 'κρεοπωλείο', 'meat', 'κρέας'] },
    { id: 'cake-candles', icon: 'fa-solid fa-cake-candles', library: 'food', keywords: ['cake', 'τούρτα', 'γενέθλια', 'ζαχαροπλαστείο', 'birthday'] },
    { id: 'ice-cream', icon: 'fa-solid fa-ice-cream', library: 'food', keywords: ['ice cream', 'παγωτό', 'γλυκό', 'dessert'] },
    { id: 'cookie', icon: 'fa-solid fa-cookie', library: 'food', keywords: ['cookie', 'μπισκότο', 'γλυκά', 'cookies'] },
    { id: 'cookie-bite', icon: 'fa-solid fa-cookie-bite', library: 'food', keywords: ['snack', 'σνακ', 'μπισκότα'] },
    { id: 'bread-slice', icon: 'fa-solid fa-bread-slice', library: 'food', keywords: ['bread', 'ψωμί', 'φούρνος', 'bakery'] },
    { id: 'beer-mug-empty', icon: 'fa-solid fa-beer-mug-empty', library: 'food', keywords: ['beer', 'μπύρα', 'ποτό', 'pub', 'bar'] },
    { id: 'wine-glass', icon: 'fa-solid fa-wine-glass', library: 'food', keywords: ['wine', 'κρασί', 'ποτό', 'έξοδος'] },
    { id: 'martini-glass', icon: 'fa-solid fa-martini-glass', library: 'food', keywords: ['cocktail', 'κοκτέιλ', 'bar', 'club'] },
    { id: 'bottle-water', icon: 'fa-solid fa-bottle-water', library: 'food', keywords: ['water', 'νερό', 'μπουκάλι', 'αναψυκτικά'] },
    { id: 'egg', icon: 'fa-solid fa-egg', library: 'food', keywords: ['egg', 'αυγά', 'πρωινό', 'breakfast'] },
    { id: 'cheese', icon: 'fa-solid fa-cheese', library: 'food', keywords: ['cheese', 'τυρί', 'τυροκομικά', 'dairy'] },
    { id: 'bacon', icon: 'fa-solid fa-bacon', library: 'food', keywords: ['bacon', 'μπέικον', 'αλλαντικά'] },
    { id: 'wheat-awn', icon: 'fa-solid fa-wheat-awn', library: 'food', keywords: ['wheat', 'σιτηρά', 'δημητριακά', 'bio'] },
    { id: 'lemon', icon: 'fa-solid fa-lemon', library: 'food', keywords: ['lemon', 'λεμόνι', 'χυμός', 'juice'] },
    { id: 'spoon', icon: 'fa-solid fa-spoon', library: 'food', keywords: ['spoon', 'κουτάλι', 'φαγητό'] },
    { id: 'glass-water', icon: 'fa-solid fa-glass-water', library: 'food', keywords: ['glass', 'ποτήρι', 'νερό'] },
    { id: 'champagne-glasses', icon: 'fa-solid fa-champagne-glasses', library: 'food', keywords: ['champagne', 'σαμπάνια', 'γιορτή', 'celebration'] },
    { id: 'jar', icon: 'fa-solid fa-jar', library: 'food', keywords: ['jar', 'βάζο', 'μέλι', 'μαρμελάδα'] },
    { id: 'candy-cane', icon: 'fa-solid fa-candy-cane', library: 'food', keywords: ['candy', 'καραμέλες', 'γλυκά'] },
    { id: 'plate-wheat', icon: 'fa-solid fa-plate-wheat', library: 'food', keywords: ['plate', 'πιάτο', 'διατροφή', 'diet'] },

    // 🛒 SHOPPING & RETAIL (20 icons)
    { id: 'cart-shopping', icon: 'fa-solid fa-cart-shopping', library: 'shopping', keywords: ['cart', 'καλάθι', 'αγορές', 'shopping', 'store'] },
    { id: 'bag-shopping', icon: 'fa-solid fa-bag-shopping', library: 'shopping', keywords: ['bag', 'τσάντα', 'ψώνια', 'shopping', 'mall'] },
    { id: 'shirt', icon: 'fa-solid fa-shirt', library: 'shopping', keywords: ['clothes', 'ρούχα', 'ένδυση', 'μπλούζα', 'fashion'] },
    { id: 'gem', icon: 'fa-solid fa-gem', library: 'shopping', keywords: ['jewelry', 'κοσμήματα', 'διαμάντι', 'luxury'] },
    { id: 'glasses', icon: 'fa-solid fa-glasses', library: 'shopping', keywords: ['glasses', 'γυαλιά', 'οπτικά', 'accessories'] },
    { id: 'tags', icon: 'fa-solid fa-tags', library: 'shopping', keywords: ['tags', 'εκπτώσεις', 'προσφορές', 'sales', 'discounts'] },
    { id: 'tag', icon: 'fa-solid fa-tag', library: 'shopping', keywords: ['tag', 'ετικέτα', 'τιμή', 'price'] },
    { id: 'gift', icon: 'fa-solid fa-gift', library: 'shopping', keywords: ['gift', 'δώρο', 'δώρα', 'presents'] },
    { id: 'store', icon: 'fa-solid fa-store', library: 'shopping', keywords: ['store', 'κατάστημα', 'μαγαζί', 'shop'] },
    { id: 'shop', icon: 'fa-solid fa-shop', library: 'shopping', keywords: ['shop', 'εμπόριο', 'boutique'] },
    { id: 'receipt', icon: 'fa-solid fa-receipt', library: 'shopping', keywords: ['receipt', 'απόδειξη', 'λογαριασμός', 'bill'] },
    { id: 'barcode', icon: 'fa-solid fa-barcode', library: 'shopping', keywords: ['barcode', 'κωδικός', 'προϊόν'] },
    { id: 'shoe-prints', icon: 'fa-solid fa-shoe-prints', library: 'shopping', keywords: ['shoes', 'παπούτσια', 'υπόδηση', 'footwear'] },
    { id: 'box-open', icon: 'fa-solid fa-box-open', library: 'shopping', keywords: ['package', 'δέμα', 'πακέτο', 'courier', 'delivery'] },
    { id: 'scissors', icon: 'fa-solid fa-scissors', library: 'shopping', keywords: ['scissors', 'κομμωτήριο', 'κουρείο', 'haircut', 'barber'] },
    { id: 'spray-can-sparkles', icon: 'fa-solid fa-spray-can-sparkles', library: 'shopping', keywords: ['cosmetics', 'καλλυντικά', 'άρωμα', 'perfume', 'beauty'] },
    { id: 'credit-card', icon: 'fa-solid fa-credit-card', library: 'shopping', keywords: ['card', 'κάρτα', 'πληρωμή', 'pos'] },
    { id: 'cart-plus', icon: 'fa-solid fa-cart-plus', library: 'shopping', keywords: ['add to cart', 'παραγγελία', 'order'] },
    { id: 'socks', icon: 'fa-solid fa-socks', library: 'shopping', keywords: ['socks', 'κάλτσες', 'εσώρουχα', 'underwear'] },
    { id: 'hat-cowboy', icon: 'fa-solid fa-hat-cowboy', library: 'shopping', keywords: ['hat', 'καπέλο', 'αξεσουάρ', 'fashion'] },

    // 🚗 TRANSPORT & TRAVEL (23 icons)
    { id: 'car', icon: 'fa-solid fa-car', library: 'transport', keywords: ['car', 'αυτοκίνητο', 'όχημα', 'auto'] },
    { id: 'car-side', icon: 'fa-solid fa-car-side', library: 'transport', keywords: ['transport', 'μεταφορές', 'μετακίνηση', 'ride'] },
    { id: 'gas-pump', icon: 'fa-solid fa-gas-pump', library: 'transport', keywords: ['gas', 'βενζίνη', 'καύσιμα', 'fuel', 'petrol'] },
    { id: 'charging-station', icon: 'fa-solid fa-charging-station', library: 'transport', keywords: ['ev', 'ηλεκτρικό', 'φόρτιση', 'electric car'] },
    { id: 'wrench', icon: 'fa-solid fa-wrench', library: 'transport', keywords: ['service', 'συνεργείο', 'επισκευή', 'μηχανικός', 'repair'] },
    { id: 'bus', icon: 'fa-solid fa-bus', library: 'transport', keywords: ['bus', 'λεωφορείο', 'αστικό', 'κτελ'] },
    { id: 'train-subway', icon: 'fa-solid fa-train-subway', library: 'transport', keywords: ['metro', 'μετρό', 'υπόγειος', 'subway', 'τραμ'] },
    { id: 'train', icon: 'fa-solid fa-train', library: 'transport', keywords: ['train', 'τρένο', 'οσε', 'railway'] },
    { id: 'plane', icon: 'fa-solid fa-plane', library: 'transport', keywords: ['plane', 'αεροπλάνο', 'πτήση', 'ταξίδι', 'flight', 'travel'] },
    { id: 'plane-departure', icon: 'fa-solid fa-plane-departure', library: 'transport', keywords: ['flight', 'αναχώρηση', 'αεροδρόμιο', 'vacation'] },
    { id: 'motorcycle', icon: 'fa-solid fa-motorcycle', library: 'transport', keywords: ['moto', 'μηχανή', 'μηχανάκι', 'scooter'] },
    { id: 'bicycle', icon: 'fa-solid fa-bicycle', library: 'transport', keywords: ['bike', 'ποδήλατο', 'cycling'] },
    { id: 'taxi', icon: 'fa-solid fa-taxi', library: 'transport', keywords: ['taxi', 'ταξί', 'uber', 'freenow'] },
    { id: 'ship', icon: 'fa-solid fa-ship', library: 'transport', keywords: ['ship', 'πλοίο', 'καράβι', 'ακτοπλοϊκά', 'ferry'] },
    { id: 'ticket', icon: 'fa-solid fa-ticket', library: 'transport', keywords: ['ticket', 'εισιτήριο', 'διόδια', 'tolls', 'e-pass'] },
    { id: 'route', icon: 'fa-solid fa-route', library: 'transport', keywords: ['route', 'διαδρομή', 'ταξίδι', 'gps', 'navigation'] },
    { id: 'truck', icon: 'fa-solid fa-truck', library: 'transport', keywords: ['truck', 'φορτηγό', 'μετακόμιση', 'moving'] },
    { id: 'oil-well', icon: 'fa-solid fa-oil-well', library: 'transport', keywords: ['oil', 'λάδια', 'λιπαντικά', 'πετρέλαιο'] },
    { id: 'anchor', icon: 'fa-solid fa-anchor', library: 'transport', keywords: ['boat', 'σκάφος', 'μαρίνα', 'λιμάνι'] },
    { id: 'car-battery', icon: 'fa-solid fa-car-battery', library: 'transport', keywords: ['battery', 'μπαταρία', 'ανταλλακτικά'] },
    { id: 'van-shuttle', icon: 'fa-solid fa-van-shuttle', library: 'transport', keywords: ['van', 'βαν', 'πούλμαν', 'shuttle'] },
    { id: 'helicopter', icon: 'fa-solid fa-helicopter', library: 'transport', keywords: ['helicopter', 'ελικόπτερο', 'αεροπορικά'] },
    { id: 'compass', icon: 'fa-solid fa-compass', library: 'transport', keywords: ['compass', 'πυξίδα', 'εξερεύνηση', 'travel'] },

    // 🏠 HOME & UTILITIES (24 icons)
    { id: 'house', icon: 'fa-solid fa-house', library: 'home', keywords: ['home', 'σπίτι', 'κατοικία', 'ενοίκιο', 'rent', 'house'] },
    { id: 'building', icon: 'fa-solid fa-building', library: 'home', keywords: ['apartment', 'πολυκατοικία', 'κοινόχρηστα', 'γραφείο', 'office'] },
    { id: 'couch', icon: 'fa-solid fa-couch', library: 'home', keywords: ['furniture', 'έπιπλα', 'σαλόνι', 'διακόσμηση', 'decor'] },
    { id: 'bolt', icon: 'fa-solid fa-bolt', library: 'home', keywords: ['electricity', 'δεη', 'ρεύμα', 'ενέργεια', 'power', 'light'] },
    { id: 'faucet-drip', icon: 'fa-solid fa-faucet-drip', library: 'home', keywords: ['water', 'ευδαπ', 'νερό', 'υδραυλικά', 'plumbing'] },
    { id: 'wifi', icon: 'fa-solid fa-wifi', library: 'home', keywords: ['internet', 'ίντερνετ', 'wifi', 'cosmote', 'vodafone', 'nova'] },
    { id: 'tv', icon: 'fa-solid fa-tv', library: 'home', keywords: ['tv', 'τηλεόραση', 'netflix', 'streaming'] },
    { id: 'shield-halved', icon: 'fa-solid fa-shield-halved', library: 'home', keywords: ['insurance', 'ασφάλεια', 'συναγερμός', 'security'] },
    { id: 'key', icon: 'fa-solid fa-key', library: 'home', keywords: ['key', 'κλειδί', 'ενοικίαση', 'airbnb', 'locksmith'] },
    { id: 'plug', icon: 'fa-solid fa-plug', library: 'home', keywords: ['appliances', 'ηλεκτρικές συσκευές', 'σύνδεση'] },
    { id: 'fire', icon: 'fa-solid fa-fire', library: 'home', keywords: ['gas', 'φυσικό αέριο', 'θέρμανση', 'heating', 'boiler'] },
    { id: 'broom', icon: 'fa-solid fa-broom', library: 'home', keywords: ['cleaning', 'καθαριότητα', 'απορρυπαντικά', 'housekeeping'] },
    { id: 'bed', icon: 'fa-solid fa-bed', library: 'home', keywords: ['bed', 'υπνοδωμάτιο', 'στρώμα', 'ξενοδοχείο', 'hotel'] },
    { id: 'bath', icon: 'fa-solid fa-bath', library: 'home', keywords: ['bath', 'μπάνιο', 'είδη υγιεινής'] },
    { id: 'shower', icon: 'fa-solid fa-shower', library: 'home', keywords: ['shower', 'ντους', 'υδραυλικός'] },
    { id: 'hammer', icon: 'fa-solid fa-hammer', library: 'home', keywords: ['renovation', 'ανακαίνιση', 'μαστορέματα', 'tools'] },
    { id: 'toolbox', icon: 'fa-solid fa-toolbox', library: 'home', keywords: ['toolbox', 'εργαλεία', 'συντήρηση', 'maintenance'] },
    { id: 'lightbulb', icon: 'fa-solid fa-lightbulb', library: 'home', keywords: ['lamp', 'λάμπες', 'φωτισμός', 'ιδέες'] },
    { id: 'toilet', icon: 'fa-solid fa-toilet', library: 'home', keywords: ['toilet', 'χαρτικά', 'μπάνιο'] },
    { id: 'door-open', icon: 'fa-solid fa-door-open', library: 'home', keywords: ['door', 'πόρτες', 'κουφώματα', 'αλουμίνια'] },
    { id: 'paint-roller', icon: 'fa-solid fa-paint-roller', library: 'home', keywords: ['paint', 'βάψιμο', 'χρώματα', 'ελαιοχρωματιστής'] },
    { id: 'temperature-half', icon: 'fa-solid fa-temperature-half', library: 'home', keywords: ['climate', 'κλιματισμός', 'ac', 'air condition'] },
    { id: 'lock', icon: 'fa-solid fa-lock', library: 'home', keywords: ['lock', 'κλειδαριά', 'προστασία'] },
    { id: 'fan', icon: 'fa-solid fa-fan', library: 'home', keywords: ['fan', 'ανεμιστήρας', 'εξαερισμός'] },

    // ❤️ HEALTH & FITNESS (20 icons)
    { id: 'heart-pulse', icon: 'fa-solid fa-heart-pulse', library: 'health', keywords: ['health', 'υγεία', 'καρδιά', 'ιατρικά', 'pulse', 'medical'] },
    { id: 'stethoscope', icon: 'fa-solid fa-stethoscope', library: 'health', keywords: ['doctor', 'γιατρός', 'εξέταση', 'κλινική'] },
    { id: 'pills', icon: 'fa-solid fa-pills', library: 'health', keywords: ['pharmacy', 'φαρμακείο', 'χάπια', 'φάρμακα', 'medicine'] },
    { id: 'capsules', icon: 'fa-solid fa-capsules', library: 'health', keywords: ['supplements', 'συμπληρώματα', 'βιταμίνες', 'vitamins'] },
    { id: 'syringe', icon: 'fa-solid fa-syringe', library: 'health', keywords: ['vaccine', 'εμβόλιο', 'εξετάσεις αίματος', 'μικροβιολόγος'] },
    { id: 'hospital', icon: 'fa-solid fa-hospital', library: 'health', keywords: ['hospital', 'νοσοκομείο', 'νοσηλεία', 'θεραπεία'] },
    { id: 'tooth', icon: 'fa-solid fa-tooth', library: 'health', keywords: ['dentist', 'οδοντίατρος', 'δόντια', 'dental'] },
    { id: 'spa', icon: 'fa-solid fa-spa', library: 'health', keywords: ['spa', 'μασάζ', 'χαλάρωση', 'massage', 'wellness'] },
    { id: 'dumbbell', icon: 'fa-solid fa-dumbbell', library: 'health', keywords: ['gym', 'γυμναστήριο', 'βάρη', 'fitness', 'workout'] },
    { id: 'person-running', icon: 'fa-solid fa-person-running', library: 'health', keywords: ['running', 'τρέξιμο', 'αθλητισμός', 'sports'] },
    { id: 'person-biking', icon: 'fa-solid fa-person-biking', library: 'health', keywords: ['cycling', 'ποδηλασία', 'άσκηση'] },
    { id: 'person-swimming', icon: 'fa-solid fa-person-swimming', library: 'health', keywords: ['swimming', 'κολυμβητήριο', 'κολύμπι', 'pool'] },
    { id: 'kit-medical', icon: 'fa-solid fa-kit-medical', library: 'health', keywords: ['first aid', 'πρώτες βοήθειες', 'ιατρικό κουτί'] },
    { id: 'eye', icon: 'fa-solid fa-eye', library: 'health', keywords: ['optometrist', 'οφθαλμίατρος', 'μάτια', 'όραση'] },
    { id: 'bandage', icon: 'fa-solid fa-bandage', library: 'health', keywords: ['bandage', 'επίδεσμος', 'τραυματισμός'] },
    { id: 'user-doctor', icon: 'fa-solid fa-user-doctor', library: 'health', keywords: ['specialist', 'ειδικός γιατρός', 'παθολόγος'] },
    { id: 'heart', icon: 'fa-solid fa-heart', library: 'health', keywords: ['care', 'φροντίδα', 'αγάπη', 'love'] },
    { id: 'dna', icon: 'fa-solid fa-dna', library: 'health', keywords: ['genetics', 'dna', 'διαγνωστικό κέντρο'] },
    { id: 'wheelchair', icon: 'fa-solid fa-wheelchair', library: 'health', keywords: ['accessibility', 'αμεα', 'κινητικότητα'] },
    { id: 'hand-dots', icon: 'fa-solid fa-hand-dots', library: 'health', keywords: ['dermatology', 'δερματολόγος', 'αλλεργίες'] },

    // 💼 FINANCE & WORK (20 icons)
    { id: 'briefcase', icon: 'fa-solid fa-briefcase', library: 'finance', keywords: ['salary', 'μισθός', 'εργασία', 'δουλειά', 'work', 'job'] },
    { id: 'wallet', icon: 'fa-solid fa-wallet', library: 'finance', keywords: ['wallet', 'πορτοφόλι', 'μετρητά', 'cash'] },
    { id: 'coins', icon: 'fa-solid fa-coins', library: 'finance', keywords: ['coins', 'κέρματα', 'ψιλά', 'ρέστα', 'interest', 'τόκοι'] },
    { id: 'money-bill-wave', icon: 'fa-solid fa-money-bill-wave', library: 'finance', keywords: ['money', 'χρήματα', 'χαρτονομίσματα', 'εισόδημα', 'income'] },
    { id: 'money-bill-1', icon: 'fa-solid fa-money-bill-1', library: 'finance', keywords: ['cash', 'μετρητά', 'πληρωμή'] },
    { id: 'money-check-dollar', icon: 'fa-solid fa-money-check-dollar', library: 'finance', keywords: ['check', 'επιταγή', 'μεταφορά', 'τραπεζική'] },
    { id: 'piggy-bank', icon: 'fa-solid fa-piggy-bank', library: 'finance', keywords: ['savings', 'αποταμίευση', 'κουμπαράς', 'saving'] },
    { id: 'chart-line', icon: 'fa-solid fa-chart-line', library: 'finance', keywords: ['investments', 'επενδύσεις', 'μετοχές', 'crypto', 'stocks'] },
    { id: 'chart-pie', icon: 'fa-solid fa-chart-pie', library: 'finance', keywords: ['budget', 'προϋπολογισμός', 'κατανομή', 'stats'] },
    { id: 'landmark', icon: 'fa-solid fa-landmark', library: 'finance', keywords: ['bank', 'τράπεζα', 'τραπεζικά', 'δάνειο', 'loan'] },
    { id: 'building-columns', icon: 'fa-solid fa-building-columns', library: 'finance', keywords: ['institution', 'εφορία', 'κράτος', 'δημόσιο', 'taxes'] },
    { id: 'vault', icon: 'fa-solid fa-vault', library: 'finance', keywords: ['vault', 'θυρίδα', 'χρηματοκιβώτιο', 'ασφάλεια'] },
    { id: 'sack-dollar', icon: 'fa-solid fa-sack-dollar', library: 'finance', keywords: ['bonus', 'μπόνους', 'κέρδη', 'profit'] },
    { id: 'scale-balanced', icon: 'fa-solid fa-scale-balanced', library: 'finance', keywords: ['legal', 'δικηγόρος', 'συμβολαιογράφος', 'δικαστικά'] },
    { id: 'hand-holding-dollar', icon: 'fa-solid fa-hand-holding-dollar', library: 'finance', keywords: ['allowance', 'επίδομα', 'δωρεά', 'χρηματοδότηση'] },
    { id: 'stamp', icon: 'fa-solid fa-stamp', library: 'finance', keywords: ['fees', 'παράβολα', 'χαρτόσημο', 'επικύρωση'] },
    { id: 'calculator', icon: 'fa-solid fa-calculator', library: 'finance', keywords: ['accounting', 'λογιστής', 'υπολογισμοί', 'accountant'] },
    { id: 'arrow-trend-up', icon: 'fa-solid fa-arrow-trend-up', library: 'finance', keywords: ['growth', 'ανάπτυξη', 'κέρδος', 'dividends'] },
    { id: 'percent', icon: 'fa-solid fa-percent', library: 'finance', keywords: ['interest', 'τόκος', 'προμήθεια', 'discount'] },
    { id: 'file-invoice-dollar', icon: 'fa-solid fa-file-invoice-dollar', library: 'finance', keywords: ['invoice', 'τιμολόγιο', 'μπλοκάκι', 'freelance'] },

    // 🎉 ENTERTAINMENT & LEISURE (20 icons)
    { id: 'gamepad', icon: 'fa-solid fa-gamepad', library: 'entertainment', keywords: ['gaming', 'παιχνίδια', 'playstation', 'xbox', 'steam', 'games'] },
    { id: 'film', icon: 'fa-solid fa-film', library: 'entertainment', keywords: ['cinema', 'σινεμά', 'ταινίες', 'movies', 'cinema'] },
    { id: 'music', icon: 'fa-solid fa-music', library: 'entertainment', keywords: ['music', 'μουσική', 'spotify', 'συναυλία', 'concert'] },
    { id: 'headphones', icon: 'fa-solid fa-headphones', library: 'entertainment', keywords: ['audio', 'ακουστικά', 'podcast', 'streaming'] },
    { id: 'guitar', icon: 'fa-solid fa-guitar', library: 'entertainment', keywords: ['instruments', 'κιθάρα', 'μουσικά όργανα', 'μαθήματα'] },
    { id: 'camera', icon: 'fa-solid fa-camera', library: 'entertainment', keywords: ['photo', 'φωτογραφία', 'κάμερα', 'photography'] },
    { id: 'palette', icon: 'fa-solid fa-palette', library: 'entertainment', keywords: ['art', 'ζωγραφική', 'τέχνη', 'χόμπι', 'hobbies'] },
    { id: 'dice', icon: 'fa-solid fa-dice', library: 'entertainment', keywords: ['board games', 'επιτραπέζια', 'ζάρια', 'καζίνο', 'casino'] },
    { id: 'trophy', icon: 'fa-solid fa-trophy', library: 'entertainment', keywords: ['trophy', 'κύπελλο', 'νίκη', 'στοίχημα', 'betting'] },
    { id: 'medal', icon: 'fa-solid fa-medal', library: 'entertainment', keywords: ['medal', 'μετάλλιο', 'διάκριση', 'αγώνας'] },
    { id: 'futbol', icon: 'fa-solid fa-futbol', library: 'entertainment', keywords: ['football', 'ποδόσφαιρο', 'γήπεδο', 'εισιτήρια αγώνα'] },
    { id: 'basketball', icon: 'fa-solid fa-basketball', library: 'entertainment', keywords: ['basketball', 'μπάσκετ', 'αθλήματα'] },
    { id: 'chess', icon: 'fa-solid fa-chess', library: 'entertainment', keywords: ['chess', 'σκάκι', 'στρατηγική'] },
    { id: 'ticket-simple', icon: 'fa-solid fa-ticket-simple', library: 'entertainment', keywords: ['event', 'εκδήλωση', 'πάρτι', 'party'] },
    { id: 'vr-cardboard', icon: 'fa-solid fa-vr-cardboard', library: 'entertainment', keywords: ['vr', 'virtual reality', 'τεχνολογία'] },
    { id: 'masks-theater', icon: 'fa-solid fa-masks-theater', library: 'entertainment', keywords: ['theater', 'θέατρο', 'παράσταση', 'show'] },
    { id: 'umbrella-beach', icon: 'fa-solid fa-umbrella-beach', library: 'entertainment', keywords: ['beach', 'διακοπές', 'παραλία', 'summer', 'vacation'] },
    { id: 'bowling-ball', icon: 'fa-solid fa-bowling-ball', library: 'entertainment', keywords: ['bowling', 'μπόουλινγκ', 'διασκέδαση'] },
    { id: 'microphone', icon: 'fa-solid fa-microphone', library: 'entertainment', keywords: ['karaoke', 'καραόκε', 'μικρόφωνο', 'παρουσίαση'] },
    { id: 'puzzle-piece', icon: 'fa-solid fa-puzzle-piece', library: 'entertainment', keywords: ['puzzle', 'παζλ', 'διασκέδαση'] },

    // 💻 TECH & GADGETS (19 icons)
    { id: 'laptop', icon: 'fa-solid fa-laptop', library: 'tech', keywords: ['laptop', 'υπολογιστής', 'λάπτοπ', 'macbook', 'pc'] },
    { id: 'mobile-screen', icon: 'fa-solid fa-mobile-screen', library: 'tech', keywords: ['phone', 'κινητό', 'τηλέφωνο', 'smartphone', 'iphone'] },
    { id: 'desktop', icon: 'fa-solid fa-desktop', library: 'tech', keywords: ['computer', 'οθόνη', 'pc desktop', 'hardware'] },
    { id: 'tablet-screen-button', icon: 'fa-solid fa-tablet-screen-button', library: 'tech', keywords: ['tablet', 'τάμπλετ', 'ipad'] },
    { id: 'microchip', icon: 'fa-solid fa-microchip', library: 'tech', keywords: ['chip', 'επεξεργαστής', 'τεχνολογία', 'gadgets'] },
    { id: 'robot', icon: 'fa-solid fa-robot', library: 'tech', keywords: ['ai', 'ρομπότ', 'αυτοματισμός', 'software'] },
    { id: 'hard-drive', icon: 'fa-solid fa-hard-drive', library: 'tech', keywords: ['storage', 'σκληρός δίσκος', 'backup', 'cloud'] },
    { id: 'keyboard', icon: 'fa-solid fa-keyboard', library: 'tech', keywords: ['keyboard', 'πληκτρολόγιο', 'αξεσουάρ υπολογιστή'] },
    { id: 'code', icon: 'fa-solid fa-code', library: 'tech', keywords: ['programming', 'προγραμματισμός', 'ανάπτυξη', 'domain', 'hosting'] },
    { id: 'server', icon: 'fa-solid fa-server', library: 'tech', keywords: ['server', 'σέρβερ', 'υποδομές', 'data'] },
    { id: 'satellite-dish', icon: 'fa-solid fa-satellite-dish', library: 'tech', keywords: ['satellite', 'δορυφορική', 'κεραία', 'σήμα'] },
    { id: 'battery-full', icon: 'fa-solid fa-battery-full', library: 'tech', keywords: ['battery', 'μπαταρία', 'powerbank', 'φορτιστής'] },
    { id: 'print', icon: 'fa-solid fa-print', library: 'tech', keywords: ['printer', 'εκτυπωτής', 'μελάνια', 'εκτυπώσεις'] },
    { id: 'database', icon: 'fa-solid fa-database', library: 'tech', keywords: ['database', 'βάση δεδομένων', 'cloud storage'] },
    { id: 'network-wired', icon: 'fa-solid fa-network-wired', library: 'tech', keywords: ['network', 'δίκτυο', 'ethernet', 'lan'] },
    { id: 'compact-disc', icon: 'fa-solid fa-compact-disc', library: 'tech', keywords: ['disc', 'cd', 'dvd', 'media'] },
    { id: 'plug-circle-bolt', icon: 'fa-solid fa-plug-circle-bolt', library: 'tech', keywords: ['charger', 'φορτιστής', 'καλώδια', 'cables'] },
    { id: 'power-off', icon: 'fa-solid fa-power-off', library: 'tech', keywords: ['power', 'διακόπτης', 'συσκευή'] },
    { id: 'tower-broadcast', icon: 'fa-solid fa-tower-broadcast', library: 'tech', keywords: ['antenna', 'ραδιόφωνο', 'εκπομπή', 'telecom'] },

    // 🎓 EDUCATION & PETS (19 icons)
    { id: 'graduation-cap', icon: 'fa-solid fa-graduation-cap', library: 'education', keywords: ['education', 'εκπαίδευση', 'πανεπιστήμιο', 'πτυχίο', 'studies'] },
    { id: 'book', icon: 'fa-solid fa-book', library: 'education', keywords: ['book', 'βιβλίο', 'βιβλιοπωλείο', 'διάβασμα', 'reading'] },
    { id: 'book-open', icon: 'fa-solid fa-book-open', library: 'education', keywords: ['textbook', 'φροντιστήριο', 'μαθήματα', 'lessons'] },
    { id: 'school', icon: 'fa-solid fa-school', library: 'education', keywords: ['school', 'σχολείο', 'δίδακτρα', 'tuition'] },
    { id: 'child', icon: 'fa-solid fa-child', library: 'education', keywords: ['child', 'παιδί', 'παιδικά', 'παιδικός σταθμός', 'kids'] },
    { id: 'baby', icon: 'fa-solid fa-baby', library: 'education', keywords: ['baby', 'μωρό', 'πάνες', 'βρεφικά', 'infant'] },
    { id: 'paw', icon: 'fa-solid fa-paw', library: 'education', keywords: ['pet', 'κατοικίδιο', 'ζώα', 'σκύλος', 'γάτα', 'vet'] },
    { id: 'dog', icon: 'fa-solid fa-dog', library: 'education', keywords: ['dog', 'σκύλος', 'τροφή σκύλου', 'pet shop'] },
    { id: 'cat', icon: 'fa-solid fa-cat', library: 'education', keywords: ['cat', 'γάτα', 'τροφή γάτας', 'κτηνίατρος'] },
    { id: 'tree', icon: 'fa-solid fa-tree', library: 'education', keywords: ['tree', 'κήπος', 'φυτά', 'γεωπονικά', 'garden'] },
    { id: 'seedling', icon: 'fa-solid fa-seedling', library: 'education', keywords: ['plant', 'γλάστρες', 'λουλούδια', 'άνθη'] },
    { id: 'leaf', icon: 'fa-solid fa-leaf', library: 'education', keywords: ['nature', 'φύση', 'οικολογία', 'eco'] },
    { id: 'atom', icon: 'fa-solid fa-atom', library: 'education', keywords: ['science', 'επιστήμη', 'σεμινάρια', 'research'] },
    { id: 'landmark-dome', icon: 'fa-solid fa-landmark-dome', library: 'education', keywords: ['museum', 'μουσείο', 'πολιτισμός', 'culture'] },
    { id: 'chalkboard-user', icon: 'fa-solid fa-chalkboard-user', library: 'education', keywords: ['teacher', 'δάσκαλος', 'καθηγητής', 'σεμινάριο'] },
    { id: 'feather-pointed', icon: 'fa-solid fa-feather-pointed', library: 'education', keywords: ['pen', 'συγγραφή', 'γραφική ύλη'] },
    { id: 'earth-americas', icon: 'fa-solid fa-earth-americas', library: 'education', keywords: ['geography', 'ξένες γλώσσες', 'languages'] },
    { id: 'flask', icon: 'fa-solid fa-flask', library: 'education', keywords: ['lab', 'εργαστήριο', 'χημεία', 'πείραμα'] },
    { id: 'brain', icon: 'fa-solid fa-brain', library: 'education', keywords: ['mind', 'ψυχολογία', 'αυτοβελτίωση', 'psychology'] },

    // ⭐ GENERAL & SYMBOLS (20 icons)
    { id: 'star', icon: 'fa-solid fa-star', library: 'general', keywords: ['star', 'αστέρι', 'αγαπημένα', 'favorites', 'special'] },
    { id: 'crown', icon: 'fa-solid fa-crown', library: 'general', keywords: ['vip', 'στέμμα', 'premium', 'exclusive'] },
    { id: 'shapes', icon: 'fa-solid fa-shapes', library: 'general', keywords: ['misc', 'διάφορα', 'λοιπά', 'γενικά', 'other'] },
    { id: 'folder', icon: 'fa-solid fa-folder', library: 'general', keywords: ['folder', 'φάκελος', 'αρχεία', 'έγγραφα'] },
    { id: 'bell', icon: 'fa-solid fa-bell', library: 'general', keywords: ['reminder', 'υπενθύμιση', 'ειδοποίηση', 'alert'] },
    { id: 'flag', icon: 'fa-solid fa-flag', library: 'general', keywords: ['goal', 'στόχος', 'σημαία', 'milestone'] },
    { id: 'location-dot', icon: 'fa-solid fa-location-dot', library: 'general', keywords: ['location', 'τοποθεσία', 'σημείο', 'place'] },
    { id: 'sun', icon: 'fa-solid fa-sun', library: 'general', keywords: ['sun', 'ήλιος', 'ημέρα', 'day'] },
    { id: 'moon', icon: 'fa-solid fa-moon', library: 'general', keywords: ['moon', 'φεγγάρι', 'νύχτα', 'night'] },
    { id: 'cloud', icon: 'fa-solid fa-cloud', library: 'general', keywords: ['cloud', 'σύννεφο', 'καιρός', 'weather'] },
    { id: 'umbrella', icon: 'fa-solid fa-umbrella', library: 'general', keywords: ['protection', 'ομπρέλα', 'προστασία'] },
    { id: 'circle-check', icon: 'fa-solid fa-circle-check', library: 'general', keywords: ['done', 'ολοκληρωμένο', 'επιτυχία', 'check'] },
    { id: 'plus', icon: 'fa-solid fa-plus', library: 'general', keywords: ['add', 'προσθήκη', 'συν', 'έξτρα'] },
    { id: 'circle-exclamation', icon: 'fa-solid fa-circle-exclamation', library: 'general', keywords: ['warning', 'προσοχή', 'επείγον', 'urgent'] },
    { id: 'circle-info', icon: 'fa-solid fa-circle-info', library: 'general', keywords: ['info', 'πληροφορίες', 'λεπτομέρειες'] },
    { id: 'bullseye', icon: 'fa-solid fa-bullseye', library: 'general', keywords: ['target', 'στόχος', 'budget limit'] },
    { id: 'paperclip', icon: 'fa-solid fa-paperclip', library: 'general', keywords: ['attachment', 'συνημμένο', 'αρχείο'] },
    { id: 'bookmark', icon: 'fa-solid fa-bookmark', library: 'general', keywords: ['bookmark', 'σελιδοδείκτης', 'σημαντικό'] },
    { id: 'share-nodes', icon: 'fa-solid fa-share-nodes', library: 'general', keywords: ['share', 'κοινοποίηση', 'σύνδεσμος'] },
    { id: 'sliders', icon: 'fa-solid fa-sliders', library: 'general', keywords: ['settings', 'ρυθμίσεις', 'προτιμήσεις'] }
  ];

  // Mapping from legacy emoji / codepoint to FontAwesome solid classes
  const EMOJI_TO_FA_MAP = {
    '🏠': 'fa-solid fa-house',
    '🏡': 'fa-solid fa-house',
    '🍔': 'fa-solid fa-burger',
    '🛒': 'fa-solid fa-basket-shopping',
    '🚗': 'fa-solid fa-car-side',
    '❤️': 'fa-solid fa-heart-pulse',
    '🎓': 'fa-solid fa-graduation-cap',
    '🎉': 'fa-solid fa-icons',
    '👕': 'fa-solid fa-bag-shopping',
    '📱': 'fa-solid fa-film',
    '🧾': 'fa-solid fa-receipt',
    '📦': 'fa-solid fa-shapes',
    '💼': 'fa-solid fa-briefcase',
    '💸': 'fa-solid fa-award',
    '📈': 'fa-solid fa-chart-line',
    '🎁': 'fa-solid fa-gift',
    '💰': 'fa-solid fa-coins',
    '➕': 'fa-solid fa-plus',
    '🏋️': 'fa-solid fa-dumbbell',
    '🚇': 'fa-solid fa-train-subway',
    '💻': 'fa-solid fa-laptop',
    '🎬': 'fa-solid fa-film',
    '🧩': 'fa-solid fa-shapes',
    '🤑': 'fa-solid fa-sack-dollar',
    '💶': 'fa-solid fa-money-bill-wave',
    '🏛️': 'fa-solid fa-building-columns',
    '🏅': 'fa-solid fa-medal',
    '👨': 'fa-solid fa-child',
    '💵': 'fa-solid fa-money-bill-1',
    '🔧': 'fa-solid fa-wrench',
    '⭐': 'fa-solid fa-star',
    '🔥': 'fa-solid fa-fire',
    '🎯': 'fa-solid fa-bullseye',
    '☕': 'fa-solid fa-mug-hot',
    '🎵': 'fa-solid fa-music',
    '✈️': 'fa-solid fa-plane',
    '🏖️': 'fa-solid fa-umbrella-beach',
    '📚': 'fa-solid fa-book',
    '🐶': 'fa-solid fa-dog',
    '🌱': 'fa-solid fa-seedling',
    '💡': 'fa-solid fa-lightbulb',
    '🗂️': 'fa-solid fa-folder',
    '🛠️': 'fa-solid fa-toolbox',
    '🎮': 'fa-solid fa-gamepad'
  };

  /**
   * Helper: Normalize string by stripping Greek accents and lowercasing
   */
  function normalizeSearchText(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Search registered category icons
   */
  function searchCategoryIcons(query, libraryId = 'all') {
    const q = normalizeSearchText(query);
    return CATEGORY_ICON_REGISTRY.filter(item => {
      if (libraryId !== 'all' && item.library !== libraryId) {
        return false;
      }
      if (!q) return true;
      if (item.id.toLowerCase().includes(q)) return true;
      return item.keywords.some(kw => normalizeSearchText(kw).includes(q));
    });
  }

  /**
   * Universal Category Visual Resolver
   * Resolves category objects, legacy strings, or custom names into
   * a uniform visual structure { iconClass, color, bgGlow, name, displayName }.
   */
  function getCategoryVisual(categoryInput, transType = 'expense') {
    let rawName = '';
    let rawIcon = '';
    let rawColor = '';

    if (typeof categoryInput === 'object' && categoryInput !== null) {
      rawName = categoryInput.name || categoryInput.category || '';
      rawIcon = categoryInput.icon || '';
      rawColor = categoryInput.color || '';
    } else if (typeof categoryInput === 'string') {
      rawName = categoryInput;
    }

    const fallbackColor = transType === 'income' ? '#4caf50' : (transType === 'transfer' ? '#3b82f6' : '#78909c');
    const color = rawColor || '#78909c';
    const bgGlow = hexToRgba(color, 0.14);

    // 1. If explicit FontAwesome class provided in icon field
    if (rawIcon && rawIcon.startsWith('fa-')) {
      const fullClass = rawIcon.startsWith('fa-solid ') ? rawIcon : `fa-solid ${rawIcon}`;
      return { iconClass: fullClass, color, bgGlow, rawName };
    }

    // 2. If emoji in icon field
    if (rawIcon && EMOJI_TO_FA_MAP[rawIcon]) {
      return { iconClass: EMOJI_TO_FA_MAP[rawIcon], color, bgGlow, rawName };
    }

    // 3. Extract leading emoji from category name string (e.g. "🚗 ΜΕΤΑΦΟΡΕΣ")
    const leadingEmojiMatch = rawName.match(/^([\uD800-\uDBFF][\uDC00-\uDFFF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83D[\uDE80-\uDEFF]|[\u2600-\u27BF]|\uD83E[\uDD00-\uDDFF])/);
    if (leadingEmojiMatch && EMOJI_TO_FA_MAP[leadingEmojiMatch[0]]) {
      return { iconClass: EMOJI_TO_FA_MAP[leadingEmojiMatch[0]], color, bgGlow, rawName };
    }

    // 4. Match cleaned category name by keywords
    const norm = normalizeSearchText(rawName);
    if (norm) {
      if (norm.includes('σουπερ') || norm.includes('supermarket') || norm.includes('μαρκετ')) {
        return { iconClass: 'fa-solid fa-basket-shopping', color: color || '#f59e0b', bgGlow, rawName };
      }
      if (norm.includes('φαγητο') || norm.includes('food') || norm.includes('τροφιμα') || norm.includes('delivery')) {
        return { iconClass: 'fa-solid fa-burger', color: color || '#ffb300', bgGlow, rawName };
      }
      if (norm.includes('σπιτι') || norm.includes('home') || norm.includes('ενοικιο') || norm.includes('rent')) {
        return { iconClass: 'fa-solid fa-house', color: color || '#e05e55', bgGlow, rawName };
      }
      if (norm.includes('μεταφορ') || norm.includes('transport') || norm.includes('αυτοκινητ') || norm.includes('car')) {
        return { iconClass: 'fa-solid fa-car-side', color: color || '#ffa726', bgGlow, rawName };
      }
      if (norm.includes('υγει') || norm.includes('health') || norm.includes('γιατρ') || norm.includes('φαρμακ')) {
        return { iconClass: 'fa-solid fa-heart-pulse', color: color || '#ef5350', bgGlow, rawName };
      }
      if (norm.includes('μισθο') || norm.includes('salary') || norm.includes('εργασια') || norm.includes('δουλει')) {
        return { iconClass: 'fa-solid fa-briefcase', color: color || '#4caf50', bgGlow, rawName };
      }
      if (norm.includes('αγορ') || norm.includes('shopping') || norm.includes('ρουχ')) {
        return { iconClass: 'fa-solid fa-bag-shopping', color: color || '#7e57c2', bgGlow, rawName };
      }
      if (norm.includes('συνδρομ') || norm.includes('subscription') || norm.includes('netflix') || norm.includes('spotify')) {
        return { iconClass: 'fa-solid fa-film', color: color || '#ec407a', bgGlow, rawName };
      }
      if (norm.includes('φορο') || norm.includes('tax') || norm.includes('λογιστ')) {
        return { iconClass: 'fa-solid fa-receipt', color: color || '#26c6da', bgGlow, rawName };
      }
      if (norm.includes('επενδυσ') || norm.includes('invest')) {
        return { iconClass: 'fa-solid fa-chart-line', color: color || '#8bc34a', bgGlow, rawName };
      }
      if (norm.includes('δωρ') || norm.includes('gift')) {
        return { iconClass: 'fa-solid fa-gift', color: color || '#66bb6a', bgGlow, rawName };
      }
      if (norm.includes('διασκεδασ') || norm.includes('fun') || norm.includes('εξοδ')) {
        return { iconClass: 'fa-solid fa-icons', color: color || '#26a69a', bgGlow, rawName };
      }
    }

    // 5. Default Fallbacks by transaction type
    let defaultClass = 'fa-solid fa-shapes';
    if (transType === 'income') defaultClass = 'fa-solid fa-wallet';
    else if (transType === 'transfer') defaultClass = 'fa-solid fa-arrow-right-arrow-left';
    else defaultClass = 'fa-solid fa-tag';

    return { iconClass: defaultClass, color: color || fallbackColor, bgGlow, rawName };
  }

  /**
   * Helper: Convert hex to rgba
   */
  function hexToRgba(hex, alpha = 0.14) {
    if (!hex || typeof hex !== 'string') return `rgba(120, 144, 156, ${alpha})`;
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    if (cleanHex.length !== 6) return `rgba(120, 144, 156, ${alpha})`;
    const r = parseInt(cleanHex.substring(0, 2), 16) || 120;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 144;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 156;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Universal HTML Category Icon Component Renderer
   */
  function renderCategoryIconHtml(categoryInput, options = {}) {
    const {
      size = 'md', // 'sm' (28px), 'md' (40px), 'lg' (48px), 'inline' (1em)
      customColor = null,
      customClass = '',
      showGlow = true,
      transType = 'expense'
    } = options;

    const visual = getCategoryVisual(categoryInput, transType);
    const color = customColor || visual.color || '#78909c';
    const bgGlow = hexToRgba(color, 0.15);
    const borderGlow = hexToRgba(color, 0.28);

    if (size === 'inline') {
      return `<i class="${visual.iconClass} ${customClass}" style="color: ${color};" aria-hidden="true"></i>`;
    }

    const sizeDimensions = {
      sm: { dim: '28px', radius: '8px', fontSize: '13px' },
      md: { dim: '40px', radius: '12px', fontSize: '17px' },
      lg: { dim: '48px', radius: '14px', fontSize: '21px' }
    }[size] || { dim: '40px', radius: '12px', fontSize: '17px' };

    const bgStyle = showGlow ? `background: ${bgGlow}; border: 1px solid ${borderGlow};` : 'background: transparent;';

    return `<div class="cat-vector-badge ${customClass}" style="width: ${sizeDimensions.dim}; height: ${sizeDimensions.dim}; min-width: ${sizeDimensions.dim}; border-radius: ${sizeDimensions.radius}; ${bgStyle} color: ${color}; display: inline-flex; align-items: center; justify-content: center; font-size: ${sizeDimensions.fontSize}; flex-shrink: 0; box-sizing: border-box; transition: all 0.2s;" aria-hidden="true"><i class="${visual.iconClass}"></i></div>`;
  }

  const BACategoryIcons = {
    ICON_LIBRARIES,
    CATEGORY_ICON_REGISTRY,
    EMOJI_TO_FA_MAP,
    searchCategoryIcons,
    getCategoryVisual,
    renderCategoryIconHtml,
    hexToRgba
  };

  // Browser global aliases
  if (typeof window !== 'undefined') {
    window.BACategoryIcons = BACategoryIcons;
    window.CATEGORY_ICON_REGISTRY = CATEGORY_ICON_REGISTRY;
    window.ICON_LIBRARIES = ICON_LIBRARIES;
    window.EMOJI_TO_FA_MAP = EMOJI_TO_FA_MAP;
    window.searchCategoryIcons = searchCategoryIcons;
    window.getCategoryVisual = getCategoryVisual;
    window.renderCategoryIconHtml = renderCategoryIconHtml;
  }

  return BACategoryIcons;
});
