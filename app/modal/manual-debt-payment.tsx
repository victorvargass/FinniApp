import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SimpleSelect } from '@/components/simple-select';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatCLPInput, formatDate, parseAmount, toDateString } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { Debt } from '@/lib/types';

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function showResult(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(t('common.done'), message);
}

export default function DebtPaymentScreen() {
  const { debtId: debtIdParam, entryId: entryIdParam } = useLocalSearchParams<{ debtId: string; entryId?: string }>();
  const debtId = Number(debtIdParam);
  const entryId = entryIdParam ? Number(entryIdParam) : null;
  const { periods, selectedPeriod, selectedPeriodId, categories, paymentMethods, getDebt, addDebtPayment, editDebtPayment, removeDebtPayment } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [debt, setDebt] = useState<Debt | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toDateString(new Date()));
  const [periodId, setPeriodId] = useState<number | null>(selectedPeriodId);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDebt(debtId).then((value) => {
      if (!value) return;
      setDebt(value);
      const entry = entryId == null ? null : value.entries?.find((item) => item.id === entryId);
      setAmount(formatCLPInput(entry?.amount ?? Math.min(value.installmentAmount ?? value.currentBalance, value.currentBalance)));
      const today = new Date();
      const defaultDate = selectedPeriod
        ? (toDateString(today) >= selectedPeriod.startDate && toDateString(today) <= selectedPeriod.endDate ? toDateString(today) : selectedPeriod.endDate)
        : toDateString(today);
      setDate(entry?.date ?? defaultDate);
      setPeriodId(entry?.periodId ?? selectedPeriodId);
      setCategoryId(entry?.categoryId ?? value.categoryId);
      setPaymentMethodId(entry?.paymentMethodId ?? value.paymentMethodId);
      setNote(entry?.note ?? '');
    }).catch(() => undefined);
  }, [debtId, entryId, getDebt, selectedPeriod, selectedPeriodId]);

  const save = async () => {
    const parsedAmount = parseAmount(amount);
    if (parsedAmount == null || periodId == null) return Alert.alert(t('debts.missingPaymentData'), t('debts.missingPaymentDataHint'));
    setSaving(true);
    try {
      const data = { amount: parsedAmount, date, periodId, categoryId, paymentMethodId, note: note.trim() || null };
      if (entryId == null) await addDebtPayment(debtId, data);
      else await editDebtPayment(entryId, data);
      showResult(entryId == null ? t('debts.paymentRegistered') : t('debts.paymentUpdated'));
      router.back();
    } catch (error) {
      Alert.alert(t('errors.couldNotSave'), error instanceof Error ? error.message : t('common.tryAgain'));
    } finally { setSaving(false); }
  };

  const confirmDelete = () => {
    if (entryId == null) return;
    Alert.alert(t('debts.deletePayment'), t('debts.deletePaymentHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => {
        setSaving(true);
        removeDebtPayment(entryId).then(() => { showResult(t('debts.paymentDeleted')); router.back(); })
          .catch((error) => Alert.alert(t('errors.couldNotDelete'), error instanceof Error ? error.message : t('common.tryAgain')))
          .finally(() => setSaving(false));
      } },
    ]);
  };

  if (!debt) return <SafeAreaView style={styles.safe}><View style={styles.center}><ThemedText>{t('common.loading')}</ThemedText></View></SafeAreaView>;
  const periodOptions = periods.map((item) => ({ value: item.id, label: `${formatDate(parseIsoDate(item.startDate))} – ${formatDate(parseIsoDate(item.endDate))}` }));
  const categoryOptions = [{ value: null, label: t('common.notSpecified') }, ...categories.filter((item) => item.purpose === 'general').map((item) => ({ value: item.id, label: item.name, color: item.color }))];
  const paymentOptions = [
    { value: null, label: t('common.notSpecified') },
    ...paymentMethods
      .filter((item) => item.active || item.id === paymentMethodId)
      .map((item) => ({ value: item.id, label: item.name, color: item.color })),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="title">{entryId == null ? t('debts.registerPayment') : t('debts.editPayment')}</ThemedText>
        <ThemedView style={styles.balanceCard}>
          <ThemedText>{debt.name}</ThemedText>
          <View style={styles.row}><ThemedText style={styles.secondary}>{t('debts.currentBalance')}</ThemedText><ThemedText type="defaultSemiBold">{formatCLP(debt.currentBalance)}</ThemedText></View>
        </ThemedView>
        <ThemedView style={styles.card}>
          <View style={styles.group}><ThemedText style={styles.label}>{t('common.amount')}</ThemedText><TextInput keyboardType="number-pad" value={amount} onChangeText={(value) => setAmount(formatCLPInput(value))} style={[styles.input, { borderColor: colors.border, color: colors.text }]} /></View>
          <SimpleSelect label={t('common.period')} value={periodId} onChange={(nextPeriodId) => {
            setPeriodId(nextPeriodId);
            const nextPeriod = periods.find((item) => item.id === nextPeriodId);
            if (nextPeriod && (date < nextPeriod.startDate || date > nextPeriod.endDate)) setDate(nextPeriod.endDate);
          }} options={periodOptions} />
          <View style={styles.group}>
            <ThemedText style={styles.label}>{t('common.date')}</ThemedText>
            <Pressable onPress={() => setShowDate(true)} style={[styles.input, styles.dateButton, { borderColor: colors.border }]}><ThemedText>{formatDate(parseIsoDate(date))}</ThemedText></Pressable>
            {showDate && <DateTimePicker value={parseIsoDate(date)} mode="date" onChange={(_, value) => { if (Platform.OS === 'android') setShowDate(false); if (value) setDate(toDateString(value)); }} />}
          </View>
          <SimpleSelect label={t('debts.category')} value={categoryId} onChange={setCategoryId} options={categoryOptions} />
          <SimpleSelect label={t('debts.paymentMethod')} value={paymentMethodId} onChange={setPaymentMethodId} options={paymentOptions} />
          <View style={styles.group}><ThemedText style={styles.label}>{t('debts.paymentNote')}</ThemedText><TextInput multiline value={note} onChangeText={setNote} placeholder={t('debts.paymentNotePlaceholder')} placeholderTextColor={colors.icon} style={[styles.input, styles.multiline, { borderColor: colors.border, color: colors.text }]} /></View>
        </ThemedView>
        <Pressable disabled={saving} onPress={() => { void save(); }} style={[styles.primary, saving && styles.disabled]}><ThemedText style={styles.primaryText}>{saving ? t('common.saving') : t('debts.savePayment')}</ThemedText></Pressable>
        {entryId != null && <Pressable disabled={saving} onPress={confirmDelete} style={styles.danger}><ThemedText style={styles.dangerText}>{t('debts.deletePayment')}</ThemedText></Pressable>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, paddingBottom: 45, gap: 15 },
  balanceCard: { borderRadius: 12, padding: 15, gap: 8 }, card: { borderRadius: 12, padding: 16, gap: 15 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, secondary: { opacity: 0.65 },
  group: { gap: 7 }, label: { fontWeight: '600' }, input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, fontFamily: Fonts.regular }, dateButton: { justifyContent: 'center' },
  multiline: { minHeight: 82, paddingTop: 12, textAlignVertical: 'top' }, primary: { minHeight: 49, borderRadius: 10, backgroundColor: '#0B315B', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontWeight: '700' },
  danger: { minHeight: 48, borderWidth: 1, borderColor: '#C93F4B', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, dangerText: { color: '#C93F4B', fontWeight: '700' }, disabled: { opacity: 0.45 },
});
