import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, LayoutTokens } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLPInput, formatDate, parseNonNegativeAmount, toDateString } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { PaymentMethod, PaymentMethodType } from '@/lib/types';
import { showToast } from '@/lib/toast';

const SECTION_ORDER: PaymentMethodType[] = ['cash', 'debit', 'prepaid', 'credit'];

function displayDate(value?: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return formatDate(new Date(`${value}T12:00:00`));
}

function initialBalance(method: PaymentMethod): string {
  return method.availableBalance != null && method.availableBalance >= 0
    ? formatCLPInput(method.availableBalance)
    : '';
}

export default function PeriodOpeningBalancesScreen() {
  const { start, end } = useLocalSearchParams<{ start?: string; end?: string }>();
  const insets = useSafeAreaInsets();
  const colors = Colors[useColorScheme() ?? 'light'];
  const { paymentMethods, updatePaymentMethodBalances } = useDatabase();
  const [balances, setBalances] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const balanceDate = toDateString(new Date());

  const activeMethods = useMemo(
    () => paymentMethods
      .filter((method) => method.active)
      .sort((left, right) => left.name.localeCompare(right.name)),
    [paymentMethods]
  );
  const sections = useMemo(
    () => SECTION_ORDER.map((type) => ({
      type,
      methods: activeMethods.filter((method) => method.type === type),
    })).filter((section) => section.methods.length > 0),
    [activeMethods]
  );

  useEffect(() => {
    setBalances((current) => {
      const next = { ...current };
      for (const method of activeMethods) {
        if (!(method.id in next)) next[method.id] = initialBalance(method);
      }
      return next;
    });
  }, [activeMethods]);

  const confirm = async () => {
    const updates = [];
    for (const method of activeMethods) {
      const balance = parseNonNegativeAmount(balances[method.id] ?? '');
      if (balance == null) {
        Alert.alert(
          t('common.error'),
          t('period.openingBalancesMissing', { name: method.name })
        );
        return;
      }
      updates.push({ id: method.id, balance, date: balanceDate });
    }

    setSaving(true);
    try {
      await updatePaymentMethodBalances(updates);
      showToast(t('period.openingBalancesSaved'));
      router.back();
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('period.openingBalancesError')
      );
    } finally {
      setSaving(false);
    }
  };

  const startLabel = displayDate(start);
  const endLabel = displayDate(end);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <ThemedText type="title">{t('period.openingBalancesHeading')}</ThemedText>
          <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
            {t('period.openingBalancesDescription')}
          </ThemedText>
          {startLabel && endLabel && (
            <ThemedText style={[styles.periodDates, { color: colors.textSecondary }]}>
              {t('period.openingBalancesPeriod', { start: startLabel, end: endLabel })}
            </ThemedText>
          )}
          <ThemedText style={[styles.balanceDate, { color: colors.action }]}>
            {t('period.openingBalancesDate', { date: displayDate(balanceDate) ?? balanceDate })}
          </ThemedText>
        </View>

        {sections.map((section) => (
          <View key={section.type} style={styles.section}>
            <ThemedText type="subtitle">{t(`paymentMethods.${section.type}`)}</ThemedText>
            <ThemedView
              style={[
                styles.sectionCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              {section.methods.map((method, index) => (
                <View
                  key={method.id}
                  style={[
                    styles.method,
                    index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                  ]}>
                  <View style={styles.methodHeader}>
                    <View style={[styles.colorDot, { backgroundColor: method.color }]} />
                    <View style={styles.methodCopy}>
                      <ThemedText type="defaultSemiBold">{method.name}</ThemedText>
                      <ThemedText style={[styles.methodHint, { color: colors.textSecondary }]}>
                        {t(method.type === 'credit'
                          ? 'paymentMethods.availableCredit'
                          : 'paymentMethods.availableBalance')}
                      </ThemedText>
                    </View>
                  </View>
                  <TextInput
                    accessibilityLabel={t('period.openingBalanceInput', { name: method.name })}
                    keyboardType="number-pad"
                    value={balances[method.id] ?? ''}
                    onChangeText={(value) => {
                      setBalances((current) => ({
                        ...current,
                        [method.id]: formatCLPInput(value),
                      }));
                    }}
                    placeholder="$0"
                    placeholderTextColor={colors.icon}
                    style={[
                      styles.input,
                      { color: colors.text, borderColor: colors.border, backgroundColor: colors.screen },
                    ]}
                  />
                </View>
              ))}
            </ThemedView>
          </View>
        ))}

        <ThemedText style={[styles.footerHint, { color: colors.textSecondary }]}>
          {t('period.openingBalancesHint')}
        </ThemedText>
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
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: colors.border },
            (pressed || saving) && styles.pressed,
          ]}>
          <ThemedText type="defaultSemiBold">{t('common.skip')}</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          testID="opening-balances-confirm"
          disabled={saving}
          onPress={() => { void confirm(); }}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary },
            (pressed || saving) && styles.pressed,
          ]}>
          <ThemedText style={[styles.primaryText, { color: colors.onPrimary }]}>
            {saving ? t('common.saving') : t('common.confirm')}
          </ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: LayoutTokens.formScrollBottom, gap: 22 },
  intro: { gap: 8 },
  description: { fontSize: 15, lineHeight: 22 },
  periodDates: { fontSize: 14, lineHeight: 20 },
  balanceDate: { fontFamily: Fonts.semiBold, fontSize: 14, lineHeight: 20 },
  section: { gap: 10 },
  sectionCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  method: { padding: 14, gap: 12 },
  methodHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorDot: { width: 14, height: 14, borderRadius: 4 },
  methodCopy: { flex: 1, gap: 2 },
  methodHint: { fontSize: 13 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontFamily: Fonts.regular,
    fontSize: 17,
  },
  footerHint: { fontSize: 13, lineHeight: 19 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: Fonts.bold },
  pressed: { opacity: 0.62 },
});
