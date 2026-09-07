// ============================================================
// CATEGORY & SUBCATEGORY FORM PICKER & MODAL VIEW SUBSYSTEM
// Autonomous UMD Module (Phase 18C Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
    var exports = factory();
    Object.assign(rootObj, exports);
    rootObj.CategoryPickerView = exports;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

  let editingCategoryName = null;
  let newCategoryDialogType = 'expense';
  let newCategorySelectedIcon = 'fa-solid fa-basket-shopping';
  let newCategorySelectedColor = '#f59e0b';

function updateCategoryDisplay() {
  const categoryHidden = document.getElementById('trans-category');
  const categoryDisplay = document.getElementById('trans-category-display');
  if (!categoryHidden || !categoryDisplay) return;

  const categoryVal = categoryHidden.value;
  if (!categoryVal) {
    categoryDisplay.innerHTML = `<span class="custom-select-placeholder">${(TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['label_select']) || 'Επιλέξτε...'}</span>`;
    return;
  }

  const type = document.querySelector('.type-tab-btn.active')?.getAttribute('data-type') || 'expense';
  const cleanName = getCategoryDisplayName(categoryVal);
  const iconHtml = (typeof renderCategoryIconHtml === 'function')
    ? renderCategoryIconHtml(categoryVal, { size: 'inline', transType: type })
    : '';

  const subcatSelect = document.getElementById('trans-subcategory-select')?.value || '';
  const subcatCustom = document.getElementById('trans-subcategory-custom')?.value || '';

  let subcatText = '';
  if (subcatSelect === '__NEW__') {
    subcatText = subcatCustom.trim();
  } else if (subcatSelect) {
    subcatText = getSubcategoryDisplayName(subcatSelect.trim(), categoryVal);
  }

  const fullText = subcatText ? `${cleanName} > ${subcatText}` : cleanName;
  const isLongText = fullText.length > 20;
  const fontSizeStyle = isLongText ? 'font-size: 11.5px;' : 'font-size: 13px;';

  if (subcatText) {
    categoryDisplay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 4px; ${fontSizeStyle} min-width: 0; flex: 1; overflow: hidden;">
        <span style="font-size:14px; flex-shrink:0; display:inline-flex; align-items:center;">${iconHtml}</span>
        <span style="font-weight:600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 85px; flex-shrink: 0;">${cleanName}</span>
        <span style="color: var(--text-muted); margin: 0 1px; flex-shrink:0;">&gt;</span>
        <span style="font-weight:600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1;">${subcatText}</span>
      </div>
    `;
  } else {
    categoryDisplay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 5px; ${fontSizeStyle} min-width: 0; flex: 1; overflow: hidden;">
        <span style="font-size:14px; flex-shrink:0; display:inline-flex; align-items:center;">${iconHtml}</span>
        <span style="font-weight:600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1;">${cleanName}</span>
      </div>
    `;
  }
}

function updateSubcategoryRowVisibility() {
  const subcatGroup = document.getElementById('form-row-subcategory');
  if (!subcatGroup) return;
  const type = document.querySelector('.type-tab-btn.active')?.getAttribute('data-type') || 'expense';
  const subcatSelect = document.getElementById('trans-subcategory-select')?.value || '';

  if (type === 'transfer') {
    subcatGroup.style.display = 'none';
  } else {
    if (subcatSelect === '__NEW__') {
      subcatGroup.style.display = 'flex';
    } else {
      subcatGroup.style.display = 'none';
    }
  }
}

function setTransactionFormType(type) {
  try {
    if (!type) type = 'expense';
    const form = document.getElementById('transaction-form');
    if (form && form.getAttribute('data-readonly') === 'true') return;

    document.querySelectorAll('.type-tab-btn').forEach(btn => {
      const btnType = btn.getAttribute('data-type');
      if (btnType) {
        btn.classList.toggle('active', btnType === type);
      }
    });

    const modalEl = document.getElementById('transaction-modal');
    if (modalEl) {
      modalEl.classList.remove('expense', 'income', 'transfer');
      modalEl.classList.add(type);
    }

    const currentLang = state.lang || 'el';
    const langDict = TRANSLATIONS[currentLang] || TRANSLATIONS['el'];
    let typeLabel = langDict['type_tab_expense'] || 'Έξοδο';
    if (type === 'income') typeLabel = langDict['type_tab_income'] || 'Έσοδο';
    else if (type === 'transfer') typeLabel = langDict['type_tab_transfer'] || 'Μεταφορά';

    const titleEl = document.getElementById('modal-trans-title');
    if (titleEl) {
      titleEl.textContent = typeLabel;
    }

    const catGroup = document.getElementById('form-row-category');
    const toAccGroup = document.getElementById('form-row-account-to');
    const fromAccLabel = document.getElementById('label-account-from');

    if (type === 'transfer') {
      if (catGroup) catGroup.style.display = 'none';
      updateSubcategoryRowVisibility();
      if (toAccGroup) toAccGroup.style.display = 'flex';
      if (fromAccLabel) fromAccLabel.textContent = langDict['label_from'] || 'Από';
    } else {
      if (catGroup) catGroup.style.display = 'flex';
      updateSubcategoryRowVisibility();
      if (toAccGroup) toAccGroup.style.display = 'none';
      if (fromAccLabel) fromAccLabel.textContent = langDict['row_account_from'] || langDict['label_account'] || 'Τρόπος πληρωμής';
      updateCategoryDropdowns(type);
      updateSubcategorySuggestions();
    }
  } catch (err) {
    console.error('Error in setTransactionFormType:', err);
  }
}

let categoryPickerEditMode = false;

