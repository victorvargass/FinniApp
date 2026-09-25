import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { APP_LOCALE, t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import type { AppNotification, RecurringDecisionItem } from '@/lib/types';

function showResult(message: string) {
  showToast(message);
}

function getMovementNoun(item: RecurringDecisionItem): string {
  if (item.isSavingsContribution) return t('recurrence.saving');
  return item.kind === 'expense'
    ? t('navigation.expense').toLowerCase()
    : t('navigation.income').toLowerCase();
}

function notificationIcon(kind: string): keyof typeof Ionicons.glyphMap {
  if (kind === 'movement-reminder') return 'create-outline';
  if (kind.startsWith('recurring-')) return 'repeat-outline';
  if (kind.startsWith('card-')) return 'card-outline';
  if (kind.includes('debt') || kind.includes('installment')) return 'cash-outline';
  if (kind === 'period-ending') return 'calendar-outline';
  return 'notifications-outline';
}

function notificationDate(timestamp: number): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

export default function NotificationsScreen() {
  const {
    appNotifications,
    recurringDecisions,
    approveRecurringOccurrence,
    skipRecurringOccurrence,
    retryRecurringOccurrence,
    setAppNotificationRead,
    deleteAppNotification,
  } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const unread = appNotifications.filter((item) => !item.isRead);
  const read = appNotifications.filter((item) => item.isRead);
  const sections = [
    { title: t('notifications.unreadSection'), data: unread },
    { title: t('notifications.readSection'), data: read },
  ].filter((section) => section.data.length > 0);

  const relatedDecision = (notification: AppNotification) => recurringDecisions.find(
    (item) => item.kind === notification.recurringKind
      && item.recurringId === notification.recurringId
      && item.scheduledDate === notification.recurringDate
  );

  const openNotification = async (notification: AppNotification) => {
    if (!notification.isRead) await setAppNotificationRead(notification.id, true);
    if (relatedDecision(notification)) return;
    if (notification.actionUrl) router.push(notification.actionUrl as never);
  };

  const showNotificationMenu = (notification: AppNotification) => {
    Alert.alert(notification.title, undefined, [
      {
        text: t(notification.isRead ? 'notifications.markUnread' : 'notifications.markRead'),
        onPress: () => { void setAppNotificationRead(notification.id, !notification.isRead); },
      },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            t('notifications.deleteTitle'),
            t('notifications.deleteDescription'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => {
                  void deleteAppNotification(notification.id)
                    .then(() => showResult(t('notifications.deleted')))
                    .catch(() => Alert.alert(t('errors.couldNotDelete'), t('common.tryAgain')));
                },
              },
            ]
          );
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const confirmMovement = async (notification: AppNotification, decision: RecurringDecisionItem) => {
    const noun = getMovementNoun(decision);
    try {
      await approveRecurringOccurrence(decision.kind, decision.recurringId, decision.scheduledDate);
      await setAppNotificationRead(notification.id, true);
      showResult(t('recurrence.createdMovement', { movement: noun }));
      router.replace({
        pathname: '/(tabs)/movements',
        params: { movementType: decision.kind === 'expense' ? 'expenses' : 'incomes' },
      });
    } catch (error) {
      Alert.alert(
        t('recurrence.createErrorTitle', { movement: noun }),
        t('recurrence.pendingAfterError', {
          message: error instanceof Error ? error.message : t('common.tryAgain'),
        })
      );
    }
  };

  const omitMovement = (notification: AppNotification, decision: RecurringDecisionItem) => {
    const noun = getMovementNoun(decision);
    Alert.alert(
      t('recurrence.skipTitle', { movement: noun }),
      t('recurrence.skipDescription', { movement: noun }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.skip'),
          style: 'destructive',
          onPress: () => {
            skipRecurringOccurrence(decision.kind, decision.recurringId, decision.scheduledDate)
              .then(async () => {
                await setAppNotificationRead(notification.id, true);
                showResult(t('recurrence.omittedMovement', { movement: noun }));
              })
              .catch((error) => Alert.alert(
                t('recurrence.skipError'),
                error instanceof Error ? error.message : t('common.tryAgain')
              ));
          },
        },
      ]
    );
  };

  const retryMovement = (notification: AppNotification, decision: RecurringDecisionItem) => {
    const noun = getMovementNoun(decision);
    Alert.alert(
      t('recurrence.retryTitle', { movement: noun }),
      t('recurrence.retryQuestion', { movement: noun, name: decision.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('recurrence.createMovement', { movement: noun }),
          onPress: () => {
            retryRecurringOccurrence(decision.kind, decision.recurringId, decision.scheduledDate)
              .then(async () => {
                await setAppNotificationRead(notification.id, true);
                showResult(t('recurrence.createdMovement', { movement: noun }));
                router.replace({
                  pathname: '/(tabs)/movements',
                  params: { movementType: decision.kind === 'expense' ? 'expenses' : 'incomes' },
                });
              })
              .catch((error) => Alert.alert(
                t('recurrence.createErrorTitle', { movement: noun }),
                t('recurrence.pendingAfterRetryError', {
                  message: error instanceof Error ? error.message : t('common.tryAgain'),
                })
              ));
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, sections.length === 0 && styles.emptyList]}
        ListHeaderComponent={sections.length > 0 ? (
          <ThemedText style={styles.intro}>{t('notifications.centerDescription')}</ThemedText>
        ) : null}
        ListEmptyComponent={(
          <EmptyState
            icon="checkmark-done-circle-outline"
            title={t('notifications.emptyTitle')}
            description={t('notifications.emptyDescription')}
          />
        )}
        renderSectionHeader={({ section }) => (
          <ThemedText type="subtitle" style={styles.sectionTitle}>{section.title}</ThemedText>
        )}
        renderItem={({ item }) => {
          const decision = relatedDecision(item);
          return (
            <ThemedView style={[
              styles.card,
              { borderColor: item.isRead ? colors.border : colors.primary },
            ]}>
              <View style={styles.cardHeader}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  onPress={() => void openNotification(item)}
                  style={({ pressed }) => [styles.notificationMain, pressed && styles.pressed]}>
                  <View style={[
                    styles.iconBox,
                    { backgroundColor: item.isRead ? colors.background : `${colors.primary}18` },
                  ]}>
                    <Ionicons
                      name={notificationIcon(item.kind)}
                      size={21}
                      color={item.isRead ? colors.icon : colors.primary}
                    />
                  </View>
                  <View style={styles.copy}>
                    <View style={styles.titleRow}>
                      {!item.isRead && (
                        <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                      )}
                      <ThemedText type="defaultSemiBold" style={styles.title}>{item.title}</ThemedText>
                    </View>
                    <ThemedText style={styles.body}>{item.body}</ThemedText>
                    <ThemedText style={styles.meta}>{notificationDate(item.scheduledFor)}</ThemedText>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityLabel={t('notifications.optionsFor', { title: item.title })}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => showNotificationMenu(item)}
                  style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
                  <Ionicons name="ellipsis-vertical" size={21} color={colors.icon} />
                </Pressable>
              </View>

              {decision?.status === 'pending' && (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => omitMovement(item, decision)}
                    style={[styles.action, { borderColor: colors.border }]}>
                    <ThemedText type="defaultSemiBold">{t('common.skip')}</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => void confirmMovement(item, decision)}
                    style={[styles.action, styles.primary]}>
                    <ThemedText style={styles.primaryText}>{t('common.confirm')}</ThemedText>
                  </Pressable>
                </View>
              )}
              {decision?.status === 'skipped' && (
                <Pressable
                  onPress={() => retryMovement(item, decision)}
                  style={[styles.singleAction, { borderColor: colors.primary }]}>
                  <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>
                    {t('common.retry')}
                  </ThemedText>
                </Pressable>
              )}
              {!decision && item.actionUrl && (
                <Pressable
                  onPress={() => void openNotification(item)}
                  style={[styles.singleAction, { borderColor: colors.border }]}>
                  <ThemedText type="defaultSemiBold">{t('notifications.viewDetail')}</ThemedText>
                  <Ionicons name="chevron-forward" size={18} color={colors.icon} />
                </Pressable>
              )}
            </ThemedView>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: 20, paddingBottom: 32 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  intro: { opacity: 0.72, lineHeight: 21, marginBottom: 14 },
  sectionTitle: { marginTop: 10, marginBottom: 8 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  notificationMain: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { flex: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  body: { opacity: 0.78, lineHeight: 20 },
  meta: { opacity: 0.58, fontSize: 12, marginTop: 2 },
  menuButton: { padding: 4 },
  pressed: { opacity: 0.65 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, borderWidth: 1, borderRadius: 9, padding: 11, alignItems: 'center' },
  singleAction: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primary: { borderColor: '#0B315B', backgroundColor: '#0B315B' },
  primaryText: { color: '#fff', fontWeight: '700' },
});
