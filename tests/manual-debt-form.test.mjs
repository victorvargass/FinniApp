import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import esLocale from '../locales/es.ts';

const form = readFileSync(new URL('../app/modal/manual-debt-form.tsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../app/modal/manual-debt-detail.tsx', import.meta.url), 'utf8');
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
  const debtRelatedCopy = [
    ...Object.values(esLocale.debts),
    esLocale.installments.manageBalance,
    esLocale.installments.intro,
    esLocale.installments.projectedBalance,
    esLocale.installments.projectedBalanceValue,
    esLocale.report.debtsSubtitle,
    esLocale.report.openingBalance,
    esLocale.report.closingBalance,
    esLocale.database.noRemainingBalance,
    esLocale.database.debtPaymentTooHigh,
    esLocale.database.debtBalanceInvalid,
    esLocale.database.debtAdjustmentFixed,
    esLocale.database.debtBalanceUnchanged,
    esLocale.database.debtAdjustmentDateInvalid,
    esLocale.database.debtAdjustmentMissing,
    esLocale.database.debtBalanceDateBeforeInitial,
    esLocale.database.debtBalanceDateInvalid,
    esLocale.database.debtBalanceDateAfterSnapshot,
  ];
  for (const value of debtRelatedCopy) {
    assert.doesNotMatch(value, /\bsaldo(?:s)?\b/i);
  }
});

test('debt date validation uses debt-specific amount terminology', () => {
  const database = readFileSync(new URL('../lib/database/engine.ts', import.meta.url), 'utf8');
  assert.match(database, /t\('database\.debtBalanceDateInvalid'\)/);
  assert.match(database, /t\('database\.debtBalanceDateBeforeInitial'\)/);
  assert.match(database, /t\('database\.debtBalanceDateAfterSnapshot'\)/);
});

test('same-amount debt updates are presented as dated confirmations', () => {
  assert.equal(esLocale.debts.balanceConfirmation, 'Monto confirmado');
  assert.match(detail, /entry\.reportedBalance != null && entry\.amount === 0/);
  assert.match(detail, /latestReportedEntry\?\.date \?\? debt\.balanceDate/);
  assert.match(detail, /!isBalanceConfirmation && <ThemedText/);
});

test('editing a variable debt shows its calculated next estimated date', () => {
  assert.match(form, /setNextEstimatedPaymentDate\(debt\.nextDueDate \?\? debt\.firstDueDate/);
  assert.match(form, /getDebtScheduleStartDate\(nextEstimatedPaymentDate, 'monthly', paymentCount\)/);
});
