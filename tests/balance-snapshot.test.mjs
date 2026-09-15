import assert from 'node:assert/strict';
import test from 'node:test';

import { isMovementCoveredByBalanceSnapshot } from '../lib/balance-snapshot.ts';

test('a movement before a reported balance is already covered', () => {
  assert.equal(isMovementCoveredByBalanceSnapshot('2026-09-14', 30, {
    date: '2026-09-15',
    movementAnchorId: 25,
  }), true);
});

test('same-day movements use their anchor order instead of the date alone', () => {
  const boundary = { date: '2026-09-15', movementAnchorId: 25 };
  assert.equal(isMovementCoveredByBalanceSnapshot('2026-09-15', 25, boundary), true);
  assert.equal(isMovementCoveredByBalanceSnapshot('2026-09-15', 26, boundary), false);
});

test('a movement after a reported balance changes the current amount', () => {
  assert.equal(isMovementCoveredByBalanceSnapshot('2026-09-16', 10, {
    date: '2026-09-15',
    movementAnchorId: 25,
  }), false);
});
