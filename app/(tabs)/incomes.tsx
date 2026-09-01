import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/floating-action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate } from '@/lib/format';
import type { Income } from '@/lib/types';

type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'amount-asc'
  | 'amount-desc'
  | 'date-asc'
  | 'date-desc';

const SORT_OPTIONS: { value: SortOption; label: string; group: string }[] = [
  { value: 'date-desc', label: 'Más reciente', group: 'Fecha' },
  { value: 'date-asc', label: 'Más antigua', group: 'Fecha' },
  { value: 'name-asc', label: 'A → Z', group: 'Nombre' },
  { value: 'name-desc', label: 'Z → A', group: 'Nombre' },
  { value: 'amount-desc', label: 'Mayor a menor', group: 'Monto' },
  { value: 'amount-asc', label: 'Menor a mayor', group: 'Monto' },
];

const SORT_LABELS = Object.fromEntries(
  SORT_OPTIONS.map(({ value, label, group }) => [value, `${group}: ${label}`])
) as Record<SortOption, string>;

function sortIncomes(items: Income[], sortBy: SortOption) {
  const sorted = [...items];
  switch (sortBy) {
    case 'name-asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    case 'name-desc':
      return sorted.sort((a, b) => b.name.localeCompare(a.name, 'es'));
    case 'amount-asc':
      return sorted.sort((a, b) => a.amount - b.amount);
    case 'amount-desc':
      return sorted.sort((a, b) => b.amount - a.amount);
    case 'date-asc':
      return sorted.sort((a, b) => a.date.localeCompare(b.date));
    case 'date-desc':
      return sorted.sort((a, b) => b.date.localeCompare(a.date));
  }
}

type OptionModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

function OptionModal({ visible, title, onClose, children }: OptionModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={styles.modalSheet}
          onPress={(e) => e.stopPropagation()}>
          <ThemedView
            style={[
              styles.modalContent,
              { paddingBottom: insets.bottom + 16 },
            ]}>
            <ThemedText style={styles.modalTitle}>{title}</ThemedText>
            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
            <Pressable
              style={[styles.modalCloseButton, { borderColor: colors.icon }]}
              onPress={onClose}>
              <ThemedText type="defaultSemiBold">Cerrar</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type ModalOptionProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
};

function ModalOption({ label, selected, onPress, color }: ModalOptionProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Pressable
      style={[
        styles.modalOption,
        { borderColor: colors.icon },
        selected && styles.modalOptionSelected,
      ]}
      onPress={onPress}>
      <View style={styles.modalOptionLeft}>
        {color != null && <View style={[styles.optionDot, { backgroundColor: color }]} />}
        <ThemedText style={selected ? styles.modalOptionTextSelected : undefined}>{label}</ThemedText>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color="#0a7ea4" />}
    </Pressable>
  );
}

