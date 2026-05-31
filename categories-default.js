/**
 * DEFAULT CATEGORIES for Budget Assistant v140+
 * - Single-word categories in Greek (με emoji)
 * - Used for new users & offline mode
 * - Per-user isolation in localStorage (user-scoped data)
 */

const DEFAULT_CATEGORIES_EXPENSES = [
  { name: 'Σπίτι', icon: '🏡', color: '#FF6B6B' },
  { name: 'Διατροφή', icon: '🛒', color: '#4ECDC4' },
  { name: 'Μετακίνηση', icon: '🚗', color: '#45B7D1' },
  { name: 'Διασκέδαση', icon: '🍔', color: '#FFA502' },
  { name: 'Αγορές', icon: '🛍️', color: '#FF69B4' },
  { name: 'Υγεία', icon: '❤️', color: '#E74C3C' },
  { name: 'Φροντίδα', icon: '👕', color: '#9B59B6' },
  { name: 'Συνδρομές', icon: '🎬', color: '#3498DB' },
  { name: 'Σπορ', icon: '🏋️', color: '#2ECC71' },
  { name: 'Υποχρεώσεις', icon: '🧾', color: '#95A5A6' },
  { name: 'Ταξίδια', icon: '✈️', color: '#1ABC9C' },
  { name: 'Διάφορα', icon: '🧩', color: '#34495E' }
];

const DEFAULT_CATEGORIES_INCOME = [
  { name: 'Μισθός', icon: '💼', color: '#27AE60' },
  { name: 'Επενδύσεις', icon: '📈', color: '#2980B9' },
  { name: 'Έξτρα', icon: '💰', color: '#F39C12' },
  { name: 'Δώρα', icon: '🎁', color: '#E91E63' },
  { name: 'Ενοίκια', icon: '🏠', color: '#795548' }
];

/**
 * Get default categories (used for offline mode & new users)
 */
function getDefaultCategories(type = 'expense') {
  if (type === 'income') {
    return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES_INCOME));
  }
  return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES_EXPENSES));
}

/**
 * Get user-scoped custom categories from localStorage
 * Key format: user_categories_{userId}_{type}
 */
function getUserCustomCategories(userId, type = 'expense') {
  if (!userId) return [];
  const key = `user_categories_${userId}_${type}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Save user-scoped custom categories to localStorage
 */
function saveUserCustomCategories(userId, type = 'expense', categories) {
  if (!userId) return;
  const key = `user_categories_${userId}_${type}`;
  localStorage.setItem(key, JSON.stringify(categories));
}

/**
 * Clear all user-scoped categories (on logout)
 */
function clearUserCategories(userId) {
  if (!userId) return;
  localStorage.removeItem(`user_categories_${userId}_expense`);
  localStorage.removeItem(`user_categories_${userId}_income`);
}

/**
 * Get combined categories: defaults + user custom (per user)
 */
function getCategoriesForUser(userId, type = 'expense') {
  const defaults = getDefaultCategories(type);
  const custom = getUserCustomCategories(userId, type);
  return [...defaults, ...custom];
}

/**
 * Initialize categories for new user (on registration)
 */
function initializeCategoriesForNewUser(userId) {
  if (!userId) return;
  // User gets default categories automatically
  // No need to pre-populate; they'll be returned by getDefaultCategories()
  console.log(`Categories initialized for new user: ${userId}`);
}
