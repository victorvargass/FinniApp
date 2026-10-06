import assert from 'node:assert/strict';
import test from 'node:test';

import { findPendingRecurringMatches } from '../lib/notification-recurrence-match.ts';

const occurredAt = new Date(2026, 9, 6, 5, 58).getTime();
const candidate = {
  amount: 12_990,
  occurredAt,
  suggestedType: 'expense',
};
const entel = {
  kind: 'expense',
  recurringId: 1,
  scheduledDate: '2026-10-06',
  name: 'Entel',
  amount: 12_990,
  isSavingsContribution: false,
  status: 'pending',
};

test('a unique same-day amount match proposes its pending recurrence', () => {
  assert.deepEqual(findPendingRecurringMatches(candidate, [
    entel,
    { ...entel, recurringId: 2, name: 'Otro día', scheduledDate: '2026-10-05' },
    { ...entel, recurringId: 3, name: 'Otro monto', amount: 13_000 },
  ]), [entel]);
});

test('same-day recurrences with the same amount remain available for explicit choice', () => {
  const spotify = { ...entel, recurringId: 2, name: 'Spotify' };
  assert.deepEqual(findPendingRecurringMatches(candidate, [entel, spotify]), [entel, spotify]);
});

test('card payments and transfers are not matched to ordinary recurrences', () => {
  assert.deepEqual(findPendingRecurringMatches({ ...candidate, suggestedType: 'card-payment' }, [entel]), []);
  assert.deepEqual(findPendingRecurringMatches({ ...candidate, suggestedType: 'transfer' }, [entel]), []);
});
