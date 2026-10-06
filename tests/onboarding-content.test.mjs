import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../app/onboarding.tsx', import.meta.url), 'utf8');
const es = readFileSync(new URL('../locales/es.ts', import.meta.url), 'utf8');

test('first-run onboarding explains automation and privacy before the financial overview', () => {
  const automation = screen.indexOf("title: 'onboarding.automationTitle'");
  const privacy = screen.indexOf("title: 'onboarding.privacyTitle'");
  const overview = screen.indexOf("title: 'onboarding.understandTitle'");

  assert.ok(automation >= 0 && automation < privacy && privacy < overview);
  assert.match(es, /automationBody: 'En Android,[^']+Google Wallet[^']+siempre revisas/);
  assert.match(es, /privacyBody: '[^']+cifrada[^']+opcionales[^']+autorización/);
});

test('onboarding requests notifications only from an explicit activation control', () => {
  assert.doesNotMatch(screen, /requestPermissionsAsync|openNotificationAccessSettings|authenticateAsync|signIn/);
  assert.match(screen, /setPushNotificationsEnabled\(true\)/);
  assert.match(screen, /testID="onboarding-enable-notifications"/);
  assert.match(screen, /onboarding\.enableNotifications/);
  assert.match(screen, /onboarding\.optionalPermissions/);
  assert.match(screen, /onboarding\.permissionControl/);
});

test('onboarding offers Android bank detection after a privacy disclosure', () => {
  assert.match(screen, /testID="onboarding-enable-bank-detection"/);
  assert.match(screen, /pendingMovements\.permissionDescription/);
  assert.match(screen, /openNotificationMovementAccessSettings/);
  assert.match(screen, /AppState\.addEventListener/);
  assert.match(screen, /isNotificationMovementAccessEnabled/);
});
