import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ColorPicker } from '@/components/ColorPicker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';

export default function OrganizerFormScreen() {
  const { kind, id } = useLocalSearchParams<{ kind?: string; id?: string }>();
  const savings = kind === 'savings';
  const recordId = id ? Number(id) : null;
  const {
    incomeCategories, savingsGroups, saveIncomeCategory, removeIncomeCategory,
    saveSavingsGroup, removeSavingsGroup,
  } = useDatabase();
  const navigation = useNavigation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const record = (savings ? savingsGroups : incomeCategories).find((item) => item.id === recordId);
  const [name, setName] = useState(record?.name ?? '');
  const [color, setColor] = useState(record?.color ?? (savings ? '#20B9DB' : '#1FAF78'));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(record?.name ?? '');
    setColor(record?.color ?? (savings ? '#20B9DB' : '#1FAF78'));
  }, [recordId, record?.id, record?.name, record?.color, savings]);

  useEffect(() => {
    navigation.setOptions({
      title: savings
        ? t(record ? 'groupings.savingsGroupEdit' : 'groupings.savingsGroupNew')
        : t(record ? 'categories.edit' : 'categories.new'),
    });
  }, [navigation, record, savings]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('categories.missingName'));
      return;
    }
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      Alert.alert(t('common.error'), t('validation.invalidCategoryColor'));
      return;
    }
    setSaving(true);
    try {
      if (savings) await saveSavingsGroup({ name, color }, recordId ?? undefined);
      else await saveIncomeCategory({ name, color }, recordId ?? undefined);
      showToast(t(savings
        ? (record ? 'groupings.savingsGroupUpdated' : 'groupings.savingsGroupCreated')
        : (record ? 'categories.updated' : 'categories.created')));
      router.back();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('errors.couldNotSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (recordId == null) return;
    Alert.alert(
      t(savings ? 'groupings.savingsGroupDelete' : 'categories.delete'),
      t(savings ? 'groupings.savingsGroupDeleteQuestion' : 'groupings.incomeDeleteQuestion'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: async () => {
          setSaving(true);
          try {
            if (savings) await removeSavingsGroup(recordId);
            else await removeIncomeCategory(recordId);
            showToast(t(savings ? 'groupings.savingsGroupDeleted' : 'groupings.incomeCategoryDeleted'));
            router.back();
          } catch (error) {
            Alert.alert(t('common.error'), error instanceof Error ? error.message : t('errors.couldNotDelete'));
          } finally {
            setSaving(false);
          }
        } },
      ]
    );
  };

  if (recordId != null && !record) return null;

  return (
    <ThemedView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="defaultSemiBold">{t('common.name')}</ThemedText>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={name}
          onChangeText={setName}
          placeholder={t(savings ? 'groupings.savingsGroupPlaceholder' : 'incomes.namePlaceholder')}
          placeholderTextColor={colors.icon}
        />
        <ThemedText type="defaultSemiBold">{t('categories.color')}</ThemedText>
        <ColorPicker value={color} onChange={setColor} />
        <Pressable onPress={handleSave} disabled={saving} style={[styles.save, { backgroundColor: colors.primary }, saving && styles.disabled]}>
          <ThemedText style={[styles.saveText, { color: colors.onPrimary }]}>{t(record ? 'common.saveChanges' : 'common.save')}</ThemedText>
        </Pressable>
        {record && (
          <Pressable onPress={handleDelete} disabled={saving} style={[styles.delete, { borderColor: colors.border }, saving && styles.disabled]}>
            <ThemedText style={styles.deleteText}>{t(savings ? 'groupings.savingsGroupDelete' : 'categories.delete')}</ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  input: { minHeight: 54, borderWidth: 1, borderRadius: 11, paddingHorizontal: 15, fontSize: 16, fontFamily: Fonts.regular },
  save: { minHeight: 54, marginTop: 14, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '700' },
  delete: { minHeight: 51, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#C43E50', fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
