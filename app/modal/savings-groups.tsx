import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/floating-action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

export default function SavingsGroupsScreen() {
  const { savingsGroups, savingsGoals } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
      <FlatList
        data={savingsGroups}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<ThemedText style={styles.empty}>{t('groupings.savingsGroupEmpty')}</ThemedText>}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/modal/organizer-form', params: { kind: 'savings', id: String(item.id) } })}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView style={[styles.item, { borderColor: colors.border }]}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <View style={styles.copy}>
                <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                <ThemedText style={[styles.detail, { color: colors.textSecondary }]}>
                  {t('groupings.goalsCount', { count: savingsGoals.filter((goal) => goal.groupId === item.id).length })}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={21} color={colors.icon} />
            </ThemedView>
          </Pressable>
        )}
      />
      <FloatingActionButton
        href={{ pathname: '/modal/organizer-form', params: { kind: 'savings' } }}
        accessibilityLabel={t('groupings.savingsGroupNew')}
        avoidBottomInset
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: 20, paddingBottom: 105, gap: 10 },
  empty: { textAlign: 'center', opacity: 0.6, marginTop: 40 },
  item: { minHeight: 65, padding: 14, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 18, height: 18, borderRadius: 6 },
  copy: { flex: 1, gap: 3 },
  detail: { fontSize: 12 },
  pressed: { opacity: 0.7 },
});
