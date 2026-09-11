import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPeriodCloseInsights } from '../lib/period-close-insights.ts';

test('period close insight reports surplus, lower spending and top category', () => {
  const insight = buildPeriodCloseInsights(
    250_000,
    750_000,
    [
      { categoryName: 'Alimentación', total: 300_000 },
      { categoryName: 'Transporte', total: 120_000 },
    ],
    1_000_000
  );

  assert.equal(insight.balanceStatus, 'positive');
  assert.equal(insight.comparisonStatus, 'less');
  assert.equal(insight.comparisonPercent, 25);
  assert.equal(insight.topCategoryName, 'Alimentación');
  assert.equal(insight.topCategoryAmount, 300_000);
});

test('period close insight handles a first period with income only', () => {
  const insight = buildPeriodCloseInsights(500_000, 0, [], null);

  assert.equal(insight.balanceStatus, 'positive');
  assert.equal(insight.comparisonStatus, 'first');
  assert.equal(insight.topCategoryName, null);
});
