import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

import { styles } from './styles';

export type ColorSelectOption = {
  value: number | null;
  label: string;
  color: string;
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
}: {
  label: string;
  value: number | null;
  options: ColorSelectOption[];
  onChange: (value: number | null) => void;
  showColor?: boolean;
  disabled?: boolean;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected.label}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setVisible(true)}
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
        onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.selectOverlay} onPress={() => setVisible(false)}>
          <Pressable style={styles.selectSheet} onPress={(event) => event.stopPropagation()}>
            <ThemedView
              style={[
                styles.selectContent,
                {
                  backgroundColor: colors.surfaceRaised,
                  paddingBottom: Math.max(insets.bottom, 16) + 12,
                },
              ]}>
              <View style={styles.selectHandle} />
              <ThemedText type="subtitle">{label}</ThemedText>
              <ScrollView style={styles.selectOptions} showsVerticalScrollIndicator={false}>
                {options.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <Pressable
                      key={option.value ?? 'none'}
                      onPress={() => {
                        onChange(option.value);
                        setVisible(false);
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
                  );
                })}
              </ScrollView>
              <Pressable
                onPress={() => setVisible(false)}
                style={[styles.selectClose, { borderColor: colors.border }]}>
                <ThemedText type="defaultSemiBold">{t('common.cancel')}</ThemedText>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
