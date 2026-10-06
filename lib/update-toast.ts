type CurrentUpdateToastInput = {
  activeUpdateId: string | null;
  previousActiveUpdateId: string | null;
};

type CurrentUpdateToastStateInput = {
  activeUpdateId: string | null;
  seenActiveUpdateIds: string[];
};

export type CurrentUpdateToastState = {
  shouldShow: boolean;
  seenActiveUpdateIds: string[];
};

const MAX_SEEN_ACTIVE_UPDATES = 20;

export function shouldShowCurrentUpdateToast({
  activeUpdateId,
  previousActiveUpdateId,
}: CurrentUpdateToastInput): boolean {
  return activeUpdateId != null
    && previousActiveUpdateId != null
    && activeUpdateId !== previousActiveUpdateId;
}

export function parseSeenActiveUpdateIds(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((item): item is string => typeof item === 'string' && item.length > 0))]
      .slice(-MAX_SEEN_ACTIVE_UPDATES);
  } catch {
    return [];
  }
}

export function resolveCurrentUpdateToastState({
  activeUpdateId,
  seenActiveUpdateIds,
}: CurrentUpdateToastStateInput): CurrentUpdateToastState {
  const seen = [...new Set(seenActiveUpdateIds.filter(Boolean))].slice(-MAX_SEEN_ACTIVE_UPDATES);
  if (!activeUpdateId || seen.includes(activeUpdateId)) {
    return { shouldShow: false, seenActiveUpdateIds: seen };
  }

  return {
    shouldShow: seen.length > 0,
    seenActiveUpdateIds: [...seen, activeUpdateId].slice(-MAX_SEEN_ACTIVE_UPDATES),
  };
}
