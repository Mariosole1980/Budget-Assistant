/**
 * js/billingService.js
 *
 * In-App Billing, Google Play Billing & Lifetime Premium Subsystem.
 * Extracted from app.js (Phase 14A Architectural Extraction).
 *
 * Features:
 * - Lifetime Premium modal & purchase flow UI
 * - Google Play Billing Plugin integration (Android native)
 * - Google Pay direct wallet flow (Web)
 * - Stripe checkout fallback & webhook confirmation
 * - Cloud premium status reconciliation & restore purchases
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

// ============================================================
// PREMIUM MODAL & PURCHASE FLOW
// ============================================================
// Opens the Premium modal. If a featureKey is provided, it highlights the
// relevant feature (used by requirePremium() from gated features).
function openPremiumModal(featureKey) {
  updatePremiumUI();
  openModal('premium-modal');
}

// Updates the Premium modal + Settings Hub badge to reflect current status.
function updatePremiumUI() {
  const active = isPremium();
  const banner = document.getElementById('premium-active-banner');
  const buyBtn = document.getElementById('premium-purchase-btn');
  const cardBtn = document.getElementById('premium-pay-card-btn');
  const paypalBtn = document.getElementById('premium-pay-paypal-btn');
  const gplayBtn = document.getElementById('premium-pay-gplay-btn');
  const gpayBtn = document.getElementById('premium-pay-gpay-btn');
  const chooseHeading = document.querySelector('#premium-modal [data-i18n="premium_choose_payment"]');
  const badge = document.getElementById('hub-premium-badge');
  const subtitle = document.getElementById('hub-premium-subtitle');

  // NATIVE (Android): Google Play Billing is the ONLY payment channel. The Play
  // purchase sheet itself offers Card (Google Wallet), Google Pay and PayPal, so
  // the in-app Stripe/PayPal/web-Google-Pay options are hidden entirely.
  const isNative = typeof window.Capacitor !== 'undefined' &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform();

  if (banner) banner.style.display = active ? 'block' : 'none';
  if (buyBtn) buyBtn.style.display = active ? 'none' : 'block';

  if (isNative) {
    if (cardBtn) cardBtn.style.display = 'none';
    if (paypalBtn) paypalBtn.style.display = 'none';
    if (gpayBtn) gpayBtn.style.display = 'none';
    if (gplayBtn) gplayBtn.style.display = active ? 'none' : 'flex';
    if (chooseHeading && chooseHeading.parentElement) {
      chooseHeading.parentElement.style.display = 'none';
    }
  } else {
    if (cardBtn) cardBtn.style.display = active ? 'none' : 'flex';
    if (paypalBtn) paypalBtn.style.display = active ? 'none' : 'flex';
    if (gpayBtn) gpayBtn.style.display = active ? 'none' : 'flex';
    if (gplayBtn) gplayBtn.style.display = 'none';
    if (chooseHeading && chooseHeading.parentElement) {
      chooseHeading.parentElement.style.display = active ? 'none' : 'flex';
    }
  }
  if (badge) {
    badge.textContent = active
      ? (state.lang === 'el' ? 'Ενεργό' : 'Active')
      : (state.lang === 'el' ? 'Αναβάθμισε' : 'Upgrade');
    badge.style.background = active ? 'rgba(34,197,94,0.2)' : 'rgba(255,193,7,0.2)';
    badge.style.color = active ? '#22c55e' : '#ffc107';
  }
  if (subtitle) {
    subtitle.textContent = active
      ? (state.lang === 'el' ? 'Όλα τα features ξεκλειδωμένα' : 'All features unlocked')
      : (state.lang === 'el' ? 'Ξεκλείδωσε όλα τα features — εφάπαξ' : 'Unlock all features — one-time');
  }

  const footnoteEl = document.querySelector('#premium-modal [data-i18n="premium_footnote"]');
  if (footnoteEl) {
    if (isNative) {
      footnoteEl.textContent = state.lang === 'el'
        ? 'Ασφαλείς συναλλαγές μέσω Google Play'
        : 'Secure transactions guaranteed via Google Play';
    } else {
      footnoteEl.textContent = state.lang === 'el'
        ? 'Ασφαλείς συναλλαγές μέσω Stripe'
        : 'Secure transactions guaranteed via Stripe';
    }
  }

  // The Google Play button is the ONLY purchase entry point on native, so its
  // label advertises the actual payment methods the user can pay with — the
  // Play purchase sheet itself offers Card (Google Wallet), Google Pay and
  // PayPal. Set here so OTA-only app.js updates reach native users even with
  // an old bundled translations file.
  const gplayLabelEl = document.querySelector('#premium-modal [data-i18n="premium_pay_gplay"]');
  const gplayDescEl = document.querySelector('#premium-modal [data-i18n="premium_pay_gplay_desc"]');
  if (isNative) {
    if (gplayLabelEl) {
      gplayLabelEl.textContent = state.lang === 'el'
        ? 'Πληρωμή με Κάρτα, Google Pay ή PayPal'
        : 'Pay with Card, Google Pay or PayPal';
    }
    if (gplayDescEl) {
      gplayDescEl.textContent = state.lang === 'el'
        ? 'Ασφαλής πληρωμή μέσω Google Play'
        : 'Secure checkout via Google Play';
    }
  }

  const restoreBtn = document.getElementById('premium-restore-btn');
  if (restoreBtn) {
    restoreBtn.style.display = (isNative && !active) ? 'block' : 'none';
  }
}

// Starts the premium purchase flow.
// - Native Android (Capacitor): Google Play Billing via the `capacitor-billing`
//   plugin is the ONLY payment channel — the Play purchase sheet itself offers
//   Card (Google Wallet), Google Pay and PayPal. The purchase token is verified
//   server-side by /api/play-billing.
// - Web / PWA: Stripe Checkout via /api/purchase (Card / Google Pay) or PayPal.
async function startPremiumPurchase(method = 'card') {
  if (isPremium()) {
    showSyncToast(state.lang === 'el' ? '✓ Είσαι ήδη Premium!' : '✓ You are already Premium!', 2500);
    return;
  }
  if (!state.currentUser) {
    showSyncToast(state.lang === 'el' ? '⚠️ Συνδέσου πρώτα για να αγοράσεις Premium.' : '⚠️ Please sign in first to purchase Premium.', 3500);
    return;
  }

  const btnId = method === 'paypal' ? 'premium-pay-paypal-btn' : (method === 'gplay' ? 'premium-pay-gplay-btn' : (method === 'gpay' ? 'premium-pay-gpay-btn' : 'premium-pay-card-btn'));
  const btn = document.getElementById(btnId) || document.getElementById('premium-purchase-btn');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span style="display:flex;align-items:center;gap:8px;margin:auto;"><i class="fa-solid fa-spinner fa-spin"></i><span>${state.lang === 'el' ? 'Προετοιμασία...' : 'Preparing...'}</span></span>`;
  }

  try {
    const isNative = typeof window.Capacitor !== 'undefined' &&
      typeof window.Capacitor.isNativePlatform === 'function' &&
      window.Capacitor.isNativePlatform();

    // NATIVE (Android): Google Play Billing is the ONLY payment channel. The
    // method argument (card/paypal/gpay) is irrelevant in the app — those web
    // payment options are hidden there (see updatePremiumUI). The Play purchase
    // sheet itself offers Card (Google Wallet), Google Pay and PayPal.
    if (isNative) {
      const Billing = getBillingPlugin();
      if (Billing) {
        const handled = await purchasePremiumViaPlayBilling(Billing);
        if (handled) return;
      }
      showSyncToast(
        state.lang === 'el'
          ? '⚠️ Το Google Play δεν είναι διαθέσιμο προς το παρόν. Δοκιμάστε ξανά σε λίγο.'
          : '⚠️ Google Play is currently unavailable. Please try again shortly.',
        4500
      );
      return;
    }

    // Web / PWA: the Google Play option is Android-only (the button is hidden on
    // web by updatePremiumUI; this branch guards old cached pages).
    if (method === 'gplay') {
      showSyncToast(
        state.lang === 'el'
          ? 'ℹ️ Το Google Play είναι διαθέσιμο μόνο στην Android εφαρμογή. Επιλέξτε «Κάρτα», «PayPal» ή «Google Pay».'
          : 'ℹ️ Google Play is only available in the Android app. Please choose Card, PayPal or Google Pay.',
        4500
      );
      return;
    }

    // Card, Google Pay or PayPal web purchase flow
    await startWebPremiumPurchase(method);
  } catch (err) {
    console.error('Premium purchase error:', err);
    showSyncToast(state.lang === 'el' ? '⚠️ Σφάλμα κατά την αγορά.' : '⚠️ Purchase error.', 3500);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// Web / PWA Stripe Checkout flow
async function startWebPremiumPurchase(method = 'card') {
  let accessToken = '';
  if (state.supabaseClient) {
    try {
      const { data } = await state.supabaseClient.auth.getSession();
      if (data && data.session && data.session.access_token) {
        accessToken = data.session.access_token;
      }
    } catch (e) {
      console.warn('Could not resolve session token for purchase:', e);
    }
  }
  if (!accessToken) {
    showSyncToast(state.lang === 'el' ? '⚠️ Συνδέσου πρώτα για να αγοράσεις Premium.' : '⚠️ Please sign in first to purchase Premium.', 3500);
    return;
  }

  const res = await fetch(getBackendApiUrl('/api/purchase'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken
    },
    body: JSON.stringify({ userId: state.currentUser.id, method: method })
  });
  const data = await res.json().catch(() => ({}));

  if (res.ok && data.url) {
    // If in Capacitor Native, open in system browser
    if (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      if (window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
        // ANTI-FLICKER: Opening the in-app browser fires visibilitychange->hidden
        // + visualViewport resize, causing layout re-flow and visible flash.
        if (typeof window.stabilizeLayoutBeforeNativePicker === 'function') {
          window.stabilizeLayoutBeforeNativePicker();
        }
        await window.Capacitor.Plugins.Browser.open({ url: data.url });
        return;
      }
    }
    window.location.href = data.url;
    return;
  }

  console.warn('Premium purchase endpoint unavailable:', data);
  showSyncToast(
    state.lang === 'el'
      ? (data.error || '⚠️ Η πληρωμή δεν είναι ακόμα ενεργή. Επικοινώνησε με τον διαχειριστή.')
      : (data.error || '⚠️ Payment is not active yet. Please contact the administrator.'),
    5000
  );
}

// ============================================================
// GOOGLE PAY (direct wallet flow — NO Stripe Checkout redirect)
// ============================================================
// Opens the native Google Pay sheet (Google Pay API), then charges the
// returned Stripe token server-side via /api/gpay-purchase. The server
// creates + confirms a PaymentIntent and grants the Premium entitlement only
// after Stripe reports 'succeeded'.
async function startGooglePayPurchase() {
  if (isPremium()) {
    showSyncToast(state.lang === 'el' ? '✓ Είσαι ήδη Premium!' : '✓ You are already Premium!', 2500);
    return;
  }
  if (!state.currentUser) {
    showSyncToast(state.lang === 'el' ? '⚠️ Συνδέσου πρώτα για να αγοράσεις Premium.' : '⚠️ Please sign in first to purchase Premium.', 3500);
    return;
  }

  const btn = document.getElementById('premium-pay-gpay-btn') || document.getElementById('premium-purchase-btn');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span style="display:flex;align-items:center;gap:8px;margin:auto;"><i class="fa-solid fa-spinner fa-spin"></i><span>${state.lang === 'el' ? 'Προετοιμασία...' : 'Preparing...'}</span></span>`;
  }

  try {
    // Google Pay sheet works on the web (Chrome/Android). On native Capacitor
    // the Play Billing / Card options are the right path.
    const isNative = typeof window.Capacitor !== 'undefined' &&
      typeof window.Capacitor.isNativePlatform === 'function' &&
      window.Capacitor.isNativePlatform();
    if (isNative) {
      // The Google Play button is the only payment path in the Android app — the
      // Play purchase sheet itself already offers Google Pay (plus Card/PayPal).
      showSyncToast(
        state.lang === 'el'
          ? 'ℹ️ Στο Android, η πληρωμή γίνεται μέσω Google Play (Κάρτα, Google Pay ή PayPal).'
          : 'ℹ️ On Android, payments go through Google Play (Card, Google Pay or PayPal).',
        4500
      );
      return;
    }

    // 1. Resolve the session token (server validates it before any charge).
    let accessToken = '';
    if (state.supabaseClient) {
      try {
        const { data } = await state.supabaseClient.auth.getSession();
        if (data && data.session && data.session.access_token) {
          accessToken = data.session.access_token;
        }
      } catch (e) {
        console.warn('Could not resolve session token for Google Pay:', e);
      }
    }
    if (!accessToken) {
      showSyncToast(state.lang === 'el' ? '⚠️ Συνδέσου πρώτα για να αγοράσεις Premium.' : '⚠️ Please sign in first to purchase Premium.', 3500);
      return;
    }

    // 2. Fetch the Stripe publishable key + environment from the server.
    const cfgRes = await fetch(getBackendApiUrl('/api/gpay-purchase'), {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    const cfgData = await cfgRes.json().catch(() => ({}));
    if (!cfgRes.ok || !cfgData.publishableKey) {
      showSyncToast(
        state.lang === 'el'
          ? '⚠️ Το Google Pay δεν είναι έτοιμο ακόμα. Επιλέξτε «Κάρτα» ή «PayPal».'
          : '⚠️ Google Pay is not ready yet. Please use Card or PayPal.',
        4500
      );
      return;
    }

    // 3. Load the Google Pay JS SDK (idempotent).
    await loadGooglePayScript();
    const paymentsApi = window.google && window.google.payments && window.google.payments.api;
    if (!paymentsApi) {
      showSyncToast(
        state.lang === 'el'
          ? '⚠️ Το Google Pay δεν υποστηρίζεται σε αυτό το πρόγραμμα.'
          : '⚠️ Google Pay is not supported on this browser.',
        4000
      );
      return;
    }

    const client = new paymentsApi.PaymentsClient({ environment: cfgData.environment });
    const cardMethod = buildGooglePayCardMethod(cfgData.publishableKey);

    // 4. Check that Google Pay is available on this device/browser.
    const ready = await client.isReadyToPay({
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [cardMethod]
    });
    if (!ready || !ready.result) {
      showSyncToast(
        state.lang === 'el'
          ? 'ℹ️ Το Google Pay δεν είναι διαθέσιμο σε αυτή τη συσκευή. Επιλέξτε «Κάρτα» ή «PayPal».'
          : 'ℹ️ Google Pay is not available on this device. Please choose Card or PayPal.',
        4500
      );
      return;
    }

    // 5. Open the native Google Pay sheet.
    const paymentData = await client.loadPaymentData({
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [cardMethod],
      merchantInfo: { merchantName: 'MKlogic' },
      transactionInfo: {
        totalPriceStatus: 'FINAL',
        totalPrice: '9.99',
        currencyCode: 'EUR',
        countryCode: 'GR'
      }
    });

    // 6. Extract the Stripe token from the Google Pay response.
    const tokenization = paymentData && paymentData.paymentMethodData && paymentData.paymentMethodData.tokenizationData;
    const rawToken = tokenization && tokenization.token ? tokenization.token : '';
    let gpayTokenId = rawToken;
    try {
      const parsed = JSON.parse(rawToken);
      gpayTokenId = parsed.id || parsed;
    } catch (e) { /* token is a plain string */ }
    if (!gpayTokenId) {
      showSyncToast(state.lang === 'el' ? '⚠️ Σφάλμα κατά την πληρωμή. Δοκιμάστε ξανά.' : '⚠️ Payment error. Please try again.', 4000);
      return;
    }

    // 7. Charge server-side (PaymentIntent + entitlement grant).
    const res = await fetch(getBackendApiUrl('/api/gpay-purchase'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      body: JSON.stringify({ userId: state.currentUser.id, token: gpayTokenId })
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      showSyncToast(
        state.lang === 'el'
          ? '🎉 Το Premium ενεργοποιήθηκε μέσω Google Pay! Ευχαριστούμε!'
          : '🎉 Premium activated via Google Pay! Thank you!',
        5000
      );
      if (state.currentUser && typeof loadUserProfiles === 'function') {
        try {
          await loadUserProfiles(state.currentUser);
          updatePremiumUI();
        } catch (e) { console.warn('Profile refresh after Google Pay:', e); }
      }
    } else if (data.error === 'requires_action') {
      showSyncToast(
        state.lang === 'el'
          ? '⚠️ Η τράπεζα ζήτησε επιπλέον επιβεβαίωση (3D Secure). Δοκιμάστε με «Πληρωμή με Κάρτα».'
          : '⚠️ Your bank requested additional verification (3D Secure). Please try "Pay with Card".',
        5000
      );
    } else {
      const msg = data.error === 'payment_failed'
        ? (state.lang === 'el' ? 'Η πληρωμή δεν ολοκληρώθηκε. Δοκιμάστε ξανά.' : 'Payment could not be completed. Please try again.')
        : (data.error || (state.lang === 'el' ? 'Η πληρωμή δεν ολοκληρώθηκε.' : 'Payment could not be completed.'));
      showSyncToast('⚠️ ' + msg, 5000);
    }
  } catch (err) {
    // Google Pay sheet dismissed by the user → silent (no scary error).
    if (err && (err.statusCode === 'CANCELED' || err.statusMessage === 'CANCELED')) {
      console.log('Google Pay sheet dismissed by the user.');
    } else {
      console.error('Google Pay purchase error:', err);
      showSyncToast(state.lang === 'el' ? '⚠️ Σφάλμα κατά την πληρωμή.' : '⚠️ Payment error.', 3500);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// Build the CARD payment method for the Google Pay API (Stripe gateway).
function buildGooglePayCardMethod(publishableKey) {
  return {
    type: 'CARD',
    parameters: {
      allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
      allowedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER']
    },
    tokenizationSpecification: {
      type: 'PAYMENT_GATEWAY',
      parameters: {
        gateway: 'stripe',
        'stripe:version': '2024-06-20',
        'stripe:publishableKey': publishableKey
      }
    }
  };
}

// Load the Google Pay JS SDK once (idempotent).
function loadGooglePayScript() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.payments) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src="https://pay.google.com/gp/p/js/pay.js"]');
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', () => reject(new Error('Google Pay SDK failed to load.')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://pay.google.com/gp/p/js/pay.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Google Pay SDK failed to load.'));
    document.head.appendChild(s);
  });
}

