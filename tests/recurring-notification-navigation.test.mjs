import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const scheduled = readFileSync(
  new URL('../services/RecurringNotificationService.ts', import.meta.url),
  'utf8'
);
const delivered = readFileSync(
  new URL('../services/NotificationInboxService.ts', import.meta.url),
  'utf8'
);

test('recurring notification actions open the exact recurrence detail', () => {
  assert.match(scheduled, /\/modal\/recurrence-detail\?id=\$\{schedule\.recurringId\}&kind=\$\{schedule\.kind\}/);
  assert.match(delivered, /\/modal\/recurrence-detail\?id=\$\{recurringId\}&kind=\$\{recurringKind\}/);
  assert.doesNotMatch(scheduled, /actionUrl:[\s\S]{0,180}recurring-expense-form/);
  assert.doesNotMatch(delivered, /actionUrl[\s\S]{0,300}recurring-income-form/);
});
