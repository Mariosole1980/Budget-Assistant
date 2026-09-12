/**
 * js/notesService.js
 *
 * In-App Notepad, Checklists, Sticky Notes, Reminders & Sync Subsystem.
 * Extracted from app.js (Phase 8A Architectural Domain Extraction).
 *
 * Features:
 * - Note models: rich text, checklists with dynamic items, reminders, color cards
 * - Note editor lifecycle: create, edit, dynamic autosave, meta footers, focus scroll
 * - Note reminders: presets, alarms, custom date/time bindings
 * - Full note trash lifecycle: soft deletion, durable tombstones, restore, permanent deletion
 * - Notes search, categories filter, view mode (grid vs list)
 * - Cloud sync & conflict resolution (Supabase sync, LWW merge, offline mutations)
 * - Category budgets (loadBudgets, saveBudgets, syncBudgets)
 * - UMD wrapper exposing methods globally to window and pure helpers to Node tests
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser: attach to root (window)
    var exports = factory();
    Object.assign(root, exports);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

// ============================================================
// NOTES & REMINDERS/CHECKLISTS LOGIC
// ============================================================
let _currentEditingNoteId = null;
let _currentEditingNotePinned = false;
let _currentEditingNoteType = 'text';
let _currentEditingNoteColor = 'default';

function translateNotepadUI() {
  const isEl = (state.lang === 'el');

  // Notepad Manager Filter Chips
  const filterAllSpan = document.querySelector('#notes-filter-bar [data-filter="all"] span');
  if (filterAllSpan) filterAllSpan.textContent = isEl ? 'Όλες' : 'All';

  const filterPinnedSpan = document.querySelector('#notes-filter-bar [data-filter="pinned"] span');
  if (filterPinnedSpan) filterPinnedSpan.textContent = isEl ? 'Καρφιτσωμένες' : 'Pinned';

  const filterTextSpan = document.querySelector('#notes-filter-bar [data-filter="text"] span');
  if (filterTextSpan) filterTextSpan.textContent = isEl ? 'Σημειώσεις' : 'Notes';

  const filterChecklistSpan = document.querySelector('#notes-filter-bar [data-filter="checklist"] span');
  if (filterChecklistSpan) filterChecklistSpan.textContent = isEl ? 'Checklists' : 'Checklists';

  const filterReminderSpan = document.querySelector('#notes-filter-bar [data-filter="reminder"] span');
  if (filterReminderSpan) filterReminderSpan.textContent = isEl ? 'Υπενθυμίσεις' : 'Reminders';

  // Notepad Subtitle & Search
  const subtitleEl = document.querySelector('[data-i18n="notes_manager_subtitle"]');
  if (subtitleEl) subtitleEl.textContent = isEl ? 'Προσωπικές σημειώσεις, λίστες & υπενθυμίσεις' : 'Personal notes, checklists & reminders';

  const searchInput = document.getElementById('notes-manager-search-input');
  if (searchInput) searchInput.placeholder = isEl ? 'Αναζήτηση σημειώσεων...' : 'Search notes...';

  // Note Editor Segmented Tabs
  const tabText = document.getElementById('note-type-text-btn');
  if (tabText) tabText.textContent = isEl ? '📝 Κείμενο' : '📝 Text';

  const tabChecklist = document.getElementById('note-type-checklist-btn');
  if (tabChecklist) tabChecklist.textContent = isEl ? '☑️ Λίστα' : '☑️ Checklist';

  // Labels inside Note Editor Modal
  const colorLabel = document.querySelector('#note-editor-modal [data-i18n="note_label_color"]');
  if (colorLabel) colorLabel.textContent = isEl ? 'Χρώμα Σημείωσης' : 'Note Color';

  const titleLabel = document.querySelector('#note-editor-modal [data-i18n="note_label_title"]');
  if (titleLabel) titleLabel.textContent = isEl ? 'Τίτλος' : 'Title';

  const reminderLabel = document.getElementById('note-editor-reminder-label');
  if (reminderLabel) reminderLabel.textContent = isEl ? '⏰ Υπενθύμιση' : '⏰ Reminder';

  const contentLabel = document.querySelector('#note-editor-modal [data-i18n="note_label_content"]');
  if (contentLabel) contentLabel.textContent = isEl ? 'Περιεχόμενο' : 'Content';

  const checklistItemsLabel = document.querySelector('#note-editor-modal [data-i18n="note_label_checklist_items"]');
  if (checklistItemsLabel) checklistItemsLabel.textContent = isEl ? 'Αντικείμενα Λίστας' : 'Checklist Items';

  const addItemSpan = document.querySelector('#note-editor-modal .note-checklist-add span');
  if (addItemSpan) addItemSpan.textContent = isEl ? 'Προσθήκη αντικειμένου' : 'Add item';

  // Placeholders
  const titleInput = document.getElementById('note-editor-title-input');
  if (titleInput) titleInput.placeholder = isEl ? 'Τίτλος σημείωσης...' : 'Note title...';

  const bodyInput = document.getElementById('note-editor-body-input');
  if (bodyInput) bodyInput.placeholder = isEl ? 'Γράψτε τη σημείωσή σας εδώ...' : 'Write your note here...';

  // Action Buttons
  const saveBtn = document.getElementById('note-editor-save-btn');
  if (saveBtn) saveBtn.textContent = isEl ? 'Αποθήκευση' : 'Save';

  const deleteBtn = document.getElementById('note-editor-delete-btn');
  // Keep the trash-can icon inside the button (the HTML already contains
  // <i class="fa-solid fa-trash-can"></i>). Only update the tooltip title so
  // the label text doesn't overflow the icon button.
  if (deleteBtn) deleteBtn.title = isEl ? 'Διαγραφή' : 'Delete';

  const cancelBtn = document.querySelector('#note-editor-modal [data-i18n="btn_cancel"]');
  if (cancelBtn) cancelBtn.textContent = isEl ? 'Άκυρο' : 'Cancel';
}
window.translateNotepadUI = translateNotepadUI;

// Tracks whether the note editor modal is currently shrunk to sit above the
// virtual keyboard. Used to reliably restore the modal once the keyboard closes,
// even when the visualViewport fires multiple resize events during the close
// animation (which previously left the fields pushed up with an empty gap below).
let _noteEditorKeyboardOpen = false;

function restoreNoteEditorInitialPosition() {
  const modal = document.getElementById('note-editor-modal');
  if (!modal) return;
  const modalBody = modal.querySelector('.modal-body');
  const content = modal.querySelector('.modal-content');
  if (modalBody) {
    modalBody.style.paddingBottom = '16px';
    modalBody.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (content) {
    content.style.maxHeight = '85vh';
  }
  // Reset the keyboard-height CSS variable so the modal overlay's
  // padding-bottom (var(--keyboard-height)) doesn't leave a persistent gap.
  document.documentElement.style.setProperty('--keyboard-height', '0px');
  _noteEditorKeyboardOpen = false;
}
window.restoreNoteEditorInitialPosition = restoreNoteEditorInitialPosition;

function bindNoteEditorFocusScroll() {
  const modal = document.getElementById('note-editor-modal');
  if (!modal) return;
  const modalBody = modal.querySelector('.modal-body');

  const adjustScroll = (el) => {
    if (!el) return;
    _noteEditorKeyboardOpen = true;
    if (modalBody) {
      modalBody.style.paddingBottom = '260px';
    }
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 80);
  };

  const attachEvents = (el) => {
    if (!el || el._scrollEventsAttached) return;
    el._scrollEventsAttached = true;

    el.addEventListener('focus', () => adjustScroll(el));
    el.addEventListener('click', () => adjustScroll(el));
    el.addEventListener('input', () => {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    el.addEventListener('blur', () => {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || !modal.contains(active) || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
          restoreNoteEditorInitialPosition();
        }
      }, 80);
    });
  };

  attachEvents(document.getElementById('note-editor-body-input'));
  attachEvents(document.getElementById('note-editor-title-input'));
  document.querySelectorAll('#note-editor-checklist-items input[type="text"]').forEach(input => {
    attachEvents(input);
  });
}
window.bindNoteEditorFocusScroll = bindNoteEditorFocusScroll;

if (typeof window !== 'undefined') {
  if (window.visualViewport) {
    // Debounce visualViewport resize events (they fire repeatedly during the
    // keyboard open/close animation). We coalesce them into one update per frame
    // so the modal doesn't get re-shrunk mid-close and left with a bottom gap.
    let _noteVpRafId = null;
    const handleNoteViewportResize = () => {
      const modal = document.getElementById('note-editor-modal');
      if (!modal || !(modal.classList.contains('active') || modal.style.display === 'flex')) return;

      const currentHeight = window.visualViewport.height;
      const content = modal.querySelector('.modal-content');
      const keyboardVisible = currentHeight < window.innerHeight * 0.75;

      if (keyboardVisible) {
        _noteEditorKeyboardOpen = true;
        if (content) {
          content.style.maxHeight = `${Math.max(250, currentHeight - 16)}px`;
        }
        const active = document.activeElement;
        if (active && modal.contains(active)) {
          setTimeout(() => {
            active.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          }, 80);
        }
      } else if (_noteEditorKeyboardOpen) {
        // Keyboard has fully closed — restore the modal to its natural position.
        restoreNoteEditorInitialPosition();
      }
    };

    const debouncedNoteViewportResize = () => {
      if (_noteVpRafId) return;
      _noteVpRafId = requestAnimationFrame(() => {
        _noteVpRafId = null;
        handleNoteViewportResize();
      });
    };

    window.visualViewport.addEventListener('resize', debouncedNoteViewportResize);
    window.visualViewport.addEventListener('scroll', debouncedNoteViewportResize);
  }

  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Keyboard) {
    try {
      window.Capacitor.Plugins.Keyboard.addListener('keyboardWillHide', () => {
        restoreNoteEditorInitialPosition();
      });
      window.Capacitor.Plugins.Keyboard.addListener('keyboardDidHide', () => {
        restoreNoteEditorInitialPosition();
      });
    } catch (e) {
      console.warn('Capacitor Keyboard listener error:', e);
    }
  }
}

function selectNoteColor(color) {
  _currentEditingNoteColor = color || 'default';

  const colorMap = {
    default: { hex: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.35)', alpha: 'rgba(245, 158, 11, 0.08)' },
    amber: { hex: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.35)', alpha: 'rgba(245, 158, 11, 0.08)' },
    emerald: { hex: '#10b981', shadow: 'rgba(16, 185, 129, 0.35)', alpha: 'rgba(16, 185, 129, 0.08)' },
    blue: { hex: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.35)', alpha: 'rgba(59, 130, 246, 0.08)' },
    purple: { hex: '#8b5cf6', shadow: 'rgba(139, 92, 246, 0.35)', alpha: 'rgba(139, 92, 246, 0.08)' },
    rose: { hex: '#f43f5e', shadow: 'rgba(244, 63, 94, 0.35)', alpha: 'rgba(244, 63, 94, 0.08)' },
    teal: { hex: '#14b8a6', shadow: 'rgba(20, 184, 166, 0.35)', alpha: 'rgba(20, 184, 166, 0.08)' }
  };

  const theme = colorMap[_currentEditingNoteColor] || colorMap.default;
  const modal = document.getElementById('note-editor-modal');
  const card = document.getElementById('note-seamless-editor-content');
  if (modal) {
    modal.style.setProperty('--note-theme-color', theme.hex);
    modal.style.setProperty('--note-theme-shadow', theme.shadow);
    modal.style.setProperty('--note-theme-alpha', theme.alpha);
  }
  if (card) {
    card.setAttribute('data-color', _currentEditingNoteColor);
  }

  document.querySelectorAll('#note-color-palette .note-color-swatch').forEach(swatch => {
    const isCurrent = swatch.getAttribute('data-color') === _currentEditingNoteColor;
    swatch.classList.toggle('active', isCurrent);
    swatch.innerHTML = isCurrent ? '<i class="fa-solid fa-check"></i>' : '';
  });

  if (_currentEditingNoteId && typeof autoSaveNoteEditor === 'function') {
    autoSaveNoteEditor();
  }
}
window.selectNoteColor = selectNoteColor;

function updateNoteEditorReminderDisplay() {
  const reminderInput = document.getElementById('note-editor-reminder-input');
  const pill = document.getElementById('note-active-reminder-pill');
  const textEl = document.getElementById('note-active-reminder-text');
  const presetsContainer = document.getElementById('note-reminder-presets-container');
  if (!reminderInput || !pill || !textEl) return;

  if (reminderInput.value) {
    const parts = reminderInput.value.split('T');
    if (parts.length === 2) {
      const dateParts = parts[0].split('-');
      const timeParts = parts[1].split(':');
      if (dateParts.length === 3 && timeParts.length >= 2) {
        const d = new Date(
          parseInt(dateParts[0], 10),
          parseInt(dateParts[1], 10) - 1,
          parseInt(dateParts[2], 10),
          parseInt(timeParts[0], 10),
          parseInt(timeParts[1], 10)
        );
        const day = d.getDate();
        const monthNamesEl = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαϊ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
        const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const m = (state.lang === 'el' ? monthNamesEl : monthNamesEn)[d.getMonth()];
        const hrs = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        textEl.textContent = `${day} ${m}, ${hrs}:${mins}`;
        pill.style.display = 'inline-flex';
        if (presetsContainer) presetsContainer.style.display = 'none';
        return;
      }
    }
  }
  pill.style.display = 'none';
  if (presetsContainer) presetsContainer.style.display = 'flex';
}

function renderNoteReminderPresets() {
  const container = document.getElementById('note-reminder-presets-container');
  if (!container) return;

  const now = new Date();
  const nowHrs = now.getHours();

  // Preset 1: +1 hour
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);
  const in1hTimeStr = `${String(in1h.getHours()).padStart(2, '0')}:${String(in1h.getMinutes()).padStart(2, '0')}`;
  const label1h = state.lang === 'el' ? `⚡ +1 ώρα (${in1hTimeStr})` : `⚡ +1 hr (${in1hTimeStr})`;

  // Preset 2: +3 hours
  const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const in3hTimeStr = `${String(in3h.getHours()).padStart(2, '0')}:${String(in3h.getMinutes()).padStart(2, '0')}`;
  const label3h = state.lang === 'el' ? `⏳ +3 ώρες (${in3hTimeStr})` : `⏳ +3 hrs (${in3hTimeStr})`;

  // Preset 3: Today 20:00 or Tomorrow 20:00
  let eveningDate = new Date();
  let eveningLabel = '';
  if (nowHrs < 19) {
    eveningDate.setHours(20, 0, 0, 0);
    eveningLabel = state.lang === 'el' ? '🌙 Σήμερα 20:00' : '🌙 Today 8 PM';
  } else {
    eveningDate.setDate(eveningDate.getDate() + 1);
    eveningDate.setHours(20, 0, 0, 0);
    eveningLabel = state.lang === 'el' ? '🌙 Αύριο 20:00' : '🌙 Tomorrow 8 PM';
  }

  // Preset 4: Tomorrow Morning 09:00
  let morningDate = new Date();
  morningDate.setDate(morningDate.getDate() + 1);
  morningDate.setHours(9, 0, 0, 0);
  const morningLabel = state.lang === 'el' ? '🌅 Αύριο 09:00' : '🌅 Tomorrow 9 AM';

  const customLabel = state.lang === 'el' ? '📅 Άλλο...' : '📅 Custom...';

  const in1hISO = `${in1h.getFullYear()}-${String(in1h.getMonth() + 1).padStart(2, '0')}-${String(in1h.getDate()).padStart(2, '0')}T${String(in1h.getHours()).padStart(2, '0')}:${String(in1h.getMinutes()).padStart(2, '0')}`;
  const in3hISO = `${in3h.getFullYear()}-${String(in3h.getMonth() + 1).padStart(2, '0')}-${String(in3h.getDate()).padStart(2, '0')}T${String(in3h.getHours()).padStart(2, '0')}:${String(in3h.getMinutes()).padStart(2, '0')}`;
  const eveISO = `${eveningDate.getFullYear()}-${String(eveningDate.getMonth() + 1).padStart(2, '0')}-${String(eveningDate.getDate()).padStart(2, '0')}T20:00`;
  const mornISO = `${morningDate.getFullYear()}-${String(morningDate.getMonth() + 1).padStart(2, '0')}-${String(morningDate.getDate()).padStart(2, '0')}T09:00`;

  container.innerHTML = `
    <button type="button" class="note-reminder-chip" onclick="applyNoteReminderString('${in1hISO}')">${label1h}</button>
    <button type="button" class="note-reminder-chip" onclick="applyNoteReminderString('${in3hISO}')">${label3h}</button>
    <button type="button" class="note-reminder-chip" onclick="applyNoteReminderString('${eveISO}')">${eveningLabel}</button>
    <button type="button" class="note-reminder-chip" onclick="applyNoteReminderString('${mornISO}')">${morningLabel}</button>
    <button type="button" class="note-reminder-chip" onclick="triggerCustomReminderInput()">${customLabel}</button>
  `;
}

function applyNoteReminderString(isoVal) {
  const reminderInput = document.getElementById('note-editor-reminder-input');
  if (reminderInput) {
    reminderInput.value = isoVal;
    updateNoteEditorReminderDisplay();
  }
}
window.applyNoteReminderString = applyNoteReminderString;

function triggerCustomReminderInput() {
  openCustomDatePicker('note-editor-reminder-input');
}
window.triggerCustomReminderInput = triggerCustomReminderInput;

function getUserScopedKey(baseKey) {
  const uid = state.currentUser ? (state.currentUser.id || state.currentUser.email || 'anonymous') : 'guest';
  return `${baseKey}_${uid}`;
}
window.getUserScopedKey = getUserScopedKey;

const PERMANENT_DELETED_NOTES_KEY = 'permanent_deleted_note_ids';

function collectPermanentlyDeletedNoteIds() {
  const excludedIds = new Set();
  const add = (id) => { if (id !== null && id !== undefined && id !== '') excludedIds.add(String(id)); };

  // 1. Durable permanent-delete tombstone list (user-scoped + fallback)
  try {
    const key = getUserScopedKey(PERMANENT_DELETED_NOTES_KEY);
    let raw = localStorage.getItem(key);
    if (!raw && !state.currentUser) {
      raw = localStorage.getItem(PERMANENT_DELETED_NOTES_KEY);
    }
    const perm = raw ? JSON.parse(raw) : [];
    (Array.isArray(perm) ? perm : []).forEach(add);
  } catch (e) { }

  // 2. Any queued 'permanent_delete_note' in the sync queue
  try {
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]') || [];
    queue.forEach(item => {
      if (item && item.action === 'permanent_delete_note' && item.payload) {
        add(item.payload);
      }
    });
  } catch (e) { }

  return excludedIds;
}
window.collectPermanentlyDeletedNoteIds = collectPermanentlyDeletedNoteIds;

function recordPermanentlyDeletedNoteIds(ids, { writeCloudTombstone = true } = {}) {
  if (!ids || ids.length === 0) return;
  const idSet = new Set(ids.map(id => String(id)));

  // 1. Remove immediately from in-memory state.notes
  if (Array.isArray(state.notes)) {
    state.notes = state.notes.filter(n => !(n && idSet.has(String(n.id))));
    saveNotes();
    if (typeof renderNotesList === 'function') renderNotesList();
  }

  // 2. Remove immediately from offline_notes in localStorage
  try {
    const key = getUserScopedKey('offline_notes');
    const cached = JSON.parse(localStorage.getItem(key) || '[]') || [];
    const cleaned = cached.filter(n => !(n && idSet.has(String(n.id))));
    localStorage.setItem(key, JSON.stringify(cleaned));
  } catch (e) { }

  // 3. Remove from deleted_notes_trash in localStorage
  try {
    if (typeof loadNotesTrash === 'function' && typeof saveNotesTrash === 'function') {
      const trash = loadNotesTrash().filter(t => !(t && idSet.has(String(t.id))));
      saveNotesTrash(trash);
    }
  } catch (e) { }

  // 4. Save to durable permanent-delete list (cap at 1000 items)
  try {
    const key = getUserScopedKey(PERMANENT_DELETED_NOTES_KEY);
    let raw = localStorage.getItem(key);
    if (!raw && !state.currentUser) {
      raw = localStorage.getItem(PERMANENT_DELETED_NOTES_KEY);
    }
    const existing = raw ? JSON.parse(raw) : [];
    const set = new Set(Array.isArray(existing) ? existing.map(String) : []);
    idSet.forEach(id => set.add(id));
    const arr = Array.from(set).slice(-1000); // retain last 1000 tombstones
    localStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {
    console.warn('[NotesService] Failed to record permanent-delete note tombstone:', e);
  }

  // 5. Best-effort cloud sync tombstone write
  if (writeCloudTombstone && typeof writeSyncTombstones === 'function' && state.supabaseClient && state.currentUser) {
    writeSyncTombstones('notes', Array.from(idSet)).catch(err => {
      console.warn('[NotesService] Failed to write permanent-delete note tombstone to cloud:', err);
    });
  }
}
window.recordPermanentlyDeletedNoteIds = recordPermanentlyDeletedNoteIds;

function loadNotes() {
  try {
    const key = getUserScopedKey('offline_notes');
    let cached = localStorage.getItem(key);
    if (!cached && !state.currentUser) {
      cached = localStorage.getItem('offline_notes');
    }
    const all = cached ? JSON.parse(cached) : [];
    const permDeleted = collectPermanentlyDeletedNoteIds();
    // Separate any soft-deleted notes into the trash bin and exclude permanently deleted
    const active = [];
    const deleted = [];
    (Array.isArray(all) ? all : []).forEach(n => {
      if (!n || !n.id || permDeleted.has(String(n.id))) return;
      if (n.status === 'deleted') {
        deleted.push(n);
      } else {
        active.push(n);
      }
    });
    state.notes = active;
    if (deleted.length > 0) {
      const trash = loadNotesTrash();
      const trashIds = new Set(trash.map(t => String(t.id)));
      deleted.forEach(n => {
        if (!trashIds.has(String(n.id))) {
          trash.push(n);
          trashIds.add(String(n.id));
        }
      });
      saveNotesTrash(trash);
      // Persist the cleaned active list.
      saveNotes();
    }
  } catch (e) {
    console.error('Failed to parse offline notes:', e);
    state.notes = [];
  }
}

function saveNotes() {
  const key = getUserScopedKey('offline_notes');
  localStorage.setItem(key, JSON.stringify(state.notes || []));
}

let _notesFilterCategory = 'all';
let _notesViewMode = 'grid';

function setNotesFilterCategory(cat) {
  _notesFilterCategory = cat;
  const chips = document.querySelectorAll('#notes-filter-bar .notes-filter-chip');
  chips.forEach(chip => {
    if (chip.getAttribute('data-filter') === cat) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
  renderNotesList();
}

function toggleNotesViewMode() {
  _notesViewMode = _notesViewMode === 'grid' ? 'list' : 'grid';
  const btn = document.getElementById('notes-view-toggle-btn');
  if (btn) {
    btn.innerHTML = _notesViewMode === 'grid' ? '<i class="fa-solid fa-border-all"></i>' : '<i class="fa-solid fa-list"></i>';
  }
  renderNotesList();
}

function renderNotesList() {
  if (typeof translateNotepadUI === 'function') translateNotepadUI();
  const listEl = document.getElementById('notes-manager-list');
  const badgeEl = document.getElementById('notes-manager-count-badge');
  if (!listEl) return;

  const query = (document.getElementById('notes-manager-search-input')?.value || '').trim().toLowerCase();

  // 1. Search Query Filter
  let filtered = state.notes || [];
  if (query) {
    filtered = filtered.filter(note => {
      const titleMatch = (note.title || '').toLowerCase().includes(query);
      let bodyMatch = false;
      if (note.type === 'checklist') {
        const items = getNoteChecklistItems(note);
        bodyMatch = items.some(item => (item.text || '').toLowerCase().includes(query));
      } else {
        bodyMatch = (note.body || '').toLowerCase().includes(query);
      }
      return titleMatch || bodyMatch;
    });
  }

  // 2. Category Filter
  if (_notesFilterCategory === 'pinned') {
    filtered = filtered.filter(n => n.pinned);
  } else if (_notesFilterCategory === 'text') {
    filtered = filtered.filter(n => n.type !== 'checklist');
  } else if (_notesFilterCategory === 'checklist') {
    filtered = filtered.filter(n => n.type === 'checklist');
  } else if (_notesFilterCategory === 'reminder') {
    filtered = filtered.filter(n => !!n.reminder_at);
  }

  // Sort notes: Pinned first, then by updated_at descending
  const sorted = [...filtered].sort((a, b) => {
    const pinA = a.pinned ? 1 : 0;
    const pinB = b.pinned ? 1 : 0;
    if (pinB !== pinA) return pinB - pinA;

    const dateA = new Date(a.updated_at || a.created_at || 0);
    const dateB = new Date(b.updated_at || b.created_at || 0);
    return dateB - dateA;
  });

  // Update badge count
  const hubBadgeEl = document.getElementById('hub-notes-count-badge');
  const totalCount = (state.notes || []).length;
  [badgeEl, hubBadgeEl].forEach(b => {
    if (!b) return;
    if (totalCount > 0) {
      b.textContent = totalCount;
      b.style.display = 'inline-block';
    } else {
      b.style.display = 'none';
    }
  });

  listEl.className = `notes-grid-container ${_notesViewMode === 'grid' ? 'grid-view' : 'list-view'}`;
  listEl.innerHTML = '';

  if (sorted.length === 0) {
    listEl.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 16px; color: var(--text-muted); font-size: 13.5px; font-family: 'Outfit', sans-serif; box-sizing: border-box; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 220px;">
        <div style="width: 58px; height: 58px; border-radius: 50%; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); display: flex; align-items: center; justify-content: center; font-size: 25px; color: #f59e0b; box-shadow: 0 4px 16px rgba(245, 158, 11, 0.15);">
          <i class="fa-regular fa-note-sticky"></i>
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-weight: 700; font-size: 15px; color: var(--text-primary);">${state.lang === 'el' ? 'Δεν υπάρχουν σημειώσεις' : 'No notes found'}</span>
          <span style="font-size: 12px; color: var(--text-muted);">${state.lang === 'el' ? 'Δημιουργήστε την πρώτη σας σημείωση ή checklist!' : 'Create your first note or checklist!'}</span>
        </div>
        <button type="button" onclick="openNoteEditor()" style="margin-top: 4px; padding: 9px 22px; font-size: 13px; font-weight: 700; border-radius: 20px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4); display: flex; align-items: center; gap: 6px; transition: transform 0.15s ease;">
          <i class="fa-solid fa-plus"></i> ${state.lang === 'el' ? 'Δημιουργία Νέας' : 'Create New'}
        </button>
      </div>
    `;
    return;
  }

  let _contextMenuNoteId = null;

  sorted.forEach(note => {
    const card = document.createElement('div');
    card.className = `modern-note-card ${note.pinned ? 'pinned' : ''}`;
    card.setAttribute('data-color', note.color || 'default');

    // Long-Press & Touch Handlers
    let pressTimer = null;
    let isLongPress = false;
    let touchStartX = 0;
    let touchStartY = 0;

    card.addEventListener('touchstart', (e) => {
      isLongPress = false;
      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        isLongPress = true;
        if (navigator.vibrate) {
          try { navigator.vibrate(35); } catch (err) { }
        }
        showNoteContextMenu(note.id);
      }, 380);
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length > 0) {
        const dx = Math.abs(e.touches[0].clientX - touchStartX);
        const dy = Math.abs(e.touches[0].clientY - touchStartY);
        if (dx > 8 || dy > 8) {
          clearTimeout(pressTimer);
        }
      }
    }, { passive: true });

    card.addEventListener('touchend', () => {
      clearTimeout(pressTimer);
    }, { passive: true });

    card.addEventListener('touchcancel', () => {
      clearTimeout(pressTimer);
    });

    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showNoteContextMenu(note.id);
    });

    card.addEventListener('click', (e) => {
      if (isLongPress) {
        isLongPress = false;
        return;
      }
      openNoteEditor(note.id);
    });

    // Header: Title & Pin Button
    const cardHeader = document.createElement('div');
    cardHeader.className = 'note-card-header';

    const titleText = document.createElement('div');
    titleText.className = 'note-card-title';
    titleText.textContent = note.title || (state.lang === 'el' ? 'Χωρίς τίτλο' : 'Untitled');
    cardHeader.appendChild(titleText);

    const pinBtn = document.createElement('button');
    pinBtn.type = 'button';
    pinBtn.className = `note-card-pin-btn ${note.pinned ? 'pinned' : ''}`;
    pinBtn.title = note.pinned ? (state.lang === 'el' ? 'Ξεκαρφίτσωμα' : 'Unpin') : (state.lang === 'el' ? 'Καρφίτσωμα' : 'Pin');
    pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotePinInline(note.id);
    });
    cardHeader.appendChild(pinBtn);
    card.appendChild(cardHeader);

    // Body Content
    const cardBody = document.createElement('div');
    cardBody.className = 'note-card-body';

    if (note.type === 'checklist') {
      const items = getNoteChecklistItems(note);

      if (items.length === 0) {
        cardBody.style.fontStyle = 'italic';
        cardBody.style.color = 'var(--text-muted)';
        cardBody.textContent = state.lang === 'el' ? 'Κενή λίστα...' : 'Empty list...';
        card.appendChild(cardBody);
      } else {
        const previewContainer = document.createElement('div');
        previewContainer.style.cssText = 'display: flex; flex-direction: column; gap: 5px; width: 100%; margin-bottom: 8px;';

        const maxItems = _notesViewMode === 'grid' ? 3 : 5;
        items.slice(0, maxItems).forEach((item, idx) => {
          const row = document.createElement('div');
          row.style.cssText = 'display: flex; align-items: center; gap: 6px; width: 100%;';

          const chk = document.createElement('span');
          chk.style.cssText = 'font-size: 13px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: ' + (item.checked ? 'var(--accent)' : 'var(--text-muted)');
          chk.innerHTML = item.checked ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-regular fa-circle"></i>';
          chk.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleChecklistItemInline(note.id, idx);
          });

          const text = document.createElement('span');
          text.style.cssText = 'font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; ' + (item.checked ? 'text-decoration: line-through; color: var(--text-muted);' : 'color: var(--text-secondary);');
          text.textContent = item.text || '';

          row.appendChild(chk);
          row.appendChild(text);
          previewContainer.appendChild(row);
        });

        if (items.length > maxItems) {
          const moreText = document.createElement('div');
          moreText.style.cssText = 'font-size: 11px; color: var(--text-muted); font-style: italic; margin-left: 19px;';
          moreText.textContent = `+ ${items.length - maxItems} ${state.lang === 'el' ? 'ακόμη' : 'more'}`;
          previewContainer.appendChild(moreText);
        }

        card.appendChild(previewContainer);

        // Progress Bar
        const total = items.length;
        const checked = items.filter(i => i.checked).length;
        const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-top: 4px; width: 100%;';

        const barBg = document.createElement('div');
        barBg.style.cssText = 'flex: 1; height: 4px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden;';

        const barFill = document.createElement('div');
        barFill.style.cssText = `height: 100%; width: ${pct}%; background: ${pct === 100 ? '#10b981' : 'var(--accent)'}; border-radius: 4px; transition: width 0.3s ease;`;
        barBg.appendChild(barFill);

        const label = document.createElement('span');
        label.style.cssText = 'font-size: 10.5px; color: var(--text-muted); font-weight: 700; font-family: \'Outfit\', sans-serif; flex-shrink: 0;';
        label.textContent = `${checked}/${total}`;

        progressContainer.appendChild(barBg);
        progressContainer.appendChild(label);
        card.appendChild(progressContainer);
      }
    } else {
      cardBody.textContent = note.body || (state.lang === 'el' ? 'Κενή σημείωση' : 'Empty note');
      card.appendChild(cardBody);
    }

    // Footer Meta (Date, Reminders, Author Avatar, Type Badge)
    const cardFooter = document.createElement('div');
    cardFooter.className = 'note-card-footer';

    const leftMeta = document.createElement('div');
    leftMeta.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    const authorInitials = getAuthorInitials(note.user_id);
    if (authorInitials) {
      const avatar = document.createElement('div');
      avatar.style.cssText = 'width: 18px; height: 18px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 8.5px; font-weight: 800; color: var(--text-secondary); flex-shrink: 0;';
      avatar.textContent = authorInitials;
      avatar.title = (state.lang === 'el' ? 'Δημιουργήθηκε από: ' : 'Created by: ') + authorInitials;
      leftMeta.appendChild(avatar);
    }

    const timeLabel = document.createElement('span');
    timeLabel.textContent = formatNoteTimestamp(note.updated_at || note.created_at);
    leftMeta.appendChild(timeLabel);
    cardFooter.appendChild(leftMeta);

    const rightMeta = document.createElement('div');
    rightMeta.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    if (note.reminder_at) {
      const remDate = new Date(note.reminder_at);
      const isPast = remDate < new Date();
      const remBadge = document.createElement('span');
      remBadge.className = `note-reminder-badge ${isPast ? 'past' : 'future'}`;
      remBadge.innerHTML = `<i class="fa-regular fa-bell"></i> ${formatNoteTimestamp(note.reminder_at)}`;
      rightMeta.appendChild(remBadge);
    }

    const typeBadge = document.createElement('span');
    typeBadge.className = `note-type-badge ${note.type === 'checklist' ? 'checklist' : ''}`;
    typeBadge.innerHTML = note.type === 'checklist' ? '<i class="fa-solid fa-list-check"></i>' : '<i class="fa-regular fa-file-lines"></i>';
    rightMeta.appendChild(typeBadge);

    cardFooter.appendChild(rightMeta);
    card.appendChild(cardFooter);

    listEl.appendChild(card);
  });
}

// ============================================================
// QUICK ACTIONS CONTEXT MENU (LONG-PRESS / RIGHT-CLICK)
// ============================================================
let _contextMenuNoteId = null;

function showNoteContextMenu(noteId) {
  _contextMenuNoteId = noteId;
  const note = (state.notes || []).find(n => String(n.id) === String(noteId));
  if (!note) return;

  const titleEl = document.getElementById('note-context-title');
  const subEl = document.getElementById('note-context-subtitle');
  const iconEl = document.getElementById('note-context-icon');
  const pinTextEl = document.getElementById('note-context-pin-text');
  const colorContainer = document.getElementById('note-context-color-palette');

  if (titleEl) titleEl.textContent = note.title || (state.lang === 'el' ? 'Χωρίς τίτλο' : 'Untitled');
  if (subEl) subEl.textContent = formatNoteTimestamp(note.updated_at || note.created_at);
  if (iconEl) {
    iconEl.innerHTML = note.type === 'checklist' ? '<i class="fa-solid fa-list-check"></i>' : '<i class="fa-regular fa-file-lines"></i>';
  }
  if (pinTextEl) {
    pinTextEl.textContent = note.pinned
      ? (state.lang === 'el' ? 'Ξεκαρφίτσωμα' : 'Unpin')
      : (state.lang === 'el' ? 'Καρφίτσωμα' : 'Pin');
  }

  if (colorContainer) {
    const colors = ['default', 'amber', 'emerald', 'blue', 'purple', 'rose', 'teal'];
    const curColor = note.color || 'default';
    colorContainer.innerHTML = colors.map(c => {
      const isAct = c === curColor;
      const bgMap = {
        default: 'rgba(255,255,255,0.1)',
        amber: '#f59e0b',
        emerald: '#10b981',
        blue: '#3b82f6',
        purple: '#8b5cf6',
        rose: '#f43f5e',
        teal: '#14b8a6'
      };
      return `<button type="button" class="note-color-swatch ${isAct ? 'active' : ''}" style="background: ${bgMap[c]}; width: 26px; height: 26px;" onclick="quickSetNoteColor('${note.id}', '${c}')">${isAct ? '<i class="fa-solid fa-check" style="font-size: 10px;"></i>' : ''}</button>`;
    }).join('');
  }

  openModal('note-context-menu-modal');
}
window.showNoteContextMenu = showNoteContextMenu;

async function quickSetNoteColor(noteId, color) {
  const note = (state.notes || []).find(n => String(n.id) === String(noteId));
  if (!note) return;

  note.color = color;
  note.updated_at = new Date().toISOString();
  saveNotes();
  renderNotesList();
  showNoteContextMenu(noteId); // refresh active color in context menu
  await upsertNoteToCloud(note);
}
window.quickSetNoteColor = quickSetNoteColor;

async function triggerContextPin() {
  if (!_contextMenuNoteId) return;
  closeModal('note-context-menu-modal');
  await toggleNotePinInline(_contextMenuNoteId);
}
window.triggerContextPin = triggerContextPin;

function triggerContextEdit() {
  if (!_contextMenuNoteId) return;
  const id = _contextMenuNoteId;
  closeModal('note-context-menu-modal');
  openNoteEditor(id);
}
window.triggerContextEdit = triggerContextEdit;

async function triggerContextCopy() {
  if (!_contextMenuNoteId) return;
  const note = (state.notes || []).find(n => String(n.id) === String(_contextMenuNoteId));
  closeModal('note-context-menu-modal');
  if (!note) return;

  let textToCopy = (note.title ? `${note.title}\n\n` : '');
  if (note.type === 'checklist') {
    const items = getNoteChecklistItems(note);
    textToCopy += items.map(i => `${i.checked ? '☑' : '☐'} ${i.text}`).join('\n');
  } else {
    textToCopy += (note.body || '');
  }

  try {
    await navigator.clipboard.writeText(textToCopy);
    if (typeof showToast === 'function') {
      showToast(state.lang === 'el' ? 'Το κείμενο αντιγράφηκε στο πρόχειρο' : 'Note copied to clipboard');
    }
  } catch (err) {
    console.warn('Clipboard write error:', err);
  }
}
window.triggerContextCopy = triggerContextCopy;

function triggerContextReminder() {
  if (!_contextMenuNoteId) return;
  const id = _contextMenuNoteId;
  closeModal('note-context-menu-modal');
  openNoteEditor(id);
  setTimeout(() => {
    toggleNoteEditorReminderTools();
  }, 100);
}
window.triggerContextReminder = triggerContextReminder;

async function triggerContextDelete() {
  if (!_contextMenuNoteId) return;
  const id = _contextMenuNoteId;
  closeModal('note-context-menu-modal');

  const confirmMsg = state.lang === 'el'
    ? 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή τη σημείωση;'
    : 'Are you sure you want to delete this note?';

  const confirmed = (typeof showConfirm === 'function')
    ? await showConfirm(confirmMsg, state.lang === 'el' ? 'Διαγραφή Σημείωσης' : 'Delete Note', '🗑️', { tone: 'amber' })
    : ((typeof window !== 'undefined' && typeof window.showConfirm === 'function')
      ? await window.showConfirm(confirmMsg, state.lang === 'el' ? 'Διαγραφή Σημείωσης' : 'Delete Note', '🗑️', { tone: 'amber' })
      : true);

  if (!confirmed) return;

  await deleteNote(id);
}
window.triggerContextDelete = triggerContextDelete;

// ============================================================
// SEAMLESS NOTE EDITOR (GOOGLE KEEP / APPLE NOTES STYLE)
// ============================================================
let _noteAutoSaveTimer = null;

function _showNoteSaveStatus(text, isSaved = true) {
  const statusEl = document.getElementById('note-editor-save-status');
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = `note-save-status-pill ${isSaved ? 'saved' : ''}`;
  statusEl.style.opacity = '1';
}

function autoSaveNoteEditor() {
  clearTimeout(_noteAutoSaveTimer);
  _showNoteSaveStatus(state.lang === 'el' ? 'Αποθήκευση...' : 'Saving...', false);

  _noteAutoSaveTimer = setTimeout(async () => {
    await saveNoteFromEditor({ silent: true });
    _showNoteSaveStatus('✓ ' + (state.lang === 'el' ? 'Αποθηκεύτηκε' : 'Saved'), true);
  }, 400);
}

function updateNoteEditorMetaFooter() {
  const dateEl = document.getElementById('note-editor-meta-date');
  const countEl = document.getElementById('note-editor-meta-count');
  const titleInput = document.getElementById('note-editor-title-input');
  const bodyInput = document.getElementById('note-editor-body-input');
  const checklistItemsEl = document.getElementById('note-editor-checklist-items');

  if (dateEl) {
    if (_currentEditingNoteId) {
      const note = (state.notes || []).find(n => String(n.id) === String(_currentEditingNoteId));
      if (note) {
        dateEl.textContent = (state.lang === 'el' ? 'Επεξεργασία ' : 'Edited ') + formatNoteTimestamp(note.updated_at || note.created_at);
      }
    } else {
      dateEl.textContent = state.lang === 'el' ? 'Νέα σημείωση' : 'New note';
    }
  }

  if (countEl) {
    if (_currentEditingNoteType === 'checklist') {
      const count = checklistItemsEl ? checklistItemsEl.children.length : 0;
      countEl.textContent = `${count} ${state.lang === 'el' ? 'αντικείμενα' : 'items'}`;
    } else {
      const text = (bodyInput?.value || '').trim();
      const chars = text.length;
      const words = text ? text.split(/\s+/).length : 0;
      countEl.textContent = `${words} ${state.lang === 'el' ? 'λέξεις' : 'words'} · ${chars} ${state.lang === 'el' ? 'χαρ.' : 'chars'}`;
    }
  }
}

function toggleNoteEditorColorPalette() {
  const bar = document.getElementById('note-color-palette-bar');
  const btn = document.getElementById('note-editor-color-toggle-btn');
  if (!bar) return;
  const isHidden = bar.style.display === 'none' || !bar.style.display;
  bar.style.display = isHidden ? 'block' : 'none';
  if (btn) btn.classList.toggle('active', isHidden);
}
window.toggleNoteEditorColorPalette = toggleNoteEditorColorPalette;

function toggleNoteEditorReminderTools() {
  const bar = document.getElementById('note-reminder-tools-bar');
  const btn = document.getElementById('note-editor-reminder-toggle-btn');
  if (!bar) return;
  const isHidden = bar.style.display === 'none' || !bar.style.display;
  bar.style.display = isHidden ? 'block' : 'none';
  if (btn) btn.classList.toggle('active', isHidden);
}
window.toggleNoteEditorReminderTools = toggleNoteEditorReminderTools;

function handleNoteEditorOverlayClick(event) {
  if (event.target && event.target.id === 'note-editor-modal') {
    closeNoteEditor();
  }
}
window.handleNoteEditorOverlayClick = handleNoteEditorOverlayClick;

function openNoteEditor(noteId = null) {
  _currentEditingNoteId = noteId;

  const modal = document.getElementById('note-editor-modal');
  const card = document.getElementById('note-seamless-editor-content');
  const titleInput = document.getElementById('note-editor-title-input');
  const bodyInput = document.getElementById('note-editor-body-input');
  const checklistItemsEl = document.getElementById('note-editor-checklist-items');
  const deleteBtn = document.getElementById('note-editor-delete-btn');
  const colorBar = document.getElementById('note-color-palette-bar');
  const reminderBar = document.getElementById('note-reminder-tools-bar');
  const statusEl = document.getElementById('note-editor-save-status');

  if (!modal || !titleInput || !bodyInput) return;

  if (colorBar) colorBar.style.display = 'none';
  if (reminderBar) reminderBar.style.display = 'none';
  if (statusEl) statusEl.textContent = '';

  titleInput.value = '';
  bodyInput.value = '';
  if (checklistItemsEl) checklistItemsEl.innerHTML = '';
  _currentEditingNotePinned = false;
  _currentEditingNoteType = 'text';

  const reminderInput = document.getElementById('note-editor-reminder-input');
  if (reminderInput) reminderInput.value = '';

  setNoteEditorType('text');

  if (noteId) {
    if (deleteBtn) deleteBtn.style.display = 'flex';

    const note = (state.notes || []).find(n => String(n.id) === String(noteId));
    if (note) {
      titleInput.value = note.title || '';
      _currentEditingNotePinned = !!note.pinned;
      _currentEditingNoteType = note.type || 'text';
      selectNoteColor(note.color || 'default');

      setNoteEditorType(_currentEditingNoteType);

      if (_currentEditingNoteType === 'checklist') {
        let items = [];
        try {
          items = typeof note.body === 'string' ? JSON.parse(note.body || '[]') : (Array.isArray(note.body) ? note.body : []);
        } catch (e) {
          items = [];
        }
        (Array.isArray(items) ? items : []).forEach(item => {
          if (item) addNoteEditorChecklistItemRow(item.text || '', !!item.checked);
        });
      } else {
        bodyInput.value = note.body || '';
      }

      if (note.reminder_at && reminderInput) {
        const remDate = new Date(note.reminder_at);
        if (!isNaN(remDate.getTime())) {
          const yyyy = remDate.getFullYear();
          const mm = String(remDate.getMonth() + 1).padStart(2, '0');
          const dd = String(remDate.getDate()).padStart(2, '0');
          const hh = String(remDate.getHours()).padStart(2, '0');
          const min = String(remDate.getMinutes()).padStart(2, '0');
          reminderInput.value = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
        }
      }
    }
  } else {
    if (deleteBtn) deleteBtn.style.display = 'none';
    selectNoteColor('default');
  }

  // Bind live listeners for auto-save and count update
  titleInput.oninput = () => {
    updateNoteEditorMetaFooter();
    autoSaveNoteEditor();
  };
  bodyInput.oninput = () => {
    updateNoteEditorMetaFooter();
    autoSaveNoteEditor();
  };

  renderNoteReminderPresets();
  updateNoteEditorReminderDisplay();
  updateNoteEditorPinUI();
  updateNoteEditorMetaFooter();
  openModal('note-editor-modal');

  // Auto-focus on text or title
  setTimeout(() => {
    if (!titleInput.value) {
      titleInput.focus();
    } else if (bodyInput && _currentEditingNoteType === 'text') {
      bodyInput.focus();
    }
  }, 120);
}

async function closeNoteEditor() {
  clearTimeout(_noteAutoSaveTimer);
  await saveNoteFromEditor({ silent: true });
  closeModal('note-editor-modal');
}
window.closeNoteEditor = closeNoteEditor;

function setNoteEditorType(type) {
  _currentEditingNoteType = type;

  const textBtn = document.getElementById('note-type-text-btn');
  const checklistBtn = document.getElementById('note-type-checklist-btn');
  const textContainer = document.getElementById('note-editor-text-container');
  const checklistContainer = document.getElementById('note-editor-checklist-container');
  const checklistItemsEl = document.getElementById('note-editor-checklist-items');

  if (type === 'checklist') {
    if (textBtn) textBtn.classList.remove('active');
    if (checklistBtn) checklistBtn.classList.add('active');

    if (textContainer) textContainer.style.display = 'none';
    if (checklistContainer) checklistContainer.style.display = 'flex';

    if (checklistItemsEl && checklistItemsEl.children.length === 0) {
      addNoteEditorChecklistItemRow('', false);
    }
  } else {
    if (textBtn) textBtn.classList.add('active');
    if (checklistBtn) checklistBtn.classList.remove('active');

    if (textContainer) textContainer.style.display = 'flex';
    if (checklistContainer) checklistContainer.style.display = 'none';
  }

  updateNoteEditorMetaFooter();
  if (_currentEditingNoteId) {
    autoSaveNoteEditor();
  }
}

function addNoteEditorChecklistItemRow(text = '', checked = false) {
  const container = document.getElementById('note-editor-checklist-items');
  if (!container) return;

  const row = document.createElement('div');
  row.className = `note-checklist-row ${checked ? 'checked-row' : ''}`;

  // Custom Interactive Round Checkbox
  const chkBox = document.createElement('div');
  chkBox.className = `note-custom-checkbox ${checked ? 'checked' : ''}`;
  chkBox.innerHTML = '<i class="fa-solid fa-check"></i>';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = text;
  input.placeholder = state.lang === 'el' ? 'Στοιχείο λίστας...' : 'List item...';

  chkBox.addEventListener('click', () => {
    const isNowChecked = !chkBox.classList.contains('checked');
    chkBox.classList.toggle('checked', isNowChecked);
    row.classList.toggle('checked-row', isNowChecked);
    autoSaveNoteEditor();
  });

  input.addEventListener('input', () => {
    updateNoteEditorMetaFooter();
    autoSaveNoteEditor();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNoteEditorChecklistItemRow('', false);
      setTimeout(() => {
        const lastRow = container.lastElementChild;
        if (lastRow) {
          const lastInput = lastRow.querySelector('input[type="text"]');
          if (lastInput) lastInput.focus();
        }
      }, 30);
    } else if (e.key === 'Backspace' && !input.value && container.children.length > 1) {
      e.preventDefault();
      const prev = row.previousElementSibling;
      row.remove();
      updateNoteEditorMetaFooter();
      autoSaveNoteEditor();
      if (prev) {
        const prevInput = prev.querySelector('input[type="text"]');
        if (prevInput) prevInput.focus();
      }
    }
  });

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'note-checklist-del';
  delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  delBtn.title = state.lang === 'el' ? 'Διαγραφή' : 'Delete';
  delBtn.addEventListener('click', () => {
    row.remove();
    updateNoteEditorMetaFooter();
    autoSaveNoteEditor();
    if (container.children.length === 0) {
      addNoteEditorChecklistItemRow('', false);
    }
  });

  row.appendChild(chkBox);
  row.appendChild(input);
  row.appendChild(delBtn);
  container.appendChild(row);
}

function addNoteEditorChecklistItem() {
  addNoteEditorChecklistItemRow('', false);
  const container = document.getElementById('note-editor-checklist-items');
  if (container && container.lastElementChild) {
    const input = container.lastElementChild.querySelector('input[type="text"]');
    if (input) input.focus();
  }
}

async function saveNoteFromEditor({ silent = false } = {}) {
  const titleInput = document.getElementById('note-editor-title-input');
  const bodyInput = document.getElementById('note-editor-body-input');
  const checklistItemsEl = document.getElementById('note-editor-checklist-items');

  if (!titleInput || !bodyInput) return;

  let title = titleInput.value.trim();
  let body = '';
  let checklistItems = null;

  if (_currentEditingNoteType === 'checklist') {
    const rows = checklistItemsEl ? checklistItemsEl.querySelectorAll('.note-checklist-row') : [];
    const items = [];
    rows.forEach(row => {
      const chkBox = row.querySelector('.note-custom-checkbox');
      const input = row.querySelector('input[type="text"]');
      if (input && input.value.trim()) {
        items.push({
          text: input.value.trim(),
          checked: chkBox ? chkBox.classList.contains('checked') : false
        });
      }
    });
    checklistItems = items;
    body = JSON.stringify(items);
  } else {
    body = bodyInput.value.trim();
  }

  // If title is empty, derive from body or fallback
  if (!title) {
    if (_currentEditingNoteType === 'checklist' && checklistItems && checklistItems.length > 0) {
      title = checklistItems[0].text.substring(0, 35);
    } else if (body) {
      const firstLine = body.split('\n')[0].trim();
      title = firstLine.substring(0, 35);
    }
  }

  // If note is completely empty and was never saved, ignore silently
  const isCompletelyEmpty = !title && !body && (!checklistItems || checklistItems.length === 0);
  if (isCompletelyEmpty) {
    if (!_currentEditingNoteId) {
      return;
    }
  }

  if (!title) {
    title = state.lang === 'el' ? 'Σημείωση' : 'Note';
  }

  const user_id = state.currentUser ? state.currentUser.id : 'offline-user';
  const family_id = state.userProfile ? state.userProfile.family_id : null;

  const reminderInput = document.getElementById('note-editor-reminder-input');
  let reminderAt = null;
  if (reminderInput && reminderInput.value) {
    reminderAt = new Date(reminderInput.value).toISOString();
  }

  const noteObj = {
    title: title,
    body: body,
    type: _currentEditingNoteType,
    pinned: _currentEditingNotePinned,
    color: _currentEditingNoteColor || 'default',
    user_id: user_id,
    family_id: family_id,
    reminder_at: reminderAt,
    checklist_items: checklistItems,
    status: 'active',
    updated_at: new Date().toISOString()
  };

  if (_currentEditingNoteId) {
    noteObj.id = _currentEditingNoteId;
    const idx = state.notes.findIndex(n => String(n.id) === String(_currentEditingNoteId));
    if (idx !== -1) {
      noteObj.created_at = state.notes[idx].created_at || noteObj.updated_at;
      state.notes[idx] = noteObj;
    }
  } else {
    noteObj.id = generateUUID();
    noteObj.created_at = noteObj.updated_at;
    _currentEditingNoteId = noteObj.id; // promote to active editing id
    state.notes.unshift(noteObj);
  }

  saveNotes();
  scheduleNoteReminder(noteObj);
  renderNotesList();

  // Centralized cloud persistence
  await upsertNoteToCloud(noteObj);
}

async function deleteNoteFromEditor() {
  if (!_currentEditingNoteId) return;

  const confirmMsg = state.lang === 'el'
    ? 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή τη σημείωση;'
    : 'Are you sure you want to delete this note?';

  const confirmed = (typeof showConfirm === 'function')
    ? await showConfirm(confirmMsg, state.lang === 'el' ? 'Διαγραφή Σημείωσης' : 'Delete Note', '🗑️', { tone: 'amber' })
    : ((typeof window !== 'undefined' && typeof window.showConfirm === 'function')
      ? await window.showConfirm(confirmMsg, state.lang === 'el' ? 'Διαγραφή Σημείωσης' : 'Delete Note', '🗑️', { tone: 'amber' })
      : true);

  if (!confirmed) return;

  const id = _currentEditingNoteId;
  _currentEditingNoteId = null; // prevent auto-save on close
  await deleteNote(id);
  closeModal('note-editor-modal');
}

function onNoteReminderChanged() {
  const reminderInput = document.getElementById('note-editor-reminder-input');
  const clearReminderBtn = document.getElementById('note-editor-clear-reminder-btn');
  if (reminderInput && clearReminderBtn) {
    if (reminderInput.value) {
      clearReminderBtn.style.display = 'inline-block';
    } else {
      clearReminderBtn.style.display = 'none';
    }
  }
}

function clearNoteEditorReminder() {
  const reminderInput = document.getElementById('note-editor-reminder-input');
  const clearReminderBtn = document.getElementById('note-editor-clear-reminder-btn');
  if (reminderInput) reminderInput.value = '';
  if (clearReminderBtn) clearReminderBtn.style.display = 'none';
}

// Soft-delete a note: instead of permanently removing the row, we flip its
// status to 'deleted' and record when/who deleted it. This mirrors the
// transactions trash-bin pattern so accidentally-deleted notes can be restored.
async function deleteNote(noteId) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return;

  // Move the note into the local trash bin (kept even when offline).
  // updated_at mirrors deleted_at so the local tombstone and the cloud tombstone
  // (written below) agree on WHEN the note was deleted. Without this, a later
  // LWW merge could read the stale updated_at as "edited after deletion" and
  // resurrect the note from the cloud.
  const deletedAt = new Date().toISOString();
  const deletedNote = {
    ...note,
    status: 'deleted',
    updated_at: deletedAt,
    deleted_at: deletedAt,
    deleted_by: state.currentUser ? state.currentUser.id : null
  };
  const trash = loadNotesTrash();
  trash.push(deletedNote);
  saveNotesTrash(trash);

  // Remove from the active list.
  state.notes = state.notes.filter(n => n.id !== noteId);
  saveNotes();
  cancelNoteReminder(noteId);
  renderNotesList();
  updateNotesTrashBadge();

  // Soft-delete on the cloud (status='deleted' + tombstone timestamps).
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    enqueueSyncMutation('delete_note', noteId);
    try {
      const { error } = await state.supabaseClient
        .from('notes')
        .update({
          status: 'deleted',
          deleted_at: deletedNote.deleted_at,
          deleted_by: state.currentUser.id,
          updated_at: deletedNote.deleted_at
        })
        .match({ id: noteId });
      if (error) {
        console.warn('Supabase note soft-delete error:', error);
      } else {
        dequeueSyncMutation('delete_note', noteId);
      }
    } catch (err) {
      console.warn('Supabase note soft-delete exception:', err);
    }
  }
}

// ============================================================
// NOTES REPOSITORY (centralized data access for the notes subsystem)
// ------------------------------------------------------------
// Consolidates the previously-duplicated `.from('notes')` calls (save, pin,
// checklist toggle, sync) into a single place, and provides the soft-delete /
// trash-bin helpers. This removes the "duplicate sync code" weakness.
// ============================================================

const NOTES_TRASH_KEY = 'deleted_notes_trash';

function loadNotesTrash() {
  try {
    const key = getUserScopedKey(NOTES_TRASH_KEY);
    let raw = localStorage.getItem(key);
    if (!raw && !state.currentUser) {
      raw = localStorage.getItem(NOTES_TRASH_KEY);
    }
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse notes trash:', e);
    return [];
  }
}

function saveNotesTrash(trash) {
  try {
    const key = getUserScopedKey(NOTES_TRASH_KEY);
    localStorage.setItem(key, JSON.stringify(trash || []));
    if (typeof updateNotesTrashBadge === 'function') {
      updateNotesTrashBadge();
    }
  } catch (e) {
    console.error('Failed to save notes trash:', e);
  }
}

// Build the DB record for a note (single source of truth for the upsert shape).
function mapNoteToDb(n, userId, familyId) {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    pinned: !!n.pinned,
    user_id: n.user_id === 'offline-user' ? userId : n.user_id,
    family_id: familyId,
    reminder_at: n.reminder_at || null,
    status: n.status || 'active',
    deleted_at: n.deleted_at || null,
    deleted_by: n.deleted_by || null,
    checklist_items: n.checklist_items || null,
    created_at: n.created_at || new Date().toISOString(),
    updated_at: n.updated_at || new Date().toISOString()
  };
}

// Read a note's checklist items, preferring the structured JSONB column and
// falling back to parsing the legacy JSON-string `body`. This centralizes the
// previously-repeated `JSON.parse(note.body)` logic.
function getNoteChecklistItems(note) {
  if (note && Array.isArray(note.checklist_items)) {
    return note.checklist_items;
  }
  if (note && note.body) {
    try {
      const parsed = JSON.parse(note.body);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { /* not JSON — treat as empty */ }
  }
  return [];
}

