# Internal Clinical Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the internal clinical flow materially faster on warm reads while preserving the current clinic UI and ensuring successful clinical writes are visible immediately after save.

**Architecture:** Introduce a shared clinical caching layer with explicit cache tags and short-lived cache profiles, then refactor dashboard, schedule, notifications, and patient reads into focused cached read-model functions. Keep pages request-aware for auth, invalidate exact tags from Server Actions with `updateTag`, and preserve existing route structure so the speedup comes from smaller queries and safer caching rather than a workflow redesign.

**Tech Stack:** Next.js 16 App Router, React Server Components, Prisma, TypeScript, Node.js built-in test runner, Next cache APIs (`use cache`, `cacheLife`, `cacheTag`, `updateTag`)

---

## File Map

- `next.config.ts`
  Enables `cacheComponents` and defines the shared `clinicalLive` / `clinicalWarm` cache profiles.
- `src/lib/clinical-cache.ts`
  Central source for cache profile names, cache-tag builders, and role-to-notification-tag mapping.
- `src/lib/clinical-revalidation.ts`
  Central source for mutation-to-tag invalidation lists and the `updateTag(...)` wrapper used by Server Actions.
- `tests/clinical-cache.test.ts`
  Verifies tag names and profile-name exports stay stable.
- `tests/clinical-revalidation.test.ts`
  Verifies each mutation kind invalidates the correct tag set.
- `src/lib/dashboard-data.ts`
  Pure dashboard summary, queue sort, and ward filter helpers.
- `src/lib/dashboard-queries.ts`
  Cached Prisma reads for dashboard summary, queue, and secondary setup/isolation data.
- `tests/dashboard-data.test.ts`
  Verifies summary counts, queue ordering, and ward filtering.
- `src/app/(app)/page.tsx`
  Consumes dashboard query helpers instead of one broad `findMany(...)`.
- `src/components/dashboard/patient-card.tsx`
  Adopts the narrower queue type without changing visible UI.
- `src/lib/schedule-data.ts`
  Pure helpers for hour bucketing, task grouping, and bath-due sorting.
- `src/lib/schedule-queries.ts`
  Cached Prisma reads for schedule meds, feedings, and bath-due data.
- `tests/schedule-data.test.ts`
  Verifies task grouping and bath-due ordering.
- `src/app/(app)/schedule/page.tsx`
  Consumes focused schedule read models instead of a single broad admission graph.
- `src/lib/notification-snapshot.ts`
  Pure notification builders plus cached notification snapshot helper by role.
- `tests/notification-snapshot.test.ts`
  Verifies role filtering and notification ordering.
- `src/app/api/notifications/route.ts`
  Delegates to the cached notification snapshot helper.
- `src/components/layout/notification-provider.tsx`
  Keeps polling behavior familiar but pauses work for hidden tabs and refreshes on visibility return.
- `src/lib/patient-page-queries.ts`
  Tags patient shell/tab read functions with `use cache`, `cacheLife`, and `cacheTag`.
- `src/actions/medications.ts`
- `src/actions/feeding.ts`
- `src/actions/vitals.ts`
- `src/actions/baths.ts`
- `src/actions/notes.ts`
- `src/actions/labs.ts`
- `src/actions/patient-media.ts`
- `src/actions/isolation.ts`
- `src/actions/admissions.ts`
  Replace broad path-only refresh behavior with shared tag invalidation plus retained path refresh where shells still need it.
- `src/app/(app)/layout.tsx`
- `src/app/(app)/page.tsx`
- `src/app/(app)/patients/[admissionId]/page.tsx`
- `src/app/(app)/schedule/page.tsx`
- `src/app/(app)/archive/page.tsx`
- `src/app/(app)/isolation/page.tsx`
- `src/app/(app)/admin/page.tsx`
- `src/app/(app)/profile/page.tsx`
- `src/app/(app)/patients/new/page.tsx`
- `src/app/(app)/patients/[admissionId]/setup/page.tsx`
- `src/app/(management)/management/layout.tsx`
- `src/app/(management)/management/page.tsx`
- `src/app/(management)/management/patients/[admissionId]/page.tsx`
  Mechanical Next 16 migration: remove `export const dynamic = "force-dynamic"` so Cache Components can be enabled without build-time route-segment-config conflicts.

---

### Task 1: Add Cache Foundations and Remove Deprecated Route Segment Config

