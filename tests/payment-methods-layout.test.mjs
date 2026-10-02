import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/modal/payment-methods.tsx', import.meta.url), 'utf8');

test('cash and debit use compact rows without repeating their section type', () => {
  assert.match(source, /item\.type === 'cash' \|\| item\.type === 'debit'/);
  assert.match(source, /!compactAccount && \([\s\S]*typeLabels\[item\.type\]/);
  assert.match(source, /compactAccount && styles\.compactCard/);
  assert.match(source, /compactAccount && styles\.compactBalance/);
});

test('compact rows keep separate actions at a touch-friendly size', () => {
  assert.match(source, /chevron: \{ minWidth: 44, minHeight: 44/);
  assert.match(source, /star: \{ width: 44, height: 44/);
});
