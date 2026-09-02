import { Pressable, StyleSheet, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { PeriodCategoryExpensesTotals } from '@/lib/types';
import { useEffect, useState } from 'react';

type CategoryChartProps = {
  periodCategoryExpensesTotals: PeriodCategoryExpensesTotals[];
  periodExpensesTotal: number;
  onOpenCategory?: (categoryId: number | null) => void;
  surfaceColor?: string;
  selectionResetKey?: string | number;
};

export function CategoryChart({
  periodCategoryExpensesTotals,
  periodExpensesTotal,
  onOpenCategory,
  surfaceColor,
  selectionResetKey,
}: CategoryChartProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const withSpending = periodCategoryExpensesTotals.filter((item) => item.total > 0);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const showPie = withSpending.length > 0

  useEffect(() => {
    setSelectedCategoryKey(null);
  }, [selectionResetKey, periodCategoryExpensesTotals]);

  if (!showPie) {
    return (
      <View style={styles.empty}>
        <ThemedText style={styles.emptyText}>{t('breakdown.emptyExpenses')}</ThemedText>
      </View>
    );
  }

  const pieData = [
    ...withSpending.map((item) => ({
      value: item.total,
      color: item.categoryColor,
      text: item.categoryName,
      categoryId: item.categoryId,
      categoryKey:
        item.categoryId === null ? 'uncategorized' : `category-${item.categoryId}`,
    }))
  ];

  const handleCategoryPress = (item: (typeof pieData)[number]) => {
    if (selectedCategoryKey === item.categoryKey) {
      if (onOpenCategory) {
        setSelectedCategoryKey(null);
        onOpenCategory(item.categoryId);
      } else {
        setSelectedCategoryKey(null);
      }
      return;
    }

    setSelectedCategoryKey(item.categoryKey);
  };

  return (
    <View style={styles.container}>
      <PieChart
        data={pieData}
        donut
        radius={110}
        innerRadius={65}
        innerCircleColor={surfaceColor ?? colors.surface}
        centerLabelComponent={() => (
          <View style={styles.centerLabel}>
            <ThemedText style={[styles.centerAmount, { color: colors.text }]}>{formatCLP(periodExpensesTotal)}</ThemedText>
            <ThemedText style={[styles.centerSub, { color: colors.textSecondary }]}>{t('expenses.total')}</ThemedText>
          </View>
        )}
        onPress={(item: any, index: number) => {
          handleCategoryPress(item);
        }}
        focusOnPress={true}
        toggleFocusOnPress={true}
        focusedPieIndex={selectedCategoryKey !== null ? pieData.findIndex((item) => item.categoryKey === selectedCategoryKey) : -1}
      />

      <View style={styles.legend}>
        {pieData.map((item) => (
          <Pressable
            key={item.categoryKey}
            style={styles.legendRow}
            onPress={() => {
              handleCategoryPress(item);
            }}
          >
            <View style={[
              styles.dot,
              {
                backgroundColor: item.color,
                borderColor: item.categoryKey === selectedCategoryKey ? colors.text : item.color,
                borderWidth: item.categoryKey === selectedCategoryKey ? 2 : 1,
              },
            ]} />
            <ThemedText
              style={[
                styles.legendName,
                {
                  color: colors.text,
                  fontSize: 14,
                  fontWeight: item.categoryKey === selectedCategoryKey ? '700' : '400',
                }
              ]}
            >
              {item.text}
            </ThemedText>
            <ThemedText style={[
                {
                  color: colors.text,
                  fontSize: 14,
                  fontWeight: item.categoryKey === selectedCategoryKey ? '700' : '400',
                }
            ]}>
              {formatCLP(item.value)}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 20,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    opacity: 0.6,
  },
  centerLabel: {
    alignItems: 'center',
  },
  centerAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  centerSub: {
    fontSize: 12,
    opacity: 0.6,
  },
  legend: {
    width: '100%',
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  legendName: {
    flex: 1,
  },
});