**Files:**
- Create: `src/lib/clinical-cache.ts`
- Create: `tests/clinical-cache.test.ts`
- Modify: `next.config.ts`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/(app)/page.tsx`
- Modify: `src/app/(app)/patients/[admissionId]/page.tsx`
- Modify: `src/app/(app)/schedule/page.tsx`
- Modify: `src/app/(app)/archive/page.tsx`
- Modify: `src/app/(app)/isolation/page.tsx`
- Modify: `src/app/(app)/admin/page.tsx`
- Modify: `src/app/(app)/profile/page.tsx`
- Modify: `src/app/(app)/patients/new/page.tsx`
- Modify: `src/app/(app)/patients/[admissionId]/setup/page.tsx`
- Modify: `src/app/(management)/management/layout.tsx`
- Modify: `src/app/(management)/management/page.tsx`
- Modify: `src/app/(management)/management/patients/[admissionId]/page.tsx`
- Test: `tests/clinical-cache.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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

test("exports the shared clinical cache profile names", () => {
  assert.equal(CLINICAL_LIVE_PROFILE, "clinicalLive");
  assert.equal(CLINICAL_WARM_PROFILE, "clinicalWarm");
});

test("builds the shared dashboard and schedule tags", () => {
  assert.equal(dashboardSummaryTag(), "dashboard:summary");
  assert.equal(dashboardQueueTag(), "dashboard:queue");
  assert.equal(dashboardSetupTag(), "dashboard:setup");
  assert.equal(scheduleTag("meds"), "schedule:meds");
});

test("builds notification and patient tags", () => {
  assert.equal(notificationsTag("DOCTOR"), "notifications:doctor");
  assert.equal(patientShellTag("adm-1"), "patient:adm-1:shell");
  assert.equal(patientTabTag("adm-1", "vitals"), "patient:adm-1:vitals");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/clinical-cache.test.ts`
Expected: FAIL because `src/lib/clinical-cache.ts` does not exist yet.

- [ ] **Step 3: Write the cache helper module**

```ts
export const CLINICAL_LIVE_PROFILE = "clinicalLive";
export const CLINICAL_WARM_PROFILE = "clinicalWarm";

export type ScheduleTagKey = "meds" | "feedings" | "baths";
export type NotificationRole =
  | "ADMIN"
  | "ATTENDANT"
  | "DOCTOR"
  | "MANAGEMENT"
  | "PARAVET";
export type PatientCacheTab =
  | "shell"
  | "vitals"
  | "meds"
  | "food"
  | "notes"
  | "labs"
  | "bath"
  | "photos"
  | "isolation"
  | "logs";

export function dashboardSummaryTag() {
  return "dashboard:summary";
}

export function dashboardQueueTag() {
  return "dashboard:queue";
}

export function dashboardSetupTag() {
  return "dashboard:setup";
}

export function scheduleTag(kind: ScheduleTagKey) {
  return `schedule:${kind}`;
}

export function notificationsTag(role: NotificationRole) {
  return `notifications:${role.toLowerCase()}`;
}

export function patientShellTag(admissionId: string) {
  return `patient:${admissionId}:shell`;
}

export function patientTabTag(admissionId: string, tab: Exclude<PatientCacheTab, "shell">) {
  return `patient:${admissionId}:${tab}`;
}
```

- [ ] **Step 4: Enable Cache Components and remove deprecated `force-dynamic` exports**

```ts
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    clinicalLive: {
      stale: 30,
      revalidate: 30,
      expire: 300,
    },
    clinicalWarm: {
      stale: 60,
      revalidate: 60,
      expire: 600,
    },
  },
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    proxyClientMaxBodySize: "50mb",
  },
};

export default withSerwist(nextConfig);
```

```ts
// Before
export const dynamic = "force-dynamic";

export default async function Page() {
  return <div>Dashboard</div>;
}

// After
export default async function Page() {
  return <div>Dashboard</div>;
}
```

- [ ] **Step 5: Run the foundation verification**

Run: `node --import tsx --test tests/clinical-cache.test.ts && npx tsc --noEmit --pretty false --incremental false`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add next.config.ts \
  src/lib/clinical-cache.ts \
  tests/clinical-cache.test.ts \
  src/app/'(app)'/layout.tsx \
  src/app/'(app)'/page.tsx \
  src/app/'(app)'/patients/'[admissionId]'/page.tsx \
  src/app/'(app)'/schedule/page.tsx \
  src/app/'(app)'/archive/page.tsx \
  src/app/'(app)'/isolation/page.tsx \
  src/app/'(app)'/admin/page.tsx \
  src/app/'(app)'/profile/page.tsx \
  src/app/'(app)'/patients/new/page.tsx \
  src/app/'(app)'/patients/'[admissionId]'/setup/page.tsx \
  src/app/'(management)'/management/layout.tsx \
  src/app/'(management)'/management/page.tsx \
  src/app/'(management)'/management/patients/'[admissionId]'/page.tsx
git commit -m "perf: add clinical cache foundations"
```

