import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  DEFAULT_HOME_PREFERENCES,
  HOME_GLOBAL_METRIC_IDS,
  HOME_PERIOD_METRIC_IDS,
  type HomeGlobalMetricId,
  type HomePeriodMetricId,
  type HomePreferences,
  type HomeSectionId,
} from '@/lib/home-preferences';
import { t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';

const ROW_STEP = 70;

type SortableSectionRowProps = {
  id: HomeSectionId;
  index: number;
  count: number;
  visible: boolean;
  onMove: (from: number, to: number) => void;
  onToggle: (id: HomeSectionId) => void;
  onDraggingChange: (dragging: boolean) => void;
};

function SortableSectionRow({
  id,
  index,
  count,
  visible,
  onMove,
  onToggle,
  onDraggingChange,
}: SortableSectionRowProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const translateY = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState(false);
  const responder = useMemo(() => {
    const finishDrag = (dy: number) => {
      const target = Math.max(0, Math.min(count - 1, index + Math.round(dy / ROW_STEP)));
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      setDragging(false);
      onDraggingChange(false);
      if (target !== index) onMove(index, target);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 3,
      onPanResponderGrant: () => {
        setDragging(true);
        onDraggingChange(true);
      },
      onPanResponderMove: Animated.event([null, { dy: translateY }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => finishDrag(gesture.dy),
      onPanResponderTerminate: (_, gesture) => finishDrag(gesture.dy),
    });
  }, [count, index, onDraggingChange, onMove, translateY]);

  return (
    <Animated.View
      style={[
        styles.sectionRow,
        { borderColor: colors.border, backgroundColor: colors.surface, transform: [{ translateY }] },
        dragging && styles.draggingRow,
      ]}>
      <View
        accessibilityActions={[
          { name: 'decrement', label: t('homeSettings.moveUp') },
          { name: 'increment', label: t('homeSettings.moveDown') },
        ]}
        accessibilityHint={t('homeSettings.dragHint')}
        accessibilityLabel={t('homeSettings.reorderSection', { section: t(`homeSettings.sections.${id}`) })}
        accessibilityRole="adjustable"
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'decrement' && index > 0) onMove(index, index - 1);
          if (event.nativeEvent.actionName === 'increment' && index < count - 1) onMove(index, index + 1);
        }}
        style={styles.dragHandle}
        {...responder.panHandlers}>
        <Ionicons name="reorder-three-outline" size={25} color={colors.icon} />
      </View>
      <ThemedText type="defaultSemiBold" style={styles.sectionName}>
        {t(`homeSettings.sections.${id}`)}
      </ThemedText>
      <Switch
        accessibilityLabel={t('homeSettings.toggleSection', { section: t(`homeSettings.sections.${id}`) })}
        onValueChange={() => onToggle(id)}
        trackColor={{ false: colors.border, true: colors.primary }}
        value={visible}
      />
    </Animated.View>
  );
}

type MetricSwitchProps<T extends string> = {
  id: T;
  selected: boolean;
  label: string;
  onToggle: (id: T) => void;
};

function MetricSwitch<T extends string>({ id, selected, label, onToggle }: MetricSwitchProps<T>) {
  const colors = Colors[useColorScheme() ?? 'light'];
  return (
    <View style={styles.metricRow}>
      <ThemedText style={styles.metricName}>{label}</ThemedText>
      <Switch
        accessibilityLabel={t('homeSettings.toggleMetric', { metric: label })}
        onValueChange={() => onToggle(id)}
        trackColor={{ false: colors.border, true: colors.primary }}
        value={selected}
      />
    </View>
  );
}

