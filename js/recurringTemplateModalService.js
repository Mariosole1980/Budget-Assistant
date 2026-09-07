/**
 * recurringTemplateModalService.js - Recurring Templates & Details Modal Service
 * Handles listing recurring templates, inspecting individual repetition history,
 * template renaming, editing recurrence schedules (calendar, presets, end date),
 * cascading transaction regeneration, and template deletion trigger.
 *
 * Extracted in Phase 29B Architectural Modularization
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RecurringTemplateModalService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let activeRecurringDetailsTemplateId = null;
  let activeRecurringEditTemplateId = null;
  let _recurringEditMonths = [];

  const GREEK_MONTHS_SHORT = (typeof I18nService !== 'undefined' && I18nService.GREEK_MONTHS_SHORT) ||
    (typeof window !== 'undefined' && window.GREEK_MONTHS_SHORT) ||
    ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαϊ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];

  const ENGLISH_MONTHS_SHORT = (typeof I18nService !== 'undefined' && I18nService.ENGLISH_MONTHS_SHORT) ||
    (typeof window !== 'undefined' && window.ENGLISH_MONTHS_SHORT) ||
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function getState() {
    if (typeof window !== 'undefined' && window.state) return window.state;
    if (typeof state !== 'undefined') return state;
    return { recurringTemplates: [], transactions: [], lang: 'el' };
  }

  function getTranslations() {
    if (typeof TRANSLATIONS !== 'undefined') return TRANSLATIONS;
    if (typeof window !== 'undefined' && window.TRANSLATIONS) return window.TRANSLATIONS;
    return { el: {}, en: {} };
  }

  function _safeCategoryInfo(category, type) {
    if (typeof getCategoryInfo === 'function') return getCategoryInfo(category, type);
    if (typeof window !== 'undefined' && typeof window.getCategoryInfo === 'function') {
      return window.getCategoryInfo(category, type);
    }
    return { icon: type === 'income' ? '🟢' : '🔴', color: '#78909c' };
  }

  function _safeCurrencySymbol() {
    if (typeof getCurrencySymbol === 'function') return getCurrencySymbol();
    if (typeof window !== 'undefined' && typeof window.getCurrencySymbol === 'function') {
      return window.getCurrencySymbol();
    }
    return '€';
  }

  function _safeFormatDisplayAmount(amount, currency) {
    if (typeof formatDisplayAmount === 'function') return formatDisplayAmount(amount, currency);
    if (typeof window !== 'undefined' && typeof window.formatDisplayAmount === 'function') {
      return window.formatDisplayAmount(amount, currency);
    }
    return parseFloat(amount || 0).toFixed(2);
  }

  function _safeEscapeHtml(str) {
    if (typeof escapeHtml === 'function') return escapeHtml(str);
    if (typeof window !== 'undefined' && typeof window.escapeHtml === 'function') {
      return window.escapeHtml(str);
    }
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }

  function _safeOpenModal(id) {
    if (typeof openModal === 'function') openModal(id);
    else if (typeof window !== 'undefined' && typeof window.openModal === 'function') {
      window.openModal(id);
    }
  }

  function _safeCloseModal(id) {
    if (typeof closeModal === 'function') closeModal(id);
    else if (typeof window !== 'undefined' && typeof window.closeModal === 'function') {
      window.closeModal(id);
    }
  }

  function _safeToast(msg, duration = 2500) {
    if (typeof showSyncToast === 'function') showSyncToast(msg, duration);
    else if (typeof window !== 'undefined' && typeof window.showSyncToast === 'function') {
      window.showSyncToast(msg, duration);
    }
  }

  function _safeMapTemplateToDb(template) {
    if (typeof mapTemplateToDb === 'function') return mapTemplateToDb(template);
    if (typeof window !== 'undefined' && typeof window.mapTemplateToDb === 'function') {
      return window.mapTemplateToDb(template);
    }
    return template;
  }

  function _safeNormalizeGreek(str) {
    if (typeof normalizeGreekString === 'function') return normalizeGreekString(str);
    if (typeof window !== 'undefined' && typeof window.normalizeGreekString === 'function') {
      return window.normalizeGreekString(str);
    }
    return String(str || '').toLowerCase();
  }

  function _safeIsSameCategory(catA, catB) {
    if (typeof isSameCategory === 'function') return isSameCategory(catA, catB);
    if (typeof window !== 'undefined' && typeof window.isSameCategory === 'function') {
      return window.isSameCategory(catA, catB);
    }
    return catA === catB;
  }

  function _safeTxBelongsToSeries(tx, ctx) {
    if (typeof _txBelongsToRecurringSeries === 'function') return _txBelongsToRecurringSeries(tx, ctx);
    if (typeof window !== 'undefined' && typeof window._txBelongsToRecurringSeries === 'function') {
      return window._txBelongsToRecurringSeries(tx, ctx);
    }
    return false;
  }

  function openRecurringTemplatesModal() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('recurring-templates-list-container');
    if (!container) return;

    const appState = getState();

    if (!appState.recurringTemplates || appState.recurringTemplates.length === 0) {
      try {
        if (typeof localStorage !== 'undefined') {
          const cached = JSON.parse(localStorage.getItem('recurring_templates') || '[]');
          if (Array.isArray(cached) && cached.length > 0) {
            appState.recurringTemplates = cached;
          }
        }
      } catch (e) { }
    }

    container.innerHTML = '';
    const templates = appState.recurringTemplates || [];
    const lang = appState.lang || 'el';
    const translations = getTranslations();

    if (templates.length === 0) {
      const emptyMsg = (translations[lang] && translations[lang]['no_recurring_templates']) || 'No active recurring transactions found.';
      container.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-secondary); font-size: 14px; line-height: 1.5;">
          ${emptyMsg}
        </div>
      `;
    } else {
      templates.forEach(t => {
        // Find category styling using robust getCategoryInfo helper
        const catInfo = _safeCategoryInfo(t.category, t.type);
        const icon = catInfo.icon || (t.type === 'income' ? '🟢' : '🔴');
        const color = catInfo.color || '#78909c';

        // Format preset type label
        let presetLabel = t.preset || 'custom';
        if (presetLabel === 'monthly') {
          const dayLabel = (translations[lang] && translations[lang]['monthly_on_day']) || 'Monthly on day';
          const startDate = t.startDate ? new Date(t.startDate) : null;
          const dayNum = startDate ? startDate.getDate() : 1;
          presetLabel = `${dayLabel} ${dayNum}`;
        } else {
          presetLabel = (translations[lang] && translations[lang]['stats_period_' + presetLabel]) || presetLabel;
        }

        let endDateLabel = '';
        if (t.endDate) {
          const parts = String(t.endDate).split('T')[0].split('-');
          if (parts.length === 3) {
            const dd = parts[2];
            const mm = parts[1];
            const yyyy = parts[0];
            endDateLabel = lang === 'el' ? ` • Έως ${dd}/${mm}/${yyyy}` : ` • Until ${dd}/${mm}/${yyyy}`;
          } else {
            const endD = new Date(t.endDate);
            if (!isNaN(endD.getTime())) {
              const day = String(endD.getDate()).padStart(2, '0');
              const month = String(endD.getMonth() + 1).padStart(2, '0');
              const year = endD.getFullYear();
              endDateLabel = lang === 'el' ? ` • Έως ${day}/${month}/${year}` : ` • Until ${day}/${month}/${year}`;
            }
          }
        }

        const isIncome = t.type === 'income';
        const amountPrefix = isIncome ? '+' : '-';
        const amountClass = isIncome ? 'recurring-amount-hero income' : 'recurring-amount-hero expense';
        const formattedAmount = `${amountPrefix} ${_safeCurrencySymbol()} ${_safeFormatDisplayAmount(t.amount, t.currency || appState.mainCurrency || 'EUR')}`;

        const renderCatIcon = (typeof renderCategoryIconHtml === 'function')
          ? renderCategoryIconHtml
          : (typeof window !== 'undefined' && typeof window.renderCategoryIconHtml === 'function' ? window.renderCategoryIconHtml : null);

        const iconHtml = renderCatIcon
          ? renderCatIcon(t.category, { size: 'md', customColor: color, transType: t.type })
          : `<div class="recurring-card-cat-icon" style="background: ${color}20; color: ${color};">${icon}</div>`;

        const itemHtml = `
          <div class="recurring-template-card" onclick="openRecurringDetailsModal('${t.id}')">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
              ${iconHtml}
              <div style="display: flex; flex-direction: column; min-width: 0; text-align: left; flex: 1;">
                <span style="font-weight: 700; color: var(--text-primary); font-size: 14.5px; word-break: break-word; line-height: 1.3;">
                  ${_safeEscapeHtml(t.note || t.category)}
                </span>
                <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px; flex-wrap: wrap;">
                  <span class="recurring-freq-pill"><i class="fa-regular fa-calendar-check" style="font-size: 10px;"></i> ${_safeEscapeHtml(presetLabel)}</span>
                  ${endDateLabel ? `<span style="font-size: 11px; color: var(--text-muted);">${_safeEscapeHtml(endDateLabel.replace('•', '').trim())}</span>` : ''}
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
              <div style="text-align: right;">
                <div class="${amountClass}">${formattedAmount}</div>
                <div style="font-size: 10.5px; color: var(--text-muted); display: flex; align-items: center; justify-content: flex-end; gap: 3px; margin-top: 2px;">
                  <span>${lang === 'el' ? 'Λεπτομέρειες' : 'Details'}</span>
                  <i class="fa-solid fa-chevron-right" style="font-size: 8.5px; opacity: 0.6;"></i>
                </div>
              </div>
              <button class="recurring-action-delete-btn" onclick="event.stopPropagation(); deleteRecurringTemplate('${t.id}')" title="${lang === 'el' ? 'Διαγραφή' : 'Delete'}">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          </div>
        `;

        container.insertAdjacentHTML('beforeend', itemHtml);
      });
    }

    _safeOpenModal('recurring-templates-modal');
  }

  function openRecurringDetailsModal(templateId) {
    if (typeof document === 'undefined') return;
    const appState = getState();
    const template = (appState.recurringTemplates || []).find(t => String(t.id) === String(templateId));
    if (!template) return;
    activeRecurringDetailsTemplateId = template.id;

    const lang = appState.lang || 'el';

    // Title
    const titleEl = document.getElementById('recurring-details-title');
    if (titleEl) titleEl.textContent = lang === 'el' ? '🔁 Επαναλήψεις' : '🔁 Repetitions';

    // Name label
    const nameLabel = document.getElementById('recurring-details-name-label');
    if (nameLabel) nameLabel.textContent = lang === 'el' ? 'Όνομα Επανάληψης' : 'Recurring Name';

    // List label
    const listLabel = document.getElementById('recurring-details-list-label');
    if (listLabel) listLabel.textContent = lang === 'el' ? 'Όλες οι Επαναλήψεις' : 'All Repetitions';

    // Name input
    const nameInput = document.getElementById('recurring-details-name-input');
    if (nameInput) nameInput.value = template.note || '';

    // Save button text
    const saveBtn = document.querySelector('#recurring-details-modal .modal-body button[onclick="saveRecurringTemplateName()"]');
    if (saveBtn) {
      saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk" style="font-size: 12px; margin-right: 4px;"></i>${lang === 'el' ? 'Αποθήκευση' : 'Save'}`;
    }

    // Gather all repetitions (transactions linked to this template or belonging to its recurring series)
    const templateIdStr = String(template.id);
    const ctx = {
      templateId: template.id,
      amount: template.amount,
      type: template.type,
      category: template.category
    };
    let updatedAnyLink = false;
    const repetitions = (appState.transactions || []).filter(tx => {
      // 1. Direct link by recurring_template_id
      if (String(tx.recurring_template_id || '') === templateIdStr) return true;

      // 2. Belongs to recurring series (amount + type + category + series occurrence date)
      if (_safeTxBelongsToSeries(tx, ctx)) {
        tx.recurring_template_id = template.id;
        updatedAnyLink = true;
        return true;
      }

      // 3. Robust fallback: same amount + type + (matching note or matching category) within template active timeline
      const txAmount = (parseFloat(tx.amount) || 0).toFixed(2);
      const templAmount = (parseFloat(template.amount) || 0).toFixed(2);
      if (txAmount === templAmount && tx.type === template.type) {
        const txNote = _safeNormalizeGreek(tx.note || tx.description || '');
        const templNote = _safeNormalizeGreek(template.note || template.description || '');
        const notesMatch = txNote.length > 0 && templNote.length > 0 && (txNote === templNote || txNote.includes(templNote) || templNote.includes(txNote));
        const catMatch = _safeIsSameCategory(tx.category, template.category);
        if (notesMatch || catMatch) {
          const txDate = String(tx.date || '').split('T')[0].split(' ')[0];
          const templateStart = template.startDate ? String(template.startDate).split('T')[0] : '2000-01-01';
          const templateEnd = template.endDate ? String(template.endDate).split('T')[0] : '2099-12-31';
          if (txDate >= templateStart && txDate <= templateEnd) {
            tx.recurring_template_id = template.id;
            updatedAnyLink = true;
            return true;
          }
        }
      }
      return false;
    });

    if (updatedAnyLink && typeof localStorage !== 'undefined') {
      localStorage.setItem('offline_transactions', JSON.stringify(appState.transactions));
    }

    // Sort by date ascending
    repetitions.sort((a, b) => {
      const da = String(a.date || '').split('T')[0];
      const db = String(b.date || '').split('T')[0];
      return da.localeCompare(db);
    });

    const listContainer = document.getElementById('recurring-details-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (repetitions.length === 0) {
      const emptyMsg = lang === 'el'
        ? 'Δεν βρέθηκαν κινήσεις για αυτή την επανάληψη.'
        : 'No transactions found for this repetition.';
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 24px 16px; color: var(--text-secondary); font-size: 13.5px; line-height: 1.5;">
          ${emptyMsg}
        </div>
      `;
    } else {
      const renderCatIcon = (typeof renderCategoryIconHtml === 'function')
        ? renderCategoryIconHtml
        : (typeof window !== 'undefined' && typeof window.renderCategoryIconHtml === 'function' ? window.renderCategoryIconHtml : null);

      repetitions.forEach(tx => {
        // Format date
        let formattedDate = tx.date || '';
        try {
          const d = new Date(tx.date);
          if (!isNaN(d.getTime())) {
            formattedDate = d.toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-US', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
          }
        } catch (e) { }

        const amount = parseFloat(tx.amount || 0).toFixed(2);
        const catBadge = renderCatIcon
          ? renderCatIcon(tx.category, { size: 'sm', transType: tx.type })
          : `<div style="font-size: 15px; flex-shrink: 0;">${tx.type === 'expense' ? '🔴' : '🟢'}</div>`;

        const rowHtml = `
          <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-card); gap: 10px; box-sizing: border-box; width: 100%; cursor: pointer;" onclick="openEditTransactionModalFromDetails('${tx.id}')">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
              ${catBadge}
              <div style="display: flex; flex-direction: column; min-width: 0; text-align: left; flex: 1;">
                <span style="font-weight: 600; color: var(--text-primary); font-size: 13.5px; word-break: break-word; line-height: 1.3;">${formattedDate}</span>
                <span style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; word-break: break-word; line-height: 1.2;">${tx.category || ''}</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
              <span style="font-weight: 700; color: var(--text-primary); font-size: 13.5px; white-space: nowrap;">${amount}€</span>
              <button type="button" onclick="event.stopPropagation(); handleDeleteFromRecurringDetails('${tx.id}', '${template.id}', '${String(tx.date || '').split('T')[0]}')" style="background: rgba(239, 83, 80, 0.1); border: 1px solid rgba(239, 83, 80, 0.2); color: var(--danger); font-size: 13px; cursor: pointer; padding: 6px 10px; border-radius: 8px; transition: background-color 0.2s;" title="${lang === 'el' ? 'Διαγραφή' : 'Delete'}">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', rowHtml);
      });
    }

    _safeOpenModal('recurring-details-modal');
  }

  function openEditTransactionModalFromDetails(txId) {
    const appState = getState();
    const tx = (appState.transactions || []).find(t => String(t.id) === String(txId));
    if (tx) {
      _safeCloseModal('recurring-details-modal');
      setTimeout(() => {
        if (typeof openEditTransactionModal === 'function') {
          openEditTransactionModal(tx, { instant: true });
        } else if (typeof window !== 'undefined' && typeof window.openEditTransactionModal === 'function') {
          window.openEditTransactionModal(tx, { instant: true });
        }
      }, 320);
    }
  }

  function handleDeleteFromRecurringDetails(txId, templateId, dateStr) {
    const appState = getState();
    const tx = (appState.transactions || []).find(t => String(t.id) === String(txId));
    const target = tx || { id: txId, recurring_template_id: templateId, date: dateStr };
    _safeCloseModal('recurring-details-modal');
    setTimeout(() => {
      if (typeof openRecurringDeleteModal === 'function') {
        openRecurringDeleteModal(target, dateStr, { instant: true });
      } else if (typeof window !== 'undefined' && typeof window.openRecurringDeleteModal === 'function') {
        window.openRecurringDeleteModal(target, dateStr, { instant: true });
      }
    }, 320);
  }

  function closeRecurringDetailsModal() {
    _safeCloseModal('recurring-details-modal');
    activeRecurringDetailsTemplateId = null;
  }

  async function saveRecurringTemplateName() {
    if (!activeRecurringDetailsTemplateId) return;
    const appState = getState();
    const lang = appState.lang || 'el';

    if (typeof document === 'undefined') return;
    const nameInput = document.getElementById('recurring-details-name-input');
    const newName = nameInput ? nameInput.value.trim() : '';

    const template = (appState.recurringTemplates || []).find(t => String(t.id) === String(activeRecurringDetailsTemplateId));
    if (!template) return;

    if (!newName) {
      _safeToast(lang === 'el' ? '⚠️ Το όνομα δεν μπορεί να είναι κενό.' : '⚠️ The name cannot be empty.', 2500);
      return;
    }

    template.note = newName;

    // Save to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('recurring_templates', JSON.stringify(appState.recurringTemplates));
    }

    // Save to Supabase (Cloud Sync)
    if (appState.isSupabaseEnabled && appState.supabaseClient && appState.currentUser) {
      try {
        await appState.supabaseClient
          .from('recurring_templates')
          .upsert([_safeMapTemplateToDb(template)]);
      } catch (err) {
        console.warn('Failed to sync recurring template name to cloud:', err);
      }
    }

    _safeToast(lang === 'el' ? '✅ Το όνομα αποθηκεύτηκε.' : '✅ Name saved.', 2500);

    // Refresh the templates list modal behind
    openRecurringTemplatesModal();
    // Re-open details modal to reflect the new name
    openRecurringDetailsModal(template.id);
  }

  function openRecurringEditModal(templateId) {
    const appState = getState();
    const template = (appState.recurringTemplates || []).find(t => String(t.id) === String(templateId));
    if (!template) return;
    activeRecurringEditTemplateId = template.id;

    const lang = appState.lang || 'el';

    if (typeof document === 'undefined') return;
    // Title
    const titleEl = document.getElementById('recurring-edit-title');
    if (titleEl) titleEl.textContent = lang === 'el' ? '✏️ Επεξεργασία Επανάληψης' : '✏️ Edit Recurring';

    // Name
    const nameInput = document.getElementById('recurring-edit-name-input');
    if (nameInput) nameInput.value = template.note || '';

    // Start date
    const startDateStr = template.startDate || `${template.startYear || new Date().getFullYear()}-${String(template.startMonth || 1).padStart(2, '0')}-01`;
    const startInput = document.getElementById('recurring-edit-start');
    const startLabel = document.getElementById('recurring-edit-start-label');
    if (startInput) startInput.value = startDateStr;
    if (startLabel) {
      const parts = startDateStr.split('-');
      if (parts.length === 3) startLabel.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
      else startLabel.textContent = startDateStr;
    }

    // Preset
    const presetSelect = document.getElementById('recurring-edit-preset');
    if (presetSelect) presetSelect.value = template.preset || 'monthly';

    // Months grid
    _recurringEditMonths = Array.isArray(template.months) ? template.months.slice() : [];
    renderRecurringEditMonthsGrid();

    // End type / end date
    const endType = template.endType || 'perpetual';
    const endDate = template.endDate || null;
    const btnPerpetual = document.getElementById('recurring-edit-end-perpetual');
    const btnDate = document.getElementById('recurring-edit-end-date');
    const endContainer = document.getElementById('recurring-edit-end-date-container');
    const endInput = document.getElementById('recurring-edit-end');
    const endLabel = document.getElementById('recurring-edit-end-label');

    if (endType === 'perpetual' || !endDate) {
      if (btnPerpetual) btnPerpetual.classList.add('active');
      if (btnDate) btnDate.classList.remove('active');
      if (endContainer) endContainer.style.display = 'none';
      if (endInput) endInput.value = '';
      if (endLabel) endLabel.textContent = lang === 'el' ? 'Επιλογή ημερομηνίας...' : 'Select date...';
    } else {
      if (btnPerpetual) btnPerpetual.classList.remove('active');
      if (btnDate) btnDate.classList.add('active');
      if (endContainer) endContainer.style.display = 'flex';
      if (endInput) endInput.value = endDate;
      if (endLabel) {
        const parts = endDate.split('-');
        if (parts.length === 3) endLabel.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
        else endLabel.textContent = endDate;
      }
    }

    // Update summary when start/end dates change via the calendar
    const startInputEl = document.getElementById('recurring-edit-start');
    const endInputEl = document.getElementById('recurring-edit-end');
    if (startInputEl) startInputEl.oninput = () => updateRecurringEditSummary();
    if (endInputEl) endInputEl.oninput = () => updateRecurringEditSummary();

    updateRecurringEditSummary();
    _safeOpenModal('recurring-edit-modal');
  }

  function closeRecurringEditModal() {
    _safeCloseModal('recurring-edit-modal');
    activeRecurringEditTemplateId = null;
  }

  function renderRecurringEditMonthsGrid() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    const grid = document.getElementById('recurring-edit-months-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const appState = getState();
    const lang = appState.lang || 'el';
    const monthNames = lang === 'en' ? ENGLISH_MONTHS_SHORT : GREEK_MONTHS_SHORT;
    for (let m = 1; m <= 12; m++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'google-picker-btn';
      btn.textContent = monthNames[m - 1];
      if (_recurringEditMonths.includes(m)) btn.classList.add('active');
      btn.onclick = () => {
        const idx = _recurringEditMonths.indexOf(m);
        if (idx > -1) {
          if (_recurringEditMonths.length > 1) {
            _recurringEditMonths.splice(idx, 1);
            btn.classList.remove('active');
          }
        } else {
          _recurringEditMonths.push(m);
          btn.classList.add('active');
        }
        updateRecurringEditSummary();
      };
      grid.appendChild(btn);
    }
  }

  function onRecurringEditPresetChange() {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('recurring-edit-preset');
    if (!select) return;
    const val = select.value;

    const monthsContainer = document.getElementById('recurring-edit-months-container');
    if (monthsContainer) {
      if (val === 'specific_months') {
        monthsContainer.style.display = 'flex';
        if (_recurringEditMonths.length === 0) {
          const startVal = document.getElementById('recurring-edit-start').value;
          const currentMonth = startVal ? new Date(startVal).getMonth() + 1 : new Date().getMonth() + 1;
          _recurringEditMonths = [currentMonth];
          renderRecurringEditMonthsGrid();
        }
      } else {
        monthsContainer.style.display = 'none';
      }
    }
    updateRecurringEditSummary();
  }

  function selectRecurringEditEndType(type) {
    if (typeof document === 'undefined') return;
    const btnPerpetual = document.getElementById('recurring-edit-end-perpetual');
    const btnDate = document.getElementById('recurring-edit-end-date');
    const endContainer = document.getElementById('recurring-edit-end-date-container');

    if (type === 'perpetual') {
      if (btnPerpetual) btnPerpetual.classList.add('active');
      if (btnDate) btnDate.classList.remove('active');
      if (endContainer) endContainer.style.display = 'none';
      const endInput = document.getElementById('recurring-edit-end');
      if (endInput) endInput.value = '';
    } else {
      if (btnPerpetual) btnPerpetual.classList.remove('active');
      if (btnDate) btnDate.classList.add('active');
      if (endContainer) endContainer.style.display = 'flex';
      const endInput = document.getElementById('recurring-edit-end');
      if (endInput && !endInput.value) {
        const today = new Date();
        const endOfYear = new Date(today.getFullYear(), 11, 31);
        const yyyy = endOfYear.getFullYear();
        const mm = String(endOfYear.getMonth() + 1).padStart(2, '0');
        const dd = String(endOfYear.getDate()).padStart(2, '0');
        endInput.value = `${yyyy}-${mm}-${dd}`;
        const endLabel = document.getElementById('recurring-edit-end-label');
        if (endLabel) endLabel.textContent = `${dd}/${mm}/${yyyy}`;
      }
    }
    updateRecurringEditSummary();
  }

  function updateRecurringEditSummary() {
    if (typeof document === 'undefined') return;
    const summaryText = document.getElementById('recurring-edit-summary-text');
    if (!summaryText) return;
    const appState = getState();
    const lang = appState.lang || 'el';
    const preset = document.getElementById('recurring-edit-preset') ? document.getElementById('recurring-edit-preset').value : 'monthly';
    const endInput = document.getElementById('recurring-edit-end');
    const endDate = endInput ? endInput.value : '';

    let freqPart = '';
    if (preset === 'daily') freqPart = lang === 'el' ? 'Κάθε μέρα' : 'Daily';
    else if (preset === 'weekly') freqPart = lang === 'el' ? 'Κάθε εβδομάδα' : 'Weekly';
    else if (preset === 'monthly') freqPart = lang === 'el' ? 'Κάθε μήνα' : 'Monthly';
    else if (preset === 'yearly') freqPart = lang === 'el' ? 'Κάθε χρόνο' : 'Yearly';
    else if (preset === 'specific_months') {
      const monthNames = lang === 'en' ? ENGLISH_MONTHS_SHORT : GREEK_MONTHS_SHORT;
      const selectedNames = _recurringEditMonths.map(m => monthNames[m - 1]).join(', ');
      freqPart = selectedNames ? (lang === 'el' ? `Σε μήνες (${selectedNames})` : `In months (${selectedNames})`) : (lang === 'el' ? 'Επιλεγμένοι μήνες' : 'Selected months');
    } else {
      freqPart = 'Custom';
    }

    let endPart = '';
    if (endDate) {
      const parts = endDate.split('-');
      if (parts.length === 3) endPart = lang === 'el' ? `μέχρι τις ${parts[2]}/${parts[1]}/${parts[0]}` : `until ${parts[2]}/${parts[1]}/${parts[0]}`;
      else endPart = lang === 'el' ? `μέχρι ${endDate}` : `until ${endDate}`;
    } else {
      endPart = lang === 'el' ? 'για πάντα' : 'forever';
    }

    summaryText.textContent = lang === 'el'
      ? `Θα δημιουργούνται: ${freqPart} ${endPart}`
      : `Will be created: ${freqPart} ${endPart}`;
  }

  async function saveRecurringTemplateEdit() {
    if (!activeRecurringEditTemplateId) return;
    const appState = getState();
    const lang = appState.lang || 'el';
    const template = (appState.recurringTemplates || []).find(t => String(t.id) === String(activeRecurringEditTemplateId));
    if (!template) return;

    if (typeof document === 'undefined') return;
    const nameInput = document.getElementById('recurring-edit-name-input');
    const newName = nameInput ? nameInput.value.trim() : '';
    if (!newName) {
      _safeToast(lang === 'el' ? '⚠️ Το όνομα δεν μπορεί να είναι κενό.' : '⚠️ The name cannot be empty.', 2500);
      return;
    }

    const startInput = document.getElementById('recurring-edit-start');
    const startDateStr = startInput ? startInput.value : '';
    if (!startDateStr) {
      _safeToast(lang === 'el' ? '⚠️ Επιλέξτε ημερομηνία έναρξης.' : '⚠️ Please select a start date.', 2500);
      return;
    }

    const preset = document.getElementById('recurring-edit-preset') ? document.getElementById('recurring-edit-preset').value : 'monthly';
    const endInput = document.getElementById('recurring-edit-end');
    const endDate = endInput ? endInput.value : '';

    // Validate specific_months
    if (preset === 'specific_months' && _recurringEditMonths.length === 0) {
      _safeToast(lang === 'el' ? '⚠️ Επιλέξτε τουλάχιστον έναν μήνα.' : '⚠️ Please select at least one month.', 2500);
      return;
    }

    // Validate end date >= start date
    if (endDate && endDate < startDateStr) {
      _safeToast(lang === 'el' ? '⚠️ Η ημερομηνία λήξης πρέπει να είναι μετά την έναρξη.' : '⚠️ End date must be after start date.', 2500);
      return;
    }

    // 1. Remove all existing transactions linked to this template (local + cloud)
    const templateIdStr = String(template.id);
    const linkedTxs = (appState.transactions || []).filter(tx => String(tx.recurring_template_id || '') === templateIdStr);
    const linkedIds = linkedTxs.map(tx => tx.id);
    if (linkedIds.length > 0) {
      appState.transactions = appState.transactions.filter(tx => !linkedIds.includes(tx.id));
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('offline_transactions', JSON.stringify(appState.transactions));
      }
      if (appState.isSupabaseEnabled && appState.supabaseClient && appState.currentUser) {
        try {
          await appState.supabaseClient.from('transactions').delete().in('id', linkedIds);
        } catch (err) {
          console.warn('Failed to delete old recurring transactions from cloud:', err);
        }
      }
    }

    // 2. Update the template fields
    template.note = newName;
    template.preset = preset;
    template.months = preset === 'specific_months' ? _recurringEditMonths.slice() : [];
    template.days = [];
    template.startDate = startDateStr;
    template.startYear = new Date(startDateStr).getFullYear();
    template.startMonth = new Date(startDateStr).getMonth() + 1;
    if (endDate) {
      template.endType = 'date';
      template.endDate = endDate;
    } else {
      template.endType = 'perpetual';
      template.endDate = null;
    }

    // Clear any deleted-dates markers so regeneration is clean
    if (template.description) {
      template.description = (template.description || '').split('||deleted_dates:')[0].trim();
    }

    // 3. Save template locally + cloud
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('recurring_templates', JSON.stringify(appState.recurringTemplates));
    }
    if (appState.isSupabaseEnabled && appState.supabaseClient && appState.currentUser) {
      try {
        await appState.supabaseClient.from('recurring_templates').upsert([_safeMapTemplateToDb(template)]);
      } catch (err) {
        console.warn('Failed to sync recurring template edit to cloud:', err);
      }
    }

    // 4. Regenerate transactions for this template across all relevant months
    regenerateRecurringTemplateTransactions(template);

    _safeToast(lang === 'el' ? '✅ Η επανάληψη ενημερώθηκε και αναδημιουργήθηκε.' : '✅ Recurring updated and regenerated.', 3000);

    closeRecurringEditModal();
    openRecurringTemplatesModal();
    openRecurringDetailsModal(template.id);
  }

  // Regenerate all recurring transactions for a single template across all months
  // from its start date up to end date (or forever), skipping deleted dates.
  function regenerateRecurringTemplateTransactions(template) {
    if (!template) return;
    const appState = getState();
    const preset = template.preset || 'monthly';
    const startDate = new Date(template.startDate || new Date().toISOString().split('T')[0]);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth(); // 0-indexed
    const startDay = startDate.getDate();

    const endDateStr = template.endDate || null;
    const endLimit = endDateStr ? new Date(endDateStr) : null;

    // Cap future generation to 12 months from today to avoid runaway creation
    const today = new Date();
    const maxFuture = new Date(today.getFullYear(), today.getMonth() + 12, 1);

    const getDelDates = (typeof getDeletedDatesFromTemplate === 'function')
      ? getDeletedDatesFromTemplate
      : (typeof window !== 'undefined' && typeof window.getDeletedDatesFromTemplate === 'function' ? window.getDeletedDatesFromTemplate : () => []);
    const deletedDates = getDelDates(template) || [];

    const genUUID = (typeof generateDeterministicUUID === 'function')
      ? generateDeterministicUUID
      : (typeof window !== 'undefined' && typeof window.generateDeterministicUUID === 'function' ? window.generateDeterministicUUID : (id, dt) => id + '_' + dt);

    let created = 0;
    let year = startYear;
    let month = startMonth;

    while (true) {
      const yearMonth = new Date(year, month, 1);
      if (yearMonth > maxFuture) break;
      if (endLimit && yearMonth > endLimit) break;

      const monthNum = month + 1;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const datesToCreate = [];

      if (preset === 'daily') {
        for (let d = 1; d <= lastDay; d++) {
          if (year === startYear && month === startMonth && d < startDay) continue;
          datesToCreate.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }
      } else if (preset === 'weekly') {
        const targetDayOfWeek = startDate.getDay();
        for (let d = 1; d <= lastDay; d++) {
          const dObj = new Date(year, month, d);
          if (dObj.getDay() === targetDayOfWeek) {
            if (year === startYear && month === startMonth && d < startDay) continue;
            datesToCreate.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
          }
        }
      } else if (preset === 'monthly') {
        const day = Math.min(startDay, lastDay);
        if (!(year === startYear && month === startMonth && day < startDay)) {
          datesToCreate.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
      } else if (preset === 'yearly') {
        if (month === startMonth) {
          const day = Math.min(startDay, lastDay);
          datesToCreate.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
      } else if (preset === 'specific_months') {
        if (template.months && template.months.includes(monthNum)) {
          const day = Math.min(startDay, lastDay);
          if (!(year === startYear && month === startMonth && day < startDay)) {
            datesToCreate.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
          }
        }
      }

      datesToCreate.forEach(dateString => {
        if (endLimit && dateString > endDateStr) return;
        if (deletedDates.includes(dateString)) return;

        const expectedDeterministicId = genUUID(template.id, dateString);
        const matchingExisting = (appState.transactions || []).find(t => {
          const tDate = String(t.date || '').split('T')[0].split(' ')[0];
          if (tDate !== dateString) return false;
          if (t.id === expectedDeterministicId) return true;
          if (t.recurring_template_id && String(t.recurring_template_id) === String(template.id)) return true;
          const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
          const templAmount = (parseFloat(template.amount) || 0).toFixed(2);
          if (tAmount === templAmount && t.type === template.type) {
            const tNote = _safeNormalizeGreek(t.note || t.description || '');
            const templNote = _safeNormalizeGreek(template.note || template.description || '');
            const notesMatch = tNote.length > 0 && templNote.length > 0 && (tNote === templNote || tNote.includes(templNote) || templNote.includes(tNote));
            if (notesMatch) return true;
            if (_safeIsSameCategory(t.category, template.category) && (!tNote || !templNote || notesMatch)) return true;
          }
          return false;
        });
        if (matchingExisting) {
          if (!matchingExisting.recurring_template_id) {
            matchingExisting.recurring_template_id = template.id;
          }
          return;
        }

        const newTx = {
          id: expectedDeterministicId,
          recurring_template_id: template.id,
          date: dateString,
          type: template.type,
          amount: parseFloat(template.amount),
          currency: template.currency || 'EUR',
          category: template.category,
          subcategory: template.subcategory || '',
          account_from: template.account_from,
          account_to: template.type === 'transfer' ? template.account_to : null,
          note: template.note,
          description: template.description || '',
          user_id: template.user_id || (appState.currentUser ? appState.currentUser.id : null),
          is_shared: template.is_shared !== undefined ? template.is_shared : (appState.partnerProfile !== null),
          family_id: template.family_id || (appState.userProfile ? appState.userProfile.family_id : null),
          created_at: new Date().toISOString()
        };

        if (typeof computeCurrencyFields === 'function') computeCurrencyFields(newTx);
        else if (typeof window !== 'undefined' && typeof window.computeCurrencyFields === 'function') {
          window.computeCurrencyFields(newTx);
        }

        // HIGH-EXPENSE ALERT: recurring-generated expenses also respect the
        // "Single Expense Alert" limit (previously only manual saves fired it).
        if (typeof checkHighExpenseAlert === 'function') checkHighExpenseAlert(newTx);
        else if (typeof window !== 'undefined' && typeof window.checkHighExpenseAlert === 'function') {
          window.checkHighExpenseAlert(newTx);
        }

        if (typeof saveTransactionOffline === 'function') saveTransactionOffline(newTx);
        else if (typeof window !== 'undefined' && typeof window.saveTransactionOffline === 'function') {
          window.saveTransactionOffline(newTx);
        }

        if (appState.isSupabaseEnabled && appState.supabaseClient && appState.currentUser) {
          const { description, is_shared, photo_local_uri, photo_url, receipt, fx_snapshot, ...dbPayload } = newTx;
          (async () => {
            try {
              const timeoutFn = (typeof promiseTimeout === 'function')
                ? promiseTimeout
                : (typeof window !== 'undefined' && typeof window.promiseTimeout === 'function' ? window.promiseTimeout : (p) => p);
              const { error } = await timeoutFn(
                appState.supabaseClient.from('transactions').upsert([dbPayload]),
                12000
              );
              if (error) throw error;
            } catch (err) {
              // If the server-side cloud limit trigger rejected this insert (free
              // user over the monthly limit), keep the transaction locally and
              // queue it for later sync — never drop financial data.
              console.warn('Cloud save failed for regenerated recurring, queueing:', newTx.id, err);
              if (typeof enqueueSyncMutation === 'function') enqueueSyncMutation('save', newTx);
              else if (typeof window !== 'undefined' && typeof window.enqueueSyncMutation === 'function') {
                window.enqueueSyncMutation('save', newTx);
              }
            }
          })();
        }
        created++;
      });

      // Advance to next month
      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
      if (year > maxFuture.getFullYear() + 1) break;
    }

    if (typeof cleanCrossLanguageRecurringDuplicates === 'function') cleanCrossLanguageRecurringDuplicates();
    else if (typeof window !== 'undefined' && typeof window.cleanCrossLanguageRecurringDuplicates === 'function') {
      window.cleanCrossLanguageRecurringDuplicates();
    }

    if (typeof calculateInitialBalances === 'function') calculateInitialBalances();
    else if (typeof window !== 'undefined' && typeof window.calculateInitialBalances === 'function') {
      window.calculateInitialBalances();
    }

    if (typeof updateUI === 'function') updateUI();
    else if (typeof window !== 'undefined' && typeof window.updateUI === 'function') {
      window.updateUI();
    }

    return created;
  }

  async function deleteRecurringTemplate(id) {
    if (!id) return;
    if (typeof openRecurringDeleteModal === 'function') openRecurringDeleteModal(id);
    else if (typeof window !== 'undefined' && typeof window.openRecurringDeleteModal === 'function') {
      window.openRecurringDeleteModal(id);
    }
  }

  // Attach to window for global inline onclick handler access
  if (typeof window !== 'undefined') {
    window.openRecurringTemplatesModal = openRecurringTemplatesModal;
    window.deleteRecurringTemplate = deleteRecurringTemplate;
    window.openRecurringDetailsModal = openRecurringDetailsModal;
    window.openEditTransactionModalFromDetails = openEditTransactionModalFromDetails;
    window.handleDeleteFromRecurringDetails = handleDeleteFromRecurringDetails;
    window.closeRecurringDetailsModal = closeRecurringDetailsModal;
    window.saveRecurringTemplateName = saveRecurringTemplateName;
    window.openRecurringEditModal = openRecurringEditModal;
    window.closeRecurringEditModal = closeRecurringEditModal;
    window.renderRecurringEditMonthsGrid = renderRecurringEditMonthsGrid;
    window.onRecurringEditPresetChange = onRecurringEditPresetChange;
    window.selectRecurringEditEndType = selectRecurringEditEndType;
    window.updateRecurringEditSummary = updateRecurringEditSummary;
    window.saveRecurringTemplateEdit = saveRecurringTemplateEdit;
    window.regenerateRecurringTemplateTransactions = regenerateRecurringTemplateTransactions;
  }

  return {
    openRecurringTemplatesModal,
    deleteRecurringTemplate,
    openRecurringDetailsModal,
    openEditTransactionModalFromDetails,
    handleDeleteFromRecurringDetails,
    closeRecurringDetailsModal,
    saveRecurringTemplateName,
    openRecurringEditModal,
    closeRecurringEditModal,
    renderRecurringEditMonthsGrid,
    onRecurringEditPresetChange,
    selectRecurringEditEndType,
    updateRecurringEditSummary,
    saveRecurringTemplateEdit,
    regenerateRecurringTemplateTransactions,
    getActiveDetailsTemplateId: () => activeRecurringDetailsTemplateId,
    setActiveDetailsTemplateId: (id) => { activeRecurringDetailsTemplateId = id; },
    getActiveEditTemplateId: () => activeRecurringEditTemplateId,
    setActiveEditTemplateId: (id) => { activeRecurringEditTemplateId = id; },
    getRecurringEditMonths: () => _recurringEditMonths,
    setRecurringEditMonths: (m) => { _recurringEditMonths = m; }
  };
}));
