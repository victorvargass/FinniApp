import React from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useThemePreference } from '@/contexts/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGoogle } from '@/hooks/useGoogle';

// Utils
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
                />
                <ActionButton
                  title={isWorking ? 'Restaurando...' : 'Restaurar'}
                  disabled={isWorking || !lastBackup}
                  onPress={confirmRestore}
                />
                <ActionButton
                  title="Cerrar sesión"
                  disabled={isWorking}
                  onPress={runLogout}
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
    paddingVertical: 12,
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
