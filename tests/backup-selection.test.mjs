import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../app/modal/google-drive.tsx', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../hooks/useGoogle.ts', import.meta.url), 'utf8');
const drive = readFileSync(new URL('../services/GoogleDriveService.ts', import.meta.url), 'utf8');
const restore = readFileSync(new URL('../services/RestoreService.ts', import.meta.url), 'utf8');

test('restore opens a selector containing the retained Drive backups', () => {
  assert.match(screen, /showBackupPicker[\s\S]*backups\.map\(\(candidate, index\)/);
  assert.match(screen, /latestBackupLabel/);
  assert.match(screen, /confirmRestore\(candidate\)/);
});

test('the selected backup id reaches the Drive download request', () => {
  assert.match(hook, /restore = useCallback\(async \(selectedBackup\?: DriveBackup\)/);
  assert.match(hook, /backup: selectedBackup/);
  assert.match(restore, /drive\.downloadDatabase\(options\.backup\)/);
  assert.match(drive, /selectedBackup \?\? await this\.getLatestBackup\(\)/);
  assert.match(drive, /\$\{DRIVE_API\}\/\$\{backup\.id\}\?alt=media/);
});

test('opening Drive enforces the three-backup retention policy', () => {
  assert.match(hook, /drive\.enforceRetention\(await drive\.listBackups\(\)\)/);
  assert.match(drive, /const obsolete = selectObsoleteBackups\(current\)/);
  assert.match(drive, /obsolete\.map\(\(backup\) => this\.deleteFile\(backup\.id\)\)/);
});

test('legacy backups without a local credential are visible but disabled', () => {
  assert.match(screen, /canRestoreBackup\(candidate\)/);
  assert.match(screen, /disabled=\{!available\}/);
  assert.match(screen, /legacyBackupUnavailableShort/);
});

test('technical operation duration is not exposed in the user interface', () => {
  assert.doesNotMatch(screen, /lastOperationMetrics|lastBackupOperationDuration|lastDuration/);
});
