import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  GoogleAuthService,
  type GoogleUser,
} from '@/services/GoogleAuthService';
import { SessionService } from '@/services/SessionService';
import { BackupService, type BackupMetadata } from '@/services/BackupService';
import { RestoreService } from '@/services/RestoreService';
import { GoogleDriveService, type DriveBackup } from '@/services/GoogleDriveService';
import { useDatabase } from '@/contexts/DatabaseContext';
import { t } from '@/lib/i18n';

type GoogleState = {
  user: GoogleUser | null;
  isLoading: boolean;
  isWorking: boolean;
  error: string | null;
  lastBackup: DriveBackup | null;
};

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return t('errors.unexpected');
}

export function useGoogle() {
  const { refresh } = useDatabase();

  const [state, setState] = useState<GoogleState>({
    user: null,
    isLoading: true,
    isWorking: false,
    error: null,
    lastBackup: null,
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
        }));

        if (user) {
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
      setState((current) => ({ ...current, user }));
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
      const result: BackupMetadata = await BackupService.backup(getDrive());
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
  }, [getDrive]);

  const restore = useCallback(async () => {
    setState((current) => ({
      ...current,
      isWorking: true,
      error: null,
    }));

    try {
      await RestoreService.restore(getDrive());
      await refresh();
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
  }, [getDrive, refresh, refreshBackupInfo]);

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
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        error: toMessage(error),
        isWorking: false,
      }));
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
    }),
    [state, login, backup, restore, logout, refreshBackupInfo]
  );
}
