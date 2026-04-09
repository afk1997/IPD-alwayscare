import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const setupFormSource = readFileSync(
  new URL("../src/components/forms/clinical-setup-form.tsx", import.meta.url),
  "utf8"
);
const admissionsSource = readFileSync(
  new URL("../src/actions/admissions.ts", import.meta.url),
  "utf8"
);
const patientHeaderSource = readFileSync(
  new URL("../src/components/patient/patient-header.tsx", import.meta.url),
  "utf8"
);

test("clinical setup collects viral risk, spay/neuter status, and ABC candidate", () => {
  assert.match(setupFormSource, /name="viralRisk"/);
  assert.match(setupFormSource, /name="spayNeuterStatus"/);
  assert.match(setupFormSource, /name="abcCandidate"/);
  assert.match(setupFormSource, /Please select viral risk/);
});

test("clinical setup persists the new admission fields", () => {
  assert.match(admissionsSource, /const viralRisk = parseViralRisk/);
  assert.match(admissionsSource, /const spayNeuterStatus =/);
  assert.match(
    admissionsSource,
    /const abcCandidate = formData\.get\("abcCandidate"\) === "true"/
  );
  assert.match(admissionsSource, /viralRisk,/);
  assert.match(admissionsSource, /spayNeuterStatus,/);
  assert.match(admissionsSource, /abcCandidate,/);
});

test("active admission editing exposes the new clinical setup fields", () => {
  assert.match(patientHeaderSource, /name="viralRisk"/);
  assert.match(patientHeaderSource, /name="spayNeuterStatus"/);
  assert.match(patientHeaderSource, /name="abcCandidate"/);
});
