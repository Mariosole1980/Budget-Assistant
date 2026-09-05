const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Quick Add Notification & Voice Assistant Unit Tests', async (t) => {
  const indexPath = path.join(__dirname, '..', 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');

  const appJsPath = path.join(__dirname, '..', 'app.js');
  const appJsContent = fs.readFileSync(appJsPath, 'utf8');

  const translationsPath = path.join(__dirname, '..', 'js', 'translations.js');
  const translationsContent = fs.readFileSync(translationsPath, 'utf8');

  const pluginPath = path.join(
    __dirname,
    '..',
    'android',
    'app',
    'src',
    'main',
    'java',
    'com',
    'budgetassistant',
    'app',
    'QuickAddNotificationPlugin.java'
  );
  const pluginContent = fs.readFileSync(pluginPath, 'utf8');

  const mainActivityPath = path.join(
    __dirname,
    '..',
    'android',
    'app',
    'src',
    'main',
    'java',
    'com',
    'budgetassistant',
    'app',
    'MainActivity.java'
  );
  const mainActivityContent = fs.readFileSync(mainActivityPath, 'utf8');

  const manifestPath = path.join(
    __dirname,
    '..',
    'android',
    'app',
    'src',
    'main',
    'AndroidManifest.xml'
  );
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');

  await t.test('1. Android Native Layer verification', () => {
    // Plugin exists and has all 4 actions
    assert.ok(pluginContent.includes('@CapacitorPlugin(name = "QuickAddNotification")'));
    assert.ok(pluginContent.includes('ACTION_VOICE_AI = "VOICE_AI"'));
    assert.ok(pluginContent.includes('ACTION_ADD_EXPENSE = "ADD_EXPENSE"'));
    assert.ok(pluginContent.includes('ACTION_ADD_INCOME = "ADD_INCOME"'));
    assert.ok(pluginContent.includes('ACTION_SCAN_RECEIPT = "SCAN_RECEIPT"'));
    assert.ok(pluginContent.includes('setOngoing(true)'));
    assert.ok(pluginContent.includes('🎙️ Βοηθός'));
    assert.ok(pluginContent.includes('➕ Έξοδο'));
    assert.ok(pluginContent.includes('💰 Έσοδο'));
    assert.ok(pluginContent.includes('📷 Scan'));

    // MainActivity registers plugin and handles intent
    assert.ok(mainActivityContent.includes('registerPlugin(QuickAddNotificationPlugin.class);'));
    assert.ok(mainActivityContent.includes('handleIncomingQuickAction'));
    assert.ok(mainActivityContent.includes('dispatchQuickAction'));

    // AndroidManifest has RECORD_AUDIO
    assert.ok(manifestContent.includes('android.permission.RECORD_AUDIO'));
  });

  await t.test('2. Web UI Elements verification', () => {
    // Preferences toggle exists
    assert.ok(indexContent.includes('id="settings-quick-add-notification"'));
    assert.ok(indexContent.includes('toggleQuickAddNotification(this.checked)'));

    // Notifications subscreen synced toggle exists
    assert.ok(indexContent.includes('id="settings-quick-add-notification-sync"'));

    // Header voice button exists
    assert.ok(indexContent.includes('id="header-voice-ai-btn"'));

    // Voice AI Modal exists with waveform rings and live transcript box
    assert.ok(indexContent.includes('id="voice-ai-modal"'));
    assert.ok(indexContent.includes('id="voice-ai-visualizer"'));
    assert.ok(indexContent.includes('id="voice-ai-mic-btn"'));
    assert.ok(indexContent.includes('id="voice-ai-transcript-text"'));
  });

  await t.test('3. JavaScript Controller Functions exist', () => {
    assert.ok(appJsContent.includes('function toggleQuickAddNotification('));
    assert.ok(appJsContent.includes('function handleQuickAction('));
    assert.ok(appJsContent.includes('function openVoiceAIModal('));
    assert.ok(appJsContent.includes('function closeVoiceAIModal('));
    assert.ok(appJsContent.includes('function startVoiceAIRecording('));
    assert.ok(appJsContent.includes('function stopVoiceAIRecording('));
    assert.ok(appJsContent.includes('function finishVoiceAIInput('));
  });

  await t.test('4. Translations exist in Greek and English', () => {
    assert.ok(translationsContent.includes('"item_quick_add_notification": "Γρήγορη καταχώρηση"'));
    assert.ok(translationsContent.includes('"item_quick_add_notification": "Quick Add"'));
    assert.ok(translationsContent.includes('"voice_ai_title"'));
    assert.ok(translationsContent.includes('"voice_ai_listening"'));
  });
});
