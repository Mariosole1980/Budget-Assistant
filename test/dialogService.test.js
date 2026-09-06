const { describe, it, before } = require('node:test');
const assert = require('node:assert');

describe('DialogService Module Tests', () => {
  let dialogService;

  before(() => {
    // Setup minimal DOM mocks for Node test environment
    global.document = global.document || {
      body: {
        appendChild: () => {},
        classList: { add: () => {}, remove: () => {} }
      },
      createElement: (tag) => ({
        id: '',
        style: {},
        innerHTML: '',
        appendChild: () => {},
        classList: { add: () => {}, remove: () => {} },
        parentNode: { replaceChild: () => {} }
      }),
      getElementById: () => null
    };

    dialogService = require('../js/dialogService.js');
  });

  it('exports all expected functions and helpers', () => {
    assert.strictEqual(typeof dialogService.getDialogVectorIcon, 'function');
    assert.strictEqual(typeof dialogService.getDialogEffectiveTone, 'function');
    assert.strictEqual(typeof dialogService.ensureCustomDialogModal, 'function');
    assert.strictEqual(typeof dialogService.showCustomDialog, 'function');
    assert.strictEqual(typeof dialogService.showConfirm, 'function');
    assert.strictEqual(typeof dialogService.showAlert, 'function');
    assert.strictEqual(typeof dialogService.promptForPin, 'function');
    assert.strictEqual(typeof dialogService.promptForTypedConfirmation, 'function');
  });

  describe('1. getDialogVectorIcon', () => {
    it('maps trash / delete keywords to trash-can icon', () => {
      assert.ok(dialogService.getDialogVectorIcon('🗑').includes('fa-trash-can'));
      assert.ok(dialogService.getDialogVectorIcon('delete').includes('fa-trash-can'));
      assert.ok(dialogService.getDialogVectorIcon('διαγραφή').includes('fa-trash-can'));
    });

    it('maps warning / alert keywords to triangle-exclamation icon', () => {
      assert.ok(dialogService.getDialogVectorIcon('⚠️').includes('fa-triangle-exclamation'));
      assert.ok(dialogService.getDialogVectorIcon('warning').includes('fa-triangle-exclamation'));
    });

    it('maps users / family keywords to users icon', () => {
      assert.ok(dialogService.getDialogVectorIcon('👥').includes('fa-users'));
      assert.ok(dialogService.getDialogVectorIcon('family').includes('fa-users'));
    });

    it('maps key keywords to key icon', () => {
      assert.ok(dialogService.getDialogVectorIcon('🔑').includes('fa-key'));
    });

    it('preserves raw HTML markup icons', () => {
      const customHtml = '<span class="custom-icon">✨</span>';
      assert.strictEqual(dialogService.getDialogVectorIcon(customHtml), customHtml);
    });

    it('falls back to info icon for general alerts and trash for cancelable confirm', () => {
      assert.ok(dialogService.getDialogVectorIcon('unknown', false).includes('fa-circle-info'));
      assert.ok(dialogService.getDialogVectorIcon('unknown', true).includes('fa-trash-can'));
    });
  });

  describe('2. getDialogEffectiveTone', () => {
    it('uses explicit tone when provided', () => {
      assert.strictEqual(dialogService.getDialogEffectiveTone('danger', 'Title', 'Msg'), 'danger');
      assert.strictEqual(dialogService.getDialogEffectiveTone('amber', 'Title', 'Msg'), 'amber');
    });

    it('detects note-related keywords and assigns amber tone', () => {
      assert.strictEqual(dialogService.getDialogEffectiveTone('', 'Διαγραφή Σημείωσης', 'Θέλετε να διαγραφεί;'), 'amber');
      assert.strictEqual(dialogService.getDialogEffectiveTone('', 'Delete Note', 'Confirm?'), 'amber');
    });

    it('defaults to cyan tone for general dialogs', () => {
      assert.strictEqual(dialogService.getDialogEffectiveTone('', 'Επιβεβαίωση', 'Είστε σίγουροι;'), 'cyan');
    });
  });

  describe('3. ensureCustomDialogModal', () => {
    it('enforces z-index 2147483647 on custom dialog modal', () => {
      const fakeModal = {
        id: 'custom-dialog-modal',
        style: { zIndex: '100' },
        parentElement: global.document.body
      };
      const origGet = global.document.getElementById;
      global.document.getElementById = (id) => id === 'custom-dialog-modal' ? fakeModal : null;

      const modal = dialogService.ensureCustomDialogModal();
      assert.strictEqual(modal.style.zIndex, '2147483647');

      global.document.getElementById = origGet;
    });
  });
});
