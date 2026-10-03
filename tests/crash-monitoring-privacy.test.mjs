import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isValidSentryDsn,
  sanitizeCrashMonitoringEvent,
} from '../lib/crash-monitoring-privacy.ts';

test('crash monitoring strips financial and personal context before sending', () => {
  const event = sanitizeCrashMonitoringEvent({
    message: 'Saldo de Victor: $1.000',
    transaction: 'debt/Victor',
    user: { email: 'victor@example.com' },
    request: { data: { amount: 1000 } },
    breadcrumbs: [{ message: 'Compra supermercado' }],
    extra: { note: 'dato privado' },
    tags: { contact: 'Victor', error_context: 'database.refresh' },
    logentry: { message: 'Deuda de Victor', params: ['$1.000'] },
    contexts: {
      app: { app_version: '1.0.0', private_value: 'secret' },
      device: { model: 'Pixel', name: 'Teléfono de Victor' },
      custom: { amount: 1000 },
    },
    exception: {
      values: [{
        type: 'TypeError',
        value: 'Falló la deuda de Victor por $1.000',
        stacktrace: { frames: [{ filename: 'home.tsx', vars: { amount: 1000 } }] },
      }],
    },
  });

  assert.equal(event.message, 'Application error');
  assert.equal(event.transaction, undefined);
  assert.equal(event.user, undefined);
  assert.equal(event.request, undefined);
  assert.equal(event.breadcrumbs, undefined);
  assert.equal(event.extra, undefined);
  assert.deepEqual(event.tags, { error_context: 'database.refresh' });
  assert.deepEqual(event.logentry, { message: 'Application error' });
  assert.deepEqual(event.contexts, {
    app: { app_version: '1.0.0' },
    device: { model: 'Pixel' },
  });
  assert.equal(event.exception?.values?.[0]?.value, 'Application error');
  assert.deepEqual(event.exception?.values?.[0]?.stacktrace?.frames?.[0], { filename: 'home.tsx' });
});

test('crash monitoring only accepts HTTPS Sentry DSNs', () => {
  assert.equal(isValidSentryDsn('https://public@example.ingest.sentry.io/123'), true);
  assert.equal(isValidSentryDsn('http://public@example.ingest.sentry.io/123'), false);
  assert.equal(isValidSentryDsn('https://example.ingest.sentry.io/123'), false);
  assert.equal(isValidSentryDsn(''), false);
});

test('reported balance write failures keep a safe Sentry context', () => {
  const event = sanitizeCrashMonitoringEvent({
    tags: { error_context: 'database.write', debt_name: 'private' },
  });

  assert.deepEqual(event.tags, { error_context: 'database.write' });
});
