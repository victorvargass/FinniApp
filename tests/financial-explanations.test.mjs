import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('financial explanations use one accessible lightbulb modal', () => {
  const modal = source('components/financial-explanation-modal.tsx');
  assert.match(modal, /name="bulb-outline"/);
  assert.match(modal, /accessibilityViewIsModal/);
  assert.match(modal, /explanation\.lines\.map/);
  assert.match(modal, /explanation\.total/);
});

test('Home summary metrics expose their underlying calculations', () => {
  const home = source('app/(tabs)/home.tsx');
  const cards = source('components/home-summary-cards.tsx');
  assert.match(cards, /onExplainPeriodMetric/);
  assert.match(cards, /onExplainGlobalMetric/);
  assert.match(home, /showPeriodMetricExplanation/);
  assert.match(home, /showGlobalMetricExplanation/);
  assert.match(home, /financialExplanation\.descriptions\.periodAvailable/);
  assert.match(home, /financialExplanation\.descriptions\.totalDebt/);
});

test('compact calculation affordances cover the twelve financial contexts', () => {
  const paths = [
    'app/(tabs)/home.tsx',
    'components/home-summary-cards.tsx',
    'components/home-payment-balances-card.tsx',
    'components/breakdown-section.tsx',
    'components/LimitProgressBar.tsx',
    'components/SavingsGoalsPeriodCard.tsx',
    'components/weekly-insight-card.tsx',
    'app/modal/manual-debt-detail.tsx',
    'app/modal/debts.tsx',
    'app/modal/budget-forecast.tsx',
    'app/modal/recurrence-detail.tsx',
    'app/(tabs)/summary.tsx',
  ];
  const combined = paths.map(source).join('\n');
  for (const token of [
    'onExplainPeriodMetric',
    'onExplainPaymentMethod',
    'financialExplanation.descriptions.chart',
    'financialExplanation.descriptions.budget',
    'onExplainGoal',
    'financialExplanation.descriptions.debtBalance',
    'financialExplanation.descriptions.contactDebt',
    'financialExplanation.descriptions.forecast',
    'financialExplanation.descriptions.weekly',
    'financialExplanation.descriptions.recurrence',
    'financialExplanation.descriptions.historicalPeriod',
  ]) assert.match(combined, new RegExp(token.replaceAll('.', '\\.')));
});
