const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const BACategoryIcons = require('../js/categoryIcons.js');
const css = fs.readFileSync(__dirname + '/../js/fontawesome.min.css', 'utf8');

// Extract all fa-* classes from fontawesome.min.css
const matches = css.match(/\.fa-[a-z0-9-]+(?=:before)/g) || [];
const availableIcons = new Set(matches.map(m => m.substring(1)));

test('categoryIcons registry contains 215 icons and all exist in CSS', () => {
  const registry = BACategoryIcons.CATEGORY_ICON_REGISTRY;
  assert.equal(registry.length, 215);

  registry.forEach(item => {
    assert.ok(item.id, 'item must have id');
    assert.ok(item.icon, 'item must have icon class');
    assert.ok(item.library, 'item must have library');
    assert.ok(Array.isArray(item.keywords) && item.keywords.length > 0, 'item must have keywords');

    const iconClass = item.icon.replace('fa-solid ', '').trim();
    assert.ok(availableIcons.has(iconClass), `Icon class ${iconClass} must exist in fontawesome.min.css`);
  });
});

test('categoryIcons search works in both Greek and English', () => {
  const greekResults = BACategoryIcons.searchCategoryIcons('καφές');
  assert.ok(greekResults.some(r => r.id === 'mug-hot'));

  const englishResults = BACategoryIcons.searchCategoryIcons('coffee');
  assert.ok(englishResults.some(r => r.id === 'mug-hot'));

  const superResults = BACategoryIcons.searchCategoryIcons('σουπερμαρκετ');
  assert.ok(superResults.some(r => r.id === 'basket-shopping'));
});

test('getCategoryVisual resolves legacy emojis, FA classes, and custom strings', () => {
  const burgerVisual = BACategoryIcons.getCategoryVisual('🍔 Τρόφιμα');
  assert.equal(burgerVisual.iconClass, 'fa-solid fa-burger');
  assert.equal(burgerVisual.color, '#ffb300');

  const carVisual = BACategoryIcons.getCategoryVisual('🚗 Μεταφορές');
  assert.equal(carVisual.iconClass, 'fa-solid fa-car-side');
  assert.equal(carVisual.color, '#ffa726');

  const superVisual = BACategoryIcons.getCategoryVisual('🛒 Σούπερ Μάρκετ');
  assert.equal(superVisual.iconClass, 'fa-solid fa-basket-shopping');
  assert.equal(superVisual.color, '#f59e0b');

  const directFa = BACategoryIcons.getCategoryVisual({ icon: 'fa-solid fa-pizza-slice', color: '#ffb300' });
  assert.equal(directFa.iconClass, 'fa-solid fa-pizza-slice');
  assert.equal(directFa.color, '#ffb300');

  // Plain strings from real user transactions
  const housePlain = BACategoryIcons.getCategoryVisual('ΣΠΙΤΙ');
  assert.equal(housePlain.iconClass, 'fa-solid fa-house');
  assert.equal(housePlain.color, '#e05e55');

  const healthPlain = BACategoryIcons.getCategoryVisual('ΥΓΕΙΑ');
  assert.equal(healthPlain.iconClass, 'fa-solid fa-heart-pulse');
  assert.equal(healthPlain.color, '#ef5350');

  const foodPlain = BACategoryIcons.getCategoryVisual('ΔΙΑΤΡΟΦΗ');
  assert.equal(foodPlain.iconClass, 'fa-solid fa-burger');
  assert.equal(foodPlain.color, '#ffb300');

  const autoPlain = BACategoryIcons.getCategoryVisual('ΑΥΤΟΚΙΝΗΤΟ');
  assert.equal(autoPlain.iconClass, 'fa-solid fa-car-side');
  assert.equal(autoPlain.color, '#ffa726');

  const extraIncome = BACategoryIcons.getCategoryVisual('ΕΞΤΡΑ ΕΙΣΟΔΗΜΑ', 'income');
  assert.equal(extraIncome.color, '#ffb300');
});

test('renderCategoryIconHtml produces valid HTML with neon glow styling', () => {
  const html = BACategoryIcons.renderCategoryIconHtml('🍔 Τρόφιμα', { size: 'md' });
  assert.ok(html.includes('cat-vector-badge'));
  assert.ok(html.includes('fa-solid fa-burger'));
  assert.ok(html.includes('40px'));
  assert.ok(html.includes('color: #ffb300'));
});
