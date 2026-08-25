import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = '@gastosapp/biometric-lock-enabled';
const BACKGROUND_GRACE_PERIOD_MS = 10_000;

type BiometricContextValue = {
  enabled: boolean;
  isAvailable: boolean;
  isChecking: boolean;
  isLocked: boolean;
  authenticationType: string;
  authenticate: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<boolean>;
};

const BiometricContext = createContext<BiometricContextValue | null>(null);

function getAuthenticationType(types: LocalAuthentication.AuthenticationType[]) {
  // Android reports supported hardware, not the method the system prompt will
  // ultimately use. It can still choose a fingerprint or the device PIN.
  if (Platform.OS === 'android') {
    return 'la biometría de tu dispositivo';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Touch ID';
  }
  return 'biometría';
}

export function BiometricProvider({ children }: PropsWithChildren) {
  const [enabled, setEnabledState] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [authenticationType, setAuthenticationType] = useState('biometría');
  const enabledRef = useRef(false);
  const isLockedRef = useRef(false);
  const authenticatingRef = useRef(false);
  const backgroundStartedAtRef = useRef<number | null>(null);

  const authenticate = useCallback(async () => {
    if (
      Platform.OS === 'web' ||
      AppState.currentState !== 'active' ||
      authenticatingRef.current
    ) {
      return false;
    }

    authenticatingRef.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Comprueba que eres tú',
        promptSubtitle: 'Confirma tu identidad para ver tus datos',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar código del dispositivo',
        biometricsSecurityLevel: 'strong',
      });

      if (result.success) {
        isLockedRef.current = false;
        setIsLocked(false);
      }
      return result.success;
    } catch {
      return false;
    } finally {
      authenticatingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        if (Platform.OS === 'web') return;

        const [storedEnabled, hasHardware, securityLevel, types] = await Promise.all([
          AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY),
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.getEnrolledLevelAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ]);
        if (!mounted) return;

        const available =
          hasHardware &&
          securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG;
        const shouldLock = storedEnabled === 'true' && available;
        setIsAvailable(available);
        setAuthenticationType(getAuthenticationType(types));
        setEnabledState(shouldLock);
        enabledRef.current = shouldLock;
        isLockedRef.current = shouldLock;
        setIsLocked(shouldLock);
      } finally {
        if (mounted) setIsChecking(false);
      }
    }

    initialize();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let lockTimer: ReturnType<typeof setTimeout> | null = null;

    const lockApp = () => {
      if (!enabledRef.current || isLockedRef.current) return;
      isLockedRef.current = true;
      setIsLocked(true);
    };

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        if (Platform.OS === 'android' && authenticatingRef.current) {
          LocalAuthentication.cancelAuthenticate().catch(() => {
            // El sistema también puede haber cerrado el prompt por su cuenta.
          });
        }

        backgroundStartedAtRef.current = Date.now();
        if (enabledRef.current && !isLockedRef.current) {
          lockTimer = setTimeout(lockApp, BACKGROUND_GRACE_PERIOD_MS);
        }
      }

      if (nextState === 'active' && backgroundStartedAtRef.current !== null) {
        if (lockTimer) {
          clearTimeout(lockTimer);
          lockTimer = null;
        }

        const timeInBackground = Date.now() - backgroundStartedAtRef.current;
        backgroundStartedAtRef.current = null;
        if (timeInBackground >= BACKGROUND_GRACE_PERIOD_MS) lockApp();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      if (lockTimer) clearTimeout(lockTimer);
      subscription.remove();
    };
  }, []);

  const setEnabled = useCallback(
    async (nextEnabled: boolean) => {
      if (nextEnabled) {
        if (!isAvailable || !(await authenticate())) return false;
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      } else {
        await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
      }

      enabledRef.current = nextEnabled;
      isLockedRef.current = false;
      setEnabledState(nextEnabled);
      setIsLocked(false);
      return true;
    },
    [authenticate, isAvailable]
  );

  return (
    <BiometricContext.Provider
      value={{
        enabled,
        isAvailable,
        isChecking,
        isLocked,
        authenticationType,
        authenticate,
        setEnabled,
      }}
    >
      {children}
    </BiometricContext.Provider>
  );
}

export function useBiometric() {
  const value = useContext(BiometricContext);
  if (!value) throw new Error('useBiometric debe usarse dentro de BiometricProvider');
  return value;
}
