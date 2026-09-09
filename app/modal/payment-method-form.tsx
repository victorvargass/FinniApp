import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, ToastAndroid, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColorPicker } from '@/components/ColorPicker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, LayoutTokens } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import type { PaymentMethodType } from '@/lib/types';

const TYPES: { value: PaymentMethodType; label: string }[] = [
  { value: 'cash', label: t('paymentMethods.cash') }, { value: 'debit', label: t('paymentMethods.debit') },
  { value: 'prepaid', label: t('paymentMethods.prepaid') }, { value: 'credit', label: t('paymentMethods.credit') },
];

function showDefaultConfirmation(name: string) {
  const message = t('paymentMethods.defaultConfirmation', { name });
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(t('paymentMethods.defaultTitle'), message);
}

function showResult(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(t('common.done'), message);
}

export default function PaymentMethodFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const {
    paymentMethods,
    settings,
    addPaymentMethod,
    editPaymentMethod,
    setPaymentMethodActive,
    setDefaultPaymentMethod,
    getPaymentMethodDeletionInfo,
    removePaymentMethod,
  } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const method = id ? paymentMethods.find((item) => item.id === Number(id)) : undefined;
  const [name, setName] = useState(method?.name ?? '');
  const [type, setType] = useState<PaymentMethodType>(method?.type ?? 'debit');
  const [billingDay, setBillingDay] = useState(method?.billingDay ? String(method.billingDay) : '25');
  const [color, setColor] = useState(method?.color ?? '#0B315B');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const day = Number(billingDay);
    if (!name.trim()) return Alert.alert(t('paymentMethods.missingName'), t('paymentMethods.missingNameHint'));
    if (type === 'credit' && (!Number.isInteger(day) || day < 1 || day > 31)) {
      return Alert.alert(t('paymentMethods.invalidDay'), t('paymentMethods.invalidDayHint'));
    }
    setSaving(true);
    try {
      const data = { name: name.trim(), type, billingDay: type === 'credit' ? day : null, color };
      if (method) await editPaymentMethod(method.id, data);
      else await addPaymentMethod(data);
      showResult(method ? t('paymentMethods.updated') : t('paymentMethods.saved'));
      router.back();
    } catch (error) {
      Alert.alert(t('errors.couldNotSave'), error instanceof Error ? error.message : t('common.tryAgain'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!method) return;
    if (settings.defaultPaymentMethodId === method.id) {
      Alert.alert(
        t('expenses.cannotDelete'), t('paymentMethods.favoriteBlockedHint')
      );
      return;
    }
    try {
      const info = await getPaymentMethodDeletionInfo(method.id);
      if (info.debtPlanCount > 0) {
        Alert.alert(
          t('expenses.cannotDelete'),
          t(info.debtPlanCount === 1 ? 'paymentMethods.debtDeleteOne' : 'paymentMethods.debtDeleteMany', { count: info.debtPlanCount })
        );
        return;
      }
      const expenseWarning = info.expenseCount > 0
        ? t('paymentMethods.expenseDeleteWarning', { count: info.expenseCount })
        : '';
      Alert.alert(
        t('paymentMethods.delete'),
        t('paymentMethods.deleteQuestion', { name: method.name, warning: expenseWarning }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => {
              setSaving(true);
              removePaymentMethod(method.id)
                .then(() => {
                  showResult(t('paymentMethods.deleted'));
                  router.back();
                })
                .catch((error) => Alert.alert(
                  t('errors.couldNotDelete'), error instanceof Error ? error.message : t('common.tryAgain')
                ))
                .finally(() => setSaving(false));
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(t('paymentMethods.reviewError'), error instanceof Error ? error.message : t('common.tryAgain'));
    }
  };

  return (
    <ThemedView style={styles.shell}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedText style={styles.label}>{t('common.name')}</ThemedText>
      <TextInput
        autoFocus={!method}
        placeholder={t('paymentMethods.namePlaceholder')}
        placeholderTextColor={colors.icon}
        value={name}
        onChangeText={setName}
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
      />
      <ThemedText style={styles.label}>{t('paymentMethods.type')}</ThemedText>
      {method ? (
        <View style={styles.types}>
          <View
            style={[
              styles.type,
              { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
            ]}
          >
            <ThemedText style={{ color: colors.primary, fontWeight: '700' }}>
              {TYPES.find((item) => item.value === method.type)?.label}
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={styles.types}>
          {TYPES.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setType(item.value)}
              style={[
                styles.type,
                { borderColor: colors.border },
                type === item.value && { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
              ]}>
              <ThemedText style={type === item.value ? { color: colors.primary, fontWeight: '700' } : undefined}>
                {item.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}
      <ThemedText style={styles.label}>{t('categories.color')}</ThemedText>
      <ColorPicker value={color} onChange={setColor} />
      {type === 'credit' && (
        <>
          <ThemedText style={styles.label}>{t('paymentMethods.billingDay')}</ThemedText>
          <TextInput
            keyboardType="number-pad"
            maxLength={2}
            value={billingDay}
            onChangeText={setBillingDay}
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          />
          <ThemedText style={styles.hint}>
            {t('paymentMethods.billingHint')}
          </ThemedText>
        </>
      )}
      {method?.type === 'credit' && (
        <View style={styles.creditActions}>
          <Pressable
            onPress={() => router.push({ pathname: '/modal/debts', params: { paymentMethodId: String(method.id) } })}
            style={[styles.secondaryButton, { borderColor: colors.border }]}>
            <Ionicons name="wallet-outline" size={20} color={colors.primary} />
            <ThemedText type="defaultSemiBold">{t('paymentMethods.installmentPurchases')}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/modal/card-cycles', params: { id: String(method.id) } })}
            style={[styles.cyclesButton, { borderColor: colors.border }]}>
            <ThemedText type="defaultSemiBold">{t('paymentMethods.cycles')}</ThemedText>
          </Pressable>
        </View>
      )}
      {method && (
        <View style={styles.preferences}>
          <View style={[styles.preferenceCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.preferenceCopy}>
              <ThemedText type="defaultSemiBold">{t('common.active')}</ThemedText>
            </View>
            <Switch
              value={method.active}
              onValueChange={(active) => {
                setPaymentMethodActive(method.id, active)
                  .then(() => showToast(t(active
                    ? 'paymentMethods.activatedToast'
                    : 'paymentMethods.deactivatedToast', { name: method.name })))
                  .catch(() => {
                    Alert.alert(t('errors.couldNotChange'), t('common.tryAgain'));
                  });
              }}
              trackColor={{ true: colors.primary }}
            />
          </View>
          <View style={[styles.preferenceCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.preferenceCopy}>
              <ThemedText type="defaultSemiBold">{t('paymentMethods.defaultMethod')}</ThemedText>
            </View>
            <Pressable
              accessibilityLabel={settings.defaultPaymentMethodId === method.id
                ? t('paymentMethods.removeFavorite', { name: method.name })
                : t('paymentMethods.markFavorite', { name: method.name })}
              accessibilityRole="button"
              disabled={!method.active}
              onPress={() => {
                const favorite = settings.defaultPaymentMethodId !== method.id;
                setDefaultPaymentMethod(favorite ? method.id : null)
                  .then(() => {
                    if (favorite) showDefaultConfirmation(method.name);
                  })
                  .catch((error) => {
                    Alert.alert(t('errors.couldNotChange'), error instanceof Error ? error.message : t('common.tryAgain'));
                  });
              }}
              style={[styles.favoriteButton, !method.active && styles.favoriteDisabled]}>
              <Ionicons
                name={settings.defaultPaymentMethodId === method.id ? 'star' : 'star-outline'}
                size={24}
                color={settings.defaultPaymentMethodId === method.id ? '#D88916' : colors.icon}
              />
            </Pressable>
          </View>
        </View>
      )}
      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, LayoutTokens.formFooterBottom),
          },
        ]}>
        <Pressable disabled={saving} onPress={save} style={[styles.save, saving && { opacity: 0.6 }]}>
          <ThemedText style={styles.saveText}>{method ? t('common.saveChanges') : t('paymentMethods.add')}</ThemedText>
        </Pressable>
        {method && settings.defaultPaymentMethodId !== method.id && (
          <Pressable
            disabled={saving}
            onPress={() => void confirmDelete()}
            style={styles.deleteButton}>
            <ThemedText style={styles.deleteText}>{t('paymentMethods.delete')}</ThemedText>
          </Pressable>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  container: { padding: 20, gap: 10, paddingBottom: 24 },
  label: { fontWeight: '700', marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, fontSize: 16, fontFamily: Fonts.regular },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  type: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  readonlyType: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 3 },
  preferences: { gap: 10, marginTop: 8 },
  preferenceCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 12, gap: 12 },
  preferenceCopy: { flex: 1, gap: 2 },
  favoriteButton: { padding: 6 },
  favoriteDisabled: { opacity: 0.35 },
  hint: { opacity: 0.65, fontSize: 13, lineHeight: 18 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 10, gap: 10 },
  save: { borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: '#0B315B' },
  saveText: { color: '#fff', fontWeight: '700' },
  cyclesButton: { borderWidth: 1, borderRadius: 10, padding: 13, alignItems: 'center' },
  creditActions: { gap: 10, marginTop: 8 },
  secondaryButton: { borderWidth: 1, borderRadius: 10, padding: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  deleteButton: { borderWidth: 1, borderColor: '#C93F4B', borderRadius: 10, padding: 13, alignItems: 'center' },
  deleteText: { color: '#C93F4B', fontWeight: '700' },
});
