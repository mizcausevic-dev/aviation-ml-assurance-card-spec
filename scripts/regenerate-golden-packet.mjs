// Manual-only regeneration of the fictional packet after a Rust report change.
// Both signing keys live only in this process; only public keys are written.
import { strict as assert } from "node:assert";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

if (process.argv.slice(2).join(" ") !== "--write") {
  throw new Error("Manual fixture operation: pass --write explicitly");
}

const repo = fileURLToPath(new URL("../", import.meta.url));
const packet = join(repo, "examples", "golden-packet");
const rustRepo = resolve(process.env.AERO_DATASET_REPO ?? join(repo, "..", "aero-dataset-provenance-rs"));
const mroRepo = resolve(process.env.AERO_MRO_SPEC_DIR ?? join(repo, "..", "mro-ai-signoff-card-spec"));
const rustBinary = resolve(process.env.AERO_DATASET_BIN ?? join(rustRepo, "target", "debug", `aero-dataset-provenance${process.platform === "win32" ? ".exe" : ""}`));
const expectedRustSha = "dc6ff8fb1d0558df7ac009883c2bfead8d76971d";
const expectedMroSha = "c3cf35b8955194266d70eb855b307ddb6c1bd1dd";
const rustSha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: rustRepo, encoding: "utf8" });
assert.equal(rustSha.status, 0, "cannot identify Rust dependency commit");
assert.equal(rustSha.stdout.trim(), expectedRustSha, "build and pin the reviewed Rust commit first");
const rustStatus = spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: rustRepo, encoding: "utf8" });
assert.equal(rustStatus.status, 0);
assert.equal(rustStatus.stdout.trim(), "", "Rust source has uncommitted changes");
const mroSha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: mroRepo, encoding: "utf8" });
assert.equal(mroSha.status, 0, "cannot identify MRO signature helper commit");
assert.equal(mroSha.stdout.trim(), expectedMroSha, "use the reviewed MRO signature helper commit");
const mroStatus = spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: mroRepo, encoding: "utf8" });
assert.equal(mroStatus.status, 0);
assert.equal(mroStatus.stdout.trim(), "", "MRO signature helper has uncommitted changes");

const { canonicalize, signatureDigest, verifyCardSignature } = await import(
  pathToFileURL(join(mroRepo, "scripts", "signature-profile.mjs"))
);
const { parseJcsJsonStrict } = await import(pathToFileURL(join(mroRepo, "scripts", "strict-json.mjs")));
const read = (name) => parseJcsJsonStrict(readFileSync(join(packet, name)));
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const hash = (value) => `sha256:${createHash("sha256").update(canonicalize(value)).digest("hex")}`;
const fingerprint = (bytes) => createHash("sha256").update(bytes).digest("hex");
const base = "https://example.invalid/aviation/packet/";

function runRust(args, env = process.env) {
  const result = spawnSync(rustBinary, args, { env, encoding: "utf8" });
  assert.equal(result.status, 0, `Rust command failed: ${args[0]}: ${result.stderr}`);
}

async function observedUtcAfter(previous) {
  const prior = Date.parse(previous);
  assert.ok(Number.isFinite(prior), "invalid preceding synthetic timestamp");
  while (Math.floor(Date.now() / 1000) * 1000 <= prior) {
    await new Promise((done) => setTimeout(done, 50));
  }
  return new Date(Math.floor(Date.now() / 1000) * 1000).toISOString().replace(".000Z", "Z");
}

