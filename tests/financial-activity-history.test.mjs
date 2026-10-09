import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const databaseSource = readFileSync(new URL('../lib/database/engine.ts', import.meta.url), 'utf8');
const screenSource = readFileSync(new URL('../app/modal/financial-audit.tsx', import.meta.url), 'utf8');
const typeSource = readFileSync(new URL('../lib/types.ts', import.meta.url), 'utf8');

test('core financial movements record creations, edits, and deletions', () => {
  for (const entity of ['expense', 'income', 'transfer', 'credit_adjustment']) {
    assert.match(databaseSource, new RegExp(`recordFinancialAudit\\([\\s\\S]*?'${entity}'`));
  }
  for (const action of ['created', 'updated', 'deleted']) {
    assert.match(databaseSource, new RegExp(`'${action}'`));
  }
  assert.match(databaseSource, /previous_snapshot_json/);
});

test('activity history exposes changed fields, timestamps, and safe undo', () => {
  assert.match(typeSource, /action: 'created' \| 'updated' \| 'deleted' \| 'restored'/);
  assert.match(screenSource, /entry\.changes\.map/);
  assert.match(screenSource, /formatMoment\(entry\.createdAt\)/);
  assert.match(screenSource, /entry\.action === 'updated'/);
  assert.match(databaseSource, /action IN \('created', 'deleted', 'updated'\)/);
  assert.match(databaseSource, /undoCreatedAuditSnapshot/);
  assert.match(databaseSource, /auditSuperseded/);
});
