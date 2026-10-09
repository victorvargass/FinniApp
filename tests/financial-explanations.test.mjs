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
  assert.match(modal, /line\.operator \?\? '\+'/);
  assert.match(modal, /maxHeight: 300/);
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

test('Home avoids repetitive explanation buttons inside detailed sections', () => {
  const home = source('app/(tabs)/home.tsx');
  const balances = source('components/home-payment-balances-card.tsx');
  const goals = source('components/SavingsGoalsPeriodCard.tsx');
  const summary = source('components/home-summary-cards.tsx');
  const breakdownInvocation = home.match(/<BreakdownSection[\s\S]*?\/>/)?.[0] ?? '';

  assert.doesNotMatch(balances, /FinancialInfoButton/);
  assert.doesNotMatch(goals, /FinancialInfoButton/);
  assert.doesNotMatch(breakdownInvocation, /onExplain=/);
  assert.match(summary, /metric === 'income'[\s\S]*?undefined/);
});

test('compact calculation affordances remain on useful aggregate contexts', () => {
  const paths = [
    'app/(tabs)/home.tsx',
    'components/home-summary-cards.tsx',
    'components/LimitProgressBar.tsx',
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
    'financialExplanation.descriptions.budget',
    'financialExplanation.descriptions.debtBalance',
    'financialExplanation.descriptions.contactDebt',
    'financialExplanation.descriptions.forecast',
    'financialExplanation.descriptions.weekly',
    'financialExplanation.descriptions.recurrence',
    'financialExplanation.descriptions.historicalPeriod',
  ]) assert.match(combined, new RegExp(token.replaceAll('.', '\\.')));
});

test('Home groups expense explanations by payment method and itemizes unbilled cards', () => {
  const home = source('app/(tabs)/home.tsx');
  assert.match(home, /totalsByPaymentMethod/);
  assert.match(home, /expense\.paymentMethodName/);
  assert.match(home, /unbilledCreditCardBreakdown\.map/);
});
