import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { FinancialInfoButton } from '@/components/financial-info-button';
import {
  FinancialExplanationModal,
  type FinancialExplanation,
  type FinancialExplanationLine,
} from '@/components/financial-explanation-modal';
import { HistoricalPeriodModal } from '@/components/HistoricalPeriodModal';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { usePeriodDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP, formatDate } from '@/lib/format';
import { buildHistoricalReport } from '@/lib/historical-report';
import { APP_LOCALE, t } from '@/lib/i18n';
import { logAppError } from '@/lib/logger';
import { showToast } from '@/lib/toast';
import type { PeriodHistory } from '@/lib/types';
import {
  exportHistoricalReportCsv,
  exportHistoricalReportPdf,
} from '@/services/HistoricalReportService';

type Scope = number | 'all';
type ExportKind = 'pdf' | 'csv' | null;

function shortPeriodLabel(date: string): string {
  return new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'short' })
    .format(new Date(`${date}T12:00:00`))
    .replace('.', '');
}

function periodAxisRange(period: Pick<PeriodHistory, 'startDate' | 'endDate'>): [string, string] {
  return [shortPeriodLabel(period.startDate), shortPeriodLabel(period.endDate)];
}

function periodRange(period: Pick<PeriodHistory, 'startDate' | 'endDate'>): string {
  return `${formatDate(new Date(`${period.startDate}T12:00:00`))} – ${formatDate(new Date(`${period.endDate}T12:00:00`))}`;
}

function niceChartMaximum(values: number[]): number {
  const maximum = Math.max(0, ...values);
  if (maximum === 0) return 1;
  const rawStep = maximum / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceStep = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.ceil(maximum / (niceStep * magnitude)) * niceStep * magnitude;
}

function formatCompactCLP(value: number): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency',
    currency: 'CLP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function MetricCard({
  icon,
  label,
  value,
  color,
  surface,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  surface: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.metricCard, { backgroundColor: surface }, pressed && styles.pressed]}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <ThemedText style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      <ThemedText style={styles.metricLabel}>{label}</ThemedText>
      {onPress && <FinancialInfoButton onPress={onPress} style={styles.metricInfo} />}
    </Pressable>
  );
}