### Task 2: Refactor Dashboard Reads into Focused Cached Queries

**Files:**
- Create: `src/lib/dashboard-data.ts`
- Create: `src/lib/dashboard-queries.ts`
- Create: `tests/dashboard-data.test.ts`
- Modify: `src/app/(app)/page.tsx`
- Modify: `src/components/dashboard/patient-card.tsx`
- Test: `tests/dashboard-data.test.ts`

- [ ] **Step 1: Write the failing dashboard helper test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/dashboard-data.test.ts`
Expected: FAIL because `src/lib/dashboard-data.ts` does not exist yet.

- [ ] **Step 3: Write the pure dashboard helpers**

```ts
export interface DashboardSummaryRow {
  id: string;
  ward: string | null;
  condition: string | null;
  pendingMeds: number;
  upcomingFeedings: number;
  bathDue: boolean;
  admissionDate: Date;
}

export function buildDashboardStats(rows: DashboardSummaryRow[]) {
  return {
    totalActive: rows.length,
    criticalCount: rows.filter((row) => row.condition === "CRITICAL").length,
    pendingMedsCount: rows.reduce((sum, row) => sum + row.pendingMeds, 0),
    feedingsCount: rows.reduce((sum, row) => sum + row.upcomingFeedings, 0),
    bathsDueCount: rows.filter((row) => row.bathDue).length,
  };
}

export function sortDashboardQueue<T extends { condition: string | null; admissionDate: Date }>(
  rows: T[]
) {
  return [...rows].sort((a, b) => {
    const aRank = a.condition === "CRITICAL" ? 0 : 1;
    const bRank = b.condition === "CRITICAL" ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return b.admissionDate.getTime() - a.admissionDate.getTime();
  });
}

export function filterDashboardQueue<T extends { ward: string | null }>(
  rows: T[],
  wardFilter?: string
) {
  if (!wardFilter) return rows;
  return rows.filter((row) => row.ward === wardFilter);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/dashboard-data.test.ts`
Expected: PASS

- [ ] **Step 5: Add focused cached dashboard queries**

```ts
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import {
  CLINICAL_LIVE_PROFILE,
  dashboardQueueTag,
  dashboardSetupTag,
  dashboardSummaryTag,
} from "@/lib/clinical-cache";
import {
  buildDashboardStats,
  filterDashboardQueue,
  sortDashboardQueue,
} from "@/lib/dashboard-data";

export async function getDashboardSummary(today: Date, nowTimeStr: string, laterTimeStr: string) {
  "use cache";
  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(dashboardSummaryTag());

  const admissions = await db.admission.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      patient: { deletedAt: null },
    },
    select: {
      id: true,
      ward: true,
      condition: true,
      admissionDate: true,
      treatmentPlans: {
        where: { isActive: true, deletedAt: null },
        select: {
          scheduledTimes: true,
          administrations: {
            where: { scheduledDate: today },
            select: {
              wasAdministered: true,
              wasSkipped: true,
            },
          },
        },
      },
      dietPlans: {
        where: { isActive: true, deletedAt: null },
        select: {
          feedingSchedules: {
            where: { isActive: true },
            select: { scheduledTime: true },
          },
        },
      },
      bathLogs: {
        orderBy: { bathedAt: "desc" },
        take: 1,
        select: { bathedAt: true },
      },
    },
  });

  const rows = admissions.map((admission) => ({
    id: admission.id,
    ward: admission.ward,
    condition: admission.condition,
    admissionDate: admission.admissionDate,
    pendingMeds: admission.treatmentPlans.reduce((sum, plan) => {
      const totalSlots = plan.scheduledTimes.length;
      const doneSlots = plan.administrations.filter(
        (item) => item.wasAdministered || item.wasSkipped
      ).length;
      return sum + Math.max(0, totalSlots - doneSlots);
    }, 0),
    upcomingFeedings: admission.dietPlans.reduce((sum, plan) => {
      const count = plan.feedingSchedules.filter((schedule) => {
        if (laterTimeStr < nowTimeStr) {
          return (
            schedule.scheduledTime >= nowTimeStr ||
            schedule.scheduledTime <= laterTimeStr
          );
        }
        return (
          schedule.scheduledTime >= nowTimeStr &&
          schedule.scheduledTime <= laterTimeStr
        );
      }).length;
      return sum + count;
    }, 0),
    bathDue: Boolean(admission.bathLogs[0]),
  }));

  return buildDashboardStats(rows);
}
```

- [ ] **Step 6: Refactor the dashboard page to use the new queries**

```ts
const [stats, queueData, secondaryData] = await Promise.all([
  getDashboardSummary(today, nowTimeStr, laterTimeStr),
  getDashboardQueue(today, wardFilter),
  getDashboardSecondaryData(),
]);

