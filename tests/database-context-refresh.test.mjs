import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../contexts/DatabaseContext.tsx', import.meta.url), 'utf8');

test('financial writes refresh their domain without rerunning global maintenance', () => {
  const start = source.indexOf('const refreshFinancialDomain');
  const end = source.indexOf('useEffect(() => {', start);
  const domainRefresh = source.slice(start, end);
  assert.match(domainRefresh, /getPaymentMethodTotals/);
  assert.match(domainRefresh, /getExpenses/);
  assert.match(domainRefresh, /getIncomes/);
  assert.match(domainRefresh, /getSavingsGoals/);
  assert.match(domainRefresh, /getDebts/);
  assert.doesNotMatch(domainRefresh, /processDueRecurringExpenses/);
  assert.doesNotMatch(domainRefresh, /getContacts/);

  for (const operation of [
    'createAccountTransfer', 'createCreditCardAdjustment', 'createDebtPayment',
    'updatePaymentMethodBalance', 'createInstallmentPurchase',
  ]) {
    const operationStart = source.indexOf(`await db.${operation}`);
    assert.notEqual(operationStart, -1, `${operation} should be wired in the context`);
    assert.match(source.slice(operationStart, operationStart + 300), /await refreshFinancialDomain\(\)/);
  }
});
