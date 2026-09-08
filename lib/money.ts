export function extractCurrencyDigits(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function parseNonNegativeCurrency(value: string): number | null {
  const digits = extractCurrencyDigits(value);
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

export function parsePositiveCurrency(value: string): number | null {
  const amount = parseNonNegativeCurrency(value);
  return amount == null || amount === 0 ? null : amount;
}
