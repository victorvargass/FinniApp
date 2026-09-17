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
  { version: 7, name: 'savings-withdrawal-policy' },
  { version: 8, name: 'account-transfers' },
  { version: 9, name: 'payment-method-name-per-type' },
  { version: 10, name: 'credit-card-refunds-and-adjustments' },
  { version: 11, name: 'savings-and-debt-balance-snapshots' },
  { version: 12, name: 'savings-balance-starting-points' },
  { version: 13, name: 'zero-savings-start-at-creation' },
  { version: 14, name: 'manual-debt-balance-starting-points' },
  { version: 15, name: 'savings-reported-balance-history' },
  { version: 16, name: 'balance-tracking-starts-at-creation' },
  { version: 17, name: 'separate-creation-and-reported-balance-dates' },
  { version: 18, name: 'income-categories-and-savings-groups' },
  { version: 19, name: 'split-purchase-payment-outflows' },
  { version: 20, name: 'persist-expense-split-mode' },
] as const;

// Legacy version 16 tied the declared balance to the historical creation date.
// The exact registration instant was not stored separately, so the last local
// update date is the best recoverable starting point for those records.
export const LEGACY_SAVINGS_BALANCE_DATE_SQL = `
  UPDATE savings_goals
  SET balance_updated_at = date(updated_at, 'localtime'),
      balance_movement_anchor_id = COALESCE((
        SELECT MAX(movement.id)
        FROM savings_goal_movements movement
        LEFT JOIN expenses expense ON expense.id = movement.expense_id
        LEFT JOIN incomes income ON income.id = movement.income_id
        WHERE movement.goal_id = savings_goals.id
          AND COALESCE(expense.date, income.date) <= date(savings_goals.updated_at, 'localtime')
      ), 0)
  WHERE balance_updated_at = date(created_at)
    AND date(updated_at, 'localtime') > balance_updated_at
    AND NOT EXISTS (
      SELECT 1 FROM savings_goal_adjustments adjustment
      WHERE adjustment.goal_id = savings_goals.id
        AND adjustment.reported_balance IS NOT NULL
    )`;

export const LEGACY_DEBT_BALANCE_DATE_SQL = `
  UPDATE manual_debts
  SET balance_updated_at = date(updated_at, 'localtime'),
      balance_payment_anchor_id = COALESCE((
        SELECT MAX(payment.id) FROM manual_debt_entries payment
        WHERE payment.debt_id = manual_debts.id AND payment.kind = 'payment'
          AND payment.date <= date(manual_debts.updated_at, 'localtime')
      ), 0)
  WHERE balance_updated_at = date(created_at)
    AND date(updated_at, 'localtime') > balance_updated_at
    AND NOT EXISTS (
      SELECT 1 FROM manual_debt_entries snapshot
      WHERE snapshot.debt_id = manual_debts.id
        AND snapshot.kind = 'adjustment'
        AND snapshot.reported_balance IS NOT NULL
    )`;

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
