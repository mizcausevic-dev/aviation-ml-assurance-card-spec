# Aviation ML Assurance Card v0.1 specification

**Status:** draft. **Wire version:** `0.1`. **License:** MIT.

The key words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are used as normative requirements of this draft format. They do not impose or restate aviation regulatory requirements.

## 1. Scope

An Aviation ML Assurance Card is a vendor's machine-readable disclosure about one civil aviation ML system version. It is not a certification artifact, safety assessment, airworthiness approval, maintenance release, or proof of the truth of the vendor's claims. It does not cover controlled defense technical data. Do not publish sensitive aircraft, operator, export-controlled, or personal data in a public card.

## 2. Document identity and discovery

The top-level `aviation_ml_card_version` **MUST** equal `"0.1"`. `system.id` **MUST** be a stable kebab-case identifier scoped to the publisher. If the publisher elects public discovery, it **SHOULD** serve the card at:

```
https://<publisher-origin>/.well-known/aviation-ml/<system_id>.json
```

The server **SHOULD** use `Content-Type: application/json`, HTTPS, an appropriate cache policy, and a documented revocation/change path. A URL convention does not imply that this repository hosts a live card.

## 3. Required fields

| Field | Meaning |
|---|---|
| `system.{id,name,version,provider,intended_use}` | Publisher-declared identity and intended use for one model/system version. |
| `assurance.easa_ai_level` | Publisher-declared EASA AI typology: `1A`, `1B`, `2A`, `2B`, or `3A`; `3B` is reserved outside v0.1. |
| `assurance.target_dal` | Proposed target development assurance level `A` to `E`, or `not_assigned`; not authority approval. |
| `assurance.standards_posture[]` | Standards **identifiers** and publisher status only. No paywalled objective text. |
| `odd.{summary,operating_conditions[],excluded_conditions[]}` | Declared ODD and its explicit exclusions. |
| `odd.coverage_evidence_refs[]` | URIs of overall coverage reports, possibly empty in an incomplete draft. |
| `odd.condition_evidence[]` | Exactly one row per operating condition, with zero or more evidence URIs. Empty evidence lists are explicit gaps. |
| `odd.condition_evidence[].{condition_id,bin_refs}` | Optional stable condition ID and exact pairs of dataset-manifest ODD dimension/bin IDs. Both fields appear together. Empty `bin_refs` is an explicit unmapped condition. |
| `learning_assurance.{process_summary,evidence_refs[]}` | Publisher-declared learning lifecycle and evidence pointers. |
| `data_management.{dataset_manifest_refs[],split_policy}` | Dataset provenance pointers and train/validation/test split policy. |
| `human_ai_teaming.{role,human_override_available,human_responsibility_summary}` | Declared allocation of responsibility and override availability. |

`role="autonomous"` in this draft is limited to **human-overridable advanced automation**. It does not represent Level 3B's non-overridable operation.

## 4. Conditional and semantic rules

1. When `assurance.easa_ai_level` is `2B` or `3A`, `human_ai_teaming.human_override_available` **MUST** be `true` and `override_procedure_ref` **MUST** be an HTTPS URI. This is a conservative **Suite disclosure profile**, not a claim that EASA mandates this for every 2B design.
2. A target DAL `A` to `E` **MUST** include `target_dal_basis_ref`. `not_assigned` does not require one.
3. A `standards_posture[]` entry with `status="internal_assessment"` **MUST** include `evidence_uri`. The status is the publisher's internal status, not certification.
4. `odd.condition_evidence[]` **MUST** map every `odd.operating_conditions[]` string exactly once. The schema checks row shape; the local semantic validator checks set equality and duplicates. An empty `evidence_refs[]` is valid but an explicit gap.
5. An operating condition **MUST NOT** also be listed under `excluded_conditions[]`. Standards identifiers **MUST NOT** be repeated.
6. `data_management.split_policy="other"` **MUST** include `split_policy_detail`.
7. When a publisher uses `condition_id`/`bin_refs`, every operating condition **MUST** have a unique `condition_id`. A bin pair **MUST** name a declared dimension and bin in the specific, content-hashed dataset manifest cited as evidence. The schema checks syntax; a packet validator or reviewer **MUST** verify the cross-document pair. Do not infer that one bin count measures the entire condition.

Data leakage detection and ODD coverage evaluation are separate engineering tasks. The card stores pointers to their outputs; it cannot prove that a test dataset was independent or that all operating conditions were exercised. Consumers **MUST NOT** convert a schema-valid or gap-free card into a certification conclusion.

The optional bin IDs are stable only within the cited manifest snapshot. A changed dimension/bin name changes the manifest hash and requires a fresh mapping review. A report's per-bin evaluation count is an observation against the author's threshold; it is not a representative-coverage percentage. Missing or undeclared sample values, unmapped conditions, and unknown bin references need distinct findings. See the [synthetic packet](examples/golden-packet/README.md) for executable examples.

## 5. Standards posture and versioning

The `identifier` field may name `SAE ARP6983`, `EUROCAE ED-324`, `RTCA DO-178C`, or `SAE ARP4754B` when applicable, but it carries no claim that the system meets them. To make an objective-level crosswalk, a publisher **SHOULD** record only verified identifiers and a citation to public material or a licensed internal reference. This spec reproduces none of the standards' text.

Breaking wire changes require a new `aviation_ml_card_version`. EASA proposals and guidance may change; a card **SHOULD** state its source revision in its linked evidence rather than treating this draft enum as a regulatory determination.

## 6. Security and privacy

Every URI is untrusted input. Validators **MUST NOT** fetch a URI to validate JSON shape; tools that fetch documents need independent SSRF controls, timeouts, size limits, and authentication boundaries. Public cards **MUST NOT** contain export-controlled technical data, live aircraft identifiers, personal details, or unreleased safety findings. Example data in this repository is fictional.

The card's `links` block MAY point to Agent Cards, AI Evidence, and an AI Incident Card index. A buyer may cite it from a Procurement Decision Card, but that buyer decision is separate from vendor disclosure and from aviation authority action.
