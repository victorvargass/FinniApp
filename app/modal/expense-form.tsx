import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ExpenseForm } from '@/components/forms';
import { ThemedText } from '@/components/themed-text';
import { t } from '@/lib/i18n';
import { ThemedView } from '@/components/themed-view';
import { useDatabase } from '@/contexts/DatabaseContext';
import * as db from '@/lib/db';
import type { ExpenseWithCategory } from '@/lib/types';

export default function ExpenseFormModal() {
  const { id, repeatId, creditPaymentTargetId } = useLocalSearchParams<{ id?: string; repeatId?: string; creditPaymentTargetId?: string }>();
  const { expenses } = useDatabase();
  const navigation = useNavigation();
  const sourceId = id ?? repeatId;
  const isRepeating = repeatId != null && id == null;

  const expenseFromSelectedPeriod = sourceId ? expenses.find((e) => e.id === Number(sourceId)) : undefined;
  const [loadedExpense, setLoadedExpense] = useState<ExpenseWithCategory | null>(
    expenseFromSelectedPeriod ?? null
  );
  const [loading, setLoading] = useState(Boolean(sourceId && !expenseFromSelectedPeriod));
  const sourceExpense = expenseFromSelectedPeriod ?? loadedExpense ?? undefined;
  const expense = isRepeating ? undefined : sourceExpense;

  useEffect(() => {
    const expenseId = Number(sourceId);
    if (!sourceId || expenseFromSelectedPeriod || !Number.isInteger(expenseId)) return;
    let cancelled = false;
    setLoading(true);
    db.getExpenseById(expenseId)
      .then((result) => {
        if (!cancelled) setLoadedExpense(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [expenseFromSelectedPeriod, sourceId]);

  useEffect(() => {
    navigation.setOptions({
      title: isRepeating ? t('expenses.repeat') : expense ? t('expenses.edit') : t('expenses.new'),
    });
  }, [navigation, expense, isRepeating]);

  useEffect(() => {
    if (expense?.debtEntryId == null || expense.debtId == null) return;
    router.replace({
      pathname: '/modal/manual-debt-payment',
      params: {
        debtId: String(expense.debtId),
        entryId: String(expense.debtEntryId),
      },
    });
  }, [expense]);

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" />
        <ThemedText>{t('expenses.loading')}</ThemedText>
      </ThemedView>
    );
  }

  if (sourceId && !sourceExpense) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ThemedText>{t('expenses.originMissing')}</ThemedText>
      </ThemedView>
    );
  }

  if (expense?.debtEntryId != null) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" />
        <ThemedText>{t('debts.loadingPayment')}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ExpenseForm
        expense={expense}
        templateExpense={isRepeating ? sourceExpense : undefined}
        initialCreditPaymentTargetId={creditPaymentTargetId ? Number(creditPaymentTargetId) : undefined}
        onSuccess={() => router.back()}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
});
