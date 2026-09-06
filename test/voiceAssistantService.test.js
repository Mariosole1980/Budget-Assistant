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
  addEventListener() {}
};
global.state = {
  lang: 'el',
  accounts: [],
  categories: [],
  transactions: []
};

const VoiceAssistant = require('../js/voiceAssistantService.js');

test('VoiceAssistant exports all expected controller functions', () => {
  assert.strictEqual(typeof VoiceAssistant.openVoiceAIModal, 'function');
  assert.strictEqual(typeof VoiceAssistant.closeVoiceAIModal, 'function');
  assert.strictEqual(typeof VoiceAssistant.toggleVoiceAIRecording, 'function');
  assert.strictEqual(typeof VoiceAssistant.startVoiceAIRecording, 'function');
  assert.strictEqual(typeof VoiceAssistant.stopVoiceAIRecording, 'function');
  assert.strictEqual(typeof VoiceAssistant.submitVoiceManualInput, 'function');
  assert.strictEqual(typeof VoiceAssistant.finishVoiceAIInput, 'function');
  assert.strictEqual(typeof VoiceAssistant.toggleQuickAddNotification, 'function');
  assert.strictEqual(typeof VoiceAssistant.handleQuickAction, 'function');
  assert.strictEqual(typeof VoiceAssistant.checkPendingQuickAction, 'function');
});

test('VoiceAssistant.openVoiceAIModal and closeVoiceAIModal execute safely without throwing', () => {
  assert.doesNotThrow(() => {
    VoiceAssistant.openVoiceAIModal({ autoStart: false });
    VoiceAssistant.closeVoiceAIModal();
  });
});
