import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

const ONBOARDING_COMPLETE_KEY = '@finniapp/onboarding-complete-v1';

type OnboardingContextValue = {
  hasCompletedOnboarding: boolean;
  isOnboardingReady: boolean;
  completeOnboarding: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isOnboardingReady, setIsOnboardingReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
      .then((value) => {
        if (mounted) setHasCompletedOnboarding(value === 'true');
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setIsOnboardingReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<OnboardingContextValue>(() => ({
    hasCompletedOnboarding,
    isOnboardingReady,
    completeOnboarding: async () => {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      setHasCompletedOnboarding(true);
    },
  }), [hasCompletedOnboarding, isOnboardingReady]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error('useOnboarding debe usarse dentro de OnboardingProvider');
  return value;
}
