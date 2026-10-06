import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldScheduleRecurringNotification } from '../lib/recurring-notification-sync.ts';

const key = 'recurring-income:7:2026-09-28';
const now = new Date('2026-09-28T11:00:00').getTime();

test('keeps an already scheduled recurring notification without duplicating it', () => {
  assert.equal(shouldScheduleRecurringNotification({
    inboxKey: key,
    triggerTime: now + 60_000,
    scheduledKeys: new Set([key]),
    notifiedKeys: new Set(),
    now,
  }), false);
});

test('does not notify an overdue recurring occurrence again after it was scheduled', () => {
  assert.equal(shouldScheduleRecurringNotification({
    inboxKey: key,
    triggerTime: now - 60_000,
    scheduledKeys: new Set(),
    notifiedKeys: new Set([key]),
    now,
  }), false);
});

test('schedules an overdue occurrence once when it has never been notified', () => {
  assert.equal(shouldScheduleRecurringNotification({
    inboxKey: key,
    triggerTime: now - 60_000,
    scheduledKeys: new Set(),
    notifiedKeys: new Set(),
    now,
  }), true);
});

test('restores a missing future schedule even when it was previously scheduled', () => {
  assert.equal(shouldScheduleRecurringNotification({
    inboxKey: key,
    triggerTime: now + 60_000,
    scheduledKeys: new Set(),
    notifiedKeys: new Set([key]),
    now,
  }), true);
});
