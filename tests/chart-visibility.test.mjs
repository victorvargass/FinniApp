import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

for (const path of ['components/CategoryChart.tsx', 'components/PaymentMethodChart.tsx']) {
  test(`${path} can hide legend items and animate the recalculated chart`, () => {
    const chart = source(path);
    assert.match(chart, /eye-outline/);
    assert.match(chart, /eye-off-outline/);
    assert.match(chart, /accessibilityRole="switch"/);
    assert.match(chart, /accessibilityState=\{\{ checked: visible \}\}/);
    assert.match(chart, /visiblePieData\.reduce/);
    assert.match(chart, /Animated\.timing\(chartAnimation/);
    assert.match(chart, /duration: 260/);
  });
}
