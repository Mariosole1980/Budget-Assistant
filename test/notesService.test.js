const test = require('node:test');
const assert = require('node:assert/strict');

// Import notesService in CommonJS Node environment
const notesService = require('../js/notesService.js');

test('notesService Module Tests', async (t) => {

  await t.test('1. exports all expected functions and controllers', () => {
    const expectedFns = [
      'translateNotepadUI',
      'restoreNoteEditorInitialPosition',
      'bindNoteEditorFocusScroll',
      'selectNoteColor',
      'updateNoteEditorReminderDisplay',
      'renderNoteReminderPresets',
      'applyNoteReminderString',
      'triggerCustomReminderInput',
      'getUserScopedKey',
      'loadNotes',
      'saveNotes',
      'setNotesFilterCategory',
      'toggleNotesViewMode',
      'renderNotesList',
      'showNoteContextMenu',
      'quickSetNoteColor',
      'triggerContextPin',
      'triggerContextEdit',
      'triggerContextCopy',
      'triggerContextReminder',
      'triggerContextDelete',
      'autoSaveNoteEditor',
      'updateNoteEditorMetaFooter',
      'toggleNoteEditorColorPalette',
      'toggleNoteEditorReminderTools',
      'handleNoteEditorOverlayClick',
      'openNoteEditor',
      'closeNoteEditor',
      'setNoteEditorType',
      'addNoteEditorChecklistItemRow',
      'addNoteEditorChecklistItem',
      'saveNoteFromEditor',
      'deleteNoteFromEditor',
      'onNoteReminderChanged',
      'clearNoteEditorReminder',
      'deleteNote',
      'loadNotesTrash',
      'saveNotesTrash',
      'mapNoteToDb',
      'getNoteChecklistItems',
      'upsertNoteToCloud',
      'buildNotesScopeQuery',
      'mergeNotes',
      'syncNotes',
      'fetchNotesTrashFromCloud',
      'updateNotesTrashBadge',
      'restoreNote',
      'deleteNotePermanently',
      'emptyNotesTrash',
      'renderNotesTrashList',
      'openNotesTrashModal',
      'loadBudgets',
      'saveBudgets',
      'syncBudgets',
      'toggleNoteEditorPin',
      'updateNoteEditorPinUI',
      'toggleNotePinInline',
      'toggleChecklistItemInline',
      'getAuthorInitials',
      'formatNoteTimestamp'
    ];

    expectedFns.forEach(fn => {
      assert.strictEqual(typeof notesService[fn], 'function', `Expected ${fn} to be a function`);
    });
  });

  await t.test('2. getNoteChecklistItems', async (st) => {
    const { getNoteChecklistItems } = notesService;

    await st.test('returns checklist_items array when present', () => {
      const note = { checklist_items: [{ text: 'Bread', checked: false }, { text: 'Milk', checked: true }] };
      const items = getNoteChecklistItems(note);
      assert.strictEqual(items.length, 2);
      assert.strictEqual(items[0].text, 'Bread');
      assert.strictEqual(items[1].checked, true);
    });

    await st.test('parses JSON string from body when checklist_items is missing', () => {
      const note = { body: JSON.stringify([{ text: 'Eggs', checked: false }]) };
      const items = getNoteChecklistItems(note);
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].text, 'Eggs');
    });

    await st.test('returns empty array for invalid, missing, or plain text bodies', () => {
      assert.deepStrictEqual(getNoteChecklistItems(null), []);
      assert.deepStrictEqual(getNoteChecklistItems({ body: 'Plain text notes' }), []);
      assert.deepStrictEqual(getNoteChecklistItems({ body: '' }), []);
    });
  });

  await t.test('3. mapNoteToDb schema formatting', () => {
    const { mapNoteToDb } = notesService;

    const localNote = {
      id: 'note-123',
      title: 'Meeting Notes',
      body: 'Discuss Q3 roadmap',
      type: 'text',
      pinned: true,
      user_id: 'offline-user',
      reminder_at: '2026-04-01T10:00:00Z',
      status: 'active'
    };

    const mapped = mapNoteToDb(localNote, 'real-user-id', 'fam-456');
    assert.strictEqual(mapped.id, 'note-123');
    assert.strictEqual(mapped.title, 'Meeting Notes');
    assert.strictEqual(mapped.user_id, 'real-user-id');
    assert.strictEqual(mapped.family_id, 'fam-456');
    assert.strictEqual(mapped.pinned, true);
    assert.strictEqual(mapped.status, 'active');
    assert.strictEqual(mapped.reminder_at, '2026-04-01T10:00:00Z');
    assert.ok(mapped.created_at);
    assert.ok(mapped.updated_at);
  });

  await t.test('4. formatNoteTimestamp', () => {
    const { formatNoteTimestamp } = notesService;

    global.state = { lang: 'el' };

    // Falsy or invalid input
    assert.strictEqual(formatNoteTimestamp(''), '');
    assert.strictEqual(formatNoteTimestamp(null), '');
    assert.strictEqual(formatNoteTimestamp('invalid-date'), '');

    // Formats valid timestamp
    const nowIso = new Date().toISOString();
    const formatted = formatNoteTimestamp(nowIso);
    assert.ok(formatted.includes('Σήμερα'));

    // English language format
    global.state.lang = 'en';
    const formattedEn = formatNoteTimestamp(nowIso);
    assert.ok(formattedEn.includes('Today'));
  });

  await t.test('5. getAuthorInitials', () => {
    const { getAuthorInitials } = notesService;

    global.state = {
      currentUser: { id: 'user-1', email: 'marios@example.com' },
      userProfile: { full_name: 'Marios S' },
      familyProfiles: [
        { id: 'user-2', full_name: 'Elena K' }
      ]
    };

    assert.strictEqual(getAuthorInitials('user-1'), 'MS');
    assert.strictEqual(getAuthorInitials('user-2'), 'EK');
    assert.strictEqual(getAuthorInitials('offline-user'), '');
    assert.strictEqual(getAuthorInitials(null), '');
  });

});
