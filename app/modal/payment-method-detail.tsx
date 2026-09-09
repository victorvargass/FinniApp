import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP, formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getEstimatedPaymentDueDate } from '@/lib/payment-method-calculations';

export default function PaymentMethodDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const methodId = Number(id);
  const { paymentMethods } = useDatabase();
  const method = paymentMethods.find((item) => item.id === methodId);
  const colors = Colors[useColorScheme() ?? 'light'];
  if (!method) return <SafeAreaView style={styles.safe}><View style={styles.center}><ThemedText>{t('common.loading')}</ThemedText></View></SafeAreaView>;
  const isCredit = method.type === 'credit';
  const progress = isCredit && method.creditLimit ? Math.min(1, Math.max(0, (method.usedAmount ?? 0) / method.creditLimit)) : 0;
  const dueDate = isCredit && method.statementDate && method.paymentDueDay
    ? getEstimatedPaymentDueDate(method.statementDate, method.paymentDueDay)
    : null;
  const typeLabel = {
    cash: t('paymentMethods.cash'),
    debit: t('paymentMethods.debit'),
    prepaid: t('paymentMethods.prepaid'),
    credit: t('paymentMethods.credit'),
  }[method.type];
  const action = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={[styles.action, { borderColor: colors.border }]}><Ionicons name={icon} size={22} color={colors.action} /><ThemedText type="defaultSemiBold" style={styles.actionText}>{label}</ThemedText><Ionicons name="chevron-forward" size={20} color={colors.icon} /></Pressable>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.accountCard, { backgroundColor: method.color }]}>
          <View style={styles.accountHeader}><View><ThemedText style={styles.onCardType}>{typeLabel}</ThemedText><ThemedText style={styles.onCardName}>{method.name}</ThemedText></View><Ionicons name={isCredit ? 'card' : 'wallet'} size={30} color="#fff" /></View>
          {method.type !== 'cash' && <><ThemedText style={styles.onCardLabel}>{isCredit ? t('paymentMethods.availableCredit') : t('paymentMethods.availableBalance')}</ThemedText><ThemedText style={styles.balance}>{method.availableBalance == null ? '—' : formatCLP(method.availableBalance)}</ThemedText></>}
          {isCredit && method.creditLimit != null && <><View style={styles.track}><View style={[styles.fill, { width: `${progress * 100}%` }]} /></View><View style={styles.accountFooter}><ThemedText style={styles.onCardSmall}>{t('paymentMethods.used')} {formatCLP(method.usedAmount ?? 0)}</ThemedText><ThemedText style={styles.onCardSmall}>{t('paymentMethods.totalCredit')} {formatCLP(method.creditLimit)}</ThemedText></View></>}
          {method.balanceUpdatedAt && <ThemedText style={styles.onCardSmall}>{t('paymentMethods.balanceUpdatedAt', { date: formatDate(new Date(`${method.balanceUpdatedAt}T12:00:00`)) })}</ThemedText>}
        </View>
        {method.type !== 'cash' && method.availableBalance == null && <ThemedText style={styles.hint}>{t('paymentMethods.balanceNotConfigured')}</ThemedText>}
        {isCredit && <ThemedView style={styles.statement}><ThemedText type="subtitle">{t('paymentMethods.billedToPay')}</ThemedText><ThemedText type="title">{formatCLP(method.billedAmount)}</ThemedText><ThemedText style={styles.hint}>{dueDate ? t('paymentMethods.dueDate', { date: formatDate(dueDate) }) : t('paymentMethods.noStatement')}</ThemedText></ThemedView>}
        <View style={styles.actions}>
          {method.type !== 'cash' && action('refresh-outline', t('paymentMethods.updateBalance'), () => router.push({ pathname: '/modal/payment-method-balance', params: { id: String(method.id) } }))}
          {isCredit && action('cash-outline', t('paymentMethods.payCard'), () => router.push({ pathname: '/modal/expense-form', params: { creditPaymentTargetId: String(method.id) } }))}
          {isCredit && action('wallet-outline', t('paymentMethods.viewInDebts'), () => router.push({ pathname: '/modal/debts', params: { paymentMethodId: String(method.id) } }))}
          {isCredit && action('receipt-outline', t('paymentMethods.cycles'), () => router.push({ pathname: '/modal/card-cycles', params: { id: String(method.id) } }))}
          {action('settings-outline', t('paymentMethods.editSettings'), () => router.push({ pathname: '/modal/payment-method-form', params: { id: String(method.id) } }))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 20, paddingBottom: 70, gap: 14 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  accountCard: { borderRadius: 20, padding: 20, minHeight: 205, gap: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, elevation: 5 }, accountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, onCardType: { color: '#fff', opacity: 0.82, fontSize: 13 }, onCardName: { color: '#fff', fontSize: 20, fontWeight: '700' }, onCardLabel: { color: '#fff', opacity: 0.82 }, balance: { color: '#fff', fontSize: 30, fontWeight: '700' }, track: { height: 7, borderRadius: 4, backgroundColor: '#ffffff55', overflow: 'hidden', marginTop: 7 }, fill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 }, accountFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, onCardSmall: { color: '#fff', opacity: 0.88, fontSize: 12 },
  statement: { borderRadius: 14, padding: 17, gap: 6 }, hint: { opacity: 0.68, lineHeight: 19 }, actions: { gap: 10 }, action: { minHeight: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }, actionText: { flex: 1 },
});
