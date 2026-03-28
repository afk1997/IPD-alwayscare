# Patient Photo & Video Upload

## Problem

The registration form has a "Photo URL" text input that expects a manual URL. Nobody uses it. Photos are never displayed on the patient page. Staff need to upload actual photos and videos of patients — both during registration and later from the patient detail page.

## Design

### Schema

New `PatientMedia` model:

```prisma
model PatientMedia {
  id             String   @id @default(cuid())
  patientId      String
  patient        Patient  @relation(fields: [patientId], references: [id])
  fileUrl        String   // Google Drive shareable link
  fileId         String   // Google Drive file ID
  fileName       String
  mimeType       String   // image/jpeg, video/mp4, etc.
  isProfilePhoto Boolean  @default(false)
  uploadedById   String
  uploadedBy     Staff    @relation(fields: [uploadedById], references: [id])
  createdAt      DateTime @default(now())

  @@index([patientId])
}
```

Remove the `photoUrl` field from Patient model. The profile photo is now the PatientMedia row where `isProfilePhoto = true`.

### Registration Form

Replace the URL text input with a file picker button. Uses the existing `uploadFileChunked()` utility and Google Drive storage. Upload is optional — patient can be registered without a photo. If uploaded, the photo is saved as a PatientMedia row with `isProfilePhoto: true`.

File picker accepts: `image/*,video/*` with `capture="environment"` for mobile camera. Show preview thumbnail after selection.

Drive folder path: `Patients/{Year}/{Month}/{PatientName}/Profile/`

### Patient Header

Replace the hardcoded paw emoji (patient-header.tsx lines 273-276) with the profile photo. If no profile photo exists, fall back to the paw emoji. Photo is a small round thumbnail. Clicking opens full-size view.

### New "Photos" Tab

Add a new tab to the patient detail page tab navigation (alongside Meds, Food, Vitals, etc.).

**Layout:**
- Upload button at the top (any staff)
- Grid of thumbnails (3 columns on mobile)
- Photos show as thumbnails, videos show thumbnail with play icon overlay
- Tap to view full-size / play video
- Delete button on each item (doctors/admins only)
- "Set as profile" button on photos (any staff)

**Upload flow:** Same chunked upload pattern as proof-upload-dialog. Multiple file selection. Progress indicator per file.

### Server Actions

- `uploadPatientMedia(patientId, fileData[])` — saves PatientMedia rows after Google Drive upload
- `deletePatientMedia(mediaId)` — deletes from DB, renames in Drive to "DELETED - ..."
- `setProfilePhoto(mediaId)` — sets `isProfilePhoto = true` on target, `false` on all others for that patient

### Files to modify/create

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add PatientMedia model, remove photoUrl from Patient, add relation |
| `src/actions/patient-media.ts` | New file: uploadPatientMedia, deletePatientMedia, setProfilePhoto |
| `src/components/forms/registration-form.tsx` | Replace URL input with file picker + preview |
| `src/components/patient/patient-header.tsx` | Show profile photo instead of paw emoji |
| `src/components/patient/photos-tab.tsx` | New file: Photos tab with grid + upload + viewer |
| `src/components/patient/tab-nav.tsx` | Add "Photos" tab |
| `src/app/(app)/patients/[admissionId]/page.tsx` | Query PatientMedia, pass to Photos tab |

### Edge cases

- Registration upload fails mid-way: patient is still registered, just without a photo. Non-blocking.
- Delete profile photo: next photo becomes profile, or fall back to paw emoji.
- Patient has no media: Photos tab shows empty state with upload prompt.
- Large videos: 100MB limit enforced by existing upload/init endpoint.
