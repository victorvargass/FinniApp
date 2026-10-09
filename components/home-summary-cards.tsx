import { Pressable, StyleSheet, View } from 'react-native';

import { FinancialInfoButton } from '@/components/financial-info-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLargeTextLayout } from '@/hooks/use-large-text-layout';
import { formatCLP, formatMoney } from '@/lib/format';
import type { HomeGlobalMetricId, HomePeriodMetricId } from '@/lib/home-preferences';
import { t } from '@/lib/i18n';

type HomeSummaryCardsProps = {
  periodMetrics: HomePeriodMetricId[];
  globalMetrics: HomeGlobalMetricId[];
  periodValues: Record<HomePeriodMetricId, number>;
  globalValues: Record<HomeGlobalMetricId, number>;
  creditTotals: {
    limitClp: number;
    availableUsdCents: number;
    limitUsdCents: number;
    hasUsd: boolean;
  };
  onExplainPeriodMetric?: (metric: HomePeriodMetricId) => void;
  onExplainGlobalMetric?: (metric: HomeGlobalMetricId) => void;
};

type MetricRowProps = {
  label: string;
  value: number;
  color?: string;
  labelColor?: string;
  onPress?: () => void;
};

function MetricRow({ label, value, color, labelColor, onPress, largeText = false }: MetricRowProps & { largeText?: boolean }) {
  const colors = Colors[useColorScheme() ?? 'light'];
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.metric, largeText && styles.metricLargeText, pressed && styles.pressed]}>
      <ThemedText style={[styles.metricLabel, { color: labelColor ?? colors.textSecondary }]}>{label}</ThemedText>
      <ThemedText type="defaultSemiBold" style={[styles.metricValue, color ? { color } : undefined]}>
        {formatCLP(value)}
      </ThemedText>
      {onPress && <FinancialInfoButton onPress={onPress} style={styles.info} color={labelColor} />}
    </Pressable>
  );
}

export function HomeSummaryCards({
  periodMetrics,
  globalMetrics,
  periodValues,
  globalValues,
  creditTotals,
  onExplainPeriodMetric,
  onExplainGlobalMetric,
}: HomeSummaryCardsProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const usesLargeText = useLargeTextLayout();
  const periodColors = scheme === 'dark'
    ? {
        positive: '#087052',
        negative: '#8F2632',
        credit: '#704500',
      }
    : {
        positive: colors.success,
        negative: colors.expense,
        credit: colors.warning,
      };
  const periodLabels: Record<HomePeriodMetricId, string> = {
    available: t('home.periodMetricAvailable'),
    income: t('home.periodMetricIncome'),
    expenses: t('home.periodMetricExpenses'),
    unbilledCredit: t('home.periodMetricUnbilledCredit'),
  };
  const globalLabels: Record<HomeGlobalMetricId, string> = {
    wallet: t('home.globalMetricWallet'),
    credit: t('home.globalMetricCredit'),
    billedCredit: t('home.globalMetricBilledCredit'),
    savings: t('home.globalMetricSavings'),
    debt: t('home.globalMetricDebt'),
  };

  return (
    <View style={styles.container}>
      <ThemedView style={[styles.card, styles.periodCard, { backgroundColor: colors.primary }]}>
        <ThemedText type="subtitle" style={{ color: colors.onPrimary }}>{t('home.periodSummary')}</ThemedText>
        <View style={styles.grid}>
          {periodMetrics.map((metric) => (
            <MetricRow
              key={metric}
              label={periodLabels[metric]}
              value={periodValues[metric]}
              labelColor={colors.onPrimary}
              color={metric === 'income'
                ? periodColors.positive
                : metric === 'expenses'
                  ? periodColors.negative
                  : metric === 'unbilledCredit'
                    ? periodColors.credit
                    : periodValues[metric] < 0
                      ? periodColors.negative
                      : periodColors.positive}
              largeText={usesLargeText}
              onPress={metric === 'income' || !onExplainPeriodMetric
                ? undefined
                : () => onExplainPeriodMetric(metric)}
            />
          ))}
        </View>
      </ThemedView>

      <ThemedView style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText type="subtitle">{t('home.globalSummary')}</ThemedText>
        <View style={styles.grid}>
          {globalMetrics.map((metric) => metric === 'credit' ? (
            <Pressable key={metric} onPress={() => onExplainGlobalMetric?.(metric)} style={({ pressed }) => [styles.metric, usesLargeText && styles.metricLargeText, pressed && styles.pressed]}>
              <ThemedText style={[styles.metricLabel, { color: colors.textSecondary }]}>
                {globalLabels[metric]}
              </ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.currencyMetricValue}>
                CLP {formatCLP(globalValues.credit)}
              </ThemedText>
              {creditTotals.hasUsd && (
                <ThemedText type="defaultSemiBold" style={styles.currencyMetricValue}>
                  {formatMoney(creditTotals.availableUsdCents, 'USD')}
                </ThemedText>
              )}
              <ThemedText style={[styles.metricLabel, styles.creditLimitLabel, { color: colors.textSecondary }]}>
                {t('home.globalMetricCreditLimits')}
              </ThemedText>
              <ThemedText style={styles.currencyMetricSecondary}>CLP {formatCLP(creditTotals.limitClp)}</ThemedText>
              {creditTotals.hasUsd && (
                <ThemedText style={styles.currencyMetricSecondary}>
                  {formatMoney(creditTotals.limitUsdCents, 'USD')}
                </ThemedText>
              )}
              <FinancialInfoButton onPress={() => onExplainGlobalMetric?.(metric)} style={styles.info} />
            </Pressable>
          ) : (
              <MetricRow
                key={metric}
                label={globalLabels[metric]}
                value={globalValues[metric]}
                color={metric === 'debt' || metric === 'billedCredit'
                  ? colors.expense
                  : metric === 'savings' ? colors.savings : undefined}
                largeText={usesLargeText}
                onPress={() => onExplainGlobalMetric?.(metric)}
              />
            ))}
        </View>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  card: { borderWidth: 1, borderColor: 'transparent', borderRadius: 18, padding: 18, gap: 14, elevation: 2 },
  periodCard: { borderWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, rowGap: 14 },
  metric: { width: '50%', paddingHorizontal: 6, paddingRight: 28, gap: 3, position: 'relative' },
  metricLargeText: { width: '100%' },
  metricLabel: { fontSize: 12, lineHeight: 17 },
  metricValue: { fontFamily: Fonts.bold, fontSize: 18, lineHeight: 24 },
  currencyMetricValue: { fontSize: 14, lineHeight: 19 },
  creditLimitLabel: { marginTop: 5 },
  currencyMetricSecondary: { fontSize: 12, lineHeight: 17 },
  info: { position: 'absolute', right: 2, top: -3 },
  pressed: { opacity: 0.68 },
});
