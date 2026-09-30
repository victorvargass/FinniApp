import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { usePeriodDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { APP_LOCALE, t } from '@/lib/i18n';
import { PERIOD_CSV_FIELDS, type PeriodCsvField } from '@/lib/period-csv';
import { showToast } from '@/lib/toast';
import { exportPeriodCsv } from '@/services/PeriodCsvService';

function displayDate(value: string): string {
  return new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: 'medium' })
    .format(new Date(`${value}T12:00:00`));
}

export default function PeriodCsvExportScreen() {
  const { periodId } = useLocalSearchParams<{ periodId?: string }>();
  const { periodHistory } = usePeriodDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const [fields, setFields] = useState<PeriodCsvField[]>([...PERIOD_CSV_FIELDS]);
  const [exporting, setExporting] = useState(false);
  const period = useMemo(
    () => periodHistory.find((item) => item.periodId === Number(periodId)),
    [periodHistory, periodId]
  );

  const toggleField = (field: PeriodCsvField) => {
    setFields((current) => current.includes(field)
      ? current.filter((item) => item !== field)
      : [...current, field]);
  };

  const runExport = async () => {
    if (!period || fields.length === 0 || exporting) return;
    setExporting(true);
    try {
      await exportPeriodCsv(period, fields);
      showToast(t('csv.generated'));
      router.back();
    } catch {
      showToast(t('csv.exportError'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={[]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}>
        <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
          {t('csv.description')}
        </ThemedText>

        {period ? (
          <ThemedView style={[styles.periodCard, { borderColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            <View style={styles.periodCopy}>
              <ThemedText type="defaultSemiBold">{t('csv.selectedPeriod')}</ThemedText>
              <ThemedText style={{ color: colors.textSecondary }}>
                {displayDate(period.startDate)} – {displayDate(period.endDate)}
              </ThemedText>
            </View>
          </ThemedView>
        ) : (
          <ThemedText style={{ color: colors.danger }}>{t('csv.periodUnavailable')}</ThemedText>
        )}

        <View style={styles.headingRow}>
          <ThemedText type="subtitle">{t('csv.fieldsTitle')}</ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => setFields(fields.length === PERIOD_CSV_FIELDS.length ? [] : [...PERIOD_CSV_FIELDS])}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="link">
              {fields.length === PERIOD_CSV_FIELDS.length ? t('csv.clearAll') : t('csv.selectAll')}
            </ThemedText>
          </Pressable>
        </View>

        <ThemedView style={[styles.fieldCard, { borderColor: colors.border }]}>
          {PERIOD_CSV_FIELDS.map((field, index) => {
            const selected = fields.includes(field);
            return (
              <Pressable
                key={field}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleField(field)}
                style={({ pressed }) => [
                  styles.fieldRow,
                  index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                  pressed && styles.pressed,
                ]}>
                <Ionicons
                  name={selected ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={selected ? colors.action : colors.icon}
                />
                <ThemedText style={styles.fieldLabel}>{t(`csv.fields.${field}`)}</ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
        {fields.length === 0 && (
          <ThemedText style={[styles.validation, { color: colors.danger }]}>
            {t('csv.selectOneField')}
          </ThemedText>
        )}
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
          disabled={!period || fields.length === 0 || exporting}
          onPress={() => { void runExport(); }}
          style={({ pressed }) => [
            styles.exportButton,
            { backgroundColor: colors.primary },
            (pressed || exporting || !period || fields.length === 0) && styles.disabled,
          ]}>
          {exporting && <ActivityIndicator size="small" color={colors.onPrimary} />}
          <ThemedText style={[styles.exportLabel, { color: colors.onPrimary }]}>
            {exporting ? t('csv.exporting') : t('csv.export')}
          </ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 18 },
  description: { fontSize: 16, lineHeight: 23 },
  periodCard: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  periodCopy: { flex: 1, gap: 2 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  fieldCard: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, overflow: 'hidden' },
  fieldRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldLabel: { flex: 1 },
  validation: { fontSize: 13 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 14 },
  exportButton: { minHeight: 52, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  exportLabel: { fontFamily: Fonts.bold, fontSize: 17 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
