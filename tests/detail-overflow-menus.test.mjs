import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const debt = readFileSync(new URL('../app/modal/manual-debt-detail.tsx', import.meta.url), 'utf8');
const paymentMethod = readFileSync(new URL('../app/modal/payment-method-detail.tsx', import.meta.url), 'utf8');
const overflowMenu = readFileSync(new URL('../components/overflow-menu.tsx', import.meta.url), 'utf8');

test('debt detail groups operational and management actions in its header overflow menu', () => {
  assert.match(debt, /<Stack\.Screen options=\{\{/);
  assert.match(debt, /headerRight: \(\) => \(/);
  assert.match(debt, /<OverflowMenu/);
  assert.match(debt, /label: t\(debt\.direction === 'receivable' \? 'debts\.registerCollection' : 'debts\.registerPayment'\)/);
  assert.match(debt, /label: t\('debts\.updateBalance'\)/);
  assert.match(debt, /t\('debts\.editConfiguration'\)/);
  assert.match(debt, /onPress: toggleArchive/);
  assert.match(debt, /onPress: deleteDebt/);
  assert.doesNotMatch(debt, /styles\.management|styles\.danger|styles\.actions|styles\.secondaryButton/);
});

test('payment method detail moves secondary configuration actions to an overflow menu', () => {
  assert.match(paymentMethod, /<Stack\.Screen options=\{\{/);
  assert.match(paymentMethod, /headerRight: \(\) => \(/);
  assert.match(paymentMethod, /<OverflowMenu/);
  assert.match(paymentMethod, /t\('paymentMethods\.installmentPurchases'\)/);
  assert.match(paymentMethod, /t\('paymentMethods\.cycles'\)/);
  assert.match(paymentMethod, /t\('paymentMethods\.editSettings'\)/);
  assert.doesNotMatch(paymentMethod, /showMoreOptions|styles\.secondaryActions/);
});

test('overflow actions expand below their trigger instead of using a centered alert', () => {
  assert.match(overflowMenu, /measureInWindow/);
  assert.match(overflowMenu, /top: \(anchor\?\.y \?\? 0\) \+ \(anchor\?\.height \?\? 0\) \+ 4/);
  assert.match(overflowMenu, /accessibilityRole=\{isSwitch \? 'switch' : 'menuitem'\}/);
  assert.match(overflowMenu, /name="ellipsis-vertical"/);
});

test('payment method movement expansion is compact and stays beside the section title', () => {
  assert.match(paymentMethod, /styles\.sectionTitleRow/);
  assert.match(paymentMethod, /testID="payment-method-view-all-movements"/);
  assert.match(paymentMethod, /viewMoreButton: \{ minHeight: 36/);
  assert.doesNotMatch(paymentMethod, /viewMoreButton: \{[^\n]*borderWidth/);

  const sectionTitle = paymentMethod.indexOf("t('paymentMethods.recentMovements')");
  const compactAction = paymentMethod.indexOf('testID="payment-method-view-all-movements"');
  const movementState = paymentMethod.indexOf('{loadingMovements ?');
  assert.ok(sectionTitle < compactAction && compactAction < movementState);
});
