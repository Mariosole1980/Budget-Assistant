// ============================================================
// CATEGORY & SUBCATEGORY SETTINGS MANAGER
// Autonomous UMD Module (Phase 11D Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CategoryManager = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

function openSettingsCategoryManager() {
  window._categoryManagerType = 'expense';
  try {
    closeNewCategoryDialog();
  } catch (e) { }
  try {
    renderCategoryManagerList();
  } catch (err) {
    console.error('Error rendering category manager:', err);
  }
  openModal('category-manager-modal');
}

function setCategoryManagerType(type) {
  window._categoryManagerType = type;
  try {
    renderCategoryManagerList();
  } catch (err) {
    console.error('Error rendering category manager:', err);
  }
}

function renderCategoryManagerList() {
  const container = document.getElementById('category-manager-list');
  if (!container) return;

  container.innerHTML = '';
  const type = window._categoryManagerType || 'expense';

  const expenseTab = document.getElementById('cat-mgr-tab-expense');
  const incomeTab = document.getElementById('cat-mgr-tab-income');
  const addCatBtn = document.querySelector('#category-manager-modal .btn-primary');
  const isIncome = type === 'income';

  if (expenseTab && incomeTab) {
    if (isIncome) {
      incomeTab.style.background = 'var(--blue-positive, #4ade80)';
      incomeTab.style.color = '#064e3b';
      incomeTab.style.fontWeight = '800';
      expenseTab.style.background = 'transparent';
      expenseTab.style.color = 'var(--text-secondary)';
      expenseTab.style.fontWeight = '700';
      if (addCatBtn) {
        addCatBtn.style.background = 'var(--blue-positive, #4ade80)';
        addCatBtn.style.color = '#064e3b';
        addCatBtn.style.fontWeight = '700';
      }
    } else {
      expenseTab.style.background = 'var(--red-negative, #e05e55)';
      expenseTab.style.color = 'white';
      expenseTab.style.fontWeight = '800';
      incomeTab.style.background = 'transparent';
      incomeTab.style.color = 'var(--text-secondary)';
      incomeTab.style.fontWeight = '700';
      if (addCatBtn) {
        addCatBtn.style.background = 'var(--red-negative, #e05e55)';
        addCatBtn.style.color = 'white';
        addCatBtn.style.fontWeight = '700';
      }
    }
  }

  const list = (state.categories || []).filter(c => c && (c.type === type || (type === 'expense' && !c.type)));

    const lang = state.lang || 'el';
  const customOrder = getCustomCategoryOrder(type);
  list.sort((a, b) => {
    const rawA = typeof a === 'string' ? a : (a ? a.name : '');
    const rawB = typeof b === 'string' ? b : (b ? b.name : '');
    const idxA = customOrder.indexOf(rawA);
    const idxB = customOrder.indexOf(rawB);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    const nameA = getCategoryDisplayName(rawA) || '';
    const nameB = getCategoryDisplayName(rawB) || '';
    return nameA.localeCompare(nameB, lang === 'el' ? 'el' : 'en', { sensitivity: 'base' });
  });

  const countLabel = document.getElementById('cat-mgr-count-label');
  if (countLabel) {
    countLabel.textContent = lang === 'el'
      ? `Σύνολο: ${list.length} κατηγορίες`
      : `Total: ${list.length} categories`;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 14px; font-style: italic;">
        ${lang === 'el' ? 'Δεν βρέθηκαν κατηγορίες.' : 'No categories found.'}
      </div>
    `;
    return;
  }

  list.forEach((c, idx) => {
    const rawName = typeof c === 'string' ? c : (c && c.name ? String(c.name) : `Category ${idx + 1}`);
    const safeId = rawName.replace(/\s+/g, '-');
    const displayName = getCategoryDisplayName(rawName);
    const subCount = getSortedSubcategoriesForCategory(rawName).length;

    const catBadgeHtml = (typeof renderCategoryIconHtml === 'function')
      ? renderCategoryIconHtml(c, { size: 'sm', transType: type })
      : `<span style="font-size: 16px;">📁</span>`;

    const card = document.createElement('div');
    card.style.cssText = 'background: var(--card-bg2, rgba(255,255,255,0.02)); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;';

    const header = document.createElement('div');
    header.className = 'category-mgr-header';
    header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; cursor: pointer; transition: background 0.2s;';
    card.setAttribute('data-category-name', rawName);
    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
        <i class="fa-solid fa-grip-lines drag-handle" style="color: var(--text-muted); cursor: grab; padding: 4px; font-size: 14px;"></i>
        ${catBadgeHtml}
        <span style="font-weight: 600; font-size: 14px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayName}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;" class="category-mgr-actions">
        <span style="font-size: 11px; color: var(--text-muted); background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 20px; font-weight:600; flex-shrink:0;">
          ${subCount} ${lang === 'el' ? 'υποκ.' : 'subcats'}
        </span>
        <button type="button" class="btn-edit-cat icon-btn" style="font-size: 13px; color: var(--text-secondary); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: none; background: transparent; cursor: pointer;" title="${lang === 'el' ? 'Επεξεργασία' : 'Edit'}">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button type="button" class="btn-delete-cat icon-btn" style="font-size: 13px; color: var(--red-negative); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: none; background: transparent; cursor: pointer;" title="${lang === 'el' ? 'Διαγραφή' : 'Delete'}">
          <i class="fa-solid fa-trash-can"></i>
        </button>
        <i class="fa-solid fa-chevron-down category-mgr-chevron" id="chevron-${safeId}" style="font-size: 12px; color: var(--text-muted); margin-left: 4px; transition: transform 0.2s; padding: 4px;"></i>
      </div>
    `;

    const details = document.createElement('div');
    details.className = 'category-mgr-details';
    details.id = `details-${safeId}`;
    details.style.cssText = 'display: none; border-top: 1px solid var(--border); padding: 12px; background: rgba(0, 0, 0, 0.08); flex-direction: column; gap: 8px;';

    // Programmatic click handler for accordion expand
    header.addEventListener('click', () => {
      toggleCategoryManagerAccordion(rawName);
    });

    // Stop propagation so clicking actions does not toggle accordion
    const actionsContainer = header.querySelector('.category-mgr-actions');
    if (actionsContainer) {
      actionsContainer.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    const btnEdit = header.querySelector('.btn-edit-cat');
    if (btnEdit) {
      btnEdit.addEventListener('click', () => {
        openEditCategoryDialog(rawName, type);
      });
    }

    const btnDelete = header.querySelector('.btn-delete-cat');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        deleteCategoryFromManager(rawName);
      });
    }

    // Make the chevron clickable to toggle the accordion (in addition to clicking the category name)
    const chevron = header.querySelector('.category-mgr-chevron');
    if (chevron) {
      chevron.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCategoryManagerAccordion(rawName);
      });
    }

        card.appendChild(header);
    card.appendChild(details);
    container.appendChild(card);
  });
  if (window.Sortable) {
    if (container._sortable) { container._sortable.destroy(); }
    container._sortable = Sortable.create(container, {
      animation: 150, handle: '.drag-handle',
      onEnd: function (evt) {
        const newOrder = Array.from(container.children).map(el => el.getAttribute('data-category-name')).filter(Boolean);
        setCustomCategoryOrder(type, newOrder);
      }
    });
  }
}

