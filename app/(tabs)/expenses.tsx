import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/floating-action-button';
import { EmptyState } from '@/components/empty-state';
import {
  MovementFilterBar,
  MovementFilterOption,
  MovementFilterSection,
  MovementFilterSheet,
} from '@/components/movement-filter-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import {
  useMovementDatabase,
  useOrganizerDatabase,
  usePaymentDatabase,
  usePeriodDatabase,
  useRecurrenceDatabase,
} from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatEventDateTime, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import { VIRTUAL_SAVINGS_PAYMENT_METHOD_ID } from '@/lib/types';
import type { ExpenseWithCategory } from '@/lib/types';

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

const EXPENSE_GROUP_BY_STORAGE_KEY = '@finniapp/expense-group-by';

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
      usdTotal: number;
      isCollapsed: boolean;
    };

const SORT_OPTIONS: { value: SortOption; label: string; group: string }[] = [
  { value: 'date-desc', label: t('filters.newest'), group: t('filters.date') },
  { value: 'date-asc', label: t('filters.oldest'), group: t('filters.date') },
  { value: 'name-asc', label: 'A → Z', group: t('filters.name') },
  { value: 'name-desc', label: 'Z → A', group: t('filters.name') },
  { value: 'amount-desc', label: t('filters.highest'), group: t('filters.amount') },
  { value: 'amount-asc', label: t('filters.lowest'), group: t('filters.amount') },
];

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
      const firstTotal = first.expenses.reduce((sum, item) => sum + (item.currency === 'USD' ? 0 : item.amount), 0);
      const secondTotal = second.expenses.reduce((sum, item) => sum + (item.currency === 'USD' ? 0 : item.amount), 0);
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

