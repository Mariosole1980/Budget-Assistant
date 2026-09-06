/**
 * js/gestureEngine.js
 *
 * Gesture & Touch Navigation Engine.
 * Extracted from app.js (Phase 13C Architectural Extraction).
 *
 * Features:
 * - Pull-To-Refresh physics, resistance curve & indicator animations
 * - Swipe-To-Back edge navigation, popstate history handling & double-back-to-exit
 * - Receipt photo lightbox multi-touch pinch-to-zoom & boundary clamping
 * - UMD wrapper exposing globals to window and methods to Node tests
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

function initPullToRefresh() {
  const container = document.querySelector('.app-content');
  const ptr = document.getElementById('pull-to-refresh');
  if (!container || !ptr) return;

  const ptrIcon = ptr.querySelector('.pull-to-refresh-icon');
  const ptrSpinner = ptr.querySelector('.pull-to-refresh-spinner');
  const ptrContent = ptr.querySelector('.pull-to-refresh-content');

  let startX = 0;
  let startY = 0;
  let currentY = 0;
  let pulling = false; // false, true, or null (undetermined)
  const threshold = 48; // px to trigger refresh (snappy and responsive)
  const maxPull = 90; // max px to pull container

  // Helper to update pull state visually
  function updatePull(diff) {
    if (diff <= 0) {
      ptr.style.height = '0px';
      ptrContent.style.opacity = '0';
      ptrContent.style.transform = 'scale(0.8)';
      return;
    }
    // simple rubber band effect
    const pullHeight = Math.min(maxPull, diff * 0.45);
    ptr.style.height = `${pullHeight}px`;

    const progress = Math.min(1, pullHeight / threshold);
    ptrContent.style.opacity = progress.toString();
    ptrContent.style.transform = `scale(${0.8 + progress * 0.2})`;

    const rot = Math.min(180, progress * 180);
    if (ptrIcon) {
      ptrIcon.style.transform = `rotate(${rot}deg)`;
      if (pullHeight >= threshold) {
        ptrIcon.style.color = 'var(--blue-positive)';
      } else {
        ptrIcon.style.color = 'var(--accent)';
      }
    }
  }

  // Helper to start the refresh process
  async function triggerRefresh() {
    ptr.classList.remove('pulling');
    ptr.classList.add('refreshing');
    ptr.style.height = '50px';
    ptrContent.style.opacity = '1';
    ptrContent.style.transform = 'scale(1)';

    if (ptrIcon) ptrIcon.style.display = 'none';
    if (ptrSpinner) ptrSpinner.style.display = 'flex';

    if (navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch (err) { }
    }

    try {
      await loadData();
      updateUI();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      // Snappy, instant dismiss with smooth ease transition
      ptr.style.transition = 'height 0.22s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.2s ease';
      ptr.style.height = '0px';
      ptrContent.style.opacity = '0';
      ptr.classList.remove('refreshing');
      setTimeout(() => {
        ptr.style.transition = '';
        if (ptrIcon) {
          ptrIcon.style.transform = '';
          ptrIcon.style.display = '';
          ptrIcon.style.color = '';
        }
        if (ptrSpinner) ptrSpinner.style.display = 'none';
      }, 230);
    }
  }

  // Helper to cancel the pull and snap back
  function cancelPull() {
    ptr.classList.remove('pulling');
    ptr.style.transition = 'height 0.2s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.18s ease';
    ptr.style.height = '0px';
    ptrContent.style.opacity = '0';
    ptrContent.style.transform = 'scale(0.8)';
    setTimeout(() => {
      ptr.style.transition = '';
      if (ptrIcon) {
        ptrIcon.style.transform = '';
        ptrIcon.style.display = '';
        ptrIcon.style.color = '';
      }
      if (ptrSpinner) ptrSpinner.style.display = 'none';
    }, 220);
  }

  // TOUCH EVENTS
  container.addEventListener('touchstart', (e) => {
    const activeScrollEl = document.querySelector(`.tab-screen.active .${state.activeTab}-scroll-content`);
    let isScrollAtTop = activeScrollEl ? (activeScrollEl.scrollTop === 0) : (container.scrollTop === 0);

    if (isScrollAtTop) {
      const touch = e.touches[0];
      startX = touch.pageX;
      startY = touch.pageY;
      currentY = startY;
      pulling = null; // Undetermined at first touch
    } else {
      pulling = false;
    }
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (pulling === false) return;

    const touch = e.touches[0];
    const dx = touch.pageX - startX;
    const dy = touch.pageY - startY;

    if (pulling === null) {
      // Must drag at least 8px to determine intention
      if (Math.abs(dy) > 8 || Math.abs(dx) > 8) {
        if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
          pulling = true;
          ptr.classList.add('pulling');
          ptr.classList.remove('refreshing');
          if (ptrIcon) ptrIcon.style.display = 'flex';
          if (ptrSpinner) ptrSpinner.style.display = 'none';
        } else {
          pulling = false;
          return;
        }
      } else {
        return;
      }
    }

    if (pulling === true) {
      currentY = touch.pageY;
      const diff = currentY - startY;
      if (diff > 0) {
        if (e.cancelable) {
          e.preventDefault();
        }
        updatePull(diff);
      } else {
        pulling = false;
        cancelPull();
      }
    }
  }, { passive: false });

  container.addEventListener('touchend', () => {
    if (pulling !== true) {
      pulling = false;
      return;
    }
    pulling = false;
    const diff = currentY - startY;
    const pullHeight = Math.min(maxPull, diff * 0.45);
    if (pullHeight >= threshold) {
      triggerRefresh();
    } else {
      cancelPull();
    }
  }, { passive: true });
}

function initSwipeToBack() {
  const TAB_ORDER = ['trans', 'stats', 'accounts', 'more'];
  let bsStartX = 0, bsStartY = 0, bsActive = false, bsSwiping = null;
  let bsDragging = false;
  const COMMIT_RATIO = 0.30; // 30% of screen width to commit

  let activeOverlayEl = null;
  let activeOverlayParent = null;

  // Setup system history state to prevent exiting the app on system back gesture/button (PWA fallback)
  history.pushState({ appState: 'active' }, '', window.location.pathname + window.location.search);
  state.historyPushed = true;

  // Shared back-navigation handler used by BOTH the popstate listener (PWA / WebView
  // history pop) and the Capacitor backButton listener. A debounce guard prevents
  // double-fire when both events fire for the same physical back press (which can
  // happen depending on Capacitor version / WebView config). Without this guard, a
  // single back press could close TWO things (e.g. a modal AND then navigate a tab
  // back or exit the app).
  let lastBackHandledAt = 0;
  const BACK_DEBOUNCE_MS = 400;
  // Double-back-to-exit: track when the user first pressed back with nothing left
  // to close, so the app only exits on the SECOND back press (standard Android UX).
  let lastExitRequestAt = 0;
  const EXIT_CONFIRM_WINDOW_MS = 2000;
  function handleBackNavigation(source, e) {
    const now = Date.now();
    if (now - lastBackHandledAt < BACK_DEBOUNCE_MS) {
      return;
    }
    lastBackHandledAt = now;

    // Guard: Ignore back if the document is hidden, backgrounding, or blurred
    // (e.g. during home swipe gesture).
    if (document.visibilityState === 'hidden') {
      return;
    }

    // Guard: If the in-app edge-swipe-back is actively dragging an overlay/screen,
    // ignore the native back event so it does not double-fire and cause jitter.
    // The in-app swipe will commit the close itself (with a smooth slide).
    if (window._swipeBackDragging) {
      return;
    }

    const handled = triggerBackAction();
    if (handled) {
      // A modal/overlay was closed (or tab was navigated back). Re-push a fresh
      // history entry so the next back press can be handled again (PWA path).
      history.pushState({ appState: 'active', tab: state.activeTab }, '', window.location.pathname + window.location.search);
      state.historyPushed = true;
      return;
    }

    // Nothing was handled (no modal, no overlay, no selection mode, already on
    // the first tab). Decide what to do based on the source.
    if (source === 'backButton') {
      // Capacitor: no more in-app back actions. Use the standard Android
      // "double back to exit" pattern — the FIRST back press only shows a toast
      // ("press back again to exit"); the app exits on the SECOND press within
      // the confirm window. This prevents accidentally minimizing the app with a
      // single swipe-back while on the Transactions tab.
      const nowMs = Date.now();
      if (nowMs - lastExitRequestAt < EXIT_CONFIRM_WINDOW_MS) {
        // Second back press within the window → actually exit the app.
        const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
        if (App && typeof App.exitApp === 'function') {
          App.exitApp();
        }
        return;
      }
      // First back press → show confirmation toast and arm the exit window.
      lastExitRequestAt = nowMs;
      const exitMsg = state.lang === 'el'
        ? 'Πατήστε ξανά πίσω για έξοδο'
        : 'Press back again to exit';
      if (typeof showSyncToast === 'function') {
        showSyncToast(exitMsg, EXIT_CONFIRM_WINDOW_MS);
      }
      return;
    }

    // popstate (PWA / WebView): no more in-app back actions. If the popped state
    // carried a tab, restore it; otherwise just refresh the UI.
    state.historyPushed = false;
    if (e && e.state && e.state.tab && e.state.tab !== state.activeTab) {
      switchTab(e.state.tab, true);
    } else {
      updateUI();
    }
  }

  window.addEventListener('popstate', (e) => {
    // NOTE: No Capacitor early-return here. In some Capacitor/WebView configs the
    // history pop fires popstate on back press even when a backButton listener is
    // registered. Routing through the shared handler (with its debounce guard)
    // makes this safe: if backButton also fires for the same press, the second
    // call is debounced away.
    handleBackNavigation('popstate', e);
  });

  // Native Capacitor Back Button Interception
  function registerCapacitorBackButton() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      const App = window.Capacitor.Plugins.App;
      if (App && typeof App.addListener === 'function') {
        App.addListener('backButton', () => {
          handleBackNavigation('backButton');
        });
        return true;
      }
    }
    return false;
  }

  // Native Capacitor Deep Link Interception
  function registerCapacitorDeepLinks() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      const App = window.Capacitor.Plugins.App;
      if (App && typeof App.addListener === 'function') {
        App.addListener('appUrlOpen', async (data) => {
          if (!data || !data.url) return;
          console.log('[DeepLink] Received URL:', data.url);

          const hashIndex = data.url.indexOf('#');
          const searchIndex = data.url.indexOf('?');
          let hash = '';
          let search = '';
          if (hashIndex !== -1) {
            hash = data.url.substring(hashIndex);
          }
          if (searchIndex !== -1) {
            const endIdx = hashIndex !== -1 && hashIndex > searchIndex ? hashIndex : data.url.length;
            search = data.url.substring(searchIndex, endIdx);
          }

          const hashParams = new URLSearchParams(hash.substring(1));
          const searchParams = new URLSearchParams(search.substring(1));

          const code = searchParams.get('code') || hashParams.get('code');
          const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');

          if (!state.supabaseClient) return;

          if (code) {
            toggleLoader(true);
            try {
              const { data: sessionData, error } = await state.supabaseClient.auth.exchangeCodeForSession(code);
              if (error) {
                console.error('[DeepLink] exchangeCodeForSession failed:', error);
                toggleLoader(false);
              } else if (sessionData && sessionData.session && sessionData.session.user) {
                state.currentUser = sessionData.session.user;
                localStorage.setItem('cached_current_user', JSON.stringify(sessionData.session.user));
                hideAuthOverlay();
                await forceSyncNow(true);
                toggleLoader(false);
              } else {
                toggleLoader(false);
              }
            } catch (err) {
              console.error('[DeepLink] exchangeCodeForSession error:', err);
              toggleLoader(false);
            }
          } else if (accessToken) {
            toggleLoader(true);
            try {
              const { data: sessionData, error } = await state.supabaseClient.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
              });
              if (error) {
                console.error('[DeepLink] Failed to set session:', error);
                toggleLoader(false);
              } else if (sessionData && sessionData.session && sessionData.session.user) {
                state.currentUser = sessionData.session.user;
                localStorage.setItem('cached_current_user', JSON.stringify(sessionData.session.user));
                hideAuthOverlay();
                await forceSyncNow(true);
                toggleLoader(false);
              } else {
                toggleLoader(false);
              }
            } catch (err) {
              console.error('[DeepLink] Error setting session:', err);
              toggleLoader(false);
            }
          }
        });
        return true;
      }
    }
    return false;
  }

  const resBack = registerCapacitorBackButton();
  const resLink = registerCapacitorDeepLinks();
  if (!resBack || !resLink) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const successBack = registerCapacitorBackButton();
      const successLink = registerCapacitorDeepLinks();
      if ((successBack && successLink) || attempts > 50) {
        clearInterval(interval);
      }
    }, 100);
  }

  function hasActiveOverlay() {
    // Check if any modal, keypad, search, or selection mode is active
    const lightbox = document.getElementById('photo-lightbox-modal');
    if (lightbox && lightbox.style.display === 'flex') return true;
    const keypad = document.getElementById('custom-calculator-keypad');
    if (keypad && keypad.classList.contains('active')) return true;
    const activeModals = document.querySelectorAll('.modal-overlay.active, .tx-modal-overlay.active');
    if (activeModals.length > 0) return true;
    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay && searchOverlay.classList.contains('active')) return true;
    if (state.selectionMode) return true;
    return false;
  }

  // Full-screen modals (e.g. the transaction modal) fill the entire screen and
  // have NO visible background behind them. Dragging them away via the edge
  // swipe-back gesture is jarring and pointless (there is nothing to reveal), so
  // the swipe-back must be disabled while one of these is open.
  function hasFullScreenModalActive() {
    const fullScreenModals = ['transaction-modal', 'profile-settings-modal'];
    const activeModals = document.querySelectorAll('.modal-overlay.active, .tx-modal-overlay.active, .profile-sheet-overlay.active');
    for (let i = 0; i < activeModals.length; i++) {
      if (fullScreenModals.includes(activeModals[i].id)) return true;
    }
    return false;
  }

  function getActiveOverlayElement() {
    const lightbox = document.getElementById('photo-lightbox-modal');
    if (lightbox && lightbox.style.display === 'flex') return lightbox;

    const keypad = document.getElementById('custom-calculator-keypad');
    if (keypad && keypad.classList.contains('active')) return null; // do not drag keypad horizontally

    const activeModals = document.querySelectorAll('.modal-overlay.active, .tx-modal-overlay.active');
    if (activeModals.length > 0) {
      return activeModals[activeModals.length - 1].querySelector('.modal-content');
    }

    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay && searchOverlay.classList.contains('active')) return searchOverlay;

    return null;
  }

  function cleanupOverlayStyles(el, parent) {
    if (el) {
      el.style.transform = '';
      el.style.transition = '';
      el.style.willChange = '';
    }
    if (parent) {
      parent.style.opacity = '';
      parent.style.transition = '';
      parent.style.willChange = '';
    }
  }

  function triggerBackAction() {
    if (document.visibilityState === 'hidden') {
      return false;
    }

    // 0. Close photo lightbox if active
    const lightbox = document.getElementById('photo-lightbox-modal');
    if (lightbox && lightbox.style.display === 'flex') {
      closePhotoLightbox();
      return true;
    }

    // 1. Close calculator keypad if active
    const keypad = document.getElementById('custom-calculator-keypad');
    if (keypad && keypad.classList.contains('active')) {
      closeCalculatorKeypad();
      return true;
    }

    // 2. Close Month/Year bottom sheet inside date picker if active
    const datePickerBS = document.getElementById('custom-date-picker-bs');
    if (datePickerBS && datePickerBS.classList.contains('active')) {
      closeCustomDatePickerBS();
      return true;
    }

    // 3. STRICT LIFO MODAL CLOSE: Close TOPMOST active modal first
    //    (includes the transaction modal which uses .tx-modal-overlay)
    const activeModals = document.querySelectorAll('.modal-overlay.active, .tx-modal-overlay.active');
    if (activeModals.length > 0) {
      const topModal = activeModals[activeModals.length - 1];
      if (topModal && topModal.id) {
        // System back button / swipe-back is a deliberate user action — mark it
        // user-initiated so the resume guard never blocks the close (no lag).
        window.__userInitiatedClose = true;
        closeModal(topModal.id);
        return true;
      }
    }

    // 4. Close search overlay if active
    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay && searchOverlay.classList.contains('active')) {
      closeSearchOverlay();
      return true;
    }

    // 5. Cancel selection mode
    if (state.selectionMode) {
      exitSelectionMode();
      return true;
    }

    // 6. Navigate to previous tab in order
    const currentIdx = TAB_ORDER.indexOf(state.activeTab);
    if (currentIdx > 0) {
      switchTab(TAB_ORDER[currentIdx - 1]);
      return true;
    }

    return false;
  }

  // --- Interactive drag-to-go-back gesture (overlays/modals only) ---
  let screenWidth = 0;

  document.addEventListener('touchstart', (e) => {
    // Only handle swipe back gesture when an overlay/modal/sheet is actively open!
    if (!hasActiveOverlay() || hasFullScreenModalActive()) {
      bsActive = false;
      return;
    }

    if (e.target.closest('#trans-photo-previews-list, .lightbox-zoom-container, #statsChart, canvas')) {
      bsActive = false;
      return;
    }

    const img = document.getElementById('photo-lightbox-img');
    const isZoomed = img && parseFloat(img.dataset.scale || '1') > 1;
    if (isZoomed) {
      bsActive = false;
      return;
    }

    const touch = e.touches[0];
    bsStartX = touch.clientX;
    bsStartY = touch.clientY;
    bsSwiping = null;
    bsDragging = false;

    // Allow swipe back starting from the left 150px of an active overlay
    bsActive = bsStartX <= 150;

    screenWidth = window.innerWidth;
    activeOverlayEl = null;
    activeOverlayParent = null;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!bsActive || !hasActiveOverlay()) return;
    const touch = e.touches[0];
    const dx = touch.clientX - bsStartX;
    const dy = touch.clientY - bsStartY;

    if (bsSwiping === null) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        bsSwiping = Math.abs(dx) > Math.abs(dy) && dx > 0;
        if (!bsSwiping) { bsActive = false; return; }
      } else return;
    }

    if (e.cancelable) e.preventDefault();

    const clampedDx = Math.max(0, Math.min(dx, screenWidth));
    const progress = clampedDx / screenWidth;

    if (!bsDragging) {
      bsDragging = true;
      window._swipeBackDragging = true;
      activeOverlayEl = getActiveOverlayElement();
      if (activeOverlayEl) {
        activeOverlayParent = activeOverlayEl.closest('.modal-overlay, .tx-modal-overlay') || activeOverlayEl;
        activeOverlayEl.style.transition = 'none';
        activeOverlayEl.style.willChange = 'transform';
        if (activeOverlayParent) {
          activeOverlayParent.style.transition = 'none';
          activeOverlayParent.style.willChange = 'opacity';
        }
      }
    }

    if (activeOverlayEl) {
      activeOverlayEl.style.transform = `translateX(${clampedDx}px)`;
      if (activeOverlayParent) {
        activeOverlayParent.style.opacity = String(1 - progress * 0.5);
      }
    }
  }, { passive: false });

  function finishDrag(committed) {
    if (!bsDragging) return;

    const activeEl = activeOverlayEl;
    const parentEl = activeOverlayParent;

    activeOverlayEl = null;
    activeOverlayParent = null;
    bsDragging = false;
    window._swipeBackDragging = false;

    if (activeEl) {
      const dur = '0.22s';
      if (committed) {
        activeEl.style.transition = `transform ${dur} cubic-bezier(0.2, 0.8, 0.3, 1)`;
        activeEl.style.transform = `translateX(${screenWidth}px)`;
        if (parentEl) {
          parentEl.style.transition = `opacity ${dur} ease`;
          parentEl.style.opacity = '0';
        }
        setTimeout(() => {
          triggerBackAction();
          cleanupOverlayStyles(activeEl, parentEl);
        }, 230);
      } else {
        activeEl.style.transition = `transform ${dur} cubic-bezier(0.2, 0.8, 0.3, 1)`;
        activeEl.style.transform = '';
        if (parentEl) {
          parentEl.style.transition = `opacity ${dur} ease`;
          parentEl.style.opacity = '';
        }
        setTimeout(() => {
          cleanupOverlayStyles(activeEl, parentEl);
        }, 210);
      }
    }
  }

  document.addEventListener('touchend', (e) => {
    if (!bsActive || !bsSwiping) {
      bsActive = false; bsSwiping = null;
      if (bsDragging) finishDrag(false);
      window._swipeBackDragging = false;
      return;
    }

    const touch = e.changedTouches[0] || e.touches[0];
    const dx = touch.clientX - bsStartX;
    bsActive = false; bsSwiping = null;

    if (bsDragging) {
      const committed = dx >= screenWidth * COMMIT_RATIO;
      finishDrag(committed);
    }
  }, { passive: false });

  document.addEventListener('touchcancel', () => {
    if (bsDragging) finishDrag(false);
    bsActive = false;
    bsSwiping = null;
    window._swipeBackDragging = false;
  }, { passive: true });
}

function initLightboxPinchZoom() {
  const img = document.getElementById('photo-lightbox-img');
  const modal = document.getElementById('photo-lightbox-modal');
  if (!img || !modal) return;

  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  let startDist = 0;
  let startScale = 1;
  let startCenter = { x: 0, y: 0 };
  let startTx = 0;
  let startTy = 0;

  let isDragging = false;
  let startX = 0;
  let startY = 0;

  let lastTapTime = 0;

  function getDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }

  img.addEventListener('touchstart', (e) => {
    const now = Date.now();

    // Double tap to zoom/reset
    if (e.touches.length === 1 && now - lastTapTime < 300) {
      e.preventDefault();
      if (scale > 1) {
        resetTransform();
      } else {
        const touch = e.touches[0];
        const rect = img.getBoundingClientRect();
        const baseWidth = rect.width;
        const baseHeight = rect.height;
        const viewWidth = window.innerWidth;
        const viewHeight = window.innerHeight;

        scale = 2.5;
        const originX = viewWidth / 2;
        const originY = viewHeight / 2;
        translateX = (touch.clientX - originX) * (1 - scale);
        translateY = (touch.clientY - originY) * (1 - scale);

        // Clamp translations
        const maxTx = Math.max(0, (baseWidth * scale - viewWidth) / 2);
        const maxTy = Math.max(0, (baseHeight * scale - viewHeight) / 2);
        translateX = Math.max(-maxTx, Math.min(translateX, maxTx));
        translateY = Math.max(-maxTy, Math.min(translateY, maxTy));

        img.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)';
        img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      }
      lastTapTime = 0;
      return;
    }

    if (e.touches.length === 1) {
      lastTapTime = now;
      if (scale > 1) {
        isDragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTx = translateX;
        startTy = translateY;
      }
    } else if (e.touches.length === 2) {
      isDragging = false;
      e.preventDefault();
      startDist = getDistance(e.touches);
      startScale = scale;
      startCenter = getCenter(e.touches);
      startTx = translateX;
      startTy = translateY;
    }
  }, { passive: false });

  img.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isDragging && scale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      translateX = startTx + dx;
      translateY = startTy + dy;

      // Boundaries with visual resistance
      const rect = img.getBoundingClientRect();
      const baseWidth = rect.width / scale;
      const baseHeight = rect.height / scale;
      const viewWidth = window.innerWidth;
      const viewHeight = window.innerHeight;

      const maxTx = Math.max(0, (baseWidth * scale - viewWidth) / 2);
      const maxTy = Math.max(0, (baseHeight * scale - viewHeight) / 2);

      if (translateX > maxTx) translateX = maxTx + (translateX - maxTx) * 0.3;
      if (translateX < -maxTx) translateX = -maxTx + (translateX + maxTx) * 0.3;
      if (translateY > maxTy) translateY = maxTy + (translateY - maxTy) * 0.3;
      if (translateY < -maxTy) translateY = -maxTy + (translateY + maxTy) * 0.3;

      applyTransform();
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getDistance(e.touches);
      if (dist > 10 && startDist > 10) {
        const factor = dist / startDist;
        const targetScale = startScale * factor;

        scale = Math.max(0.8, Math.min(targetScale, 5));

        const currentCenter = getCenter(e.touches);
        const scaleRatio = scale / startScale;
        translateX = currentCenter.x - (startCenter.x - startTx) * scaleRatio;
        translateY = currentCenter.y - (startCenter.y - startTy) * scaleRatio;

        applyTransform();
      }
    }
  }, { passive: false });

  img.addEventListener('touchend', (e) => {
    isDragging = false;

    // Snapping back transitions
    if (scale < 1) {
      resetTransform();
    } else if (scale > 1) {
      const rect = img.getBoundingClientRect();
      const baseWidth = rect.width / scale;
      const baseHeight = rect.height / scale;
      const viewWidth = window.innerWidth;
      const viewHeight = window.innerHeight;

      const maxTx = Math.max(0, (baseWidth * scale - viewWidth) / 2);
      const maxTy = Math.max(0, (baseHeight * scale - viewHeight) / 2);

      let targetTx = translateX;
      let targetTy = translateY;
      let needsSnap = false;

      if (translateX > maxTx) { targetTx = maxTx; needsSnap = true; }
      else if (translateX < -maxTx) { targetTx = -maxTx; needsSnap = true; }

      if (translateY > maxTy) { targetTy = maxTy; needsSnap = true; }
      else if (translateY < -maxTy) { targetTy = -maxTy; needsSnap = true; }

      if (needsSnap) {
        translateX = targetTx;
        translateY = targetTy;
        img.style.transition = 'transform 0.2s ease-out';
        img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      }
    }
  });

  function applyTransform() {
    img.style.transition = 'none';
    img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    img.dataset.scale = scale;
  }

  function resetTransform() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    img.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)';
    img.style.transform = `translate(0px, 0px) scale(1)`;
    img.dataset.scale = 1;
  }

  window.resetLightboxPinchZoom = resetTransform;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'style') {
        const display = modal.style.display;
        if (display === 'none') {
          resetTransform();
        }
      }
    });
  });
  observer.observe(modal, { attributes: true });
}

  // UMD Exports & Window Bindings
  if (typeof window !== 'undefined') {
    window.initPullToRefresh = initPullToRefresh;
    window.initSwipeToBack = initSwipeToBack;
    window.initLightboxPinchZoom = initLightboxPinchZoom;
  }

  return {
    initPullToRefresh: initPullToRefresh,
    initSwipeToBack: initSwipeToBack,
    initLightboxPinchZoom: initLightboxPinchZoom
  };
}));
