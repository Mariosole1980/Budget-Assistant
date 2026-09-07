// ============================================================
// AUTH OVERLAY & DIAGNOSTICS SUBSYSTEM
// Autonomous UMD Module (Phase 18B Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
    var exports = factory();
    Object.assign(rootObj, exports);
    rootObj.AuthOverlayService = exports;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

let _authOverlayUserRequested = false; window._authOverlayUserRequested = false;

// ============================================================
// AUTH OVERLAY DIAGNOSTICS
// ------------------------------------------------------------
// When the user taps the lock icon in the header and the login
// overlay fails to open, this mechanism runs a battery of checks
// and displays a detailed diagnostic panel explaining EXACTLY
// what is wrong (missing element, JS error, CSS hiding it, etc.)
// so the problem can be identified and reported precisely.
// ============================================================

// Renders a full-screen diagnostic panel with a list of checks.
function showAuthDiagnosticPanel(checks, thrownError) {
  try {
    // Remove any existing diagnostic panel
    const existing = document.getElementById('auth-diagnostic-panel');
    if (existing) existing.remove();

    const isEl = (state && state.lang === 'el');
    const panel = document.createElement('div');
    panel.id = 'auth-diagnostic-panel';
    panel.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483646;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;';

    const card = document.createElement('div');
    card.style.cssText = 'background:#1e1e2e;color:#e4e4ef;border:1px solid #3a3a52;border-radius:16px;max-width:520px;width:100%;max-height:85vh;overflow-y:auto;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,0.6);';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:18px;font-weight:800;margin-bottom:6px;display:flex;align-items:center;gap:8px;';
    title.innerHTML = '🔍 ' + (isEl ? 'Διαγνωστικά Σύνδεσης' : 'Login Diagnostics');

    const subtitle = document.createElement('div');
    subtitle.style.cssText = 'font-size:13px;color:#9aa0b5;margin-bottom:16px;line-height:1.5;';
    subtitle.textContent = isEl
      ? 'Το λουκέτο σύνδεσης δεν άνοιξε. Παρακάτω φαίνεται τι ακριβώς πήγε στραβά:'
      : 'The login lock did not open. Below is exactly what went wrong:';

    card.appendChild(title);
    card.appendChild(subtitle);

    // Render each check result
    checks.forEach(function (c) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border-radius:10px;margin-bottom:8px;background:' + (c.ok ? 'rgba(46,204,113,0.10)' : 'rgba(239,68,68,0.12)') + ';border:1px solid ' + (c.ok ? 'rgba(46,204,113,0.35)' : 'rgba(239,68,68,0.4)') + ';';
      const icon = document.createElement('span');
      icon.style.cssText = 'font-size:15px;flex-shrink:0;';
      icon.textContent = c.ok ? '✅' : '❌';
      const body = document.createElement('div');
      body.style.cssText = 'font-size:13px;line-height:1.45;';
      const name = document.createElement('div');
      name.style.cssText = 'font-weight:700;color:' + (c.ok ? '#4ade80' : '#f87171') + ';';
      name.textContent = c.label;
      body.appendChild(name);
      if (c.detail) {
        const detail = document.createElement('div');
        detail.style.cssText = 'color:#cbd5e1;font-size:12px;margin-top:2px;word-break:break-word;';
        detail.textContent = c.detail;
        body.appendChild(detail);
      }
      row.appendChild(icon);
      row.appendChild(body);
      card.appendChild(row);
    });

    // Show thrown error if any
    if (thrownError) {
      const errBox = document.createElement('div');
      errBox.style.cssText = 'margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.5);';
      errBox.innerHTML = '<div style="font-weight:700;color:#f87171;font-size:13px;margin-bottom:4px;">⚠️ ' + (isEl ? 'Σφάλμα JavaScript' : 'JavaScript Error') + '</div><div style="font-size:12px;color:#fecaca;word-break:break-word;font-family:monospace;">' + String(thrownError && thrownError.message ? thrownError.message : thrownError) + '</div>';
      card.appendChild(errBox);
    }

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;margin-top:18px;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = isEl ? 'Κλείσιμο' : 'Close';
    closeBtn.style.cssText = 'flex:1;padding:11px;border:none;border-radius:10px;background:#3a3a52;color:#fff;font-weight:700;font-size:14px;cursor:pointer;';
    closeBtn.onclick = function () { panel.remove(); };

    const copyBtn = document.createElement('button');
    copyBtn.textContent = isEl ? '📋 Αντιγραφή Διαγνωστικών' : '📋 Copy Diagnostics';
    copyBtn.style.cssText = 'flex:1;padding:11px;border:none;border-radius:10px;background:#7c6af7;color:#fff;font-weight:700;font-size:14px;cursor:pointer;';
    copyBtn.onclick = function () {
      try {
        const lines = checks.map(function (c) { return (c.ok ? '[OK] ' : '[FAIL] ') + c.label + (c.detail ? ' — ' + c.detail : ''); });
        if (thrownError) lines.push('[ERROR] ' + (thrownError.message || thrownError));
        navigator.clipboard.writeText(lines.join('\n')).then(function () {
          copyBtn.textContent = isEl ? '✅ Αντιγράφηκε!' : '✅ Copied!';
        }).catch(function () {
          copyBtn.textContent = isEl ? '⚠️ Αποτυχία' : '⚠️ Failed';
        });
      } catch (e) { /* ignore */ }
    };

    btnRow.appendChild(closeBtn);
    btnRow.appendChild(copyBtn);
    card.appendChild(btnRow);

    panel.appendChild(card);
    panel.addEventListener('click', function (e) { if (e.target === panel) panel.remove(); });
    document.body.appendChild(panel);
  } catch (e) {
    console.error('[AuthDiag] Failed to render diagnostic panel:', e);
    window.showAlert('Διαγνωστικά σύνδεσης:\n' + JSON.stringify(checks) + '\n' + (thrownError ? thrownError.message : ''));
  }
}

