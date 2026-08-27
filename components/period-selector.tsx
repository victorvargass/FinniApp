import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDate } from '@/lib/format';

function formatPeriodDate(value: string) {
  return formatDate(new Date(`${value}T12:00:00`));
}

export function PeriodSelector() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { periods, selectedPeriod, settings, selectPeriod } = useDatabase();

  if (!selectedPeriod) return null;

  // getPeriods returns newest first. Left moves into history; right moves forward.
  const selectedIndex = periods.findIndex((period) => period.id === selectedPeriod.id);
  const previousPeriod = periods[selectedIndex + 1];
  const nextPeriod = selectedIndex > 0 ? periods[selectedIndex - 1] : undefined;
  const isCurrent = selectedPeriod.id === settings.currentPeriodId;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}>
      <Pressable
        accessibilityLabel="Ver período anterior"
        disabled={!previousPeriod}
        hitSlop={8}
        onPress={() => previousPeriod && selectPeriod(previousPeriod.id)}
        style={[styles.arrow, !previousPeriod && styles.disabled]}>
        <Ionicons name="chevron-back" size={23} color={colors.icon} />
      </Pressable>

      <View style={styles.copy}>
        <View style={styles.labelRow}>
          <ThemedText type="defaultSemiBold">
            {isCurrent ? 'Período actual' : 'Período histórico'}
          </ThemedText>
        </View>
        <ThemedText style={styles.dates}>
          {formatPeriodDate(selectedPeriod.startDate)} – {formatPeriodDate(selectedPeriod.endDate)}
        </ThemedText>
      </View>

      <Pressable
        accessibilityLabel="Ver período siguiente"
        disabled={!nextPeriod}
        hitSlop={8}
        onPress={() => nextPeriod && selectPeriod(nextPeriod.id)}
        style={[styles.arrow, !nextPeriod && styles.disabled]}>
        <Ionicons name="chevron-forward" size={23} color={colors.icon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  arrow: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.22,
  },
  copy: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dates: {
    fontSize: 13,
    opacity: 0.7,
    textAlign: 'center',
  },
});
