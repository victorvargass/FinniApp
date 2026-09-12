import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';
import { t } from '@/lib/i18n';

export type HomeAttentionItem = {
  key: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  tone: 'warning' | 'danger' | 'action';
  onPress: () => void;
};

type HomeOverviewProps = {
  balance: number;
  dailyAvailable: number | null;
  incomeTotal: number;
  expenseTotal: number;
  attentionItems: HomeAttentionItem[];
  showActions: boolean;
  showPayCard: boolean;
  onAddExpense: () => void;
  onAddIncome: () => void;
  onPayCard: () => void;
};

export function HomeOverview({
  balance,
  dailyAvailable,
  incomeTotal,
  expenseTotal,
  attentionItems,
  showActions,
  showPayCard,
  onAddExpense,
  onAddIncome,
  onPayCard,
}: HomeOverviewProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const actions = [
    { key: 'expense', icon: 'arrow-up', label: t('home.addExpense'), onPress: onAddExpense },
    { key: 'income', icon: 'arrow-down', label: t('home.addIncome'), onPress: onAddIncome },
    ...(showPayCard
      ? [{ key: 'payment', icon: 'card-outline' as const, label: t('home.payCard'), onPress: onPayCard }]
      : []),
  ] as const;

  return (
    <View style={styles.container}>
      <ThemedView style={[styles.hero, { backgroundColor: colors.primary }]}>
        <ThemedText style={[styles.eyebrow, { color: colors.onPrimary }]}>
          {t('home.availableThisPeriod')}
        </ThemedText>
        <ThemedText
          accessibilityLabel={t('home.availableAmount', { amount: formatCLP(balance) })}
          style={[styles.balance, { color: balance >= 0 ? colors.onPrimary : colors.danger }]}>
          {formatCLP(balance)}
        </ThemedText>
        {dailyAvailable != null && (
          <View style={[styles.dailyChip, { backgroundColor: `${colors.secondary}22` }]}>
            <Ionicons name="calendar-outline" size={17} color={colors.secondary} />
            <ThemedText style={[styles.dailyText, { color: colors.onPrimary }]}>
              {t('home.dailyAvailable', { amount: formatCLP(dailyAvailable) })}
            </ThemedText>
          </View>
        )}
        <View style={styles.totals}>
          <View style={styles.totalItem}>
            <ThemedText style={[styles.totalLabel, { color: colors.onPrimary }]}>{t('navigation.incomes')}</ThemedText>
            <ThemedText style={[styles.totalValue, { color: colors.success }]}>+{formatCLP(incomeTotal)}</ThemedText>
          </View>
          <View style={[styles.totalDivider, { backgroundColor: `${colors.onPrimary}33` }]} />
          <View style={styles.totalItem}>
            <ThemedText style={[styles.totalLabel, { color: colors.onPrimary }]}>{t('navigation.expenses')}</ThemedText>
            <ThemedText style={[styles.totalValue, { color: colors.expense }]}>-{formatCLP(expenseTotal)}</ThemedText>
          </View>
        </View>
      </ThemedView>

      {showActions && (
        <View style={styles.section}>
          <ThemedText type="subtitle">{t('home.quickActions')}</ThemedText>
          <View style={styles.actions}>
            {actions.map((action, index) => (
            <Pressable
              accessibilityLabel={action.label}
              accessibilityRole="button"
              key={action.key}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.action,
                {
                  backgroundColor: index === 0 ? colors.secondary : colors.surface,
                  borderColor: index === 0 ? colors.secondary : colors.border,
                },
                pressed && styles.pressed,
              ]}>
              <Ionicons
                name={action.icon}
                size={22}
                color={index === 0 ? colors.onSecondary : colors.action}
              />
              <ThemedText
                type="defaultSemiBold"
                style={[styles.actionLabel, index === 0 && { color: colors.onSecondary }]}>
                {action.label}
              </ThemedText>
            </Pressable>
            ))}
          </View>
        </View>
      )}

      {showActions && <View style={styles.section}>
        <ThemedText type="subtitle">{t('home.attention')}</ThemedText>
        {attentionItems.length === 0 ? (
          <ThemedView style={[styles.upToDate, { borderColor: colors.border }]}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <View style={styles.attentionCopy}>
              <ThemedText type="defaultSemiBold">{t('home.upToDate')}</ThemedText>
              <ThemedText style={{ color: colors.textSecondary }}>{t('home.upToDateHint')}</ThemedText>
            </View>
          </ThemedView>
        ) : (
          attentionItems.slice(0, 3).map((item) => {
            const accent = item.tone === 'danger'
              ? colors.danger
              : item.tone === 'warning' ? colors.warning : colors.action;
            return (
              <Pressable
                accessibilityRole="button"
                key={item.key}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.attention,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.attentionIcon, { backgroundColor: `${accent}1F` }]}>
                  <Ionicons name={item.icon} size={22} color={accent} />
                </View>
                <View style={styles.attentionCopy}>
                  <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
                  <ThemedText style={[styles.attentionBody, { color: colors.textSecondary }]}>{item.body}</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.icon} />
              </Pressable>
            );
          })
        )}
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  hero: { borderRadius: 20, padding: 20, gap: 10, elevation: 3 },
  eyebrow: { fontFamily: Fonts.medium, opacity: 0.78 },
  balance: { fontFamily: Fonts.bold, fontSize: 34, lineHeight: 41 },
  dailyChip: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  dailyText: { fontFamily: Fonts.semiBold, fontSize: 13, lineHeight: 18 },
  totals: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  totalItem: { flex: 1, gap: 2 },
  totalDivider: { width: StyleSheet.hairlineWidth, height: 42, marginHorizontal: 16 },
  totalLabel: { fontSize: 12, lineHeight: 17, opacity: 0.72 },
  totalValue: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 21 },
  section: { gap: 10 },
  actions: { flexDirection: 'row', gap: 9 },
  action: { flex: 1, minHeight: 76, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 5, padding: 8 },
  actionLabel: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
  upToDate: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  attention: { borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  attentionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  attentionCopy: { flex: 1, gap: 2 },
  attentionBody: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
