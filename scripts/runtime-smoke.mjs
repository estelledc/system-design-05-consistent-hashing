import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const cli = fileURLToPath(new URL('../bin/consistent-hash.mjs', import.meta.url));

async function execute(args) {
  const { stdout, stderr } = await run(process.execPath, [cli, ...args], {
    timeout: 10_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.equal(stderr, '');
  assert.equal(stdout.trim().split('\n').length, 1);
  return JSON.parse(stdout);
}

const first = await execute([
  'locate', '--nodes', 'cache-a,cache-b,cache-c', '--key', 'order-42', '--replicas', '2', '--vnodes', '128',
]);
const repeated = await execute([
  'locate', '--nodes', 'cache-c,cache-a,cache-b', '--key', 'order-42', '--replicas', '2', '--vnodes', '128',
]);
assert.equal(first.ok, true);
assert.deepEqual(first.result.owners, repeated.result.owners);
assert.equal(first.result.ring.fingerprint, repeated.result.ring.fingerprint);
assert.equal(new Set(first.result.owners).size, 2);

const simulation = await execute([
  'simulate', '--nodes', 'cache-a,cache-b,cache-c,cache-d', '--add', 'cache-e',
  '--keys', '20000', '--seed', 'runtime-smoke', '--vnodes', '256',
]);
assert.equal(simulation.result.consistentHash.unexpectedDestination, 0);
assert.ok(simulation.result.consistentHash.moved > 0);
assert.ok(simulation.result.consistentHash.movedFraction < simulation.result.moduloHash.movedFraction);

let invalidReceipt;
try {
  await run(process.execPath, [cli, 'simulate', '--nodes', 'cache-a,cache-b'], { timeout: 10_000 });
  assert.fail('invalid command unexpectedly succeeded');
} catch (error) {
  assert.equal(error.code, 1);
  assert.equal(error.stdout, '');
  invalidReceipt = JSON.parse(error.stderr);
  assert.equal(invalidReceipt.error.code, 'INVALID_ARGUMENT');
}

process.stdout.write(`${JSON.stringify({
  kind: 'cli_runtime_receipt',
  node: process.version,
  deterministicFingerprint: first.result.ring.fingerprint,
  owners: first.result.owners,
  sampledKeys: simulation.result.consistentHash.keyCount,
  consistentHashMovedFraction: simulation.result.consistentHash.movedFraction,
  moduloHashMovedFraction: simulation.result.moduloHash.movedFraction,
  unexpectedDestination: simulation.result.consistentHash.unexpectedDestination,
  invalidInputExit: 1,
  claimBoundary: 'deterministic local CLI execution over a generated key corpus; no data migration or production traffic',
})}\n`);
