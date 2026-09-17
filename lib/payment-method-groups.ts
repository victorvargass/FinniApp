import type { PaymentMethodType } from './types';

export type HomePaymentBalanceKind = 'wallet' | 'credit';

export const PAYMENT_METHOD_TYPE_ORDER: readonly PaymentMethodType[] = [
  'cash',
  'debit',
  'prepaid',
  'credit',
];

export function groupPaymentMethodsByType<T extends { type: PaymentMethodType }>(methods: readonly T[]) {
  return PAYMENT_METHOD_TYPE_ORDER
    .map((type) => ({
      type,
      data: methods.filter((method) => method.type === type),
    }))
    .filter((section) => section.data.length > 0);
}

export function getHomePaymentMethods<
  T extends { active: boolean; type: PaymentMethodType },
>(methods: readonly T[], kind: HomePaymentBalanceKind): T[] {
  return methods.filter((method) => method.active && (
    kind === 'credit'
      ? method.type === 'credit'
      : method.type === 'cash' || method.type === 'debit' || method.type === 'prepaid'
  ));
}

export function sumKnownAvailableBalances<T extends { availableBalance: number | null }>(
  methods: readonly T[]
): number {
  return methods.reduce((total, method) => total + (method.availableBalance ?? 0), 0);
}
