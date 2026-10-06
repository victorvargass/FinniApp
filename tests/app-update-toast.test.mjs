import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseSeenActiveUpdateIds,
  resolveCurrentUpdateToastState,
  shouldShowCurrentUpdateToast,
} from '../lib/update-toast.ts';

test('announces an update only after its id becomes the active id', () => {
  assert.equal(shouldShowCurrentUpdateToast({
    activeUpdateId: 'update-2',
    previousActiveUpdateId: 'update-1',
  }), true);
});

test('does not announce the same active update twice', () => {
  assert.equal(shouldShowCurrentUpdateToast({
    activeUpdateId: 'update-2',
    previousActiveUpdateId: 'update-2',
  }), false);
});

test('does not announce the first observed update as a newly applied update', () => {
  assert.equal(shouldShowCurrentUpdateToast({
    activeUpdateId: 'update-1',
    previousActiveUpdateId: null,
  }), false);
});

test('does not announce development sessions without an Expo update id', () => {
  assert.equal(shouldShowCurrentUpdateToast({
    activeUpdateId: null,
    previousActiveUpdateId: 'update-1',
  }), false);
});

test('announces each applied update only once even after another update ran', () => {
  const firstLaunch = resolveCurrentUpdateToastState({
    activeUpdateId: 'update-2',
    seenActiveUpdateIds: ['embedded-update', 'update-1'],
  });
  assert.equal(firstLaunch.shouldShow, true);
  assert.deepEqual(firstLaunch.seenActiveUpdateIds, ['embedded-update', 'update-1', 'update-2']);

  const repeatedLaunch = resolveCurrentUpdateToastState({
    activeUpdateId: 'update-2',
    seenActiveUpdateIds: firstLaunch.seenActiveUpdateIds,
  });
  assert.equal(repeatedLaunch.shouldShow, false);

  const rollbackLaunch = resolveCurrentUpdateToastState({
    activeUpdateId: 'update-1',
    seenActiveUpdateIds: repeatedLaunch.seenActiveUpdateIds,
  });
  assert.equal(rollbackLaunch.shouldShow, false);
});

test('keeps malformed or oversized persisted update history safe and bounded', () => {
  assert.deepEqual(parseSeenActiveUpdateIds('not-json'), []);
  assert.deepEqual(parseSeenActiveUpdateIds(JSON.stringify(['a', '', 'a', 3, 'b'])), ['a', 'b']);

  const state = resolveCurrentUpdateToastState({
    activeUpdateId: 'latest',
    seenActiveUpdateIds: Array.from({ length: 25 }, (_, index) => `update-${index}`),
  });
  assert.equal(state.shouldShow, true);
  assert.equal(state.seenActiveUpdateIds.length, 20);
  assert.equal(state.seenActiveUpdateIds.at(-1), 'latest');
});