function toggleCategoryPickerEditMode() {
  categoryPickerEditMode = !categoryPickerEditMode;
  const btn = document.getElementById('btn-toggle-cat-edit');
  if (btn) {
    btn.textContent = categoryPickerEditMode
      ? (TRANSLATIONS[state.lang]['keypad_btn_done'] || 'Τέλος')
      : (TRANSLATIONS[state.lang]['btn_manage'] || 'Διαχείριση');
    if (categoryPickerEditMode) {
      btn.style.borderColor = 'var(--accent)';
      btn.style.color = 'var(--accent)';
    } else {
      btn.style.borderColor = 'var(--border)';
      btn.style.color = 'var(--text-secondary)';
    }
  }
  const currentType = window._openedCategoryPickerFromSettings
    ? (window._categoryPickerSettingsType || 'expense')
    : document.querySelector('.type-tab-btn.active').getAttribute('data-type');
  updateCategoryDropdowns(currentType, true);
}

async function inlineDeleteCustomCategory(categoryName, type) {
  const confirmMsg = state.lang === 'el'
    ? 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την κατηγορία;'
    : 'Are you sure you want to delete this category?';

  const confirmed = await showConfirm(confirmMsg, state.lang === 'el' ? 'Διαγραφή Κατηγορίας' : 'Delete Category', '📂');
  if (!confirmed) {
    return;
  }

  // Also check if any transactions use this category. If yes, inform the user clearly
  const count = (state.transactions || []).filter(t => t && t.category === categoryName).length;
  if (count > 0) {
    const warningMsg = state.lang === 'el'
      ? `Αυτή η κατηγορία χρησιμοποιείται σε ${count} συναλλαγές. Οι συναλλαγές σας θα παραμείνουν αποθηκευμένες κανονικά (δεν διαγράφονται). Θέλετε να αφαιρεθεί η κατηγορία από τη λίστα επιλογών;`
      : `This category is used in ${count} transactions. Your transactions will remain safely stored (they will not be deleted). Do you want to remove the category from the options list?`;

    const warningConfirmed = await showConfirm(warningMsg, state.lang === 'el' ? 'Επιβεβαίωση' : 'Confirmation', '📂');
    if (!warningConfirmed) {
      return;
    }
  }

  // Find the category to get its ID before removing it
  const catToDelete = state.categories.find(c => c.name === categoryName);
  if (!catToDelete) return;

  state.categories = state.categories.filter(c => c.name !== categoryName);
  saveCategoriesToStorage();

  // Sync delete to cloud if enabled
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser && catToDelete.id) {
    try {
      state.supabaseClient
        .from('categories')
        .delete()
        .eq('id', catToDelete.id)
        .then(({ error }) => {
          if (error) console.warn('Cloud category delete warning:', error);
        });
    } catch (e) {
      console.warn('Cloud category delete failed:', e);
    }
  }

  updateCategoryDropdowns(type);
  if (typeof renderCategoryManagerList === 'function') {
    renderCategoryManagerList();
  }
  updateUI();
}

function inlineRenameCategory(categoryName, type) {
  const cat = state.categories.find(c => c.name === categoryName);
  if (!cat) return;

  const currentDisplayName = getCategoryDisplayName(categoryName);
  const newName = prompt(
    state.lang === 'el' ? 'Εισάγετε το νέο όνομα της κατηγορίας:' : 'Enter the new category name:',
    currentDisplayName
  );

  if (newName === null) return; // User cancelled
  const trimmed = newName.trim();
  if (trimmed === '') {
    window.showAlert(state.lang === 'el' ? 'Το όνομα δεν μπορεί να είναι κενό!' : 'Category name cannot be empty!');
    return;
  }

  // If the display name did not change, do nothing
  if (trimmed === currentDisplayName) return;

  // Check if another category with the same name and type already exists
  const exists = state.categories.find(c => c.type === type && getCategoryDisplayName(c.name).toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    window.showAlert(
      state.lang === 'el'
        ? 'Υπάρχει ήδη κατηγορία με αυτό το όνομα!'
        : 'A category with this name already exists!'
    );
    return;
  }

  const oldName = cat.name;
  const now = new Date().toISOString();

  // Update category name
  cat.name = trimmed;
  cat.updated_at = now;

  // Update all transactions that were using the old category name
  let transactionsUpdated = 0;
  state.transactions.forEach(t => {
    if (t.category === oldName) {
      t.category = trimmed;
      transactionsUpdated++;
    }
  });

  saveCategoriesToStorage();

  if (transactionsUpdated > 0) {
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
  }

  // Sync to Cloud if enabled
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      // Update the category in cloud
      state.supabaseClient
        .from('categories')
        .update({
          name: cat.name,
          updated_at: now
        })
        .eq('id', cat.id)
        .then(({ error }) => {
          if (error) console.warn('Cloud category rename warning:', error);
        });

      // 3. Update transactions in Supabase if any were updated locally
      if (transactionsUpdated > 0) {
        state.supabaseClient
          .from('transactions')
          .update({ category: trimmed })
          .match({ user_id: state.currentUser.id, category: oldName })
          .then(({ error: transErr }) => {
            if (transErr) console.warn('Cloud transactions category update warning:', transErr);
          });
      }
    } catch (e) {
      console.warn('Cloud category rename sync failed:', e);
    }
  }

  updateCategoryDropdowns(type, true);
  updateUI();
}

window.inlineRenameCategory = inlineRenameCategory;
window.openEditCategoryDialog = openEditCategoryDialog;
window.openNewCategoryDialog = openNewCategoryDialog;
window.closeNewCategoryDialog = closeNewCategoryDialog;
window.openCategoryModal = openCategoryModal;

function getCustomCategoryOrder(type) { try { return JSON.parse(localStorage.getItem(`custom_category_order_${type}`)) || []; } catch(e) { return []; } }
function setCustomCategoryOrder(type, arr) { localStorage.setItem(`custom_category_order_${type}`, JSON.stringify(arr)); }
function getCustomSubcategoryOrder(cat) { try { return JSON.parse(localStorage.getItem(`custom_subcategory_order_${cat}`)) || []; } catch(e) { return []; } }
function setCustomSubcategoryOrder(cat, arr) { localStorage.setItem(`custom_subcategory_order_${cat}`, JSON.stringify(arr)); }

let lastRenderedCategoryType = null;
let lastRenderedCategoryEditMode = null;

