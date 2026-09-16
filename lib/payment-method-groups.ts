import type { PaymentMethodType } from './types';

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
