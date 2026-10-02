import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';
import { orderGroupedOptions } from '@/lib/payment-method-options';
import { matchesSearchQuery } from '@/lib/search';

import { styles } from './styles';

export type ColorSelectOption = {
  value: number | null;
  label: string;
  color: string;
  group?: string;
  groupOrder?: number;
};

type NameSuggestionsProps = {
  suggestions: string[];
  onSelect: (name: string) => void;
};

export function NameSuggestions({ suggestions, onSelect }: NameSuggestionsProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  if (suggestions.length === 0) return null;

  return (
    <View style={[styles.nameSuggestions, { borderColor: colors.icon }]}>
      <ThemedText style={styles.nameSuggestionsLabel}>{t('common.suggestions')}</ThemedText>
      {suggestions.map((suggestion) => (
        <Pressable
          accessibilityLabel={suggestion}
          accessibilityRole="button"
          key={suggestion}
          onPressIn={() => onSelect(suggestion)}
          style={styles.nameSuggestion}>
          <ThemedText>{suggestion}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}
export function ColorSelect({
  label,
  value,
  options,
  onChange,
  showColor = true,
  disabled = false,
  searchable = false,
  testID,
}: {
  label: string;
  value: number | null;
  options: ColorSelectOption[];
  onChange: (value: number | null) => void;
  showColor?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  testID?: string;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
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
    <>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected.label}`}
        accessibilityHint={t('accessibility.openSelector')}
        accessibilityState={{ disabled, expanded: visible }}
        disabled={disabled}
        onPress={() => setVisible(true)}
        testID={testID}
        style={({ pressed }) => [
          styles.selectButton,
          { borderColor: colors.border },
          pressed && !disabled && styles.selectPressed,
          disabled && { opacity: 0.72 },
        ]}>
        <View style={styles.selectValue}>
          {showColor && <View style={[styles.selectDot, { backgroundColor: selected.color }]} />}
          <ThemedText type="defaultSemiBold" numberOfLines={1}>{selected.label}</ThemedText>
        </View>
        <Ionicons name={disabled ? 'lock-closed-outline' : 'chevron-down'} size={20} color={colors.icon} />
      </Pressable>

      <Modal
        animationType="slide"
        transparent
        visible={visible && !disabled}
        onRequestClose={closeSelect}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.selectKeyboardAvoider}>
          <Pressable accessible={false} style={styles.selectOverlay} onPress={closeSelect}>
            <Pressable accessible={false} style={styles.selectSheet} onPress={(event) => event.stopPropagation()}>
              <ThemedView
                accessibilityViewIsModal
                style={[
                  styles.selectContent,
                  {
                    backgroundColor: colors.surfaceRaised,
                    paddingBottom: Math.max(insets.bottom, 16) + 12,
                  },
                ]}>
                <View style={styles.selectHandle} />
                <ThemedText type="subtitle">{label}</ThemedText>
                {searchable && (
                  <View style={[styles.selectSearch, { borderColor: colors.border }]}>
                    <Ionicons name="search-outline" size={20} color={colors.icon} />
                    <TextInput
                      accessibilityLabel={t('common.searchCategory')}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={setSearchQuery}
                      placeholder={t('common.searchCategory')}
                      placeholderTextColor={colors.icon}
                      returnKeyType="search"
                      style={[styles.selectSearchInput, { color: colors.text }]}
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
                  style={styles.selectOptions}
                  showsVerticalScrollIndicator={false}>
                  {filteredOptions.map((option, index) => {
                    const isSelected = option.value === value;
                    const showGroup = option.group != null && option.group !== filteredOptions[index - 1]?.group;
                    return (
                      <View key={option.value ?? 'none'}>
                        {showGroup && <ThemedText style={styles.selectGroup}>{option.group}</ThemedText>}
                        <Pressable
                          accessibilityLabel={option.label}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: isSelected }}
                          onPress={() => {
                            onChange(option.value);
                            closeSelect();
                          }}
                          style={[
                            styles.selectOption,
                            { borderColor: isSelected ? option.color : colors.border },
                            isSelected && { backgroundColor: option.color + '18' },
                          ]}>
                          <View style={styles.selectValue}>
                            {showColor && <View style={[styles.selectDot, { backgroundColor: option.color }]} />}
                            <ThemedText style={isSelected ? styles.selectOptionSelectedText : undefined}>
                              {option.label}
                            </ThemedText>
                          </View>
                          {isSelected && <Ionicons name="checkmark-circle" size={21} color={option.color} />}
                        </Pressable>
                      </View>
                    );
                  })}
                  {filteredOptions.length === 0 && (
                    <ThemedText style={styles.selectEmpty}>{t('common.noCategoriesFound')}</ThemedText>
                  )}
                </ScrollView>
                <Pressable
                  accessibilityRole="button"
                  onPress={closeSelect}
                  style={[styles.selectClose, { borderColor: colors.border }]}>
                  <ThemedText type="defaultSemiBold">{t('common.cancel')}</ThemedText>
                </Pressable>
              </ThemedView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
