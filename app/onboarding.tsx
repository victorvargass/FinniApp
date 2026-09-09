import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleLogo } from '@/components/google-logo';
import { ThemedText } from '@/components/themed-text';
import { BrandColors, Colors, Fonts } from '@/constants/theme';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

const wordmark = require('@/assets/images/splash-icon.png');
const darkWordmark = require('@/assets/images/splash-icon-dark.png');

function MoneyOverview() {
  return (
    <View style={styles.phoneCard}>
      <Image contentFit="contain" source={wordmark} style={styles.wordmark} />
      <ThemedText style={styles.visualEyebrow}>{t('onboarding.periodBalance')}</ThemedText>
      <ThemedText style={styles.visualBalance}>$428.500</ThemedText>
      <View style={styles.moneyRow}>
        <View style={[styles.moneyCard, styles.incomeCard]}>
          <Ionicons name="arrow-down" size={19} color={Colors.light.success} />
          <View>
            <ThemedText style={styles.visualLabel}>{t('navigation.incomes')}</ThemedText>
            <ThemedText style={[styles.visualAmount, { color: Colors.light.success }]}>+$850.000</ThemedText>
          </View>
        </View>
        <View style={[styles.moneyCard, styles.expenseCard]}>
          <Ionicons name="arrow-up" size={19} color={Colors.light.expense} />
          <View>
            <ThemedText style={styles.visualLabel}>{t('navigation.expenses')}</ThemedText>
            <ThemedText style={[styles.visualAmount, { color: Colors.light.expense }]}>-$421.500</ThemedText>
          </View>
        </View>
      </View>
      <View style={styles.quickAdd}>
        <Ionicons name="add" size={24} color={BrandColors.navy} />
      </View>
    </View>
  );
}

function SetupOverview() {
  return (
    <View style={styles.setupCard}>
      <View style={styles.setupRow}>
        <View style={styles.setupIcon}><GoogleLogo /></View>
        <View style={styles.setupCopy}>
          <ThemedText style={styles.setupTitle}>{t('onboarding.googleBackup')}</ThemedText>
          <ThemedText style={styles.setupHint}>{t('onboarding.googleBackupHint')}</ThemedText>
        </View>
        <Ionicons name="checkmark-circle" size={23} color={BrandColors.turquoise} />
      </View>
      <View style={styles.setupDivider} />
      <View style={styles.setupRow}>
        <View style={[styles.setupIcon, styles.calendarIcon]}>
          <Ionicons name="calendar-outline" size={23} color={BrandColors.navy} />
        </View>
        <View style={styles.setupCopy}>
          <ThemedText style={styles.setupTitle}>{t('onboarding.customPeriod')}</ThemedText>
          <ThemedText style={styles.setupHint}>01 sep - 30 sep</ThemedText>
        </View>
      </View>
      <View style={styles.setupDivider} />
      <View style={styles.setupRow}>
        <View style={[styles.setupIcon, styles.categoryIcon]}>
          <Ionicons name="pricetags-outline" size={23} color={BrandColors.navy} />
        </View>
        <View style={styles.setupCopy}>
          <View style={styles.categoryHeading}>
            <ThemedText style={styles.setupTitle}>{t('onboarding.categoriesAndLimits')}</ThemedText>
            <ThemedText style={styles.limitAmount}>$96.000 / $150.000</ThemedText>
          </View>
          <View style={styles.progressTrack}><View style={styles.progressValue} /></View>
        </View>
      </View>
    </View>
  );
}

