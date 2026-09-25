type RelationDatabase = {
  getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
};

type NullableRelation = {
  table: string;
  column: string;
  parentTable: string;
};

type DependentRelation = {
  table: string;
  column: string;
  parentTable: string;
};

// These references are optional metadata. Clearing an orphan keeps the
// financial movement itself and lets the UI show it as unclassified.
const NULLABLE_RELATIONS: readonly NullableRelation[] = [
  { table: 'settings', column: 'current_period_id', parentTable: 'periods' },
  { table: 'settings', column: 'default_payment_method_id', parentTable: 'payment_methods' },
  { table: 'expenses', column: 'category_id', parentTable: 'categories' },
  { table: 'expenses', column: 'payment_method_id', parentTable: 'payment_methods' },
  { table: 'expenses', column: 'recurring_expense_id', parentTable: 'recurring_expenses' },
  { table: 'expenses', column: 'debt_plan_id', parentTable: 'debt_plans' },
  { table: 'expenses', column: 'debt_installment_id', parentTable: 'debt_installments' },
  { table: 'expenses', column: 'credit_payment_target_id', parentTable: 'payment_methods' },
  { table: 'incomes', column: 'payment_method_id', parentTable: 'payment_methods' },
  { table: 'incomes', column: 'category_id', parentTable: 'income_categories' },
  { table: 'incomes', column: 'recurring_income_id', parentTable: 'recurring_incomes' },
  { table: 'credit_card_cycles', column: 'bank_charge_expense_id', parentTable: 'expenses' },
  { table: 'credit_card_cycles', column: 'adjustment_expense_id', parentTable: 'expenses' },
  { table: 'recurring_expenses', column: 'category_id', parentTable: 'categories' },
  { table: 'recurring_expenses', column: 'payment_method_id', parentTable: 'payment_methods' },
  { table: 'recurring_expenses', column: 'source_expense_id', parentTable: 'expenses' },
  { table: 'recurring_expenses', column: 'savings_goal_id', parentTable: 'savings_goals' },
  { table: 'recurring_expense_occurrences', column: 'expense_id', parentTable: 'expenses' },
  { table: 'debt_plans', column: 'category_id', parentTable: 'categories' },
  { table: 'debt_installments', column: 'expense_id', parentTable: 'expenses' },
  { table: 'recurring_incomes', column: 'source_income_id', parentTable: 'incomes' },
  { table: 'recurring_incomes', column: 'payment_method_id', parentTable: 'payment_methods' },
  { table: 'recurring_incomes', column: 'category_id', parentTable: 'income_categories' },
  { table: 'recurring_income_occurrences', column: 'income_id', parentTable: 'incomes' },
  { table: 'savings_goals', column: 'group_id', parentTable: 'savings_groups' },
  { table: 'manual_debts', column: 'category_id', parentTable: 'categories' },
  { table: 'manual_debts', column: 'income_category_id', parentTable: 'income_categories' },
  { table: 'manual_debts', column: 'contact_id', parentTable: 'contacts' },
  { table: 'manual_debts', column: 'payment_method_id', parentTable: 'payment_methods' },
  { table: 'manual_debt_entries', column: 'period_id', parentTable: 'periods' },
  { table: 'manual_debt_entries', column: 'expense_id', parentTable: 'expenses' },
  { table: 'manual_debt_entries', column: 'income_id', parentTable: 'incomes' },
  { table: 'contacts', column: 'relationship_type_id', parentTable: 'contact_relationships' },
] as const;

// These rows only connect or project parent data. If their parent is gone,
// the row cannot be displayed meaningfully, while the underlying expense or
// income (when present) remains untouched.
const DEPENDENT_RELATIONS: readonly DependentRelation[] = [
  { table: 'credit_card_adjustments', column: 'payment_method_id', parentTable: 'payment_methods' },
  { table: 'credit_card_cycles', column: 'payment_method_id', parentTable: 'payment_methods' },
  { table: 'recurring_expense_occurrences', column: 'recurring_expense_id', parentTable: 'recurring_expenses' },
  { table: 'debt_installments', column: 'debt_plan_id', parentTable: 'debt_plans' },
  { table: 'recurring_income_occurrences', column: 'recurring_income_id', parentTable: 'recurring_incomes' },
  { table: 'savings_goal_movements', column: 'goal_id', parentTable: 'savings_goals' },
  { table: 'savings_goal_adjustments', column: 'goal_id', parentTable: 'savings_goals' },
  { table: 'manual_debt_entries', column: 'debt_id', parentTable: 'manual_debts' },
  { table: 'contact_bank_accounts', column: 'contact_id', parentTable: 'contacts' },
] as const;

async function getSchemaColumns(database: RelationDatabase): Promise<Map<string, Set<string>>> {
  const tables = await database.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  );
  const schema = new Map<string, Set<string>>();
  for (const { name } of tables) {
    const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(\"${name}\")`);
    schema.set(name, new Set(columns.map((column) => column.name)));
  }
  return schema;
}

function relationExists(
  schema: Map<string, Set<string>>,
  relation: NullableRelation | DependentRelation
): boolean {
  return schema.get(relation.table)?.has(relation.column) === true
    && schema.get(relation.parentTable)?.has('id') === true;
}

/**
 * Repairs only relationships whose recovery cannot remove a financial
 * movement. Required ledger relationships deliberately remain untouched so
 * the caller can reject a genuinely unsafe database.
 */
export async function repairRecoverableDatabaseRelations(database: RelationDatabase): Promise<void> {
  const schema = await getSchemaColumns(database);

  for (const relation of NULLABLE_RELATIONS) {
    if (!relationExists(schema, relation)) continue;
    await database.runAsync(
      `UPDATE "${relation.table}"
       SET "${relation.column}" = NULL
       WHERE "${relation.column}" IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM "${relation.parentTable}" parent
           WHERE parent.id = "${relation.table}"."${relation.column}"
         )`
    );
  }

  for (const relation of DEPENDENT_RELATIONS) {
    if (!relationExists(schema, relation)) continue;
    await database.runAsync(
      `DELETE FROM "${relation.table}"
       WHERE NOT EXISTS (
         SELECT 1 FROM "${relation.parentTable}" parent
         WHERE parent.id = "${relation.table}"."${relation.column}"
       )`
    );
  }

  // Association rows with a missing movement have no monetary value of their
  // own. Removing the broken link keeps every expense and income intact.
  if (schema.get('savings_goal_movements')?.has('expense_id')
      && schema.get('savings_goal_movements')?.has('income_id')) {
    await database.runAsync(`
      DELETE FROM savings_goal_movements
      WHERE (expense_id IS NULL AND income_id IS NULL)
         OR (expense_id IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM expenses WHERE expenses.id = savings_goal_movements.expense_id
         ))
         OR (income_id IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM incomes WHERE incomes.id = savings_goal_movements.income_id
         ))
    `);
  }
}
