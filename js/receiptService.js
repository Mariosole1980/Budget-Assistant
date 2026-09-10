(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReceiptService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Helper to access pending receipt files
  function getPendingFiles() {
    if (typeof window !== 'undefined' && window._pendingReceiptFiles) return window._pendingReceiptFiles;
    return [];
  }

  // ============================================================
  // RECEIPT PHOTO LIGHTBOX
  // ============================================================
  function openPhotoLightbox(src) {
    const modal = document.getElementById('photo-lightbox-modal');
    const img = document.getElementById('photo-lightbox-img');
    if (modal && img && src) {
      img.src = src;
      modal.style.display = 'flex';
    }
  }

  function closePhotoLightbox() {
    const modal = document.getElementById('photo-lightbox-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // ============================================================
  // RECEIPT PHOTO LOGIC & AI SCAN
  // ============================================================

  function renderPhotoPreviews() {
    const container = document.getElementById('trans-photo-preview-container');
    const list = document.getElementById('trans-photo-previews-list');
    if (!container || !list) return;

    list.innerHTML = '';

    const pendingList = (typeof window !== 'undefined' && window._pendingReceiptFiles) ? window._pendingReceiptFiles : [];
    if (pendingList.length === 0) {
      container.style.display = 'none';
      return;
    }

    const form = document.getElementById('transaction-form');
    const isReadOnly = form && form.getAttribute('data-readonly') === 'true';

    // 1. If not read-only, prepend the Camera/Gallery capture button as the first item
    if (!isReadOnly) {
      const cameraBox = document.createElement('div');
      cameraBox.className = 'photo-thumbnail-wrapper camera-capture-btn';
      cameraBox.style.cssText = 'position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1.5px dashed var(--text-muted); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; background: rgba(255,255,255,0.02); gap: 4px;';

      const camIcon = document.createElement('i');
      camIcon.className = 'fa-solid fa-camera';
      camIcon.style.cssText = 'font-size: 20px; color: var(--text-secondary);';

      const camLabel = document.createElement('span');
      camLabel.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['label_camera']) || 'Κάμερα';
      camLabel.style.cssText = 'font-size: 10px; color: var(--text-secondary); font-weight: 600;';

      cameraBox.appendChild(camIcon);
      cameraBox.appendChild(camLabel);

      cameraBox.addEventListener('click', (e) => {
        openReceiptPhotoSourcePicker(e);
      });

      list.appendChild(cameraBox);
    }

    pendingList.forEach(photo => {
      const wrapper = document.createElement('div');
      wrapper.className = 'photo-thumbnail-wrapper';
      wrapper.style.cssText = 'position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); background: rgba(0,0,0,0.2);';

      const img = document.createElement('img');
      img.src = photo.url;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; cursor: pointer;';
      img.addEventListener('click', () => openPhotoLightbox(photo.url));

      wrapper.appendChild(img);

      if (!isReadOnly) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.style.cssText = 'position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #ff5555; padding: 0;';
        deleteBtn.innerHTML = '<i class="fa-solid fa-xmark" style="font-size: 11px;"></i>';
        deleteBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          removePendingPhoto(photo.id);
        });
        wrapper.appendChild(deleteBtn);
      }

      list.appendChild(wrapper);
    });

    container.style.display = 'flex';
  }

  async function removePendingPhoto(id) {
    const list = (typeof window !== 'undefined' && window._pendingReceiptFiles) ? window._pendingReceiptFiles : [];
    const index = list.findIndex(p => p.id === id);
    if (index !== -1) {
      const photo = list[index];
      const confirmMsg = TRANSLATIONS[state.lang]['photo_delete_confirm'] || 'Διαγραφή φωτογραφίας απόδειξης;';
      const confirmed = await showConfirm(confirmMsg, state.lang === 'el' ? 'Διαγραφή Φωτογραφίας' : 'Delete Photo', '📸');
      if (confirmed) {
        if (photo.url && !photo.isExisting) {
          URL.revokeObjectURL(photo.url);
        }
        list.splice(index, 1);
        if (list.length === 0) {
          if (typeof window !== 'undefined') window._pendingReceiptDeleted = true;
        }
        renderPhotoPreviews();
      }
    }
  }

  function getMonthlyAIScanUsage() {
    const isPro = (typeof isPremium === 'function') ? isPremium() : (typeof window !== 'undefined' && typeof window.isPremium === 'function' ? window.isPremium() : false);
    const now = new Date();
    const monthKey = `ai_scans_${now.getFullYear()}_${now.getMonth() + 1}`;
    const used = parseInt(localStorage.getItem(monthKey) || '0', 10);
    const limits = (typeof PREMIUM_LIMITS !== 'undefined') ? PREMIUM_LIMITS : (typeof window !== 'undefined' && window.PREMIUM_LIMITS ? window.PREMIUM_LIMITS : { aiReceiptsPremium: 100, aiReceiptsFree: 5 });
    const max = isPro ? (limits.aiReceiptsPremium || 100) : (limits.aiReceiptsFree || 5);
    const remaining = isPro ? Infinity : Math.max(0, max - used);
    return { isPro, used, max, remaining, monthKey };
  }

  function updateAIScanQuotaBadge() {
    const badge = document.getElementById('ai-scan-badge-quota');
    if (!badge) return;
    const quota = getMonthlyAIScanUsage();
    if (quota.isPro) {
      badge.textContent = 'PRO ✨';
      badge.style.color = '#fff';
      badge.style.background = 'rgba(255, 255, 255, 0.28)';
    } else {
      const freeLabel = state.lang === 'el' ? 'δωρεάν' : 'free';
      badge.textContent = `${quota.remaining}/${quota.max} ${freeLabel}`;
      badge.style.color = '#fff';
      badge.style.background = quota.remaining > 0 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(239, 68, 68, 0.45)';
    }
  }

  function openReceiptPhotoSourcePicker(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Blur any active input to prevent keyboard resize / screen flickering
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    const form = document.getElementById('transaction-form');
    if (form && form.getAttribute('data-readonly') === 'true') return;

    updateAIScanQuotaBadge();
    const modalEl = document.getElementById('receipt-photo-source-modal');
    if (modalEl) {
      // FIX (stuck picker): If the sheet was left mid-fade by a previous flow
      // (e.g. the close transition was interrupted when the native camera opened
      // / closed the app), force it back to a fully-closed state before opening
      // again — otherwise openModal() re-activates an invisible full-screen
      // overlay (opacity 0 / visibility stuck) that swallows every tap and the
      // camera icon appears "dead".
      modalEl.classList.remove('active');
      modalEl.style.opacity = '';
      modalEl.style.visibility = '';
      modalEl.style.pointerEvents = '';
      if (typeof ensureOverlayInBody === 'function') ensureOverlayInBody(modalEl);
      if (modalEl.parentElement === document.body) {
        document.body.appendChild(modalEl); // re-append to be visually on top of active transaction modal
      }
    }
    openModal('receipt-photo-source-modal');
  }

  function triggerReceiptAIScan(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // ANTI-FLICKER: stabilize BEFORE closeModal so the updateUI() that closeModal
    // triggers internally (when no other modal is open) runs under no-transition,
    // preventing the re-render flash before the camera activity opens.
    stabilizeLayoutBeforeNativePicker();
    // userInitiated: the user explicitly chose this option, so closing the sheet
    // must NEVER be blocked by the resume anti-ghost-click guard — otherwise a
    // stuck full-screen overlay (z-index 25000) swallows every later tap on the
    // camera icon ("camera dead" after the first scan).
    closeModal('receipt-photo-source-modal', { userInitiated: true });
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }

    const quota = getMonthlyAIScanUsage();
    if (!quota.isPro && quota.remaining <= 0) {
      const msg = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['ai_scan_quota_msg']) ||
        'Έχετε χρησιμοποιήσει τις 5 δωρεάν σαρώσεις αυτού του μήνα. Αναβαθμίστε σε Lifetime PRO για έως 100 σαρώσεις/μήνα!';
      showSyncToast(msg, 3500);
      if (typeof openPremiumModal === 'function') {
        setTimeout(() => openPremiumModal('receipts'), 200);
      }
      return;
    }

    const aiCameraInput = document.getElementById('trans-ai-camera-input');
    if (aiCameraInput) {
      // Reset the hidden input so Android WebView reliably re-opens the camera
      // on a second AI scan (a leftover value can make .click() a silent no-op).
      aiCameraInput.value = '';
      setTimeout(() => {
        aiCameraInput.click();
      }, 60);
    }
  }

  function triggerReceiptCameraCapture(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // ANTI-FLICKER: stabilize BEFORE closeModal so the updateUI() that closeModal
    // triggers internally (when no other modal is open) runs under no-transition,
    // preventing the re-render flash before the camera activity opens.
    stabilizeLayoutBeforeNativePicker();
    // userInitiated: never let the resume guard block closing the sheet.
    closeModal('receipt-photo-source-modal', { userInitiated: true });
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    const cameraInput = document.getElementById('trans-camera-input');
    if (cameraInput) {
      // Reset the hidden input so the camera re-opens reliably on a second use.
      cameraInput.value = '';
      setTimeout(() => {
        cameraInput.click();
      }, 60);
    }
  }

  function triggerReceiptGalleryUpload(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // ANTI-FLICKER: stabilize BEFORE closeModal so the updateUI() that closeModal
    // triggers internally (when no other modal is open) runs under no-transition,
    // preventing the re-render flash before the gallery picker opens.
    stabilizeLayoutBeforeNativePicker();
    // userInitiated: never let the resume guard block closing the sheet.
    closeModal('receipt-photo-source-modal', { userInitiated: true });
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    const photoInput = document.getElementById('trans-photo-input');
    if (photoInput) {
      photoInput.value = '';
      setTimeout(() => {
        photoInput.click();
      }, 60);
    }
  }

  // Called at the exact moment a native Android activity (camera, file picker,
  // share sheet, browser, permission dialog) is about to cover the WebView.
  // When the activity opens, Android fires visibilitychange→hidden and a
  // visualViewport resize, which blur the focused input, drop body.keyboard-active
  // and reset --keyboard-height. The transaction modal lays out with
  // padding-bottom: var(--keyboard-height), so those changes re-flow the modal and
  // produce a visible flicker right before the native screen appears and again when
  // an Android permission / chooser dialog is shown. Stabilize the layout to its
  // final (no-keyboard) state and suppress CSS transitions for the handoff window
  // so the native handoff is seamless.
  // NOTE: 1000ms guard (was 700ms) — permission dialogs take slightly longer to
  // surface than a file picker, so the extra margin prevents early uncovering.
  function stabilizeLayoutBeforeNativePicker() {
    document.body.classList.remove('keyboard-active');
    document.documentElement.style.setProperty('--keyboard-height', '0px');
  }
  window.stabilizeLayoutBeforeNativePicker = stabilizeLayoutBeforeNativePicker;

  function handleReceiptPhotoSourceOverlayClick(e) {
    if (e.target.id === 'receipt-photo-source-modal') {
      closeModal('receipt-photo-source-modal', { userInitiated: true });
    }
  }

  function compressImageForAI(file, maxDimension = 1400, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image for compression'));
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  let _aiScanInFlight = false;

  async function processReceiptImageWithAI(file) {
    if (!file) return;

    const quota = getMonthlyAIScanUsage();
    if (!quota.isPro && quota.remaining <= 0) {
      const msg = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['ai_scan_quota_msg']) ||
        'Έχετε χρησιμοποιήσει τις 5 δωρεάν σαρώσεις αυτού του μήνα. Αναβαθμίστε σε Lifetime PRO για έως 100 σαρώσεις/μήνα!';
      showSyncToast(msg, 3500);
      if (typeof openPremiumModal === 'function') {
        openPremiumModal('receipts');
      }
      return;
    }

    // RE-ENTRANCY GUARD: Some Android WebViews fire the hidden file input's
    // 'change' event TWICE for a single capture, and a user may also tap the
    // camera twice quickly. Only ONE AI scan may run at a time — a duplicate
    // concurrent call would double-charge the scan quota and could surface a
    // misleading "recognition failed" toast (e.g. the duplicate request being
    // rate-limited after the first one already filled the fields).
    if (_aiScanInFlight) {
      console.warn('AI receipt scan already in progress — ignoring duplicate trigger.');
      return;
    }
    _aiScanInFlight = true;

    // 1. Add image to pending receipt photos (so user sees thumbnail preview immediately)
    const url = URL.createObjectURL(file);
    (window._pendingReceiptFiles = window._pendingReceiptFiles || []).push({
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      file: file,
      url: url,
      isExisting: false
    });
    if (typeof window !== 'undefined') window._pendingReceiptDeleted = false;
    renderPhotoPreviews();

    // 2. Show AI scanning loader banner
    const banner = document.getElementById('ai-receipt-scanning-banner');
    const confirmCard = document.getElementById('ai-receipt-confirmation-card');
    if (banner) banner.style.display = 'flex';
    if (confirmCard) confirmCard.style.display = 'none';

    try {
      // 3. Compress image client-side to ~150KB for rapid upload
      const base64 = await compressImageForAI(file, 1400, 0.82);

      // 4. Resolve URL via getBackendApiUrl for Capacitor & Web
      const apiUrl = getBackendApiUrl('/api/scan-receipt');
      const headers = { 'Content-Type': 'application/json' };

      // Attach Supabase Session Bearer token if available
      try {
        if (state.session && state.session.access_token) {
          headers['Authorization'] = `Bearer ${state.session.access_token}`;
        } else if (state.supabaseClient && typeof state.supabaseClient.auth?.getSession === 'function') {
          const sessRes = await state.supabaseClient.auth.getSession();
          if (sessRes?.data?.session?.access_token) {
            headers['Authorization'] = `Bearer ${sessRes.data.session.access_token}`;
          }
        }
      } catch (authErr) {
        console.warn('Could not extract session token for receipt scan:', authErr);
      }

      // 5. Send to Cloudflare Function
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: 'image/jpeg',
          currentLang: state.lang
        })
      });

      if (!res.ok) {
        // Distinguish the server-side quota rejection (429) from a real OCR
        // failure so the user sees the correct message instead of a generic
        // "recognition failed" toast.
        if (res.status === 429) {
          let quotaMsg = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['ai_scan_quota_msg']) ||
            'Έχετε χρησιμοποιήσει τις 5 δωρεάν σαρώσεις αυτού του μήνα. Αναβαθμίστε σε Lifetime PRO για έως 100 σαρώσεις/μήνα!';
          try {
            const errBody = await res.json();
            if (errBody && errBody.error === 'SCAN_LIMIT_REACHED' && errBody.message) {
              quotaMsg = errBody.message;
            }
          } catch (_) { /* ignore parse errors */ }
          if (banner) banner.style.display = 'none';
          showSyncToast(quotaMsg, 4000);
          if (!isPremium() && typeof openPremiumModal === 'function') {
            openPremiumModal('receipts');
          }
          throw new Error('AI_SCAN_QUOTA_REACHED');
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Invalid AI result');
      }

      const data = json.data;
      if (banner) banner.style.display = 'none';

      // 6. Increment quota for free users (guarded: a quota bookkeeping hiccup
      // must never turn a successful scan into a "recognition failed" toast).
      if (!quota.isPro) {
        try {
          localStorage.setItem(quota.monthKey, String(quota.used + 1));
          updateAIScanQuotaBadge();
        } catch (qErr) {
          console.warn('AI scan quota increment warning:', qErr);
        }
      }

      // 7. Auto-fill form fields — DEFENSIVE on purpose. A single malformed AI
      // value (non-string category, invalid date, odd amount) or a UI hiccup
      // must NEVER fall into the outer catch — otherwise the user sees the
      // "Δεν ήταν δυνατή η αναγνώριση" failure toast AFTER the fields were
      // already filled by a successful scan. All autofill runs inside its own
      // try/catch so partial fills stay filled and success is still reported.
      try {
        const amtNum = Number(data.amount);
        if (data.amount !== undefined && data.amount !== null && !isNaN(amtNum) && amtNum > 0) {
          const amtStr = String(amtNum);
          const amountInput = document.getElementById('trans-amount');
          if (amountInput) amountInput.value = formatCalcDisplay(amtStr);
          if (window.calculatorKeypadState) {
            window.calculatorKeypadState.currentValue = amtStr;
          }
        }

        if (typeof data.merchant === 'string' && data.merchant.trim()) {
          const noteInput = document.getElementById('trans-note');
          if (noteInput) noteInput.value = data.merchant;
        }

        if (typeof data.date === 'string' && data.date.trim()) {
          let dVal = data.date;
          if (typeof data.time === 'string' && data.time.trim()) {
            dVal = `${dVal}T${data.time}`;
          } else {
            const now = new Date();
            const hrs = String(now.getHours()).padStart(2, '0');
            const mins = String(now.getMinutes()).padStart(2, '0');
            dVal = `${dVal}T${hrs}:${mins}`;
          }
          const dateInput = document.getElementById('trans-date');
          const dateDisplay = document.getElementById('trans-date-display');
          if (dateInput) dateInput.value = dVal;
          if (dateDisplay) {
            try {
              dateDisplay.textContent = formatGreekDateTime(dVal);
            } catch (e) {
              dateDisplay.textContent = dVal;
            }
          }
        }

        // Match Category (guard the string ops — the AI occasionally returns a
        // non-string value here which used to throw and kill the whole scan).
        if (typeof data.category === 'string' && data.category.trim() && state.categories) {
          const cleanTarget = data.category.toLowerCase().replace(/^[^\w\s\u0370-\u03ff]+/, '').trim();
          const matchedCat = state.categories.find(c => {
            const cleanName = (c.name || '').toLowerCase().replace(/^[^\w\s\u0370-\u03ff]+/, '').trim();
            return cleanName.includes(cleanTarget) || cleanTarget.includes(cleanName);
          });
          if (matchedCat) {
            try {
              selectCategory(matchedCat.name, matchedCat.icon, matchedCat.color, false);
            } catch (e) {
              console.warn('AI category select warning:', e);
            }
          }
        }

        // Match or fill Subcategory
        if (typeof data.subcategory === 'string' && data.subcategory.trim()) {
          const subInput = document.getElementById('trans-subcategory-custom');
          const subSelect = document.getElementById('trans-subcategory-select');
          if (subSelect && Array.from(subSelect.options).some(o => o.value === data.subcategory)) {
            subSelect.value = data.subcategory;
          } else if (subInput) {
            subInput.value = data.subcategory;
          }
          updateSubcategoryRowVisibility();
        }
      } catch (fillErr) {
        console.warn('AI autofill completed with warnings:', fillErr);
      }

      // 8. Show AI Confirmation Card + success toast — cosmetic UI, fully
      // isolated from the outer catch so it can never surface as a failure.
      const successMsg = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['ai_scan_success']) || '✨ Αναγνωρίστηκε επιτυχώς με AI';
      try {
        if (confirmCard) {
          const merchEl = document.getElementById('ai-confirm-merchant');
          const amtEl = document.getElementById('ai-confirm-amount');
          const catEl = document.getElementById('ai-confirm-category');
          const dateEl = document.getElementById('ai-confirm-date');

          if (merchEl) merchEl.textContent = data.merchant || '—';
          if (amtEl) amtEl.textContent = formatCurrency(Number(data.amount || 0));
          if (catEl) catEl.textContent = `${data.category || ''} ${data.subcategory ? '• ' + data.subcategory : ''}`.trim();
          if (dateEl) dateEl.textContent = data.date || '';

          confirmCard.style.display = 'flex';
        }
        showSyncToast(successMsg, 3000);
      } catch (uiErr) {
        console.warn('AI confirmation UI error:', uiErr);
        try { showSyncToast(successMsg, 3000); } catch (e) { /* ignore */ }
      }

    } catch (err) {
      console.error('AI Receipt Processing Error:', err);
      if (banner) banner.style.display = 'none';
      const failMsg = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['ai_scan_fail']) ||
        'Δεν ήταν δυνατή η ανάγνωση της απόδειξης. Παρακαλώ ελέγξτε τη φωτογραφία ή συμπληρώστε τα πεδία χειροκίνητα.';
      showSyncToast(failMsg, 4000);
    } finally {
      _aiScanInFlight = false;
    }
  }

  function dismissAIConfirmationCard(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const card = document.getElementById('ai-receipt-confirmation-card');
    if (card) card.style.display = 'none';
  }


  // ============================================================
  // RECEIPT EVENT LISTENERS INITIALIZATION
  // ============================================================
  function initReceiptEventListeners() {
    const cameraBtnEl = document.getElementById('trans-camera-btn');
    const photoInputEl = document.getElementById('trans-photo-input');

    if (cameraBtnEl && photoInputEl) {
      cameraBtnEl.addEventListener('click', (e) => {
        openReceiptPhotoSourcePicker(e);
      });

      photoInputEl.addEventListener('change', (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const targetFiles = (typeof window !== 'undefined' && window._pendingReceiptFiles) ? window._pendingReceiptFiles : [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file.type || !file.type.startsWith('image/')) {
            const msg = (typeof state !== 'undefined' && state.lang === 'el') ? 'Παρακαλώ επιλέξτε μόνο εικόνες!' : 'Please select image files only!';
            if (typeof window !== 'undefined' && window.showAlert) window.showAlert(msg, (typeof state !== 'undefined' && state.lang === 'el') ? 'Σφάλμα' : 'Error', '⚠️');
            continue;
          }
          if (file.size > 5 * 1024 * 1024) {
            const msg = (typeof state !== 'undefined' && state.lang === 'el') ? 'Το μέγεθος της εικόνας δεν πρέπει να ξεπερνά τα 5MB!' : 'Image size must not exceed 5MB!';
            if (typeof window !== 'undefined' && window.showAlert) window.showAlert(msg, (typeof state !== 'undefined' && state.lang === 'el') ? 'Σφάλμα' : 'Error', '⚠️');
            continue;
          }

          const url = (typeof URL !== 'undefined' && URL.createObjectURL) ? URL.createObjectURL(file) : '';
          targetFiles.push({
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            file: file,
            url: url,
            isExisting: false
          });
        }
        if (typeof window !== 'undefined') window._pendingReceiptDeleted = false;

        const placeholderContainer = document.getElementById('trans-photo-placeholder-container');
        if (placeholderContainer) placeholderContainer.style.display = 'none';

        renderPhotoPreviews();
        photoInputEl.value = ''; // Reset file input
      });

      const cameraInputEl = document.getElementById('trans-camera-input');
      if (cameraInputEl) {
        cameraInputEl.addEventListener('change', (e) => {
          const files = e.target.files;
          if (!files || files.length === 0) return;

          const targetFiles = (typeof window !== 'undefined' && window._pendingReceiptFiles) ? window._pendingReceiptFiles : [];
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type || !file.type.startsWith('image/')) {
              const msg = (typeof state !== 'undefined' && state.lang === 'el') ? 'Παρακαλώ επιλέξτε μόνο εικόνες!' : 'Please select image files only!';
              if (typeof window !== 'undefined' && window.showAlert) window.showAlert(msg, (typeof state !== 'undefined' && state.lang === 'el') ? 'Σφάλμα' : 'Error', '⚠️');
              continue;
            }
            if (file.size > 5 * 1024 * 1024) {
              const msg = (typeof state !== 'undefined' && state.lang === 'el') ? 'Το μέγεθος της εικόνας δεν πρέπει να ξεπερνά τα 5MB!' : 'Image size must not exceed 5MB!';
              if (typeof window !== 'undefined' && window.showAlert) window.showAlert(msg, (typeof state !== 'undefined' && state.lang === 'el') ? 'Σφάλμα' : 'Error', '⚠️');
              continue;
            }

            const url = (typeof URL !== 'undefined' && URL.createObjectURL) ? URL.createObjectURL(file) : '';
            targetFiles.push({
              id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
              file: file,
              url: url,
              isExisting: false
            });
          }
          if (typeof window !== 'undefined') window._pendingReceiptDeleted = false;

          const placeholderContainer = document.getElementById('trans-photo-placeholder-container');
          if (placeholderContainer) placeholderContainer.style.display = 'none';

          renderPhotoPreviews();
          cameraInputEl.value = ''; // Reset file input
        });
      }

      const aiCameraInputEl = document.getElementById('trans-ai-camera-input');
      if (aiCameraInputEl) {
        aiCameraInputEl.addEventListener('change', (e) => {
          const files = e.target.files;
          if (!files || files.length === 0) return;
          const file = files[0];
          if (file) {
            processReceiptImageWithAI(file);
          }
          aiCameraInputEl.value = '';
        });
      }

      const aiGalleryInputEl = document.getElementById('trans-ai-gallery-input');
      if (aiGalleryInputEl) {
        aiGalleryInputEl.addEventListener('change', (e) => {
          const files = e.target.files;
          if (!files || files.length === 0) return;
          const file = files[0];
          if (file) {
            processReceiptImageWithAI(file);
          }
          aiGalleryInputEl.value = '';
        });
      }
    }
  }

  // Global window attachments
  if (typeof window !== 'undefined') {
    window.renderPhotoPreviews = renderPhotoPreviews;
    window.removePendingPhoto = removePendingPhoto;
    window.getMonthlyAIScanUsage = getMonthlyAIScanUsage;
    window.updateAIScanQuotaBadge = updateAIScanQuotaBadge;
    window.openReceiptPhotoSourcePicker = openReceiptPhotoSourcePicker;
    window.triggerReceiptAIScan = triggerReceiptAIScan;
    window.triggerReceiptCameraCapture = triggerReceiptCameraCapture;
    window.triggerReceiptGalleryUpload = triggerReceiptGalleryUpload;
    window.stabilizeLayoutBeforeNativePicker = stabilizeLayoutBeforeNativePicker;
    window.handleReceiptPhotoSourceOverlayClick = handleReceiptPhotoSourceOverlayClick;
    window.compressImageForAI = compressImageForAI;
    window.processReceiptImageWithAI = processReceiptImageWithAI;
    window.dismissAIConfirmationCard = dismissAIConfirmationCard;
    window.openPhotoLightbox = openPhotoLightbox;
    window.closePhotoLightbox = closePhotoLightbox;
    window.initReceiptEventListeners = initReceiptEventListeners;
  }

  return {
    renderPhotoPreviews,
    removePendingPhoto,
    getMonthlyAIScanUsage,
    updateAIScanQuotaBadge,
    openReceiptPhotoSourcePicker,
    triggerReceiptAIScan,
    triggerReceiptCameraCapture,
    triggerReceiptGalleryUpload,
    stabilizeLayoutBeforeNativePicker,
    handleReceiptPhotoSourceOverlayClick,
    compressImageForAI,
    processReceiptImageWithAI,
    dismissAIConfirmationCard,
    openPhotoLightbox,
    closePhotoLightbox,
    initReceiptEventListeners
  };
}));
