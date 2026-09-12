type CategoryLimitSnapshot = {
  categoryId: number | null;
  categoryName: string;
  periodLimit: number | null;
  total: number;
};

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
