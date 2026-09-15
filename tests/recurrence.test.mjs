import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addIsoMonths,
  getNextOccurrenceDate,
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

test('annual recurrence clamps a leap-day schedule safely', () => {
  const rule = {
    frequency: 'annual',
    intervalMonths: 1,
    executionDay: null,
    startDate: '2028-02-29',
    endDate: '2030-03-01',
  };
  assert.equal(getNextOccurrenceDate(rule), '2028-02-29');
  assert.equal(getNextOccurrenceDate(rule, '2028-02-29'), '2029-02-28');
});

test('custom monthly recurrence honors its configured interval', () => {
  assert.deepEqual(getOccurrenceDates({
    frequency: 'custom',
    intervalMonths: 3,
    executionDay: 15,
    startDate: '2026-01-20',
    endDate: '2026-12-31',
  }, '2026-01-01', '2026-12-31'), [
    '2026-04-15',
    '2026-07-15',
    '2026-10-15',
  ]);
});

test('recurrence returns null after its end date', () => {
  assert.equal(getNextOccurrenceDate({
    frequency: 'weekly',
    intervalMonths: 1,
    executionDay: null,
    startDate: '2026-09-01',
    endDate: '2026-09-07',
  }, '2026-09-01'), null);
});

test('occurrence generation observes its safety limit', () => {
  assert.equal(getOccurrenceDates({
    frequency: 'weekly',
    intervalMonths: 1,
    executionDay: null,
    startDate: '2026-01-01',
    endDate: null,
  }, '2026-01-01', '2030-01-01', 3).length, 3);
});
