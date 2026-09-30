import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  configureCrashMonitoring,
  getCrashMonitoringConsent,
  isCrashMonitoringConfigured,
  setCrashMonitoringConsent,
} from '@/services/CrashMonitoringService';

type CrashMonitoringContextValue = {
  configured: boolean;
  enabled: boolean;
  isReady: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
};

const CrashMonitoringContext = createContext<CrashMonitoringContextValue | null>(null);

export function CrashMonitoringProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    void getCrashMonitoringConsent()
      .then(async (consent) => {
        const activeMonitoring = await configureCrashMonitoring(consent);
        if (active) setEnabledState(activeMonitoring);
      })
      .catch(() => {
        if (active) setEnabledState(false);
      })
      .finally(() => {
        if (active) setIsReady(true);
      });
    return () => { active = false; };
  }, []);

  const setEnabled = useCallback(async (nextEnabled: boolean) => {
    if (nextEnabled && !isCrashMonitoringConfigured) return;
    try {
      await setCrashMonitoringConsent(nextEnabled);
      const activeMonitoring = await configureCrashMonitoring(nextEnabled);
      setEnabledState(activeMonitoring);
    } catch (error) {
      if (nextEnabled) await setCrashMonitoringConsent(false).catch(() => undefined);
      setEnabledState(false);
      throw error;
    }
  }, []);

  const value = useMemo(() => ({
    configured: isCrashMonitoringConfigured,
    enabled,
    isReady,
    setEnabled,
  }), [enabled, isReady, setEnabled]);

  return (
    <CrashMonitoringContext.Provider value={value}>
      {children}
    </CrashMonitoringContext.Provider>
  );
}

export function useCrashMonitoring(): CrashMonitoringContextValue {
  const context = useContext(CrashMonitoringContext);
  if (!context) throw new Error('useCrashMonitoring must be used inside CrashMonitoringProvider');
  return context;
}
