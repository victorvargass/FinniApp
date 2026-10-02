import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSavingsProgressSeries } from '../lib/savings-progress.ts';

const movement = (overrides) => ({
  id: 1,
  goalId: 7,
  kind: 'contribution',
  name: 'Movimiento',
  amount: 0,
  date: '2026-10-02',
  time: '12:00',
  expenseId: null,
  incomeId: null,
  reportedBalance: null,
  ...overrides,
});

test('savings progress follows contributions, withdrawals and reported balances', () => {
  const points = buildSavingsProgressSeries(300_000, '2026-09-14', '10:00', [
    movement({ id: 4, kind: 'withdrawal', amount: 20_000, date: '2026-10-03' }),
    movement({ id: 2, amount: 100_000, date: '2026-09-28' }),
    movement({ id: -3, kind: 'adjustment', amount: 15_000, reportedBalance: 415_000, date: '2026-10-01' }),
  ], 395_000);

  assert.deepEqual(points.map((point) => point.balance), [300_000, 400_000, 415_000, 395_000]);
  assert.deepEqual(points.map((point) => point.date), [
    '2026-09-14', '2026-09-28', '2026-10-01', '2026-10-03',
  ]);
});

test('movements covered by the reported starting balance are not counted twice', () => {
  const points = buildSavingsProgressSeries(300_000, '2026-09-14', '10:00', [
    movement({ id: 1, amount: 80_000, date: '2026-09-10' }),
    movement({ id: 2, amount: 25_000, date: '2026-09-14', time: '09:30' }),
    movement({ id: 3, amount: 40_000, date: '2026-09-14', time: '10:30' }),
  ], 340_000);

  assert.deepEqual(points.map((point) => point.balance), [300_000, 340_000]);
});

test('the current saved amount remains the authoritative last point', () => {
  const points = buildSavingsProgressSeries(100_000, '2026-09-01', null, [], 125_000);
  assert.deepEqual(points.map((point) => point.balance), [100_000, 125_000]);
});
