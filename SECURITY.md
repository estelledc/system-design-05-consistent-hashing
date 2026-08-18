# Security policy

## Supported version

Only the current `main` branch is maintained. This repository is an executable design study, not a hosted service.

## Reporting

Please report a vulnerability through GitHub's private security-advisory flow. Do not include credentials, customer keys, production membership lists, or other sensitive data in a public issue.

## Scope boundary

The library validates node identifiers, weights, replica counts, sample sizes, and key lengths. Its SHA-256 mapping is deterministic but unkeyed: it is not an authentication primitive and does not make hostile or skewed key distributions safe. The embedding system remains responsible for authenticating membership changes, distributing one canonical ring configuration, detecting node health, protecting data, and executing migrations.

See [Threat model](docs/threat-model.md) for the detailed trust boundary.