function updateCategoryDropdowns(type = 'expense', force = false) {
  if (!state.categories || state.categories.length === 0) {
    state.categories = DEFAULT_CATEGORIES.slice();
  }
  deduplicateCategories();
  const grid = document.getElementById('category-picker-grid');
  if (!grid) return;

  // Performance optimization to prevent modal opening lag
  if (!force && lastRenderedCategoryType === type && lastRenderedCategoryEditMode === categoryPickerEditMode) {
    return;
  }

  grid.innerHTML = '';
  lastRenderedCategoryType = type;
  lastRenderedCategoryEditMode = categoryPickerEditMode;

  const currentCategory = document.getElementById('trans-category').value;
  let categoryExists = false;

  // Filter by type. In edit mode, show all. Otherwise, hide hidden categories.
  let visibleCategories = state.categories.filter(c => c.type === type && (categoryPickerEditMode || !c.hidden));

  // Fallback: If no categories found for this type, inject defaults for this type
  if (visibleCategories.length === 0) {
    const defaultsForType = DEFAULT_CATEGORIES.filter(c => c.type === type);
    state.categories.push(...defaultsForType);
    deduplicateCategories();
    visibleCategories = state.categories.filter(c => c.type === type && (categoryPickerEditMode || !c.hidden));
  }

  // Sort categories alphabetically based on display name in the active language
  const lang = state.lang || 'el';
    const customOrder = getCustomCategoryOrder(type);
  visibleCategories.sort((a, b) => {
    const idxA = customOrder.indexOf(a.name);
    const idxB = customOrder.indexOf(b.name);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    const nameA = getCategoryDisplayName(a.name);
    const nameB = getCategoryDisplayName(b.name);
    return nameA.localeCompare(nameB, lang === 'el' ? 'el' : 'en', { sensitivity: 'base' });
  });

  visibleCategories.forEach(c => {
    const div = document.createElement('div');
    div.className = 'category-picker-item';
    div.setAttribute('data-category-name', c.name);

    const displayName = getCategoryDisplayName(c.name);
    const catBadge = (typeof renderCategoryIconHtml === 'function')
      ? renderCategoryIconHtml(c, { size: 'sm', transType: type })
      : `<span class="category-picker-icon">${c.icon}</span>`;

    if (categoryPickerEditMode) {
      div.classList.add('in-edit-mode');
      if (c.hidden) div.style.opacity = '0.55';
      div.innerHTML = `
        ${catBadge}
        <span class="category-picker-name">${displayName}</span>
        <span class="category-delete-badge" title="${state.lang === 'el' ? 'Διαγραφή' : 'Delete'}">
          <i class="fa-solid fa-xmark"></i>
        </span>
      `;
      // Tap the badge = delete
      div.querySelector('.category-delete-badge').addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        inlineDeleteCustomCategory(c.name, type);
      });
      // Tap the card body = edit
      div.onclick = () => openEditCategoryDialog(c.name, type);
    } else {
      if (c.name === currentCategory || (currentCategory && normalizeCategoryName(c.name) === normalizeCategoryName(currentCategory))) {
        div.classList.add('selected');
        categoryExists = true;
      }
      div.innerHTML = `${catBadge}<span class="category-picker-name">${displayName}</span>`;
      div.onclick = () => selectCategory(c.name, c.icon, c.color, true);
    }

    grid.appendChild(div);
  });

  // "+" New Category box (always visible, both in normal and edit mode)
  const addBox = document.createElement('div');
  addBox.className = 'category-picker-item category-picker-add';
  addBox.innerHTML = `<div class="cat-vector-badge" style="width:28px; height:28px; border-radius:8px; background:rgba(124,106,247,0.15); border:1px solid rgba(124,106,247,0.3); color:var(--accent); display:inline-flex; align-items:center; justify-content:center; font-size:14px;"><i class="fa-solid fa-plus"></i></div><span class="category-picker-name">${state.lang === 'el' ? 'Νέα Κατηγορία' : 'New Category'}</span>`;
  addBox.onclick = () => openNewCategoryDialog(type);
  grid.appendChild(addBox);

    if (!categoryPickerEditMode && !categoryExists && currentCategory !== '') {
    document.getElementById('trans-category').value = '';
    updateCategoryDisplay();
  }
  if (window.Sortable) {
    if (grid._sortable) { grid._sortable.destroy(); }
    grid._sortable = Sortable.create(grid, {
      animation: 150, delay: 250, delayOnTouchOnly: true, filter: '.category-picker-add',
      onEnd: function (evt) {
        const newOrder = Array.from(grid.children).filter(el => !el.classList.contains('category-picker-add')).map(el => el.getAttribute('data-category-name')).filter(Boolean);
        setCustomCategoryOrder(type, newOrder);
      }
    });
  }
}


function selectCategory(name, icon, color, isManual = false) {
  document.getElementById('trans-category').value = name;
  document.querySelectorAll('.category-picker-item').forEach(item => {
    item.classList.remove('selected');
    if (item.getAttribute('data-category-name') === name) {
      item.classList.add('selected');
    }
  });

  // Reset subcategory selection when category changes
  document.getElementById('trans-subcategory-select').value = '';
  const customInput = document.getElementById('trans-subcategory-custom');
  if (customInput) customInput.value = '';

  updateCategoryDisplay();
  updateSubcategorySuggestions();
  updateSubcategoryRowVisibility();

  if (isManual) {
    closeModal('category-picker-modal');
    openSubcategoryModal();
  } else {
    closeModal('category-picker-modal');
  }
}

function selectSubcategory(name) {
  document.getElementById('trans-subcategory-select').value = name;
  const customInput = document.getElementById('trans-subcategory-custom');
  if (customInput) customInput.value = '';

  updateCategoryDisplay();
  updateSubcategoryRowVisibility();
  closeModal('subcategory-picker-modal');
}

