/**
 * js/voiceAssistantService.js
 *
 * Persistent Quick-Add Notification & Voice AI Assistant («🎙️ Οικονομικός Βοηθός») Subsystem.
 * Extracted from app.js (Phase 13A Architectural Extraction).
 *
 * Features:
 * - SpeechRecognition API & live waveform visualizer
 * - Voice parsing & transaction entities autofill
 * - Android / Capacitor QuickAddNotification persistent bar integration
 * - Cold-start & runtime Quick Action dispatching
 * - UMD pattern exposing globals to window and methods to Node tests
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    Object.assign(root, exports);
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

// =============================================================================
// PERSISTENT QUICK-ADD NOTIFICATION & VOICE AI ASSISTANT («🎙️ Οικονομικός Βοηθός»)
// =============================================================================

async function toggleQuickAddNotification(enabled) {
  const cb1 = document.getElementById('settings-quick-add-notification');
  const cb2 = document.getElementById('settings-quick-add-notification-sync');

  const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());

  if (isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.QuickAddNotification) {
    const plugin = window.Capacitor.Plugins.QuickAddNotification;
    try {
      if (enabled) {
        const res = await plugin.enableQuickAdd();
        if (res && res.permissionDenied) {
          localStorage.setItem('quick_add_notification_enabled', 'false');
          if (cb1) cb1.checked = false;
          if (cb2) cb2.checked = false;
          if (typeof showToast === 'function') {
            showToast(state.lang === 'el'
              ? '⚠️ Απαιτείται άδεια ειδοποιήσεων στο Android. Παρακαλώ επιτρέψτε τις ειδοποιήσεις στις Ρυθμίσεις.'
              : '⚠️ Notification permission is required in Android. Please allow notifications in Settings.',
              'warning',
              6000
            );
          }
          return;
        }

        localStorage.setItem('quick_add_notification_enabled', 'true');
        if (cb1) cb1.checked = true;
        if (cb2) cb2.checked = true;
        if (typeof showToast === 'function') {
          showToast(state.lang === 'el' ? '✅ Η μόνιμη ειδοποίηση γρήγορης καταχώρησης ενεργοποιήθηκε' : '✅ Quick Add persistent notification enabled', 'success');
        }
      } else {
        localStorage.setItem('quick_add_notification_enabled', 'false');
        if (cb1) cb1.checked = false;
        if (cb2) cb2.checked = false;
        await plugin.disableQuickAdd();
        if (typeof showToast === 'function') {
          showToast(state.lang === 'el' ? 'Η μόνιμη ειδοποίηση απενεργοποιήθηκε' : 'Quick Add persistent notification disabled', 'info');
        }
      }
    } catch (err) {
      console.warn('[QuickAdd] Error toggling notification:', err);
    }
  } else {
    // Running in Web Browser / PWA (outside native Android wrapper)
    localStorage.setItem('quick_add_notification_enabled', enabled ? 'true' : 'false');
    if (cb1) cb1.checked = enabled;
    if (cb2) cb2.checked = enabled;

    if (enabled) {
      if (typeof showToast === 'function') {
        showToast(state.lang === 'el'
          ? 'ℹ️ Η μόνιμη ειδοποίηση υποστηρίζεται στην εγκατεστημένη εφαρμογή Android (APK).'
          : 'ℹ️ Persistent notification bar is supported in the installed Android app (APK).',
          'info',
          6000
        );
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(state.lang === 'el' ? 'Η γρήγορη καταχώρηση απενεργοποιήθηκε' : 'Quick Add disabled', 'info');
      }
    }
  }
}
window.toggleQuickAddNotification = toggleQuickAddNotification;

function handleQuickAction(action) {
  console.log('[QuickAction] Dispatching action:', action);
  if (!action) return;

  setTimeout(() => {
    switch (action) {
      case 'VOICE_AI':
        if (typeof openVoiceAIModal === 'function') {
          openVoiceAIModal({ autoStart: true });
        }
        break;
      case 'ADD_EXPENSE':
        if (typeof openAddTransactionModal === 'function') {
          openAddTransactionModal();
          if (typeof setTransactionFormType === 'function') {
            setTransactionFormType('expense');
          }
        }
        break;
      case 'ADD_INCOME':
        if (typeof openAddTransactionModal === 'function') {
          openAddTransactionModal();
          if (typeof setTransactionFormType === 'function') {
            setTransactionFormType('income');
          }
        }
        break;
      case 'SCAN_RECEIPT':
        if (typeof openAddTransactionModal === 'function') {
          openAddTransactionModal();
          if (typeof openReceiptPhotoSourcePicker === 'function') {
            setTimeout(() => {
              openReceiptPhotoSourcePicker();
            }, 120);
          }
        }
        break;
      default:
        console.warn('[QuickAction] Unknown action:', action);
    }
  }, 150);
}
window.handleQuickAction = handleQuickAction;

function checkPendingQuickAction() {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.QuickAddNotification) {
    window.Capacitor.Plugins.QuickAddNotification.getPendingAction()
      .then(res => {
        if (res && res.action) {
          console.log('[QuickAction] Cold start pending action detected:', res.action);
          handleQuickAction(res.action);
        }
      })
      .catch(err => {
        console.warn('[QuickAdd] Could not check pending action:', err);
      });
  }
}
window.checkPendingQuickAction = checkPendingQuickAction;

// =============================================================================
// VOICE AI ASSISTANT MODAL CONTROLLER
// =============================================================================

let _voiceAIRecognition = null;
let _voiceAIIsListening = false;
let _voiceAITarget = 'transaction';
let _voiceAIFinalTranscript = '';
let _voiceAISilenceTimer = null;

function openVoiceAIModal({ autoStart = true, target = 'transaction' } = {}) {
  _voiceAITarget = target;
  _voiceAIFinalTranscript = '';

  const modal = document.getElementById('voice-ai-modal');
  if (!modal) return;

  const visualizer = document.getElementById('voice-ai-visualizer');
  if (visualizer) visualizer.classList.remove('voice-ai-listening');

  const badge = document.getElementById('voice-ai-status-badge');
  if (badge) badge.textContent = state.lang === 'el' ? 'Έτοιμο για ακρόαση' : 'Ready to listen';

  const hint = document.getElementById('voice-ai-hint');
  if (hint) {
    hint.textContent = state.lang === 'el'
      ? 'Σας ακούω... Πείτε π.χ. «30€ βενζίνη από Alpha Bank»'
      : 'Listening... Say e.g. «30€ gas from Alpha Bank»';
  }

  const transcriptBox = document.getElementById('voice-ai-transcript-text');
  if (transcriptBox) {
    transcriptBox.textContent = state.lang === 'el' ? 'Περιμένω να μιλήσετε...' : 'Waiting for speech...';
    transcriptBox.style.opacity = '0.6';
    transcriptBox.style.fontStyle = 'italic';
  }

  const manualInput = document.getElementById('voice-ai-manual-input');
  if (manualInput) manualInput.value = '';

  if (typeof openModal === 'function') {
    openModal('voice-ai-modal');
  } else {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }

  if (autoStart) {
    setTimeout(() => {
      startVoiceAIRecording();
    }, 220);
  }
}
window.openVoiceAIModal = openVoiceAIModal;

function closeVoiceAIModal() {
  stopVoiceAIRecording();
  if (typeof closeModal === 'function') {
    closeModal('voice-ai-modal');
  } else {
    const modal = document.getElementById('voice-ai-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  }
}
window.closeVoiceAIModal = closeVoiceAIModal;

function toggleVoiceAIRecording() {
  if (_voiceAIIsListening) {
    stopVoiceAIRecording();
  } else {
    startVoiceAIRecording();
  }
}
window.toggleVoiceAIRecording = toggleVoiceAIRecording;

async function ensureMicrophonePermission() {
  // 1. Android Capacitor Native:
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
    try {
      const QuickAdd = window.Capacitor.Plugins && window.Capacitor.Plugins.QuickAddNotification;
      if (QuickAdd && typeof QuickAdd.requestMicrophonePermission === 'function') {
        const res = await QuickAdd.requestMicrophonePermission();
        if (res && res.granted) return true;
        if (res && res.granted === false) return false;
      }
    } catch (e) {
      console.warn('[VoiceAI] Native mic permission error:', e);
    }
  }

  // 2. Web / PWA fallback: prompt user using getUserMedia before SpeechRecognition starts
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stream) {
        stream.getTracks().forEach(track => {
          try { track.stop(); } catch (_) {}
        });
        return true;
      }
    } catch (err) {
      console.warn('[VoiceAI] getUserMedia permission error:', err);
      return false;
    }
  }

  return true;
}

async function startVoiceAIRecording() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hint = document.getElementById('voice-ai-hint');
  const badge = document.getElementById('voice-ai-status-badge');
  const visualizer = document.getElementById('voice-ai-visualizer');
  const transcriptBox = document.getElementById('voice-ai-transcript-text');

  if (!SpeechRecognition) {
    if (hint) {
      hint.textContent = state.lang === 'el'
        ? '⚠️ Η φωνητική αναγνώριση δεν υποστηρίζεται στο πρόγραμμα περιήγησης. Πληκτρολογήστε παρακάτω:'
        : '⚠️ Speech recognition is not supported in this browser. Please type below:';
    }
    if (badge) badge.textContent = state.lang === 'el' ? 'Μη διαθέσιμο' : 'Unavailable';
    const manualInput = document.getElementById('voice-ai-manual-input');
    if (manualInput) manualInput.focus();
    return;
  }

  try {
    if (_voiceAIRecognition) {
      try { _voiceAIRecognition.abort(); } catch (e) {}
      _voiceAIRecognition = null;
    }

    if (badge) badge.textContent = state.lang === 'el' ? 'Έλεγχος…' : 'Checking…';
    const hasPermission = await ensureMicrophonePermission();
    if (!hasPermission) {
      _voiceAIIsListening = false;
      if (visualizer) visualizer.classList.remove('voice-ai-listening');
      if (badge) badge.textContent = state.lang === 'el' ? 'Άδεια' : 'Permission';
      if (hint) {
        hint.textContent = state.lang === 'el'
          ? '⚠️ Απαιτείται άδεια μικροφώνου. Επιτρέψτε την πρόσβαση στις Ρυθμίσεις ή πληκτρολογήστε παρακάτω:'
          : '⚠️ Microphone permission is required. Allow access in settings or type below:';
      }
      const manualInput = document.getElementById('voice-ai-manual-input');
      if (manualInput) manualInput.focus();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = state.lang === 'en' ? 'en-US' : 'el-GR';

    recognition.onstart = () => {
      _voiceAIIsListening = true;
      if (visualizer) visualizer.classList.add('voice-ai-listening');
      if (badge) badge.textContent = state.lang === 'el' ? 'Ακρόαση…' : 'Listening…';
      if (hint) {
        hint.textContent = state.lang === 'el'
          ? 'Σας ακούω... Πείτε π.χ. «30€ βενζίνη από Alpha Bank»'
          : 'Listening... Say e.g. «30€ gas from Alpha Bank»';
      }
      try {
        if (navigator.vibrate) navigator.vibrate(35);
      } catch (e) {}
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      const currentText = (final || interim).trim();
      if (currentText && transcriptBox) {
        transcriptBox.textContent = currentText;
        transcriptBox.style.opacity = '1';
        transcriptBox.style.fontStyle = 'normal';
      }

      const manualInput = document.getElementById('voice-ai-manual-input');
      if (manualInput && currentText) {
        manualInput.value = currentText;
      }

      if (final) {
        _voiceAIFinalTranscript = final.trim();
        if (_voiceAISilenceTimer) clearTimeout(_voiceAISilenceTimer);
        _voiceAISilenceTimer = setTimeout(() => {
          stopVoiceAIRecording();
          finishVoiceAIInput();
        }, 1200);
      }
    };

    recognition.onerror = (event) => {
      console.warn('[VoiceAI] Recognition error:', event.error);
      _voiceAIIsListening = false;
      if (visualizer) visualizer.classList.remove('voice-ai-listening');
      if (badge) badge.textContent = state.lang === 'el' ? 'Σφάλμα' : 'Error';
      if (hint) {
        if (event.error === 'not-allowed') {
          hint.textContent = state.lang === 'el'
            ? '⚠️ Απαιτείται άδεια μικροφώνου. Επιτρέψτε την πρόσβαση στις Ρυθμίσεις ή πληκτρολογήστε παρακάτω:'
            : '⚠️ Microphone permission is required. Allow access in Settings or type below:';
        } else if (event.error === 'no-speech') {
          hint.textContent = state.lang === 'el'
            ? 'Δεν ακούστηκε ομιλία. Πατήστε το μικρόφωνο για δοκιμή ξανά.'
            : 'No speech detected. Tap microphone to try again.';
        } else {
          hint.textContent = state.lang === 'el'
            ? '⚠️ Σφάλμα: ' + event.error + '. Μπορείτε να πληκτρολογήσετε παρακάτω.'
            : '⚠️ Error: ' + event.error + '. You can type below.';
        }
      }
    };

    recognition.onend = () => {
      _voiceAIIsListening = false;
      if (visualizer) visualizer.classList.remove('voice-ai-listening');
      if (badge) badge.textContent = state.lang === 'el' ? 'Έτοιμο' : 'Ready';
    };

    _voiceAIRecognition = recognition;
    recognition.start();
  } catch (err) {
    console.warn('[VoiceAI] Failed to start recognition:', err);
    _voiceAIIsListening = false;
    if (visualizer) visualizer.classList.remove('voice-ai-listening');
    if (hint) {
      hint.textContent = state.lang === 'el'
        ? '⚠️ Δεν ήταν δυνατή η εκκίνηση του μικροφώνου.'
        : '⚠️ Could not start microphone.';
    }
  }
}
window.startVoiceAIRecording = startVoiceAIRecording;

function stopVoiceAIRecording() {
  if (_voiceAISilenceTimer) {
    clearTimeout(_voiceAISilenceTimer);
    _voiceAISilenceTimer = null;
  }
  if (_voiceAIRecognition) {
    try {
      _voiceAIRecognition.stop();
    } catch (e) {}
    _voiceAIRecognition = null;
  }
  _voiceAIIsListening = false;
  const visualizer = document.getElementById('voice-ai-visualizer');
  if (visualizer) visualizer.classList.remove('voice-ai-listening');
}
window.stopVoiceAIRecording = stopVoiceAIRecording;

function submitVoiceManualInput() {
  const manualInput = document.getElementById('voice-ai-manual-input');
  if (manualInput && manualInput.value.trim()) {
    _voiceAIFinalTranscript = manualInput.value.trim();
    finishVoiceAIInput();
  }
}
window.submitVoiceManualInput = submitVoiceManualInput;

async function finishVoiceAIInput() {
  stopVoiceAIRecording();
  const manualInput = document.getElementById('voice-ai-manual-input');
  const transcriptBox = document.getElementById('voice-ai-transcript-text');

  const textToProcess = (
    _voiceAIFinalTranscript ||
    (manualInput ? manualInput.value : '') ||
    (transcriptBox && transcriptBox.style.fontStyle !== 'italic' ? transcriptBox.textContent : '')
  ).trim();

  if (!textToProcess) {
    if (typeof showToast === 'function') {
      showToast(state.lang === 'el' ? 'Παρακαλώ πείτε ή γράψτε τη συναλλαγή σας' : 'Please speak or enter your transaction', 'info');
    }
    return;
  }

  const hint = document.getElementById('voice-ai-hint');
  const badge = document.getElementById('voice-ai-status-badge');
  if (hint) hint.textContent = state.lang === 'el' ? 'Επεξεργασία με AI…' : 'Processing with AI…';
  if (badge) badge.textContent = state.lang === 'el' ? 'Επεξεργασία…' : 'Processing…';

  try {
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
  } catch (e) {}

  if (_voiceAITarget === 'advisor') {
    closeVoiceAIModal();
    const chatInput = document.getElementById('advisor-chat-input');
    if (chatInput) {
      chatInput.value = textToProcess;
      if (typeof handleAdvisorChatInput === 'function') handleAdvisorChatInput(chatInput);
      if (typeof submitCoachInput === 'function') submitCoachInput();
    }
    return;
  }

  // Default: transaction creation
  let parsed = null;
  if (window.AIEngine && typeof window.AIEngine.process === 'function') {
    try {
      parsed = await window.AIEngine.process(textToProcess, state);
    } catch (err) {
      console.warn('[VoiceAI] AIEngine error, falling back to local regex:', err);
    }
  }

  closeVoiceAIModal();

  // Open transaction modal
  if (typeof openAddTransactionModal === 'function') {
    openAddTransactionModal();
  }

  const entities = (parsed && parsed.entities) ? parsed.entities : null;
  const isIncome = entities ? (entities.type === 'income') : (function() {
    const nl = textToProcess.toLowerCase();
    return nl.includes('πηρα') || nl.includes('μπηκε') || nl.includes('μισθος') || nl.includes('εισπραξη') || nl.includes('εσοδο') || nl.includes('salary');
  })();

  if (typeof setTransactionFormType === 'function') {
    setTransactionFormType(isIncome ? 'income' : 'expense');
  }

  // Set Amount
  const amtInput = document.getElementById('trans-amount');
  if (amtInput) {
    if (entities && entities.amount) {
      amtInput.value = entities.amount;
    } else {
      const m = textToProcess.match(/(\d+([.,]\d{1,2})?)/);
      if (m) amtInput.value = m[1].replace(',', '.');
    }
  }

  // Set Note / Merchant
  const descInput = document.getElementById('trans-desc');
  if (descInput) {
    descInput.value = (entities && entities.merchant) ? entities.merchant : textToProcess;
    if (window.updateDescriptionHeight) window.updateDescriptionHeight();
  }

  // Set Category
  if (entities && entities.category) {
    const catSelect = document.getElementById('trans-category');
    if (catSelect) {
      catSelect.value = entities.category;
      const catDisplay = document.getElementById('trans-category-display');
      if (catDisplay) {
        catDisplay.innerHTML = '<span>' + entities.category + '</span>';
      }
      if (typeof updateSubcategoryDropdown === 'function') {
        updateSubcategoryDropdown(entities.category, entities.subcategory || null);
      }
    }
  }

  // Set Account
  if (entities && entities.account_from) {
    const accFrom = document.getElementById('trans-account-from');
    if (accFrom && state.accounts) {
      const match = state.accounts.find(a =>
        a.name.toLowerCase() === entities.account_from.toLowerCase() ||
        a.name.toLowerCase().includes(entities.account_from.toLowerCase())
      );
      if (match) accFrom.value = match.name;
    }
  }

  // Set Date
  if (entities && entities.date) {
    const dateInput = document.getElementById('trans-date');
    if (dateInput) {
      const d = new Date(entities.date);
      if (!isNaN(d.getTime())) {
        const tzOffset = d.getTimezoneOffset() * 60000;
        const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
        dateInput.value = localISOTime;
        const dateDisplay = document.getElementById('trans-date-display');
        if (dateDisplay && typeof formatGreekDateTime === 'function') {
          dateDisplay.textContent = formatGreekDateTime(localISOTime);
        }
      }
    }
  }

  if (typeof showToast === 'function') {
    showToast(
      state.lang === 'el'
        ? '🎙️ Η συναλλαγή συμπληρώθηκε από τη φωνή!'
        : '🎙️ Transaction populated from voice!',
      'success'
    );
  }
}
window.finishVoiceAIInput = finishVoiceAIInput;

// Auto-check pending quick action on startup
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  if (typeof document !== 'undefined' && (document.readyState === 'complete' || document.readyState === 'interactive')) {
    setTimeout(checkPendingQuickAction, 600);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkPendingQuickAction, 600);
    });
  }
}



  // UMD Exports & Window Bindings
  if (typeof window !== 'undefined') {
    window.toggleQuickAddNotification = toggleQuickAddNotification;
    window.handleQuickAction = handleQuickAction;
    window.checkPendingQuickAction = checkPendingQuickAction;
    window.openVoiceAIModal = openVoiceAIModal;
    window.closeVoiceAIModal = closeVoiceAIModal;
    window.toggleVoiceAIRecording = toggleVoiceAIRecording;
    window.startVoiceAIRecording = startVoiceAIRecording;
    window.stopVoiceAIRecording = stopVoiceAIRecording;
    window.submitVoiceManualInput = submitVoiceManualInput;
    window.finishVoiceAIInput = finishVoiceAIInput;
  }

  return {
    toggleQuickAddNotification: toggleQuickAddNotification,
    handleQuickAction: handleQuickAction,
    checkPendingQuickAction: checkPendingQuickAction,
    openVoiceAIModal: openVoiceAIModal,
    closeVoiceAIModal: closeVoiceAIModal,
    toggleVoiceAIRecording: toggleVoiceAIRecording,
    startVoiceAIRecording: startVoiceAIRecording,
    stopVoiceAIRecording: stopVoiceAIRecording,
    submitVoiceManualInput: submitVoiceManualInput,
    finishVoiceAIInput: finishVoiceAIInput
  };
}));
