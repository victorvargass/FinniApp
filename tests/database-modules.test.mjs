import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('notification repository uses its domain database module', () => {
  const repository = readFileSync(new URL('../repositories/notifications.ts', import.meta.url), 'utf8');
  const monolith = readFileSync(new URL('../lib/db.ts', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../lib/database/notifications.ts', import.meta.url), 'utf8');

  assert.match(repository, /@\/lib\/database\/notifications/);
  assert.match(module, /@\/lib\/database\/connection/);
  assert.doesNotMatch(module, /@\/lib\/db/);
  assert.match(module, /export async function getAppNotifications/);
  assert.match(module, /withExclusiveDatabaseTransaction/);
  assert.doesNotMatch(monolith, /export async function getAppNotifications/);
});

test('settings repository reads preferences through its domain module', () => {
  const repository = readFileSync(new URL('../repositories/settings.ts', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../lib/database/settings.ts', import.meta.url), 'utf8');
  const monolith = readFileSync(new URL('../lib/db.ts', import.meta.url), 'utf8');

  assert.match(repository, /@\/lib\/database\/settings/);
  assert.match(module, /export async function getSettings/);
  assert.doesNotMatch(module, /@\/lib\/db/);
  assert.doesNotMatch(monolith, /export async function getSettings/);
});

test('contacts repository owns contacts and relationship persistence', () => {
  const repository = readFileSync(new URL('../repositories/contacts.ts', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../lib/database/contacts.ts', import.meta.url), 'utf8');
  const monolith = readFileSync(new URL('../lib/db.ts', import.meta.url), 'utf8');

  assert.match(repository, /@\/lib\/database\/contacts/);
  assert.match(module, /export async function saveContact/);
  assert.match(module, /withExclusiveDatabaseTransaction/);
  assert.doesNotMatch(monolith, /export async function saveContact/);
});
