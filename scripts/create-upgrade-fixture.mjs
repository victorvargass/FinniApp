import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(process.argv[2] ?? resolve(root, 'tmp', 'gastos-v27.db'));
const source = readFileSync(resolve(root, 'lib', 'db.ts'), 'utf8');
const initializeStart = source.indexOf('async function initializeDatabase()');
const schemaStart = source.indexOf('await db.execAsync(`', initializeStart) + 'await db.execAsync(`'.length;
const schemaEnd = source.indexOf('\n  `);', schemaStart);

if (initializeStart < 0 || schemaStart < 0 || schemaEnd < 0) {
  throw new Error('No se pudo encontrar el contrato de creación de la base en lib/db.ts.');
}

const schemaSql = source
  .slice(schemaStart, schemaEnd)
  .replace('${DATABASE_APPLICATION_ID}', String(0x46494e4e));

if (schemaSql.includes('${')) {
  throw new Error('El esquema contiene interpolaciones que el generador no reconoce.');
}

mkdirSync(dirname(outputPath), { recursive: true });
rmSync(outputPath, { force: true });
const database = new DatabaseSync(outputPath);

try {
  database.exec(schemaSql);
  database.exec(`
    ALTER TABLE settings DROP COLUMN home_preferences;
    PRAGMA user_version = 27;
    PRAGMA application_id = ${0x46494e4e};

    INSERT INTO periods (id, start_date, end_date)
    VALUES (1, '2026-09-01', '2026-09-30');
    INSERT INTO settings (id, current_period_id) VALUES (1, 1);
    INSERT INTO categories (id, name, color, purpose)
    VALUES (1, 'Alimentación QA', '#e74c3c', 'general');
    INSERT INTO income_categories (id, name, color)
    VALUES (1, 'Ingreso QA', '#20a486');
    INSERT INTO payment_methods (
      id, name, type, color, reported_balance, balance_updated_at,
      balance_updated_time, balance_synced_at
    ) VALUES (
      1, 'Cuenta QA', 'debit', '#0b315b', 250000, '2026-09-01',
      '08:00', '2026-09-01 08:00:00'
    );
    INSERT INTO expenses (
      id, name, amount, category_id, period_id, date, time
    ) VALUES (1, 'Compra migrada QA', 12500, 1, 1, '2026-09-10', '12:30');
    INSERT INTO incomes (
      id, name, amount, period_id, date, time, payment_method_id, category_id
    ) VALUES (1, 'Ingreso migrado QA', 200000, 1, '2026-09-05', '09:15', 1, 1);
    INSERT INTO savings_goals (
      id, name, target_amount, initial_amount, deadline, color,
      balance_updated_at, balance_updated_time
    ) VALUES (
      1, 'Meta migrada QA', 100000, 45000, '2026-12-31', '#20b9db',
      '2026-09-01', '08:00'
    );
    INSERT INTO contacts (id, name, nickname)
    VALUES (1, 'Contacto migrado QA', 'QA');
    INSERT INTO manual_debts (
      id, type, direction, name, contact_id, initial_amount,
      installment_amount, frequency, first_due_date, status,
      balance_updated_at, balance_updated_time
    ) VALUES (
      1, 'fixed', 'payable', 'Deuda migrada QA', 1, 30000,
      10000, 'monthly', '2026-10-05', 'active', '2026-09-01', '08:00'
    );
    INSERT INTO recurring_expenses (
      id, name, amount, frequency, registration_mode, start_date,
      execution_day, active
    ) VALUES (
      1, 'Recurrencia migrada QA', 8000, 'monthly', 'confirmation',
      '2026-10-10', 10, 1
    );
  `);

  const foreignKeyErrors = database.prepare('PRAGMA foreign_key_check').all();
  if (foreignKeyErrors.length > 0) {
    throw new Error(`La base ficticia contiene relaciones inválidas: ${JSON.stringify(foreignKeyErrors)}`);
  }
} finally {
  database.close();
}

process.stdout.write(`${outputPath}\n`);
