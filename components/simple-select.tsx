import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';
import { orderGroupedOptions } from '@/lib/payment-method-options';
import { matchesSearchQuery } from '@/lib/search';

export type SimpleSelectOption<T extends string | number | null> = {
  value: T;
  label: string;
  color?: string;
  group?: string;
  groupOrder?: number;
};

export function SimpleSelect<T extends string | number | null>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  searchable = false,
  modalSize = 'content',
  testID,
}: {
  label: string;
  value: T;
  options: SimpleSelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  searchable?: boolean;
  modalSize?: 'content' | 'large';
  testID?: string;
}) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const selected = options.find((option) => option.value === value) ?? options[0];
  const filteredOptions = useMemo(() => {
    return orderGroupedOptions(options.filter((option) => matchesSearchQuery(option.label, searchQuery)));
  }, [options, searchQuery]);

  const closeSelect = () => {
    setVisible(false);
    setSearchQuery('');
  };

  return (
    <View style={styles.group}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <Pressable
        accessibilityHint={t('accessibility.openSelector')}
        accessibilityLabel={`${label}: ${selected?.label ?? ''}`}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: visible }}
        disabled={disabled}
        onPress={() => setVisible(true)}
        testID={testID}
        style={[styles.field, { borderColor: colors.border }, disabled && styles.disabled]}>
        <View style={styles.value}>
          {selected?.color && <View style={[styles.dot, { backgroundColor: selected.color }]} />}
          <ThemedText numberOfLines={1} style={styles.valueText}>{selected?.label}</ThemedText>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.icon} />
      </Pressable>
      <Modal transparent animationType="slide" visible={visible} onRequestClose={closeSelect}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoider}>
          <Pressable accessible={false} style={styles.overlay} onPress={closeSelect}>
            <Pressable accessible={false} style={styles.dialogPosition} onPress={(event) => event.stopPropagation()}>
              <ThemedView style={[
                styles.sheet,
                {
                  backgroundColor: colors.surfaceRaised,
                  height: modalSize === 'large' ? '82%' : undefined,
                  paddingBottom: Math.max(insets.bottom, 16) + 12,
                },
              ]} accessibilityViewIsModal>
                <View style={styles.handle} />
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
                    <Pressable
                      accessibilityLabel={t('common.clearSearch')}
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={20} color={colors.icon} />
                    </Pressable>
                  )}
                </View>
              )}
              <ScrollView
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                style={styles.options}>
                {filteredOptions.map((option, index) => {
                  const active = option.value === value;
                  const showGroup = option.group != null && option.group !== filteredOptions[index - 1]?.group;
                  return (
                    <View key={`${String(option.value)}-${index}`}>
                      {showGroup && <ThemedText style={styles.groupLabel}>{option.group}</ThemedText>}
                      <Pressable
                        accessibilityLabel={option.label}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        onPress={() => { onChange(option.value); closeSelect(); }}
                        style={[styles.option, { borderColor: active ? colors.primary : colors.border }, active && { backgroundColor: colors.primary + '14' }]}>
                        <View style={styles.value}>
                          {option.color && <View style={[styles.dot, { backgroundColor: option.color }]} />}
                          <ThemedText style={styles.valueText}>{option.label}</ThemedText>
                        </View>
                        {active && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                      </Pressable>
                    </View>
                  );
                })}
                {filteredOptions.length === 0 && (
                  <ThemedText style={styles.empty}>{t('common.noCategoriesFound')}</ThemedText>
                )}
              </ScrollView>
              </ThemedView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 7 }, label: { fontWeight: '600' },
  field: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  value: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 }, valueText: { flexShrink: 1 },
  dot: { width: 13, height: 13, borderRadius: 5 },
  keyboardAvoider: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  dialogPosition: { width: '100%', maxHeight: '82%', flexShrink: 1 },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, gap: 14, maxHeight: '100%', flexShrink: 1 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#60758E', opacity: 0.55, alignSelf: 'center' },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  empty: { textAlign: 'center', opacity: 0.7, paddingHorizontal: 16, paddingVertical: 28 },
  groupLabel: { fontSize: 12, fontWeight: '700', opacity: 0.65, marginTop: 7, marginBottom: 7, paddingHorizontal: 2, textTransform: 'uppercase' },
  options: { flexShrink: 1, maxHeight: 420 },
  option: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  disabled: { opacity: 0.6 },
});
