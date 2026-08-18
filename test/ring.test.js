import assert from 'node:assert/strict';
import test from 'node:test';

import { ConsistentHashRing } from '../src/ring.js';

function controlledHash(values) {
  return (input) => {
    if (!values.has(input)) throw new Error(`unexpected hash input: ${JSON.stringify(input)}`);
    return values.get(input);
  };
}

test('clockwise lookup includes exact-token ownership and ring wraparound', () => {
  const values = new Map([
    [`node\0a\0${0}`, 10n],
    [`node\0b\0${0}`, 100n],
    [`node\0c\0${0}`, 200n],
    ['key\0before-a', 5n],
    ['key\0exact-b', 100n],
    ['key\0between', 150n],
    ['key\0wrap', 250n],
  ]);
  const ring = new ConsistentHashRing(['a', 'b', 'c'], {
    virtualNodes: 1,
    hash: controlledHash(values),
    hashVersion: 'controlled-v1',
  });
  assert.equal(ring.primary('before-a'), 'a');
  assert.equal(ring.primary('exact-b'), 'b');
  assert.equal(ring.primary('between'), 'c');
  assert.equal(ring.primary('wrap'), 'a');
});

test('membership input order does not change tokens, fingerprint, or mapping', () => {
  const left = new ConsistentHashRing(['cache-c', 'cache-a', 'cache-b']);
  const right = new ConsistentHashRing(['cache-b', 'cache-c', 'cache-a']);
  assert.equal(left.fingerprint(), right.fingerprint());
  for (let index = 0; index < 1000; index += 1) {
    assert.deepEqual(left.locate(`key-${index}`, { replicas: 3 }), right.locate(`key-${index}`, { replicas: 3 }));
  }
});

test('placement-relevant settings change the configuration fingerprint', () => {
  const baseline = new ConsistentHashRing(['a', 'b'], { virtualNodes: 32 });
  assert.notEqual(
    baseline.fingerprint(),
    new ConsistentHashRing(['a', 'b'], { virtualNodes: 64 }).fingerprint(),
  );
  assert.notEqual(
    baseline.fingerprint(),
    new ConsistentHashRing([{ id: 'a', weight: 2 }, 'b'], { virtualNodes: 32 }).fingerprint(),
  );
});

test('replica preference list contains distinct physical nodes', () => {
  const ring = new ConsistentHashRing(['a', 'b', 'c'], { virtualNodes: 64 });
  const owners = ring.locate('order-42', { replicas: 3 });
  assert.equal(owners.length, 3);
  assert.equal(new Set(owners).size, 3);
  assert.throws(() => ring.locate('order-42', { replicas: 4 }), /replicas/);
});

test('token collisions resolve deterministically without duplicate replicas', () => {
  const values = new Map([
    [`node\0a\0${0}`, 10n],
    [`node\0b\0${0}`, 10n],
    [`node\0c\0${0}`, 100n],
    ['key\0collision', 10n],
  ]);
  const ring = new ConsistentHashRing(['c', 'b', 'a'], {
    virtualNodes: 1,
    hash: controlledHash(values),
    hashVersion: 'colliding-v1',
  });
  assert.deepEqual(ring.locate('collision', { replicas: 3 }), ['a', 'b', 'c']);
  assert.equal(ring.ownership().reduce((sum, item) => sum + item.share, 0), 1);
});

test('weights multiply virtual tokens and immutable membership operations preserve settings', () => {
  const ring = new ConsistentHashRing([{ id: 'small', weight: 1 }, { id: 'large', weight: 3 }], {
    virtualNodes: 32,
  });
  assert.equal(ring.tokenCount(), 128);
  const added = ring.withNode({ id: 'medium', weight: 2 });
  assert.equal(added.tokenCount(), 192);
  assert.equal(ring.tokenCount(), 128);
  assert.equal(added.withoutNode('medium').fingerprint(), ring.fingerprint());
});

test('rejects duplicate, unsafe, oversized, and final-node membership changes', () => {
  assert.throws(() => new ConsistentHashRing(['a', 'a']), /unique/);
  assert.throws(() => new ConsistentHashRing(['../a']), /safe identifier/);
  assert.throws(() => new ConsistentHashRing([{ id: 'a', weight: 101 }]), /weight/);
  assert.throws(() => new ConsistentHashRing(['a'], { virtualNodes: 5000 }), /virtualNodes/);
  assert.throws(() => new ConsistentHashRing(['a']).withoutNode('a'), /final node/);
});