const filteredAdmissions = filterDashboardQueue(
  sortDashboardQueue(queueData.activeAdmissions),
  wardFilter
);
```

- [ ] **Step 7: Run dashboard verification**

Run: `node --import tsx --test tests/dashboard-data.test.ts && npx eslint 'src/app/(app)/page.tsx' 'src/components/dashboard/patient-card.tsx' 'src/lib/dashboard-data.ts' 'src/lib/dashboard-queries.ts'`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/'(app)'/page.tsx \
  src/components/dashboard/patient-card.tsx \
  src/lib/dashboard-data.ts \
  src/lib/dashboard-queries.ts \
  tests/dashboard-data.test.ts
git commit -m "perf: split dashboard reads into cached models"
```

### Task 3: Refactor Schedule Reads into Focused Cached Queries

**Files:**
- Create: `src/lib/schedule-data.ts`
- Create: `src/lib/schedule-queries.ts`
- Create: `tests/schedule-data.test.ts`
- Modify: `src/app/(app)/schedule/page.tsx`
- Test: `tests/schedule-data.test.ts`

- [ ] **Step 1: Write the failing schedule helper test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/schedule-data.test.ts`
Expected: FAIL because `src/lib/schedule-data.ts` does not exist yet.

- [ ] **Step 3: Write the pure schedule helpers**

```ts
export const SCHEDULE_HOURS = [
  "00:00", "01:00", "02:00", "03:00", "04:00", "05:00",
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00", "23:00",
];

export function getHourBucket(scheduledTime: string) {
  const [hour] = scheduledTime.split(":").map(Number);
  return `${String(hour).padStart(2, "0")}:00`;
}

export function buildHourGroups(meds: any[], feedings: any[]) {
  return SCHEDULE_HOURS.map((hour) => ({
    hour,
    meds: meds.filter((task) => task.hour === hour),
    feedings: feedings.filter((task) => task.hour === hour),
  }));
}

export function sortBathDuePatients<T extends { isOverdue: boolean; daysSinceLast: number }>(
  rows: T[]
) {
  return [...rows].sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return b.daysSinceLast - a.daysSinceLast;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/schedule-data.test.ts`
Expected: PASS

- [ ] **Step 5: Add focused cached schedule queries and refactor the page**

```ts
export async function getScheduleMedTasks(today: Date) {
  "use cache";
  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(scheduleTag("meds"));

  return db.treatmentPlan.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      admission: {
        status: "ACTIVE",
        deletedAt: null,
        patient: { deletedAt: null },
      },
    },
    select: {
      id: true,
      drugName: true,
      dose: true,
      route: true,
      scheduledTimes: true,
      admission: {
        select: {
          id: true,
          ward: true,
          cageNumber: true,
          patient: { select: { name: true } },
        },
      },
      administrations: {
        where: { scheduledDate: today },
        include: { administeredBy: { select: { name: true } } },
      },
    },
  });
}
```

```ts
const [medTasks, feedingTasks, bathDuePatients] = await Promise.all([
  getScheduleMedTasks(today),
  getScheduleFeedingTasks(today),
  getScheduleBathTasks(),
]);

const hourGroups = buildHourGroups(medTasks, feedingTasks);
```

- [ ] **Step 6: Run schedule verification**

Run: `node --import tsx --test tests/schedule-data.test.ts && npx eslint 'src/app/(app)/schedule/page.tsx' 'src/lib/schedule-data.ts' 'src/lib/schedule-queries.ts'`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/'(app)'/schedule/page.tsx \
  src/lib/schedule-data.ts \
  src/lib/schedule-queries.ts \
  tests/schedule-data.test.ts
git commit -m "perf: split schedule reads into cached models"
```

