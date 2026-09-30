import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';
import type { HomeGlobalMetricId, HomePeriodMetricId } from '@/lib/home-preferences';
import { t } from '@/lib/i18n';

type HomeSummaryCardsProps = {
  periodMetrics: HomePeriodMetricId[];
  globalMetrics: HomeGlobalMetricId[];
  periodValues: Record<HomePeriodMetricId, number>;
  globalValues: Record<HomeGlobalMetricId, number>;
};

type MetricRowProps = {
  label: string;
  value: number;
  color?: string;
  labelColor?: string;
};

function MetricRow({ label, value, color, labelColor }: MetricRowProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  return (
    <View style={styles.metric}>
      <ThemedText style={[styles.metricLabel, { color: labelColor ?? colors.textSecondary }]}>{label}</ThemedText>
      <ThemedText type="defaultSemiBold" style={[styles.metricValue, color ? { color } : undefined]}>
        {formatCLP(value)}
      </ThemedText>
    </View>
  );
}

export function HomeSummaryCards({
  periodMetrics,
  globalMetrics,
  periodValues,
  globalValues,
}: HomeSummaryCardsProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
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
              color={colors.onPrimary}
            />
          ))}
        </View>
      </ThemedView>

      <ThemedView style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText type="subtitle">{t('home.globalSummary')}</ThemedText>
        <View style={styles.grid}>
          {globalMetrics.map((metric) => (
            <MetricRow
              key={metric}
              label={globalLabels[metric]}
              value={globalValues[metric]}
              color={metric === 'debt' || metric === 'billedCredit'
                ? colors.expense
                : metric === 'savings' ? colors.savings : undefined}
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
  metric: { width: '50%', paddingHorizontal: 6, gap: 3 },
  metricLabel: { fontSize: 12, lineHeight: 17 },
  metricValue: { fontFamily: Fonts.bold, fontSize: 18, lineHeight: 24 },
});