// Resolve the capacitor-billing plugin (BillingPlugin) if present on native.
function getBillingPlugin() {
  if (typeof window.Capacitor === 'undefined') return null;
  if (window.Capacitor.Plugins) {
    if (window.Capacitor.Plugins.BillingPlugin) return window.Capacitor.Plugins.BillingPlugin;
    if (window.Capacitor.Plugins.Billing) return window.Capacitor.Plugins.Billing;
  }
  if (typeof window.Capacitor.registerPlugin === 'function') {
    try {
      const p = window.Capacitor.registerPlugin('BillingPlugin');
      if (p) return p;
    } catch (e) { }
    try {
      const p2 = window.Capacitor.registerPlugin('Billing');
      if (p2) return p2;
    } catch (e) { }
  }
  return null;
}

// Native Android purchase via Google Play Billing. Launches the Play purchase
// sheet for the Premium Lifetime one-time product, then verifies the returned
// purchase token server-side and grants the entitlement.
async function purchasePremiumViaPlayBilling(Billing) {
  const PRODUCT_ID = 'premium_lifetime';
  const PRODUCT_TYPE = 'INAPP'; // one-time purchase (Premium Lifetime)

  try {
    const result = await Billing.launchBillingFlow({
      product: PRODUCT_ID,
      type: PRODUCT_TYPE
    });

    if (!result || result.value === 'web') {
      return false; // Fallback to Stripe
    }

    const purchaseToken = result.purchaseToken;
    if (!purchaseToken) {
      console.warn('Play Billing purchase resolved without a purchaseToken:', result);
      return false; // Fallback to Stripe
    }

    // Acknowledge the purchase (required within 3 days for one-time products).
    try {
      await Billing.sendAck({ purchaseToken });
    } catch (ackErr) {
      console.warn('Play Billing sendAck failed (will retry later):', ackErr.message);
    }

    // Verify server-side and grant entitlement.
    const ver = await verifyPlayBillingPurchase(purchaseToken, PRODUCT_ID);
    if (ver.ok) {
      await loadUserProfiles(state.currentUser);
      updatePremiumUI();
      showSyncToast(state.lang === 'el' ? '✓ Το Premium ενεργοποιήθηκε!' : '✓ Premium activated!', 3000);
      return true;
    } else {
      // The user HAS already been charged at this point — never imply it failed
      // silently. Show the real server reason so the issue is diagnosable, and
      // tell them the entitlement is not lost (restore/reconciliation can fix it).
      const reason = ver.error || (state.lang === 'el' ? 'άγνωστο σφάλμα' : 'unknown error');
      console.warn('Play Billing verification failed after purchase:', reason);

      // PERSIST the purchase token so it can be re-verified later (Restore /
      // next login) WITHOUT charging the user again. The token is removed only
      // once the server confirms the entitlement.
      try {
        if (state.currentUser && purchaseToken) {
          localStorage.setItem(
            'pending_play_purchase_' + state.currentUser.id,
            JSON.stringify({ purchaseToken, productId: PRODUCT_ID, at: new Date().toISOString(), attempts: 0 })
          );
        }
      } catch (storeErr) {
        console.warn('Could not store pending Play purchase token:', storeErr);
      }

      showSyncToast(
        state.lang === 'el'
          ? `⚠️ Η αγορά ολοκληρώθηκε, αλλά η ενεργοποίηση απέτυχε: ${reason}`
          : `⚠️ Purchase completed, but activation failed: ${reason}`,
        7000
      );
      return true;
    }
  } catch (err) {
    const rawMsg = (err && (err.message || err.errorMessage)) || String(err);
    const errMsg = rawMsg.toLowerCase();
    console.warn('Play Billing purchase error:', err);

    if (errMsg.includes('user_canceled') || errMsg.includes('user canceled') || errMsg.includes('user cancelled') || errMsg.includes('purchase canceled')) {
      showSyncToast(state.lang === 'el' ? 'Η αγορά ακυρώθηκε.' : 'Purchase cancelled.', 3000);
      return true;
    }

    if (errMsg.includes('error retrieving product details')) {
      // queryProductDetailsAsync returned no product for 'premium_lifetime'.
      // This is a Play Console configuration issue, not a code failure.
      console.warn('Play Billing: product premium_lifetime not found:', rawMsg);
      showSyncToast(
        state.lang === 'el'
          ? `⚠️ Το προϊόν «premium_lifetime» δεν βρέθηκε στο Google Play (Error retrieving product details). Βεβαιωθείτε ότι: 1) υπάρχει ως in-app product στο Play Console (Monetize → In-app products), 2) είναι ΕΝΕΡΓΟ (όχι draft/απενεργοποιημένο), 3) είναι τύπου «In-app product» (όχι συνδρομή), και 4) αυτή η έκδοση/λογαριασμός δοκιμής έχει πρόσβαση σε αυτό.`
          : `⚠️ Product "premium_lifetime" was not found in Google Play (Error retrieving product details). Make sure: 1) it exists as an in-app product in Play Console (Monetize → In-app products), 2) it is ACTIVE (not draft/deactivated), 3) it is a one-time "In-app product" (not a subscription), and 4) this test build/account has access to it.`,
        8000
      );
      return true;
    }

    showSyncToast(
      state.lang === 'el'
        ? `⚠️ Google Play: ${rawMsg}`
        : `⚠️ Google Play: ${rawMsg}`,
      5000
    );
    return true;
  }
}

