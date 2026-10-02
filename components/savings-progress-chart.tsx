import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Stop,
} from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP, formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { SavingsProgressPoint } from '@/lib/savings-progress';

const WIDTH = 320;
const HEIGHT = 170;
const LEFT = 10;
const RIGHT = 10;
const TOP = 14;
const BOTTOM = 18;

function displayDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return formatDate(new Date(year, month - 1, day, 12));
}

type SavingsProgressChartProps = {
  color: string;
  points: SavingsProgressPoint[];
  targetAmount: number;
};

export function SavingsProgressChart({ color, points, targetAmount }: SavingsProgressChartProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const geometry = useMemo(() => {
    const values = points.map((point) => point.balance);
    const maximumBalance = Math.max(1, ...values);
    const showTarget = targetAmount <= maximumBalance * 1.35;
    const maximum = Math.max(maximumBalance * 1.12, showTarget ? targetAmount : 0, 1);
    const plotWidth = WIDTH - LEFT - RIGHT;
    const plotHeight = HEIGHT - TOP - BOTTOM;
    const coordinates = points.map((point, index) => ({
      ...point,
      x: points.length === 1
        ? LEFT + plotWidth / 2
        : LEFT + (index / (points.length - 1)) * plotWidth,
      y: TOP + plotHeight - (point.balance / maximum) * plotHeight,
    }));
    const linePath = coordinates.map((point, index) => (
      `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    )).join(' ');
    const first = coordinates[0];
    const last = coordinates.at(-1);
    const areaPath = first && last
      ? `${linePath} L ${last.x} ${TOP + plotHeight} L ${first.x} ${TOP + plotHeight} Z`
      : '';
    return {
      areaPath,
      coordinates,
      linePath,
      maximum,
      plotHeight,
      showTarget,
      targetY: TOP + plotHeight - (targetAmount / maximum) * plotHeight,
    };
  }, [points, targetAmount]);
  const first = points[0];
  const last = points.at(-1);

  return (
    <View
      accessibilityLabel={t('savings.progressChartAccessibility', {
        start: formatCLP(first?.balance ?? 0),
        current: formatCLP(last?.balance ?? 0),
      })}
      accessibilityRole="image"
      style={styles.container}>
      <View style={styles.valueRow}>
        <View>
          <ThemedText style={[styles.valueLabel, { color: colors.textSecondary }]}>
            {t('savings.progressHistoryStart')}
          </ThemedText>
          <ThemedText type="defaultSemiBold">{formatCLP(first?.balance ?? 0)}</ThemedText>
        </View>
        <View style={styles.currentValue}>
          <ThemedText style={[styles.valueLabel, { color: colors.textSecondary }]}>
            {t('savings.progressHistoryCurrent')}
          </ThemedText>
          <ThemedText type="defaultSemiBold" style={{ color }}>{formatCLP(last?.balance ?? 0)}</ThemedText>
        </View>
      </View>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <LinearGradient id="savingsArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.30" />
            <Stop offset="1" stopColor={color} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = TOP + geometry.plotHeight * ratio;
          return <Line key={ratio} x1={LEFT} x2={WIDTH - RIGHT} y1={y} y2={y} stroke={colors.border} strokeWidth="1" />;
        })}
        {geometry.showTarget && (
          <Line
            x1={LEFT}
            x2={WIDTH - RIGHT}
            y1={geometry.targetY}
            y2={geometry.targetY}
            stroke={colors.textSecondary}
            strokeDasharray="5 5"
            strokeOpacity="0.55"
          />
        )}
        {geometry.areaPath && <Path d={geometry.areaPath} fill="url(#savingsArea)" />}
        {geometry.linePath && (
          <Path
            d={geometry.linePath}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        )}
        {geometry.coordinates.map((point, index) => (
          <Circle
            key={point.id}
            cx={point.x}
            cy={point.y}
            fill={index === geometry.coordinates.length - 1 ? color : colors.surface}
            r={index === geometry.coordinates.length - 1 ? 4.5 : 3}
            stroke={color}
            strokeWidth="2"
          />
        ))}
      </Svg>
      <View style={styles.dateRow}>
        <ThemedText style={[styles.date, { color: colors.textSecondary }]}>
          {first ? displayDate(first.date) : ''}
        </ThemedText>
        <ThemedText style={[styles.date, { color: colors.textSecondary }]}>
          {last ? displayDate(last.date) : ''}
        </ThemedText>
      </View>
      <ThemedText style={[styles.target, { color: colors.textSecondary }]}>
        {t('savings.target', { amount: formatCLP(targetAmount) })}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  currentValue: { alignItems: 'flex-end' },
  valueLabel: { fontSize: 11, lineHeight: 15 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  date: { fontSize: 11 },
  target: { fontSize: 11, textAlign: 'center', marginTop: 3 },
});
