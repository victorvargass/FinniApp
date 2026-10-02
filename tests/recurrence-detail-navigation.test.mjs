import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const list = readFileSync(new URL('../app/modal/recurring-expenses.tsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../app/modal/recurrence-detail.tsx', import.meta.url), 'utf8');
const expenseForm = readFileSync(new URL('../app/modal/recurring-expense-form.tsx', import.meta.url), 'utf8');
const incomeForm = readFileSync(new URL('../app/modal/recurring-income-form.tsx', import.meta.url), 'utf8');

test('recurrence rows open read-only details and use compact trash actions', () => {
  assert.match(list, /pathname: '\/modal\/recurrence-detail'/);
  assert.match(list, /kind: 'income'/);
  assert.match(list, /kind: 'expense'/);
  assert.equal((list.match(/name="trash-outline"/g) ?? []).length, 2);
  assert.doesNotMatch(list, /styles\.removeLink/);
});

test('recurrence detail centralizes edit, activation and confirmed deletion', () => {
  assert.match(detail, /name="ellipsis-vertical"/);
  assert.match(detail, /text: t\('common\.edit'\)/);
  assert.match(detail, /recurrence\.deactivate/);
  assert.match(detail, /confirmDelete/);
  assert.match(detail, /text: t\('common\.delete'\)/);
  assert.doesNotMatch(expenseForm, /confirmRemove/);
  assert.doesNotMatch(expenseForm, /removeRecurringExpense/);
  assert.doesNotMatch(incomeForm, /removeRecurringIncome/);
});
