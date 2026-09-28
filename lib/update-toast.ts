import type { PublishedUpdateStatus } from './app-update-info';

type CurrentUpdateToastInput = {
  activeUpdateId: string | null;
  lastConfirmedUpdateId: string | null;
  status: PublishedUpdateStatus;
};

export function shouldShowCurrentUpdateToast({
  activeUpdateId,
  lastConfirmedUpdateId,
  status,
}: CurrentUpdateToastInput): boolean {
  return activeUpdateId != null
    && activeUpdateId !== lastConfirmedUpdateId
    && status.kind === 'current';
}
