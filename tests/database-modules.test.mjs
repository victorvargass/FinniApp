import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('notification repository uses its domain database module', () => {
  const repository = readFileSync(new URL('../repositories/notifications.ts', import.meta.url), 'utf8');
  const monolith = readFileSync(new URL('../lib/db.ts', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../lib/database/notifications.ts', import.meta.url), 'utf8');

  assert.match(repository, /@\/lib\/database\/notifications/);
  assert.match(module, /export async function getAppNotifications/);
  assert.match(module, /withExclusiveTransactionAsync/);
  assert.doesNotMatch(monolith, /export async function getAppNotifications/);
});
