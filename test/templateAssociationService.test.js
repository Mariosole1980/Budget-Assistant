'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

const TemplateAssociationService = require('../js/templateAssociationService.js');

describe('TemplateAssociationService Module Tests', () => {
  beforeEach(() => {
    global.window = {
      state: {
        recurringTemplates: [
          { id: 'tmpl-rent', amount: 650, type: 'expense', category: 'Rent', preset: 'monthly' }
        ],
        transactions: [
          { id: 'tx-1', amount: 650, type: 'expense', category: 'Rent', date: '2026-03-01' }
        ]
      },
      CATEGORY_NAME_TRANSLATIONS: {
        'Σπίτι': 'Home',
        'Ενοίκιο': 'Rent',
        'Σούπερ Μάρκετ': 'Supermarket'
      }
    };
    global.localStorage = {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); },
      removeItem(k) { delete this.store[k]; }
    };
    global.state = global.window.state;
  });

  test('TemplateAssociationService exports all expected functions', () => {
    assert.strictEqual(typeof TemplateAssociationService.isSameCategory, 'function');
    assert.strictEqual(typeof TemplateAssociationService.generateDeterministicUUID, 'function');
    assert.strictEqual(typeof TemplateAssociationService.mergeAndDeduplicateTemplates, 'function');
    assert.strictEqual(typeof TemplateAssociationService.cleanDuplicateTemplates, 'function');
    assert.strictEqual(typeof TemplateAssociationService.resolveRecurringTemplateForTx, 'function');
    assert.strictEqual(typeof TemplateAssociationService.isTransactionRecurring, 'function');
    assert.strictEqual(typeof TemplateAssociationService.backfillRecurringTemplateIds, 'function');
  });

  test('isSameCategory compares identical and translated categories', () => {
    assert.strictEqual(TemplateAssociationService.isSameCategory('Rent', 'Rent'), true);
    assert.strictEqual(TemplateAssociationService.isSameCategory('Ενοίκιο', 'Rent'), true);
    assert.strictEqual(TemplateAssociationService.isSameCategory('Rent', 'Supermarket'), false);
    assert.strictEqual(TemplateAssociationService.isSameCategory('', 'Rent'), false);
    assert.strictEqual(TemplateAssociationService.isSameCategory('', null), true);
  });

  test('generateDeterministicUUID produces consistent valid UUID v4', () => {
    const uuid1 = TemplateAssociationService.generateDeterministicUUID('tmpl-1', '2026-05-01');
    const uuid2 = TemplateAssociationService.generateDeterministicUUID('tmpl-1', '2026-05-01');
    const uuid3 = TemplateAssociationService.generateDeterministicUUID('tmpl-1', '2026-05-02');

    assert.strictEqual(uuid1, uuid2, 'Same template and date must yield identical UUID');
    assert.notStrictEqual(uuid1, uuid3, 'Different dates must yield different UUIDs');
    assert.match(uuid1, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('resolveRecurringTemplateForTx and isTransactionRecurring identify template correctly', () => {
    const tx = { amount: 650, type: 'expense', category: 'Rent' };
    const resolved = TemplateAssociationService.resolveRecurringTemplateForTx(tx);
    assert.ok(resolved);
    assert.strictEqual(resolved.id, 'tmpl-rent');
    assert.strictEqual(TemplateAssociationService.isTransactionRecurring(tx), true);

    const nonRecTx = { amount: 20, type: 'expense', category: 'Coffee' };
    assert.strictEqual(TemplateAssociationService.resolveRecurringTemplateForTx(nonRecTx), null);
    assert.strictEqual(TemplateAssociationService.isTransactionRecurring(nonRecTx), false);
  });

  test('mergeAndDeduplicateTemplates merges cloud and local without duplicates', () => {
    const cloud = [
      { id: 'c1', note: 'Gym', amount: 40, type: 'expense', category: 'Health', preset: 'monthly' }
    ];
    const local = [
      { id: 'l1', note: 'Gym', amount: 40, type: 'expense', category: 'Health', preset: 'monthly' }
    ];

    const merged = TemplateAssociationService.mergeAndDeduplicateTemplates(cloud, local);
    assert.strictEqual(merged.length, 1);
  });
});