function openCategoryModal() {
  if (window.autocompleteJustSelected) return;
  const form = document.getElementById('transaction-form');
  if (form && form.getAttribute('data-readonly') === 'true') return;
  const activeTypeTab = document.querySelector('.type-tab-btn.active');
  const currentType = activeTypeTab ? activeTypeTab.getAttribute('data-type') : 'expense';

  // Reset edit mode on modal open
  categoryPickerEditMode = false;
  const btn = document.getElementById('btn-toggle-cat-edit');
  if (btn) {
    btn.textContent = state.lang === 'el' ? 'Διαχείριση' : 'Manage';
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--text-secondary)';
  }

  // Force update to prevent any stale flash or lag when switching tabs
  updateCategoryDropdowns(currentType, true);
  closeNewCategoryDialog(); // Reset dialog state
  openModal('category-picker-modal');
}

function openEditCategoryDialog(categoryName, type) {
  const cat = state.categories.find(c => c.name === categoryName);
  if (!cat) return;

  editingCategoryName = categoryName;
  newCategoryDialogType = type || cat.type || 'expense';

  const visual = (typeof getCategoryVisual === 'function')
    ? getCategoryVisual(cat, newCategoryDialogType)
    : { iconClass: 'fa-solid fa-shapes', color: '#f59e0b' };

  newCategorySelectedIcon = visual.iconClass || 'fa-solid fa-shapes';
  newCategorySelectedColor = cat.color || visual.color || '#f59e0b';

  const nameInput = document.getElementById('new-cat-name-input');
  const titleEl = document.getElementById('new-cat-dialog-title');
  const searchInput = document.getElementById('new-cat-icon-search');

  if (titleEl) {
    titleEl.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_edit_title']) || (state.lang === 'el' ? 'Επεξεργασία Κατηγορίας' : 'Edit Category');
  }

  if (searchInput) {
    searchInput.value = '';
    searchInput.placeholder = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_search_placeholder']) || (state.lang === 'el' ? '🔍 Αναζήτηση (π.χ. καφές, burger, car)...' : '🔍 Search (e.g. coffee, burger, car)...');
  }
  if (nameInput) {
    nameInput.value = getCategoryDisplayName(categoryName);
    nameInput.placeholder = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_name_placeholder']) || (state.lang === 'el' ? 'Όνομα κατηγορίας' : 'Category name');
  }

  const modal = document.getElementById('category-editor-modal');
  if (modal) {
    modal.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang][k]) {
        el.textContent = TRANSLATIONS[state.lang][k];
      }
    });
    modal.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const k = el.getAttribute('data-i18n-placeholder');
      if (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang][k]) {
        el.placeholder = TRANSLATIONS[state.lang][k];
      }
    });
  }

  renderCategoryIconDialog('all', '');

  const saveBtn = document.querySelector('#category-editor-modal .btn-primary');
  if (saveBtn) saveBtn.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['btn_save']) || (state.lang === 'el' ? 'Αποθήκευση' : 'Save');
  const cancelBtn = document.querySelector('#category-editor-modal .btn-secondary');
  if (cancelBtn) cancelBtn.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['btn_cancel']) || (state.lang === 'el' ? 'Άκυρο' : 'Cancel');

  renderEditCategorySubcategories(categoryName);
  openModal('category-editor-modal');
  if (nameInput) setTimeout(() => nameInput.focus(), 150);
}

function openNewCategoryDialog(type) {
  editingCategoryName = null; // ensure we are in create mode
  newCategoryDialogType = type || (window._categoryManagerType || 'expense');
  newCategorySelectedIcon = newCategoryDialogType === 'income' ? 'fa-solid fa-wallet' : 'fa-solid fa-basket-shopping';
  newCategorySelectedColor = newCategoryDialogType === 'income' ? '#4caf50' : '#f59e0b';

  const nameInput = document.getElementById('new-cat-name-input');
  const titleEl = document.getElementById('new-cat-dialog-title');
  const searchInput = document.getElementById('new-cat-icon-search');

  if (titleEl) {
    titleEl.textContent = newCategoryDialogType === 'income'
      ? ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_title_income']) || (state.lang === 'el' ? 'Νέα Κατηγορία Εσόδου' : 'New Income Category'))
      : ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_title_expense']) || (state.lang === 'el' ? 'Νέα Κατηγορία Εξόδου' : 'New Expense Category'));
  }

  if (searchInput) {
    searchInput.value = '';
    searchInput.placeholder = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_search_placeholder']) || (state.lang === 'el' ? '🔍 Αναζήτηση (π.χ. καφές, burger, car)...' : '🔍 Search (e.g. coffee, burger, car)...');
  }
  if (nameInput) {
    nameInput.value = '';
    nameInput.placeholder = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_name_placeholder']) || (state.lang === 'el' ? 'Όνομα κατηγορίας' : 'Category name');
  }

  const modal = document.getElementById('category-editor-modal');
  if (modal) {
    modal.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang][k]) {
        el.textContent = TRANSLATIONS[state.lang][k];
      }
    });
    modal.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const k = el.getAttribute('data-i18n-placeholder');
      if (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang][k]) {
        el.placeholder = TRANSLATIONS[state.lang][k];
      }
    });
  }

  renderCategoryIconDialog('all', '');

  const saveBtn = document.querySelector('#category-editor-modal .btn-primary');
  if (saveBtn) {
    saveBtn.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['btn_save']) || (state.lang === 'el' ? 'Αποθήκευση' : 'Save');
  }
  const cancelBtn = document.querySelector('#category-editor-modal .btn-secondary');
  if (cancelBtn) {
    cancelBtn.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['btn_cancel']) || (state.lang === 'el' ? 'Άκυρο' : 'Cancel');
  }

  renderEditCategorySubcategories(null);
  openModal('category-editor-modal');
  if (nameInput) setTimeout(() => nameInput.focus(), 150);
}

function closeNewCategoryDialog() {
  closeModal('category-editor-modal');
  newCategoryDialogType = 'expense';
  newCategorySelectedIcon = 'fa-solid fa-basket-shopping';
  newCategorySelectedColor = '#f59e0b';
  editingCategoryName = null;
  renderEditCategorySubcategories(null);
}

// ═══════════════════════════════════════════════════════════════════════
// Vector Category Icon Dialog – renders library tabs, color palette,
// icon grid, and live preview inside the #category-editor-modal.
// ═══════════════════════════════════════════════════════════════════════

