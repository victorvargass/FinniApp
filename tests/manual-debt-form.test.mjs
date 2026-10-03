import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import esLocale from '../locales/es.ts';

const form = readFileSync(new URL('../app/modal/manual-debt-form.tsx', import.meta.url), 'utf8');
const esSource = readFileSync(new URL('../locales/es.ts', import.meta.url), 'utf8');

test('new debts use one reported-debt date for creation and balance tracking', () => {
  assert.match(form, /t\('debts\.reportedDebtDate'\)/);
  assert.match(form, /if \(debtId == null\) setCreationDate\(nextDate\)/);
  assert.doesNotMatch(form, /t\('common\.creationDate'\)/);
  assert.doesNotMatch(form, /showCreationDate/);
});

test('debt form presents the reported amount and date with clear labels', () => {
  assert.match(esSource, /initialReportedBalance: 'Monto total informado \(CLP\)'/);
  assert.match(esSource, /reportedDebtDate: 'Fecha de la deuda informada'/);
  assert.match(esSource, /reportedDebtDateHint: 'Esta fecha inicia el historial de la deuda\./);
});

test('debt copy uses monto instead of saldo throughout the debt workflow', () => {
  assert.equal(esLocale.debts.currentBalance, 'Monto pendiente');
  assert.equal(esLocale.debts.updateBalance, 'Actualizar monto');
  assert.equal(esLocale.debts.balanceAdjustment, 'Ajuste de monto');
  for (const value of Object.values(esLocale.debts)) {
    assert.doesNotMatch(value, /\bsaldo(?:s)?\b/i);
  }
});
