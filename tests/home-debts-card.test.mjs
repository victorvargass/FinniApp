import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const card = readFileSync(new URL('../components/home-debts-card.tsx', import.meta.url), 'utf8');

test('credit card rows place the billed amount below used credit without a due date', () => {
  assert.match(card, /amount=\{card\.usedAmount \?\? 0\}[\s\S]*amountDetail=\{`\$\{t\('paymentMethods\.billedToPay'\)\}: \$\{formatCLP\(card\.billedAmount\)\}`\}/);
  assert.match(card, /detail=\{t\('paymentMethods\.credit'\)\}/);
  assert.doesNotMatch(card, /getCardDueDate|homeCardEstimatedDue|homeCardDue/);
});
