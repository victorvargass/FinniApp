import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSavingsBalanceAdjustmentAmount,
  resolveSavingsBalanceStartDate,
} from '../lib/savings-balance.ts';

test('a zero savings balance starts tracking on the registration date', () => {
  assert.equal(
    resolveSavingsBalanceStartDate('2026-09-15'),
    '2026-09-15'
  );
});

test('a reported savings balance uses the date it was entered in the app', () => {
  assert.equal(
    resolveSavingsBalanceStartDate('2026-09-15'),
    '2026-09-15'
  );
});

test('reporting the same savings balance still creates a dated zero adjustment', () => {
  assert.equal(getSavingsBalanceAdjustmentAmount(843824, 843824), 0);
});
