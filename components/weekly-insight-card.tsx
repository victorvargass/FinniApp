import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { WeeklyInsight } from '@/lib/weekly-insights';

type WeeklyInsightCardProps = {
  insight: WeeklyInsight;
  savingsMilestone: { name: string; milestone: number } | null;
};

export function WeeklyInsightCard({ insight, savingsMilestone }: WeeklyInsightCardProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const hasActivity = insight.expenseTotal > 0 || insight.incomeTotal > 0;

  if (!hasActivity) return null;

  const comparison = insight.expenseChangePercent == null
    ? null
    : insight.expenseChangePercent === 0
      ? t('home.weeklySame')
      : insight.expenseChangePercent < 0
        ? t('home.weeklyLess', { percent: Math.abs(insight.expenseChangePercent) })
        : t('home.weeklyMore', { percent: insight.expenseChangePercent });

  const rows = [
    {
      key: 'spent',
      icon: 'calendar-outline' as const,
      text: t('home.weeklySpent', { amount: formatCLP(insight.expenseTotal) }),
    },
    comparison ? {
      key: 'comparison',
      icon: insight.expenseChangePercent != null && insight.expenseChangePercent <= 0
        ? 'trending-down-outline' as const
        : 'trending-up-outline' as const,
      text: comparison,
    } : null,
    insight.topCategoryName ? {
      key: 'category',
      icon: 'pie-chart-outline' as const,
      text: t('home.weeklyTopCategory', {
        category: insight.topCategoryName,
        amount: formatCLP(insight.topCategoryAmount),
      }),
    } : null,
    savingsMilestone ? {
      key: 'savings',
      icon: 'flag-outline' as const,
      text: t('home.savingsMilestone', {
        name: savingsMilestone.name,
        percent: savingsMilestone.milestone,
      }),
    } : null,
  ].filter((item): item is NonNullable<typeof item> => item != null);

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <ThemedText type="subtitle">{t('home.weeklyTitle')}</ThemedText>
        <ThemedText style={{ color: colors.textSecondary }}>{t('home.lastSevenDays')}</ThemedText>
      </View>
      <ThemedView style={[styles.card, { borderColor: colors.border }]}>
        {rows.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={[styles.icon, { backgroundColor: `${colors.secondary}1F` }]}>
              <Ionicons name={row.icon} size={19} color={colors.action} />
            </View>
            <ThemedText style={styles.copy}>{row.text}</ThemedText>
          </View>
        ))}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  heading: { gap: 2 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, lineHeight: 20 },
});
