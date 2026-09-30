import { File, Paths } from 'expo-file-system';
import { fetch, type FetchRequestInit } from 'expo/fetch';

import { t } from '@/lib/i18n';
import { DATABASE_SCHEMA_VERSION } from '@/lib/database-schema';
import { selectObsoleteBackups } from '@/lib/backup-policy';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const BACKUP_NAME = 'gastosapp-backup.db';
const VERSIONED_BACKUP_PREFIX = 'gastosapp-backup-v';

export type DriveBackup = {
  id: string;
  name: string;
  modifiedTime: string;
};

type TokenProvider = () => Promise<string>;

export class GoogleDriveService {
  constructor(private readonly getAccessToken: TokenProvider) {}

  private async request(
    url: string,
    init: Omit<FetchRequestInit, 'headers'> = {}
  ): Promise<Response> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(url, {
      ...init,
      // expo/fetch's Android bridge expects headers as name/value pairs.
      headers: [['Authorization', `Bearer ${accessToken}`]],
    });

    if (!response.ok) {
      throw new Error(t('errors.googleDriveResponse', {
        status: response.status,
        details: '',
      }));
    }

    return response;
  }

  async listBackups(): Promise<DriveBackup[]> {
    const query = encodeURIComponent(
      `(name = '${BACKUP_NAME}' or name contains '${VERSIONED_BACKUP_PREFIX}') and trashed = false`
    );

    const response = await this.request(
      `${DRIVE_API}?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`
    );

    const data = (await response.json()) as { files?: DriveBackup[] };
    return data.files ?? [];
  }

  async getLatestBackup(): Promise<DriveBackup | null> {
    const backups = await this.listBackups();
    return backups[0] ?? null;
  }

  private async deleteFile(fileId: string): Promise<void> {
    await this.request(`${DRIVE_API}/${fileId}`, {
      method: 'DELETE',
    });
  }

  async uploadDatabase(uri: string): Promise<DriveBackup> {
    const file = new File(uri);

    const backups = await this.listBackups();
    const extension = file.name.endsWith('.finni') ? 'finni' : 'db';
    const versionedName = `${VERSIONED_BACKUP_PREFIX}${DATABASE_SCHEMA_VERSION}-${Date.now()}.${extension}`;

    const metadata = {
      name: versionedName,
      parents: ['appDataFolder'],
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], {
        type: 'application/json',
      })
    );
    // Expo File implements Blob and is supported by FormData in Expo SDK 54.
    form.append('file', file);

    const response = await this.request(
      `${UPLOAD_API}?uploadType=multipart&fields=id,name,modifiedTime`,
      {
        method: 'POST',
        body: form,
      }
    );

    const uploaded = (await response.json()) as DriveBackup;

    // Upload before cleaning up: a failed upload must never leave the user
    // without a valid backup. Keep several generations so a damaged-but-valid
    // state does not immediately replace the only recovery point.
    await Promise.allSettled(
      selectObsoleteBackups([uploaded, ...backups]).map((backup) => this.deleteFile(backup.id))
    );

    return uploaded;
  }

  async downloadDatabase(): Promise<File | null> {
    const backup = await this.getLatestBackup();
    if (!backup) return null;

    const response = await this.request(
      `${DRIVE_API}/${backup.id}?alt=media`
    );

    const extension = backup.name.endsWith('.finni') ? 'finni' : 'db';
    const file = new File(Paths.cache, `gastos-restore-${Date.now()}.${extension}`);
    file.write(await response.bytes());
    return file;
  }
}
