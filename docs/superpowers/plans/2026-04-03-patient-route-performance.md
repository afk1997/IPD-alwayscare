# Patient Route Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make patient tab navigation faster by loading only the data needed for the active tab instead of re-fetching the full admission graph on every tab switch.

**Architecture:** Introduce a patient-page data loader with a small shared shell query plus tab-specific supplemental queries. Keep the UI structure stable so the performance win comes from smaller server work rather than a visible product rewrite.

**Tech Stack:** Next.js App Router, React Server Components, Prisma, Node.js built-in test runner, TypeScript

---

### Task 1: Add a Testable Tab Load Plan

**Files:**
- Create: `src/lib/patient-page-data.ts`
- Create: `tests/patient-page-data.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { getPatientTabLoadPlan } from "@/lib/patient-page-data";

test("vitals tab only requests shell, vitals, and doctor actions", () => {
  assert.deepEqual(getPatientTabLoadPlan("vitals", true), {
    vitals: true,
    meds: false,
    food: false,
    notes: false,
    labs: false,
    bath: false,
    isolation: false,
    logs: false,
    photos: false,
    profilePhoto: true,
    availableCages: true,
  });
});

test("photos tab only requests shell and media data", () => {
  assert.deepEqual(getPatientTabLoadPlan("photos", false), {
    vitals: false,
    meds: false,
    food: false,
    notes: false,
    labs: false,
    bath: false,
    isolation: false,
    logs: false,
    photos: true,
    profilePhoto: true,
    availableCages: false,
  });
});

test("logs tab opts into the broad history load", () => {
  const plan = getPatientTabLoadPlan("logs", true);
  assert.equal(plan.logs, true);
  assert.equal(plan.availableCages, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/patient-page-data.test.ts`
Expected: FAIL because `src/lib/patient-page-data.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type PatientTabKey =
  | "vitals"
  | "meds"
  | "food"
  | "notes"
  | "logs"
  | "labs"
  | "bath"
  | "photos"
  | "isolation";

export interface PatientTabLoadPlan {
  vitals: boolean;
  meds: boolean;
  food: boolean;
  notes: boolean;
  labs: boolean;
  bath: boolean;
  isolation: boolean;
  logs: boolean;
  photos: boolean;
  profilePhoto: boolean;
  availableCages: boolean;
}

export function getPatientTabLoadPlan(
  tab: string,
  isDoctor: boolean
): PatientTabLoadPlan {
  return {
    vitals: tab === "vitals",
    meds: tab === "meds",
    food: tab === "food",
    notes: tab === "notes",
    labs: tab === "labs",
    bath: tab === "bath",
    isolation: tab === "isolation",
    logs: tab === "logs",
    photos: tab === "photos",
    profilePhoto: true,
    availableCages: isDoctor,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/patient-page-data.test.ts`
Expected: PASS

### Task 2: Move Patient Detail Fetching Behind the Load Plan

**Files:**
- Modify: `src/app/(app)/patients/[admissionId]/page.tsx`
- Modify: `src/lib/patient-page-data.ts`

- [ ] **Step 1: Write the failing test expectation in code comments and keep Task 1 green**

```ts
// The page should fetch shell data once, then fetch only the active tab payload.
```

- [ ] **Step 2: Implement the server-side loader helpers**

```ts
export async function getPatientPageShell(...) { ... }
export async function getPatientPageTabData(...) { ... }
```

- [ ] **Step 3: Refactor the page to use shell + tab data**

```ts
const shell = await getPatientPageShell(...);
const tabPlan = getPatientTabLoadPlan(tab, isDoctor);
const tabData = await getPatientPageTabData({ admissionId, patientId, tab, tabPlan, ... });
```

- [ ] **Step 4: Keep component props stable while passing only the active tab data**

```tsx
{tab === "vitals" && <VitalsTab vitals={tabData.vitals} ... />}
{tab === "photos" && <PhotosTab media={tabData.media} ... />}
```

- [ ] **Step 5: Run targeted verification**

Run: `npm run lint`
Expected: PASS

### Task 3: Validate the Slow Path Improvement

**Files:**
- Modify: `docs/superpowers/specs/2026-04-03-patient-route-performance-design.md`

- [ ] **Step 1: Re-run the targeted test**

Run: `node --import tsx --test tests/patient-page-data.test.ts`
Expected: PASS

- [ ] **Step 2: Run a production-safety type/lint check**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Capture runtime evidence from the dev server**

Run: hit `/patients/[admissionId]?tab=vitals`, `/patients/[admissionId]?tab=photos`, and `/patients/[admissionId]?tab=logs`
Expected: lighter tabs no longer force unrelated data loading logic in the server path.
