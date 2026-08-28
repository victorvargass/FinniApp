import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, FlatList, Platform, Pressable, StyleSheet, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/floating-action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { PaymentMethodType } from '@/lib/types';

const TYPE_LABELS: Record<PaymentMethodType, string> = {
  cash: 'Efectivo', debit: 'Débito', prepaid: 'Prepago', credit: 'Crédito',
};

function showDefaultConfirmation(name: string) {
  const message = `${name} es ahora tu medio de pago predeterminado.`;
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert('Medio predeterminado', message);
}

export default function PaymentMethodsScreen() {
  const { paymentMethods, settings, setDefaultPaymentMethod } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={paymentMethods}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <ThemedText style={styles.intro}>
            Los gastos antiguos quedan como “No especificado”. Puedes desactivar un medio sin perder su historial.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <ThemedView style={[styles.card, !item.active && styles.inactive]}>
            <View style={[styles.colorDot, { backgroundColor: item.color }]} />
            <Pressable
              onPress={() => router.push({ pathname: '/modal/payment-method-form', params: { id: String(item.id) } })}
              style={styles.main}>
              <View style={styles.copy}>
                <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                <ThemedText style={styles.secondary}>
                  {TYPE_LABELS[item.type]}{item.billingDay ? ` · factura aprox. el ${item.billingDay}` : ''}
                </ThemedText>
              </View>
            </Pressable>
            <Pressable
              accessibilityLabel={settings.defaultPaymentMethodId === item.id
                ? `Quitar ${item.name} como predeterminado`
                : `Usar ${item.name} como predeterminado`}
              accessibilityRole="button"
              disabled={!item.active}
              onPress={() => {
                const willBeDefault = settings.defaultPaymentMethodId !== item.id;
                setDefaultPaymentMethod(willBeDefault ? item.id : null)
                  .then(() => {
                    if (willBeDefault) showDefaultConfirmation(item.name);
                  })
                  .catch((error) => Alert.alert(
                    'No se pudo cambiar',
                    error instanceof Error ? error.message : 'Inténtalo nuevamente.'
                  ));
              }}
              style={[styles.star, !item.active && styles.starDisabled]}>
              <Ionicons
                name={settings.defaultPaymentMethodId === item.id ? 'star' : 'star-outline'}
                size={22}
                color={settings.defaultPaymentMethodId === item.id ? '#f2b705' : colors.icon}
              />
            </Pressable>
            <Pressable
              accessibilityLabel={`Configurar ${item.name}`}
              onPress={() => router.push({ pathname: '/modal/payment-method-form', params: { id: String(item.id) } })}
              style={styles.chevron}>
              <Ionicons name="chevron-forward" size={21} color={colors.icon} />
            </Pressable>
          </ThemedView>
        )}
      />
      <FloatingActionButton href="/modal/payment-method-form" accessibilityLabel="Agregar medio de pago" avoidBottomInset />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: 20, paddingBottom: 100, gap: 10 },
  intro: { opacity: 0.7, lineHeight: 20, marginBottom: 8 },
  card: { borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  inactive: { opacity: 0.55 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  colorDot: { width: 18, height: 18, borderRadius: 6 },
  copy: { flex: 1, gap: 3 },
  secondary: { opacity: 0.65, fontSize: 13 },
  chevron: { paddingVertical: 8, paddingLeft: 4 },
  star: { padding: 6 },
  starDisabled: { opacity: 0.35 },
});
