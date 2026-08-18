import { Pressable, StyleSheet, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { ThemedText } from '@/components/themed-text';
import { formatCLP } from '@/lib/format';
import type { PeriodCategoryExpensesTotals } from '@/lib/types';
import { useState } from 'react';

type CategoryChartProps = {
  periodCategoryExpensesTotals: PeriodCategoryExpensesTotals[];
  periodExpensesTotal: number;
};

export function CategoryChart({ periodCategoryExpensesTotals, periodExpensesTotal }: CategoryChartProps) {
  const withSpending = periodCategoryExpensesTotals.filter((item) => item.total > 0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
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
    }))
  ];

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
          if (selectedCategoryId === item.categoryId) {
            setSelectedCategoryId(null);
          } else {
            setSelectedCategoryId(item.categoryId);
          }
        }}
        focusOnPress={true}
        toggleFocusOnPress={true}
        focusedPieIndex={selectedCategoryId ? pieData.findIndex((item) => item.categoryId === selectedCategoryId) : -1}
      />

      <View style={styles.legend}>
        {pieData.map((item) => (
          <Pressable
            key={item.categoryId}
            style={styles.legendRow}
            onPress={() => {
              if (selectedCategoryId === item.categoryId) {
                setSelectedCategoryId(null);
              } else {
                setSelectedCategoryId(item.categoryId);
              }
            }}
          >
            <View style={[styles.dot, { backgroundColor: item.color, borderColor: item.categoryId === selectedCategoryId ? '#000' : item.color }]} />
            <ThemedText
              style={[
                styles.legendName,
                { 
                  color: item.categoryId === selectedCategoryId ? '#000' : '#666',
                  fontSize: item.categoryId === selectedCategoryId ? 17 : 14
                }
              ]}
            >
              {item.text}
            </ThemedText>
            <ThemedText type="defaultSemiBold" style={[
                {
                  color: item.categoryId === selectedCategoryId ? '#000' : '#666',
                  fontSize: item.categoryId === selectedCategoryId ? 17 : 14,
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
