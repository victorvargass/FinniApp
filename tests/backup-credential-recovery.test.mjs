import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../app/modal/google-drive.tsx', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../hooks/useGoogle.ts', import.meta.url), 'utf8');
const backupService = readFileSync(
  new URL('../services/BackupService.ts', import.meta.url),
  'utf8'
);
const automaticBackup = readFileSync(
  new URL('../components/automatic-backup-controller.tsx', import.meta.url),
  'utf8'
);
const restoreService = readFileSync(new URL('../services/RestoreService.ts', import.meta.url), 'utf8');

test('new Drive backups rely on Google access without a FinniApp password', () => {
  assert.doesNotMatch(backupService, /BackupEncryptionService|passphrase/);
  assert.match(backupService, /drive\.uploadDatabase\(file\.uri\)/);
  assert.doesNotMatch(automaticBackup, /BackupCredentialService|getPassphrase/);
  assert.match(automaticBackup, /BackupService\.backup\(drive,\s*\{/);
});

test('the Drive screen does not ask users to create or recover a backup password', () => {
  assert.match(screen, /backupAccessGoogle/);
  assert.doesNotMatch(screen, /testID="backup-passphrase"/);
  assert.doesNotMatch(screen, /forgotBackupPassphrase/);
  assert.match(screen, /disabled=\{isWorking\}[\s\S]*onPress=\{confirmBackup\}/);
});

test('legacy encrypted backups remain restorable only when the old device credential exists', () => {
  assert.match(restoreService, /BackupEncryptionService\.decryptIfNeeded\(file, passphrase\)/);
  assert.match(hook, /BackupCredentialService\.getPassphrase\(accountId\)/);
  assert.match(screen, /isLegacyEncryptedBackup[\s\S]*legacyBackupCanMigrate/);
  assert.match(screen, /canRestoreBackup[\s\S]*legacyBackupUnavailable/);
});

test('sign-in offers a recoverable Google backup immediately', () => {
  assert.match(screen, /backupFoundTitle[\s\S]*backupFoundReady[\s\S]*restoreNow/);
});
