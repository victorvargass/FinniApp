import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SavingsGoalProgress } from '@/components/SavingsGoalProgress';
import { SavingsProgressChart } from '@/components/savings-progress-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useSavingsDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate, formatEventDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { buildSavingsProgressSeries } from '@/lib/savings-progress';
import { showToast } from '@/lib/toast';
import type { SavingsGoalMovement } from '@/lib/types';

function formatIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return formatDate(new Date(year, month - 1, day, 12));
}

export default function SavingsGoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const {
    savingsGoals,
    savingsGroups,
    getSavingsGoalMovements,
    removeSavingsGoalBalanceAdjustment,
  } = useSavingsDatabase();
  const goalId = Number(id);
  const goal = savingsGoals.find((item) => item.id === goalId);
  const group = savingsGroups.find((item) => item.id === goal?.groupId);
  const [movements, setMovements] = useState<SavingsGoalMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [deletingAdjustment, setDeletingAdjustment] = useState(false);
  const progressPoints = useMemo(() => goal
    ? buildSavingsProgressSeries(
      goal.initialAmount,
      goal.balanceDate,
      goal.balanceTime ?? goal.balanceUpdatedTime,
      movements,
      goal.currentAmount
    )
    : [], [goal, movements]);

  useFocusEffect(useCallback(() => {
    if (!goal) return undefined;
    let active = true;
    navigation.setOptions({ title: t('savings.goalDetails') });
    setLoadingMovements(true);
    getSavingsGoalMovements(goal.id)
      .then((items) => { if (active) setMovements(items); })
      .catch(() => { if (active) setMovements([]); })
      .finally(() => { if (active) setLoadingMovements(false); });
    return () => { active = false; };
  }, [getSavingsGoalMovements, goal, navigation]));

  if (!goal) {
    return (
      <ThemedView style={styles.notFound}>
        <ThemedText type="subtitle">{t('savings.missing')}</ThemedText>
        <Pressable onPress={() => router.back()} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
          <ThemedText style={{ color: colors.onPrimary }}>{t('common.goBack')}</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const confirmDeleteBalanceUpdate = (movement: SavingsGoalMovement) => {
    if (movement.kind !== 'adjustment' || deletingAdjustment) return;
    Alert.alert(
      t('savings.deleteBalanceUpdate'),
      t('savings.deleteBalanceUpdateQuestion', { date: formatIsoDate(movement.date) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeletingAdjustment(true);
            try {
              await removeSavingsGoalBalanceAdjustment(goal.id, Math.abs(movement.id));
              setMovements((current) => current.filter((item) => item.id !== movement.id));
              showToast(t('savings.balanceUpdateDeleted'));
            } catch (error) {
              Alert.alert(
                t('errors.couldNotDelete'),
                error instanceof Error ? error.message : t('common.tryAgain')
              );
            } finally {
              setDeletingAdjustment(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView style={[styles.summaryCard, { borderColor: colors.border }]}>
          <View style={styles.titleRow}>
            <View style={[styles.goalIcon, { backgroundColor: `${goal.color}20` }]}>
              <Ionicons name="flag-outline" size={23} color={goal.color} />
            </View>
            <View style={styles.titleCopy}>
              <ThemedText type="subtitle">{goal.name}</ThemedText>
              <ThemedText style={{ color: colors.textSecondary }}>
                {t(goal.status === 'archived' ? 'savings.archived' : 'savings.active')}
              </ThemedText>
            </View>
          </View>
          <SavingsGoalProgress
            color={goal.color}
            currentAmount={goal.currentAmount}
            targetAmount={goal.targetAmount}
          />
          <View style={styles.metadata}>
            <ThemedText style={{ color: colors.textSecondary }}>
              {t('savings.deadlineValue', { date: formatIsoDate(goal.deadline) })}
            </ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>
              {t('savings.groupValue', { group: group?.name ?? t('common.notSpecified') })}
            </ThemedText>
          </View>
        </ThemedView>

        <ThemedView style={[styles.chartCard, { borderColor: colors.border }]}>
          <ThemedText type="subtitle">{t('savings.progressHistory')}</ThemedText>
          <ThemedText style={[styles.chartHint, { color: colors.textSecondary }]}>
            {t('savings.progressHistoryHint')}
          </ThemedText>
          <SavingsProgressChart
            color={goal.color}
            points={progressPoints}
            targetAmount={goal.targetAmount}
          />
        </ThemedView>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/modal/savings-goal-form', params: { id: String(goal.id) } })}
          style={({ pressed }) => [styles.editButton, { borderColor: colors.border }, pressed && styles.pressed]}>
          <Ionicons name="settings-outline" size={19} color={colors.primary} />
          <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>
            {t('savings.editConfiguration')}
          </ThemedText>
        </Pressable>

        {goal.status === 'active' && (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({
                pathname: '/modal/expense-form',
                params: { savingsGoalId: String(goal.id) },
              })}
              style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.action }, pressed && styles.pressed]}>
              <ThemedText type="defaultSemiBold" style={{ color: colors.onPrimary }}>
                {t('savings.enterContribution')}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({
                pathname: '/modal/savings-goal-balance',
                params: { savingsGoalId: String(goal.id) },
              })}
              style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
              <ThemedText type="defaultSemiBold">{t('savings.updateBalance')}</ThemedText>
            </Pressable>
            {goal.allowWithdrawals && goal.currentAmount > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({
                  pathname: '/modal/income-form',
                  params: { savingsGoalId: String(goal.id) },
                })}
                style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
                <ThemedText type="defaultSemiBold">{t('savings.withdraw')}</ThemedText>
              </Pressable>
            )}
            {!goal.allowWithdrawals && (
              <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
                {t('savings.withdrawalsDisabled')}
              </ThemedText>
            )}
          </View>
        )}

        <ThemedView style={[styles.movementsSection, { borderColor: colors.border }]}>
          <ThemedText type="subtitle">{t('savings.movements')}</ThemedText>
          <View style={[styles.movementRow, { borderBottomColor: colors.border }]}>
            <View style={styles.movementCopy}>
              <ThemedText type="defaultSemiBold">{t('savings.reportedStartingBalance')}</ThemedText>
              <ThemedText style={styles.movementMeta}>{formatIsoDate(goal.balanceDate)}</ThemedText>
            </View>
            <ThemedText type="defaultSemiBold">{formatCLP(goal.initialAmount)}</ThemedText>
          </View>
          {loadingMovements ? (
            <ThemedText style={styles.emptyMovements}>{t('savings.loadingMovements')}</ThemedText>
          ) : movements.length === 0 ? (
            <ThemedText style={styles.emptyMovements}>{t('savings.noMovements')}</ThemedText>
          ) : movements.map((movement) => {
            const positive = movement.kind === 'contribution';
            const label = movement.kind === 'contribution'
              ? t('savings.contribution')
              : movement.kind === 'withdrawal'
                ? t('savings.withdrawalToPeriod')
                : movement.kind === 'funded_expense'
                  ? t('savings.fundedExpense')
                  : t('savings.balanceAdjustment');
            const canOpen = movement.expenseId != null || movement.incomeId != null;
            const canDelete = movement.kind === 'adjustment';
            return (
              <Pressable
                accessibilityLabel={canDelete
                  ? t('savings.deleteBalanceUpdateAccessibility', { date: formatIsoDate(movement.date) })
                  : undefined}
                disabled={!canOpen && !canDelete}
                key={movement.id}
                onPress={() => {
                  if (canDelete) confirmDeleteBalanceUpdate(movement);
                  else if (movement.expenseId != null) {
                    router.push({ pathname: '/modal/expense-form', params: { id: String(movement.expenseId) } });
                  } else if (movement.incomeId != null) {
                    router.push({ pathname: '/modal/income-form', params: { id: String(movement.incomeId) } });
                  }
                }}
                style={({ pressed }) => [
                  styles.movementRow,
                  { borderBottomColor: colors.border },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.movementCopy}>
                  <ThemedText type="defaultSemiBold" numberOfLines={1}>{movement.name}</ThemedText>
                  <ThemedText style={styles.movementMeta}>
                    {label} · {formatEventDateTime(movement.date, movement.time)}
                  </ThemedText>
                </View>
                <View style={styles.movementValue}>
                  <ThemedText style={movement.kind === 'adjustment'
                    ? undefined
                    : positive ? styles.positiveMovement : styles.negativeMovement}>
                    {movement.kind === 'adjustment'
                      ? formatCLP(movement.reportedBalance ?? Math.abs(movement.amount))
                      : `${positive ? '+' : '−'}${formatCLP(Math.abs(movement.amount))}`}
                  </ThemedText>
                  {canDelete && <Ionicons name="trash-outline" size={18} color={colors.danger} />}
                </View>
              </Pressable>
            );
          })}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 44, gap: 12 },
  summaryCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, gap: 14 },
  chartCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, gap: 5 },
  chartHint: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  goalIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  titleCopy: { flex: 1, gap: 2 },
  metadata: { gap: 3 },
  editButton: { minHeight: 48, borderWidth: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actions: { gap: 9 },
  primaryButton: { minHeight: 48, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  secondaryButton: { minHeight: 46, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  hint: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  movementsSection: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 3 },
  movementRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 9 },
  movementCopy: { flex: 1, gap: 3 },
  movementValue: { alignItems: 'flex-end', gap: 5 },
  movementMeta: { fontSize: 12, opacity: 0.64 },
  positiveMovement: { color: '#1FAF78', fontWeight: '800' },
  negativeMovement: { color: '#C93F4B', fontWeight: '800' },
  emptyMovements: { paddingVertical: 14, textAlign: 'center', opacity: 0.62 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  pressed: { opacity: 0.7 },
});
