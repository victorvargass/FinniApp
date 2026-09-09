import { useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, ToastAndroid } from 'react-native';

import { ColorPicker } from '@/components/ColorPicker';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLPInput, parseAmount } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { Category } from '@/lib/types';

import { styles } from './styles';

type CategoryFormProps = {
  category?: Category;
  onSuccess: () => void;
};

export function CategoryForm({ category, onSuccess }: CategoryFormProps) {
  const { addCategory, editCategory, getCategoryExpenseCount, removeCategory } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isSavingsCategory = category?.purpose === 'savings';
  const isProtectedCategory = isSavingsCategory || category?.systemKey != null;

  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? '#0B315B');
  const [limitText, setLimitText] = useState(
    category?.periodLimit != null ? formatCLPInput(category.periodLimit) : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('categories.missingName'));
      return;
    }
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      Alert.alert(t('common.error'), t('validation.invalidCategoryColor'));
      return;
    }

    const periodLimit = isProtectedCategory ? null : limitText.trim() ? parseAmount(limitText) : null;
    if (!isProtectedCategory && limitText.trim() && periodLimit == null) {
      Alert.alert(t('common.error'), t('validation.invalidCategoryLimit'));
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: isProtectedCategory && category ? category.name : name.trim(),
        color,
        periodLimit,
      };
      if (category) {
        await editCategory(category.id, data);
        if (Platform.OS === 'android') {
          ToastAndroid.show(t('categories.updated'), ToastAndroid.SHORT);
        } else {
          Alert.alert(t('common.saved'), t('categories.updated'));
        }
      } else {
        await addCategory(data);
        if (Platform.OS === 'android') {
          ToastAndroid.show(t('categories.created'), ToastAndroid.SHORT);
        } else {
          Alert.alert(t('common.saved'), t('categories.created'));
        }
      }
      onSuccess();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('errors.couldNotSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!category || saving) return;

    let expenseCount: number;
    try {
      expenseCount = await getCategoryExpenseCount(category.id);
    } catch {
      Alert.alert(t('common.error'), t('categories.usageCheckError'));
      return;
    }

    const hasExpenses = expenseCount > 0;
    const message = hasExpenses
      ? t('categories.deleteWithExpenses', {
          count: expenseCount,
          expenseLabel: expenseCount === 1 ? t('categories.associatedExpense') : t('categories.associatedExpenses'),
          name: category.name,
          result: expenseCount === 1 ? t('categories.expenseWillRemain') : t('categories.expensesWillRemain'),
        })
      : t('categories.deleteQuestion', { name: category.name });

    Alert.alert(
      t('categories.delete'),
      message,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: hasExpenses ? t('categories.deleteAnyway') : t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await removeCategory(category.id, hasExpenses);
              const successMessage = hasExpenses
                ? t('categories.deletedDetached')
                : t('categories.deleted');
              if (Platform.OS === 'android') ToastAndroid.show(successMessage, ToastAndroid.LONG);
              else Alert.alert(t('common.deleted'), successMessage);
              onSuccess();
            } catch (error) {
              Alert.alert(t('common.error'), error instanceof Error ? error.message : t('errors.couldNotDelete'));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedText style={styles.label}>{t('common.name')}</ThemedText>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={name}
        onChangeText={setName}
        editable={!isProtectedCategory}
        placeholder={t('categories.placeholderName')}
        placeholderTextColor={colors.icon}
      />
      {isProtectedCategory && (
        <ThemedText style={styles.savingsHint}>
          {t(category?.systemKey === 'credit_payment'
            ? 'categories.creditPaymentReservedHint'
            : 'categories.savingsReservedHint')}
        </ThemedText>
      )}

      <ThemedText style={styles.label}>{t('categories.color')}</ThemedText>
      <ColorPicker value={color} onChange={setColor} />

      {!isProtectedCategory && (
        <>
          <ThemedText style={styles.label}>{t('categories.limitOptional')}</ThemedText>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
            value={limitText}
            onChangeText={(value) => setLimitText(formatCLPInput(value))}
            placeholder={t('categories.placeholderLimit')}
            placeholderTextColor={colors.icon}
            keyboardType="number-pad"
          />
        </>
      )}

      <Pressable
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}>
        <ThemedText style={styles.buttonText}>
          {category ? t('common.update') : t('common.save')}
        </ThemedText>
      </Pressable>
      {category && !isProtectedCategory && (
        <Pressable
          style={[styles.deleteButton, saving && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={saving}>
          <ThemedText style={styles.deleteButtonText}>{t('categories.delete')}</ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
}
