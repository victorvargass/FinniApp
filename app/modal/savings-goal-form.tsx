import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColorPicker } from '@/components/ColorPicker';
import { SavingsGoalProgress } from '@/components/SavingsGoalProgress';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate, parseAmount, toDateString } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { NewSavingsGoal, SavingsGoalMovement } from '@/lib/types';

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    ? date
    : null;
}

function parseDate(value: string): Date {
  return parseIsoDate(value) ?? getDefaultDeadline();
}

function formatCreatedAt(value: string): string {
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return formatDate(date);
  const fallback = parseIsoDate(value.slice(0, 10));
  return fallback ? formatDate(fallback) : t('common.dateUnavailable');
}

function formatMovementDate(value: string): string {
  const date = parseIsoDate(value);
  return date ? formatDate(date) : t('common.dateUnavailable');
}

function getDefaultDeadline(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  date.setHours(12, 0, 0, 0);
  return date;
}

function parseInitialAmount(value: string): number | null {
  const cleaned = value.replace(/[.,\s]/g, '');
  if (!cleaned) return 0;
  if (!/^\d+$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function showToast(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(t('common.done'), message);
}

export default function SavingsGoalFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colors = Colors[useColorScheme() ?? 'light'];
  const {
    savingsGoals,
    addSavingsGoal,
    editSavingsGoal,
    setSavingsGoalStatus,
    removeSavingsGoal,
    getSavingsGoalMovements,
  } = useDatabase();

  const goalId = id ? Number(id) : null;
  const goal = goalId != null
    ? savingsGoals.find((item) => item.id === goalId)
    : undefined;
  const [name, setName] = useState(goal?.name ?? '');
  const [targetText, setTargetText] = useState(
    goal ? String(goal.targetAmount) : ''
  );
  const [initialText, setInitialText] = useState(
    goal ? String(goal.initialAmount) : '0'
  );
  const [deadline, setDeadline] = useState(
    goal ? parseDate(goal.deadline) : getDefaultDeadline()
  );
  const [color, setColor] = useState(goal?.color ?? '#27ae60');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [movements, setMovements] = useState<SavingsGoalMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(Boolean(goal));

  useEffect(() => {
    navigation.setOptions({
      title: goal ? t('savings.editGoal') : t('savings.newGoal'),
    });
  }, [goal, navigation]);

  useEffect(() => {
    if (!goal) return;
    let cancelled = false;
    setLoadingMovements(true);
    getSavingsGoalMovements(goal.id)
      .then((items) => {
        if (!cancelled) setMovements(items);
      })
      .catch(() => {
        if (!cancelled) setMovements([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMovements(false);
      });
    return () => { cancelled = true; };
  }, [getSavingsGoalMovements, goal]);

  if (id && !goal) {
    return (
      <ThemedView style={styles.notFound}>
        <ThemedText type="subtitle">{t('savings.missing')}</ThemedText>
        <Pressable onPress={() => router.back()} style={styles.primaryButton}>
          <ThemedText style={styles.primaryButtonText}>{t('common.goBack')}</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('savings.missingName'), t('savings.missingNameHint'));
      return;
    }

    const targetAmount = parseAmount(targetText);
    if (targetAmount == null || targetAmount <= 0) {
      Alert.alert(t('savings.invalidAmount'), t('savings.invalidTargetHint'));
      return;
    }

    const initialAmount = parseInitialAmount(initialText);
    if (initialAmount == null) {
      Alert.alert(t('savings.invalidAmount'), t('savings.invalidInitialHint'));
      return;
    }
    if (initialAmount > targetAmount) {
      Alert.alert(
        t('savings.initialTooHigh'),
        t('savings.initialTooHighHint')
      );
      return;
    }
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      Alert.alert(t('savings.invalidColor'), t('savings.invalidColorHint'));
      return;
    }

    const data: NewSavingsGoal = {
      name: name.trim(),
      targetAmount,
      initialAmount,
      deadline: toDateString(deadline),
      color: color.toLowerCase(),
    };

    setSaving(true);
    try {
      if (goal) {
        await editSavingsGoal(goal.id, data);
        showToast(t('savings.updated'));
      } else {
        await addSavingsGoal(data);
        showToast(t('savings.created'));
      }
      router.back();
    } catch (error) {
      Alert.alert(
        t('errors.couldNotSave'),
        error instanceof Error ? error.message : t('common.tryAgain')
      );
    } finally {
      setSaving(false);
    }
  };

  const applyStatusChange = async () => {
    if (!goal) return;
    const nextStatus = goal.status === 'archived' ? 'active' : 'archived';
    setSaving(true);
    try {
      await setSavingsGoalStatus(goal.id, nextStatus);
      showToast(nextStatus === 'archived' ? t('savings.archivedToast') : t('savings.reactivated'));
      router.back();
    } catch (error) {
      Alert.alert(
        nextStatus === 'archived' ? t('savings.archiveError') : t('savings.reactivateError'),
        error instanceof Error ? error.message : t('common.tryAgain')
      );
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = () => {
    if (!goal || saving) return;
    if (goal.status === 'archived') {
      void applyStatusChange();
      return;
    }
    Alert.alert(
      t('savings.archiveGoal'),
      t('savings.archiveDescription'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('savings.archiveAction'), onPress: () => { void applyStatusChange(); } },
      ]
    );
  };

  const confirmDelete = () => {
    if (!goal || saving) return;
    Alert.alert(
      t('savings.deleteGoal'),
      t('savings.deleteQuestion', { name: goal.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await removeSavingsGoal(goal.id);
              showToast(t('savings.deleted'));
              router.back();
            } catch (error) {
              Alert.alert(
                t('errors.couldNotDelete'),
                error instanceof Error ? error.message : t('common.tryAgain')
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.shell}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {goal && (
          <ThemedView style={[styles.progressCard, { borderColor: colors.border }]}>
            <ThemedText type="defaultSemiBold">{t('savings.currentProgress')}</ThemedText>
            <SavingsGoalProgress
              color={goal.color}
              currentAmount={goal.currentAmount}
              targetAmount={goal.targetAmount}
            />
            {goal.status === 'active' && goal.currentAmount > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({
                  pathname: '/modal/income-form',
                  params: { savingsGoalId: String(goal.id) },
                })}
                style={({ pressed }) => [
                  styles.withdrawButton,
                  { borderColor: colors.border },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="defaultSemiBold">{t('savings.withdraw')}</ThemedText>
              </Pressable>
            )}
          </ThemedView>
        )}

        {goal && (
          <View style={[styles.movementsSection, { borderColor: colors.border }]}>
            <ThemedText type="subtitle">{t('savings.movements')}</ThemedText>
            {goal.initialAmount > 0 && (
              <View style={[styles.movementRow, { borderBottomColor: colors.border }]}>
                <View style={styles.movementCopy}>
                  <ThemedText type="defaultSemiBold">{t('savings.initialAmount')}</ThemedText>
                  <ThemedText style={styles.movementMeta}>
                    {formatCreatedAt(goal.createdAt)}
                  </ThemedText>
                </View>
                <ThemedText style={styles.positiveMovement}>+{formatCLP(goal.initialAmount)}</ThemedText>
              </View>
            )}
            {loadingMovements ? (
              <ThemedText style={styles.emptyMovements}>{t('savings.loadingMovements')}</ThemedText>
            ) : movements.length === 0 && goal.initialAmount === 0 ? (
              <ThemedText style={styles.emptyMovements}>{t('savings.noMovements')}</ThemedText>
            ) : (
              movements.map((movement) => {
                const contribution = movement.kind === 'contribution';
                const label = contribution
                  ? t('savings.contribution')
                  : movement.kind === 'withdrawal'
                    ? t('savings.withdrawalToPeriod')
                    : t('savings.fundedExpense');
                const canOpen = movement.expenseId != null || movement.incomeId != null;
                return (
                  <Pressable
                    key={movement.id}
                    disabled={!canOpen}
                    onPress={() => {
                      if (movement.expenseId != null) {
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
                        {label} · {formatMovementDate(movement.date)}
                      </ThemedText>
                    </View>
                    <ThemedText style={contribution ? styles.positiveMovement : styles.negativeMovement}>
                      {contribution ? '+' : '−'}{formatCLP(movement.amount)}
                    </ThemedText>
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        <ThemedText style={styles.label}>{t('common.name')}</ThemedText>
        <TextInput
          autoCapitalize="sentences"
          maxLength={80}
          onChangeText={setName}
          placeholder={t('savings.namePlaceholder')}
          placeholderTextColor={colors.icon}
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          value={name}
        />

        <ThemedText style={styles.label}>{t('savings.targetAmount')}</ThemedText>
        <TextInput
          keyboardType="number-pad"
          onChangeText={setTargetText}
          placeholder={t('savings.targetPlaceholder')}
          placeholderTextColor={colors.icon}
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          value={targetText}
        />

        <ThemedText style={styles.label}>{t('savings.initialAmountClp')}</ThemedText>
        <TextInput
          keyboardType="number-pad"
          onChangeText={setInitialText}
          placeholder="0"
          placeholderTextColor={colors.icon}
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          value={initialText}
        />
        <ThemedText style={styles.hint}>
          {t('savings.initialHint')}
        </ThemedText>

        <ThemedText style={styles.label}>{t('savings.deadline')}</ThemedText>
        <Pressable
          accessibilityLabel={t('savings.deadlineValue', { date: formatDate(deadline) })}
          accessibilityRole="button"
          onPress={() => setShowDatePicker(true)}
          style={({ pressed }) => [
            styles.dateButton,
            { borderColor: colors.border },
            pressed && styles.pressed,
          ]}>
          <ThemedText>{formatDate(deadline)}</ThemedText>
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={goal ? undefined : new Date()}
            mode="date"
            onChange={(_, selectedDate) => {
              if (Platform.OS === 'android') setShowDatePicker(false);
              if (selectedDate) {
                selectedDate.setHours(12, 0, 0, 0);
                setDeadline(selectedDate);
              }
            }}
            value={deadline}
          />
        )}
        {Platform.OS === 'ios' && showDatePicker && (
          <Pressable onPress={() => setShowDatePicker(false)} style={styles.doneDate}>
            <ThemedText type="link">{t('common.done')}</ThemedText>
          </Pressable>
        )}

        <ThemedText style={styles.label}>{t('categories.color')}</ThemedText>
        <ColorPicker value={color} onChange={setColor} />

        {goal && (
          <View style={[styles.management, { borderTopColor: colors.border }]}>
            <ThemedText type="subtitle">{t('savings.manageGoal')}</ThemedText>
            <ThemedText style={styles.hint}>
              {t('savings.archiveHint')}
            </ThemedText>
            <Pressable
              disabled={saving}
              onPress={changeStatus}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: colors.border },
                pressed && styles.pressed,
                saving && styles.disabled,
              ]}>
              <ThemedText type="defaultSemiBold">
                {goal.status === 'archived' ? t('savings.reactivateGoal') : t('savings.archiveGoal')}
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={confirmDelete}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.pressed,
                saving && styles.disabled,
              ]}>
              <ThemedText style={styles.deleteText}>{t('savings.deleteGoal')}</ThemedText>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}>
        <Pressable
          disabled={saving}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            saving && styles.disabled,
          ]}>
          <ThemedText style={styles.primaryButtonText}>
            {goal ? t('common.saveChanges') : t('common.save')}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 10,
  },
  progressCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 11,
    marginBottom: 6,
  },
  movementsSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 3,
    marginBottom: 4,
  },
  movementRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 9,
  },
  movementCopy: { flex: 1, gap: 3 },
  movementMeta: { fontSize: 12, opacity: 0.64 },
  positiveMovement: { color: '#168f5b', fontWeight: '800' },
  negativeMovement: { color: '#c0392b', fontWeight: '800' },
  emptyMovements: { paddingVertical: 14, textAlign: 'center', opacity: 0.62 },
  withdrawButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  label: {
    fontWeight: '700',
    marginTop: 7,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.62,
  },
  dateButton: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
  },
  doneDate: {
    alignSelf: 'flex-end',
    paddingVertical: 5,
  },
  management: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 18,
    paddingTop: 18,
    gap: 10,
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  deleteButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  deleteText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 18,
    backgroundColor: '#0a7ea4',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.55,
  },
});
