const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.document = {
  getElementById(id) {
    return {
      id,
      textContent: '',
      value: '',
      style: {},
      classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} }
    };
  },
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
  createElement() {
    return {
      id: '',
      className: '',
      style: {},
      classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} },
      appendChild: () => {}
    };
  }
};
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); }
};
global.state = {
  lang: 'el',
  currentUser: null,
  transactions: []
};

const FeedbackService = require('../js/feedbackReviewService.js');

test('FeedbackService exports storage keys and URLs', () => {
  assert.ok(FeedbackService.REVIEW_STORAGE_KEYS);
  assert.ok(FeedbackService.PLAY_STORE_URL_APP);
  assert.ok(FeedbackService.PLAY_STORE_URL_WEB);
});

test('FeedbackService exports review and feedback functions', () => {
  assert.strictEqual(typeof FeedbackService.initReviewTracking, 'function');
  assert.strictEqual(typeof FeedbackService.openPlayStoreRating, 'function');
  assert.strictEqual(typeof FeedbackService.checkAndPromptAppReview, 'function');
  assert.strictEqual(typeof FeedbackService.showReviewPromptModal, 'function');
  assert.strictEqual(typeof FeedbackService.submitUserFeedback, 'function');
  assert.strictEqual(typeof FeedbackService.resetFeedbackForm, 'function');
});

test('initReviewTracking records first launch time if not present', () => {
  FeedbackService.initReviewTracking();
  const firstLaunch = global.localStorage.getItem(FeedbackService.REVIEW_STORAGE_KEYS.FIRST_LAUNCH);
  assert.ok(firstLaunch);
});
