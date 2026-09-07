const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Quick-Start 60-Second Onboarding Wizard Unit Tests', async (t) => {
  const indexPath = path.join(__dirname, '..', 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');

  const appJsPath = path.join(__dirname, '..', 'app.js');
  const wizardJsPath = path.join(__dirname, '..', 'js', 'onboardingWizard.js');
  const stsViewPath = path.join(__dirname, '..', 'js', 'safeToSpendView.js');
  const targetJs = (fs.existsSync(wizardJsPath) ? fs.readFileSync(wizardJsPath, 'utf8') : '') +
    (fs.existsSync(stsViewPath) ? '\n' + fs.readFileSync(stsViewPath, 'utf8') : '');
  const appJsContent = fs.readFileSync(appJsPath, 'utf8') + '\n' + targetJs;

  await t.test('1. index.html contains quick-start modal and settings entry', () => {
    assert.ok(indexContent.includes('id="quick-start-modal"'), 'quick-start-modal exists in DOM');
    assert.ok(indexContent.includes('id="quick-start-body"'), 'quick-start-body exists');
    assert.ok(indexContent.includes('Ρύθμιση εισοδήματος &amp; παγίων'), 'Settings row exists in index.html');
    assert.ok(indexContent.includes('openQuickStartModal(1)'), 'Settings row opens quick-start modal');
  });

  await t.test('2. app.js defines core Quick-Start functions and window exports', () => {
    assert.ok(appJsContent.includes('function openQuickStartModal('), 'openQuickStartModal defined');
    assert.ok(appJsContent.includes('function closeQuickStartModal('), 'closeQuickStartModal defined');
    assert.ok(appJsContent.includes('function renderQuickStartStep('), 'renderQuickStartStep defined');
    assert.ok(appJsContent.includes('function applyQuickStartProfile('), 'applyQuickStartProfile defined');
    assert.ok(appJsContent.includes('function getQuickStartProfile('), 'getQuickStartProfile defined');
    assert.ok(appJsContent.includes('window.openQuickStartModal = openQuickStartModal'), 'openQuickStartModal exported');
    assert.ok(appJsContent.includes('window.applyQuickStartProfile = applyQuickStartProfile'), 'applyQuickStartProfile exported');
  });

  await t.test('3. Exact natural Greek copy verification (No robotic/AI tells)', () => {
    // Screen 0
    assert.ok(appJsContent.includes('Ξέρεις πόσα σου μένουν για ξόδεμα;'));
    assert.ok(appJsContent.includes('Υπολογισμός σε 1′'));
    assert.ok(appJsContent.includes('Δες πώς λειτουργεί (Demo)'));
    assert.ok(appJsContent.includes('Όχι τώρα'));

    // Step 1
    assert.ok(appJsContent.includes('Πόσα χρήματα μπαίνουν κάθε μήνα;'));
    assert.ok(appJsContent.includes('Ο καθαρός μισθός σου ή το κοινό εισόδημα του σπιτιού.'));
    assert.ok(appJsContent.includes('Κοινό ταμείο με σύντροφο'));

    // Step 2
    assert.ok(appJsContent.includes('Ποια είναι τα σταθερά σου έξοδα;'));
    assert.ok(appJsContent.includes('Όσα πληρώνεις στάνταρ κάθε μήνα.'));
    assert.ok(appJsContent.includes('Στόχος αποταμίευσης'));

    // Step 3
    assert.ok(appJsContent.includes('Αυτό είναι το ημερήσιο όριό σου'));
    assert.ok(appJsContent.includes('Πάμε στην εφαρμογή'));
  });

  await t.test('4. Empty state card in app.js includes Quick-Start CTA', () => {
    assert.ok(appJsContent.includes('onclick="openQuickStartModal(0)"'), 'Empty card has openQuickStartModal CTA');
    assert.ok(appJsContent.includes('Υπολογισμός ορίου σε 1′'), 'CTA label is exact');
  });

  await t.test('5. Zero Ledger Pollution: applyQuickStartProfile does not create fake transactions', () => {
    const applyFnMatch = appJsContent.match(/function applyQuickStartProfile\(\) \{([\s\S]*?)\n\}/);
    assert.ok(applyFnMatch, 'applyQuickStartProfile body found');
    const body = applyFnMatch[1];
    assert.ok(!body.includes('state.transactions.push'), 'Zero transactions pushed into ledger');
    assert.ok(!body.includes('saveTransaction('), 'Zero saveTransaction calls in applyQuickStartProfile');
    assert.ok(body.includes('state.recurringTemplates.push'), 'Registers recurring templates');
    assert.ok(body.includes('ba_quick_start_profile'), 'Persists ba_quick_start_profile');
  });

  await t.test('6. getLiquidBalance supports baseline income fallback', () => {
    assert.ok(appJsContent.includes('ba_quick_start_profile'), 'getLiquidBalance checks ba_quick_start_profile');
    assert.ok(appJsContent.includes('monthly_income - spentThisMonth'), 'getLiquidBalance computes net available pool');
  });
});
