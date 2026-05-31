/**
 * EXCEL IMPORT: Category Replacement Logic (v140+)
 * When user imports Excel with custom categories,
 * replace defaults with those from Excel for that user
 */

/**
 * Process category replacement during Excel import
 * Called after Excel data is parsed
 */
function handleExcelCategoryReplacement(importedCategories, userId, type = 'expense') {
  if (!userId || !importedCategories || importedCategories.length === 0) {
    console.log('No category replacement needed');
    return;
  }

  // Replace user's default categories with imported ones
  saveUserCustomCategories(userId, type, importedCategories);

  // Hide default categories from UI for this user
  localStorage.setItem(`user_hide_defaults_${userId}_${type}`, 'true');

  console.log(`✅ Categories replaced from Excel: ${importedCategories.length} ${type} categories`);
}

/**
 * Get categories: if user imported Excel, show only those (hide defaults)
 */
function getCategoriesForUserV2(userId, type = 'expense') {
  if (!userId) {
    return getDefaultCategories(type);
  }

  // Check if defaults should be hidden (Excel import happened)
  const hideDefaults = localStorage.getItem(`user_hide_defaults_${userId}_${type}`) === 'true';

  const custom = getUserCustomCategories(userId, type);

  if (hideDefaults && custom.length > 0) {
    // Only return custom categories from Excel import
    return custom;
  }

  // Return defaults + custom (normal case)
  const defaults = getDefaultCategories(type);
  return [...defaults, ...custom];
}

/**
 * Clear Excel import flag (e.g., on logout)
 */
function clearExcelImportFlag(userId, type) {
  if (!userId) return;
  localStorage.removeItem(`user_hide_defaults_${userId}_${type}`);
}
