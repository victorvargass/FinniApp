import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const card = readFileSync(new URL('../components/home-debts-card.tsx', import.meta.url), 'utf8');

test('credit cards remain visible using billed debt when used credit is unknown', () => {
  assert.match(card, /getCreditCardDebtAmount\(item\) > 0/);
  assert.match(card, /amount=\{getCreditCardDebtAmount\(card\)\}/);
  assert.match(card, /card\.usedAmount == null \? 'paymentMethods\.billedToPay' : 'paymentMethods\.credit'/);
  assert.match(card, /total=\{card\.usedAmount == null \? null : card\.creditLimit\}/);
  assert.doesNotMatch(card, /getCardDueDate|homeCardEstimatedDue|homeCardDue/);
});

test('credit card bars show used credit instead of the inverse paid-debt progress', () => {
  assert.match(card, /progressMode\?: 'paid' \| 'used'/);
  assert.match(card, /progressMode === 'used' \? amount \/ total : 1 - amount \/ total/);
  assert.match(card, /progressMode="used"/);
});
