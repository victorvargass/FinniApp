import assert from 'node:assert/strict';
import test from 'node:test';

import { getLocalCalendarDaysUntil } from '../lib/relative-due-date.ts';

test('counts calendar days until a future due date', () => {
  const now = new Date(2026, 9, 1, 23, 45);
  const dueDate = new Date(2026, 9, 5, 9, 0);

  assert.equal(getLocalCalendarDaysUntil(dueDate, now), 4);
});

test('uses calendar dates instead of elapsed hours around daylight changes', () => {
  const now = new Date(2026, 8, 5, 23, 30);
  const tomorrow = new Date(2026, 8, 6, 0, 15);

  assert.equal(getLocalCalendarDaysUntil(tomorrow, now), 1);
});
