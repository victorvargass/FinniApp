import { router } from 'expo-router';
import { useMemo } from 'react';

import {
  AccountMovementList,
  type AccountMovementListItem,
} from '@/components/account-movement-list';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';
import type { CreditCardAdjustmentKind } from '@/lib/types';

function getAdjustmentLabel(kind: CreditCardAdjustmentKind | null) {
  switch (kind) {
    case 'refund':
      return t('paymentMethods.adjustmentKinds.refund');
    case 'cancelled_purchase':
      return t('paymentMethods.adjustmentKinds.cancelled_purchase');
    case 'discount':
      return t('paymentMethods.adjustmentKinds.discount');
    default:
      return t('paymentMethods.adjustmentKinds.other');
  }
}

export function CardPaymentMovements() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { cardPaymentMovements, selectedPeriodId } = useDatabase();

  const movements = useMemo<AccountMovementListItem[]>(() => (
    cardPaymentMovements.map((movement) => {
      const isPayment = movement.kind === 'payment';
      const sourceName = movement.sourcePaymentMethodName ?? t('common.notSpecified');
      return {
        key: `${movement.kind}-${movement.id}`,
        title: movement.name?.trim()
          || (isPayment ? t('movementLedger.cardPayment') : getAdjustmentLabel(movement.adjustmentKind)),
        amount: movement.amount,
        date: movement.date,
        time: movement.time,
        description: isPayment
          ? t('movementLedger.paymentRoute', {
              source: sourceName,
              target: movement.targetPaymentMethodName,
            })
          : t('movementLedger.adjustmentFor', { target: movement.targetPaymentMethodName }),
        color: movement.targetPaymentMethodColor || colors.warning,
        icon: isPayment ? 'card-outline' : 'return-down-back-outline',
        filterKey: isPayment ? 'payment' : 'adjustment',
        primaryGroup: {
          key: `target-${movement.targetPaymentMethodId}`,
          name: movement.targetPaymentMethodName,
          color: movement.targetPaymentMethodColor || colors.warning,
        },
        secondaryGroup: isPayment
          ? {
              key: movement.sourcePaymentMethodId == null
                ? 'source-unspecified'
                : `source-${movement.sourcePaymentMethodId}`,
              name: sourceName,
              color: movement.sourcePaymentMethodColor || colors.icon,
            }
          : {
              key: 'adjustments',
              name: t('movementLedger.adjustments'),
              color: colors.success,
            },
        onPress: () => router.push((isPayment
          ? { pathname: '/modal/expense-form', params: { id: String(movement.id) } }
          : { pathname: '/modal/expense-form', params: { adjustmentId: String(movement.id) } }) as never),
      };
    })
  ), [cardPaymentMovements, colors.icon, colors.success, colors.warning]);

  return (
    <AccountMovementList
      movements={movements}
      periodKey={selectedPeriodId}
      groupOptions={[
        { value: 'primary', label: t('movementLedger.groupByReceivingCard') },
        { value: 'secondary', label: t('movementLedger.groupBySourceAccount') },
        { value: 'none', label: t('filters.noGrouping') },
      ]}
      defaultGroup="primary"
      filterOptions={[
        { value: 'all', label: t('movementLedger.all') },
        { value: 'payment', label: t('movementLedger.payments') },
        { value: 'adjustment', label: t('movementLedger.adjustments') },
      ]}
      searchPlaceholder={t('movementLedger.searchCardPayments')}
      emptyIcon="card-outline"
      emptyTitle={t('movementLedger.emptyCardPaymentsTitle')}
      emptyDescription={t('movementLedger.emptyCardPaymentsDescription')}
      emptyActionLabel={t('movementLedger.addCardPayment')}
      fabHref={{ pathname: '/modal/expense-form', params: { cardPayment: 'true' } }}
      fabAccessibilityLabel={t('movementLedger.addCardPayment')}
    />
  );
}
