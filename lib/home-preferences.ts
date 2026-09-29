export const HOME_SECTION_IDS = [
  'attention',
  'weekly',
  'wallet',
  'credit',
  'savings',
  'debts',
  'breakdown',
] as const;

export const HOME_PERIOD_METRIC_IDS = [
  'available',
  'income',
  'expenses',
  'unbilledCredit',
] as const;

export const HOME_GLOBAL_METRIC_IDS = [
  'wallet',
  'credit',
  'savings',
  'debt',
] as const;

export type HomeSectionId = typeof HOME_SECTION_IDS[number];
export type HomePeriodMetricId = typeof HOME_PERIOD_METRIC_IDS[number];
export type HomeGlobalMetricId = typeof HOME_GLOBAL_METRIC_IDS[number];

export type HomePreferences = {
  sectionOrder: HomeSectionId[];
  hiddenSections: HomeSectionId[];
  periodMetrics: HomePeriodMetricId[];
  globalMetrics: HomeGlobalMetricId[];
};

export const DEFAULT_HOME_PREFERENCES: HomePreferences = {
  sectionOrder: [...HOME_SECTION_IDS],
  hiddenSections: [],
  periodMetrics: [...HOME_PERIOD_METRIC_IDS],
  globalMetrics: [...HOME_GLOBAL_METRIC_IDS],
};

function normalizeSelection<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: readonly T[],
  requireOne = false
): T[] {
  if (!Array.isArray(value)) return [...fallback];
  const allowedSet = new Set<string>(allowed);
  const selection = [...new Set(value.filter((item): item is T => (
    typeof item === 'string' && allowedSet.has(item)
  )))];
  return requireOne && selection.length === 0 ? [...fallback] : selection;
}

export function normalizeHomePreferences(value: unknown): HomePreferences {
  const candidate = typeof value === 'object' && value != null
    ? value as Partial<HomePreferences>
    : {};
  const storedOrder = normalizeSelection(candidate.sectionOrder, HOME_SECTION_IDS, []);
  const missingSections = HOME_SECTION_IDS.filter((item) => !storedOrder.includes(item));

  return {
    sectionOrder: [...storedOrder, ...missingSections],
    hiddenSections: normalizeSelection(candidate.hiddenSections, HOME_SECTION_IDS, []),
    periodMetrics: normalizeSelection(
      candidate.periodMetrics,
      HOME_PERIOD_METRIC_IDS,
      DEFAULT_HOME_PREFERENCES.periodMetrics,
      true
    ),
    globalMetrics: normalizeSelection(
      candidate.globalMetrics,
      HOME_GLOBAL_METRIC_IDS,
      DEFAULT_HOME_PREFERENCES.globalMetrics,
      true
    ),
  };
}

export function parseHomePreferences(value: string | null | undefined): HomePreferences {
  if (!value) return normalizeHomePreferences(null);
  try {
    return normalizeHomePreferences(JSON.parse(value));
  } catch {
    return normalizeHomePreferences(null);
  }
}
