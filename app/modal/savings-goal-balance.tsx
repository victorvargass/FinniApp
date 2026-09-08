import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatCLPInput, formatDate, parseNonNegativeAmount, toDateString } from '@/lib/format';
import { t } from '@/lib/i18n';

export default function SavingsGoalBalanceScreen() {
  const { savingsGoalId: savingsGoalIdParam } = useLocalSearchParams<{ savingsGoalId: string }>();
  const savingsGoalId = Number(savingsGoalIdParam);
  const { savingsGoals, addSavingsGoalBalanceAdjustment } = useDatabase();
  const goal = savingsGoals.find((item) => item.id === savingsGoalId);
  const colors = Colors[useColorScheme() ?? 'light'];
  const [balance, setBalance] = useState(goal ? formatCLPInput(goal.currentAmount) : '');
  const [date, setDate] = useState(toDateString(new Date()));
  const [note, setNote] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const parsed = parseNonNegativeAmount(balance);
    if (parsed == null) {
      Alert.alert(t('savings.invalidBalance'), t('savings.invalidBalanceHint'));
      return;
    }
    setSaving(true);
    try {
      await addSavingsGoalBalanceAdjustment(savingsGoalId, {
        balance: parsed,
        date,
        note: note.trim() || null,
      });
      if (Platform.OS === 'android') ToastAndroid.show(t('savings.balanceUpdated'), ToastAndroid.SHORT);
      else Alert.alert(t('common.done'), t('savings.balanceUpdated'));
      router.back();
    } catch (error) {
      Alert.alert(
        t('savings.balanceUpdateError'),
        error instanceof Error ? error.message : t('common.tryAgain')
      );
    } finally {
      setSaving(false);
    }
  };

  if (!goal) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ThemedText>{t('common.loading')}</ThemedText></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText style={styles.description}>{t('savings.updateBalanceHint')}</ThemedText>
        <ThemedView style={styles.card}>
          <View style={styles.row}>
            <ThemedText>{t('savings.currentBalance')}</ThemedText>
            <ThemedText type="defaultSemiBold">{formatCLP(goal.currentAmount)}</ThemedText>
          </View>
          <View style={styles.group}>
            <ThemedText style={styles.label}>{t('savings.newReportedBalance')}</ThemedText>
            <TextInput
              keyboardType="number-pad"
              value={balance}
              onChangeText={(value) => setBalance(formatCLPInput(value))}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
          </View>
          <View style={styles.group}>
            <ThemedText style={styles.label}>{t('common.date')}</ThemedText>
            <Pressable onPress={() => setShowDate(true)} style={[styles.input, styles.dateButton, { borderColor: colors.border }]}>
              <ThemedText>{formatDate(new Date(`${date}T12:00:00`))}</ThemedText>
            </Pressable>
            {showDate && (
              <DateTimePicker
                value={new Date(`${date}T12:00:00`)}
                mode="date"
                onChange={(_, value) => {
                  if (Platform.OS === 'android') setShowDate(false);
                  if (value) setDate(toDateString(value));
                }}
              />
            )}
          </View>
          <View style={styles.group}>
            <ThemedText style={styles.label}>{t('savings.adjustmentNote')}</ThemedText>
            <TextInput
              multiline
              value={note}
              onChangeText={setNote}
              placeholder={t('savings.adjustmentNotePlaceholder')}
              placeholderTextColor={colors.icon}
              style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border }]}
            />
          </View>
        </ThemedView>
        <Pressable disabled={saving} onPress={() => { void save(); }} style={[styles.primary, saving && styles.disabled]}>
          <ThemedText style={styles.primaryText}>{saving ? t('common.saving') : t('savings.saveBalance')}</ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 14 },
  description: { opacity: 0.7, lineHeight: 20 },
  card: { borderRadius: 12, padding: 16, gap: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  group: { gap: 7 },
  label: { fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 16, fontFamily: Fonts.regular },
  dateButton: { justifyContent: 'center' },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  primary: { minHeight: 48, borderRadius: 10, backgroundColor: '#0B315B', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.55 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
