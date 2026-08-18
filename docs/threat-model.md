# Threat model

## Assets and trust boundary

The protected assets are deterministic placement, ring configuration integrity, data availability during membership changes, and the confidentiality of application keys and topology. This package receives membership and keys from a host application. It does not authenticate an operator or secure a transport.

Trusted inputs are limited to a configuration that the host has authenticated and authorized. Keys may be untrusted. Node IDs are restricted to short ASCII identifiers so fingerprints are portable and logs do not accept control characters or paths.

## Abuse and failure cases

| Threat | Impact | Mitigation here | Remaining host responsibility |
|---|---|---|---|
| Unauthorized node addition | Traffic or data routed to an attacker | Deterministic fingerprint exposes a changed config | Sign/authorize config, distribute it securely, audit activation |
| Split membership views | Different clients choose different owners | Fingerprint and immutable snapshots | Version negotiation, convergence gate, rollback |
| Adversarial or skewed keys | Hot node or resource exhaustion | 4,096-character key limit; SHA-256 avoids trivial weak-hash structure | Rate limits, hot-key detection, salting/splitting, admission control |
| Oversized config | CPU and memory exhaustion during build | Caps on node weight, virtual nodes, and one million total tokens | Bound config payload and update frequency before construction |
| Hash algorithm drift | Large silent remap | Explicit hash version in fingerprint | Treat version change as a migration with compatibility policy |
| Raw key disclosure | Sensitive identifiers in logs or receipts | Library emits owners and hashes only when caller requests them; sample uses synthetic keys | Do not log raw application keys; classify and minimize topology logs |
| Node ID injection | Ambiguous fingerprints or logs | Strict 1–128 character identifier grammar | Map infrastructure identities to safe stable IDs |
| False durability assumption | Data loss after routing change | Documentation labels preference lists as placement only | Replication protocol, acknowledgements, repair, backups |

## Cryptographic boundary

SHA-256 is used here for deterministic placement, not authentication. Truncating to 64 bits makes the ring compact but permits collisions; deterministic tie-breaking preserves behavior, not cryptographic collision resistance. If attackers can profit from choosing placement, the host may require a secret keyed hash and coordinated key rotation. That is a different operational contract and is intentionally not hidden behind a fallback.

## Privacy

Real keys, membership lists, capacity weights, and movement plans can reveal product or infrastructure details. The repository and its tests use synthetic data only. Production observability should use bounded-cardinality node aliases and aggregate movement metrics rather than raw keys.
