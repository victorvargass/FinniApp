import assert from 'node:assert/strict';
import test from 'node:test';

import { getNextDebtDueDate } from '../lib/debt-calculations.ts';

test('a historical payment covered by the balance snapshot does not skip the next due date', () => {
  assert.equal(getNextDebtDueDate('2026-09-25', 'monthly', 0), '2026-09-25');
});

test('a payment after the balance snapshot advances the next due date', () => {
  assert.equal(getNextDebtDueDate('2026-09-25', 'monthly', 1), '2026-10-25');
});
