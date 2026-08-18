# ADR 0001: Use an immutable weighted ring with virtual nodes

- Status: accepted
- Date: 2026-08-18

## Context

The practice needs to make membership-change behavior, weighted capacity, replica preference lists, and configuration drift directly observable. Nodes use arbitrary stable identifiers and may be removed in any order. The result must be understandable without a running database or control plane.

## Decision

Use an immutable consistent-hash ring. Give each physical node a configurable base count of virtual tokens multiplied by an integer weight. Sort tokens deterministically, locate the clockwise successor with binary search, and walk further for distinct physical replica candidates. Include all placement-relevant inputs in a SHA-256 configuration fingerprint.

Use a domain-separated SHA-256-to-64-bit mapping instead of a runtime's built-in hash. The version is explicit because changing a hash function changes placement.

## Alternatives considered

### Modulo hashing

It is tiny and fast, so the simulator retains it as a comparison. When the divisor changes, however, a broad fraction of keys remap. That makes it unsuitable for the membership-change invariant being studied.

### Rendezvous hashing

Rendezvous hashing can express arbitrary node sets without maintaining a ring and is often a strong practical choice. A straightforward implementation scores every candidate per key, while optimized variants add their own machinery. The ring was selected here because clockwise ranges, virtual-node ownership, and replica walking are the concepts this case must expose—not because rendezvous hashing is generally inferior.

### Jump consistent hash

Jump consistent hash has very small memory cost and fast lookup, but its standard contract addresses sequentially numbered buckets. Supporting arbitrary identities, removals, weights, and preference lists changes the fit. It is a good candidate when that narrower bucket model matches the system.

### Maglev-style lookup table

Maglev targets load-balancer backend selection and builds a compact lookup table with different construction and failover tradeoffs. It is not used as a generic synonym for this ring.

## Consequences

- Membership additions and removals have executable movement properties.
- Weights and virtual-node counts affect balance and memory in a visible way.
- A 64-bit token collision is handled deterministically, although one colliding token may own no interval.
- Rebuilding is not free; the host should construct and validate a new immutable snapshot before activation.
- More virtual nodes improve balance for tested samples but increase build cost and memory. They do not solve hot keys.
- Placement is separated from migration, membership consensus, health, replication, and durability.

## References

- [Karger et al., Consistent Hashing and Random Trees](https://people.csail.mit.edu/karger/Papers/web.pdf)
- [Amazon Dynamo](https://www.allthingsdistributed.com/2007/10/amazons_dynamo.html)
- [Jump Consistent Hash](https://arxiv.org/abs/1406.2294)
- [Maglev](https://www.usenix.org/conference/nsdi16/technical-sessions/presentation/eisenbud)
