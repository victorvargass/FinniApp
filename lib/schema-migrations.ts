import { DATABASE_APPLICATION_ID, DATABASE_SCHEMA_VERSION } from './database-schema.ts';

type MigrationDatabase = {
  execAsync(source: string): Promise<void>;
};

export const SCHEMA_MIGRATIONS = [
  { version: 1, name: 'baseline-versioned-schema' },
  { version: 2, name: 'payment-method-account-balances' },
  { version: 3, name: 'credit-card-installment-commitments' },
  { version: 4, name: 'payment-method-balance-sync-timestamps' },
  { version: 5, name: 'income-payment-destinations' },
  { version: 6, name: 'reserved-default-cash-account' },
] as const;

export async function recordAppliedSchema(database: MigrationDatabase): Promise<void> {
  const current = SCHEMA_MIGRATIONS.at(-1);
  if (!current || current.version !== DATABASE_SCHEMA_VERSION) {
    throw new Error('Database schema version does not match the migration registry');
  }

  await database.execAsync(`
    PRAGMA application_id = ${DATABASE_APPLICATION_ID};
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR IGNORE INTO schema_migrations (version, name)
    VALUES (${current.version}, '${current.name}');
    PRAGMA user_version = ${current.version};
  `);
}
