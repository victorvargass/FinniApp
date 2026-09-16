import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ExpensesScreen from './expenses';
import IncomesScreen from './incomes';
import { AccountTransferMovements } from '@/components/account-transfer-movements';
import { CardPaymentMovements } from '@/components/card-payment-movements';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

type MovementType = 'expenses' | 'incomes' | 'card-payments' | 'transfers';

const movementTypes = [
  { key: 'expenses', icon: 'arrow-up-circle-outline', label: 'navigation.expenses' },
  { key: 'incomes', icon: 'arrow-down-circle-outline', label: 'navigation.incomes' },
  { key: 'card-payments', icon: 'card-outline', label: 'navigation.cardPayments' },
  { key: 'transfers', icon: 'swap-horizontal-outline', label: 'navigation.transfers' },
] as const;

export default function MovementsScreen() {
  const { movementType: requestedMovementType } = useLocalSearchParams<{
    movementType?: MovementType;
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [movementType, setMovementType] = useState<MovementType>('expenses');

  useEffect(() => {
    if (
      requestedMovementType === 'expenses'
      || requestedMovementType === 'incomes'
      || requestedMovementType === 'card-payments'
      || requestedMovementType === 'transfers'
    ) {
      setMovementType(requestedMovementType);
    }
  }, [requestedMovementType]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">{t('navigation.movements')}</ThemedText>
      </ThemedView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segmentedScroll}>
        <ThemedView style={[styles.segmentedControl, { borderColor: colors.border }]}>
          {movementTypes.map((type) => {
            const selected = movementType === type.key;
            return (
              <Pressable
                key={type.key}
                style={[styles.segment, selected && { backgroundColor: colors.primary }]}
                onPress={() => setMovementType(type.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}>
                <Ionicons
                  name={type.icon}
                  size={18}
                  color={selected ? colors.onPrimary : colors.icon}
                />
                <ThemedText style={[styles.segmentLabel, selected && { color: colors.onPrimary }]}>
                  {t(type.label)}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
      </ScrollView>
      <View style={styles.content}>
        {movementType === 'expenses' && <ExpensesScreen embedded />}
        {movementType === 'incomes' && <IncomesScreen embedded />}
        {movementType === 'card-payments' && <CardPaymentMovements />}
        {movementType === 'transfers' && <AccountTransferMovements />}
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
    padding: 4,
    borderWidth: 1,
    borderRadius: 16,
  },
  segmentedScroll: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  segment: {
    minWidth: 108,
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
