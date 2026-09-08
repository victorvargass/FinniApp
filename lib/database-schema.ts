export const DATABASE_NAME = 'gastos.db';
export const DATABASE_SCHEMA_VERSION = 1;
export const DATABASE_APPLICATION_ID = 0x46494e4e; // "FINN"
export const MAX_BACKUP_SIZE_BYTES = 100 * 1024 * 1024;

export const REQUIRED_BACKUP_TABLES = [
  'settings',
  'periods',
  'categories',
  'expenses',
  'incomes',
] as const;
