import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDate } from '@/lib/format';
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
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'annual', label: 'Anual' },
  { value: 'custom', label: 'Personalizado' },
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
      <ThemedText style={styles.label}>Frecuencia</ThemedText>
      <Options options={FREQUENCIES} value={value.frequency} onChange={changeFrequency} />

      {value.frequency === 'custom' && (
        <>
          <ThemedText style={styles.label}>Cada cuántos meses</ThemedText>
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
          <ThemedText style={styles.label}>Día del mes</ThemedText>
          <TextInput
            keyboardType="number-pad"
            maxLength={2}
            value={value.executionDay == null ? '' : String(value.executionDay)}
            onChangeText={(text) => update({ executionDay: Number(text.replace(/\D/g, '')) || null })}
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          />
          {(value.executionDay ?? 0) >= 29 && (
            <ThemedText style={styles.hint}>
              Si un mes es más corto, se usará su último día.
            </ThemedText>
          )}
        </>
      )}

      <ThemedText style={styles.label}>Próxima ejecución</ThemedText>
      <Pressable
        disabled={fixedStartDate != null}
        onPress={() => setDatePicker('start')}
        style={[styles.input, { borderColor: colors.border }]}>
        <ThemedText>
          {nextExecutionDate ? formatDate(parseIsoDate(nextExecutionDate)) : 'Sin próximas ejecuciones'}
        </ThemedText>
      </Pressable>
      {value.frequency === 'weekly' && (
        <ThemedText style={styles.hint}>
          Se ejecutará cada {parseIsoDate(referenceDate).toLocaleDateString('es-CL', { weekday: 'long' })}.
        </ThemedText>
      )}
      {value.frequency === 'annual' && (
        <ThemedText style={styles.hint}>Se repetirá una vez al año en esta fecha.</ThemedText>
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
              <ThemedText type="link">Listo</ThemedText>
            </Pressable>
          )}
        </>
      )}

      {!hideRegistrationMode && <>
      <ThemedText style={styles.label}>Modo de registro</ThemedText>
      <Options<RecurringRegistrationMode>
        options={[
          { value: 'confirmation', label: 'Con confirmación' },
          { value: 'automatic', label: 'Automático' },
        ]}
        value={value.registrationMode}
        onChange={(registrationMode) => update({ registrationMode })}
      />
      <ThemedText style={styles.hint}>
        {value.registrationMode === 'automatic'
          ? `El ${movementKind} se registrará automáticamente cuando llegue la fecha programada.`
          : `Recibirás una notificación para aprobar u omitir el ${movementKind}.`}
      </ThemedText>
      </>}

      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <ThemedText type="defaultSemiBold">Fecha de fin</ThemedText>
          <ThemedText style={styles.hint}>{value.endDate ? `Después de esta fecha, el ${movementKind} no se seguirá registrando de manera recurrente` : 'Sin fecha de término'}</ThemedText>
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
                  <ThemedText type="link">Listo</ThemedText>
                </Pressable>
              )}
            </>
          )}
        </>
      )}

      {showActiveToggle && (
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <ThemedText type="defaultSemiBold">Activo</ThemedText>
            <ThemedText style={styles.hint}>Permite crear los próximos movimientos recurrentes</ThemedText>
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
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, fontSize: 16 },
  hint: { opacity: 0.65, fontSize: 13, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  switchCopy: { flex: 1, gap: 2 },
  doneDate: { alignSelf: 'flex-end' },
});
