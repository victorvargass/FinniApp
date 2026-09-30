import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../services/PeriodCsvService.ts', import.meta.url), 'utf8');

test('Android CSV export is UTF-8 and advertises an Excel-compatible attachment', () => {
  assert.match(source, /\\uFEFF/);
  assert.match(source, /application\/vnd\.ms-excel/);
  assert.match(source, /Sharing\.shareAsync\(file\.uri/);
});