function ReportOverview() {
  return (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View>
          <ThemedText style={styles.visualEyebrow}>{t('onboarding.financialReport')}</ThemedText>
          <ThemedText style={styles.reportBrand}>Finni<TextAccent>App</TextAccent></ThemedText>
        </View>
        <View style={styles.pdfBadge}><ThemedText style={styles.pdfText}>PDF</ThemedText></View>
      </View>
      <View style={styles.reportMetrics}>
        <View style={styles.reportMetric}><ThemedText style={styles.reportMetricLabel}>{t('navigation.incomes')}</ThemedText><ThemedText style={[styles.reportMetricValue, { color: Colors.light.success }]}>$1.600.000</ThemedText></View>
        <View style={styles.reportMetric}><ThemedText style={styles.reportMetricLabel}>{t('navigation.expenses')}</ThemedText><ThemedText style={[styles.reportMetricValue, { color: Colors.light.expense }]}>$982.400</ThemedText></View>
      </View>
      <View style={styles.reportFeatureGrid}>
        {[
          ['pie-chart-outline', t('onboarding.progress')],
          ['flag-outline', t('onboarding.savings')],
          ['card-outline', t('onboarding.debts')],
          ['document-text-outline', t('onboarding.periodReport')],
        ].map(([icon, label]) => (
          <View key={label} style={styles.reportFeature}>
            <Ionicons name={icon as React.ComponentProps<typeof Ionicons>['name']} size={20} color={BrandColors.blueSecondary} />
            <ThemedText style={styles.reportFeatureText}>{label}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

function TextAccent({ children }: { children: React.ReactNode }) {
  return <ThemedText style={styles.reportBrandAccent}>{children}</ThemedText>;
}

const slides = [
  { title: 'onboarding.welcomeTitle', body: 'onboarding.welcomeBody', visual: MoneyOverview },
  { title: 'onboarding.setupTitle', body: 'onboarding.setupBody', visual: SetupOverview },
  { title: 'onboarding.understandTitle', body: 'onboarding.understandBody', visual: ReportOverview },
] as const;

export default function OnboardingScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [page, setPage] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const pagerRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { completeOnboarding } = useOnboarding();
  const isLast = page === slides.length - 1;

  const goToPage = (nextPage: number) => {
    const boundedPage = Math.max(0, Math.min(nextPage, slides.length - 1));
    pagerRef.current?.scrollTo({ x: boundedPage * width, animated: true });
    setPage(boundedPage);
  };

  const handlePageChange = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.max(0, Math.min(Math.round(event.nativeEvent.contentOffset.x / width), slides.length - 1)));
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      if (returnTo === 'user') {
        router.back();
        return;
      }
      await completeOnboarding();
      router.replace('/(tabs)/period');
    } finally {
      setFinishing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['top', 'bottom']}>
      <LinearGradient colors={['rgba(66,214,192,0.20)', 'rgba(32,185,219,0.04)', 'transparent']} style={styles.glow} />
      <View style={styles.topBar}>
        <Image contentFit="contain" source={colorScheme === 'dark' ? darkWordmark : wordmark} style={styles.topLogo} />
        {!isLast && (
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => { void finish(); }} testID="onboarding-skip">
            <ThemedText style={[styles.skip, { color: colors.action }]}>{t('onboarding.skip')}</ThemedText>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={pagerRef}
        directionalLockEnabled
        horizontal
        onMomentumScrollEnd={handlePageChange}
        pagingEnabled
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={styles.pager}>
        {slides.map((item) => {
          const Visual = item.visual;
          return (
            <ScrollView
              key={item.title}
              contentContainerStyle={[styles.content, { width }]}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}>
              <View style={styles.visualContainer}><Visual /></View>
              <View style={styles.copy}>
                <ThemedText type="title" style={styles.title}>{t(item.title)}</ThemedText>
                <ThemedText style={[styles.body, { color: colors.textSecondary }]}>{t(item.body)}</ThemedText>
              </View>
            </ScrollView>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots} accessibilityLabel={t('onboarding.page', { current: page + 1, total: slides.length })}>
          {slides.map((item, index) => (
            <View key={item.title} style={[styles.dot, { backgroundColor: index === page ? colors.secondary : colors.border }, index === page && styles.activeDot]} />
          ))}
        </View>
        <View style={styles.actions}>
          {page > 0 && (
            <Pressable accessibilityRole="button" onPress={() => goToPage(page - 1)} style={[styles.backButton, { borderColor: colors.border }]}>
              <Ionicons name="arrow-back" size={21} color={colors.text} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={finishing}
            testID="onboarding-next"
            onPress={() => { if (isLast) void finish(); else goToPage(page + 1); }}
            style={({ pressed }) => [styles.nextButton, { backgroundColor: colors.primary }, pressed && styles.pressed, finishing && styles.disabled]}>
            <ThemedText style={[styles.nextText, { color: colors.onPrimary }]}>{t(isLast ? 'onboarding.start' : 'onboarding.next')}</ThemedText>
            <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={21} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 330 },
  topBar: { minHeight: 58, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topLogo: { width: 118, height: 38 }, skip: { fontFamily: Fonts.semiBold, fontSize: 15 },
  pager: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 6, paddingBottom: 16, justifyContent: 'center', gap: 28 },
  visualContainer: { minHeight: 340, alignItems: 'center', justifyContent: 'center' },
  copy: { alignItems: 'center', gap: 12 }, title: { maxWidth: 560, textAlign: 'center', fontSize: 30, lineHeight: 36 },
  body: { maxWidth: 600, textAlign: 'center', fontSize: 16, lineHeight: 24 },
  footer: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 8, gap: 18 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 }, activeDot: { width: 24 },
  actions: { flexDirection: 'row', gap: 10 },
  backButton: { width: 52, minHeight: 52, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nextButton: { minHeight: 52, flex: 1, borderRadius: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  nextText: { fontFamily: Fonts.bold, fontSize: 16 }, pressed: { opacity: 0.78 }, disabled: { opacity: 0.55 },
  phoneCard: { width: '100%', maxWidth: 390, minHeight: 300, padding: 22, borderRadius: 30, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E1E8', shadowColor: BrandColors.navy, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.13, shadowRadius: 24, elevation: 8 },
  wordmark: { width: 142, height: 42, alignSelf: 'center' }, visualEyebrow: { marginTop: 21, color: BrandColors.blueGray, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  visualBalance: { color: BrandColors.navy, fontFamily: Fonts.bold, fontSize: 34, lineHeight: 42, textAlign: 'center' },
  moneyRow: { flexDirection: 'row', gap: 10, marginTop: 19 }, moneyCard: { flex: 1, minHeight: 70, padding: 11, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 8 },
  incomeCard: { backgroundColor: '#E7F7F0' }, expenseCard: { backgroundColor: '#FDEDEC' },
  visualLabel: { color: BrandColors.navy, fontSize: 10, lineHeight: 13 }, visualAmount: { fontFamily: Fonts.bold, fontSize: 13, lineHeight: 18 },
  quickAdd: { position: 'absolute', bottom: -22, alignSelf: 'center', width: 50, height: 50, borderRadius: 25, backgroundColor: BrandColors.turquoise, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  setupCard: { width: '100%', maxWidth: 420, padding: 8, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E1E8', shadowColor: BrandColors.navy, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 7 },
  setupRow: { minHeight: 88, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  setupIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#F5F8FA', alignItems: 'center', justifyContent: 'center' },
  calendarIcon: { backgroundColor: '#E8F9F6' }, categoryIcon: { backgroundColor: '#E8F4FA' }, setupCopy: { flex: 1, gap: 4 },
  setupTitle: { color: BrandColors.navy, fontFamily: Fonts.bold, fontSize: 14, lineHeight: 18 }, setupHint: { color: BrandColors.blueGray, fontSize: 11, lineHeight: 15 },
  setupDivider: { height: 1, marginHorizontal: 14, backgroundColor: '#E8EEF2' }, categoryHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  limitAmount: { color: BrandColors.blueGray, fontSize: 9, lineHeight: 12 }, progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#D8E1E8' }, progressValue: { width: '64%', height: '100%', borderRadius: 3, backgroundColor: BrandColors.turquoise },
  reportCard: { width: '100%', maxWidth: 420, minHeight: 305, padding: 21, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E1E8', shadowColor: BrandColors.navy, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 7 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, reportBrand: { color: BrandColors.navy, fontFamily: Fonts.bold, fontSize: 26, lineHeight: 30 }, reportBrandAccent: { color: BrandColors.turquoise, fontFamily: Fonts.bold, fontSize: 26, lineHeight: 30 },
  pdfBadge: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, backgroundColor: '#FDEDEC' }, pdfText: { color: Colors.light.expense, fontFamily: Fonts.bold, fontSize: 11, lineHeight: 14 },
  reportMetrics: { flexDirection: 'row', gap: 9, marginTop: 20 }, reportMetric: { flex: 1, padding: 11, borderRadius: 12, backgroundColor: '#F5F8FA' },
  reportMetricLabel: { color: BrandColors.blueGray, fontSize: 10, lineHeight: 14 }, reportMetricValue: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 20 },
  reportFeatureGrid: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, reportFeature: { width: '48%', minHeight: 49, paddingHorizontal: 10, borderRadius: 11, backgroundColor: '#E8F9F6', flexDirection: 'row', alignItems: 'center', gap: 7 },
  reportFeatureText: { flex: 1, color: BrandColors.navy, fontFamily: Fonts.semiBold, fontSize: 10, lineHeight: 13 },
});
