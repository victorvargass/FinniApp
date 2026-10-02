import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/modal/payment-methods.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../app/(tabs)/home.tsx', import.meta.url), 'utf8');

test('payment method rows do not repeat the type already shown by their section', () => {
  assert.match(source, /item\.type === 'cash' \|\| item\.type === 'debit'/);
  assert.doesNotMatch(source, /typeLabels\[item\.type\]/);
  assert.doesNotMatch(source, /paymentMethods\.approximateBilling/);
  assert.match(source, /compactAccount && styles\.compactCard/);
  assert.match(source, /compactAccount && styles\.compactBalance/);
});

test('credit rows prioritize available limits and the billed amount pending', () => {
  assert.match(source, /paymentMethods\.availableCredits/);
  assert.match(source, /item\.usdCreditLimitCents != null/);
  assert.match(source, /paymentMethods\.pendingBilled/);
  assert.match(source, /formatCLP\(item\.billedAmount\)/);
});

test('compact rows keep separate actions at a touch-friendly size', () => {
  assert.match(source, /chevron: \{ minWidth: 44, minHeight: 44/);
  assert.match(source, /star: \{ width: 44, height: 44/);
});

test('credit details opens payment methods with the credit section selected', () => {
  assert.match(home, /section === 'credit'[\s\S]*?pathname: '\/modal\/payment-methods'[\s\S]*?section: 'credit'/);
  assert.match(source, /useLocalSearchParams<\{ section\?: string \}>\(\)/);
  assert.match(source, /requestedSection \?\? 'accounts'/);
  assert.match(source, /setMethodSection\(requestedSection\)/);
});
