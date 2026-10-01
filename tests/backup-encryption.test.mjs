import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decryptBackupBytes,
  encryptBackupBytes,
  isEncryptedBackupBytes,
} from '../lib/backup-encryption.ts';

const salt = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
const nonce = Uint8Array.from({ length: 24 }, (_, index) => 100 + index);

test('backup encryption round-trips bytes without exposing the SQLite header', async () => {
  const plaintext = new TextEncoder().encode('SQLite format 3\0financial fixture');
  const encrypted = await encryptBackupBytes(plaintext, 'correct horse battery staple', salt, nonce);

  assert.equal(isEncryptedBackupBytes(encrypted), true);
  assert.equal(new TextDecoder().decode(encrypted).includes('SQLite format 3'), false);
  assert.deepEqual(await decryptBackupBytes(encrypted, 'correct horse battery staple'), plaintext);
});

test('a native key derivation can keep the encrypted backup format compatible', async () => {
  const nativeKeyDeriver = async (_passphrase, _salt, _iterations, keyLength) =>
    new Uint8Array(keyLength).fill(37);
  const plaintext = new TextEncoder().encode('SQLite format 3\0native KDF fixture');
  const encrypted = await encryptBackupBytes(
    plaintext,
    'correct horse battery staple',
    salt,
    nonce,
    nativeKeyDeriver
  );

  assert.deepEqual(
    await decryptBackupBytes(encrypted, 'correct horse battery staple', nativeKeyDeriver),
    plaintext
  );
});

test('backup authentication rejects an incorrect password and modified ciphertext', async () => {
  const encrypted = await encryptBackupBytes(
    new Uint8Array([1, 2, 3, 4]),
    'correct horse battery staple',
    salt,
    nonce
  );

  await assert.rejects(
    decryptBackupBytes(encrypted, 'incorrect password'),
    /INVALID_BACKUP_PASSPHRASE/
  );
  const modified = encrypted.slice();
  modified[modified.length - 1] ^= 1;
  await assert.rejects(
    decryptBackupBytes(modified, 'correct horse battery staple'),
    /INVALID_BACKUP_PASSPHRASE/
  );
});

test('legacy SQLite backups are distinguishable from encrypted envelopes', () => {
  assert.equal(isEncryptedBackupBytes(new TextEncoder().encode('SQLite format 3\0')), false);
});

test('backup encryption refuses weak passwords and malformed envelopes', async () => {
  await assert.rejects(
    encryptBackupBytes(new Uint8Array([1]), 'short', salt, nonce),
    /INVALID_BACKUP_PASSPHRASE_POLICY/
  );
  const malformed = new Uint8Array(32);
  malformed.set(new TextEncoder().encode('FINNIAPP-BACKUP\0'));
  new DataView(malformed.buffer).setUint32(16, 1, false);
  malformed[20] = 'x'.charCodeAt(0);
  await assert.rejects(decryptBackupBytes(malformed, 'correct horse battery staple'));
});
