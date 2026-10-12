import { strict as assert } from "node:assert";
import { createHash, createPublicKey } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const repo = fileURLToPath(new URL("../", import.meta.url));
const packet = join(repo, "examples", "golden-packet");
const spec = (env, sibling) => resolve(process.env[env] ?? join(repo, "..", sibling));
const mroRepo = spec("AERO_MRO_SPEC_DIR", "mro-ai-signoff-card-spec");
const incidentRepo = spec("AERO_INCIDENT_SPEC_DIR", "ai-incident-card-spec-aero-20261012");
const decisionRepo = spec("AERO_DECISION_SPEC_DIR", "ai-procurement-decision-spec-aero-20261012");
const rustRepo = spec("AERO_DATASET_REPO", "aero-dataset-provenance-rs");
const rustBinary = resolve(process.env.AERO_DATASET_BIN ?? join(rustRepo, "target", "debug", `aero-dataset-provenance${process.platform === "win32" ? ".exe" : ""}`));
const { canonicalize, verifyCardSignatureRaw } = await import(pathToFileURL(join(mroRepo, "scripts", "signature-profile.mjs")));
const { parseJcsJsonStrict } = await import(pathToFileURL(join(mroRepo, "scripts", "strict-json.mjs")));

const raw = (name) => readFileSync(join(packet, name));
const json = (name) => parseJcsJsonStrict(raw(name));
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const jcsHash = (value) => sha256(Buffer.from(canonicalize(value), "utf8"));
const base = "https://example.invalid/aviation/packet/";
const resourceMap = json("refs.json");
const url = (name) => `${base}${name}`;

function fixtureFor(uri) {
  assert.ok(Object.hasOwn(resourceMap, uri), `unmapped synthetic URI: ${uri}`);
  assert.ok(uri.startsWith(base), `URI outside synthetic packet: ${uri}`);
  const local = resourceMap[uri];
  assert.equal(typeof local, "string");
  assert.ok(!isAbsolute(local) && !local.includes("\\"), `unsafe fixture mapping: ${local}`);
  const selected = resolve(packet, local);
  const subpath = relative(packet, selected);
  assert.ok(subpath && !subpath.startsWith(".." + sep) && subpath !== ".." && !isAbsolute(subpath), `fixture mapping escapes packet: ${local}`);
  readFileSync(selected); // Existence check without network access.
  return selected;
}

