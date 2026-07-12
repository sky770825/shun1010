const assert = require('node:assert/strict');
const test = require('node:test');

const {
  scheduleDataMatches,
  shouldReplaceLocalSchedule,
} = require('../sheet-sync-utils.js');

test('does not replace a local schedule with an empty remote result', () => {
  const local = { '2026-07:1-morning': '09' };

  assert.equal(shouldReplaceLocalSchedule(local, {}), false);
  assert.equal(shouldReplaceLocalSchedule(local, null), false);
});

test('replaces local data when the remote schedule contains records', () => {
  const remote = { '2026-07:1-morning': '09' };

  assert.equal(shouldReplaceLocalSchedule({}, remote), true);
  assert.equal(shouldReplaceLocalSchedule({ '2026-07:1-morning': '10' }, remote), true);
});

test('matches a verified write regardless of key order and member ID padding', () => {
  const expected = {
    '2026-07:1-morning': '9',
    '2026-07:1-evening': '12',
  };
  const actual = {
    '2026-07:1-evening': '12',
    '2026-07:1-morning': '09',
  };

  assert.equal(scheduleDataMatches(expected, actual), true);
});

test('rejects a write verification with a missing or changed assignment', () => {
  const expected = {
    '2026-07:1-morning': '09',
    '2026-07:1-evening': '12',
  };

  assert.equal(scheduleDataMatches(expected, { '2026-07:1-morning': '09' }), false);
  assert.equal(scheduleDataMatches(expected, {
    '2026-07:1-morning': '09',
    '2026-07:1-evening': '13',
  }), false);
});
