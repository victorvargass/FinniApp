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

export function AccountTransferMovements() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { accountTransfers, selectedPeriodId } = useDatabase();

  const movements = useMemo<AccountMovementListItem[]>(() => (
    accountTransfers.map((transfer) => ({
      key: `transfer-${transfer.id}`,
      title: transfer.note?.trim() || t('transfers.defaultName'),
      amount: transfer.amount,
      date: transfer.date,
      time: transfer.time,
      description: t('movementLedger.transferRoute', {
        source: transfer.sourcePaymentMethodName,
        target: transfer.destinationPaymentMethodName,
      }),
      color: transfer.sourcePaymentMethodColor || colors.secondary,
      icon: 'swap-horizontal-outline',
      primaryGroup: {
        key: `source-${transfer.sourcePaymentMethodId}`,
        name: transfer.sourcePaymentMethodName,
        color: transfer.sourcePaymentMethodColor || colors.secondary,
      },
      secondaryGroup: {
        key: `destination-${transfer.destinationPaymentMethodId}`,
        name: transfer.destinationPaymentMethodName,
        color: transfer.destinationPaymentMethodColor || colors.secondary,
      },
      onPress: () => router.push({
        pathname: '/modal/account-transfer-form',
        params: { id: String(transfer.id) },
      } as never),
    }))
  ), [accountTransfers, colors.secondary]);

  return (
    <AccountMovementList
      movements={movements}
      periodKey={selectedPeriodId}
      groupOptions={[
        { value: 'primary', label: t('movementLedger.groupBySourceAccount') },
        { value: 'secondary', label: t('movementLedger.groupByDestinationAccount') },
        { value: 'none', label: t('filters.noGrouping') },
      ]}
      defaultGroup="none"
      searchPlaceholder={t('movementLedger.searchTransfers')}
      emptyIcon="swap-horizontal-outline"
      emptyTitle={t('movementLedger.emptyTransfersTitle')}
      emptyDescription={t('movementLedger.emptyTransfersDescription')}
      emptyActionLabel={t('movementLedger.addTransfer')}
      fabHref="/modal/account-transfer-form"
      fabAccessibilityLabel={t('movementLedger.addTransfer')}
    />
  );
}
