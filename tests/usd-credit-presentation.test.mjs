import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const expenseForm = readFileSync(new URL('../components/forms/expense-form.tsx', import.meta.url), 'utf8');
const paymentMethodDetail = readFileSync(new URL('../app/modal/payment-method-detail.tsx', import.meta.url), 'utf8');
const paymentMethods = readFileSync(new URL('../app/modal/payment-methods.tsx', import.meta.url), 'utf8');
const homeBalances = readFileSync(new URL('../components/home-payment-balances-card.tsx', import.meta.url), 'utf8');
const homeSummary = readFileSync(new URL('../components/home-summary-cards.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../app/(tabs)/home.tsx', import.meta.url), 'utf8');
const es = readFileSync(new URL('../locales/es.ts', import.meta.url), 'utf8');

test('expense amount label follows the selected movement currency', () => {
  assert.match(expenseForm, /const totalAmountLabel = t\('expenses\.amountTotal', \{ currency \}\)/);
  assert.match(expenseForm, /accessibilityLabel=\{totalAmountLabel\}/);
  assert.match(es, /amountTotal: 'Monto total \(%\{currency\}\)'/);
});

test('credit detail keeps CLP and USD available limits together in the main card', () => {
  assert.match(paymentMethodDetail, /styles\.accountCard[\s\S]*paymentMethods\.availableCredits[\s\S]*styles\.currencyGrid/);
  assert.match(paymentMethodDetail, />CLP<[\s\S]*formatCLP\(method\.availableBalance\)/);
  assert.match(paymentMethodDetail, />USD<[\s\S]*formatMoney\(method\.usdAvailableCreditCents \?\? 0, 'USD'\)/);
  assert.match(paymentMethodDetail, /adjustsFontSizeToFit[\s\S]*minimumFontScale=\{0\.72\}/);
});

test('payment method list groups available credit by currency', () => {
  assert.match(paymentMethods, /paymentMethods\.availableCredits/);
  assert.match(paymentMethods, /`CLP \$\{formatCLP\(item\.availableBalance\)\}`/);
  assert.match(paymentMethods, /USD \{formatMoney\(item\.usdAvailableCreditCents \?\? 0, 'USD'\)\}/);
});

test('Home presents available and total CLP and USD credit', () => {
  assert.match(homeBalances, /paymentMethods\.availableCredits[\s\S]*CLP [\s\S]*USD [\s\S]*paymentMethods\.totalCredits[\s\S]*CLP [\s\S]*USD /);
  assert.match(home, /creditTotals=\{\{[\s\S]*limitClp: creditLimitTotal[\s\S]*availableUsdCents: usdAvailableCreditTotalCents[\s\S]*limitUsdCents: usdCreditLimitTotalCents/);
  assert.match(homeSummary, /home\.globalMetricCreditLimits[\s\S]*creditTotals\.limitClp[\s\S]*creditTotals\.limitUsdCents/);
});
