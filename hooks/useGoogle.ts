import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  GoogleAuthService,
  type GoogleUser,
} from '@/services/GoogleAuthService';
import { SessionService } from '@/services/SessionService';
import { BackupService } from '@/services/BackupService';
import { RestoreService } from '@/services/RestoreService';
import { GoogleDriveService, type DriveBackup } from '@/services/GoogleDriveService';
import { usePreferenceDatabase } from '@/contexts/DatabaseDomainContexts';
import { t } from '@/lib/i18n';
import { BackupCredentialService } from '@/services/BackupCredentialService';
import { BackupPreferencesService } from '@/services/BackupPreferencesService';
import { DRIVE_BACKUP_RETENTION, type BackupFrequency } from '@/lib/backup-policy';
import type {
  BackupOperation,
  BackupOperationMetrics,
  BackupProgress,
} from '@/lib/backup-operation';

type GoogleState = {
  user: GoogleUser | null;
  isLoading: boolean;
  isWorking: boolean;
  operation: BackupOperation | 'session' | null;
  progress: BackupProgress | null;
  lastOperationMetrics: BackupOperationMetrics | null;
  error: string | null;
  lastBackup: DriveBackup | null;
  backups: DriveBackup[];
  hasBackupPassphrase: boolean;
  backupFrequency: BackupFrequency;
};

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return t('errors.unexpected');
}

export function useGoogle() {
  const { runDatabaseMaintenance } = usePreferenceDatabase();

  const [state, setState] = useState<GoogleState>({
    user: null,
    isLoading: true,
    isWorking: false,
    operation: null,
    progress: null,
    lastOperationMetrics: null,
    error: null,
    lastBackup: null,
    backups: [],
    hasBackupPassphrase: false,
    backupFrequency: 'daily',
  });

  const getDrive = useCallback(
    () => new GoogleDriveService(() => SessionService.getAccessToken()),
    []
  );

  const refreshBackupInfo = useCallback(async () => {
    if (!GoogleAuthService.getCurrentUser()) {
      setState((current) => ({ ...current, lastBackup: null, backups: [] }));
      return [];
    }

    const drive = getDrive();
    const backups = await drive.enforceRetention(await drive.listBackups());
    setState((current) => ({ ...current, lastBackup: backups[0] ?? null, backups }));
    return backups;
  }, [getDrive]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [user, backupFrequency] = await Promise.all([
          SessionService.restore(),
          BackupPreferencesService.getFrequency(),
        ]);

        if (!active) return;

        setState((current) => ({
          ...current,
          user,
          isLoading: false,
          hasBackupPassphrase: false,
          backupFrequency,
        }));

        if (user) {
          const passphrase = await BackupCredentialService.getPassphrase(user.id);
          if (active) setState((current) => ({ ...current, hasBackupPassphrase: !!passphrase }));
          await refreshBackupInfo();
        }
      } catch (error) {
        if (!active) return;
        setState((current) => ({
          ...current,
          isLoading: false,
          error: toMessage(error),
        }));
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshBackupInfo]);

  const login = useCallback(async () => {
    setState((current) => ({
      ...current,
      isWorking: true,
      operation: 'session',
      error: null,
    }));

    try {
      const user = await SessionService.signIn();
      const passphrase = await BackupCredentialService.getPassphrase(user.id);
      setState((current) => ({ ...current, user, hasBackupPassphrase: !!passphrase }));
      await refreshBackupInfo();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: toMessage(error),
      }));
      throw error;
    } finally {
      setState((current) => ({ ...current, isWorking: false, operation: null }));
    }
  }, [refreshBackupInfo]);

  const backup = useCallback(async () => {
    setState((current) => ({
      ...current,
      isWorking: true,
      operation: 'backup',
      progress: null,
      error: null,
    }));

    try {
      const accountId = state.user?.id;
      if (!accountId) throw new Error(t('errors.googleAuthRequired'));
      const result = await BackupService.backup(getDrive(), {
        onProgress: (progress) => setState((current) => ({ ...current, progress })),
      });
      await Promise.all([
        BackupPreferencesService.recordSuccessfulBackup(accountId, result.fingerprint),
        BackupPreferencesService.recordOperationMetrics(result.metrics),
      ]).catch(() => undefined);
      setState((current) => ({
        ...current,
        lastBackup: result.metadata ?? current.lastBackup,
        backups: result.metadata
          ? [result.metadata, ...current.backups.filter((item) => item.id !== result.metadata?.id)]
              .slice(0, DRIVE_BACKUP_RETENTION)
          : current.backups,
        lastOperationMetrics: result.metrics,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error: toMessage(error),
      }));
      throw error;
    } finally {
      setState((current) => ({
        ...current,
        isWorking: false,
        operation: null,
        progress: null,
      }));
    }
  }, [getDrive, state.user?.id]);

  const restore = useCallback(async (selectedBackup?: DriveBackup) => {
    setState((current) => ({
      ...current,
      isWorking: true,
      operation: 'restore',
      progress: null,
      error: null,
    }));

    try {
      const accountId = state.user?.id;
      const passphrase = accountId
        ? await BackupCredentialService.getPassphrase(accountId)
        : null;
      let metrics: BackupOperationMetrics | null = null;
      await runDatabaseMaintenance(async () => {
        metrics = await RestoreService.restore(
          getDrive(),
          {
            backup: selectedBackup,
            passphrase,
            onProgress: (progress) => setState((current) => ({ ...current, progress })),
          }
        );
      });
      await refreshBackupInfo();
      if (metrics) {
        await BackupPreferencesService.recordOperationMetrics(metrics).catch(() => undefined);
      }
      setState((current) => ({ ...current, lastOperationMetrics: metrics }));
      setState((current) => ({
        ...current,
        hasBackupPassphrase: Boolean(accountId && passphrase),
      }));
    } catch (error) {
      if (error instanceof Error && error.message === t('errors.invalidBackupPassphrase')) {
        await BackupCredentialService.clear().catch(() => undefined);
      }
      setState((current) => ({
        ...current,
        hasBackupPassphrase: error instanceof Error && error.message === t('errors.invalidBackupPassphrase')
          ? false
          : current.hasBackupPassphrase,
        error: toMessage(error),
      }));
      throw error;
    } finally {
      setState((current) => ({
        ...current,
        isWorking: false,
        operation: null,
        progress: null,
      }));
    }
  }, [getDrive, runDatabaseMaintenance, refreshBackupInfo, state.user?.id]);

  const setBackupFrequency = useCallback(async (frequency: BackupFrequency) => {
    await BackupPreferencesService.setFrequency(frequency);
    setState((current) => ({ ...current, backupFrequency: frequency }));
  }, []);

  const logout = useCallback(async () => {
    setState((current) => ({
      ...current,
      isWorking: true,
      operation: 'session',
      error: null,
    }));

    try {
      await SessionService.signOut();
      setState({
        user: null,
        isLoading: false,
        isWorking: false,
        operation: null,
        progress: null,
        lastOperationMetrics: null,
        error: null,
        lastBackup: null,
        backups: [],
        hasBackupPassphrase: false,
        backupFrequency: await BackupPreferencesService.getFrequency(),
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        error: toMessage(error),
        isWorking: false,
        operation: null,
      }));
      throw error;
    }
  }, []);

  return useMemo(
    () => ({
      ...state,
      isConnected: !!state.user,
      login,
      backup,
      restore,
      logout,
      refreshBackupInfo,
      setBackupFrequency,
    }),
    [
      state,
      login,
      backup,
      restore,
      logout,
      refreshBackupInfo,
      setBackupFrequency,
    ]
  );
}
