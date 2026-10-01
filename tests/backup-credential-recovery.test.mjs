import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../app/modal/google-drive.tsx', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../hooks/useGoogle.ts', import.meta.url), 'utf8');
const biometric = readFileSync(
  new URL('../contexts/BiometricContext.tsx', import.meta.url),
  'utf8'
);

test('the locally stored backup password can be recovered only after device authentication', () => {
  assert.match(hook, /revealBackupPassphrase[\s\S]*BackupCredentialService\.getPassphrase\(accountId\)/);
  assert.match(screen, /biometric\.authenticate\([\s\S]*revealBackupPassphrase\(\)/);
  assert.match(screen, /!biometric\.isAvailable/);
  assert.match(biometric, /biometricsSecurityLevel:\s*'strong'/);
});

test('a revealed backup password is short-lived and hidden outside the active app', () => {
  assert.match(screen, /setTimeout\(\(\) => setRevealedPassphrase\(null\), 30_000\)/);
  assert.match(screen, /nextState !== 'active'[\s\S]*setRevealedPassphrase\(null\)/);
  assert.match(screen, /<ThemedText selectable[\s\S]*\{revealedPassphrase\}/);
});
