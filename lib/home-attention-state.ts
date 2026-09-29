export const MAX_HOME_ATTENTION_DISMISSALS = 100;

export function normalizeHomeAttentionDismissals(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function appendHomeAttentionDismissal(
  current: string[],
  id: string,
  limit = MAX_HOME_ATTENTION_DISMISSALS
): string[] {
  return [...current.filter((item) => item !== id), id].slice(-limit);
}

export function removeHomeAttentionDismissal(current: string[], id: string): string[] {
  return current.filter((item) => item !== id);
}