### Task 4: Cache Notification Snapshots and Make Polling Visibility-Aware

**Files:**
- Create: `src/lib/notification-snapshot.ts`
- Create: `tests/notification-snapshot.test.ts`
- Modify: `src/app/api/notifications/route.ts`
- Modify: `src/components/layout/notification-provider.tsx`
- Test: `tests/notification-snapshot.test.ts`

- [ ] **Step 1: Write the failing notification helper test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  filterNotificationsForRole,
  sortNotificationsByPriority,
} from "../src/lib/notification-snapshot";

const notifications = [
  { id: "med-1", type: "urgent", category: "MEDS" },
  { id: "food-1", type: "due", category: "FOOD" },
  { id: "vitals-1", type: "critical", category: "VITALS" },
  { id: "setup-1", type: "info", category: "ADMISSION" },
];

test("doctor sees urgent, critical, and setup notifications", () => {
  const filtered = filterNotificationsForRole(notifications as any, "DOCTOR");
  assert.deepEqual(filtered.map((item) => item.id), ["med-1", "vitals-1", "setup-1"]);
});

test("paravet sees meds plus critical items only", () => {
  const filtered = filterNotificationsForRole(notifications as any, "PARAVET");
  assert.deepEqual(filtered.map((item) => item.id), ["med-1", "vitals-1"]);
});

test("sortNotificationsByPriority keeps urgent before critical before due", () => {
  const sorted = sortNotificationsByPriority(notifications as any);
  assert.deepEqual(sorted.map((item) => item.id), ["med-1", "vitals-1", "food-1", "setup-1"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/notification-snapshot.test.ts`
Expected: FAIL because `src/lib/notification-snapshot.ts` does not exist yet.

- [ ] **Step 3: Write the pure notification helpers**

```ts
const priority: Record<string, number> = {
  urgent: 0,
  critical: 1,
  overdue: 2,
  due: 3,
  upcoming: 4,
  info: 5,
};

export function sortNotificationsByPriority<T extends { type: string }>(items: T[]) {
  return [...items].sort((a, b) => (priority[a.type] ?? 9) - (priority[b.type] ?? 9));
}

export function filterNotificationsForRole<T extends { type: string; category: string }>(
  items: T[],
  role: string
) {
  if (role === "MANAGEMENT") {
    return items.filter((item) =>
      item.type === "overdue" || item.type === "urgent" || item.type === "critical"
    );
  }
  if (role === "DOCTOR") {
    return items.filter((item) => {
      if (item.type === "overdue" || item.type === "urgent") return true;
      if (item.type === "critical") return true;
      return item.category === "ADMISSION";
    });
  }
  if (role === "PARAVET") {
    return items.filter((item) => {
      if (item.category === "MEDS") return true;
      return item.type === "critical";
    });
  }
  return items;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/notification-snapshot.test.ts`
Expected: PASS

- [ ] **Step 5: Add the cached notification snapshot and provider refresh policy**

```ts
export async function getNotificationsSnapshot(role: NotificationRole, today: Date, nowMinutes: number) {
  "use cache";
  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(notificationsTag(role));

  const notifications = await buildNotificationsSnapshot(today, nowMinutes);
  return filterNotificationsForRole(sortNotificationsByPriority(notifications), role);
}
```

```ts
useEffect(() => {
  void refresh();

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void refresh();
    }
  };

  document.addEventListener("visibilitychange", onVisibilityChange);

  const interval = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void refresh();
    }
  }, 30000);

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.clearInterval(interval);
  };
}, [refresh]);
```

- [ ] **Step 6: Run notification verification**

Run: `node --import tsx --test tests/notification-snapshot.test.ts && npx eslint 'src/app/api/notifications/route.ts' 'src/components/layout/notification-provider.tsx' 'src/lib/notification-snapshot.ts'`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/notifications/route.ts \
  src/components/layout/notification-provider.tsx \
  src/lib/notification-snapshot.ts \
  tests/notification-snapshot.test.ts
git commit -m "perf: cache notification snapshots"
```

### Task 5: Tag the Patient Read Models

**Files:**
- Create: `tests/patient-page-cache.test.ts`
- Modify: `src/lib/patient-page-queries.ts`
- Modify: `src/app/(app)/patients/[admissionId]/page.tsx`
- Test: `tests/patient-page-cache.test.ts`
- Test: `tests/patient-page-data.test.ts`

