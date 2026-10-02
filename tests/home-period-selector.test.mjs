import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../app/(tabs)/home.tsx', import.meta.url), 'utf8');
const selector = readFileSync(new URL('../components/period-selector.tsx', import.meta.url), 'utf8');

test('Home keeps the period range only in the selector', () => {
  assert.match(home, /<PeriodSelector onEditDates=/);
  assert.doesNotMatch(home, /styles\.dateRangeContainer|styles\.dateContainer|styles\.dateButton/);
});

test('the current period dates remain editable from the selector', () => {
  assert.match(selector, /onEditDates\?: \(\) => void/);
  assert.match(selector, /accessibilityLabel=\{onEditDates \? t\('period\.editDates'\)/);
  assert.match(home, /Alert\.alert\(t\('home\.periodDetails'\), t\('period\.editDatesHint'\), actions\)/);
});

test('the close-period action stays directly below the period selector', () => {
  const selectorIndex = home.indexOf('<PeriodSelector onEditDates=');
  const closeIndex = home.indexOf('testID="period-close"');
  const summaryIndex = home.indexOf('<HomeSummaryCards');
  assert.ok(selectorIndex >= 0 && selectorIndex < closeIndex);
  assert.ok(closeIndex < summaryIndex);
  assert.equal(home.match(/testID="period-close"/g)?.length, 1);
});
