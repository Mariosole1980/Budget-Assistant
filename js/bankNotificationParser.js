/**
 * BankNotificationParser - Greek Banks & Revolut Notification Parsing Engine
 *
 * Autonomous UMD Module for parsing push notifications and SMS from:
 * - Eurobank (gr.eurobank.ebanking)
 * - Piraeus Bank / Winbank (com.winbank.mobile)
 * - Alpha Bank (gr.alphabank.mobilebanking)
 * - National Bank of Greece / NBG (gr.nbg.mobilebanking)
 * - Revolut (com.revolut.revolut)
 *
 * Extracts: amount, type (expense/income), currency, merchant name, card suffix,
 * bank identifier, and predicts transaction category using a Greek merchant dictionary.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BankNotificationParser = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BANK_PACKAGES = {
    'gr.eurobank.ebanking': 'Eurobank',
    'com.winbank.mobile': 'Τράπεζα Πειραιώς',
    'gr.alphabank.mobilebanking': 'Alpha Bank',
    'gr.nbg.mobilebanking': 'Εθνική Τράπεζα',
    'com.revolut.revolut': 'Revolut'
  };

  // Known merchant patterns and mapping to default category names
  var MERCHANT_CATEGORIES = [
    // Supermarkets & Groceries
    { keywords: ['sklavenitis', 'σκλαβενιτησ', 'σκλαβενιτης', 'ab vassilopoulos', 'αβ βασιλοπουλος', 'lidl', 'mymarket', 'my market', 'μασουτης', 'masoutis', 'γαλαξιας', 'galaxias', 'bazaar', 'market in', 'kritikos', 'κριτικος'], category: 'Σούπερ Μάρκετ' },
    
    // Coffee & Bakeries
    { keywords: ['mikel', 'coffee island', 'gregorys', 'γρηγορης', 'everest', 'starbucks', 'coffee lab', 'veneti', 'βενετη', 'κουλουραδες', 'bread factory', 'mon kulur'], category: 'Καφές / Έξω' },
    
    // Food Delivery & Restaurants
    { keywords: ['efood', 'e-food', 'wolt', 'box delivery', 'mcdonalds', 'kfc', 'goodys', 'dominos', 'pizza fan'], category: 'Φαγητό / Delivery' },
    
    // Gas & Transportation
    { keywords: ['shell', 'eko', 'εκο', 'bp', 'avin', 'revoil', 'cyclon', 'ελιν', 'elin', 'oasa', 'οασα', 'uber', 'taxi', 'beat', 'freenow', 'aegean', 'ryanair'], category: 'Καύσιμα / Μετακίνηση' },
    
    // Utilities & Bills
    { keywords: ['dei', 'δεη', 'protergia', 'elpedison', 'heron', 'ηρων', 'zenith', 'eydap', 'ευδαπ', 'cosmote', 'vodafone', 'nova', 'wind'], category: 'Λογαριασμοί' },
    
    // Pharmacy & Health
    { keywords: ['farmakeio', 'φαρμακειο', 'pharmacy', 'care market'], category: 'Φαρμακείο / Υγεία' },
    
    // Shopping & Electronics
    { keywords: ['zara', 'h&m', 'public', 'plaisio', 'πλαισιο', 'kotsovolos', 'κωτσοβολος', 'amazon', 'skroutz', 'ikea', 'jumbo', 'attica', 'intersport'], category: 'Αγορές' },

    // Subscriptions / Digital
    { keywords: ['netflix', 'spotify', 'youtube', 'apple.com', 'google *', 'play store', 'disney', 'playstation', 'steam'], category: 'Συνδρομές' }
  ];

  /**
   * Cleans Greek text from accents and converts to lowercase for easy matching.
   */
  function normalizeText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Attempts to identify the bank from package name or title/text content.
   */
  function detectBank(pkg, title, text) {
    if (pkg && BANK_PACKAGES[pkg]) {
      return BANK_PACKAGES[pkg];
    }
    var combined = (title + ' ' + text).toLowerCase();
    if (combined.indexOf('eurobank') !== -1) return 'Eurobank';
    if (combined.indexOf('winbank') !== -1 || combined.indexOf('πειραιως') !== -1 || combined.indexOf('piraeus') !== -1) return 'Τράπεζα Πειραιώς';
    if (combined.indexOf('alpha') !== -1) return 'Alpha Bank';
    if (combined.indexOf('εθνικη') !== -1 || combined.indexOf('nbg') !== -1) return 'Εθνική Τράπεζα';
    if (combined.indexOf('revolut') !== -1) return 'Revolut';
    return 'Τράπεζα';
  }

  /**
   * Parses monetary amount from text string.
   */
  function parseAmount(text) {
    if (!text) return null;

    // Pattern 1: currency symbol before amount (€ 15,50 or EUR 15.50)
    var m1 = text.match(/(?:€|EUR)\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})|[0-9]+(?:[\.,][0-9]{1,2})?)/i);
    if (m1 && m1[1]) {
      return cleanAmountNumber(m1[1]);
    }

    // Pattern 2: amount followed by currency symbol (15,50 € or 15,50 EUR or 15.50€)
    var m2 = text.match(/([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})|[0-9]+(?:[\.,][0-9]{1,2})?)\s*(?:€|EUR|EYΡΩ|ΕΥΡΩ)/i);
    if (m2 && m2[1]) {
      return cleanAmountNumber(m2[1]);
    }

    // Pattern 3: general amount after keywords (ποσού 15,50 / ποσό 15,50)
    var m3 = text.match(/(?:ποσού|ποσου|ποσο|ποσό|amount)\s*:?\s*([0-9]+(?:[\.,][0-9]{1,2})?)/i);
    if (m3 && m3[1]) {
      return cleanAmountNumber(m3[1]);
    }

    return null;
  }

  function cleanAmountNumber(str) {
    if (!str) return null;
    var cleaned = str.trim();
    // If it has both dot and comma (e.g. 1.250,50), remove dots, replace comma with dot
    if (cleaned.indexOf('.') !== -1 && cleaned.indexOf(',') !== -1) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.indexOf(',') !== -1) {
      // European format: 15,50 -> 15.50
      cleaned = cleaned.replace(',', '.');
    }
    var num = parseFloat(cleaned);
    return (!isNaN(num) && num > 0) ? Math.round(num * 100) / 100 : null;
  }

  /**
   * Identifies if the notification corresponds to an expense or an income.
   */
  function detectTransactionType(text) {
    var norm = normalizeText(text);
    // Income indicators
    if (norm.match(/(?:καταθεση|μισθοδοσια|επιστροφη χρηματων|πιστωση|εμβασμα απο|ελαβες|ελαβατε|received|refund|credit)/i)) {
      return 'income';
    }
    // Default is expense (αγορα, χρεωση, πληρωμη, spent, purchase)
    return 'expense';
  }

  /**
   * Extracts clean merchant / payee name from notification text.
   */
  function extractMerchant(text, bank) {
    if (!text) return '';

    // Remove amount string so it does not interfere
    var cleaned = text.replace(/(?:€|EUR)?\s*[0-9]+(?:[\.,][0-9]{1,2})?\s*(?:€|EUR)?/gi, '');

    var merchant = '';

    var match1 = cleaned.match(/(?:στην επιχείρηση|στην επιχειρηση|στην εταιρεία|στην εταιρεια|στο κατάστημα|στο καταστημα)\s+([^,.;\n\r]+)/i);
    if (match1 && match1[1]) {
      merchant = match1[1];
    }

    if (!merchant) {
      var match2 = cleaned.match(/(?:σε|στο|στη|από|απο|at|to)\s+([A-Z0-9Α-Ωa-zα-ω\s\.\&\*\-]+?)(?:\s+(?:με την κάρτα|με καρτα|με την καρτα|στις|την|μεσω|μέσω|\.|\,|$))/i);
      if (match2 && match2[1]) {
        merchant = match2[1];
      }
    }

    if (!merchant) {
      var match3 = cleaned.match(/-\s*([A-Z0-9Α-Ωa-zα-ω\s\.\&\*\-]+?)(?:\s*(?:με την κάρτα|\.|\,|$))/i);
      if (match3 && match3[1]) {
        merchant = match3[1];
      }
    }

    // Fallback: Revolut "Ξοδέψατε 5,20 € στο Coffee Island" or "You spent €12.50 at Zara"
    if (!merchant) {
      var matchRev = cleaned.match(/(?:στο|στην|at)\s+([A-Z0-9Α-Ωa-zα-ω\s\.\&\*\-]+)/i);
      if (matchRev && matchRev[1]) {
        merchant = matchRev[1];
      }
    }

    if (merchant) {
      merchant = merchant
        .replace(/(?:με την κάρτα|με καρτα|στις|την|το|τον|τη|μεσω|μέσω).*$/gi, '')
        .replace(/[\*\#\-\_\:\;]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return merchant || (bank ? (bank + ' Συναλλαγή') : 'Τραπεζική Συναλλαγή');
  }

  /**
   * Extracts masked card number if present (e.g. "...1234" or "*1234").
   */
  function extractCardSuffix(text) {
    if (!text) return null;
    var m = text.match(/(?:κάρτας?|καρτας?|card)\s*(?:νούμερο|αριθμός|no)?\s*[\.\*\#xX]*([0-9]{4})/i);
    if (m && m[1]) {
      return '...' + m[1];
    }
    return null;
  }

  /**
   * Predicts expense category based on merchant name or full text keywords.
   */
  function predictCategory(merchant, fullText) {
    var searchCorpus = normalizeText((merchant || '') + ' ' + (fullText || ''));
    for (var i = 0; i < MERCHANT_CATEGORIES.length; i++) {
      var entry = MERCHANT_CATEGORIES[i];
      for (var k = 0; k < entry.keywords.length; k++) {
        if (searchCorpus.indexOf(entry.keywords[k]) !== -1) {
          return entry.category;
        }
      }
    }
    return 'Άλλα';
  }

  /**
   * Main parsing entry point.
   */
  function parse(rawNotification) {
    if (!rawNotification) return null;

    var pkg = rawNotification.packageName || '';
    var title = String(rawNotification.title || '');
    var text = String(rawNotification.bigText || rawNotification.text || '');

    var fullContent = (title + ' ' + text).trim();
    if (!fullContent) return null;

    var amount = parseAmount(fullContent);
    if (!amount || amount <= 0) {
      return null;
    }

    var bank = detectBank(pkg, title, text);
    var type = detectTransactionType(fullContent);
    var merchant = extractMerchant(fullContent, bank);
    var cardSuffix = extractCardSuffix(fullContent);
    var category = (type === 'income') ? 'Μισθοδοσία / Έσοδα' : predictCategory(merchant, fullContent);

    return {
      isValid: true,
      bank: bank,
      packageName: pkg,
      amount: amount,
      currency: 'EUR',
      type: type,
      merchant: merchant,
      cardSuffix: cardSuffix,
      suggestedCategory: category,
      rawTitle: title,
      rawText: text,
      timestamp: rawNotification.timestamp || Date.now()
    };
  }

  return {
    parse: parse,
    parseAmount: parseAmount,
    detectBank: detectBank,
    detectTransactionType: detectTransactionType,
    extractMerchant: extractMerchant,
    extractCardSuffix: extractCardSuffix,
    predictCategory: predictCategory,
    BANK_PACKAGES: BANK_PACKAGES
  };
}));
