const { describe, it } = require('node:test');
const assert = require('node:assert');

const UserGuide = require('../js/userGuide.js');

describe('UserGuide Module Tests', () => {
  it('exports USER_GUIDE_DATA with both el and en languages', () => {
    assert.ok(UserGuide.USER_GUIDE_DATA, 'USER_GUIDE_DATA exists');
    assert.ok(UserGuide.USER_GUIDE_DATA.el, 'el language exists');
    assert.ok(UserGuide.USER_GUIDE_DATA.en, 'en language exists');
  });

  it('both languages define exactly 13 chapters with matching IDs', () => {
    const elChapters = UserGuide.USER_GUIDE_DATA.el.chapters;
    const enChapters = UserGuide.USER_GUIDE_DATA.en.chapters;

    assert.strictEqual(elChapters.length, 13, 'Greek has 13 chapters');
    assert.strictEqual(enChapters.length, 13, 'English has 13 chapters');

    const elIds = elChapters.map(c => c.id);
    const enIds = enChapters.map(c => c.id);

    assert.deepStrictEqual(elIds, enIds, 'Chapter IDs match across languages');
  });

  it('all chapters contain non-empty title, icon, and content', () => {
    for (const lang of ['el', 'en']) {
      const chapters = UserGuide.USER_GUIDE_DATA[lang].chapters;
      chapters.forEach(chap => {
        assert.ok(chap.id && typeof chap.id === 'string', `Chapter ${chap.id} has valid id`);
        assert.ok(chap.title && typeof chap.title === 'string', `Chapter ${chap.id} has valid title`);
        assert.ok(chap.icon && typeof chap.icon === 'string', `Chapter ${chap.id} has valid icon`);
        assert.ok(chap.content && typeof chap.content === 'string' && chap.content.length > 50, `Chapter ${chap.id} has content`);
      });
    }
  });

  it('highlightGuideQuery properly highlights search queries', () => {
    const text = 'Ο Cloud συγχρονισμός είναι ασφαλής';
    const highlighted = UserGuide.highlightGuideQuery(text, 'Cloud');
    assert.strictEqual(highlighted, 'Ο <mark class="guide-highlight">Cloud</mark> συγχρονισμός είναι ασφαλής');
  });

  it('highlightGuideQuery returns original text for empty or falsy query', () => {
    const text = 'Απλό κείμενο';
    assert.strictEqual(UserGuide.highlightGuideQuery(text, ''), text);
    assert.strictEqual(UserGuide.highlightGuideQuery(text, null), text);
    assert.strictEqual(UserGuide.highlightGuideQuery(text, '   '), text);
  });

  it('exports all expected modal and guide functions', () => {
    assert.strictEqual(typeof UserGuide.openUserGuideModal, 'function');
    assert.strictEqual(typeof UserGuide.toggleUserGuideLanguage, 'function');
    assert.strictEqual(typeof UserGuide.filterUserGuide, 'function');
    assert.strictEqual(typeof UserGuide.clearUserGuideSearch, 'function');
    assert.strictEqual(typeof UserGuide.toggleGuideChapter, 'function');
    assert.strictEqual(typeof UserGuide.jumpToGuideChapter, 'function');
    assert.strictEqual(typeof UserGuide.renderUserGuideContent, 'function');
  });
});
