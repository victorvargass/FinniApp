import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addIsoMonths,
  getOccurrenceDates,
} from '../lib/recurrence-core.ts';

test('monthly recurrence clamps safely to the last day of short months', () => {
  assert.equal(addIsoMonths('2026-01-31', 1, 31), '2026-02-28');
  assert.deepEqual(getOccurrenceDates({
    frequency: 'monthly',
    intervalMonths: 1,
    executionDay: 31,
    startDate: '2026-01-31',
    endDate: '2026-04-30',
  }, '2026-01-01', '2026-12-31'), [
    '2026-01-31',
    '2026-02-28',
    '2026-03-31',
    '2026-04-30',
  ]);
});

test('weekly recurrence respects start and end boundaries', () => {
  assert.deepEqual(getOccurrenceDates({
    frequency: 'weekly',
    intervalMonths: 1,
    executionDay: null,
    startDate: '2026-09-01',
    endDate: '2026-09-22',
  }, '2026-09-08', '2026-10-01'), [
    '2026-09-08',
    '2026-09-15',
    '2026-09-22',
  ]);
});
