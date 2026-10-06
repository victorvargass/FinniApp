import type { PaymentMethod, PaymentMethodType } from '@/lib/types';

type MatchablePaymentMethod = Pick<PaymentMethod, 'id' | 'name' | 'type' | 'active'>;

type DetectedPaymentMethod = {
  sourceApp: string;
  paymentMethodHint?: string | null;
  suggestedPaymentMethodType?: PaymentMethodType | null;
  suggestedType: 'expense' | 'income' | 'card-payment' | 'transfer';
};

const GENERIC_NAME_PARTS = new Set([
  'app', 'aplicacion', 'banco', 'bank', 'mi', 'de', 'del', 'la', 'el',
  'tarjeta', 'card', 'credito', 'credit', 'debito', 'debit', 'prepago', 'prepaid',
  'cuenta', 'account', 'wallet', 'google', 'movil', 'mobile',
]);

function comparableParts(value: string): string[] {
  return value
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length >= 2 && !GENERIC_NAME_PARTS.has(part));
}

function bigrams(value: string): Set<string> {
  if (value.length < 2) return new Set(value ? [value] : []);
  return new Set(Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2)));
}

function nameSimilarity(first: string, second: string): number {
  const firstParts = comparableParts(first);
  const secondParts = comparableParts(second);
  const firstCompact = firstParts.join('');
  const secondCompact = secondParts.join('');
  if (!firstCompact || !secondCompact) return 0;
  if (firstCompact === secondCompact) return 100;
  if (Math.min(firstCompact.length, secondCompact.length) >= 3
    && (firstCompact.includes(secondCompact) || secondCompact.includes(firstCompact))) return 85;

  const sharedParts = firstParts.filter((part) => secondParts.includes(part));
  const tokenScore = sharedParts.length === 0
    ? 0
    : 65 + Math.round(25 * sharedParts.length / Math.max(firstParts.length, secondParts.length));
  const firstBigrams = bigrams(firstCompact);
  const secondBigrams = bigrams(secondCompact);
  const sharedBigrams = [...firstBigrams].filter((part) => secondBigrams.has(part)).length;
  const diceScore = firstBigrams.size + secondBigrams.size === 0
    ? 0
    : Math.round(70 * (2 * sharedBigrams) / (firstBigrams.size + secondBigrams.size));
  return Math.max(tokenScore, diceScore);
}

function isCompatibleType(candidate: DetectedPaymentMethod, method: MatchablePaymentMethod): boolean {
  if (candidate.suggestedPaymentMethodType != null) {
    return method.type === candidate.suggestedPaymentMethodType;
  }
  if (candidate.suggestedType === 'card-payment') return method.type === 'credit';
  if (candidate.suggestedType === 'income' || candidate.suggestedType === 'transfer') {
    return method.type !== 'credit';
  }
  return true;
}

export function findClosestPaymentMethod(
  candidate: DetectedPaymentMethod,
  paymentMethods: readonly MatchablePaymentMethod[]
): MatchablePaymentMethod | null {
  const detectedName = candidate.paymentMethodHint?.trim() || candidate.sourceApp;
  const ranked = paymentMethods
    .filter((method) => method.active && isCompatibleType(candidate, method))
    .map((method) => ({ method, score: nameSimilarity(detectedName, method.name) }))
    .filter((match) => match.score >= 50)
    .sort((first, second) => second.score - first.score || first.method.id - second.method.id);

  if (ranked.length === 0) return null;
  if (candidate.suggestedPaymentMethodType == null
    && candidate.suggestedType === 'expense'
    && ranked.length > 1) return null;
  if (ranked[1]?.score === ranked[0].score) return null;
  return ranked[0].method;
}
