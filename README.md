# Aviation ML Assurance Card

**Draft v0.1, MIT.** A vendor-side JSON disclosure for machine-learning systems proposed for civil aviation use. It extends the [Kinetic Gain Protocol Suite](https://github.com/mizcausevic-dev/kinetic-gain-protocol-suite) in the same document family as Clinical AI Disclosure and AI Tutor Cards.

The card records a publisher's intended use, **declared** EASA AI typology, proposed target DAL, operational design domain (ODD), learning and dataset evidence, human-AI teaming, and standards posture by **identifier only**. A schema-valid card does not establish airworthiness, regulatory acceptance, a correct DAL, or that linked evidence proves a claim.

## Quickstart

1. Choose a stable `system.id` and author JSON against [aviation-ml-card.schema.json](aviation-ml-card.schema.json). Use the [fictional example](examples/synthetic-inspection-assistant.json) only as a format demonstration.
2. Run `npm ci` and `npm test`. This runs local JSON Schema 2020-12 checks, one-to-one ODD condition mapping checks, and known-invalid controls.
3. If a vendor chooses public discovery, serve its own card over HTTPS at `/.well-known/aviation-ml/<system_id>.json` with `Content-Type: application/json`. This repository does not deploy that path.
4. Link the card's dataset manifest and ODD evidence refs to separately reviewable artifacts. A URI is a pointer, not verified coverage.

The v0.1 `assurance.easa_ai_level` values are `1A`, `1B`, `2A`, `2B`, and `3A`. **`3B` is reserved and rejected** by this draft. For `2B` and `3A`, this Suite profile requires a declared human override path. That is a conservative disclosure rule, **not a statement that EASA mandates an override for every Level 2B design**. EASA's NPA 2025-07 is proposed material, and its Level 3 concept paper is exploratory. See [sources](docs/SOURCES.md).

## Files

- [SPEC.md](SPEC.md): field semantics, conditional rules, discovery, and limitations.
- [aviation-ml-card.schema.json](aviation-ml-card.schema.json): strict JSON Schema 2020-12 shape.
- [examples/](examples/): synthetic valid and deliberately invalid cards. No live aircraft, person, operator, dataset, or maintenance finding is represented.
- [docs/ORIGIN.md](docs/ORIGIN.md): design origin and boundaries.
- [docs/SOURCES.md](docs/SOURCES.md): official public sources and status checked on 2026-10-12.

## Relationship to the Suite

The vendor card may reference an Agent Card, AI Evidence records, and an AI Incident Card index. The [MRO AI Sign-off Card](https://github.com/mizcausevic-dev/mro-ai-signoff-card-spec) is a separate per-artifact human review record. The [Procurement Decision Card](https://github.com/mizcausevic-dev/ai-procurement-decision-spec) remains the buyer-side approval artifact. None of these cards executes a safety function or grants maintenance-release authority.

The corresponding `mcp-kinetic-gain` tools and public Suite pages should be described as available only after their own reviewed release and live verification. This draft repository alone does not change the published MCP package.

## Status and license

This is a draft format, not an EASA, FAA, SAE, EUROCAE, or NIST standard. The text, schema, examples, and local validation code are [MIT-licensed](LICENSE). Normative commercial standards are cited only by identifier; their copyrighted text is not reproduced.