const NEON_BADGE_COLORS = [
  '#f59e0b', '#ef5350', '#ec407a', '#ab47bc', '#7c6af7',
  '#5c6bc0', '#42a5f5', '#26c6da', '#26a69a', '#66bb6a',
  '#8bc34a', '#4caf50', '#ff7043', '#78909c', '#8d6e63'
];

function renderCategoryIconDialog(libraryFilter, searchQuery) {
  const tabsContainer = document.getElementById('new-cat-library-tabs');
  const grid = document.getElementById('new-cat-emoji-grid');
  const colorPalette = document.getElementById('new-cat-color-palette');
  if (!grid) return;

  // ── Library Tabs ──
  if (tabsContainer) {
    tabsContainer.innerHTML = '';
    const lang = state.lang || 'el';
    const libs = (typeof ICON_LIBRARIES !== 'undefined') ? ICON_LIBRARIES : [];
    const allTab = document.createElement('button');
    allTab.type = 'button';
    allTab.textContent = lang === 'el' ? 'Όλα' : 'All';
    allTab.style.cssText = `padding:6px 12px; font-size:11px; font-weight:700; border-radius:8px; cursor:pointer; white-space:nowrap; border:1px solid ${libraryFilter === 'all' ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}; background:${libraryFilter === 'all' ? 'rgba(124,106,247,0.18)' : 'rgba(0,0,0,0.25)'}; color:${libraryFilter === 'all' ? 'var(--accent)' : 'var(--text-secondary)'};`;
    allTab.onclick = () => renderCategoryIconDialog('all', searchQuery || '');
    tabsContainer.appendChild(allTab);

    libs.forEach(lib => {
      const tab = document.createElement('button');
      tab.type = 'button';
      const isActive = libraryFilter === lib.id;
      tab.innerHTML = `<i class="${lib.icon}" style="margin-right:4px;"></i>${lang === 'el' ? lib.labelEl : lib.labelEn}`;
      tab.style.cssText = `padding:6px 12px; font-size:11px; font-weight:600; border-radius:8px; cursor:pointer; white-space:nowrap; border:1px solid ${isActive ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}; background:${isActive ? 'rgba(124,106,247,0.18)' : 'rgba(0,0,0,0.25)'}; color:${isActive ? 'var(--accent)' : 'var(--text-secondary)'};`;
      tab.onclick = () => renderCategoryIconDialog(lib.id, searchQuery || '');
      tabsContainer.appendChild(tab);
    });
  }

  // ── Color Palette ──
  if (colorPalette && colorPalette.children.length === 0) {
    NEON_BADGE_COLORS.forEach(hex => {
      const swatch = document.createElement('div');
      const isSelected = hex === newCategorySelectedColor;
      swatch.style.cssText = `width:28px; height:28px; min-width:28px; border-radius:50%; background:${hex}; cursor:pointer; border:2.5px solid ${isSelected ? 'white' : 'transparent'}; box-shadow:${isSelected ? '0 0 0 2px var(--accent)' : 'none'}; transition:all 0.15s;`;
      swatch.onclick = () => {
        newCategorySelectedColor = hex;
        colorPalette.querySelectorAll('div').forEach(s => {
          s.style.border = '2.5px solid transparent';
          s.style.boxShadow = 'none';
        });
        swatch.style.border = '2.5px solid white';
        swatch.style.boxShadow = '0 0 0 2px var(--accent)';
        updateNewCategoryLivePreview();
      };
      colorPalette.appendChild(swatch);
    });
  }

  // ── Icon Grid ──
  grid.innerHTML = '';
  const searchFn = (typeof searchCategoryIcons === 'function') ? searchCategoryIcons : null;
  const registry = (typeof CATEGORY_ICON_REGISTRY !== 'undefined') ? CATEGORY_ICON_REGISTRY : [];
  let icons;
  if (searchFn) {
    icons = searchFn(searchQuery || '', libraryFilter || 'all');
  } else {
    icons = registry.filter(item => {
      if (libraryFilter && libraryFilter !== 'all' && item.library !== libraryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return item.id.includes(q) || (item.keywords && item.keywords.some(kw => kw.toLowerCase().includes(q)));
      }
      return true;
    });
  }

  if (icons.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:16px; color:var(--text-muted); font-size:12px;">${state.lang === 'el' ? 'Δε βρέθηκαν εικονίδια' : 'No icons found'}</div>`;
    return;
  }

  icons.forEach(item => {
    const btn = document.createElement('div');
    const isSelected = item.icon === newCategorySelectedIcon;
    btn.style.cssText = `display:flex; align-items:center; justify-content:center; width:46px; height:46px; border-radius:9px; cursor:pointer; transition:all 0.15s; font-size:22px; color:${isSelected ? newCategorySelectedColor : 'var(--text-secondary)'}; border:2px solid ${isSelected ? newCategorySelectedColor : 'transparent'}; background:${isSelected ? 'rgba(124,106,247,0.12)' : 'transparent'};`;
    btn.innerHTML = (typeof renderIconGlyph === 'function')
      ? renderIconGlyph(item.icon, '', 'style="pointer-events:none;"')
      : (String(item.icon).startsWith('fa-') ? `<i class="${item.icon}"></i>` : `<span>${item.icon}</span>`);
    btn.title = item.id;
    btn.onclick = () => {
      newCategorySelectedIcon = item.icon;
      grid.querySelectorAll('div').forEach(d => {
        d.style.border = '2px solid transparent';
        d.style.background = 'transparent';
        d.style.color = 'var(--text-secondary)';
      });
      btn.style.border = `2px solid ${newCategorySelectedColor}`;
      btn.style.background = 'rgba(124,106,247,0.12)';
      btn.style.color = newCategorySelectedColor;
      updateNewCategoryLivePreview();
    };
    grid.appendChild(btn);
  });

  updateNewCategoryLivePreview();
}

