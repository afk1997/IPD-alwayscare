import test from "node:test";
import assert from "node:assert/strict";
import {
  CLINICAL_LIVE_PROFILE,
  CLINICAL_WARM_PROFILE,
  dashboardSummaryTag,
  dashboardQueueTag,
  dashboardSetupTag,
  scheduleTag,
  notificationsTag,
  patientShellTag,
  patientTabTag,
} from "../src/lib/clinical-cache";

test("clinical cache constants and tags match the approved contract", () => {
  assert.equal(CLINICAL_LIVE_PROFILE, "clinicalLive");
  assert.equal(CLINICAL_WARM_PROFILE, "clinicalWarm");
  assert.equal(dashboardSummaryTag(), "dashboard:summary");
  assert.equal(dashboardQueueTag(), "dashboard:queue");
  assert.equal(dashboardSetupTag(), "dashboard:setup");
  assert.equal(scheduleTag("meds"), "schedule:meds");
  assert.equal(notificationsTag("DOCTOR"), "notifications:doctor");
  assert.equal(patientShellTag("adm-1"), "patient:adm-1:shell");
  assert.equal(patientTabTag("adm-1", "vitals"), "patient:adm-1:vitals");
});