// Persist a single note to the cloud (used by save/pin/checklist-toggle).
async function upsertNoteToCloud(note) {
  if (!state.isSupabaseEnabled || !state.supabaseClient || !state.currentUser) return;
  const familyId = state.userProfile ? state.userProfile.family_id : null;
  const record = mapNoteToDb(note, state.currentUser.id, familyId);
  enqueueSyncMutation('save_note', note);
  try {
    const { error } = await state.supabaseClient.from('notes').upsert(record);
    if (error) {
      console.warn('[NotesRepo] upsert error:', error);
    } else {
      dequeueSyncMutation('save_note', note.id);
    }
  } catch (err) {
    console.warn('[NotesRepo] upsert exception:', err);
  }
}

// Build the scope filter (user + family) used by both sync and trash queries.
function buildNotesScopeQuery(baseQuery) {
  const familyId = state.userProfile ? state.userProfile.family_id : null;
  const userId = state.currentUser.id;
  if (familyId) {
    return baseQuery.or(`family_id.eq.${familyId},user_id.eq.${userId}`);
  }
  return baseQuery.eq('user_id', userId);
}

// Conflict-aware merge: for each note id, pick the newest version by
// updated_at. A soft-deleted note (status='deleted') is treated as a
// tombstone — it is excluded from the active list but preserved in the trash.
function mergeNotes(localNotes, remoteNotes) {
  const byId = new Map();

  const ingest = (n) => {
    const existing = byId.get(n.id);
    if (!existing) {
      byId.set(n.id, n);
      return;
    }
    const existingDate = new Date(existing.updated_at || existing.created_at || 0);
    const incomingDate = new Date(n.updated_at || n.created_at || 0);
    if (incomingDate > existingDate) {
      byId.set(n.id, n);
    }
  };

  (localNotes || []).forEach(ingest);
  (remoteNotes || []).forEach(ingest);

  const merged = [];
  const notesToUpsert = [];
  const tombstones = [];

  byId.forEach(n => {
    if (n.status === 'deleted') {
      tombstones.push(n);
    } else {
      merged.push(n);
      // If this note came from local and is newer than what the cloud has,
      // we still push it (the upsert is idempotent). To avoid re-pushing
      // unchanged remote notes, only push notes that are locally dirty.
      if (n._dirty) notesToUpsert.push(n);
    }
  });

  return { merged, notesToUpsert, tombstones };
}

