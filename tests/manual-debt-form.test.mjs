import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const form = readFileSync(new URL('../app/modal/manual-debt-form.tsx', import.meta.url), 'utf8');
const es = readFileSync(new URL('../locales/es.ts', import.meta.url), 'utf8');

test('new debts use one reported-debt date for creation and balance tracking', () => {
  assert.match(form, /t\('debts\.reportedDebtDate'\)/);
  assert.match(form, /if \(debtId == null\) setCreationDate\(nextDate\)/);
  assert.doesNotMatch(form, /t\('common\.creationDate'\)/);
  assert.doesNotMatch(form, /showCreationDate/);
});

test('debt form presents the reported amount and date with clear labels', () => {
  assert.match(es, /initialReportedBalance: 'Monto total informado \(CLP\)'/);
  assert.match(es, /reportedDebtDate: 'Fecha de la deuda informada'/);
  assert.match(es, /reportedDebtDateHint: 'Esta fecha inicia el historial de la deuda\./);
});