// Runs diagnostics and attempts to open the auth overlay. If it fails,
// shows the diagnostic panel explaining exactly what is wrong.
function openAuthWithDiagnostics() {
  const checks = [];
  const isEl = (state && state.lang === 'el');

  // 1. Check the auth overlay element exists
  const authOverlay = document.getElementById('auth-overlay');
  checks.push({
    ok: !!authOverlay,
    label: isEl ? 'Στοιχείο auth-overlay' : 'auth-overlay element',
    detail: authOverlay ? 'Βρέθηκε (#auth-overlay)' : 'ΔΕΝ βρέθηκε — λείπει από το index.html'
  });

  // 2. Check auth-card exists
  const authCard = document.getElementById('auth-card');
  checks.push({
    ok: !!authCard,
    label: isEl ? 'Στοιχείο auth-card' : 'auth-card element',
    detail: authCard ? 'Βρέθηκε (#auth-card)' : 'ΔΕΝ βρέθηκε — λείπει από το index.html'
  });

  // 3. Check auth-forms-container exists
  const formsContainer = document.getElementById('auth-forms-container');
  checks.push({
    ok: !!formsContainer,
    label: isEl ? 'Στοιχείο auth-forms-container' : 'auth-forms-container element',
    detail: formsContainer ? 'Βρέθηκε (#auth-forms-container)' : 'ΔΕΝ βρέθηκε — λείπει από το index.html'
  });

  // 4. Check showAuthOverlay is defined
  const fnOk = typeof showAuthOverlay === 'function';
  checks.push({
    ok: fnOk,
    label: isEl ? 'Συνάρτηση showAuthOverlay' : 'showAuthOverlay function',
    detail: fnOk ? 'Ορίζεται σωστά' : 'ΔΕΝ ορίζεται — σφάλμα φόρτωσης app.js'
  });

  // 5. Check for early-auth style blocks that might hide the overlay
  const earlyHide = document.getElementById('early-auth-hide-style');
  const earlyStyle = document.getElementById('early-auth-style');
  const hasEarlyHide = !!earlyHide;
  const hasEarlyStyle = !!earlyStyle;
  checks.push({
    ok: !hasEarlyHide && !hasEarlyStyle,
    label: isEl ? 'Προσωρινά style blocks' : 'Temporary style blocks',
    detail: (hasEarlyHide || hasEarlyStyle)
      ? 'Βρέθηκαν blocks που κρύβουν το overlay (early-auth-hide-style' + (hasEarlyHide ? ' ✓' : '') + ', early-auth-style' + (hasEarlyStyle ? ' ✓' : '') + ') — θα αφαιρεθούν'
      : 'Κανένα block που κρύβει το overlay'
  });

  // 6. Check the overlay's current computed display state
  let displayState = 'unknown';
  let visibilityState = 'unknown';
  if (authOverlay) {
    try {
      const cs = window.getComputedStyle(authOverlay);
      displayState = cs.display;
      visibilityState = cs.visibility;
    } catch (e) { /* ignore */ }
  }
  checks.push({
    ok: true,
    label: isEl ? 'Τρέχουσα κατάσταση overlay' : 'Current overlay state',
    detail: 'display=' + displayState + ', visibility=' + visibilityState
  });

  // Attempt to open the overlay, capturing any thrown error
  let thrownError = null;
  let opened = false;
  try {
    showAuthOverlay();
    // Verify it actually became visible
    if (authOverlay) {
      const cs = window.getComputedStyle(authOverlay);
      opened = cs.display !== 'none' && cs.visibility !== 'hidden';
    } else {
      opened = false;
    }
  } catch (err) {
    thrownError = err;
    opened = false;
  }

  checks.push({
    ok: opened,
    label: isEl ? 'Άνοιγμα overlay' : 'Overlay opened',
    detail: opened
      ? (isEl ? 'Το λουκέτο άνοιξε επιτυχώς ✅' : 'The lock opened successfully ✅')
      : (isEl ? 'Το overlay ΔΕΝ εμφανίστηκε' : 'The overlay did NOT appear')
  });

  if (opened) {
    // Success — no need to show the diagnostic panel.
    return;
  }

  // Failure — show the diagnostic panel with all the details.
  showAuthDiagnosticPanel(checks, thrownError);
}
window.openAuthWithDiagnostics = openAuthWithDiagnostics;

