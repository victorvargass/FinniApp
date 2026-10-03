import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHistoricalReport,
  getPeriodCashflow,
} from '../lib/historical-report.ts';
import en from '../locales/en.ts';
import es from '../locales/es.ts';

function period(overrides = {}) {
  return {
    periodId: 1,
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    year: 2026,
    incomesTotal: 1_000,
    savingsWithdrawalTotal: 0,
    savingsFundingTotal: 100,
    debtPaymentsTotal: 50,
    debtCollectionsTotal: 0,
    cardPaymentsFromAccountsTotal: 0,
    cardInternalAdjustmentsTotal: 0,
    categories: [{
      categoryId: 1,
      categoryName: 'Hogar',
      categoryColor: '#00AA00',
      periodLimit: null,
      total: 600,
    }],
    paymentMethods: [{
      paymentMethodId: 1,
      paymentMethodName: 'Cuenta',
      paymentMethodColor: '#0000AA',
      paymentMethodType: 'debit',
      billingDay: null,
      active: true,
      total: 600,
    }],
    ...overrides,
  };
}

test('historical cashflow includes savings withdrawals without counting them as income', () => {
  assert.equal(getPeriodCashflow(period({ savingsWithdrawalTotal: 200 })), 600);
});

test('historical copy describes the net result instead of an available account balance', () => {
  assert.equal(es.history.cashflow, 'Resultado neto');
  assert.match(es.history.dataNote, /ingresos más retiros de ahorro, menos salidas/);
  assert.equal(en.history.cashflow, 'Net result');
  assert.match(en.history.dataNote, /income plus savings withdrawals, minus outflows/);
});

test('historical report combines periods, categories, savings and debts', () => {
  const report = buildHistoricalReport([
    period(),
    period({
      periodId: 2,
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      incomesTotal: 1_500,
      savingsFundingTotal: 200,
      debtPaymentsTotal: 100,
      debtCollectionsTotal: 80,
      categories: [
        { categoryId: 1, categoryName: 'Hogar', categoryColor: '#00AA00', periodLimit: 700, total: 400 },
        { categoryId: 2, categoryName: 'Salud', categoryColor: '#AA0000', periodLimit: null, total: 300 },
      ],
    }),
  ]);

  assert.equal(report.incomeTotal, 2_500);
  assert.equal(report.expenseTotal, 1_300);
  assert.equal(report.cashflowTotal, 1_200);
  assert.equal(report.averageExpense, 650);
  assert.equal(report.savingsFundingTotal, 300);
  assert.equal(report.savingsRate, 12);
  assert.equal(report.debtPaymentsTotal, 150);
  assert.equal(report.debtCollectionsTotal, 80);
  assert.equal(report.categories[0].categoryName, 'Hogar');
  assert.equal(report.categories[0].total, 1_000);
  assert.equal(report.bestPeriod?.periodId, 2);
  assert.equal(report.latestExpenseChangePercent, 17);
  assert.equal(report.latestIncomeChangePercent, 50);
});

test('historical report remains meaningful without income or periods', () => {
  const empty = buildHistoricalReport([]);
  assert.equal(empty.savingsRate, null);
  assert.equal(empty.bestPeriod, null);
  assert.deepEqual(empty.categories, []);

  const noIncome = buildHistoricalReport([period({ incomesTotal: 0 })]);
  assert.equal(noIncome.savingsRate, null);
});
