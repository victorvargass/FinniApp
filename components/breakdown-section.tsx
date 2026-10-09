import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FinancialInfoButton } from '@/components/financial-info-button';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

export type BreakdownMode = 'category' | 'paymentMethod';

type Props = {
  mode: BreakdownMode;
  onChange: (mode: BreakdownMode) => void;
  categoryContent: ReactNode;
  paymentMethodContent: ReactNode;
  backgroundColor: string;
  collapsible?: boolean;
  style?: StyleProp<ViewStyle>;
  onExplain?: () => void;
};

export function BreakdownSection({
  mode,
  onChange,
  categoryContent,
  paymentMethodContent,
  backgroundColor,
  collapsible = false,
  style,
  onExplain,
}: Props) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [expanded, setExpanded] = useState(!collapsible);
  const selectedModeLabel = t(mode === 'category' ? 'filters.groupByCategory' : 'filters.groupByPaymentMethod');

  return (
    <ThemedView style={[styles.container, collapsible && styles.collapsibleContainer, { backgroundColor }, style]}>
      {collapsible ? (
        <Pressable
          accessibilityLabel={`${t('breakdown.title')}. ${selectedModeLabel}`}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
          <View style={styles.headerCopy}>
            <ThemedText type="subtitle">{t('breakdown.title')}</ThemedText>
            <ThemedText style={[styles.summary, { color: colors.textSecondary }]}>{selectedModeLabel}</ThemedText>
          </View>
          {onExplain && <FinancialInfoButton onPress={onExplain} />}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={21} color={colors.icon} />
        </Pressable>
      ) : (
        <View style={styles.titleRow}><ThemedText type="title" style={styles.title}>{t('breakdown.title')}</ThemedText>{onExplain && <FinancialInfoButton onPress={onExplain} />}</View>
      )}

      {expanded && (
        <>
          <View style={[styles.toggle, { borderColor: colors.border, backgroundColor: colors.screen }]}>
            <ToggleOption
              label={t('filters.groupByCategory')}
              selected={mode === 'category'}
              onPress={() => onChange('category')}
              activeColor={colors.primary}
              activeTextColor={colors.onPrimary}
            />
            <ToggleOption
              label={t('filters.groupByPaymentMethod')}
              selected={mode === 'paymentMethod'}
              onPress={() => onChange('paymentMethod')}
              activeColor={colors.primary}
              activeTextColor={colors.onPrimary}
            />
          </View>

          <View style={styles.content}>
            {mode === 'category' ? categoryContent : paymentMethodContent}
          </View>
        </>
      )}
    </ThemedView>
  );
}

function ToggleOption({
  label,
  selected,
  onPress,
  activeColor,
  activeTextColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  activeColor: string;
  activeTextColor: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && { backgroundColor: activeColor },
        pressed && styles.pressed,
      ]}>
      <ThemedText
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        numberOfLines={1}
        style={[styles.optionText, selected && { color: activeTextColor }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 14,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  collapsibleContainer: { borderRadius: 14, padding: 16, gap: 16 },
  header: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCopy: { minWidth: 0, flex: 1, gap: 2 },
  summary: { fontSize: 12, lineHeight: 17 },
  title: { fontSize: 24, lineHeight: 28 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
  },
  option: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  optionText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    paddingTop: 2,
  },
  pressed: {
    opacity: 0.72,
  },
});
