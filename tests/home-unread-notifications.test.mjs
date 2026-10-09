import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const home = readFileSync(new URL('../app/(tabs)/home.tsx', import.meta.url), 'utf8');

test('unread inbox notifications return to Home attention and its counter', () => {
  assert.match(home, /usePreferenceDatabase/);
  assert.match(home, /appNotifications\.filter\(\(notification\) => !notification\.isRead\)/);
  assert.match(home, /key: `app-notification-\$\{notification\.id\}`/);
  assert.match(home, /title: notification\.title/);
  assert.match(home, /body: notification\.body/);
  assert.match(home, /notificationCount=\{unreadAppNotifications\.length\}/);
  assert.match(home, /setAppNotificationRead\(notification\.id, true\)/);
});
