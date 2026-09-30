import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../lib/db.ts', import.meta.url), 'utf8');

test('credit card adjustment insert binds one value per declared column', () => {
  const start = source.indexOf('export async function createCreditCardAdjustment');
  const end = source.indexOf('export async function updateCreditCardAdjustment', start);
  const implementation = source.slice(start, end);
  const values = implementation.match(/VALUES \(([^)]+)\)/)?.[1].match(/\?/g) ?? [];
  const argumentBlock = implementation.slice(
    implementation.indexOf('data.paymentMethodId'),
    implementation.indexOf('createdId = result.lastInsertRowId')
  );
  const argumentsPassed = argumentBlock.match(/^\s{6}(?:data\.|resolveEventTime)/gm) ?? [];
  assert.equal(values.length, 6);
  assert.equal(argumentsPassed.length, 6);
  assert.equal((argumentBlock.match(/resolveEventTime\(data\.time\)/g) ?? []).length, 1);
});
