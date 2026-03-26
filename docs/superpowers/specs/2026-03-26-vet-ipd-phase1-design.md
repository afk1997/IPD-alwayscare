# Veterinary IPD Management System — Phase 1 Design Spec

## Overview

A mobile-first PWA for managing inpatient animals at the Always Care animal clinic. Replaces paper treatment sheets. Staff (doctors, paravets, attendants) track admissions, medications, vitals, feeding, clinical notes, baths, and isolation protocols from their phones.

**Scope**: Phase 1 — Core system for daily use. Excludes: WhatsApp notifications (Phase 3), vitals trend charts (Phase 3), admin panel for staff/cage management (Phase 3), PWA offline support (not planned), weight trend alerts (Phase 3).

**Source PRD**: `VET-IPD-PRD.md`

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS + shadcn/ui |
| ORM | Prisma |
| Database | PostgreSQL on Neon DB (serverless) |
| Auth | Custom phone+password, encrypted session cookie |
| File uploads | Google Drive API (service account) |
| Hosting | Vercel |
| PWA | @serwist/next (asset caching, installable, no offline data) |
| Charts | Recharts (Phase 3 — vitals trends) |

---

## Architecture

### Approach: Monolithic App Router + Server Actions

All mutations via Server Actions. Single Route Handler for Google Drive file uploads (multipart). No separate API layer — Prisma called directly in server code.

### Project Structure

```
src/
├── app/
│   ├── (auth)/                  # Login page — no nav bar
│   │   └── login/page.tsx
│   ├── (app)/                   # Authenticated app — shared layout with bottom nav
│   │   ├── layout.tsx           # Bottom nav + top header
│   │   ├── page.tsx             # Dashboard (home)
│   │   ├── patients/
│   │   │   ├── new/page.tsx     # Register / Admit patient
│   │   │   └── [admissionId]/page.tsx  # Patient detail (tabbed)
│   │   ├── schedule/page.tsx    # Daily schedule
│   │   ├── isolation/page.tsx   # Isolation ward view
│   │   ├── admin/page.tsx       # Staff & cage management
│   │   └── profile/page.tsx     # Current user profile
│   ├── api/
│   │   └── uploads/route.ts     # Google Drive file upload (multipart)
│   ├── manifest.ts              # PWA web manifest
│   └── layout.tsx               # Root layout (fonts, providers)
├── actions/                     # Server Actions grouped by domain
│   ├── auth.ts
│   ├── admissions.ts
│   ├── vitals.ts
│   ├── medications.ts
│   ├── feeding.ts
│   ├── notes.ts
│   ├── baths.ts
│   ├── isolation.ts
│   ├── fluids.ts
│   ├── labs.ts
│   └── staff.ts
├── lib/
│   ├── db.ts                    # Prisma client singleton
│   ├── auth.ts                  # Session encrypt/decrypt/verify helpers
│   ├── google-drive.ts          # Google Drive API wrapper
│   ├── whatsapp.ts              # Interakt API wrapper (Phase 3 stub)
│   ├── vitals-thresholds.ts     # Abnormal value detection logic
│   └── constants.ts             # Enums, frequency→time mappings
├── components/
│   ├── ui/                      # shadcn/ui base components
│   ├── dashboard/               # Dashboard cards, patient list, alert banners
│   ├── patient/                 # Patient detail tab components
│   ├── forms/                   # Shared form components (vitals form, med form, etc.)
│   └── layout/                  # BottomNav, TopHeader, FAB
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── proxy.ts                     # Auth middleware — check session, redirect to /login
```

### Route Groups

- `(auth)` — Login page. No bottom nav. Unauthenticated access.
- `(app)` — All authenticated pages. Shared layout with bottom nav (mobile) / sidebar (desktop).

### Auth Middleware (`proxy.ts`)

Runs on every request. Decrypts the session cookie, verifies the session exists in the database and isn't expired, attaches `userId` and `role` to request headers. Redirects to `/login` if missing or expired. Located at `src/proxy.ts` (same level as `app/`).

---

## Authentication

### Flow

1. Admin pre-creates staff accounts (name, phone, role, temporary password).
2. Staff visits `/login` → enters phone number + password.
3. Server Action validates credentials (bcrypt compare) → creates a `Session` row → sets an encrypted HTTP-only cookie containing `{sessionId, staffId, role}`.
4. `proxy.ts` checks the cookie on every request.
5. Sessions expire after 7 days.
6. Deactivating a staff account invalidates all their active sessions.