function toggleCategoryManagerAccordion(categoryName) {
  const safeId = categoryName.replace(/\s+/g, '-');
  const details = document.getElementById(`details-${safeId}`);
  const chevron = document.getElementById(`chevron-${safeId}`);
  if (!details) return;

  const isExpanded = details.style.display === 'flex';
  if (isExpanded) {
    details.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  } else {
    document.querySelectorAll('.category-mgr-details').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.category-mgr-chevron').forEach(el => el.style.transform = 'rotate(0deg)');

    details.style.display = 'flex';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
    renderCategoryManagerSubcategories(categoryName);
  }
}

function renderCategoryManagerSubcategories(categoryName) {
  const safeId = categoryName.replace(/\s+/g, '-');
  const container = document.getElementById(`details-${safeId}`);
  if (!container) return;

  const subcats = getSortedSubcategoriesForCategory(categoryName);
  container.innerHTML = '';

  const subcatTitle = document.createElement('div');
  subcatTitle.style = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px;';
  subcatTitle.textContent = state.lang === 'el' ? 'Λίστα Υποκατηγοριών' : 'Subcategories List';
  container.appendChild(subcatTitle);

  if (subcats.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.style = 'font-size: 13px; color: var(--text-muted); padding: 8px 0; font-style: italic;';
    emptyState.textContent = state.lang === 'el' ? 'Δεν υπάρχουν υποκατηγορίες.' : 'No subcategories yet.';
    container.appendChild(emptyState);
  } else {
    const listEl = document.createElement('div');
    listEl.style = 'display: flex; flex-direction: column; gap: 8px;';

    // Call getSubcategoriesStatsForCategory ONCE before the loop to optimize performance
    const stats = getSubcategoriesStatsForCategory(categoryName);

    subcats.forEach(sub => {
      const item = document.createElement('div');
      item.style = 'display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px;';

      const subStat = stats[sub] || { count: 0, lastUsedDate: '' };

      let usageText = '';
      if (subStat.count > 0) {
        let dateStr = '';
        if (subStat.lastUsedDate) {
          const parts = subStat.lastUsedDate.split('-');
          if (parts.length === 3) {
            dateStr = `${parts[2]}.${parts[1]}.${parts[0].slice(-2)}`;
          } else {
            dateStr = subStat.lastUsedDate;
          }
        }

        usageText = state.lang === 'el'
          ? `${subStat.count} συν. • Τελ: ${dateStr}`
          : `${subStat.count} txs • Last: ${dateStr}`;
      } else {
        usageText = state.lang === 'el' ? 'Μη χρησιμοποιούμενη' : 'Unused';
      }

      item.setAttribute('data-subcat-name', sub);
      const normalView = document.createElement('div');
      normalView.style = 'display: flex; align-items: center; justify-content: space-between; width: 100%;';
      normalView.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-grip-lines drag-handle-sub" style="color: var(--text-muted); cursor: grab; padding: 4px; font-size: 14px;"></i>
          <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-weight: 500; font-size: 14px; color: var(--text-primary);">${sub}</span>
          <span style="font-size: 11px; color: var(--text-muted);">${usageText}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button class="icon-btn" style="font-size: 12px; color: var(--text-secondary); padding: 6px; border-radius: 4px;" title="Rename">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="icon-btn" style="font-size: 12px; color: var(--red-negative); padding: 6px; border-radius: 4px;" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;

      const editView = document.createElement('div');
      editView.style = 'display: none; align-items: center; gap: 8px; width: 100%;';
      editView.innerHTML = `
        <input type="text" class="form-input" value="${sub}" style="flex: 1; padding: 6px 10px; font-size: 13px; border-radius: 6px; border: 1px solid var(--accent); background: var(--bg-main); color: var(--text-primary);">
        <button class="btn btn-primary" style="padding: 6px 10px; font-size: 12px; border-radius: 6px;"><i class="fa-solid fa-check"></i></button>
        <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 12px; border-radius: 6px;"><i class="fa-solid fa-xmark"></i></button>
      `;

      const editBtn = normalView.querySelector('button[title="Rename"]');
      const deleteBtn = normalView.querySelector('button[title="Delete"]');
      const saveEditBtn = editView.querySelector('.btn-primary');
      const cancelEditBtn = editView.querySelector('.btn-secondary');
      const editInput = editView.querySelector('input');

      editBtn.onclick = () => {
        normalView.style.display = 'none';
        editView.style.display = 'flex';
        editInput.focus();
      };

      cancelEditBtn.onclick = () => {
        editView.style.display = 'none';
        normalView.style.display = 'flex';
        editInput.value = sub;
      };

      saveEditBtn.onclick = async () => {
        const newVal = editInput.value.trim();
        if (!newVal || newVal === sub) {
          cancelEditBtn.click();
          return;
        }
        await handleCategoryManagerSubcategoryRename(categoryName, sub, newVal);
        renderCategoryManagerSubcategories(categoryName);
      };

      deleteBtn.onclick = async () => {
        const confirmMsg = state.lang === 'el'
          ? `Θέλετε σίγουρα να διαγράψετε την υποκατηγορία "${sub}";`
          : `Are you sure you want to delete subcategory "${sub}"?`;

        const confirmed = await showConfirm(confirmMsg, state.lang === 'el' ? 'Διαγραφή Υποκατηγορίας' : 'Delete Subcategory', '🗑️');
        if (confirmed) {
          await deleteSubcategoryGlobally(categoryName, sub);
          renderCategoryManagerSubcategories(categoryName);
        }
      };

            item.appendChild(normalView);
      item.appendChild(editView);
      listEl.appendChild(item);
    });

    container.appendChild(listEl);
    if (window.Sortable) {
      if (listEl._sortable) { listEl._sortable.destroy(); }
      listEl._sortable = Sortable.create(listEl, {
        animation: 150, handle: '.drag-handle-sub',
        onEnd: function (evt) {
          const newOrder = Array.from(listEl.children).map(el => el.getAttribute('data-subcat-name')).filter(Boolean);
          setCustomSubcategoryOrder(categoryName, newOrder);
        }
      });
    }
  }

  const addForm = document.createElement('div');
  addForm.style = 'margin-top: 10px; border-top: 1px dashed var(--border); padding-top: 10px; display: flex; flex-direction: column; gap: 8px;';

  const addTrigger = document.createElement('button');
  addTrigger.type = 'button';
  addTrigger.className = 'btn btn-secondary';
  addTrigger.style = 'font-size: 13px; padding: 8px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px dashed var(--border); width: 100%; text-align: center; color: var(--text-primary); cursor: pointer;';
  addTrigger.innerHTML = `<i class="fa-solid fa-plus" style="font-size:12px; color:var(--accent);"></i> ${state.lang === 'el' ? 'Προσθήκη υποκατηγορίας' : 'Add subcategory'}`;

  const addInputContainer = document.createElement('div');
  addInputContainer.style = 'display: none; align-items: center; gap: 8px; width: 100%;';
  addInputContainer.innerHTML = `
    <input type="text" class="form-input" placeholder="${state.lang === 'el' ? 'Όνομα υποκατηγορίας...' : 'Subcategory name...'}" style="flex: 1; padding: 8px 12px; font-size: 13px; border-radius: 8px; background: var(--bg-main); color: var(--text-primary); border: 1px solid var(--border);">
    <button class="btn btn-primary" style="padding: 8px 14px; font-size: 13px; border-radius: 8px; font-weight: 600;">${state.lang === 'el' ? 'Προσθήκη' : 'Add'}</button>
    <button class="btn btn-secondary" style="padding: 8px 12px; font-size: 13px; border-radius: 8px;"><i class="fa-solid fa-xmark"></i></button>
  `;

  const addInput = addInputContainer.querySelector('input');
  const addSubmit = addInputContainer.querySelector('.btn-primary');
  const addCancel = addInputContainer.querySelector('.btn-secondary');

  addTrigger.onclick = () => {
    addTrigger.style.display = 'none';
    addInputContainer.style.display = 'flex';
    addInput.focus();
  };

  addCancel.onclick = () => {
    addInputContainer.style.display = 'none';
    addTrigger.style.display = 'flex';
    addInput.value = '';
  };

  addSubmit.onclick = async () => {
    const newVal = addInput.value.trim();
    if (!newVal) {
      addCancel.click();
      return;
    }
    await addSubcategoryToCategory(categoryName, newVal);
    renderCategoryManagerSubcategories(categoryName);
  };

  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addSubmit.click();
    }
  });

  addForm.appendChild(addTrigger);
  addForm.appendChild(addInputContainer);
  container.appendChild(addForm);
}