- [ ] **Step 1: Write the failing patient cache tag test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  patientShellTag,
  patientTabTag,
} from "../src/lib/clinical-cache";

test("patient shell and tab tags remain stable", () => {
  assert.equal(patientShellTag("adm-1"), "patient:adm-1:shell");
  assert.equal(patientTabTag("adm-1", "meds"), "patient:adm-1:meds");
  assert.equal(patientTabTag("adm-1", "logs"), "patient:adm-1:logs");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/patient-page-cache.test.ts`
Expected: FAIL because `tests/patient-page-cache.test.ts` is new and the patient query helpers are not yet cache-tagged.

- [ ] **Step 3: Add cache tags and lifetimes to patient read helpers**

```ts
import { cacheLife, cacheTag } from "next/cache";
import {
  CLINICAL_WARM_PROFILE,
  patientShellTag,
  patientTabTag,
} from "@/lib/clinical-cache";

export async function getPatientPageShell(admissionId: string) {
  "use cache";
  cacheLife(CLINICAL_WARM_PROFILE);
  cacheTag(patientShellTag(admissionId));

  return db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      id: true,
      patientId: true,
      admissionDate: true,
      ward: true,
      cageNumber: true,
      condition: true,
      diagnosis: true,
      chiefComplaint: true,
      diagnosisNotes: true,
      attendingDoctor: true,
      status: true,
      patient: {
        select: {
          id: true,
          name: true,
          breed: true,
          age: true,
          sex: true,
          weight: true,
          species: true,
          color: true,
          isStray: true,
          rescueLocation: true,
          rescuerInfo: true,
          deletedAt: true,
        },
      },
    },
  });
}
```

```ts
export async function getPatientVitalsData(admissionId: string) {
  "use cache";
  cacheLife(CLINICAL_WARM_PROFILE);
  cacheTag(patientTabTag(admissionId, "vitals"));

  const admission = await db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      vitalRecords: {
        orderBy: { recordedAt: "desc" },
        include: { recordedBy: { select: { name: true } } },
      },
    },
  });

  return admission?.vitalRecords ?? [];
}
```

- [ ] **Step 4: Keep the page dynamic shell but continue to fetch only the active tab**

```ts
const loadPlan = getPatientTabLoadPlan(tab, isDoctor);
const admission = await getPatientPageShell(admissionId);

const vitals = loadPlan.vitals ? await getPatientVitalsData(admissionId) : [];
const medsData = loadPlan.meds
  ? await getPatientMedsData(admissionId, today)
  : { treatmentPlans: [], fluidTherapies: [] };
```

- [ ] **Step 5: Run patient-route verification**

Run: `node --import tsx --test tests/patient-page-cache.test.ts tests/patient-page-data.test.ts && npx eslint 'src/app/(app)/patients/[admissionId]/page.tsx' 'src/lib/patient-page-queries.ts'`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/'(app)'/patients/'[admissionId]'/page.tsx \
  src/lib/patient-page-queries.ts \
  tests/patient-page-cache.test.ts \
  tests/patient-page-data.test.ts
git commit -m "perf: tag patient read models"
```

### Task 6: Add Shared Mutation Invalidation Helpers

**Files:**
- Create: `src/lib/clinical-revalidation.ts`
- Create: `tests/clinical-revalidation.test.ts`
- Test: `tests/clinical-revalidation.test.ts`

- [ ] **Step 1: Write the failing invalidation mapping test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  getMedicationMutationTags,
  getFeedingMutationTags,
  getVitalsMutationTags,
  getBathMutationTags,
} from "../src/lib/clinical-revalidation";

test("medication mutations invalidate patient, dashboard, schedule, and notifications", () => {
  assert.deepEqual(getMedicationMutationTags("adm-1"), [
    "patient:adm-1:meds",
    "patient:adm-1:logs",
    "dashboard:summary",
    "dashboard:queue",
    "schedule:meds",
    "notifications:doctor",
    "notifications:admin",
    "notifications:attendant",
    "notifications:management",
    "notifications:paravet",
  ]);
});