### Password Management

- Passwords stored as bcrypt hashes.
- No self-service password reset in Phase 1 — admin resets manually.
- No email/OTP involved.

---

## Data Model

All models as specified in the PRD (`VET-IPD-PRD.md` lines 80-263), with these additions/changes:

### Additions

**Staff model — auth fields:**
- `passwordHash` — string. bcrypt hash of the password.

**Session model (new):**
- `id` — string (cuid)
- `token` — string, unique. Random token stored in the encrypted cookie.
- `staff` — relation to Staff
- `expiresAt` — datetime. 7 days from creation.
- `createdAt` — datetime

**FluidRateChange model (new, referenced but not defined in PRD):**
- `fluidTherapy` — relation to FluidTherapy
- `oldRate` — string
- `newRate` — string
- `changedAt` — datetime
- `changedBy` — relation to Staff
- `reason` — text, optional

### Changes from PRD

- **Admission.condition**: Doctor-only to update. PRD line 109 ("Updated by any staff member") is overridden — confirmed doctor-only.
- **Soft deletes**: `deletedAt` (nullable datetime) added to Patient, Admission, TreatmentPlan, DietPlan. Medical records are never hard-deleted.
- **All records**: Include `createdAt` and `updatedAt` timestamps via Prisma `@default(now())` and `@updatedAt`.

### Indexes

As specified in PRD (line 564):
- `(admissionId, isActive)` on TreatmentPlan
- `(admissionId, recordedAt)` on VitalRecord, ClinicalNote
- `(scheduledDate)` on MedicationAdministration
- `(ward, status)` on Admission
- `(phone)` unique on Staff
- `(token)` unique on Session

### Cage Uniqueness

Enforced at the application layer in the Server Action (query for existing ACTIVE admission with the same cage number before assigning). Prisma doesn't support partial unique constraints natively — use a check-then-create within a transaction.

---

## Access Control

### Two-Tier Model

**Doctor-only actions (clinical setup):**
- Complete clinical setup (Step 2 of admission)
- Create / modify / stop treatment plans
- Create / modify diet plans
- Start / modify / stop fluid therapy
- Set up isolation protocol
- Order labs
- Change patient condition
- Transfer ward
- Discharge patient

**All authenticated users (any role):**
- Register a new patient (Step 1)
- Record vitals
- Mark medications as administered or skipped
- Log feeding status
- Write clinical notes
- Log baths
- Log disinfection
- Upload photos/files
- View all data

### Enforcement

- Server Actions for doctor-only operations check `role === 'DOCTOR'` from the session. Throw a 403 error if not.
- UI hides doctor-only buttons/forms for non-doctor roles using the session role.
- All daily execution actions have no role check beyond "is authenticated."

---

## UI Design Decisions

### Theme & Styling

- **Light theme** — white card surfaces, subtle shadows, `#f8fafc` background.
- **Accent**: Teal (`#0d9488`) for general ward and primary actions.
- **Danger**: Red (`#dc2626`) for critical status, overdue items, isolation ward.
- **Warning**: Amber (`#d97706`) for guarded status, pending items.
- **Success**: Green (`#16a34a`) for stable/improving, completed items.
- **Typography**: System font stack (Geist Sans when available).
- **Component library**: shadcn/ui with Tailwind CSS.

### Navigation

- **Mobile**: Bottom nav bar with 4 tabs — Home (dashboard), Schedule, Isolation, Profile.
- **Desktop**: Same tabs as sidebar.
- **FAB** (Floating Action Button): Teal "+" button on mobile dashboard. Opens quick actions: Admit New Patient, Quick Vitals Entry, Quick Med Checkoff.

### Patient Detail Page

