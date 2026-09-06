/**
 * js/dialogService.js
 *
 * Custom In-App Modal Dialog System (Alert, Confirm, Custom Prompts & Input Gates).
 * Extracted from app.js (Phase 5 Architectural Domain Extraction).
 *
 * Features:
 * - Unbreakable top-level z-index: 2147483647
 * - FontAwesome vector icon mapping for all alerts/prompts
 * - Contextual tone resolution (amber, cyan, danger)
 * - Safe touch/click outside backdrop dismissal
 * - PIN & typed confirmation prompts for safety-critical actions
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

  /**
   * Pure helper: Map raw emoji/strings to clean FontAwesome vector icons.
   */
  function getDialogVectorIcon(icon, showCancel) {
    let vectorIconHtml = '<i class="fa-solid fa-circle-info"></i>';
    if (typeof icon === 'string') {
      if (icon.includes('🗑') || icon.includes('trash') || icon.includes('διαγραφ') || icon.includes('delete')) {
        vectorIconHtml = '<i class="fa-solid fa-trash-can"></i>';
      } else if (icon.includes('⚠️') || icon.includes('warning') || icon.includes('alert')) {
        vectorIconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';
      } else if (icon.includes('👥') || icon.includes('family') || icon.includes('users')) {
        vectorIconHtml = '<i class="fa-solid fa-users"></i>';
      } else if (icon.includes('🚪') || icon.includes('leave') || icon.includes('kick')) {
        vectorIconHtml = '<i class="fa-solid fa-arrow-right-from-bracket"></i>';
      } else if (icon.includes('👤') || icon.includes('user')) {
        vectorIconHtml = '<i class="fa-solid fa-user"></i>';
      } else if (icon.includes('🔑') || icon.includes('key')) {
        vectorIconHtml = '<i class="fa-solid fa-key"></i>';
      } else if (icon.includes('🎉') || icon.includes('check') || icon.includes('success')) {
        vectorIconHtml = '<i class="fa-solid fa-circle-check"></i>';
      } else if (icon.includes('🔀') || icon.includes('shuffle')) {
        vectorIconHtml = '<i class="fa-solid fa-shuffle"></i>';
      } else if (icon.startsWith('<')) {
        vectorIconHtml = icon;
      } else {
        vectorIconHtml = showCancel ? '<i class="fa-solid fa-trash-can"></i>' : '<i class="fa-solid fa-circle-info"></i>';
      }
    }
    return vectorIconHtml;
  }

  /**
   * Pure helper: Determine contextual tone (amber, cyan, danger) from options and text.
   */
  function getDialogEffectiveTone(tone, title, message) {
    let effectiveTone = tone;
    if (!effectiveTone) {
      const lowerTitle = (title || '').toLowerCase();
      const lowerMsg = (message || '').toLowerCase();
      if (lowerTitle.includes('σημείωσ') || lowerTitle.includes('note') || lowerMsg.includes('σημείωσ') || lowerMsg.includes('note')) {
        effectiveTone = 'amber';
      } else {
        effectiveTone = 'cyan';
      }
    }
    return effectiveTone;
  }

  // Ensures the custom dialog modal exists in the DOM.
  function ensureCustomDialogModal() {
    if (typeof document === 'undefined') return null;
    let modal = document.getElementById('custom-dialog-modal');
    if (modal) {
      modal.style.zIndex = '2147483647';
      if (modal.parentElement !== document.body && document.body) {
        document.body.appendChild(modal);
      }
      return modal;
    }

    modal = document.createElement('div');
    modal.id = 'custom-dialog-modal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '2147483647';
    modal.innerHTML =
      '<div class="modal-content custom-dialog-content">' +
      '<div id="custom-dialog-icon-wrapper" class="custom-dialog-badge badge-cyan">' +
      '<span id="custom-dialog-icon"><i class="fa-solid fa-trash-can"></i></span>' +
      '</div>' +
      '<h4 id="custom-dialog-title">Επιβεβαίωση</h4>' +
      '<p id="custom-dialog-message"></p>' +
      '<div class="custom-dialog-buttons">' +
      '<button id="custom-dialog-btn-cancel" class="btn btn-secondary">Ακύρωση</button>' +
      '<button id="custom-dialog-btn-ok" class="btn btn-primary btn-tone-cyan">Διαγραφή</button>' +
      '</div></div>';
    if (document.body) {
      document.body.appendChild(modal);
    }
    return modal;
  }

  function showCustomDialog({ message, title = '', icon = '💬', showCancel = false, confirmBtnText = '', cancelBtnText = '', tone = '' }) {
    return new Promise((resolve) => {
      const modal = ensureCustomDialogModal();
      if (!modal) {
        resolve(true);
        return;
      }
      modal.style.zIndex = '2147483647';
      let isResolved = false;

      const cleanupAndResolve = (result) => {
        if (isResolved) return;
        isResolved = true;
        modal.classList.remove('active');
        modal.style.zIndex = '2147483647';
        if (document.body) document.body.classList.remove('modal-open');
        modal.ontouchstart = null;
        modal.ontouchend = null;
        modal.onclick = null;
        resolve(result);
      };

      const lang = (windowObj.state && windowObj.state.lang) || 'el';
      const isEl = lang === 'el';
      const defaultTitle = showCancel ? (isEl ? 'Επιβεβαίωση' : 'Confirm') : (isEl ? 'Ειδοποίηση' : 'Alert');
      const defaultCancelText = isEl ? 'Ακύρωση' : 'Cancel';

      const effectiveTone = getDialogEffectiveTone(tone, title, message);

      const titleEl = document.getElementById('custom-dialog-title');
      const msgEl = document.getElementById('custom-dialog-message');
      const iconWrapper = document.getElementById('custom-dialog-icon-wrapper');
      const iconEl = document.getElementById('custom-dialog-icon');
      const btnCancel = document.getElementById('custom-dialog-btn-cancel');
      const btnOk = document.getElementById('custom-dialog-btn-ok');

      if (titleEl) titleEl.textContent = title || defaultTitle;
      if (msgEl) msgEl.innerHTML = message;

      const vectorIconHtml = getDialogVectorIcon(icon, showCancel);

      if (iconWrapper) {
        iconWrapper.className = 'custom-dialog-badge badge-' + effectiveTone;
        if (iconEl) {
          iconEl.innerHTML = vectorIconHtml;
        } else {
          iconWrapper.innerHTML = '<span id="custom-dialog-icon">' + vectorIconHtml + '</span>';
        }
      } else if (iconEl) {
        iconEl.innerHTML = vectorIconHtml;
      }

      if (btnCancel) {
        btnCancel.textContent = cancelBtnText || defaultCancelText;
        btnCancel.style.display = showCancel ? 'block' : 'none';
      }

      if (btnOk) {
        if (showCancel) {
          const lowerTitle = (title || '').toLowerCase();
          const lowerMsg = (message || '').toLowerCase();
          const isDelete = lowerTitle.includes('διαγραφ') || lowerTitle.includes('delete') ||
                           lowerTitle.includes('εκκαθάρισ') || lowerTitle.includes('empty') ||
                           lowerMsg.includes('διαγραφ') || lowerMsg.includes('delete');
          const defaultActionText = isDelete ? (isEl ? 'Διαγραφή' : 'Delete') : (isEl ? 'Επιβεβαίωση' : 'Confirm');
          btnOk.textContent = confirmBtnText || defaultActionText;
          btnOk.className = 'btn btn-primary btn-tone-' + effectiveTone;
        } else {
          btnOk.textContent = confirmBtnText || (isEl ? 'Εντάξει' : 'OK');
          btnOk.className = 'btn btn-primary btn-tone-cyan';
        }
      }

      let newBtnCancel = null;
      let newBtnOk = null;
      if (btnCancel && btnCancel.parentNode) {
        newBtnCancel = btnCancel.cloneNode(true);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
      }
      if (btnOk && btnOk.parentNode) {
        newBtnOk = btnOk.cloneNode(true);
        btnOk.parentNode.replaceChild(newBtnOk, btnOk);
      }

      modal.classList.add('active');
      if (document.body) document.body.classList.add('modal-open');

      if (newBtnCancel) {
        newBtnCancel.addEventListener('click', (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          cleanupAndResolve(false);
        });
      }

      if (newBtnOk) {
        newBtnOk.addEventListener('click', (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          cleanupAndResolve(true);
        });
      }

      let touchStartTarget = null;
      modal.ontouchstart = (e) => {
        touchStartTarget = e.target;
      };
      modal.ontouchend = (e) => {
        if (touchStartTarget === modal && e.target === modal) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          cleanupAndResolve(showCancel ? false : true);
        }
        touchStartTarget = null;
      };
      modal.onclick = (e) => {
        if (e.target === modal) {
          if (e.stopPropagation) e.stopPropagation();
          cleanupAndResolve(showCancel ? false : true);
        }
      };
    });
  }

  function showConfirm(message, title = '', icon = '❓', options = {}) {
    return showCustomDialog({ message, title, icon, showCancel: true, ...(typeof options === 'object' ? options : {}) });
  }

  function showAlert(message, title = '', icon = 'ℹ️', options = {}) {
    return showCustomDialog({ message, title, icon, showCancel: false, ...(typeof options === 'object' ? options : {}) });
  }

  // Generic PIN prompt modal -> resolves with entered PIN string, or null if cancelled.
  function promptForPin(message, title) {
    return new Promise((resolve) => {
      const modal = document.getElementById('pin-prompt-modal');
      if (!modal) { resolve(null); return; }
      const input = document.getElementById('pin-prompt-input');
      const titleEl = document.getElementById('pin-prompt-title');
      const msgEl = document.getElementById('pin-prompt-message');
      const btnCancel = document.getElementById('pin-prompt-btn-cancel');
      const btnOk = document.getElementById('pin-prompt-btn-ok');

      const isEl = ((windowObj.state && windowObj.state.lang) || 'el') === 'el';
      if (titleEl) titleEl.textContent = title || (isEl ? 'Εισαγωγή PIN' : 'Enter PIN');
      if (msgEl) msgEl.textContent = message || (isEl ? 'Εισάγετε το PIN σας για να συνεχίσετε.' : 'Enter your PIN to continue.');
      if (input) input.value = '';

      const newCancel = btnCancel ? btnCancel.cloneNode(true) : null;
      const newOk = btnOk ? btnOk.cloneNode(true) : null;
      if (btnCancel && btnCancel.parentNode && newCancel) btnCancel.parentNode.replaceChild(newCancel, btnCancel);
      if (btnOk && btnOk.parentNode && newOk) btnOk.parentNode.replaceChild(newOk, btnOk);

      modal.classList.add('active');
      if (input) setTimeout(() => input.focus(), 50);

      const cleanup = () => { modal.classList.remove('active'); };
      if (newCancel) newCancel.addEventListener('click', () => { cleanup(); resolve(null); });
      if (newOk) newOk.addEventListener('click', () => { cleanup(); resolve((input && input.value) || null); });
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { cleanup(); resolve(input.value || null); }
        });
      }
    });
  }

  // Generic type-to-confirm modal -> resolves true if typed word matches (case-insensitive).
  function promptForTypedConfirmation(message, requiredWord, title, okLabel) {
    return new Promise((resolve) => {
      const modal = document.getElementById('type-confirm-modal');
      if (!modal) { resolve(false); return; }
      const input = document.getElementById('type-confirm-input');
      const titleEl = document.getElementById('type-confirm-title');
      const msgEl = document.getElementById('type-confirm-message');
      const hintEl = document.getElementById('type-confirm-hint');
      const iconEl = document.getElementById('type-confirm-icon');
      const btnCancel = document.getElementById('type-confirm-btn-cancel');
      const btnOk = document.getElementById('type-confirm-btn-ok');

      const isEl = ((windowObj.state && windowObj.state.lang) || 'el') === 'el';
      if (titleEl) titleEl.textContent = title || (isEl ? 'Επιβεβαίωση' : 'Confirmation');
      if (msgEl) msgEl.textContent = message;
      if (iconEl) iconEl.textContent = '⚠️';
      if (hintEl) hintEl.textContent = (isEl ? 'Πληκτρολογήστε ' : 'Type ') + '"' + requiredWord + '"' + (isEl ? ' για να συνεχίσετε.' : ' to continue.');
      if (btnOk) btnOk.textContent = okLabel || (isEl ? 'Διαγραφή' : 'Delete');
      if (input) {
        input.value = '';
        input.setAttribute('autocapitalize', 'characters');
      }

      const newCancel = btnCancel ? btnCancel.cloneNode(true) : null;
      const newOk = btnOk ? btnOk.cloneNode(true) : null;
      if (btnCancel && btnCancel.parentNode && newCancel) btnCancel.parentNode.replaceChild(newCancel, btnCancel);
      if (btnOk && btnOk.parentNode && newOk) btnOk.parentNode.replaceChild(newOk, btnOk);

      modal.classList.add('active');
      if (input) setTimeout(() => input.focus(), 50);

      const check = () => (input ? (input.value || '').trim().toUpperCase() === requiredWord.toUpperCase() : false);
      const updateOkState = () => {
        if (newOk) {
          newOk.disabled = !check();
          newOk.style.opacity = check() ? '1' : '0.5';
        }
      };
      if (input) input.addEventListener('input', updateOkState);
      updateOkState();

      const cleanup = () => { modal.classList.remove('active'); };
      if (newCancel) newCancel.addEventListener('click', () => { cleanup(); resolve(false); });
      if (newOk) newOk.addEventListener('click', () => { if (check()) { cleanup(); resolve(true); } });
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && check()) { cleanup(); resolve(true); }
        });
      }
    });
  }

  // Attach to windowObj
  windowObj.showConfirm = showConfirm;
  windowObj.showAlert = showAlert;
  windowObj.ensureCustomDialogModal = ensureCustomDialogModal;
  windowObj.showCustomDialog = showCustomDialog;
  windowObj.promptForPin = promptForPin;
  windowObj.promptForTypedConfirmation = promptForTypedConfirmation;

  // Intercept standard window.alert
  if (typeof window !== 'undefined') {
    window.alert = function (message) {
      showAlert(String(message));
    };
  }

  // CommonJS / Node exports
  return {
    getDialogVectorIcon,
    getDialogEffectiveTone,
    ensureCustomDialogModal,
    showCustomDialog,
    showConfirm,
    showAlert,
    promptForPin,
    promptForTypedConfirmation
  };
});
