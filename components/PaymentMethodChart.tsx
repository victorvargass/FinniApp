import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';

type PaymentMethodChartItem = {
  paymentMethodId: number | null;
  paymentMethodName: string;
  paymentMethodColor: string | null;
  total: number;
};

type Props = {
  items: PaymentMethodChartItem[];
  total: number;
  onOpenPaymentMethod?: (paymentMethodId: number | null) => void;
  onSelectPaymentMethod?: () => void;
  surfaceColor?: string;
  selectionResetKey?: string | number;
};

export function PaymentMethodChart({
  items,
  total,
  onOpenPaymentMethod,
  onSelectPaymentMethod,
  surfaceColor,
  selectionResetKey,
}: Props) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const withSpending = items.filter((item) => item.total > 0);

  useEffect(() => {
    setSelectedKey(null);
  }, [items, selectionResetKey]);

  if (withSpending.length === 0) {
    return (
      <View style={styles.empty}>
        <ThemedText style={styles.emptyText}>Sin gastos durante este período</ThemedText>
      </View>
    );
  }

  const pieData = withSpending.map((item) => ({
    value: item.total,
    color: item.paymentMethodColor ?? '#95a5a6',
    text: item.paymentMethodName,
    paymentMethodId: item.paymentMethodId,
    key: item.paymentMethodId == null ? 'unspecified' : `payment-${item.paymentMethodId}`,
  }));

  const handlePress = (item: (typeof pieData)[number]) => {
    onSelectPaymentMethod?.();
    if (selectedKey === item.key) {
      setSelectedKey(null);
      onOpenPaymentMethod?.(item.paymentMethodId);
      return;
    }
    setSelectedKey(item.key);
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
            <ThemedText style={[styles.centerAmount, { color: colors.text }]}>{formatCLP(total)}</ThemedText>
            <ThemedText style={[styles.centerSub, { color: colors.textSecondary }]}>Total gastos</ThemedText>
          </View>
        )}
        onPress={(item: any) => handlePress(item)}
        focusOnPress
        toggleFocusOnPress
        focusedPieIndex={selectedKey == null ? -1 : pieData.findIndex((item) => item.key === selectedKey)}
      />

      <View style={styles.legend}>
        {pieData.map((item) => (
          <Pressable key={item.key} style={styles.legendRow} onPress={() => handlePress(item)}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: item.color,
                  borderColor: item.key === selectedKey ? colors.text : item.color,
                  borderWidth: item.key === selectedKey ? 2 : 1,
                },
              ]}
            />
            <ThemedText
              style={[
                styles.legendName,
                { color: colors.text, fontWeight: item.key === selectedKey ? '700' : '400' },
              ]}>
              {item.text}
            </ThemedText>
            <ThemedText
              style={{ color: colors.text, fontSize: 14, fontWeight: item.key === selectedKey ? '700' : '400' }}>
              {formatCLP(item.value)}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 20 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { opacity: 0.6 },
  centerLabel: { alignItems: 'center' },
  centerAmount: { fontSize: 16, fontWeight: '700' },
  centerSub: { fontSize: 12, opacity: 0.6 },
  legend: { width: '100%', gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  legendName: { flex: 1, fontSize: 14 },
});
