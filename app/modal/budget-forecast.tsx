import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { usePeriodDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { groupFinancialForecastItems } from '@/lib/financial-forecast';
import { APP_LOCALE, t } from '@/lib/i18n';
import { logAppError } from '@/lib/logger';
import { toIsoDate } from '@/lib/recurrence';
import type { BudgetForecast, FinancialForecastItem } from '@/lib/types';
import { getBudgetForecast } from '@/repositories';

const EMPTY: BudgetForecast = {
  categories: [], items: [], projectedIncome: 0, projectedOutflow: 0, projectedNet: 0,
};

function money(value: number): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
  }).format(value);
}

function date(value: string): string {
  return new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: 'medium' })
    .format(new Date(`${value}T12:00:00`));
}

export default function BudgetForecastScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { selectedPeriodId } = usePeriodDatabase();
  const [forecast, setForecast] = useState<BudgetForecast>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const today = toIsoDate(new Date());
  const groups = groupFinancialForecastItems(forecast.items, today);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    (selectedPeriodId == null
      ? Promise.resolve(EMPTY)
      : getBudgetForecast(selectedPeriodId, today))
      .then((next) => { if (active) setForecast(next); })
      .catch((error) => {
        if (!active) return;
        setLoadFailed(true);
        logAppError('forecast.load', error);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedPeriodId, today]));

  const renderItem = (item: FinancialForecastItem) => {
    const isIncome = item.kind === 'income' || item.kind === 'receivable';
    const icon = isIncome
      ? 'arrow-down-circle-outline'
      : item.kind === 'debt'
        ? 'people-outline'
        : item.kind === 'installment' || item.kind === 'billed'
          ? 'card-outline'
          : 'repeat-outline';
    return (
      <ThemedView key={item.id} style={[styles.item, { borderBottomColor: colors.border }]}>
        <Ionicons name={icon} size={23} color={isIncome ? colors.success : colors.warning} />
        <View style={styles.itemCopy}>
          <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
          <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
            {t(`budgetForecast.kinds.${item.kind}`)} · {date(item.date)}
          </ThemedText>
        </View>
        <ThemedText style={{ color: isIncome ? colors.success : colors.expense }}>
          {isIncome ? '+' : '−'}{money(item.amount)}
        </ThemedText>
      </ThemedView>
    );
  };

  if (loading) {
    return <View style={[styles.loading, { backgroundColor: colors.screen }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (loadFailed) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
        <View style={styles.content}>
          <ThemedView style={[styles.emptyCard, { borderColor: colors.border }]}>
            <ThemedText style={{ color: colors.textSecondary }}>{t('budgetForecast.loadError')}</ThemedText>
          </ThemedView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={[styles.intro, { color: colors.textSecondary }]}>
          {t('budgetForecast.description')}
        </ThemedText>
        <ThemedView style={[styles.summary, { backgroundColor: colors.primary }]}>
          <ThemedText style={[styles.summaryLabel, { color: colors.onPrimary }]}>{t('budgetForecast.projectedNet')}</ThemedText>
          <ThemedText style={[styles.summaryAmount, { color: colors.onPrimary }]}>{money(forecast.projectedNet)}</ThemedText>
          <View style={styles.summaryColumns}>
            <View style={styles.summaryColumn}>
              <ThemedText style={[styles.summaryMeta, { color: colors.onPrimary }]}>{t('budgetForecast.expectedIncome')}</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: colors.onPrimary }]}>{money(forecast.projectedIncome)}</ThemedText>
            </View>
            <View style={styles.summaryColumn}>
              <ThemedText style={[styles.summaryMeta, { color: colors.onPrimary }]}>{t('budgetForecast.expectedOutflow')}</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: colors.onPrimary }]}>{money(forecast.projectedOutflow)}</ThemedText>
            </View>
          </View>
        </ThemedView>

        <View style={styles.section}>
          <ThemedText type="subtitle">{t('budgetForecast.budgets')}</ThemedText>
          <ThemedText style={{ color: colors.textSecondary }}>{t('budgetForecast.budgetsHint')}</ThemedText>
        </View>
        {forecast.categories.length === 0 ? (
          <ThemedView style={[styles.emptyCard, { borderColor: colors.border }]}>
            <ThemedText style={{ color: colors.textSecondary }}>{t('budgetForecast.noBudgets')}</ThemedText>
          </ThemedView>
        ) : forecast.categories.map((category) => {
          const ratio = category.limit > 0 ? category.spent / category.limit : 0;
          const progress = Math.min(1, ratio);
          const color = ratio > 1 ? colors.danger : ratio >= 0.8 ? colors.warning : category.color;
          return (
            <ThemedView key={category.categoryId} style={[styles.budgetCard, { borderColor: colors.border }]}>
              <View style={styles.rowBetween}>
                <ThemedText type="defaultSemiBold">{category.name}</ThemedText>
                <ThemedText style={{ color }}>{Math.round(ratio * 100)}%</ThemedText>
              </View>
              <View style={[styles.track, { backgroundColor: colors.border }]}>
                <View style={[styles.progress, { backgroundColor: color, width: `${progress * 100}%` }]} />
              </View>
              <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
                {t('budgetForecast.spentOf', { spent: money(category.spent), limit: money(category.limit) })}
              </ThemedText>
            </ThemedView>
          );
        })}

        <View style={styles.section}>
          <ThemedText type="subtitle">{t('budgetForecast.upcoming')}</ThemedText>
          <ThemedText style={{ color: colors.textSecondary }}>{t('budgetForecast.upcomingHint')}</ThemedText>
        </View>
        {forecast.items.length === 0 ? (
          <ThemedView style={[styles.emptyCard, { borderColor: colors.border }]}>
            <ThemedText style={{ color: colors.textSecondary }}>{t('budgetForecast.noUpcoming')}</ThemedText>
          </ThemedView>
        ) : ([
          ['overdue', groups.overdue],
          ['today', groups.today],
          ['soon', groups.soon],
          ['later', groups.later],
        ] as const).map(([group, items]) => items.length > 0 && (
          <View key={group}>
            <ThemedText style={[styles.groupLabel, { color: group === 'overdue' ? colors.danger : colors.textSecondary }]}>
              {t(`budgetForecast.groups.${group}`)}
            </ThemedText>
            {items.map(renderItem)}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 44, gap: 12 }, intro: { fontSize: 16, lineHeight: 23 },
  summary: { borderRadius: 18, padding: 20, gap: 5 }, summaryLabel: { opacity: 0.86 },
  summaryAmount: { fontFamily: Fonts.bold, fontSize: 30 }, summaryColumns: { flexDirection: 'row', gap: 20, marginTop: 10 },
  summaryColumn: { flex: 1, gap: 2 }, summaryMeta: { fontSize: 12, opacity: 0.82 }, summaryValue: { fontFamily: Fonts.semiBold },
  section: { gap: 3, marginTop: 12 }, emptyCard: { borderWidth: 1, borderRadius: 14, padding: 16 },
  budgetCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 9 }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' }, progress: { height: '100%', borderRadius: 4 }, meta: { fontSize: 13 },
  item: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth }, itemCopy: { flex: 1, gap: 2 },
  groupLabel: { fontFamily: Fonts.semiBold, fontSize: 12, marginTop: 8, marginBottom: 2, textTransform: 'uppercase' },
});
