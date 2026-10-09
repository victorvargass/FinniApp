import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/floating-action-button';
import { FeatureGuide, FeatureGuideButton, useFeatureGuide } from '@/components/feature-guide';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { usePaymentDatabase, usePreferenceDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getAvailablePaymentMethodSections, groupPaymentMethodsByType } from '@/lib/payment-method-groups';
import { showToast } from '@/lib/toast';

function showDefaultConfirmation(name: string) {
  showToast(t('paymentMethods.defaultConfirmation', { name }));
}

export default function PaymentMethodsScreen() {
  const { section: requestedSectionParam } = useLocalSearchParams<{ section?: string }>();
  const { paymentMethods, setDefaultPaymentMethod } = usePaymentDatabase();
  const { settings } = usePreferenceDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const requestedSection = requestedSectionParam === 'credit'
    || requestedSectionParam === 'prepaid'
    || requestedSectionParam === 'accounts'
    ? requestedSectionParam
    : null;
  const [methodSection, setMethodSection] = useState<'accounts' | 'prepaid' | 'credit'>(
    requestedSection ?? 'accounts'
  );
  const appliedRequestedSection = useRef(false);
  const guide = useFeatureGuide('payment-methods');
  const guideSlides = [
    {
      icon: 'business-outline' as const,
      title: t('featureGuides.paymentMethods.startTitle'),
      body: t('featureGuides.paymentMethods.startBody'),
    },
    {
      icon: 'card-outline' as const,
      title: t('featureGuides.paymentMethods.conceptsTitle'),
      body: t('featureGuides.paymentMethods.conceptsBody'),
    },
    {
      icon: 'calculator-outline' as const,
      title: t('featureGuides.paymentMethods.trackingTitle'),
      body: t('featureGuides.paymentMethods.trackingBody'),
    },
    {
      icon: 'sync-outline' as const,
      title: t('featureGuides.paymentMethods.syncTitle'),
      body: t('featureGuides.paymentMethods.syncBody'),
    },
    {
      icon: 'time-outline' as const,
      title: t('featureGuides.paymentMethods.historyTitle'),
      body: t('featureGuides.paymentMethods.historyBody'),
    },
  ];
  const typeLabels = {
    cash: t('paymentMethods.cash'),
    debit: t('paymentMethods.debit'),
    prepaid: t('paymentMethods.prepaid'),
    credit: t('paymentMethods.credit'),
  };
  const methodSections = useMemo(() => getAvailablePaymentMethodSections(paymentMethods).map((value) => ({
    value,
    label: value === 'accounts'
      ? t('paymentMethods.accountsTab')
      : t(`paymentMethods.${value}`),
  })), [paymentMethods]);
  useEffect(() => {
    if (
      !appliedRequestedSection.current
      && requestedSection
      && methodSections.some((section) => section.value === requestedSection)
    ) {
      appliedRequestedSection.current = true;
      setMethodSection(requestedSection);
      return;
    }
    if (methodSections.length === 0) return;
    if (!methodSections.some((section) => section.value === methodSection)) {
      setMethodSection(methodSections[0]?.value ?? 'accounts');
    }
  }, [methodSection, methodSections, requestedSection]);
  const visiblePaymentMethods = paymentMethods.filter((method) => {
    if (methodSection === 'accounts') return method.type === 'cash' || method.type === 'debit';
    return method.type === methodSection;
  });
  const sections = groupPaymentMethodsByType(visiblePaymentMethods).map((section) => ({
    ...section,
    title: typeLabels[section.type],
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.guideHeader}>
              <ThemedText style={styles.description}>
                {t('paymentMethods.description')}
              </ThemedText>
              <FeatureGuideButton onPress={guide.open} />
            </View>
            {methodSections.length > 1 && (
              <SegmentedTabs
                value={methodSection}
                onChange={setMethodSection}
                options={methodSections}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          <ThemedView style={[styles.empty, { borderColor: colors.border }]}>
            <Ionicons name="wallet-outline" size={32} color={colors.icon} />
            <ThemedText style={styles.emptyText}>{t('paymentMethods.emptySection')}</ThemedText>
          </ThemedView>
        }
        renderSectionHeader={({ section }) => (
          <ThemedText accessibilityRole="header" style={styles.sectionTitle} type="defaultSemiBold">
            {section.title}
          </ThemedText>
        )}
        renderItem={({ item }) => {
          const compactAccount = item.type === 'cash' || item.type === 'debit';
          return (
          <ThemedView style={[
            styles.card,
            compactAccount && styles.compactCard,
            !item.active && styles.inactive,
          ]}>
            <View style={[
              styles.colorDot,
              compactAccount && styles.compactColorDot,
              { backgroundColor: item.color },
            ]} />
            <Pressable
              onPress={() => router.push({ pathname: '/modal/payment-method-detail', params: { id: String(item.id) } })}
              style={styles.main}>
              <View style={[styles.copy, compactAccount && styles.compactCopy]}>
                <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                {item.type === 'credit' && (
                  <ThemedText type="defaultSemiBold" style={styles.balanceHeading}>
                    {t('paymentMethods.availableCredits')}
                  </ThemedText>
                )}
                {item.availableBalance == null ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={(event) => {
                        event.stopPropagation();
                        router.push({
                          pathname: '/modal/payment-method-balance',
                          params: { id: String(item.id) },
                        });
                      }}
                      style={styles.configureBalance}>
                      <Ionicons name="sync-outline" size={15} color={colors.action} />
                      <ThemedText type="defaultSemiBold" style={[styles.balance, { color: colors.action }]}>
                        {item.type === 'credit'
                          ? `CLP — · ${t('paymentMethods.configureCurrentBalance')}`
                          : t('paymentMethods.configureCurrentBalance')}
                      </ThemedText>
                    </Pressable>
                  ) : (
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.balance, compactAccount && styles.compactBalance]}>
                      {item.type === 'credit'
                        ? `CLP ${formatCLP(item.availableBalance)}`
                        : `${t('paymentMethods.availableBalance')}: ${formatCLP(item.availableBalance)}`}
                    </ThemedText>
                  )}
                {item.usdCreditLimitCents != null && (
                  <ThemedText type="defaultSemiBold" style={styles.balance}>
                    {formatMoney(item.usdAvailableCreditCents ?? 0, 'USD')}
                  </ThemedText>
                )}
                {item.type === 'credit' && (
                  <View style={styles.billedRow}>
                    <ThemedText style={[styles.billedLabel, { color: colors.textSecondary }]}>
                      {t('paymentMethods.pendingBilled')}
                    </ThemedText>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.billedAmount, { color: item.billedAmount > 0 ? colors.expense : colors.textSecondary }]}>
                      {formatCLP(item.billedAmount)}
                    </ThemedText>
                  </View>
                )}
              </View>
            </Pressable>
            <Pressable
              accessibilityLabel={settings.defaultPaymentMethodId === item.id
                ? t('paymentMethods.removeDefault', { name: item.name })
                : t('paymentMethods.useAsDefault', { name: item.name })}
              accessibilityRole="button"
              disabled={!item.active || (item.systemKey === 'cash' && settings.defaultPaymentMethodId === item.id)}
              onPress={() => {
                const willBeDefault = settings.defaultPaymentMethodId !== item.id;
                setDefaultPaymentMethod(willBeDefault ? item.id : null)
                  .then(() => {
                    if (willBeDefault) showDefaultConfirmation(item.name);
                  })
                  .catch((error) => Alert.alert(
                    t('errors.couldNotChange'),
                    error instanceof Error ? error.message : t('common.tryAgain')
                  ));
              }}
              style={[
                styles.star,
                (!item.active || (item.systemKey === 'cash' && settings.defaultPaymentMethodId === item.id)) && styles.starDisabled,
              ]}>
              <Ionicons
                name={settings.defaultPaymentMethodId === item.id ? 'star' : 'star-outline'}
                size={22}
                color={settings.defaultPaymentMethodId === item.id ? '#D88916' : colors.icon}
              />
            </Pressable>
            {item.type === 'credit' && (
              <Pressable
                accessibilityLabel={t('paymentMethods.viewStatements', { name: item.name })}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/modal/card-cycles', params: { id: String(item.id) } })}
                style={styles.statementButton}>
                <Ionicons name="receipt-outline" size={21} color={colors.primary} />
              </Pressable>
            )}
            <Pressable
              accessibilityLabel={t('paymentMethods.configure', { name: item.name })}
              onPress={() => router.push({ pathname: '/modal/payment-method-detail', params: { id: String(item.id) } })}
              style={styles.chevron}>
              <Ionicons name="chevron-forward" size={21} color={colors.icon} />
            </Pressable>
          </ThemedView>
          );
        }}
        stickySectionHeadersEnabled={false}
      />
      <FeatureGuide visible={guide.visible} slides={guideSlides} onClose={guide.close} />
      <FloatingActionButton href="/modal/payment-method-form" accessibilityLabel={t('paymentMethods.add')} avoidBottomInset />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: 20, paddingBottom: 100 },
  listHeader: { gap: 13 },
  guideHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 2 },
  description: { flex: 1, opacity: 0.7, lineHeight: 21 },
  sectionTitle: { fontSize: 18, marginTop: 14, marginBottom: 6, paddingHorizontal: 12 },
  card: { borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  compactCard: { paddingVertical: 7, marginBottom: 0 },
  inactive: { opacity: 0.55 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  colorDot: { width: 18, height: 18, borderRadius: 6 },
  compactColorDot: { width: 16, height: 16, borderRadius: 5 },
  copy: { flex: 1, gap: 3 },
  compactCopy: { gap: 0 },
  balanceHeading: { fontSize: 12, marginTop: 5 },
  balance: { fontSize: 12, marginTop: 2 },
  compactBalance: { marginTop: 0 },
  configureBalance: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  billedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  billedLabel: { fontSize: 12 },
  billedAmount: { fontSize: 12 },
  chevron: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  star: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  statementButton: { padding: 6 },
  starDisabled: { opacity: 0.35 },
  empty: { minHeight: 130, marginTop: 22, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  emptyText: { textAlign: 'center', opacity: 0.68 },
});