async function handleCategoryManagerSubcategoryRename(categoryName, oldSub, newSub) {
  const existingSubcats = getSortedSubcategoriesForCategory(categoryName);
  if (existingSubcats.includes(newSub)) {
    const confirmMsg = state.lang === 'el'
      ? `Η υποκατηγορία "${newSub}" υπάρχει ήδη. Θέλετε να συγχωνεύσετε την υποκατηγορία "${oldSub}" με την "${newSub}"; Όλες οι συναλλαγές θα ενημερωθούν.`
      : `Subcategory "${newSub}" already exists. Do you want to merge "${oldSub}" into "${newSub}"? All transactions will be updated.`;

    const confirmed = await showConfirm(confirmMsg, state.lang === 'el' ? 'Συγχώνευση Υποκατηγοριών' : 'Merge Subcategories', '🔄');
    if (!confirmed) return;
  }
  await renameSubcategoryGlobally(categoryName, oldSub, newSub);
}

function addSubcategoryToCategory(categoryName, subcatName) {
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

  const cleanSub = subcatName.trim();
  if (!cleanSub) return;

  const now = new Date().toISOString();
  if (!cat) {
    cat = {
      id: typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID(),
      name: categoryName,
      type: 'expense',
      subcategories: [cleanSub],
      deleted_subcategories: [],
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
    if (!cat.subcategories.some(s => s.toLowerCase() === cleanSub.toLowerCase())) {
      cat.subcategories.push(cleanSub);
    }
    if (Array.isArray(cat.deleted_subcategories)) {
      cat.deleted_subcategories = cat.deleted_subcategories.filter(s => s.toLowerCase() !== cleanSub.toLowerCase());
    }
  }

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
    }).then(() => { }, err => console.warn('Sync categories subcategories warning:', err));
  }
}

