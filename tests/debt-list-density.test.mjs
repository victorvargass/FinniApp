import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const screen = readFileSync(new URL('../app/modal/debts.tsx', import.meta.url), 'utf8');

test('active debt rows omit redundant status and grouped contact name', () => {
  assert.match(screen, /debt\.status !== 'active'/);
  assert.match(screen, /group\.debts\.map\(\(debt\) => renderDebt\(debt, true\)\)/);
  assert.match(screen, /!hideContactName &&/);
});
