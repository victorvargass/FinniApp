import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../app/(tabs)/home.tsx', import.meta.url), 'utf8');
const selector = readFileSync(new URL('../components/period-selector.tsx', import.meta.url), 'utf8');

test('Home keeps the period range only in the selector', () => {
  assert.match(home, /<PeriodSelector[\s\S]*?actions=\{isCurrentPeriod/);
  assert.doesNotMatch(home, /styles\.dateRangeContainer|styles\.dateContainer|styles\.dateButton/);
});

test('the current period opens its actions from an ellipsis menu', () => {
  assert.match(selector, /actions\?: OverflowMenuAction\[\]/);
  assert.match(selector, /<OverflowMenu/);
  assert.match(selector, /accessibilityLabel=\{t\('period\.manage'\)\}/);
  assert.doesNotMatch(selector, /name="pencil-outline"/);
  assert.match(home, /label: t\('period\.editDates'\)[\s\S]*?onPress: openPeriodDateEditor/);
  assert.match(home, /Alert\.alert\(t\('home\.periodDetails'\), t\('period\.editDatesHint'\), actions\)/);
});

test('closing the period is a destructive menu action instead of a large Home button', () => {
  assert.match(home, /hasPeriodMovements \? \[\{[\s\S]*?t\('period\.close'\)[\s\S]*?destructive: true/);
  assert.match(home, /onPress: confirmClosePeriod/);
  assert.doesNotMatch(home, /testID="period-close"|periodCloseButton|periodCloseContainer/);
});

test('period actions render edit, close and cancel in the requested visual order', () => {
  const edit = home.indexOf("label: t('period.editDates')");
  const close = home.indexOf("label: t('period.close')", edit);
  const cancel = home.indexOf("label: t('common.cancel')", close);

  assert.ok(edit >= 0 && edit < close && close < cancel);
  assert.doesNotMatch(home, /Alert\.alert\(\s*t\('period\.manage'/);
});
