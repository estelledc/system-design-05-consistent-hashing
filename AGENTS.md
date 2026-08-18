# Consistent Hashing contributor guide

- Preserve deterministic mapping for the same ring fingerprint and key.
- Treat movement, distribution, and benchmark outputs as sampled evidence, not universal guarantees.
- Membership changes are explicit immutable snapshots; do not hide mutable global ring state.
- Replica lists must contain distinct physical nodes.
- Add property tests for mapping or membership-change semantics.
- Do not copy diagrams or code from unlicensed system-design notes.
- Run `npm run check` before handoff.
