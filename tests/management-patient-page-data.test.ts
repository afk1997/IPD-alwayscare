import test from "node:test";
import assert from "node:assert/strict";
import {
  getManagementPatientTabLoadPlan,
  normalizeManagementPatientTab,
} from "../src/lib/management-patient-page-data";

test("overview tab requests only summary data", () => {
  assert.deepEqual(getManagementPatientTabLoadPlan("overview"), {
    overview: true,
    meds: false,
    food: false,
    vitals: false,
    notes: false,
    labs: false,
    bath: false,
    isolation: false,
    media: false,
    logs: false,
  });
});

test("media tab only opts into media data", () => {
  assert.deepEqual(getManagementPatientTabLoadPlan("media"), {
    overview: false,
    meds: false,
    food: false,
    vitals: false,
    notes: false,
    labs: false,
    bath: false,
    isolation: false,
    media: true,
    logs: false,
  });
});

test("logs tab keeps the broad history load", () => {
  const plan = getManagementPatientTabLoadPlan("logs");
  assert.equal(plan.logs, true);
  assert.equal(plan.media, false);
  assert.equal(plan.overview, false);
});

test("unknown management tabs normalize to overview", () => {
  assert.equal(normalizeManagementPatientTab(undefined), "overview");
  assert.equal(normalizeManagementPatientTab("wat"), "overview");
});
