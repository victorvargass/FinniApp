import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { addIsoDays, addIsoMonths } from '@/lib/recurrence';
import type { ManualDebt } from '@/lib/types';

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function showResult(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(t('common.done'), message);
}

export default function ManualDebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const debtId = Number(id);
  const { getManualDebt, setManualDebtArchived, removeManualDebt } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [debt, setDebt] = useState<ManualDebt | null>(null);
  const [working, setWorking] = useState(false);
  const load = useCallback(async () => setDebt(await getManualDebt(debtId)), [debtId, getManualDebt]);
  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  const toggleArchive = () => {
    if (!debt) return;
    const archive = debt.status !== 'archived';
    Alert.alert(
      archive ? t('manualDebts.archive') : t('manualDebts.reactivate'),
      archive ? t('manualDebts.archiveHint') : t('manualDebts.reactivateHint'),
      [{ text: t('common.cancel'), style: 'cancel' }, { text: archive ? t('manualDebts.archive') : t('manualDebts.reactivate'), onPress: () => {
        setWorking(true);
        setManualDebtArchived(debt.id, archive).then(() => { showResult(archive ? t('manualDebts.archived') : t('manualDebts.reactivated')); return load(); })
          .catch((error) => Alert.alert(t('errors.couldNotUpdate'), error instanceof Error ? error.message : t('common.tryAgain')))
          .finally(() => setWorking(false));
      } }]
    );
  };

  const deleteDebt = () => {
    if (!debt) return;
    if (debt.entryCount > 0) return Alert.alert(t('manualDebts.cannotDelete'), t('manualDebts.cannotDeleteHint'));
    Alert.alert(t('manualDebts.delete'), t('manualDebts.deleteHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => {
        setWorking(true);
        removeManualDebt(debt.id).then(() => { showResult(t('manualDebts.deleted')); router.back(); })
          .catch((error) => Alert.alert(t('errors.couldNotDelete'), error instanceof Error ? error.message : t('common.tryAgain')))
          .finally(() => setWorking(false));
      } },
    ]);
  };

  if (!debt) return <SafeAreaView style={styles.safe}><View style={styles.center}><ThemedText>{t('common.loading')}</ThemedText></View></SafeAreaView>;
  const progress = debt.initialAmount > 0 ? Math.min(100, debt.paidAmount / debt.initialAmount * 100) : 0;
  const isArchived = debt.status === 'archived';
  const isPaid = debt.status === 'paid';
  const projectedPayments = debt.type === 'fixed' && debt.installmentAmount && debt.nextDueDate
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}><View style={styles.titleCopy}><ThemedText type="title">{debt.name}</ThemedText>{debt.creditor && <ThemedText style={styles.secondary}>{debt.creditor}</ThemedText>}</View><Pressable onPress={() => router.push({ pathname: '/modal/manual-debt-form', params: { id: String(debt.id) } })} hitSlop={8}><Ionicons name="create-outline" size={25} color={colors.primary} /></Pressable></View>

        <ThemedView style={styles.summary}>
          <View style={styles.row}><ThemedText style={styles.secondary}>{t('manualDebts.currentBalance')}</ThemedText><ThemedText type="title">{formatCLP(debt.currentBalance)}</ThemedText></View>
          <View style={styles.row}><ThemedText>{t('manualDebts.estimatedTotalDebt')}</ThemedText><ThemedText>{formatCLP(debt.initialAmount)}</ThemedText></View>
          {debt.type === 'fixed' && <><View style={[styles.track, { backgroundColor: colors.border }]}><View style={[styles.fill, { width: `${progress}%`, backgroundColor: colors.primary }]} /></View><View style={styles.row}><ThemedText style={styles.secondary}>{t('manualDebts.paid')}</ThemedText><ThemedText>{formatCLP(debt.paidAmount)}</ThemedText></View></>}
          <ThemedText style={[styles.status, { color: isPaid ? '#2e9d63' : isArchived ? '#64748b' : colors.primary }]}>{isPaid ? t('manualDebts.statusPaid') : isArchived ? t('manualDebts.statusArchived') : t('manualDebts.statusActive')}</ThemedText>
        </ThemedView>

        {debt.type === 'fixed' && (
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">{t('manualDebts.paymentPlan')}</ThemedText>
            <View style={styles.row}><ThemedText>{t('manualDebts.estimatedInstallment')}</ThemedText><ThemedText>{formatCLP(debt.installmentAmount ?? 0)}</ThemedText></View>
            <View style={styles.row}><ThemedText>{t('manualDebts.estimatedPayments')}</ThemedText><ThemedText>{debt.paymentCount} / {debt.totalInstallments}</ThemedText></View>
            {debt.nextDueDate && <View style={styles.row}><ThemedText>{t('manualDebts.nextDue')}</ThemedText><ThemedText>{formatDate(parseIsoDate(debt.nextDueDate))}</ThemedText></View>}
          </ThemedView>
        )}
        {debt.type === 'variable' && debt.installmentAmount != null && (
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">{t('manualDebts.paymentReference')}</ThemedText>
            <View style={styles.row}><ThemedText>{t('manualDebts.estimatedInstallment')}</ThemedText><ThemedText>{formatCLP(debt.installmentAmount)}</ThemedText></View>
            {debt.nextDueDate && <View style={styles.row}><ThemedText>{t('manualDebts.nextEstimatedPaymentDate')}</ThemedText><ThemedText>{formatDate(parseIsoDate(debt.nextDueDate))}</ThemedText></View>}
          </ThemedView>
        )}

        {projectedPayments.length > 0 && (
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">{t('manualDebts.upcomingPayments')}</ThemedText>
            {projectedPayments.map((payment) => <View key={payment.number} style={styles.row}><ThemedText>{t('manualDebts.paymentNumber', { number: payment.number })} · {formatDate(parseIsoDate(payment.date))}</ThemedText><ThemedText>{formatCLP(payment.amount)}</ThemedText></View>)}
            {remainingProjectedCount > projectedPayments.length && <ThemedText style={styles.secondary}>{t('manualDebts.moreProjectedPayments', { count: remainingProjectedCount - projectedPayments.length })}</ThemedText>}
          </ThemedView>
        )}

        {!isArchived && (
          <View style={styles.actions}>
            {!isPaid && <Pressable onPress={() => router.push({ pathname: '/modal/manual-debt-payment', params: { debtId: String(debt.id) } })} style={styles.primary}><Ionicons name="cash-outline" size={20} color="#fff" /><ThemedText style={styles.primaryText}>{t('manualDebts.registerPayment')}</ThemedText></Pressable>}
            {debt.type === 'variable' && <Pressable onPress={() => router.push({ pathname: '/modal/manual-debt-balance', params: { debtId: String(debt.id) } })} style={[styles.secondaryButton, { borderColor: colors.primary }]}><Ionicons name="sync-outline" size={20} color={colors.primary} /><ThemedText style={{ color: colors.primary, fontWeight: '700' }}>{t('manualDebts.updateBalance')}</ThemedText></Pressable>}
          </View>
        )}

        <ThemedText type="subtitle">{t('manualDebts.history')}</ThemedText>
        {debt.entries?.length === 0 && <ThemedView style={styles.empty}><ThemedText style={styles.secondary}>{t('manualDebts.noHistory')}</ThemedText></ThemedView>}
        {debt.entries?.map((entry) => (
          <Pressable key={entry.id} disabled={entry.kind !== 'payment'} onPress={() => router.push({ pathname: '/modal/manual-debt-payment', params: { debtId: String(debt.id), entryId: String(entry.id) } })}>
            <ThemedView style={styles.entry}>
              <View style={[styles.entryIcon, { backgroundColor: entry.kind === 'payment' ? '#2e9d63' : entry.amount > 0 ? '#d97706' : '#0a7ea4' }]}><Ionicons name={entry.kind === 'payment' ? 'arrow-down' : 'swap-vertical'} size={17} color="#fff" /></View>
              <View style={styles.entryCopy}><ThemedText type="defaultSemiBold">{entry.kind === 'payment' ? t('manualDebts.payment') : t('manualDebts.balanceAdjustment')}</ThemedText><ThemedText style={styles.entryMeta}>{formatDate(parseIsoDate(entry.date))}{entry.paymentMethodName ? ` · ${entry.paymentMethodName}` : ''}{entry.note ? ` · ${entry.note}` : ''}</ThemedText></View>
              <ThemedText style={{ color: entry.kind === 'payment' || entry.amount < 0 ? '#2e9d63' : '#d97706' }}>{entry.kind === 'payment' || entry.amount < 0 ? '−' : '+'}{formatCLP(Math.abs(entry.amount))}</ThemedText>
            </ThemedView>
          </Pressable>
        ))}

        <View style={styles.management}>
          <Pressable disabled={working} onPress={toggleArchive} style={[styles.secondaryButton, { borderColor: colors.border }]}><ThemedText>{isArchived ? t('manualDebts.reactivate') : t('manualDebts.archive')}</ThemedText></Pressable>
          {debt.entryCount === 0 && <Pressable disabled={working} onPress={deleteDebt} style={styles.danger}><ThemedText style={styles.dangerText}>{t('manualDebts.delete')}</ThemedText></Pressable>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, paddingBottom: 45, gap: 14 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, titleCopy: { flex: 1, gap: 3 },
  summary: { borderRadius: 13, padding: 17, gap: 11 }, card: { borderRadius: 12, padding: 15, gap: 11 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, secondary: { opacity: 0.65 },
  track: { height: 9, borderRadius: 5, overflow: 'hidden' }, fill: { height: '100%', borderRadius: 5 }, status: { fontSize: 12, fontWeight: '800' }, actions: { gap: 10 },
  primary: { minHeight: 49, borderRadius: 10, backgroundColor: '#0a7ea4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { minHeight: 47, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 }, empty: { borderRadius: 12, padding: 18, alignItems: 'center' },
  entry: { borderRadius: 11, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, entryIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, entryCopy: { flex: 1, gap: 2 }, entryMeta: { opacity: 0.62, fontSize: 12 },
  management: { marginTop: 8, gap: 10 }, danger: { minHeight: 47, borderWidth: 1, borderColor: '#dc2626', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, dangerText: { color: '#dc2626', fontWeight: '700' },
});
