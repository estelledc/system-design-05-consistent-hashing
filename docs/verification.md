# Verification record

## What the gate covers

`npm run check` executes static repository checks, all Node tests, a real child-process CLI smoke, the local algorithm benchmark, and the npm vulnerability audit.

The tests cover:

- deterministic, domain-separated unsigned 64-bit hashing and input bounds;
- exact-token lookup, wraparound, collisions, weights, membership validation, and immutable changes;
- membership-order-independent fingerprints and mappings;
- distinct physical replica candidates;
- addition and removal movement properties over an exhaustive reduced 8-bit model and deterministic 50,000-key corpora;
- sampled weighted balance and virtual-node balance improvement;
- consistent-hash versus modulo movement over 100,000 generated keys;
- CLI success and error envelopes.

No test is skipped. The CI matrix runs the same locked package and gate on Node 22, 24, and 26.

## Current receipts

The initial public CI receipt is pending repository publication. Replace this sentence only after the GitHub run is green; a local exit code is not a remote receipt.

## Reproduce locally

```sh
npm ci --ignore-scripts
npm run check
```

The benchmark emits the Node version, platform, architecture, ring size, lookup count, elapsed times, and a checksum. Timing varies by machine and shared load. It proves the loop ran and its invariants held in that environment; it is not a service benchmark.

## Evidence boundary

Passing this gate supports the implementation's deterministic placement and sampled movement claims. It does not establish data migration correctness, replica durability, membership consensus, failure detection, cache hit rate, production traffic balance, deployment, SLA, security review, or external user acceptance.