const scratch = mkdtempSync(join(tmpdir(), "kg-aero-packet-"));
const relScratch = relative(tmpdir(), scratch);
assert.ok(relScratch.startsWith("kg-aero-packet-") && !relScratch.includes(sep) && !relScratch.includes(".."), "unsafe scratch directory");
try {
  const reportPath = join(scratch, "dataset-report.json");
  const attestationPath = join(scratch, "dataset-report.attestation.json");
  runRust(["analyze", join(packet, "dataset", "manifest.json"), join(packet, "dataset"), reportPath]);
  const report = parseJcsJsonStrict(readFileSync(reportPath));
  assert.equal(report.report_version, "0.2.0");
  assert.equal(report.declared_checks_passed, true);
  assert.deepEqual(report.leakage_findings, []);
  assert.deepEqual(report.temporal_violations, []);

  const datasetKey = generateKeyPairSync("ed25519");
  const datasetPrivateJwk = datasetKey.privateKey.export({ format: "jwk" });
  const datasetPublicJwk = datasetKey.publicKey.export({ format: "jwk" });
  const datasetPublicBytes = Buffer.from(datasetPublicJwk.x, "base64url");
  const datasetPublicB64 = datasetPublicBytes.toString("base64");
  const keyUrl = `${base}keys/dataset-sha256-${fingerprint(datasetPublicBytes)}`;
  let seedB64 = Buffer.from(datasetPrivateJwk.d, "base64url").toString("base64");
  runRust(["sign", reportPath, keyUrl, attestationPath], {
    ...process.env,
    AERO_DATASET_SIGNING_KEY_B64: seedB64
  });
  seedB64 = "";
  runRust(["verify", reportPath, attestationPath, keyUrl], {
    ...process.env,
    AERO_DATASET_SIGNING_KEY_B64: "",
    AERO_DATASET_VERIFYING_KEY_B64: datasetPublicB64
  });
  const attestation = parseJcsJsonStrict(readFileSync(attestationPath));
  assert.equal(attestation.key_url, keyUrl);

  const mro = read("mro-card.json");
  const reviewer = generateKeyPairSync("ed25519");
  const reviewerPublicDer = reviewer.publicKey.export({ type: "spki", format: "der" });
  const reviewerKeyId = `synthetic-aero-packet-reviewer-sha256-${fingerprint(reviewerPublicDer)}`;
  mro.human_review.reviewed_at = await observedUtcAfter(attestation.signed_at);
  mro.signature.key_id = reviewerKeyId;
  mro.signature.signed_at = await observedUtcAfter(mro.human_review.reviewed_at);
  mro.signature.signature_b64url = sign(null, signatureDigest(mro), reviewer.privateKey).toString("base64url");
  assert.equal(verifyCardSignature(mro, { keyId: reviewerKeyId, publicKey: reviewer.publicKey }), true);
  const authority = read("authority-record.json");
  authority.key_id = reviewerKeyId;
  assert.equal(authority.test_only, true);
  assert.equal(authority.authority_verified, false);

  const incident = read("incident-card.json");
  incident.incident.discovered_at = await observedUtcAfter(mro.signature.signed_at);
  incident.incident.disclosed_at = await observedUtcAfter(incident.incident.discovered_at);
  incident.published_at = await observedUtcAfter(incident.incident.disclosed_at);
  incident.last_updated_at = incident.published_at;

  const decision = read("buyer-decision.json");
  decision.issued_at = await observedUtcAfter(incident.published_at);
  assert.equal(decision.decision.status, "pending");
  const card = read("aviation-card.json");
  const documents = new Map([
    [`${base}aviation-card.json`, card],
    [`${base}mro-card.json`, mro],
    [`${base}incident-card.json`, incident]
  ]);
  for (const ref of decision.subject.documents_reviewed) {
    assert.ok(documents.has(ref.url), `unknown buyer reference: ${ref.url}`);
    ref.content_hash = hash(documents.get(ref.url));
  }
  const refs = read("refs.json");
  for (const ref of Object.keys(refs)) {
    if (ref.startsWith(`${base}keys/dataset`)) delete refs[ref];
  }
  refs[keyUrl] = "dataset-public-key.b64";

  const files = new Map([
    ["dataset-report.json", readFileSync(reportPath)],
    ["dataset-report.attestation.json", jsonBytes(attestation)],
    ["dataset-public-key.b64", Buffer.from(`${datasetPublicB64}\n`)],
    ["mro-card.json", jsonBytes(mro)],
    ["mro-public-key.pub", Buffer.from(reviewer.publicKey.export({ type: "spki", format: "pem" }))],
    ["authority-record.json", jsonBytes(authority)],
    ["incident-card.json", jsonBytes(incident)],
    ["buyer-decision.json", jsonBytes(decision)],
    ["refs.json", jsonBytes(refs)]
  ]);
  for (const [name, bytes] of files) {
    const staged = join(scratch, name);
    writeFileSync(staged, bytes);
  }
  for (const name of files.keys()) copyFileSync(join(scratch, name), join(packet, name));
  process.stdout.write("Regenerated fictional packet with fresh public test keys and observed UTC chronology.\n");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
