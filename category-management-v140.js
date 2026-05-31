/**
 * CATEGORY MANAGEMENT v140
 * In-place editing/deletion in category picker modal
 * No separate "Category Manager" in settings
 * v140+
 */

/**
 * Enhanced category picker with edit/delete capabilities
 * Adds edit icons and long-press support
 */
function setupCategoryPickerWithEditing(categoryPickerModal) {
  if (!categoryPickerModal) return;

  const categoryGrid = categoryPickerModal.querySelector('#category-picker-grid');
  if (!categoryGrid) return;

  // Add event delegation for edit/delete
  categoryGrid.addEventListener('contextmenu', (e) => {
    const categoryBox = e.target.closest('[data-category-item]');
    if (categoryBox) {
      e.preventDefault();
      handleCategoryContextMenu(categoryBox, e);
    }
  });

  // Long-press support for mobile
  let longPressTimer = null;
  categoryGrid.addEventListener('touchstart', (e) => {
    const categoryBox = e.target.closest('[data-category-item]');
    if (categoryBox) {
      longPressTimer = setTimeout(() => {
        handleCategoryLongPress(categoryBox, e);
      }, 500);
    }
  });

  categoryGrid.addEventListener('touchend', () => {
    clearTimeout(longPressTimer);
  });
}

/**
 * Handle right-click context menu on category item
 */
