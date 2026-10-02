import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const expenses = readFileSync(new URL('../app/(tabs)/expenses.tsx', import.meta.url), 'utf8');
const incomes = readFileSync(new URL('../app/(tabs)/incomes.tsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../app/modal/movement-detail.tsx', import.meta.url), 'utf8');
const expenseForm = readFileSync(new URL('../components/forms/expense-form.tsx', import.meta.url), 'utf8');

test('ordinary movement rows open read-only details and retain direct confirmed deletion', () => {
  assert.match(expenses, /pathname: '\/modal\/movement-detail'/);
  assert.match(expenses, /kind: 'expense'/);
  assert.match(expenses, /name="trash-outline"/);
  assert.match(incomes, /pathname: '\/modal\/movement-detail'/);
  assert.match(incomes, /kind: 'income'/);
  assert.match(incomes, /name="trash-outline"/);
  assert.doesNotMatch(expenses, /const handleActions/);
  assert.doesNotMatch(incomes, /const handleActions/);
});

test('movement detail keeps edit, duplicate and confirmed delete in its overflow menu', () => {
  assert.match(detail, /<OverflowMenu/);
  assert.match(detail, /label: t\('common\.edit'\)/);
  assert.match(detail, /label: t\('common\.repeat'\)/);
  assert.match(detail, /label: t\('common\.delete'\)/);
  assert.match(detail, /confirmDelete/);
  assert.match(detail, /expenses\.deleteQuestion/);
  assert.match(detail, /incomes\.deleteQuestion/);
});

test('expense management actions live in the read-only detail instead of the edit form', () => {
  assert.doesNotMatch(expenseForm, /confirmDeleteExpense/);
  assert.doesNotMatch(expenseForm, /recurringExpenseActions/);
  assert.match(detail, /canManageRecurrence/);
  assert.match(detail, /pathname: '\/modal\/recurring-expense-form'/);
  assert.match(detail, /'expenses\.makeRecurring'/);
});
