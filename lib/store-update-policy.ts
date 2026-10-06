export type PlatformVersionPolicy = {
  latestVersion: string;
  minimumVersion: string;
  storeUrl: string;
};

export type StoreUpdateStatus =
  | { kind: 'current' }
  | { kind: 'unavailable' }
  | {
      kind: 'available';
      latestVersion: string;
      required: boolean;
      storeUrl: string;
    };

export function compareVersions(left: string, right: string): number {
  const normalize = (value: string) => value
    .split('.')
    .map((segment) => Number.parseInt(segment.replace(/\D.*$/, ''), 10) || 0);
  const leftParts = normalize(left);
  const rightParts = normalize(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
}

export function evaluateStoreUpdate(
  currentVersion: string,
  policy: PlatformVersionPolicy | undefined
): StoreUpdateStatus {
  if (!policy?.latestVersion || !policy.minimumVersion || !policy.storeUrl) {
    return { kind: 'unavailable' };
  }
  if (compareVersions(currentVersion, policy.latestVersion) >= 0) {
    return { kind: 'current' };
  }
  return {
    kind: 'available',
    latestVersion: policy.latestVersion,
    required: compareVersions(currentVersion, policy.minimumVersion) < 0,
    storeUrl: policy.storeUrl,
  };
}
