const test = require('node:test');
const assert = require('node:assert/strict');

const BankNotificationParser = require('../js/bankNotificationParser.js');

test('BankNotificationParser: exports expected functions', () => {
  assert.equal(typeof BankNotificationParser.parse, 'function');
  assert.equal(typeof BankNotificationParser.parseAmount, 'function');
  assert.equal(typeof BankNotificationParser.detectBank, 'function');
  assert.equal(typeof BankNotificationParser.detectTransactionType, 'function');
  assert.equal(typeof BankNotificationParser.extractMerchant, 'function');
  assert.equal(typeof BankNotificationParser.extractCardSuffix, 'function');
  assert.equal(typeof BankNotificationParser.predictCategory, 'function');
});

test('BankNotificationParser: parses Eurobank notification accurately', () => {
  const notif = {
    packageName: 'gr.eurobank.ebanking',
    title: 'Eurobank',
    text: 'Αγορά 15,50 EUR στην επιχείρηση SKLAVENITIS με την κάρτα ...1234'
  };
  const result = BankNotificationParser.parse(notif);
  assert.ok(result);
  assert.equal(result.isValid, true);
  assert.equal(result.bank, 'Eurobank');
  assert.equal(result.amount, 15.5);
  assert.equal(result.currency, 'EUR');
  assert.equal(result.type, 'expense');
  assert.equal(result.merchant, 'SKLAVENITIS');
  assert.equal(result.cardSuffix, '...1234');
  assert.equal(result.suggestedCategory, 'Σούπερ Μάρκετ');
});

test('BankNotificationParser: parses Piraeus winbank notification accurately', () => {
  const notif = {
    packageName: 'com.winbank.mobile',
    title: 'winbank',
    text: 'Χρέωση κάρτας ...5678 ποσού 23,40 EUR στην επιχείρηση AB VASSILOPOULOS'
  };
  const result = BankNotificationParser.parse(notif);
  assert.ok(result);
  assert.equal(result.isValid, true);
  assert.equal(result.bank, 'Τράπεζα Πειραιώς');
  assert.equal(result.amount, 23.4);
  assert.equal(result.type, 'expense');
  assert.equal(result.merchant, 'AB VASSILOPOULOS');
  assert.equal(result.cardSuffix, '...5678');
  assert.equal(result.suggestedCategory, 'Σούπερ Μάρκετ');
});

test('BankNotificationParser: parses Alpha Bank notification accurately', () => {
  const notif = {
    packageName: 'gr.alphabank.mobilebanking',
    title: 'Alpha Bank Alerts',
    text: 'Έγκριση συναλλαγής 8,50 EUR στην επιχείρηση GREGORYS'
  };
  const result = BankNotificationParser.parse(notif);
  assert.ok(result);
  assert.equal(result.isValid, true);
  assert.equal(result.bank, 'Alpha Bank');
  assert.equal(result.amount, 8.5);
  assert.equal(result.type, 'expense');
  assert.equal(result.merchant, 'GREGORYS');
  assert.equal(result.suggestedCategory, 'Καφές / Έξω');
});

test('BankNotificationParser: parses NBG (Εθνική Τράπεζα) notification accurately', () => {
  const notif = {
    packageName: 'gr.nbg.mobilebanking',
    title: 'Εθνική Τράπεζα',
    text: 'Χρέωση 18,90 EUR - EFOOD'
  };
  const result = BankNotificationParser.parse(notif);
  assert.ok(result);
  assert.equal(result.isValid, true);
  assert.equal(result.bank, 'Εθνική Τράπεζα');
  assert.equal(result.amount, 18.9);
  assert.equal(result.type, 'expense');
  assert.equal(result.merchant, 'EFOOD');
  assert.equal(result.suggestedCategory, 'Φαγητό / Delivery');
});

test('BankNotificationParser: parses Revolut notifications (Greek & English)', () => {
  const notifGr = {
    packageName: 'com.revolut.revolut',
    title: 'Revolut',
    text: 'Ξοδέψατε 5,20 € στο Coffee Island'
  };
  const resGr = BankNotificationParser.parse(notifGr);
  assert.ok(resGr);
  assert.equal(resGr.amount, 5.2);
  assert.equal(resGr.bank, 'Revolut');
  assert.equal(resGr.merchant, 'Coffee Island');
  assert.equal(resGr.suggestedCategory, 'Καφές / Έξω');

  const notifEn = {
    packageName: 'com.revolut.revolut',
    title: 'Revolut',
    text: 'You spent €12.50 at Zara'
  };
  const resEn = BankNotificationParser.parse(notifEn);
  assert.ok(resEn);
  assert.equal(resEn.amount, 12.5);
  assert.equal(resEn.merchant, 'Zara');
  assert.equal(resEn.suggestedCategory, 'Αγορές');
});

test('BankNotificationParser: handles income notifications correctly', () => {
  const notifIncome = {
    packageName: 'gr.eurobank.ebanking',
    title: 'Eurobank',
    text: 'Κατάθεση ποσού 1.250,00 EUR - Μισθοδοσία'
  };
  const res = BankNotificationParser.parse(notifIncome);
  assert.ok(res);
  assert.equal(res.amount, 1250);
  assert.equal(res.type, 'income');
  assert.equal(res.suggestedCategory, 'Μισθοδοσία / Έσοδα');
});

test('BankNotificationParser: returns null for non-transaction notifications', () => {
  assert.equal(BankNotificationParser.parse(null), null);
  assert.equal(BankNotificationParser.parse({ text: '' }), null);
  assert.equal(BankNotificationParser.parse({ title: 'System', text: 'Μια νέα ενημέρωση είναι διαθέσιμη' }), null);
  assert.equal(BankNotificationParser.parse({ title: 'Revolut', text: 'Καλώς ήρθατε στο Revolut' }), null);
});
