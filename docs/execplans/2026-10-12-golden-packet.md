# Synthetic aerospace packet integration plan

Status: local verification complete and the hosted packet workflow passed at `6b64b16`. Scope: review-only PRs; no public card endpoint, package release, or real aviation data.

## Goal

Make the proposed aviation artifacts reviewable as one fictional packet with reproducible cross-repository checks, without implying certification or buyer approval.

## Current state

The Aviation ML Card, MRO Sign-off Card, AI Incident Card, Procurement Decision Card, Rust dataset tool, and fleet Action live in separate repositories. Before this packet, the Rust report did not map its manifest bin labels to named Aviation Card operating conditions. All examples here are synthetic; there is no buyer or operational dataset.

## Scope

Add packet fixtures, optional Aviation Card condition/bin identifiers, a local validator, and pinned CI in this spec repository. Repair only the parallel Rust test fixture race exposed by hosted CI. No new repository, new MCP server, real aviation data, endpoint deployment, or public release.

## Acceptance criteria

1. A fictional packet links an Aviation ML Card, actual dataset manifest and analyzed report, detached report attestation, MRO signed review card and source artifact, aviation Incident Card profile, and pending Procurement Decision Card.
2. Each local `example.invalid` URI has one explicit fixture mapping. The packet gate checks IDs, artifact and document digests, report-to-manifest binding, model version, and cross-card references without fetching arbitrary URLs.
3. Card ODD conditions have stable local IDs and explicit manifest dimension/bin pairs. Missing mappings, unknown bin references, and unknown evaluation values are separately reported. Per-bin counts never become a statistical coverage or airworthiness claim.
4. The report and MRO signatures verify with pinned synthetic public keys. Tampered bytes, missing mappings, bad hashes, broken references, and untrusted keys fail.
5. A pinned GitHub workflow runs the full local validators, dataset analyzer, detached-signature verification, packet gate, and fleet summary Action. CI and local results are recorded before review.

## Risks and release class

R2 review-only, cross-repository data-model work. Material risks are falsely treating declared ODD counts as representative coverage, trusting synthetic signer keys or identities, stale cross-repository pins, and accidental publication of aircraft or personnel data. The packet contains only tiny fictional text samples; its validator makes no network requests. No cloud dataset or hosting spend is part of this review. Rollback is branch/PR withdrawal before merge; a future merged change would need a reviewed revert and rerun.

## Design

The Card binds each named operating condition to stable local `condition_id` and exact manifest `dimension`/`bin` references. The validator resolves only explicitly mapped `example.invalid` fixtures, re-runs the Rust analyzer over committed bytes, compares the report, verifies detached signatures with checked-in test-only public keys, and checks cross-card IDs and hashes. A pinned workflow executes the same checks and the fleet Action. Keeping the packet in the Aviation Card repo avoids a separate product surface; the Rust tool remains a generic manifest analyzer.

## Execution sequence

1. Extend `aviation-ml-card.schema.json` and `scripts/validate-examples.mjs` with optional condition IDs and bin references.
2. Add `examples/golden-packet/` and `scripts/validate-golden-packet.mjs`; exercise positive and tamper/gap paths.
3. Pin each dependency in `.github/workflows/golden-packet.yml`, run local checks, and open the review PR.
4. Repair the Rust test-directory collision in its own PR, update the workflow pin, and require exact-head hosted CI.

## Decisions

- Keep the packet in this spec repo. It tests the other published spec schemas and the Rust CLI at reviewed commits; it does not create another product or MCP server.
- Add optional `condition_id` and `bin_refs` to v0.1 ODD rows. Existing cards remain shape-compatible. A bin pair is an identifier within one content-hashed manifest; it is not a globally defined ODD ontology.
- Use synthetic keys and `example.invalid` URIs. A signature check proves only possession of the corresponding test key, not reviewer identity, authority, or source rights.
- The buyer card stays `pending`. No buyer or maintenance release is represented.

## Verification

