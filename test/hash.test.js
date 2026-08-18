import assert from 'node:assert/strict';
import test from 'node:test';

import {
  UINT64_MAX,
  hashKey,
  hashNodeToken,
  sha256ToUint64,
  tokenHex,
  validateHashValue,
} from '../src/hash.js';

test('SHA-256 truncation is deterministic and domain-separated', () => {
  assert.equal(sha256ToUint64('same'), sha256ToUint64('same'));
  assert.notEqual(hashKey('a'), hashNodeToken('a', 0));
  assert.match(tokenHex(hashKey('a')), /^0x[a-f0-9]{16}$/);
});

test('hash boundary accepts the full unsigned 64-bit range only', () => {
  assert.equal(validateHashValue(0n), 0n);
  assert.equal(validateHashValue(UINT64_MAX), UINT64_MAX);
  assert.throws(() => validateHashValue(-1n), /unsigned 64-bit/);
  assert.throws(() => validateHashValue(UINT64_MAX + 1n), /unsigned 64-bit/);
  assert.throws(() => validateHashValue(1), /unsigned 64-bit/);
});

test('rejects oversized or non-string keys before hashing', () => {
  assert.throws(() => hashKey('x'.repeat(4097)), /at most 4096/);
  assert.throws(() => hashKey(Buffer.from('x')), /key must be a string/);
});
