import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formatCLP } from '@/lib/format';
import { t } from '@/lib/i18n';

type SavingsGoalProgressProps = {
  currentAmount: number;
  targetAmount: number;
  color: string;
};

export function SavingsGoalProgress({
  currentAmount,
  targetAmount,
  color,
}: SavingsGoalProgressProps) {
  const safeCurrent = Math.max(0, currentAmount);
  const safeTarget = Math.max(0, targetAmount);
  const ratio = safeTarget > 0 ? safeCurrent / safeTarget : 0;
  const cappedProgress = Math.min(ratio, 1);
  const percentage = Math.round(ratio * 100);
  const excess = Math.max(safeCurrent - safeTarget, 0);
  const progressColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#0B315B';

  return (
    <View style={styles.container}>
      <View style={styles.amountRow}>
        <ThemedText type="defaultSemiBold">{formatCLP(safeCurrent)}</ThemedText>
        <ThemedText style={styles.percentage}>{percentage}%</ThemedText>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: Math.max(safeTarget, 1),
          now: Math.min(safeCurrent, Math.max(safeTarget, 1)),
          text: t('savings.progressAccessibility', { percentage }),
        }}
        style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: progressColor,
              width: `${cappedProgress * 100}%`,
            },
          ]}
        />
      </View>

      <View style={styles.footer}>
        <ThemedText style={styles.target}>{t('savings.target', { amount: formatCLP(safeTarget) })}</ThemedText>
        {safeTarget > 0 && safeCurrent >= safeTarget && (
          <ThemedText style={styles.achievement}>
            {excess > 0 ? t('savings.exceededBy', { amount: formatCLP(excess) }) : t('savings.achieved')}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 7,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  percentage: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.72,
  },
  track: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
  },
  target: {
    fontSize: 12,
    opacity: 0.65,
  },
  achievement: {
    color: '#1FAF78',
    fontSize: 12,
    fontWeight: '700',
  },
});
