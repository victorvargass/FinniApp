import { t } from '@/lib/i18n';
import type { PaymentMethodType } from '@/lib/types';

const PAYMENT_METHOD_GROUP_ORDER: Record<PaymentMethodType, number> = {
  cash: 0,
  debit: 1,
  prepaid: 2,
  credit: 3,
};

export function getPaymentMethodOptionGroup(type: PaymentMethodType) {
  return {
    group: t(`paymentMethods.${type}`),
    groupOrder: PAYMENT_METHOD_GROUP_ORDER[type],
  };
}

export function orderGroupedOptions<T extends { groupOrder?: number }>(options: T[]) {
  return options
    .map((option, index) => ({ option, index }))
    .sort((left, right) => {
      const orderDifference = (left.option.groupOrder ?? -1) - (right.option.groupOrder ?? -1);
      return orderDifference || left.index - right.index;
    })
    .map(({ option }) => option);
}
