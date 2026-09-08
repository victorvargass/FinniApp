import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDate } from '@/lib/format';
import { APP_LOCALE, t } from '@/lib/i18n';
import { addIsoDays, addIsoMonths, getOccurrenceDates, parseIsoDate, toIsoDate } from '@/lib/recurrence';
import type {
  NewRecurringSchedule,
  RecurringFrequency,
  RecurringRegistrationMode,
} from '@/lib/types';

type Props = {
  value: NewRecurringSchedule;
  onChange: (value: NewRecurringSchedule) => void;
  showActiveToggle?: boolean;
  fixedStartDate?: string;
  storedNextDate?: string | null;
  hideRegistrationMode?: boolean;
  movementKind?: 'gasto' | 'ingreso';
};

const FREQUENCIES: { value: RecurringFrequency; label: string }[] = [
  { value: 'weekly', label: t('recurrence.weekly') },
  { value: 'monthly', label: t('recurrence.monthly') },
  { value: 'annual', label: t('recurrence.annual') },
  { value: 'custom', label: t('recurrence.custom') },
];

function Options<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const colors = Colors[useColorScheme() ?? 'light'];
  return (
    <View style={styles.options}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.option,
              { borderColor: selected ? colors.primary : colors.border },
              selected && { backgroundColor: colors.primary + '18' },
            ]}>
            <ThemedText style={selected ? { color: colors.primary, fontWeight: '700' } : undefined}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RecurringScheduleFields({
  value,
  onChange,
  showActiveToggle = false,
  fixedStartDate,
  storedNextDate,
  hideRegistrationMode = false,
  movementKind = 'gasto',
}: Props) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [datePicker, setDatePicker] = useState<'start' | 'end' | null>(null);
  const update = (patch: Partial<NewRecurringSchedule>) => onChange({ ...value, ...patch });
  const usesExecutionDay = value.frequency === 'monthly' || value.frequency === 'custom';
  const referenceDate = fixedStartDate ?? value.startDate;
  const calculatedNextDate = getOccurrenceDates(
    { ...value, startDate: referenceDate },
    addIsoDays(referenceDate, 1),
    addIsoMonths(referenceDate, 240),
    5000
  )[0] ?? null;
  const nextExecutionDate = storedNextDate === undefined ? calculatedNextDate : storedNextDate;

  const changeFrequency = (frequency: RecurringFrequency) => {
    update({
      frequency,
      executionDay: frequency === 'monthly' || frequency === 'custom'
        ? value.executionDay ?? parseIsoDate(value.startDate).getDate()
        : null,
    });
  };

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>{t('recurrence.frequency')}</ThemedText>
      <Options options={FREQUENCIES} value={value.frequency} onChange={changeFrequency} />

      {value.frequency === 'custom' && (
        <>
          <ThemedText style={styles.label}>{t('recurrence.intervalMonths')}</ThemedText>
          <TextInput
            keyboardType="number-pad"
            maxLength={2}
            value={value.intervalMonths > 0 ? String(value.intervalMonths) : ''}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '');
              update({ intervalMonths: digits ? Number(digits) : 0 });
            }}
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          />
        </>
      )}

      {usesExecutionDay && (
        <>
          <ThemedText style={styles.label}>{t('recurrence.dayOfMonth')}</ThemedText>
          <TextInput
            keyboardType="number-pad"
            maxLength={2}
            value={value.executionDay == null ? '' : String(value.executionDay)}
            onChangeText={(text) => update({ executionDay: Number(text.replace(/\D/g, '')) || null })}
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          />
          {(value.executionDay ?? 0) >= 29 && (
            <ThemedText style={styles.hint}>
              {t('recurrence.shortMonthHint')}
            </ThemedText>
          )}
        </>
      )}

      <ThemedText style={styles.label}>{t('recurrence.nextExecution')}</ThemedText>
      <Pressable
        disabled={fixedStartDate != null}
        onPress={() => setDatePicker('start')}
        style={[styles.input, { borderColor: colors.border }]}>
        <ThemedText>
          {nextExecutionDate ? formatDate(parseIsoDate(nextExecutionDate)) : t('recurrence.noNextExecutions')}
        </ThemedText>
      </Pressable>
      {value.frequency === 'weekly' && (
        <ThemedText style={styles.hint}>
          {t('recurrence.weeklyHint', { weekday: parseIsoDate(referenceDate).toLocaleDateString(APP_LOCALE, { weekday: 'long' }) })}
        </ThemedText>
      )}
      {value.frequency === 'annual' && (
        <ThemedText style={styles.hint}>{t('recurrence.annualHint')}</ThemedText>
      )}
      {fixedStartDate == null && datePicker === 'start' && (
        <>
          <DateTimePicker
            value={parseIsoDate(value.startDate)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, selected) => {
              if (Platform.OS === 'android') setDatePicker(null);
              if (!selected) return;
              update({
                startDate: toIsoDate(selected),
                executionDay: usesExecutionDay ? selected.getDate() : value.executionDay,
              });
            }}
          />
          {Platform.OS === 'ios' && (
            <Pressable onPress={() => setDatePicker(null)} style={styles.doneDate}>
              <ThemedText type="link">{t('common.done')}</ThemedText>
            </Pressable>
          )}
        </>
      )}

      {!hideRegistrationMode && <>
      <ThemedText style={styles.label}>{t('recurrence.registrationMode')}</ThemedText>
      <Options<RecurringRegistrationMode>
        options={[
          { value: 'confirmation', label: t('recurrence.confirmation') },
          { value: 'automatic', label: t('common.automatic') },
        ]}
        value={value.registrationMode}
        onChange={(registrationMode) => update({ registrationMode })}
      />
      <ThemedText style={styles.hint}>
        {value.registrationMode === 'automatic'
          ? t('recurrence.automaticHint', { movement: movementKind })
          : t('recurrence.confirmationHint', { movement: movementKind })}
      </ThemedText>
      </>}

      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <ThemedText type="defaultSemiBold">{t('recurrence.endDate')}</ThemedText>
          <ThemedText style={styles.hint}>{value.endDate ? t('recurrence.endDateHint', { movement: movementKind }) : t('recurrence.noEndDate')}</ThemedText>
        </View>
        <Switch
          value={value.endDate != null}
          onValueChange={(enabled) => update({
            endDate: enabled ? addIsoMonths(value.startDate, 12) : null,
          })}
          trackColor={{ true: colors.primary }}
        />
      </View>
      {value.endDate && (
        <>
          <Pressable
            onPress={() => setDatePicker('end')}
            style={[styles.input, { borderColor: colors.border }]}>
            <ThemedText>{formatDate(parseIsoDate(value.endDate))}</ThemedText>
          </Pressable>
          {datePicker === 'end' && (
            <>
              <DateTimePicker
                value={parseIsoDate(value.endDate)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, selected) => {
                  if (Platform.OS === 'android') setDatePicker(null);
                  if (selected) update({ endDate: toIsoDate(selected) });
                }}
              />
              {Platform.OS === 'ios' && (
                <Pressable onPress={() => setDatePicker(null)} style={styles.doneDate}>
                  <ThemedText type="link">{t('common.done')}</ThemedText>
                </Pressable>
              )}
            </>
          )}
        </>
      )}

      {showActiveToggle && (
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <ThemedText type="defaultSemiBold">{t('common.active')}</ThemedText>
            <ThemedText style={styles.hint}>{t('recurrence.activeHint')}</ThemedText>
          </View>
          <Switch
            value={value.active}
            onValueChange={(active) => update({ active })}
            trackColor={{ true: colors.primary }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  label: { fontWeight: '700', marginTop: 6 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 9 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, fontSize: 16, fontFamily: Fonts.regular },
  hint: { opacity: 0.65, fontSize: 13, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  switchCopy: { flex: 1, gap: 2 },
  doneDate: { alignSelf: 'flex-end' },
});