export default function HomeSettingsScreen() {
  const { settings, setHomePreferences } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const [preferences, setPreferences] = useState<HomePreferences>(settings.homePreferences);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setPreferences(settings.homePreferences), [settings.homePreferences]);

  const moveSection = useCallback((from: number, to: number) => {
    setPreferences((current) => {
      const next = [...current.sectionOrder];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...current, sectionOrder: next };
    });
  }, []);

  const toggleSection = (id: HomeSectionId) => {
    setPreferences((current) => ({
      ...current,
      hiddenSections: current.hiddenSections.includes(id)
        ? current.hiddenSections.filter((item) => item !== id)
        : [...current.hiddenSections, id],
    }));
  };

  const toggleMetric = <T extends HomePeriodMetricId | HomeGlobalMetricId>(
    field: 'periodMetrics' | 'globalMetrics',
    id: T
  ) => {
    setPreferences((current) => {
      const selection = current[field] as T[];
      if (selection.includes(id) && selection.length === 1) {
        showToast(t('homeSettings.keepOneMetric'));
        return current;
      }
      return {
        ...current,
        [field]: selection.includes(id)
          ? selection.filter((item) => item !== id)
          : [...selection, id],
      } as HomePreferences;
    });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await setHomePreferences(preferences);
      showToast(t('homeSettings.saved'));
      router.back();
    } catch {
      showToast(t('errors.couldNotSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={[]}>
      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}>
        <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
          {t('homeSettings.description')}
        </ThemedText>

        <View style={styles.heading}>
          <ThemedText type="subtitle">{t('homeSettings.sectionsTitle')}</ThemedText>
          <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>{t('homeSettings.sectionsHint')}</ThemedText>
        </View>
        <View style={styles.sectionList}>
          {preferences.sectionOrder.map((id, index) => (
            <SortableSectionRow
              key={id}
              id={id}
              index={index}
              count={preferences.sectionOrder.length}
              visible={!preferences.hiddenSections.includes(id)}
              onMove={moveSection}
              onToggle={toggleSection}
              onDraggingChange={setDragging}
            />
          ))}
        </View>

        <View style={styles.heading}>
          <ThemedText type="subtitle">{t('home.periodSummary')}</ThemedText>
          <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>{t('homeSettings.metricsHint')}</ThemedText>
        </View>
        <ThemedView style={[styles.metricCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {HOME_PERIOD_METRIC_IDS.map((id) => (
            <MetricSwitch
              key={id}
              id={id}
              label={t(`homeSettings.periodMetrics.${id}`)}
              selected={preferences.periodMetrics.includes(id)}
              onToggle={(metric) => toggleMetric('periodMetrics', metric)}
            />
          ))}
        </ThemedView>

        <View style={styles.heading}>
          <ThemedText type="subtitle">{t('home.globalSummary')}</ThemedText>
          <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>{t('homeSettings.metricsHint')}</ThemedText>
        </View>
        <ThemedView style={[styles.metricCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {HOME_GLOBAL_METRIC_IDS.map((id) => (
            <MetricSwitch
              key={id}
              id={id}
              label={t(`homeSettings.globalMetrics.${id}`)}
              selected={preferences.globalMetrics.includes(id)}
              onToggle={(metric) => toggleMetric('globalMetrics', metric)}
            />
          ))}
        </ThemedView>

        <Pressable
          accessibilityRole="button"
          onPress={() => setPreferences({
            version: DEFAULT_HOME_PREFERENCES.version,
            sectionOrder: [...DEFAULT_HOME_PREFERENCES.sectionOrder],
            hiddenSections: [],
            periodMetrics: [...DEFAULT_HOME_PREFERENCES.periodMetrics],
            globalMetrics: [...DEFAULT_HOME_PREFERENCES.globalMetrics],
          })}
          style={({ pressed }) => [styles.resetButton, { borderColor: colors.border }, pressed && styles.pressed]}>
          <Ionicons name="refresh-outline" size={19} color={colors.icon} />
          <ThemedText type="defaultSemiBold">{t('homeSettings.restoreDefaults')}</ThemedText>
        </Pressable>
      </ScrollView>

      <View style={[
        styles.footer,
        {
          backgroundColor: colors.screen,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 14),
        },
      ]}>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => { void save(); }}
          style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary }, (pressed || saving) && styles.pressed]}>
          <ThemedText style={[styles.saveText, { color: colors.onPrimary }]}>
            {saving ? t('common.saving') : t('common.save')}
          </ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16 },
  description: { fontSize: 16, lineHeight: 23 },
  heading: { gap: 3, marginTop: 4 },
  hint: { fontSize: 13, lineHeight: 18 },
  sectionList: { gap: 8 },
  sectionRow: { minHeight: 62, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  draggingRow: { zIndex: 10, elevation: 8, opacity: 0.96 },
  dragHandle: { width: 36, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  sectionName: { flex: 1 },
  metricCard: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
  metricRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricName: { flex: 1 },
  resetButton: { minHeight: 50, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 14 },
  saveButton: { minHeight: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  saveText: { fontFamily: Fonts.bold, fontSize: 17 },
  pressed: { opacity: 0.7 },
});
