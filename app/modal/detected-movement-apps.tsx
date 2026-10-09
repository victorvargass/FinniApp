import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, LayoutTokens } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { t } from '@/lib/i18n';
import {
  getNotificationMovementSources,
  isNotificationMovementAccessEnabled,
  notificationMovementCaptureSupported,
  openNotificationMovementAccessSettings,
  setNotificationMovementSourceEnabled,
  type NotificationMovementSource,
} from '@/lib/notification-movements';
import { showToast } from '@/lib/toast';
import { ensurePushNotificationPermission } from '@/services/NotificationPreferencesService';

export default function DetectedMovementAppsScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [sources, setSources] = useState<NotificationMovementSource[]>([]);
  const [accessEnabled, setAccessEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [enabled, detectedSources] = await Promise.all([
        isNotificationMovementAccessEnabled(),
        getNotificationMovementSources(),
      ]);
      setAccessEnabled(enabled);
      setSources(detectedSources);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => subscription.remove();
  }, [load]));

  const setSourceEnabled = async (source: NotificationMovementSource, enabled: boolean) => {
    setSources((current) => current.map((item) => (
      item.packageName === source.packageName ? { ...item, enabled } : item
    )));
    try {
      await setNotificationMovementSourceEnabled(source.packageName, enabled);
      showToast(t(enabled ? 'pendingMovements.sourceEnabled' : 'pendingMovements.sourceDisabled', {
        name: source.name,
      }));
    } catch (error) {
      setSources((current) => current.map((item) => (
        item.packageName === source.packageName ? source : item
      )));
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('errors.couldNotSave')
      );
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={[styles.intro, { color: colors.textSecondary }]}>
          {t('pendingMovements.sourcesHint')}
        </ThemedText>

        {!notificationMovementCaptureSupported ? (
          <ThemedView style={[styles.notice, { borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={26} color={colors.icon} />
            <ThemedText style={styles.noticeCopy}>{t('pendingMovements.unsupported')}</ThemedText>
          </ThemedView>
        ) : !accessEnabled ? (
          <ThemedView style={[styles.notice, { borderColor: colors.border }]}>
            <Ionicons name="notifications-outline" size={26} color={colors.action} />
            <View style={styles.noticeCopy}>
              <ThemedText type="subtitle">{t('pendingMovements.permissionTitle')}</ThemedText>
              <ThemedText style={{ color: colors.textSecondary }}>
                {t('pendingMovements.permissionDescription')}
              </ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void ensurePushNotificationPermission()
                  .catch(() => undefined)
                  .finally(() => { void openNotificationMovementAccessSettings(); });
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={[styles.primaryText, { color: colors.onPrimary }]}>
                {t('pendingMovements.openAccessSettings')}
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.action} style={styles.loader} />
        ) : accessEnabled && sources.length > 0 ? (
          <ThemedView style={[styles.sourcesCard, { borderColor: colors.border }]}>
            {sources.map((source, index) => (
              <View key={source.packageName}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <View style={styles.sourceRow}>
                  <View style={styles.sourceCopy}>
                    <ThemedText type="defaultSemiBold">{source.name}</ThemedText>
                    <ThemedText
                      numberOfLines={1}
                      style={[styles.sourcePackage, { color: colors.textSecondary }]}>
                      {source.packageName}
                    </ThemedText>
                  </View>
                  <Switch
                    accessibilityLabel={t('pendingMovements.sourceToggleAccessibility', { name: source.name })}
                    value={source.enabled}
                    onValueChange={(enabled) => { void setSourceEnabled(source, enabled); }}
                    trackColor={{ false: colors.border, true: colors.action }}
                    thumbColor={colors.surface}
                  />
                </View>
              </View>
            ))}
          </ThemedView>
        ) : accessEnabled ? (
          <ThemedView style={styles.empty}>
            <Ionicons name="apps-outline" size={40} color={colors.icon} />
            <ThemedText type="subtitle">{t('pendingMovements.noSources')}</ThemedText>
            <ThemedText style={[styles.emptyCopy, { color: colors.textSecondary }]}>
              {t('pendingMovements.noSourcesHint')}
            </ThemedText>
          </ThemedView>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  intro: { lineHeight: 23 },
  notice: { borderWidth: 1, borderRadius: LayoutTokens.radiusLarge, padding: 16, gap: 12 },
  noticeCopy: { flex: 1, gap: 4 },
  primaryButton: { minHeight: 48, borderRadius: LayoutTokens.radiusMedium, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryText: { fontFamily: Fonts.bold, textAlign: 'center' },
  loader: { marginTop: 36 },
  sourcesCard: { borderWidth: 1, borderRadius: LayoutTokens.radiusLarge, paddingHorizontal: 16 },
  sourceRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sourceCopy: { flex: 1, minWidth: 0, gap: 2 },
  sourcePackage: { fontSize: 12, lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth },
  empty: { alignItems: 'center', paddingVertical: 54, gap: 10 },
  emptyCopy: { textAlign: 'center' },
  pressed: { opacity: 0.65 },
});
