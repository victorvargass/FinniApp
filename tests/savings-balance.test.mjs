import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveSavingsBalanceStartDate } from '../lib/savings-balance.ts';

test('a zero savings balance starts tracking on the goal creation date', () => {
  assert.equal(
    resolveSavingsBalanceStartDate(0, '2026-08-27', '2026-09-15'),
    '2026-08-27'
  );
});

test('a reported savings balance remains a snapshot from its registration date', () => {
  assert.equal(
    resolveSavingsBalanceStartDate(843824, '2024-12-30', '2026-09-15'),
    '2026-09-15'
  );
});
