import { Pressable, StyleSheet, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { ThemedText } from '@/components/themed-text';
import { formatCLP } from '@/lib/format';
import type { PeriodCategoryExpensesTotals } from '@/lib/types';
import { useState } from 'react';

type CategoryChartProps = {
  periodCategoryExpensesTotals: PeriodCategoryExpensesTotals[];
  periodExpensesTotal: number;
  onOpenCategory?: (categoryId: number | null) => void;
};

export function CategoryChart({
  periodCategoryExpensesTotals,
  periodExpensesTotal,
  onOpenCategory,
}: CategoryChartProps) {
  const withSpending = periodCategoryExpensesTotals.filter((item) => item.total > 0);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const showPie = withSpending.length > 0

  if (!showPie) {
    return (
      <View style={styles.empty}>
        <ThemedText style={styles.emptyText}>Sin gastos durante este período</ThemedText>
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
        centerLabelComponent={() => (
          <View style={styles.centerLabel}>
            <ThemedText style={styles.centerAmount}>{formatCLP(periodExpensesTotal)}</ThemedText>
            <ThemedText style={styles.centerSub}>Total gastos</ThemedText>
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
            <View style={[styles.dot, { backgroundColor: item.color, borderColor: item.categoryKey === selectedCategoryKey ? '#000' : item.color }]} />
            <ThemedText
              style={[
                styles.legendName,
                { 
                  color: item.categoryKey === selectedCategoryKey ? '#000' : '#666',
                  fontSize: item.categoryKey === selectedCategoryKey ? 17 : 14
                }
              ]}
            >
              {item.text}
            </ThemedText>
            <ThemedText type="defaultSemiBold" style={[
                {
                  color: item.categoryKey === selectedCategoryKey ? '#000' : '#666',
                  fontSize: item.categoryKey === selectedCategoryKey ? 17 : 14,
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
