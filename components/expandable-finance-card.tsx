import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

type ExpandableFinanceCardProps = {
  title: string;
  summary: string;
  backgroundColor: string;
  manageAccessibilityLabel: string;
  children: ReactNode;
  initiallyExpanded?: boolean;
  onManage: () => void;
};

export function ExpandableFinanceCard({
  title,
  summary,
  backgroundColor,
  manageAccessibilityLabel,
  children,
  initiallyExpanded = false,
  onManage,
}: ExpandableFinanceCardProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [expanded, setExpanded] = useState(initiallyExpanded);

  return (
    <View style={[styles.card, { backgroundColor }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${title}. ${summary}`}
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
          <View style={styles.headerCopy}>
            <ThemedText type="subtitle">{title}</ThemedText>
            <ThemedText style={[styles.summary, { color: colors.textSecondary }]}>{summary}</ThemedText>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={21}
            color={colors.icon}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={manageAccessibilityLabel}
          onPress={onManage}
          style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}>
          <ThemedText style={styles.manageButtonText}>{t('common.details')}</ThemedText>
        </Pressable>
      </View>
      {expanded && children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    gap: 16,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggle: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCopy: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  summary: {
    fontSize: 12,
    lineHeight: 17,
  },
  manageButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#0B315B',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  manageButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
