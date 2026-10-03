import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OverflowMenu } from '@/components/overflow-menu';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useMovementDatabase, usePaymentDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/feedback';
import { formatEventDateTime, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import type { AccountTransfer, CreditCardAdjustment, CreditCardAdjustmentKind, ExpenseWithCategory } from '@/lib/types';
import { getExpenseById } from '@/repositories/movements';

type AccountMovementKind = 'payment' | 'adjustment' | 'transfer';

function DetailRow({ label, value, color }: { label: string; value: string; color?: string | null }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.valueRow}>
        {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
        <ThemedText style={styles.value}>{value}</ThemedText>
      </View>
    </View>
  );
}

function adjustmentLabel(kind: CreditCardAdjustmentKind) {
  return t(`paymentMethods.adjustmentKinds.${kind}`);
}

export default function AccountMovementDetailScreen() {
  const { id, kind: requestedKind } = useLocalSearchParams<{ id?: string; kind?: AccountMovementKind }>();
  const movementId = Number(id);
  const kind: AccountMovementKind = requestedKind === 'payment' || requestedKind === 'adjustment'
    ? requestedKind
    : 'transfer';
  const navigation = useNavigation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const { removeExpense } = useMovementDatabase();
  const {
    paymentMethods,
    getCreditCardAdjustment,
    removeCreditCardAdjustment,
    getAccountTransfer,
    removeAccountTransfer,
  } = usePaymentDatabase();
  const [payment, setPayment] = useState<ExpenseWithCategory | null>(null);
  const [adjustment, setAdjustment] = useState<CreditCardAdjustment | null>(null);
  const [transfer, setTransfer] = useState<AccountTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(movementId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    if (kind === 'payment') {
      const result = await getExpenseById(movementId);
      setPayment(result?.creditPaymentTargetId != null ? result : null);
    } else if (kind === 'adjustment') {
      setAdjustment(await getCreditCardAdjustment(movementId));
    } else {
      setTransfer(await getAccountTransfer(movementId));
    }
    setLoading(false);
  }, [getAccountTransfer, getCreditCardAdjustment, kind, movementId]);

  useFocusEffect(useCallback(() => {
    load().catch(() => setLoading(false));
  }, [load]));

  const movement = kind === 'payment' ? payment : kind === 'adjustment' ? adjustment : transfer;

  const editMovement = useCallback(() => {
    if (!movement) return;
    if (kind === 'payment') {
      router.push({ pathname: '/modal/expense-form', params: { id: String(movement.id) } });
    } else if (kind === 'adjustment') {
      router.push({ pathname: '/modal/expense-form', params: { adjustmentId: String(movement.id) } });
    } else {
      router.push({ pathname: '/modal/account-transfer-form', params: { id: String(movement.id) } });
    }
  }, [kind, movement]);

  const confirmDelete = useCallback(() => {
    if (!movement) return;
    const title = kind === 'payment'
      ? t('expenses.delete')
      : kind === 'adjustment'
        ? t('paymentMethods.deleteAdjustment')
        : t('transfers.delete');
    const question = kind === 'payment'
      ? t('expenses.deleteQuestion', { name: (movement as ExpenseWithCategory).name })
      : kind === 'adjustment'
        ? t('paymentMethods.deleteAdjustmentQuestion')
        : t('transfers.deleteQuestion');
    Alert.alert(title, question, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setWorking(true);
          try {
            if (kind === 'payment') {
              await removeExpense(movement.id);
              showToast(t('expenses.deleted'));
            } else if (kind === 'adjustment') {
              await removeCreditCardAdjustment(movement.id);
              showToast(t('paymentMethods.adjustmentDeleted'));
            } else {
              await removeAccountTransfer(movement.id);
              showToast(t('transfers.deleted'));
            }
            router.back();
          } catch (error) {
            Alert.alert(t('common.error'), errorMessage(error, 'errors.couldNotDelete'));
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  }, [kind, movement, removeAccountTransfer, removeCreditCardAdjustment, removeExpense]);

  useEffect(() => {
    navigation.setOptions({
      title: t(`accountMovementDetail.${kind}Title`),
      headerRight: () => (
        <OverflowMenu
          accessibilityLabel={t('common.moreOptions')}
          actions={movement ? [
            { label: t('common.edit'), icon: 'create-outline', onPress: editMovement },
            { label: t('common.delete'), icon: 'trash-outline', destructive: true, onPress: confirmDelete },
          ] : []}
          disabled={!movement || working}
          iconColor={colors.primary}
        />
      ),
    });
  }, [colors.primary, confirmDelete, editMovement, kind, movement, navigation, working]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText>{t('common.loading')}</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!movement) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={42} color={colors.icon} />
          <ThemedText type="subtitle">{t('accountMovementDetail.notFound')}</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const targetMethodId = kind === 'payment'
    ? payment?.creditPaymentTargetId
    : kind === 'adjustment'
      ? adjustment?.paymentMethodId
      : null;
  const targetMethod = paymentMethods.find((method) => method.id === targetMethodId);
  const title = kind === 'payment'
    ? payment!.name
    : kind === 'adjustment'
      ? adjustment!.note?.trim() || adjustmentLabel(adjustment!.kind)
      : transfer!.note?.trim() || t('transfers.defaultName');
  const amount = movement.amount;
  const currency = kind === 'payment'
    ? payment!.currency
    : kind === 'adjustment'
      ? adjustment!.currency ?? 'CLP'
      : 'CLP';
  const accent = kind === 'transfer' ? colors.secondary : kind === 'adjustment' ? colors.success : colors.warning;
  const icon = kind === 'transfer'
    ? 'swap-horizontal-outline'
    : kind === 'adjustment'
      ? 'return-down-back-outline'
      : 'card-outline';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView style={[styles.hero, { borderTopColor: accent }]}>
          <View style={[styles.iconBox, { backgroundColor: `${accent}18` }]}>
            <Ionicons name={icon} size={28} color={accent} />
          </View>
          <ThemedText style={[styles.kind, { color: accent }]}>
            {t(`accountMovementDetail.${kind}`)}
          </ThemedText>
          <ThemedText type="title" style={styles.name}>{title}</ThemedText>
          <ThemedText style={[styles.amount, { color: accent }]}>{formatMoney(amount, currency)}</ThemedText>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText type="subtitle">{t('movementDetail.information')}</ThemedText>
          <DetailRow label={t('movementDetail.date')} value={formatEventDateTime(movement.date, movement.time)} />
          {kind === 'payment' ? (
            <>
              <DetailRow
                label={t('accountMovementDetail.sourceAccount')}
                value={payment!.paymentMethodName ?? t('common.notSpecified')}
                color={payment!.paymentMethodColor}
              />
              <DetailRow
                label={t('accountMovementDetail.receivingCard')}
                value={targetMethod?.name ?? t('common.notSpecified')}
                color={targetMethod?.color}
              />
            </>
          ) : kind === 'adjustment' ? (
            <>
              <DetailRow label={t('accountMovementDetail.adjustmentKind')} value={adjustmentLabel(adjustment!.kind)} />
              <DetailRow
                label={t('accountMovementDetail.receivingCard')}
                value={targetMethod?.name ?? t('common.notSpecified')}
                color={targetMethod?.color}
              />
            </>
          ) : (
            <>
              <DetailRow
                label={t('transfers.from')}
                value={transfer!.sourcePaymentMethodName}
                color={transfer!.sourcePaymentMethodColor}
              />
              <DetailRow
                label={t('transfers.to')}
                value={transfer!.destinationPaymentMethodName}
                color={transfer!.destinationPaymentMethodColor}
              />
              {transfer!.note ? <DetailRow label={t('accountMovementDetail.note')} value={transfer!.note} /> : null}
            </>
          )}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  hero: {
    alignItems: 'center',
    borderRadius: 18,
    borderTopWidth: 5,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 7,
  },
  iconBox: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  kind: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  name: { textAlign: 'center' },
  amount: { fontSize: 30, lineHeight: 38, fontWeight: '700' },
  card: { borderRadius: 18, padding: 20, gap: 4 },
  detailRow: {
    minHeight: 56,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#AEBBC755',
    gap: 5,
  },
  label: { opacity: 0.65, fontSize: 13 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  dot: { width: 11, height: 11, borderRadius: 5.5 },
});
