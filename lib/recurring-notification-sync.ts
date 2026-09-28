export function shouldScheduleRecurringNotification({
  inboxKey,
  triggerTime,
  scheduledKeys,
  existingInboxKeys,
  now = Date.now(),
}: {
  inboxKey: string;
  triggerTime: number;
  scheduledKeys: ReadonlySet<string>;
  existingInboxKeys: ReadonlySet<string>;
  now?: number;
}): boolean {
  if (scheduledKeys.has(inboxKey)) return false;
  if (triggerTime <= now && existingInboxKeys.has(inboxKey)) return false;
  return true;
}
