/** The account pays the whole purchase; expense.amount is only the user's share. */
export function paymentOutflowSql(alias: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
    throw new Error('Invalid expense table alias');
  }
  return `COALESCE(${alias}.original_amount, ${alias}.amount)`;
}
