import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleLogo } from '@/components/google-logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useBiometric } from '@/contexts/BiometricContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useThemePreference } from '@/contexts/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGoogle } from '@/hooks/useGoogle';
import { Alert } from '@/lib/alert';

// Utils
const WEEKDAY_LABELS: Record<number, string> = {
  1: 'domingos',
  2: 'lunes',
  3: 'martes',
  4: 'miércoles',
  5: 'jueves',
  6: 'viernes',
  7: 'sábados',
};

function formatBackupDate(date: string | undefined): string {
  if (!date) return 'Nunca';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Desconocido';

  return parsed.toLocaleString('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// Components
type ActionButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
  textStyle?: any;
  icon?: React.ReactNode;
};

function ActionButton({
  title,
  onPress,
  disabled,
  style,
  textStyle,
  icon,
}: ActionButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}
    >
      {icon}
      <ThemedText style={[styles.buttonText, textStyle]}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

// Main screen
export default function UserScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { setPreference: setThemePreference } = useThemePreference();
  const { recurringDecisions, settings, setMovementReminder } = useDatabase();
  const pendingConfirmations = recurringDecisions.filter((item) => item.status === 'pending').length;
  const {
    authenticationType,
    enabled: biometricEnabled,
    isAvailable: isBiometricAvailable,
    setEnabled: setBiometricEnabled,
  } = useBiometric();
  const {
    user,
    isLoading,
    isWorking,
    isConnected,
    lastBackup,
    error,
    login,
    backup,
    restore,
    logout,
  } = useGoogle();

  // Actions
  const runBackup = async () => {
    try {
      await backup();
      Alert.alert('Respaldo completado', 'Tus datos fueron respaldados en Google Drive.');
    } catch {
      // El hook ya expone el error.
    }
  };

  const runRestore = async () => {
    try {
      await restore();
      Alert.alert(
        'Restauración completada',
        'La base de datos fue restaurada correctamente.'
      );
    } catch {
      // El hook ya expone el error.
    }
  };

  const confirmRestore = () => {
    Alert.alert(
      'Restaurar datos',
      'La restauración reemplazará los datos actuales de FinniApp por el último respaldo. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Restaurar', style: 'destructive', onPress: runRestore },
      ]
    );
  };

  const runLogout = async () => {
    await logout();
  };

  // Loading
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
          <ThemedText>Cargando sesión...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  // Main content
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Configuración</ThemedText>
          <Pressable
            accessibilityLabel={pendingConfirmations > 0
              ? `Notificaciones, ${pendingConfirmations} pendientes`
              : 'Notificaciones'}
            accessibilityRole="button"
            onPress={() => router.push('/modal/recurring-confirmations')}
            hitSlop={10}
            style={({ pressed }) => [
              styles.notificationButton,
              pressed && styles.buttonPressed,
            ]}>
            <Ionicons name="notifications-outline" size={25} color={colors.icon} />
            {pendingConfirmations > 0 && (
              <View style={styles.notificationBadge}>
                <ThemedText style={styles.notificationBadgeText}>
                  {pendingConfirmations > 99 ? '99+' : pendingConfirmations}
                </ThemedText>
              </View>
            )}
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.card}>
          <Pressable
            accessibilityLabel="Configurar categorías"
            accessibilityRole="button"
            onPress={() => router.push('/modal/categories')}
            style={({ pressed }) => [
              styles.settingsLink,
              pressed && styles.buttonPressed,
            ]}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">Categorías</ThemedText>
              <ThemedText style={styles.description}>
                Crea categorías y configura sus límites por período
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.icon} />
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.card}>
          <Pressable
            accessibilityLabel="Configurar medios de pago"
            accessibilityRole="button"
            onPress={() => router.push('/modal/payment-methods')}
            style={({ pressed }) => [styles.settingsLink, pressed && styles.buttonPressed]}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">Medios de pago</ThemedText>
              <ThemedText style={styles.description}>
                Configura efectivo, tarjetas y sus ciclos de facturación
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.icon} />
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.card}>
          <Pressable
            accessibilityLabel="Configurar movimientos recurrentes"
            accessibilityRole="button"
            onPress={() => router.push('/modal/recurring-expenses')}
            style={({ pressed }) => [styles.settingsLink, pressed && styles.buttonPressed]}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">Movimientos recurrentes</ThemedText>
              <ThemedText style={styles.description}>
                Gestiona gastos e ingresos programados
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.icon} />
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.card}>
          <Pressable
            accessibilityLabel="Gestionar deudas y cuotas"
            accessibilityRole="button"
            onPress={() => router.push('/modal/debts')}
            style={({ pressed }) => [styles.settingsLink, pressed && styles.buttonPressed]}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">Deudas y cuotas</ThemedText>
              <ThemedText style={styles.description}>
                Activa compras en cuotas y revisa saldos pendientes
              </ThemedText>
            </View>
            <Ionicons name="wallet-outline" size={22} color={colors.icon} />
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.card}>
          <View style={styles.settingRow}>
            <Pressable
              accessibilityLabel="Configurar periodicidad del recordatorio"
              accessibilityRole="button"
              onPress={() => router.push('/modal/movement-reminder')}
              style={({ pressed }) => [styles.reminderLink, pressed && styles.buttonPressed]}>
              <View style={styles.settingCopy}>
                <ThemedText type="subtitle">Recordatorio de movimientos</ThemedText>
                <ThemedText style={styles.description}>
                  {settings.movementReminderFrequency === 'daily'
                    ? 'Todos los días'
                    : `Todos los ${WEEKDAY_LABELS[settings.movementReminderWeekday] ?? 'domingos'}`} · {String(settings.movementReminderHour).padStart(2, '0')}:{String(settings.movementReminderMinute).padStart(2, '0')}
                </ThemedText>
              </View>
            </Pressable>
            <Switch
              accessibilityLabel="Activar recordatorio de movimientos"
              value={settings.movementReminderEnabled}
              onValueChange={(movementReminderEnabled) => {
                setMovementReminder({
                  movementReminderEnabled,
                  movementReminderFrequency: settings.movementReminderFrequency,
                  movementReminderWeekday: settings.movementReminderWeekday,
                  movementReminderHour: settings.movementReminderHour,
                  movementReminderMinute: settings.movementReminderMinute,
                }).catch((toggleError) => {
                  Alert.alert('No se pudo actualizar', toggleError instanceof Error ? toggleError.message : 'Inténtalo nuevamente.');
                });
              }}
              trackColor={{ true: colors.primary }}
            />
            <Pressable
              accessibilityLabel="Configurar periodicidad del recordatorio"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push('/modal/movement-reminder')}
              style={({ pressed }) => pressed && styles.buttonPressed}>
              <Ionicons name="chevron-forward" size={20} color={colors.icon} />
            </Pressable>
          </View>
        </ThemedView>

        <ThemedView style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">Tema oscuro</ThemedText>
              <ThemedText style={styles.description}>
                Habilitar el tema oscuro en toda la aplicación
              </ThemedText>
            </View>
            <Switch
              accessibilityLabel="Activar modo oscuro"
              onValueChange={(enabled) => {
                setThemePreference(enabled ? 'dark' : 'light').catch(() => {
                  Alert.alert('No se pudo cambiar', 'Inténtalo nuevamente.');
                });
              }}
              trackColor={{ true: colors.tint }}
              value={colorScheme === 'dark'}
            />
          </View>
        </ThemedView>

        <ThemedView style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">Bloqueo biométrico</ThemedText>
              <ThemedText style={styles.description}>
                {isBiometricAvailable
                  ? `Solicitar ${authenticationType} para acceder a la aplicación`
                  : 'Configura una huella o rostro en tu dispositivo para activar esta opción'}
              </ThemedText>
            </View>
            <Switch
              accessibilityLabel="Activar bloqueo biométrico"
              disabled={!isBiometricAvailable}
              onValueChange={(value) => {
                setBiometricEnabled(value).catch(() => {
                  Alert.alert('No se pudo cambiar', 'Inténtalo nuevamente.');
                });
              }}
              trackColor={{ true: colors.tint }}
              value={biometricEnabled}
            />
          </View>
        </ThemedView>

        <ThemedView style={styles.card}>
          {!isConnected ? (
            <>
              <ThemedText type="subtitle">Google Drive</ThemedText>
              <ThemedText style={styles.description}>
                Conecta tu cuenta de Google para guardar y restaurar tu información
                de forma segura
              </ThemedText>
              <ActionButton
                title={isWorking ? 'Conectando...' : 'Conectar con Google'}
                disabled={isWorking}
                onPress={() => {
                  login().catch(() => {
                    // El mensaje se muestra debajo.
                  });
                }}
                style={styles.googleButtonStyle}
                textStyle={styles.googleButtonTextStyle}
                icon={<GoogleLogo />}
              />
            </>
          ) : (
            <>
              <View style={styles.profile}>
                <View style={styles.avatar}>
                  <ThemedText style={styles.avatarText}>
                    {(user?.name?.[0] ?? 'G').toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.profileInfo}>
                  <ThemedText type="subtitle">
                    {user?.name ?? 'Usuario Google'}
                  </ThemedText>
                  <ThemedText style={styles.secondary}>
                    {user?.email ?? 'Correo no disponible'}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Estado</ThemedText>
                <ThemedText style={styles.connected}>Conectado con Google</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Último respaldo</ThemedText>
                <ThemedText style={styles.infoValue}>
                  {formatBackupDate(lastBackup?.modifiedTime)}
                </ThemedText>
              </View>
              <View style={styles.actions}>
                <ActionButton
                  title={isWorking ? 'Respaldando...' : 'Respaldar'}
                  disabled={isWorking}
                  onPress={runBackup}
                  style={colorScheme === 'dark' ? styles.darkActionButton : undefined}
                  textStyle={colorScheme === 'dark' ? styles.darkActionButtonText : undefined}
                />
                <ActionButton
                  title={isWorking ? 'Restaurando...' : 'Restaurar'}
                  disabled={isWorking || !lastBackup}
                  onPress={confirmRestore}
                  style={colorScheme === 'dark' ? styles.darkActionButton : undefined}
                  textStyle={colorScheme === 'dark' ? styles.darkActionButtonText : undefined}
                />
                <ActionButton
                  title="Cerrar sesión"
                  disabled={isWorking}
                  onPress={runLogout}
                  style={colorScheme === 'dark' ? styles.darkActionButton : undefined}
                  textStyle={colorScheme === 'dark' ? styles.darkActionButtonText : undefined}
                />
              </View>
            </>
          )}

          {isWorking && (
            <View style={styles.progress}>
              <ActivityIndicator size="small" />
              <ThemedText>Procesando...</ThemedText>
            </View>
          )}

          {error && (
            <>
              {Alert.alert(
                'Error',
                error,
                [{ text: 'OK' }],
                { cancelable: true }
              )}
            </>
          )}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 52,
    position: 'relative',
  },
  notificationButton: {
    position: 'absolute',
    right: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 1,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  card: {
    borderRadius: 12,
    padding: 18,
    elevation: 2,
    gap: 18,
  },
  description: {
    lineHeight: 21,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  settingCopy: {
    flex: 1,
    gap: 6,
  },
  settingsLink: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  reminderLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  secondary: {
    opacity: 0.7,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  infoLabel: {
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    opacity: 0.8,
  },
  connected: {
    fontWeight: '700',
  },
  actions: {
    gap: 10,
  },
  button: {
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontWeight: '700',
  },
  darkActionButton: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  darkActionButtonText: {
    color: '#11181C',
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  error: {
    lineHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  googleButtonStyle: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  googleButtonTextStyle: {
    color: '#444',
    fontWeight: '600',
    fontSize: 16,
  },
});
