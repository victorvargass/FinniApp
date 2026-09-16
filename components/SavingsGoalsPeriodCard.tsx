import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ExpandableFinanceCard } from '@/components/expandable-finance-card';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';
import { APP_LOCALE, t } from '@/lib/i18n';
import { groupSavingsItems } from '@/lib/savings-grouping';
import type { SavingsGoal, SavingsGoalPeriodActivity, SavingsGroup } from '@/lib/types';

type SavingsGoalsPeriodCardProps = {
  items: SavingsGoalPeriodActivity[];
  goals: SavingsGoal[];
  groups: SavingsGroup[];
  backgroundColor: string;
  asOfDate: string;
  onManage: () => void;
  onOpenGoal: (id: number) => void;
};

function formatDeadline(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getGoalState(item: SavingsGoalPeriodActivity, asOfDate: string) {
  const normalizedStatus = String(item.status).toLowerCase();
  const completed = normalizedStatus === 'completed' || item.closingAmount >= item.targetAmount;
  const archived = normalizedStatus === 'archived';
  const expiredByStatus = ['expired', 'overdue', 'vencida'].includes(normalizedStatus);
  const expired = !completed && !archived && (expiredByStatus || item.deadline < asOfDate);

  if (completed) return { label: t('savings.completed'), style: styles.completedBadge };
  if (expired) return { label: t('savings.expired'), style: styles.expiredBadge };
  if (archived) return { label: t('savings.archived'), style: styles.archivedBadge };
  return null;
}

export function SavingsGoalsPeriodCard({
  items,
  goals,
  groups,
  backgroundColor,
  asOfDate,
  onManage,
  onOpenGoal,
}: SavingsGoalsPeriodCardProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  if (items.length === 0) return null;
  const savedTotal = items.reduce((sum, item) => sum + item.closingAmount, 0);
  const summaryKey = items.length === 1 ? 'savings.homeSummaryOne' : 'savings.homeSummaryOther';
  const groupByGoalId = new Map(goals.map((goal) => [goal.id, goal.groupId]));
  const sections = groupSavingsItems(items, groups,
    (item) => groupByGoalId.get(item.goalId) ?? null, t('common.notSpecified'));

  return (
    <ExpandableFinanceCard
      title={t('savings.title')}
      summary={t(summaryKey, { count: items.length, amount: formatCLP(savedTotal) })}
      backgroundColor={backgroundColor}
      manageAccessibilityLabel={t('savings.detailsAccessibility')}
      onManage={onManage}>
      <View style={styles.goalList}>
        {sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <ThemedText style={styles.sectionLabel}>{section.name}</ThemedText>
            {section.items.map((item) => {
          const state = getGoalState(item, asOfDate);
          const progress = item.targetAmount > 0
            ? Math.min(Math.max(item.closingAmount / item.targetAmount, 0), 1)
            : 0;

          return (
            <Pressable
              key={item.goalId}
              accessibilityRole="button"
              accessibilityLabel={t('savings.openGoalAccessibility', { name: item.goalName })}
              onPress={() => onOpenGoal(item.goalId)}
              style={({ pressed }) => [styles.goal, pressed && styles.pressed]}>
              <View style={styles.goalHeader}>
                <View style={styles.goalTitleRow}>
                  <View style={[styles.goalDot, { backgroundColor: item.goalColor }]} />
                  <ThemedText type="defaultSemiBold" style={styles.goalName} numberOfLines={1}>
                    {item.goalName}
                  </ThemedText>
                  {state && (
                    <View style={[styles.statusBadge, state.style]}>
                      <ThemedText style={styles.statusText}>{state.label}</ThemedText>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={18} color={colors.icon} />
                </View>
                <ThemedText type="defaultSemiBold">
                  {formatCLP(item.closingAmount)} / {formatCLP(item.targetAmount)}
                </ThemedText>
              </View>

              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { backgroundColor: item.goalColor, width: `${progress * 100}%` },
                  ]}
                />
              </View>

              <ThemedText style={styles.goalDetail}>
                {t('savings.deadlineShort', { date: formatDeadline(item.deadline) })}
              </ThemedText>
            </Pressable>
          );
            })}
          </View>
        ))}
      </View>
    </ExpandableFinanceCard>
  );
}

const styles = StyleSheet.create({
  goalList: {
    gap: 15,
  },
  section: { gap: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '700', opacity: 0.72 },
  goal: {
    gap: 8,
  },
  goalHeader: {
    gap: 5,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  goalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  goalName: {
    flex: 1,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  completedBadge: {
    backgroundColor: 'rgba(22,143,91,0.16)',
  },
  expiredBadge: {
    backgroundColor: 'rgba(192,57,43,0.16)',
  },
  archivedBadge: {
    backgroundColor: 'rgba(128,128,128,0.16)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  track: {
    height: 9,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
  goalDetail: {
    fontSize: 11,
    opacity: 0.65,
  },
  pressed: {
    opacity: 0.68,
  },
});
