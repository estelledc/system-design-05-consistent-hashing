import { createHash } from 'node:crypto';

export const HASH_VERSION = 'sha256-u64be-v1';
export const UINT64_SPACE = 1n << 64n;
export const UINT64_MAX = UINT64_SPACE - 1n;

export function validateHashValue(value) {
  if (typeof value !== 'bigint' || value < 0n || value > UINT64_MAX) {
    throw new TypeError('hash function must return an unsigned 64-bit bigint');
  }
  return value;
}

export function sha256ToUint64(value) {
  if (typeof value !== 'string' || value.length > 4096) {
    throw new TypeError('hash input must be a string of at most 4096 characters');
  }
  const digest = createHash('sha256').update(value, 'utf8').digest();
  return digest.readBigUInt64BE(0);
}

export function hashNodeToken(nodeId, replicaIndex, hash = sha256ToUint64) {
  return validateHashValue(hash(`node\0${nodeId}\0${replicaIndex}`));
}

export function hashKey(key, hash = sha256ToUint64) {
  if (typeof key !== 'string' || key.length > 4096) {
    throw new TypeError('key must be a string of at most 4096 characters');
  }
  return validateHashValue(hash(`key\0${key}`));
}

export function tokenHex(token) {
  return `0x${validateHashValue(token).toString(16).padStart(16, '0')}`;
}
