(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SubcategoryManager = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function stripLeadingEmoji(str) {
    if (typeof window !== 'undefined' && typeof window.stripLeadingEmoji === 'function' && window.stripLeadingEmoji !== stripLeadingEmoji) {
      return window.stripLeadingEmoji(str);
    }
    if (!str) return '';
    let i = 0;
    const codes = [];
    for (let j = 0; j < str.length; j++) {
      codes.push(str.charCodeAt(j));
    }
    while (i < codes.length) {
      const c = codes[i];
      if (c >= 0xD800 && c <= 0xDBFF) {
        i += 2;
        if (i < codes.length && codes[i] === 0xFE0F) i++;
        if (i < codes.length && codes[i] === 0x20) i++;
      } else {
        break;
      }
    }
    return str.slice(i);
  }

// ============================================================
// SUBCATEGORY MANAGER LOGIC (INLINE EDIT, MERGE, SORT, UNDO)
// ============================================================
let _lastSubcatDeleteBackup = null;
let _subcatUndoTimer = null;
let _subcatUndoActiveCallback = null;

function showSubcatUndoSnackbar(message, onUndo) {
  if (_subcatUndoTimer) {
    clearTimeout(_subcatUndoTimer);
    _subcatUndoTimer = null;
  }
  let snackbar = document.getElementById('subcat-undo-snackbar');
  if (!snackbar) {
    snackbar = document.createElement('div');
    snackbar.id = 'subcat-undo-snackbar';
    snackbar.style.cssText = 'position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#242936; color:#fff; padding:12px 18px; border-radius:12px; font-size:13px; font-family:"Outfit",sans-serif; display:flex; align-items:center; gap:12px; box-shadow:0 8px 24px rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); z-index:2147483646; transition:opacity 0.3s, transform 0.3s;';
    document.body.appendChild(snackbar);
  }

  const undoText = (state.lang || 'el') === 'el' ? 'Αναίρεση' : 'Undo';
  snackbar.innerHTML = `
    <span style="font-weight: 500;">${escapeHtml(message)}</span>
    <button type="button" id="subcat-undo-btn" style="background:var(--accent, #7c6af7); color:#fff; border:none; border-radius:8px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit;">${undoText}</button>
  `;
  snackbar.style.display = 'flex';
  snackbar.style.opacity = '1';

  const undoBtn = document.getElementById('subcat-undo-btn');
  if (undoBtn) {
    undoBtn.onclick = () => {
      snackbar.style.opacity = '0';
      setTimeout(() => { snackbar.style.display = 'none'; }, 300);
      if (typeof onUndo === 'function') onUndo();
    };
  }

  _subcatUndoTimer = setTimeout(() => {
    snackbar.style.opacity = '0';
    setTimeout(() => { snackbar.style.display = 'none'; }, 300);
  }, 5000);
}

function getSubcategoriesStatsForCategory(categoryName) {
  const cleanedCat = stripLeadingEmoji(categoryName).toUpperCase().trim();
  const stats = {};

  (state.transactions || []).forEach(t => {
    if (t && t.category && stripLeadingEmoji(t.category).toUpperCase().trim() === cleanedCat) {
      if (t.subcategory && t.subcategory.trim() !== '') {
        const sub = t.subcategory.trim();
        if (!stats[sub]) {
          stats[sub] = { count: 0, lastUsedDate: '' };
        }
        stats[sub].count++;

        const tDate = t.date || '';
        if (tDate && (!stats[sub].lastUsedDate || tDate > stats[sub].lastUsedDate)) {
          stats[sub].lastUsedDate = tDate;
        }
      }
    }
  });

  return stats;
}

function getSubcategoriesForCategory(category) {
  if (!category) return [];
  const rawClean = stripLeadingEmoji(category).trim();
  const cleanedCat = rawClean.toUpperCase();
  const normCat = (typeof normalizeGreekString === 'function') ? normalizeGreekString(rawClean) : cleanedCat.toLowerCase();
  const dispCat = (typeof getCategoryDisplayName === 'function') ? getCategoryDisplayName(category).toUpperCase().trim() : '';
  const normDisp = (typeof normalizeGreekString === 'function' && dispCat) ? normalizeGreekString(dispCat) : '';
  const uniqueSubcats = new Set();

  const cat = (state.categories || []).find(c => {
    if (!c) return false;
    const cClean = stripLeadingEmoji(c.name || '').trim().toUpperCase();
    const cNorm = (typeof normalizeGreekString === 'function') ? normalizeGreekString(c.name || '') : cClean.toLowerCase();
    return cClean === cleanedCat || cClean === dispCat || cNorm === normCat || (normDisp && cNorm === normDisp);
  });

  const deletedSubs = new Set(
    ((cat && Array.isArray(cat.deleted_subcategories)) ? cat.deleted_subcategories : [])
      .map(s => String(s || '').trim().toLowerCase())
  );

  // 1. Match DEFAULT_SUBCATEGORIES_MAP case-insensitively & accent-insensitively
  if (typeof DEFAULT_SUBCATEGORIES_MAP === 'object' && DEFAULT_SUBCATEGORIES_MAP) {
    Object.keys(DEFAULT_SUBCATEGORIES_MAP).forEach(key => {
      const keyClean = stripLeadingEmoji(key).trim().toUpperCase();
      const keyNorm = (typeof normalizeGreekString === 'function') ? normalizeGreekString(key) : keyClean.toLowerCase();

      if (keyClean === cleanedCat || keyClean === dispCat || keyNorm === normCat || (normDisp && keyNorm === normDisp)) {
        (DEFAULT_SUBCATEGORIES_MAP[key] || []).forEach(sub => {
          const s = String(sub || '').trim();
          if (s && !deletedSubs.has(s.toLowerCase())) uniqueSubcats.add(s);
        });
      }
    });
  }

  // 2. Match custom subcategories attached to state.categories
  if (cat && Array.isArray(cat.subcategories)) {
    cat.subcategories.forEach(sub => {
      const s = typeof sub === 'string' ? sub.trim() : (sub && sub.name ? String(sub.name).trim() : String(sub || '').trim());
      if (s && !deletedSubs.has(s.toLowerCase())) uniqueSubcats.add(s);
    });
  }

  // 3. Match subcategories from existing transactions
  (state.transactions || []).forEach(t => {
    if (t && t.category && stripLeadingEmoji(t.category).trim().toUpperCase() === cleanedCat) {
      if (t.subcategory && t.subcategory.trim() !== '') {
        const s = t.subcategory.trim();
        if (!deletedSubs.has(s.toLowerCase())) uniqueSubcats.add(s);
      }
    }
  });

  return Array.from(uniqueSubcats).sort();
}

function getSortedSubcategoriesForCategory(categoryName) {
  if (!categoryName) return [];
  const stats = getSubcategoriesStatsForCategory(categoryName);
  const subcatKeys = new Set(Object.keys(stats));

  const rawClean = stripLeadingEmoji(categoryName).trim();
  const cleanedCat = rawClean.toUpperCase();
  const normCat = (typeof normalizeGreekString === 'function') ? normalizeGreekString(rawClean) : cleanedCat.toLowerCase();
  const dispCat = (typeof getCategoryDisplayName === 'function') ? getCategoryDisplayName(categoryName).toUpperCase().trim() : '';
  const normDisp = (typeof normalizeGreekString === 'function' && dispCat) ? normalizeGreekString(dispCat) : '';

  // 1. Find category object in state.categories
  const cat = (state.categories || []).find(c => {
    if (!c) return false;
    const cClean = stripLeadingEmoji(c.name || '').trim().toUpperCase();
    const cNorm = (typeof normalizeGreekString === 'function') ? normalizeGreekString(c.name || '') : cClean.toLowerCase();
    return cClean === cleanedCat || cClean === dispCat || cNorm === normCat || (normDisp && cNorm === normDisp);
  });

  const deletedSubs = new Set(
    ((cat && Array.isArray(cat.deleted_subcategories)) ? cat.deleted_subcategories : [])
      .map(s => String(s || '').trim().toLowerCase())
  );

  // 2. Merge default subcategories from DEFAULT_SUBCATEGORIES_MAP (unless deleted)
  if (typeof DEFAULT_SUBCATEGORIES_MAP === 'object' && DEFAULT_SUBCATEGORIES_MAP) {
    Object.keys(DEFAULT_SUBCATEGORIES_MAP).forEach(key => {
      const keyClean = stripLeadingEmoji(key).trim().toUpperCase();
      const keyNorm = (typeof normalizeGreekString === 'function') ? normalizeGreekString(key) : keyClean.toLowerCase();

      if (keyClean === cleanedCat || keyClean === dispCat || keyNorm === normCat || (normDisp && keyNorm === normDisp)) {
        (DEFAULT_SUBCATEGORIES_MAP[key] || []).forEach(sub => {
          const s = String(sub || '').trim();
          if (s && !deletedSubs.has(s.toLowerCase())) {
            subcatKeys.add(s);
          }
        });
      }
    });
  }

  // 3. Merge static subcategories from category object in state.categories (unless deleted)
  if (cat && Array.isArray(cat.subcategories)) {
    cat.subcategories.forEach(sub => {
      const s = typeof sub === 'string' ? sub.trim() : (sub && sub.name ? String(sub.name).trim() : String(sub || '').trim());
      if (s && !deletedSubs.has(s.toLowerCase())) {
        subcatKeys.add(s);
      }
    });
  }

  const arr = Array.from(subcatKeys).filter(s => !deletedSubs.has(String(s).trim().toLowerCase()));

  // Sort them:
  // 1. By transaction count descending
  // 2. If counts are equal, alphabetically
    const customOrder = (typeof getCustomSubcategoryOrder === 'function') ? getCustomSubcategoryOrder(categoryName) : [];
  arr.sort((a, b) => {
    const idxA = customOrder.indexOf(a);
    const idxB = customOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    const countA = stats[a] ? stats[a].count : 0;
    const countB = stats[b] ? stats[b].count : 0;
    if (countB !== countA) {
      return countB - countA;
    }
    return a.localeCompare(b, state.lang === 'el' ? 'el' : 'en', { sensitivity: 'base' });
  });

  return arr;
}

async function renameSubcategoryGlobally(categoryName, oldSub, newSub) {
  const cleanedCat = stripLeadingEmoji(categoryName).toUpperCase().trim();
  const normCat = (typeof normalizeGreekString === 'function') ? normalizeGreekString(categoryName) : cleanedCat.toLowerCase();
  const dispCat = (typeof getCategoryDisplayName === 'function') ? getCategoryDisplayName(categoryName).toUpperCase().trim() : '';
  const normDisp = (typeof normalizeGreekString === 'function' && dispCat) ? normalizeGreekString(dispCat) : '';

  let cat = (state.categories || []).find(c => {
    if (!c) return false;
    const cClean = stripLeadingEmoji(c.name || '').trim().toUpperCase();
    const cNorm = (typeof normalizeGreekString === 'function') ? normalizeGreekString(c.name || '') : cClean.toLowerCase();
    return cClean === cleanedCat || cClean === dispCat || cNorm === normCat || (normDisp && cNorm === normDisp);
  });

  const now = new Date().toISOString();
  if (!cat) {
    cat = {
      id: typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID(),
      name: categoryName,
      type: 'expense',
      subcategories: [newSub.trim()],
      deleted_subcategories: [oldSub.trim()],
      user_id: state.currentUser ? state.currentUser.id : null,
      family_id: state.userProfile ? state.userProfile.family_id : null,
      created_at: now,
      updated_at: now
    };
    if (!state.categories) state.categories = [];
    state.categories.push(cat);
  } else {
    if (!Array.isArray(cat.subcategories)) {
      cat.subcategories = [];
    }
    cat.subcategories = cat.subcategories.filter(s => s.trim().toLowerCase() !== oldSub.trim().toLowerCase());
    if (!cat.subcategories.some(s => s.toLowerCase() === newSub.trim().toLowerCase())) {
      cat.subcategories.push(newSub.trim());
    }

    if (!Array.isArray(cat.deleted_subcategories)) {
      cat.deleted_subcategories = [];
    }
    if (!cat.deleted_subcategories.some(s => s.toLowerCase() === oldSub.trim().toLowerCase())) {
      cat.deleted_subcategories.push(oldSub.trim());
    }
    cat.deleted_subcategories = cat.deleted_subcategories.filter(s => s.toLowerCase() !== newSub.trim().toLowerCase());
  }

  cat.updated_at = now;
  saveCategoriesToStorage();

  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      await state.supabaseClient.from('categories').upsert({
        id: cat.id || (typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID()),
        user_id: state.currentUser.id,
        family_id: state.userProfile ? state.userProfile.family_id : null,
        name: cat.name,
        type: cat.type || 'expense',
        icon: cat.icon || '',
        color: cat.color || '',
        hidden: !!cat.hidden,
        subcategories: cat.subcategories,
        deleted_subcategories: cat.deleted_subcategories,
        updated_at: now
      });
    } catch (err) {
      console.warn('Supabase categories update error:', err);
    }
  }

  // 2. Update transactions
  let updatedCount = 0;
  (state.transactions || []).forEach(t => {
    if (t && t.category && stripLeadingEmoji(t.category).toUpperCase().trim() === cleanedCat) {
      if (t.subcategory && t.subcategory.trim().toLowerCase() === oldSub.trim().toLowerCase()) {
        t.subcategory = newSub.trim();
        updatedCount++;
      }
    }
  });

  if (updatedCount > 0) {
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
    calculateInitialBalances();
    updateUI();
  }

  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      const { error } = await state.supabaseClient
        .from('transactions')
        .update({ subcategory: newSub.trim() })
        .match({ user_id: state.currentUser.id, category: categoryName, subcategory: oldSub });

      if (error) console.warn('Supabase subcategory rename sync error:', error);
    } catch (err) {
      console.warn('Supabase subcategory rename sync failed:', err);
    }
  }

  showSyncToast(state.lang === 'el' ? '✓ Υποκατηγορία μετονομάστηκε' : '✓ Subcategory renamed', 2000);
}

