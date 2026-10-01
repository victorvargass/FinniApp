import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../services/PeriodCsvService.ts', import.meta.url), 'utf8');
const database = readFileSync(new URL('../lib/database/engine.ts', import.meta.url), 'utf8');

test('Android CSV export is UTF-8 and advertises an Excel-compatible attachment', () => {
  assert.match(source, /file\.write\(csv\)/);
  assert.match(source, /application\/vnd\.ms-excel/);
  assert.match(source, /Sharing\.shareAsync\(file\.uri/);
});

test('period statement supplies every movement field needed by the CSV', () => {
  const statementQuery = database.slice(
    database.indexOf('export async function getPeriodStatement'),
    database.indexOf('export async function getPeriodFinancialDetails')
  );
  assert.match(statementQuery, /e\.time/);
  assert.match(statementQuery, /income\.time/);
  assert.match(statementQuery, /incomeCategory\.name AS categoryName/);
  assert.match(statementQuery, /paymentMethod\.name AS paymentMethodName/);
});