export default function IncomesScreen() {
  const { incomes, removeIncome, selectedPeriodId } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  useEffect(() => {
    setSearch('');
    setSortBy('date-desc');
    setSortModalVisible(false);
  }, [selectedPeriodId]);

  const filteredIncomes = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = incomes.filter((item) => {
      if (query && !item.name.toLowerCase().includes(query))
        return false;
    
      return true;
    });

    return sortIncomes(filtered, sortBy);
  }, [incomes, search, sortBy]);

  const isSortActive = sortBy !== 'date-desc';

  const handleDelete = (id: number, name: string) => {
    Alert.alert('Eliminar ingreso', `¿Eliminar "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          removeIncome(id)
          if (Platform.OS === 'android') {
            ToastAndroid.show('Ingreso eliminado', ToastAndroid.SHORT);
          } else {
            Alert.alert('Eliminado', 'Ingreso eliminado');
          }
        }
      },
    ]);
  };

  const selectSort = (value: SortOption) => {
    setSortBy(value);
    setSortModalVisible(false);
  };

  const sortGroups = [...new Set(SORT_OPTIONS.map((opt) => opt.group))];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Ingresos</ThemedText>
      </ThemedView>

      <ThemedView style={styles.filters}>
        <View style={[styles.searchBox, { borderColor: colors.icon }]}>
          <Ionicons name="search" size={18} color={colors.icon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nombre..."
            placeholderTextColor={colors.icon}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.icon} />
            </Pressable>
          )}
        </View>

        <View style={styles.toolbar}>
          <Pressable
            style={[
              styles.toolbarButton,
              { borderColor: colors.icon },
              isSortActive && styles.toolbarButtonActive,
            ]}
            onPress={() => setSortModalVisible(true)}>
            <Ionicons name="swap-vertical" size={18} color={isSortActive ? '#0a7ea4' : colors.icon} />
            <View style={styles.toolbarButtonText}>
              <ThemedText type="defaultSemiBold">Orden</ThemedText>
              <ThemedText style={styles.toolbarSubtext} numberOfLines={1}>
                {SORT_LABELS[sortBy]}
              </ThemedText>
            </View>
          </Pressable>
        </View>
      </ThemedView>

      <OptionModal
        visible={sortModalVisible}
        title="Ordenar por"
        onClose={() => setSortModalVisible(false)}>
        {sortGroups.map((group) => (
          <View key={group} style={styles.modalGroup}>
            <ThemedText style={styles.modalGroupLabel}>{group}</ThemedText>
            {SORT_OPTIONS.filter((opt) => opt.group === group).map((opt) => (
              <ModalOption
                key={opt.value}
                label={opt.label}
                selected={sortBy === opt.value}
                onPress={() => selectSort(opt.value)}
              />
            ))}
          </View>
        ))}
      </OptionModal>

      <FlatList
        style={{ marginTop: 8 }}
        data={filteredIncomes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <ThemedText style={styles.empty}>
            {incomes.length === 0
              ? 'No hay ingresos registrados. Toca el botón + para agregar uno.'
              : 'No hay ingresos que coincidan con los filtros.'}
          </ThemedText>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/modal/income-form',
                params: { id: String(item.id) },
              })
            }
            onLongPress={() => handleDelete(item.id, item.name)}
            delayLongPress={500}>
            <ThemedView
              style={[
                styles.item,
                {
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  minHeight: 40,
                },
              ]}
            >
              <View style={[styles.itemLeft, { gap: 6 }]}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: '#008000', width: 11, height: 11, borderRadius: 5.5 }
                  ]}
                />
                <View style={styles.itemInfo}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>{item.name}</ThemedText>
                  <ThemedText style={[styles.meta, { fontSize: 12 }]}>{formatDate(new Date(`${item.date}T12:00:00`))}</ThemedText>
                </View>
              </View>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>{formatCLP(item.amount)}</ThemedText>
            </ThemedView>
          </Pressable>
        )}
      />
      <FloatingActionButton
        href="/modal/income-form"
        accessibilityLabel="Agregar ingreso"
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
  filters: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 10,
  },
  toolbarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toolbarButtonActive: {
    borderColor: '#0a7ea4',
    backgroundColor: '#0a7ea412',
  },
  toolbarButtonText: {
    flex: 1,
    gap: 1,
  },
  toolbarSubtext: {
    fontSize: 12,
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalSheet: {
    maxHeight: '75%',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  modalTitle: {
    marginBottom: 12,
  },
  modalScroll: {
    maxHeight: 420,
  },
  modalGroup: {
    marginBottom: 8,
  },
  modalGroupLabel: {
    fontSize: 13,
    opacity: 0.5,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  modalOptionSelected: {
    borderColor: '#0a7ea4',
    backgroundColor: '#0a7ea412',
  },
  modalOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalOptionTextSelected: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  optionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  modalCloseButton: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  list: {
    padding: 20,
    paddingTop: 0,
    gap: 10,
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
    marginBottom: 2,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  meta: {
    fontSize: 13,
    opacity: 0.6,
  },
});