test("bath mutations invalidate patient, dashboard, schedule, and notifications", () => {
  assert.deepEqual(getBathMutationTags("adm-1"), [
    "patient:adm-1:bath",
    "patient:adm-1:logs",
    "dashboard:summary",
    "dashboard:queue",
    "schedule:baths",
    "notifications:doctor",
    "notifications:admin",
    "notifications:attendant",
    "notifications:management",
    "notifications:paravet",
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/clinical-revalidation.test.ts`
Expected: FAIL because `src/lib/clinical-revalidation.ts` does not exist yet.

- [ ] **Step 3: Write the shared revalidation helper**

```ts
import { updateTag } from "next/cache";
import {
  dashboardQueueTag,
  dashboardSetupTag,
  dashboardSummaryTag,
  notificationsTag,
  patientShellTag,
  patientTabTag,
  scheduleTag,
} from "@/lib/clinical-cache";

const notificationTags = [
  notificationsTag("DOCTOR"),
  notificationsTag("ADMIN"),
  notificationsTag("ATTENDANT"),
  notificationsTag("MANAGEMENT"),
  notificationsTag("PARAVET"),
];

export function getMedicationMutationTags(admissionId: string) {
  return [
    patientTabTag(admissionId, "meds"),
    patientTabTag(admissionId, "logs"),
    dashboardSummaryTag(),
    dashboardQueueTag(),
    scheduleTag("meds"),
    ...notificationTags,
  ];
}

export function getAdmissionMutationTags(admissionId?: string) {
  return [
    ...(admissionId ? [patientShellTag(admissionId)] : []),
    dashboardSummaryTag(),
    dashboardQueueTag(),
    dashboardSetupTag(),
    scheduleTag("meds"),
    scheduleTag("feedings"),
    scheduleTag("baths"),
    ...notificationTags,
  ];
}

export function updateClinicalTags(tags: string[]) {
  for (const tag of new Set(tags)) {
    updateTag(tag);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/clinical-revalidation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/clinical-revalidation.ts tests/clinical-revalidation.test.ts
git commit -m "perf: add clinical mutation invalidation helpers"
```

### Task 7: Wire Invalidation Helpers into Clinical Server Actions and Re-Measure

**Files:**
- Modify: `src/actions/medications.ts`
- Modify: `src/actions/feeding.ts`
- Modify: `src/actions/vitals.ts`
- Modify: `src/actions/baths.ts`
- Modify: `src/actions/notes.ts`
- Modify: `src/actions/labs.ts`
- Modify: `src/actions/patient-media.ts`
- Modify: `src/actions/isolation.ts`
- Modify: `src/actions/admissions.ts`
- Test: `tests/clinical-revalidation.test.ts`

- [ ] **Step 1: Replace path-only invalidation in the highest-risk actions first**

```ts
import { revalidatePath } from "next/cache";
import {
  getMedicationMutationTags,
  updateClinicalTags,
} from "@/lib/clinical-revalidation";

export async function administerDose(
  treatmentPlanId: string,
  scheduledDate: string,
  scheduledTime: string
) {
  const session = await requireWriteAccess();
  const plan = await db.treatmentPlan.findUnique({
    where: { id: treatmentPlanId },
    select: {
      admissionId: true,
      isActive: true,
      deletedAt: true,
      admission: { select: { deletedAt: true, status: true } },
    },
  });

  if (!plan) return { error: "Treatment plan not found" };
  if (!plan.isActive || plan.deletedAt) return { error: "Treatment plan is no longer active" };
  if (plan.admission.deletedAt || plan.admission.status !== "ACTIVE") {
    return { error: "Admission is no longer active" };
  }

  const administration = await db.medicationAdministration.upsert({
    where: {
      treatmentPlanId_scheduledDate_scheduledTime: {
        treatmentPlanId,
        scheduledDate: toUTCDate(scheduledDate),
        scheduledTime,
      },
    },
    update: {
      wasAdministered: true,
      wasSkipped: false,
      skipReason: null,
      actualTime: new Date(),
      administeredById: session.staffId,
    },
    create: {
      treatmentPlanId,
      scheduledDate: toUTCDate(scheduledDate),
      scheduledTime,
      wasAdministered: true,
      actualTime: new Date(),
      administeredById: session.staffId,
    },
  });

  updateClinicalTags(getMedicationMutationTags(plan.admissionId));
  revalidatePath("/patients/[admissionId]", "page");
  revalidatePath("/schedule");
  return { success: true, id: administration.id };
}
```

- [ ] **Step 2: Apply the same pattern to feeding, vitals, and baths**

```ts
updateClinicalTags(getFeedingMutationTags(admissionId));
updateClinicalTags(getVitalsMutationTags(admissionId));
updateClinicalTags(getBathMutationTags(admissionId));
```

- [ ] **Step 3: Wire notes, labs, media, isolation, and admissions into the shared tag model**

```ts
updateClinicalTags([
  patientTabTag(admissionId, "notes"),
  patientTabTag(admissionId, "logs"),
]);

updateClinicalTags(getAdmissionMutationTags(admissionId));
```

- [ ] **Step 4: Run the full targeted verification suite**

Run: `node --import tsx --test tests/clinical-cache.test.ts tests/dashboard-data.test.ts tests/schedule-data.test.ts tests/notification-snapshot.test.ts tests/patient-page-data.test.ts tests/clinical-revalidation.test.ts`
Expected: PASS

- [ ] **Step 5: Run type and lint verification on the changed surface**

Run: `npx tsc --noEmit --pretty false --incremental false && npx eslint 'src/actions/medications.ts' 'src/actions/feeding.ts' 'src/actions/vitals.ts' 'src/actions/baths.ts' 'src/actions/notes.ts' 'src/actions/labs.ts' 'src/actions/patient-media.ts' 'src/actions/isolation.ts' 'src/actions/admissions.ts' 'src/lib/clinical-cache.ts' 'src/lib/clinical-revalidation.ts' 'src/lib/dashboard-data.ts' 'src/lib/dashboard-queries.ts' 'src/lib/schedule-data.ts' 'src/lib/schedule-queries.ts' 'src/lib/notification-snapshot.ts' 'src/lib/patient-page-queries.ts' 'src/app/(app)/page.tsx' 'src/app/(app)/schedule/page.tsx' 'src/app/api/notifications/route.ts' 'src/components/layout/notification-provider.tsx'`
Expected: PASS

- [ ] **Step 6: Run a live timing comparison with the dev server**

Run:

```bash
node <<'EOF'
const base = 'http://localhost:3000';
const phone = '112345678901';
const password = '112345678901';

function decodeHtml(value = '') {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function pickCookies(setCookies) {
  return setCookies.map((value) => value.split(';')[0]).join('; ');
}

async function fetchText(path, cookieHeader) {
  const start = performance.now();
  const res = await fetch(base + path, {
    headers: {
      origin: base,
      referer: base + path,
      'user-agent': 'Mozilla/5.0',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    redirect: 'manual',
  });
  const ms = Math.round(performance.now() - start);
  const text = await res.text();
  return { res, text, ms };
}

(async () => {
  const loginPage = await fetchText('/login');
  const hiddenInputs = loginPage.text
    .split('<input')
    .slice(1)
    .map((chunk) => '<input' + chunk)
    .filter((input) => input.includes('type="hidden"'))
    .map((input) => {
      const name = input.match(/name="([^"]+)"/)?.[1] ?? null;
      const value = input.match(/value="([^"]*)"/)?.[1] ?? '';
      return name ? [name, decodeHtml(value)] : null;
    })
    .filter(Boolean);

  const form = new FormData();
  for (const [name, value] of hiddenInputs) form.append(name, value);
  form.append('phone', phone);
  form.append('password', password);

  const loginRes = await fetch(base + '/login', {
    method: 'POST',
    body: form,
    redirect: 'manual',
    headers: {
      origin: base,
      referer: base + '/login',
      'user-agent': 'Mozilla/5.0',
    },
  });

  const cookies = typeof loginRes.headers.getSetCookie === 'function'
    ? loginRes.headers.getSetCookie()
    : [];
  const cookieHeader = pickCookies(cookies);

  const home = await fetchText('/', cookieHeader);
  const schedule = await fetchText('/schedule', cookieHeader);
  const notifications = await fetchText('/api/notifications', cookieHeader);

  console.log(JSON.stringify({
    homeMs: home.ms,
    scheduleMs: schedule.ms,
    notificationsMs: notifications.ms,
  }, null, 2));
})();
EOF
```

Expected: materially lower warm-read timings than the baseline of roughly `4.8-5.5s` for `/`, `~0.6-1.4s` patient tabs, and `~1-1.7s` notifications.

- [ ] **Step 7: Commit**

```bash
git add src/actions/medications.ts \
  src/actions/feeding.ts \
  src/actions/vitals.ts \
  src/actions/baths.ts \
  src/actions/notes.ts \
  src/actions/labs.ts \
  src/actions/patient-media.ts \
  src/actions/isolation.ts \
  src/actions/admissions.ts
git commit -m "perf: invalidate clinical caches on write"
```
