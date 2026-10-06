import { Platform } from 'react-native';
import type { Href } from 'expo-router';

import NativeNotificationMovements, { type NativePendingMovement } from '@/modules/notification-movements';
import { toDateString } from '@/lib/format';
import { toTimeString } from '@/lib/event-time';
import { findClosestPaymentMethod } from '@/lib/notification-payment-method-match';
import type { PaymentMethod } from '@/lib/types';

export type PendingMovementCandidate = NativePendingMovement;

export const notificationMovementCaptureSupported = Platform.OS === 'android' && NativeNotificationMovements != null;

export async function isNotificationMovementAccessEnabled(): Promise<boolean> {
  return notificationMovementCaptureSupported
    ? NativeNotificationMovements!.isAccessEnabledAsync()
    : false;
}

export async function openNotificationMovementAccessSettings(): Promise<void> {
  await NativeNotificationMovements?.openAccessSettingsAsync();
}

export async function getPendingNotificationMovements(): Promise<PendingMovementCandidate[]> {
  return NativeNotificationMovements?.getPendingAsync() ?? [];
}

export async function claimNextPendingNotificationMovement(): Promise<PendingMovementCandidate | null> {
  return NativeNotificationMovements?.claimNextPendingAsync() ?? null;
}

export async function removePendingNotificationMovement(id: string): Promise<void> {
  await NativeNotificationMovements?.removePendingAsync(id);
}

export function pendingMovementHref(
  candidate: PendingMovementCandidate,
  paymentMethods: readonly Pick<PaymentMethod, 'id' | 'name' | 'type' | 'active'>[]
): Href {
  const occurredAt = new Date(candidate.occurredAt);
  const matchedPaymentMethod = findClosestPaymentMethod(candidate, paymentMethods);
  const params = {
    candidateId: candidate.id,
    initialName: candidate.name,
    initialAmount: String(candidate.amount),
    initialDate: toDateString(occurredAt),
    initialTime: toTimeString(occurredAt),
  };
  if (candidate.suggestedType === 'income') return {
    pathname: '/modal/income-form',
    params: {
      ...params,
      ...(matchedPaymentMethod ? { initialPaymentMethodId: String(matchedPaymentMethod.id) } : {}),
    },
  };
  if (candidate.suggestedType === 'transfer') return {
    pathname: '/modal/account-transfer-form',
    params: {
      ...params,
      ...(matchedPaymentMethod ? { sourcePaymentMethodId: String(matchedPaymentMethod.id) } : {}),
    },
  };
  return {
    pathname: '/modal/expense-form',
    params: {
      ...params,
      ...(candidate.suggestedType === 'card-payment'
        ? {
            cardPayment: 'true',
            ...(matchedPaymentMethod ? { initialCreditPaymentTargetId: String(matchedPaymentMethod.id) } : {}),
          }
        : matchedPaymentMethod ? { initialPaymentMethodId: String(matchedPaymentMethod.id) } : {}),
    },
  };
}
