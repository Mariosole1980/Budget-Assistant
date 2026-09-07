/**
 * ============================================================
 * SUBCATEGORY SUGGESTIONS & SELECTION UI SERVICE
 * ------------------------------------------------------------
 * Handles subcategory suggestions picker, dynamic Sortable order,
 * and custom subcategory input visibility.
 *
 * Extracted from app.js (Phase 27C Architectural Modularization)
 * ============================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SubcategorySuggestionService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getState() {
    return (typeof window !== 'undefined' && window.state) ? window.state : { lang: 'el' };
  }

  function getTranslations() {
    return (typeof window !== 'undefined' && window.TRANSLATIONS) ? window.TRANSLATIONS : {};
  }

  function updateSubcategorySuggestions() {
    if (typeof document === 'undefined') return;
    const categoryHidden = document.getElementById('trans-category');
    const subcatList = document.getElementById('subcategory-picker-list');
    if (!categoryHidden || !subcatList) return;

    const category = categoryHidden.value;
    subcatList.innerHTML = '';

    const subSelectEl = document.getElementById('trans-subcategory-select');
    const currentSubcategory = subSelectEl ? subSelectEl.value : '';
    const state = getState();
    const translations = getTranslations();
    const langDict = translations[state.lang] || {};

    if (!category) {
      subcatList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">' +
        (langDict['select_category_first'] || 'Επιλέξτε πρώτα κατηγορία') + '</div>';
      return;
    }

    const sortedSubs = (typeof window !== 'undefined' && typeof window.getSortedSubcategoriesForCategory === 'function')
      ? window.getSortedSubcategoriesForCategory(category)
      : [];

    // Add "No subcategory" option at the top
    const noneOpt = document.createElement('div');
    noneOpt.className = 'subcategory-item none-subcat';
    if (currentSubcategory === '') noneOpt.classList.add('selected');
    noneOpt.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-ban" style="color:var(--text-muted);font-size:12px;"></i> <span style="font-weight: 500; color: var(--text-secondary);">' +
      (state.lang === 'en' ? 'No subcategory' : 'Χωρίς υποκατηγορία') + '</span></div>';
    noneOpt.onclick = () => {
      if (typeof window !== 'undefined' && typeof window.selectSubcategory === 'function') {
        window.selectSubcategory('');
      }
    };
    subcatList.appendChild(noneOpt);

    sortedSubs.forEach(sub => {
      const div = document.createElement('div');
      div.className = 'subcategory-item';
      div.setAttribute('data-subcat-name', sub);
      if (sub === currentSubcategory) div.classList.add('selected');
      const dispName = (typeof window !== 'undefined' && typeof window.getSubcategoryDisplayName === 'function')
        ? window.getSubcategoryDisplayName(sub, category)
        : sub;
      div.innerHTML = '<span>' + dispName + '</span>';
      div.onclick = () => {
        if (typeof window !== 'undefined' && typeof window.selectSubcategory === 'function') {
          window.selectSubcategory(sub);
        }
      };
      subcatList.appendChild(div);
    });

    const newOpt = document.createElement('div');
    newOpt.className = 'subcategory-item new-subcat';
    newOpt.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-plus"></i> <span>' +
      (langDict['option_new_subcategory'] || 'Νέα υποκατηγορία...') + '</span></div>';
    newOpt.onclick = () => {
      if (typeof window !== 'undefined' && typeof window.closeModal === 'function') {
        window.closeModal('subcategory-picker-modal');
      }
      showSubcategorySelect();
    };
    subcatList.appendChild(newOpt);

    if (typeof window !== 'undefined' && window.Sortable) {
      if (subcatList._sortable && typeof subcatList._sortable.destroy === 'function') {
        subcatList._sortable.destroy();
      }
      subcatList._sortable = window.Sortable.create(subcatList, {
        animation: 150, delay: 250, delayOnTouchOnly: true, filter: '.none-subcat, .new-subcat',
        onEnd: function () {
          const newOrder = Array.from(subcatList.children)
            .map(el => el.getAttribute && el.getAttribute('data-subcat-name'))
            .filter(Boolean);
          if (typeof window.setCustomSubcategoryOrder === 'function') {
            window.setCustomSubcategoryOrder(category, newOrder);
          }
        }
      });
    }
  }

  function showSubcategorySelect() {
    if (typeof document === 'undefined') return;
    const trigger = document.getElementById('trans-subcategory-trigger');
    const custom = document.getElementById('trans-subcategory-custom');
    const cancelBtn = document.getElementById('btn-cancel-custom-sub');

    if (trigger && custom && cancelBtn) {
      trigger.style.display = 'none';
      custom.style.display = 'block';
      cancelBtn.style.display = 'block';
      const subSelect = document.getElementById('trans-subcategory-select');
      if (subSelect) subSelect.value = '__NEW__';
      if (typeof window !== 'undefined' && typeof window.updateSubcategoryRowVisibility === 'function') {
        window.updateSubcategoryRowVisibility();
      }
      if (typeof custom.focus === 'function') {
        custom.focus();
      }
    }
  }

  function hideSubcategorySelect() {
    if (typeof document === 'undefined') return;
    const trigger = document.getElementById('trans-subcategory-trigger');
    const custom = document.getElementById('trans-subcategory-custom');
    const cancelBtn = document.getElementById('btn-cancel-custom-sub');

    if (trigger && custom && cancelBtn) {
      trigger.style.display = 'flex';
      custom.style.display = 'none';
      cancelBtn.style.display = 'none';

      custom.value = '';
      const subSelect = document.getElementById('trans-subcategory-select');
      if (subSelect) subSelect.value = '';
      const displayEl = document.getElementById('trans-subcategory-display');
      if (displayEl) {
        displayEl.innerHTML = '<span class="custom-select-placeholder" data-i18n="placeholder_subcategory">Πατήστε για επιλογή</span>';
      }
      if (typeof window !== 'undefined' && typeof window.updateSubcategoryRowVisibility === 'function') {
        window.updateSubcategoryRowVisibility();
      }
    }
  }

  return {
    updateSubcategorySuggestions,
    showSubcategorySelect,
    hideSubcategorySelect
  };
}));
