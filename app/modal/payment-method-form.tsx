import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, ToastAndroid, View } from 'react-native';

import { ColorPicker } from '@/components/ColorPicker';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import type { PaymentMethodType } from '@/lib/types';

const TYPES: { value: PaymentMethodType; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'debit', label: 'Débito' },
  { value: 'prepaid', label: 'Prepago' },
  { value: 'credit', label: 'Crédito' },
];

function showDefaultConfirmation(name: string) {
  const message = `${name} es ahora tu medio de pago predeterminado.`;
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert('Medio predeterminado', message);
}

export default function PaymentMethodFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const {
    paymentMethods,
    settings,
    addPaymentMethod,
    editPaymentMethod,
    setPaymentMethodActive,
    setDefaultPaymentMethod,
  } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const method = id ? paymentMethods.find((item) => item.id === Number(id)) : undefined;
  const [name, setName] = useState(method?.name ?? '');
  const [type, setType] = useState<PaymentMethodType>(method?.type ?? 'debit');
  const [billingDay, setBillingDay] = useState(method?.billingDay ? String(method.billingDay) : '25');
  const [color, setColor] = useState(method?.color ?? '#0a7ea4');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const day = Number(billingDay);
    if (!name.trim()) return Alert.alert('Falta el nombre', 'Escribe un nombre para el medio de pago.');
    if (type === 'credit' && (!Number.isInteger(day) || day < 1 || day > 31)) {
      return Alert.alert('Día no válido', 'El día estimado de facturación debe estar entre 1 y 31.');
    }
    setSaving(true);
    try {
      const data = { name: name.trim(), type, billingDay: type === 'credit' ? day : null, color };
      if (method) await editPaymentMethod(method.id, data);
      else await addPaymentMethod(data);
      router.back();
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Inténtalo nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedText style={styles.label}>Nombre</ThemedText>
      <TextInput
        autoFocus={!method}
        placeholder="Ej: Visa Banco"
        placeholderTextColor={colors.icon}
        value={name}
        onChangeText={setName}
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
      />
      <ThemedText style={styles.label}>Tipo</ThemedText>
      {method ? (
        <View style={styles.types}>
          <View
            style={[
              styles.type,
              { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
            ]}
          >
            <ThemedText style={{ color: colors.primary, fontWeight: '700' }}>
              {TYPES.find((item) => item.value === method.type)?.label}
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={styles.types}>
          {TYPES.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setType(item.value)}
              style={[
                styles.type,
                { borderColor: colors.border },
                type === item.value && { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
              ]}>
              <ThemedText style={type === item.value ? { color: colors.primary, fontWeight: '700' } : undefined}>
                {item.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}
      <ThemedText style={styles.label}>Color</ThemedText>
      <ColorPicker value={color} onChange={setColor} />
      {type === 'credit' && (
        <>
          <ThemedText style={styles.label}>Día estimado de facturación</ThemedText>
          <TextInput
            keyboardType="number-pad"
            maxLength={2}
            value={billingDay}
            onChangeText={setBillingDay}
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          />
          <ThemedText style={styles.hint}>
            Es una referencia para anticipar el ciclo. Al llegar la facturación podrás registrar su fecha real.
          </ThemedText>
        </>
      )}
      {method && (
        <View style={styles.preferences}>
          <View style={[styles.preferenceCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.preferenceCopy}>
              <ThemedText type="defaultSemiBold">Activo</ThemedText>
            </View>
            <Switch
              value={method.active}
              onValueChange={(active) => {
                setPaymentMethodActive(method.id, active).catch(() => {
                  Alert.alert('No se pudo cambiar', 'Inténtalo nuevamente.');
                });
              }}
              trackColor={{ true: colors.primary }}
            />
          </View>
          <View style={[styles.preferenceCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.preferenceCopy}>
              <ThemedText type="defaultSemiBold">Medio de pago predeterminado</ThemedText>
            </View>
            <Pressable
              accessibilityLabel={settings.defaultPaymentMethodId === method.id
                ? `Quitar ${method.name} como favorito`
                : `Marcar ${method.name} como favorito`}
              accessibilityRole="button"
              disabled={!method.active}
              onPress={() => {
                const favorite = settings.defaultPaymentMethodId !== method.id;
                setDefaultPaymentMethod(favorite ? method.id : null)
                  .then(() => {
                    if (favorite) showDefaultConfirmation(method.name);
                  })
                  .catch((error) => {
                    Alert.alert('No se pudo cambiar', error instanceof Error ? error.message : 'Inténtalo nuevamente.');
                  });
              }}
              style={[styles.favoriteButton, !method.active && styles.favoriteDisabled]}>
              <Ionicons
                name={settings.defaultPaymentMethodId === method.id ? 'star' : 'star-outline'}
                size={24}
                color={settings.defaultPaymentMethodId === method.id ? '#f2b705' : colors.icon}
              />
            </Pressable>
          </View>
        </View>
      )}
      <Pressable disabled={saving} onPress={save} style={[styles.save, saving && { opacity: 0.6 }]}>
        <ThemedText style={styles.saveText}>{method ? 'Guardar cambios' : 'Agregar medio de pago'}</ThemedText>
      </Pressable>
      {method?.type === 'credit' && (
        <Pressable
          onPress={() => router.push({ pathname: '/modal/card-cycles', params: { id: String(method.id) } })}
          style={[styles.cyclesButton, { borderColor: colors.border }]}>
          <ThemedText type="defaultSemiBold">Ver ciclos y conciliar</ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10, paddingBottom: 40 },
  label: { fontWeight: '700', marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, fontSize: 16 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  type: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  readonlyType: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 3 },
  preferences: { gap: 10, marginTop: 8 },
  preferenceCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 12, gap: 12 },
  preferenceCopy: { flex: 1, gap: 2 },
  favoriteButton: { padding: 6 },
  favoriteDisabled: { opacity: 0.35 },
  hint: { opacity: 0.65, fontSize: 13, lineHeight: 18 },
  save: { marginTop: 18, borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: '#0a7ea4' },
  saveText: { color: '#fff', fontWeight: '700' },
  cyclesButton: { borderWidth: 1, borderRadius: 10, padding: 13, alignItems: 'center' },
});
