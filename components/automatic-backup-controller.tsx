import { useEffect } from 'react';

import { isAutomaticBackupDue } from '@/lib/backup-policy';
import { BackupService } from '@/services/BackupService';
import { GoogleDriveService } from '@/services/GoogleDriveService';
import { SessionService } from '@/services/SessionService';
import { BackupCredentialService } from '@/services/BackupCredentialService';
import { BackupPreferencesService } from '@/services/BackupPreferencesService';

export function AutomaticBackupController({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let active = true;

    void (async () => {
      try {
        const [previous, frequency] = await Promise.all([
          BackupPreferencesService.getLastAutomaticBackup(),
          BackupPreferencesService.getFrequency(),
        ]);
        if (!isAutomaticBackupDue(previous, Date.now(), frequency)) return;
        const user = await SessionService.restore();
        if (!active || !user) return;
        const passphrase = await BackupCredentialService.getPassphrase(user.id);
        if (!passphrase) return;
        const drive = new GoogleDriveService(() => SessionService.getAccessToken());
        const previousFingerprint = await BackupPreferencesService.getLastFingerprint(user.id);
        const result = await BackupService.backup(drive, passphrase, {
          skipIfFingerprint: previousFingerprint,
        });
        if (!active) return;
        await BackupPreferencesService.recordOperationMetrics(result.metrics).catch(() => undefined);
        if (result.skipped) {
          await BackupPreferencesService.recordAutomaticBackupCheck();
        } else {
          await BackupPreferencesService.recordSuccessfulBackup(user.id, result.fingerprint);
        }
      } catch {
        // Automatic backups are best effort. The manual Drive screen keeps the
        // actionable error state and can renew permissions when required.
      }
    })();

    return () => { active = false; };
  }, [enabled]);

  return null;
}
