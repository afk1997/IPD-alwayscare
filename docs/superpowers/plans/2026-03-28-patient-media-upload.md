# Patient Photo & Video Upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the useless "Photo URL" text input with actual photo/video upload to Google Drive, add a Photos tab to the patient detail page, and display the profile photo in the patient header.

**Architecture:** New `PatientMedia` Prisma model. Reuse existing `uploadFileChunked()` and Google Drive infrastructure. New server actions in `src/actions/patient-media.ts`. New Photos tab component. Update registration form and patient header.

**Tech Stack:** Next.js 16, Prisma 7, Google Drive API (resumable upload), shadcn/ui (Sheet, Dialog, Button)

---

### Task 1: Schema — Add PatientMedia model, remove photoUrl

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add PatientMedia model to schema**

Add after the ProofAttachment model:

```prisma
model PatientMedia {
  id             String   @id @default(cuid())
  patientId      String
  patient        Patient  @relation(fields: [patientId], references: [id])
  fileUrl        String
  fileId         String
  fileName       String
  mimeType       String
  isProfilePhoto Boolean  @default(false)
  uploadedById   String
  uploadedBy     Staff    @relation(fields: [uploadedById], references: [id])
  createdAt      DateTime @default(now())

  @@index([patientId])
}
```

Add `media PatientMedia[]` to the Patient model's relations.
Add `patientMedia PatientMedia[]` to the Staff model's relations.
Remove `photoUrl String?` from the Patient model.

- [ ] **Step 2: Run prisma db push and generate**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 3: Fix any code that references `photoUrl`**

Search for `photoUrl` in all .ts/.tsx files. Remove it from:
- `src/actions/admissions.ts` — `registerPatient()` (remove `photoUrl` from formData extraction and patient.create data)
- `src/actions/admissions.ts` — `editRegisteredPatient()` (if it references photoUrl)
- `src/components/forms/registration-form.tsx` — remove the Photo URL input field entirely (lines 152-162)

- [ ] **Step 4: Verify build**

```bash
npx next build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/
git commit -m "feat: add PatientMedia schema, remove photoUrl field"
```

---

### Task 2: Server actions for patient media

**Files:**
- Create: `src/actions/patient-media.ts`

- [ ] **Step 1: Create the patient-media actions file**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireDoctor } from "@/lib/auth";
import { handleActionError } from "@/lib/action-utils";
import { markDeletedInDrive } from "@/lib/google-auth";