function handleCategoryIconSearch(value) {
  const tabsContainer = document.getElementById('new-cat-library-tabs');
  // Determine currently active library tab
  let activeLib = 'all';
  if (tabsContainer) {
    const activeBtn = tabsContainer.querySelector('button[style*="accent"]');
    if (activeBtn) {
      const libs = (typeof ICON_LIBRARIES !== 'undefined') ? ICON_LIBRARIES : [];
      const btnText = activeBtn.textContent.trim();
      const match = libs.find(l => l.labelEl === btnText || l.labelEn === btnText);
      if (match) activeLib = match.id;
    }
  }
  renderCategoryIconDialog(activeLib, value || '');
}

function updateNewCategoryLivePreview() {
  const previewContainer = document.getElementById('new-cat-preview-icon-container');
  const previewName = document.getElementById('new-cat-preview-name');
  const previewType = document.getElementById('new-cat-preview-type');
  const nameInput = document.getElementById('new-cat-name-input');

  if (previewContainer) {
    const color = newCategorySelectedColor || '#f59e0b';
    const iconClass = newCategorySelectedIcon || 'fa-solid fa-basket-shopping';
    const hexToRgbaFn = (typeof hexToRgba === 'function') ? hexToRgba : (h, a) => `rgba(120,144,156,${a})`;
    const bgGlow = hexToRgbaFn(color, 0.15);
    const borderGlow = hexToRgbaFn(color, 0.28);
    previewContainer.innerHTML = `<div class="cat-vector-badge" style="width:44px; height:44px; min-width:44px; border-radius:12px; background:${bgGlow}; border:1px solid ${borderGlow}; color:${color}; display:inline-flex; align-items:center; justify-content:center; font-size:22px;">${(typeof renderIconGlyph === 'function') ? renderIconGlyph(iconClass) : (String(iconClass).startsWith('fa-') ? `<i class="${iconClass}"></i>` : `<span>${iconClass}</span>`)}</div>`;
  }

  if (previewName && nameInput) {
    const val = nameInput.value.trim();
    previewName.textContent = val || ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_name_placeholder']) || (state.lang === 'el' ? 'Όνομα κατηγορίας' : 'Category name'));
  }

  if (previewType) {
    const label = newCategoryDialogType === 'income'
      ? ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_preview_type_income']) || (state.lang === 'el' ? 'Κατηγορία Εσόδου' : 'Income Category'))
      : ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['new_category_preview_type_expense']) || (state.lang === 'el' ? 'Κατηγορία Εξόδου' : 'Expense Category'));
    previewType.textContent = editingCategoryName
      ? ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['btn_edit']) || (state.lang === 'el' ? 'Επεξεργασία' : 'Editing'))
      : label;
  }
}

function renderEditCategorySubcategories(categoryName) {
  const section = document.getElementById('edit-cat-subcategories-section');
  if (!section) return;

  if (!categoryName) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'flex';
  section.innerHTML = '';

  const lang = state.lang || 'el';
  const stats = (typeof getSubcategoriesStatsForCategory === 'function')
    ? getSubcategoriesStatsForCategory(categoryName)
    : {};
  const subcatKeys = Object.keys(stats);

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; justify-content:space-between;';
  header.innerHTML = `
    <label style="font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">
      ${lang === 'el' ? 'Υποκατηγορίες' : 'Subcategories'}
      <span style="color:var(--accent); font-weight:800; margin-left:4px;">${subcatKeys.length > 0 ? `(${subcatKeys.length})` : ''}</span>
    </label>
  `;
  section.appendChild(header);

  if (subcatKeys.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:12.5px; color:var(--text-muted); padding:16px 12px; text-align:center; line-height:1.5; background:rgba(0,0,0,0.1); border:1px solid rgba(255,255,255,0.04); border-radius:10px;';
    empty.innerHTML = lang === 'el'
      ? 'Δεν υπάρχουν ακόμη υποκατηγορίες.<br><span style="font-size:11px; opacity:0.8;">Οι υποκατηγορίες δημιουργούνται αυτόματα όταν καταχωρείς συναλλαγές.</span>'
      : 'No subcategories yet.<br><span style="font-size:11px; opacity:0.8;">Subcategories are created automatically when you record transactions.</span>';
    section.appendChild(empty);
    return;
  }

  const sortedSubs = subcatKeys.sort((a, b) => {
    const diff = stats[b].count - stats[a].count;
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });

  sortedSubs.forEach(sub => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); border-radius:10px; font-size:13px; color:var(--text-secondary); transition: background 0.2s;';

    const count = stats[sub].count;
    const lastUsed = stats[sub].lastUsedDate;
    let lastUsedStr = '';
    if (lastUsed) {
      const parts = lastUsed.split('-');
      if (parts.length === 3) {
        lastUsedStr = lang === 'el'
          ? ` • Τελ. χρήση: ${parts[2]}/${parts[1]}/${parts[0]}`
          : ` • Last used: ${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    const txLabel = lang === 'el'
      ? (count === 1 ? 'συναλλαγή' : 'συναλλαγές')
      : (count === 1 ? 'transaction' : 'transactions');

    item.innerHTML = `
      <div style="display:flex; flex-direction:column; flex:1; overflow:hidden; margin-right:8px;">
        <span style="font-weight:600; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${sub}</span>
        <span style="font-size:11px; color:var(--text-muted); margin-top:2px;">${count} ${txLabel}${lastUsedStr}</span>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <button type="button" class="icon-btn edit-sub-btn" style="color:var(--text-muted); cursor:pointer; font-size:12.5px; background:none; border:none; padding:6px; transition:color 0.2s;"><i class="fa-solid fa-pen"></i></button>
        <button type="button" class="icon-btn delete-sub-btn" style="color:var(--red-negative, #ff4a4a); cursor:pointer; font-size:12.5px; background:none; border:none; padding:6px; transition:color 0.2s;"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `;

    item.querySelector('.edit-sub-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; flex:1; margin-right:8px;">
          <input type="text" class="rename-sub-input" value="${sub}" style="flex:1; padding:6px 10px; font-size:13px; border-radius:8px; background:rgba(0,0,0,0.35); border:1px solid var(--accent, #7c6af7); color:var(--text-primary); outline:none; font-family:'Outfit',sans-serif;">
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button type="button" class="icon-btn save-rename-btn" style="color:var(--accent, #7c6af7); cursor:pointer; font-size:13px; background:none; border:none; padding:6px;"><i class="fa-solid fa-check"></i></button>
          <button type="button" class="icon-btn cancel-rename-btn" style="color:var(--text-muted); cursor:pointer; font-size:13px; background:none; border:none; padding:6px;"><i class="fa-solid fa-xmark"></i></button>
        </div>
      `;

      const input = item.querySelector('.rename-sub-input');
      if (input) {
        input.focus();
        input.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter') {
            evt.preventDefault();
            item.querySelector('.save-rename-btn').click();
          }
        });
      }

      item.querySelector('.save-rename-btn').addEventListener('click', async (evt) => {
        evt.stopPropagation();
        const newName = input.value.trim();
        if (newName === '') {
          showSyncToast(lang === 'el' ? '⚠️ Το όνομα δεν μπορεί να είναι κενό!' : '⚠️ Name cannot be empty!', 2500);
          return;
        }
        if (/^[ \-_\.\*]+$/.test(newName)) {
          showSyncToast(lang === 'el' ? '⚠️ Μη έγκυρο όνομα υποκατηγορίας!' : '⚠️ Invalid subcategory name!', 2500);
          return;
        }
        if (newName === sub) {
          renderEditCategorySubcategories(categoryName);
          return;
        }
        if (stats[newName]) {
          const confirmTitle = lang === 'el' ? 'Συγχώνευση Υποκατηγοριών' : 'Merge Subcategories';
          const confirmMsg = lang === 'el'
            ? `Η υποκατηγορία "${newName}" υπάρχει ήδη. Θέλετε να συγχωνεύσετε όλες τις συναλλαγές της "${sub}" στην "${newName}";`
            : `Subcategory "${newName}" already exists. Do you want to merge all transactions from "${sub}" into "${newName}"?`;
          const confirmed = await showConfirm(confirmMsg, confirmTitle, '🔀');
          if (!confirmed) return;
        }
        await renameSubcategoryGlobally(categoryName, sub, newName);
        renderEditCategorySubcategories(categoryName);
      });

      item.querySelector('.cancel-rename-btn').addEventListener('click', (evt) => {
        evt.stopPropagation();
        renderEditCategorySubcategories(categoryName);
      });
    });

    item.querySelector('.delete-sub-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmTitle = lang === 'el' ? 'Διαγραφή Υποκατηγορίας' : 'Delete Subcategory';
      const confirmMsg = lang === 'el'
        ? `Είστε σίγουροι ότι θέλετε να διαγράψετε την υποκατηγορία "${sub}";\nΘα αφαιρεθεί από όλες τις συναλλαγές.`
        : `Are you sure you want to delete subcategory "${sub}"?\nIt will be removed from all transactions.`;
      const confirmed = await showConfirm(confirmMsg, confirmTitle, '🗑️');
      if (confirmed) {
        await deleteSubcategoryGlobally(categoryName, sub);
        renderEditCategorySubcategories(categoryName);
      }
    });

    section.appendChild(item);
  });
}

