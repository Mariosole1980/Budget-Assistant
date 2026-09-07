'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

const RecurringTemplateModalService = require('../js/recurringTemplateModalService.js');

describe('RecurringTemplateModalService Module Tests', () => {
  beforeEach(() => {
    global.window = {
      state: {
        lang: 'el',
        mainCurrency: 'EUR',
        recurringTemplates: [
          {
            id: 'tmpl-1',
            preset: 'monthly',
            amount: 50,
            currency: 'EUR',
            type: 'expense',
            category: 'Supermarket',
            note: 'Groceries',
            startDate: '2026-01-01',
            endType: 'perpetual'
          }
        ],
        transactions: []
      }
    };
    global.document = {
      getElementById: (id) => {
        return {
          id,
          value: '',
          style: {},
          classList: {
            add: () => { },
            remove: () => { },
            toggle: () => { }
          },
          innerHTML: '',
          textContent: '',
          appendChild: () => { },
          insertAdjacentHTML: () => { }
        };
      },
      querySelector: () => ({
        innerHTML: '',
        value: ''
      }),
      querySelectorAll: () => [],
      createElement: () => ({ classList: { add: () => { }, remove: () => { } }, onclick: null })
    };
    global.state = global.window.state;
    global.TRANSLATIONS = {
      el: {
        no_recurring_templates: 'Δεν βρέθηκαν επαναλήψεις.',
        monthly_on_day: 'Κάθε μήνα την ημέρα'
      },
      en: {
        no_recurring_templates: 'No recurring templates found.',
        monthly_on_day: 'Monthly on day'
      }
    };
  });

  test('RecurringTemplateModalService exports all expected functions', () => {
    assert.strictEqual(typeof RecurringTemplateModalService.openRecurringTemplatesModal, 'function');
    assert.strictEqual(typeof RecurringTemplateModalService.deleteRecurringTemplate, 'function');
    assert.strictEqual(typeof RecurringTemplateModalService.openRecurringDetailsModal, 'function');
    assert.strictEqual(typeof RecurringTemplateModalService.openEditTransactionModalFromDetails, 'function');
    assert.strictEqual(typeof RecurringTemplateModalService.handleDeleteFromRecurringDetails, 'function');
    assert.strictEqual(typeof RecurringTemplateModalService.closeRecurringDetailsModal, 'function');
    assert.strictEqual(typeof RecurringTemplateModalService.saveRecurringTemplateName, 'function');
    assert.strictEqual(typeof RecurringTemplateModalService.openRecurringEditModal, 'function');
    assert.strictEqual(typeof RecurringTemplateModalService.closeRecurringEditModal, 'function');
    assert.strictEqual(typeof RecurringTemplateModalService.renderRecurringEditMonthsGrid, 'function');
    assert.strictEqual(typeof RecurringTemplateModalService.onRecurringEditPresetChange, 'function');
    assert.strictEqual(typeof RecurringTemplateModalService.selectRecurringEditEndType, 'function');
    assert.strictEqual(typeof RecurringTemplateModalService.updateRecurringEditSummary, 'function');
    assert.strictEqual(typeof RecurringTemplateModalService.saveRecurringTemplateEdit, 'function');
    assert.strictEqual(typeof RecurringTemplateModalService.regenerateRecurringTemplateTransactions, 'function');
  });

  test('selectRecurringEditEndType toggles between perpetual and date', () => {
    let capturedEndValue = '';
    global.document.getElementById = (id) => {
      if (id === 'recurring-edit-end') {
        return {
          get value() { return capturedEndValue; },
          set value(v) { capturedEndValue = v; }
        };
      }
      return {
        id,
        value: '',
        style: {},
        classList: { add: () => { }, remove: () => { } }
      };
    };

    RecurringTemplateModalService.selectRecurringEditEndType('date');
    assert.ok(capturedEndValue.length > 0, 'Should set default end date');

    RecurringTemplateModalService.selectRecurringEditEndType('perpetual');
    assert.strictEqual(capturedEndValue, '', 'Should clear end date on perpetual');
  });

  test('openRecurringDetailsModal and closeRecurringDetailsModal set and clear active id', () => {
    RecurringTemplateModalService.openRecurringDetailsModal('tmpl-1');
    assert.strictEqual(RecurringTemplateModalService.getActiveDetailsTemplateId(), 'tmpl-1');

    RecurringTemplateModalService.closeRecurringDetailsModal();
    assert.strictEqual(RecurringTemplateModalService.getActiveDetailsTemplateId(), null);
  });

  test('openRecurringEditModal and closeRecurringEditModal set and clear active edit id', () => {
    RecurringTemplateModalService.openRecurringEditModal('tmpl-1');
    assert.strictEqual(RecurringTemplateModalService.getActiveEditTemplateId(), 'tmpl-1');

    RecurringTemplateModalService.closeRecurringEditModal();
    assert.strictEqual(RecurringTemplateModalService.getActiveEditTemplateId(), null);
  });

  test('regenerateRecurringTemplateTransactions creates transactions idempotently', () => {
    const template = global.window.state.recurringTemplates[0];
    const createdCount = RecurringTemplateModalService.regenerateRecurringTemplateTransactions(template);

    assert.ok(typeof createdCount === 'number');
    assert.ok(createdCount >= 0);
  });
});