// Verify a Google Play purchase token server-side (/api/play-billing) and grant
// the Premium entitlement. Returns { ok, error } — ok=true only when the server
// confirmed premium_active. The error is the server-provided reason (so the UI
// can show exactly why activation failed).
async function verifyPlayBillingPurchase(purchaseToken, productId) {
  if (!state.currentUser || !state.supabaseClient) return { ok: false, error: 'not_authenticated' };
  try {
    const { data: sessionData } = await state.supabaseClient.auth.getSession();
    const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
    if (!token) return { ok: false, error: 'no_session' };

    const res = await fetch(getBackendApiUrl('/api/play-billing'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ purchaseToken, productId })
    });
    let data = {};
    try { data = await res.json(); } catch (e) { }
    if (!res.ok) {
      const reason = (data && data.error) || `HTTP ${res.status}`;
      console.warn('Play Billing verification failed:', res.status, data);
      return { ok: false, error: reason };
    }
    return { ok: !!(data.ok && data.premium_active), error: (data && data.error) || null };
  } catch (err) {
    console.warn('Play Billing verification error:', err.message);
    return { ok: false, error: (err && err.message) || 'network_error' };
  }
}

// Re-verifies any locally-stored Google Play purchase token that previously
// completed but failed activation (e.g. a transient server/permissions error).
// Idempotent and safe to call on restore and on login. The stored token is
// removed only after the server confirms the entitlement.
async function recoverPendingPlayPurchase() {
  if (!state.currentUser || !state.supabaseClient) return false;
  const key = 'pending_play_purchase_' + state.currentUser.id;
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(key) || 'null');
  } catch (e) { stored = null; }
  if (!stored || !stored.purchaseToken) return false;

  // Already entitled → nothing pending to recover; clean up the stale token.
  if (isPremium()) {
    try { localStorage.removeItem(key); } catch (e) { }
    return true;
  }

  // Cap auto-retries to avoid hammering the endpoint on every login; the user
  // can still trigger a manual retry via "Restore purchase".
  if ((stored.attempts || 0) >= 10) return false;

  const ver = await verifyPlayBillingPurchase(stored.purchaseToken, stored.productId || 'premium_lifetime');
  if (ver.ok) {
    try { localStorage.removeItem(key); } catch (e) { }
    await loadUserProfiles(state.currentUser);
    updatePremiumUI();
    showSyncToast(state.lang === 'el' ? '✓ Το Premium ενεργοποιήθηκε!' : '✓ Premium activated!', 3000);
    return true;
  }
  // Keep the token for a later retry.
  try {
    stored.attempts = (stored.attempts || 0) + 1;
    stored.lastError = ver.error || 'unknown';
    localStorage.setItem(key, JSON.stringify(stored));
  } catch (e) { }
  return false;
}

