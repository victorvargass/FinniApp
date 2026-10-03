import { normalizeSearchText } from './search.ts';
import type { CurrencyCode } from './types.ts';

export type DuplicateMovementCandidate = {
  id: number;
  name: string;
  amount: number;
  date: string;
  time?: string;
  currency?: CurrencyCode;
};

type DuplicateMovementDraft = {
  name: string;
  amount: number;
  currency?: CurrencyCode;
};

function normalizeMovementName(value: string) {
  return normalizeSearchText(value).trim().replace(/\s+/g, ' ');
}

export function findDuplicateMovement(
  candidates: readonly DuplicateMovementCandidate[],
  draft: DuplicateMovementDraft,
  excludedId?: number
): DuplicateMovementCandidate | null {
  const normalizedName = normalizeMovementName(draft.name);
  if (!normalizedName || !Number.isFinite(draft.amount)) return null;

  return candidates
    .filter((candidate) => candidate.id !== excludedId
      && candidate.amount === draft.amount
      && normalizeMovementName(candidate.name) === normalizedName
      && (draft.currency == null || (candidate.currency ?? 'CLP') === draft.currency))
    .sort((first, second) => second.date.localeCompare(first.date)
      || (second.time ?? '').localeCompare(first.time ?? '')
      || second.id - first.id)[0] ?? null;
}
