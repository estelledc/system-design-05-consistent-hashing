import assert from 'node:assert/strict';
import test from 'node:test';

import { ConsistentHashRing } from '../src/ring.js';
import { analyzeDistribution, analyzeMovement, sampleKey } from '../src/simulation.js';

const nodes = ['cache-a', 'cache-b', 'cache-c', 'cache-d'];

function finiteDomainHash(input) {
  const nodeTokens = new Map([
    [`node\0a\0${0}`, 40n],
    [`node\0b\0${0}`, 160n],
    [`node\0c\0${0}`, 100n],
  ]);
  if (nodeTokens.has(input)) return nodeTokens.get(input);
  if (input.startsWith('key\0')) return BigInt(input.slice(4));
  throw new Error(`unexpected finite-domain input: ${JSON.stringify(input)}`);
}

test('membership movement is exhaustive over a reduced 8-bit key model', () => {
  const beforeAddition = new ConsistentHashRing(['a', 'b'], {
    virtualNodes: 1,
    hash: finiteDomainHash,
    hashVersion: 'finite-u8-v1',
  });
  const afterAddition = beforeAddition.withNode('c');
  const afterRemoval = afterAddition.withoutNode('c');

  for (let token = 0; token < 256; token += 1) {
    const key = String(token);
    const beforeOwner = beforeAddition.primary(key);
    const addedOwner = afterAddition.primary(key);
    if (beforeOwner !== addedOwner) assert.equal(addedOwner, 'c');

    const removedOwner = afterRemoval.primary(key);
    if (addedOwner !== removedOwner) assert.equal(addedOwner, 'c');
  }
});

test('adding one node only moves sampled primaries to that new node', () => {
  const before = new ConsistentHashRing(nodes, { virtualNodes: 128 });
  const after = before.withNode('cache-e');
  const movement = analyzeMovement(before, after, {
    keyCount: 50_000,
    seed: 'addition-property',
    expectedDestination: 'cache-e',
  });
  assert.equal(movement.unexpectedDestination, 0);
  assert.ok(movement.moved > 0);
});

test('removing one node only moves sampled primaries that belonged to it', () => {
  const before = new ConsistentHashRing(nodes, { virtualNodes: 128 });
  const after = before.withoutNode('cache-c');
  const movement = analyzeMovement(before, after, {
    keyCount: 50_000,
    seed: 'removal-property',
    expectedSource: 'cache-c',
  });
  assert.equal(movement.unexpectedSource, 0);
  assert.ok(movement.moved > 0);
});

test('preference lists stay distinct over a deterministic key corpus', () => {
  const ring = new ConsistentHashRing(nodes, { virtualNodes: 128 });
  for (let index = 0; index < 10_000; index += 1) {
    const owners = ring.locate(sampleKey('replicas', index), { replicas: 4 });
    assert.equal(new Set(owners).size, 4);
  }
});

test('weighted virtual nodes produce sampled load near the configured ratio', () => {
  const ring = new ConsistentHashRing([
    { id: 'small', weight: 1 },
    { id: 'large', weight: 2 },
  ], { virtualNodes: 512 });
  const distribution = analyzeDistribution(ring, { keyCount: 100_000, seed: 'weighted' });
  const largeShare = distribution.counts.large / distribution.keyCount;
  assert.ok(largeShare > 0.61 && largeShare < 0.72, `large share was ${largeShare}`);
});

test('more virtual nodes improve this fixed corpus distribution without claiming a theorem', () => {
  const coarse = analyzeDistribution(
    new ConsistentHashRing(nodes, { virtualNodes: 1 }),
    { keyCount: 100_000, seed: 'balance' },
  );
  const fine = analyzeDistribution(
    new ConsistentHashRing(nodes, { virtualNodes: 256 }),
    { keyCount: 100_000, seed: 'balance' },
  );
  assert.ok(fine.coefficientOfVariation < coarse.coefficientOfVariation);
  assert.ok(fine.coefficientOfVariation < 0.1);
});
