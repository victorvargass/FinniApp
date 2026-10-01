import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

const MAGIC = new TextEncoder().encode('FINNIAPP-BACKUP\0');
const FORMAT_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const NONCE_LENGTH = 24;
const MAX_HEADER_LENGTH = 4096;

type BackupEncryptionHeader = {
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'XCHACHA20-POLY1305';
  salt: string;
  nonce: string;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string, expectedLength: number): Uint8Array {
  if (!new RegExp(`^[0-9a-f]{${expectedLength * 2}}$`, 'i').test(value)) {
    throw new Error('INVALID_BACKUP_ENVELOPE');
  }
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function equalPrefix(bytes: Uint8Array, prefix: Uint8Array): boolean {
  return bytes.length >= prefix.length && prefix.every((value, index) => bytes[index] === value);
}

export type BackupKeyDeriver = (
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  keyLength: number
) => Promise<Uint8Array>;

const deriveKey: BackupKeyDeriver = (passphrase, salt, iterations, keyLength) => {
  return pbkdf2Async(sha256, passphrase.normalize('NFKC'), salt, {
    c: iterations,
    dkLen: keyLength,
  });
}

export function isEncryptedBackupBytes(bytes: Uint8Array): boolean {
  return equalPrefix(bytes, MAGIC);
}

export async function encryptBackupBytes(
  plaintext: Uint8Array,
  passphrase: string,
  salt: Uint8Array,
  nonce: Uint8Array,
  keyDeriver: BackupKeyDeriver = deriveKey
): Promise<Uint8Array> {
  if (passphrase.normalize('NFKC').length < BACKUP_PASSPHRASE_MIN_LENGTH) {
    throw new Error('INVALID_BACKUP_PASSPHRASE_POLICY');
  }
  if (salt.length !== SALT_LENGTH || nonce.length !== NONCE_LENGTH) {
    throw new Error('INVALID_BACKUP_RANDOMNESS');
  }
  const header: BackupEncryptionHeader = {
    version: FORMAT_VERSION,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    cipher: 'XCHACHA20-POLY1305',
    salt: bytesToHex(salt),
    nonce: bytesToHex(nonce),
  };
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const headerLength = new Uint8Array(4);
  new DataView(headerLength.buffer).setUint32(0, headerBytes.length, false);
  const authenticatedHeader = concatBytes(MAGIC, headerLength, headerBytes);
  const key = await keyDeriver(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH);
  try {
    const ciphertext = xchacha20poly1305(key, nonce, authenticatedHeader).encrypt(plaintext);
    return concatBytes(authenticatedHeader, ciphertext);
  } finally {
    key.fill(0);
  }
}

export async function decryptBackupBytes(
  envelope: Uint8Array,
  passphrase: string,
  keyDeriver: BackupKeyDeriver = deriveKey
): Promise<Uint8Array> {
  if (!isEncryptedBackupBytes(envelope) || envelope.length < MAGIC.length + 4) {
    throw new Error('INVALID_BACKUP_ENVELOPE');
  }
  const headerLength = new DataView(
    envelope.buffer,
    envelope.byteOffset + MAGIC.length,
    4
  ).getUint32(0, false);
  if (headerLength <= 0 || headerLength > MAX_HEADER_LENGTH) {
    throw new Error('INVALID_BACKUP_ENVELOPE');
  }
  const ciphertextOffset = MAGIC.length + 4 + headerLength;
  if (ciphertextOffset >= envelope.length) throw new Error('INVALID_BACKUP_ENVELOPE');

  let header: BackupEncryptionHeader;
  try {
    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(envelope.slice(MAGIC.length + 4, ciphertextOffset))
    );
    if (typeof parsed !== 'object' || parsed == null) throw new Error('INVALID_BACKUP_ENVELOPE');
    header = parsed as BackupEncryptionHeader;
  } catch {
    throw new Error('INVALID_BACKUP_ENVELOPE');
  }
  if (
    header.version !== FORMAT_VERSION
    || header.kdf !== 'PBKDF2-SHA256'
    || header.cipher !== 'XCHACHA20-POLY1305'
    || header.iterations !== PBKDF2_ITERATIONS
  ) {
    throw new Error('INVALID_BACKUP_ENVELOPE');
  }
  const salt = hexToBytes(header.salt, SALT_LENGTH);
  const nonce = hexToBytes(header.nonce, NONCE_LENGTH);
  const key = await keyDeriver(passphrase, salt, header.iterations, KEY_LENGTH);
  try {
    return xchacha20poly1305(key, nonce, envelope.slice(0, ciphertextOffset))
      .decrypt(envelope.slice(ciphertextOffset));
  } catch {
    throw new Error('INVALID_BACKUP_PASSPHRASE');
  } finally {
    key.fill(0);
  }
}

export const BACKUP_PASSPHRASE_MIN_LENGTH = 10;
