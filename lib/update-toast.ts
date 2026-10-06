type CurrentUpdateToastInput = {
  activeUpdateId: string | null;
  previousActiveUpdateId: string | null;
};

export function shouldShowCurrentUpdateToast({
  activeUpdateId,
  previousActiveUpdateId,
}: CurrentUpdateToastInput): boolean {
  return activeUpdateId != null
    && previousActiveUpdateId != null
    && activeUpdateId !== previousActiveUpdateId;
}
