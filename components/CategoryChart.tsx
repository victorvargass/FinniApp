import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { PeriodCategoryExpensesTotals } from '@/lib/types';

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
  const [hiddenCategoryKeys, setHiddenCategoryKeys] = useState<Set<string>>(() => new Set());
  const chartAnimation = useRef(new Animated.Value(1)).current;
  const showPie = withSpending.length > 0;

  useEffect(() => {
    setSelectedCategoryKey(null);
  }, [periodCategoryExpensesTotals, selectionResetKey]);

  useEffect(() => {
    setHiddenCategoryKeys(new Set());
  }, [selectionResetKey]);

  const pieData = withSpending.map((item) => ({
      value: item.total,
      color: item.categoryColor,
      text: item.categoryName,
      categoryId: item.categoryId,
      categoryKey:
        item.categoryId === null ? 'uncategorized' : `category-${item.categoryId}`,
    }));
  const visiblePieData = pieData.filter((item) => !hiddenCategoryKeys.has(item.categoryKey));
  const visibleTotal = hiddenCategoryKeys.size === 0
    ? periodExpensesTotal
    : visiblePieData.reduce((sum, item) => sum + item.value, 0);
  const visibilityKey = visiblePieData.map((item) => item.categoryKey).join('|');

  useEffect(() => {
    chartAnimation.setValue(0);
    const animation = Animated.timing(chartAnimation, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [chartAnimation, visibilityKey]);

  if (!showPie) {
    return (
      <View style={styles.empty}>
        <ThemedText style={styles.emptyText}>{t('breakdown.emptyExpenses')}</ThemedText>
      </View>
    );
  }

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

  const toggleCategoryVisibility = (categoryKey: string) => {
    setSelectedCategoryKey((current) => current === categoryKey ? null : current);
    setHiddenCategoryKeys((current) => {
      const next = new Set(current);
      if (next.has(categoryKey)) next.delete(categoryKey);
      else next.add(categoryKey);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{
        opacity: chartAnimation,
        transform: [{ scale: chartAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
      }}>
        {visiblePieData.length > 0 ? (
          <PieChart
            data={visiblePieData}
            donut
            radius={110}
            innerRadius={65}
            innerCircleColor={surfaceColor ?? colors.surface}
            centerLabelComponent={() => (
              <View style={styles.centerLabel}>
                <ThemedText style={[styles.centerAmount, { color: colors.text }]}>{formatCLP(visibleTotal)}</ThemedText>
                <ThemedText style={[styles.centerSub, { color: colors.textSecondary }]}>{t('expenses.total')}</ThemedText>
              </View>
            )}
            onPress={(item: any) => {
              handleCategoryPress(item);
            }}
            focusOnPress
            toggleFocusOnPress
            focusedPieIndex={selectedCategoryKey !== null ? visiblePieData.findIndex((item) => item.categoryKey === selectedCategoryKey) : -1}
          />
        ) : (
          <View style={styles.noVisibleItems}>
            <Ionicons name="eye-off-outline" size={28} color={colors.icon} />
            <ThemedText style={styles.emptyText}>{t('breakdown.noVisibleItems')}</ThemedText>
          </View>
        )}
      </Animated.View>

      <View style={styles.legend}>
        {pieData.map((item) => {
          const visible = !hiddenCategoryKeys.has(item.categoryKey);
          const selected = item.categoryKey === selectedCategoryKey;
          return (
            <View key={item.categoryKey} style={styles.legendRow}>
              <Pressable
                accessibilityHint={t('accessibility.chartItemHint')}
                accessibilityLabel={`${item.text}: ${formatCLP(item.value)}`}
                accessibilityRole="button"
                accessibilityState={{ selected: selected, disabled: !visible }}
                disabled={!visible}
                style={[styles.legendMain, !visible && styles.legendHidden]}
                onPress={() => handleCategoryPress(item)}>
                <View style={[
                  styles.dot,
                  {
                    backgroundColor: item.color,
                    borderColor: selected ? colors.text : item.color,
                    borderWidth: selected ? 2 : 1,
                  },
                ]} />
                <ThemedText
                  style={[
                    styles.legendName,
                    { color: colors.text, fontWeight: selected ? '700' : '400' },
                  ]}>
                  {item.text}
                </ThemedText>
                <ThemedText style={{ color: colors.text, fontSize: 14, fontWeight: selected ? '700' : '400' }}>
                  {formatCLP(item.value)}
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityLabel={t(visible ? 'breakdown.hideItem' : 'breakdown.showItem', { name: item.text })}
                accessibilityRole="switch"
                accessibilityState={{ checked: visible }}
                hitSlop={6}
                onPress={() => toggleCategoryVisibility(item.categoryKey)}
                style={styles.visibilityButton}>
                <Ionicons
                  color={visible ? colors.primary : colors.icon}
                  name={visible ? 'eye-outline' : 'eye-off-outline'}
                  size={22}
                />
              </Pressable>
            </View>
          );
        })}
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
  noVisibleItems: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  legend: {
    width: '100%',
    gap: 8,
  },
  legendRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendMain: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendHidden: {
    opacity: 0.42,
  },
  visibilityButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
