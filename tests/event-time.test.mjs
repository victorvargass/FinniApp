import assert from 'node:assert/strict';
import test from 'node:test';

import { dateWithTime, isValidTimeString, resolveEventTime, toTimeString } from '../lib/event-time.ts';

test('formats and validates a local event hour', () => {
  assert.equal(toTimeString(new Date(2026, 8, 25, 7, 4)), '07:04');
  assert.equal(isValidTimeString('23:59'), true);
  assert.equal(isValidTimeString('24:00'), false);
});

test('uses an explicit time and falls back to the current local time', () => {
  const fallback = new Date(2026, 8, 25, 16, 32);
  assert.equal(resolveEventTime('09:15', fallback), '09:15');
  assert.equal(resolveEventTime(undefined, fallback), '16:32');
});

test('combines a date with a selected time', () => {
  const result = dateWithTime(new Date(2026, 8, 25, 12), '18:45');
  assert.deepEqual(
    [result.getFullYear(), result.getMonth(), result.getDate(), result.getHours(), result.getMinutes()],
    [2026, 8, 25, 18, 45]
  );
});
