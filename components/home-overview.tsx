import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

export type HomeAttentionItem = {
  key: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  tone: 'warning' | 'danger' | 'action';
  onPress: () => void;
  onDismiss: () => void;
};

type HomeAttentionSectionProps = {
  items: HomeAttentionItem[];
  notificationCount: number;
  onOpenNotifications: () => void;
  onUndoDismiss?: () => void;
};

export function HomeAttentionSection({ items, notificationCount, onOpenNotifications, onUndoDismiss }: HomeAttentionSectionProps) {
  const colors = Colors[useColorScheme() ?? 'light'];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>{t('home.attention')}</ThemedText>
        <Pressable
          accessibilityLabel={t('home.viewNotifications')}
          accessibilityRole="button"
          onPress={onOpenNotifications}
          style={({ pressed }) => [styles.notificationsLink, pressed && styles.pressed]}>
          <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>
            {t('home.viewNotificationsShort', { count: notificationCount })}
          </ThemedText>
        </Pressable>
      </View>
      {items.length === 0 ? (
        <ThemedView style={[styles.upToDate, { borderColor: colors.border }]}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <View style={styles.attentionCopy}>
            <ThemedText type="defaultSemiBold">{t('home.upToDate')}</ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>{t('home.upToDateHint')}</ThemedText>
          </View>
        </ThemedView>
      ) : (
        items.slice(0, 3).map((item) => {
          const accent = item.tone === 'danger'
            ? colors.danger
            : item.tone === 'warning' ? colors.warning : colors.action;
          return (
            <View
              key={item.key}
              style={[styles.attention, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable
                accessibilityRole="button"
                onPress={item.onPress}
                style={({ pressed }) => [styles.attentionAction, pressed && styles.pressed]}>
                <View style={[styles.attentionIcon, { backgroundColor: `${accent}1F` }]}>
                  <Ionicons name={item.icon} size={22} color={accent} />
                </View>
                <View style={styles.attentionCopy}>
                  <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
                  <ThemedText style={[styles.attentionBody, { color: colors.textSecondary }]}>{item.body}</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.icon} />
              </Pressable>
              <Pressable
                accessibilityLabel={t('home.dismissAttention')}
                accessibilityRole="button"
                hitSlop={8}
                onPress={item.onDismiss}
                style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed]}>
                <Ionicons name="close" size={20} color={colors.icon} />
              </Pressable>
            </View>
          );
        })
      )}
      {onUndoDismiss && (
        <ThemedView style={[styles.undoNotice, { borderColor: colors.border }]}>
          <ThemedText style={[styles.undoLabel, { color: colors.textSecondary }]}>
            {t('home.attentionDismissed')}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={onUndoDismiss}
            style={({ pressed }) => [styles.undoButton, pressed && styles.pressed]}>
            <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>
              {t('common.undo')}
            </ThemedText>
          </Pressable>
        </ThemedView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { flex: 1 },
  notificationsLink: {
    minHeight: 44,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  upToDate: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  attention: { borderWidth: 1, borderRadius: 14, padding: 7, flexDirection: 'row', alignItems: 'center', gap: 2 },
  attentionAction: { flex: 1, minWidth: 0, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 12 },
  attentionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  attentionCopy: { flex: 1, gap: 2 },
  attentionBody: { fontSize: 13, lineHeight: 18 },
  dismissButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  undoNotice: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  undoLabel: { flex: 1, fontSize: 13 },
  undoButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 },
  pressed: { opacity: 0.7 },
});
