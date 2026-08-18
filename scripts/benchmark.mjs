import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { ConsistentHashRing } from '../src/ring.js';

const nodeCount = 100;
const virtualNodes = 256;
const lookups = 200_000;
const nodes = Array.from({ length: nodeCount }, (_, index) => `cache-${String(index).padStart(3, '0')}`);

const buildStartedAt = performance.now();
const ring = new ConsistentHashRing(nodes, { virtualNodes });
const buildElapsedMs = performance.now() - buildStartedAt;

let checksum = 0;
const lookupStartedAt = performance.now();
for (let index = 0; index < lookups; index += 1) {
  const owners = ring.locate(`benchmark-key-${index}`, { replicas: 3 });
  assert.equal(new Set(owners).size, 3);
  checksum += owners[0].charCodeAt(owners[0].length - 1);
}
const lookupElapsedMs = performance.now() - lookupStartedAt;
assert.equal(ring.tokenCount(), nodeCount * virtualNodes);
assert.ok(checksum > 0);

process.stdout.write(`${JSON.stringify({
  kind: 'local_algorithm_receipt',
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  physicalNodes: nodeCount,
  virtualNodesPerPhysicalNode: virtualNodes,
  tokenCount: ring.tokenCount(),
  replicasPerLookup: 3,
  lookups,
  buildElapsedMs: Number(buildElapsedMs.toFixed(3)),
  lookupElapsedMs: Number(lookupElapsedMs.toFixed(3)),
  lookupsPerSecond: Math.round(lookups / (lookupElapsedMs / 1000)),
  checksum,
  claimBoundary: 'single-process SHA-256 and binary-search loop; not a production latency or capacity claim',
})}\n`);
