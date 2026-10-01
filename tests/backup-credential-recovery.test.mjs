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

test('an existing encrypted Drive backup never enters password creation mode', () => {
  assert.match(screen, /backupRequiresPassphrase\s*=\s*Boolean\(lastBackup\?\.name\.endsWith\('\.finni'\)\)/);
  assert.match(screen, /needsExistingPassphrase[\s\S]*backupEncryptionExisting/);
  assert.match(screen, /!needsExistingPassphrase\s*&&\s*\([\s\S]*backup-passphrase-confirmation/);
  assert.match(screen, /needsExistingPassphrase\) confirmRestore\(passphrase\)/);
});

test('a recovered password is stored only after a successful restore', () => {
  const restoreCall = hook.indexOf('metrics = await RestoreService.restore');
  const credentialWrite = hook.indexOf('BackupCredentialService.setPassphrase(accountId, providedPassphrase)');
  assert.ok(restoreCall >= 0);
  assert.ok(credentialWrite > restoreCall);
  assert.match(hook, /invalidBackupPassphrase[\s\S]*BackupCredentialService\.clear\(\)/);
});

test('sign-in offers the discovered backup immediately', () => {
  assert.match(screen, /backupFoundTitle[\s\S]*backupFoundPasswordRequired/);
  assert.match(screen, /backupFoundTitle[\s\S]*backupFoundReady[\s\S]*restoreNow/);
});
