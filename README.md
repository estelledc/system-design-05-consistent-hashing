# Consistent Hashing: executable placement evidence

A dependency-free Node.js implementation of an immutable weighted consistent-hash ring, distinct-node replica router, and movement simulator. It turns the usual ring diagram into properties that can fail in CI.

The central result is deliberately narrow: consistent hashing reduces remapping when membership changes. It does not make movement free, migrate data, detect failures, synchronize membership, guarantee even production load, or cure hot keys.

## Quick start

Requires Node.js 22 or newer.

```sh
npm ci --ignore-scripts
npm run check

node bin/consistent-hash.mjs locate \
  --nodes cache-a,cache-b,cache-c \
  --key order-42 \
  --replicas 2 \
  --vnodes 256

node bin/consistent-hash.mjs simulate \
  --nodes cache-a,cache-b,cache-c,cache-d \
  --add cache-e \
  --keys 100000 \
  --seed review \
  --vnodes 256
```

Each CLI call emits one JSON envelope. A simulation reports both the ring and sorted modulo hashing over the same generated key corpus. Its seed, key count, fingerprints, transitions, and distributions travel with the result.

## Problem contract

### User and scenario

The user is a storage, cache, or routing component that needs a repeatable ordered list of physical owners for a key. The primary scenario is changing an arbitrary node set while avoiding the broad remapping caused by `hash(key) % nodeCount`.

### Functional requirements

- Map a string key to one primary and optionally more distinct physical candidates.
- Add or remove a node without mutating an in-use ring snapshot.
- Represent coarse capacity differences with integer weights.
- Produce a stable fingerprint for every placement-relevant configuration.
- Compare remapping and sampled distribution with a modulo baseline.
- Emit machine-readable CLI results and invalid-input errors.

### Non-goals

- Membership consensus, node health, request retry, data copy, dual writes, cleanup, replication acknowledgements, repair, encryption, or authorization.
- A production load-balancer or distributed cache service.
- Proof that generated-key distribution equals a real workload.

### Trust boundary

Keys may be untrusted and are length-bounded. Membership is powerful control-plane input and must already be authenticated by the embedding system. See [Threat model](docs/threat-model.md).

## Design in one minute

1. Normalize and sort physical node identities.
2. Hash `virtualNodes * weight` labeled tokens per node into a 64-bit space.
3. Sort tokens once and fingerprint the full placement configuration.
4. Hash a key in a separate domain and binary-search its clockwise successor.
5. For replicas, continue clockwise while skipping repeated physical nodes.
6. Build a new immutable ring for membership changes; never edit the active array in place.

[Architecture](docs/architecture.md) defines the invariants, complexity, API, and failure windows. [ADR 0001](docs/adr/0001-ring-with-virtual-nodes.md) compares modulo, rendezvous, jump, and Maglev-style approaches.

## Back-of-the-envelope estimate

For 100 equal-weight physical nodes and 256 virtual nodes each:

- ring entries: `100 * 256 = 25,600`;
- build: `O(25,600 log 25,600)` plus SHA-256 for every token;
- primary lookup: one SHA-256 and `O(log 25,600)` comparisons;
- three candidates: continue clockwise until three distinct physical IDs appear.

Those are algorithmic counts. JavaScript object overhead, garbage collection, key distribution, host load, network latency, data size, and cache behavior decide real capacity. `npm run benchmark` prints an environment-bound receipt instead of turning a laptop number into an SLA.

## What is actually tested

The suite checks exact-token and wraparound lookup, deterministic collision handling, input-order independence, weights, immutable membership changes, distinct physical candidates, and CLI contracts. It exhaustively enumerates a reduced 8-bit hash model, then repeats the movement properties over larger fixed corpora:

- after adding a node, every moved primary goes to the new node;
- after removing a node, every moved primary came from the removed node;
- modulo hashing remaps much more of the same sampled corpus;
- virtual nodes improve balance for one declared corpus;
- a 2:1 token weight produces a nearby sampled ownership ratio.

The two balance statements are measurements tied to hash version, membership, sample seed, and count—not universal theorems. Full commands and boundaries are in [Verification](docs/verification.md).

## Repository map

- `src/hash.js`: stable hash domains and unsigned 64-bit token format.
- `src/ring.js`: immutable weighted ring, preference lists, ownership, and fingerprints.
- `src/modulo-router.js`: deterministic comparison baseline.
- `src/simulation.js`: sampled movement and distribution analysis.
- `src/cli.js` and `bin/consistent-hash.mjs`: JSON command surface.
- `test/`: example, boundary, property, simulator, and CLI tests.
- `scripts/`: static audit, child-process smoke, and environment-bound benchmark.
- `docs/operations.md`: activation, migration boundaries, signals, and failure policy.

## Source and clean-room note

The problem was prompted by the `Consistent Hashing` chapter in [`liquidslr/system-design-notes`](https://github.com/liquidslr/system-design-notes/tree/9d8388721e7231442763ad37398b8d82224aa68f). That source tree did not declare a license at the reviewed commit, so no prose, figures, or code were copied. This implementation and documentation were written independently.

Mechanism and alternatives were checked against the original [Karger et al. paper](https://people.csail.mit.edu/karger/Papers/web.pdf), the [Amazon Dynamo description](https://www.allthingsdistributed.com/2007/10/amazons_dynamo.html), [Jump Consistent Hash](https://arxiv.org/abs/1406.2294), and [Maglev](https://www.usenix.org/conference/nsdi16/technical-sessions/presentation/eisenbud).

## License

[MIT](LICENSE)
