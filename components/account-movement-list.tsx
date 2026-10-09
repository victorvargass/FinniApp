import { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { FloatingActionButton } from '@/components/floating-action-button';
import {
  MovementFilterBar,
  MovementFilterOption,
  MovementFilterSection,
  MovementFilterSheet,
} from '@/components/movement-filter-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLargeTextLayout } from '@/hooks/use-large-text-layout';
import { formatCLP, formatEventDateTime, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { matchesSearchQuery } from '@/lib/search';

type IconName = ComponentProps<typeof Ionicons>['name'];
type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export type AccountMovementListItem = {
  key: string;
  title: string;
  amount: number;
  currency?: 'CLP' | 'USD';
  date: string;
  time: string;
  description: string;
  color: string;
  icon: IconName;
  filterKey?: string;
  primaryGroup: { key: string; name: string; color: string };
  secondaryGroup: { key: string; name: string; color: string };
  onPress: () => void;
  onDelete?: () => void;
  deleteAccessibilityLabel?: string;
};

type GroupOption = {
  value: 'none' | 'primary' | 'secondary';
  label: string;
};

type FilterOption = {
  value: string;
  label: string;
};

type ListItem =
  | { type: 'movement'; movement: AccountMovementListItem }
  | {
      type: 'group';
      key: string;
      name: string;
      color: string;
      total: number;
      usdTotal: number;
      collapsed: boolean;
    };

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date-desc', label: `${t('filters.date')}: ${t('filters.newest')}` },
  { value: 'date-asc', label: `${t('filters.date')}: ${t('filters.oldest')}` },
  { value: 'amount-desc', label: `${t('filters.amount')}: ${t('filters.highest')}` },
  { value: 'amount-asc', label: `${t('filters.amount')}: ${t('filters.lowest')}` },
];

function sortMovements(items: AccountMovementListItem[], sortBy: SortOption) {
  return [...items].sort((first, second) => {
    if (sortBy === 'date-desc') return `${second.date}T${second.time}`.localeCompare(`${first.date}T${first.time}`) || second.key.localeCompare(first.key);
    if (sortBy === 'date-asc') return `${first.date}T${first.time}`.localeCompare(`${second.date}T${second.time}`) || first.key.localeCompare(second.key);
    if (sortBy === 'amount-desc') return second.amount - first.amount || second.date.localeCompare(first.date);
    return first.amount - second.amount || second.date.localeCompare(first.date);
  });
}

export function AccountMovementList({
  movements,
  periodKey,
  groupOptions,
  defaultGroup,
  filterOptions = [],
  searchPlaceholder,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  fabHref,
  fabAccessibilityLabel,
}: {
  movements: AccountMovementListItem[];
  periodKey: number | null;
  groupOptions: GroupOption[];
  defaultGroup: GroupOption['value'];
  filterOptions?: FilterOption[];
  searchPlaceholder: string;
  emptyIcon: IconName;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel: string;
  fabHref: Href;
  fabAccessibilityLabel: string;
}) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const usesLargeText = useLargeTextLayout();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [groupBy, setGroupBy] = useState<GroupOption['value']>(defaultGroup);
  const defaultFilterKey = filterOptions[0]?.value ?? 'all';
  const [filterKey, setFilterKey] = useState(defaultFilterKey);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  useEffect(() => {
    setSearch('');
    setSortBy('date-desc');
    setGroupBy(defaultGroup);
    setFilterKey(defaultFilterKey);
    setCollapsedGroups([]);
    setFilterSheetVisible(false);
  }, [defaultFilterKey, defaultGroup, periodKey]);

  const filtered = useMemo(() => sortMovements(movements.filter((movement) => {
    if (filterKey !== 'all' && movement.filterKey !== filterKey) return false;
    return matchesSearchQuery(
      `${movement.title} ${movement.description} ${movement.primaryGroup.name} ${movement.secondaryGroup.name}`,
      search
    );
  }), sortBy), [filterKey, movements, search, sortBy]);

  const listItems = useMemo<ListItem[]>(() => {
    if (groupBy === 'none') {
      return filtered.map((movement) => ({ type: 'movement', movement }));
    }
    const groups = new Map<string, { name: string; color: string; movements: AccountMovementListItem[] }>();
    filtered.forEach((movement) => {
      const group = groupBy === 'primary' ? movement.primaryGroup : movement.secondaryGroup;
      const current = groups.get(group.key) ?? { name: group.name, color: group.color, movements: [] };
      current.movements.push(movement);
      groups.set(group.key, current);
    });
    return [...groups.entries()]
      .sort(([, first], [, second]) => first.name.localeCompare(second.name, 'es'))
      .flatMap(([key, group]) => {
        const collapsed = collapsedGroups.includes(key);
        return [
          {
            type: 'group' as const,
            key,
            name: group.name,
            color: group.color,
            total: group.movements.reduce((sum, movement) => sum + (movement.currency === 'USD' ? 0 : movement.amount), 0),
            usdTotal: group.movements.reduce((sum, movement) => sum + (movement.currency === 'USD' ? movement.amount : 0), 0),
            collapsed,
          },
          ...(collapsed ? [] : group.movements.map((movement) => ({ type: 'movement' as const, movement }))),
        ];
      });
  }, [collapsedGroups, filtered, groupBy]);

  const activeFilterCount = Number(sortBy !== 'date-desc')
    + Number(groupBy !== defaultGroup)
    + Number(filterKey !== defaultFilterKey);
  const clearFilters = () => {
    setSearch('');
    setFilterKey(defaultFilterKey);
  };
  const resetFilterControls = () => {
    setSortBy('date-desc');
    setGroupBy(defaultGroup);
    setFilterKey(defaultFilterKey);
    setCollapsedGroups([]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <MovementFilterBar
          activeCount={activeFilterCount}
          onChangeSearch={setSearch}
          onOpenFilters={() => setFilterSheetVisible(true)}
          placeholder={searchPlaceholder}
          search={search}
        />
      </View>

      <MovementFilterSheet
        activeCount={activeFilterCount}
        onClear={resetFilterControls}
        onClose={() => setFilterSheetVisible(false)}
        resultCount={filtered.length}
        visible={filterSheetVisible}>
        <MovementFilterSection title={t('filters.sortBy')}>
          {SORT_OPTIONS.map((option) => (
            <MovementFilterOption
              key={option.value}
              label={option.label}
              onPress={() => setSortBy(option.value)}
              selected={sortBy === option.value}
            />
          ))}
        </MovementFilterSection>
        <MovementFilterSection title={t('filters.group')}>
          {groupOptions.map((option) => (
            <MovementFilterOption
              key={option.value}
              label={option.label}
              onPress={() => {
                setGroupBy(option.value);
                setCollapsedGroups([]);
              }}
              selected={groupBy === option.value}
            />
          ))}
        </MovementFilterSection>
        {filterOptions.length > 1 && (
          <MovementFilterSection title={t('filters.movementType')}>
            {filterOptions.map((option) => (
              <MovementFilterOption
                key={option.value}
                label={option.label}
                onPress={() => setFilterKey(option.value)}
                selected={filterKey === option.value}
              />
            ))}
          </MovementFilterSection>
        )}
      </MovementFilterSheet>

      <FlatList
        contentContainerStyle={styles.list}
        data={listItems}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.type === 'group' ? `group-${item.key}` : item.movement.key}
        ListEmptyComponent={movements.length === 0 ? (
          <EmptyState
            actionLabel={emptyActionLabel}
            description={emptyDescription}
            icon={emptyIcon}
            onAction={() => router.push(fabHref)}
            title={emptyTitle}
          />
        ) : (
          <EmptyState
            actionLabel={t('filters.clear')}
            description={t('movementLedger.noResultsDescription')}
            icon="search-outline"
            onAction={clearFilters}
            title={t('emptyStates.noResultsTitle')}
          />
        )}
        renderItem={({ item }) => {
          if (item.type === 'group') {
            return (
              <Pressable
                accessibilityLabel={`${item.name}, ${formatCLP(item.total)}${item.usdTotal > 0 ? `, ${formatMoney(item.usdTotal, 'USD')}` : ''}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: !item.collapsed }}
                onPress={() => setCollapsedGroups((current) => current.includes(item.key)
                  ? current.filter((key) => key !== item.key)
                  : [...current, item.key])}
                style={[styles.groupHeader, usesLargeText && styles.groupHeaderLargeText, { borderLeftColor: item.color, backgroundColor: `${item.color}18` }]}>
                <View style={styles.groupName}>
                  <View style={[styles.dot, { backgroundColor: item.color }]} />
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                </View>
                <View style={styles.groupTotal}>
                  <View>
                    <ThemedText type="defaultSemiBold">{formatCLP(item.total)}</ThemedText>
                    {item.usdTotal > 0 && <ThemedText type="defaultSemiBold">{formatMoney(item.usdTotal, 'USD')}</ThemedText>}
                  </View>
                  <Ionicons name={item.collapsed ? 'chevron-down' : 'chevron-up'} size={19} color={item.color} />
                </View>
              </Pressable>
            );
          }
          const movement = item.movement;
          return (
            <Pressable
              accessibilityLabel={`${movement.title}, ${formatMoney(movement.amount, movement.currency)}, ${movement.description}, ${formatEventDateTime(movement.date, movement.time)}`}
              accessibilityRole="button"
              onPress={movement.onPress}
              style={styles.movementPressable}>
              <ThemedView style={[styles.movement, usesLargeText && styles.movementLargeText]}>
                <View style={[styles.icon, { backgroundColor: `${movement.color}18` }]}>
                  <Ionicons name={movement.icon} size={20} color={movement.color} />
                </View>
                <View style={styles.movementCopy}>
                  <ThemedText numberOfLines={usesLargeText ? undefined : 1} type="defaultSemiBold">{movement.title}</ThemedText>
                  <ThemedText numberOfLines={2} style={styles.movementMeta}>
                    {movement.description} · {formatEventDateTime(movement.date, movement.time)}
                  </ThemedText>
                </View>
                <View style={[styles.amountColumn, usesLargeText && styles.amountColumnLargeText]}>
                  <ThemedText type="defaultSemiBold">{formatMoney(movement.amount, movement.currency)}</ThemedText>
                  <View style={styles.movementActions}>
                    {movement.onDelete && (
                      <Pressable
                        accessibilityLabel={movement.deleteAccessibilityLabel ?? t('common.delete')}
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={(event) => {
                          event.stopPropagation();
                          movement.onDelete?.();
                        }}
                        style={styles.deleteAction}>
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                      </Pressable>
                    )}
                  </View>
                </View>
              </ThemedView>
            </Pressable>
          );
        }}
      />
      <FloatingActionButton href={fabHref} accessibilityLabel={fabAccessibilityLabel} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filters: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  list: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 105 },
  groupHeader: { minHeight: 48, borderLeftWidth: 5, borderRadius: 10, marginBottom: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  groupHeaderLargeText: { flexWrap: 'wrap', paddingVertical: 10 },
  groupName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  groupTotal: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 13, height: 13, borderRadius: 6.5 },
  movementPressable: { marginBottom: 4 },
  movement: { minHeight: 64, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  movementLargeText: { flexWrap: 'wrap', alignItems: 'flex-start' },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  movementCopy: { flex: 1, gap: 3 },
  movementMeta: { fontSize: 12, lineHeight: 17, opacity: 0.62 },
  amountColumn: { alignItems: 'flex-end', gap: 4 },
  amountColumnLargeText: { width: '100%', alignItems: 'flex-start', paddingLeft: 48 },
  movementActions: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  deleteAction: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center' },
});
