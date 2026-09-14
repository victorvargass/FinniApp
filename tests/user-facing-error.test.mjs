import assert from 'node:assert/strict';
import test from 'node:test';

import { isTechnicalErrorMessage } from '../lib/user-facing-error.ts';

test('native database errors are never suitable for users', () => {
  assert.equal(
    isTechnicalErrorMessage("Call to function 'NativeStatement.finalizeAsync' has been rejected"),
    true
  );
  assert.equal(
    isTechnicalErrorMessage('UNIQUE constraint failed: payment_methods.name'),
    true
  );
  assert.equal(
    isTechnicalErrorMessage('Ya existe un medio de pago de este tipo con ese nombre.'),
    false
  );
});
