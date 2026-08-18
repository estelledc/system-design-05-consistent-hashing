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

- Implementation commit: `629ab4ae641806df263eaaefd57831eab7cdff35`.
- Public CI: [run 32147816184](https://github.com/estelledc/system-design-05-consistent-hashing/actions/runs/32147816184).
- The run completed successfully on Node 22.23.2, 24.19.0, and 26.7.0. Each job reported 23 passed, 0 failed, 0 skipped, and 0 high-or-greater npm vulnerabilities.
- All three runtime smokes produced fingerprint `bacd206392f1e2ce947877b560e6b5ea73c4ab99a01578e9f6b20611b395fb4a` for the same ring, mapped the same key to `cache-c, cache-a`, and observed 19.585% consistent-hash movement versus 80.04% modulo movement over the declared 20,000-key addition sample, with zero unexpected destinations.
- Local full gates also passed on Node 22.23.1 and 26.6.0. Those local versions and timings are supporting evidence; the linked GitHub run is the remote publication receipt.

The movement percentages are fixtures for hash version, membership, virtual-node count, seed, and generated corpus. They are not predictions for a production dataset.

## Reproduce locally

```sh
npm ci --ignore-scripts
npm run check
```

The benchmark emits the Node version, platform, architecture, ring size, lookup count, elapsed times, and a checksum. Timing varies by machine and shared load. It proves the loop ran and its invariants held in that environment; it is not a service benchmark.

## Evidence boundary

Passing this gate supports the implementation's deterministic placement and sampled movement claims. It does not establish data migration correctness, replica durability, membership consensus, failure detection, cache hit rate, production traffic balance, deployment, SLA, security review, or external user acceptance.
