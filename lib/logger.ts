import AsyncStorage from '@react-native-async-storage/async-storage';

export type LogContext =
  | 'database.initialize'
  | 'database.refresh'
  | 'database.restore'
  | 'report.export';

export type AppDiagnostic = {
  timestamp: string;
  context: LogContext;
  category: string;
};

const DIAGNOSTICS_KEY = '@finniapp/diagnostics';
const MAX_DIAGNOSTICS = 20;
let writeTail: Promise<void> = Promise.resolve();

function parseDiagnostics(value: string | null): AppDiagnostic[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is AppDiagnostic => {
      if (typeof item !== 'object' || item == null) return false;
      const candidate = item as Partial<AppDiagnostic>;
      return typeof candidate.timestamp === 'string'
        && typeof candidate.context === 'string'
        && typeof candidate.category === 'string';
    }).slice(-MAX_DIAGNOSTICS);
  } catch {
    return [];
  }
}

/** Stores only an error category and code location; messages and user data are never serialized. */
export function logAppError(context: LogContext, error: unknown): void {
  const diagnostic: AppDiagnostic = {
    timestamp: new Date().toISOString(),
    context,
    category: error instanceof Error ? error.name : 'UnknownError',
  };

  writeTail = writeTail
    .then(async () => {
      const current = parseDiagnostics(await AsyncStorage.getItem(DIAGNOSTICS_KEY));
      await AsyncStorage.setItem(
        DIAGNOSTICS_KEY,
        JSON.stringify([...current, diagnostic].slice(-MAX_DIAGNOSTICS))
      );
    })
    .catch(() => undefined);

  if (__DEV__) console.error(`[${context}] ${diagnostic.category}`);
}

export async function getAppDiagnostics(): Promise<AppDiagnostic[]> {
  await writeTail;
  return parseDiagnostics(await AsyncStorage.getItem(DIAGNOSTICS_KEY));
}

export async function clearAppDiagnostics(): Promise<void> {
  await writeTail;
  await AsyncStorage.removeItem(DIAGNOSTICS_KEY);
}
