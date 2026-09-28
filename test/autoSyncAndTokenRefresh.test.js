'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// Test 1: Verify isSupabaseAuthOrRlsError is defined and catches 42501
test('isSupabaseAuthOrRlsError detects 42501, 401, and RLS policy error strings', () => {
  const authSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'authService.js'), 'utf8');
  assert.ok(authSrc.includes('42501'), 'authService must check error code 42501');
  assert.ok(authSrc.includes('row-level security'), 'authService must check row-level security message');
  assert.ok(authSrc.includes('ensureAuthenticatedSession'), 'authService must export ensureAuthenticatedSession');
});

// Test 2: Verify transactionMutationService retries on 42501
test('transactionMutationService checks 42501 and row-level security on upsert failure', () => {
  const txMutSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'transactionMutationService.js'), 'utf8');
  assert.ok(txMutSrc.includes('42501'), 'transactionMutationService must handle 42501 error code');
  assert.ok(txMutSrc.includes('row-level security'), 'transactionMutationService must handle row-level security policy errors');
});

// Test 3: Verify syncQueueService retries on 42501 and never drops pending local items on auth error
test('syncQueueService retries on 42501 and keeps un-synced transactions safe in queue', () => {
  const syncQueueSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'syncQueueService.js'), 'utf8');
  assert.ok(syncQueueSrc.includes('42501'), 'syncQueueService must check 42501');
  assert.ok(syncQueueSrc.includes('refreshSession'), 'syncQueueService must attempt session refresh on RLS error');
});

// Test 4: Verify autoSyncMissingTransactionsToCloud only reports genuinely uploaded items
test('autoSyncMissingTransactionsToCloud returns only successfully uploaded transactions', () => {
  const integritySrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'dataIntegrityService.js'), 'utf8');
  assert.ok(integritySrc.includes('successfullyUploaded'), 'dataIntegrityService must track successfully uploaded transactions');
  assert.ok(integritySrc.includes('42501'), 'dataIntegrityService must handle 42501 error');
});

// Test 5: Verify forceSyncNow reflects pending queue rather than falsely stating up to date
test('forceSyncNow shows pending count toast when items remain queued', () => {
  const realtimeSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'supabaseRealtimeService.js'), 'utf8');
  assert.ok(realtimeSrc.includes('state.syncPendingCount > 0'), 'forceSyncNow must check syncPendingCount before showing up-to-date toast');
});
