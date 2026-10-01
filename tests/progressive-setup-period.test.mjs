import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const home = readFileSync(
  new URL('../app/(tabs)/home.tsx', import.meta.url),
  'utf8'
);

test('a second period completes the otherwise locked initial-date setup step', () => {
  assert.match(home, /periodHistory\.length > 1/);
  assert.match(home, /setHasConfiguredPeriod\(true\)/);
  assert.match(home, /markFirstPeriodConfigured\(\)/);
  assert.match(home, /\[periodHistory\.length\]/);
});
