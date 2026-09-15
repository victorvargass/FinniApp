import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSavingsBalanceAdjustmentAmount,
  isSavingsMovementCoveredByBalance,
  resolveSavingsBalanceStartDate,
} from '../lib/savings-balance.ts';

test('the savings starting point follows the goal creation date', () => {
  assert.equal(
    resolveSavingsBalanceStartDate('2026-08-25'),
    '2026-08-25'
  );
});

test('a contribution after a backdated creation date is not covered by the starting balance', () => {
  assert.equal(
    isSavingsMovementCoveredByBalance('2026-08-26', 1, {
      date: '2026-08-25',
      movementAnchorId: 0,
    }),
    false
  );
});

test('a savings balance boundary covers earlier movements', () => {
  assert.equal(
    isSavingsMovementCoveredByBalance('2026-09-14', 20, {
      date: '2026-09-15',
      movementAnchorId: 25,
    }),
    true
  );
});

test('same-day savings movements are ordered by the synchronization anchor', () => {
  const boundary = { date: '2026-09-15', movementAnchorId: 25 };
  assert.equal(isSavingsMovementCoveredByBalance('2026-09-15', 25, boundary), true);
  assert.equal(isSavingsMovementCoveredByBalance('2026-09-15', 26, boundary), false);
});

test('without a savings balance boundary every movement remains effective', () => {
  assert.equal(isSavingsMovementCoveredByBalance('2026-09-15', 25, null), false);
});

test('reporting the same savings balance still creates a dated zero adjustment', () => {
  assert.equal(getSavingsBalanceAdjustmentAmount(843824, 843824), 0);
});