function handleCategoryContextMenu(categoryBox, event) {
  const categoryName = categoryBox.getAttribute('data-category-name');
  const categoryType = categoryBox.getAttribute('data-category-type') || 'expense';
  const userId = supabaseUser?.id;

  // Create context menu
  const menu = document.createElement('div');
  menu.style.cssText = `
    position: fixed;
    top: ${event.clientY}px;
    left: ${event.clientX}px;
    background: var(--bg-card, #222731);
    border: 1px solid var(--border, #2e3543);
    border-radius: 8px;
    padding: 8px 0;
    z-index: 10001;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  // Check if it's a custom category (not default)
  const isCustom = !isDefaultCategory(categoryName, categoryType);

  if (isCustom) {
    // Edit option
    const editBtn = document.createElement('div');
    editBtn.style.cssText = `
      padding: 10px 16px;
      cursor: pointer;
      color: var(--text-main, #e3e8f0);
      font-size: 14px;
      transition: background 0.2s;
    `;
    editBtn.textContent = state?.lang === 'en' ? 'Edit' : 'Επεξεργασία';
    editBtn.addEventListener('mouseenter', () => {
      editBtn.style.background = 'var(--border, #2e3543)';
    });
    editBtn.addEventListener('mouseleave', () => {
      editBtn.style.background = 'transparent';
    });
    editBtn.addEventListener('click', () => {
      editCategory(categoryName, categoryType, userId);
      menu.remove();
    });
    menu.appendChild(editBtn);

    // Delete option
    const deleteBtn = document.createElement('div');
    deleteBtn.style.cssText = `
      padding: 10px 16px;
      cursor: pointer;
      color: #e05e55;
      font-size: 14px;
      transition: background 0.2s;
    `;
    deleteBtn.textContent = state?.lang === 'en' ? 'Delete' : 'Διαγραφή';
    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.background = 'var(--border, #2e3543)';
    });
    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.background = 'transparent';
    });
    deleteBtn.addEventListener('click', () => {
      deleteCategory(categoryName, categoryType, userId);
      menu.remove();
    });
    menu.appendChild(deleteBtn);
  }

  document.body.appendChild(menu);

  // Close menu on click outside
  setTimeout(() => {
    document.addEventListener('click', () => {
      menu.remove();
    }, { once: true });
  }, 0);
}

/**
 * Handle long-press on category item (mobile)
 */
function handleCategoryLongPress(categoryBox, event) {
  // Same as context menu
  handleCategoryContextMenu(categoryBox, { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY });
}

/**
 * Check if category is a default one (not editable)
 */
function isDefaultCategory(categoryName, type) {
  const defaults = getDefaultCategories(type);
  return defaults.some(c => c.name === categoryName);
}

/**
 * Edit custom category (name)
 */
function editCategory(oldName, type, userId) {
  if (!userId) {
    alert(state?.lang === 'en' ? 'Please log in to edit categories' : 'Παρακαλώ συνδεθείτε για να επεξεργαστείτε κατηγορίες');
    return;
  }

  const newName = prompt(
    state?.lang === 'en' ? `Edit category "${oldName}":` : `Επεξεργασία κατηγορίας "${oldName}":`,
    oldName
  );

  if (!newName || newName === oldName) return;

  // Get custom categories
  const customCats = getUserCustomCategories(userId, type);
  const index = customCats.findIndex(c => c.name === oldName);

  if (index !== -1) {
    customCats[index].name = newName;
    saveUserCustomCategories(userId, type, customCats);
    console.log(`✅ Category renamed: ${oldName} → ${newName}`);

    // Refresh category picker
    refreshCategoryPicker(type);
  }
}

/**
 * Delete custom category
 */
function deleteCategory(categoryName, type, userId) {
  if (!userId) {
    alert(state?.lang === 'en' ? 'Please log in to delete categories' : 'Παρακαλώ συνδεθείτε για να διαγράψετε κατηγορίες');
    return;
  }

  const confirmed = confirm(
    state?.lang === 'en' ? `Delete category "${categoryName}"?` : `Διαγραφή κατηγορίας "${categoryName}";`
  );

  if (!confirmed) return;

  // Get custom categories
  const customCats = getUserCustomCategories(userId, type);
  const filtered = customCats.filter(c => c.name !== categoryName);

  saveUserCustomCategories(userId, type, filtered);
  console.log(`✅ Category deleted: ${categoryName}`);

  // Refresh category picker
  refreshCategoryPicker(type);
}

/**
 * Refresh category picker grid
 */
function refreshCategoryPicker(type) {
  const modal = document.getElementById('category-picker-modal');
  if (!modal) return;

  const grid = modal.querySelector('#category-picker-grid');
  if (!grid) return;

  // Re-render categories
  renderCategoryPickerGrid(grid, type);
}

/**
 * Render category picker grid
 */
function renderCategoryPickerGrid(gridElement, type) {
  if (!gridElement) return;

  const userId = supabaseUser?.id;
  const categories = userId 
    ? getCategoriesForUser(userId, type)
    : getDefaultCategories(type);

  gridElement.innerHTML = '';

  categories.forEach(cat => {
    const box = document.createElement('div');
    box.className = 'category-picker-item';
    box.setAttribute('data-category-item', 'true');
    box.setAttribute('data-category-name', cat.name);
    box.setAttribute('data-category-type', type);
    box.style.cssText = `
      padding: 12px;
      text-align: center;
      background: var(--bg-main, #181b22);
      border: 1px solid var(--border, #2e3543);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    `;

    box.innerHTML = `
      <div style="font-size: 28px; margin-bottom: 6px;">${cat.icon}</div>
      <div style="font-size: 12px; color: var(--text-main); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${cat.name}</div>
    `;

    box.addEventListener('click', () => {
      selectCategory(cat.name, cat.icon, cat.color, true);
      closeModal('category-picker-modal');
    });

    box.addEventListener('mouseenter', () => {
      box.style.background = 'var(--border, #2e3543)';
      box.style.borderColor = 'var(--accent, #e05e55)';
    });

    box.addEventListener('mouseleave', () => {
      box.style.background = 'var(--bg-main, #181b22)';
      box.style.borderColor = 'var(--border, #2e3543)';
    });

    gridElement.appendChild(box);
  });

  // Add new category button
  const addBtn = document.createElement('div');
  addBtn.className = 'category-add-btn';
  addBtn.style.cssText = `
    padding: 12px;
    text-align: center;
    background: var(--border-light, #384152);
    border: 2px dashed var(--border, #2e3543);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  `;
  addBtn.innerHTML = `<i class="fa-solid fa-plus" style="font-size: 24px; color: var(--accent);"></i>`;
  addBtn.addEventListener('click', () => openNewCategoryDialog(type));
  gridElement.appendChild(addBtn);
}
