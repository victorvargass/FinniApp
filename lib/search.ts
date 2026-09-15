export function matchesSearchQuery(label: string, query: string) {
  const normalizedQuery = normalizeSearchText(query.trim());
  return normalizedQuery.length === 0 || normalizeSearchText(label).includes(normalizedQuery);
}

function normalizeSearchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}
