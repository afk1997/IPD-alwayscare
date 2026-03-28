# Edit & Cancel Registered Patients

## Problem

Patients in "Awaiting Clinical Setup" (REGISTERED status) cannot be edited or cancelled. If registration details are wrong or a patient was registered by mistake, there's no recourse — the record sits in the pending list indefinitely.

## Design

### Cancel Registration

- **Who**: Any authenticated staff member
- **What**: Hard-deletes both the Admission and Patient records
- **Why hard-delete**: No clinical data exists at REGISTERED stage (no vitals, meds, notes, proofs) — nothing to preserve
- **UI**: Red "Cancel" button on each pending patient card in the dashboard's "Awaiting Clinical Setup" section. Opens confirmation dialog.
- **Safety**: Confirmation dialog says "This will permanently remove [Patient Name] from the system."

### Edit Patient Details

- **Who**: Any authenticated staff member
- **What**: Edit the patient fields captured at registration: name, species, breed, age, weight, sex, color/markings, stray info (isStray, rescueLocation, rescuerInfo)
- **UI**: Edit (pencil) icon button on each pending patient card. Opens a Sheet (side panel) with the editable fields, pre-filled with current values.
- **Reuse**: Uses the existing `updatePatient` server action — already handles all these fields.

### Pre-assign Attending Doctor

- **Who**: Any authenticated staff member
- **What**: Set `attendingDoctorId` on the admission before clinical setup, so the team knows who's responsible
- **UI**: Doctor dropdown on the edit sheet (not a separate control — bundled with the edit flow)
- **Backend**: New action `assignDoctorToRegistered(admissionId, doctorId)` — updates the admission's `attendingDoctorId` field. Only works on REGISTERED admissions.

## Files to modify

| File | Change |
|------|--------|
| `src/actions/admissions.ts` | Add `cancelRegistration(admissionId)` — hard-deletes admission + patient |
| `src/actions/admissions.ts` | Add `assignDoctorToRegistered(admissionId, doctorId)` |
| `src/components/dashboard/pending-setup.tsx` | Add Edit and Cancel buttons, confirmation dialog, edit sheet |
| `src/app/(app)/page.tsx` | Pass doctors list to PendingSetup component |

## Edge cases

- Cancel on a patient that was already set up (race condition): Action checks `status === "REGISTERED"` before deleting
- Edit on a patient that was already set up: Sheet should only open for REGISTERED admissions
- The pending-setup component already returns null if no registered admissions exist