// Restores a previously purchased Premium (Android / Google Play).
async function restorePremiumPurchase() {
  if (!state.currentUser) {
    showSyncToast(state.lang === 'el' ? '⚠️ Συνδέσου πρώτα για να επαναφέρεις το Premium.' : '⚠️ Please sign in first to restore Premium.', 3500);
    return;
  }

  // Native Android: the capacitor-billing plugin has no restorePurchases()
  // method, so we rely on server-side reconciliation (/api/premium-status).
  // That endpoint re-reads the profile (source of truth) and reconciles any
  // previously granted entitlement, so a reinstall / re-login picks it up.
  if (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    // First re-verify any locally-stored Play purchase that previously
    // completed but failed activation, then run the server reconciliation.
    const playRecovered = await recoverPendingPlayPurchase();
    const restored = playRecovered || await reconcilePremiumPurchase();
    await loadUserProfiles(state.currentUser);
    updatePremiumUI();
    if (restored || isPremium()) {
      showSyncToast(state.lang === 'el' ? '✓ Το Premium επαναφέρθηκε.' : '✓ Premium restored.', 3000);
    } else {
      showSyncToast(state.lang === 'el' ? '⚠️ Δεν βρέθηκε ενεργό Premium.' : '⚠️ No active Premium found.', 3500);
    }
    return;
  }

  // Web: first try server-side reconciliation (/api/premium-status). This
  // queries Stripe for the user's paid sessions and grants the entitlement if
  // the webhook was lost. Then re-fetch the profile (server is source of truth).
  await reconcilePremiumPurchase();
  await loadUserProfiles(state.currentUser);
  updatePremiumUI();
  showSyncToast(state.lang === 'el' ? '✓ Το Premium ανανεώθηκε.' : '✓ Premium refreshed.', 2500);
}

