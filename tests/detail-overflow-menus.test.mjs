import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const debt = readFileSync(new URL('../app/modal/manual-debt-detail.tsx', import.meta.url), 'utf8');
const paymentMethod = readFileSync(new URL('../app/modal/payment-method-detail.tsx', import.meta.url), 'utf8');
const overflowMenu = readFileSync(new URL('../components/overflow-menu.tsx', import.meta.url), 'utf8');
const overflowScreens = [
  '../app/(tabs)/home.tsx',
  '../app/modal/contact-detail.tsx',
  '../app/modal/debts.tsx',
  '../app/modal/manual-debt-detail.tsx',
  '../app/modal/movement-detail.tsx',
  '../app/modal/payment-method-detail.tsx',
  '../app/modal/recurrence-detail.tsx',
  '../app/modal/recurring-confirmations.tsx',
  '../app/modal/savings-goal-detail.tsx',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));

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

test('payment method detail moves operational and configuration actions to an overflow menu', () => {
  assert.match(paymentMethod, /<Stack\.Screen options=\{\{/);
  assert.match(paymentMethod, /headerRight: \(\) => \(/);
  assert.match(paymentMethod, /<OverflowMenu/);
  assert.match(paymentMethod, /label: t\('paymentMethods\.updateBalance'\)/);
  assert.match(paymentMethod, /label: t\('paymentMethods\.payCard'\)/);
  assert.match(paymentMethod, /label: t\('paymentMethods\.payBilledAmount'\)/);
  assert.match(paymentMethod, /initialAmount: String\(method\.billedAmount\)/);
  assert.match(paymentMethod, /initialName: t\('paymentMethods\.billedPaymentName'/);
  assert.match(paymentMethod, /label: t\('transfers\.action'\)/);
  assert.match(paymentMethod, /t\('paymentMethods\.installmentPurchases'\)/);
  assert.match(paymentMethod, /t\('paymentMethods\.cycles'\)/);
  assert.match(paymentMethod, /t\('paymentMethods\.editSettings'\)/);
  assert.doesNotMatch(paymentMethod, /showMoreOptions|styles\.secondaryActions|styles\.actions|styles\.actionText/);
});

test('overflow actions expand below their trigger instead of using a centered alert', () => {
  assert.match(overflowMenu, /measureInWindow/);
  assert.match(overflowMenu, /const menuTop = Math\.max\(/);
  assert.match(overflowMenu, /insets\.top \+ 56 \+ 4/);
  assert.match(overflowMenu, /top: menuTop/);
  assert.match(overflowMenu, /accessibilityRole=\{isSwitch \? 'switch' : 'menuitem'\}/);
  assert.match(overflowMenu, /name="ellipsis-vertical"/);
});

test('overflow menus close from the backdrop without redundant cancel rows', () => {
  assert.match(overflowMenu, /onPress=\{close\} style=\{styles\.overlay\}/);
  for (const screen of overflowScreens) {
    assert.doesNotMatch(screen, /label:\s*t\('common\.cancel'\)/);
  }
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
