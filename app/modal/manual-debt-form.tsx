import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SimpleSelect } from '@/components/simple-select';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLPInput, formatDate, parseAmount, toDateString } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { DebtFrequency, DebtType } from '@/lib/types';

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function showResult(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(t('common.done'), message);
}

export default function DebtFormScreen() {
  const { id, type: requestedType } = useLocalSearchParams<{ id?: string; type?: DebtType }>();
  const debtId = id ? Number(id) : null;
  const { categories, paymentMethods, getDebt, addDebt, editDebt } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [type, setType] = useState<DebtType>(requestedType === 'variable' ? 'variable' : 'fixed');
  const [name, setName] = useState('');
  const [creditor, setCreditor] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [frequency, setFrequency] = useState<DebtFrequency>('monthly');
  const [firstDueDate, setFirstDueDate] = useState(toDateString(new Date()));
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [entryCount, setEntryCount] = useState(0);
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (debtId == null) return;
    getDebt(debtId).then((debt) => {
      if (!debt) return;
      setType(debt.type); setName(debt.name); setCreditor(debt.creditor ?? '');
      setInitialAmount(formatCLPInput(debt.initialAmount)); setInstallmentAmount(debt.installmentAmount ? formatCLPInput(debt.installmentAmount) : '');
      setFrequency(debt.frequency ?? 'monthly'); setFirstDueDate(debt.firstDueDate ?? toDateString(new Date()));
      setCategoryId(debt.categoryId); setPaymentMethodId(debt.paymentMethodId); setNotes(debt.notes ?? ''); setEntryCount(debt.entryCount);
    }).catch(() => undefined);
  }, [debtId, getDebt]);

  const save = async () => {
    const parsedInitial = parseAmount(initialAmount);
    const parsedInstallment = parseAmount(installmentAmount);
    if (!name.trim()) return Alert.alert(t('debts.missingName'), t('debts.missingNameHint'));
    if (parsedInitial == null) return Alert.alert(t('debts.invalidAmount'), t('debts.invalidInitialHint'));
    if (type === 'fixed' && parsedInstallment == null) return Alert.alert(t('debts.invalidAmount'), t('debts.invalidInstallmentHint'));
    if (parsedInstallment != null && parsedInstallment > parsedInitial) return Alert.alert(t('debts.invalidAmount'), t('debts.installmentTooHighHint'));
    setSaving(true);
    try {
      const data = {
        type, name: name.trim(), creditor: creditor.trim() || null, initialAmount: parsedInitial,
        installmentAmount: parsedInstallment, frequency: type === 'fixed' ? frequency : parsedInstallment != null ? 'monthly' as const : null,
        firstDueDate: parsedInstallment != null ? firstDueDate : null, categoryId, paymentMethodId, notes: notes.trim() || null,
      };
      if (debtId != null) {
        await editDebt(debtId, data);
        showResult(t('debts.updated'));
        router.back();
      } else {
        const createdId = await addDebt(data);
        showResult(t('debts.created'));
        router.replace({ pathname: '/modal/manual-debt-detail', params: { id: String(createdId) } });
      }
    } catch (error) {
      Alert.alert(t('errors.couldNotSave'), error instanceof Error ? error.message : t('common.tryAgain'));
    } finally { setSaving(false); }
  };

  const categoryOptions = [
    { value: null, label: t('common.notSpecified') },
    ...categories.filter((item) => item.purpose === 'general').map((item) => ({ value: item.id, label: item.name, color: item.color })),
  ];
  const paymentOptions = [
    { value: null, label: t('common.notSpecified') },
    ...paymentMethods
      .filter((item) => item.active || item.id === paymentMethodId)
      .map((item) => ({ value: item.id, label: item.name, color: item.color })),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: debtId ? t('debts.edit') : t('debts.new') }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText style={styles.description}>{t('debts.formHint')}</ThemedText>
        <ThemedView style={styles.card}>
          <SimpleSelect disabled={debtId != null} label={t('debts.type')} value={type} onChange={setType} options={[
            { value: 'fixed', label: t('debts.fixed') }, { value: 'variable', label: t('debts.variable') },
          ]} />
          {debtId != null && <ThemedText style={styles.hint}>{t('debts.typeLockedHint')}</ThemedText>}
          <Field label={t('debts.name')} value={name} onChangeText={setName} colors={colors} placeholder={t('debts.namePlaceholder')} />
          <Field label={t('debts.creditor')} value={creditor} onChangeText={setCreditor} colors={colors} placeholder={t('debts.creditorPlaceholder')} />
          <Field label={t('debts.estimatedTotalDebt')} value={initialAmount} onChangeText={setInitialAmount} colors={colors} keyboardType="number-pad" editable={entryCount === 0} />
          {entryCount > 0 && <ThemedText style={styles.hint}>{t('debts.initialLockedHint')}</ThemedText>}
          {type === 'fixed' && (
            <>
              <Field label={t('debts.installmentAmount')} value={installmentAmount} onChangeText={setInstallmentAmount} colors={colors} keyboardType="number-pad" />
              <SimpleSelect label={t('debts.frequency')} value={frequency} onChange={setFrequency} options={[
                { value: 'weekly', label: t('debts.weekly') }, { value: 'monthly', label: t('debts.monthly') }, { value: 'annual', label: t('debts.annual') },
              ]} />
              <View style={styles.group}>
                <ThemedText style={styles.label}>{t('debts.firstDueDate')}</ThemedText>
                <Pressable onPress={() => setShowDate(true)} style={[styles.input, styles.dateButton, { borderColor: colors.border }]}>
                  <ThemedText>{formatDate(parseIsoDate(firstDueDate))}</ThemedText>
                </Pressable>
                {showDate && <DateTimePicker value={parseIsoDate(firstDueDate)} mode="date" onChange={(_, date) => { if (Platform.OS === 'android') setShowDate(false); if (date) setFirstDueDate(toDateString(date)); }} />}
              </View>
            </>
          )}
          {type === 'variable' && (
            <>
              <Field label={t('debts.variableEstimatedPayment')} value={installmentAmount} onChangeText={setInstallmentAmount} colors={colors} keyboardType="number-pad" placeholder={t('debts.optional')} />
              {parseAmount(installmentAmount) != null && (
                <View style={styles.group}>
                  <ThemedText style={styles.label}>{t('debts.nextEstimatedPaymentDate')}</ThemedText>
                  <Pressable onPress={() => setShowDate(true)} style={[styles.input, styles.dateButton, { borderColor: colors.border }]}><ThemedText>{formatDate(parseIsoDate(firstDueDate))}</ThemedText></Pressable>
                  {showDate && <DateTimePicker value={parseIsoDate(firstDueDate)} mode="date" onChange={(_, date) => { if (Platform.OS === 'android') setShowDate(false); if (date) setFirstDueDate(toDateString(date)); }} />}
                </View>
              )}
            </>
          )}
          <SimpleSelect label={t('debts.defaultCategory')} value={categoryId} onChange={setCategoryId} options={categoryOptions} />
          <SimpleSelect label={t('debts.defaultPaymentMethod')} value={paymentMethodId} onChange={setPaymentMethodId} options={paymentOptions} />
          <Field label={t('debts.notes')} value={notes} onChangeText={setNotes} colors={colors} multiline placeholder={t('debts.notesPlaceholder')} />
        </ThemedView>
        <Pressable disabled={saving} onPress={() => { void save(); }} style={[styles.primary, saving && styles.disabled]}>
          <ThemedText style={styles.primaryText}>{saving ? t('common.saving') : t('common.save')}</ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, colors, onChangeText, keyboardType, ...props }: React.ComponentProps<typeof TextInput> & { label: string; colors: typeof Colors.light }) {
  const isMoney = keyboardType === 'number-pad';
  return <View style={styles.group}><ThemedText style={styles.label}>{label}</ThemedText><TextInput {...props} keyboardType={keyboardType} onChangeText={isMoney ? (value) => onChangeText?.(formatCLPInput(value)) : onChangeText} placeholderTextColor={colors.icon} style={[styles.input, props.multiline && styles.multiline, { borderColor: colors.border, color: colors.text }]} /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 20, paddingBottom: 45, gap: 16 }, description: { opacity: 0.68, lineHeight: 20 },
  card: { borderRadius: 13, padding: 16, gap: 15 }, group: { gap: 7 }, label: { fontWeight: '600' }, hint: { opacity: 0.62, fontSize: 12, lineHeight: 17 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 }, multiline: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  dateButton: { justifyContent: 'center' }, primary: { minHeight: 49, borderRadius: 10, backgroundColor: '#0a7ea4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primaryText: { color: '#fff', fontWeight: '700' }, disabled: { opacity: 0.45 },
});
