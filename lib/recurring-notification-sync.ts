export function shouldScheduleRecurringNotification({
  inboxKey,
  triggerTime,
  scheduledKeys,
  notifiedKeys,
  now = Date.now(),
}: {
  inboxKey: string;
  triggerTime: number;
  scheduledKeys: ReadonlySet<string>;
  notifiedKeys: ReadonlySet<string>;
  now?: number;
}): boolean {
  if (scheduledKeys.has(inboxKey)) return false;
  if (triggerTime <= now && notifiedKeys.has(inboxKey)) return false;
  return true;
}
