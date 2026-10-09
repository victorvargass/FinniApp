import { StyleSheet, View } from 'react-native';

import { FinancialInfoButton } from '@/components/financial-info-button';
import { ThemedText } from '@/components/themed-text';
import { formatCLP } from '@/lib/format';
import { t } from '@/lib/i18n';

type LimitProgressBarProps = {
  name: string;
  color: string;
  spent: number;
  limit: number | null;
  onExplain?: () => void;
};

export function LimitProgressBar({ name, color, spent, limit, onExplain }: LimitProgressBarProps) {
  if (limit == null || limit <= 0) {
    return null;
  }

  const progress = Math.min(spent / limit, 1);
  const overLimit = spent > limit;
  const onLimitOrMore = spent >= limit;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="defaultSemiBold">{name}</ThemedText>
        <View style={styles.amountRow}>
          <ThemedText style={onLimitOrMore ? styles.overLimit : undefined}>
            {formatCLP(spent)} / {formatCLP(limit)}
          </ThemedText>
          {onExplain && <FinancialInfoButton onPress={onExplain} />}
        </View>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${progress * 100}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      {overLimit && (
        <ThemedText style={styles.warning}>
          {t('limits.exceededBy', { amount: formatCLP(spent - limit) })}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  track: {
    height: 8,
    backgroundColor: 'rgba(128,128,128,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  overLimit: {
    color: '#E95353',
    fontWeight: '600',
  },
  warning: {
    fontSize: 12,
    color: '#E95353',
  },
});
