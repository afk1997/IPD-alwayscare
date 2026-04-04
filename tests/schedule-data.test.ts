import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHourGroups,
  getHourBucket,
  sortBathDuePatients,
} from "../src/lib/schedule-data";

test("getHourBucket normalizes a scheduled time into the hourly column", () => {
  assert.equal(getHourBucket("09:30"), "09:00");
  assert.equal(getHourBucket("23:55"), "23:00");
});

test("buildHourGroups groups meds and feedings by hour", () => {
  const groups = buildHourGroups(
    [{ type: "med", hour: "09:00", scheduledTime: "09:30", patientName: "Milo" }],
    [{ type: "feeding", hour: "09:00", scheduledTime: "09:00", patientName: "Simba" }]
  );
  assert.equal(groups.find((group) => group.hour === "09:00")?.meds.length, 1);
  assert.equal(groups.find((group) => group.hour === "09:00")?.feedings.length, 1);
});

test("sortBathDuePatients keeps overdue patients first", () => {
  const sorted = sortBathDuePatients([
    { patientName: "Lucy", daysSinceLast: 2, isOverdue: false },
    { patientName: "Milo", daysSinceLast: 4, isOverdue: true },
  ]);
  assert.equal(sorted[0].patientName, "Milo");
});
