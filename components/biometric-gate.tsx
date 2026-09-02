import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useBiometric } from '@/contexts/BiometricContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

export function BiometricGate({ children }: React.PropsWithChildren) {
  const { authenticate, authenticationType, isChecking, isLocked } = useBiometric();
  const autoPromptedRef = useRef(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') autoPromptedRef.current = false;
      setAppState(nextState);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isLocked) {
      autoPromptedRef.current = false;
      return;
    }

    if (appState === 'active' && !autoPromptedRef.current) {
      const timer = setTimeout(() => {
        autoPromptedRef.current = true;
        authenticate();
      }, 250);

      return () => clearTimeout(timer);
    }
  }, [appState, authenticate, isLocked]);

  if (isChecking) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (isLocked) {
    return (
      <ThemedView style={styles.centered}>
        <View style={[styles.iconCircle, { backgroundColor: `${colors.tint}18` }]}>
          <Ionicons name="lock-closed" size={42} color={colors.tint} />
        </View>
        <ThemedText type="title" style={styles.title}>{t('biometric.appLocked')}</ThemedText>
        <ThemedText style={styles.description}>
          {t('biometric.accessWith', { authenticationType })}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={authenticate}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.tint },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="finger-print" size={22} color={colorScheme === 'dark' ? '#11181C' : '#fff'} />
          <ThemedText style={[styles.buttonText, { color: colorScheme === 'dark' ? '#11181C' : '#fff' }]}>
            {t('biometric.unlock')}
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { textAlign: 'center' },
  description: { textAlign: 'center', opacity: 0.72, lineHeight: 22 },
  button: {
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  buttonText: { fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
