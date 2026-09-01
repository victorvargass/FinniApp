import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';

const DAYS = [
  [1, 'Domingo'], [2, 'Lunes'], [3, 'Martes'], [4, 'Miércoles'],
  [5, 'Jueves'], [6, 'Viernes'], [7, 'Sábado'],
] as const;

export default function MovementReminderScreen() {
  const { settings, setMovementReminder } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>(settings.movementReminderFrequency);
  const [weekday, setWeekday] = useState(settings.movementReminderWeekday);
  const [time, setTime] = useState(() => new Date(2026, 0, 1, settings.movementReminderHour, settings.movementReminderMinute));
  const [showTime, setShowTime] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await setMovementReminder({
        movementReminderEnabled: settings.movementReminderEnabled,
        movementReminderFrequency: frequency,
        movementReminderWeekday: weekday,
        movementReminderHour: time.getHours(),
        movementReminderMinute: time.getMinutes(),
      });
      router.back();
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Inténtalo nuevamente.');
    } finally { setSaving(false); }
  };

  return <SafeAreaView style={styles.safe} edges={['bottom']}><ScrollView contentContainerStyle={styles.content}>
    <ThemedText style={styles.hint}>Configura cuándo quieres recibir el aviso.</ThemedText>
    <ThemedText style={styles.label}>Periodicidad</ThemedText>
    <View style={styles.options}>{([['daily', 'Diariamente'], ['weekly', 'Una vez por semana']] as const).map(([value, label]) => <Pressable key={value} onPress={() => setFrequency(value)} style={[styles.option, { borderColor: colors.border }, frequency === value && styles.selected]}><ThemedText style={frequency === value ? styles.selectedText : undefined}>{label}</ThemedText></Pressable>)}</View>
    {frequency === 'weekly' && <><ThemedText style={styles.label}>Día de la semana</ThemedText><View style={styles.days}>{DAYS.map(([value, label]) => <Pressable key={value} onPress={() => setWeekday(value)} style={[styles.day, { borderColor: colors.border }, weekday === value && styles.selected]}><ThemedText style={weekday === value ? styles.selectedText : undefined}>{label}</ThemedText></Pressable>)}</View></>}
    <ThemedText style={styles.label}>Hora</ThemedText>
    <Pressable onPress={() => setShowTime(true)} style={[styles.time, { borderColor: colors.border }]}><ThemedText type="defaultSemiBold">{time.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</ThemedText></Pressable>
    {showTime && <DateTimePicker value={time} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_, value) => { if (Platform.OS === 'android') setShowTime(false); if (value) setTime(value); }} />}
    {Platform.OS === 'ios' && showTime && <Pressable onPress={() => setShowTime(false)} style={styles.done}><ThemedText type="link">Listo</ThemedText></Pressable>}
    <Pressable disabled={saving} onPress={save} style={[styles.save, saving && { opacity: 0.6 }]}><ThemedText style={styles.saveText}>{saving ? 'Guardando...' : 'Guardar recordatorio'}</ThemedText></Pressable>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1 }, content: { padding: 20, paddingBottom: 40, gap: 13 }, hint: { opacity: 0.65, lineHeight: 19, marginBottom: 4 }, label: { fontWeight: '700', marginTop: 4 }, options: { flexDirection: 'row', gap: 8 }, option: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' }, selected: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' }, selectedText: { color: '#fff', fontWeight: '700' }, days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, day: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }, time: { borderWidth: 1, borderRadius: 10, padding: 14 }, done: { alignSelf: 'flex-end' }, save: { backgroundColor: '#0a7ea4', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 }, saveText: { color: '#fff', fontWeight: '700' } });
