export const DATABASE_NAME = 'gastos.db';
export const DATABASE_SCHEMA_VERSION = 4;
export const DATABASE_APPLICATION_ID = 0x46494e4e; // "FINN"
export const MAX_BACKUP_SIZE_BYTES = 100 * 1024 * 1024;
export const SQLITE_FILE_HEADER = 'SQLite format 3\u0000';

export function hasValidSQLiteHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  return new TextDecoder().decode(bytes.slice(0, 16)) === SQLITE_FILE_HEADER;
}

export const REQUIRED_BACKUP_TABLES = [
  'settings',
  'periods',
  'categories',
  'expenses',
  'incomes',
] as const;
