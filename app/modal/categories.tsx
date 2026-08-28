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
import { formatCLP } from '@/lib/format';

export default function CategoriesScreen() {
  const { categories } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={categories}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <ThemedText style={styles.empty}>
            Crea categorías para organizar tus gastos.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`Configurar ${item.name}`}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/modal/category-form', params: { id: String(item.id) } })}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView style={styles.item}>
              <View style={styles.itemLeft}>
                <View style={[styles.colorBadge, { backgroundColor: item.color }]} />
                <View style={styles.copy}>
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                  {item.periodLimit != null && (
                    <ThemedText style={styles.limit}>
                      Límite: {formatCLP(item.periodLimit)}/período
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
        href="/modal/category-form"
        accessibilityLabel="Agregar categoría"
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
