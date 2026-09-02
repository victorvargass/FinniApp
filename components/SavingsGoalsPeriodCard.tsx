import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formatCLP } from '@/lib/format';
import { APP_LOCALE, t } from '@/lib/i18n';
import type { SavingsGoalPeriodActivity } from '@/lib/types';

type SavingsGoalsPeriodCardProps = {
  items: SavingsGoalPeriodActivity[];
  backgroundColor: string;
  asOfDate: string;
  onManage: () => void;
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
  backgroundColor,
  asOfDate,
  onManage,
}: SavingsGoalsPeriodCardProps) {
  if (items.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText type="subtitle">{t('savings.title')}</ThemedText>
          <ThemedText style={styles.description}>{t('savings.periodProgress')}</ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('savings.manageAccessibility')}
          onPress={onManage}
          style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}>
          <ThemedText style={styles.manageButtonText}>{t('savings.manage')}</ThemedText>
        </Pressable>
      </View>

      <View style={styles.goalList}>
        {items.map((item) => {
          const state = getGoalState(item, asOfDate);
          const progress = item.targetAmount > 0
            ? Math.min(Math.max(item.closingAmount / item.targetAmount, 0), 1)
            : 0;

          return (
            <View key={item.goalId} style={styles.goal}>
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
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    gap: 16,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  description: {
    fontSize: 12,
    opacity: 0.65,
  },
  manageButton: {
    borderRadius: 999,
    backgroundColor: '#0a7ea4',
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
  goalList: {
    gap: 15,
  },
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
});
