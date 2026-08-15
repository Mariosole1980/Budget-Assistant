// ============================================================
// LOCAL RECEIPT PHOTO STORAGE (IndexedDB)
// 100% free, no Supabase Storage costs
// Extracted from app.js (Phase 4)
// ============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReceiptStorage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ReceiptStorage = {
    _db: null,
    DB_NAME: 'BudgetReceiptsDB',
    STORE_NAME: 'receipts',
  
    async _getDB() {
      if (this._db) return this._db;
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(this.DB_NAME, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
        req.onerror = (e) => { console.error('ReceiptStorage DB error:', e); reject(e); };
      });
    },
  
    async save(transactionId, blobs) {
      const db = await this._getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        tx.objectStore(this.STORE_NAME).put({ id: transactionId, blobs, savedAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e);
        tx.onabort = (e) => reject(e);
      });
    },
  
    async load(transactionId) {
      const db = await this._getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, 'readonly');
        const req = tx.objectStore(this.STORE_NAME).get(transactionId);
        req.onsuccess = () => {
          if (!req.result) {
            resolve([]);
          } else if (req.result.blobs) {
            resolve(req.result.blobs);
          } else if (req.result.blob) {
            resolve([req.result.blob]); // Backward compatibility for single blob
          } else {
            resolve([]);
          }
        };
        req.onerror = (e) => reject(e);
        tx.oncomplete = () => { /* resolve already called in onsuccess, but good for lifecycle */ };
        tx.onerror = (e) => reject(e);
        tx.onabort = (e) => reject(e);
      });
    },
  
    async remove(transactionId) {
      const db = await this._getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        tx.objectStore(this.STORE_NAME).delete(transactionId);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e);
        tx.onabort = (e) => reject(e);
      });
    }
  };
  if (typeof window !== 'undefined') {
    window.ReceiptStorage = ReceiptStorage;
  }
  return ReceiptStorage;
});
