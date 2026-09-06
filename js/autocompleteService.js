/**
 * js/autocompleteService.js
 *
 * Note Field Smart Autocomplete Subsystem (Greeklish, Multi-Word, Quick Picks).
 * Extracted from app.js (Phase 7 Architectural Domain Extraction).
 *
 * Features:
 * - Real-time phonetic Greeklish mapper (diphthongs, accents, transliteration)
 * - Multi-word diacritic-insensitive query matcher with final sigma normalization
 * - Keyword match highlighter
 * - Recency and frequency scoring prioritizing recurring templates
 * - Dynamic positioning dropdown with responsive touch/click selection
 * - Auto-fills Note, Category, Subcategory, and Account from historical picks
 * - Preference toggles (settings_autocomplete_enabled, settings_note_shortcut_enabled)
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

  var windowObj = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
  var window = windowObj;

function greekToGreeklish(text) {
  if (!text) return '';
  let str = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const pairs = [
    [/ου/g, 'ou'], [/αι/g, 'ai'], [/ει/g, 'ei'], [/οι/g, 'oi'],
    [/υι/g, 'yi'], [/αυ/g, 'av'], [/ευ/g, 'ev'], [/ηυ/g, 'iv'],
    [/μπ/g, 'b'], [/ντ/g, 'd'], [/γκ/g, 'g'], [/γγ/g, 'ng'],
    [/τσ/g, 'ts'], [/τζ/g, 'tz'], [/θ/g, 'th'], [/ch/g, 'x'],
    [/ph/g, 'f'], [/ps/g, 'ps'], [/ks/g, 'x'], [/sh/g, 's']
  ];
  pairs.forEach(([re, repl]) => { str = str.replace(re, repl); });
  const map = {
    'α':'a', 'β':'v', 'γ':'g', 'δ':'d', 'ε':'e', 'ζ':'z', 'η':'i', 'θ':'th',
    'ι':'i', 'κ':'k', 'λ':'l', 'μ':'m', 'ν':'n', 'ξ':'x', 'ο':'o', 'π':'p',
    'ρ':'r', 'σ':'s', 'ς':'s', 'τ':'t', 'υ':'y', 'φ':'f', 'χ':'x', 'ψ':'ps', 'ω':'o'
  };
  return str.split('').map(c => map[c] || c).join('');
}

function matchesQuery(target, query) {
  if (!query) return true;
  const normTargetGreek = target.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ς/g, 'σ');
  const normTargetGlish = greekToGreeklish(target);

  const rawWords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return true;

  return rawWords.every(w => {
    const wNorm = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ς/g, 'σ');
    const wGlish = greekToGreeklish(w);
    return normTargetGreek.includes(wNorm) || normTargetGlish.includes(wGlish) || normTargetGlish.includes(wNorm);
  });
}

function highlightMatch(text, query) {
  if (!query) return text;
  const rawWords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let result = text;
  rawWords.forEach(w => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const regex = new RegExp('(' + escaped + ')', 'gi');
      result = result.replace(regex, '<span class="note-match-highlight">$1</span>');
    } catch (e) { }
  });
  return result;
}

function getAdvancedNotes(query) {
  const allTransactions = state.transactions || [];
  const noteDetails = new Map();

  // 1. Scan transactions (recent first, count frequency)
  const sortFn = (typeof compareTransactions === 'function')
    ? compareTransactions
    : (a, b) => new Date(b.date || 0) - new Date(a.date || 0);
  const sortedTrans = [...allTransactions].sort(sortFn);

  for (const t of sortedTrans) {
    const title = (t.note || t.description || '').trim();
    if (!title) continue;
    const titleLower = title.toLowerCase();
    if (!noteDetails.has(titleLower)) {
      noteDetails.set(titleLower, {
        title: title,
        category: t.category || '',
        subcategory: t.subcategory || '',
        account: t.account_from || t.account || '',
        count: 1
      });
    } else {
      const existing = noteDetails.get(titleLower);
      existing.count = (existing.count || 1) + 1;
    }
  }

  // 2. Scan recurring templates to make sure items like "ΕΝΟΙΚΙΟ ΓΡΑΦΕΙΟΥ 2026", "ΕΝΦΙΑ" are suggested
  const templates = state.recurringTemplates || [];
  for (const tmpl of templates) {
    const title = (tmpl.note || '').trim();
    if (!title) continue;
    const titleLower = title.toLowerCase();
    if (!noteDetails.has(titleLower)) {
      noteDetails.set(titleLower, {
        title: title,
        category: tmpl.category || '',
        subcategory: tmpl.subcategory || '',
        account: tmpl.account_from || '',
        count: 5 // Prioritize recurring templates
      });
    }
  }

  const q = (query || '').trim();
  const allItems = Array.from(noteDetails.values());

  if (!q) {
    // Quick Picks: Top 5 most frequent on empty query
    return allItems.sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 5);
  }

  const suggestions = allItems.filter(item => matchesQuery(item.title, q));

  suggestions.sort((a, b) => {
    const aNorm = a.title.toLowerCase();
    const bNorm = b.title.toLowerCase();
    const qLower = q.toLowerCase();
    const aStarts = aNorm.startsWith(qLower);
    const bStarts = bNorm.startsWith(qLower);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return (b.count || 0) - (a.count || 0);
  });

  return suggestions.slice(0, 6);
}

function renderNoteAutocomplete(query) {
  const dropdown = document.getElementById('note-autocomplete-dropdown');
  if (!dropdown) return;

  const autocompleteEnabled = localStorage.getItem('settings_autocomplete_enabled') !== 'false';
  if (!autocompleteEnabled) {
    dropdown.style.display = 'none';
    return;
  }

  const q = (query || '').trim();
  const filtered = getAdvancedNotes(q);

  if (filtered.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  // Dynamic positioning: open downwards if container is near the top
  const container = document.querySelector('.title-input-container');
  if (container) {
    const rect = container.getBoundingClientRect();
    if (rect.top < 220) {
      dropdown.style.bottom = 'auto';
      dropdown.style.top = 'calc(100% + 8px)';
      dropdown.style.boxShadow = '0 14px 40px rgba(0, 0, 0, 0.75)';
    } else {
      dropdown.style.bottom = 'calc(100% + 8px)';
      dropdown.style.top = 'auto';
      dropdown.style.boxShadow = '0 -14px 40px rgba(0, 0, 0, 0.75)';
    }
  }

  dropdown.innerHTML = '';

  const isEl = (state.lang || 'el') === 'el';
  const header = document.createElement('div');
  header.className = 'note-autocomplete-header';
  header.innerHTML = q
    ? `<span>${isEl ? 'Προτάσεις' : 'Suggestions'}</span><span style="color:#38bdf8;font-size:10px;"><i class="fa-solid fa-wand-magic-sparkles"></i> Greeklish</span>`
    : `<span>${isEl ? 'Συχνές κινήσεις (Quick Picks)' : 'Recent Quick Picks'}</span><span style="color:#38bdf8;font-size:10px;"><i class="fa-solid fa-bolt"></i> Auto-fill</span>`;
  dropdown.appendChild(header);

  filtered.forEach(suggestion => {
    const item = document.createElement('div');
    item.className = 'note-autocomplete-item';

    let categoryBadgeHTML = '';
    if (suggestion.category) {
      const catCleanName = getCategoryDisplayName(suggestion.category);
      const iconHtml = (typeof renderCategoryIconHtml === 'function')
        ? renderCategoryIconHtml(suggestion.category, { size: 'inline' })
        : '<i class="fa-solid fa-shapes"></i>';
      categoryBadgeHTML = `<span class="note-category-pill" style="font-size: 11px; opacity: 0.85; padding: 2px 7px; background: rgba(255,255,255,0.06); border-radius: 8px; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;">${iconHtml} ${catCleanName}</span>`;
    }

    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;">
        <i class="fa-solid ${q ? 'fa-magnifying-glass' : 'fa-clock-rotate-left'}" style="color:var(--text-muted);font-size:11px;flex-shrink:0;"></i>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;">${highlightMatch(suggestion.title, q)}</span>
      </div>
      ${categoryBadgeHTML}`;

    // Prevent focus loss before selection on touch / click
    item.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      window.autocompleteJustSelected = true;
      setTimeout(() => {
        window.autocompleteJustSelected = false;
      }, 400);

      const noteInput = document.getElementById('trans-note');
      if (noteInput) {
        noteInput.value = suggestion.title;
        noteInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Auto-select Category, Subcategory, and Account
      if (suggestion.category) {
        let catObj = state.categories.find(c => c.name === suggestion.category);
        if (!catObj) {
          const cleanSug = stripLeadingEmoji(suggestion.category).trim().toUpperCase();
          catObj = state.categories.find(c => stripLeadingEmoji(c.name).trim().toUpperCase() === cleanSug);
        }
        if (catObj) {
          selectCategory(catObj.name, catObj.icon, catObj.color, false);
        } else {
          selectCategory(suggestion.category, '🧩', 'var(--accent)', false);
        }
      }
      if (suggestion.subcategory) {
        hideSubcategorySelect();
        selectSubcategory(suggestion.subcategory);
      }
      if (suggestion.account) {
        const accInput = document.getElementById('trans-account-from');
        if (accInput) {
          accInput.value = suggestion.account;
          updateAccountTriggerDisplay('from');
        }
      }

      closeNoteAutocomplete();
    });

    dropdown.appendChild(item);
  });

  dropdown.style.display = 'block';
}

function closeNoteAutocomplete() {
  const dropdown = document.getElementById('note-autocomplete-dropdown');
  if (dropdown) dropdown.style.display = 'none';
}

function initNoteAutocomplete() {
  const noteInput = document.getElementById('trans-note');
  const dropdown = document.getElementById('note-autocomplete-dropdown');
  if (!noteInput || !dropdown) return;

  if (noteInput.dataset.autocompleteBound === 'true') {
    return;
  }
  noteInput.dataset.autocompleteBound = 'true';

  noteInput.addEventListener('focus', () => {
    renderNoteAutocomplete(noteInput.value);
  });

  noteInput.addEventListener('input', () => {
    renderNoteAutocomplete(noteInput.value);
  });

  noteInput.addEventListener('blur', () => {
    setTimeout(closeNoteAutocomplete, 220);
  });

  noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNoteAutocomplete();
  });
}


function toggleAutocompleteSetting(enabled) {
  localStorage.setItem('settings_autocomplete_enabled', enabled ? 'true' : 'false');
}

function toggleNoteShortcutSetting(enabled) {
  localStorage.setItem('settings_note_shortcut_enabled', enabled ? 'true' : 'false');
  updateNoteShortcutVisibility();
}

function updateNoteShortcutVisibility() {
  const noteShortcutEnabled = localStorage.getItem('settings_note_shortcut_enabled') === 'true';
  const fabNote = document.getElementById('fab-note-btn');
  if (fabNote) {
    if (noteShortcutEnabled && state.activeTab === 'trans' && !state.selectionMode) {
      fabNote.style.display = 'flex';
    } else {
      fabNote.style.display = 'none';
    }
  }
}
  // Bind to windowObj for global & inline HTML onclick availability
  windowObj.greekToGreeklish = greekToGreeklish;
  windowObj.matchesQuery = matchesQuery;
  windowObj.highlightMatch = highlightMatch;
  windowObj.getAdvancedNotes = getAdvancedNotes;
  windowObj.renderNoteAutocomplete = renderNoteAutocomplete;
  windowObj.closeNoteAutocomplete = closeNoteAutocomplete;
  windowObj.initNoteAutocomplete = initNoteAutocomplete;
  windowObj.toggleAutocompleteSetting = toggleAutocompleteSetting;
  windowObj.toggleNoteShortcutSetting = toggleNoteShortcutSetting;
  windowObj.updateNoteShortcutVisibility = updateNoteShortcutVisibility;

  // Return module exports for Node / CommonJS
  return {
    greekToGreeklish: greekToGreeklish,
    matchesQuery: matchesQuery,
    highlightMatch: highlightMatch,
    getAdvancedNotes: getAdvancedNotes,
    renderNoteAutocomplete: renderNoteAutocomplete,
    closeNoteAutocomplete: closeNoteAutocomplete,
    initNoteAutocomplete: initNoteAutocomplete,
    toggleAutocompleteSetting: toggleAutocompleteSetting,
    toggleNoteShortcutSetting: toggleNoteShortcutSetting,
    updateNoteShortcutVisibility: updateNoteShortcutVisibility
  };
});