- `npm.cmd ci` in this repo: exit 0; six test-only packages installed, audit reported zero vulnerabilities.
- `npm.cmd test`: exit 0; existing valid and invalid card controls passed.
- `npm.cmd run test:packet`: exit 0; four schemas, the URI map, fresh Rust analysis, both independent test-key signature checks, document and artifact hashes, chronology, and tamper/gap negatives passed. The positive ODD map reported two evaluation samples for each of two declared bins and no unknowns. These are fixture counts only.
- `npm.cmd ci` and `npm.cmd test` in `mro-ai-signoff-card-spec`: exit 0; its original signed fixture and malformed/tampered controls passed.
- `python -m unittest discover -s tests -v` in `ai-incident-card-spec`: exit 0, 5 tests. The packet validator also independently checks the pinned Incident schema.
- `cargo clippy --locked --all-targets -- -D warnings`, `cargo fmt --all --check`, and `cargo test --locked --all-targets` in the Rust repair branch: exit 0; 9 Rust tests, including 32 concurrent fixture creations. Formatting and Clippy needed unsandboxed retries because the Windows sandbox denied their configuration read.
- `actionlint .github/workflows/golden-packet.yml`, `node --check scripts/validate-golden-packet.mjs`, `git diff --check`, and `gitleaks detect --source . --no-git --exit-code 1 --redact`: exit 0; gitleaks reported no findings in the checked files.
- Hosted run [38301102426](https://github.com/mizcausevic-dev/aviation-ml-assurance-card-spec/actions/runs/38301102426): structural-summary succeeded; packet failed before this repo's integration gate because the pinned Rust dependency's parallel tests hit `AlreadyExists` while creating a fixture directory. Rust repair PR [#1](https://github.com/mizcausevic-dev/aero-dataset-provenance-rs/pull/1) changes test fixtures only and is pinned here at `7f84b7ec51fc803224b8a7bcdb7b379c707258a9`; its [push](https://github.com/mizcausevic-dev/aero-dataset-provenance-rs/actions/runs/38301479961) and [PR](https://github.com/mizcausevic-dev/aero-dataset-provenance-rs/actions/runs/38301510309) CI each passed.
- Hosted packet [run 38301669033](https://github.com/mizcausevic-dev/aviation-ml-assurance-card-spec/actions/runs/38301669033) at `66cec49` passed the `packet` and `structural-summary` jobs; baseline `validate` [run 38301669028](https://github.com/mizcausevic-dev/aviation-ml-assurance-card-spec/actions/runs/38301669028) passed. The packet job ran the pinned Rust format, Clippy, tests and build, both npm validator suites, regenerated dataset report/signature checks, and tamper controls. These results do not verify any actual vendor, buyer, or aviation deployment.
- Exact-head `ce0cdfb` [packet and structural-summary](https://github.com/mizcausevic-dev/aviation-ml-assurance-card-spec/actions/runs/38301826307) and [baseline validate](https://github.com/mizcausevic-dev/aviation-ml-assurance-card-spec/actions/runs/38301826387) also passed.

## Deployment and rollback

There is no deployment target or deploy command in this PR-only phase. Review the two linked PRs below and require exact-head CI again after each update. Withdraw the PRs to discard the candidate before merge. If merged later, revert the relevant commits and rerun validation; no runtime state migration is involved.

## Progress

- [x] Packet, mapping, negative controls, and local checks completed.
- [x] Rust CI race repaired in a separate PR, originally pinned at `7f84b7e`.
- [x] Earlier hosted packet, fleet summary, baseline validator, and Rust PR checks passed at their recorded heads.
- [x] Local report v0.2.0 packet regenerated and checked against Rust `dc6ff8f`.
- [x] Hosted packet, structural summary, and baseline validation passed at `6b64b16` after the report v0.2.0 refresh.
- [ ] Merge or publication: outside this review-only scope.

## Outcome

[Aviation packet PR #1](https://github.com/mizcausevic-dev/aviation-ml-assurance-card-spec/pull/1) and [Rust PR #1](https://github.com/mizcausevic-dev/aero-dataset-provenance-rs/pull/1) remain open and unmerged at this review checkpoint. The locally refreshed fictional packet reports two distinct observed file hashes in each of its two referenced bins, no declared gaps, and passing cryptographic checks against test-only keys. The refreshed packet's [hosted packet and structural-summary jobs](https://github.com/mizcausevic-dev/aviation-ml-assurance-card-spec/actions/runs/38307010652) and [baseline validator](https://github.com/mizcausevic-dev/aviation-ml-assurance-card-spec/actions/runs/38307010623) passed at `6b64b16`; rerun exact-head CI after any further update. This does not establish independent acquisitions, representative coverage, source rights, reviewer authority, maintenance release, procurement approval, airworthiness, or a deployed boundary. Merge order, if later authorized: Rust PR first, then repin the Aviation workflow to the merged Rust commit and rerun exact-head checks.

## Report v0.2.0 follow-up (2026-10-12)

The reviewed Rust PR head `dc6ff8fb1d0558df7ac009883c2bfead8d76971d` changes ODD `evaluation_samples` from manifest-row counts to distinct observed SHA-256 file hashes within each bin. Historical v0.1.0 signatures remain verifiable for archival use, but new signing requires report v0.2.0. The Aviation packet validator now requires v0.2.0 and independently recounts hashes from the manifest and report. The existing validation and test files differ, so the fictional per-bin count remains two. Distinct bytes do not prove independent acquisitions or adequate coverage.

The manual `scripts/regenerate-golden-packet.mjs --write` helper checked the exact Rust commit and MRO signature-helper commit `c3cf35b8955194266d70eb855b307ddb6c1bd1dd`, with clean tracked source trees. It generated fresh Ed25519 keys in process memory, passed the dataset seed only through a child-process environment variable, and wrote only test public keys. Test key selectors now include complete public-key SHA-256 fingerprints. The regenerated report signature was timestamped `2026-10-12T20:49:49Z`; synthetic MRO review/sign, incident discovery/disclosure/publication, and the pending buyer fixture were stamped in order through `20:49:55Z`. A wall-clock readback at `20:50:06Z` showed no future-dated fixture. The MRO and incident JCS hashes in the pending Decision Card were recomputed; its status remains `pending`.

Executed checks at this local follow-up head:

- `cargo build --locked` and `cargo test --locked --all-targets` in the exact Rust worktree: exit 0; 14 Rust tests passed. Windows emitted path-canonicalization and hardlink-cache warnings.
- `npm.cmd test` and `npm.cmd run test:packet` in this worktree: exit 0; local schema/negative controls and the fresh four-schema packet, report parity, two signatures, hashes, timeline, and tamper/gap controls passed.
- The pinned fleet Action `dist/index.cjs` on both golden cards: exit 0, declared-field gate passed. It does not validate evidence or signer authority.
- `node --check scripts/regenerate-golden-packet.mjs`, `node --check scripts/validate-golden-packet.mjs`, `actionlint .github/workflows/golden-packet.yml`, and `git diff --check`: exit 0.
- `gitleaks detect --source . --no-git --exit-code 1 --redact`: exit 0; it reported no findings over approximately 85.6 KB. This scan is not proof that a complete security audit is clean.

After this preparation checkpoint, the refreshed Aviation packet's hosted jobs passed at `6b64b16` as linked above. Any real signer identity, buyer, maintenance authority, dataset rights, representative ODD coverage, and deployment remain unverified.

## Dependency merge checkpoint (2026-10-13 ET)

The reviewed Rust provenance head `dc6ff8f` merged unchanged at `b29b500e29fcac266543325355c0a28bc7c4a542`; the reviewed MRO signature-helper head `7bd2758` merged unchanged at `09095ea2bd1c0abd9fe8454be743711fcc835912`. Both post-merge validation workflows succeeded. The Aviation packet workflow and manual regeneration helper now pin those merged commits. The later packet validator review also added negative controls for padded MRO signatures, duplicate buyer references, incorrect URI-to-file bindings, and incident disclosure before discovery.

At this checkpoint Aviation PR #1 is still a source candidate. No package, Pages site, or hosted endpoint was published by these dependency merges. The packet remains fictional and cannot establish dataset rights, signer authority, representative ODD coverage, buyer approval, maintenance release, or airworthiness.
