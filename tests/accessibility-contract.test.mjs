import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('shared selectors expose their state and option semantics', () => {
  for (const path of ['components/simple-select.tsx', 'components/forms/shared.tsx']) {
    const contents = source(path);
    assert.match(contents, /accessibilityState=\{\{ disabled, expanded: visible \}\}/);
    assert.match(contents, /accessibilityRole="radio"/);
    assert.match(contents, /accessibilityState=\{\{ selected:/);
    assert.match(contents, /accessibilityViewIsModal/);
  }
});

test('period navigation announces unavailable controls', () => {
  const contents = source('components/period-selector.tsx');
  assert.match(contents, /accessibilityState=\{\{ disabled: !previousPeriod \}\}/);
  assert.match(contents, /accessibilityState=\{\{ disabled: !nextPeriod \}\}/);
});

test('interactive chart legends announce values and selection', () => {
  for (const path of ['components/CategoryChart.tsx', 'components/PaymentMethodChart.tsx']) {
    const contents = source(path);
    assert.match(contents, /accessibilityLabel=\{`\$\{item\.text\}: \$\{formatCLP\(item\.value\)\}`\}/);
    assert.match(contents, /accessibilityState=\{\{ selected:/);
    assert.match(contents, /minHeight: 44/);
  }
});

test('shared account movement controls expose actionable semantics', () => {
  const contents = source('components/account-movement-list.tsx');
  const filterContents = source('components/movement-filter-sheet.tsx');
  assert.match(contents, /MovementFilterOption/);
  assert.match(filterContents, /accessibilityRole=\{isMultiple \? 'checkbox' : 'radio'\}/);
  assert.match(filterContents, /checked: selected/);
  assert.match(filterContents, /selected/);
  assert.match(contents, /accessibilityLabel=\{`\$\{movement\.title\}/);
  assert.match(filterContents, /option: \{\s*minHeight: 49/);
  assert.match(contents, /movement: \{ minHeight: 64/);
});
