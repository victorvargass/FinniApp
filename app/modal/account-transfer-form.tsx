import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColorSelect } from '@/components/forms/shared';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, LayoutTokens } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatCLPInput, formatDate, parseAmount, toDateString } from '@/lib/format';
import { t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import type { AccountTransfer, NewAccountTransfer, PaymentMethod } from '@/lib/types';

export default function AccountTransferFormScreen() {
  const { id, sourcePaymentMethodId } = useLocalSearchParams<{ id?: string; sourcePaymentMethodId?: string }>();
  const transferId = Number(id);
  const requestedSourceId = Number(sourcePaymentMethodId);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colors = Colors[useColorScheme() ?? 'light'];
  const {
    paymentMethods,
    settings,
    getAccountTransfer,
    addAccountTransfer,
    editAccountTransfer,
    removeAccountTransfer,
  } = useDatabase();
  const [existing, setExisting] = useState<AccountTransfer | null>(null);
  const [loading, setLoading] = useState(Number.isInteger(transferId));
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toDateString(new Date()));
  const [note, setNote] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);

  const transferAccounts = useMemo(() => paymentMethods.filter((method) => (
    method.type !== 'credit' && (method.active || method.id === existing?.sourcePaymentMethodId || method.id === existing?.destinationPaymentMethodId)
  )), [existing, paymentMethods]);

  useEffect(() => {
    navigation.setOptions({ title: Number.isInteger(transferId) ? t('transfers.edit') : t('transfers.new') });
  }, [navigation, transferId]);

  useEffect(() => {
    if (!Number.isInteger(transferId)) return;
    let cancelled = false;
    getAccountTransfer(transferId)
      .then((transfer) => {
        if (cancelled) return;
        setExisting(transfer);
        if (transfer) {
          setSourceId(transfer.sourcePaymentMethodId);
          setDestinationId(transfer.destinationPaymentMethodId);
          setAmount(formatCLPInput(transfer.amount));
          setDate(transfer.date);
          setNote(transfer.note ?? '');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [getAccountTransfer, transferId]);

  useEffect(() => {
    if (Number.isInteger(transferId) || transferAccounts.length < 1 || sourceId != null) return;
    const preferredId = Number.isInteger(requestedSourceId)
      ? requestedSourceId
      : settings.defaultPaymentMethodId;
    const preferred = transferAccounts.find((method) => method.id === preferredId) ?? transferAccounts[0];
    setSourceId(preferred.id);
  }, [requestedSourceId, settings.defaultPaymentMethodId, sourceId, transferAccounts, transferId]);

  useEffect(() => {
    if (destinationId != null && destinationId !== sourceId) return;
    setDestinationId(transferAccounts.find((method) => method.id !== sourceId)?.id ?? null);
  }, [destinationId, sourceId, transferAccounts]);

  const source = transferAccounts.find((method) => method.id === sourceId);
  const isSourceLocked = !Number.isInteger(transferId)
    && Number.isInteger(requestedSourceId)
    && source?.id === requestedSourceId;
  const parsedAmount = parseAmount(amount);
  const projectedSourceBalance = getProjectedSourceBalance(source, existing, sourceId, destinationId, parsedAmount);
  const exceedsBalance = projectedSourceBalance != null && projectedSourceBalance < 0;
  const accountOptions = transferAccounts.map((method) => ({ value: method.id, label: method.name, color: method.color }));
  const destinationOptions = accountOptions.filter((option) => option.value !== sourceId);

  const persist = async () => {
    if (sourceId == null || destinationId == null) {
      Alert.alert(t('common.error'), t('transfers.incomplete'));
      return;
    }
    if (sourceId === destinationId) {
      Alert.alert(t('common.error'), t('transfers.sameAccount'));
      return;
    }
    if (parsedAmount == null) {
      Alert.alert(t('common.error'), t('transfers.invalidAmount'));
      return;
    }
    const data: NewAccountTransfer = {
      sourcePaymentMethodId: sourceId,
      destinationPaymentMethodId: destinationId,
      amount: parsedAmount,
      date,
      note: note.trim() || null,
    };
    setSaving(true);
    try {
      if (Number.isInteger(transferId)) {
        await editAccountTransfer(transferId, data);
        showToast(t('transfers.updated'));
      } else {
        await addAccountTransfer(data);
        showToast(t('transfers.created'));
      }
      router.back();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('errors.couldNotSave'));
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (exceedsBalance) {
      Alert.alert(t('transfers.confirmExcessTitle'), t('transfers.confirmExcessDescription'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.continue'), style: 'destructive', onPress: () => { void persist(); } },
      ]);
      return;
    }
    void persist();
  };

  const remove = () => {
    Alert.alert(t('transfers.delete'), t('transfers.deleteQuestion'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          removeAccountTransfer(transferId)
            .then(() => {
              showToast(t('transfers.deleted'));
              router.back();
            })
            .catch((error) => Alert.alert(t('common.error'), error instanceof Error ? error.message : t('errors.couldNotDelete')))
            .finally(() => setSaving(false));
        },
      },
    ]);
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.action} /></View></SafeAreaView>;
  }
  if (Number.isInteger(transferId) && !existing) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ThemedText>{t('database.transferMissing')}</ThemedText></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.shell}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedView style={styles.explanation}>
            <Ionicons name="swap-horizontal-outline" size={24} color={colors.action} />
            <ThemedText style={[styles.explanationText, { color: colors.textSecondary }]}>{t('transfers.accountHistory')}</ThemedText>
          </ThemedView>

          <ColorSelect
            label={t('transfers.from')}
            value={sourceId}
            options={accountOptions}
            onChange={setSourceId}
            disabled={isSourceLocked}
          />
          {source && (
            <ThemedText style={[styles.balanceHint, { color: exceedsBalance ? colors.danger : colors.textSecondary }]}>
              {source.availableBalance == null
                ? t('transfers.noBalance')
                : t('transfers.available', { amount: formatCLP(source.availableBalance) })}
            </ThemedText>
          )}
          {destinationOptions.length > 0 ? (
            <ColorSelect label={t('transfers.to')} value={destinationId} options={destinationOptions} onChange={setDestinationId} />
          ) : (
            <ThemedView style={styles.emptyAccounts}>
              <ThemedText type="defaultSemiBold">{t('transfers.noDestinationTitle')}</ThemedText>
              <ThemedText style={{ color: colors.textSecondary }}>{t('transfers.noDestinationDescription')}</ThemedText>
              <Pressable onPress={() => router.push('/modal/payment-method-form')}>
                <ThemedText type="defaultSemiBold" style={{ color: colors.action }}>{t('paymentMethods.add')}</ThemedText>
              </Pressable>
            </ThemedView>
          )}

          <ThemedText style={styles.label}>{t('transfers.amount')}</ThemedText>
          <TextInput
            keyboardType="number-pad"
            value={amount}
            onChangeText={(value) => setAmount(formatCLPInput(value))}
            placeholder="$0"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          {exceedsBalance && source && projectedSourceBalance != null && (
            <ThemedText style={[styles.warning, { color: colors.danger }]}>
              {t('transfers.exceedsBalance', { name: source.name, amount: formatCLP(Math.abs(projectedSourceBalance)) })}
            </ThemedText>
          )}

          <ThemedText style={styles.label}>{t('transfers.date')}</ThemedText>
          <Pressable onPress={() => setShowDate(true)} style={[styles.input, styles.dateButton, { borderColor: colors.border }]}>
            <ThemedText>{formatDate(new Date(`${date}T12:00:00`))}</ThemedText>
          </Pressable>
          {showDate && (
            <DateTimePicker
              maximumDate={new Date()}
              value={new Date(`${date}T12:00:00`)}
              mode="date"
              onChange={(_, value) => {
                if (Platform.OS === 'android') setShowDate(false);
                if (value) setDate(toDateString(value));
              }}
            />
          )}

          <ThemedText style={styles.label}>{t('transfers.note')}</ThemedText>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('transfers.notePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />

          {Number.isInteger(transferId) && (
            <Pressable disabled={saving} onPress={remove} style={[styles.deleteButton, { borderColor: colors.danger }]}>
              <ThemedText type="defaultSemiBold" style={{ color: colors.danger }}>{t('transfers.delete')}</ThemedText>
            </Pressable>
          )}
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, LayoutTokens.formFooterBottom) }]}>
          <Pressable disabled={saving || transferAccounts.length < 2} onPress={save} style={[styles.primary, (saving || transferAccounts.length < 2) && styles.disabled]}>
            <ThemedText style={styles.primaryText}>{saving ? t('common.saving') : Number.isInteger(transferId) ? t('common.saveChanges') : t('transfers.create')}</ThemedText>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function getProjectedSourceBalance(
  source: PaymentMethod | undefined,
  existing: AccountTransfer | null,
  sourceId: number | null,
  destinationId: number | null,
  amount: number | null
) {
  if (source?.availableBalance == null || amount == null) return null;
  let available = source.availableBalance;
  if (existing?.sourcePaymentMethodId === sourceId) available += existing.amount;
  if (existing?.destinationPaymentMethodId === sourceId) available -= existing.amount;
  if (sourceId !== destinationId) available -= amount;
  return available;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  shell: { flex: 1 },
  content: { padding: 20, paddingBottom: LayoutTokens.formScrollBottom, gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  explanation: { borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  explanationText: { flex: 1, lineHeight: 20 },
  label: { marginTop: 8, marginBottom: 4, fontWeight: '600' },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontFamily: Fonts.regular, fontSize: 16 },
  dateButton: { justifyContent: 'center' },
  balanceHint: { fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  warning: { fontSize: 13, lineHeight: 19, fontFamily: Fonts.semiBold },
  emptyAccounts: { borderRadius: 12, padding: 14, gap: 6 },
  deleteButton: { minHeight: 50, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 10 },
  primary: { minHeight: 50, borderRadius: 10, backgroundColor: '#0B315B', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
