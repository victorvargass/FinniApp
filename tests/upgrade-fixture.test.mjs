import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

test('the Android upgrade fixture is populated and remains at schema v27', () => {
  const output = join(tmpdir(), `finniapp-upgrade-${process.pid}-${Date.now()}.db`);
  try {
    execFileSync(process.execPath, ['scripts/create-upgrade-fixture.mjs', output], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });
    const database = new DatabaseSync(output, { readOnly: true });
    try {
      assert.equal(database.prepare('PRAGMA user_version').get().user_version, 27);
      assert.equal(database.prepare('PRAGMA application_id').get().application_id, 0x46494e4e);
      assert.equal(
        database.prepare("SELECT COUNT(*) AS value FROM pragma_table_info('settings') WHERE name = 'home_preferences'").get().value,
        0
      );
      for (const [table, name] of [
        ['expenses', 'Compra migrada QA'],
        ['incomes', 'Ingreso migrado QA'],
        ['savings_goals', 'Meta migrada QA'],
        ['manual_debts', 'Deuda migrada QA'],
        ['recurring_expenses', 'Recurrencia migrada QA'],
      ]) {
        assert.equal(database.prepare(`SELECT name FROM ${table} LIMIT 1`).get().name, name);
      }
      assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      database.close();
    }
  } finally {
    rmSync(output, { force: true });
  }
});
