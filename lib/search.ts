export function matchesSearchQuery(label: string, query: string) {
  const normalizedQuery = normalizeSearchText(query.trim());
  return normalizedQuery.length === 0 || normalizeSearchText(label).includes(normalizedQuery);
}

export function normalizeSearchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

function normalizeAmountSearchQuery(query: string): string | null {
  const normalized = normalizeSearchText(query.trim())
    .replace(/^(?:clp|usd|us)\s*/i, '')
    .replace(/^\$\s*/, '');
  if (!normalized || !/^[\d.,\s]+$/.test(normalized)) return null;
  const digits = normalized.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

export function matchesMovementSearchQuery(
  label: string,
  amount: number,
  query: string
): boolean {
  if (matchesSearchQuery(label, query)) return true;
  const amountQuery = normalizeAmountSearchQuery(query);
  if (amountQuery == null) return false;
  const amountDigits = String(Math.abs(amount)).replace(/\D/g, '');
  return amountDigits.includes(amountQuery);
}
