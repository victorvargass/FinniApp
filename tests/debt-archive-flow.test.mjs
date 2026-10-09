import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('paying a debt in full offers to archive it without losing its history', () => {
  const payment = source('app/modal/manual-debt-payment.tsx');
  assert.match(payment, /item\.status === 'paid'/);
  assert.match(payment, /debts\.paidDebtArchiveHint/);
  assert.match(payment, /setDebtArchived\(item\.id, true\)/);
  assert.match(payment, /cancelable: false/);
});

test('archiving a debt returns to the debt list', () => {
  const detail = source('app/modal/manual-debt-detail.tsx');
  const payment = source('app/modal/manual-debt-payment.tsx');
  assert.match(detail, /if \(archive\)[\s\S]*router\.dismissTo\('\/modal\/debts'\)/);
  assert.match(payment, /router\.dismissTo\('\/modal\/debts'\)/);
});

test('the archived list summarizes payment state without a large reactivate action', () => {
  const archived = source('app/modal/archived-debts.tsx');
  assert.match(archived, /debt\.currentBalance <= 0/);
  assert.match(archived, /t\('debts\.statusPaid'\)/);
  assert.match(archived, /t\('debts\.currentBalance'\)/);
  assert.doesNotMatch(archived, /setDebtArchived|styles\.reactivate|debts\.reactivate/);
});
