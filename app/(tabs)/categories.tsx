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
  const { categories, removeCategory } = useDatabase();

  const handleDelete = (id: number, name: string) => {
    Alert.alert('Eliminar categoría', `¿Eliminar "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeCategory(id);
            if (Platform.OS === 'android') {
              ToastAndroid.show('Categoría eliminada', ToastAndroid.SHORT);
            } else {
              Alert.alert('Eliminada', 'Categoría eliminada');
            }
          } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Categorías</ThemedText>
      </ThemedView>

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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