export default function HistoricalSummaryScreen() {
  const { periodHistory, selectPeriod } = usePeriodDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { width: screenWidth } = useWindowDimensions();
  const years = useMemo(
    () => [...new Set(periodHistory.map((period) => period.year))].sort((a, b) => b - a),
    [periodHistory]
  );
  const [scope, setScope] = useState<Scope | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodHistory | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [exporting, setExporting] = useState<ExportKind>(null);
  const [explanation, setExplanation] = useState<FinancialExplanation | null>(null);

  const effectiveScope: Scope = scope ?? years[0] ?? 'all';
  const filteredPeriods = useMemo(
    () => effectiveScope === 'all'
      ? periodHistory
      : periodHistory.filter((period) => period.year === effectiveScope),
    [effectiveScope, periodHistory]
  );
  const report = useMemo(() => buildHistoricalReport(filteredPeriods), [filteredPeriods]);
  const scopeLabel = effectiveScope === 'all' ? t('history.allYears') : String(effectiveScope);
  const visibleCategories = showAllCategories ? report.categories : report.categories.slice(0, 5);
  const maximumCategory = report.categories[0]?.total ?? 1;
  const chartMaximum = niceChartMaximum(
    report.periods.flatMap((period) => [period.incomesTotal, period.expenseTotal])
  );
  const chartWidth = Math.max(screenWidth - 144, report.periods.length * 88);
  const chartData = report.periods.flatMap((period) => {
    const [startLabel, endLabel] = periodAxisRange(period);
    return [
      {
        value: period.incomesTotal,
        frontColor: colors.success,
        spacing: 6,
        labelWidth: 84,
        labelComponent: () => (
          <View style={styles.periodAxisLabel}>
            <ThemedText style={[styles.periodAxisDate, { color: colors.textSecondary }]}>
              {startLabel}
            </ThemedText>
            <ThemedText style={[styles.periodAxisDate, { color: colors.textSecondary }]}>
              – {endLabel}
            </ThemedText>
          </View>
        ),
        onPress: () => setSelectedPeriod(period),
      },
      {
        value: period.expenseTotal,
        frontColor: colors.expense,
        spacing: 46,
        onPress: () => setSelectedPeriod(period),
      },
    ];
  });

  const insights = useMemo(() => {
    const items: { icon: keyof typeof Ionicons.glyphMap; text: string; color: string }[] = [];
    if (report.latestExpenseChangePercent != null) {
      const change = report.latestExpenseChangePercent;
      items.push({
        icon: change <= 0 ? 'trending-down-outline' : 'trending-up-outline',
        color: change <= 0 ? colors.success : colors.expense,
        text: change === 0
          ? t('history.expenseChangeSame')
          : t(change < 0 ? 'history.expenseChangeDown' : 'history.expenseChangeUp', {
              percent: Math.abs(change),
            }),
      });
    }
    if (report.topCategory && report.expenseTotal > 0) {
      items.push({
        icon: 'pie-chart-outline',
        color: report.topCategory.categoryColor,
        text: t('history.topCategoryInsight', {
          name: report.topCategory.categoryName,
          percent: Math.round((report.topCategory.total / report.expenseTotal) * 100),
        }),
      });
    }
    if (report.savingsRate != null && report.savingsContributionTotal > 0) {
      items.push({
        icon: 'leaf-outline',
        color: colors.savings,
        text: t('history.savingsRateInsight', { percent: report.savingsRate }),
      });
    }
    if (report.bestPeriod) {
      items.push({
        icon: 'trophy-outline',
        color: colors.warning,
        text: t('history.bestPeriodInsight', {
          period: periodRange(report.bestPeriod),
          amount: formatCLP(report.bestPeriod.cashflow),
        }),
      });
    }
    return items;
  }, [colors, report]);

  const periodLines = (value: (period: typeof report.periods[number]) => number): FinancialExplanationLine[] =>
    report.periods
      .map((period) => ({ label: periodRange(period), value: formatCLP(value(period)) }))
      .filter((line) => line.value !== formatCLP(0));
  const showExplanation = (
    title: string,
    description: Parameters<typeof t>[0],
    lines: FinancialExplanationLine[],
    total: number
  ) => setExplanation({
    title,
    description: t(description),
    lines,
    totalLabel: t('financialExplanation.total'),
    total: formatCLP(total),
  });
  const showSavingsContributions = () => showExplanation(
    t('history.savingsContributions'),
    'financialExplanation.descriptions.savings',
    periodLines((period) => period.savingsContributionTotal),
    report.savingsContributionTotal
  );
  const showSavingsWithdrawals = () => showExplanation(
    t('history.savingsWithdrawals'),
    'financialExplanation.descriptions.savingsWithdrawals',
    periodLines((period) => period.savingsWithdrawalTotal),
    report.savingsWithdrawalTotal
  );
  const showDebtPayments = () => showExplanation(
    t('history.debtPayments'),
    'financialExplanation.descriptions.debtPayments',
    periodLines((period) => period.debtPaymentsTotal),
    report.debtPaymentsTotal
  );
  const showDebtCollections = () => showExplanation(
    t('history.debtCollections'),
    'financialExplanation.descriptions.debtCollections',
    periodLines((period) => period.debtCollectionsTotal),
    report.debtCollectionsTotal
  );
  const showCardPayments = () => showExplanation(
    t('history.cardPayments'),
    'financialExplanation.descriptions.cardPayments',
    periodLines((period) => period.cardPaymentsFromAccountsTotal),
    report.cardPaymentsTotal
  );

  const runExport = async (kind: Exclude<ExportKind, null>) => {
    if (exporting || report.periods.length === 0) return;
    setExporting(kind);
    try {
      if (kind === 'pdf') await exportHistoricalReportPdf(report, scopeLabel);
      else await exportHistoricalReportCsv(report, scopeLabel);
      showToast(t('history.reportGenerated'));
    } catch (error) {
      logAppError(kind === 'pdf' ? 'report.export' : 'csv.export', error);
      showToast(t('history.exportError'));
    } finally {
      setExporting(null);
    }
  };

  if (periodHistory.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['top']}>
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="bar-chart-outline"
            title={t('emptyStates.historyTitle')}
            description={t('emptyStates.historyDescription')}
            actionLabel={t('emptyStates.goHome')}
            onAction={() => router.navigate('/(tabs)/home')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <ThemedText type="title">{t('history.summary')}</ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>{t('history.subtitle')}</ThemedText>
          </View>
          <View style={styles.exportActions}>
            <Pressable
              accessibilityLabel={t('history.exportPdf')}
              accessibilityRole="button"
              accessibilityState={{ busy: exporting === 'pdf', disabled: exporting != null }}
              disabled={exporting != null}
              onPress={() => { void runExport('pdf'); }}
              style={({ pressed }) => [styles.exportButton, styles.pdfButton, pressed && styles.pressed]}>
              {exporting === 'pdf'
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Ionicons name="document-text-outline" color="#FFFFFF" size={20} />}
            </Pressable>
            <Pressable
              accessibilityLabel={t('history.exportCsv')}
              accessibilityRole="button"
              accessibilityState={{ busy: exporting === 'csv', disabled: exporting != null }}
              disabled={exporting != null}
              onPress={() => { void runExport('csv'); }}
              style={({ pressed }) => [styles.exportButton, styles.csvButton, pressed && styles.pressed]}>
              {exporting === 'csv'
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Ionicons name="grid-outline" color="#FFFFFF" size={20} />}
            </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeRow}>
          {years.map((year) => (
            <Pressable
              key={year}
              accessibilityRole="button"
              accessibilityState={{ selected: effectiveScope === year }}
              onPress={() => setScope(year)}
              style={[
                styles.scopeChip,
                { borderColor: effectiveScope === year ? colors.primary : colors.border },
                effectiveScope === year && { backgroundColor: colors.primary },
              ]}>
              <ThemedText style={effectiveScope === year ? { color: colors.onPrimary, fontFamily: Fonts.bold } : undefined}>
                {year}
              </ThemedText>
            </Pressable>
          ))}
          {years.length > 1 && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: effectiveScope === 'all' }}
              onPress={() => setScope('all')}
              style={[
                styles.scopeChip,
                { borderColor: effectiveScope === 'all' ? colors.primary : colors.border },
                effectiveScope === 'all' && { backgroundColor: colors.primary },
              ]}>
              <ThemedText style={effectiveScope === 'all' ? { color: colors.onPrimary, fontFamily: Fonts.bold } : undefined}>
                {t('history.allYears')}
              </ThemedText>
            </Pressable>
          )}
        </ScrollView>

        <View style={styles.metricGrid}>
          <MetricCard icon="arrow-down-circle-outline" label={t('history.income')} value={formatCLP(report.incomeTotal)} color={colors.success} surface={colors.surface} onPress={() => showExplanation(t('history.income'), 'financialExplanation.descriptions.income', periodLines((period) => period.incomesTotal), report.incomeTotal)} />
          <MetricCard icon="arrow-up-circle-outline" label={t('history.outflows')} value={formatCLP(report.expenseTotal)} color={colors.expense} surface={colors.surface} onPress={() => showExplanation(t('history.outflows'), 'financialExplanation.descriptions.outflows', periodLines((period) => period.expenseTotal), report.expenseTotal)} />
          <MetricCard icon="swap-vertical-outline" label={t('history.cashflow')} value={formatCLP(report.cashflowTotal)} color={report.cashflowTotal >= 0 ? colors.success : colors.expense} surface={colors.surface} onPress={() => showExplanation(t('history.cashflow'), 'financialExplanation.descriptions.net', [
            { label: t('history.income'), value: formatCLP(report.incomeTotal) },
            { label: t('history.savingsWithdrawals'), value: formatCLP(report.savingsWithdrawalTotal) },
            { label: t('history.outflows'), value: formatCLP(report.expenseTotal), operator: '−' },
          ], report.cashflowTotal)} />
          <MetricCard icon="leaf-outline" label={t('history.savings')} value={formatCLP(report.savingsContributionTotal)} color={colors.savings} surface={colors.surface} onPress={() => showExplanation(t('history.savings'), 'financialExplanation.descriptions.savings', periodLines((period) => period.savingsContributionTotal), report.savingsContributionTotal)} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeading}>
            <ThemedText type="subtitle">{t('history.flowEvolution')}</ThemedText>
            <ThemedText style={[styles.caption, { color: colors.textSecondary }]}>
              {t('history.periodCount', { count: report.periods.length })}
            </ThemedText>
          </View>
          <View style={styles.legend}>
            <Pressable onPress={() => showExplanation(t('history.income'), 'financialExplanation.descriptions.income', periodLines((period) => period.incomesTotal), report.incomeTotal)} style={[styles.legendItem, { backgroundColor: `${colors.success}14` }]}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <ThemedText style={styles.legendText}>{t('history.income')}</ThemedText>
            </Pressable>
            <Pressable onPress={() => showExplanation(t('history.outflows'), 'financialExplanation.descriptions.outflows', periodLines((period) => period.expenseTotal), report.expenseTotal)} style={[styles.legendItem, { backgroundColor: `${colors.expense}14` }]}>
              <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
              <ThemedText style={styles.legendText}>{t('history.outflows')}</ThemedText>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={chartData}
              width={chartWidth}
              height={210}
              barWidth={16}
              maxValue={chartMaximum}
              noOfSections={4}
              yAxisLabelWidth={62}
              yAxisLabelTexts={[0, 1, 2, 3, 4].map((index) => formatCompactCLP((chartMaximum / 4) * index))}
              yAxisTextStyle={{ color: colors.textSecondary, fontSize: 9 }}
              xAxisLabelsHeight={40}
              xAxisTextNumberOfLines={2}
              xAxisColor={colors.border}
              yAxisColor={colors.border}
              rulesColor={colors.border}
              roundedTop
              isAnimated
            />
          </ScrollView>
          <ThemedText style={[styles.chartHint, { color: colors.textSecondary }]}>
            {t('history.chartHint')}
          </ThemedText>
        </View>

        {insights.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <ThemedText type="subtitle">{t('history.insights')}</ThemedText>
            <View style={styles.insightList}>
              {insights.map((insight, index) => (
                <View key={`${insight.text}-${index}`} style={styles.insightRow}>
                  <View style={[styles.insightIcon, { backgroundColor: `${insight.color}18` }]}>
                    <Ionicons name={insight.icon} size={19} color={insight.color} />
                  </View>
                  <ThemedText style={styles.insightText}>{insight.text}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeading}>
            <View>
              <ThemedText type="subtitle">{t('history.topCategories')}</ThemedText>
              <ThemedText style={[styles.caption, { color: colors.textSecondary }]}>{t('history.categoryBreakdown')}</ThemedText>
            </View>
            <ThemedText style={{ color: colors.textSecondary }}>{formatCLP(report.averageExpense)}</ThemedText>
          </View>
          <View style={styles.rankingList}>
            {visibleCategories.map((category, index) => (
              <View key={category.categoryId ?? 'none'}>
                <View style={styles.rankingHeader}>
                  <View style={styles.rankingName}>
                    <ThemedText style={[styles.rank, { color: colors.textSecondary }]}>{index + 1}</ThemedText>
                    <View style={[styles.categoryDot, { backgroundColor: category.categoryColor }]} />
                    <ThemedText style={styles.rankingLabel} numberOfLines={1}>{category.categoryName}</ThemedText>
                  </View>
                  <ThemedText style={styles.rankingAmount}>{formatCLP(category.total)}</ThemedText>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                  <View style={[
                    styles.progressFill,
                    {
                      backgroundColor: category.categoryColor,
                      width: `${Math.max(2, Math.round((category.total / maximumCategory) * 100))}%`,
                    },
                  ]} />
                </View>
              </View>
            ))}
          </View>
          {report.categories.length > 5 && (
            <Pressable accessibilityRole="button" onPress={() => setShowAllCategories((value) => !value)} style={styles.textButton}>
              <ThemedText style={{ color: colors.action, fontFamily: Fonts.bold }}>
                {t(showAllCategories ? 'history.showLess' : 'history.showAll')}
              </ThemedText>
              <Ionicons name={showAllCategories ? 'chevron-up' : 'chevron-down'} color={colors.action} size={18} />
            </Pressable>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <ThemedText type="subtitle">{t('history.activity')}</ThemedText>
          <View style={styles.activityGrid}>
            <Pressable style={styles.activityItem} onPress={showSavingsContributions}>
              <Ionicons name="add-circle-outline" color={colors.savings} size={21} />
              <View style={styles.activityValueRow}>
                <ThemedText style={styles.activityValue}>{formatCLP(report.savingsContributionTotal)}</ThemedText>
                <FinancialInfoButton onPress={showSavingsContributions} />
              </View>
              <ThemedText style={[styles.caption, { color: colors.textSecondary }]}>{t('history.savingsContributions')}</ThemedText>
            </Pressable>
            <Pressable style={styles.activityItem} onPress={showSavingsWithdrawals}>
              <Ionicons name="remove-circle-outline" color={colors.warning} size={21} />
              <View style={styles.activityValueRow}>
                <ThemedText style={styles.activityValue}>{formatCLP(report.savingsWithdrawalTotal)}</ThemedText>
                <FinancialInfoButton onPress={showSavingsWithdrawals} />
              </View>
              <ThemedText style={[styles.caption, { color: colors.textSecondary }]}>{t('history.savingsWithdrawals')}</ThemedText>
            </Pressable>
            <Pressable style={styles.activityItem} onPress={showDebtPayments}>
              <Ionicons name="card-outline" color={colors.expense} size={21} />
              <View style={styles.activityValueRow}>
                <ThemedText style={styles.activityValue}>{formatCLP(report.debtPaymentsTotal)}</ThemedText>
                <FinancialInfoButton onPress={showDebtPayments} />
              </View>
              <ThemedText style={[styles.caption, { color: colors.textSecondary }]}>{t('history.debtPayments')}</ThemedText>
            </Pressable>
            <Pressable style={styles.activityItem} onPress={showDebtCollections}>
              <Ionicons name="cash-outline" color={colors.success} size={21} />
              <View style={styles.activityValueRow}>
                <ThemedText style={styles.activityValue}>{formatCLP(report.debtCollectionsTotal)}</ThemedText>
                <FinancialInfoButton onPress={showDebtCollections} />
              </View>
              <ThemedText style={[styles.caption, { color: colors.textSecondary }]}>{t('history.debtCollections')}</ThemedText>
            </Pressable>
          </View>
          {report.cardPaymentsTotal > 0 && (
            <Pressable onPress={showCardPayments} style={[styles.inlineSummary, { borderTopColor: colors.border }]}>
              <ThemedText style={{ color: colors.textSecondary }}>{t('history.cardPayments')}</ThemedText>
              <View style={styles.inlineValueRow}>
                <ThemedText style={styles.rankingAmount}>{formatCLP(report.cardPaymentsTotal)}</ThemedText>
                <FinancialInfoButton onPress={showCardPayments} />
              </View>
            </Pressable>
          )}
        </View>

        {report.paymentMethods.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <ThemedText type="subtitle">{t('history.paymentMethods')}</ThemedText>
            <View style={styles.methodList}>
              {report.paymentMethods.slice(0, 5).map((method) => (
                <View key={method.paymentMethodId ?? 'none'} style={styles.methodRow}>
                  <View style={styles.rankingName}>
                    <View style={[styles.categoryDot, { backgroundColor: method.paymentMethodColor }]} />
                    <ThemedText numberOfLines={1} style={styles.rankingLabel}>{method.paymentMethodName}</ThemedText>
                  </View>
                  <ThemedText style={styles.rankingAmount}>{formatCLP(method.total)}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.periodSection}>
          <View style={styles.sectionHeading}>
            <ThemedText type="subtitle">{t('history.periods')}</ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>{report.periods.length}</ThemedText>
          </View>
          {[...report.periods].reverse().map((period) => (
            <Pressable
              key={period.periodId}
              accessibilityRole="button"
              accessibilityLabel={`${periodRange(period)}. ${t('history.viewDetail')}`}
              onPress={() => setSelectedPeriod(period)}
              style={({ pressed }) => [styles.periodCard, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
              <View style={styles.periodTopRow}>
                <View style={styles.periodIcon}>
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.periodCopy}>
                  <ThemedText style={styles.periodTitle}>{periodRange(period)}</ThemedText>
                  <ThemedText style={[styles.caption, { color: colors.textSecondary }]}>
                    {t('history.periodSummary', {
                      income: formatCLP(period.incomesTotal),
                      outflows: formatCLP(period.expenseTotal),
                    })}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={21} color={colors.icon} />
              </View>
              <View style={[styles.periodResult, { borderTopColor: colors.border }]}>
                <ThemedText style={{ color: colors.textSecondary }}>{t('history.cashflow')}</ThemedText>
                <View style={styles.periodValueRow}><ThemedText style={{ color: period.cashflow >= 0 ? colors.success : colors.expense, fontFamily: Fonts.bold }}>{formatCLP(period.cashflow)}</ThemedText><FinancialInfoButton onPress={() => setExplanation({ title: periodRange(period), description: t('financialExplanation.descriptions.historicalPeriod'), lines: [{ label: t('history.income'), value: formatCLP(period.incomesTotal) }, { label: t('history.savingsWithdrawals'), value: formatCLP(period.savingsWithdrawalTotal) }, { label: t('history.outflows'), value: formatCLP(period.expenseTotal), operator: '−' }], totalLabel: t('history.cashflow'), total: formatCLP(period.cashflow) })} /></View>
              </View>
            </Pressable>
          ))}
        </View>

        <ThemedText style={[styles.dataNote, { color: colors.textSecondary }]}>
          {t('history.dataNote')}
        </ThemedText>
      </ScrollView>

      <HistoricalPeriodModal
        visible={selectedPeriod != null}
        period={selectedPeriod}
        onClose={() => setSelectedPeriod(null)}
        onOpenPeriod={(periodId) => {
          selectPeriod(periodId);
          setSelectedPeriod(null);
          router.navigate({ pathname: '/(tabs)/home', params: { scrollToTop: String(Date.now()) } });
        }}
        onOpenCategory={(periodId, categoryId) => {
          selectPeriod(periodId);
          setSelectedPeriod(null);
          router.navigate({
            pathname: '/(tabs)/movements',
            params: {
              movementType: 'expenses',
              categoryFilter: categoryId == null ? 'none' : String(categoryId),
              paymentMethodFilter: '',
              filterRequestId: String(Date.now()),
            },
          });
        }}
        onOpenPaymentMethod={(periodId, paymentMethodId) => {
          selectPeriod(periodId);
          setSelectedPeriod(null);
          router.navigate({
            pathname: '/(tabs)/movements',
            params: {
              movementType: 'expenses',
              categoryFilter: '',
              paymentMethodFilter: paymentMethodId == null ? 'none' : String(paymentMethodId),
              filterRequestId: String(Date.now()),
            },
          });
        }}
      />
      <FinancialExplanationModal explanation={explanation} onClose={() => setExplanation(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, gap: 16, paddingBottom: 44 },
  emptyContainer: { flex: 1, padding: 20, justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCopy: { flex: 1, gap: 3 },
  exportActions: { flexDirection: 'row', gap: 8 },
  exportButton: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pdfButton: { backgroundColor: '#C93F4B' },
  csvButton: { backgroundColor: '#168A5B' },
  pressed: { opacity: 0.68 },
  scopeRow: { gap: 9, paddingRight: 4 },
  scopeChip: { minWidth: 64, minHeight: 42, paddingHorizontal: 15, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', minHeight: 118, borderRadius: 16, padding: 14, paddingRight: 34, gap: 5, elevation: 1, position: 'relative' },
  metricInfo: { position: 'absolute', right: 8, top: 8 },
  metricIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  metricValue: { fontFamily: Fonts.bold, fontSize: 19 },
  metricLabel: { fontSize: 13 },
  card: { borderRadius: 18, padding: 16, gap: 15, elevation: 1 },
  sectionHeading: { gap: 2 },
  caption: { fontSize: 12, lineHeight: 17 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  legendItem: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 15 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
  periodAxisLabel: { width: 90, alignItems: 'center' },
  periodAxisDate: { fontSize: 9, lineHeight: 13, textAlign: 'center' },
  chartHint: { textAlign: 'center', fontSize: 12 },
  insightList: { gap: 12 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  insightIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  insightText: { flex: 1, lineHeight: 20 },
  rankingList: { gap: 14 },
  rankingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 7 },
  rankingName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rank: { width: 17, fontSize: 12 },
  categoryDot: { width: 11, height: 11, borderRadius: 4 },
  rankingLabel: { flex: 1 },
  rankingAmount: { fontFamily: Fonts.bold },
  progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  textButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: 12, justifyContent: 'center' },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  activityItem: { width: '48%', minHeight: 92, gap: 4 },
  activityValueRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  activityValue: { fontFamily: Fonts.bold, fontSize: 16 },
  inlineSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 13 },
  inlineValueRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  methodList: { gap: 13 },
  methodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  periodSection: { gap: 10 },
  periodCard: { borderRadius: 16, padding: 15, gap: 12, elevation: 1 },
  periodTopRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  periodIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#20C9B51A' },
  periodCopy: { flex: 1, gap: 3 },
  periodTitle: { fontFamily: Fonts.bold },
  periodResult: { borderTopWidth: 1, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  periodValueRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dataNote: { fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 12 },
});