async function syncNotes() {
  if (!state.supabaseClient || !state.currentUser) return;

  const userId = state.currentUser.id;

  try {
    // Fetch active + soft-deleted notes so tombstones propagate across devices.
    let query = state.supabaseClient.from('notes').select('*');
    query = buildNotesScopeQuery(query);
    const { data: remoteNotes, error } = await query;

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01' || error.status === 404) {
        console.log('[NotesSync] notes table not found in database. Skipping notes cloud sync.');
        return;
      }
      console.warn('[NotesSync] error fetching remote notes:', error);
      return;
    }

    if (!remoteNotes) return;

    // Read pending sync queue deletions AND durable permanent-delete tombstones
    // so notes permanently deleted locally while offline or in past sessions
    // are NEVER resurrected by a cloud fetch.
    let pendingDeleteNoteIds = typeof collectPermanentlyDeletedNoteIds === 'function'
      ? collectPermanentlyDeletedNoteIds()
      : new Set();
    try {
      const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]');
      queue.forEach(item => {
        if (item.action === 'permanent_delete_note' || item.action === 'delete_note') {
          if (item.payload) pendingDeleteNoteIds.add(String(item.payload));
        }
      });
    } catch (e) { }

    // Clean up orphaned remote notes that were permanently deleted locally
    const orphanedCloudIds = (remoteNotes || [])
      .filter(n => n && n.id && pendingDeleteNoteIds.has(String(n.id)))
      .map(n => n.id);
    if (orphanedCloudIds.length > 0 && state.supabaseClient) {
      state.supabaseClient
        .from('notes')
        .delete()
        .in('id', orphanedCloudIds)
        .then(() => {
          console.log(`[NotesSync] Cleaned up ${orphanedCloudIds.length} orphaned permanently-deleted notes from cloud.`);
        })
        .catch(err => {
          console.warn('[NotesSync] Failed background cleanup of orphaned notes:', err);
        });
    }

    // Mark local notes as dirty so the merge knows which ones to push back.
    state.notes.forEach(n => { n._dirty = true; });

    const { merged, notesToUpsert, tombstones } = mergeNotes(state.notes, remoteNotes);

    // The local trash bin is authoritative on this device: a note that was
    // soft-deleted here must NOT come back into the active list, even if the
    // remote copy is still active (e.g. the delete happened while offline or in
    // guest mode and its tombstone never reached the cloud). Without this guard
    // the very next sync resurrects trashed notes back into the Notes tab.
    const trash = loadNotesTrash();
    const trashById = new Map(trash.map(t => [String(t.id), t]));
    const resurrected = [];
    const activeNotes = [];
    merged.forEach(n => {
      if (pendingDeleteNoteIds.has(String(n.id))) {
        // Excluded because user deleted it permanently or to trash!
        return;
      }
      const localTomb = trashById.get(String(n.id));
      if (localTomb) {
        // Remember the remote note's last-update time for the conflict check
        // when we decide whether to re-assert the tombstone on the cloud.
        resurrected.push({ tomb: localTomb, remoteUpdatedAt: n.updated_at || n.created_at });
      } else {
        activeNotes.push(n);
      }
    });

    state.notes = activeNotes;
    saveNotes();
    renderNotesList();

    // Fold any remote tombstones into the local trash bin so a note deleted on
    // another device shows up here too.
    if (tombstones.length > 0) {
      const trashIds = new Set(trash.map(t => String(t.id)));
      tombstones.forEach(t => {
        if (pendingDeleteNoteIds.has(String(t.id))) return;
        if (!trashIds.has(String(t.id))) {
          trash.push(t);
          trashIds.add(String(t.id));
        }
      });
      saveNotesTrash(trash);
    }

    // Push local changes (dirty active notes) plus re-asserted tombstones so the
    // cloud ends up in the same state as this device. A tombstone is re-asserted
    // only when this device's delete is newer than the remote note's last update
    // (a newer edit/restore made on another device wins instead and is not
    // clobbered — it stays out of the local active list all the same).
    const familyId = state.userProfile ? state.userProfile.family_id : null;
    const records = notesToUpsert.filter(n => !pendingDeleteNoteIds.has(String(n.id))).map(n => mapNoteToDb(n, userId, familyId));
    if (resurrected.length > 0) {
      const now = new Date().toISOString();
      resurrected.forEach(({ tomb, remoteUpdatedAt }) => {
        if (!tomb || !tomb.id || pendingDeleteNoteIds.has(String(tomb.id))) return;
        const tombTime = new Date(tomb.deleted_at || tomb.updated_at || 0).getTime();
        const remoteTime = new Date(remoteUpdatedAt || 0).getTime();
        if (tombTime < remoteTime) return; // remote is newer — don't clobber
        records.push(mapNoteToDb({
          ...tomb,
          status: 'deleted',
          updated_at: now,
          deleted_at: tomb.deleted_at || now,
          deleted_by: tomb.deleted_by || userId
        }, userId, familyId));
      });
    }
    if (records.length > 0) {
      const { error: upsertError } = await state.supabaseClient
        .from('notes')
        .upsert(records);
      if (upsertError) {
        console.warn('[NotesSync] error pushing local notes to remote:', upsertError);
      }
    }
  } catch (err) {
    console.warn('[NotesSync] unhandled exception during notes sync:', err);
  }
}

