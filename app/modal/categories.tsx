import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Alert, FlatList, Platform, Pressable, StyleSheet, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/floating-action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDatabase } from '@/contexts/DatabaseContext';
import { formatCLP } from '@/lib/format';

export default function CategoriesScreen() {
  const { categories, getCategoryExpenseCount, removeCategory } = useDatabase();

  const handleDelete = async (id: number, name: string) => {
    let expenseCount: number;
    try {
      expenseCount = await getCategoryExpenseCount(id);
    } catch {
      Alert.alert('Error', 'No se pudo comprobar si la categoría está en uso.');
      return;
    }

    const hasExpenses = expenseCount > 0;
    const message = hasExpenses
      ? `Hay ${expenseCount} ${expenseCount === 1 ? 'gasto asociado' : 'gastos asociados'} a "${name}". Si eliminas la categoría, ${expenseCount === 1 ? 'el gasto quedará' : 'los gastos quedarán'} sin categoría.\n\n¿Deseas eliminarla de todas formas?`
      : `¿Eliminar "${name}"?`;

    Alert.alert('Eliminar categoría', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: hasExpenses ? 'Eliminar igualmente' : 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeCategory(id, hasExpenses);
            const successMessage = hasExpenses
              ? 'Categoría eliminada. Los gastos asociados quedaron sin categoría.'
              : 'Categoría eliminada';
            if (Platform.OS === 'android') {
              ToastAndroid.show(successMessage, ToastAndroid.LONG);
            } else {
              Alert.alert('Eliminada', successMessage);
            }
          } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

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
          <ThemedView style={[styles.item, { paddingVertical: 6, paddingHorizontal: 10, minHeight: 44 }]}>
            <View style={[styles.itemLeft, { gap: 8 }]}>
              <View style={[styles.colorBadge, { backgroundColor: item.color, width: 18, height: 18, borderRadius: 6 }]} />
              <View>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>{item.name}</ThemedText>
                {item.periodLimit != null && (
                  <ThemedText style={[styles.limit, { fontSize: 12 }]}>
                    Límite: {formatCLP(item.periodLimit)}/período
                  </ThemedText>
                )}
              </View>
            </View>
            <View style={[styles.actions, { gap: 2 }]}>
              <Link href={{ pathname: '/modal/category-form', params: { id: String(item.id) } }} asChild>
                <Pressable style={[styles.editButton, { padding: 4 }]}>
                  <Ionicons name="create-outline" size={17} color="#0a7ea4" />
                </Pressable>
              </Link>
              <Pressable onPress={() => handleDelete(item.id, item.name)} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={17} color="#be1b1b" />
              </Pressable>
            </View>
          </ThemedView>
     
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
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  colorBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  limit: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    padding: 4,
  },
  delete: {
    color: '#e74c3c',
    fontSize: 14,
  }
});
