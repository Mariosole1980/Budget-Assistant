const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

global.state = {
  lang: 'el',
  currentUser: { id: 'user1' }
};

global.TRANSLATIONS = {
  el: {
    label_camera: 'Κάμερα',
    photo_delete_confirm: 'Διαγραφή φωτογραφίας;',
    ai_scan_quota_msg: 'Έχετε χρησιμοποιήσει τις δωρεάν σαρώσεις.'
  }
};

const mockElements = {};
global.document = {
  getElementById(id) {
    if (!mockElements[id]) {
      mockElements[id] = {
        id,
        style: {},
        innerHTML: '',
        value: '',
        classList: { add() {}, remove() {}, contains() { return false; } },
        addEventListener() {},
        appendChild() {},
        querySelectorAll() { return []; }
      };
    }
    return mockElements[id];
  },
  createElement(tag) {
    return {
      tagName: tag.toUpperCase(),
      style: {},
      classList: { add() {}, remove() {}, contains() { return false; } },
      addEventListener() {},
      appendChild() {},
      setAttribute() {}
    };
  }
};

global.window._pendingReceiptFiles = [];
global.window._pendingReceiptDeleted = false;
global.openModal = () => {};
global.closeModal = () => {};
global.showSyncToast = () => {};
global.showConfirm = async () => true;

const ReceiptService = require('../js/receiptService.js');

test('ReceiptService: exports all expected functions to module and window', () => {
  assert.strictEqual(typeof ReceiptService.openPhotoLightbox, 'function');
  assert.strictEqual(typeof ReceiptService.closePhotoLightbox, 'function');
  assert.strictEqual(typeof ReceiptService.getMonthlyAIScanUsage, 'function');
  assert.strictEqual(typeof ReceiptService.updateAIScanQuotaBadge, 'function');
  assert.strictEqual(typeof ReceiptService.renderPhotoPreviews, 'function');
  assert.strictEqual(typeof ReceiptService.removePendingPhoto, 'function');
  assert.strictEqual(typeof ReceiptService.initReceiptEventListeners, 'function');

  // Verify window attachments
  assert.strictEqual(typeof window.openPhotoLightbox, 'function');
  assert.strictEqual(typeof window.closePhotoLightbox, 'function');
  assert.strictEqual(typeof window.getMonthlyAIScanUsage, 'function');
  assert.strictEqual(typeof window.updateAIScanQuotaBadge, 'function');
  assert.strictEqual(typeof window.renderPhotoPreviews, 'function');
  assert.strictEqual(typeof window.removePendingPhoto, 'function');
  assert.strictEqual(typeof window.initReceiptEventListeners, 'function');
});

test('ReceiptService: openPhotoLightbox and closePhotoLightbox adjust modal styles', () => {
  const modal = document.getElementById('photo-lightbox-modal');
  const img = document.getElementById('photo-lightbox-img');

  ReceiptService.openPhotoLightbox('data:image/png;base64,1234');
  assert.strictEqual(modal.style.display, 'flex');
  assert.strictEqual(img.src, 'data:image/png;base64,1234');

  ReceiptService.closePhotoLightbox();
  assert.strictEqual(modal.style.display, 'none');
});

test('ReceiptService: getMonthlyAIScanUsage returns valid usage structure', () => {
  const usage = ReceiptService.getMonthlyAIScanUsage();
  assert.ok(usage);
  assert.strictEqual(typeof usage.used, 'number');
  assert.strictEqual(typeof usage.max, 'number');
  assert.strictEqual(typeof usage.remaining, 'number');
});
