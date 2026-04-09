import test from "node:test";
import assert from "node:assert/strict";

import {
  formatPatientNumber,
  parseViralRisk,
  validateHandlingNote,
  validateSpayNeuterStatus,
} from "../src/lib/intake-fields";
import { buildDriveFolderPath } from "../src/lib/drive-path";

test("formatPatientNumber pads to six digits with the IPD prefix", () => {
  assert.equal(formatPatientNumber(1), "IPD-000001");
  assert.equal(formatPatientNumber(123), "IPD-000123");
});

test("validateHandlingNote accepts the approved intake values", () => {
  assert.equal(validateHandlingNote("STANDARD"), "STANDARD");
  assert.equal(validateHandlingNote("GENTLE"), "GENTLE");
  assert.equal(
    validateHandlingNote("ADVANCED_HANDLER_ONLY"),
    "ADVANCED_HANDLER_ONLY"
  );
});

test("validateHandlingNote rejects unknown values", () => {
  assert.throws(() => validateHandlingNote("CALM"), /Invalid handling note/);
});

test("parseViralRisk maps YES/NO to booleans", () => {
  assert.equal(parseViralRisk("YES"), true);
  assert.equal(parseViralRisk("NO"), false);
  assert.throws(() => parseViralRisk("MAYBE"), /Invalid viral risk/);
});

test("validateSpayNeuterStatus accepts approved setup values", () => {
  assert.equal(validateSpayNeuterStatus("UNKNOWN"), "UNKNOWN");
  assert.equal(validateSpayNeuterStatus("INTACT"), "INTACT");
  assert.equal(
    validateSpayNeuterStatus("SPAYED_NEUTERED"),
    "SPAYED_NEUTERED"
  );
});

test("LOCATION uploads use a dedicated Drive folder label", () => {
  const folder = buildDriveFolderPath("Bruno", "LOCATION");
  assert.equal(folder.at(-1), "Location");
});
