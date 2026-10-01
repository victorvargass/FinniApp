import type { PeriodStatement } from './types';

export const PERIOD_CSV_FIELDS = [
  'date',
  'time',
  'type',
  'name',
  'category',
  'paymentMethod',
  'currency',
  'amount',
] as const;

export type PeriodCsvField = typeof PERIOD_CSV_FIELDS[number];

export type PeriodCsvLabels = {
  headers: Record<PeriodCsvField, string>;
  expense: string;
  income: string;
  uncategorized: string;
  noPaymentMethod: string;
};

function escapeCsv(value: string | number): string {
  const raw = String(value);
  const text = typeof value === 'string' && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildPeriodCsv(
  statement: PeriodStatement,
  fields: PeriodCsvField[],
  labels: PeriodCsvLabels
): string {
  const selected = fields.length > 0 ? fields : [...PERIOD_CSV_FIELDS];
  const movements = [
    ...statement.expenses.map((item) => ({
      id: item.id,
      date: item.date,
      time: item.time || '12:00',
      type: labels.expense,
      name: item.name,
      category: item.categoryName ?? labels.uncategorized,
      paymentMethod: item.paymentMethodName ?? labels.noPaymentMethod,
      currency: item.currency === 'USD' ? 'USD' as const : 'CLP' as const,
      amount: item.currency === 'USD'
        ? -Math.abs(item.originalAmount ?? item.amount) / 100
        : -Math.abs(item.originalAmount ?? item.amount),
    })),
    ...statement.incomes.map((item) => ({
      id: item.id,
      date: item.date,
      time: item.time || '12:00',
      type: labels.income,
      name: item.name,
      category: item.categoryName ?? labels.uncategorized,
      paymentMethod: item.paymentMethodName ?? labels.noPaymentMethod,
      currency: 'CLP' as const,
      amount: Math.abs(item.amount),
    })),
  ].sort((first, second) => (
    first.date.localeCompare(second.date)
    || first.time.localeCompare(second.time)
    || first.type.localeCompare(second.type)
    || first.id - second.id
  ));

  const lines = [
    selected.map((field) => escapeCsv(labels.headers[field])).join(';'),
    ...movements.map((movement) => (
      selected.map((field) => escapeCsv(movement[field])).join(';')
    )),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
