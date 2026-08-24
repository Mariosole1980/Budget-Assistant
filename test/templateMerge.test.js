const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

// Define global localStorage mock for testing
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

global.window = global;

// Extract mergeAndDeduplicateTemplates from app.js
const appJs = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const fnMatch = appJs.match(/function mergeAndDeduplicateTemplates[\s\S]*?window\.mergeAndDeduplicateTemplates\s*=\s*mergeAndDeduplicateTemplates;/);
if (!fnMatch) {
  throw new Error('mergeAndDeduplicateTemplates not found in app.js');
}

eval(fnMatch[0]);

test('mergeAndDeduplicateTemplates keeps cloud templates', () => {
  global.localStorage.clear();
  const cloud = [
    { id: 't1', note: 'Rent', amount: 500 },
    { id: 't2', note: 'Internet', amount: 30 }
  ];
  const local = [];
  const res = mergeAndDeduplicateTemplates(cloud, local);
  assert.equal(res.length, 2);
  assert.equal(res[0].id, 't1');
  assert.equal(res[1].id, 't2');
});

test('mergeAndDeduplicateTemplates preserves unsynced local templates', () => {
  global.localStorage.clear();
  const cloud = [
    { id: 't1', note: 'Rent', amount: 500 }
  ];
  const local = [
    { id: 't1', note: 'Rent', amount: 500 },
    { id: 't2_local', note: 'Gym', amount: 40 }
  ];
  const res = mergeAndDeduplicateTemplates(cloud, local);
  assert.equal(res.length, 2);
  const ids = res.map(t => t.id);
  assert.ok(ids.includes('t1'));
  assert.ok(ids.includes('t2_local'));
});

test('mergeAndDeduplicateTemplates prefers queued local updates over stale cloud data', () => {
  global.localStorage.clear();
  global.localStorage.setItem('money_manager_sync_queue', JSON.stringify([
    { action: 'save_template', payload: { id: 't1', note: 'Rent Updated', amount: 550 } }
  ]));

  const cloud = [
    { id: 't1', note: 'Rent Old', amount: 500 }
  ];
  const local = [
    { id: 't1', note: 'Rent Updated', amount: 550 }
  ];
  const res = mergeAndDeduplicateTemplates(cloud, local);
  assert.equal(res.length, 1);
  assert.equal(res[0].amount, 550);
  assert.equal(res[0].note, 'Rent Updated');
});

test('mergeAndDeduplicateTemplates drops templates with pending delete_template', () => {
  global.localStorage.clear();
  global.localStorage.setItem('money_manager_sync_queue', JSON.stringify([
    { action: 'delete_template', payload: 't1' }
  ]));

  const cloud = [
    { id: 't1', note: 'Rent', amount: 500 },
    { id: 't2', note: 'Internet', amount: 30 }
  ];
  const local = [
    { id: 't1', note: 'Rent', amount: 500 }
  ];
  const res = mergeAndDeduplicateTemplates(cloud, local);
  assert.equal(res.length, 1);
  assert.equal(res[0].id, 't2');
});
