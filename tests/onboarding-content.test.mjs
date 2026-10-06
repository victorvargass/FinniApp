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

test('onboarding informs about optional permissions without requesting them', () => {
  assert.doesNotMatch(screen, /requestPermissionsAsync|openNotificationAccessSettings|authenticateAsync|signIn/);
  assert.match(screen, /onboarding\.optionalPermissions/);
  assert.match(screen, /onboarding\.permissionControl/);
});
