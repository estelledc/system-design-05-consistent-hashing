import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateAddition, simulateRemoval } from '../src/simulation.js';

const nodes = ['a', 'b', 'c', 'd'].map((id) => ({ id, weight: 1 }));

test('addition sample shows bounded ring movement and broad modulo remapping', () => {
  const report = simulateAddition({
    nodes,
    addedNode: { id: 'e', weight: 1 },
    virtualNodes: 256,
    keyCount: 100_000,
    seed: 'compare-add',
  });
  assert.equal(report.consistentHash.unexpectedDestination, 0);
  assert.ok(report.consistentHash.movedFraction < 0.3);
  assert.ok(report.moduloHash.movedFraction > 0.6);
});

test('removal sample only moves keys whose primary was removed', () => {
  const report = simulateRemoval({
    nodes,
    removedNodeId: 'c',
    virtualNodes: 256,
    keyCount: 100_000,
    seed: 'compare-remove',
  });
  assert.equal(report.consistentHash.unexpectedSource, 0);
  assert.ok(report.consistentHash.movedFraction > 0.15);
  assert.ok(report.consistentHash.movedFraction < 0.35);
});

test('simulation rejects weighted modulo comparisons', () => {
  assert.throws(() => simulateAddition({
    nodes: [{ id: 'a', weight: 2 }, { id: 'b', weight: 1 }],
    addedNode: { id: 'c', weight: 1 },
  }), /equal-weight/);
});
