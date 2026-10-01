import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTOMATIC_BACKUP_INTERVALS,
  AUTOMATIC_BACKUP_INTERVAL_MS,
  isAutomaticBackupDue,
  migrationSnapshotTimestamp,
  selectObsoleteBackups,
} from '../lib/backup-policy.ts';

test('automatic backup runs at most once per 24 hours', () => {
  const now = Date.UTC(2026, 8, 29, 12);
  assert.equal(isAutomaticBackupDue(null, now), true);
  assert.equal(isAutomaticBackupDue(String(now - AUTOMATIC_BACKUP_INTERVAL_MS + 1), now), false);
  assert.equal(isAutomaticBackupDue(String(now - AUTOMATIC_BACKUP_INTERVAL_MS), now), true);
  assert.equal(isAutomaticBackupDue('invalid', now), true);
});

test('automatic backup respects daily, weekly, monthly, and manual choices', () => {
  const now = Date.UTC(2026, 9, 1, 12);
  for (const frequency of ['daily', 'weekly', 'monthly']) {
    const interval = AUTOMATIC_BACKUP_INTERVALS[frequency];
    assert.equal(isAutomaticBackupDue(String(now - interval + 1), now, frequency), false);
    assert.equal(isAutomaticBackupDue(String(now - interval), now, frequency), true);
  }
  assert.equal(isAutomaticBackupDue(null, now, 'manual'), false);
});

test('Drive retention removes only versions beyond the newest five', () => {
  const backups = Array.from({ length: 7 }, (_, index) => ({
    id: String(index), modifiedTime: `2026-09-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
  }));
  assert.deepEqual(selectObsoleteBackups(backups).map((item) => item.id), ['1', '0']);
});

test('migration snapshots sort by their timestamp across schema versions', () => {
  assert.equal(migrationSnapshotTimestamp('pre-migration-v28-1790672400000.db'), 1790672400000);
  assert.equal(migrationSnapshotTimestamp('unknown.db'), 0);
});