function assertAllPacketUrisMapped(value) {
  if (typeof value === "string" && value.startsWith(base)) fixtureFor(value);
  else if (Array.isArray(value)) value.forEach(assertAllPacketUrisMapped);
  else if (value && typeof value === "object") Object.values(value).forEach(assertAllPacketUrisMapped);
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
function validate(schemaPath, document, label) {
  const check = ajv.compile(parseJcsJsonStrict(readFileSync(schemaPath)));
  assert.ok(check(document), `${label}: ${ajv.errorsText(check.errors)}`);
}

function runRust(...args) {
  const env = { ...process.env };
  delete env.AERO_DATASET_SIGNING_KEY_B64;
  env.AERO_DATASET_VERIFYING_KEY_B64 = raw("dataset-public-key.b64").toString("ascii").trim();
  return spawnSync(rustBinary, args, {
    encoding: "utf8",
    env
  });
}

function oddFindings(card, manifest, report) {
  const findings = {
    unmapped_condition_ids: [],
    unknown_condition_rows: [],
    unknown_bin_refs: [],
    unknown_evaluation_values: [],
    below_declared_minimum: []
  };
  const conditionNames = card.odd.operating_conditions;
  const rows = card.odd.condition_evidence;
  assert.equal(new Set(conditionNames).size, conditionNames.length, "duplicate operating condition");
  const rowNames = rows.map((row) => row.condition);
  assert.equal(new Set(rowNames).size, rowNames.length, "duplicate condition row");
  for (const condition of conditionNames) {
    if (!rowNames.includes(condition)) findings.unmapped_condition_ids.push(`missing-row:${condition}`);
  }
  for (const condition of rowNames) {
    if (!conditionNames.includes(condition)) findings.unknown_condition_rows.push(condition);
  }
  const ids = new Set();
  const observed = new Map(report.odd_observations.map((dimension) => [dimension.dimension, dimension]));
  const counts = [];
  for (const row of rows) {
    const id = row.condition_id ?? `missing-id:${row.condition}`;
    assert.ok(!ids.has(id), `duplicate condition ID: ${id}`);
    ids.add(id);
    if (!row.condition_id || !Array.isArray(row.bin_refs) || row.bin_refs.length === 0) {
      findings.unmapped_condition_ids.push(id);
      continue;
    }
    const pairs = new Set();
    for (const ref of row.bin_refs) {
      const pair = `${ref.dimension}:${ref.bin}`;
      assert.ok(!pairs.has(pair), `duplicate bin reference: ${pair}`);
      pairs.add(pair);
      const manifestBins = manifest.odd_bins[ref.dimension];
      const bin = observed.get(ref.dimension)?.bins.find((item) => item.bin === ref.bin);
      if (!manifestBins?.includes(ref.bin) || !bin) {
        findings.unknown_bin_refs.push(`${id} -> ${pair}`);
        continue;
      }
      counts.push({ condition_id: id, bin_ref: pair, evaluation_samples: bin.evaluation_samples });
      if (!bin.meets_declared_minimum) findings.below_declared_minimum.push(`${id} -> ${pair}`);
    }
  }
  for (const dimension of report.odd_observations) {
    if (dimension.missing_or_undeclared_value_samples > 0) {
      findings.unknown_evaluation_values.push(`${dimension.dimension}:${dimension.missing_or_undeclared_value_samples}`);
    }
  }
  return { findings, counts };
}

function assertNoOddFindings(result) {
  assert.deepEqual(result.findings, {
    unmapped_condition_ids: [], unknown_condition_rows: [], unknown_bin_refs: [], unknown_evaluation_values: [], below_declared_minimum: []
  }, `ODD linkage has gaps: ${JSON.stringify(result.findings)}`);
}

function assertBuyerHashes(buyerDecision, documents) {
  assert.equal(buyerDecision.subject.documents_reviewed.length, documents.size);
  for (const ref of buyerDecision.subject.documents_reviewed) {
    const document = documents.get(ref.url);
    assert.ok(document, `unexpected buyer document: ${ref.url}`);
    assert.equal(ref.content_hash, jcsHash(document), `buyer content hash mismatch: ${ref.url}`);
  }
}

const card = json("aviation-card.json");
const mro = json("mro-card.json");
const incident = json("incident-card.json");
const decision = json("buyer-decision.json");
const manifest = json("dataset/manifest.json");
const report = json("dataset-report.json");
const attestation = json("dataset-report.attestation.json");
const authority = json("authority-record.json");

validate(join(repo, "aviation-ml-card.schema.json"), card, "aviation card");
validate(join(mroRepo, "mro-ai-signoff-card.schema.json"), mro, "MRO card");
validate(join(incidentRepo, "incident-card.schema.json"), incident, "incident card");
validate(join(decisionRepo, "decision-card.schema.json"), decision, "buyer decision card");
for (const document of [card, mro, incident, decision, attestation, json("incident-index.json")]) assertAllPacketUrisMapped(document);
for (const uri of Object.keys(resourceMap)) fixtureFor(uri);

assert.equal(card.system.id, mro.finding.model_id, "MRO model ID mismatch");
assert.equal(card.system.version, mro.finding.model_version, "MRO model version mismatch");
assert.equal(card.system.provider, incident.affected.vendor, "incident vendor mismatch");
assert.ok(incident.affected.products.includes(card.system.name), "incident product mismatch");
assert.ok(incident.affected.versions.includes(card.system.version), "incident model version mismatch");
assert.equal(incident.aviation_profile.aviation_ml_card_uri, url("aviation-card.json"));
assert.deepEqual(incident.aviation_profile.mro_signoff_card_uris, [url("mro-card.json")]);
assert.deepEqual(json("incident-index.json").incident_card_uris, [url("incident-card.json")]);
assert.equal(card.links.incident_card_index_uri, url("incident-index.json"));
assert.equal(card.data_management.dataset_manifest_refs[0], url("dataset-manifest.json"));
assert.equal(card.data_management.leakage_check_ref, url("dataset-report.json"));
assert.ok(card.odd.coverage_evidence_refs.includes(url("dataset-report.json")));
assert.ok(mro.evidence_refs.includes(url("dataset-report.json")));
assert.ok(mro.evidence_refs.includes(url("synthetic-observation.json")));

assert.equal(report.dataset_id, manifest.dataset_id, "dataset ID mismatch");
assert.equal(report.manifest_jcs_sha256, jcsHash(manifest), "manifest digest mismatch");
assert.equal(report.report_version, "0.1.0");
const observations = oddFindings(card, manifest, report);
process.stdout.write(`ODD findings ${JSON.stringify(observations.findings)}; per-bin observations ${JSON.stringify(observations.counts)}\n`);
assertNoOddFindings(observations);
assert.ok(report.declared_checks_passed, "Rust-declared checks failed");
assert.deepEqual(report.leakage_findings, []);
assert.deepEqual(report.temporal_violations, []);
for (const row of card.odd.condition_evidence) {
  assert.ok(row.evidence_refs.includes(url("dataset-report.json")), `missing report evidence for ${row.condition_id}`);
}

const artifact = raw("synthetic-observation.json");
assert.equal(mro.artifact.sha256, sha256(artifact).slice(7), "MRO artifact digest mismatch");
assert.equal(mro.artifact.byte_length, artifact.length, "MRO artifact byte length mismatch");
assert.equal(mro.human_review.staff_id, authority.staff_id);
assert.equal(mro.signature.key_id, authority.key_id);
assert.equal(authority.test_only, true);
assert.equal(authority.authority_verified, false);
assert.equal(mro.human_review.authority_ref, url("authority/synthetic-reviewer-01"));
assert.ok(Date.parse(mro.signature.signed_at) >= Date.parse(mro.human_review.reviewed_at));
assert.ok(Date.parse(mro.human_review.reviewed_at) >= Date.parse(attestation.signed_at), "MRO fixture predates report signature");
assert.ok(Date.parse(incident.incident.discovered_at) >= Date.parse(mro.signature.signed_at), "incident fixture predates MRO signature");
assert.ok(Date.parse(incident.published_at) >= Date.parse(incident.incident.disclosed_at), "incident published before disclosure");
const trustedMro = { keyId: authority.key_id, publicKey: createPublicKey(raw("mro-public-key.pub")) };
assert.ok(verifyCardSignatureRaw(raw("mro-card.json"), trustedMro), "MRO signature invalid");
assert.ok(!verifyCardSignatureRaw(JSON.stringify({ ...mro, finding: { ...mro.finding, confidence: 0.72 } }), trustedMro), "tampered MRO signature accepted");
assert.ok(!verifyCardSignatureRaw(raw("mro-card.json"), { ...trustedMro, keyId: "wrong-key" }), "wrong MRO key ID accepted");

assert.equal(decision.decision.status, "pending", "synthetic buyer decision must remain pending");
assert.equal(decision.subject.vendor_name, card.system.provider);
assert.equal(decision.subject.product_name, card.system.name);
const expectedDocs = new Map([
  [url("aviation-card.json"), card], [url("mro-card.json"), mro], [url("incident-card.json"), incident]
]);
assertBuyerHashes(decision, expectedDocs);
assert.ok(Date.parse(decision.issued_at) >= Date.parse(attestation.signed_at), "decision fixture predates report signature");
assert.ok(Date.parse(decision.issued_at) >= Date.parse(incident.published_at), "decision fixture predates incident publication");

const scratch = mkdtempSync(join(tmpdir(), "kg-aero-packet-"));
const subpath = relative(tmpdir(), scratch);
assert.ok(subpath && !subpath.startsWith(".." + sep) && !isAbsolute(subpath), "unsafe scratch path");
try {
  const regenerated = join(scratch, "dataset-report.json");
  const analyzed = runRust("analyze", join(packet, "dataset", "manifest.json"), join(packet, "dataset"), regenerated);
  assert.equal(analyzed.status, 0, `Rust analyzer failed: ${analyzed.stderr}`);
  assert.equal(canonicalize(parseJcsJsonStrict(readFileSync(regenerated))), canonicalize(report), "committed report differs from fresh dataset analysis");
  assert.equal(attestation.key_url, url("keys/dataset"), "report key URL differs from independently expected selector");
  const verifyArgs = [regenerated, join(packet, "dataset-report.attestation.json"), url("keys/dataset")];
  const verified = runRust("verify", ...verifyArgs);
  assert.equal(verified.status, 0, `Rust report signature failed: ${verified.stderr}`);
  const altered = structuredClone(report);
  altered.dataset_id = "TAMPERED";
  const tamperedPath = join(scratch, "tampered-report.json");
  writeFileSync(tamperedPath, `${JSON.stringify(altered)}\n`);
  assert.notEqual(runRust("verify", tamperedPath, verifyArgs[1], verifyArgs[2]).status, 0, "tampered report verified");
  const wrongKey = spawnSync(rustBinary, ["verify", ...verifyArgs], {
    encoding: "utf8",
    env: { ...process.env, AERO_DATASET_SIGNING_KEY_B64: "", AERO_DATASET_VERIFYING_KEY_B64: Buffer.alloc(32, 3).toString("base64") }
  });
  assert.notEqual(wrongKey.status, 0, "wrong report key verified");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

const unmapped = structuredClone(card);
unmapped.odd.condition_evidence[0].bin_refs = [];
assert.deepEqual(oddFindings(unmapped, manifest, report).findings.unmapped_condition_ids, ["stationary-inspection"]);
const missingRow = structuredClone(card);
missingRow.odd.condition_evidence.splice(0, 1);
assert.deepEqual(oddFindings(missingRow, manifest, report).findings.unmapped_condition_ids, ["missing-row:stationary inspection"]);
const unknownRow = structuredClone(card);
unknownRow.odd.condition_evidence[0].condition = "unrecognized condition";
assert.deepEqual(oddFindings(unknownRow, manifest, report).findings.unknown_condition_rows, ["unrecognized condition"]);
const badBin = structuredClone(card);
badBin.odd.condition_evidence[0].bin_refs = [{ dimension: "inspection-mode", bin: "airborne" }];
assert.deepEqual(oddFindings(badBin, manifest, report).findings.unknown_bin_refs, ["stationary-inspection -> inspection-mode:airborne"]);
const unknownReport = structuredClone(report);
unknownReport.odd_observations[0].missing_or_undeclared_value_samples = 1;
assert.deepEqual(oddFindings(card, manifest, unknownReport).findings.unknown_evaluation_values, ["illumination:1"]);
const badDecision = structuredClone(decision);
badDecision.subject.documents_reviewed[0].content_hash = `sha256:${"0".repeat(64)}`;
assert.throws(() => assertBuyerHashes(badDecision, expectedDocs), /buyer content hash mismatch/);
process.stdout.write("VERIFIED four schemas, URI map, cross-card IDs/hashes, fresh Rust analysis, two signatures, and tamper/gap negatives\n");