// ============================================================
// NOTES TRASH BIN (soft-deleted notes)
// ============================================================

// Fetch soft-deleted notes from the cloud and merge them with the local trash.
async function fetchNotesTrashFromCloud() {
  if (!state.isSupabaseEnabled || !state.supabaseClient || !state.currentUser) return;
  try {
    let query = state.supabaseClient
      .from('notes')
      .select('*')
      .eq('status', 'deleted')
      .order('deleted_at', { ascending: false })
      .limit(100);
    query = buildNotesScopeQuery(query);

    const { data, error } = await promiseTimeout(query, 15000);
    if (error) {
      console.warn('[NotesTrash] cloud fetch error:', error);
      return;
    }

    const cloudItems = data || [];
    const cloudIds = new Set(cloudItems.map(t => String(t.id)));
    const localItems = loadNotesTrash().filter(t => !cloudIds.has(String(t.id)));

    const merged = [...cloudItems, ...localItems];
    saveNotesTrash(merged);
    updateNotesTrashBadge();
    return merged;
  } catch (err) {
    console.warn('[NotesTrash] cloud fetch exception:', err);
  }
}

// Update the badge displaying the number of notes in the trash.
function updateNotesTrashBadge() {
  const badge = document.getElementById('notes-trash-count-badge');
  if (!badge) return;
  const trash = loadNotesTrash();
  const count = Array.isArray(trash) ? trash.length : 0;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}
