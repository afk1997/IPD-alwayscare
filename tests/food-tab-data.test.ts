import test from "node:test";
import assert from "node:assert/strict";

import * as foodTabData from "../src/lib/food-tab-data";

const buildFoodTabData = (
  foodTabData as Record<string, unknown>
).buildFoodTabData as
  | undefined
  | ((
      activePlan: Record<string, unknown> | null,
      historyLogs: Array<Record<string, unknown>>
    ) => {
      activePlan: Record<string, unknown> | null;
      historyEntries: Array<Record<string, unknown>>;
    });

test("buildFoodTabData keeps only today's log on active schedules and sorts history", () => {
  assert.equal(typeof buildFoodTabData, "function");

  const data = buildFoodTabData!(
    {
      id: "plan-1",
      dietType: "High Protein",
      instructions: "Warm feed only",
      createdBy: { name: "Dr Rao" },
      feedingSchedules: [
        {
          id: "schedule-2",
          scheduledTime: "14:00",
          foodType: "Chicken",
          portion: "150 g",
          feedingLogs: [],
        },
        {
          id: "schedule-1",
          scheduledTime: "09:00",
          foodType: "Rice",
          portion: "100 g",
          feedingLogs: [
            {
              id: "today-log",
              status: "EATEN",
              amountConsumed: "Full",
              notes: "Ate well",
            },
          ],
        },
      ],
    },
    [
      {
        id: "history-2",
        date: new Date("2026-04-03T00:00:00.000Z"),
        status: "REFUSED",
        amountConsumed: null,
        notes: "Nausea",
        feedingSchedule: {
          scheduledTime: "15:00",
          foodType: "Rice",
        },
      },
      {
        id: "history-1",
        date: new Date("2026-04-03T00:00:00.000Z"),
        status: "PARTIAL",
        amountConsumed: "Half",
        notes: null,
        feedingSchedule: {
          scheduledTime: "09:00",
          foodType: "Chicken",
        },
      },
      {
        id: "history-3",
        date: new Date("2026-04-02T00:00:00.000Z"),
        status: "EATEN",
        amountConsumed: "Full",
        notes: null,
        feedingSchedule: {
          scheduledTime: "11:00",
          foodType: "Kibble",
        },
      },
    ]
  );

  assert.deepEqual(data.activePlan, {
    id: "plan-1",
    dietType: "High Protein",
    instructions: "Warm feed only",
    createdByName: "Dr Rao",
    feedingSchedules: [
      {
        id: "schedule-1",
        scheduledTime: "09:00",
        foodType: "Rice",
        portion: "100 g",
        todayLog: {
          id: "today-log",
          status: "EATEN",
          amountConsumed: "Full",
          notes: "Ate well",
        },
      },
      {
        id: "schedule-2",
        scheduledTime: "14:00",
        foodType: "Chicken",
        portion: "150 g",
        todayLog: null,
      },
    ],
  });

  assert.deepEqual(data.historyEntries, [
    {
      id: "history-1",
      date: "2026-04-03",
      foodType: "Chicken",
      scheduledTime: "09:00",
      status: "PARTIAL",
      amountConsumed: "Half",
      notes: null,
    },
    {
      id: "history-2",
      date: "2026-04-03",
      foodType: "Rice",
      scheduledTime: "15:00",
      status: "REFUSED",
      amountConsumed: null,
      notes: "Nausea",
    },
    {
      id: "history-3",
      date: "2026-04-02",
      foodType: "Kibble",
      scheduledTime: "11:00",
      status: "EATEN",
      amountConsumed: "Full",
      notes: null,
    },
  ]);
});

test("buildFoodTabData handles missing active plan", () => {
  assert.equal(typeof buildFoodTabData, "function");

  const data = buildFoodTabData!(null, []);

  assert.equal(data.activePlan, null);
  assert.deepEqual(data.historyEntries, []);
});
