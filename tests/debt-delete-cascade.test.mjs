import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const detail = readFileSync(new URL('../app/modal/manual-debt-detail.tsx', import.meta.url), 'utf8');
const database = readFileSync(new URL('../lib/database/engine.ts', import.meta.url), 'utf8');
const es = readFileSync(new URL('../locales/es.ts', import.meta.url), 'utf8');

test('debt detail allows deletion with history and warns about related movements', () => {
  assert.doesNotMatch(detail, /if \(debt\.entryCount > 0\).*cannotDelete/);
  assert.match(detail, /debt\.entryCount > 0 \? 'debts\.deleteWithHistoryHint' : 'debts\.deleteHint'/);
  assert.doesNotMatch(detail, /debt\.entryCount === 0 \? \[\{/);
  assert.match(es, /deleteWithHistoryHint: 'Se eliminarán esta deuda y todos sus movimientos relacionados/);
});

test('debt deletion removes linked entries and their financial movements in one transaction', () => {
  const start = database.indexOf('export async function deleteDebt(id: number)');
  const end = database.indexOf('\nasync function postInstallment', start);
  const implementation = database.slice(start, end);

  assert.match(implementation, /withExclusiveTransaction/);
  assert.match(implementation, /SELECT entry\.expense_id, entry\.income_id/);
  assert.match(implementation, /DELETE FROM expense_shares WHERE debt_id = \?/);
  assert.match(implementation, /DELETE FROM manual_debt_entries WHERE debt_id = \?/);
  assert.match(implementation, /DELETE FROM expenses WHERE id = \?/);
  assert.match(implementation, /DELETE FROM incomes WHERE id = \?/);
  assert.match(implementation, /DELETE FROM manual_debts WHERE id = \?/);
  assert.doesNotMatch(implementation, /debtHasHistory|splitDebtManagedByExpense/);
});