function openCategoryManagerAddDialog() {
  const type = window._categoryManagerType || 'expense';
  openNewCategoryDialog(type);
}

function openCategoryEditorModal(categoryName) {
  const cat = state.categories.find(c => c.name === categoryName);
  const type = cat ? cat.type : (window._categoryManagerType || 'expense');
  openEditCategoryDialog(categoryName, type);
}

async function deleteCategoryFromManager(categoryName) {
  const type = window._categoryManagerType || 'expense';
  await inlineDeleteCustomCategory(categoryName, type);
  renderCategoryManagerList();
}

window.openSettingsCategoryManager = openSettingsCategoryManager;
window.setCategoryManagerType = setCategoryManagerType;
window.toggleCategoryManagerAccordion = toggleCategoryManagerAccordion;
window.openCategoryManagerAddDialog = openCategoryManagerAddDialog;
window.openCategoryEditorModal = openCategoryEditorModal;
window.deleteCategoryFromManager = deleteCategoryFromManager;


  // UMD Exports & Window Binding
  window.openSettingsCategoryManager = openSettingsCategoryManager;
  window.setCategoryManagerType = setCategoryManagerType;
  window.renderCategoryManagerList = renderCategoryManagerList;
  window.toggleCategoryManagerAccordion = toggleCategoryManagerAccordion;
  window.renderCategoryManagerSubcategories = renderCategoryManagerSubcategories;
  window.handleCategoryManagerSubcategoryRename = handleCategoryManagerSubcategoryRename;
  window.addSubcategoryToCategory = addSubcategoryToCategory;
  window.openCategoryManagerAddDialog = openCategoryManagerAddDialog;
  window.openCategoryEditorModal = openCategoryEditorModal;
  window.deleteCategoryFromManager = deleteCategoryFromManager;

  return {
    openSettingsCategoryManager: openSettingsCategoryManager,
    setCategoryManagerType: setCategoryManagerType,
    renderCategoryManagerList: renderCategoryManagerList,
    toggleCategoryManagerAccordion: toggleCategoryManagerAccordion,
    renderCategoryManagerSubcategories: renderCategoryManagerSubcategories,
    handleCategoryManagerSubcategoryRename: handleCategoryManagerSubcategoryRename,
    addSubcategoryToCategory: addSubcategoryToCategory,
    openCategoryManagerAddDialog: openCategoryManagerAddDialog,
    openCategoryEditorModal: openCategoryEditorModal,
    deleteCategoryFromManager: deleteCategoryFromManager
  };
}));
