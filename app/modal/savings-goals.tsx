import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/floating-action-button';
import { SavingsGoalProgress } from '@/components/SavingsGoalProgress';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP, formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { SavingsGoal } from '@/lib/types';

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function getDeadlineCopy(goal: SavingsGoal): { text: string; overdue: boolean } {
  const deadline = parseDate(goal.deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue =
    goal.status === 'active' &&
    goal.currentAmount < goal.targetAmount &&
    deadline.getTime() < today.getTime();

  return {
    text: t(overdue ? 'savings.expiredValue' : 'savings.deadlineValue', { date: formatDate(deadline) }),
    overdue,
  };
}

function GoalCard({ goal }: { goal: SavingsGoal }) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const deadline = getDeadlineCopy(goal);
  const achieved = goal.currentAmount >= goal.targetAmount;
  const statusLabel = goal.status === 'archived'
    ? t('savings.archived')
    : achieved
      ? t('savings.achieved')
      : t('savings.active');

  return (
    <Pressable
      accessibilityLabel={t('savings.editAccessibility', { name: goal.name })}
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: '/modal/savings-goal-form',
          params: { id: String(goal.id) },
        })
      }
      style={({ pressed }) => [pressed && styles.pressed]}>
      <ThemedView style={[styles.card, goal.status === 'archived' && styles.archivedCard]}>
        <View style={styles.cardHeader}>
          <View style={[styles.goalIcon, { backgroundColor: `${goal.color}20` }]}>
            <Ionicons name="flag-outline" size={21} color={goal.color} />
          </View>
          <View style={styles.cardCopy}>
            <ThemedText type="subtitle" numberOfLines={1}>{goal.name}</ThemedText>
            <ThemedText style={[styles.deadline, deadline.overdue && styles.overdue]}>
              {deadline.text}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={21} color={colors.icon} />
        </View>

        <SavingsGoalProgress
          color={goal.color}
          currentAmount={goal.currentAmount}
          targetAmount={goal.targetAmount}
        />

        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusBadge,
              achieved && goal.status !== 'archived'
                ? styles.completedBadge
                : goal.status === 'archived'
                  ? styles.archivedBadge
                  : { backgroundColor: `${colors.primary}18` },
            ]}>
            <ThemedText
              style={[
                styles.statusText,
                achieved && goal.status !== 'archived'
                  ? styles.completedText
                  : goal.status === 'archived'
                    ? styles.archivedText
                    : { color: colors.primary },
              ]}>
              {statusLabel}
            </ThemedText>
          </View>
        </View>
      </ThemedView>
    </Pressable>
  );
}

export default function SavingsGoalsScreen() {
  const { savingsGoals } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [showArchived, setShowArchived] = useState(false);

  const currentGoals = useMemo(
    () => savingsGoals.filter((goal) => goal.status !== 'archived'),
    [savingsGoals]
  );
  const archivedGoals = useMemo(
    () => savingsGoals.filter((goal) => goal.status === 'archived'),
    [savingsGoals]
  );
  const visibleGoals = showArchived ? savingsGoals : currentGoals;
  const totalSaved = savingsGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const totalTarget = currentGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{t('savings.title')}</ThemedText>
        <ThemedText style={styles.intro}>
          {t('savings.intro')}
        </ThemedText>

        <ThemedView style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <ThemedText style={styles.summaryLabel}>{t('savings.accumulated')}</ThemedText>
            <ThemedText type="subtitle" style={styles.savedAmount}>
              {formatCLP(totalSaved)}
            </ThemedText>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <ThemedText style={styles.summaryLabel}>{t('savings.combinedTarget')}</ThemedText>
            <ThemedText type="subtitle">{formatCLP(totalTarget)}</ThemedText>
          </View>
        </ThemedView>

        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle">
            {t(showArchived ? 'savings.allGoals' : 'savings.currentGoals')}
          </ThemedText>
          {archivedGoals.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowArchived((current) => !current)}
              style={({ pressed }) => [styles.archiveToggle, pressed && styles.pressed]}>
              <ThemedText style={[styles.archiveToggleText, { color: colors.primary }]}>
                {showArchived ? t('savings.hideArchived') : t('savings.viewArchived', { count: archivedGoals.length })}
              </ThemedText>
            </Pressable>
          )}
        </View>

        {visibleGoals.length === 0 ? (
          <ThemedView style={styles.empty}>
            <Ionicons name="flag-outline" size={38} color={colors.icon} />
            <ThemedText type="defaultSemiBold">{t('savings.noActiveGoals')}</ThemedText>
            <ThemedText style={styles.emptyCopy}>
              {t('savings.emptyHint')}
            </ThemedText>
          </ThemedView>
        ) : (
          <View style={styles.goals}>
            {visibleGoals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
          </View>
        )}
      </ScrollView>

      <FloatingActionButton
        accessibilityLabel={t('savings.createGoal')}
        avoidBottomInset
        href="/modal/savings-goal-form"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 110,
    gap: 13,
  },
  intro: {
    lineHeight: 20,
    opacity: 0.68,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    padding: 16,
    gap: 14,
    elevation: 2,
  },
  summaryItem: {
    flex: 1,
    gap: 5,
  },
  summaryLabel: {
    fontSize: 12,
    opacity: 0.65,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
  },
  savedAmount: {
    color: '#1FAF78',
  },
  sectionHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  archiveToggle: {
    paddingVertical: 7,
  },
  archiveToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  goals: {
    gap: 11,
  },
  card: {
    borderRadius: 12,
    padding: 15,
    gap: 14,
    elevation: 2,
  },
  archivedCard: {
    opacity: 0.72,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 3,
  },
  deadline: {
    fontSize: 12,
    opacity: 0.62,
  },
  overdue: {
    color: '#C93F4B',
    fontWeight: '700',
    opacity: 1,
  },
  statusRow: {
    flexDirection: 'row',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  completedBadge: {
    backgroundColor: '#1FAF7818',
  },
  archivedBadge: {
    backgroundColor: '#60758E26',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  completedText: {
    color: '#1FAF78',
  },
  archivedText: {
    color: '#60758E',
  },
  empty: {
    borderRadius: 12,
    alignItems: 'center',
    padding: 28,
    gap: 8,
  },
  emptyCopy: {
    maxWidth: 280,
    textAlign: 'center',
    lineHeight: 19,
    opacity: 0.62,
  },
  pressed: {
    opacity: 0.68,
  },
});
