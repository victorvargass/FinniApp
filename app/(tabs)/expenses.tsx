import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP, formatDate } from '@/lib/format';
import type { Category, ExpenseWithCategory } from '@/lib/types';

type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'amount-asc'
  | 'amount-desc'
  | 'date-asc'
  | 'date-desc';

type CategoryFilter = ('none' | number)[];

type ExpenseListItem =
  | { type: 'expense'; expense: ExpenseWithCategory }
  | {
      type: 'category';
      key: string;
      name: string;
      color: string;
      isCollapsed: boolean;
    };

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

function sortExpenses(items: ExpenseWithCategory[], sortBy: SortOption) {
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

function getCategoryFilterLabel(
  filter: CategoryFilter,
  categories: Category[]
) {
  if (filter.length === 0)
    return 'Todas';

  if (filter.length === 1) {
    const value = filter[0];

    if (value === 'none')
      return 'Sin categoría';

    return categories.find(c => c.id === value)?.name ?? 'Categoría';
  }

  return `${filter.length} categorías`;
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

export default function ExpensesScreen() {
  const { expenses, categories, removeExpense } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>([]);
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [isGroupedByCategory, setGroupedByCategory] = useState(false);
  const [collapsedCategoryKeys, setCollapsedCategoryKeys] = useState<string[]>([]);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = expenses.filter((item) => {
      if (query && !item.name.toLowerCase().includes(query))
        return false;
    
      if (categoryFilter.length > 0) {
        const match =
          (item.categoryId == null &&
            categoryFilter.includes('none')) ||
          (item.categoryId != null &&
            categoryFilter.includes(item.categoryId));
    
        if (!match) return false;
      }
    
      return true;
    });

    return sortExpenses(filtered, sortBy);
  }, [expenses, search, categoryFilter, sortBy]);

  const isSortActive = sortBy !== 'date-desc';
  const isFilterActive = categoryFilter.length > 0;

  const listItems = useMemo<ExpenseListItem[]>(() => {
    if (!isGroupedByCategory) {
      return filteredExpenses.map((expense) => ({ type: 'expense', expense }));
    }

    const groups = new Map<
      string,
      { name: string; color: string; expenses: ExpenseWithCategory[] }
    >();

    filteredExpenses.forEach((expense) => {
      const key = expense.categoryId == null ? 'none' : String(expense.categoryId);
      const group = groups.get(key) ?? {
        name: expense.categoryName ?? 'Sin categoría',
        color: expense.categoryColor ?? '#95a5a6',
        expenses: [],
      };

      group.expenses.push(expense);
      groups.set(key, group);
    });

    return [...groups.entries()]
      .sort(([firstKey, first], [secondKey, second]) => {
        if (firstKey === 'none') return 1;
        if (secondKey === 'none') return -1;
        return first.name.localeCompare(second.name, 'es');
      })
      .flatMap(([key, group]) => [
        {
          type: 'category' as const,
          key,
          name: group.name,
          color: group.color,
          isCollapsed: collapsedCategoryKeys.includes(key),
        },
        ...(collapsedCategoryKeys.includes(key)
          ? []
          : group.expenses.map((expense) => ({ type: 'expense' as const, expense }))),
      ]);
  }, [filteredExpenses, isGroupedByCategory, collapsedCategoryKeys]);

  const toggleCategoryCollapsed = (key: string) => {
    setCollapsedCategoryKeys((current) =>
      current.includes(key)
        ? current.filter((categoryKey) => categoryKey !== key)
        : [...current, key]
    );
  };

  const toggleCategoryFilter = (
    value: number | 'none'
  ) => {
    setCategoryFilter((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert('Eliminar gasto', `¿Eliminar "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => removeExpense(id),
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
        <ThemedText type="title">Gastos</ThemedText>
        <Link href="/modal/expense-form" asChild>
          <Pressable style={styles.addButton}>
            <ThemedText style={styles.addButtonText}>+ Nuevo</ThemedText>
          </Pressable>
        </Link>
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

          <Pressable
            style={[
              styles.toolbarButton,
              { borderColor: colors.icon },
              isFilterActive && styles.toolbarButtonActive,
            ]}
            onPress={() => setFilterModalVisible(true)}>
            <Ionicons name="filter" size={18} color={isFilterActive ? '#0a7ea4' : colors.icon} />
            <View style={styles.toolbarButtonText}>
              <ThemedText type="defaultSemiBold">Filtro</ThemedText>
              <ThemedText style={styles.toolbarSubtext} numberOfLines={1}>
                {getCategoryFilterLabel(categoryFilter, categories)}
              </ThemedText>
            </View>
          </Pressable>
        </View>
        <View style={[styles.groupToggle, { borderColor: colors.icon }]}>
          <View style={styles.groupToggleLabel}>
            <Ionicons name="folder-open-outline" size={18} color={colors.icon} />
            <View>
              <ThemedText type="defaultSemiBold">Agrupar por categoría</ThemedText>
            </View>
          </View>
          <Switch
            value={isGroupedByCategory}
            onValueChange={setGroupedByCategory}
            trackColor={{ false: colors.icon, true: '#0a7ea4' }}
            thumbColor="#fff"
            accessibilityLabel="Agrupar gastos por categoría"
          />
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

      <OptionModal
        visible={filterModalVisible}
        title="Filtrar por categoría"
        onClose={() => setFilterModalVisible(false)}>
        <ModalOption
          label="Todas las categorías"
          selected={categoryFilter.length === 0}
          onPress={() => setCategoryFilter([])}
        />
        <ModalOption
          label="Sin categoría"
          selected={categoryFilter.includes('none')}
          onPress={() => toggleCategoryFilter('none')}
        />
        {categories.map((cat) => (
          <ModalOption
            key={cat.id}
            label={cat.name}
            color={cat.color}
            selected={categoryFilter.includes(cat.id)}
            onPress={() => toggleCategoryFilter(cat.id)}
          />
        ))}
      </OptionModal>

      <FlatList
        style={{ marginTop: 8 }}
        data={listItems}
        keyExtractor={(item) =>
          item.type === 'category' ? `category-${item.key}` : `expense-${item.expense.id}`
        }
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <ThemedText style={styles.empty}>
            {expenses.length === 0
              ? 'No hay gastos registrados. Toca "+ Nuevo" para agregar uno.'
              : 'No hay gastos que coincidan con los filtros.'}
          </ThemedText>
        }
        renderItem={({ item }) => {
          if (item.type === 'category') {
            return (
              <Pressable
                style={[
                  styles.categoryHeader,
                  { borderLeftColor: item.color, backgroundColor: `${item.color}18` },
                ]}
                onPress={() => toggleCategoryCollapsed(item.key)}
                accessibilityRole="button"
                accessibilityLabel={`${item.isCollapsed ? 'Mostrar' : 'Ocultar'} gastos de ${item.name}`}
                accessibilityState={{ expanded: !item.isCollapsed }}>
                <View style={styles.categoryHeaderLeft}>
                  <View style={[styles.dot, { backgroundColor: item.color }]} />
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                </View>
                <Ionicons
                  name={item.isCollapsed ? 'chevron-down' : 'chevron-up'}
                  size={20}
                  color={item.color}
                />
              </Pressable>
            );
          }

          const expense = item.expense;
          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/modal/expense-form',
                  params: { id: String(expense.id) },
                })
              }
              onLongPress={() => handleDelete(expense.id, expense.name)}
              delayLongPress={500}>
              <ThemedView style={[styles.item, { paddingVertical: 6, paddingHorizontal: 10, minHeight: 40 }]}>
                <View style={[styles.itemLeft, { gap: 6 }]}>
                  {isGroupedByCategory ? null : (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: expense.categoryColor ?? '#95a5a6', width: 11, height: 11, borderRadius: 5.5 }
                      ]}
                    />
                  )}
            
                  <View style={[styles.itemInfo]}>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>{expense.name}</ThemedText>
                    <ThemedText style={[styles.meta, { fontSize: 12 }]}>
                      {isGroupedByCategory
                        ? formatDate(new Date(`${expense.date}T12:00:00`))
                        : `${expense.categoryName ?? 'Sin categoría'} · ${formatDate(new Date(`${expense.date}T12:00:00`))}`}
                    </ThemedText>
               
                  </View>
                </View>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>{formatCLP(expense.amount)}</ThemedText>
              </ThemedView>
            </Pressable>
          );
        }}
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
  addButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
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
  groupToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groupToggleLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
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
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    marginBottom: 12,
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
    paddingBottom: 40,
  },
  empty: {
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 40,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
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
