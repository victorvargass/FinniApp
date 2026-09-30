import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import { isAutomaticBackupDue } from '@/lib/backup-policy';
import { BackupService } from '@/services/BackupService';
import { GoogleDriveService } from '@/services/GoogleDriveService';
import { SessionService } from '@/services/SessionService';

const LAST_AUTOMATIC_BACKUP_KEY = '@finniapp/last-automatic-backup';
export function AutomaticBackupController({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let active = true;

    void (async () => {
      try {
        const previous = await AsyncStorage.getItem(LAST_AUTOMATIC_BACKUP_KEY);
        if (!isAutomaticBackupDue(previous)) return;
        const user = await SessionService.restore();
        if (!active || !user) return;
        const drive = new GoogleDriveService(() => SessionService.getAccessToken());
        await BackupService.backup(drive);
        if (active) await AsyncStorage.setItem(LAST_AUTOMATIC_BACKUP_KEY, String(Date.now()));
      } catch {
        // Automatic backups are best effort. The manual Drive screen keeps the
        // actionable error state and can renew permissions when required.
      }
    })();

    return () => { active = false; };
  }, [enabled]);

  return null;
}
