const DAY_MS = 24 * 60 * 60 * 1000;

type CategoryLimitSnapshot = {
  categoryId: number | null;
  categoryName: string;
  periodLimit: number | null;
  total: number;
};

function localDateKey(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function isoDateKey(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function getRemainingPeriodDays(endDate: string, today = new Date()): number {
  const end = isoDateKey(endDate);
  if (end == null) return 1;
  return Math.max(1, Math.floor((end - localDateKey(today)) / DAY_MS) + 1);
}

export function calculateDailyAvailable(
  availableBalance: number,
  endDate: string,
  today = new Date()
): number {
  if (availableBalance <= 0) return 0;
  return Math.floor(availableBalance / getRemainingPeriodDays(endDate, today));
}

export function findMostUrgentCategoryLimit(
  items: CategoryLimitSnapshot[],
  threshold = 0.8
): (CategoryLimitSnapshot & { ratio: number }) | null {
  return items
    .filter((item) => item.periodLimit != null && item.periodLimit > 0)
    .map((item) => ({ ...item, ratio: item.total / (item.periodLimit as number) }))
    .filter((item) => item.ratio >= threshold)
    .sort((left, right) => right.ratio - left.ratio)[0] ?? null;
}
