/**
 * ============================================================
 * SPLASH & COLD-START LIFECYCLE SUBSYSTEM
 * ============================================================
 * Coordinates branded splash screen animation timing, cold start overlay fade-out,
 * background-to-resume overlays (anti-black flash), and native Android first paint signals.
 *
 * Extracted from app.js (Phase 22A Architectural Modularization)
 * ============================================================
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SplashLifecycleService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const _splashAppStartTime = (typeof window !== 'undefined' && typeof window._pageLoadTimestamp === 'number')
    ? window._pageLoadTimestamp
    : Date.now();
  let _coldStartFadeDone = false;
  let _splashFrameStartMs = 0;

  function _markSplashFrameLoaded() {
    if (!_splashFrameStartMs) _splashFrameStartMs = Date.now();
    if (typeof window !== 'undefined') window._splashFrameStartMs = _splashFrameStartMs;
  }

  let _launchWindowGoneMs = 0;
  function _markLaunchWindowGone() {
    if (!_launchWindowGoneMs) _launchWindowGoneMs = Date.now();
    if (typeof window !== 'undefined') {
      window._launchWindowGoneMs = _launchWindowGoneMs;
      if (!window.__launchGoneAt) window.__launchGoneAt = _launchWindowGoneMs;
    }
  }

  function fadeOutColdStartOverlay() {
    if (_coldStartFadeDone) return;
    if (typeof document === 'undefined') return;

    const frame = document.getElementById('cold-start-frame') || document.getElementById('cold-start-overlay');
    if (!frame) {
      _coldStartFadeDone = true;
      return;
    }

    const winAnchor = typeof window !== 'undefined' ? (window._splashFrameStartMs || 0) : 0;
    const winGoneAnchor = typeof window !== 'undefined' ? (window.__launchGoneAt || 0) : 0;

    const anchor = Math.max(
      _splashFrameStartMs || winAnchor,
      _launchWindowGoneMs || winGoneAnchor,
      _splashAppStartTime
    );
    const elapsed = Date.now() - anchor;
    const minVisibleMs = 1500;
    if (elapsed < minVisibleMs) {
      setTimeout(fadeOutColdStartOverlay, minVisibleMs - elapsed);
      return;
    }

    _coldStartFadeDone = true;
    frame.style.pointerEvents = 'none';
    frame.style.transition = 'opacity 0.45s ease';
    frame.style.opacity = '0';
    setTimeout(() => {
      if (frame.parentNode) frame.parentNode.removeChild(frame);
    }, 450);
  }

  let _resumeOverlayTimer = null;
  function showResumeOverlay() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    if (document.documentElement.classList.contains('web-mode')) return;

    const overlay = document.getElementById('resume-overlay');
    if (!overlay) return;

    const savedTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('app_theme')) || 'dark';
    const bgColor = (typeof window !== 'undefined' && typeof window.getThemeBgColor === 'function')
      ? window.getThemeBgColor(savedTheme)
      : '#181b22';
    overlay.style.backgroundColor = bgColor;
    overlay.style.transition = 'none';
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';

    if (_resumeOverlayTimer) clearTimeout(_resumeOverlayTimer);
    _resumeOverlayTimer = setTimeout(() => {
      _resumeOverlayTimer = null;
      hideResumeOverlay();
    }, 450);
  }

  function hideResumeOverlay() {
    if (typeof document === 'undefined') return;
    const overlay = document.getElementById('resume-overlay');
    if (!overlay) return;
    overlay.style.transition = 'opacity 0.25s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.visibility = 'hidden';
    }, 280);
  }

  function _notifyNativeContentPainted() {
    if (typeof window === 'undefined') return;
    const _isNativeAndroid = !!(window.Capacitor &&
      window.Capacitor.isNativePlatform &&
      window.Capacitor.isNativePlatform());
    if (!_isNativeAndroid) return;
    if (!window.NativeApp || typeof window.NativeApp.onFirstPaint !== 'function') return;
    if (window._contentPaintNotified) return;
    window._contentPaintNotified = true;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try { window.NativeApp.onFirstPaint(); } catch (e) { /* fail silently */ }
        });
      });
    }
  }

  // Safety fallback for UI recovery
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      fadeOutColdStartOverlay();
    }, 5000);

    window._markSplashFrameLoaded = _markSplashFrameLoaded;
    window._markLaunchWindowGone = _markLaunchWindowGone;
    window.fadeOutColdStartOverlay = fadeOutColdStartOverlay;
    window.showResumeOverlay = showResumeOverlay;
    window.hideResumeOverlay = hideResumeOverlay;
    window._notifyNativeContentPainted = _notifyNativeContentPainted;
  }

  return {
    _markSplashFrameLoaded,
    _markLaunchWindowGone,
    fadeOutColdStartOverlay,
    showResumeOverlay,
    hideResumeOverlay,
    _notifyNativeContentPainted
  };
}));
