import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';

import {
  AccountMovementList,
  type AccountMovementListItem,
} from '@/components/account-movement-list';
import { Colors } from '@/constants/theme';
import { usePaymentDatabase, usePeriodDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';

export function AccountTransferMovements() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { accountTransfers, removeAccountTransfer } = usePaymentDatabase();
  const { selectedPeriodId } = usePeriodDatabase();

  const confirmDelete = useCallback((id: number) => {
    Alert.alert(t('transfers.delete'), t('transfers.deleteQuestion'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await removeAccountTransfer(id);
            showToast(t('transfers.deleted'));
          } catch (error) {
            Alert.alert(t('common.error'), errorMessage(error, 'errors.couldNotDelete'));
          }
        },
      },
    ]);
  }, [removeAccountTransfer]);

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
        pathname: '/modal/account-movement-detail',
        params: { id: String(transfer.id), kind: 'transfer' },
      } as never),
      onDelete: () => confirmDelete(transfer.id),
      deleteAccessibilityLabel: t('movementDetail.deleteNamed', {
        name: transfer.note?.trim() || t('transfers.defaultName'),
      }),
    }))
  ), [accountTransfers, colors.secondary, confirmDelete]);

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
