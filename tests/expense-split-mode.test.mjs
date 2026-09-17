import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveExpenseSplitMode } from '../lib/expense-split-mode.ts';

test('saved split mode is restored exactly when editing', () => {
  assert.equal(resolveExpenseSplitMode('amount', 50), 'amount');
  assert.equal(resolveExpenseSplitMode('percentage', 53.846154), 'percentage');
});

test('legacy exact-amount split is inferred from its calculated precision', () => {
  assert.equal(resolveExpenseSplitMode(null, 53.846154), 'amount');
});

test('legacy user-entered percentage remains percentage when representable by the old field', () => {
  assert.equal(resolveExpenseSplitMode(null, 53.846), 'percentage');
  assert.equal(resolveExpenseSplitMode(null, 50), 'percentage');
});
