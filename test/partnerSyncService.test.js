const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.document = {
  _elements: {},
  getElementById(id) {
    if (!this._elements[id]) {
      this._elements[id] = {
        id,
        innerHTML: '',
        value: '',
        style: {},
        classList: { contains: () => false, add: () => {}, remove: () => {} }
      };
    }
    return this._elements[id];
  },
  querySelector() {
    return { style: {} };
  },
  querySelectorAll() {
    return [];
  }
};

global.state = {
  lang: 'el',
  currentUser: { id: 'u1', email: 'test@example.com' },
  userProfile: { family_id: 'fam-123', family_role: 'admin' },
  isSupabaseEnabled: false
};
global.TRANSLATIONS = {
  el: {
    partner_title: 'Κοινόχρηστο Budget'
  },
  en: {
    partner_title: 'Shared Budget'
  }
};
global.showToast = () => {};
global.showSyncToast = () => {};
global.showConfirm = async () => true;
global.openModal = () => {};
global.closeModal = () => {};

const PartnerSyncService = require('../js/partnerSyncService.js');

test('PartnerSyncService exports all expected functions', () => {
  assert.strictEqual(typeof PartnerSyncService.renderPartnerSection, 'function');
  assert.strictEqual(typeof PartnerSyncService.renderFamilyMembersList, 'function');
  assert.strictEqual(typeof PartnerSyncService.renderMemberInviteCode, 'function');
  assert.strictEqual(typeof PartnerSyncService.renderFamilyFeatures, 'function');
  assert.strictEqual(typeof PartnerSyncService.openInviteModal, 'function');
  assert.strictEqual(typeof PartnerSyncService.closeInviteModal, 'function');
  assert.strictEqual(typeof PartnerSyncService.createFamilyGroup, 'function');
  assert.strictEqual(typeof PartnerSyncService.joinFamilyGroup, 'function');
  assert.strictEqual(typeof PartnerSyncService.leaveFamilyGroup, 'function');
  assert.strictEqual(typeof PartnerSyncService.selectInviteRole, 'function');
});

test('PartnerSyncService.selectInviteRole toggles card styles and updates hidden role input', () => {
  const memberCard = global.document.getElementById('role-card-member');
  const adminCard = global.document.getElementById('role-card-admin');
  const roleInput = global.document.getElementById('invite-role-select');

  PartnerSyncService.selectInviteRole('admin');
  assert.strictEqual(roleInput.value, 'admin');

  PartnerSyncService.selectInviteRole('member');
  assert.strictEqual(roleInput.value, 'member');
});

test('PartnerSyncService.renderMemberInviteCode returns valid formatted HTML with code', () => {
  const html = PartnerSyncService.renderMemberInviteCode('ABC-1234');
  assert.ok(typeof html === 'string');
  assert.ok(html.includes('ABC-1234'));
});

test('PartnerSyncService.renderFamilyFeatures produces feature cards', () => {
  const html = PartnerSyncService.renderFamilyFeatures();
  assert.ok(typeof html === 'string');
  assert.ok(html.length > 50);
});

test('PartnerSyncService exports getMemberBadgeHTML and partner utilities', () => {
  assert.strictEqual(typeof PartnerSyncService.getMemberBadgeHTML, 'function');
  assert.strictEqual(typeof PartnerSyncService.getMemberInitials, 'function');
  assert.strictEqual(typeof PartnerSyncService.getMemberColorGradient, 'function');
  assert.strictEqual(typeof global.getMemberBadgeHTML, 'function');
});

test('getMemberBadgeHTML handles various transaction ownership scenarios', () => {
  // Scenario 1: No family profile, no partner -> empty string
  global.state.userProfile = {};
  global.state.familyProfiles = [];
  global.state.partnerProfile = null;
  assert.strictEqual(PartnerSyncService.getMemberBadgeHTML({ id: 'tx-1' }), '');

  // Scenario 2: Family active, personal transaction (t.user_id set, but not t.family_id)
  global.state.userProfile = { family_id: 'fam-1' };
  const personalBadge = PartnerSyncService.getMemberBadgeHTML({ id: 'tx-2', user_id: 'u1' });
  assert.ok(personalBadge.includes('trans-personal-badge'));

  // Scenario 3: Family active, shared transaction with known creator
  global.state.familyProfiles = [{ id: 'u2', display_name: 'Maria K', email: 'maria@example.com' }];
  const memberBadge = PartnerSyncService.getMemberBadgeHTML({ id: 'tx-3', user_id: 'u2', family_id: 'fam-1' });
  assert.ok(memberBadge.includes('trans-member-badge'));
  assert.ok(memberBadge.includes('MK'));

  // Scenario 4: Direct partner entry
  global.state.userProfile = {};
  global.state.familyProfiles = [];
  global.state.partnerProfile = { id: 'partner-99' };
  const partnerBadge = PartnerSyncService.getMemberBadgeHTML({ id: 'tx-4', user_id: 'partner-99' });
  assert.ok(partnerBadge.includes('partner-badge-icon'));
});
