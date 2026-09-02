import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { IncomeForm } from '@/components/forms';
import { t } from '@/lib/i18n';
import { ThemedView } from '@/components/themed-view';
import { useDatabase } from '@/contexts/DatabaseContext';

export default function IncomeFormModal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { incomes } = useDatabase();
  const navigation = useNavigation();

  const income = id ? incomes.find((i) => i.id === Number(id)) : undefined;

  useEffect(() => {
    navigation.setOptions({
      title: income ? t('incomes.edit') : t('incomes.new'),
    });
  }, [navigation, income]);

  return (
    <ThemedView style={styles.container}>
      <IncomeForm income={income} onSuccess={() => router.back()} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
