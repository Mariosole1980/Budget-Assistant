/**
 * js/feedbackReviewService.js
 *
 * In-App User Feedback & Google Play Store Rating Subsystem.
 * Extracted from app.js (Phase 13B Architectural Extraction).
 *
 * Features:
 * - In-app 7-day usage review prompt modal & Google Play deep links
 * - User feedback rating modal with category chips & comment textarea
 * - Local storage persistence & Supabase feedback cloud sync
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

// IN-APP REVIEW & RATING SUBSYSTEM (Prompt after 7 days of usage)
// ============================================================================
const REVIEW_STORAGE_KEYS = {
  FIRST_LAUNCH: 'budget_assistant_first_launch_time',
  STATUS: 'budget_assistant_review_status', // 'rated' | 'dismissed' | 'remind_later'
  NEXT_PROMPT: 'budget_assistant_review_next_prompt_time'
};

const PLAY_STORE_URL_APP = 'market://details?id=com.budgetassistant.app';
const PLAY_STORE_URL_WEB = 'https://play.google.com/store/apps/details?id=com.budgetassistant.app';

function initReviewTracking() {
  try {
    if (!localStorage.getItem(REVIEW_STORAGE_KEYS.FIRST_LAUNCH)) {
      localStorage.setItem(REVIEW_STORAGE_KEYS.FIRST_LAUNCH, Date.now().toString());
    }
  } catch (e) { }
}

function openPlayStoreRating() {
  try {
    localStorage.setItem(REVIEW_STORAGE_KEYS.STATUS, 'rated');
  } catch (e) { }
  const isNative = typeof window.Capacitor !== 'undefined' &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform();

  if (isNative) {
    window.location.href = PLAY_STORE_URL_APP;
  } else {
    window.open(PLAY_STORE_URL_WEB, '_blank', 'noopener,noreferrer');
  }
}

function checkAndPromptAppReview() {
  try {
    initReviewTracking();
    const status = localStorage.getItem(REVIEW_STORAGE_KEYS.STATUS);
    if (status === 'rated' || status === 'dismissed') return;

    const firstLaunch = parseInt(localStorage.getItem(REVIEW_STORAGE_KEYS.FIRST_LAUNCH), 10);
    if (!firstLaunch || isNaN(firstLaunch)) return;

    const daysSinceFirstLaunch = (Date.now() - firstLaunch) / (1000 * 60 * 60 * 24);
    if (daysSinceFirstLaunch < 7) return;

    if (status === 'remind_later') {
      const nextPrompt = parseInt(localStorage.getItem(REVIEW_STORAGE_KEYS.NEXT_PROMPT), 10);
      if (nextPrompt && Date.now() < nextPrompt) return;
    }

    // Require active engagement: at least 3 transactions recorded
    if (!state.transactions || state.transactions.length < 3) return;

    // Show prompt after a short delay so the initial dashboard render is smooth
    setTimeout(() => {
      showReviewPromptModal();
    }, 2500);
  } catch (err) {
    console.warn('[ReviewPrompt] check failed:', err);
  }
}

function showReviewPromptModal() {
  let modal = document.getElementById('in-app-review-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'in-app-review-modal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '2147483646';
    document.body.appendChild(modal);
  }

  const isEl = (state.lang || 'el') === 'el';
  const title = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['review_prompt_title']) || (isEl ? 'Σας αρέσει το Budget Assistant;' : 'Enjoying Budget Assistant?');
  const subtitle = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['review_prompt_desc']) || (isEl
    ? 'Η γνώμη σας μας βοηθά να εξελίσσουμε την εφαρμογή! Θα θέλατε να μας αφήσετε μια σύντομη αξιολόγηση στο Google Play Store;'
    : 'Your feedback helps us continuously improve! Would you take a moment to leave a review on Google Play Store?');
  const rateBtnText = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['review_btn_rate']) || (isEl ? '⭐ Αξιολόγηση στο Play Store' : '⭐ Rate on Play Store');
  const laterBtnText = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['review_btn_later']) || (isEl ? 'Υπενθύμιση αργότερα' : 'Remind me later');
  const dismissBtnText = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['review_btn_dismiss']) || (isEl ? 'Όχι, ευχαριστώ' : 'No, thanks');

  modal.innerHTML =
    '<div class="modal-content" style="max-width: 340px; text-align: center; padding: 26px 22px; border-radius: 22px; background: var(--bg-card); border: 1px solid var(--border); box-shadow: 0 16px 36px rgba(0,0,0,0.5);">' +
    '<div style="display: flex; justify-content: center; gap: 6px; font-size: 26px; color: #fbbf24; margin-bottom: 14px;">' +
    '<span>⭐</span><span>⭐</span><span>⭐</span><span>⭐</span><span>⭐</span>' +
    '</div>' +
    '<h3 style="font-weight: 800; font-size: 17px; color: var(--text-main); margin-bottom: 8px;">' + title + '</h3>' +
    '<p style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 22px;">' + subtitle + '</p>' +
    '<div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">' +
    '<button id="review-btn-rate" class="btn btn-primary" style="width: 100%; padding: 13px; font-weight: 700; border-radius: 12px; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px;">' +
    '<span>' + rateBtnText + '</span>' +
    '</button>' +
    '<button id="review-btn-later" class="btn btn-secondary" style="width: 100%; padding: 11px; font-weight: 600; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-main); font-size: 13px; color: var(--text-main);">' +
    laterBtnText +
    '</button>' +
    '<button id="review-btn-dismiss" style="background: none; border: none; padding: 8px; color: var(--text-secondary); font-size: 12px; cursor: pointer; text-decoration: underline;">' +
    dismissBtnText +
    '</button>' +
    '</div></div>';

  modal.classList.add('active');
  document.body.classList.add('modal-open');

  const closeReviewModal = () => {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  };

  document.getElementById('review-btn-rate').onclick = () => {
    closeReviewModal();
    openPlayStoreRating();
  };

  document.getElementById('review-btn-later').onclick = () => {
    closeReviewModal();
    try {
      localStorage.setItem(REVIEW_STORAGE_KEYS.STATUS, 'remind_later');
      localStorage.setItem(REVIEW_STORAGE_KEYS.NEXT_PROMPT, (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
    } catch (e) { }
  };

  document.getElementById('review-btn-dismiss').onclick = () => {
    closeReviewModal();
    try {
      localStorage.setItem(REVIEW_STORAGE_KEYS.STATUS, 'dismissed');
    } catch (e) { }
  };
}

window.openPlayStoreRating = openPlayStoreRating;
window.checkAndPromptAppReview = checkAndPromptAppReview;
window.showReviewPromptModal = showReviewPromptModal;

// USER FEEDBACK SUBMISSION LOGIC
// ============================================================
async function submitUserFeedback() {
  const ratingBtn = document.querySelector('.emoji-rate-btn.active');
  const rating = ratingBtn ? parseInt(ratingBtn.getAttribute('data-rate')) : null;
  const chipBtn = document.querySelector('.feedback-chip.active');
  const type = chipBtn ? chipBtn.getAttribute('data-type') : 'suggestion';
  const commentVal = document.getElementById('feedback-comment').value.trim();

  if (!rating) {
    window.showAlert(state.lang === 'el' ? 'Παρακαλώ επιλέξτε μια βαθμολογία!' : 'Please select a rating!');
    return;
  }

  const submitBtn = document.getElementById('feedback-submit-btn');
  const textSpan = document.getElementById('feedback-btn-text');
  const spinnerDiv = document.getElementById('feedback-btn-spinner');

  if (submitBtn) submitBtn.disabled = true;
  if (textSpan) textSpan.style.opacity = '0.3';
  if (spinnerDiv) spinnerDiv.style.display = 'block';

  const feedbackData = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    rating,
    type,
    comment: commentVal,
    user_email: state.currentUser ? state.currentUser.email : 'guest',
    created_at: new Date().toISOString()
  };

  // Save locally first
  const existingFeedback = JSON.parse(localStorage.getItem('user_feedback') || '[]');
  existingFeedback.push(feedbackData);
  localStorage.setItem('user_feedback', JSON.stringify(existingFeedback));

  // Try sending to Supabase if logged in
  if (state.supabaseClient && state.currentUser) {
    try {
      const { error } = await state.supabaseClient
        .from('feedback')
        .insert([{
          rating: feedbackData.rating,
          type: feedbackData.type,
          comment: feedbackData.comment,
          user_email: feedbackData.user_email
        }]);

      if (error) {
        console.warn('Supabase feedback insert failed (table might not exist):', error);
      }
    } catch (err) {
      console.warn('Error syncing feedback to Supabase:', err);
    }
  }

  // Wait a small amount for a smooth premium loading state
  setTimeout(() => {
    if (spinnerDiv) spinnerDiv.style.display = 'none';
    if (textSpan) textSpan.style.opacity = '1';
    if (submitBtn) submitBtn.disabled = false;

    // Transition UI to success state
    const cardContainer = document.getElementById('feedback-card-container');

    if (cardContainer) {
      // Clear inputs
      document.getElementById('feedback-comment').value = '';
      document.querySelectorAll('.emoji-rate-btn').forEach(btn => btn.classList.remove('active'));

      // Toggle views inside card container
      const formContents = cardContainer.querySelectorAll('.feedback-rating-container, .feedback-form-group, #feedback-submit-btn');
      formContents.forEach(el => el.style.display = 'none');

      // Insert success elements inside card container if not already there
      let successEl = document.getElementById('feedback-success-el');
      if (!successEl) {
        successEl = document.createElement('div');
        successEl.id = 'feedback-success-el';
        successEl.className = 'feedback-success-container';
        successEl.innerHTML = `
          <div class="success-icon-wrapper">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <div class="success-message" data-i18n="feedback_success_msg">${TRANSLATIONS[state.lang]['feedback_success_msg']}</div>
          <button type="button" class="feedback-reset-btn" onclick="resetFeedbackForm()" data-i18n="feedback_reset_btn">${TRANSLATIONS[state.lang]['feedback_reset_btn'] || 'Νέα Αξιολόγηση'}</button>
        `;
        cardContainer.appendChild(successEl);
      } else {
        successEl.style.display = 'flex';
      }
    }
  }, 800);
}

function resetFeedbackForm() {
  const cardContainer = document.getElementById('feedback-card-container');
  if (cardContainer) {
    const successEl = document.getElementById('feedback-success-el');
    if (successEl) successEl.style.display = 'none';

    const formContents = cardContainer.querySelectorAll('.feedback-rating-container, .feedback-form-group, #feedback-submit-btn');
    formContents.forEach(el => {
      el.style.display = '';
    });

    // Reset inputs
    document.getElementById('feedback-comment').value = '';
    document.querySelectorAll('.emoji-rate-btn').forEach(btn => btn.classList.remove('active'));
    const labelEl = document.getElementById('emoji-rate-label');
    if (labelEl) {
      labelEl.textContent = '';
      labelEl.style.opacity = '0';
    }
    document.querySelectorAll('.feedback-chip').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === 0);
    });
  }
}

window.submitUserFeedback = submitUserFeedback;
window.resetFeedbackForm = resetFeedbackForm;

  // UMD Exports & Window Bindings
  if (typeof window !== 'undefined') {
    window.REVIEW_STORAGE_KEYS = REVIEW_STORAGE_KEYS;
    window.PLAY_STORE_URL_APP = PLAY_STORE_URL_APP;
    window.PLAY_STORE_URL_WEB = PLAY_STORE_URL_WEB;
    window.initReviewTracking = initReviewTracking;
    window.openPlayStoreRating = openPlayStoreRating;
    window.checkAndPromptAppReview = checkAndPromptAppReview;
    window.showReviewPromptModal = showReviewPromptModal;
    window.submitUserFeedback = submitUserFeedback;
    window.resetFeedbackForm = resetFeedbackForm;
  }

  return {
    REVIEW_STORAGE_KEYS: REVIEW_STORAGE_KEYS,
    PLAY_STORE_URL_APP: PLAY_STORE_URL_APP,
    PLAY_STORE_URL_WEB: PLAY_STORE_URL_WEB,
    initReviewTracking: initReviewTracking,
    openPlayStoreRating: openPlayStoreRating,
    checkAndPromptAppReview: checkAndPromptAppReview,
    showReviewPromptModal: showReviewPromptModal,
    submitUserFeedback: submitUserFeedback,
    resetFeedbackForm: resetFeedbackForm
  };
}));
