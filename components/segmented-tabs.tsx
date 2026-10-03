import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLargeTextLayout } from '@/hooks/use-large-text-layout';

export type SegmentedTabOption<T extends string> = {
  value: T;
  label: string;
};

export function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly SegmentedTabOption<T>[];
  onChange: (value: T) => void;
}) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const usesLargeText = useLargeTextLayout();

  return (
    <View style={[styles.container, usesLargeText && styles.containerLargeText, { borderColor: colors.border }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.tab,
              usesLargeText && styles.tabLargeText,
              selected && { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}>
            <ThemedText
              numberOfLines={2}
              style={[styles.label, selected && { color: colors.onPrimary }]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 4, gap: 4 },
  containerLargeText: { flexDirection: 'column' },
  tab: { flex: 1, minHeight: 43, borderRadius: 9, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  tabLargeText: { flex: 0, width: '100%', paddingVertical: 8 },
  label: { fontSize: 13, lineHeight: 16, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.68 },
});
