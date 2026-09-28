import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldShowCurrentUpdateToast } from '../lib/update-toast.ts';

test('announces an unseen active update only after Expo confirms it is current', () => {
  assert.equal(shouldShowCurrentUpdateToast({
    activeUpdateId: 'update-2',
    lastConfirmedUpdateId: 'update-1',
    status: { kind: 'current' },
  }), true);
});

test('does not announce the same active update twice', () => {
  assert.equal(shouldShowCurrentUpdateToast({
    activeUpdateId: 'update-2',
    lastConfirmedUpdateId: 'update-2',
    status: { kind: 'current' },
  }), false);
});

test('does not claim to be current when an update is available or cannot be checked', () => {
  assert.equal(shouldShowCurrentUpdateToast({
    activeUpdateId: 'update-1',
    lastConfirmedUpdateId: null,
    status: { kind: 'available', update: { id: 'update-2', createdAt: null } },
  }), false);
  assert.equal(shouldShowCurrentUpdateToast({
    activeUpdateId: 'update-1',
    lastConfirmedUpdateId: null,
    status: { kind: 'unavailable' },
  }), false);
});

test('does not announce development sessions without an Expo update id', () => {
  assert.equal(shouldShowCurrentUpdateToast({
    activeUpdateId: null,
    lastConfirmedUpdateId: null,
    status: { kind: 'current' },
  }), false);
});
