/**
 * CurrencyService — Ο μοναδικός μηχανισμός μετατροπής νομισμάτων.
 *
 * Κανόνες:
 *  - Το `amount_base` υπολογίζεται ΜΟΝΟ μέσα από το CurrencyService (computeAmountBase).
 *  - Όλα τα reports χρησιμοποιούν `sumInCurrency()` — ποτέ απευθείας SUM(amount_base)
 *    σε μικτά base_currency.
 *  - Κανένα άλλο σημείο του κώδικα δεν πολλαπλασιάζει/διαιρεί ποσά με ισοτιμία.
 *
 * Source of truth: amount, currency, rate_to_base, base_currency
 * Cache: amount_base (= amount / COALESCE(rate_to_base_actual, rate_to_base))
 */
class CurrencyService {
    constructor() {
        // Τοπικό cache ισοτιμιών (για offline & ταχύτητα)
        // Δομή: { `${base}_${quote}_${date}`: { rate, source, fetched_at } }
        this.rateCache = new Map();

        // Κατάλογος νομισμάτων (fallback αν δεν φορτωθούν από το DB)
        // Κάθε νόμισμα έχει: code, name, symbol, decimals, flag, countries[]
        // countries[] περιέχει ονόματα χωρών (Ελληνικά + Αγγλικά) για αναζήτηση.
        this.currencies = [
            { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, flag: '🇪🇺', countries: ['Ευρωζώνη', 'Eurozone', 'Γερμανία', 'Germany', 'Γαλλία', 'France', 'Ιταλία', 'Italy', 'Ισπανία', 'Spain', 'Ελλάδα', 'Greece', 'Πορτογαλία', 'Portugal', 'Ολλανδία', 'Netherlands', 'Βέλγιο', 'Belgium', 'Αυστρία', 'Austria', 'Ιρλανδία', 'Ireland', 'Φινλανδία', 'Finland', 'Σλοβακία', 'Slovakia', 'Σλοβενία', 'Slovenia', 'Λετονία', 'Latvia', 'Λιθουανία', 'Lithuania', 'Εσθονία', 'Estonia', 'Κύπρος', 'Cyprus', 'Μάλτα', 'Malta', 'Λουξεμβούργο', 'Luxembourg', 'Κροατία', 'Croatia'] },
            { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2, flag: '🇺🇸', countries: ['ΗΠΑ', 'USA', 'Αμερική', 'America', 'Ηνωμένες Πολιτείες', 'United States'] },
            { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2, flag: '🇬🇧', countries: ['Ηνωμένο Βασίλειο', 'United Kingdom', 'Βρετανία', 'Britain', 'Αγγλία', 'England'] },
            { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0, flag: '🇯🇵', countries: ['Ιαπωνία', 'Japan'] },
            { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2, flag: '🇨🇭', countries: ['Ελβετία', 'Switzerland'] },
            { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2, flag: '🇨🇦', countries: ['Καναδάς', 'Canada'] },
            { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2, flag: '🇦🇺', countries: ['Αυστραλία', 'Australia'] },
            { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2, flag: '🇳🇿', countries: ['Νέα Ζηλανδία', 'New Zealand'] },
            { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2, flag: '🇨🇳', countries: ['Κίνα', 'China'] },
            { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2, flag: '🇮🇳', countries: ['Ινδία', 'India'] },
            { code: 'RUB', name: 'Russian Ruble', symbol: '₽', decimals: 2, flag: '🇷🇺', countries: ['Ρωσία', 'Russia'] },
            { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2, flag: '🇧🇷', countries: ['Βραζιλία', 'Brazil'] },
            { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', decimals: 2, flag: '🇲🇽', countries: ['Μεξικό', 'Mexico'] },
            { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2, flag: '🇿🇦', countries: ['Νότια Αφρική', 'South Africa'] },
            { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimals: 2, flag: '🇹🇷', countries: ['Τουρκία', 'Turkey'] },
            { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2, flag: '🇸🇪', countries: ['Σουηδία', 'Sweden'] },
            { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2, flag: '🇳🇴', countries: ['Νορβηγία', 'Norway'] },
            { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimals: 2, flag: '🇩🇰', countries: ['Δανία', 'Denmark'] },
            { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', decimals: 2, flag: '🇵🇱', countries: ['Πολωνία', 'Poland'] },
            { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', decimals: 2, flag: '🇨🇿', countries: ['Τσεχία', 'Czech Republic', 'Τσεχική Δημοκρατία'] },
            { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', decimals: 2, flag: '🇭🇺', countries: ['Ουγγαρία', 'Hungary'] },
            { code: 'RON', name: 'Romanian Leu', symbol: 'lei', decimals: 2, flag: '🇷🇴', countries: ['Ρουμανία', 'Romania'] },
            { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', decimals: 2, flag: '🇧🇬', countries: ['Βουλγαρία', 'Bulgaria'] },
            { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴', decimals: 2, flag: '🇺🇦', countries: ['Ουκρανία', 'Ukraine'] },
            { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', decimals: 2, flag: '🇮🇱', countries: ['Ισραήλ', 'Israel'] },
            { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2, flag: '🇦🇪', countries: ['Ηνωμένα Αραβικά Εμιράτα', 'United Arab Emirates', 'Εμιράτα', 'UAE'] },
            { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimals: 2, flag: '🇸🇦', countries: ['Σαουδική Αραβία', 'Saudi Arabia'] },
            { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', decimals: 2, flag: '🇶🇦', countries: ['Κατάρ', 'Qatar'] },
            { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', decimals: 3, flag: '🇰🇼', countries: ['Κουβέιτ', 'Kuwait'] },
            { code: 'BHD', name: 'Bahraini Dinar', symbol: 'د.ب', decimals: 3, flag: '🇧🇭', countries: ['Μπαχρέιν', 'Bahrain'] },
            { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', decimals: 3, flag: '🇴🇲', countries: ['Ομάν', 'Oman'] },
            { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا', decimals: 3, flag: '🇯🇴', countries: ['Ιορδανία', 'Jordan'] },
            { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل', decimals: 2, flag: '🇱🇧', countries: ['Λίβανος', 'Lebanon'] },
            { code: 'EGP', name: 'Egyptian Pound', symbol: 'ج.م', decimals: 2, flag: '🇪🇬', countries: ['Αίγυπτος', 'Egypt'] },
            { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.', decimals: 2, flag: '🇲🇦', countries: ['Μαρόκο', 'Morocco'] },
            { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت', decimals: 3, flag: '🇹🇳', countries: ['Τυνησία', 'Tunisia'] },
            { code: 'DZD', name: 'Algerian Dinar', symbol: 'دج', decimals: 2, flag: '🇩🇿', countries: ['Αλγερία', 'Algeria'] },
            { code: 'LYD', name: 'Libyan Dinar', symbol: 'ل.د', decimals: 3, flag: '🇱🇾', countries: ['Λιβύη', 'Libya'] },
            { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2, flag: '🇳🇬', countries: ['Νιγηρία', 'Nigeria'] },
            { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', decimals: 2, flag: '🇬🇭', countries: ['Γκάνα', 'Ghana'] },
            { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2, flag: '🇰🇪', countries: ['Κένυα', 'Kenya'] },
            { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', decimals: 2, flag: '🇹🇿', countries: ['Τανζανία', 'Tanzania'] },
            { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', decimals: 0, flag: '🇺🇬', countries: ['Ουγκάντα', 'Uganda'] },
            { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', decimals: 2, flag: '🇪🇹', countries: ['Αιθιοπία', 'Ethiopia'] },
            { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA', decimals: 0, flag: '🌍', countries: ['Δυτική Αφρική', 'West Africa', 'Σενεγάλη', 'Senegal', 'Ακτή Ελεφαντοστού', 'Ivory Coast', 'Μάλι', 'Mali', 'Μπουρκίνα Φάσο', 'Burkina Faso', 'Νίγηρας', 'Niger', 'Τόγκο', 'Togo', 'Μπενίν', 'Benin'] },
            { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA', decimals: 0, flag: '🌍', countries: ['Κεντρική Αφρική', 'Central Africa', 'Καμερούν', 'Cameroon', 'Γκαμπόν', 'Gabon', 'Κονγκό', 'Congo', 'Τσαντ', 'Chad', 'Κεντροαφρικανική Δημοκρατία', 'Central African Republic'] },
            { code: 'ARS', name: 'Argentine Peso', symbol: '$', decimals: 2, flag: '🇦🇷', countries: ['Αργεντινή', 'Argentina'] },
            { code: 'CLP', name: 'Chilean Peso', symbol: '$', decimals: 0, flag: '🇨🇱', countries: ['Χιλή', 'Chile'] },
            { code: 'COP', name: 'Colombian Peso', symbol: '$', decimals: 2, flag: '🇨🇴', countries: ['Κολομβία', 'Colombia'] },
            { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', decimals: 2, flag: '🇵🇪', countries: ['Περού', 'Peru'] },
            { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U', decimals: 2, flag: '🇺🇾', countries: ['Ουρουγουάη', 'Uruguay'] },
            { code: 'PYG', name: 'Paraguayan Guarani', symbol: '₲', decimals: 0, flag: '🇵🇾', countries: ['Παραγουάη', 'Paraguay'] },
            { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs', decimals: 2, flag: '🇧🇴', countries: ['Βολιβία', 'Bolivia'] },
            { code: 'VES', name: 'Venezuelan Bolívar', symbol: 'Bs', decimals: 2, flag: '🇻🇪', countries: ['Βενεζουέλα', 'Venezuela'] },
            { code: 'CRC', name: 'Costa Rican Colón', symbol: '₡', decimals: 2, flag: '🇨🇷', countries: ['Κόστα Ρίκα', 'Costa Rica'] },
            { code: 'PAB', name: 'Panamanian Balboa', symbol: 'B/.', decimals: 2, flag: '🇵🇦', countries: ['Παναμάς', 'Panama'] },
            { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$', decimals: 2, flag: '🇩🇴', countries: ['Δομινικανή Δημοκρατία', 'Dominican Republic'] },
            { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q', decimals: 2, flag: '🇬🇹', countries: ['Γουατεμάλα', 'Guatemala'] },
            { code: 'HNL', name: 'Honduran Lempira', symbol: 'L', decimals: 2, flag: '🇭🇳', countries: ['Ονδούρα', 'Honduras'] },
            { code: 'NIO', name: 'Nicaraguan Córdoba', symbol: 'C$', decimals: 2, flag: '🇳🇮', countries: ['Νικαράγουα', 'Nicaragua'] },
            { code: 'SVC', name: 'Salvadoran Colón', symbol: '₡', decimals: 2, flag: '🇸🇻', countries: ['Ελ Σαλβαδόρ', 'El Salvador'] },
            { code: 'JMD', name: 'Jamaican Dollar', symbol: 'J$', decimals: 2, flag: '🇯🇲', countries: ['Τζαμάικα', 'Jamaica'] },
            { code: 'TTD', name: 'Trinidad and Tobago Dollar', symbol: 'TT$', decimals: 2, flag: '🇹🇹', countries: ['Τρινιντάντ και Τομπάγκο', 'Trinidad and Tobago'] },
            { code: 'BSD', name: 'Bahamian Dollar', symbol: 'B$', decimals: 2, flag: '🇧🇸', countries: ['Μπαχάμες', 'Bahamas'] },
            { code: 'BBD', name: 'Barbadian Dollar', symbol: 'Bds$', decimals: 2, flag: '🇧🇧', countries: ['Μπαρμπάντος', 'Barbados'] },
            { code: 'CUP', name: 'Cuban Peso', symbol: '₱', decimals: 2, flag: '🇨🇺', countries: ['Κούβα', 'Cuba'] },
            { code: 'HTG', name: 'Haitian Gourde', symbol: 'G', decimals: 2, flag: '🇭🇹', countries: ['Αϊτή', 'Haiti'] },
            { code: 'AWG', name: 'Aruban Florin', symbol: 'ƒ', decimals: 2, flag: '🇦🇼', countries: ['Αρούμπα', 'Aruba'] },
            { code: 'ANG', name: 'Netherlands Antillean Guilder', symbol: 'ƒ', decimals: 2, flag: '🇨🇼', countries: ['Κουρασάο', 'Curaçao', 'Ολλανδικές Αντίλλες', 'Netherlands Antilles'] },
            { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0, flag: '🇰🇷', countries: ['Νότια Κορέα', 'South Korea', 'Κορέα', 'Korea'] },
            { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2, flag: '🇸🇬', countries: ['Σιγκαπούρη', 'Singapore'] },
            { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2, flag: '🇭🇰', countries: ['Χονγκ Κονγκ', 'Hong Kong'] },
            { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', decimals: 2, flag: '🇹🇼', countries: ['Ταϊβάν', 'Taiwan'] },
            { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2, flag: '🇲🇾', countries: ['Μαλαισία', 'Malaysia'] },
            { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2, flag: '🇹🇭', countries: ['Ταϊλάνδη', 'Thailand'] },
            { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 0, flag: '🇮🇩', countries: ['Ινδονησία', 'Indonesia'] },
            { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2, flag: '🇵🇭', countries: ['Φιλιππίνες', 'Philippines'] },
            { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimals: 0, flag: '🇻🇳', countries: ['Βιετνάμ', 'Vietnam'] },
            { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', decimals: 2, flag: '🇵🇰', countries: ['Πακιστάν', 'Pakistan'] },
            { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', decimals: 2, flag: '🇧🇩', countries: ['Μπανγκλαντές', 'Bangladesh'] },
            { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', decimals: 2, flag: '🇱🇰', countries: ['Σρι Λάνκα', 'Sri Lanka'] },
            { code: 'NPR', name: 'Nepalese Rupee', symbol: '₨', decimals: 2, flag: '🇳🇵', countries: ['Νεπάλ', 'Nepal'] },
            { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', decimals: 0, flag: '🇲🇲', countries: ['Μιανμάρ', 'Myanmar', 'Βιρμανία', 'Burma'] },
            { code: 'KHR', name: 'Cambodian Riel', symbol: '៛', decimals: 2, flag: '🇰🇭', countries: ['Καμπότζη', 'Cambodia'] },
            { code: 'LAK', name: 'Lao Kip', symbol: '₭', decimals: 0, flag: '🇱🇦', countries: ['Λάος', 'Laos'] },
            { code: 'MNT', name: 'Mongolian Tugrik', symbol: '₮', decimals: 0, flag: '🇲🇳', countries: ['Μογγολία', 'Mongolia'] },
            { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸', decimals: 2, flag: '🇰🇿', countries: ['Καζακστάν', 'Kazakhstan'] },
            { code: 'UZS', name: 'Uzbekistani Som', symbol: 'soʻm', decimals: 2, flag: '🇺🇿', countries: ['Ουζμπεκιστάν', 'Uzbekistan'] },
            { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼', decimals: 2, flag: '🇦🇿', countries: ['Αζερμπαϊτζάν', 'Azerbaijan'] },
            { code: 'GEL', name: 'Georgian Lari', symbol: '₾', decimals: 2, flag: '🇬🇪', countries: ['Γεωργία', 'Georgia'] },
            { code: 'AMD', name: 'Armenian Dram', symbol: '֏', decimals: 2, flag: '🇦🇲', countries: ['Αρμενία', 'Armenia'] },
            { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br', decimals: 2, flag: '🇧🇾', countries: ['Λευκορωσία', 'Belarus'] },
            { code: 'MDL', name: 'Moldovan Leu', symbol: 'L', decimals: 2, flag: '🇲🇩', countries: ['Μολδαβία', 'Moldova'] },
            { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин', decimals: 2, flag: '🇷🇸', countries: ['Σερβία', 'Serbia'] },
            { code: 'MKD', name: 'Macedonian Denar', symbol: 'ден', decimals: 2, flag: '🇲🇰', countries: ['Βόρεια Μακεδονία', 'North Macedonia', 'ΠΓΔΜ'] },
            { code: 'ALL', name: 'Albanian Lek', symbol: 'L', decimals: 2, flag: '🇦🇱', countries: ['Αλβανία', 'Albania'] },
            { code: 'BAM', name: 'Bosnian Convertible Mark', symbol: 'KM', decimals: 2, flag: '🇧🇦', countries: ['Βοσνία και Ερζεγοβίνη', 'Bosnia and Herzegovina'] },
            { code: 'ISK', name: 'Icelandic Króna', symbol: 'kr', decimals: 0, flag: '🇮🇸', countries: ['Ισλανδία', 'Iceland'] },
            { code: 'FJD', name: 'Fijian Dollar', symbol: 'FJ$', decimals: 2, flag: '🇫🇯', countries: ['Φίτζι', 'Fiji'] },
            { code: 'PGK', name: 'Papua New Guinean Kina', symbol: 'K', decimals: 2, flag: '🇵🇬', countries: ['Παπούα Νέα Γουινέα', 'Papua New Guinea'] },
            { code: 'WST', name: 'Samoan Tala', symbol: 'WS$', decimals: 2, flag: '🇼🇸', countries: ['Σαμόα', 'Samoa'] },
            { code: 'TOP', name: 'Tongan Paʻanga', symbol: 'T$', decimals: 2, flag: '🇹🇴', countries: ['Τόνγκα', 'Tonga'] },
            { code: 'VUV', name: 'Vanuatu Vatu', symbol: 'VT', decimals: 0, flag: '🇻🇺', countries: ['Βανουάτου', 'Vanuatu'] },
            { code: 'SBD', name: 'Solomon Islands Dollar', symbol: 'SI$', decimals: 2, flag: '🇸🇧', countries: ['Νήσοι Σολομώντα', 'Solomon Islands'] },
            { code: 'MUR', name: 'Mauritian Rupee', symbol: '₨', decimals: 2, flag: '🇲🇺', countries: ['Μαυρίκιος', 'Mauritius'] },
            { code: 'SCR', name: 'Seychellois Rupee', symbol: '₨', decimals: 2, flag: '🇸🇨', countries: ['Σεϋχέλλες', 'Seychelles'] },
            { code: 'MVR', name: 'Maldivian Rufiyaa', symbol: 'Rf', decimals: 2, flag: '🇲🇻', countries: ['Μαλδίβες', 'Maldives'] },
            { code: 'BND', name: 'Brunei Dollar', symbol: 'B$', decimals: 2, flag: '🇧🇳', countries: ['Μπρουνέι', 'Brunei'] },
            { code: 'MOP', name: 'Macanese Pataca', symbol: 'MOP$', decimals: 2, flag: '🇲🇴', countries: ['Μακάο', 'Macau'] },
            { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT', decimals: 2, flag: '🇲🇿', countries: ['Μοζαμβίκη', 'Mozambique'] },
            { code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz', decimals: 2, flag: '🇦🇴', countries: ['Ανγκόλα', 'Angola'] },
            { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', decimals: 2, flag: '🇿🇲', countries: ['Ζάμπια', 'Zambia'] },
            { code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK', decimals: 2, flag: '🇲🇼', countries: ['Μαλάουι', 'Malawi'] },
            { code: 'BWP', name: 'Botswana Pula', symbol: 'P', decimals: 2, flag: '🇧🇼', countries: ['Μποτσουάνα', 'Botswana'] },
            { code: 'NAD', name: 'Namibian Dollar', symbol: 'N$', decimals: 2, flag: '🇳🇦', countries: ['Ναμίμπια', 'Namibia'] },
            { code: 'SZL', name: 'Swazi Lilangeni', symbol: 'E', decimals: 2, flag: '🇸🇿', countries: ['Εσουατίνι', 'Eswatini', 'Σουαζιλάνδη', 'Swaziland'] },
            { code: 'LSL', name: 'Lesotho Loti', symbol: 'L', decimals: 2, flag: '🇱🇸', countries: ['Λεσότο', 'Lesotho'] },
            { code: 'ZWL', name: 'Zimbabwean Dollar', symbol: 'Z$', decimals: 2, flag: '🇿🇼', countries: ['Ζιμπάμπουε', 'Zimbabwe'] },
            { code: 'CVE', name: 'Cape Verdean Escudo', symbol: '$', decimals: 2, flag: '🇨🇻', countries: ['Πράσινο Ακρωτήριο', 'Cape Verde'] },
            { code: 'GMD', name: 'Gambian Dalasi', symbol: 'D', decimals: 2, flag: '🇬🇲', countries: ['Γκάμπια', 'Gambia'] },
            { code: 'GNF', name: 'Guinean Franc', symbol: 'FG', decimals: 0, flag: '🇬🇳', countries: ['Γουινέα', 'Guinea'] },
            { code: 'SLL', name: 'Sierra Leonean Leone', symbol: 'Le', decimals: 2, flag: '🇸🇱', countries: ['Σιέρα Λεόνε', 'Sierra Leone'] },
            { code: 'LRD', name: 'Liberian Dollar', symbol: 'L$', decimals: 2, flag: '🇱🇷', countries: ['Λιβερία', 'Liberia'] },
            { code: 'MRU', name: 'Mauritanian Ouguiya', symbol: 'UM', decimals: 2, flag: '🇲🇷', countries: ['Μαυριτανία', 'Mauritania'] },
            { code: 'DJF', name: 'Djiboutian Franc', symbol: 'Fdj', decimals: 0, flag: '🇩🇯', countries: ['Τζιμπουτί', 'Djibouti'] },
            { code: 'SOS', name: 'Somali Shilling', symbol: 'Sh', decimals: 2, flag: '🇸🇴', countries: ['Σομαλία', 'Somalia'] },
            { code: 'ERN', name: 'Eritrean Nakfa', symbol: 'Nfk', decimals: 2, flag: '🇪🇷', countries: ['Ερυθραία', 'Eritrea'] },
            { code: 'SDG', name: 'Sudanese Pound', symbol: 'ج.س', decimals: 2, flag: '🇸🇩', countries: ['Σουδάν', 'Sudan'] },
            { code: 'SSP', name: 'South Sudanese Pound', symbol: 'SS£', decimals: 2, flag: '🇸🇸', countries: ['Νότιο Σουδάν', 'South Sudan'] },
            { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw', decimals: 0, flag: '🇷🇼', countries: ['Ρουάντα', 'Rwanda'] },
            { code: 'BIF', name: 'Burundian Franc', symbol: 'FBu', decimals: 0, flag: '🇧🇮', countries: ['Μπουρούντι', 'Burundi'] },
            { code: 'CDF', name: 'Congolese Franc', symbol: 'FC', decimals: 2, flag: '🇨🇩', countries: ['Λαϊκή Δημοκρατία του Κονγκό', 'DR Congo', 'Κονγκό Κινσάσα'] },
        ];

        // Providers για ενσωμάτωση με Supabase
        this._rateProvider = null;
        this._ratePersist = null;
        this._manualRateSink = null;
    }

    // ===== Βοηθητικά =====

    round(value, decimals = 4) {
        const factor = Math.pow(10, decimals);
        return Math.round((value + Number.EPSILON) * factor) / factor;
    }

    toDateKey(date) {
        if (!date) return null;
        if (date instanceof Date) {
            return date.toISOString().slice(0, 10);
        }
        const s = String(date);
        return s.slice(0, 10);
    }

    // ===== Κατάλογος νομισμάτων =====

    setCurrencies(list) {
        if (Array.isArray(list) && list.length) {
            this.currencies = list;
        }
    }

    getCurrencies() {
        return this.currencies;
    }

    getCurrency(code) {
        return this.currencies.find((c) => c.code === code) || null;
    }

    getSymbol(code) {
        const c = this.getCurrency(code);
        return c ? c.symbol : (code || '');
    }

    getDecimals(code) {
        const c = this.getCurrency(code);
        return c && typeof c.decimals === 'number' ? c.decimals : 2;
    }

    /**
     * Επιστρέφει τη λίστα χωρών ενός νομίσματος (για αναζήτηση).
     */
    getCountries(code) {
        const c = this.getCurrency(code);
        return c && Array.isArray(c.countries) ? c.countries : [];
    }

    /**
     * Επιστρέφει όλα τα νομίσματα που αντιστοιχούν σε μια χώρα (αναζήτηση με χώρα).
     */
    getCurrenciesByCountry(query) {
        if (!query) return [];
        const q = String(query).toLowerCase().trim();
        if (!q) return [];
        return this.currencies.filter((c) => {
            return (c.countries || []).some((name) => String(name).toLowerCase().includes(q));
        });
    }

    // ===== Μετατροπή =====

    /**
     * Μετατρέπει ποσό από ένα νόμισμα σε άλλο με ιστορική ισοτιμία της ημερομηνίας.
     */
    convert(amount, fromCurrency, toCurrency, date) {
        if (fromCurrency === toCurrency) return amount;
        const rate = this.getRate(fromCurrency, toCurrency, date);
        if (rate == null || rate === 0) return null; // δεν υπάρχει ισοτιμία
        return this.round(amount * rate, 4);
    }

    /**
     * Υπολογίζει το amount_base μιας νέας συναλλαγής.
     * Πάντα: amount_base = amount / COALESCE(rate_to_base_actual, rate_to_base)
     */
    computeAmountBase(amount, currency, baseCurrency, date, rateToBaseActual = null) {
        if (currency === baseCurrency) return this.round(amount, 4);
        const rate = rateToBaseActual != null
            ? rateToBaseActual
            : this.getRate(currency, baseCurrency, date);
        if (rate == null || rate === 0) return null;
        return this.round(amount / rate, 4);
    }

    // ===== Source of truth =====

    /**
     * Επιστρέφει το ποσό μιας συναλλαγής στο base_currency (χρησιμοποιεί amount_base cache).
     */
    toBase(tx) {
        if (!tx) return 0;
        if (tx.amount_base != null) return Number(tx.amount_base);
        return this.computeAmountBase(
            Number(tx.amount),
            tx.currency || 'EUR',
            tx.base_currency || 'EUR',
            tx.date,
            tx.rate_to_base_actual != null ? Number(tx.rate_to_base_actual) : null
        ) || 0;
    }

    /**
     * Επιστρέφει το ποσό μιας συναλλαγής σε οποιοδήποτε νόμισμα (για εμφάνιση).
     */
    displayAmount(tx, targetCurrency) {
        if (!tx) return 0;
        const txCurrency = tx.currency || 'EUR';
        const baseCurrency = tx.base_currency || 'EUR';
        if (targetCurrency === txCurrency) return Number(tx.amount);
        if (targetCurrency === baseCurrency) return this.toBase(tx);
        return this.convert(this.toBase(tx), baseCurrency, targetCurrency, tx.date) || 0;
    }

    /**
     * Αθροίζει συναλλαγές σε ένα target currency, μετατρέποντας κάθε μία ξεχωριστά.
     * Αυτός είναι ο ΜΟΝΟΣ σωστός τρόπος για μικτά base_currency.
     */
    sumInCurrency(transactions, targetCurrency) {
        if (!Array.isArray(transactions)) return 0;
        return transactions.reduce((sum, tx) => {
            return sum + this.displayAmount(tx, targetCurrency);
        }, 0);
    }

    // ===== Ισοτιμίες =====

    /**
     * Επιστρέφει την ισοτιμία base→quote για μια ημερομηνία, με ιεραρχία:
     *  1) exchange_rates (ακριβής ημερομηνία) → 2) χειροκίνητη → 3) πλησιέστερη προηγούμενη
     */
    getRate(base, quote, date) {
        if (base === quote) return 1;
        const dateKey = this.toDateKey(date) || new Date().toISOString().slice(0, 10);

        // 1. Τοπικό cache (ακριβής ημερομηνία)
        const exactKey = `${base}_${quote}_${dateKey}`;
        if (this.rateCache.has(exactKey)) {
            return this.rateCache.get(exactKey).rate;
        }

        // 2. Αν υπάρχει global rate provider (Supabase), ρώτα το
        if (this._rateProvider) {
            const rate = this._rateProvider(base, quote, dateKey);
            if (rate != null) {
                this._rememberRate(base, quote, dateKey, rate, 'cached');
                return rate;
            }
        }

        return null;
    }

    /**
     * Ο χρήστης ορίζει χειροκίνητα ισοτιμία (source='manual', δεν αντικαθίσταται).
     */
    setManualRate(base, quote, date, rate) {
        const dateKey = this.toDateKey(date) || new Date().toISOString().slice(0, 10);
        this._rememberRate(base, quote, dateKey, rate, 'manual');
        if (this._manualRateSink) {
            this._manualRateSink(base, quote, dateKey, rate);
        }
    }

    // ===== Διόρθωση πραγματικής χρέωσης =====

    /**
     * Ο χρήστης διορθώνει το πραγματικό ποσό που χρέωσε η τράπεζα.
     */
    correctActualAmount(tx, actualAmountInBase) {
        if (!tx || actualAmountInBase == null || actualAmountInBase <= 0) return tx;
        const amount = Number(tx.amount);
        tx.rate_to_base_actual = this.round(amount / actualAmountInBase, 8);
        tx.amount_base = this.computeAmountBase(
            amount,
            tx.currency || 'EUR',
            tx.base_currency || 'EUR',
            tx.date,
            tx.rate_to_base_actual
        );
        tx.rate_source = 'manual';
        return tx;
    }

    // ===== Κατάσταση αξιοπιστίας =====

    /**
     * Παράγωγο conversion_status από το rate_source.
     */
    conversionStatus(tx) {
        if (!tx) return 'confirmed';
        const source = tx.rate_source || 'api';
        if (source === 'manual') return 'manual';
        if (source === 'cached') return 'estimate';
        return 'confirmed';
    }

    // ===== Λήψη ισοτιμιών (Frankfurter/ECB) =====

    /**
     * Φέρνει τις ισοτιμίες της ημέρας από το Frankfurter API και τις αποθηκεύει.
     * Δεν μπλοκάρει — σε αποτυχία επιστρέφει false.
     */
    async fetchTodayRates(baseCurrency = 'EUR') {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const cacheKey = `fx_${baseCurrency}_${today}`;
            // Έλεγξε τοπικό cache για σήμερα
            try {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed && parsed.rates) {
                        this._ingestRates(baseCurrency, today, parsed.rates, 'api');
                        return true;
                    }
                }
            } catch (e) { /* ignore */ }

            const res = await fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}`);
            if (!res.ok) return false;
            const data = await res.json();
            if (!data || !data.rates) return false;

            // Αποθήκευσε στο τοπικό cache
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ rates: data.rates, fetched_at: Date.now() }));
            } catch (e) { /* ignore */ }

            this._ingestRates(baseCurrency, today, data.rates, 'api');

            // Αποθήκευσε στο Supabase (αν υπάρχει provider)
            if (this._ratePersist) {
                this._ratePersist(baseCurrency, today, data.rates);
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    _ingestRates(base, date, rates, source) {
        Object.entries(rates || {}).forEach(([quote, rate]) => {
            this._rememberRate(base, quote, date, rate, source);
        });
    }

    _rememberRate(base, quote, dateKey, rate, source) {
        this.rateCache.set(`${base}_${quote}_${dateKey}`, { rate: Number(rate), source, fetched_at: Date.now() });
    }

    // ===== Ενσωμάτωση με Supabase (providers) =====

    setRateProvider(fn) {
        this._rateProvider = fn;
    }

    setRatePersist(fn) {
        this._ratePersist = fn;
    }

    setManualRateSink(fn) {
        this._manualRateSink = fn;
    }

    // ===== Feature flag =====

    isEnabled() {
        try {
            return localStorage.getItem('multi_currency_enabled') === 'true';
        } catch (e) {
            return false;
        }
    }

    setEnabled(val) {
        try {
            localStorage.setItem('multi_currency_enabled', val ? 'true' : 'false');
        } catch (e) { /* ignore */ }
    }
}

// Singleton instance
const CurrencyServiceInstance = new CurrencyService();

// Εξαγωγή για χρήση σε browser (script tag) και ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CurrencyServiceInstance;
}
if (typeof window !== 'undefined') {
    // Self-healing export: only overwrite window.CurrencyService if the current
    // one is missing required methods (e.g. a stale cached instance). If a
    // complete fallback was already installed by app.js's bootstrap guard, we
    // must NOT clobber it with a stale/incomplete instance — that would
    // re-introduce "CurrencyService.X is not a function" crashes.
    const REQUIRED = [
        'round', 'toDateKey', 'setCurrencies', 'getCurrencies', 'getCurrency',
        'getSymbol', 'getDecimals', 'getCountries', 'getCurrenciesByCountry',
        'convert', 'computeAmountBase', 'toBase',
        'displayAmount', 'sumInCurrency', 'getRate', 'setManualRate',
        'correctActualAmount', 'conversionStatus', 'fetchTodayRates',
        'setRateProvider', 'setRatePersist', 'setManualRateSink',
        'isEnabled', 'setEnabled'
    ];
    const existing = window.CurrencyService;
    let existingComplete = existing && typeof existing === 'object';
    if (existingComplete) {
        for (let i = 0; i < REQUIRED.length; i++) {
            if (typeof existing[REQUIRED[i]] !== 'function') {
                existingComplete = false;
                break;
            }
        }
    }
    if (!existingComplete) {
        window.CurrencyService = CurrencyServiceInstance;
    }
}
