import { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { FloatingActionButton } from '@/components/floating-action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP, formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { matchesSearchQuery } from '@/lib/search';

type IconName = ComponentProps<typeof Ionicons>['name'];
type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export type AccountMovementListItem = {
  key: string;
  title: string;
  amount: number;
  date: string;
  description: string;
  color: string;
  icon: IconName;
  filterKey?: string;
  primaryGroup: { key: string; name: string; color: string };
  secondaryGroup: { key: string; name: string; color: string };
  onPress: () => void;
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
    if (sortBy === 'date-desc') return second.date.localeCompare(first.date) || second.key.localeCompare(first.key);
    if (sortBy === 'date-asc') return first.date.localeCompare(second.date) || first.key.localeCompare(second.key);
    if (sortBy === 'amount-desc') return second.amount - first.amount || second.date.localeCompare(first.date);
    return first.amount - second.amount || second.date.localeCompare(first.date);
  });
}

function ChoiceModal({
  title,
  visible,
  options,
  selected,
  onClose,
  onSelect,
}: {
  title: string;
  visible: boolean;
  options: { value: string; label: string }[];
  selected: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheetPosition} onPress={(event) => event.stopPropagation()}>
          <ThemedView style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <ThemedText type="subtitle">{title}</ThemedText>
            {options.map((option) => {
              const active = option.value === selected;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => onSelect(option.value)}
                  style={[
                    styles.option,
                    { borderColor: active ? colors.primary : colors.border },
                    active && { backgroundColor: `${colors.secondary}24` },
                  ]}>
                  <ThemedText style={active ? styles.optionActive : undefined}>{option.label}</ThemedText>
                  {active && <Ionicons name="checkmark-circle" size={21} color={colors.primary} />}
                </Pressable>
              );
            })}
            <Pressable onPress={onClose} style={[styles.close, { borderColor: colors.border }]}>
              <ThemedText type="defaultSemiBold">{t('common.close')}</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
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
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [groupBy, setGroupBy] = useState<GroupOption['value']>(defaultGroup);
  const defaultFilterKey = filterOptions[0]?.value ?? 'all';
  const [filterKey, setFilterKey] = useState(defaultFilterKey);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [sortVisible, setSortVisible] = useState(false);
  const [groupVisible, setGroupVisible] = useState(false);

  useEffect(() => {
    setSearch('');
    setSortBy('date-desc');
    setGroupBy(defaultGroup);
    setFilterKey(defaultFilterKey);
    setCollapsedGroups([]);
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
            total: group.movements.reduce((sum, movement) => sum + movement.amount, 0),
            collapsed,
          },
          ...(collapsed ? [] : group.movements.map((movement) => ({ type: 'movement' as const, movement }))),
        ];
      });
  }, [collapsedGroups, filtered, groupBy]);

  const selectedSort = SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? '';
  const selectedGroup = groupOptions.find((option) => option.value === groupBy)?.label ?? '';
  const clearFilters = () => {
    setSearch('');
    setFilterKey(defaultFilterKey);
  };

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <View style={[styles.search, { borderColor: colors.icon }]}>
          <Ionicons name="search" size={18} color={colors.icon} />
          <TextInput
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={setSearch}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.icon}
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
          />
          {search.length > 0 && (
            <Pressable hitSlop={8} onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.icon} />
            </Pressable>
          )}
        </View>

        {filterOptions.length > 1 && (
          <ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
            {filterOptions.map((option) => {
              const active = filterKey === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setFilterKey(option.value)}
                  style={[
                    styles.chip,
                    { borderColor: active ? colors.primary : colors.border },
                    active && { backgroundColor: `${colors.secondary}24` },
                  ]}>
                  <ThemedText style={active ? styles.optionActive : undefined}>{option.label}</ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.toolbar}>
          <Pressable onPress={() => setSortVisible(true)} style={[styles.toolbarButton, { borderColor: colors.icon }]}>
            <Ionicons name="swap-vertical" size={18} color={colors.icon} />
            <View style={styles.toolbarCopy}>
              <ThemedText type="defaultSemiBold">{t('filters.order')}</ThemedText>
              <ThemedText numberOfLines={1} style={styles.toolbarDetail}>{selectedSort}</ThemedText>
            </View>
          </Pressable>
          <Pressable onPress={() => setGroupVisible(true)} style={[styles.toolbarButton, { borderColor: colors.primary, backgroundColor: `${colors.secondary}24` }]}>
            <Ionicons name="layers-outline" size={18} color={colors.primary} />
            <View style={styles.toolbarCopy}>
              <ThemedText type="defaultSemiBold">{t('filters.group')}</ThemedText>
              <ThemedText numberOfLines={1} style={styles.toolbarDetail}>{selectedGroup}</ThemedText>
            </View>
          </Pressable>
        </View>
      </View>

      <ChoiceModal
        title={t('filters.sortBy')}
        visible={sortVisible}
        options={SORT_OPTIONS}
        selected={sortBy}
        onClose={() => setSortVisible(false)}
        onSelect={(value) => { setSortBy(value as SortOption); setSortVisible(false); }}
      />
      <ChoiceModal
        title={t('filters.group')}
        visible={groupVisible}
        options={groupOptions}
        selected={groupBy}
        onClose={() => setGroupVisible(false)}
        onSelect={(value) => { setGroupBy(value as GroupOption['value']); setCollapsedGroups([]); setGroupVisible(false); }}
      />

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
                accessibilityRole="button"
                accessibilityState={{ expanded: !item.collapsed }}
                onPress={() => setCollapsedGroups((current) => current.includes(item.key)
                  ? current.filter((key) => key !== item.key)
                  : [...current, item.key])}
                style={[styles.groupHeader, { borderLeftColor: item.color, backgroundColor: `${item.color}18` }]}>
                <View style={styles.groupName}>
                  <View style={[styles.dot, { backgroundColor: item.color }]} />
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                </View>
                <View style={styles.groupTotal}>
                  <ThemedText type="defaultSemiBold">{formatCLP(item.total)}</ThemedText>
                  <Ionicons name={item.collapsed ? 'chevron-down' : 'chevron-up'} size={19} color={item.color} />
                </View>
              </Pressable>
            );
          }
          const movement = item.movement;
          return (
            <Pressable onPress={movement.onPress} style={styles.movementPressable}>
              <ThemedView style={styles.movement}>
                <View style={[styles.icon, { backgroundColor: `${movement.color}18` }]}>
                  <Ionicons name={movement.icon} size={20} color={movement.color} />
                </View>
                <View style={styles.movementCopy}>
                  <ThemedText numberOfLines={1} type="defaultSemiBold">{movement.title}</ThemedText>
                  <ThemedText numberOfLines={2} style={styles.movementMeta}>
                    {movement.description} · {formatDate(new Date(`${movement.date}T12:00:00`))}
                  </ThemedText>
                </View>
                <View style={styles.amountColumn}>
                  <ThemedText type="defaultSemiBold">{formatCLP(movement.amount)}</ThemedText>
                  <Ionicons name="chevron-forward" size={18} color={colors.icon} />
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
  filters: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 10 },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, padding: 0, fontSize: 16, fontFamily: Fonts.regular },
  chips: { gap: 8 },
  chip: { minHeight: 36, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row', gap: 10 },
  toolbarButton: { flex: 1, minHeight: 60, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  toolbarCopy: { flex: 1, gap: 1 },
  toolbarDetail: { fontSize: 12, opacity: 0.6 },
  list: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 105 },
  groupHeader: { minHeight: 48, borderLeftWidth: 5, borderRadius: 10, marginBottom: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  groupName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  groupTotal: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 13, height: 13, borderRadius: 6.5 },
  movementPressable: { marginBottom: 4 },
  movement: { minHeight: 64, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  movementCopy: { flex: 1, gap: 3 },
  movementMeta: { fontSize: 12, lineHeight: 17, opacity: 0.62 },
  amountColumn: { alignItems: 'flex-end', gap: 4 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetPosition: { maxHeight: '75%' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 20, paddingTop: 20, gap: 10 },
  option: { minHeight: 49, borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  optionActive: { fontWeight: '700' },
  close: { minHeight: 48, borderWidth: 1, borderRadius: 10, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
});
