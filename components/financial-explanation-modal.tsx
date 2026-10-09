import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

export type FinancialExplanationLine = {
  label: string;
  value: string;
  operator?: '+' | '−';
};

export type FinancialExplanation = {
  title: string;
  description: string;
  lines: FinancialExplanationLine[];
  totalLabel: string;
  total: string;
};

export function FinancialExplanationModal({
  explanation,
  onClose,
}: {
  explanation: FinancialExplanation | null;
  onClose: () => void;
}) {
  const colors = Colors[useColorScheme() ?? 'light'];
  if (!explanation) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={t('common.close')}
        accessibilityRole="button"
        onPress={onClose}
        style={styles.overlay}>
        <Pressable
          accessibilityViewIsModal
          accessibilityRole="none"
          onPress={(event) => event.stopPropagation()}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={[styles.bulb, { backgroundColor: `${colors.warning}1F` }]}>
              <Ionicons name="bulb-outline" size={26} color={colors.warning} />
            </View>
            <View style={styles.headerCopy}>
              <ThemedText style={[styles.eyebrow, { color: colors.action }]}>
                {t('financialExplanation.eyebrow')}
              </ThemedText>
              <ThemedText type="subtitle">{explanation.title}</ThemedText>
            </View>
            <Pressable
              accessibilityLabel={t('common.close')}
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
              style={({ pressed }) => [styles.closeIcon, pressed && styles.pressed]}>
              <Ionicons name="close" size={23} color={colors.icon} />
            </Pressable>
          </View>

          <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
            {explanation.description}
          </ThemedText>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.lines} showsVerticalScrollIndicator={false}>
            {explanation.lines.length === 0 ? (
              <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>
                {t('financialExplanation.noComponents')}
              </ThemedText>
            ) : explanation.lines.map((line, index) => (
              <View key={`${line.label}-${index}`} style={styles.line}>
                <View style={[styles.operator, { backgroundColor: `${colors.primary}12` }]}>
                  <ThemedText style={[styles.operatorText, { color: colors.primary }]}>
                    {line.operator ?? '+'}
                  </ThemedText>
                </View>
                <ThemedText style={styles.lineLabel}>{line.label}</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.lineValue}>{line.value}</ThemedText>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.total, { borderTopColor: colors.border, backgroundColor: colors.surfaceRaised }]}>
            <ThemedText type="defaultSemiBold">{explanation.totalLabel}</ThemedText>
            <ThemedText type="subtitle" style={[styles.totalValue, { color: colors.primary }]}>
              {explanation.total}
            </ThemedText>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={[styles.buttonText, { color: colors.onPrimary }]}>
              {t('financialExplanation.understood')}
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(4, 22, 39, 0.52)',
  },
  card: {
    maxHeight: '82%',
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    gap: 16,
    elevation: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bulb: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 11, lineHeight: 15, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.7 },
  closeIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  description: { fontSize: 14, lineHeight: 20 },
  scroll: { flexGrow: 0, flexShrink: 1, maxHeight: 300 },
  lines: { gap: 11 },
  line: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 8 },
  operator: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  operatorText: { fontFamily: Fonts.bold, fontSize: 14 },
  lineLabel: { minWidth: 0, flex: 1, fontSize: 13 },
  lineValue: { fontSize: 13, textAlign: 'right' },
  empty: { paddingVertical: 8, textAlign: 'center' },
  total: { borderTopWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  totalValue: { flexShrink: 1, textAlign: 'right' },
  button: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontFamily: Fonts.bold },
  pressed: { opacity: 0.72 },
});
