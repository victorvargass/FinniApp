import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const form = readFileSync(new URL('../components/forms/expense-form.tsx', import.meta.url), 'utf8');

test('card payment form can fill the current billed amount while preserving partial payments', () => {
  assert.match(form, /isDedicatedCardPaymentFlow/);
  assert.match(form, /targetCreditCard\.billedAmount > 0/);
  assert.match(form, /t\('paymentMethods\.useBilledAmount'\)/);
  assert.match(form, /setAmountText\(formatCLPInput\(targetCreditCard\.billedAmount\)\)/);
  assert.match(form, /onChangeText=\{\(value\) => setAmountText/);
});
