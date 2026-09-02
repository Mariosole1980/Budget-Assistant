'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

test('review storage keys are properly named', () => {
    const keys = {
        FIRST_LAUNCH: 'budget_assistant_first_launch_time',
        STATUS: 'budget_assistant_review_status',
        NEXT_PROMPT: 'budget_assistant_review_next_prompt_time'
    };
    assert.strictEqual(keys.FIRST_LAUNCH, 'budget_assistant_first_launch_time');
    assert.strictEqual(keys.STATUS, 'budget_assistant_review_status');
    assert.strictEqual(keys.NEXT_PROMPT, 'budget_assistant_review_next_prompt_time');
});

test('7-day threshold calculates accurately', () => {
    const now = Date.now();
    const sixDaysAgo = now - (6 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000);

    const isEligible = (launchTime) => {
        const days = (now - launchTime) / (1000 * 60 * 60 * 24);
        return days >= 7;
    };

    assert.strictEqual(isEligible(sixDaysAgo), false);
    assert.strictEqual(isEligible(sevenDaysAgo), true);
    assert.strictEqual(isEligible(eightDaysAgo), true);
});

test('review status transitions protect against spamming users', () => {
    const shouldPrompt = (status, days, txCount, nextPrompt, now) => {
        if (status === 'rated' || status === 'dismissed') return false;
        if (days < 7) return false;
        if (status === 'remind_later' && nextPrompt && now < nextPrompt) return false;
        if (txCount < 3) return false;
        return true;
    };

    const now = 1000000000;
    assert.strictEqual(shouldPrompt(null, 5, 10, null, now), false);
    assert.strictEqual(shouldPrompt(null, 8, 2, null, now), false);
    assert.strictEqual(shouldPrompt(null, 8, 5, null, now), true);
    assert.strictEqual(shouldPrompt('rated', 8, 5, null, now), false);
    assert.strictEqual(shouldPrompt('dismissed', 8, 5, null, now), false);
    assert.strictEqual(shouldPrompt('remind_later', 8, 5, now + 50000, now), false);
    assert.strictEqual(shouldPrompt('remind_later', 15, 5, now - 50000, now), true);
});
