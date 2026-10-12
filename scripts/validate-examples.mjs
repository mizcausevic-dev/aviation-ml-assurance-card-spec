import { readFileSync, readdirSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = new URL("../", import.meta.url);
const schema = JSON.parse(readFileSync(new URL("aviation-ml-card.schema.json", root), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
const validate = ajv.compile(schema);

function checkConditionMap(card) {
  const conditions = card.odd.operating_conditions;
  const mapped = card.odd.condition_evidence.map((row) => row.condition);
  if (new Set(mapped).size !== mapped.length) throw new Error("Duplicate ODD condition mapping");
  if (conditions.length !== mapped.length || conditions.some((condition) => !mapped.includes(condition))) {
    throw new Error("Every declared ODD operating condition needs exactly one condition_evidence row");
  }
  if (conditions.some((condition) => card.odd.excluded_conditions.includes(condition))) {
    throw new Error("ODD operating and excluded conditions must not overlap");
  }
  const standards = card.assurance.standards_posture.map((row) => row.identifier);
  if (new Set(standards).size !== standards.length) throw new Error("Duplicate standards identifier");
}

const validFiles = readdirSync(new URL("examples/", root)).filter((name) => name.endsWith(".json")).sort();
if (validFiles.length === 0) throw new Error("No valid aviation examples found");
for (const file of validFiles) {
  const card = JSON.parse(readFileSync(new URL(`examples/${file}`, root), "utf8"));
  if (!validate(card)) throw new Error(`${file}: ${ajv.errorsText(validate.errors)}`);
  checkConditionMap(card);
  process.stdout.write(`VALID examples/${file}\n`);
}

const invalid = JSON.parse(readFileSync(new URL("examples/invalid/level-3b.json", root), "utf8"));
if (validate(invalid)) throw new Error("Known-invalid Level 3B fixture was accepted");
process.stdout.write("REJECTED known-invalid Level 3B fixture\n");

const base = JSON.parse(readFileSync(new URL(`examples/${validFiles[0]}`, root), "utf8"));
const missingOverride = structuredClone(base);
missingOverride.human_ai_teaming.human_override_available = false;
delete missingOverride.human_ai_teaming.override_procedure_ref;
if (validate(missingOverride)) throw new Error("Level 2B without human override was accepted");
process.stdout.write("REJECTED Level 2B without override path\n");

const wrongCondition = structuredClone(base);
wrongCondition.odd.condition_evidence[0].condition = "unrelated condition";
if (!validate(wrongCondition)) throw new Error("Wrong-condition control should be schema-valid before semantic test");
try {
  checkConditionMap(wrongCondition);
  throw new Error("Wrong-condition control was accepted");
} catch (error) {
  if (error.message === "Wrong-condition control was accepted") throw error;
}
process.stdout.write("REJECTED unmapped ODD condition\n");

const gap = structuredClone(base);
gap.odd.condition_evidence[0].evidence_refs = [];
if (!validate(gap)) throw new Error("An explicit ODD evidence gap must be representable in a draft card");
checkConditionMap(gap);
if (gap.odd.condition_evidence.filter((row) => row.evidence_refs.length === 0).length !== 1) {
  throw new Error("Gap control did not expose one missing evidence row");
}
process.stdout.write("DETECTED one explicit ODD evidence gap (structural validation is not coverage proof)\n");