export default function ExpensesScreen({ embedded = false }: { embedded?: boolean }) {
  const { expenses, removeExpense } = useMovementDatabase();
  const { categories } = useOrganizerDatabase();
  const { paymentMethods } = usePaymentDatabase();
  const { recurringExpenses } = useRecurrenceDatabase();
  const { selectedPeriodId } = usePeriodDatabase();
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
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<string[]>([]);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
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
  const hasSavingsWithdrawalExpenses = availablePaymentMethodIds.has(VIRTUAL_SAVINGS_PAYMENT_METHOD_ID);
  const availableCategories = categories.filter((item) => availableCategoryIds.has(item.id));
  const availablePaymentMethods = paymentMethods.filter((item) =>
    availablePaymentMethodIds.has(item.id)
  );

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(EXPENSE_GROUP_BY_STORAGE_KEY)
      .then((storedGroupBy) => {
        if (
          !cancelled &&
          (storedGroupBy === 'category' ||
            storedGroupBy === 'payment-method' ||
            storedGroupBy === 'none')
        ) {
          setGroupBy(storedGroupBy);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSearch('');
    setCategoryFilter([]);
    setPaymentMethodFilter([]);
    setSortBy('date-desc');
    setCollapsedGroupKeys([]);
    setFilterSheetVisible(false);
  }, [selectedPeriodId]);

  const selectGroupBy = (value: GroupBy) => {
    setGroupBy(value);
    setCollapsedGroupKeys([]);
    void AsyncStorage.setItem(EXPENSE_GROUP_BY_STORAGE_KEY, value).catch(() => undefined);
  };

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
    if (Number.isInteger(paymentMethodId) && (
      paymentMethodId > 0 || paymentMethodId === VIRTUAL_SAVINGS_PAYMENT_METHOD_ID
    )) {
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
  const activeFilterCount = Number(isSortActive)
    + Number(groupBy !== 'category')
    + Number(categoryFilter.length > 0)
    + Number(paymentMethodFilter.length > 0);

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
          ? expense.categoryName ?? t('expenses.noCategory')
          : expense.paymentMethodName ?? t('common.notSpecified'),
        color: groupsByCategory
          ? expense.categoryColor ?? '#60758E'
          : expense.paymentMethodColor ?? '#60758E',
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
          total: group.expenses.reduce((sum, expense) => sum + (expense.currency === 'USD' ? 0 : expense.amount), 0),
          usdTotal: group.expenses.reduce((sum, expense) => sum + (expense.currency === 'USD' ? expense.amount : 0), 0),
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
    Alert.alert(t('expenses.delete'), t('expenses.deleteQuestion', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await removeExpense(id);
            showToast(t('expenses.deleted'));
          } catch (error) {
            Alert.alert(
              t('expenses.cannotDelete'),
              error instanceof Error ? error.message : t('expenses.deleteError')
            );
          }
        }
      },
    ]);
  };

  const clearAllFilters = () => {
    setSearch('');
    setCategoryFilter([]);
    setPaymentMethodFilter([]);
  };

  const selectSort = (value: SortOption) => {
    setSortBy(value);
  };

  const resetFilterControls = () => {
    setSortBy('date-desc');
    selectGroupBy('category');
    setCategoryFilter([]);
    setPaymentMethodFilter([]);
  };

  const sortGroups = [...new Set(SORT_OPTIONS.map((opt) => opt.group))];

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['top']}>
      {!embedded && (
        <ThemedView style={styles.header}>
          <ThemedText type="title">{t('navigation.expenses')}</ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.filters}>
        <MovementFilterBar
          activeCount={activeFilterCount}
          onChangeSearch={setSearch}
          onOpenFilters={() => setFilterSheetVisible(true)}
          placeholder={t('expenses.searchPlaceholder')}
          search={search}
        />
      </ThemedView>

      <MovementFilterSheet
        activeCount={activeFilterCount}
        onClear={resetFilterControls}
        onClose={() => setFilterSheetVisible(false)}
        resultCount={filteredExpenses.length}
        visible={filterSheetVisible}>
        {sortGroups.map((group) => (
          <MovementFilterSection key={group} title={`${t('filters.sortBy')} · ${group}`}>
            {SORT_OPTIONS.filter((opt) => opt.group === group).map((opt) => (
              <MovementFilterOption
                key={opt.value}
                label={opt.label}
                onPress={() => selectSort(opt.value)}
                selected={sortBy === opt.value}
              />
            ))}
          </MovementFilterSection>
        ))}
        <MovementFilterSection title={t('filters.groupExpenses')}>
          <MovementFilterOption
            label={t('filters.groupByCategory')}
            onPress={() => selectGroupBy('category')}
            selected={groupBy === 'category'}
          />
          <MovementFilterOption
            label={t('filters.groupByPaymentMethod')}
            onPress={() => selectGroupBy('payment-method')}
            selected={groupBy === 'payment-method'}
          />
          <MovementFilterOption
            label={t('filters.noGrouping')}
            onPress={() => selectGroupBy('none')}
            selected={groupBy === 'none'}
          />
        </MovementFilterSection>
        <MovementFilterSection
          actionLabel={categoryFilter.length > 0 ? t('filters.clear') : undefined}
          onAction={categoryFilter.length > 0 ? () => setCategoryFilter([]) : undefined}
          title={t('filters.category')}>
          <MovementFilterOption
            label={t('filters.allCategories')}
            onPress={() => setCategoryFilter([])}
            selected={categoryFilter.length === 0}
          />
          {hasUncategorizedExpenses && (
            <MovementFilterOption
              label={t('expenses.noCategory')}
              onPress={() => toggleCategoryFilter('none')}
              selectionMode="multiple"
              selected={categoryFilter.includes('none')}
            />
          )}
          {availableCategories.map((cat) => (
            <MovementFilterOption
              key={cat.id}
              color={cat.color}
              label={cat.name}
              onPress={() => toggleCategoryFilter(cat.id)}
              selectionMode="multiple"
              selected={categoryFilter.includes(cat.id)}
            />
          ))}
        </MovementFilterSection>
        <MovementFilterSection
          actionLabel={paymentMethodFilter.length > 0 ? t('filters.clear') : undefined}
          onAction={paymentMethodFilter.length > 0 ? () => setPaymentMethodFilter([]) : undefined}
          title={t('filters.paymentMethod')}>
          <MovementFilterOption
            label={t('filters.allPaymentMethods')}
            onPress={() => setPaymentMethodFilter([])}
            selected={paymentMethodFilter.length === 0}
          />
          {hasUnspecifiedPaymentExpenses && (
            <MovementFilterOption
              label={t('common.notSpecified')}
              onPress={() => togglePaymentMethodFilter('none')}
              selectionMode="multiple"
              selected={paymentMethodFilter.includes('none')}
            />
          )}
          {hasSavingsWithdrawalExpenses && (
            <MovementFilterOption
              color="#20B9DB"
              label={t('savings.withdrawalPaymentMethod')}
              onPress={() => togglePaymentMethodFilter(VIRTUAL_SAVINGS_PAYMENT_METHOD_ID)}
              selectionMode="multiple"
              selected={paymentMethodFilter.includes(VIRTUAL_SAVINGS_PAYMENT_METHOD_ID)}
            />
          )}
          {availablePaymentMethods.map((method) => (
            <MovementFilterOption
              key={method.id}
              color={method.color}
              label={method.name}
              onPress={() => togglePaymentMethodFilter(method.id)}
              selectionMode="multiple"
              selected={paymentMethodFilter.includes(method.id)}
            />
          ))}
        </MovementFilterSection>
      </MovementFilterSheet>

      <FlatList
        style={{ marginTop: 8 }}
        data={listItems}
        keyExtractor={(item) =>
          item.type === 'group' ? `group-${groupBy}-${item.key}` : `expense-${item.expense.id}`
        }
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          expenses.length === 0 ? (
            <EmptyState
              icon="arrow-up-circle-outline"
              title={t('emptyStates.expensesTitle')}
              description={t('emptyStates.expensesDescription')}
              actionLabel={t('expenses.add')}
              onAction={() => router.push('/modal/expense-form')}
            />
          ) : (
            <EmptyState
              icon="search-outline"
              title={t('emptyStates.noResultsTitle')}
              description={t('expenses.emptyFiltered')}
              actionLabel={t('emptyStates.clearFilters')}
              onAction={clearAllFilters}
            />
          )
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
                accessibilityLabel={t(item.isCollapsed ? 'accessibility.showExpenseGroup' : 'accessibility.hideExpenseGroup', { name: item.name })}
                accessibilityState={{ expanded: !item.isCollapsed }}>
                <View style={styles.categoryHeaderLeft}>
                  <View style={[styles.dot, { backgroundColor: item.color }]} />
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                </View>
                <View style={styles.groupHeaderRight}>
                  <View>
                    <ThemedText type="defaultSemiBold">{formatCLP(item.total)}</ThemedText>
                    {item.usdTotal > 0 && (
                      <ThemedText type="defaultSemiBold">{formatMoney(item.usdTotal, 'USD')}</ThemedText>
                    )}
                  </View>
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
                  pathname: '/modal/movement-detail',
                  params: { id: String(expense.id), kind: 'expense' },
                } as never)
              }
            >
              <ThemedView style={[styles.item, { paddingVertical: 6, paddingHorizontal: 10, minHeight: 40 }]}>
                <View style={[styles.itemLeft, { gap: 6 }]}>
                  {groupBy === 'none' && (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: expense.categoryColor ?? '#60758E', width: 11, height: 11, borderRadius: 5.5 }
                      ]}
                    />
                  )}
            
                  <View style={[styles.itemInfo]}>
                    <View style={styles.expenseNameRow}>
                      <ThemedText type="defaultSemiBold" style={styles.expenseName} numberOfLines={1}>
                        {expense.name}
                      </ThemedText>
                      {expense.originalAmount != null && expense.splitPercentage != null && (
                        <Ionicons
                          name="pie-chart-outline"
                          size={17}
                          color={colors.primary}
                          accessibilityLabel={t('accessibility.splitExpense')}
                        />
                      )}
                      {expense.recurringExpenseId != null &&
                        activeRecurringExpenseIds.has(expense.recurringExpenseId) && (
                        <Ionicons
                          name="sync-circle-outline"
                          size={18}
                          color={colors.primary}
                          accessibilityLabel={t('accessibility.recurringExpense')}
                        />
                      )}
                      {expense.savingsGoalId != null && (
                        <Ionicons
                          name={expense.savingsKind === 'funded_expense' ? 'wallet-outline' : 'flag-outline'}
                          size={17}
                          color={expense.savingsGoalColor ?? colors.primary}
                          accessibilityLabel={t(expense.savingsKind === 'funded_expense' ? 'savings.fundedAccessibility' : 'savings.contributionAccessibility')}
                        />
                      )}
                    </View>
                    <ThemedText style={[styles.meta, { fontSize: 12 }]}>
                      {groupBy === 'category'
                        ? `${formatEventDateTime(expense.date, expense.time)} · ${expense.paymentMethodName ?? t('common.notSpecified')}`
                        : groupBy === 'payment-method'
                          ? `${expense.categoryName ?? t('expenses.noCategory')} · ${formatEventDateTime(expense.date, expense.time)}`
                          : `${expense.categoryName ?? t('expenses.noCategory')} · ${expense.paymentMethodName ?? t('common.notSpecified')} · ${formatEventDateTime(expense.date, expense.time)}`}
                      {expense.savingsGoalName
                        ? t(expense.savingsKind === 'funded_expense' ? 'savings.expenseFromGoal' : 'savings.expenseGoal', { name: expense.savingsGoalName })
                        : ''}
                    </ThemedText>
               
                  </View>
                </View>
                <View style={styles.itemActions}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>{formatMoney(expense.amount, expense.currency)}</ThemedText>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      handleDelete(expense.id, expense.name);
                    }}
                    style={styles.itemActionButton}
                    accessibilityRole="button"
                    accessibilityLabel={t('movementDetail.deleteNamed', { name: expense.name })}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Pressable>
                </View>
              </ThemedView>
            </Pressable>
          );
        }}
      />
      <FloatingActionButton
        href="/modal/expense-form"
        accessibilityLabel={t('accessibility.addExpense')}
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
    paddingBottom: 12,
  },
  list: {
    padding: 20,
    paddingTop: 0,
    gap: 10,
    paddingBottom: 100,
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
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemActionButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -10,
    marginRight: -10,
  },
  expenseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  expenseName: {
    fontSize: 15,
    flexShrink: 1,
  },
  meta: {
    fontSize: 13,
    opacity: 0.6,
  },
});
