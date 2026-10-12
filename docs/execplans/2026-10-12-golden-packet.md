# Synthetic aerospace packet integration plan

Status: local verification complete; hosted PR checks pending. Scope: a review-only PR; no public card endpoint, package release, or real aviation data.

## Acceptance

1. A fictional packet links an Aviation ML Card, actual dataset manifest and analyzed report, detached report attestation, MRO signed review card and source artifact, aviation Incident Card profile, and pending Procurement Decision Card.
2. Each local `example.invalid` URI has one explicit fixture mapping. The packet gate checks IDs, artifact and document digests, report-to-manifest binding, model version, and cross-card references without fetching arbitrary URLs.
3. Card ODD conditions have stable local IDs and explicit manifest dimension/bin pairs. Missing mappings, unknown bin references, and unknown evaluation values are separately reported. Per-bin counts never become a statistical coverage or airworthiness claim.
4. The report and MRO signatures verify with pinned synthetic public keys. Tampered bytes, missing mappings, bad hashes, broken references, and untrusted keys fail.
5. A pinned GitHub workflow runs the full local validators, dataset analyzer, detached-signature verification, packet gate, and fleet summary Action. CI and local results are recorded before review.

## Decisions and limits

- Keep the packet in this spec repo. It tests the other published spec schemas and the Rust CLI at reviewed commits; it does not create another product or MCP server.
- Add optional `condition_id` and `bin_refs` to v0.1 ODD rows. Existing cards remain shape-compatible. A bin pair is an identifier within one content-hashed manifest; it is not a globally defined ODD ontology.
- Use synthetic keys and `example.invalid` URIs. A signature check proves only possession of the corresponding test key, not reviewer identity, authority, or source rights.
- The buyer card stays `pending`. No buyer or maintenance release is represented.

## Verification record

- `npm.cmd ci` in this repo: exit 0; six test-only packages installed, audit reported zero vulnerabilities.
- `npm.cmd test`: exit 0; existing valid and invalid card controls passed.
- `npm.cmd run test:packet`: exit 0; four schemas, the URI map, fresh Rust analysis, both independent test-key signature checks, document and artifact hashes, chronology, and tamper/gap negatives passed. The positive ODD map reported two evaluation samples for each of two declared bins and no unknowns. These are fixture counts only.
- `npm.cmd ci` and `npm.cmd test` in `mro-ai-signoff-card-spec`: exit 0; its original signed fixture and malformed/tampered controls passed.
- `python -m unittest discover -s tests -v` in `ai-incident-card-spec`: exit 0, 5 tests. The packet validator also independently checks the pinned Incident schema.
- `cargo clippy --locked --all-targets --manifest-path .../aero-dataset-provenance-rs/Cargo.toml -- -D warnings` and `cargo test --locked --all-targets --manifest-path .../aero-dataset-provenance-rs/Cargo.toml` from this repo: exit 0, 8 Rust tests. `cargo fmt --all --check` in the Rust repo: exit 0 on unsandboxed retry; sandboxed attempt failed with Windows access denied before checking formatting.
- `actionlint .github/workflows/golden-packet.yml`, `node --check scripts/validate-golden-packet.mjs`, `git diff --check`, and `gitleaks detect --source . --no-git --exit-code 1 --redact`: exit 0; gitleaks reported no findings in the checked files.
- Hosted CI: pending an exact-head pull request run. The workflow checks out five referenced repos/actions by SHA, runs the structural fleet Action separately, and runs schema, Rust, signature, and packet gates.
