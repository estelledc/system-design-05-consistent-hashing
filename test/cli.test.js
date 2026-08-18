import assert from 'node:assert/strict';
import test from 'node:test';

import { execute, runCli } from '../src/cli.js';

function capture() {
  let value = '';
  return {
    stream: { write(chunk) { value += chunk; } },
    value() { return value; },
  };
}

test('locate returns a deterministic fingerprint, token, and distinct owners', () => {
  const response = execute([
    'locate', '--nodes', 'a,b,c', '--key', 'order-42', '--replicas', '2', '--vnodes', '64',
  ]);
  assert.equal(response.command, 'locate');
  assert.match(response.result.keyToken, /^0x[a-f0-9]{16}$/);
  assert.match(response.result.ring.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(new Set(response.result.owners).size, 2);
});

test('ring command supports weighted nodes and reports ownership sum', () => {
  const response = execute(['ring', '--nodes', 'small:1,large:2', '--vnodes', '64']);
  assert.equal(response.result.ring.tokenCount, 192);
  const sum = response.result.ownership.reduce((total, item) => total + item.share, 0);
  assert.ok(Math.abs(sum - 1) < 1e-12);
});

test('simulate addition returns sampled movement evidence', () => {
  const response = execute([
    'simulate', '--nodes', 'a,b,c,d', '--add', 'e', '--keys', '10000', '--seed', 'cli',
  ]);
  assert.equal(response.result.change.type, 'add');
  assert.equal(response.result.consistentHash.unexpectedDestination, 0);
});

test('CLI emits one JSON error envelope for invalid requests', () => {
  const stdout = capture();
  const stderr = capture();
  const exitCode = runCli(['simulate', '--nodes', 'a,b'], {
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  assert.equal(exitCode, 1);
  assert.equal(stdout.value(), '');
  const payload = JSON.parse(stderr.value());
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'INVALID_ARGUMENT');
});
