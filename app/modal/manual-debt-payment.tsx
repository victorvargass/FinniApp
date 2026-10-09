import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SimpleSelect } from '@/components/simple-select';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, LayoutTokens } from '@/constants/theme';
import {
  useDebtDatabase,
  useOrganizerDatabase,
  usePaymentDatabase,
  usePeriodDatabase,
} from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { errorMessage, showFeedback } from '@/lib/feedback';
import { dateWithTime, toTimeString } from '@/lib/event-time';
import { formatCLP, formatCLPInput, formatDate, formatTime, parseAmount, toDateString } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getPaymentMethodOptionGroup } from '@/lib/payment-method-options';
import type { Debt, DebtDirection } from '@/lib/types';

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export default function DebtPaymentScreen() {
  const { debtId: debtIdParam, entryId: entryIdParam, direction: directionParam, contactId: contactIdParam } = useLocalSearchParams<{
    debtId?: string;
    entryId?: string;
    direction?: DebtDirection;
    contactId?: string;
  }>();
  const requestedDebtId = debtIdParam ? Number(debtIdParam) : null;
  const requestedContactId = contactIdParam ? Number(contactIdParam) : null;
  const entryId = entryIdParam ? Number(entryIdParam) : null;
  const requestedDirection: DebtDirection = directionParam === 'receivable' ? 'receivable' : 'payable';
  const navigation = useNavigation();
  const { periods, selectedPeriod, selectedPeriodId } = usePeriodDatabase();
  const { categories, incomeCategories } = useOrganizerDatabase();
  const { paymentMethods } = usePaymentDatabase();
  const {
    getDebts,
    getDebt,
    addDebtPayment,
    addDebtPayments,
    editDebtPayment,
    removeDebtPayment,
    setDebtArchived,
  } = useDebtDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [availableDebts, setAvailableDebts] = useState<Debt[]>([]);
  const [selectedDebtId, setSelectedDebtId] = useState<number | null>(
    requestedDebtId != null && Number.isInteger(requestedDebtId) ? requestedDebtId : null
  );
  const [settlementScope, setSettlementScope] = useState<'debt' | 'contact'>(
    requestedContactId != null && Number.isInteger(requestedContactId) ? 'contact' : 'debt'
  );
  const [selectedContactId, setSelectedContactId] = useState<number | null>(
    requestedContactId != null && Number.isInteger(requestedContactId) ? requestedContactId : null
  );
  const [debt, setDebt] = useState<Debt | null>(null);
  const [loadingDebts, setLoadingDebts] = useState(true);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toDateString(new Date()));
  const [time, setTime] = useState(toTimeString(new Date()));
  const [periodId, setPeriodId] = useState<number | null>(selectedPeriodId);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [saving, setSaving] = useState(false);

  const offerToArchivePaidDebts = async (debtIds: number[]) => {
    const settledDebts = (await Promise.all(debtIds.map((item) => getDebt(item))))
      .filter((item): item is Debt => item != null && item.status === 'paid');
    if (settledDebts.length === 0) {
      router.back();
      return;
    }
    const multiple = settledDebts.length > 1;
    Alert.alert(
      t(multiple ? 'debts.paidDebtsArchiveTitle' : 'debts.paidDebtArchiveTitle', {
        count: settledDebts.length,
      }),
      t(multiple ? 'debts.paidDebtsArchiveHint' : 'debts.paidDebtArchiveHint'),
      [
        { text: t('common.later'), style: 'cancel', onPress: () => router.back() },
        {
          text: t('debts.archivePaidAction'),
          onPress: () => {
            setSaving(true);
            void Promise.all(settledDebts.map((item) => setDebtArchived(item.id, true)))
              .then(() => {
                showFeedback(t(multiple ? 'debts.paidDebtsArchived' : 'debts.archived', {
                  count: settledDebts.length,
                }));
                router.dismissTo('/modal/debts');
              })
              .catch((error) => Alert.alert(t('errors.couldNotUpdate'), errorMessage(error)))
              .finally(() => setSaving(false));
          },
        },
      ],
      { cancelable: false }
    );
  };

  useEffect(() => {
    const direction = debt?.direction ?? requestedDirection;
    navigation.setOptions({
      title: direction === 'receivable'
        ? entryId == null ? t('debts.registerCollection') : t('debts.editCollection')
        : entryId == null ? t('debts.registerPayment') : t('debts.editPayment'),
    });
  }, [debt?.direction, entryId, navigation, requestedDirection]);

  useEffect(() => {
    let cancelled = false;
    setLoadingDebts(true);
    getDebts().then((rows) => {
      if (cancelled) return;
      const direction = debt?.direction ?? requestedDirection;
      setAvailableDebts(rows.filter((item) => (
        item.direction === direction && item.status === 'active' && item.currentBalance > 0
      )));
    }).finally(() => {
      if (!cancelled) setLoadingDebts(false);
    });
    return () => { cancelled = true; };
  }, [debt?.direction, getDebts, requestedDirection]);

  useEffect(() => {
    if (settlementScope !== 'contact') return;
    const firstDebt = availableDebts.find((item) => item.contactId === selectedContactId);
    setSelectedDebtId(firstDebt?.id ?? null);
  }, [availableDebts, selectedContactId, settlementScope]);

  useEffect(() => {
    if (selectedDebtId == null) {
      setDebt(null);
      return;
    }
    let cancelled = false;
    setLoadingDebts(true);
    getDebt(selectedDebtId).then((value) => {
      if (!value || cancelled) return;
      setDebt(value);
      const entry = entryId == null ? null : value.entries?.find((item) => item.id === entryId);
      const contactTotal = selectedContactId == null
        ? null
        : availableDebts
            .filter((item) => item.contactId === selectedContactId)
            .reduce((sum, item) => sum + item.currentBalance, 0);
      setAmount(formatCLPInput(entry?.amount ?? contactTotal ?? Math.min(value.installmentAmount ?? value.currentBalance, value.currentBalance)));
      const today = new Date();
      const defaultDate = selectedPeriod
        ? (toDateString(today) >= selectedPeriod.startDate && toDateString(today) <= selectedPeriod.endDate ? toDateString(today) : selectedPeriod.endDate)
        : toDateString(today);
      setDate(entry?.date ?? defaultDate);
      setTime(entry?.time ?? toTimeString(new Date()));
      setPeriodId(entry?.periodId ?? selectedPeriodId);
      const debtPaymentCategoryName = t('database.defaultCategories.debtPayment');
      const defaultCategoryId = value.direction === 'receivable'
        ? incomeCategories.find((item) => item.name.localeCompare(debtPaymentCategoryName, undefined, { sensitivity: 'base' }) === 0)?.id
        : categories.find((item) => item.name.localeCompare(debtPaymentCategoryName, undefined, { sensitivity: 'base' }) === 0)?.id;
      setCategoryId(entry?.categoryId ?? (value.direction === 'receivable' ? value.incomeCategoryId : value.categoryId) ?? defaultCategoryId ?? null);
      setPaymentMethodId(entry?.paymentMethodId ?? value.paymentMethodId);
      setNote(entry?.note ?? '');
    }).catch(() => undefined).finally(() => {
      if (!cancelled) setLoadingDebts(false);
    });
    return () => { cancelled = true; };
  }, [availableDebts, categories, entryId, getDebt, incomeCategories, selectedContactId, selectedDebtId, selectedPeriod, selectedPeriodId]);

  const save = async () => {
    if (!debt) return;
    const parsedAmount = parseAmount(amount);
    if (parsedAmount == null || periodId == null) return Alert.alert(t('debts.missingPaymentData'), t('debts.missingPaymentDataHint'));
    setSaving(true);
    try {
      const commonData = { date, time, periodId, categoryId, paymentMethodId, note: note.trim() || null };
      let affectedDebtIds: number[];
      if (entryId == null && selectedContactId != null) {
        const contactDebts = availableDebts.filter((item) => item.contactId === selectedContactId);
        await addDebtPayments({
          ...commonData,
          payments: contactDebts.map((item) => ({ debtId: item.id, amount: item.currentBalance })),
        });
        affectedDebtIds = contactDebts.map((item) => item.id);
      } else {
        affectedDebtIds = [debt.id];
        if (entryId == null) await addDebtPayment(debt.id, { ...commonData, amount: parsedAmount });
        else await editDebtPayment(entryId, { ...commonData, amount: parsedAmount });
      }
      showFeedback(debt?.direction === 'receivable'
        ? entryId == null ? t('debts.collectionRegistered') : t('debts.collectionUpdated')
        : entryId == null ? t('debts.paymentRegistered') : t('debts.paymentUpdated'));
      await offerToArchivePaidDebts(affectedDebtIds);
    } catch (error) {
      Alert.alert(t('errors.couldNotSave'), errorMessage(error));
    } finally { setSaving(false); }
  };

  const confirmDelete = () => {
    if (entryId == null) return;
    Alert.alert(
      t(debt?.direction === 'receivable' ? 'debts.deleteCollection' : 'debts.deletePayment'),
      t(debt?.direction === 'receivable' ? 'debts.deleteCollectionHint' : 'debts.deletePaymentHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => {
        setSaving(true);
        removeDebtPayment(entryId).then(() => { showFeedback(t(debt?.direction === 'receivable' ? 'debts.collectionDeleted' : 'debts.paymentDeleted')); router.back(); })
          .catch((error) => Alert.alert(t('errors.couldNotDelete'), errorMessage(error)))
          .finally(() => setSaving(false));
      } },
      ]
    );
  };

  const effectiveDirection = debt?.direction ?? requestedDirection;
  const canSelectDebt = entryId == null && requestedDebtId == null;
  const contactDebts = selectedContactId == null
    ? []
    : availableDebts.filter((item) => item.contactId === selectedContactId);
  const contactBalance = contactDebts.reduce((sum, item) => sum + item.currentBalance, 0);
  const contactOptions = Array.from(
    availableDebts.reduce((contacts, item) => {
      if (item.contactId == null || !item.contactName) return contacts;
      const current = contacts.get(item.contactId);
      contacts.set(item.contactId, {
        value: item.contactId,
        label: item.contactName,
        total: (current?.total ?? 0) + item.currentBalance,
      });
      return contacts;
    }, new Map<number, { value: number; label: string; total: number }>()).values()
  ).map((item) => ({ value: item.value, label: `${item.label} · ${formatCLP(item.total)}` }));
  const debtOptions = availableDebts.map((item) => ({
    value: item.id,
    label: `${item.name} · ${formatCLP(item.currentBalance)}`,
    group: item.contactName ?? item.creditor ?? t('common.notSpecified'),
  }));
  const periodOptions = periods.map((item) => ({ value: item.id, label: `${formatDate(parseIsoDate(item.startDate))} – ${formatDate(parseIsoDate(item.endDate))}` }));
  const categoryOptions = [{ value: null, label: t('common.notSpecified') }, ...(effectiveDirection === 'receivable'
    ? incomeCategories
    : categories.filter((item) => item.purpose === 'general' && item.systemKey == null)
  ).map((item) => ({ value: item.id, label: item.name, color: item.color }))];
  const paymentOptions = [
    { value: null, label: t('common.notSpecified') },
    ...paymentMethods
      .filter((item) => (item.active || item.id === paymentMethodId) && (effectiveDirection !== 'receivable' || item.type !== 'credit'))
      .map((item) => ({
        value: item.id,
        label: `${item.name} · ${t(`paymentMethods.${item.type}`)}`,
        color: item.color,
        ...getPaymentMethodOptionGroup(item.type),
      })),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {canSelectDebt && (
          <ThemedView style={styles.card}>
            {contactOptions.length > 0 && (
              <View style={styles.scopeRow}>
                <Pressable
                  onPress={() => { setSettlementScope('debt'); setSelectedContactId(null); setSelectedDebtId(null); }}
                  style={[styles.scopeButton, { borderColor: colors.border }, settlementScope === 'debt' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  <ThemedText style={settlementScope === 'debt' && { color: colors.onPrimary }}>{t('debts.specificDebt')}</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => { setSettlementScope('contact'); setSelectedDebtId(null); }}
                  style={[styles.scopeButton, { borderColor: colors.border }, settlementScope === 'contact' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  <ThemedText style={settlementScope === 'contact' && { color: colors.onPrimary }}>{t('debts.fullContactBalance')}</ThemedText>
                </Pressable>
              </View>
            )}
            {settlementScope === 'contact' ? (
              <SimpleSelect
                searchable
                modalSize="large"
                label={t(effectiveDirection === 'receivable' ? 'debts.selectDebtorContact' : 'debts.selectCreditorContact')}
                value={selectedContactId}
                onChange={setSelectedContactId}
                options={[{ value: null, label: t('debts.chooseContact') }, ...contactOptions]}
              />
            ) : (
              <SimpleSelect
                searchable
                modalSize="large"
                label={t(effectiveDirection === 'receivable' ? 'debts.selectReceivableDebt' : 'debts.selectPayableDebt')}
                value={selectedDebtId}
                onChange={setSelectedDebtId}
                options={[{ value: null, label: t('debts.chooseDebt') }, ...debtOptions]}
              />
            )}
          </ThemedView>
        )}
        {loadingDebts && !debt && <View style={styles.center}><ThemedText>{t('common.loading')}</ThemedText></View>}
        {!loadingDebts && !debt && (
          <ThemedView style={styles.emptyCard}>
            <ThemedText style={styles.emptyText}>
              {availableDebts.length === 0
                ? t(effectiveDirection === 'receivable' ? 'debts.noReceivableDebts' : 'debts.noPayableDebts')
                : t('debts.chooseDebt')}
            </ThemedText>
            {availableDebts.length === 0 && (
              <Pressable onPress={() => router.replace({ pathname: '/modal/manual-debt-form', params: { direction: effectiveDirection } })} style={[styles.secondaryButton, { borderColor: colors.primary }]}>
                <ThemedText style={{ color: colors.primary, fontWeight: '700' }}>{t('debts.createDebt')}</ThemedText>
              </Pressable>
            )}
          </ThemedView>
        )}
        {debt && <>
          <ThemedView style={styles.balanceCard}>
            <ThemedText>{selectedContactId != null ? debt.contactName ?? debt.name : debt.name}</ThemedText>
            {selectedContactId != null && <ThemedText style={styles.secondary}>{t('debts.debtsIncluded', { count: contactDebts.length })}</ThemedText>}
            <View style={styles.row}><ThemedText style={styles.secondary}>{t('debts.currentBalance')}</ThemedText><ThemedText type="defaultSemiBold">{formatCLP(selectedContactId != null ? contactBalance : debt.currentBalance)}</ThemedText></View>
          </ThemedView>
          <ThemedView style={styles.card}>
          <View style={styles.group}>
            <View style={styles.amountHeader}>
              <ThemedText style={styles.label}>{t('common.amount')}</ThemedText>
              {selectedContactId == null && <Pressable hitSlop={8} onPress={() => setAmount(formatCLPInput(debt.currentBalance))}>
                <ThemedText style={[styles.fullBalance, { color: colors.action }]}>{t('debts.useFullBalance')}</ThemedText>
              </Pressable>}
            </View>
            <TextInput editable={selectedContactId == null} keyboardType="number-pad" testID="debt-payment-amount-input" value={amount} onChangeText={(value) => setAmount(formatCLPInput(value))} style={[styles.input, selectedContactId != null && styles.disabled, { borderColor: colors.border, color: colors.text }]} />
          </View>
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
          <View style={styles.group}>
            <ThemedText style={styles.label}>{t('common.time')}</ThemedText>
            <Pressable onPress={() => setShowTime(true)} style={[styles.input, styles.dateButton, { borderColor: colors.border }]}><ThemedText>{formatTime(dateWithTime(parseIsoDate(date), time))}</ThemedText></Pressable>
            {showTime && <DateTimePicker value={dateWithTime(parseIsoDate(date), time)} mode="time" onChange={(_, value) => { if (Platform.OS === 'android') setShowTime(false); if (value) setTime(toTimeString(value)); }} />}
          </View>
          <SimpleSelect searchable label={t('debts.category')} value={categoryId} onChange={setCategoryId} options={categoryOptions} />
          <SimpleSelect label={t(effectiveDirection === 'receivable' ? 'debts.collectionDestination' : 'debts.paymentMethod')} value={paymentMethodId} onChange={setPaymentMethodId} options={paymentOptions} />
          <View style={styles.group}><ThemedText style={styles.label}>{t('debts.paymentNote')}</ThemedText><TextInput multiline value={note} onChangeText={setNote} placeholder={t('debts.paymentNotePlaceholder')} placeholderTextColor={colors.icon} style={[styles.input, styles.multiline, { borderColor: colors.border, color: colors.text }]} /></View>
        </ThemedView>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void save(); }} style={[styles.primary, saving && styles.disabled]} testID="debt-payment-save"><ThemedText style={styles.primaryText}>{saving ? t('common.saving') : t(effectiveDirection === 'receivable' ? 'debts.saveCollection' : 'debts.savePayment')}</ThemedText></Pressable>
          {entryId != null && <Pressable disabled={saving} onPress={confirmDelete} style={styles.danger}><ThemedText style={styles.dangerText}>{t(effectiveDirection === 'receivable' ? 'debts.deleteCollection' : 'debts.deletePayment')}</ThemedText></Pressable>}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, center: { minHeight: 120, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, paddingBottom: LayoutTokens.formScrollBottom, gap: 15 },
  balanceCard: { borderRadius: 12, padding: 15, gap: 8 }, card: { borderRadius: 12, padding: 16, gap: 15 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, secondary: { opacity: 0.65 },
  emptyCard: { minHeight: 150, borderRadius: 12, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 16 }, emptyText: { textAlign: 'center' }, secondaryButton: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  scopeRow: { flexDirection: 'row', gap: 8 }, scopeButton: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  group: { gap: 7 }, amountHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, label: { fontWeight: '600' }, fullBalance: { fontWeight: '700', fontSize: 13 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, fontFamily: Fonts.regular }, dateButton: { justifyContent: 'center' },
  multiline: { minHeight: 82, paddingTop: 12, textAlignVertical: 'top' }, primary: { minHeight: 49, borderRadius: 10, backgroundColor: '#0B315B', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontWeight: '700' },
  danger: { minHeight: 48, borderWidth: 1, borderColor: '#C93F4B', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, dangerText: { color: '#C93F4B', fontWeight: '700' }, disabled: { opacity: 0.45 },
});