window.updateNotesTrashBadge = updateNotesTrashBadge;

// Restore a soft-deleted note back to the active list.
async function restoreNote(noteId) {
  const trash = loadNotesTrash();
  const item = trash.find(t => String(t.id) === String(noteId));
  if (!item) return;

  const restored = { ...item };
  delete restored.deleted_at;
  delete restored.deleted_by;
  restored.status = 'active';
  restored.updated_at = new Date().toISOString();

  // Remove from trash, add back to active list immediately.
  saveNotesTrash(trash.filter(t => String(t.id) !== String(noteId)));
  if (!state.notes) state.notes = [];
  // Defensive dedupe: if the note somehow already exists in the active list
  // (e.g. restored on another device while it was still sitting in this trash),
  // drop the old copy first so we never render two entries for one note.
  state.notes = state.notes.filter(n => String(n.id) !== String(noteId));
  state.notes.push(restored);
  saveNotes();
  renderNotesList();
  renderNotesTrashList(false);
  updateNotesTrashBadge();

  enqueueSyncMutation('restore_note', noteId);

  if (typeof showToast === 'function') {
    showToast(state.lang === 'el' ? 'Η σημείωση επαναφέρθηκε' : 'Note restored');
  }

  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      const { error } = await state.supabaseClient
        .from('notes')
        .update({ status: 'active', deleted_at: null, deleted_by: null, updated_at: restored.updated_at })
        .eq('id', noteId);
      if (!error) {
        dequeueSyncMutation('restore_note', noteId);
      }
    } catch (err) {
      console.warn('[NotesTrash] restore exception:', err);
    }
  }
}

