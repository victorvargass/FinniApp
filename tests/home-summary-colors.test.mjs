import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const summary = readFileSync(new URL('../components/home-summary-cards.tsx', import.meta.url), 'utf8');

test('period summary amounts use semantic colors', () => {
  assert.match(summary, /metric === 'income'[\s\S]*periodColors\.positive/);
  assert.match(summary, /metric === 'expenses'[\s\S]*periodColors\.negative/);
  assert.match(summary, /metric === 'unbilledCredit'[\s\S]*periodColors\.credit/);
  assert.match(summary, /periodValues\[metric\] < 0[\s\S]*periodColors\.negative[\s\S]*periodColors\.positive/);
});

test('dark mode defines colors with contrast against its primary card', () => {
  assert.match(summary, /scheme === 'dark'[\s\S]*positive: '#087052'[\s\S]*negative: '#8F2632'[\s\S]*credit: '#704500'/);
});
