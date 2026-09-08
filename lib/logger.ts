type LogContext =
  | 'database.initialize'
  | 'database.refresh'
  | 'report.export';

/** Logs diagnostic categories in development without serializing user data. */
export function logAppError(context: LogContext, error: unknown): void {
  if (!__DEV__) return;
  const category = error instanceof Error ? error.name : 'UnknownError';
  console.error(`[${context}] ${category}`);
}
