import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { CategoryForm } from '@/components/forms';
import { t } from '@/lib/i18n';
import { ThemedView } from '@/components/themed-view';
import { useDatabase } from '@/contexts/DatabaseContext';

export default function CategoryFormModal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { categories } = useDatabase();
  const navigation = useNavigation();

  const category = id ? categories.find((c) => c.id === Number(id)) : undefined;

  useEffect(() => {
    navigation.setOptions({
      title: category ? t('categories.edit') : t('categories.new'),
    });
  }, [navigation, category]);

  return (
    <ThemedView style={styles.container}>
      <CategoryForm category={category} onSuccess={() => router.back()} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
