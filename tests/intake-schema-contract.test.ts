import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schemaSource = readFileSync(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8"
);
const admissionsSource = readFileSync(
  new URL("../src/actions/admissions.ts", import.meta.url),
  "utf8"
);
const seedSource = readFileSync(
  new URL("../prisma/seed.ts", import.meta.url),
  "utf8"
);

test("patient schema stores the approved intake metadata", () => {
  assert.match(schemaSource, /enum HandlingNote[\s\S]*STANDARD/);
  assert.match(schemaSource, /patientNumber\s+String\?\s+@unique/);
  assert.match(schemaSource, /locationGpsCoordinates\s+String\?/);
  assert.match(schemaSource, /ambulancePersonName\s+String\?/);
  assert.match(
    schemaSource,
    /handlingNote\s+HandlingNote\s+@default\(STANDARD\)/
  );
  assert.match(schemaSource, /isStray\s+Boolean\s+@default\(false\)/);
  assert.match(schemaSource, /enum RegistrationMode[\s\S]*WALK_IN/);
  assert.match(
    schemaSource,
    /registrationMode\s+RegistrationMode\s+@default\(AMBULANCE\)/
  );
  assert.match(schemaSource, /registrationModeOther\s+String\?/);
});

test("admission schema stores the approved clinical setup metadata", () => {
  assert.match(schemaSource, /enum SpayNeuterStatus[\s\S]*SPAYED_NEUTERED/);
  assert.match(schemaSource, /viralRisk\s+Boolean\?/);
  assert.match(schemaSource, /spayNeuterStatus\s+SpayNeuterStatus\?/);
  assert.match(schemaSource, /abcCandidate\s+Boolean\s+@default\(false\)/);
});

test("a dedicated counter model exists for patient-number allocation", () => {
  assert.match(schemaSource, /model ClinicCounter[\s\S]*value\s+Int/);
  assert.match(admissionsSource, /clinicCounter\.upsert/);
  assert.match(admissionsSource, /formatPatientNumber\(/);
});

test("seed code backfills patient numbers and syncs the counter", () => {
  assert.match(seedSource, /formatPatientNumber\(/);
  assert.match(seedSource, /clinicCounter\.upsert/);
});
