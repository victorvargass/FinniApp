import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, LayoutTokens } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatCLPInput, formatDate, parseNonNegativeAmount, toDateString } from '@/lib/format';
import { t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';

export default function PaymentMethodBalanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const methodId = Number(id);
  const { paymentMethods, updatePaymentMethodBalance } = useDatabase();
  const method = paymentMethods.find((item) => item.id === methodId);
  const colors = Colors[useColorScheme() ?? 'light'];
  const [balance, setBalance] = useState(method?.availableBalance == null ? '' : formatCLPInput(method.availableBalance));
  const [date, setDate] = useState(toDateString(new Date()));
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const parsed = parseNonNegativeAmount(balance);
    if (parsed == null) return Alert.alert(t('common.error'), t('database.paymentBalanceInvalid'));
    setSaving(true);
    try {
      await updatePaymentMethodBalance(methodId, { balance: parsed, date });
      showToast(t('paymentMethods.balanceUpdated'));
      router.back();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('errors.couldNotSave'));
    } finally {
      setSaving(false);
    }
  };

  if (!method) return <SafeAreaView style={styles.safe}><View style={styles.center}><ThemedText>{t('common.loading')}</ThemedText></View></SafeAreaView>;
  const parsedBalance = parseNonNegativeAmount(balance);
  const difference = parsedBalance == null || method.availableBalance == null
    ? null
    : parsedBalance - method.availableBalance;
  const differenceLabel = difference == null
    ? null
    : `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${formatCLP(Math.abs(difference))}`;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.card}>
          <View style={styles.row}>
            <ThemedText>{method.type === 'credit' ? t('paymentMethods.availableCredit') : t('paymentMethods.availableBalance')}</ThemedText>
            <ThemedText type="defaultSemiBold">{method.availableBalance == null ? '—' : formatCLP(method.availableBalance)}</ThemedText>
          </View>
          <ThemedText style={styles.label}>
            {t(method.type === 'credit'
              ? 'paymentMethods.realAvailableCredit'
              : 'paymentMethods.realAvailableBalance')}
          </ThemedText>
          <TextInput keyboardType="number-pad" value={balance} onChangeText={(value) => setBalance(formatCLPInput(value))} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
          <ThemedText style={styles.hint}>{t('paymentMethods.balanceSnapshotHint')}</ThemedText>
          {differenceLabel && (
            <ThemedText style={[styles.difference, { color: difference === 0 ? colors.success : colors.warning }]}>
              {difference === 0
                ? t('paymentMethods.balancesMatch')
                : t('paymentMethods.differenceFromCalculated', { amount: differenceLabel })}
            </ThemedText>
          )}
          <ThemedText style={styles.label}>{t('paymentMethods.balanceDate')}</ThemedText>
          <Pressable onPress={() => setShowDate(true)} style={[styles.input, styles.date, { borderColor: colors.border }]}><ThemedText>{formatDate(new Date(`${date}T12:00:00`))}</ThemedText></Pressable>
          {showDate && <DateTimePicker value={new Date(`${date}T12:00:00`)} mode="date" onChange={(_, value) => { if (Platform.OS === 'android') setShowDate(false); if (value) setDate(toDateString(value)); }} />}
        </ThemedView>
        <Pressable disabled={saving} onPress={() => void save()} style={[styles.primary, saving && styles.disabled]}><ThemedText style={styles.primaryText}>{saving ? t('common.saving') : t('common.save')}</ThemedText></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 20, paddingBottom: LayoutTokens.formScrollBottom, gap: 14 }, card: { borderRadius: 14, padding: 16, gap: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, label: { fontWeight: '700' }, input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontFamily: Fonts.regular, fontSize: 16 },
  hint: { opacity: 0.68, lineHeight: 19 }, difference: { fontFamily: Fonts.semiBold, lineHeight: 20 },
  date: { justifyContent: 'center' }, primary: { minHeight: 50, borderRadius: 10, backgroundColor: '#0B315B', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, disabled: { opacity: 0.55 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
