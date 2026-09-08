import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatCLPInput, formatDate, parseNonNegativeAmount, toDateString } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { ManualDebt } from '@/lib/types';

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export default function ManualDebtBalanceScreen() {
  const { debtId: debtIdParam } = useLocalSearchParams<{ debtId: string }>();
  const debtId = Number(debtIdParam);
  const { getManualDebt, addManualDebtBalanceAdjustment } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [debt, setDebt] = useState<ManualDebt | null>(null);
  const [balance, setBalance] = useState('');
  const [date, setDate] = useState(toDateString(new Date()));
  const [note, setNote] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getManualDebt(debtId).then((value) => { setDebt(value); if (value) setBalance(formatCLPInput(value.currentBalance)); }).catch(() => undefined); }, [debtId, getManualDebt]);

  const save = async () => {
    const parsed = parseNonNegativeAmount(balance);
    if (parsed == null) return Alert.alert(t('manualDebts.invalidBalance'), t('manualDebts.invalidBalanceHint'));
    setSaving(true);
    try {
      await addManualDebtBalanceAdjustment(debtId, { balance: parsed, date, note: note.trim() || null });
      if (Platform.OS === 'android') ToastAndroid.show(t('manualDebts.balanceUpdated'), ToastAndroid.SHORT);
      else Alert.alert(t('common.done'), t('manualDebts.balanceUpdated'));
      router.back();
    } catch (error) {
      Alert.alert(t('manualDebts.balanceUpdateError'), error instanceof Error ? error.message : t('common.tryAgain'));
    } finally { setSaving(false); }
  };

  if (!debt) return <SafeAreaView style={styles.safe}><View style={styles.center}><ThemedText>{t('common.loading')}</ThemedText></View></SafeAreaView>;
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="title">{t('manualDebts.updateBalance')}</ThemedText>
        <ThemedText style={styles.description}>{t('manualDebts.updateBalanceHint')}</ThemedText>
        <ThemedView style={styles.card}>
          <View style={styles.row}><ThemedText>{t('manualDebts.currentBalance')}</ThemedText><ThemedText type="defaultSemiBold">{formatCLP(debt.currentBalance)}</ThemedText></View>
          <View style={styles.group}><ThemedText style={styles.label}>{t('manualDebts.newReportedBalance')}</ThemedText><TextInput keyboardType="number-pad" value={balance} onChangeText={(value) => setBalance(formatCLPInput(value))} style={[styles.input, { color: colors.text, borderColor: colors.border }]} /></View>
          <View style={styles.group}><ThemedText style={styles.label}>{t('common.date')}</ThemedText><Pressable onPress={() => setShowDate(true)} style={[styles.input, styles.dateButton, { borderColor: colors.border }]}><ThemedText>{formatDate(parseIsoDate(date))}</ThemedText></Pressable>{showDate && <DateTimePicker value={parseIsoDate(date)} mode="date" onChange={(_, value) => { if (Platform.OS === 'android') setShowDate(false); if (value) setDate(toDateString(value)); }} />}</View>
          <View style={styles.group}><ThemedText style={styles.label}>{t('manualDebts.adjustmentNote')}</ThemedText><TextInput multiline value={note} onChangeText={setNote} placeholder={t('manualDebts.adjustmentNotePlaceholder')} placeholderTextColor={colors.icon} style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border }]} /></View>
        </ThemedView>
        <Pressable disabled={saving} onPress={() => { void save(); }} style={[styles.primary, saving && styles.disabled]}><ThemedText style={styles.primaryText}>{saving ? t('common.saving') : t('manualDebts.saveBalance')}</ThemedText></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, paddingBottom: 45, gap: 15 }, description: { opacity: 0.68, lineHeight: 20 },
  card: { borderRadius: 12, padding: 16, gap: 16 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, group: { gap: 7 }, label: { fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 }, dateButton: { justifyContent: 'center' }, multiline: { minHeight: 86, paddingTop: 12, textAlignVertical: 'top' },
  primary: { minHeight: 49, borderRadius: 10, backgroundColor: '#0a7ea4', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, disabled: { opacity: 0.45 },
});
