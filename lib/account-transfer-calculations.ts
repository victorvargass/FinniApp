import type { AccountTransfer } from './types';

type ExistingTransfer = Pick<
  AccountTransfer,
  'amount' | 'sourcePaymentMethodId' | 'destinationPaymentMethodId'
>;

type TransferSourceDraft = {
  sourceId: number | null;
  amount: string;
  transferAll: boolean;
};

export function changeTransferSource(
  draft: TransferSourceDraft,
  nextSourceId: number | null
): TransferSourceDraft {
  if (nextSourceId === draft.sourceId) return draft;
  return { sourceId: nextSourceId, amount: '', transferAll: false };
}

export function getTransferableSourceBalance(
  availableBalance: number | null,
  sourceId: number | null,
  existing: ExistingTransfer | null
): number | null {
  if (availableBalance == null) return null;

  let transferable = availableBalance;
  if (existing?.sourcePaymentMethodId === sourceId) transferable += existing.amount;
  if (existing?.destinationPaymentMethodId === sourceId) transferable -= existing.amount;
  return transferable;
}

export function getProjectedSourceBalance(
  transferableBalance: number | null,
  sourceId: number | null,
  destinationId: number | null,
  amount: number | null
): number | null {
  if (transferableBalance == null || amount == null) return null;
  return sourceId === destinationId ? transferableBalance : transferableBalance - amount;
}
