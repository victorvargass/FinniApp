import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Android notification capture is explicit and stores only parsed movement fields', () => {
  const manifest = read('modules/notification-movements/android/src/main/AndroidManifest.xml');
  const listener = read('modules/notification-movements/android/src/main/java/com/vitoco18/finniapp/notificationmovements/FinancialNotificationListenerService.kt');
  const store = read('modules/notification-movements/android/src/main/java/com/vitoco18/finniapp/notificationmovements/PendingMovementStore.kt');

  assert.match(manifest, /BIND_NOTIFICATION_LISTENER_SERVICE/);
  assert.match(listener, /CATEGORY_MESSAGE/);
  assert.match(listener, /CATEGORY_EMAIL/);
  assert.match(listener, /amountPattern/);
  assert.match(listener, /com\.google\.android\.apps\.walletnfcrel/);
  assert.match(listener, /com\.coopeuchapp/);
  assert.match(listener, /cl\.bancochile\.mi_banco/);
  assert.match(listener, /cl\.bci\.sismo\.mach/);
  assert.match(listener, /TRUSTED_FINANCIAL_PACKAGES/);
  assert.match(listener, /EXCLUDED_SOURCE_PACKAGES/);
  assert.match(listener, /com\.google\.android\.gm/);
  assert.match(listener, /isGoogleWallet/);
  assert.match(listener, /extractWalletMerchant/);
  assert.match(store, /sourceApp/);
  assert.match(store, /suggestedType/);
  assert.match(store, /paymentMethodHint/);
  assert.match(store, /suggestedPaymentMethodType/);
  assert.match(store, /DUPLICATE_WINDOW_MS/);
  assert.match(store, /isLikelyDuplicate/);
  assert.match(store, /AndroidKeyStore/);
  assert.match(store, /AES\/GCM\/NoPadding/);
  assert.doesNotMatch(store, /notificationBody|rawBody|rawText/);
});

test('notification access has a prominent local-processing disclosure before Android settings', () => {
  const screen = read('app/modal/pending-movements.tsx');
  const es = read('locales/es.ts');
  const disclosure = es.match(/permissionDescription:[^\n]+/)?.[0] ?? '';

  assert.match(screen, /pendingMovements\.permissionDescription/);
  assert.match(screen, /pendingMovements\.openAccessSettings/);
  assert.ok(
    screen.lastIndexOf('pendingMovements.permissionDescription')
      < screen.lastIndexOf('openNotificationMovementAccessSettings')
  );
  assert.match(disclosure, /título y contenido de notificaciones/);
  assert.match(disclosure, /nombre, monto, fecha, hora, aplicación de origen y tipo probable/);
  assert.match(disclosure, /no conservará el texto completo/);
  assert.match(disclosure, /ni enviará estos datos a servidores/);
  assert.match(disclosure, /revocar el acceso/);
});

test('detected movements can be deferred, reviewed, prefilled and removed after saving', () => {
  const controller = read('components/automatic-movement-controller.tsx');
  const screen = read('app/modal/pending-movements.tsx');
  const routes = read('lib/notification-movements.ts');
  const expenseModal = read('app/modal/expense-form.tsx');
  const incomeModal = read('app/modal/income-form.tsx');
  const transferModal = read('app/modal/account-transfer-form.tsx');

  assert.match(controller, /claimNextPendingNotificationMovement/);
  assert.match(controller, /pendingMovements\.later/);
  assert.match(screen, /openNotificationMovementAccessSettings/);
  assert.match(screen, /removePendingNotificationMovement/);
  assert.match(routes, /initialName/);
  assert.match(routes, /initialAmount/);
  assert.match(routes, /initialDate/);
  assert.match(routes, /initialTime/);
  assert.match(routes, /findClosestPaymentMethod/);
  assert.match(routes, /initialPaymentMethodId/);
  for (const modal of [expenseModal, incomeModal, transferModal]) {
    assert.match(modal, /candidateId/);
    assert.match(modal, /removePendingNotificationMovement/);
  }
});

test('notification access refreshes immediately after returning from Android settings', () => {
  const screen = read('app/modal/pending-movements.tsx');

  assert.match(screen, /AppState\.addEventListener\('change'/);
  assert.match(screen, /nextState === 'active'/);
  assert.match(screen, /if \(nextState === 'active'\) void load\(\)/);
  assert.match(screen, /appStateSubscription\.remove\(\)/);
});

test('home highlights detected pending movements and opens their review screen', () => {
  const home = read('app/(tabs)/home.tsx');
  const es = read('locales/es.ts');
  const en = read('locales/en.ts');

  assert.match(home, /getPendingNotificationMovements/);
  assert.match(home, /pendingNotificationMovementIds\.length > 0/);
  assert.match(home, /notification-movements-\$\{pendingNotificationMovementIds\.join\('_'\)\}/);
  assert.match(home, /router\.push\('\/modal\/pending-movements'/);
  assert.match(home, /clearInterval\(interval\)/);
  assert.match(es, /pendingNotificationMovementsTitle: 'Movimientos pendientes por revisar'/);
  assert.match(en, /pendingNotificationMovementsTitle: 'Pending transactions to review'/);
});
