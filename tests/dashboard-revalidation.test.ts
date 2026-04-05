import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { admissionDashboardInvalidations } from "../src/lib/dashboard-revalidation";

const admissionsActionsSource = readFileSync(
  new URL("../src/actions/admissions.ts", import.meta.url),
  "utf8"
);

test("transferWard invalidates all dashboard caches affected by ward changes", () => {
  assert.deepEqual(admissionDashboardInvalidations.transferWard, [
    "summary",
    "queue",
    "setup",
  ]);
});

test("dischargePatient invalidates all dashboard caches affected by active isolation changes", () => {
  assert.deepEqual(admissionDashboardInvalidations.dischargePatient, [
    "summary",
    "queue",
    "setup",
  ]);
});

test("transferWard uses the transferWard invalidation contract", () => {
  assert.match(
    admissionsActionsSource,
    /export async function transferWard[\s\S]*?invalidateDashboardTags\(\.\.\.admissionDashboardInvalidations\.transferWard\);/
  );
});

test("dischargePatient uses the dischargePatient invalidation contract", () => {
  assert.match(
    admissionsActionsSource,
    /export async function dischargePatient[\s\S]*?invalidateDashboardTags\(\.\.\.admissionDashboardInvalidations\.dischargePatient\);/
  );
});