// Permanently delete a single note from the trash (local + cloud).
async function deleteNotePermanently(noteId) {
  // 1. Immediately remove locally, record durable tombstone, and re-render without cloud roundtrip
  if (typeof recordPermanentlyDeletedNoteIds === 'function') {
    recordPermanentlyDeletedNoteIds([noteId]);
  }
  const trash = loadNotesTrash().filter(t => String(t.id) !== String(noteId));
  saveNotesTrash(trash);
  renderNotesTrashList(false);
  updateNotesTrashBadge();

  // Enqueue mutation so permanent deletion is durable and survives offline/network retries
  enqueueSyncMutation('permanent_delete_note', noteId);

  if (typeof showToast === 'function') {
    showToast(state.lang === 'el' ? 'Η σημείωση διαγράφηκε οριστικά' : 'Note permanently deleted');
  }

  // 2. Perform background deletion in cloud
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      const { error } = await state.supabaseClient.from('notes').delete().eq('id', noteId);
      if (!error) {
        dequeueSyncMutation('permanent_delete_note', noteId);
      }
    } catch (err) {
      console.warn('[NotesTrash] permanent delete exception:', err);
    }
  }
}

// Empty the entire notes trash bin (local + cloud).
async function emptyNotesTrash() {
  const trash = loadNotesTrash();
  if (!trash || trash.length === 0) {
    if (typeof showToast === 'function') {
      showToast(state.lang === 'el' ? 'Ο κάδος σημειώσεων είναι ήδη άδειος' : 'Notes trash is already empty');
    }
    return;
  }

  const confirmMsg = state.lang === 'el'
    ? 'Είστε σίγουροι ότι θέλετε να αδειάσετε οριστικά όλες τις σημειώσεις από τον κάδο;'
    : 'Are you sure you want to permanently empty all items from the notes trash bin?';

  const confirmed = (typeof showConfirm === 'function')
    ? await showConfirm(confirmMsg, state.lang === 'el' ? 'Εκκαθάριση Κάδου' : 'Empty Trash', '🗑️', { tone: 'amber' })
    : ((typeof window !== 'undefined' && typeof window.showConfirm === 'function')
      ? await window.showConfirm(confirmMsg, state.lang === 'el' ? 'Εκκαθάριση Κάδου' : 'Empty Trash', '🗑️', { tone: 'amber' })
      : true);

  if (!confirmed) return;

  const ids = trash.map(t => t.id).filter(Boolean);

  // 1. Immediately record durable tombstones, clear locally and update UI
  if (typeof recordPermanentlyDeletedNoteIds === 'function') {
    recordPermanentlyDeletedNoteIds(ids);
  }
  saveNotesTrash([]);
  renderNotesTrashList(false);
  updateNotesTrashBadge();

  // Enqueue each deletion into the durable sync queue
  ids.forEach(id => enqueueSyncMutation('permanent_delete_note', id));

  if (typeof showToast === 'function') {
    showToast(state.lang === 'el' ? 'Ο κάδος σημειώσεων άδειασε' : 'Notes trash emptied');
  }

  // 2. Perform batch deletion in cloud
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser && ids.length > 0) {
    try {
      const { error } = await state.supabaseClient.from('notes').delete().in('id', ids);
      if (!error) {
        ids.forEach(id => dequeueSyncMutation('permanent_delete_note', id));
      }
    } catch (err) {
      console.warn('[NotesTrash] empty trash exception:', err);
    }
  }
}

