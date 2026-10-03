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
  assert.match(store, /sourceApp/);
  assert.match(store, /suggestedType/);
  assert.match(store, /AndroidKeyStore/);
  assert.match(store, /AES\/GCM\/NoPadding/);
  assert.doesNotMatch(store, /notificationBody|rawBody|rawText/);
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
  for (const modal of [expenseModal, incomeModal, transferModal]) {
    assert.match(modal, /candidateId/);
    assert.match(modal, /removePendingNotificationMovement/);
  }
});
