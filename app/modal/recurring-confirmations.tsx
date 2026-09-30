import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { usePreferenceDatabase, useRecurrenceDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { APP_LOCALE, t } from '@/lib/i18n';
import { localNotificationDateKey, notificationDayBucket } from '@/lib/notification-inbox';
import { showToast } from '@/lib/toast';
import type { AppNotification, RecurringDecisionItem } from '@/lib/types';

type NotificationListItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'notification'; key: string; notification: AppNotification };

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

function notificationTime(timestamp: number): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function notificationDayLabel(timestamp: number): string {
  const bucket = notificationDayBucket(timestamp);
  if (bucket === 'today') return t('notifications.today');
  if (bucket === 'yesterday') return t('notifications.yesterday');
  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function groupNotificationsByDay(
  notifications: AppNotification[],
  sectionKey: 'unread' | 'read'
): NotificationListItem[] {
  const rows: NotificationListItem[] = [];
  let previousDay = '';

  notifications.forEach((notification) => {
    const day = localNotificationDateKey(notification.scheduledFor);
    if (day !== previousDay) {
      rows.push({
        type: 'day',
        key: `day-${sectionKey}-${day}`,
        label: notificationDayLabel(notification.scheduledFor),
      });
      previousDay = day;
    }
    rows.push({
      type: 'notification',
      key: `notification-${notification.id}`,
      notification,
    });
  });

  return rows;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const {
    recurringDecisions,
    approveRecurringOccurrence,
    skipRecurringOccurrence,
    retryRecurringOccurrence,
  } = useRecurrenceDatabase();
  const {
    appNotifications,
    setAppNotificationRead,
    deleteAppNotification,
  } = usePreferenceDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [selectedNotificationId, setSelectedNotificationId] = useState<number | null>(null);
  const selectedNotification = appNotifications.find((item) => item.id === selectedNotificationId) ?? null;
  const unread = appNotifications.filter((item) => !item.isRead);
  const read = appNotifications.filter((item) => item.isRead);
  const sections = [
    { title: t('notifications.unreadSection'), data: groupNotificationsByDay(unread, 'unread') },
    { title: t('notifications.readSection'), data: groupNotificationsByDay(read, 'read') },
  ].filter((section) => section.data.length > 0);

  const relatedDecision = (notification: AppNotification) => recurringDecisions.find(
    (item) => item.kind === notification.recurringKind
      && item.recurringId === notification.recurringId
      && item.scheduledDate === notification.recurringDate
  );
  const selectedDecision = selectedNotification ? relatedDecision(selectedNotification) : undefined;

  const openDetails = (notification: AppNotification) => {
    setSelectedNotificationId(notification.id);
    if (!notification.isRead) {
      void setAppNotificationRead(notification.id, true)
        .catch(() => Alert.alert(t('errors.couldNotChange'), t('common.tryAgain')));
    }
  };

  const goToAction = async (notification: AppNotification) => {
    if (!notification.isRead) await setAppNotificationRead(notification.id, true);
    setSelectedNotificationId(null);
    if (notification.actionUrl) router.push(notification.actionUrl as never);
  };

  const confirmDelete = (notification: AppNotification) => {
    Alert.alert(t('notifications.deleteTitle'), t('notifications.deleteDescription'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void deleteAppNotification(notification.id)
            .then(() => {
              if (selectedNotificationId === notification.id) setSelectedNotificationId(null);
              showToast(t('notifications.deleted'));
            })
            .catch(() => Alert.alert(t('errors.couldNotDelete'), t('common.tryAgain')));
        },
      },
    ]);
  };

  const markUnread = async (notification: AppNotification) => {
    try {
      await setAppNotificationRead(notification.id, false);
      setSelectedNotificationId(null);
    } catch {
      Alert.alert(t('errors.couldNotChange'), t('common.tryAgain'));
    }
  };

  const confirmMovement = async (notification: AppNotification, decision: RecurringDecisionItem) => {
    const noun = getMovementNoun(decision);
    try {
      await approveRecurringOccurrence(decision.kind, decision.recurringId, decision.scheduledDate);
      await setAppNotificationRead(notification.id, true);
      setSelectedNotificationId(null);
      showToast(t('recurrence.createdMovement', { movement: noun }));
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
            void skipRecurringOccurrence(decision.kind, decision.recurringId, decision.scheduledDate)
              .then(async () => {
                await setAppNotificationRead(notification.id, true);
                setSelectedNotificationId(null);
                showToast(t('recurrence.omittedMovement', { movement: noun }));
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
            void retryRecurringOccurrence(decision.kind, decision.recurringId, decision.scheduledDate)
              .then(async () => {
                await setAppNotificationRead(notification.id, true);
                setSelectedNotificationId(null);
                showToast(t('recurrence.createdMovement', { movement: noun }));
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
        keyExtractor={(item) => item.key}
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
        renderItem={({ item }) => item.type === 'day' ? (
          <ThemedText style={[styles.dayLabel, { color: colors.textSecondary }]}>
            {item.label}
          </ThemedText>
        ) : (
          <ThemedView style={[styles.row, { borderColor: colors.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.notification.title}
              onPress={() => openDetails(item.notification)}
              style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
              <View style={[
                styles.iconBox,
                { backgroundColor: item.notification.isRead ? colors.background : `${colors.primary}18` },
              ]}>
                <Ionicons
                  name={notificationIcon(item.notification.kind)}
                  size={20}
                  color={item.notification.isRead ? colors.icon : colors.primary}
                />
              </View>
              {!item.notification.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
              <View style={styles.rowCopy}>
                <ThemedText type="defaultSemiBold" numberOfLines={2}>
                  {item.notification.title}
                </ThemedText>
                <ThemedText style={[styles.rowTime, { color: colors.textSecondary }]}>
                  {notificationTime(item.notification.scheduledFor)}
                </ThemedText>
              </View>
            </Pressable>
            <Pressable
              accessibilityLabel={t('common.delete')}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => confirmDelete(item.notification)}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </ThemedView>
        )}
      />

      <Modal
        animationType="slide"
        transparent
        visible={selectedNotification != null}
        onRequestClose={() => setSelectedNotificationId(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setSelectedNotificationId(null)} />
          {selectedNotification && (
            <ThemedView style={[
              styles.sheet,
              { borderColor: colors.border, paddingBottom: Math.max(insets.bottom + 18, 30) },
            ]}>
              <View style={styles.sheetHeader}>
                <View style={[styles.detailIcon, { backgroundColor: `${colors.primary}18` }]}>
                  <Ionicons name={notificationIcon(selectedNotification.kind)} size={23} color={colors.primary} />
                </View>
                <ThemedText type="subtitle" style={styles.sheetTitle}>{selectedNotification.title}</ThemedText>
                <Pressable
                  accessibilityLabel={t('notifications.closeDetail')}
                  hitSlop={8}
                  onPress={() => setSelectedNotificationId(null)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <Ionicons name="close" size={25} color={colors.icon} />
                </Pressable>
              </View>
              <ThemedText style={[styles.detailBody, { color: colors.textSecondary }]}>
                {selectedNotification.body}
              </ThemedText>
              <ThemedText style={[styles.detailDate, { color: colors.textSecondary }]}>
                {notificationDate(selectedNotification.scheduledFor)}
              </ThemedText>

              {selectedDecision?.status === 'pending' && (
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => omitMovement(selectedNotification, selectedDecision)}
                    style={[styles.button, { borderColor: colors.border }]}>
                    <ThemedText type="defaultSemiBold">{t('common.skip')}</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => void confirmMovement(selectedNotification, selectedDecision)}
                    style={[styles.button, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    <ThemedText type="defaultSemiBold" style={{ color: colors.onPrimary }}>
                      {t('common.confirm')}
                    </ThemedText>
                  </Pressable>
                </View>
              )}
              {selectedDecision?.status === 'skipped' && (
                <Pressable
                  onPress={() => retryMovement(selectedNotification, selectedDecision)}
                  style={[styles.fullButton, { borderColor: colors.primary }]}>
                  <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>
                    {t('common.retry')}
                  </ThemedText>
                </Pressable>
              )}
              {selectedNotification.actionUrl && (
                <Pressable
                  onPress={() => void goToAction(selectedNotification)}
                  style={[styles.fullButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  <ThemedText type="defaultSemiBold" style={{ color: colors.onPrimary }}>
                    {t('notifications.goToAction')}
                  </ThemedText>
                </Pressable>
              )}
              <Pressable
                onPress={() => void markUnread(selectedNotification)}
                style={[styles.fullButton, { borderColor: colors.border }]}>
                <ThemedText type="defaultSemiBold">{t('notifications.markUnread')}</ThemedText>
              </Pressable>
            </ThemedView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: 20, paddingBottom: 32 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  intro: { opacity: 0.72, lineHeight: 21, marginBottom: 14 },
  sectionTitle: { marginTop: 10, marginBottom: 8 },
  dayLabel: { fontSize: 12, fontWeight: '600', marginTop: 4, marginBottom: 6, paddingHorizontal: 2 },
  row: {
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  iconBox: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  rowCopy: { flex: 1, gap: 2 },
  rowTime: { fontSize: 12 },
  deleteButton: { padding: 9 },
  pressed: { opacity: 0.62 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.38)' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 30,
    gap: 14,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { flex: 1 },
  detailBody: { lineHeight: 21 },
  detailDate: { fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 4 },
  button: {
    flex: 1,
    minHeight: 47,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  fullButton: {
    minHeight: 47,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
});