- **Header**: Compact — patient photo, name, breed/age/sex/weight, status badges (condition + ward + cage), diagnosis, attending doctor, days admitted.
- **Tabs**: Material-style underline tabs, horizontally scrollable. Tabs: Vitals | Meds | Food | Notes | Labs | Bath | Isolation (only if isolation ward).
- **Vitals tab**: Key-value list (not grid). Abnormal values highlighted red. 48h trend chart placeholder (Phase 3). "Record Vitals" button at bottom.
- **Meds tab**: Time-grouped checklist (see below). Active fluid therapy card at top if applicable.
- **Food tab**: Feeding schedule as checklist. Tap to open bottom sheet with status buttons (Eaten/Partial/Refused) + notes.
- **Notes tab**: Timeline view, newest first. Category badges, author name color-coded by role.
- **Labs tab**: List view, newest first. Expandable for full result.
- **Bath tab**: Last bath info, days since bath, due indicator, "Log Bath" one-tap button, history.
- **Isolation tab**: Biosecurity protocol card (red), PCR tracking timeline, disinfection log, clearance status.
- **Doctor-only actions**: At bottom of page, hidden for non-doctors. Update Condition, Transfer Ward, Discharge.

### Medication Checkoff Pattern

**Time-grouped checklist** — meds grouped by scheduled hour across the day:

- Each time block header shows the hour and status (Completed / Pending / Upcoming / OVERDUE).
- Each med within a block shows: checkbox, drug name, dose, route.
- **Completed**: Green background, checkmark, "Given by [name] at [time]".
- **Pending (current hour)**: White background, empty checkbox. Tap checkbox = mark as given (stamps current user + time).
- **Upcoming (future)**: Dimmed/grey. Non-interactive until within the hour.
- **Overdue (past + not done)**: Red background, exclamation icon. "35 min overdue — tap to give or skip."
- **Skip flow**: Tap the med row (not checkbox) → bottom sheet with skip reason (required text or common presets: "Patient vomiting", "Refused oral medication").

This same time-grouped pattern is reused on the Daily Schedule page across all patients.

### Dashboard

- **Top**: Summary cards row — Total IPD, Critical count, Meds Due, Upcoming Feedings (next 2 hrs), Baths Due.
- **Alert banner**: Persistent red alert if isolation ward has active patients (disease name, PPE instructions, "Handle LAST").
- **Pending Clinical Setup**: Amber section for REGISTERED patients awaiting doctor. Shows patient name, breed, age, weight, who registered, when. "Complete Setup" button visible only to doctors.
- **Patient list**: Grouped by ward (General first, Isolation second). Cards show: name, breed, cage, condition badge, ward badge, bath-due badge, diagnosis, latest vitals snapshot (red if abnormal), next pending med, attending doctor.
- **Ward filter**: Pill tabs — All | General | Isolation.
- **Critical patients**: Sorted to top, red border on card.

### Two-Step Intake

**`/patients/new`**:
- All roles see: Registration form (name, species, breed, age, weight, sex, color, photo, stray toggle, rescue location, rescuer info).
- Doctors additionally see: Clinical setup section below (diagnosis, chief complaint, notes, ward, cage, condition, attending doctor, initial meds/diet/fluids/isolation protocol). Appears as an expandable section or inline continuation.
- Non-doctor submit → creates Patient + Admission with status=REGISTERED.
- Doctor submit (both sections) → creates Patient + Admission with status=ACTIVE + any initial treatment plans.
- Clinical setup can also be accessed from the dashboard "Pending Clinical Setup" section.

### Daily Schedule Page

Time-grouped checklist across ALL active patients. Each time block (06:00–23:00) shows:
- All meds due in that hour (with patient name + ward badge).
- All feedings due in that hour.
- Checkboxes to mark done inline.

**Bath due section**: Pinned at top, separate from hourly blocks. Lists all patients with bath due/overdue.

### Isolation Page

- Red-tinted header with biosecurity reminder (PPE checklist, "Handle LAST").
- List of isolation patients with expanded protocol info (disease, PCR status, latest vitals).
- Next disinfection due time. Overdue alert if late by 1+ hour.
- One-tap "Log Disinfection" button.

---

## Business Rules

