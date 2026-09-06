const test = require('node:test');
const assert = require('node:assert/strict');

// Import autocompleteService in CommonJS Node environment
const autocompleteService = require('../js/autocompleteService.js');

test('autocompleteService Module Tests', async (t) => {

  await t.test('1. exports all expected functions and controllers', () => {
    const expectedFns = [
      'greekToGreeklish',
      'matchesQuery',
      'highlightMatch',
      'getAdvancedNotes',
      'renderNoteAutocomplete',
      'closeNoteAutocomplete',
      'initNoteAutocomplete',
      'toggleAutocompleteSetting',
      'toggleNoteShortcutSetting',
      'updateNoteShortcutVisibility'
    ];

    expectedFns.forEach(fn => {
      assert.strictEqual(typeof autocompleteService[fn], 'function', `Expected ${fn} to be a function`);
    });
  });

  await t.test('2. greekToGreeklish phonetics converter', async (st) => {
    const { greekToGreeklish } = autocompleteService;

    await st.test('converts Greek diphthongs and special consonants accurately', () => {
      assert.strictEqual(greekToGreeklish('ουρανός'), 'ouranos');
      assert.strictEqual(greekToGreeklish('μπύρα'), 'byra');
      assert.strictEqual(greekToGreeklish('ντομάτα'), 'domata');
      assert.strictEqual(greekToGreeklish('γκάζι'), 'gazi');
      assert.strictEqual(greekToGreeklish('τσάι'), 'tsai');
      assert.strictEqual(greekToGreeklish('τζατζίκι'), 'tzatziki');
      assert.strictEqual(greekToGreeklish('ψωμί'), 'psomi');
      assert.strictEqual(greekToGreeklish('θέατρο'), 'theatro');
    });

    await st.test('strips diacritics and lowercases during transliteration', () => {
      assert.strictEqual(greekToGreeklish('ΜΙΣΘΌΣ'), 'misthos');
      assert.strictEqual(greekToGreeklish('Σούπερ Μάρκετ'), 'souper market');
      assert.strictEqual(greekToGreeklish('Καφές'), 'kafes');
    });

    await st.test('safely handles empty, null, or undefined input', () => {
      assert.strictEqual(greekToGreeklish(''), '');
      assert.strictEqual(greekToGreeklish(null), '');
      assert.strictEqual(greekToGreeklish(undefined), '');
    });
  });

  await t.test('3. matchesQuery multi-word & Greeklish matcher', async (st) => {
    const { matchesQuery } = autocompleteService;

    await st.test('matches Greek queries against Greek target with diacritic insensitivity', () => {
      assert.strictEqual(matchesQuery('Μισθοδοσία Μαρτίου', 'μισθοδοσια'), true);
      assert.strictEqual(matchesQuery('Μισθοδοσία Μαρτίου', 'μισθο'), true);
      assert.strictEqual(matchesQuery('Σούπερ Μάρκετ', 'σουπερ'), true);
      assert.strictEqual(matchesQuery('Σούπερ Μάρκετ', 'ΜΑΡΚΕΤ'), true);
    });

    await st.test('matches Greeklish queries against Greek target', () => {
      assert.strictEqual(matchesQuery('Καφές', 'kafes'), true);
      assert.strictEqual(matchesQuery('Σούπερ Μάρκετ', 'souper'), true);
      assert.strictEqual(matchesQuery('Σούπερ Μάρκετ', 'market'), true);
      assert.strictEqual(matchesQuery('Βενζίνη Shell', 'venzini'), true);
    });

    await st.test('matches multi-word queries in any order', () => {
      assert.strictEqual(matchesQuery('Εβδομαδιαία ψώνια Lidl Hellas', 'lidl ψωνια'), true);
      assert.strictEqual(matchesQuery('Εβδομαδιαία ψώνια Lidl Hellas', 'hellas evdomadiaia'), true);
    });

    await st.test('returns false for non-matching queries', () => {
      assert.strictEqual(matchesQuery('Βενζίνη', 'φαρμακειο'), false);
      assert.strictEqual(matchesQuery('Ενοίκιο', 'cinema'), false);
    });

    await st.test('returns true for empty or whitespace-only queries', () => {
      assert.strictEqual(matchesQuery('Οποιαδήποτε σημείωση', ''), true);
      assert.strictEqual(matchesQuery('Οποιαδήποτε σημείωση', '   '), true);
    });
  });

  await t.test('4. highlightMatch', async (st) => {
    const { highlightMatch } = autocompleteService;

    await st.test('wraps matched words in note-match-highlight span', () => {
      const result = highlightMatch('Lidl Supermarket', 'lidl');
      assert.ok(result.includes('<span class="note-match-highlight">Lidl</span>'));
    });

    await st.test('handles regex special characters safely without crashing', () => {
      const result = highlightMatch('Cost (10%) + VAT', '(10%)');
      assert.ok(result.includes('<span class="note-match-highlight">(10%)</span>'));
    });

    await st.test('returns original string when query is empty', () => {
      assert.strictEqual(highlightMatch('Original Note', ''), 'Original Note');
    });
  });

  await t.test('5. getAdvancedNotes ranking & suggestions', async (st) => {
    const { getAdvancedNotes } = autocompleteService;

    // Set up mock state
    global.state = {
      transactions: [
        { note: 'Καφές γραφείου', category: 'Φαγητό', date: '2026-03-10' },
        { note: 'Καφές γραφείου', category: 'Φαγητό', date: '2026-03-09' },
        { note: 'Καφές γραφείου', category: 'Φαγητό', date: '2026-03-08' },
        { note: 'Σούπερ Μάρκετ', category: 'Σούπερ Μάρκετ', date: '2026-03-07' },
        { note: 'Βενζίνη', category: 'Μεταφορές', date: '2026-03-06' }
      ],
      recurringTemplates: [
        { note: 'Ενοίκιο Γραφείου 2026', category: 'Στέγαση' }
      ]
    };

    await st.test('returns top frequent items as Quick Picks on empty query', () => {
      const quickPicks = getAdvancedNotes('');
      assert.ok(quickPicks.length > 0);
      // 'Καφές γραφείου' has frequency 3, 'Ενοίκιο Γραφείου 2026' has count 5 (recurring boost)
      assert.strictEqual(quickPicks[0].title, 'Ενοίκιο Γραφείου 2026');
      assert.strictEqual(quickPicks[1].title, 'Καφές γραφείου');
    });

    await st.test('filters and prioritizes prefix matches on non-empty query', () => {
      const suggestions = getAdvancedNotes('καφ');
      assert.ok(suggestions.length > 0);
      assert.strictEqual(suggestions[0].title, 'Καφές γραφείου');
      assert.strictEqual(suggestions[0].category, 'Φαγητό');
    });

    await st.test('matches via Greeklish input', () => {
      const suggestions = getAdvancedNotes('souper');
      assert.ok(suggestions.length > 0);
      assert.strictEqual(suggestions[0].title, 'Σούπερ Μάρκετ');
    });
  });

});
