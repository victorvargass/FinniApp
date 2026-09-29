import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendHomeAttentionDismissal,
  normalizeHomeAttentionDismissals,
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
