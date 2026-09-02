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
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { expenses } = useDatabase();
  const navigation = useNavigation();

  const expenseFromSelectedPeriod = id ? expenses.find((e) => e.id === Number(id)) : undefined;
  const [loadedExpense, setLoadedExpense] = useState<ExpenseWithCategory | null>(
    expenseFromSelectedPeriod ?? null
  );
  const [loading, setLoading] = useState(Boolean(id && !expenseFromSelectedPeriod));
  const expense = expenseFromSelectedPeriod ?? loadedExpense ?? undefined;

  useEffect(() => {
    const expenseId = Number(id);
    if (!id || expenseFromSelectedPeriod || !Number.isInteger(expenseId)) return;
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
  }, [expenseFromSelectedPeriod, id]);

  useEffect(() => {
    navigation.setOptions({
      title: expense ? t('expenses.edit') : t('expenses.new'),
    });
  }, [navigation, expense]);

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" />
        <ThemedText>{t('expenses.loading')}</ThemedText>
      </ThemedView>
    );
  }

  if (id && !expense) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ThemedText>{t('expenses.originMissing')}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ExpenseForm expense={expense} onSuccess={() => router.back()} />
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