| # | Rule | Detection | User-facing signal |
|---|------|-----------|-------------------|
| 1 | Cage uniqueness | Transaction check in Server Action before assigning | Error toast: "Cage G-03 is occupied by [patient]" |
| 2 | Isolation handling order | Always-visible banner on dashboard + isolation page | Red banner: "Handle isolation patients LAST in rotation" |
| 3 | Med overdue (30+ min) | Compare `scheduledTime` + 30min to current time, not yet administered | Red highlight in checklist + overdue count in dashboard summary |
| 4 | Disinfection overdue (1+ hr) | Compare last DisinfectionLog to protocol interval | Red alert on isolation page + patient isolation tab |
| 5 | Critical patients | `condition === 'CRITICAL'` | Red border, sorted to top of lists, red CRITICAL badge |
| 6 | Discharge requires | Form validation | Discharge notes required, condition must be RECOVERED or DECEASED |
| 7 | Vitals auto-flag | Thresholds in `vitals-thresholds.ts` (dog defaults: temp >39.5/<37.5, HR >140/<60, RR >35, pain >=5, CRT >2s) | Red text + "↑ HIGH" / "↓ LOW" label next to abnormal values |
| 8 | Feeding refusal (2+ consecutive) | Query last 2 FeedingLogs for same schedule, both REFUSED | Yellow alert badge on patient dashboard card |
| 9 | Weight drop >5% | Compare latest weight to admission weight | Alert badge on patient card (Phase 3 for detailed trend) |
| 10 | Bath reminder (5 days) | Compute from last BathLog or admission date | Orange "Bath due" badge on card + schedule page. Red if 1+ day overdue |

---

## PWA Configuration

- **Manifest** (`src/app/manifest.ts`): App name "Always Care IPD", short name "IPD", theme color `#0d9488`, background color `#f8fafc`, display `standalone`, icons (192px, 512px).
- **Service Worker** (`@serwist/next`): Cache static assets (JS, CSS, fonts, images) with cache-first strategy. API calls use network-first (no offline data). App shell cached for fast subsequent loads.
- **Install prompt**: Show "Add to Home Screen" banner on first few visits.

---

## Environment Variables

```
DATABASE_URL="postgresql://..."            # Neon pooled connection
DIRECT_URL="postgresql://..."              # Neon direct connection (migrations)
SESSION_SECRET="..."                       # 32+ char random secret for cookie encryption
GOOGLE_DRIVE_FOLDER_ID="..."              # Shared Google Drive folder for uploads
GOOGLE_SERVICE_ACCOUNT_KEY="..."          # Google service account JSON (base64 encoded)
INTERAKT_API_KEY="..."                    # WhatsApp notifications (Phase 3)
WHATSAPP_GROUP_NUMBERS="..."              # Alert recipients (Phase 3)
```

---

## Phase 1 Scope — Explicit Inclusions

1. Auth (phone + password login, session management)
2. Dashboard with ward overview, summary cards, alert banners, pending clinical setup
3. Two-step patient intake (register → clinical setup)
4. Patient detail page with all 7 tabs (Vitals, Meds, Food, Notes, Labs, Bath, Isolation)
5. Medication administration — time-grouped checklist with checkoff/skip
6. Vitals recording with abnormal value flagging
7. Feeding schedule + logging (Eaten/Partial/Refused)
8. Clinical notes (categorized, timestamped, any role)
9. Bath tracking with 5-day reminder badges
10. Isolation tab with biosecurity protocol, PCR tracking, disinfection logging
11. Fluid therapy management with rate changes
12. Lab results module
13. Discharge workflow
14. Daily schedule page (all tasks across all patients)
15. Isolation ward dedicated page
16. Google Drive integration for photo/report uploads
17. PWA (installable, asset caching)
18. Admin page (staff CRUD, cage configuration)

## Phase 1 Scope — Explicit Exclusions

- WhatsApp notifications via Interakt (Phase 3)
- Vitals trend charts with Recharts (Phase 3)
- Weight trend monitoring with alerts (Phase 3)
- Offline data entry
- Self-service password reset
- Reports / analytics
- Patient history across admissions (viewable but no dedicated UI)

---

## Timestamps & Localization

- All timestamps stored in UTC in the database.
- All timestamps displayed in IST (`Asia/Kolkata`).
- Time format: 24-hour (08:00, 14:00, 22:00).
- Date format: DD/MM/YYYY.

---

## Non-Functional Requirements

- **Performance**: Dashboard loads in <2 seconds with 20 active patients. Prisma `select` to limit payloads.
- **Reliability**: Transactional writes for multi-record operations (admission + treatment plans, discharge + status change).
- **Security**: All routes authenticated. Doctor-only enforcement at Server Action level. HTTP-only encrypted session cookie. No secrets in client code.
- **Audit trail**: Every record includes `createdBy` (Staff relation) and `createdAt`. No hard deletes — soft delete via `deletedAt`.
- **Mobile**: Touch targets minimum 44x44px. Minimal typing for routine actions. Bottom sheet for quick inputs.
