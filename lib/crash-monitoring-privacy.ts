export type CrashStackFrame = {
  vars?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CrashStacktrace = {
  frames?: CrashStackFrame[];
  [key: string]: unknown;
};

export type CrashMechanismValue = {
  value?: string;
  stacktrace?: CrashStacktrace;
  raw_stacktrace?: CrashStacktrace;
  [key: string]: unknown;
};

export type CrashMonitoringEvent = {
  user?: unknown;
  request?: unknown;
  breadcrumbs?: unknown[];
  extra?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  message?: string;
  transaction?: string;
  culprit?: string;
  server_name?: string;
  fingerprint?: string[];
  contexts?: Record<string, unknown>;
  exception?: { values?: CrashMechanismValue[] };
  threads?: { values?: Array<{ stacktrace?: CrashStacktrace }> };
  logentry?: { message?: string; params?: unknown[] };
  [key: string]: unknown;
};

const SAFE_CONTEXT_FIELDS: Record<string, readonly string[]> = {
  app: ['app_build', 'app_identifier', 'app_name', 'app_version', 'build_type'],
  device: ['arch', 'brand', 'family', 'manufacturer', 'model', 'model_id', 'screen_density', 'screen_height_pixels', 'screen_width_pixels'],
  os: ['build', 'kernel_version', 'name', 'rooted', 'version'],
  runtime: ['name', 'version'],
};

const SAFE_ERROR_CONTEXTS = new Set([
  'database.initialize',
  'database.refresh',
  'database.restore',
  'report.export',
  'updates.currentToast',
]);

function sanitizeStacktrace(stacktrace: CrashStacktrace | undefined): void {
  for (const frame of stacktrace?.frames ?? []) delete frame.vars;
}

function sanitizeContexts(contexts: CrashMonitoringEvent['contexts']): CrashMonitoringEvent['contexts'] {
  if (!contexts) return undefined;
  const sanitized: NonNullable<CrashMonitoringEvent['contexts']> = {};
  for (const [contextName, allowedFields] of Object.entries(SAFE_CONTEXT_FIELDS)) {
    const value = contexts[contextName];
    if (typeof value !== 'object' || value == null || Array.isArray(value)) continue;
    const source = value as Record<string, unknown>;
    sanitized[contextName] = Object.fromEntries(
      allowedFields
        .filter((field) => source[field] !== undefined)
        .map((field) => [field, source[field]])
    );
  }
  return sanitized;
}

export function sanitizeCrashMonitoringEvent<T extends object>(event: T): T {
  const sanitized = event as T & CrashMonitoringEvent;
  delete sanitized.user;
  delete sanitized.request;
  delete sanitized.breadcrumbs;
  delete sanitized.extra;
  const errorContext = sanitized.tags?.error_context;
  sanitized.tags = typeof errorContext === 'string' && SAFE_ERROR_CONTEXTS.has(errorContext)
    ? { error_context: errorContext }
    : undefined;
  delete sanitized.transaction;
  delete sanitized.culprit;
  delete sanitized.server_name;
  delete sanitized.fingerprint;

  if (sanitized.message) sanitized.message = 'Application error';
  if (sanitized.logentry) {
    sanitized.logentry.message = 'Application error';
    delete sanitized.logentry.params;
  }

  for (const exception of sanitized.exception?.values ?? []) {
    exception.value = 'Application error';
    sanitizeStacktrace(exception.stacktrace);
    sanitizeStacktrace(exception.raw_stacktrace);
  }
  for (const thread of sanitized.threads?.values ?? []) sanitizeStacktrace(thread.stacktrace);

  sanitized.contexts = sanitizeContexts(sanitized.contexts);
  return event;
}

export function isValidSentryDsn(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    const projectId = url.pathname.split('/').filter(Boolean).at(-1);
    return url.protocol === 'https:'
      && url.username.length > 0
      && url.hostname.length > 0
      && Boolean(projectId);
  } catch {
    return false;
  }
}
