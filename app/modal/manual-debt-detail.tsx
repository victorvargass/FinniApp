import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OverflowMenu } from '@/components/overflow-menu';
import { Colors } from '@/constants/theme';
import { useDebtDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLargeTextLayout } from '@/hooks/use-large-text-layout';
import { Alert } from '@/lib/alert';
import { errorMessage, showFeedback } from '@/lib/feedback';
import { isSinglePaymentDebt } from '@/lib/debt-calculations';
import { formatCLP, formatDate, formatEventDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { addIsoDays, addIsoMonths } from '@/lib/recurrence';
import type { Debt, DebtEntry } from '@/lib/types';

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const debtId = Number(id);
  const { getDebt, setDebtArchived, removeDebt, removeDebtBalanceAdjustment } = useDebtDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const usesLargeText = useLargeTextLayout();
  const [debt, setDebt] = useState<Debt | null>(null);
  const [working, setWorking] = useState(false);
  const load = useCallback(async () => setDebt(await getDebt(debtId)), [debtId, getDebt]);
  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  const toggleArchive = () => {
    if (!debt) return;
    const archive = debt.status !== 'archived';
    Alert.alert(
      archive ? t('debts.archive') : t('debts.reactivate'),
      archive ? t('debts.archiveHint') : t('debts.reactivateHint'),
      [{ text: t('common.cancel'), style: 'cancel' }, { text: archive ? t('debts.archive') : t('debts.reactivate'), onPress: () => {
        setWorking(true);
        setDebtArchived(debt.id, archive).then(() => { showFeedback(archive ? t('debts.archived') : t('debts.reactivated')); return load(); })
          .catch((error) => Alert.alert(t('errors.couldNotUpdate'), errorMessage(error)))
          .finally(() => setWorking(false));
      } }]
    );
  };

  const deleteDebt = () => {
    if (!debt) return;
    Alert.alert(t('debts.delete'), t(debt.entryCount > 0 ? 'debts.deleteWithHistoryHint' : 'debts.deleteHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => {
        setWorking(true);
        removeDebt(debt.id).then(() => { showFeedback(t('debts.deleted')); router.back(); })
          .catch((error) => Alert.alert(t('errors.couldNotDelete'), errorMessage(error)))
          .finally(() => setWorking(false));
      } },
    ]);
  };

  const deleteBalanceUpdate = (entry: DebtEntry) => {
    Alert.alert(
      t('debts.deleteBalanceUpdate'),
      t('debts.deleteBalanceUpdateQuestion', { date: formatDate(parseIsoDate(entry.date)) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => {
          setWorking(true);
          removeDebtBalanceAdjustment(debtId, entry.id)
            .then(() => { showFeedback(t('debts.balanceUpdateDeleted')); return load(); })
            .catch((error) => Alert.alert(t('errors.couldNotDelete'), errorMessage(error)))
            .finally(() => setWorking(false));
        } },
      ]
    );
  };

  if (!debt) return <SafeAreaView style={styles.safe}><View style={styles.center}><ThemedText>{t('common.loading')}</ThemedText></View></SafeAreaView>;
  const progress = debt.initialAmount > 0 ? Math.min(100, debt.paidAmount / debt.initialAmount * 100) : 0;
  const isArchived = debt.status === 'archived';
  const isPaid = debt.status === 'paid';
  const isSinglePayment = debt.type === 'fixed'
    && isSinglePaymentDebt(debt.initialAmount, debt.installmentAmount);
  const latestReportedEntry = debt.entries?.find((entry) => entry.reportedBalance != null);
  const latestReportedAmount = latestReportedEntry?.reportedBalance ?? debt.initialAmount;
  const latestReportedDate = latestReportedEntry?.date ?? debt.balanceDate;
  const projectedPayments = debt.type === 'fixed' && !isSinglePayment && debt.installmentAmount && debt.nextDueDate
    ? Array.from({ length: Math.min(6, Math.ceil(debt.currentBalance / debt.installmentAmount)) }, (_, index) => {
        const date = debt.frequency === 'weekly'
          ? addIsoDays(debt.nextDueDate!, index * 7)
          : addIsoMonths(debt.nextDueDate!, index * (debt.frequency === 'annual' ? 12 : 1));
        return {
          number: debt.paymentCount + index + 1,
          date,
          amount: Math.min(debt.installmentAmount!, Math.max(0, debt.currentBalance - debt.installmentAmount! * index)),
        };
      })
    : [];
  const remainingProjectedCount = debt.type === 'fixed' && debt.installmentAmount
    ? Math.ceil(debt.currentBalance / debt.installmentAmount)
    : 0;
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{
        headerRight: () => (
          <OverflowMenu
            accessibilityLabel={t('common.moreOptions')}
            actions={[
              ...(!isArchived && !isPaid ? [{
                label: t(debt.direction === 'receivable' ? 'debts.registerCollection' : 'debts.registerPayment'),
                icon: 'cash-outline' as const,
                onPress: () => router.push({
                  pathname: '/modal/manual-debt-payment',
                  params: { debtId: String(debt.id) },
                }),
              }] : []),
              ...(!isArchived && debt.type === 'variable' ? [{
                label: t('debts.updateBalance'),
                icon: 'sync-outline' as const,
                onPress: () => router.push({
                  pathname: '/modal/manual-debt-balance',
                  params: { debtId: String(debt.id) },
                }),
              }] : []),
              {
                label: t('debts.editConfiguration'),
                icon: 'settings-outline',
                onPress: () => router.push({ pathname: '/modal/manual-debt-form', params: { id: String(debt.id) } }),
              },
              {
                label: isArchived ? t('debts.reactivate') : t('debts.archive'),
                icon: isArchived ? 'refresh-outline' : 'archive-outline',
                onPress: toggleArchive,
              },
              {
                label: t('debts.delete'),
                icon: 'trash-outline' as const,
                destructive: true,
                onPress: deleteDebt,
              },
            ]}
            disabled={working}
          />
        ),
      }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleCopy}><ThemedText type="title">{debt.name}</ThemedText>{(debt.contactName || debt.creditor) && <ThemedText style={styles.secondary}>{debt.contactName ?? debt.creditor}</ThemedText>}<ThemedText style={styles.secondary}>{t(debt.direction === 'receivable' ? 'debts.owedToMe' : 'debts.iOwe')}</ThemedText></View>

        <ThemedView style={styles.summary}>
          <View style={[styles.row, usesLargeText && styles.rowLargeText]}><ThemedText style={styles.secondary}>{t('debts.currentBalance')}</ThemedText><ThemedText type="title">{formatCLP(debt.currentBalance)}</ThemedText></View>
          <View style={[styles.row, usesLargeText && styles.rowLargeText]}><ThemedText>{t('debts.reportedBalanceOn', { date: formatDate(parseIsoDate(latestReportedDate)) })}</ThemedText><ThemedText>{formatCLP(latestReportedAmount)}</ThemedText></View>
          {debt.type === 'fixed' && <><View style={[styles.track, { backgroundColor: colors.border }]}><View style={[styles.fill, { width: `${progress}%`, backgroundColor: colors.primary }]} /></View><View style={[styles.row, usesLargeText && styles.rowLargeText]}><ThemedText style={styles.secondary}>{t('debts.paid')}</ThemedText><ThemedText>{formatCLP(debt.paidAmount)}</ThemedText></View></>}
          <ThemedText style={[styles.status, { color: isPaid ? '#1FAF78' : isArchived ? '#60758E' : colors.primary }]}>{isPaid ? t('debts.statusPaid') : isArchived ? t('debts.statusArchived') : t('debts.statusActive')}</ThemedText>
        </ThemedView>

        {debt.type === 'fixed' && !isSinglePayment && (
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">{t('debts.paymentPlan')}</ThemedText>
            <View style={[styles.row, usesLargeText && styles.rowLargeText]}><ThemedText>{t('debts.estimatedInstallment')}</ThemedText><ThemedText>{formatCLP(debt.installmentAmount ?? 0)}</ThemedText></View>
            <View style={[styles.row, usesLargeText && styles.rowLargeText]}><ThemedText>{t('debts.estimatedPayments')}</ThemedText><ThemedText>{debt.paymentCount} / {debt.totalInstallments}</ThemedText></View>
            {debt.nextDueDate && <View style={[styles.row, usesLargeText && styles.rowLargeText]}><ThemedText>{t('debts.nextDue')}</ThemedText><ThemedText>{formatDate(parseIsoDate(debt.nextDueDate))}</ThemedText></View>}
          </ThemedView>
        )}
        {isSinglePayment && (
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">{t('debts.singlePayment')}</ThemedText>
            {debt.firstDueDate && (
              <View style={[styles.row, usesLargeText && styles.rowLargeText]}>
                <ThemedText>{t(debt.direction === 'receivable' ? 'debts.scheduledCollectionDate' : 'debts.scheduledPaymentDate')}</ThemedText>
                <ThemedText>{formatDate(parseIsoDate(debt.firstDueDate))}</ThemedText>
              </View>
            )}
            <ThemedText style={styles.secondary}>{t(debt.direction === 'receivable' ? 'debts.singleCollectionDetail' : 'debts.singlePaymentDetail')}</ThemedText>
          </ThemedView>
        )}
        {debt.type === 'variable' && debt.installmentAmount != null && (
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">{t('debts.paymentReference')}</ThemedText>
            <View style={[styles.row, usesLargeText && styles.rowLargeText]}><ThemedText>{t('debts.estimatedInstallment')}</ThemedText><ThemedText>{formatCLP(debt.installmentAmount)}</ThemedText></View>
            {debt.nextDueDate && <View style={[styles.row, usesLargeText && styles.rowLargeText]}><ThemedText>{t('debts.nextEstimatedPaymentDate')}</ThemedText><ThemedText>{formatDate(parseIsoDate(debt.nextDueDate))}</ThemedText></View>}
          </ThemedView>
        )}

        {projectedPayments.length > 0 && (
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">{t('debts.upcomingPayments')}</ThemedText>
            {projectedPayments.map((payment) => <View key={payment.number} style={[styles.row, usesLargeText && styles.rowLargeText]}><ThemedText>{t('debts.paymentNumber', { number: payment.number })} · {formatDate(parseIsoDate(payment.date))}</ThemedText><ThemedText>{formatCLP(payment.amount)}</ThemedText></View>)}
            {remainingProjectedCount > projectedPayments.length && <ThemedText style={styles.secondary}>{t('debts.moreProjectedPayments', { count: remainingProjectedCount - projectedPayments.length })}</ThemedText>}
          </ThemedView>
        )}

        <ThemedText type="subtitle">{t('debts.history')}</ThemedText>
        {debt.entries?.length === 0 && <ThemedView style={styles.empty}><ThemedText style={styles.secondary}>{t('debts.noHistory')}</ThemedText></ThemedView>}
        {debt.entries?.map((entry) => {
          const isBalanceConfirmation = entry.reportedBalance != null && entry.amount === 0;
          return (
            <Pressable
              key={entry.id}
              disabled={working || (entry.kind !== 'payment' && entry.reportedBalance == null)}
              onPress={() => entry.kind === 'payment'
                ? router.push({ pathname: '/modal/manual-debt-payment', params: { debtId: String(debt.id), entryId: String(entry.id) } })
                : deleteBalanceUpdate(entry)}>
              <ThemedView style={[styles.entry, usesLargeText && styles.entryLargeText]}>
                <View style={[styles.entryIcon, { backgroundColor: entry.kind === 'payment' ? '#1FAF78' : entry.amount > 0 ? '#D88916' : '#0B315B' }]}><Ionicons name={entry.kind === 'payment' ? 'arrow-down' : 'swap-vertical'} size={17} color="#fff" /></View>
                <View style={styles.entryCopy}><ThemedText type="defaultSemiBold">{entry.kind === 'payment' ? t(debt.direction === 'receivable' ? 'debts.collection' : 'debts.payment') : t(isBalanceConfirmation ? 'debts.balanceConfirmation' : 'debts.balanceAdjustment')}</ThemedText><ThemedText style={styles.entryMeta}>{formatEventDateTime(entry.date, entry.time)}{entry.paymentMethodName ? ` · ${entry.paymentMethodName}` : ''}{entry.note ? ` · ${entry.note}` : ''}{entry.reportedBalance != null ? ` · ${t('debts.reportedBalanceEntry', { amount: formatCLP(entry.reportedBalance) })}` : ''}</ThemedText></View>
                {!isBalanceConfirmation && <ThemedText style={[styles.entryAmount, usesLargeText && styles.entryAmountLargeText, { color: entry.kind === 'payment' || entry.amount < 0 ? '#1FAF78' : '#D88916' }]}>{entry.kind === 'payment' || entry.amount < 0 ? '−' : '+'}{formatCLP(Math.abs(entry.amount))}</ThemedText>}
                {entry.reportedBalance != null && <Ionicons name="trash-outline" size={18} color="#C93F4B" />}
              </ThemedView>
            </Pressable>
          );
        })}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, paddingBottom: 45, gap: 14 }, titleCopy: { gap: 3 },
  summary: { borderRadius: 13, padding: 17, gap: 11 }, card: { borderRadius: 12, padding: 15, gap: 11 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, rowLargeText: { flexDirection: 'column', alignItems: 'flex-start', gap: 2 }, secondary: { opacity: 0.65 },
  track: { height: 9, borderRadius: 5, overflow: 'hidden' }, fill: { height: '100%', borderRadius: 5 }, status: { fontSize: 12, fontWeight: '800' },
  empty: { borderRadius: 12, padding: 18, alignItems: 'center' },
  entry: { borderRadius: 11, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, entryLargeText: { flexWrap: 'wrap', alignItems: 'flex-start' }, entryIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, entryCopy: { flex: 1, minWidth: 0, gap: 2 }, entryMeta: { opacity: 0.62, fontSize: 12 }, entryAmount: { textAlign: 'right' }, entryAmountLargeText: { width: '100%', paddingLeft: 40 },
});
