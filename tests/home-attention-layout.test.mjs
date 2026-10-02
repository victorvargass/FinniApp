import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/home-overview.tsx', import.meta.url), 'utf8');

test('the notifications action is a compact link beside the attention title', () => {
  const titleIndex = source.indexOf("t('home.attention')");
  const actionIndex = source.indexOf("t('home.viewNotificationsShort')");
  const itemsIndex = source.indexOf('items.length === 0');
  assert.ok(titleIndex >= 0 && titleIndex < actionIndex);
  assert.ok(actionIndex < itemsIndex);
  assert.match(source, /accessibilityLabel=\{t\('home\.viewNotifications'\)\}/);
  assert.doesNotMatch(source, /notificationsButton|notificationsButtonLabel/);
});
