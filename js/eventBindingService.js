/**
 * eventBindingService.js
 *
 * Event Binding & DOM Event Listeners Subsystem
 * Extracted from app.js (Phase 31A Architectural Modularization)
 *
 * Encapsulates setupEventListeners():
 * - Bottom navigation and month navigation
 * - Notes manager triggers & inputs
 * - More-tab hub screen navigation
 * - Quick action buttons and modal triggers
 * - Calculator keypad and currency symbol tap handling
 * - Feedback rating stars and chip toggles
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.EventBindingService = factory();
    if (typeof root.setupEventListeners === 'undefined') {
      root.setupEventListeners = root.EventBindingService.setupEventListeners;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function setupEventListeners() {
    if (typeof document === 'undefined') return;

    // Dynamic state accessor proxy to ensure safe access in both browser and test environments
    const state = new Proxy({}, {
      get(target, prop) {
        const s = (typeof window !== 'undefined' && window.state)
          ? window.state
          : (typeof global !== 'undefined' && global.state
            ? global.state
            : (typeof getState === 'function' ? getState() : {}));
        return s ? s[prop] : undefined;
      },
      set(target, prop, val) {
        const s = (typeof window !== 'undefined' && window.state)
          ? window.state
          : (typeof global !== 'undefined' && global.state
            ? global.state
            : (typeof getState === 'function' ? getState() : {}));
        if (s) s[prop] = val;
        return true;
      }
    });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      if (tab === 'trans' && state.activeTab === 'trans') {
        const today = new Date();
        if (state.selectedMonth === today.getMonth() && state.selectedYear === today.getFullYear()) {
          scrollToToday();
        } else {
          switchTab(tab);
        }
      } else {
        switchTab(tab);
      }
    });
  });

  document.getElementById('period-prev').addEventListener('click', () => {
    navigateMonth(-1);
  });
  document.getElementById('period-next').addEventListener('click', () => {
    navigateMonth(1);
  });

  document.getElementById('stats-tab-expense').addEventListener('click', () => toggleStatsType('expense'));
  document.getElementById('stats-tab-income').addEventListener('click', () => toggleStatsType('income'));
  document.getElementById('fab-btn').addEventListener('click', openAddTransactionModal);

  const fabNoteBtn = document.getElementById('fab-note-btn');
  if (fabNoteBtn) {
    fabNoteBtn.addEventListener('click', () => {
      openNotesManager();
    });
  }

  const notesSearchInput = document.getElementById('notes-manager-search-input');
  if (notesSearchInput) {
    notesSearchInput.addEventListener('input', () => {
      renderNotesList();
    });
  }

  const notesManagerAddBtn = document.getElementById('notes-manager-add-btn');
  if (notesManagerAddBtn) {
    notesManagerAddBtn.addEventListener('click', () => {
      openNoteEditor();
    });
  }

  // More screen hub rows
  const rowPref = document.getElementById('hub-row-preferences');
  if (rowPref) rowPref.addEventListener('click', () => openSettingsSubscreen('preferences', 'settings_pref_title'));

  const rowNotifications = document.getElementById('hub-row-notifications');
  if (rowNotifications) rowNotifications.addEventListener('click', () => openSettingsSubscreen('notifications', 'settings_notif_title'));

  const rowRecurring = document.getElementById('hub-row-recurring');
  if (rowRecurring) rowRecurring.addEventListener('click', openRecurringTemplatesModal);

  const rowCategories = document.getElementById('hub-row-categories');
  if (rowCategories) rowCategories.addEventListener('click', openSettingsCategoryManager);

  const rowSecurity = document.getElementById('hub-row-security');
  if (rowSecurity) rowSecurity.addEventListener('click', () => openSettingsSubscreen('security', 'settings_security_title'));

  const rowTrash = document.getElementById('hub-row-trash');
  if (rowTrash) rowTrash.addEventListener('click', openTrashBinModal);

  const rowSync = document.getElementById('hub-row-sync');
  if (rowSync) rowSync.addEventListener('click', () => openSettingsSubscreen('sync', 'settings_data_title'));

  const rowFamily = document.getElementById('hub-row-family');
  if (rowFamily) rowFamily.addEventListener('click', () => openSettingsSubscreen('family', 'settings_family_title'));

  // NOTE: The Feedback & Rating entry point lives inside the Legal subscreen
  // (legal-feedback-row), so there is no hub-row-feedback element to bind here.

  const rowLegal = document.getElementById('hub-row-legal');
  if (rowLegal) rowLegal.addEventListener('click', () => openSettingsSubscreen('legal', 'settings_account_legal_title'));

  // Close modals dynamically using data-close-modal attribute
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetModal = btn.getAttribute('data-close-modal');
      closeModal(targetModal);
    });
  });

  document.querySelectorAll('.type-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => setTransactionFormType(btn.getAttribute('data-type')));
  });

  // Date input change display listener
  const dateField = document.getElementById('trans-date');
  if (dateField) {
    dateField.addEventListener('input', (e) => {
      document.getElementById('trans-date-display').textContent = formatGreekDateTime(e.target.value);
      updateDualAmountDisplay();
    });
  }

  // Keypad keys pointerdown listeners (0ms mobile touch delay optimization)
  document.querySelectorAll('.calc-key-btn').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // Prevents emulated click events and double triggers
      e.stopPropagation();
      const val = btn.getAttribute('data-val');
      handleCalculatorKeyPress(val);
    });
  });

  // Close keypad when other form fields are clicked or focused
  ['trans-note', 'trans-description', 'trans-category', 'trans-account-from', 'trans-account-to', 'trans-date', 'trans-subcategory-custom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const textInputs = ['trans-note', 'trans-description', 'trans-subcategory-custom'];

      el.addEventListener('focus', () => {
        closeCalculatorKeypad();

        const isKeyboardAlreadyActive = document.body.classList.contains('keyboard-active');

        if (textInputs.includes(id)) {

          document.body.classList.add('keyboard-active');

          if (isIOS) {
            const body = el.closest('.modal-body');
            if (body) {
              // Force layout reflow so the padding-bottom takes effect instantly in bounding rects
              body.offsetHeight;
            }
          }
        }

        const scrollIntoViewIfNeeded = (isInstant = false) => {
          const row = el.closest('.form-row') || el.closest('.form-group');
          const body = el.closest('.modal-body');
          if (row && body) {
            const bodyRect = body.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();

            let keyboardHeight = 0;
            if (window.visualViewport && document.body.classList.contains('keyboard-active')) {
              const cssKeyboardHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--keyboard-height')) || 0;
              const vvKeyboardHeight = window.innerHeight - window.visualViewport.height;
              keyboardHeight = Math.max(vvKeyboardHeight, cssKeyboardHeight);
            }

            const visibleHeight = bodyRect.height - keyboardHeight;
            const safetyMargin = 24; // Keep row at least 24px above the keyboard
            const effectiveBottom = bodyRect.top + visibleHeight - safetyMargin;

            if (rowRect.bottom > effectiveBottom) {
              const targetScroll = body.scrollTop + (rowRect.bottom - effectiveBottom);
              body.scrollTo({ top: targetScroll, behavior: isInstant ? 'auto' : 'smooth' });
            } else if (rowRect.top < bodyRect.top + 8) {
              const targetScroll = Math.max(0, body.scrollTop - (bodyRect.top - rowRect.top) - 8);
              body.scrollTo({ top: targetScroll, behavior: isInstant ? 'auto' : 'smooth' });
            }
          }
        };

        if (isIOS) {
          // On iOS, scroll instantly so input is in the safe zone before Safari decides to pan
          scrollIntoViewIfNeeded(true);
        } else {
          if (!isKeyboardAlreadyActive) {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            setTimeout(() => {
              window.scrollTo(0, 0);
              document.body.scrollTop = 0;
              scrollIntoViewIfNeeded(false);
            }, 350);
          } else {
            setTimeout(() => {
              scrollIntoViewIfNeeded(false);
            }, 50);
          }
        }
      });

      el.addEventListener('blur', () => {
        // Guard: if app is backgrounding or hidden, handle blur synchronously to prevent post-resume layout jumps/flicker
        if (document.visibilityState === 'hidden' || window._appIsBackgrounding) {
          if (textInputs.includes(id)) {
            document.body.classList.remove('keyboard-active');
          }
          forceViewportReset(true);
          return;
        }

        if (textInputs.includes(id)) {
          // Delay removal to see if focus transferred to another text input in the same modal
          setTimeout(() => {
            const activeEl = document.activeElement;
            const isAnotherInputFocused = activeEl && textInputs.includes(activeEl.id);
            if (!isAnotherInputFocused) {
              document.body.classList.remove('keyboard-active');

              // Reset scroll when input loses focus and keyboard actually closes
              setTimeout(() => {
                forceViewportReset();
              }, 50);
            }
          }, 80);
        } else {
          // Reset scroll when input loses focus
          setTimeout(() => {
            forceViewportReset();
          }, 50);
        }
      });
    }
  });

  const subcatSelect = document.getElementById('trans-subcategory-select');
  if (subcatSelect) {
    subcatSelect.addEventListener('change', () => {
      if (subcatSelect.value === '__NEW__') {
        showSubcategorySelect();
      }
    });
    subcatSelect.addEventListener('focus', closeCalculatorKeypad);
    subcatSelect.addEventListener('click', closeCalculatorKeypad);
  }

  const customSubcatInput = document.getElementById('trans-subcategory-custom');
  if (customSubcatInput) {
    customSubcatInput.addEventListener('input', updateCategoryDisplay);
  }

  const catSelect = document.getElementById('trans-category');
  if (catSelect) {
    catSelect.addEventListener('change', updateSubcategorySuggestions);
  }

  // Document keydown for calculator keyboard support
  document.addEventListener('keydown', (e) => {
    // Never intercept typing or backspace when the user is focused on an input or textarea
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      return;
    }
    const modal = document.getElementById('transaction-modal');
    const keypad = document.getElementById('custom-calculator-keypad');
    if (modal && modal.classList.contains('active') && keypad && keypad.classList.contains('active')) {
      const key = e.key;
      if (key >= '0' && key <= '9') {
        handleCalculatorKeyPress(key);
      } else if (key === 'Enter') {
        e.preventDefault();
        handleCalculatorKeyPress('done');
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleCalculatorKeyPress('backspace');
      } else if (key === '-') {
        handleCalculatorKeyPress('-');
      } else if (key === '.' || key === ',') {
        handleCalculatorKeyPress('.');
      }
    }
  });

  let _isSubmittingTransaction = false;
  document.getElementById('transaction-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (_isSubmittingTransaction) return;
    _isSubmittingTransaction = true;
    try {
      closeCalculatorKeypad();
      const id = document.getElementById('trans-id').value;
      const type = document.querySelector('.type-tab-btn.active').getAttribute('data-type');

      let rawAmount = document.getElementById('trans-amount').value || '0';
      rawAmount = stripThousandsSeparators(rawAmount);
      rawAmount = rawAmount.replace(/\,/g, '.');
      const evaluatedVal = evaluateCalcBuffer(rawAmount);
      const amountVal = parseFloat(evaluatedVal) || 0;
      let categoryVal = type === 'transfer' ? 'ΜΕΤΑΦΟΡΑ' : document.getElementById('trans-category').value;
      // Normalize a ghost category (e.g. "Αυτοκίνητο") to its canonical stored name
      // (e.g. "🚗 ΑΥΤΟΚΙΝΗΤΟ") so it doesn't create a phantom category with a wrong icon.
      if (type !== 'transfer' && categoryVal) {
        const normCat = normalizeCategoryName(categoryVal);
        if (normCat) {
          const canonical = state.categories.find(c => c.name && normalizeCategoryName(c.name) === normCat);
          if (canonical) categoryVal = canonical.name;
        }
      }
      const noteVal = document.getElementById('trans-note').value.trim();

      // Validation: Amount, Category, Title (note) must be filled
      const lang = state.lang || 'el';
      if (amountVal <= 0) {
        const msg = lang === 'el' ? 'Παρακαλώ εισάγετε ποσό μεγαλύτερο από 0!' : 'Please enter an amount greater than 0!';
        await showCustomDialog({ message: msg, icon: '⚠️' });
        return;
      }

      if (!categoryVal || categoryVal.trim() === '') {
        const msg = lang === 'el' ? 'Παρακαλώ επιλέξτε κατηγορία!' : 'Please select a category!';
        await showCustomDialog({ message: msg, icon: '⚠️' });
        return;
      }

      if (!noteVal || noteVal === '') {
        const msg = lang === 'el' ? 'Παρακαλώ εισάγετε τίτλο!' : 'Please enter a title!';
        await showCustomDialog({ message: msg, icon: '⚠️' });
        return;
      }

      // Transfers must move money between two DIFFERENT accounts. Reject a
      // transfer where the source and destination account are the same, as it
      // would be a meaningless no-op that only distorts account balances.
      if (type === 'transfer') {
        const fromAcc = document.getElementById('trans-account-from').value;
        const toAcc = document.getElementById('trans-account-to').value;
        if (fromAcc && toAcc && fromAcc === toAcc) {
          const msg = lang === 'el' ? 'Η μεταφορά πρέπει να γίνει μεταξύ δύο διαφορετικών λογαριασμών!' : 'A transfer must be between two different accounts!';
          await showCustomDialog({ message: msg, icon: '⚠️' });
          return;
        }
      }

      const isRecurringActive = _pendingRecurringSettings.isActive === true;

      // Recurring "μέχρι ημερομηνία" guard: when the chosen end date is EARLIER than the transaction
      // date, the generator would silently produce ZERO occurrences (the template is saved but no
      // transaction ever appears — the "recurring save did nothing" bug). Detect this up-front and
      // tell the user instead of failing silently.
      if (!id && isRecurringActive && _pendingRecurringSettings.endType === 'date' && _pendingRecurringSettings.endDate) {
        const startStr = String(document.getElementById('trans-date').value || '').split('T')[0].split(' ')[0];
        const endStr = String(_pendingRecurringSettings.endDate).split('T')[0].split(' ')[0];
        if (startStr && endStr && endStr < startStr) {
          const fmt = (s) => s.split('-').reverse().join('/');
          const msg = lang === 'el'
            ? `⚠️ Η επανάληψη δεν θα δημιουργούσε καμία κίνηση: η ημερομηνία λήξης (${fmt(endStr)}) είναι ΠΡΙΝ την ημερομηνία της συναλλαγής (${fmt(startStr)}). Ανοίξτε το Rep/Inst. και επιλέξτε λήξη μετά την έναρξη.`
            : `⚠️ This recurrence would create no transactions: the end date (${fmt(endStr)}) is BEFORE the transaction date (${fmt(startStr)}). Open Rep/Inst. and pick an end date after the start.`;
          await showCustomDialog({ message: msg, icon: '⚠️' });
          return;
        }
      }

      if (!id && isRecurringActive) {
        const template = {
          id: generateUUID(),
          type,
          amount: amountVal,
          currency: getTransactionCurrency(),
          category: categoryVal,
          subcategory: (() => {
            if (type === 'transfer') return '';
            const customInput = document.getElementById('trans-subcategory-custom');
            if (customInput && customInput.style.display !== 'none') {
              return customInput.value.trim();
            }
            const select = document.getElementById('trans-subcategory-select');
            return (select && select.value !== '__NEW__') ? select.value.trim() : '';
          })(),
          account_from: document.getElementById('trans-account-from').value,
          account_to: type === 'transfer' ? document.getElementById('trans-account-to').value : null,
          note: noteVal,
          description: document.getElementById('trans-description').value.trim(),
          days: [..._pendingRecurringSettings.days],
          months: [..._pendingRecurringSettings.months],
          preset: _pendingRecurringSettings.preset || 'monthly',
          years: [...(_pendingRecurringSettings.years || [])],
          endType: _pendingRecurringSettings.endType || 'perpetual',
          endDate: (() => {
            if (_pendingRecurringSettings.endType === 'date') {
              const hiddenInput = document.getElementById('recurring-end-date');
              return (hiddenInput && hiddenInput.value) ? hiddenInput.value : (_pendingRecurringSettings.endDate || null);
            }
            return null;
          })(),
          startDate: document.getElementById('trans-date').value || new Date().toISOString().split('T')[0],
          startYear: (() => {
            const dateElVal = document.getElementById('trans-date').value;
            return dateElVal ? new Date(dateElVal).getFullYear() : new Date().getFullYear();
          })(),
          startMonth: (() => {
            const dateElVal = document.getElementById('trans-date').value;
            return dateElVal ? (new Date(dateElVal).getMonth() + 1) : (new Date().getMonth() + 1);
          })(),
          user_id: state.currentUser ? state.currentUser.id : null,
          is_shared: state.partnerProfile !== null,
          family_id: state.userProfile ? state.userProfile.family_id : null
        };

        state.recurringTemplates.push(template);
        localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
        if (typeof enqueueSyncMutation === 'function') {
          enqueueSyncMutation('save_template', template);
        }

        if (state.supabaseClient && state.currentUser) {
          state.supabaseClient
            .from('recurring_templates')
            .insert([mapTemplateToDb(template)])
            .select()
            .then(({ data, error }) => {
              if (error) {
                console.error('Failed to sync new recurring template to cloud:', error);
              } else {
                if (typeof dequeueSyncMutation === 'function') {
                  dequeueSyncMutation('save_template', template.id);
                }
                if (data && data[0]) {
                  const idx = state.recurringTemplates.findIndex(t => t.id === template.id);
                  if (idx !== -1) {
                    const dbTemplate = mapTemplateFromDb(data[0]);
                    if (dbTemplate && (!dbTemplate.days || dbTemplate.days.length === 0)) {
                      dbTemplate.days = Array.isArray(template.days) ? template.days : [];
                    }
                    if (dbTemplate && (!dbTemplate.months || dbTemplate.months.length === 0)) {
                      dbTemplate.months = Array.isArray(template.months) ? template.months : [];
                    }
                    if (dbTemplate && (!dbTemplate.years || dbTemplate.years.length === 0)) {
                      dbTemplate.years = Array.isArray(template.years) ? template.years : [];
                    }
                    if (dbTemplate && !dbTemplate.preset) {
                      dbTemplate.preset = template.preset || 'monthly';
                    }
                    state.recurringTemplates[idx] = dbTemplate || template;
                    localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
                    processRecurringTemplates();
                    updateUI();
                  }
                }
              }
            }).catch(e => {
              console.warn('Recurring template insert network error:', e);
            });
        }

        processRecurringTemplates();
        updateUI();

        _pendingReceiptFiles.forEach(p => {
          if (p.url && !p.isExisting) URL.revokeObjectURL(p.url);
        });
        _pendingReceiptFiles = [];
        _pendingReceiptDeleted = false;

        if (typeof clearRecurringSettings === 'function') {
          clearRecurringSettings(false);
        }

        closeModal('transaction-modal');
        return;
      }

      let t = {
        date: document.getElementById('trans-date').value,
        type,
        amount: amountVal,
        currency: getTransactionCurrency(),
        category: categoryVal,
        subcategory: (() => {
          if (type === 'transfer') return '';
          const customInput = document.getElementById('trans-subcategory-custom');
          if (customInput && customInput.style.display !== 'none') {
            return customInput.value.trim();
          }
          const select = document.getElementById('trans-subcategory-select');
          return (select && select.value !== '__NEW__') ? select.value.trim() : '';
        })(),
        account_from: document.getElementById('trans-account-from').value,
        account_to: type === 'transfer' ? document.getElementById('trans-account-to').value : null,
        note: noteVal,
        description: document.getElementById('trans-description').value.trim(),
      };
      if (id) {
        const existing = state.transactions.find(item => item.id === id);
        if (existing) {
          t = { ...existing, ...t };
          t.user_id = existing.user_id || (state.currentUser ? state.currentUser.id : null);
          t.is_shared = existing.is_shared !== undefined ? existing.is_shared : (state.partnerProfile !== null);
          t.family_id = existing.family_id || (state.userProfile ? state.userProfile.family_id : null);
        } else {
          t.id = id;
          t.user_id = state.currentUser ? state.currentUser.id : null;
          t.is_shared = state.partnerProfile !== null;
          t.family_id = state.userProfile ? state.userProfile.family_id : null;
        }
      } else {
        t.user_id = state.currentUser ? state.currentUser.id : null;
        t.is_shared = state.partnerProfile !== null;
        t.family_id = state.userProfile ? state.userProfile.family_id : null;
      }

      // Multi-currency: compute base-currency fields (amount_base, rate_to_base, base_currency).
      // Always computed so new transactions are consistent with the schema, even when the
      // feature flag is off (EUR → 1:1).
      computeCurrencyFields(t);

      // Multi-currency: apply the user-entered actual charged amount (base currency)
      // correction, which overrides the estimated rate with the real one (source='manual').
      if (CurrencyService.isEnabled() && t.currency && t.currency !== t.base_currency) {
        t = applyActualAmountCorrection(t);
      }

      await saveTransaction(t);

      // Save or delete receipt photos in IndexedDB
      if (_pendingReceiptFiles.length > 0 && t.id) {
        try {
          const blobsToSave = _pendingReceiptFiles.map(p => p.file).filter(f => f instanceof Blob);
          await ReceiptStorage.save(t.id, blobsToSave);
          t.photo_local_uri = 'local-file://' + t.id;
          saveTransactionOffline(t);
        } catch (err) {
          console.warn('Failed to save receipt photos:', err);
        }
      } else if (_pendingReceiptDeleted && t.id) {
        try {
          await ReceiptStorage.remove(t.id);
          t.photo_local_uri = null;
          saveTransactionOffline(t);
        } catch (err) {
          console.warn('Failed to delete receipt photos:', err);
        }
      }

      _pendingReceiptFiles.forEach(p => {
        if (p.url && !p.isExisting) URL.revokeObjectURL(p.url);
      });
      _pendingReceiptFiles = [];
      _pendingReceiptDeleted = false;

      closeModal('transaction-modal');
    } finally {
      _isSubmittingTransaction = false;
    }
  });

  document.getElementById('trans-delete-btn').addEventListener('click', async () => {
    const id = document.getElementById('trans-id').value;
    const tx = (state.transactions || []).find(t => String(t.id) === String(id));
    // If this is a recurring transaction, route through the scoped delete modal
    // (single / this + future / all repetitions) instead of deleting just this
    // occurrence directly. Use isTransactionRecurring() OR a direct content-key
    // template resolution so the 3-option modal reliably appears even if the
    // recurring_template_id link is missing on an older cloud-loaded transaction.
    const isRecurring = !!(tx && (isTransactionRecurring(tx) || resolveRecurringTemplateForTx(tx)));
    if (isRecurring) {
      closeModal('transaction-modal');
      // Delay opening the recurring delete modal until the transaction modal has
      // fully closed. On mobile (Capacitor WebView) opening a modal synchronously
      // right after closing another can be swallowed by the close animation /
      // viewport reset, so the 3-option modal never appears. A short delay lets the
      // close complete first, matching the working recurring-card delete path.
      setTimeout(() => {
        openRecurringDeleteModal(tx, String(tx.date || '').split('T')[0].split(' ')[0], { instant: true });
      }, 320);
      return;
    }
    const confirmMsg = TRANSLATIONS[state.lang]['confirm_delete_transaction'];
    const confirmed = await showConfirm(confirmMsg, state.lang === 'el' ? 'Διαγραφή Κίνησης' : 'Delete Transaction', '🗑️', { tone: 'cyan' });
    if (id && confirmed) {
      deleteTransaction(id);
      closeModal('transaction-modal');
    }
  });

  // ============================================================
  // RECEIPT PHOTO LISTENERS
  // Extracted to js/receiptService.js (Phase 15B Architectural Extraction)
  // ============================================================
  if (typeof initReceiptEventListeners === 'function') {
    initReceiptEventListeners();
  } else if (typeof window.initReceiptEventListeners === 'function') {
    window.initReceiptEventListeners();
  }

  function openCalculatorKeypad() { return CalculatorKeypadService.openCalculatorKeypad(); }
  window.openCalculatorKeypad = openCalculatorKeypad;

  // Routes taps on the amount row: tapping the currency symbol opens the
  // currency picker, tapping anywhere else opens the calculator keypad.
  function handleAmountRowClick(e) {
    if (e && e.target && e.target.closest && (e.target.closest('.currency-symbol-tappable') || e.target.closest('.currency-symbol'))) {
      openCurrencyPickerModal();
    } else {
      openCalculatorKeypad();
    }
  }

  window.handleAmountRowClick = handleAmountRowClick;

  // Robust tap interception for the currency symbol.
  // Note: We intentionally avoid opening the modal during 'pointerdown' because
  // displaying an overlay before finger-up causes the subsequent 'click' event
  // to hit the newly-opened modal backdrop, which would immediately dismiss it
  // on fast taps. Instead, we capture the gesture and open cleanly on 'click'.
  let _symbolTapPending = false;
  const isSymbolTap = (t) => {
    if (!t) return false;
    const form = document.getElementById('transaction-form');
    if (!form) return false;
    if (t.closest && (t.closest('.currency-symbol-tappable') || t.closest('.currency-symbol'))) return true;
    return false;
  };

  function safeOpenCurrencyPicker(e) {
    try {
      openCurrencyPickerModal();
      return true;
    } catch (err) {
      console.error('[CurrencySymbol] openCurrencyPickerModal failed:', err);
      try {
        if (typeof showSyncToast === 'function') {
          showSyncToast('Σφάλμα νομίσματος: ' + (err && err.message ? err.message : err), 3000);
        }
      } catch (_) { /* ignore */ }
      return false;
    }
  }

  document.addEventListener('click', (e) => {
    if (isSymbolTap(e.target)) {
      e.stopPropagation();
      e.preventDefault();
      safeOpenCurrencyPicker(e);
    }
  }, true);

  function closeCalculatorKeypad() { return CalculatorKeypadService.closeCalculatorKeypad(); }
  function handleCalculatorKeyPress(val) { return CalculatorKeypadService.handleCalculatorKeyPress(val); }

  window.closeCalculatorKeypad = closeCalculatorKeypad;
  window.handleCalculatorKeyPress = handleCalculatorKeyPress;

  // Stats period navigation
  document.getElementById('stats-period-prev').addEventListener('click', () => {
    adjustStatsPeriod(-1);
  });
  document.getElementById('stats-period-next').addEventListener('click', () => {
    adjustStatsPeriod(1);
  });

  // Dropdown period selection
  const dropdownBtn = document.getElementById('stats-period-dropdown-btn');
  const dropdownMenu = document.getElementById('stats-period-dropdown-menu');
  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const familyFilterMenu = document.getElementById('stats-family-dropdown-menu');
    if (familyFilterMenu) familyFilterMenu.classList.remove('active');
    dropdownMenu.classList.toggle('active');
  });

  const familyFilterBtn = document.getElementById('stats-family-dropdown-btn');
  const familyFilterMenu = document.getElementById('stats-family-dropdown-menu');
  if (familyFilterBtn && familyFilterMenu) {
    familyFilterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.remove('active');
      familyFilterMenu.classList.toggle('active');
    });
  }

  document.addEventListener('click', () => {
    dropdownMenu.classList.remove('active');
    if (familyFilterMenu) {
      familyFilterMenu.classList.remove('active');
    }
    document.querySelectorAll('.member-dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  });

  document.querySelectorAll('.stats-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const val = item.getAttribute('data-value');
      if (val === 'period') {
        const { start, end } = getStatsDateRange();
        document.getElementById('custom-period-start').value = start.toISOString().split('T')[0];
        document.getElementById('custom-period-end').value = end.toISOString().split('T')[0];
        openModal('custom-period-modal');
      } else {
        state.expandedStatsCategories.clear();
        state.statsPeriodType = val;
        state.statsDate = new Date();
        renderStatsTab();
      }
    });
  });

  // Search button and Month picker title event listeners
  const searchBtn = document.getElementById('trans-search-btn');
  if (searchBtn) searchBtn.addEventListener('click', openSearchOverlay);

  const currPeriodTitle = document.getElementById('current-period-title');
  if (currPeriodTitle) {
    currPeriodTitle.addEventListener('click', (e) => {
      const isYearClick = e.target.classList.contains('year-part');
      openMonthPicker(isYearClick);
    });
  }

  const statsPeriodTitle = document.getElementById('stats-period-title');
  if (statsPeriodTitle) {
    statsPeriodTitle.addEventListener('click', (e) => {
      const isYearClick = e.target.classList.contains('year-part');
      openMonthPicker(isYearClick);
    });
  }

  // Tapping the Overview year title returns to the current year.
  const overviewYearTitle = document.getElementById('overview-year-title');
  if (overviewYearTitle) {
    overviewYearTitle.addEventListener('click', () => {
      const currentYear = new Date().getFullYear();
      if ((state.overviewYear || currentYear) !== currentYear) {
        state.overviewYear = currentYear;
        renderAccountsTab();
      }
    });
  }

  // Auto-close search overlay when user scrolls down in the main content
  const appContent = document.querySelector('.app-content');
  if (appContent) {
    let lastScrollTop = 0;
    let touchStartY = 0;

    // Desktop scroll (using capturing to catch scroll events from sub-scroll containers)
    appContent.addEventListener('scroll', (e) => {
      const target = e.target;
      const st = target.scrollTop;
      const overlay = document.getElementById('search-overlay');
      if (overlay && overlay.classList.contains('active') && st > lastScrollTop + 8) {
        closeSearchOverlay();
      }
      lastScrollTop = st <= 0 ? 0 : st;
    }, { capture: true, passive: true });

    // Mobile touch: detect downward swipe
    appContent.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    appContent.addEventListener('touchmove', (e) => {
      const dy = touchStartY - e.touches[0].clientY;
      const overlay = document.getElementById('search-overlay');
      // dy > 0 means swiping up (scrolling down)
      if (overlay && overlay.classList.contains('active') && dy > 15) {
        closeSearchOverlay();
      }
    }, { passive: true });
  }

  // Feedback rating emojis clicks with explanatory text
  const ratingTexts = {
    1: { el: '😡 Πολύ κακό', en: '😡 Very Bad' },
    2: { el: '🙁 Χρειάζεται βελτίωση', en: '🙁 Needs Improvement' },
    3: { el: '😐 Μέτριο', en: '😐 Neutral' },
    4: { el: '😊 Καλό', en: '😊 Good' },
    5: { el: '🤩 Εξαιρετικό!', en: '🤩 Love it!' }
  };

  document.querySelectorAll('.emoji-rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.emoji-rate-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const rate = parseInt(btn.getAttribute('data-rate'));
      const labelEl = document.getElementById('emoji-rate-label');
      if (labelEl && ratingTexts[rate]) {
        const lang = state.lang || 'el';
        labelEl.textContent = ratingTexts[rate][lang] || ratingTexts[rate]['el'];
        labelEl.style.opacity = '1';
      }
    });
  });

  // Feedback type chips clicks
  document.querySelectorAll('.feedback-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.feedback-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  }

  return {
    setupEventListeners: setupEventListeners
  };
});
