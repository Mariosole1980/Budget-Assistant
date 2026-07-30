const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

const results = {
  hasOfflineQueueCheck: appJs.includes('offline_sync_queue') || appJs.includes('flushOfflineSyncQueue') || appJs.includes('processOfflineQueue'),
  hasCamelToSnakeConverter: appJs.includes('camelCase') || appJs.includes('snake_case') || appJs.includes('toSnakeCase'),
  hasUUIDGeneration: appJs.includes('crypto.randomUUID') || appJs.includes('generateUUID') || appJs.includes('uuidv4'),
  hasRecurringSyncSnakeCase: appJs.includes('recurring_templates') || appJs.includes('template_name') || appJs.includes('created_at'),
  syncSequenceCheck: false
};

// Check sync order: does sync process queue before fetching latest transactions?
const syncOnlineIdx = appJs.indexOf('syncOnlineTransactions');
const processQueueIdx = appJs.indexOf('processOfflineSyncQueue');
const flushQueueIdx = appJs.indexOf('flushOfflineSyncQueue');

console.log("Check results:", JSON.stringify(results, null, 2));

// Search for recurring templates mapping in app.js
let idx = 0;
while ((idx = appJs.indexOf('recurring_templates', idx)) !== -1) {
  console.log("Found recurring_templates at pos:", idx);
  console.log(appJs.substring(Math.max(0, idx - 100), idx + 300));
  console.log("-----------------------------------------------");
  idx += 'recurring_templates'.length;
}