// Call the server-side reconciliation endpoint. It queries Stripe for the
// authenticated user's paid Checkout Sessions and grants the entitlement if a
// paid session exists but the profile isn't premium (webhook-lost recovery).
// Returns true if the server reported premium_active after reconciliation.
async function reconcilePremiumPurchase() {
  if (!state.currentUser || !state.supabaseClient) return false;
  try {
    const { data: sessionData } = await state.supabaseClient.auth.getSession();
    const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
    if (!token) return false;

    // Short retry loop: the webhook may still be processing, so give it a few
    // attempts before giving up. Each attempt is idempotent.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(getBackendApiUrl('/api/premium-status'), {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data && data.premium_active) {
            return true;
          }
        }
      } catch (err) {
        console.warn('Premium reconciliation attempt failed:', err.message);
      }
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    return false;
  } catch (err) {
    console.warn('Premium reconciliation error:', err);
    return false;
  }
}

  // UMD Exports & Window Bindings
  if (typeof window !== 'undefined') {
    window.openPremiumModal = openPremiumModal;
    window.updatePremiumUI = updatePremiumUI;
    window.startPremiumPurchase = startPremiumPurchase;
    window.startGooglePayPurchase = startGooglePayPurchase;
    window.restorePremiumPurchase = restorePremiumPurchase;
    window.reconcilePremiumPurchase = reconcilePremiumPurchase;
    window.reconcileCloudPremiumStatus = reconcilePremiumPurchase;
  }

  return {
    openPremiumModal: openPremiumModal,
    updatePremiumUI: updatePremiumUI,
    startPremiumPurchase: startPremiumPurchase,
    startGooglePayPurchase: startGooglePayPurchase,
    restorePremiumPurchase: restorePremiumPurchase,
    reconcilePremiumPurchase: reconcilePremiumPurchase,
    reconcileCloudPremiumStatus: reconcilePremiumPurchase
  };
}));
