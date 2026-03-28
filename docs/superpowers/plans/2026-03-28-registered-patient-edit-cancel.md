# Edit & Cancel Registered Patients — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow any staff member to edit patient details or cancel registration for patients awaiting clinical setup.

**Architecture:** Two new server actions (`cancelRegistration`, `editRegisteredPatient`) in admissions.ts. The `PendingSetup` dashboard component gets Edit (Sheet) and Cancel (Dialog) buttons. No new files — all changes fit in existing files.

**Tech Stack:** Next.js 16 Server Actions, Prisma 7, React (Sheet + Dialog from shadcn/ui)

---

### Task 1: Add `cancelRegistration` server action

**Files:**
- Modify: `src/actions/admissions.ts` (add after `registerPatient` function, ~line 70)

- [ ] **Step 1: Add the cancelRegistration function**

```typescript
export async function cancelRegistration(admissionId: string) {
  try {
    await requireAuth();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, status: true, patientId: true },
    });
    if (!admission) return { error: "Admission not found" };
    if (admission.status !== "REGISTERED") {
      return { error: "Only registered (pending setup) patients can be cancelled" };
    }

    // Hard-delete both admission and patient — no clinical data exists yet
    await db.$transaction(async (tx: any) => {
      await tx.admission.delete({ where: { id: admissionId } });
      await tx.patient.delete({ where: { id: admission.patientId } });
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/actions/admissions.ts
git commit -m "feat: add cancelRegistration server action"
```

---

### Task 2: Add `editRegisteredPatient` server action

**Files:**
- Modify: `src/actions/admissions.ts` (add after `cancelRegistration`)

- [ ] **Step 1: Add the editRegisteredPatient function**

This is separate from `updatePatient` because `updatePatient` requires doctor role, but any staff should be able to edit registered patients.

```typescript
export async function editRegisteredPatient(admissionId: string, formData: FormData) {
  try {
    await requireAuth();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, status: true, patientId: true },
    });
    if (!admission) return { error: "Admission not found" };
    if (admission.status !== "REGISTERED") {
      return { error: "Only registered (pending setup) patients can be edited here" };
    }

    const name = (formData.get("name") as string)?.trim();
    const breed = (formData.get("breed") as string) || null;
    const age = (formData.get("age") as string) || null;
    const weightStr = formData.get("weight") as string;
    const weight = weightStr ? parseFloat(weightStr) : null;
    const sex = formData.get("sex") as string;
    const color = (formData.get("color") as string) || null;
    const isStray = formData.get("isStray") === "true";
    const rescueLocation = (formData.get("rescueLocation") as string) || null;
    const rescuerInfo = (formData.get("rescuerInfo") as string) || null;

    if (!name) return { error: "Patient name is required" };

    await db.patient.update({
      where: { id: admission.patientId },
      data: {
        name,
        breed,
        age,
        weight,
        sex: sex ? validateSex(sex) : undefined,
        color,
        isStray,
        rescueLocation: isStray ? rescueLocation : null,
        rescuerInfo: isStray ? rescuerInfo : null,
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/actions/admissions.ts
git commit -m "feat: add editRegisteredPatient server action"
```

---

### Task 3: Update PendingSetup component with Edit Sheet and Cancel Dialog

**Files:**
- Modify: `src/components/dashboard/pending-setup.tsx` (full rewrite of the component)

- [ ] **Step 1: Update the PendingSetup component**

Add imports for Sheet, Dialog, Button, Input, Label, Select, Switch from shadcn/ui. Add Pencil, Trash2, X icons from lucide-react. Import the two new server actions.

Expand the `RegisteredAdmission` interface to include `patient.species`, `patient.sex`, `patient.color`, `patient.isStray`, `patient.rescueLocation`, `patient.rescuerInfo`, and `patient.id`.

Add two inline components:
- `EditRegisteredSheet` — Side panel with all patient fields pre-filled, save button calls `editRegisteredPatient`
- `CancelRegistrationDialog` — Confirmation dialog, confirm button calls `cancelRegistration`

Add Edit (pencil icon) and Cancel (trash icon) buttons to each patient card row, visible to all staff.

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/pending-setup.tsx
git commit -m "feat: add edit sheet and cancel dialog to pending setup cards"
```

---

### Task 4: Update dashboard page to pass additional patient data

**Files:**
- Modify: `src/app/(app)/page.tsx` (update the Prisma query include for patient)

- [ ] **Step 1: Expand patient select in the admissions query**

The current query at ~line 37 has `patient: true` which already includes all patient fields. Verify this includes `id`, `species`, `sex`, `color`, `isStray`, `rescueLocation`, `rescuerInfo`. Since `include: { patient: true }` returns all scalar fields, no query change is needed.

However, the `PendingSetup` component's `RegisteredAdmission` interface needs to match. The component changes in Task 3 handle this.

- [ ] **Step 2: Verify the registeredAdmissions passed to PendingSetup include the new fields**

Read the dashboard page.tsx to confirm `registeredAdmissions` is derived from the same `admissions` query that includes `patient: true`. It is — no changes needed to page.tsx.

- [ ] **Step 3: Final build verification**

Run: `npx next build 2>&1 | tail -10`
Expected: Full build succeeds with no TypeScript errors

- [ ] **Step 4: Commit all changes**

```bash
git add -A
git commit -m "feat: edit and cancel registered patients from dashboard"
```
