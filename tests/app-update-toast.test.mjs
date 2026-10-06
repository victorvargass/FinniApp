import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldShowCurrentUpdateToast } from '../lib/update-toast.ts';

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
