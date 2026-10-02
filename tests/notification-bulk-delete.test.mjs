import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../app/modal/recurring-confirmations.tsx', import.meta.url), 'utf8');
const database = readFileSync(new URL('../lib/database/notifications.ts', import.meta.url), 'utf8');
const preferenceActions = readFileSync(new URL('../contexts/database/usePreferenceActions.ts', import.meta.url), 'utf8');

test('notifications expose delete all from an overflow menu with confirmation', () => {
  assert.match(screen, /<OverflowMenu/);
  assert.match(screen, /t\('notifications\.deleteAll'\)/);
  assert.match(screen, /t\('notifications\.deleteAllTitle'\)/);
  assert.match(screen, /deleteAppNotifications\(appNotifications\.map\(\(item\) => item\.id\)\)/);
});

test('bulk notification deletion soft-deletes only the visible notification ids', () => {
  assert.match(database, /export async function deleteAppNotifications\(ids: number\[\]\)/);
  assert.match(database, /WHERE id IN \(\$\{placeholders\}\) AND deleted_at IS NULL/);
  assert.match(preferenceActions, /await db\.deleteAppNotifications\(ids\)[\s\S]*?await reloadNotifications\(\)/);
});