function saveNewCategoryFromPicker() {
  const nameInput = document.getElementById('new-cat-name-input');
  const name = nameInput ? nameInput.value.trim() : '';

  if (!name) {
    window.showAlert(TRANSLATIONS[state.lang]['alert_enter_category_name']);
    return;
  }

  // === EDIT MODE: Update existing category ===
  if (editingCategoryName) {
    const cat = state.categories.find(c => c.name === editingCategoryName);
    if (!cat) {
      closeNewCategoryDialog();
      return;
    }

    const oldName = cat.name;
    const currentDisplayName = getCategoryDisplayName(oldName);
    const nameChanged = name !== currentDisplayName;
    const iconChanged = newCategorySelectedIcon !== cat.icon;
    const colorChanged = newCategorySelectedColor !== cat.color;

    if (!nameChanged && !iconChanged && !colorChanged) {
      closeNewCategoryDialog();
      return;
    }

    // Check for name collision with another category (only if name changed)
    if (nameChanged) {
      const collision = state.categories.find(c => c.name !== oldName && getCategoryDisplayName(c.name).toLowerCase() === name.toLowerCase() && c.type === cat.type);
      if (collision) {
        window.showAlert(state.lang === 'el' ? 'Υπάρχει ήδη κατηγορία με αυτό το όνομα!' : 'A category with this name already exists!');
        return;
      }
    }

    const now = new Date().toISOString();
    cat.name = name;
    cat.icon = newCategorySelectedIcon;
    cat.color = newCategorySelectedColor;
    cat.updated_at = now;

    // Update transactions using old name
    let transactionsUpdated = 0;
    if (nameChanged) {
      state.transactions.forEach(t => {
        if (t.category === oldName) {
          t.category = name;
          transactionsUpdated++;
        }
      });
      if (transactionsUpdated > 0) {
        localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
      }
    }

    saveCategoriesToStorage();

    // Cloud sync
    if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
      try {
        if (nameChanged) {
          // Update category name
          state.supabaseClient.from('categories').update({
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            hidden: !!cat.hidden,
            updated_at: now
          }).eq('id', cat.id)
            .then(({ error }) => { if (error) console.warn('Cloud category rename warning:', error); });
            
          if (transactionsUpdated > 0) {
             let query = state.supabaseClient.from('transactions').update({ category: name }).eq('category', oldName);
             if (state.userProfile && state.userProfile.family_id) {
               query = query.eq('family_id', state.userProfile.family_id);
             } else {
               query = query.eq('user_id', state.currentUser.id);
             }
             query.then(({ error }) => { if (error) console.warn('Cloud transactions rename warning:', error); });
          }
        } else {
          // Only icon / color / details changed
          state.supabaseClient.from('categories').update({
            icon: cat.icon,
            color: cat.color,
            hidden: !!cat.hidden,
            updated_at: now
          }).eq('id', cat.id)
            .then(({ error }) => { if (error) console.warn('Cloud category update warning:', error); });
        }
      } catch (e) {
        console.warn('Cloud category edit sync failed:', e);
      }
    }

    closeNewCategoryDialog();
    updateCategoryDropdowns(newCategoryDialogType, true);
    if (typeof renderCategoryManagerList === 'function') {
      renderCategoryManagerList();
    }
    updateUI();
    showSyncToast(state.lang === 'el' ? '✓ Κατηγορία ενημερώθηκε' : '✓ Category updated', 2000);
    return;
  }

  // === CREATE MODE: New category ===
  // Check for duplicate
  const exists = state.categories.find(c =>
    c.name && c.name.toUpperCase() === name.toUpperCase()
  );
  if (exists) {
    window.showAlert(TRANSLATIONS[state.lang]['alert_category_exists']);
    return;
  }

  // Create new category
  const now = new Date().toISOString();
  const newCategory = {
    id: typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID(),
    name: name,
    type: newCategoryDialogType,
    icon: newCategorySelectedIcon,
    color: newCategorySelectedColor,
    user_id: state.currentUser ? state.currentUser.id : null,
    family_id: state.userProfile ? state.userProfile.family_id : null,
    created_at: now,
    updated_at: now
  };

  state.categories.push(newCategory);
  saveCategoriesToStorage();

  // Sync to cloud if enabled
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      state.supabaseClient
        .from('categories')
        .insert({
          id: newCategory.id,
          user_id: state.currentUser.id,
          family_id: state.userProfile ? state.userProfile.family_id : null,
          name: newCategory.name,
          type: newCategory.type,
          icon: newCategory.icon,
          color: newCategory.color,
          created_at: newCategory.created_at,
          updated_at: newCategory.updated_at
        })
        .then(({ error }) => {
          if (error) console.warn('Cloud category insert warning:', error);
        });
    } catch (e) {
      console.warn('Cloud category insert catch:', e);
    }
  }

  // Close dialog
  closeNewCategoryDialog();

  // Refresh grid
  updateCategoryDropdowns(newCategoryDialogType);
  if (typeof renderCategoryManagerList === 'function') {
    renderCategoryManagerList();
  }

  // Auto-select the new category
  document.getElementById('trans-category').value = newCategory.name;
  document.querySelectorAll('.category-picker-item').forEach(item => {
    item.classList.remove('selected');
    if (item.getAttribute('data-category-name') === newCategory.name) {
      item.classList.add('selected');
    }
  });

  updateCategoryDisplay();
  updateSubcategorySuggestions();
  updateSubcategoryRowVisibility();

  // Close the category picker modal
  closeModal('category-picker-modal');
}

