import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';
import { matchesSearchQuery } from '@/lib/search';

export type SimpleSelectOption<T extends string | number | null> = {
  value: T;
  label: string;
  color?: string;
};

export function SimpleSelect<T extends string | number | null>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  searchable = false,
}: {
  label: string;
  value: T;
  options: SimpleSelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  searchable?: boolean;
}) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [visible, setVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const selected = options.find((option) => option.value === value) ?? options[0];
  const filteredOptions = useMemo(() => {
    return options.filter((option) => matchesSearchQuery(option.label, searchQuery));
  }, [options, searchQuery]);

  const closeSelect = () => {
    setVisible(false);
    setSearchQuery('');
  };

  return (
    <View style={styles.group}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <Pressable disabled={disabled} onPress={() => setVisible(true)} style={[styles.field, { borderColor: colors.border }, disabled && styles.disabled]}>
        <View style={styles.value}>
          {selected?.color && <View style={[styles.dot, { backgroundColor: selected.color }]} />}
          <ThemedText numberOfLines={1} style={styles.valueText}>{selected?.label}</ThemedText>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.icon} />
      </Pressable>
      <Modal transparent animationType="fade" visible={visible} onRequestClose={closeSelect}>
        <Pressable style={styles.overlay} onPress={closeSelect}>
          <Pressable style={styles.dialogPosition} onPress={(event) => event.stopPropagation()}>
            <ThemedView style={[styles.sheet, { backgroundColor: colors.surfaceRaised, minHeight: Math.min(520, 100 + options.length * 56) }]}>
              <ThemedText type="subtitle">{label}</ThemedText>
              {searchable && (
                <View style={[styles.search, { borderColor: colors.border }]}>
                  <Ionicons name="search-outline" size={20} color={colors.icon} />
                  <TextInput
                    accessibilityLabel={t('common.searchCategory')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={setSearchQuery}
                    placeholder={t('common.searchCategory')}
                    placeholderTextColor={colors.icon}
                    returnKeyType="search"
                    style={[styles.searchInput, { color: colors.text }]}
                    value={searchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <Pressable accessibilityLabel={t('common.clearSearch')} hitSlop={10} onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={20} color={colors.icon} />
                    </Pressable>
                  )}
                </View>
              )}
              <ScrollView style={styles.options}>
                {filteredOptions.map((option, index) => {
                  const active = option.value === value;
                  return (
                    <Pressable
                      key={`${String(option.value)}-${index}`}
                      onPress={() => { onChange(option.value); closeSelect(); }}
                      style={[styles.option, { borderColor: active ? colors.primary : colors.border }, active && { backgroundColor: colors.primary + '14' }]}>
                      <View style={styles.value}>
                        {option.color && <View style={[styles.dot, { backgroundColor: option.color }]} />}
                        <ThemedText style={styles.valueText}>{option.label}</ThemedText>
                      </View>
                      {active && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                    </Pressable>
                  );
                })}
                {filteredOptions.length === 0 && (
                  <ThemedText style={styles.empty}>{t('common.noCategoriesFound')}</ThemedText>
                )}
              </ScrollView>
            </ThemedView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 7 }, label: { fontWeight: '600' },
  field: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  value: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 }, valueText: { flexShrink: 1 },
  dot: { width: 13, height: 13, borderRadius: 5 }, overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.45)' },
  dialogPosition: { width: '100%' }, sheet: { borderRadius: 18, padding: 20, gap: 14, maxHeight: '72%' },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  empty: { textAlign: 'center', opacity: 0.7, paddingHorizontal: 16, paddingVertical: 28 },
  options: { flex: 1, maxHeight: 420 },
  option: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  disabled: { opacity: 0.6 },
});
