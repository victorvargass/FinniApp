import { toDateString } from '@/lib/format';
import type { NewRecurringSchedule } from '@/lib/types';

export function parseDateString(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
export function getEstimatedBillingDate(purchaseDate: Date, billingDay: number) {
  const monthOffset = purchaseDate.getDate() <= billingDay ? 0 : 1;
  const year = purchaseDate.getFullYear();
  const month = purchaseDate.getMonth() + monthOffset;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(billingDay, lastDay), 12);
}

export function getDefaultRecurringSchedule(date: Date): NewRecurringSchedule {
  return {
    frequency: 'monthly',
    intervalMonths: 2,
    executionDay: date.getDate(),
    registrationMode: 'confirmation',
    startDate: toDateString(date),
    endDate: null,
    active: true,
  };
}

export function getNameSuggestions(names: string[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  if (!normalizedQuery) return [];

  const uniqueNames = new Map<string, string>();
  names.forEach((item) => {
    const name = item.trim();
    const normalizedName = name.toLocaleLowerCase('es');
    if (
      normalizedName.includes(normalizedQuery) &&
      normalizedName !== normalizedQuery &&
      !uniqueNames.has(normalizedName)
    ) {
      uniqueNames.set(normalizedName, name);
    }
  });

  return [...uniqueNames.values()].slice(0, 5);
}
