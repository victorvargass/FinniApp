import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from './i18n';

export type LogContext =
  | 'database.initialize'
  | 'database.refresh'
  | 'database.restore'
  | 'report.export';

export type AppDiagnostic = {
  timestamp: string;
  context: LogContext;
  category: string;
  code: string;
  stage: DiagnosticStage;
  nativeOperation: string | null;
  backupSizeBytes: number | null;
  backupSchemaVersion: number | null;
  expectedSchemaVersion: number | null;
};

export type DiagnosticStage =
  | 'download'
  | 'validation'
  | 'compatibility'
  | 'opening'
  | 'replacement'
  | 'migration'
  | 'refresh'
  | 'export'
  | 'unknown';

export type DiagnosticMetadata = Partial<Pick<
  AppDiagnostic,
  'stage' | 'code' | 'backupSizeBytes' | 'backupSchemaVersion' | 'expectedSchemaVersion'
>>;

type DiagnosableError = Error & { diagnosticMetadata?: DiagnosticMetadata };

export function attachDiagnosticMetadata(error: unknown, metadata: DiagnosticMetadata): Error {
  const diagnosable: DiagnosableError = error instanceof Error ? error : new Error('Unknown error');
  diagnosable.diagnosticMetadata = { ...diagnosable.diagnosticMetadata, ...metadata };
  return diagnosable;
}

export function getDiagnosticMetadata(error: unknown): DiagnosticMetadata {
  return error instanceof Error
    ? ((error as DiagnosableError).diagnosticMetadata ?? {})
    : {};
}

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
    }).map((item) => ({
      ...item,
      code: typeof item.code === 'string' ? item.code : 'UNKNOWN_ERROR',
      stage: typeof item.stage === 'string' ? item.stage : stageForContext(item.context),
      nativeOperation: typeof item.nativeOperation === 'string' ? item.nativeOperation : null,
      backupSizeBytes: typeof item.backupSizeBytes === 'number' ? item.backupSizeBytes : null,
      backupSchemaVersion: typeof item.backupSchemaVersion === 'number' ? item.backupSchemaVersion : null,
      expectedSchemaVersion: typeof item.expectedSchemaVersion === 'number' ? item.expectedSchemaVersion : null,
    })).slice(-MAX_DIAGNOSTICS);
  } catch {
    return [];
  }
}

function stageForContext(context: string): DiagnosticStage {
  if (context === 'database.restore') return 'opening';
  if (context === 'database.initialize') return 'migration';
  if (context === 'database.refresh') return 'refresh';
  if (context === 'report.export') return 'export';
  return 'unknown';
}

function classifyError(context: LogContext, error: unknown): Pick<AppDiagnostic, 'code' | 'stage' | 'nativeOperation'> {
  const message = error instanceof Error ? error.message : '';
  const nativeOperation = message.match(/(?:NativeDatabase|NativeStatement)\.[A-Za-z]+Async/)?.[0] ?? null;
  const sqliteCode = message.match(/\bSQLITE_[A-Z_]+\b/)?.[0];

  if (message === t('errors.emptyBackup')) return { code: 'BACKUP_EMPTY', stage: 'validation', nativeOperation };
  if (message === t('errors.invalidBackupIntegrity')) return { code: 'BACKUP_INTEGRITY_FAILED', stage: 'validation', nativeOperation };
  if (message === t('errors.invalidBackupRelations')) return { code: 'BACKUP_RELATIONS_INVALID', stage: 'validation', nativeOperation };
  if (message === t('errors.invalidBackupVersion')) return { code: 'BACKUP_VERSION_INCOMPATIBLE', stage: 'compatibility', nativeOperation };
  if (message === t('errors.noDriveBackup')) return { code: 'DRIVE_BACKUP_NOT_FOUND', stage: 'download', nativeOperation };

  return {
    code: sqliteCode ?? (nativeOperation ? 'NATIVE_SQLITE_ERROR' : `${context.toUpperCase().replaceAll('.', '_')}_FAILED`),
    stage: stageForContext(context),
    nativeOperation,
  };
}

/** Stores only an error category and code location; messages and user data are never serialized. */
export function logAppError(context: LogContext, error: unknown, metadata: DiagnosticMetadata = {}): void {
  const classified = classifyError(context, error);
  const attached = getDiagnosticMetadata(error);
  const diagnostic: AppDiagnostic = {
    timestamp: new Date().toISOString(),
    context,
    category: error instanceof Error ? error.name : 'UnknownError',
    code: metadata.code ?? attached.code ?? classified.code,
    stage: metadata.stage ?? attached.stage ?? classified.stage,
    nativeOperation: classified.nativeOperation,
    backupSizeBytes: metadata.backupSizeBytes ?? attached.backupSizeBytes ?? null,
    backupSchemaVersion: metadata.backupSchemaVersion ?? attached.backupSchemaVersion ?? null,
    expectedSchemaVersion: metadata.expectedSchemaVersion ?? attached.expectedSchemaVersion ?? null,
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

  if (__DEV__) console.error(`[${context}] ${diagnostic.code}`);
}

export async function getAppDiagnostics(): Promise<AppDiagnostic[]> {
  await writeTail;
  return parseDiagnostics(await AsyncStorage.getItem(DIAGNOSTICS_KEY));
}

export async function clearAppDiagnostics(): Promise<void> {
  await writeTail;
  await AsyncStorage.removeItem(DIAGNOSTICS_KEY);
}
