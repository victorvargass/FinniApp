import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
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
import type { Category, ExpenseWithCategory, PaymentMethod } from '@/lib/types';

type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'amount-asc'
  | 'amount-desc'
  | 'date-asc'
  | 'date-desc';

type CategoryFilter = ('none' | number)[];
type PaymentMethodFilter = ('none' | number)[];
type GroupBy = 'none' | 'category' | 'payment-method';

type ExpenseGroup = {
  name: string;
  color: string;
  expenses: ExpenseWithCategory[];
};

type ExpenseListItem =
  | { type: 'expense'; expense: ExpenseWithCategory }
  | {
      type: 'group';
      key: string;
      name: string;
      color: string;
      total: number;
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

function getPaymentMethodFilterLabel(
  filter: PaymentMethodFilter,
  paymentMethods: PaymentMethod[]
) {
  if (filter.length === 0) return 'Todos';
  if (filter.length === 1) {
    const value = filter[0];
    if (value === 'none') return 'No especificado';
    return paymentMethods.find((method) => method.id === value)?.name ?? 'Medio de pago';
  }
  return `${filter.length} medios`;
}

function compareExpenseGroups(
  first: ExpenseGroup,
  second: ExpenseGroup,
  sortBy: SortOption
) {
  const nameComparison = first.name.localeCompare(second.name, 'es');

  switch (sortBy) {
    case 'name-asc':
      return nameComparison;
    case 'name-desc':
      return -nameComparison;
    case 'amount-asc':
    case 'amount-desc': {
      const firstTotal = first.expenses.reduce((sum, item) => sum + item.amount, 0);
      const secondTotal = second.expenses.reduce((sum, item) => sum + item.amount, 0);
      const comparison = firstTotal - secondTotal;
      return (sortBy === 'amount-asc' ? comparison : -comparison) || nameComparison;
    }
    case 'date-asc': {
      const firstOldest = first.expenses.reduce(
        (oldest, item) => (item.date < oldest ? item.date : oldest),
        first.expenses[0].date
      );
      const secondOldest = second.expenses.reduce(
        (oldest, item) => (item.date < oldest ? item.date : oldest),
        second.expenses[0].date
      );
      return firstOldest.localeCompare(secondOldest) || nameComparison;
    }
    case 'date-desc': {
      const firstNewest = first.expenses.reduce(
        (newest, item) => (item.date > newest ? item.date : newest),
        first.expenses[0].date
      );
      const secondNewest = second.expenses.reduce(
        (newest, item) => (item.date > newest ? item.date : newest),
        second.expenses[0].date
      );
      return secondNewest.localeCompare(firstNewest) || nameComparison;
    }
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
  const {
    expenses,
    categories,
    paymentMethods,
    recurringExpenses,
    removeExpense,
    selectedPeriodId,
  } = useDatabase();
  const {
    categoryFilter: requestedCategory,
    paymentMethodFilter: requestedPaymentMethod,
    filterRequestId,
  } =
    useLocalSearchParams<{
      categoryFilter?: string;
      paymentMethodFilter?: string;
      filterRequestId?: string;
    }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>([]);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>([]);
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<string[]>([]);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const activeRecurringExpenseIds = useMemo(
    () => new Set(recurringExpenses.filter((item) => item.active).map((item) => item.id)),
    [recurringExpenses]
  );
  const availableCategoryIds = useMemo(
    () => new Set(expenses.flatMap((item) => item.categoryId == null ? [] : [item.categoryId])),
    [expenses]
  );
  const availablePaymentMethodIds = useMemo(
    () => new Set(expenses.flatMap((item) => item.paymentMethodId == null ? [] : [item.paymentMethodId])),
    [expenses]
  );
  const hasUncategorizedExpenses = expenses.some((item) => item.categoryId == null);
  const hasUnspecifiedPaymentExpenses = expenses.some((item) => item.paymentMethodId == null);
  const availableCategories = categories.filter((item) => availableCategoryIds.has(item.id));
  const availablePaymentMethods = paymentMethods.filter((item) =>
    availablePaymentMethodIds.has(item.id)
  );

  useEffect(() => {
    setSearch('');
    setCategoryFilter([]);
    setPaymentMethodFilter([]);
    setSortBy('date-desc');
    setGroupBy('none');
    setCollapsedGroupKeys([]);
    setSortModalVisible(false);
    setFilterModalVisible(false);
    setGroupModalVisible(false);
  }, [selectedPeriodId]);

  useEffect(() => {
    if (!requestedCategory) return;

    if (requestedCategory === 'none') {
      setCategoryFilter(['none']);
      setPaymentMethodFilter([]);
      setSearch('');
      return;
    }

    const categoryId = Number(requestedCategory);
    if (Number.isInteger(categoryId) && categoryId > 0) {
      setCategoryFilter([categoryId]);
      setPaymentMethodFilter([]);
      setSearch('');
    }
  }, [requestedCategory, filterRequestId]);

  useEffect(() => {
    if (!requestedPaymentMethod) return;

    if (requestedPaymentMethod === 'none') {
      setPaymentMethodFilter(['none']);
      setCategoryFilter([]);
      setSearch('');
      return;
    }

    const paymentMethodId = Number(requestedPaymentMethod);
    if (Number.isInteger(paymentMethodId) && paymentMethodId > 0) {
      setPaymentMethodFilter([paymentMethodId]);
      setCategoryFilter([]);
      setSearch('');
    }
  }, [requestedPaymentMethod, filterRequestId]);

  useEffect(() => {
    setCategoryFilter((current) => {
      const available = current.filter((item) =>
        item === 'none' ? hasUncategorizedExpenses : availableCategoryIds.has(item)
      );
      return available.length === current.length ? current : available;
    });
    setPaymentMethodFilter((current) => {
      const available = current.filter((item) =>
        item === 'none' ? hasUnspecifiedPaymentExpenses : availablePaymentMethodIds.has(item)
      );
      return available.length === current.length ? current : available;
    });
  }, [
    availableCategoryIds,
    availablePaymentMethodIds,
    hasUncategorizedExpenses,
    hasUnspecifiedPaymentExpenses,
  ]);

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

      if (paymentMethodFilter.length > 0) {
        const match =
          (item.paymentMethodId == null && paymentMethodFilter.includes('none')) ||
          (item.paymentMethodId != null && paymentMethodFilter.includes(item.paymentMethodId));
        if (!match) return false;
      }
    
      return true;
    });

    return sortExpenses(filtered, sortBy);
  }, [expenses, search, categoryFilter, paymentMethodFilter, sortBy]);

  const isSortActive = sortBy !== 'date-desc';
  const isFilterActive = categoryFilter.length > 0 || paymentMethodFilter.length > 0;

  const listItems = useMemo<ExpenseListItem[]>(() => {
    if (groupBy === 'none') {
      return filteredExpenses.map((expense) => ({ type: 'expense', expense }));
    }

    const groups = new Map<string, ExpenseGroup>();

    filteredExpenses.forEach((expense) => {
      const groupsByCategory = groupBy === 'category';
      const id = groupsByCategory ? expense.categoryId : expense.paymentMethodId;
      const key = id == null ? 'none' : String(id);
      const group = groups.get(key) ?? {
        name: groupsByCategory
          ? expense.categoryName ?? 'Sin categoría'
          : expense.paymentMethodName ?? 'No especificado',
        color: groupsByCategory
          ? expense.categoryColor ?? '#95a5a6'
          : expense.paymentMethodColor ?? '#95a5a6',
        expenses: [],
      };

      group.expenses.push(expense);
      groups.set(key, group);
    });

    return [...groups.entries()]
      .sort(([, first], [, second]) => compareExpenseGroups(first, second, sortBy))
      .flatMap(([key, group]) => [
        {
          type: 'group' as const,
          key,
          name: group.name,
          color: group.color,
          total: group.expenses.reduce((sum, expense) => sum + expense.amount, 0),
          isCollapsed: collapsedGroupKeys.includes(key),
        },
        ...(collapsedGroupKeys.includes(key)
          ? []
          : group.expenses.map((expense) => ({ type: 'expense' as const, expense }))),
      ]);
  }, [filteredExpenses, groupBy, collapsedGroupKeys, sortBy]);

  const toggleGroupCollapsed = (key: string) => {
    setCollapsedGroupKeys((current) =>
      current.includes(key)
        ? current.filter((categoryKey) => categoryKey !== key)
        : [...current, key]
    );
  };

  const togglePaymentMethodFilter = (value: number | 'none') => {
    setPaymentMethodFilter((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value]
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
        onPress: async () => {
          try {
            await removeExpense(id);
            if (Platform.OS === 'android') {
              ToastAndroid.show('Gasto eliminado', ToastAndroid.SHORT);
            } else {
              Alert.alert('Eliminado', 'Gasto eliminado');
            }
          } catch (error) {
            Alert.alert(
              'No se puede eliminar',
              error instanceof Error ? error.message : 'No se pudo eliminar el gasto.'
            );
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
        <ThemedText type="title">Gastos</ThemedText>
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
              groupBy !== 'none' && styles.toolbarButtonActive,
            ]}
            onPress={() => setGroupModalVisible(true)}>
            <Ionicons name="layers-outline" size={18} color={groupBy !== 'none' ? '#0a7ea4' : colors.icon} />
            <View style={styles.toolbarButtonText}>
              <ThemedText type="defaultSemiBold">Agrupar</ThemedText>
              <ThemedText style={styles.toolbarSubtext} numberOfLines={1}>
                {groupBy === 'category' ? 'Categoría' : groupBy === 'payment-method' ? 'Medio de pago' : 'Sin agrupar'}
              </ThemedText>
            </View>
          </Pressable>
        </View>
        <Pressable
          style={[
            styles.filterButton,
            { borderColor: colors.icon },
            isFilterActive && styles.toolbarButtonActive,
          ]}
          onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="filter" size={18} color={isFilterActive ? '#0a7ea4' : colors.icon} />
          <View style={styles.toolbarButtonText}>
            <ThemedText type="defaultSemiBold">Filtros</ThemedText>
            <ThemedText style={styles.toolbarSubtext} numberOfLines={1}>
              Categoría: {getCategoryFilterLabel(categoryFilter, categories)} · Pago: {getPaymentMethodFilterLabel(paymentMethodFilter, paymentMethods)}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.icon} />
        </Pressable>
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
        visible={groupModalVisible}
        title="Agrupar gastos"
        onClose={() => setGroupModalVisible(false)}>
        <ModalOption
          label="Sin agrupar"
          selected={groupBy === 'none'}
          onPress={() => { setGroupBy('none'); setCollapsedGroupKeys([]); setGroupModalVisible(false); }}
        />
        <ModalOption
          label="Por categoría"
          selected={groupBy === 'category'}
          onPress={() => { setGroupBy('category'); setCollapsedGroupKeys([]); setGroupModalVisible(false); }}
        />
        <ModalOption
          label="Por medio de pago"
          selected={groupBy === 'payment-method'}
          onPress={() => { setGroupBy('payment-method'); setCollapsedGroupKeys([]); setGroupModalVisible(false); }}
        />
      </OptionModal>

      <OptionModal
        visible={filterModalVisible}
        title="Filtrar gastos"
        onClose={() => setFilterModalVisible(false)}>
        <View style={styles.filterModalHeader}>
          <ThemedText style={styles.modalGroupLabel}>CATEGORÍA</ThemedText>
          {categoryFilter.length > 0 && (
            <Pressable onPress={() => setCategoryFilter([])}>
              <ThemedText type="link">Limpiar</ThemedText>
            </Pressable>
          )}
        </View>
        <ModalOption
          label="Todas las categorías"
          selected={categoryFilter.length === 0}
          onPress={() => setCategoryFilter([])}
        />
        {hasUncategorizedExpenses && (
          <ModalOption
            label="Sin categoría"
            selected={categoryFilter.includes('none')}
            onPress={() => toggleCategoryFilter('none')}
          />
        )}
        {availableCategories.map((cat) => (
          <ModalOption
            key={cat.id}
            label={cat.name}
            color={cat.color}
            selected={categoryFilter.includes(cat.id)}
            onPress={() => toggleCategoryFilter(cat.id)}
          />
        ))}
        <View style={styles.filterModalHeader}>
          <ThemedText style={styles.modalGroupLabel}>MEDIO DE PAGO</ThemedText>
          {paymentMethodFilter.length > 0 && (
            <Pressable onPress={() => setPaymentMethodFilter([])}>
              <ThemedText type="link">Limpiar</ThemedText>
            </Pressable>
          )}
        </View>
        <ModalOption
          label="Todos los medios"
          selected={paymentMethodFilter.length === 0}
          onPress={() => setPaymentMethodFilter([])}
        />
        {hasUnspecifiedPaymentExpenses && (
          <ModalOption
            label="No especificado"
            selected={paymentMethodFilter.includes('none')}
            onPress={() => togglePaymentMethodFilter('none')}
          />
        )}
        {availablePaymentMethods.map((method) => (
          <ModalOption
            key={method.id}
            label={method.name}
            color={method.color}
            selected={paymentMethodFilter.includes(method.id)}
            onPress={() => togglePaymentMethodFilter(method.id)}
          />
        ))}
        {isFilterActive && (
          <Pressable
            style={styles.clearAllFilters}
            onPress={() => { setCategoryFilter([]); setPaymentMethodFilter([]); }}>
            <ThemedText style={styles.clearAllFiltersText}>Limpiar todos los filtros</ThemedText>
          </Pressable>
        )}
      </OptionModal>

      <FlatList
        style={{ marginTop: 8 }}
        data={listItems}
        keyExtractor={(item) =>
          item.type === 'group' ? `group-${groupBy}-${item.key}` : `expense-${item.expense.id}`
        }
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <ThemedText style={styles.empty}>
            {expenses.length === 0
              ? 'No hay gastos registrados. Toca el botón + para agregar uno.'
              : 'No hay gastos que coincidan con los filtros.'}
          </ThemedText>
        }
        renderItem={({ item }) => {
          if (item.type === 'group') {
            return (
              <Pressable
                style={[
                  styles.categoryHeader,
                  { borderLeftColor: item.color, backgroundColor: `${item.color}18` },
                ]}
                onPress={() => toggleGroupCollapsed(item.key)}
                accessibilityRole="button"
                accessibilityLabel={`${item.isCollapsed ? 'Mostrar' : 'Ocultar'} gastos de ${item.name}`}
                accessibilityState={{ expanded: !item.isCollapsed }}>
                <View style={styles.categoryHeaderLeft}>
                  <View style={[styles.dot, { backgroundColor: item.color }]} />
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                </View>
                <View style={styles.groupHeaderRight}>
                  <ThemedText type="defaultSemiBold">{formatCLP(item.total)}</ThemedText>
                  <Ionicons
                    name={item.isCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={20}
                    color={item.color}
                  />
                </View>
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
                  {groupBy === 'none' && (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: expense.categoryColor ?? '#95a5a6', width: 11, height: 11, borderRadius: 5.5 }
                      ]}
                    />
                  )}
            
                  <View style={[styles.itemInfo]}>
                    <View style={styles.expenseNameRow}>
                      <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>{expense.name}</ThemedText>
                      {expense.recurringExpenseId != null &&
                        activeRecurringExpenseIds.has(expense.recurringExpenseId) && (
                        <Ionicons
                          name="sync-circle-outline"
                          size={18}
                          color={colors.primary}
                          accessibilityLabel="Gasto recurrente"
                        />
                      )}
                    </View>
                    <ThemedText style={[styles.meta, { fontSize: 12 }]}>
                      {groupBy === 'category'
                        ? `${formatDate(new Date(`${expense.date}T12:00:00`))} · ${expense.paymentMethodName ?? 'No especificado'}`
                        : groupBy === 'payment-method'
                          ? `${expense.categoryName ?? 'Sin categoría'} · ${formatDate(new Date(`${expense.date}T12:00:00`))}`
                          : `${expense.categoryName ?? 'Sin categoría'} · ${expense.paymentMethodName ?? 'No especificado'} · ${formatDate(new Date(`${expense.date}T12:00:00`))}`}
                    </ThemedText>
               
                  </View>
                </View>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>{formatCLP(expense.amount)}</ThemedText>
              </ThemedView>
            </Pressable>
          );
        }}
      />
      <FloatingActionButton
        href="/modal/expense-form"
        accessibilityLabel="Agregar gasto"
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
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  clearAllFilters: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  clearAllFiltersText: {
    color: '#be1b1b',
    fontWeight: '600',
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
    paddingBottom: 100,
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
  groupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  expenseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  meta: {
    fontSize: 13,
    opacity: 0.6,
  },
});