// Delegated document-level listener: guarantees the diagnostic fires on the
// lock badge (#user-profile-badge) even if updateHeaderProfileBadge() did not
// set the onclick handler (e.g. stale cache / re-render race on web).
(function ensureLockBadgeDiagnosticListener() {
  try {
    document.addEventListener('click', function (e) {
      try {
        var badge = e.target && e.target.closest ? e.target.closest('#user-profile-badge') : null;
        if (!badge) return;
        // If the overlay is already open, let the normal handler manage it.
        var overlay = document.getElementById('auth-overlay');
        if (overlay && !overlay.classList.contains('hidden')) return;
        // Only intercept if the badge has no working onclick that opens the overlay.
        if (typeof badge.onclick === 'function') return;
        // Fallback: show auth overlay directly.
        if (typeof showAuthOverlay === 'function') {
          showAuthOverlay();
        }
      } catch (err) {
        // Never break other click handling.
      }
    }, true);
  } catch (err) {
    // Ignore — the direct onclick handler remains the primary path.
  }
})();

function showAuthOverlay() {
  try {
    _authOverlayUserRequested = true; window._authOverlayUserRequested = true;
    if (typeof hideLockScreen === 'function') {
      try { hideLockScreen(); } catch (e) { }
    }
    const authOverlay = document.getElementById('auth-overlay');
    if (!authOverlay) return;

    if (authOverlay.parentElement !== document.body) {
      document.body.appendChild(authOverlay);
    }

    const formsContainer = document.getElementById('auth-forms-container');
    const authCard = document.getElementById('auth-card');
    const loadingState = document.getElementById('auth-loading-state');

    // Clean up early styles
    const earlyHideStyle = document.getElementById('early-auth-hide-style');
    if (earlyHideStyle) earlyHideStyle.remove();
    const earlyStyle = document.getElementById('early-auth-style');
    if (earlyStyle) earlyStyle.remove();

    // Also remove any anonymous style blocks in head that hide the overlay
    try {
      document.querySelectorAll('head style').forEach(s => {
        if (s.innerHTML && s.innerHTML.includes('#auth-overlay') && s.innerHTML.includes('none')) {
          s.remove();
        }
      });
    } catch (e) { }

    authOverlay.classList.remove('hidden');
    authOverlay.classList.add('active');
    authOverlay.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; z-index: 2147483647 !important; pointer-events: auto !important; position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; min-height: 100dvh !important; background: radial-gradient(circle at 50% 30%, #1c2536 0%, #090c13 100%) !important;';

    if (formsContainer) formsContainer.style.setProperty('display', 'block', 'important');
    if (authCard) {
      authCard.style.setProperty('display', 'flex', 'important');
      authCard.style.setProperty('visibility', 'visible', 'important');
      authCard.style.setProperty('opacity', '1', 'important');
    }
    if (loadingState) loadingState.style.setProperty('display', 'none', 'important');

    if (typeof switchAuthTab === 'function') {
      try { switchAuthTab('password'); } catch (e) { }
    }

    // Clear other open modals safely
    try {
      document.querySelectorAll('.modal-overlay:not(#auth-overlay), .tx-modal-overlay, .profile-sheet-overlay').forEach(m => m.classList.remove('active'));
    } catch (err) {
      console.warn("Failed to clear modals", err);
    }

    const txModal = document.getElementById('transaction-modal');
    if (txModal) txModal.style.display = 'none';

    const emailInput = document.getElementById('auth-email');
    if (emailInput && !emailInput.value) {
      setTimeout(() => { try { emailInput.focus(); } catch (e) { } }, 150);
    }
  } catch (err) {
    console.error("Auth Overlay Error:", err);
  }
}
window.showAuthOverlay = showAuthOverlay;

function hideAuthOverlay() {
  _authOverlayUserRequested = false; window._authOverlayUserRequested = false;
  const authOverlay = document.getElementById('auth-overlay');
  const formsContainer = document.getElementById('auth-forms-container');
  const loadingState = document.getElementById('auth-loading-state');
  const earlyStyle = document.getElementById('early-auth-style');
  if (earlyStyle) earlyStyle.remove();

  if (authOverlay) {
    authOverlay.classList.remove('active');
    authOverlay.style.removeProperty('display');
    authOverlay.style.display = 'none';
    authOverlay.style.pointerEvents = '';
  }
  if (loadingState) loadingState.style.display = 'none';
  if (formsContainer) formsContainer.style.display = 'block';
  forceViewportReset();
  if (state.guestMode || state.currentUser) {
    flushUI();
  }
}
window.hideAuthOverlay = hideAuthOverlay;

function closeAuth() {
  hideAuthOverlay();
}
window.closeAuth = closeAuth;

  // Window Bindings
  window.showAuthDiagnosticPanel = showAuthDiagnosticPanel;
  window.openAuthWithDiagnostics = openAuthWithDiagnostics;
  window.showAuthOverlay = showAuthOverlay;
  window.hideAuthOverlay = hideAuthOverlay;
  window.closeAuth = closeAuth;

  return {
    showAuthDiagnosticPanel: showAuthDiagnosticPanel,
    openAuthWithDiagnostics: openAuthWithDiagnostics,
    showAuthOverlay: showAuthOverlay,
    hideAuthOverlay: hideAuthOverlay,
    closeAuth: closeAuth,
    getAuthOverlayUserRequested: function() { return _authOverlayUserRequested; },
    setAuthOverlayUserRequested: function(val) { _authOverlayUserRequested = !!val; window._authOverlayUserRequested = !!val; }
  };
}));
