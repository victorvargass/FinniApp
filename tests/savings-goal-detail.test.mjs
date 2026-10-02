import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const detail = readFileSync(new URL('../app/modal/savings-goal-detail.tsx', import.meta.url), 'utf8');
const form = readFileSync(new URL('../app/modal/savings-goal-form.tsx', import.meta.url), 'utf8');
const goals = readFileSync(new URL('../app/modal/savings-goals.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../app/(tabs)/home.tsx', import.meta.url), 'utf8');
const search = readFileSync(new URL('../app/modal/global-search.tsx', import.meta.url), 'utf8');

test('goal entry points open the read-only detail instead of the configuration form', () => {
  assert.match(goals, /pathname: '\/modal\/savings-goal-detail'/);
  assert.match(home, /pathname: '\/modal\/savings-goal-detail'/);
  assert.match(search, /'savings-goal': '\/modal\/savings-goal-detail'/);
});

test('goal detail owns progress and movements with every action in its header overflow menu', () => {
  assert.match(detail, /<SavingsGoalProgress/);
  assert.match(detail, /<SavingsProgressChart/);
  assert.match(detail, /buildSavingsProgressSeries/);
  assert.match(detail, /t\('savings\.movements'\)/);
  assert.match(detail, /t\('savings\.editConfiguration'\)/);
  assert.match(detail, /label: t\('savings\.enterContribution'\)/);
  assert.match(detail, /pathname: '\/modal\/savings-goal-form'/);
  assert.match(detail, /<Stack\.Screen options=\{\{/);
  assert.match(detail, /headerRight: \(\) => \(/);
  assert.match(detail, /<OverflowMenu/);
  assert.doesNotMatch(detail, /styles\.editButton|styles\.secondaryButton|styles\.actions/);
  assert.doesNotMatch(form, /<SavingsGoalProgress|t\('savings\.movements'\)/);
});
