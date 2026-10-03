import { requireOptionalNativeModule } from 'expo';

export type NativePendingMovement = {
  id: string;
  sourceApp: string;
  name: string;
  amount: number;
  currency: 'CLP';
  occurredAt: number;
  suggestedType: 'expense' | 'income' | 'card-payment' | 'transfer';
  promptedAt?: number | null;
};

export type NotificationMovementsNativeModule = {
  isAccessEnabledAsync(): Promise<boolean>;
  openAccessSettingsAsync(): Promise<void>;
  getPendingAsync(): Promise<NativePendingMovement[]>;
  claimNextPendingAsync(): Promise<NativePendingMovement | null>;
  removePendingAsync(id: string): Promise<void>;
};

export default requireOptionalNativeModule<NotificationMovementsNativeModule>('FinniNotificationMovements');