async function deleteSubcategoryGlobally(categoryName, subToDelete) {
  const cleanedCat = stripLeadingEmoji(categoryName).toUpperCase().trim();
  const normCat = (typeof normalizeGreekString === 'function') ? normalizeGreekString(categoryName) : cleanedCat.toLowerCase();
  const dispCat = (typeof getCategoryDisplayName === 'function') ? getCategoryDisplayName(categoryName).toUpperCase().trim() : '';
  const normDisp = (typeof normalizeGreekString === 'function' && dispCat) ? normalizeGreekString(dispCat) : '';

  // 1. Remove from static list in category object and mark in deleted_subcategories
  let cat = (state.categories || []).find(c => {
    if (!c) return false;
    const cClean = stripLeadingEmoji(c.name || '').trim().toUpperCase();
    const cNorm = (typeof normalizeGreekString === 'function') ? normalizeGreekString(c.name || '') : cClean.toLowerCase();
    return cClean === cleanedCat || cClean === dispCat || cNorm === normCat || (normDisp && cNorm === normDisp);
  });

  const now = new Date().toISOString();
  if (!cat) {
    cat = {
      id: typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID(),
      name: categoryName,
      type: 'expense',
      subcategories: [],
      deleted_subcategories: [subToDelete.trim()],
      user_id: state.currentUser ? state.currentUser.id : null,
      family_id: state.userProfile ? state.userProfile.family_id : null,
      created_at: now,
      updated_at: now
    };
    if (!state.categories) state.categories = [];
    state.categories.push(cat);
  } else {
    if (!Array.isArray(cat.subcategories)) {
      cat.subcategories = [];
    }
    cat.subcategories = cat.subcategories.filter(s => {
      const sName = typeof s === 'string' ? s.trim() : (s && s.name ? String(s.name).trim() : String(s || '').trim());
      return sName.toLowerCase() !== subToDelete.trim().toLowerCase();
    });

    if (!Array.isArray(cat.deleted_subcategories)) {
      cat.deleted_subcategories = [];
    }
    if (!cat.deleted_subcategories.some(s => s.toLowerCase() === subToDelete.trim().toLowerCase())) {
      cat.deleted_subcategories.push(subToDelete.trim());
    }
  }

  cat.updated_at = now;
  saveCategoriesToStorage();

  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      await state.supabaseClient.from('categories').upsert({
        id: cat.id || (typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID()),
        user_id: state.currentUser.id,
        family_id: state.userProfile ? state.userProfile.family_id : null,
        name: cat.name,
        type: cat.type || 'expense',
        icon: cat.icon || '',
        color: cat.color || '',
        hidden: !!cat.hidden,
        subcategories: cat.subcategories,
        deleted_subcategories: cat.deleted_subcategories,
        updated_at: now
      });
    } catch (err) {
      console.warn('Supabase categories update error:', err);
    }
  }

  // NOTE: Existing transactions are preserved untouched (their category & subcategory remain intact)
  _lastSubcatDeleteBackup = {
    categoryName: categoryName,
    subcategoryName: subToDelete,
    timestamp: Date.now()
  };

  updateUI();

  const msg = state.lang === 'el'
    ? `Διαγράφηκε η υποκατηγορία "${subToDelete}" από τις επιλογές`
    : `Deleted subcategory "${subToDelete}" from options`;

  showSubcatUndoSnackbar(msg, () => {
    undoLastSubcategoryDelete();
  });

  if (typeof renderCategoryManagerList === 'function') {
    renderCategoryManagerList();
  }
  if (typeof editingCategoryName !== 'undefined' && editingCategoryName) {
    renderEditCategorySubcategories(editingCategoryName);
  }
}

