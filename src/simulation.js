import { ConsistentHashRing } from './ring.js';
import { ModuloRouter } from './modulo-router.js';

const MAX_KEYS = 1_000_000;

function validateSample({ keyCount, seed }) {
  if (!Number.isSafeInteger(keyCount) || keyCount < 1 || keyCount > MAX_KEYS) {
    throw new TypeError(`keyCount must be an integer between 1 and ${MAX_KEYS}`);
  }
  if (typeof seed !== 'string' || seed.length === 0 || seed.length > 128) {
    throw new TypeError('seed must contain 1-128 characters');
  }
}

export function sampleKey(seed, index) {
  return `sample\0${seed}\0${index}`;
}

export function analyzeDistribution(router, { keyCount = 100_000, seed = '42' } = {}) {
  validateSample({ keyCount, seed });
  const nodes = router.nodes().map((node) => (typeof node === 'string' ? node : node.id));
  const counts = new Map(nodes.map((node) => [node, 0]));
  for (let index = 0; index < keyCount; index += 1) {
    const node = router.primary(sampleKey(seed, index));
    counts.set(node, counts.get(node) + 1);
  }

  const values = [...counts.values()];
  const mean = keyCount / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return {
    keyCount,
    seed,
    counts: Object.fromEntries([...counts].sort()),
    min: Math.min(...values),
    max: Math.max(...values),
    mean,
    coefficientOfVariation: Math.sqrt(variance) / mean,
  };
}

export function analyzeMovement(before, after, {
  keyCount = 100_000,
  seed = '42',
  expectedDestination = null,
  expectedSource = null,
} = {}) {
  validateSample({ keyCount, seed });
  let moved = 0;
  let unexpectedDestination = 0;
  let unexpectedSource = 0;
  const transitions = new Map();

  for (let index = 0; index < keyCount; index += 1) {
    const key = sampleKey(seed, index);
    const source = before.primary(key);
    const destination = after.primary(key);
    if (source === destination) continue;
    moved += 1;
    if (expectedDestination && destination !== expectedDestination) unexpectedDestination += 1;
    if (expectedSource && source !== expectedSource) unexpectedSource += 1;
    const transition = `${source}->${destination}`;
    transitions.set(transition, (transitions.get(transition) ?? 0) + 1);
  }

  return {
    keyCount,
    moved,
    movedFraction: moved / keyCount,
    unexpectedDestination,
    unexpectedSource,
    transitions: Object.fromEntries([...transitions].sort()),
  };
}

export function simulateAddition({
  nodes,
  addedNode,
  virtualNodes = 128,
  keyCount = 100_000,
  seed = '42',
}) {
  if (nodes.some((node) => node.weight !== 1) || addedNode.weight !== 1) {
    throw new TypeError('modulo comparison supports equal-weight nodes only');
  }
  const beforeRing = new ConsistentHashRing(nodes, { virtualNodes });
  const afterRing = beforeRing.withNode(addedNode);
  const beforeModulo = new ModuloRouter(nodes.map((node) => node.id));
  const afterModulo = new ModuloRouter([...nodes.map((node) => node.id), addedNode.id]);

  return {
    change: { type: 'add', node: addedNode.id },
    before: beforeRing.snapshot(),
    after: afterRing.snapshot(),
    consistentHash: analyzeMovement(beforeRing, afterRing, {
      keyCount,
      seed,
      expectedDestination: addedNode.id,
    }),
    moduloHash: analyzeMovement(beforeModulo, afterModulo, { keyCount, seed }),
    distributionBefore: analyzeDistribution(beforeRing, { keyCount, seed }),
    distributionAfter: analyzeDistribution(afterRing, { keyCount, seed }),
  };
}

export function simulateRemoval({
  nodes,
  removedNodeId,
  virtualNodes = 128,
  keyCount = 100_000,
  seed = '42',
}) {
  if (nodes.some((node) => node.weight !== 1)) {
    throw new TypeError('modulo comparison supports equal-weight nodes only');
  }
  const beforeRing = new ConsistentHashRing(nodes, { virtualNodes });
  const afterRing = beforeRing.withoutNode(removedNodeId);
  const beforeModulo = new ModuloRouter(nodes.map((node) => node.id));
  const afterModulo = new ModuloRouter(
    nodes.filter((node) => node.id !== removedNodeId).map((node) => node.id),
  );

  return {
    change: { type: 'remove', node: removedNodeId },
    before: beforeRing.snapshot(),
    after: afterRing.snapshot(),
    consistentHash: analyzeMovement(beforeRing, afterRing, {
      keyCount,
      seed,
      expectedSource: removedNodeId,
    }),
    moduloHash: analyzeMovement(beforeModulo, afterModulo, { keyCount, seed }),
    distributionBefore: analyzeDistribution(beforeRing, { keyCount, seed }),
    distributionAfter: analyzeDistribution(afterRing, { keyCount, seed }),
  };
}
