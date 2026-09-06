const test = require('node:test');
const assert = require('node:assert/strict');

// Set up minimal browser globals for testing
global.window = global;
global.document = {
  getElementById: () => null,
  querySelector: () => null
};
global.state = {
  lang: 'el',
  currentUser: { email: 'marios.ko@hotmail.com' }
};

const adminDashboardService = require('../js/adminDashboardService.js');

test('AdminDashboardService exports expected functions', () => {
  assert.equal(typeof adminDashboardService.isAdminUser, 'function');
  assert.equal(typeof adminDashboardService.openAdminDashboard, 'function');
  assert.equal(typeof adminDashboardService.getValidSessionToken, 'function');
  assert.equal(typeof adminDashboardService.refreshAdminDashboard, 'function');
  assert.equal(typeof adminDashboardService.adminErrorBox, 'function');
  assert.equal(typeof adminDashboardService.adminBar, 'function');
  assert.equal(typeof adminDashboardService.adminMeterCard, 'function');
  assert.equal(typeof adminDashboardService.renderAdminUsage, 'function');
});

test('isAdminUser correctly verifies owner email', () => {
  global.state.currentUser = { email: 'marios.ko@hotmail.com' };
  assert.equal(adminDashboardService.isAdminUser(), true);

  global.state.currentUser = { email: 'other@example.com' };
  assert.equal(adminDashboardService.isAdminUser(), false);

  global.state.currentUser = null;
  assert.equal(adminDashboardService.isAdminUser(), false);
});

test('adminErrorBox and adminBar generate correct HTML', () => {
  const errHtml = adminDashboardService.adminErrorBox('Test Error');
  assert.ok(errHtml.includes('Test Error'));

  const barHtml = adminDashboardService.adminBar(75);
  assert.ok(barHtml.includes('width:75%'));
});
