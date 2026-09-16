import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSavingsBalanceAdjustmentAmount,
  isSavingsMovementCoveredByBalance,
  resolveSavingsBalanceStartDate,
} from '../lib/savings-balance.ts';

test('the savings starting point follows the reported balance date, not historical creation', () => {
  assert.equal(
    resolveSavingsBalanceStartDate('2026-09-15'),
    '2026-09-15'
  );
});

test('a contribution after historical creation but before the reported balance is covered', () => {
  assert.equal(
    isSavingsMovementCoveredByBalance('2026-08-26', 1, {
      date: '2026-09-15',
      movementAnchorId: 0,
    }),
    true
  );
});

test('a later contribution counts even when the reported opening balance is zero', () => {
  assert.equal(isSavingsMovementCoveredByBalance('2026-09-16', 2, {
    date: '2026-09-15', movementAnchorId: 0,
  }), false);
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
