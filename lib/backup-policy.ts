export const DRIVE_BACKUP_RETENTION = 5;
export const LOCAL_MIGRATION_BACKUP_RETENTION = 3;
export const AUTOMATIC_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function isAutomaticBackupDue(previous: string | null, now = Date.now()): boolean {
  if (previous == null) return true;
  const timestamp = Number(previous);
  return !Number.isFinite(timestamp) || now - timestamp >= AUTOMATIC_BACKUP_INTERVAL_MS;
}

export function selectObsoleteBackups<T extends { modifiedTime: string }>(
  backups: T[],
  retention = DRIVE_BACKUP_RETENTION
): T[] {
  return [...backups]
    .sort((first, second) => second.modifiedTime.localeCompare(first.modifiedTime))
    .slice(retention);
}

export function migrationSnapshotTimestamp(name: string): number {
  const match = name.match(/-(\d+)\.db$/);
  return match ? Number(match[1]) : 0;
}