async function undoLastSubcategoryDelete() {
  if (!_lastSubcatDeleteBackup) return;

  const { categoryName, subcategoryName } = _lastSubcatDeleteBackup;

  // Restore in category object
  const cleanedCat = stripLeadingEmoji(categoryName).toUpperCase().trim();
  const normCat = (typeof normalizeGreekString === 'function') ? normalizeGreekString(categoryName) : cleanedCat.toLowerCase();
  const dispCat = (typeof getCategoryDisplayName === 'function') ? getCategoryDisplayName(categoryName).toUpperCase().trim() : '';
  const normDisp = (typeof normalizeGreekString === 'function' && dispCat) ? normalizeGreekString(dispCat) : '';

  const cat = (state.categories || []).find(c => {
    if (!c) return false;
    const cClean = stripLeadingEmoji(c.name || '').trim().toUpperCase();
    const cNorm = (typeof normalizeGreekString === 'function') ? normalizeGreekString(c.name || '') : cClean.toLowerCase();
    return cClean === cleanedCat || cClean === dispCat || cNorm === normCat || (normDisp && cNorm === normDisp);
  });

  if (cat) {
    if (Array.isArray(cat.deleted_subcategories)) {
      cat.deleted_subcategories = cat.deleted_subcategories.filter(s => s.toLowerCase() !== subcategoryName.toLowerCase());
    }
    if (!Array.isArray(cat.subcategories)) {
      cat.subcategories = [];
    }
    if (!cat.subcategories.some(s => s.toLowerCase() === subcategoryName.toLowerCase())) {
      cat.subcategories.push(subcategoryName);
    }
    const now = new Date().toISOString();
    cat.updated_at = now;
    saveCategoriesToStorage();

    if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
      state.supabaseClient.from('categories').upsert({
        id: cat.id || (typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID()),
        user_id: state.currentUser.id,
        family_id: state.userProfile ? state.userProfile.family_id : null,
        name: cat.name,
        type: cat.type || 'expense',
        icon: cat.icon || '',
        color: cat.color || '',
        hidden: !!cat.hidden,
        subcategories: cat.subcategories,
        deleted_subcategories: cat.deleted_subcategories,
        updated_at: now
      }).then(() => { }, err => console.warn('Supabase categories undo update error:', err));
    }
  }

  _lastSubcatDeleteBackup = null;

  if (typeof editingCategoryName !== 'undefined' && editingCategoryName) {
    renderEditCategorySubcategories(editingCategoryName);
  }
  if (typeof renderCategoryManagerList === 'function') {
    renderCategoryManagerList();
  }
  if (typeof renderCategoryManagerSubcategories === 'function') {
    renderCategoryManagerSubcategories(categoryName);
  }

  updateUI();
  showSyncToast(state.lang === 'el' ? '✓ Η διαγραφή αναιρέθηκε' : '✓ Deletion undone', 2000);
}


  // Window attachments for backward compatibility and global access
  if (typeof window !== 'undefined') {
    window.showSubcatUndoSnackbar = showSubcatUndoSnackbar;
    window.getSubcategoriesStatsForCategory = getSubcategoriesStatsForCategory;
    window.getSubcategoriesForCategory = getSubcategoriesForCategory;
    window.getSortedSubcategoriesForCategory = getSortedSubcategoriesForCategory;
    window.renameSubcategoryGlobally = renameSubcategoryGlobally;
    window.deleteSubcategoryGlobally = deleteSubcategoryGlobally;
    window.undoLastSubcategoryDelete = undoLastSubcategoryDelete;
  }

  return {
    showSubcatUndoSnackbar,
    getSubcategoriesStatsForCategory,
    getSubcategoriesForCategory,
    getSortedSubcategoriesForCategory,
    renameSubcategoryGlobally,
    deleteSubcategoryGlobally,
    undoLastSubcategoryDelete
  };
}));
