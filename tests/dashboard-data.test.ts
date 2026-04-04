import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDashboardStats,
  filterDashboardQueue,
  sortDashboardQueue,
} from "../src/lib/dashboard-data";

const activeAdmissions = [
  {
    id: "a1",
    ward: "GENERAL",
    condition: "CRITICAL",
    pendingMeds: 2,
    upcomingFeedings: 1,
    bathDue: true,
    admissionDate: new Date("2026-04-03T05:00:00.000Z"),
  },
  {
    id: "a2",
    ward: "ISOLATION",
    condition: "STABLE",
    pendingMeds: 1,
    upcomingFeedings: 0,
    bathDue: false,
    admissionDate: new Date("2026-04-03T03:00:00.000Z"),
  },
];

test("buildDashboardStats computes the clinical counters", () => {
  assert.deepEqual(buildDashboardStats(activeAdmissions), {
    totalActive: 2,
    criticalCount: 1,
    pendingMedsCount: 3,
    feedingsCount: 1,
    bathsDueCount: 1,
  });
});

test("sortDashboardQueue puts critical patients first", () => {
  const sorted = sortDashboardQueue(activeAdmissions);
  assert.equal(sorted[0].id, "a1");
  assert.equal(sorted[1].id, "a2");
});

test("filterDashboardQueue narrows by ward", () => {
  const filtered = filterDashboardQueue(activeAdmissions, "ISOLATION");
  assert.deepEqual(filtered.map((item) => item.id), ["a2"]);
});
