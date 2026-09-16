import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { APP_LOCALE, t } from './i18n';

type UpdateIdentity = {
  id: string | null;
  createdAt: Date | null;
};

export type PublishedUpdateStatus =
  | { kind: 'checking' }
  | { kind: 'current' }
  | { kind: 'available'; update: UpdateIdentity }
  | { kind: 'notConfigured' }
  | { kind: 'unavailable' }
  | { kind: 'rollback' };

export function getInstalledVersion(): string {
  return Constants.expoConfig?.version ?? t('settings.unknown');
}

export function getActiveUpdate(): UpdateIdentity {
  return { id: Updates.updateId, createdAt: Updates.createdAt };
}

export function formatUpdateIdentity(update: UpdateIdentity, fullId = false): string {
  if (!update.id) return t('settings.updateUnknown');
  const id = fullId ? update.id : update.id.slice(0, 8);
  const date = update.createdAt?.toLocaleString(APP_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return date ? `${id} · ${date}` : id;
}

export function formatPublishedUpdate(
  status: PublishedUpdateStatus,
  active: UpdateIdentity,
  fullId = false
): string {
  switch (status.kind) {
    case 'checking': return t('settings.updateChecking');
    case 'current': return `${formatUpdateIdentity(active, fullId)} · ${t('settings.updateCurrent')}`;
    case 'available': return formatUpdateIdentity(status.update, fullId);
    case 'notConfigured': return t('settings.updateNotConfigured');
    case 'rollback': return t('settings.updateRollback');
    case 'unavailable': return t('settings.updateUnavailable');
  }
}

export async function checkPublishedUpdate(): Promise<PublishedUpdateStatus> {
  if (!Updates.isEnabled || !Updates.channel) return { kind: 'notConfigured' };
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isRollBackToEmbedded) return { kind: 'rollback' };
    if (!result.isAvailable) return { kind: 'current' };
    const manifest = result.manifest;
    const createdAt = 'createdAt' in manifest ? new Date(manifest.createdAt) : null;
    return { kind: 'available', update: { id: manifest.id, createdAt } };
  } catch {
    return { kind: 'unavailable' };
  }
}
