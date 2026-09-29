import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendHomeAttentionDismissal,
  normalizeHomeAttentionDismissals,
  removeHomeAttentionDismissal,
} from '../lib/home-attention-state.ts';

test('home attention dismissals ignore corrupt entries and remain unique', () => {
  assert.deepEqual(normalizeHomeAttentionDismissals(['card-1', 2, null, 'limit-1']), [
    'card-1',
    'limit-1',
  ]);
  assert.deepEqual(appendHomeAttentionDismissal(['card-1', 'limit-1'], 'card-1'), [
    'limit-1',
    'card-1',
  ]);
});

test('home attention dismissals keep only the most recent entries', () => {
  assert.deepEqual(appendHomeAttentionDismissal(['one', 'two', 'three'], 'four', 3), [
    'two',
    'three',
    'four',
  ]);
});

test('a dismissed home alert can be restored without changing the others', () => {
  assert.deepEqual(
    removeHomeAttentionDismissal(['card-1', 'limit-1', 'payment-1'], 'limit-1'),
    ['card-1', 'payment-1']
  );
});
