import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/floating-action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';
import { t } from '@/lib/i18n';

export default function CategoriesScreen() {
  const { categories, incomeCategories } = useDatabase();
  const { tab: requestedTab } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'expenses' | 'incomes'>(requestedTab === 'incomes' ? 'incomes' : 'expenses');
  const colors = Colors[useColorScheme() ?? 'light'];
  const rows: { id: number; name: string; color: string; periodLimit: number | null }[] = tab === 'expenses'
    ? categories.map(({ id, name, color, periodLimit }) => ({ id, name, color, periodLimit }))
    : incomeCategories.map(({ id, name, color }) => ({ id, name, color, periodLimit: null }));

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={rows}
        keyExtractor={(item) => `${tab}-${item.id}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={[styles.tabs, { borderColor: colors.border }]}>
            {(['expenses', 'incomes'] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === value }}
                onPress={() => setTab(value)}
                style={[styles.tab, tab === value && { backgroundColor: colors.primary }]}>
                <ThemedText type="defaultSemiBold" style={tab === value && { color: colors.onPrimary }}>
                  {t(value === 'expenses' ? 'groupings.expenseCategories' : 'groupings.incomeCategories')}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        }
        ListEmptyComponent={
          <ThemedText style={styles.empty}>
            {t(tab === 'expenses' ? 'categories.empty' : 'groupings.incomeEmpty')}
          </ThemedText>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={t('categories.configure', { name: item.name })}
            accessibilityRole="button"
            onPress={() => router.push(tab === 'expenses'
              ? { pathname: '/modal/category-form', params: { id: String(item.id) } }
              : { pathname: '/modal/organizer-form', params: { kind: 'income', id: String(item.id) } })}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView style={styles.item}>
              <View style={styles.itemLeft}>
                <View style={[styles.colorBadge, { backgroundColor: item.color }]} />
                <View style={styles.copy}>
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                  {tab === 'expenses' && item.periodLimit != null && (
                    <ThemedText style={styles.limit}>
                      {t('categories.limitPerPeriod', { amount: formatCLP(item.periodLimit) })}
                    </ThemedText>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={21} color={colors.icon} />
            </ThemedView>
          </Pressable>
        )}
      />
      <FloatingActionButton
        href={tab === 'expenses' ? '/modal/category-form' : { pathname: '/modal/organizer-form', params: { kind: 'income' } }}
        accessibilityLabel={t('accessibility.addCategory')}
        avoidBottomInset
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  list: {
    padding: 20,
    paddingBottom: 100,
    gap: 10,
  },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 4, marginBottom: 8 },
  tab: { flex: 1, minHeight: 43, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  empty: {
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 40,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    minHeight: 48,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  colorBadge: {
    width: 18,
    height: 18,
    borderRadius: 6,
  },
  copy: { flex: 1, gap: 3 },
  limit: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  pressed: { opacity: 0.65 },
});
