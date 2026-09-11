import { HistoricalPeriodModal } from '@/components/HistoricalPeriodModal';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';
import { APP_LOCALE, t } from '@/lib/i18n';
import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';
// Utils
function formatDayShortMonth(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  const shortMonth = new Intl.DateTimeFormat(APP_LOCALE, { month: 'short' })
    .format(date)
    .replace('.', '')
    .replace(/^./, (letter) => letter.toUpperCase());
  return `${day.toString().padStart(2, '0')}-${shortMonth}`;
}

export default function HistoricalSummaryScreen() {
  const { periodHistory, selectPeriod } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const years = useMemo(() => {
    return Array.from(
      new Set(periodHistory.map(period => period.year))
    ).sort();
  }, [periodHistory]);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  const barWidth = 22;
  const spacing = 20;
  const visibleColumns = 6;
  
  const chartWidth = Math.max(
    Dimensions.get('window').width,
    visibleColumns * (barWidth + spacing) + 60
  );

  useEffect(() => {
    if (selectedYear === null && years.length > 0) {
      setSelectedYear(years[years.length - 1]);
    }
  }, [years, selectedYear]);

  const filteredPeriods = useMemo(() => {
    if (selectedYear === null) return [];
    return periodHistory.filter(period => period.year === selectedYear);
  }, [periodHistory, selectedYear]);

  const categories = useMemo(() => {
    const map = new Map();
    filteredPeriods.forEach(period => {
      period.categories.forEach(category => {
        map.set(category.categoryId, category);
      });
    });
    return Array.from(map.values());
  }, [filteredPeriods]);

  // Calcular suma total histórica para mostrar arriba del gráfico
  const totalGastado = useMemo(() => {
    return filteredPeriods.reduce(
      (total, period) =>
        total +
        period.categories.reduce(
          (ct, c) => ct + (typeof c.total === 'number' ? c.total : 0),
          0
        ),
      0
    );
  }, [filteredPeriods]);

  const stackData = useMemo(() => {
    return filteredPeriods.map((period, index) => ({
      label: formatDayShortMonth(period.startDate),
      periodIndex: index,
      stacks: categories.map(category => {
        const found = period.categories.find(
          item => item.categoryId === category.categoryId
        );
        return {
          value: found?.total ?? 0,
          color: category.categoryColor,
        };
      }),
    }));
  }, [filteredPeriods, categories]);

  const chartMaxValue = useMemo(() => {
    const max = Math.max(
      ...stackData.map(d => d.stacks.reduce((sum, s) => sum + s.value, 0))
    );
  
    const rawStep = max / 5;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
  
    let niceStep;
  
    if (normalized <= 1) {
      niceStep = 1;
    } else if (normalized <= 2) {
      niceStep = 2;
    } else if (normalized <= 5) {
      niceStep = 5;
    } else {
      niceStep = 10;
    }
  
    const step = niceStep * magnitude;
  
    return Math.ceil(max / step) * step;
  }, [stackData]);

  function YearPicker() {
    if (years.length === 0) {
      return (
        <Text style={[styles.label, { color: colors.text }]}>
          {t('history.noYears')}
        </Text>
      );
    }
    return (
      <View style={styles.yearChipContainer}>
        {years.map(year => (
          <TouchableOpacity
            key={year}
            style={[
              styles.yearChip,
              {
                borderColor: colors.tint,
                backgroundColor: selectedYear === year ? colors.tint : 'transparent',
              }
            ]}
            onPress={() => setSelectedYear(year)}
          >
            <Text
              style={{
                color: selectedYear === year ? colors.background : colors.text,
                fontFamily: selectedYear === year ? Fonts.bold : Fonts.regular,
                fontSize: 16,
              }}
            >
              {year}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">{t('history.summary')}</ThemedText>
        </ThemedView>

        {stackData.length > 0 && categories.length > 0 ? (
          <ThemedView style={styles.card}>
            <ThemedText style={styles.label}>{t('history.year')}</ThemedText>
            <YearPicker />

            {/* Mostrar total histórico gastado en formato CLP */}
            <View style={{ marginTop: 2 }}>
              <ThemedText style={{ fontWeight: '600', fontSize: 15, color: colors.text }}>
                {t('history.totalSpentYear')} <Text style={{ fontFamily: Fonts.bold }}>{formatCLP(totalGastado)}</Text>
              </ThemedText>
            </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <BarChart
                  stackData={stackData}
                  width={chartWidth}
                  height={320}
                  barWidth={barWidth}
                  spacing={spacing}
                  noOfSections={5}
                  roundedTop
                  isAnimated
                  onPress={(item: any) => {
                    const period = filteredPeriods[item.periodIndex];
                    setSelectedPeriod(period);
                    setShowPeriodModal(true);
                  }}
                  yAxisTextStyle={{
                    color: colors.text,
                    fontSize: 10,
                  }}
                  xAxisLabelTextStyle={{
                    color: colors.text,
                    fontSize: 9,
                  }}
                  rulesColor="#D8E1E8"
                  yAxisLabelPrefix="$ "
                  yAxisLabelWidth={60}
                  maxValue={chartMaxValue}
                  yAxisLabelTexts={(() => {
                    const step = chartMaxValue / 5;
                  
                    return [...Array(6).keys()].map(i => {
                      return formatCLP(step * i);
                    });
                  })()}
                />
              </ScrollView>

            {categories.length > 0 && (
              <View style={styles.categoryContainer}>
                <ThemedText style={styles.label}>{t('history.categories')}</ThemedText>
                {categories.map(category => (
                  <View
                    key={category.categoryId ?? 'uncategorized'}
                    style={styles.categoryRow}
                  >
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: category.categoryColor }
                      ]}
                    />
                    <ThemedText>{category.categoryName}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </ThemedView>
        ) : (
          <ThemedView style={styles.card}>
            <EmptyState
              icon="bar-chart-outline"
              title={t('emptyStates.historyTitle')}
              description={t('emptyStates.historyDescription')}
              actionLabel={t('emptyStates.goHome')}
              onAction={() => router.navigate('/(tabs)/home')}
            />
          </ThemedView>
        )}
      </ScrollView>

      <HistoricalPeriodModal
        visible={showPeriodModal}
        period={selectedPeriod}
        onClose={() => {
          setShowPeriodModal(false);
          setSelectedPeriod(null);
        }}
        onOpenPeriod={(periodId) => {
          selectPeriod(periodId);
          setShowPeriodModal(false);
          setSelectedPeriod(null);
          router.navigate({
            pathname: '/(tabs)/home',
            params: { scrollToTop: String(Date.now()) },
          });
        }}
        onOpenCategory={(periodId, categoryId) => {
          selectPeriod(periodId);
          setShowPeriodModal(false);
          setSelectedPeriod(null);
          router.navigate({
            pathname: '/(tabs)/expenses',
            params: {
              categoryFilter: categoryId == null ? 'none' : String(categoryId),
              paymentMethodFilter: '',
              filterRequestId: String(Date.now()),
            },
          });
        }}
        onOpenPaymentMethod={(periodId, paymentMethodId) => {
          selectPeriod(periodId);
          setShowPeriodModal(false);
          setSelectedPeriod(null);
          router.navigate({
            pathname: '/(tabs)/expenses',
            params: {
              categoryFilter: '',
              paymentMethodFilter: paymentMethodId == null ? 'none' : String(paymentMethodId),
              filterRequestId: String(Date.now()),
            },
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    gap: 16,
  },
  label: {
    fontWeight: '600',
  },
  yearChipContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 6,
    marginBottom: 6,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryContainer: {
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 24
  }
});
