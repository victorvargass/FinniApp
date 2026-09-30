import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  GoogleAuthService,
  type GoogleUser,
} from '@/services/GoogleAuthService';
import { SessionService } from '@/services/SessionService';
import { BackupService, type BackupMetadata } from '@/services/BackupService';
import { RestoreService } from '@/services/RestoreService';
import { GoogleDriveService, type DriveBackup } from '@/services/GoogleDriveService';
import { useDatabaseActions } from '@/contexts/DatabaseContext';
import { t } from '@/lib/i18n';
import { BackupCredentialService } from '@/services/BackupCredentialService';

type GoogleState = {
  user: GoogleUser | null;
  isLoading: boolean;
  isWorking: boolean;
  error: string | null;
  lastBackup: DriveBackup | null;
  hasBackupPassphrase: boolean;
};

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return t('errors.unexpected');
}

export function useGoogle() {
  const { runDatabaseMaintenance } = useDatabaseActions();

  const [state, setState] = useState<GoogleState>({
    user: null,
    isLoading: true,
    isWorking: false,
    error: null,
    lastBackup: null,
    hasBackupPassphrase: false,
  });

  const getDrive = useCallback(
    () => new GoogleDriveService(() => SessionService.getAccessToken()),
    []
  );

  const refreshBackupInfo = useCallback(async () => {
    if (!GoogleAuthService.getCurrentUser()) {
      setState((current) => ({ ...current, lastBackup: null }));
      return;
    }

    const backup = await getDrive().getLatestBackup();
    setState((current) => ({ ...current, lastBackup: backup }));
  }, [getDrive]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const user = await SessionService.restore();

        if (!active) return;

        setState((current) => ({
          ...current,
          user,
          isLoading: false,
          hasBackupPassphrase: false,
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
      setState((current) => ({ ...current, isWorking: false }));
    }
  }, [refreshBackupInfo]);

  const backup = useCallback(async () => {
    setState((current) => ({
      ...current,
      isWorking: true,
      error: null,
    }));

    try {
      const accountId = state.user?.id;
      const passphrase = accountId
        ? await BackupCredentialService.getPassphrase(accountId)
        : null;
      if (!passphrase) throw new Error(t('errors.backupPassphraseRequired'));
      const result: BackupMetadata = await BackupService.backup(getDrive(), passphrase);
      setState((current) => ({
        ...current,
        lastBackup: {
          id: result.id,
          name: result.name,
          modifiedTime: result.modifiedTime,
        },
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error: toMessage(error),
      }));
      throw error;
    } finally {
      setState((current) => ({ ...current, isWorking: false }));
    }
  }, [getDrive, state.user?.id]);

  const restore = useCallback(async () => {
    setState((current) => ({
      ...current,
      isWorking: true,
      error: null,
    }));

    try {
      const accountId = state.user?.id;
      const passphrase = accountId
        ? await BackupCredentialService.getPassphrase(accountId)
        : null;
      await runDatabaseMaintenance(() => RestoreService.restore(getDrive(), passphrase));
      await refreshBackupInfo();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: toMessage(error),
      }));
      throw error;
    } finally {
      setState((current) => ({ ...current, isWorking: false }));
    }
  }, [getDrive, runDatabaseMaintenance, refreshBackupInfo, state.user?.id]);

  const saveBackupPassphrase = useCallback(async (passphrase: string) => {
    const accountId = state.user?.id;
    if (!accountId) throw new Error(t('errors.googleAuthRequired'));
    await BackupCredentialService.setPassphrase(accountId, passphrase);
    setState((current) => ({ ...current, hasBackupPassphrase: true, error: null }));
  }, [state.user?.id]);

  const logout = useCallback(async () => {
    setState((current) => ({
      ...current,
      isWorking: true,
      error: null,
    }));

    try {
      await SessionService.signOut();
      setState({
        user: null,
        isLoading: false,
        isWorking: false,
        error: null,
        lastBackup: null,
        hasBackupPassphrase: false,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        error: toMessage(error),
        isWorking: false,
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
      saveBackupPassphrase,
    }),
    [state, login, backup, restore, logout, refreshBackupInfo, saveBackupPassphrase]
  );
}
