import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { IncomeForm } from '@/components/forms';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useDatabase } from '@/contexts/DatabaseContext';
import * as db from '@/lib/db';
import { t } from '@/lib/i18n';
import type { Income } from '@/lib/types';

export default function IncomeFormModal() {
  const { id, repeatId, savingsGoalId } = useLocalSearchParams<{ id?: string; repeatId?: string; savingsGoalId?: string }>();
  const { incomes } = useDatabase();
  const navigation = useNavigation();
  const sourceId = id ?? repeatId;
  const isRepeating = repeatId != null && id == null;

  const incomeFromSelectedPeriod = sourceId ? incomes.find((i) => i.id === Number(sourceId)) : undefined;
  const [loadedIncome, setLoadedIncome] = useState<Income | null>(incomeFromSelectedPeriod ?? null);
  const [loading, setLoading] = useState(Boolean(sourceId && !incomeFromSelectedPeriod));
  const sourceIncome = incomeFromSelectedPeriod ?? loadedIncome ?? undefined;
  const income = isRepeating ? undefined : sourceIncome;
  const requestedSavingsGoalId = Number(savingsGoalId);

  useEffect(() => {
    const incomeId = Number(sourceId);
    if (!sourceId || incomeFromSelectedPeriod || !Number.isInteger(incomeId)) return;
    let cancelled = false;
    setLoading(true);
    db.getIncomeById(incomeId)
      .then((result) => {
        if (!cancelled) setLoadedIncome(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [incomeFromSelectedPeriod, sourceId]);

  useEffect(() => {
    navigation.setOptions({
      title: isRepeating
        ? t('incomes.repeat')
        : income
        ? income.savingsGoalId != null ? t('savings.editWithdrawal') : t('incomes.edit')
        : Number.isInteger(requestedSavingsGoalId) ? t('savings.withdraw') : t('incomes.new'),
    });
  }, [navigation, income, isRepeating, requestedSavingsGoalId]);

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" />
        <ThemedText>{t('incomes.loading')}</ThemedText>
      </ThemedView>
    );
  }

  if (sourceId && !sourceIncome) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ThemedText>{t('database.incomeMissing')}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <IncomeForm
        income={income}
        templateIncome={isRepeating ? sourceIncome : undefined}
        initialSavingsGoalId={Number.isInteger(requestedSavingsGoalId) ? requestedSavingsGoalId : null}
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
