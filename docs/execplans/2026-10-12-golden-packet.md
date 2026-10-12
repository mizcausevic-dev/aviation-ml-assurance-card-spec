# Synthetic aerospace packet integration plan

Status: local verification complete and the repaired hosted packet workflow passed at `66cec49`. Scope: review-only PRs; no public card endpoint, package release, or real aviation data.

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
- `cargo clippy --locked --all-targets -- -D warnings`, `cargo fmt --all --check`, and `cargo test --locked --all-targets` in the Rust repair branch: exit 0; 9 Rust tests, including 32 concurrent fixture creations. Formatting and Clippy needed unsandboxed retries because the Windows sandbox denied their configuration read.
- `actionlint .github/workflows/golden-packet.yml`, `node --check scripts/validate-golden-packet.mjs`, `git diff --check`, and `gitleaks detect --source . --no-git --exit-code 1 --redact`: exit 0; gitleaks reported no findings in the checked files.
- Hosted run [38301102426](https://github.com/mizcausevic-dev/aviation-ml-assurance-card-spec/actions/runs/38301102426): structural-summary succeeded; packet failed before this repo's integration gate because the pinned Rust dependency's parallel tests hit `AlreadyExists` while creating a fixture directory. Rust repair PR [#1](https://github.com/mizcausevic-dev/aero-dataset-provenance-rs/pull/1) changes test fixtures only and is pinned here at `7f84b7ec51fc803224b8a7bcdb7b379c707258a9`; its [push](https://github.com/mizcausevic-dev/aero-dataset-provenance-rs/actions/runs/38301479961) and [PR](https://github.com/mizcausevic-dev/aero-dataset-provenance-rs/actions/runs/38301510309) CI each passed.
- Hosted packet [run 38301669033](https://github.com/mizcausevic-dev/aviation-ml-assurance-card-spec/actions/runs/38301669033) at `66cec49` passed the `packet` and `structural-summary` jobs; baseline `validate` [run 38301669028](https://github.com/mizcausevic-dev/aviation-ml-assurance-card-spec/actions/runs/38301669028) passed. The packet job ran the pinned Rust format, Clippy, tests and build, both npm validator suites, regenerated dataset report/signature checks, and tamper controls. These results do not verify any actual vendor, buyer, or aviation deployment.
