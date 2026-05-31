/**
 * SUBCATEGORY & TRANSLATIONS DEFINITIONS
 * Fixes: ReferenceError: SUBCATEGORY_NAME_TRANSLATIONS is not defined
 * v140+
 */

const SUBCATEGORY_NAME_TRANSLATIONS = {
  el: {
    'dining_out': 'Εστιάτοριο',
    'fast_food': 'Γρήγορο φαγιτό',
    'groceries': 'Σαβινείο',
    'fuel': 'Αέριο',
    'maintenance': 'Συντήρηση',
    'parking': 'Εισαγωγή',
    'movies': 'Ένα Μίλια Κινημάτοσ',
    'games': 'Παιχνίδια',
    'restaurants': 'Εστιάτορα',
    'bars': 'Μπαρ / Κλαβ',
    'concerts': 'Κονσέρτα',
    'events': 'Εκδήλωση',
    'clothing': 'Ρούχα',
    'electronics': 'Ηλεκτρονικά',
    'books': 'Βιβλία',
    'household': 'Νοικοκυρικά',
    'gym': 'Γυμναστήριο',
    'doctor': 'Γιατρός',
    'pharmacy': 'Φαρμακείο',
    'dentist': 'Οδοντίατρος',
    'haircut': 'Κουρείο',
    'spa': 'Πατριθτ',
    'netflix': 'Netflix',
    'spotify': 'Spotify',
    'prime_video': 'Prime Video',
    'other_subscriptions': 'Άλλες Συνδρομές',
    'flights': 'Πτήσεις',
    'hotels': 'Ξενοδοχεία',
    'taxi': 'Τάξι',
    'rent': 'Ενοίκια
  },
  en: {
    'dining_out': 'Dining Out',
    'fast_food': 'Fast Food',
    'groceries': 'Groceries',
    'fuel': 'Fuel',
    'maintenance': 'Maintenance',
    'parking': 'Parking',
    'movies': 'Movies',
    'games': 'Games',
    'restaurants': 'Restaurants',
    'bars': 'Bars/Clubs',
    'concerts': 'Concerts',
    'events': 'Events',
    'clothing': 'Clothing',
    'electronics': 'Electronics',
    'books': 'Books',
    'household': 'Household Items',
    'gym': 'Gym',
    'doctor': 'Doctor',
    'pharmacy': 'Pharmacy',
    'dentist': 'Dentist',
    'haircut': 'Haircut',
    'spa': 'Spa',
    'netflix': 'Netflix',
    'spotify': 'Spotify',
    'prime_video': 'Prime Video',
    'other_subscriptions': 'Other Subscriptions',
    'flights': 'Flights',
    'hotels': 'Hotels',
    'taxi': 'Taxi',
    'rent': 'Rent'
  }
};

/**
 * Get translated subcategory name
 */
function getSubcategoryTranslation(subcategoryKey) {
  const lang = state?.lang || 'el';
  if (SUBCATEGORY_NAME_TRANSLATIONS[lang] && SUBCATEGORY_NAME_TRANSLATIONS[lang][subcategoryKey]) {
    return SUBCATEGORY_NAME_TRANSLATIONS[lang][subcategoryKey];
  }
  // Fallback to English if translation missing
  if (SUBCATEGORY_NAME_TRANSLATIONS.en[subcategoryKey]) {
    return SUBCATEGORY_NAME_TRANSLATIONS.en[subcategoryKey];
  }
  return subcategoryKey; // Return key as-is if no translation found
}

// Ensure SUBCATEGORY_NAME_TRANSLATIONS is globally accessible
window.SUBCATEGORY_NAME_TRANSLATIONS = SUBCATEGORY_NAME_TRANSLATIONS;
window.getSubcategoryTranslation = getSubcategoryTranslation;
