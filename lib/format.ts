import { APP_LOCALE } from './i18n';

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formats the raw digits of a monetary input while it is being edited. */
export function formatCLPInput(value: string | number | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return formatCLP(Number(digits));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function parseAmount(value: string): number | null {
  const cleaned = value.replace(/\D/g, '');
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  return Number.isNaN(num) || num <= 0 ? null : num;
}

export function formatMonth(month: string | null): string {
  if (!month) return '';

  const [year, monthNumber] = month.split('-');

  const date = new Date(Number(year), Number(monthNumber) - 1, 1, 12);
  const formattedMonth = new Intl.DateTimeFormat(APP_LOCALE, { month: 'short' })
    .format(date)
    .replace('.', '');
  return `${formattedMonth}-${year.slice(2)}`;
}