function openSubcategoryModal() {
  if (window.autocompleteJustSelected) return;
  const form = document.getElementById('transaction-form');
  if (form && form.getAttribute('data-readonly') === 'true') return;
  if (!document.getElementById('trans-category').value) {
    window.showAlert(TRANSLATIONS[state.lang]['alert_select_category_first']);
    return;
  }
  updateSubcategorySuggestions();
  openModal('subcategory-picker-modal');
}

  // Window Bindings
  window.updateCategoryDisplay = updateCategoryDisplay;
  window.updateSubcategoryRowVisibility = updateSubcategoryRowVisibility;
  window.setTransactionFormType = setTransactionFormType;
  window.toggleCategoryPickerEditMode = toggleCategoryPickerEditMode;
  window.inlineDeleteCustomCategory = inlineDeleteCustomCategory;
  window.inlineRenameCategory = inlineRenameCategory;
  window.getCustomCategoryOrder = getCustomCategoryOrder;
  window.setCustomCategoryOrder = setCustomCategoryOrder;
  window.getCustomSubcategoryOrder = getCustomSubcategoryOrder;
  window.setCustomSubcategoryOrder = setCustomSubcategoryOrder;
  window.updateCategoryDropdowns = updateCategoryDropdowns;
  window.selectCategory = selectCategory;
  window.selectSubcategory = selectSubcategory;
  window.openCategoryModal = openCategoryModal;
  window.openEditCategoryDialog = openEditCategoryDialog;
  window.openNewCategoryDialog = openNewCategoryDialog;
  window.closeNewCategoryDialog = closeNewCategoryDialog;
  window.renderCategoryIconDialog = renderCategoryIconDialog;
  window.handleCategoryIconSearch = handleCategoryIconSearch;
  window.updateNewCategoryLivePreview = updateNewCategoryLivePreview;
  window.renderEditCategorySubcategories = renderEditCategorySubcategories;
  window.saveNewCategoryFromPicker = saveNewCategoryFromPicker;
  window.openSubcategoryModal = openSubcategoryModal;

  return {
    updateCategoryDisplay: updateCategoryDisplay,
    updateSubcategoryRowVisibility: updateSubcategoryRowVisibility,
    setTransactionFormType: setTransactionFormType,
    toggleCategoryPickerEditMode: toggleCategoryPickerEditMode,
    inlineDeleteCustomCategory: inlineDeleteCustomCategory,
    inlineRenameCategory: inlineRenameCategory,
    getCustomCategoryOrder: getCustomCategoryOrder,
    setCustomCategoryOrder: setCustomCategoryOrder,
    getCustomSubcategoryOrder: getCustomSubcategoryOrder,
    setCustomSubcategoryOrder: setCustomSubcategoryOrder,
    updateCategoryDropdowns: updateCategoryDropdowns,
    selectCategory: selectCategory,
    selectSubcategory: selectSubcategory,
    openCategoryModal: openCategoryModal,
    openEditCategoryDialog: openEditCategoryDialog,
    openNewCategoryDialog: openNewCategoryDialog,
    closeNewCategoryDialog: closeNewCategoryDialog,
    renderCategoryIconDialog: renderCategoryIconDialog,
    handleCategoryIconSearch: handleCategoryIconSearch,
    updateNewCategoryLivePreview: updateNewCategoryLivePreview,
    renderEditCategorySubcategories: renderEditCategorySubcategories,
    saveNewCategoryFromPicker: saveNewCategoryFromPicker,
    openSubcategoryModal: openSubcategoryModal
  };
}));
