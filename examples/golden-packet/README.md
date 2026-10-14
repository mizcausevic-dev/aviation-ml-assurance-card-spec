# Synthetic aerospace packet

This is one **fictional, offline** chain of artifacts. The URLs use the reserved `example.invalid` domain and are mapped to local files by [`refs.json`](refs.json); nothing is hosted or fetched. The packet does not represent a buyer, operator, aircraft, certifying staff member, regulatory filing, maintenance release, or authority approval.

| Artifact | Packet role |
| --- | --- |
| [`aviation-card.json`](aviation-card.json) | Vendor-side system version and ODD declaration. `condition_id` plus each exact `dimension`/`bin` pair binds a named card condition to a bin in the content-hashed dataset manifest. |
| [`dataset/manifest.json`](dataset/manifest.json) and [`dataset-report.json`](dataset-report.json) | Actual byte hashes, split-leakage checks, temporal check, and report v0.2.0 ODD-bin counts generated with `aero-dataset-provenance-rs` at commit `dc6ff8fb1d0558df7ac009883c2bfead8d76971d`. Each bin counts distinct observed validation/test file hashes. The three tiny text samples are synthetic; different hashes do not prove independent acquisitions or representative coverage. |
| [`dataset-report.attestation.json`](dataset-report.attestation.json) | Detached `hash-attestation` v0.2 signature under a synthetic, public-key-fingerprinted selector. [`dataset-public-key.b64`](dataset-public-key.b64) is a test-only verification key; the signing key was ephemeral and was not committed. |
| [`mro-card.json`](mro-card.json) and [`synthetic-observation.json`](synthetic-observation.json) | Per-artifact human review fixture with an exact byte digest and a separate JCS-SHA256-Ed25519 signature. Its test-only public key is [`mro-public-key.pub`](mro-public-key.pub). The fictional reviewer **overrides the model suggestion**, not a maintenance decision. |
| [`incident-card.json`](incident-card.json) | Existing AI Incident Card aviation profile, linking the vendor and MRO records. The local index is [`incident-index.json`](incident-index.json). |
| [`buyer-decision.json`](buyer-decision.json) | Existing Procurement Decision Card v0.1, **pending**. It records JCS SHA-256 hashes of the synthetic documents; no buyer approval is simulated. |

## Validate locally

Clone the four dependency repos as siblings of this repo (`aero-dataset-provenance-rs`, `mro-ai-signoff-card-spec`, `ai-incident-card-spec`, and `ai-procurement-decision-spec`). The CI workflow instead checks out their **exact reviewed commits** into `deps/` and sets the `AERO_*_DIR` paths. Then run from this repo:

```powershell
npm ci
npm test
cargo build --locked --manifest-path ..\aero-dataset-provenance-rs\Cargo.toml
npm run test:packet
```

The gate validates all four document schemas, requires report v0.2.0 and independently recounts distinct evaluation file hashes per bin, re-runs the Rust analyzer against the committed sample bytes, compares the regenerated report to the committed report, verifies both signatures with local test keys, and checks model IDs, version, artifact digest, JCS document hashes, and every packet URI. It exercises inflated counts, tampered signatures and reports, wrong keys, an unmapped condition, a nonexistent bin, and an unknown evaluation value. It prints separate ODD finding lists and each **per-bin distinct-file count**.

The workflow pins the reviewed MRO signature helper at `7bd2758b50704ff8761145d497e9d0c6eb4f2e4b` and rejects non-canonical padded signature encoding. That MRO commit remains an unmerged review candidate; repin to its merged commit and rerun the packet before a Suite release.

These counts only describe this tiny declared sample set against an author-supplied minimum of one. Distinct bytes are not proof of independent acquisition. They do **not** show representative ODD coverage, source rights, model performance, real reviewer identity, certifying authority, or airworthiness. The `authority_verified: false` fixture is intentional. The fleet Action runs in a separate CI job as a fast structural gate; only the packet job performs full schema and cryptographic checks. All links to paywalled aviation standards remain identifiers, without copied text.

To regenerate these fictional signatures after a reviewed Rust report change, build the exact Rust commit pinned in CI and run `node scripts/regenerate-golden-packet.mjs --write` from the Aviation repository. The helper creates new test keys in memory and writes only public keys. It reads the current UTC clock for each successive fictional event; inspect its diff and rerun both validators before proposing the changed packet. Never use this helper with real personnel, aircraft, or buyer records.
