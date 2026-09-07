/**
 * templateAssociationService.js - Recurring Template Deduplication & Transaction Association
 * Handles multi-source template merging (cloud + local + sync queue), content-based deduplication,
 * cross-language category matching, deterministic UUID generation, transaction-to-template resolution,
 * and database backfilling for recurring template foreign keys.
 *
 * Extracted in Phase 30B Architectural Modularization
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TemplateAssociationService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getState() {
    if (typeof window !== 'undefined' && window.state) return window.state;
    if (typeof state !== 'undefined') return state;
    return { recurringTemplates: [], transactions: [] };
  }

  function _safeNormalizeGreek(str) {
    if (typeof normalizeGreekString === 'function') return normalizeGreekString(str);
    if (typeof window !== 'undefined' && typeof window.normalizeGreekString === 'function') {
      return window.normalizeGreekString(str);
    }
    return String(str || '').toLowerCase().trim();
  }

  function _safeNormalizeString(str) {
    if (typeof normalizeString === 'function') return normalizeString(str);
    if (typeof window !== 'undefined' && typeof window.normalizeString === 'function') {
      return window.normalizeString(str);
    }
    return String(str || '').toUpperCase().trim();
  }

  function _safeStripEmoji(str) {
    if (typeof stripLeadingEmoji === 'function') return stripLeadingEmoji(str);
    if (typeof window !== 'undefined' && typeof window.stripLeadingEmoji === 'function') {
      return window.stripLeadingEmoji(str);
    }
    return String(str || '').trim();
  }

  function isSameCategory(catA, catB) {
    if (!catA && !catB) return true;
    if (!catA || !catB) return false;
    if (catA === catB) return true;

    const normA = _safeNormalizeString(_safeStripEmoji(String(catA)).trim());
    const normB = _safeNormalizeString(_safeStripEmoji(String(catB)).trim());
    if (normA && normB && normA === normB) return true;

    const translations = (typeof CATEGORY_NAME_TRANSLATIONS !== 'undefined')
      ? CATEGORY_NAME_TRANSLATIONS
      : ((typeof window !== 'undefined' && window.CATEGORY_NAME_TRANSLATIONS) || {});

    for (const [elKey, enVal] of Object.entries(translations)) {
      const normEl = _safeNormalizeString(_safeStripEmoji(elKey).trim());
      const normEn = _safeNormalizeString(_safeStripEmoji(enVal).trim());

      const aMatches = (normA === normEl || normA === normEn);
      const bMatches = (normB === normEl || normB === normEn);

      if (aMatches && bMatches) {
        return true;
      }
    }

    return false;
  }

  function generateDeterministicUUID(templateId, dateString) {
    const str = `rec_${templateId}_${dateString}`;
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x7fed211a, h4 = 0x12345678;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
      h3 = Math.imul(h3 ^ ch, 3812015801);
      h4 = Math.imul(h4 ^ ch, 2718281829);
    }
    const toHex = (n) => (n >>> 0).toString(16).padStart(8, '0');
    const hex = toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  }

  function mergeAndDeduplicateTemplates(cloudTemplates = [], localTemplates = []) {
    const templateMap = new Map();

    // 1. First add all cloud templates
    (cloudTemplates || []).forEach(t => {
      if (t && t.id) {
        templateMap.set(String(t.id), t);
      }
    });

    // 2. Identify sync queue state
    const queueStr = (typeof localStorage !== 'undefined') ? localStorage.getItem('money_manager_sync_queue') : null;
    const queuedTemplateIds = new Set();
    const deletedTemplateIds = new Set();
    if (queueStr) {
      try {
        const q = JSON.parse(queueStr) || [];
        q.forEach(item => {
          if (!item) return;
          if (item.action === 'save_template' && item.payload && item.payload.id) {
            queuedTemplateIds.add(String(item.payload.id));
          } else if (item.action === 'delete_template') {
            deletedTemplateIds.add(String(item.payload.id || item.payload));
          }
        });
      } catch (e) { }
    }

    // 3. Merge local templates: keep if not in cloud yet, or if queued for save
    (localTemplates || []).forEach(t => {
      if (!t || !t.id) return;
      const idStr = String(t.id);
      if (deletedTemplateIds.has(idStr)) return;

      if (!templateMap.has(idStr) || queuedTemplateIds.has(idStr)) {
        templateMap.set(idStr, t);
      }
    });

    // 4. Remove any template that has a pending delete
    deletedTemplateIds.forEach(delId => {
      templateMap.delete(delId);
    });

    // 5. Deduplicate by content (note/title + amount + type + category + preset)
    const normStr = (s) => _safeNormalizeGreek(s || '');
    const rawList = Array.from(templateMap.values());
    const deduped = [];
    const removedDuplicateTemplateIds = new Set();

    rawList.forEach(t => {
      if (!t) return;
      const tNote = normStr(t.note || t.description || t.title || '');
      const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
      const tType = t.type;
      const tCat = t.category;
      const tPreset = t.preset || 'custom';

      const matchIdx = deduped.findIndex(other => {
        if (!other) return false;
        if (String(t.id) === String(other.id)) return true;
        const oNote = normStr(other.note || other.description || other.title || '');
        const oAmount = (parseFloat(other.amount) || 0).toFixed(2);
        const oType = other.type;
        const oCat = other.category;
        const oPreset = other.preset || 'custom';

        const sameNote = (tNote.length > 0 && oNote.length > 0) ? (tNote === oNote) : (tNote.length === 0 && oNote.length === 0);
        const sameAmount = tAmount === oAmount;
        const sameType = tType === oType;
        const sameCat = isSameCategory(tCat, oCat);
        const samePreset = tPreset === oPreset;

        return sameNote && sameAmount && sameType && sameCat && samePreset;
      });

      if (matchIdx === -1) {
        deduped.push(t);
      } else {
        if (t.id) removedDuplicateTemplateIds.add(String(t.id));
      }
    });

    // If duplicate templates were removed, purge synthetic occurrences belonging to the duplicate IDs
    const appState = (typeof getState === 'function') ? getState() : (typeof state !== 'undefined' ? state : ((typeof window !== 'undefined' && window.state) ? window.state : {}));
    if (removedDuplicateTemplateIds.size > 0 && Array.isArray(appState.transactions)) {
      appState.transactions = appState.transactions.filter(tx => !removedDuplicateTemplateIds.has(String(tx.recurring_template_id)));
    }

    return deduped;
  }

  function cleanDuplicateTemplates() {
    const appState = (typeof getState === 'function') ? getState() : (typeof state !== 'undefined' ? state : ((typeof window !== 'undefined' && window.state) ? window.state : {}));
    if (!appState.recurringTemplates || appState.recurringTemplates.length < 2) return;

    const deduped = [];
    const removedIds = new Set();

    for (const t of appState.recurringTemplates) {
      if (!t) continue;
      const tNote = _safeNormalizeGreek(t.note || t.description || t.title || '');
      const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
      const tType = t.type;
      const tCat = t.category;
      const tPreset = t.preset || 'custom';

      const isDup = deduped.some(other => {
        if (String(t.id) === String(other.id)) return true;
        const oNote = _safeNormalizeGreek(other.note || other.description || other.title || '');
        const oAmount = (parseFloat(other.amount) || 0).toFixed(2);
        const oType = other.type;
        const oCat = other.category;
        const oPreset = other.preset || 'custom';

        const sameNote = (tNote.length > 0 && oNote.length > 0) ? (tNote === oNote) : (tNote.length === 0 && oNote.length === 0);
        const sameAmount = tAmount === oAmount;
        const sameType = tType === oType;
        const sameCat = isSameCategory(tCat, oCat);
        const samePreset = tPreset === oPreset;

        return sameNote && sameAmount && sameType && sameCat && samePreset;
      });

      if (!isDup) {
        deduped.push(t);
      } else {
        if (t.id) removedIds.add(String(t.id));
      }
    }

    appState.recurringTemplates = deduped;
    if (removedIds.size > 0 && Array.isArray(appState.transactions)) {
      appState.transactions = appState.transactions.filter(tx => !removedIds.has(String(tx.recurring_template_id)));
    }
  }

  function resolveRecurringTemplateForTx(tx) {
    if (!tx) return null;
    const appState = (typeof getState === 'function') ? getState() : (typeof state !== 'undefined' ? state : ((typeof window !== 'undefined' && window.state) ? window.state : {}));
    const templates = appState.recurringTemplates || [];
    if (templates.length === 0) return null;

    if (tx.recurring_template_id) {
      const found = templates.find(t => String(t.id) === String(tx.recurring_template_id));
      if (found) return found;
    }

    const txAmount = (parseFloat(tx.amount) || 0).toFixed(2);
    const txType = tx.type;
    const txNote = (tx.note || tx.description || '').trim().toLowerCase();

    return templates.find(template => {
      if (tx.recurring_template_id && String(tx.recurring_template_id) === String(template.id)) return true;
      const tAmount = (parseFloat(template.amount) || 0).toFixed(2);
      const tType = template.type;
      const tNote = (template.note || template.description || '').trim().toLowerCase();

      if (txAmount === tAmount && txType === tType) {
        if (isSameCategory(tx.category, template.category)) return true;
        if (txNote && tNote && txNote === tNote) return true;
      }
      return false;
    }) || null;
  }

  function isTransactionRecurring(tx) {
    return !!resolveRecurringTemplateForTx(tx);
  }

  function backfillRecurringTemplateIds() {
    const appState = (typeof getState === 'function') ? getState() : (typeof state !== 'undefined' ? state : ((typeof window !== 'undefined' && window.state) ? window.state : {}));
    const templates = appState.recurringTemplates || [];
    if (templates.length === 0) return;
    const txs = appState.transactions || [];
    if (txs.length === 0) return;

    const toUpdate = [];
    txs.forEach(tx => {
      if (tx.recurring_template_id) return; // already linked
      const txAmount = (parseFloat(tx.amount) || 0).toFixed(2);
      const txType = tx.type;
      const match = templates.find(t => {
        return (parseFloat(t.amount) || 0).toFixed(2) === txAmount &&
          t.type === txType &&
          isSameCategory(t.category, tx.category);
      });
      if (match) {
        tx.recurring_template_id = match.id;
        toUpdate.push({ id: tx.id, recurring_template_id: match.id });
      }
    });

    if (toUpdate.length === 0) return;

    // Persist the link to the cloud (only id + recurring_template_id) so it survives reloads.
    if (appState.isSupabaseEnabled && appState.supabaseClient && appState.currentUser) {
      (async () => {
        try {
          const timeoutFn = (typeof promiseTimeout === 'function')
            ? promiseTimeout
            : (typeof window !== 'undefined' && typeof window.promiseTimeout === 'function' ? window.promiseTimeout : (p) => p);

          for (let i = 0; i < toUpdate.length; i += 100) {
            const chunk = toUpdate.slice(i, i + 100);
            const { error } = await timeoutFn(
              appState.supabaseClient.from('transactions').upsert(chunk),
              15000
            );
            if (error) console.warn('[backfill] upsert error:', error);
          }
        } catch (e) {
          console.warn('[backfill] failed to persist links:', e);
        }
      })();
    }
  }

  // Bind to window for global runtime access
  if (typeof window !== 'undefined') {
    window.isSameCategory = isSameCategory;
    window.generateDeterministicUUID = generateDeterministicUUID;
    window.mergeAndDeduplicateTemplates = mergeAndDeduplicateTemplates;
    window.cleanDuplicateTemplates = cleanDuplicateTemplates;
    window.resolveRecurringTemplateForTx = resolveRecurringTemplateForTx;
    window.isTransactionRecurring = isTransactionRecurring;
    window.backfillRecurringTemplateIds = backfillRecurringTemplateIds;
  }

  return {
    isSameCategory,
    generateDeterministicUUID,
    mergeAndDeduplicateTemplates,
    cleanDuplicateTemplates,
    resolveRecurringTemplateForTx,
    isTransactionRecurring,
    backfillRecurringTemplateIds
  };
}));