// Render the notes trash bin list inside the trash modal.
async function renderNotesTrashList(syncCloud = false) {
  let items = loadNotesTrash();
  if (syncCloud) {
    const cloudTrash = await fetchNotesTrashFromCloud();
    if (cloudTrash) items = cloudTrash;
  }

  const container = document.getElementById('notes-trash-list-container');
  if (!container) return;

  container.innerHTML = '';

  const btnEmpty = document.getElementById('btn-empty-notes-trash');
  if (btnEmpty) btnEmpty.style.display = items.length === 0 ? 'none' : 'flex';

  updateNotesTrashBadge();

  if (items.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 32px 16px; color: var(--text-secondary); font-size: 14px; line-height: 1.5;">
        ${state.lang === 'el' ? 'Ο κάδος σημειώσεων είναι άδειος.' : 'The notes trash bin is empty.'}
      </div>
    `;
    return;
  }

  const sorted = [...items].sort((a, b) => new Date(b.deleted_at || 0) - new Date(a.deleted_at || 0));

  sorted.forEach(n => {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-card); gap: 12px; box-sizing: border-box; width: 100%;';

    const left = document.createElement('div');
    left.style.cssText = 'display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;';
    left.innerHTML = `
      <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(var(--accent-rgb, 224, 94, 85), 0.12); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
        ${n.type === 'checklist' ? '<i class="fa-solid fa-list-check"></i>' : '<i class="fa-regular fa-file-lines"></i>'}
      </div>
      <div style="display: flex; flex-direction: column; min-width: 0; text-align: left; flex: 1;">
        <span style="font-weight: 700; color: var(--text-primary); font-size: 14px; word-break: break-word; line-height: 1.3;">${escapeHtml(n.title || (state.lang === 'el' ? 'Χωρίς τίτλο' : 'Untitled'))}</span>
        <span style="font-size: 11.5px; color: var(--text-secondary); margin-top: 3px; word-break: break-word; line-height: 1.2;">${formatNoteTimestamp(n.deleted_at || n.updated_at)}</span>
      </div>
    `;

    const right = document.createElement('div');
    right.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-shrink: 0;';
    right.innerHTML = `
      <button class="restore-btn" onclick="restoreNote('${n.id}')" style="background: var(--primary); border: none; color: #ffffff; font-size: 12px; font-weight: 600; cursor: pointer; padding: 6px 12px; border-radius: 8px; transition: opacity 0.2s; outline: none;">
        ${state.lang === 'el' ? 'Επαναφορά' : 'Restore'}
      </button>
      <button onclick="deleteNotePermanently('${n.id}')" style="background: transparent; border: none; color: var(--danger); font-size: 14px; cursor: pointer; padding: 6px; border-radius: 6px;" title="${state.lang === 'el' ? 'Οριστική Διαγραφή' : 'Permanent Delete'}">
        🗑️
      </button>
    `;

    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });
}

function openNotesTrashModal() {
  renderNotesTrashList(true);
  openModal('notes-trash-modal');
}

// Expose to window for HTML onclick handlers.
window.loadNotesTrash = loadNotesTrash;
window.saveNotesTrash = saveNotesTrash;
window.restoreNote = restoreNote;
window.deleteNotePermanently = deleteNotePermanently;
window.emptyNotesTrash = emptyNotesTrash;
window.renderNotesTrashList = renderNotesTrashList;
window.openNotesTrashModal = openNotesTrashModal;
window.updateNotesTrashBadge = updateNotesTrashBadge;

// ============================================================
// CATEGORY BUDGETS SUBSYSTEM (LOAD, SAVE, SYNC)
// ============================================================
function loadBudgets() {
  try {
    const raw = localStorage.getItem('money_manager_budgets');
    state.budgets = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load budgets from localStorage:', e);
    state.budgets = [];
  }
}

function saveBudgets() {
  try {
    localStorage.setItem('money_manager_budgets', JSON.stringify(state.budgets || []));
  } catch (e) {
    console.error('Failed to save budgets to localStorage:', e);
  }
}

async function syncBudgets() {
  if (!state.budgets) state.budgets = [];
  loadBudgets();

  if (!state.supabaseClient || !state.currentUser) return;

  const familyId = state.userProfile ? state.userProfile.family_id : null;
  const userId = state.currentUser.id;

  try {
    let query = state.supabaseClient.from('category_budgets').select('*');
    if (familyId) {
      query = query.or(`family_id.eq.${familyId},user_id.eq.${userId}`);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data: remoteBudgets, error } = await query;

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01' || error.status === 404) {
        console.log('[BudgetsSync] category_budgets table not found in database. Operating in local mode.');
        return;
      }
      console.warn('[BudgetsSync] error fetching remote budgets:', error);
      return;
    }

    if (!remoteBudgets) return;

    const remoteMap = new Map();
    remoteBudgets.forEach(rb => remoteMap.set(rb.id, rb));

    const mergedBudgets = [];
    const budgetsToUpsert = [];

    state.budgets.forEach(localB => {
      const remoteB = remoteMap.get(localB.id);
      if (remoteB) {
        const localDate = new Date(localB.updated_at || localB.created_at || 0);
        const remoteDate = new Date(remoteB.updated_at || remoteB.created_at || 0);

        if (localDate > remoteDate) {
          if (!localB.is_deleted) mergedBudgets.push(localB);
          budgetsToUpsert.push(localB);
        } else {
          if (!remoteB.is_deleted) mergedBudgets.push(remoteB);
        }
        remoteMap.delete(localB.id);
      } else {
        if (!localB.is_deleted) mergedBudgets.push(localB);
        budgetsToUpsert.push(localB);
      }
    });

    remoteMap.forEach(rb => {
      if (!rb.is_deleted) mergedBudgets.push(rb);
    });

    state.budgets = mergedBudgets;
    saveBudgets();

    if (budgetsToUpsert.length > 0) {
      const records = budgetsToUpsert.map(b => ({
        id: b.id,
        user_id: b.user_id === 'offline-user' ? userId : b.user_id,
        family_id: familyId,
        category: b.category,
        subcategory: b.subcategory || '',
        amount: parseFloat(b.amount || 0),
        currency: b.currency || 'EUR',
        period: b.period || 'monthly',
        scope: b.scope || 'personal',
        notify_threshold: b.notify_threshold || 0.8,
        is_deleted: !!b.is_deleted,
        created_at: b.created_at || new Date().toISOString(),
        updated_at: b.updated_at || new Date().toISOString()
      }));

      const { error: upsertError } = await state.supabaseClient
        .from('category_budgets')
        .upsert(records);

      if (upsertError) {
        console.warn('[BudgetsSync] error pushing local budgets to remote:', upsertError);
      }
    }
  } catch (err) {
    console.warn('[BudgetsSync] unhandled exception during budgets sync:', err);
  }
}
window.loadBudgets = loadBudgets;
window.saveBudgets = saveBudgets;
window.syncBudgets = syncBudgets;

function toggleNoteEditorPin() {
  _currentEditingNotePinned = !_currentEditingNotePinned;
  updateNoteEditorPinUI();
}

function updateNoteEditorPinUI() {
  const pinBtn = document.getElementById('note-editor-pin-btn');
  if (!pinBtn) return;

  if (_currentEditingNotePinned) {
    pinBtn.style.color = 'var(--accent)';
    pinBtn.title = state.lang === 'el' ? 'Ξεκαρφίτσωμα' : 'Unpin';
  } else {
    pinBtn.style.color = 'var(--text-muted)';
    pinBtn.title = state.lang === 'el' ? 'Καρφίτσωμα' : 'Pin';
  }
}
window.updateNoteEditorPinUI = updateNoteEditorPinUI;

async function toggleNotePinInline(noteId) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return;

  note.pinned = !note.pinned;
  note.updated_at = new Date().toISOString();

  saveNotes();
  renderNotesList();

  // Centralized cloud persistence.
  await upsertNoteToCloud(note);
}

async function toggleChecklistItemInline(noteId, itemIndex) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note || note.type !== 'checklist') return;

  const items = getNoteChecklistItems(note);

  if (items[itemIndex]) {
    items[itemIndex].checked = !items[itemIndex].checked;
    note.body = JSON.stringify(items);
    // Keep the structured JSONB column in sync with the body string.
    note.checklist_items = items;
    note.updated_at = new Date().toISOString();

    saveNotes();
    renderNotesList();

    // Centralized cloud persistence.
    await upsertNoteToCloud(note);
  }
}

function getAuthorInitials(userId) {
  if (!userId || userId === 'offline-user') return '';
  if (state.currentUser && state.currentUser.id === userId) {
    const name = state.userProfile?.full_name || state.currentUser.email || '';
    if (name.includes('@')) return name.substring(0, 2).toUpperCase();
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }
  const profile = state.familyProfiles?.find(p => p.id === userId);
  if (profile) {
    const name = profile.full_name || '';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }
  if (state.partnerProfile && state.partnerProfile.id === userId) {
    const name = state.partnerProfile.full_name || '';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }
  return '';
}

function formatNoteTimestamp(tsString) {
  if (!tsString) return '';
  try {
    const date = new Date(tsString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();

    const isToday = date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const pad = (n) => String(n).padStart(2, '0');
    const hoursStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

    if (isToday) {
      return state.lang === 'el' ? `Σήμερα, ${hoursStr}` : `Today, ${hoursStr}`;
    }
    if (isYesterday) {
      return state.lang === 'el' ? `Χθες, ${hoursStr}` : `Yesterday, ${hoursStr}`;
    }

    const day = date.getDate();
    const monthsEl = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιούν', 'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthStr = state.lang === 'el' ? monthsEl[date.getMonth()] : monthsEn[date.getMonth()];

    return `${day} ${monthStr}, ${hoursStr}`;
  } catch (e) {
    return '';
  }
}


window.openNoteEditor = openNoteEditor;
window.closeNoteEditor = closeNoteEditor;
window.handleNoteEditorOverlayClick = handleNoteEditorOverlayClick;
window.toggleNoteEditorColorPalette = toggleNoteEditorColorPalette;
window.toggleNoteEditorReminderTools = toggleNoteEditorReminderTools;
window.setNoteEditorType = setNoteEditorType;
window.addNoteEditorChecklistItemRow = addNoteEditorChecklistItemRow;
window.addNoteEditorChecklistItem = addNoteEditorChecklistItem;
window.saveNoteFromEditor = saveNoteFromEditor;
window.deleteNoteFromEditor = deleteNoteFromEditor;
window.toggleNoteEditorPin = toggleNoteEditorPin;
window.renderNotesList = renderNotesList;
window.setNotesFilterCategory = setNotesFilterCategory;
window.toggleNotesViewMode = toggleNotesViewMode;
window.loadNotes = loadNotes;
window.saveNotes = saveNotes;
window.deleteNote = deleteNote;
window.onNoteReminderChanged = onNoteReminderChanged;
window.clearNoteEditorReminder = clearNoteEditorReminder;
window.syncNotes = syncNotes;
window.showNoteContextMenu = showNoteContextMenu;
window.quickSetNoteColor = quickSetNoteColor;
window.triggerContextPin = triggerContextPin;
window.triggerContextEdit = triggerContextEdit;
window.triggerContextCopy = triggerContextCopy;
window.triggerContextReminder = triggerContextReminder;
window.triggerContextDelete = triggerContextDelete;

  // Bind all functions to windowObj for global, onclick & app.js availability
  windowObj.translateNotepadUI = translateNotepadUI;
  windowObj.restoreNoteEditorInitialPosition = restoreNoteEditorInitialPosition;
  windowObj.bindNoteEditorFocusScroll = bindNoteEditorFocusScroll;
  windowObj.selectNoteColor = selectNoteColor;
  windowObj.updateNoteEditorReminderDisplay = updateNoteEditorReminderDisplay;
  windowObj.renderNoteReminderPresets = renderNoteReminderPresets;
  windowObj.applyNoteReminderString = applyNoteReminderString;
  windowObj.triggerCustomReminderInput = triggerCustomReminderInput;
  windowObj.getUserScopedKey = getUserScopedKey;
  windowObj.loadNotes = loadNotes;
  windowObj.saveNotes = saveNotes;
  windowObj.setNotesFilterCategory = setNotesFilterCategory;
  windowObj.toggleNotesViewMode = toggleNotesViewMode;
  windowObj.renderNotesList = renderNotesList;
  windowObj.showNoteContextMenu = showNoteContextMenu;
  windowObj.quickSetNoteColor = quickSetNoteColor;
  windowObj.triggerContextPin = triggerContextPin;
  windowObj.triggerContextEdit = triggerContextEdit;
  windowObj.triggerContextCopy = triggerContextCopy;
  windowObj.triggerContextReminder = triggerContextReminder;
  windowObj.triggerContextDelete = triggerContextDelete;
  windowObj.autoSaveNoteEditor = autoSaveNoteEditor;
  windowObj.updateNoteEditorMetaFooter = updateNoteEditorMetaFooter;
  windowObj.toggleNoteEditorColorPalette = toggleNoteEditorColorPalette;
  windowObj.toggleNoteEditorReminderTools = toggleNoteEditorReminderTools;
  windowObj.handleNoteEditorOverlayClick = handleNoteEditorOverlayClick;
  windowObj.openNoteEditor = openNoteEditor;
  windowObj.closeNoteEditor = closeNoteEditor;
  windowObj.setNoteEditorType = setNoteEditorType;
  windowObj.addNoteEditorChecklistItemRow = addNoteEditorChecklistItemRow;
  windowObj.addNoteEditorChecklistItem = addNoteEditorChecklistItem;
  windowObj.saveNoteFromEditor = saveNoteFromEditor;
  windowObj.deleteNoteFromEditor = deleteNoteFromEditor;
  windowObj.onNoteReminderChanged = onNoteReminderChanged;
  windowObj.clearNoteEditorReminder = clearNoteEditorReminder;
  windowObj.deleteNote = deleteNote;
  windowObj.loadNotesTrash = loadNotesTrash;
  windowObj.saveNotesTrash = saveNotesTrash;
  windowObj.mapNoteToDb = mapNoteToDb;
  windowObj.getNoteChecklistItems = getNoteChecklistItems;
  windowObj.upsertNoteToCloud = upsertNoteToCloud;
  windowObj.buildNotesScopeQuery = buildNotesScopeQuery;
  windowObj.mergeNotes = mergeNotes;
  windowObj.syncNotes = syncNotes;
  windowObj.fetchNotesTrashFromCloud = fetchNotesTrashFromCloud;
  windowObj.updateNotesTrashBadge = updateNotesTrashBadge;
  windowObj.restoreNote = restoreNote;
  windowObj.deleteNotePermanently = deleteNotePermanently;
  windowObj.emptyNotesTrash = emptyNotesTrash;
  windowObj.renderNotesTrashList = renderNotesTrashList;
  windowObj.openNotesTrashModal = openNotesTrashModal;
  windowObj.loadBudgets = loadBudgets;
  windowObj.saveBudgets = saveBudgets;
  windowObj.syncBudgets = syncBudgets;
  windowObj.toggleNoteEditorPin = toggleNoteEditorPin;
  windowObj.updateNoteEditorPinUI = updateNoteEditorPinUI;
  windowObj.toggleNotePinInline = toggleNotePinInline;
  windowObj.collectPermanentlyDeletedNoteIds = collectPermanentlyDeletedNoteIds;
  windowObj.recordPermanentlyDeletedNoteIds = recordPermanentlyDeletedNoteIds;
  windowObj.getAuthorInitials = getAuthorInitials;
  windowObj.formatNoteTimestamp = formatNoteTimestamp;

  // Return module exports for Node / CommonJS
  return {
    translateNotepadUI: translateNotepadUI,
    restoreNoteEditorInitialPosition: restoreNoteEditorInitialPosition,
    bindNoteEditorFocusScroll: bindNoteEditorFocusScroll,
    selectNoteColor: selectNoteColor,
    updateNoteEditorReminderDisplay: updateNoteEditorReminderDisplay,
    renderNoteReminderPresets: renderNoteReminderPresets,
    applyNoteReminderString: applyNoteReminderString,
    triggerCustomReminderInput: triggerCustomReminderInput,
    getUserScopedKey: getUserScopedKey,
    collectPermanentlyDeletedNoteIds: collectPermanentlyDeletedNoteIds,
    recordPermanentlyDeletedNoteIds: recordPermanentlyDeletedNoteIds,
    loadNotes: loadNotes,
    saveNotes: saveNotes,
    setNotesFilterCategory: setNotesFilterCategory,
    toggleNotesViewMode: toggleNotesViewMode,
    renderNotesList: renderNotesList,
    showNoteContextMenu: showNoteContextMenu,
    quickSetNoteColor: quickSetNoteColor,
    triggerContextPin: triggerContextPin,
    triggerContextEdit: triggerContextEdit,
    triggerContextCopy: triggerContextCopy,
    triggerContextReminder: triggerContextReminder,
    triggerContextDelete: triggerContextDelete,
    autoSaveNoteEditor: autoSaveNoteEditor,
    updateNoteEditorMetaFooter: updateNoteEditorMetaFooter,
    toggleNoteEditorColorPalette: toggleNoteEditorColorPalette,
    toggleNoteEditorReminderTools: toggleNoteEditorReminderTools,
    handleNoteEditorOverlayClick: handleNoteEditorOverlayClick,
    openNoteEditor: openNoteEditor,
    closeNoteEditor: closeNoteEditor,
    setNoteEditorType: setNoteEditorType,
    addNoteEditorChecklistItemRow: addNoteEditorChecklistItemRow,
    addNoteEditorChecklistItem: addNoteEditorChecklistItem,
    saveNoteFromEditor: saveNoteFromEditor,
    deleteNoteFromEditor: deleteNoteFromEditor,
    onNoteReminderChanged: onNoteReminderChanged,
    clearNoteEditorReminder: clearNoteEditorReminder,
    deleteNote: deleteNote,
    loadNotesTrash: loadNotesTrash,
    saveNotesTrash: saveNotesTrash,
    mapNoteToDb: mapNoteToDb,
    getNoteChecklistItems: getNoteChecklistItems,
    upsertNoteToCloud: upsertNoteToCloud,
    buildNotesScopeQuery: buildNotesScopeQuery,
    mergeNotes: mergeNotes,
    syncNotes: syncNotes,
    fetchNotesTrashFromCloud: fetchNotesTrashFromCloud,
    updateNotesTrashBadge: updateNotesTrashBadge,
    restoreNote: restoreNote,
    deleteNotePermanently: deleteNotePermanently,
    emptyNotesTrash: emptyNotesTrash,
    renderNotesTrashList: renderNotesTrashList,
    openNotesTrashModal: openNotesTrashModal,
    loadBudgets: loadBudgets,
    saveBudgets: saveBudgets,
    syncBudgets: syncBudgets,
    toggleNoteEditorPin: toggleNoteEditorPin,
    updateNoteEditorPinUI: updateNoteEditorPinUI,
    toggleNotePinInline: toggleNotePinInline,
    toggleChecklistItemInline: toggleChecklistItemInline,
    getAuthorInitials: getAuthorInitials,
    formatNoteTimestamp: formatNoteTimestamp
  };
});
