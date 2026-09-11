import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ExpensesScreen from './expenses';
import IncomesScreen from './incomes';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

type MovementType = 'expenses' | 'incomes';

export default function MovementsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [movementType, setMovementType] = useState<MovementType>('expenses');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">{t('navigation.movements')}</ThemedText>
      </ThemedView>
      <ThemedView style={[styles.segmentedControl, { borderColor: colors.border }]}>
        {(['expenses', 'incomes'] as const).map((type) => {
          const selected = movementType === type;
          return (
            <Pressable
              key={type}
              style={[styles.segment, selected && { backgroundColor: colors.primary }]}
              onPress={() => setMovementType(type)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}>
              <Ionicons
                name={type === 'expenses' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                size={19}
                color={selected ? colors.onPrimary : colors.icon}
              />
              <ThemedText style={[styles.segmentLabel, selected && { color: colors.onPrimary }]}>
                {t(type === 'expenses' ? 'navigation.expenses' : 'navigation.incomes')}
              </ThemedText>
            </Pressable>
          );
        })}
      </ThemedView>
      <View style={styles.content}>
        {movementType === 'expenses' ? <ExpensesScreen embedded /> : <IncomesScreen embedded />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 4,
    padding: 4,
    borderWidth: 1,
    borderRadius: 16,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  segmentLabel: {
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
});