export async function savePatientMedia(
  patientId: string,
  files: Array<{ fileUrl: string; fileId: string; fileName: string; mimeType: string }>,
  setAsProfile: boolean
) {
  try {
    const session = await requireAuth();

    const patient = await db.patient.findUnique({
      where: { id: patientId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) return { error: "Patient not found" };

    // If setting as profile, unset any existing profile photo
    if (setAsProfile && files.length > 0) {
      await db.patientMedia.updateMany({
        where: { patientId, isProfilePhoto: true },
        data: { isProfilePhoto: false },
      });
    }

    await db.patientMedia.createMany({
      data: files.map((f, i) => ({
        patientId,
        fileUrl: f.fileUrl,
        fileId: f.fileId,
        fileName: f.fileName,
        mimeType: f.mimeType,
        isProfilePhoto: setAsProfile && i === 0,
        uploadedById: session.staffId,
      })),
    });

    revalidatePath(`/patients`);
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deletePatientMedia(mediaId: string) {
  try {
    await requireDoctor();

    const media = await db.patientMedia.findUnique({
      where: { id: mediaId },
      select: { id: true, fileId: true, fileName: true, patientId: true, isProfilePhoto: true },
    });
    if (!media) return { error: "Media not found" };

    // Rename in Google Drive
    await markDeletedInDrive([{ fileId: media.fileId, fileName: media.fileName }]);

    // Delete from DB
    await db.patientMedia.delete({ where: { id: mediaId } });

    // If it was the profile photo, promote the next one
    if (media.isProfilePhoto) {
      const next = await db.patientMedia.findFirst({
        where: { patientId: media.patientId, mimeType: { startsWith: "image/" } },
        orderBy: { createdAt: "asc" },
      });
      if (next) {
        await db.patientMedia.update({
          where: { id: next.id },
          data: { isProfilePhoto: true },
        });
      }
    }

    revalidatePath(`/patients`);
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function setProfilePhoto(mediaId: string) {
  try {
    await requireAuth();

    const media = await db.patientMedia.findUnique({
      where: { id: mediaId },
      select: { id: true, patientId: true, mimeType: true },
    });
    if (!media) return { error: "Media not found" };
    if (!media.mimeType.startsWith("image/")) {
      return { error: "Only images can be set as profile photo" };
    }

    // Unset current profile, set new one
    await db.$transaction(async (tx: any) => {
      await tx.patientMedia.updateMany({
        where: { patientId: media.patientId, isProfilePhoto: true },
        data: { isProfilePhoto: false },
      });
      await tx.patientMedia.update({
        where: { id: mediaId },
        data: { isProfilePhoto: true },
      });
    });

    revalidatePath(`/patients`);
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/actions/patient-media.ts
git commit -m "feat: add patient media server actions"
```

---

### Task 3: Registration form — replace URL input with file upload

**Files:**
- Modify: `src/components/forms/registration-form.tsx`
- Modify: `src/actions/admissions.ts` (registerPatient to handle media after patient creation)

- [ ] **Step 1: Update registration form**

Replace the "Photo URL" input (lines 152-162) with a file picker that:
- Uses `<input type="file" accept="image/*,video/*" capture="environment" multiple>` hidden behind a styled Button
- Shows thumbnail previews of selected files (images as img tags, videos with play overlay)
- Has a remove button per preview
- Stores selected Files in React state
- On form submit: first creates the patient via `registerPatient()`, then uploads files via `uploadFileChunked()` and saves via `savePatientMedia()`. The upload happens client-side AFTER patient creation succeeds.

Import `uploadFileChunked` from `@/lib/chunked-upload`, `savePatientMedia` from `@/actions/patient-media`, `buildDriveFolderPath` from `@/lib/drive-path`.

The folder path for registration photos: `buildDriveFolderPath(patientName, "PROFILE")` — also add "PROFILE" to the catLabels in `src/lib/drive-path.ts`.

- [ ] **Step 2: Update drive-path.ts to support PROFILE category**

Add `PROFILE: "Profile"` to the `catLabels` record in `buildDriveFolderPath()`.

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/components/forms/registration-form.tsx src/lib/drive-path.ts src/actions/admissions.ts
git commit -m "feat: replace photo URL input with file upload in registration"
```

---

### Task 4: Patient header — show profile photo

**Files:**
- Modify: `src/components/patient/patient-header.tsx`
- Modify: `src/app/(app)/patients/[admissionId]/page.tsx`

- [ ] **Step 1: Update patient detail page to query profile photo**

In the admission query's `patient` include, add:
```typescript
patient: {
  include: {
    media: {
      where: { isProfilePhoto: true },
      take: 1,
      select: { fileUrl: true },
    },
  },
},
```

Or simpler: since `patient: true` already loads all scalar fields, separately query the profile photo and pass it to PatientHeader.

- [ ] **Step 2: Update PatientHeader to accept and display profilePhotoUrl**

Replace the paw emoji placeholder (lines 273-276) with:
```tsx
{profilePhotoUrl ? (
  <img
    src={profilePhotoUrl}
    alt={patient.name}
    className="w-12 h-12 rounded-lg object-cover shrink-0"
  />
) : (
  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl shrink-0">
    🐾
  </div>
)}
```

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/components/patient/patient-header.tsx src/app/(app)/patients/[admissionId]/page.tsx
git commit -m "feat: show patient profile photo in header"
```

---

### Task 5: Photos tab component

**Files:**
- Create: `src/components/patient/photos-tab.tsx`

- [ ] **Step 1: Create the Photos tab component**

A client component with:

**Props:**
```typescript
interface PhotosTabProps {
  patientId: string;
  patientName: string;
  media: Array<{
    id: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    isProfilePhoto: boolean;
    createdAt: Date;
    uploadedBy: { name: string };
  }>;
  isDoctor: boolean;
}
```

**Features:**
- Upload button at top — opens hidden file input (`accept="image/*,video/*" multiple capture="environment"`)
- Upload progress indicator per file (uses `uploadFileChunked()`)
- After upload completes, calls `savePatientMedia()` and page revalidates
- 3-column grid of thumbnails
- Images render as `<img>` with `object-cover`
- Videos render as `<video>` with first frame poster, play icon overlay
- Tap/click opens full-size viewer (Dialog with large image or video player)
- Each item has: "Set as profile" button (images only, any staff), Delete button (doctors only)
- Delete calls `deletePatientMedia()` with confirmation dialog
- "Set as profile" calls `setProfilePhoto()`
- Profile photo has a small star/checkmark badge overlay
- Empty state: "No photos yet" with upload prompt

Use `buildDriveFolderPath(patientName, "PROFILE")` for folder path.
Use `buildDriveFileName("profile", "photo")` for file naming.

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/patient/photos-tab.tsx
git commit -m "feat: add Photos tab component with upload, gallery, and viewer"
```

---

### Task 6: Wire up Photos tab in patient page and tab nav

**Files:**
- Modify: `src/components/patient/tab-nav.tsx`
- Modify: `src/app/(app)/patients/[admissionId]/page.tsx`

- [ ] **Step 1: Add "Photos" tab to tab-nav.tsx**

Add to `BASE_TABS` array:
```typescript
{ key: "photos", label: "Photos" },
```

- [ ] **Step 2: Update patient detail page to query and render Photos tab**

Add to the admission query — include `patientMedia` (or query separately):
```typescript
const patientMedia = await db.patientMedia.findMany({
  where: { patientId: admission.patientId },
  orderBy: { createdAt: "desc" },
  include: { uploadedBy: { select: { name: true } } },
});
```

Add the tab render:
```tsx
{tab === "photos" && (
  <PhotosTab
    patientId={admission.patientId}
    patientName={admission.patient.name}
    media={patientMedia}
    isDoctor={isDoctor}
  />
)}
```

Import `PhotosTab` from `@/components/patient/photos-tab`.

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/components/patient/tab-nav.tsx src/app/(app)/patients/[admissionId]/page.tsx
git commit -m "feat: wire Photos tab into patient detail page"
```

---

### Task 7: Handle patient deletion cleanup

**Files:**
- Modify: `src/actions/admissions.ts` — `permanentlyDeletePatient` and `cancelRegistration`

- [ ] **Step 1: Update permanentlyDeletePatient to clean up PatientMedia**

Inside the transaction, before deleting the patient, add:
```typescript
// Delete patient media
const patientMediaItems = await tx.patientMedia.findMany({
  where: { patientId: { in: admissionIds.length > 0 ? [patient.id] : [] } },
  select: { id: true, fileId: true, fileName: true },
});
// Rename in Drive
await markDeletedInDrive(patientMediaItems);
await tx.patientMedia.deleteMany({ where: { patientId: patient.id } });
```

Actually simpler — just use `patientId` directly:
```typescript
const mediaItems = await tx.patientMedia.findMany({
  where: { patientId },
  select: { fileId: true, fileName: true },
});
await markDeletedInDrive(mediaItems);
await tx.patientMedia.deleteMany({ where: { patientId } });
```

Add this before the `tx.patient.delete()` call.

- [ ] **Step 2: Update cancelRegistration similarly**

Inside the transaction, before `tx.patient.delete()`, add:
```typescript
const mediaItems = await tx.patientMedia.findMany({
  where: { patientId: current.patientId },
  select: { fileId: true, fileName: true },
});
await markDeletedInDrive(mediaItems);
await tx.patientMedia.deleteMany({ where: { patientId: current.patientId } });
```

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/actions/admissions.ts
git commit -m "feat: clean up patient media on patient deletion"
```
