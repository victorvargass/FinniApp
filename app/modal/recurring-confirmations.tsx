import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate } from '@/lib/format';
import { parseIsoDate } from '@/lib/recurrence';
import { t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import type { RecurringDecisionItem } from '@/lib/types';

function showResult(message: string) {
  showToast(message);
}

export default function RecurringConfirmationsScreen() {
  const {
    recurringDecisions,
    approveRecurringOccurrence,
    skipRecurringOccurrence,
    dismissSkippedOccurrence,
    retryRecurringOccurrence,
  } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const pending = recurringDecisions.filter((item) => item.status === 'pending');
  const skipped = recurringDecisions.filter((item) => item.status === 'skipped');
  const sections = [
    { title: t('recurrence.pendingSection'), data: pending },
    { title: t('recurrence.skippedSection'), data: skipped },
  ].filter((section) => section.data.length > 0);

  const confirmMovement = async (item: RecurringDecisionItem) => {
    const noun = item.kind === 'expense' ? t('navigation.expense').toLowerCase() : t('navigation.income').toLowerCase();
    const nounTitle = item.kind === 'expense' ? t('navigation.expense').toLowerCase() : t('navigation.income').toLowerCase();
    try {
      await approveRecurringOccurrence(item.kind, item.recurringId, item.scheduledDate);
      showResult(t('recurrence.createdMovement', { movement: nounTitle }));
      router.replace({
        pathname: '/(tabs)/movements',
        params: { movementType: item.kind === 'expense' ? 'expenses' : 'incomes' },
      });
    } catch (error) {
      Alert.alert(
        t('recurrence.createErrorTitle', { movement: noun }),
        t('recurrence.pendingAfterError', { message: error instanceof Error ? error.message : t('common.tryAgain') })
      );
    }
  };

  const omitMovement = (item: RecurringDecisionItem) => {
    const noun = item.kind === 'expense' ? t('navigation.expense').toLowerCase() : t('navigation.income').toLowerCase();
    const nounTitle = item.kind === 'expense' ? t('navigation.expense').toLowerCase() : t('navigation.income').toLowerCase();
    Alert.alert(
      t('recurrence.skipTitle', { movement: noun }),
      t('recurrence.skipDescription', { movement: noun }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.skip'),
          style: 'destructive',
          onPress: () => {
            skipRecurringOccurrence(item.kind, item.recurringId, item.scheduledDate)
              .then(() => showResult(t('recurrence.omittedMovement', { movement: nounTitle })))
              .catch((error) => {
                Alert.alert(
                  t('recurrence.skipError'),
                  error instanceof Error ? error.message : t('common.tryAgain')
                );
              });
          },
        },
      ]
    );
  };

  const retryMovement = (item: RecurringDecisionItem) => {
    const noun = item.kind === 'expense' ? t('navigation.expense').toLowerCase() : t('navigation.income').toLowerCase();
    const nounTitle = item.kind === 'expense' ? t('navigation.expense').toLowerCase() : t('navigation.income').toLowerCase();
    Alert.alert(
      t('recurrence.retryTitle', { movement: noun }),
      t('recurrence.retryQuestion', { movement: noun, name: item.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('recurrence.createMovement', { movement: noun }),
          onPress: () => {
            retryRecurringOccurrence(item.kind, item.recurringId, item.scheduledDate)
              .then(() => {
                showResult(t('recurrence.createdMovement', { movement: nounTitle }));
                router.replace({
                  pathname: '/(tabs)/movements',
                  params: { movementType: item.kind === 'expense' ? 'expenses' : 'incomes' },
                });
              })
              .catch((error) => {
                Alert.alert(
                  t('recurrence.createErrorTitle', { movement: noun }),
                  t('recurrence.pendingAfterRetryError', { message: error instanceof Error ? error.message : t('common.tryAgain') })
                );
              });
          },
        },
      ]
    );
  };

  const deleteSkippedNotification = (item: RecurringDecisionItem) => {
    const noun = item.kind === 'expense' ? t('navigation.expense').toLowerCase() : t('navigation.income').toLowerCase();
    Alert.alert(
      t('recurrence.deleteNotification'),
      t('recurrence.deleteNotificationDescription', { name: item.name, movement: noun }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            dismissSkippedOccurrence(item.kind, item.recurringId, item.scheduledDate)
              .then(() => showResult(t('recurrence.notificationDeleted')))
              .catch((error) => {
                Alert.alert(
                  t('errors.couldNotDelete'),
                  error instanceof Error ? error.message : t('common.tryAgain')
                );
              });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.kind}-${item.recurringId}-${item.scheduledDate}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={(
          <ThemedText style={styles.empty}>{t('recurrence.decisionsEmpty')}</ThemedText>
        )}
        renderSectionHeader={({ section }) => (
          <ThemedText type="subtitle" style={styles.sectionTitle}>{section.title}</ThemedText>
        )}
        renderItem={({ item }) => (
          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons
                name={item.status === 'pending' ? 'notifications-outline' : 'return-up-back-outline'}
                size={21}
                color={item.status === 'pending' ? colors.primary : colors.icon}
              />
              <View style={styles.copy}>
                <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                <ThemedText style={styles.meta}>
                  {formatCLP(item.amount)} · {formatDate(parseIsoDate(item.scheduledDate))}
                </ThemedText>
              </View>
            </View>
            {item.status === 'pending' ? (
              <View style={styles.actions}>
                <Pressable
                  onPress={() => omitMovement(item)}
                  style={[styles.action, { borderColor: colors.border }]}>
                  <ThemedText type="defaultSemiBold">{t('common.skip')}</ThemedText>
                </Pressable>
                <Pressable onPress={() => void confirmMovement(item)} style={[styles.action, styles.primary]}>
                  <ThemedText style={styles.primaryText}>{t('common.confirm')}</ThemedText>
                </Pressable>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable
                  onPress={() => deleteSkippedNotification(item)}
                  style={[styles.action, { borderColor: '#C93F4B' }]}>
                  <ThemedText type="defaultSemiBold" style={styles.deleteText}>{t('common.delete')}</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => retryMovement(item)}
                  style={[styles.action, { borderColor: colors.primary }]}>
                  <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>{t('common.retry')}</ThemedText>
                </Pressable>
              </View>
            )}
          </ThemedView>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: 20, paddingBottom: 32, gap: 10 },
  intro: { opacity: 0.72, lineHeight: 20, marginBottom: 10 },
  empty: { textAlign: 'center', opacity: 0.6, marginTop: 40 },
  sectionTitle: { marginTop: 10, marginBottom: 4 },
  card: { borderRadius: 12, padding: 14, gap: 12, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  copy: { flex: 1, gap: 3 },
  meta: { opacity: 0.65, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, borderWidth: 1, borderRadius: 9, padding: 11, alignItems: 'center' },
  primary: { borderColor: '#0B315B', backgroundColor: '#0B315B' },
  primaryText: { color: '#fff', fontWeight: '700' },
  deleteText: { color: '#C93F4B' },
});
