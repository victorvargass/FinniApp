import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLargeTextLayout } from '@/hooks/use-large-text-layout';
import { t } from '@/lib/i18n';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function MovementFilterBar({
  search,
  onChangeSearch,
  placeholder,
  activeCount,
  onOpenFilters,
}: {
  search: string;
  onChangeSearch: (value: string) => void;
  placeholder: string;
  activeCount: number;
  onOpenFilters: () => void;
}) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const usesLargeText = useLargeTextLayout();
  const filtersActive = activeCount > 0;
  const activeLabel = activeCount === 1
    ? t('filters.oneActive')
    : t('filters.activeCount', { count: activeCount });

  return (
    <View style={[styles.filterBar, usesLargeText && styles.filterBarLargeText]}>
      <View style={[styles.searchBox, { borderColor: colors.icon }]}>
        <Ionicons name="search" size={18} color={colors.icon} />
        <TextInput
          accessibilityLabel={placeholder}
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={onChangeSearch}
          placeholder={placeholder}
          placeholderTextColor={colors.icon}
          style={[styles.searchInput, { color: colors.text }]}
          value={search}
        />
        {search.length > 0 && (
          <Pressable
            accessibilityLabel={t('common.clearSearch')}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => onChangeSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.icon} />
          </Pressable>
        )}
      </View>

      <Pressable
        accessibilityLabel={filtersActive
          ? `${t('common.filters')}, ${activeLabel}`
          : t('common.filters')}
        accessibilityRole="button"
        onPress={onOpenFilters}
        style={[
          styles.filterButton,
          usesLargeText && styles.filterButtonLargeText,
          { borderColor: filtersActive ? colors.primary : colors.icon },
          filtersActive && { backgroundColor: `${colors.secondary}24` },
        ]}>
        <Ionicons name="options-outline" size={20} color={filtersActive ? colors.primary : colors.icon} />
        <ThemedText
          numberOfLines={usesLargeText ? undefined : 1}
          style={[styles.filterButtonText, filtersActive && { color: colors.primary }]}>
          {t('common.filters')}
        </ThemedText>
        {filtersActive && (
          <View style={[styles.activeBadge, { backgroundColor: colors.primary }]}>
            <ThemedText style={[styles.activeBadgeText, { color: colors.onPrimary }]}>
              {activeCount}
            </ThemedText>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export function MovementFilterSheet({
  visible,
  onClose,
  resultCount,
  activeCount,
  onClear,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  resultCount: number;
  activeCount: number;
  onClear?: () => void;
  children: ReactNode;
}) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const resultLabel = resultCount === 1
    ? t('filters.viewOneMovement')
    : t('filters.viewMovements', { count: resultCount });
  const activeLabel = activeCount === 1
    ? t('filters.oneActive')
    : t('filters.activeCount', { count: activeCount });

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable accessible={false} style={styles.overlay} onPress={onClose}>
        <Pressable accessible={false} style={styles.sheetPosition} onPress={(event) => event.stopPropagation()}>
          <ThemedView
            accessibilityViewIsModal
            style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <ThemedText type="subtitle">{t('common.filters')}</ThemedText>
                {activeCount > 0 && (
                  <View style={[styles.sheetBadge, { backgroundColor: `${colors.secondary}24` }]}>
                    <ThemedText style={[styles.sheetBadgeText, { color: colors.primary }]}>
                      {activeLabel}
                    </ThemedText>
                  </View>
                )}
              </View>
              <Pressable
                accessibilityLabel={t('common.close')}
                accessibilityRole="button"
                hitSlop={10}
                onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.sheetScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.sheetScroll}>
              {children}
              {activeCount > 0 && onClear && (
                <Pressable accessibilityRole="button" onPress={onClear} style={styles.clearButton}>
                  <ThemedText style={[styles.clearButtonText, { color: colors.danger }]}>
                    {t('filters.clearAll')}
                  </ThemedText>
                </Pressable>
              )}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={[styles.resultsButton, { backgroundColor: colors.primary }]}>
              <ThemedText type="defaultSemiBold" style={{ color: colors.onPrimary }}>
                {resultLabel}
              </ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function MovementFilterSection({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        {actionLabel && onAction && (
          <Pressable accessibilityRole="button" onPress={onAction}>
            <ThemedText type="link">{actionLabel}</ThemedText>
          </Pressable>
        )}
      </View>
      <View style={styles.options}>{children}</View>
    </View>
  );
}

export function MovementFilterOption({
  label,
  selected,
  onPress,
  color,
  icon,
  selectionMode = 'single',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  icon?: IconName;
  selectionMode?: 'single' | 'multiple';
}) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const isMultiple = selectionMode === 'multiple';
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole={isMultiple ? 'checkbox' : 'radio'}
      accessibilityState={isMultiple ? { checked: selected } : { selected }}
      onPress={onPress}
      style={[
        styles.option,
        { borderColor: selected ? colors.primary : colors.border },
        selected && { backgroundColor: `${colors.secondary}24` },
      ]}>
      <View style={styles.optionLeft}>
        {color != null && <View style={[styles.optionDot, { backgroundColor: color }]} />}
        {icon != null && <Ionicons name={icon} size={18} color={selected ? colors.primary : colors.icon} />}
        <ThemedText style={selected ? styles.optionSelected : undefined}>{label}</ThemedText>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    flexDirection: 'row',
    gap: 10,
  },
  filterBarLargeText: {
    flexDirection: 'column',
  },
  searchBox: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontSize: 16,
    fontFamily: Fonts.regular,
  },
  filterButton: {
    minWidth: 112,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  filterButtonLargeText: {
    width: '100%',
  },
  filterButtonText: {
    fontWeight: '700',
  },
  activeBadge: {
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 5,
  },
  activeBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetPosition: {
    maxHeight: '88%',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    marginBottom: 14,
  },
  sheetHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 10,
  },
  sheetTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  sheetBadge: {
    minHeight: 25,
    justifyContent: 'center',
    borderRadius: 13,
    paddingHorizontal: 9,
  },
  sheetBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sheetScroll: {
    maxHeight: 540,
  },
  sheetScrollContent: {
    paddingBottom: 6,
  },
  section: {
    paddingTop: 12,
  },
  sectionHeader: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 7,
  },
  sectionTitle: {
    fontSize: 13,
    opacity: 0.58,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  options: {
    gap: 8,
  },
  option: {
    minHeight: 49,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  optionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  optionSelected: {
    fontWeight: '700',
  },
  clearButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  clearButtonText: {
    fontWeight: '700',
  },
  resultsButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    marginTop: 10,
  },
});
