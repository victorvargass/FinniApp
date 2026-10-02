import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const detail = readFileSync(new URL('../app/modal/debt-detail.tsx', import.meta.url), 'utf8');
const overflowMenu = readFileSync(new URL('../components/overflow-menu.tsx', import.meta.url), 'utf8');

test('installment detail keeps home visibility and deletion in its header overflow menu', () => {
  assert.match(detail, /<Stack\.Screen options=\{\{/);
  assert.match(detail, /headerRight: \(\) => \(/);
  assert.match(detail, /<OverflowMenu/);
  assert.match(detail, /label: t\('homeVisibility\.title'\)/);
  assert.match(detail, /switchValue: plan\.showOnHome/);
  assert.match(detail, /label: t\('installments\.deletePurchase'\)/);
  assert.doesNotMatch(detail, /<HomeVisibilityPreference|styles\.deleteSection|styles\.danger/);
});

test('posted installments expose compact chevron navigation without a separate edit row', () => {
  assert.match(detail, /name="chevron-forward"/);
  assert.match(detail, /accessibilityLabel=\{installment\.expenseId != null \? t\('installments\.editInstallment'\)/);
  assert.doesNotMatch(detail, /<ThemedText[^>]*>\{t\('installments\.editInstallment'\)\}/);
});

test('overflow menus support an accessible inline switch that stays open when toggled', () => {
  assert.match(overflowMenu, /accessibilityRole=\{isSwitch \? 'switch' : 'menuitem'\}/);
  assert.match(overflowMenu, /<Switch/);
  assert.match(overflowMenu, /if \(isSwitch\) \{[\s\S]*toggleSwitch\(\);[\s\S]*return;/);
});
