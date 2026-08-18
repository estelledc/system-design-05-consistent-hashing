# Operations guide

## Activation contract

Treat a ring snapshot as configuration, not ambient mutable state.

1. Authenticate and validate the proposed membership, weights, virtual-node count, and hash version.
2. Build the candidate ring off the request path and record its fingerprint.
3. Compare old and new placement over the real key catalogue when available. The included simulator uses generated keys and cannot replace that inventory.
4. Copy or repair data for the candidate owners. Define how reads and writes behave during this window.
5. Activate one version under a coordinated control-plane decision.
6. Observe errors and movement; retain a rollback window.
7. Delete old copies only after migration, convergence, and rollback gates succeed.

## Signals worth exporting

| Signal | Why it matters | Alert candidate |
|---|---|---|
| Active fingerprint by client cohort | Detects split configuration | More than one expected fingerprint after rollout grace period |
| Lookup failures by reason | Catches invalid config, key, or replica count | Any sustained non-user validation error |
| Requests and bytes per physical owner | Shows imbalance that token ownership alone misses | Sustained deviation from capacity-weighted target |
| Hot-key contribution, privacy-safe | Reveals skew hidden by aggregate balance | Small key set dominates an owner |
| Planned and completed moved bytes | Separates routing plan from actual migration | Plan grows while completion stalls |
| Replica repair backlog and age | Preference list is not durability | Backlog violates recovery objective |
| Ring build time and token count | Protects control-plane resources | Approaches configured build budget or token cap |

The library does not emit metrics or health endpoints because it is not a daemon. The host should expose these signals alongside its own liveness and readiness checks.

## Failure policy

- Invalid candidate configuration: reject it; keep the last accepted immutable ring.
- Fingerprint disagreement: fail closed for destructive migration actions. Request serving may use a deliberate compatibility policy, but silent mixed placement is unsafe.
- Unhealthy owner: the pure ring still returns its deterministic preference list. A host may try the next replica for reads only if its consistency and staleness contract permits it.
- Migration timeout: stop cleanup, keep receipts, and decide rollback versus repair. Recomputing a ring is not recovery.
- Hot node: first distinguish token imbalance, unequal capacity, a hot key, and application locality. Increasing virtual nodes only targets the first category.

## Simulator interpretation

`simulate` enumerates deterministic synthetic keys for one seed. `unexpectedDestination = 0` on addition and `unexpectedSource = 0` on removal are algorithm-property checks over that corpus. The moved fraction and distribution are samples. They do not predict exact production bytes, request rates, cache warmth, or migration duration.

## Reproducible commands

```sh
npm ci --ignore-scripts
npm run check
node bin/consistent-hash.mjs ring --nodes cache-a,cache-b:2,cache-c --vnodes 256
node bin/consistent-hash.mjs locate --nodes cache-a,cache-b,cache-c --key order-42 --replicas 2
node bin/consistent-hash.mjs simulate --nodes cache-a,cache-b,cache-c,cache-d --add cache-e --keys 100000 --seed review
```
