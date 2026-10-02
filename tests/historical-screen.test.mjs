import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../app/(tabs)/summary.tsx', import.meta.url), 'utf8');
const database = readFileSync(new URL('../lib/database/engine.ts', import.meta.url), 'utf8');

test('historical report presents flow, insights, savings, debts and period details', () => {
  assert.match(screen, /buildHistoricalReport\(filteredPeriods\)/);
  assert.match(screen, /history\.flowEvolution/);
  assert.match(screen, /history\.insights/);
  assert.match(screen, /history\.savingsContributions/);
  assert.match(screen, /history\.debtPayments/);
  assert.match(screen, /history\.paymentMethods/);
  assert.match(screen, /<HistoricalPeriodModal/);
});

test('historical PDF and CSV exports both expose progress while generating', () => {
  assert.match(screen, /busy: exporting === 'pdf'/);
  assert.match(screen, /exporting === 'pdf'[\s\S]*?<ActivityIndicator/);
  assert.match(screen, /busy: exporting === 'csv'/);
  assert.match(screen, /exporting === 'csv'[\s\S]*?<ActivityIndicator/);
});

test('historical chart keeps its legend and complete period ranges inside the card', () => {
  assert.match(screen, /const chartWidth = Math\.max\(screenWidth - 144, report\.periods\.length \* 88\)/);
  assert.match(screen, /periodAxisRange\(period\)/);
  assert.match(screen, /labelWidth: 84/);
  assert.match(screen, /xAxisLabelsHeight=\{40\}/);
  assert.match(screen, /styles\.legendItem/);
});

test('period history aggregates payable and receivable debt payments separately', () => {
  assert.match(database, /manual_debt_entries entry[\s\S]*debt\.direction[\s\S]*entry\.kind = 'payment'/);
  assert.match(database, /debtPaymentsTotal: debtPaymentsByPeriod/);
  assert.match(database, /debtCollectionsTotal: debtCollectionsByPeriod/);
});
