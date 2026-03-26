# Veterinary IPD Management System — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first PWA for managing inpatient animals at Always Care animal clinic — replacing paper treatment sheets with digital medication tracking, vitals recording, feeding logs, bath tracking, and isolation protocol management.

**Architecture:** Monolithic Next.js 16 App Router with Server Actions for all mutations. Prisma ORM with Neon Postgres. Custom phone+password auth with encrypted session cookies. Light theme, shadcn/ui components, bottom nav on mobile.

**Tech Stack:** Next.js 16, TypeScript, Prisma, Neon Postgres, Tailwind CSS, shadcn/ui, jose (JWT), bcrypt, @serwist/next (PWA)

**Design Spec:** `docs/superpowers/specs/2026-03-26-vet-ipd-phase1-design.md`
**Source PRD:** `VET-IPD-PRD.md`

---

## File Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx                # Login form — phone + password
│   ├── (app)/
│   │   ├── layout.tsx                  # Authenticated layout — bottom nav (mobile), sidebar (desktop)
│   │   ├── page.tsx                    # Dashboard — summary cards, alerts, patient list
│   │   ├── patients/
│   │   │   ├── new/
│   │   │   │   └── page.tsx            # Register patient (Step 1) + Clinical setup (Step 2, doctor-only)
│   │   │   └── [admissionId]/
│   │   │       └── page.tsx            # Patient detail — tabbed interface
│   │   ├── schedule/
│   │   │   └── page.tsx                # Daily schedule — time-grouped tasks across all patients
│   │   ├── isolation/
│   │   │   └── page.tsx                # Isolation ward — biosecurity + disinfection
│   │   ├── admin/
│   │   │   └── page.tsx                # Staff management + cage config
│   │   └── profile/
│   │       └── page.tsx                # Current user profile + logout
│   ├── api/
│   │   └── uploads/
│   │       └── route.ts                # Google Drive file upload (multipart)
│   ├── layout.tsx                      # Root layout — fonts, metadata, toast provider
│   └── manifest.ts                     # PWA web manifest
├── actions/
│   ├── auth.ts                         # login, logout
│   ├── admissions.ts                   # registerPatient, clinicalSetup, updateCondition, transferWard, discharge
│   ├── vitals.ts                       # recordVitals
│   ├── medications.ts                  # prescribeMedication, updateMedication, stopMedication, administerDose, skipDose
│   ├── feeding.ts                      # createDietPlan, updateDietPlan, logFeeding
│   ├── notes.ts                        # addNote
│   ├── baths.ts                        # logBath
│   ├── isolation.ts                    # createIsolationProtocol, updateIsolation, logDisinfection
│   ├── fluids.ts                       # startFluidTherapy, changeRate, stopFluids
│   ├── labs.ts                         # addLabResult
│   └── staff.ts                        # createStaff, updateStaff, deactivateStaff, resetPassword
├── lib/
│   ├── db.ts                           # Prisma client singleton
│   ├── auth.ts                         # Session create/verify/destroy, requireAuth, requireDoctor
│   ├── google-drive.ts                 # Upload file, create subfolder, get shareable link
│   ├── vitals-thresholds.ts            # isAbnormal() for each vital sign
│   ├── date-utils.ts                   # IST formatting, relative time, bath-due calculation
│   └── constants.ts                    # Enums, frequency→time mappings, medication route labels
├── components/
│   ├── ui/                             # shadcn/ui primitives (button, card, input, select, sheet, tabs, badge, dialog, toast, etc.)
│   ├── layout/
│   │   ├── bottom-nav.tsx              # Mobile bottom navigation (4 tabs)
│   │   ├── sidebar.tsx                 # Desktop sidebar navigation
│   │   ├── top-header.tsx              # Page title + user info
│   │   └── fab.tsx                     # Floating action button + quick action menu
│   ├── dashboard/
│   │   ├── summary-cards.tsx           # Total IPD, Critical, Meds Due, Feedings, Baths Due
│   │   ├── isolation-alert.tsx         # Red alert banner for isolation ward
│   │   ├── pending-setup.tsx           # Amber section for REGISTERED patients
│   │   ├── patient-card.tsx            # Individual patient card in the list
│   │   └── ward-filter.tsx             # All | General | Isolation pill tabs
│   ├── patient/
│   │   ├── patient-header.tsx          # Compact header with photo, name, badges, info
│   │   ├── tab-nav.tsx                 # Material-style underline tabs
│   │   ├── vitals-tab.tsx              # Vitals list + record form
│   │   ├── vitals-form.tsx             # Record vitals form (sheet/dialog)
│   │   ├── meds-tab.tsx                # Time-grouped medication checklist
│   │   ├── med-checkoff.tsx            # Single medication row with checkbox
│   │   ├── med-skip-sheet.tsx          # Bottom sheet for skip reason
│   │   ├── prescribe-med-form.tsx      # Prescribe new medication (doctor-only)
│   │   ├── fluid-card.tsx              # Active fluid therapy display + actions
│   │   ├── food-tab.tsx                # Diet plan + feeding checklist
│   │   ├── feeding-log-sheet.tsx       # Bottom sheet for logging feeding status
│   │   ├── notes-tab.tsx               # Clinical notes timeline
│   │   ├── note-form.tsx               # Add note form
│   │   ├── labs-tab.tsx                # Lab results list
│   │   ├── lab-form.tsx                # Add lab result form (doctor-only)
│   │   ├── bath-tab.tsx                # Bath info + history + log button
│   │   ├── isolation-tab.tsx           # Biosecurity + PCR + disinfection
│   │   ├── doctor-actions.tsx          # Condition, transfer, discharge buttons
│   │   └── discharge-form.tsx          # Discharge dialog with notes
│   ├── forms/
│   │   ├── registration-form.tsx       # Step 1: Patient registration fields
│   │   ├── clinical-setup-form.tsx     # Step 2: Clinical setup fields (doctor-only)
│   │   └── isolation-setup-form.tsx    # Isolation protocol fields (sub-form of clinical setup)
│   └── schedule/
│       ├── time-block.tsx              # Single hourly block with tasks
│       ├── schedule-med-row.tsx        # Med row in schedule (with patient name)
│       ├── schedule-feeding-row.tsx    # Feeding row in schedule
│       └── bath-due-section.tsx        # Bath due patients (pinned at top)
├── prisma/
│   ├── schema.prisma                   # Full database schema
│   └── seed.ts                         # Realistic seed data for development
└── proxy.ts                            # Auth proxy — redirect unauthenticated to /login
```

---

## Task 1: Project Scaffold & Dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `.env.local`, `.gitignore`, `src/app/layout.tsx`, `src/app/manifest.ts`

- [ ] **Step 1: Create Next.js 16 project**

```bash
cd "/Users/kaivan108icloud.com/Documents/IPD- management"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack
```

Select defaults when prompted. This creates the Next.js 16 scaffold with App Router and Turbopack.

- [ ] **Step 2: Install core dependencies**

```bash
npm install prisma @prisma/client bcryptjs jose date-fns
npm install -D @types/bcryptjs
```

- `prisma` + `@prisma/client`: ORM
- `bcryptjs`: Password hashing (pure JS, works everywhere)
- `jose`: JWT encrypt/decrypt for session cookies
- `date-fns`: Date formatting and arithmetic (IST, relative time)

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

Then install the components we'll need:

```bash
npx shadcn@latest add button card input label select sheet tabs badge dialog toast sonner separator avatar dropdown-menu switch textarea scroll-area
```

- [ ] **Step 4: Configure Tailwind with custom colors**

Edit `tailwind.config.ts` to add the clinic color tokens:

```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        clinic: {
          bg: "#f8fafc",
          teal: "#0d9488",
          "teal-light": "#f0fdf9",
          red: "#dc2626",
          "red-light": "#fef2f2",
          amber: "#d97706",
          "amber-light": "#fffbeb",
          green: "#16a34a",
          "green-light": "#f0fdf4",
          blue: "#2563eb",
          "blue-light": "#eff6ff",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

- [ ] **Step 5: Create .env.local template**

Create `.env.local`:

```env
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"
SESSION_SECRET="generate-a-32-char-random-string-here"
GOOGLE_DRIVE_FOLDER_ID=""
GOOGLE_SERVICE_ACCOUNT_KEY=""
```

Add to `.gitignore`:

```
.env*.local
.superpowers/
```

- [ ] **Step 6: Create PWA manifest**

Create `src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Always Care IPD",
    short_name: "IPD",
    description: "Inpatient Department Management for Always Care Animal Clinic",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0d9488",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```

Create placeholder icon files:

```bash
mkdir -p public/icons
```

Generate simple placeholder PNGs (replace with real icons later). For now create a simple SVG and convert:

Create `public/icons/icon-192.png` and `public/icons/icon-512.png` as placeholder files (solid teal square with "IPD" text — replace with actual clinic logo later).

- [ ] **Step 7: Update root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Always Care IPD",
  description: "Inpatient Department Management",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0d9488",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans bg-clinic-bg antialiased`}>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Verify scaffold runs**

```bash
npm run dev
```

Visit `http://localhost:3000`. Should see the Next.js default page. Kill the server.

- [ ] **Step 9: Commit**

```bash
git init
git add -A
git commit -m "feat: project scaffold — Next.js 16, Tailwind, shadcn/ui, PWA manifest"
```

---

## Task 2: Prisma Schema & Database

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Write the full Prisma schema**

Replace `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─── Enums ─────────────────────────────────────────

enum Species {
  DOG
  CAT
  BIRD
  OTHER
}

enum Sex {
  MALE
  FEMALE
  UNKNOWN
}

enum Ward {
  GENERAL
  ISOLATION
  ICU
}

enum AdmissionStatus {
  REGISTERED
  ACTIVE
  DISCHARGED
  DECEASED
  TRANSFERRED
}

enum Condition {
  CRITICAL
  GUARDED
  STABLE
  IMPROVING
  RECOVERED
}

enum MedRoute {
  PO
  IV
  SC
  IM
  TOPICAL
  NEBULIZER
  RECTAL
  OPHTHALMIC
  OTIC
  OTHER
}

enum Frequency {
  SID
  BID
  TID
  QID
  Q4H
  Q6H
  Q8H
  Q12H
  PRN
  STAT
  WEEKLY
  OTHER
}

enum FeedingStatus {
  PENDING
  EATEN
  PARTIAL
  REFUSED
  SKIPPED
}

enum NoteCategory {
  OBSERVATION
  BEHAVIOR
  WOUND_CARE
  ELIMINATION
  PROCEDURE
  DOCTOR_ROUND
  SHIFT_HANDOVER
  OTHER
}

enum LabTestType {
  CBC
  BLOOD_CHEMISTRY
  PCR
  URINALYSIS
  FECAL_EXAM
  XRAY
  ULTRASOUND
  SEROLOGY
  SKIN_SCRAPING
  OTHER
}

enum StaffRole {
  DOCTOR
  PARAVET
  ATTENDANT
  ADMIN
}

// ─── Models ────────────────────────────────────────

model Staff {
  id           String    @id @default(cuid())
  name         String
  phone        String    @unique
  passwordHash String
  role         StaffRole
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  sessions                Session[]
  admissionsAdmitted      Admission[]              @relation("admittedBy")
  admissionsDischarged    Admission[]              @relation("dischargedBy")
  vitalRecords            VitalRecord[]
  medAdministrations      MedicationAdministration[]
  feedingLogs             FeedingLog[]
  clinicalNotes           ClinicalNote[]
  bathLogs                BathLog[]
  disinfectionLogs        DisinfectionLog[]
  fluidRateChanges        FluidRateChange[]
  treatmentPlansCreated   TreatmentPlan[]          @relation("createdByStaff")
  dietPlansCreated        DietPlan[]               @relation("createdByStaff")
  fluidTherapiesCreated   FluidTherapy[]           @relation("createdByStaff")
  labResultsCreated       LabResult[]
  isolationProtocolsCreated IsolationProtocol[]     @relation("createdByStaff")
}

model Session {
  id        String   @id @default(cuid())
  staffId   String
  staff     Staff    @relation(fields: [staffId], references: [id])
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([staffId])
}

model Patient {
  id             String    @id @default(cuid())
  name           String
  species        Species   @default(DOG)
  breed          String?
  age            String?
  weight         Float?
  sex            Sex       @default(UNKNOWN)
  color          String?
  microchipId    String?
  photoUrl       String?
  isStray        Boolean   @default(true)
  rescueLocation String?
  rescuerInfo    String?
  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  admissions Admission[]
}

model Admission {
  id              String          @id @default(cuid())
  patientId       String
  patient         Patient         @relation(fields: [patientId], references: [id])
  admissionDate   DateTime        @default(now())
  dischargeDate   DateTime?
  ward            Ward?
  cageNumber      String?
  status          AdmissionStatus @default(REGISTERED)
  condition       Condition?
  diagnosis       String?
  diagnosisNotes  String?
  chiefComplaint  String?
  admittedById    String
  admittedBy      Staff           @relation("admittedBy", fields: [admittedById], references: [id])
  attendingDoctor String?
  dischargedById  String?
  dischargedBy    Staff?          @relation("dischargedBy", fields: [dischargedById], references: [id])
  dischargeNotes  String?
  deletedAt       DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  treatmentPlans    TreatmentPlan[]
  vitalRecords      VitalRecord[]
  fluidTherapies    FluidTherapy[]
  dietPlans         DietPlan[]
  clinicalNotes     ClinicalNote[]
  bathLogs          BathLog[]
  labResults        LabResult[]
  isolationProtocol IsolationProtocol?

  @@index([ward, status])
  @@index([patientId])
  @@index([status])
}

model TreatmentPlan {
  id             String    @id @default(cuid())
  admissionId    String
  admission      Admission @relation(fields: [admissionId], references: [id])
  drugName       String
  dose           String
  calculatedDose String?
  route          MedRoute
  frequency      Frequency
  scheduledTimes String[]
  startDate      DateTime  @default(now())
  endDate        DateTime?
  isActive       Boolean   @default(true)
  notes          String?
  createdById    String
  createdBy      Staff     @relation("createdByStaff", fields: [createdById], references: [id])
  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  administrations MedicationAdministration[]

  @@index([admissionId, isActive])
}

model MedicationAdministration {
  id              String        @id @default(cuid())
  treatmentPlanId String
  treatmentPlan   TreatmentPlan @relation(fields: [treatmentPlanId], references: [id])
  scheduledDate   DateTime      @db.Date
  scheduledTime   String
  wasAdministered Boolean       @default(false)
  actualTime      DateTime?
  wasSkipped      Boolean       @default(false)
  skipReason      String?
  administeredById String?
  administeredBy   Staff?       @relation(fields: [administeredById], references: [id])
  notes           String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@unique([treatmentPlanId, scheduledDate, scheduledTime])
  @@index([scheduledDate])
  @@index([treatmentPlanId])
}

model VitalRecord {
  id                   String   @id @default(cuid())
  admissionId          String
  admission            Admission @relation(fields: [admissionId], references: [id])
  recordedAt           DateTime @default(now())
  temperature          Float?
  heartRate            Int?
  respRate             Int?
  painScore            Int?
  weight               Float?
  bloodPressure        String?
  spo2                 Float?
  capillaryRefillTime  Float?
  mucousMembraneColor  String?
  notes                String?
  recordedById         String
  recordedBy           Staff    @relation(fields: [recordedById], references: [id])
  createdAt            DateTime @default(now())

  @@index([admissionId, recordedAt])
}

model FluidTherapy {
  id          String    @id @default(cuid())
  admissionId String
  admission   Admission @relation(fields: [admissionId], references: [id])
  fluidType   String
  rate        String
  additives   String?
  startTime   DateTime  @default(now())
  endTime     DateTime?
  isActive    Boolean   @default(true)
  notes       String?
  createdById String
  createdBy   Staff     @relation("createdByStaff", fields: [createdById], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  rateChanges FluidRateChange[]

  @@index([admissionId, isActive])
}

model FluidRateChange {
  id              String       @id @default(cuid())
  fluidTherapyId  String
  fluidTherapy    FluidTherapy @relation(fields: [fluidTherapyId], references: [id])
  oldRate         String
  newRate         String
  changedAt       DateTime     @default(now())
  changedById     String
  changedBy       Staff        @relation(fields: [changedById], references: [id])
  reason          String?
}

model DietPlan {
  id           String    @id @default(cuid())
  admissionId  String
  admission    Admission @relation(fields: [admissionId], references: [id])
  dietType     String
  instructions String?
  isActive     Boolean   @default(true)
  createdById  String
  createdBy    Staff     @relation("createdByStaff", fields: [createdById], references: [id])
  deletedAt    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  feedingSchedules FeedingSchedule[]

  @@index([admissionId, isActive])
}

model FeedingSchedule {
  id            String   @id @default(cuid())
  dietPlanId    String
  dietPlan      DietPlan @relation(fields: [dietPlanId], references: [id])
  scheduledTime String
  foodType      String
  portion       String
  createdAt     DateTime @default(now())

  feedingLogs FeedingLog[]
}

model FeedingLog {
  id                String         @id @default(cuid())
  feedingScheduleId String
  feedingSchedule   FeedingSchedule @relation(fields: [feedingScheduleId], references: [id])
  date              DateTime       @db.Date
  status            FeedingStatus  @default(PENDING)
  amountConsumed    String?
  notes             String?
  loggedById        String
  loggedBy          Staff          @relation(fields: [loggedById], references: [id])
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@unique([feedingScheduleId, date])
  @@index([date])
}

model ClinicalNote {
  id           String       @id @default(cuid())
  admissionId  String
  admission    Admission    @relation(fields: [admissionId], references: [id])
  category     NoteCategory
  content      String
  recordedAt   DateTime     @default(now())
  recordedById String
  recordedBy   Staff        @relation(fields: [recordedById], references: [id])
  createdAt    DateTime     @default(now())

  @@index([admissionId, recordedAt])
}

model BathLog {
  id          String    @id @default(cuid())
  admissionId String
  admission   Admission @relation(fields: [admissionId], references: [id])
  bathedAt    DateTime  @default(now())
  bathedById  String
  bathedBy    Staff     @relation(fields: [bathedById], references: [id])
  notes       String?
  createdAt   DateTime  @default(now())

  @@index([admissionId, bathedAt])
}

model LabResult {
  id           String      @id @default(cuid())
  admissionId  String
  admission    Admission   @relation(fields: [admissionId], references: [id])
  testType     LabTestType
  testName     String
  result       String
  resultDate   DateTime    @default(now())
  isAbnormal   Boolean     @default(false)
  notes        String?
  reportUrl    String?
  createdById  String
  createdBy    Staff       @relation(fields: [createdById], references: [id])
  createdAt    DateTime    @default(now())

  @@index([admissionId])
}

model IsolationProtocol {
  id                    String    @id @default(cuid())
  admissionId           String    @unique
  admission             Admission @relation(fields: [admissionId], references: [id])
  disease               String
  pcrStatus             String    @default("Pending")
  lastPcrDate           DateTime?
  pcrTrend              String?
  ppeRequired           String[]
  disinfectant          String    @default("Quaternary ammonium compound")
  disinfectionInterval  String    @default("Q4H")
  biosecurityNotes      String?
  isCleared             Boolean   @default(false)
  clearedDate           DateTime?
  createdById           String
  createdBy             Staff     @relation("createdByStaff", fields: [createdById], references: [id])
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  disinfectionLogs DisinfectionLog[]
}

model DisinfectionLog {
  id                  String            @id @default(cuid())
  isolationProtocolId String
  isolationProtocol   IsolationProtocol @relation(fields: [isolationProtocolId], references: [id])
  performedAt         DateTime          @default(now())
  performedById       String
  performedBy         Staff             @relation(fields: [performedById], references: [id])
  notes               String?
  createdAt           DateTime          @default(now())
}

model CageConfig {
  id       String @id @default(cuid())
  ward     Ward
  cageNumber String
  isActive Boolean @default(true)
  createdAt DateTime @default(now())

  @@unique([ward, cageNumber])
}
```

- [ ] **Step 3: Create Prisma client singleton**

Create `src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 4: Push schema to database**

Make sure your Neon database is running and `DATABASE_URL` / `DIRECT_URL` are set in `.env.local`:

```bash
npx prisma db push
```

Expected: Schema synced successfully.

- [ ] **Step 5: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 6: Verify with Prisma Studio**

```bash
npx prisma studio
```

Opens browser at `localhost:5555`. All tables should be visible and empty. Close it.

- [ ] **Step 7: Commit**

```bash
git add prisma/ src/lib/db.ts
git commit -m "feat: Prisma schema — all 16 models with enums, indexes, relations"
```

---

## Task 3: Auth System

**Files:**
- Create: `src/lib/auth.ts`, `src/actions/auth.ts`, `src/proxy.ts`, `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create auth library**

Create `src/lib/auth.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const COOKIE_NAME = "ipd-session";

export async function createSession(staffId: string, role: string) {
  const session = await db.session.create({
    data: {
      staffId,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });

  const token = await new SignJWT({ sid: session.id, uid: staffId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return session;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const session = await db.session.findUnique({
      where: { id: payload.sid as string },
      include: { staff: { select: { id: true, name: true, role: true, isActive: true } } },
    });

    if (!session || session.expiresAt < new Date() || !session.staff.isActive) {
      return null;
    }

    return {
      sessionId: session.id,
      staffId: session.staff.id,
      name: session.staff.name,
      role: session.staff.role,
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      await db.session.delete({ where: { id: payload.sid as string } }).catch(() => {});
    } catch {
      // Token invalid — just clear the cookie
    }
  }

  cookieStore.delete(COOKIE_NAME);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireDoctor() {
  const session = await requireAuth();
  if (session.role !== "DOCTOR") throw new Error("Forbidden: Doctor only");
  return session;
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Create auth actions**

Create `src/actions/auth.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";

export async function login(formData: FormData) {
  const phone = formData.get("phone") as string;
  const password = formData.get("password") as string;

  if (!phone || !password) {
    return { error: "Phone and password are required" };
  }

  const staff = await db.staff.findUnique({ where: { phone } });
  if (!staff || !staff.isActive) {
    return { error: "Invalid phone number or password" };
  }

  const valid = await bcrypt.compare(password, staff.passwordHash);
  if (!valid) {
    return { error: "Invalid phone number or password" };
  }

  await createSession(staff.id, staff.role);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
```

- [ ] **Step 3: Create proxy.ts**

Create `src/proxy.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets and API routes for uploads
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("ipd-session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("ipd-session");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons).*)"],
};
```

- [ ] **Step 4: Create login page**

Create `src/app/(auth)/login/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-clinic-bg p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-clinic-teal">
            Always Care IPD
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in to continue
          </p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {state?.error && (
              <div className="rounded-md bg-clinic-red-light border border-red-200 p-3 text-sm text-clinic-red">
                {state.error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="9876543210"
                required
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="h-12 text-base"
              />
            </div>
            <Button
              type="submit"
              disabled={pending}
              className="w-full h-12 text-base bg-clinic-teal hover:bg-clinic-teal/90"
            >
              {pending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Create auth layout (no nav)**

Create `src/app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 6: Create a seed admin user for testing**

Create `prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  // Create admin user
  await prisma.staff.upsert({
    where: { phone: "9999999999" },
    update: {},
    create: {
      name: "Admin",
      phone: "9999999999",
      passwordHash,
      role: "ADMIN",
    },
  });

  // Create a doctor
  await prisma.staff.upsert({
    where: { phone: "9999999001" },
    update: {},
    create: {
      name: "Dr. Shah",
      phone: "9999999001",
      passwordHash: await bcrypt.hash("doctor123", 10),
      role: "DOCTOR",
    },
  });

  // Create a paravet
  await prisma.staff.upsert({
    where: { phone: "9999999002" },
    update: {},
    create: {
      name: "Ravi (Paravet)",
      phone: "9999999002",
      passwordHash: await bcrypt.hash("paravet123", 10),
      role: "PARAVET",
    },
  });

  // Create an attendant
  await prisma.staff.upsert({
    where: { phone: "9999999003" },
    update: {},
    create: {
      name: "Priya (Attendant)",
      phone: "9999999003",
      passwordHash: await bcrypt.hash("attendant123", 10),
      role: "ATTENDANT",
    },
  });

  // Create default cage configurations
  const generalCages = ["G-01", "G-02", "G-03", "G-04", "G-05", "G-06", "G-07", "G-08"];
  const isoCages = ["ISO-01", "ISO-02", "ISO-03", "ISO-04"];
  const icuCages = ["ICU-01", "ICU-02"];

  for (const cage of generalCages) {
    await prisma.cageConfig.upsert({
      where: { ward_cageNumber: { ward: "GENERAL", cageNumber: cage } },
      update: {},
      create: { ward: "GENERAL", cageNumber: cage },
    });
  }
  for (const cage of isoCages) {
    await prisma.cageConfig.upsert({
      where: { ward_cageNumber: { ward: "ISOLATION", cageNumber: cage } },
      update: {},
      create: { ward: "ISOLATION", cageNumber: cage },
    });
  }
  for (const cage of icuCages) {
    await prisma.cageConfig.upsert({
      where: { ward_cageNumber: { ward: "ICU", cageNumber: cage } },
      update: {},
      create: { ward: "ICU", cageNumber: cage },
    });
  }

  console.log("Seed complete: 4 staff + 14 cages created");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
```

Add to `package.json`:

```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

Install tsx if not present:

```bash
npm install -D tsx
```

Run the seed:

```bash
npx prisma db seed
```

Expected: "Seed complete: 4 staff + 14 cages created"

- [ ] **Step 7: Test login flow**

```bash
npm run dev
```

1. Visit `http://localhost:3000` — should redirect to `/login`
2. Enter phone `9999999001`, password `doctor123` — should redirect to `/` (will be a blank page for now, that's fine)
3. Visit `/login` while logged in — should still show login (we haven't added redirect-if-authenticated yet)

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth.ts src/actions/auth.ts src/proxy.ts "src/app/(auth)" prisma/seed.ts package.json
git commit -m "feat: auth system — login, session management, proxy middleware, seed data"
```

---

## Task 4: App Layout & Navigation

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/components/layout/bottom-nav.tsx`, `src/components/layout/top-header.tsx`, `src/components/layout/fab.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/profile/page.tsx`

- [ ] **Step 1: Create bottom nav component**

Create `src/components/layout/bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, AlertTriangle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/schedule", icon: Calendar, label: "Schedule" },
  { href: "/isolation", icon: AlertTriangle, label: "Isolation" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden">
      <div className="flex justify-around items-center h-16 px-2 pb-safe">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[64px] py-1",
                isActive ? "text-clinic-teal" : "text-gray-400"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Create top header component**

Create `src/components/layout/top-header.tsx`:

```tsx
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export async function TopHeader({ title }: { title?: string }) {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 h-14">
        <h1 className="text-lg font-bold text-gray-900">
          {title || "Always Care IPD"}
        </h1>
        {session && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden sm:inline">{session.name}</span>
            <Badge
              variant="outline"
              className="text-[10px] capitalize"
            >
              {session.role.toLowerCase()}
            </Badge>
          </div>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create FAB component**

Create `src/components/layout/fab.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Plus, X, UserPlus, Heart, Pill } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { href: "/patients/new", icon: UserPlus, label: "Admit Patient" },
  { href: "/schedule", icon: Pill, label: "Med Checkoff" },
];

export function FAB() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-20 right-4 z-50 md:hidden flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col gap-2 mb-2">
          {ACTIONS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 bg-white rounded-full pl-3 pr-4 py-2 shadow-lg border border-gray-200"
            >
              <Icon className="h-4 w-4 text-clinic-teal" />
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </Link>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-all",
          open
            ? "bg-gray-700 rotate-45"
            : "bg-clinic-teal"
        )}
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <Plus className="h-6 w-6 text-white" />
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create app layout**

Create `src/app/(app)/layout.tsx`:

```tsx
import { TopHeader } from "@/components/layout/top-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { FAB } from "@/components/layout/fab";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-clinic-bg">
      <TopHeader />
      <main className="pb-20 md:pb-4">{children}</main>
      <FAB />
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 5: Create placeholder dashboard page**

Create `src/app/(app)/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div className="p-4">
      <p className="text-gray-500">Dashboard — coming in Task 9</p>
    </div>
  );
}
```

- [ ] **Step 6: Create profile page with logout**

Create `src/app/(app)/profile/page.tsx`:

```tsx
import { getSession } from "@/lib/auth";
import { logout } from "@/actions/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="p-4 max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Name</p>
            <p className="text-lg font-medium">{session.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Role</p>
            <Badge variant="outline" className="capitalize">
              {session.role.toLowerCase()}
            </Badge>
          </div>
          <form action={logout}>
            <Button variant="destructive" className="w-full">
              Sign Out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Install lucide-react icons**

```bash
npm install lucide-react
```

- [ ] **Step 8: Test navigation**

```bash
npm run dev
```

1. Log in with `9999999001` / `doctor123`
2. Should see dashboard with top header (name + role badge) and bottom nav
3. Tap through bottom nav tabs — Home, Schedule, Isolation, Profile
4. Profile should show name, role, and logout button
5. FAB "+" button should expand with action options
6. Tap "Sign Out" — should redirect to `/login`

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)" src/components/layout/
git commit -m "feat: app layout — bottom nav, top header, FAB, profile page"
```

---

## Task 5: Utility Libraries

**Files:**
- Create: `src/lib/constants.ts`, `src/lib/vitals-thresholds.ts`, `src/lib/date-utils.ts`

- [ ] **Step 1: Create constants**

Create `src/lib/constants.ts`:

```ts
export const FREQUENCY_LABELS: Record<string, string> = {
  SID: "Once daily",
  BID: "Twice daily",
  TID: "Three times daily",
  QID: "Four times daily",
  Q4H: "Every 4 hours",
  Q6H: "Every 6 hours",
  Q8H: "Every 8 hours",
  Q12H: "Every 12 hours",
  PRN: "As needed",
  STAT: "One-time",
  WEEKLY: "Weekly",
  OTHER: "Other",
};

export const FREQUENCY_DEFAULT_TIMES: Record<string, string[]> = {
  SID: ["08:00"],
  BID: ["08:00", "20:00"],
  TID: ["08:00", "14:00", "22:00"],
  QID: ["06:00", "12:00", "18:00", "00:00"],
  Q4H: ["06:00", "10:00", "14:00", "18:00", "22:00", "02:00"],
  Q6H: ["06:00", "12:00", "18:00", "00:00"],
  Q8H: ["06:00", "14:00", "22:00"],
  Q12H: ["08:00", "20:00"],
  STAT: [],
  PRN: [],
  WEEKLY: ["08:00"],
  OTHER: [],
};

export const ROUTE_LABELS: Record<string, string> = {
  PO: "Oral (PO)",
  IV: "Intravenous (IV)",
  SC: "Subcutaneous (SC)",
  IM: "Intramuscular (IM)",
  TOPICAL: "Topical",
  NEBULIZER: "Nebulizer",
  RECTAL: "Rectal",
  OPHTHALMIC: "Ophthalmic",
  OTIC: "Otic (Ear)",
  OTHER: "Other",
};

export const CONDITION_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CRITICAL: { label: "Critical", color: "text-clinic-red", bg: "bg-clinic-red-light", border: "border-red-200" },
  GUARDED: { label: "Guarded", color: "text-clinic-amber", bg: "bg-clinic-amber-light", border: "border-amber-200" },
  STABLE: { label: "Stable", color: "text-clinic-green", bg: "bg-clinic-green-light", border: "border-green-200" },
  IMPROVING: { label: "Improving", color: "text-clinic-blue", bg: "bg-clinic-blue-light", border: "border-blue-200" },
  RECOVERED: { label: "Recovered", color: "text-clinic-green", bg: "bg-clinic-green-light", border: "border-green-200" },
};

export const WARD_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  GENERAL: { label: "General", color: "text-clinic-teal", bg: "bg-clinic-teal-light" },
  ISOLATION: { label: "Isolation", color: "text-clinic-red", bg: "bg-clinic-red-light" },
  ICU: { label: "ICU", color: "text-clinic-amber", bg: "bg-clinic-amber-light" },
};

export const NOTE_CATEGORY_LABELS: Record<string, string> = {
  OBSERVATION: "Observation",
  BEHAVIOR: "Behavior",
  WOUND_CARE: "Wound Care",
  ELIMINATION: "Elimination",
  PROCEDURE: "Procedure",
  DOCTOR_ROUND: "Doctor Round",
  SHIFT_HANDOVER: "Shift Handover",
  OTHER: "Other",
};

export const NOTE_ROLE_COLORS: Record<string, string> = {
  DOCTOR: "text-purple-600",
  PARAVET: "text-clinic-teal",
  ATTENDANT: "text-gray-500",
  ADMIN: "text-gray-500",
};

export const COMMON_SKIP_REASONS = [
  "Patient vomiting",
  "Refused oral medication",
  "NPO — nothing by mouth",
  "Medication not available",
  "Doctor advised to hold",
];

export const COMMON_DRUGS = [
  "Ceftriaxone",
  "Meloxicam",
  "Pantoprazole",
  "Ondansetron",
  "Metronidazole",
  "Amoxicillin-Clavulanate",
  "Doxycycline",
  "Tramadol",
  "Nebulization (Salbutamol + NS)",
  "Vitamin B Complex",
  "Iron supplement",
  "Ivermectin",
];

export const PPE_OPTIONS = [
  "Gloves",
  "Gown",
  "Shoe covers",
  "Face mask",
  "Eye protection",
  "Hand sanitize on exit",
];

export const DISINFECTION_INTERVALS = [
  { value: "Q2H", label: "Every 2 hours" },
  { value: "Q4H", label: "Every 4 hours" },
  { value: "Q6H", label: "Every 6 hours" },
  { value: "Q8H", label: "Every 8 hours" },
  { value: "Q12H", label: "Every 12 hours" },
];

export const BATH_DUE_DAYS = 5;
```

- [ ] **Step 2: Create vitals thresholds**

Create `src/lib/vitals-thresholds.ts`:

```ts
export type VitalFlag = {
  isAbnormal: boolean;
  label: string; // "Normal", "↑ HIGH", "↓ LOW"
};

export function checkTemperature(value: number | null | undefined): VitalFlag {
  if (value == null) return { isAbnormal: false, label: "" };
  if (value > 39.5) return { isAbnormal: true, label: "↑ HIGH" };
  if (value < 37.5) return { isAbnormal: true, label: "↓ LOW" };
  return { isAbnormal: false, label: "Normal" };
}

export function checkHeartRate(value: number | null | undefined): VitalFlag {
  if (value == null) return { isAbnormal: false, label: "" };
  if (value > 140) return { isAbnormal: true, label: "↑ HIGH" };
  if (value < 60) return { isAbnormal: true, label: "↓ LOW" };
  return { isAbnormal: false, label: "Normal" };
}

export function checkRespRate(value: number | null | undefined): VitalFlag {
  if (value == null) return { isAbnormal: false, label: "" };
  if (value > 35) return { isAbnormal: true, label: "↑ HIGH" };
  return { isAbnormal: false, label: "Normal" };
}

export function checkPainScore(value: number | null | undefined): VitalFlag {
  if (value == null) return { isAbnormal: false, label: "" };
  if (value >= 5) return { isAbnormal: true, label: "↑ HIGH" };
  return { isAbnormal: false, label: "Normal" };
}

export function checkCRT(value: number | null | undefined): VitalFlag {
  if (value == null) return { isAbnormal: false, label: "" };
  if (value > 2) return { isAbnormal: true, label: "↑ SLOW" };
  return { isAbnormal: false, label: "Normal" };
}

export function hasAnyAbnormalVital(vitals: {
  temperature?: number | null;
  heartRate?: number | null;
  respRate?: number | null;
  painScore?: number | null;
  capillaryRefillTime?: number | null;
}): boolean {
  return (
    checkTemperature(vitals.temperature).isAbnormal ||
    checkHeartRate(vitals.heartRate).isAbnormal ||
    checkRespRate(vitals.respRate).isAbnormal ||
    checkPainScore(vitals.painScore).isAbnormal ||
    checkCRT(vitals.capillaryRefillTime).isAbnormal
  );
}
```

- [ ] **Step 3: Create date utils**

Create `src/lib/date-utils.ts`:

```ts
import { format, formatDistanceToNow, differenceInDays, differenceInMinutes } from "date-fns";

const IST_OFFSET = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30

export function toIST(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET);
}

export function formatIST(date: Date, formatStr: string = "dd/MM/yyyy"): string {
  return format(toIST(date), formatStr);
}

export function formatTimeIST(date: Date): string {
  return format(toIST(date), "HH:mm");
}

export function formatDateTimeIST(date: Date): string {
  return format(toIST(date), "dd/MM/yyyy HH:mm");
}

export function formatRelative(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

export function daysSince(date: Date): number {
  return differenceInDays(new Date(), date);
}

export function minutesSince(date: Date): number {
  return differenceInMinutes(new Date(), date);
}

export function isBathDue(lastBathOrAdmission: Date, dueDays: number = 5): {
  isDue: boolean;
  isOverdue: boolean;
  daysSinceLast: number;
} {
  const days = daysSince(lastBathOrAdmission);
  return {
    isDue: days >= dueDays,
    isOverdue: days > dueDays,
    daysSinceLast: days,
  };
}

export function getTodayIST(): string {
  return format(toIST(new Date()), "yyyy-MM-dd");
}

export function isOverdueByMinutes(scheduledTime: string, minutes: number = 30): boolean {
  const now = toIST(new Date());
  const today = format(now, "yyyy-MM-dd");
  const scheduled = new Date(`${today}T${scheduledTime}:00`);
  return differenceInMinutes(now, scheduled) > minutes;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/lib/vitals-thresholds.ts src/lib/date-utils.ts
git commit -m "feat: utility libraries — constants, vitals thresholds, IST date formatting"
```

---

## Task 6: Admin Page (Staff CRUD + Cage Config)

**Files:**
- Create: `src/actions/staff.ts`, `src/app/(app)/admin/page.tsx`

- [ ] **Step 1: Create staff actions**

Create `src/actions/staff.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function createStaff(formData: FormData) {
  const session = await requireAuth();
  if (session.role !== "ADMIN" && session.role !== "DOCTOR") {
    return { error: "Only admins and doctors can manage staff" };
  }

  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;

  if (!name || !phone || !password || !role) {
    return { error: "All fields are required" };
  }

  const existing = await db.staff.findUnique({ where: { phone } });
  if (existing) {
    return { error: "Phone number already registered" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await db.staff.create({
    data: { name, phone, passwordHash, role: role as any },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function toggleStaffActive(staffId: string) {
  const session = await requireAuth();
  if (session.role !== "ADMIN" && session.role !== "DOCTOR") {
    return { error: "Unauthorized" };
  }

  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff) return { error: "Staff not found" };

  await db.staff.update({
    where: { id: staffId },
    data: { isActive: !staff.isActive },
  });

  // Invalidate sessions if deactivating
  if (staff.isActive) {
    await db.session.deleteMany({ where: { staffId } });
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function resetStaffPassword(staffId: string, newPassword: string) {
  const session = await requireAuth();
  if (session.role !== "ADMIN" && session.role !== "DOCTOR") {
    return { error: "Unauthorized" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.staff.update({
    where: { id: staffId },
    data: { passwordHash },
  });

  // Invalidate existing sessions so they must re-login
  await db.session.deleteMany({ where: { staffId } });

  revalidatePath("/admin");
  return { success: true };
}

export async function addCage(formData: FormData) {
  const session = await requireAuth();
  if (session.role !== "ADMIN" && session.role !== "DOCTOR") {
    return { error: "Unauthorized" };
  }

  const ward = formData.get("ward") as string;
  const cageNumber = formData.get("cageNumber") as string;

  if (!ward || !cageNumber) return { error: "Ward and cage number are required" };

  const existing = await db.cageConfig.findUnique({
    where: { ward_cageNumber: { ward: ward as any, cageNumber } },
  });
  if (existing) return { error: "Cage already exists" };

  await db.cageConfig.create({
    data: { ward: ward as any, cageNumber },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function toggleCageActive(cageId: string) {
  const session = await requireAuth();
  if (session.role !== "ADMIN" && session.role !== "DOCTOR") {
    return { error: "Unauthorized" };
  }

  const cage = await db.cageConfig.findUnique({ where: { id: cageId } });
  if (!cage) return { error: "Cage not found" };

  await db.cageConfig.update({
    where: { id: cageId },
    data: { isActive: !cage.isActive },
  });

  revalidatePath("/admin");
  return { success: true };
}
```

- [ ] **Step 2: Create admin page**

Create `src/app/(app)/admin/page.tsx`. This page should have two sections: Staff Management and Cage Configuration. It's a client component that uses the server actions above.

Build a tabbed interface with:
- **Staff tab**: Table of all staff (name, phone, role, active status). "Add Staff" button opens a dialog with name, phone, password, role fields. Each row has a toggle for active/deactivate and a "Reset Password" button.
- **Cage tab**: Table grouped by ward showing cage numbers and active status. "Add Cage" form with ward dropdown and cage number input.

Use shadcn/ui `Tabs`, `Table`, `Dialog`, `Select`, `Input`, `Button`, `Badge`, `Switch` components.

Access: Only show this page to ADMIN and DOCTOR roles. Show "Access Denied" for others.

- [ ] **Step 3: Test admin page**

```bash
npm run dev
```

1. Log in as admin (`9999999999` / `admin123`)
2. Navigate to `/admin`
3. Should see 4 staff members from seed data
4. Add a new staff member — verify it appears in the list
5. Toggle deactivate on a staff member
6. Check cage configuration tab — should show 14 cages from seed

- [ ] **Step 4: Commit**

```bash
git add src/actions/staff.ts "src/app/(app)/admin"
git commit -m "feat: admin page — staff CRUD, cage config, password reset"
```

---

## Task 7: Patient Registration (Step 1)

**Files:**
- Create: `src/actions/admissions.ts`, `src/components/forms/registration-form.tsx`, `src/app/(app)/patients/new/page.tsx`

- [ ] **Step 1: Create admissions actions (register patient)**

Create `src/actions/admissions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireDoctor } from "@/lib/auth";

export async function registerPatient(formData: FormData) {
  const session = await requireAuth();

  const name = formData.get("name") as string;
  const species = formData.get("species") as string || "DOG";
  const breed = formData.get("breed") as string || undefined;
  const age = formData.get("age") as string || undefined;
  const weightStr = formData.get("weight") as string;
  const weight = weightStr ? parseFloat(weightStr) : undefined;
  const sex = formData.get("sex") as string || "UNKNOWN";
  const color = formData.get("color") as string || undefined;
  const photoUrl = formData.get("photoUrl") as string || undefined;
  const isStray = formData.get("isStray") === "true";
  const rescueLocation = formData.get("rescueLocation") as string || undefined;
  const rescuerInfo = formData.get("rescuerInfo") as string || undefined;

  if (!name) return { error: "Patient name is required" };

  const result = await db.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: {
        name,
        species: species as any,
        breed,
        age,
        weight,
        sex: sex as any,
        color,
        photoUrl,
        isStray,
        rescueLocation,
        rescuerInfo,
      },
    });

    const admission = await tx.admission.create({
      data: {
        patientId: patient.id,
        admittedById: session.staffId,
        status: "REGISTERED",
      },
    });

    return { patientId: patient.id, admissionId: admission.id };
  });

  revalidatePath("/");
  return { success: true, admissionId: result.admissionId };
}
```

- [ ] **Step 2: Create registration form component**

Create `src/components/forms/registration-form.tsx`:

A client component form with fields matching the PRD Step 1:
- Name (required text input)
- Species (select dropdown: Dog/Cat/Bird/Other, default Dog)
- Breed (text input)
- Age (text input, placeholder "~3 years")
- Weight (number input, kg)
- Sex (select: Male/Female/Unknown)
- Color (text input)
- Photo upload (file input — stores photoUrl, Google Drive integration in Task 22, for now just a placeholder)
- Is Stray toggle (Switch component, default on)
- Rescue Location (text input, conditionally shown when stray=true)
- Rescuer Info (text input, conditionally shown when stray=true)

Uses `useActionState` with `registerPatient` action. On success, redirects to dashboard (non-doctor) or shows clinical setup (doctor). Show success toast.

- [ ] **Step 3: Create new patient page**

Create `src/app/(app)/patients/new/page.tsx`:

Server component that:
1. Gets current session via `getSession()`
2. Renders `<RegistrationForm />` with `isDoctor={session.role === "DOCTOR"}`
3. If doctor, also renders `<ClinicalSetupForm />` below (Task 8)

For now, just render the registration form. Clinical setup will be added in Task 8.

- [ ] **Step 4: Test patient registration**

```bash
npm run dev
```

1. Log in as paravet (`9999999002` / `paravet123`)
2. Navigate to `/patients/new`
3. Fill in: Name "Bruno", Species Dog, Breed "Labrador Mix", Age "~3 years", Weight 24.5, Sex Male, Is Stray on, Rescue Location "MG Road"
4. Submit — should see success, redirect to dashboard
5. Check Prisma Studio — Patient and Admission (status=REGISTERED) should exist

- [ ] **Step 5: Commit**

```bash
git add src/actions/admissions.ts src/components/forms/registration-form.tsx "src/app/(app)/patients"
git commit -m "feat: patient registration (Step 1) — any role can register patients"
```

---

## Task 8: Clinical Setup (Step 2)

**Files:**
- Create: `src/components/forms/clinical-setup-form.tsx`, `src/components/forms/isolation-setup-form.tsx`
- Modify: `src/actions/admissions.ts`, `src/app/(app)/patients/new/page.tsx`

- [ ] **Step 1: Add clinical setup action**

Add to `src/actions/admissions.ts`:

```ts
export async function clinicalSetup(admissionId: string, formData: FormData) {
  const session = await requireDoctor();

  const diagnosis = formData.get("diagnosis") as string;
  const chiefComplaint = formData.get("chiefComplaint") as string || undefined;
  const diagnosisNotes = formData.get("diagnosisNotes") as string || undefined;
  const ward = formData.get("ward") as string;
  const cageNumber = formData.get("cageNumber") as string;
  const condition = formData.get("condition") as string;
  const attendingDoctor = formData.get("attendingDoctor") as string;

  if (!diagnosis || !ward || !cageNumber || !condition || !attendingDoctor) {
    return { error: "All required fields must be filled" };
  }

  // Check cage uniqueness
  const existingCage = await db.admission.findFirst({
    where: {
      cageNumber,
      status: "ACTIVE",
      id: { not: admissionId },
    },
    include: { patient: { select: { name: true } } },
  });

  if (existingCage) {
    return { error: `Cage ${cageNumber} is occupied by ${existingCage.patient.name}` };
  }

  await db.$transaction(async (tx) => {
    // Update admission
    await tx.admission.update({
      where: { id: admissionId },
      data: {
        status: "ACTIVE",
        diagnosis,
        chiefComplaint,
        diagnosisNotes,
        ward: ward as any,
        cageNumber,
        condition: condition as any,
        attendingDoctor,
      },
    });

    // Parse and create initial medications if provided
    const medsJson = formData.get("medications") as string;
    if (medsJson) {
      const meds = JSON.parse(medsJson) as Array<{
        drugName: string; dose: string; route: string;
        frequency: string; scheduledTimes: string[]; notes?: string;
      }>;
      for (const med of meds) {
        await tx.treatmentPlan.create({
          data: {
            admissionId,
            drugName: med.drugName,
            dose: med.dose,
            route: med.route as any,
            frequency: med.frequency as any,
            scheduledTimes: med.scheduledTimes,
            notes: med.notes,
            createdById: session.staffId,
          },
        });
      }
    }

    // Create diet plan if provided
    const dietType = formData.get("dietType") as string;
    if (dietType) {
      const dietInstructions = formData.get("dietInstructions") as string;
      const feedingsJson = formData.get("feedingSchedules") as string;
      const dietPlan = await tx.dietPlan.create({
        data: {
          admissionId,
          dietType,
          instructions: dietInstructions,
          createdById: session.staffId,
        },
      });
      if (feedingsJson) {
        const feedings = JSON.parse(feedingsJson) as Array<{
          scheduledTime: string; foodType: string; portion: string;
        }>;
        for (const f of feedings) {
          await tx.feedingSchedule.create({
            data: {
              dietPlanId: dietPlan.id,
              scheduledTime: f.scheduledTime,
              foodType: f.foodType,
              portion: f.portion,
            },
          });
        }
      }
    }

    // Create fluid therapy if provided
    const fluidType = formData.get("fluidType") as string;
    if (fluidType) {
      await tx.fluidTherapy.create({
        data: {
          admissionId,
          fluidType,
          rate: formData.get("fluidRate") as string,
          additives: formData.get("fluidAdditives") as string || undefined,
          createdById: session.staffId,
        },
      });
    }

    // Create isolation protocol if ward is ISOLATION
    if (ward === "ISOLATION") {
      const disease = formData.get("disease") as string;
      if (disease) {
        const ppeJson = formData.get("ppeRequired") as string;
        await tx.isolationProtocol.create({
          data: {
            admissionId,
            disease,
            ppeRequired: ppeJson ? JSON.parse(ppeJson) : [],
            disinfectant: formData.get("disinfectant") as string || "Quaternary ammonium compound",
            disinfectionInterval: formData.get("disinfectionInterval") as string || "Q4H",
            biosecurityNotes: formData.get("biosecurityNotes") as string || undefined,
            createdById: session.staffId,
          },
        });
      }
    }

    // Create initial note if provided
    const initialNotes = formData.get("initialNotes") as string;
    if (initialNotes) {
      await tx.clinicalNote.create({
        data: {
          admissionId,
          category: "DOCTOR_ROUND",
          content: initialNotes,
          recordedById: session.staffId,
        },
      });
    }
  });

  revalidatePath("/");
  redirect(`/patients/${admissionId}`);
}
```

- [ ] **Step 2: Create clinical setup form component**

Create `src/components/forms/clinical-setup-form.tsx`:

Client component with:
- Diagnosis (required text)
- Chief complaint (text)
- Diagnosis notes (textarea)
- Ward (select: General/Isolation)
- Cage number (select — fetches available cages for selected ward via a separate query)
- Initial condition (select: Critical/Guarded/Stable)
- Attending doctor (select — fetches active doctors)
- **Optional initial treatment section** (collapsible):
  - Medications (repeatable group: drug name with autocomplete from COMMON_DRUGS, dose, route select, frequency select → auto-populates scheduled times, notes)
  - Fluid therapy (fluid type, rate, additives)
  - Diet plan (diet type, instructions, feeding schedules — repeatable: time, food type, portion)
  - Initial notes (textarea)
- If ward=ISOLATION, render isolation setup sub-form

Create `src/components/forms/isolation-setup-form.tsx`:
- Disease name (text)
- PPE required (multi-select checkboxes from PPE_OPTIONS)
- Disinfectant (text, default "Quaternary ammonium compound")
- Disinfection interval (select from DISINFECTION_INTERVALS)
- Biosecurity notes (textarea)

- [ ] **Step 3: Update new patient page for doctors**

Modify `src/app/(app)/patients/new/page.tsx` to:
- Show clinical setup form below registration form when user is a doctor
- Pass available cages and active doctors as props (fetched server-side)
- Handle the two-form flow: registration creates the admission, then clinical setup completes it

Also create a standalone clinical setup page route for completing setup from the dashboard:
Create `src/app/(app)/patients/[admissionId]/setup/page.tsx` that loads the admission data and shows only the clinical setup form.

- [ ] **Step 4: Test clinical setup**

1. Log in as doctor (`9999999001` / `doctor123`)
2. Navigate to `/patients/new` — should see both registration and clinical setup sections
3. Fill in registration + clinical setup with a medication and diet plan
4. Submit — should redirect to patient detail page
5. Log in as paravet — navigate to `/patients/new` — should only see registration section
6. Register a patient — should redirect to dashboard
7. On dashboard, verify the "Pending Clinical Setup" section shows the patient (this will be built in Task 9, for now check Prisma Studio)

- [ ] **Step 5: Commit**

```bash
git add src/actions/admissions.ts src/components/forms/ "src/app/(app)/patients"
git commit -m "feat: clinical setup (Step 2) — doctor-only admission completion with initial treatment"
```

---

## Task 9: Dashboard

**Files:**
- Create: `src/components/dashboard/summary-cards.tsx`, `src/components/dashboard/isolation-alert.tsx`, `src/components/dashboard/pending-setup.tsx`, `src/components/dashboard/patient-card.tsx`, `src/components/dashboard/ward-filter.tsx`
- Modify: `src/app/(app)/page.tsx`

- [ ] **Step 1: Build dashboard data query**

In `src/app/(app)/page.tsx`, build a server component that queries:

```ts
// Active admissions with patient info, latest vitals, today's pending meds, bath status
const admissions = await db.admission.findMany({
  where: {
    status: { in: ["ACTIVE", "REGISTERED"] },
    deletedAt: null,
  },
  include: {
    patient: true,
    admittedBy: { select: { name: true } },
    vitalRecords: {
      orderBy: { recordedAt: "desc" },
      take: 1,
      select: { temperature: true, heartRate: true, recordedAt: true },
    },
    treatmentPlans: {
      where: { isActive: true },
      include: {
        administrations: {
          where: { scheduledDate: today, wasAdministered: false, wasSkipped: false },
          select: { scheduledTime: true },
          orderBy: { scheduledTime: "asc" },
          take: 1,
        },
      },
    },
    bathLogs: {
      orderBy: { bathedAt: "desc" },
      take: 1,
      select: { bathedAt: true },
    },
    isolationProtocol: {
      select: { disease: true, ppeRequired: true },
    },
  },
  orderBy: [
    { condition: "asc" }, // CRITICAL first (alphabetically: CRITICAL < GUARDED < ...)
    { admissionDate: "desc" },
  ],
});
```

Then compute summary stats and pass to child components.

- [ ] **Step 2: Create summary cards component**

`src/components/dashboard/summary-cards.tsx`:

A row of 5 small cards:
- Total IPD (count of ACTIVE)
- Critical (count where condition=CRITICAL, red text)
- Meds Due (count of pending medication administrations today)
- Feedings (count of feedings in next 2 hours)
- Baths Due (count where bath is due per 5-day rule)

Use the Card component with compact padding, grid layout (5 columns on desktop, scroll on mobile).

- [ ] **Step 3: Create isolation alert banner**

`src/components/dashboard/isolation-alert.tsx`:

If any ACTIVE admission has ward=ISOLATION, show a red banner with:
- "ISOLATION WARD ACTIVE" header
- Disease name(s)
- PPE requirements
- "Handle isolation patients LAST in rotation"

Red background, white text, always visible.

- [ ] **Step 4: Create pending clinical setup section**

`src/components/dashboard/pending-setup.tsx`:

Amber/yellow section showing REGISTERED admissions. Each item shows:
- Patient name, breed, age, weight
- Registered by, when
- "Complete Setup" button (Link to `/patients/[admissionId]/setup`) — only visible to doctors

Props: `admissions` (filtered REGISTERED), `isDoctor` boolean.

- [ ] **Step 5: Create patient card component**

`src/components/dashboard/patient-card.tsx`:

Individual patient card for the list. Shows:
- Name, breed, age, weight
- Cage number
- Condition badge (using CONDITION_CONFIG colors)
- Ward badge (using WARD_CONFIG colors)
- Bath due badge (orange/red if due, using `isBathDue()`)
- Diagnosis (truncated to ~50 chars)
- Latest vitals: temp + HR, red text if abnormal (using `checkTemperature`, `checkHeartRate`)
- Next pending medication with time
- Attending doctor

Entire card is a Link to `/patients/[admissionId]`.
Critical patients get a red left border.

- [ ] **Step 6: Create ward filter component**

`src/components/dashboard/ward-filter.tsx`:

Client component with pill-style tabs: All | General | Isolation.
Uses URL search params or client state to filter.

- [ ] **Step 7: Assemble dashboard page**

Update `src/app/(app)/page.tsx` to render:
1. `<SummaryCards stats={...} />`
2. `<IsolationAlert admissions={isolationAdmissions} />` (if any)
3. `<PendingSetup admissions={registeredAdmissions} isDoctor={...} />` (if any)
4. `<WardFilter />`
5. Patient list — map ACTIVE admissions to `<PatientCard />` components, grouped by ward (General first, Isolation second)

- [ ] **Step 8: Test dashboard**

1. Seed some test data via Prisma Studio or the registration flow — create a few ACTIVE patients with different conditions and wards
2. Dashboard should show summary cards, patient cards with badges, ward filter
3. Critical patients should have red border and sort to top
4. If any isolation patients exist, red alert banner should show

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/page.tsx" src/components/dashboard/
git commit -m "feat: dashboard — summary cards, patient list, isolation alert, pending setup"
```

---

## Task 10: Patient Detail Shell + Doctor Actions

**Files:**
- Create: `src/app/(app)/patients/[admissionId]/page.tsx`, `src/components/patient/patient-header.tsx`, `src/components/patient/tab-nav.tsx`, `src/components/patient/doctor-actions.tsx`, `src/components/patient/discharge-form.tsx`
- Modify: `src/actions/admissions.ts`

- [ ] **Step 1: Add doctor actions to admissions actions**

Add to `src/actions/admissions.ts`:

```ts
export async function updateCondition(admissionId: string, condition: string) {
  await requireDoctor();
  await db.admission.update({
    where: { id: admissionId },
    data: { condition: condition as any },
  });
  revalidatePath(`/patients/${admissionId}`);
  revalidatePath("/");
}

export async function transferWard(admissionId: string, newWard: string, newCage: string) {
  const session = await requireDoctor();

  // Check cage uniqueness
  const existing = await db.admission.findFirst({
    where: { cageNumber: newCage, status: "ACTIVE", id: { not: admissionId } },
    include: { patient: { select: { name: true } } },
  });
  if (existing) {
    return { error: `Cage ${newCage} is occupied by ${existing.patient.name}` };
  }

  await db.admission.update({
    where: { id: admissionId },
    data: { ward: newWard as any, cageNumber: newCage },
  });

  revalidatePath(`/patients/${admissionId}`);
  revalidatePath("/");
}

export async function dischargePatient(admissionId: string, formData: FormData) {
  const session = await requireDoctor();

  const dischargeNotes = formData.get("dischargeNotes") as string;
  const condition = formData.get("condition") as string;

  if (!dischargeNotes) return { error: "Discharge notes are required" };
  if (condition !== "RECOVERED" && condition !== "DECEASED") {
    return { error: "Condition must be Recovered or Deceased for discharge" };
  }

  await db.admission.update({
    where: { id: admissionId },
    data: {
      status: condition === "DECEASED" ? "DECEASED" : "DISCHARGED",
      condition: condition as any,
      dischargeDate: new Date(),
      dischargedById: session.staffId,
      dischargeNotes,
    },
  });

  // Deactivate all active treatment plans
  await db.treatmentPlan.updateMany({
    where: { admissionId, isActive: true },
    data: { isActive: false },
  });

  // Deactivate all active diet plans
  await db.dietPlan.updateMany({
    where: { admissionId, isActive: true },
    data: { isActive: false },
  });

  // Deactivate all active fluid therapies
  await db.fluidTherapy.updateMany({
    where: { admissionId, isActive: true },
    data: { isActive: false },
  });

  revalidatePath("/");
  redirect("/");
}
```

- [ ] **Step 2: Create patient header component**

`src/components/patient/patient-header.tsx`:

Server component showing:
- Back button (← link to dashboard)
- Patient photo (or placeholder icon)
- Name, breed, age, sex, weight
- Condition badge + Ward badge + Cage number
- Diagnosis
- Attending doctor
- "Day N" (days since admission)

Compact layout matching the "Underline Tabs + List Vitals" mockup chosen in brainstorming.

- [ ] **Step 3: Create tab navigation component**

`src/components/patient/tab-nav.tsx`:

Client component. Material-style underline tabs, horizontally scrollable.

Tabs: Vitals | Meds | Food | Notes | Labs | Bath | Isolation

The Isolation tab is only shown if `ward === "ISOLATION"`.

Use URL hash or search params to track active tab. Default to "Vitals" tab.

- [ ] **Step 4: Create doctor actions bar**

`src/components/patient/doctor-actions.tsx`:

Only rendered when `isDoctor === true`. Shows at the bottom of the patient detail page:
- "Update Condition" button → opens Select dropdown with Condition values
- "Transfer Ward" button → opens dialog with ward select + cage select
- "Discharge" button → opens discharge form dialog

`src/components/patient/discharge-form.tsx`:
- Dialog with discharge notes (required textarea)
- Final condition (select: Recovered / Deceased only)
- Submit calls `dischargePatient` action

- [ ] **Step 5: Create patient detail page**

Create `src/app/(app)/patients/[admissionId]/page.tsx`:

Server component that:
1. Fetches admission with full relations via `db.admission.findUnique`
2. Gets session for role check
3. Renders:
   - `<PatientHeader admission={admission} />`
   - `<TabNav ward={admission.ward} />`
   - Active tab content (placeholder divs for each tab — actual tab components built in Tasks 11-18)
   - `<DoctorActions admission={admission} />` if doctor

- [ ] **Step 6: Test patient detail page**

1. Create a test patient via the registration + clinical setup flow
2. Click on the patient card from dashboard → should navigate to `/patients/[id]`
3. Should see patient header with all info
4. Should see tab navigation — clicking tabs should switch
5. Doctor should see condition/transfer/discharge buttons at bottom
6. Paravet should NOT see those buttons

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/patients/[admissionId]" src/components/patient/ src/actions/admissions.ts
git commit -m "feat: patient detail shell — header, tab nav, doctor actions (condition, transfer, discharge)"
```

---

## Task 11: Vitals Tab

**Files:**
- Create: `src/actions/vitals.ts`, `src/components/patient/vitals-tab.tsx`, `src/components/patient/vitals-form.tsx`

- [ ] **Step 1: Create vitals action**

Create `src/actions/vitals.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function recordVitals(admissionId: string, formData: FormData) {
  const session = await requireAuth();

  const data: any = { admissionId, recordedById: session.staffId };

  const temp = formData.get("temperature") as string;
  if (temp) data.temperature = parseFloat(temp);

  const hr = formData.get("heartRate") as string;
  if (hr) data.heartRate = parseInt(hr);

  const rr = formData.get("respRate") as string;
  if (rr) data.respRate = parseInt(rr);

  const pain = formData.get("painScore") as string;
  if (pain) data.painScore = parseInt(pain);

  const weight = formData.get("weight") as string;
  if (weight) data.weight = parseFloat(weight);

  const bp = formData.get("bloodPressure") as string;
  if (bp) data.bloodPressure = bp;

  const spo2 = formData.get("spo2") as string;
  if (spo2) data.spo2 = parseFloat(spo2);

  const crt = formData.get("capillaryRefillTime") as string;
  if (crt) data.capillaryRefillTime = parseFloat(crt);

  const mmc = formData.get("mucousMembraneColor") as string;
  if (mmc) data.mucousMembraneColor = mmc;

  const notes = formData.get("notes") as string;
  if (notes) data.notes = notes;

  await db.vitalRecord.create({ data });

  revalidatePath(`/patients/${admissionId}`);
  return { success: true };
}
```

- [ ] **Step 2: Create vitals tab component**

`src/components/patient/vitals-tab.tsx`:

Shows:
- Latest vitals as a key-value list (matching the "B: Underline Tabs + List Vitals" mockup):
  - Temperature — value, abnormal flag via `checkTemperature()`
  - Heart Rate — value, flag via `checkHeartRate()`
  - Resp Rate — value, flag via `checkRespRate()`
  - Pain Score — value, flag via `checkPainScore()`
  - Weight — value in kg
  - SpO2 — value
  - CRT — value, flag via `checkCRT()`
  - Mucous Membrane — value
  - Abnormal values: red text with flag label ("↑ HIGH" etc.)
- 48h trend chart placeholder: "Chart coming in Phase 3" message in a card
- Vitals history: table of all records, newest first. Each row: date/time, temp, HR, RR, pain, weight, recorded by.
- "Record Vitals" button at bottom

Props: `admissionId`, `vitals` array (fetched server-side), `latestVitals` (first item or null)

- [ ] **Step 3: Create vitals form**

`src/components/patient/vitals-form.tsx`:

Opens as a Sheet (bottom sheet on mobile). Fields:
- Temperature (number, step 0.1, pre-filled with last value)
- Heart Rate (number, pre-filled)
- Respiratory Rate (number, pre-filled)
- Pain Score (0-10, slider or number input, pre-filled)
- Weight (number, step 0.1, pre-filled)
- SpO2 (number, step 0.1)
- Blood Pressure (text)
- CRT (number, step 0.1)
- Mucous Membrane Color (select: Pink, Pale, White, Yellow, Brick red)
- Notes (textarea)
- Submit button

Auto-highlight fields with abnormal values as the user types (real-time threshold check).

- [ ] **Step 4: Wire into patient detail page**

Modify `src/app/(app)/patients/[admissionId]/page.tsx` to:
- Fetch vitals for this admission
- Pass to `<VitalsTab />` when vitals tab is active

- [ ] **Step 5: Test vitals recording**

1. Open a patient detail page
2. Tap "Record Vitals"
3. Enter temp=40.1, HR=152, RR=22, pain=6, weight=24.5
4. Submit — vitals should appear in the list
5. Temp and HR should show red "↑ HIGH" flags
6. Record a second set — should appear at top

- [ ] **Step 6: Commit**

```bash
git add src/actions/vitals.ts src/components/patient/vitals-tab.tsx src/components/patient/vitals-form.tsx
git commit -m "feat: vitals tab — record vitals, abnormal flagging, history list"
```

---

## Task 12: Medications Tab (Time-Grouped Checklist)

**Files:**
- Create: `src/actions/medications.ts`, `src/components/patient/meds-tab.tsx`, `src/components/patient/med-checkoff.tsx`, `src/components/patient/med-skip-sheet.tsx`, `src/components/patient/prescribe-med-form.tsx`

- [ ] **Step 1: Create medications actions**

Create `src/actions/medications.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireDoctor } from "@/lib/auth";

export async function prescribeMedication(admissionId: string, formData: FormData) {
  const session = await requireDoctor();

  const drugName = formData.get("drugName") as string;
  const dose = formData.get("dose") as string;
  const calculatedDose = formData.get("calculatedDose") as string || undefined;
  const route = formData.get("route") as string;
  const frequency = formData.get("frequency") as string;
  const scheduledTimesJson = formData.get("scheduledTimes") as string;
  const scheduledTimes = scheduledTimesJson ? JSON.parse(scheduledTimesJson) : [];
  const notes = formData.get("notes") as string || undefined;
  const endDateStr = formData.get("endDate") as string;

  if (!drugName || !dose || !route || !frequency) {
    return { error: "Drug name, dose, route, and frequency are required" };
  }

  await db.treatmentPlan.create({
    data: {
      admissionId,
      drugName,
      dose,
      calculatedDose,
      route: route as any,
      frequency: frequency as any,
      scheduledTimes,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      notes,
      createdById: session.staffId,
    },
  });

  revalidatePath(`/patients/${admissionId}`);
  return { success: true };
}

export async function stopMedication(treatmentPlanId: string) {
  await requireDoctor();

  const plan = await db.treatmentPlan.findUnique({ where: { id: treatmentPlanId } });
  if (!plan) return { error: "Treatment plan not found" };

  await db.treatmentPlan.update({
    where: { id: treatmentPlanId },
    data: { isActive: false, endDate: new Date() },
  });

  revalidatePath(`/patients/${plan.admissionId}`);
  return { success: true };
}

export async function administerDose(
  treatmentPlanId: string,
  scheduledDate: string,
  scheduledTime: string
) {
  const session = await requireAuth();

  await db.medicationAdministration.upsert({
    where: {
      treatmentPlanId_scheduledDate_scheduledTime: {
        treatmentPlanId,
        scheduledDate: new Date(scheduledDate),
        scheduledTime,
      },
    },
    update: {
      wasAdministered: true,
      actualTime: new Date(),
      administeredById: session.staffId,
      wasSkipped: false,
      skipReason: null,
    },
    create: {
      treatmentPlanId,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      wasAdministered: true,
      actualTime: new Date(),
      administeredById: session.staffId,
    },
  });

  const plan = await db.treatmentPlan.findUnique({ where: { id: treatmentPlanId } });
  revalidatePath(`/patients/${plan?.admissionId}`);
  revalidatePath("/schedule");
  return { success: true };
}

export async function skipDose(
  treatmentPlanId: string,
  scheduledDate: string,
  scheduledTime: string,
  skipReason: string
) {
  const session = await requireAuth();

  if (!skipReason) return { error: "Skip reason is required" };

  await db.medicationAdministration.upsert({
    where: {
      treatmentPlanId_scheduledDate_scheduledTime: {
        treatmentPlanId,
        scheduledDate: new Date(scheduledDate),
        scheduledTime,
      },
    },
    update: {
      wasSkipped: true,
      skipReason,
      wasAdministered: false,
      administeredById: session.staffId,
    },
    create: {
      treatmentPlanId,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      wasSkipped: true,
      skipReason,
      administeredById: session.staffId,
    },
  });

  const plan = await db.treatmentPlan.findUnique({ where: { id: treatmentPlanId } });
  revalidatePath(`/patients/${plan?.admissionId}`);
  revalidatePath("/schedule");
  return { success: true };
}
```

- [ ] **Step 2: Create meds tab component (time-grouped checklist)**

`src/components/patient/meds-tab.tsx`:

This is the most complex component. It renders the **time-grouped checklist** pattern:

1. Fetch active treatment plans with today's administrations
2. Flatten all scheduled doses into a flat list: `{ treatmentPlanId, drugName, dose, route, scheduledTime, administration? }`
3. Group by `scheduledTime` (hour)
4. Sort groups chronologically
5. For each time group, render a `TimeGroup` with header showing time and status:
   - All administered → "Completed" (green)
   - Some pending, time is past → "OVERDUE" (red)
   - Current hour → "Pending" (default)
   - Future → "Upcoming" (grey)
6. Each med within a group renders as a `<MedCheckoff />` row

Also render:
- Fluid therapy card at top (if active) — see Task 13
- "Add Medication" button (doctor-only) → opens prescribe form
- "Stopped medications" collapsible section at bottom

- [ ] **Step 3: Create med checkoff row component**

`src/components/patient/med-checkoff.tsx`:

Single medication row with:
- Checkbox (28x28px minimum tap target within 44x44px hit area)
- Drug name, dose, route
- Status-dependent styling:
  - Administered: green bg, checkmark, "Given by [name] at [time]"
  - Skipped: grey bg, strikethrough, skip reason
  - Overdue: red bg, "!" icon, "X min overdue"
  - Pending: white bg, empty checkbox
  - Upcoming: grey/dimmed, disabled checkbox

Tap checkbox → calls `administerDose()` action
Tap row (not checkbox) → opens skip sheet

- [ ] **Step 4: Create skip reason sheet**

`src/components/patient/med-skip-sheet.tsx`:

Bottom Sheet with:
- "Skip this dose?" header
- Drug name and scheduled time
- Common reason buttons (from COMMON_SKIP_REASONS constant)
- Custom reason text input
- "Confirm Skip" button
- Calls `skipDose()` action

- [ ] **Step 5: Create prescribe medication form**

`src/components/patient/prescribe-med-form.tsx`:

Doctor-only form (Sheet or Dialog) with:
- Drug name (text input with datalist autocomplete from COMMON_DRUGS)
- Dose (text, e.g., "25 mg/kg")
- Calculated dose (text, optional)
- Route (select from MedRoute enum using ROUTE_LABELS)
- Frequency (select from Frequency enum using FREQUENCY_LABELS)
- Scheduled times (auto-populated from FREQUENCY_DEFAULT_TIMES when frequency changes, editable)
- End date (optional date picker)
- Notes (textarea)
- Calls `prescribeMedication()` action

- [ ] **Step 6: Test medication flow**

1. As doctor, prescribe Ceftriaxone BID (08:00, 20:00) for a patient
2. Meds tab should show two time groups: 08:00 and 20:00
3. As paravet, tap checkbox on the 08:00 dose — should turn green with your name and time
4. Tap the 20:00 row (not checkbox) — skip sheet should open
5. Select "Patient vomiting" as reason — dose should show as skipped
6. Prescribe another med — should appear in the checklist

- [ ] **Step 7: Commit**

```bash
git add src/actions/medications.ts src/components/patient/meds-tab.tsx src/components/patient/med-checkoff.tsx src/components/patient/med-skip-sheet.tsx src/components/patient/prescribe-med-form.tsx
git commit -m "feat: medications tab — time-grouped checklist, administer, skip, prescribe"
```

---

## Task 13: Fluid Therapy

**Files:**
- Create: `src/actions/fluids.ts`, `src/components/patient/fluid-card.tsx`

- [ ] **Step 1: Create fluids actions**

Create `src/actions/fluids.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDoctor } from "@/lib/auth";

export async function startFluidTherapy(admissionId: string, formData: FormData) {
  const session = await requireDoctor();

  const fluidType = formData.get("fluidType") as string;
  const rate = formData.get("rate") as string;
  const additives = formData.get("additives") as string || undefined;
  const notes = formData.get("notes") as string || undefined;

  if (!fluidType || !rate) return { error: "Fluid type and rate are required" };

  await db.fluidTherapy.create({
    data: { admissionId, fluidType, rate, additives, notes, createdById: session.staffId },
  });

  revalidatePath(`/patients/${admissionId}`);
  return { success: true };
}

export async function changeFluidRate(fluidTherapyId: string, formData: FormData) {
  const session = await requireDoctor();

  const newRate = formData.get("newRate") as string;
  const reason = formData.get("reason") as string || undefined;

  if (!newRate) return { error: "New rate is required" };

  const fluid = await db.fluidTherapy.findUnique({ where: { id: fluidTherapyId } });
  if (!fluid) return { error: "Fluid therapy not found" };

  await db.$transaction([
    db.fluidRateChange.create({
      data: {
        fluidTherapyId,
        oldRate: fluid.rate,
        newRate,
        changedById: session.staffId,
        reason,
      },
    }),
    db.fluidTherapy.update({
      where: { id: fluidTherapyId },
      data: { rate: newRate },
    }),
  ]);

  revalidatePath(`/patients/${fluid.admissionId}`);
  return { success: true };
}

export async function stopFluids(fluidTherapyId: string) {
  await requireDoctor();

  const fluid = await db.fluidTherapy.update({
    where: { id: fluidTherapyId },
    data: { isActive: false, endTime: new Date() },
  });

  revalidatePath(`/patients/${fluid.admissionId}`);
  return { success: true };
}
```

- [ ] **Step 2: Create fluid card component**

`src/components/patient/fluid-card.tsx`:

Displayed at the top of the Meds tab when there's an active fluid therapy. Shows:
- Fluid type (RL, NS, DNS, etc.)
- Current rate
- Additives (if any)
- Start time
- "Change Rate" button (doctor-only) → opens dialog with new rate + reason
- "Stop Fluids" button (doctor-only)
- Rate change history (collapsed, expandable)

- [ ] **Step 3: Test fluid therapy**

1. As doctor, start RL at 40ml/hr for a patient
2. Fluid card should appear at top of Meds tab
3. Change rate to 60ml/hr with reason "Patient tolerating well"
4. Rate should update, rate change should appear in history
5. Stop fluids — card should disappear

- [ ] **Step 4: Commit**

```bash
git add src/actions/fluids.ts src/components/patient/fluid-card.tsx
git commit -m "feat: fluid therapy — start, change rate, stop, rate change log"
```

---

## Task 14: Food & Nutrition Tab

**Files:**
- Create: `src/actions/feeding.ts`, `src/components/patient/food-tab.tsx`, `src/components/patient/feeding-log-sheet.tsx`

- [ ] **Step 1: Create feeding actions**

Create `src/actions/feeding.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireDoctor } from "@/lib/auth";

export async function createDietPlan(admissionId: string, formData: FormData) {
  const session = await requireDoctor();

  const dietType = formData.get("dietType") as string;
  const instructions = formData.get("instructions") as string || undefined;
  const schedulesJson = formData.get("schedules") as string;

  if (!dietType) return { error: "Diet type is required" };

  // Deactivate existing active diet plans
  await db.dietPlan.updateMany({
    where: { admissionId, isActive: true },
    data: { isActive: false },
  });

  const schedules = schedulesJson ? JSON.parse(schedulesJson) : [];

  await db.dietPlan.create({
    data: {
      admissionId,
      dietType,
      instructions,
      createdById: session.staffId,
      feedingSchedules: {
        create: schedules.map((s: any) => ({
          scheduledTime: s.scheduledTime,
          foodType: s.foodType,
          portion: s.portion,
        })),
      },
    },
  });

  revalidatePath(`/patients/${admissionId}`);
  return { success: true };
}

export async function logFeeding(feedingScheduleId: string, formData: FormData) {
  const session = await requireAuth();

  const status = formData.get("status") as string;
  const amountConsumed = formData.get("amountConsumed") as string || undefined;
  const notes = formData.get("notes") as string || undefined;
  const dateStr = formData.get("date") as string;

  if (!status) return { error: "Status is required" };

  await db.feedingLog.upsert({
    where: {
      feedingScheduleId_date: {
        feedingScheduleId,
        date: new Date(dateStr),
      },
    },
    update: {
      status: status as any,
      amountConsumed,
      notes,
      loggedById: session.staffId,
    },
    create: {
      feedingScheduleId,
      date: new Date(dateStr),
      status: status as any,
      amountConsumed,
      notes,
      loggedById: session.staffId,
    },
  });

  const schedule = await db.feedingSchedule.findUnique({
    where: { id: feedingScheduleId },
    include: { dietPlan: { select: { admissionId: true } } },
  });

  revalidatePath(`/patients/${schedule?.dietPlan.admissionId}`);
  revalidatePath("/schedule");
  return { success: true };
}
```

- [ ] **Step 2: Create food tab component**

`src/components/patient/food-tab.tsx`:

Shows:
- Active diet plan card: diet type, instructions
- "Change Diet" button (doctor-only) → opens diet plan form
- Today's feeding schedule as a checklist:
  - Each row: time, food type, portion, status indicator
  - Status colors: green (EATEN), yellow (PARTIAL), red (REFUSED), grey (PENDING)
  - Tap to open feeding log sheet
- Feeding history: past 7 days, collapsed by default

- [ ] **Step 3: Create feeding log sheet**

`src/components/patient/feeding-log-sheet.tsx`:

Bottom sheet with:
- Time and food info displayed
- Status buttons: Eaten / Partial / Refused (large, tappable, 44px height)
- Amount consumed (text, optional, shown for Partial)
- Notes (textarea, optional)
- Submit calls `logFeeding()` action

- [ ] **Step 4: Test feeding flow**

1. As doctor, create a diet plan with 3 feedings (08:00, 14:00, 20:00)
2. Food tab should show the schedule
3. As paravet, tap the 08:00 feeding → log as "Eaten"
4. Row should turn green
5. Log 14:00 as "Refused" — row should turn red

- [ ] **Step 5: Commit**

```bash
git add src/actions/feeding.ts src/components/patient/food-tab.tsx src/components/patient/feeding-log-sheet.tsx
git commit -m "feat: food tab — diet plan, feeding schedule checklist, log feedings"
```

---

## Task 15: Clinical Notes Tab

**Files:**
- Create: `src/actions/notes.ts`, `src/components/patient/notes-tab.tsx`, `src/components/patient/note-form.tsx`

- [ ] **Step 1: Create notes action**

Create `src/actions/notes.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function addNote(admissionId: string, formData: FormData) {
  const session = await requireAuth();

  const category = formData.get("category") as string;
  const content = formData.get("content") as string;

  if (!category || !content) return { error: "Category and content are required" };

  await db.clinicalNote.create({
    data: {
      admissionId,
      category: category as any,
      content,
      recordedById: session.staffId,
    },
  });

  revalidatePath(`/patients/${admissionId}`);
  return { success: true };
}
```

- [ ] **Step 2: Create notes tab**

`src/components/patient/notes-tab.tsx`:

Timeline view, newest first. Each note shows:
- Time (formatDateTimeIST)
- Category badge (using NOTE_CATEGORY_LABELS)
- Author name, color-coded by role (using NOTE_ROLE_COLORS: doctor=purple, paravet=teal, attendant=grey)
- Content text

"Add Note" button at bottom.

- [ ] **Step 3: Create note form**

`src/components/patient/note-form.tsx`:

Sheet with:
- Category (select from NoteCategory enum)
- Content (textarea, autofocus)
- Submit

Auto-timestamps and auto-assigns logged-in user.

- [ ] **Step 4: Test and commit**

```bash
git add src/actions/notes.ts src/components/patient/notes-tab.tsx src/components/patient/note-form.tsx
git commit -m "feat: clinical notes tab — categorized timeline, add notes"
```

---

## Task 16: Labs Tab

**Files:**
- Create: `src/actions/labs.ts`, `src/components/patient/labs-tab.tsx`, `src/components/patient/lab-form.tsx`

- [ ] **Step 1: Create labs action**

Create `src/actions/labs.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDoctor } from "@/lib/auth";

export async function addLabResult(admissionId: string, formData: FormData) {
  const session = await requireDoctor();

  const testType = formData.get("testType") as string;
  const testName = formData.get("testName") as string;
  const result = formData.get("result") as string;
  const isAbnormal = formData.get("isAbnormal") === "true";
  const notes = formData.get("notes") as string || undefined;
  const reportUrl = formData.get("reportUrl") as string || undefined;

  if (!testType || !testName || !result) {
    return { error: "Test type, name, and result are required" };
  }

  await db.labResult.create({
    data: {
      admissionId,
      testType: testType as any,
      testName,
      result,
      isAbnormal,
      notes,
      reportUrl,
      createdById: session.staffId,
    },
  });

  revalidatePath(`/patients/${admissionId}`);
  return { success: true };
}
```

- [ ] **Step 2: Create labs tab and form**

`src/components/patient/labs-tab.tsx`:
- List of lab results, newest first
- Each shows: test name, type badge, date, result (truncated), abnormal flag (red badge)
- Tap to expand: full result, notes, report image link
- "Add Lab Result" button (doctor-only)

`src/components/patient/lab-form.tsx`:
- Test type (select from LabTestType enum)
- Test name (text)
- Result (textarea)
- Abnormal toggle (Switch)
- Notes (textarea)
- Report upload (file input — Google Drive integration in Task 22, for now just a URL text input)

- [ ] **Step 3: Test and commit**

```bash
git add src/actions/labs.ts src/components/patient/labs-tab.tsx src/components/patient/lab-form.tsx
git commit -m "feat: labs tab — add lab results, expandable list with abnormal flags"
```

---

## Task 17: Bath Tab

**Files:**
- Create: `src/actions/baths.ts`, `src/components/patient/bath-tab.tsx`

- [ ] **Step 1: Create bath action**

Create `src/actions/baths.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function logBath(admissionId: string, formData: FormData) {
  const session = await requireAuth();

  const notes = formData.get("notes") as string || undefined;

  await db.bathLog.create({
    data: {
      admissionId,
      bathedById: session.staffId,
      notes,
    },
  });

  revalidatePath(`/patients/${admissionId}`);
  revalidatePath("/");
  revalidatePath("/schedule");
  return { success: true };
}
```

- [ ] **Step 2: Create bath tab**

`src/components/patient/bath-tab.tsx`:

Shows:
- **Last bath info**: date/time, who bathed, notes. Large "X days since last bath" display.
- **Bath due indicator**:
  - Green: bathed within 5 days
  - Orange: bath due today (exactly 5 days)
  - Red: overdue (>5 days)
  - Uses `isBathDue()` from date-utils
  - If no bath ever logged, count from admission date
- **"Log Bath" button**: Large, prominent. Opens a Sheet with optional notes text field. One-tap submit.
- **Bath history**: List of all bath records (date, who, notes).

- [ ] **Step 3: Test and commit**

1. Patient with no bath record should show "Bath due" based on admission date
2. Log a bath → indicator should turn green, "0 days since last bath"
3. Check dashboard patient card — bath due badge should disappear

```bash
git add src/actions/baths.ts src/components/patient/bath-tab.tsx
git commit -m "feat: bath tab — log baths, 5-day due indicator, bath history"
```

---

## Task 18: Isolation Tab

**Files:**
- Create: `src/actions/isolation.ts`, `src/components/patient/isolation-tab.tsx`

- [ ] **Step 1: Create isolation actions**

Create `src/actions/isolation.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireDoctor } from "@/lib/auth";

export async function logDisinfection(isolationProtocolId: string) {
  const session = await requireAuth();

  await db.disinfectionLog.create({
    data: {
      isolationProtocolId,
      performedById: session.staffId,
    },
  });

  const protocol = await db.isolationProtocol.findUnique({
    where: { id: isolationProtocolId },
    select: { admissionId: true },
  });

  revalidatePath(`/patients/${protocol?.admissionId}`);
  revalidatePath("/isolation");
  return { success: true };
}

export async function updateIsolationProtocol(protocolId: string, formData: FormData) {
  await requireDoctor();

  const pcrStatus = formData.get("pcrStatus") as string;
  const pcrTrend = formData.get("pcrTrend") as string || undefined;
  const isCleared = formData.get("isCleared") === "true";

  const data: any = {};
  if (pcrStatus) {
    data.pcrStatus = pcrStatus;
    data.lastPcrDate = new Date();
  }
  if (pcrTrend) data.pcrTrend = pcrTrend;
  if (isCleared) {
    data.isCleared = true;
    data.clearedDate = new Date();
  }

  const protocol = await db.isolationProtocol.update({
    where: { id: protocolId },
    data,
  });

  revalidatePath(`/patients/${protocol.admissionId}`);
  revalidatePath("/isolation");
  return { success: true };
}
```

- [ ] **Step 2: Create isolation tab**

`src/components/patient/isolation-tab.tsx`:

Only shown for patients in ISOLATION ward. Shows:

- **Biosecurity protocol card** (red-tinted):
  - Disease name
  - PPE required (as badges)
  - Disinfectant
  - Disinfection interval
  - Biosecurity notes
- **PCR tracking**:
  - Timeline of PCR results (from LabResult where testType=PCR)
  - Current PCR status + trend
  - "Update PCR" button (doctor-only) → dialog with status, trend
- **Disinfection log**:
  - List of disinfection events with timestamp and who performed
  - **Next disinfection due**: computed from last disinfection + interval
  - **Overdue alert**: if more than 1 hour past due, red alert
  - "Log Disinfection" button — one-tap, auto-stamps time + user
- **Clearance status**:
  - "Not yet cleared" with last PCR date, OR
  - "Cleared on [date]" with green badge
  - "Clear for General Ward" button (doctor-only)

- [ ] **Step 3: Test and commit**

1. Create an isolation patient with protocol
2. Isolation tab should show protocol card
3. Log a disinfection — should appear in log
4. Update PCR status as doctor

```bash
git add src/actions/isolation.ts src/components/patient/isolation-tab.tsx
git commit -m "feat: isolation tab — biosecurity protocol, PCR tracking, disinfection logging"
```

---

## Task 19: Daily Schedule Page

**Files:**
- Create: `src/app/(app)/schedule/page.tsx`, `src/components/schedule/time-block.tsx`, `src/components/schedule/schedule-med-row.tsx`, `src/components/schedule/schedule-feeding-row.tsx`, `src/components/schedule/bath-due-section.tsx`

- [ ] **Step 1: Build schedule page with data query**

Create `src/app/(app)/schedule/page.tsx`:

Server component that:
1. Fetches all active admissions with:
   - Active treatment plans + today's scheduled times + administration records
   - Active diet plans + feeding schedules + today's feeding logs
   - Bath logs (last bath per admission)
   - Patient name + ward
2. Flattens all scheduled tasks into a list
3. Groups by hour (06:00–23:00)
4. Computes bath-due patients separately
5. Renders:
   - `<BathDueSection />` pinned at top
   - Time blocks from 06:00 to 23:00, each containing med rows and feeding rows for that hour

- [ ] **Step 2: Create time block component**

`src/components/schedule/time-block.tsx`:

Header shows hour (e.g., "08:00") and status:
- All done → green "Completed"
- Some overdue → red "OVERDUE"
- Current hour → bold, highlighted
- Future → grey

Contains `<ScheduleMedRow />` and `<ScheduleFeedingRow />` components.

- [ ] **Step 3: Create schedule med row**

`src/components/schedule/schedule-med-row.tsx`:

Like `<MedCheckoff />` but also shows **patient name** with ward badge. Same checkbox behavior — tap to administer, tap row to skip.

- [ ] **Step 4: Create schedule feeding row**

`src/components/schedule/schedule-feeding-row.tsx`:

Shows patient name, food type, portion. Tap to open feeding log sheet with status buttons.

- [ ] **Step 5: Create bath due section**

`src/components/schedule/bath-due-section.tsx`:

Pinned at top of schedule page. Lists patients with bath due/overdue:
- Patient name, days since last bath
- "Log Bath" button per patient
- Orange for due, red for overdue

- [ ] **Step 6: Test schedule page**

1. Have multiple patients with medications and feedings scheduled
2. Schedule page should show all tasks grouped by hour
3. Current hour should be highlighted
4. Past undone items should show red "OVERDUE"
5. Check off a med — should turn green
6. Bath due patients should appear at top

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/schedule" src/components/schedule/
git commit -m "feat: daily schedule page — time-grouped tasks across all patients, bath due section"
```

---

## Task 20: Isolation Ward Page

**Files:**
- Create: `src/app/(app)/isolation/page.tsx`

- [ ] **Step 1: Create isolation page**

Create `src/app/(app)/isolation/page.tsx`:

Server component that:
1. Fetches all ACTIVE admissions where ward=ISOLATION, with isolation protocol, latest vitals, disinfection logs
2. Renders:
   - Red-tinted header: "ISOLATION WARD" with biosecurity reminder
   - PPE checklist with large badges
   - "Handle isolation patients LAST in rotation" warning
   - List of isolation patients, each showing:
     - Patient name, cage, diagnosis
     - Condition badge
     - Disease, PCR status
     - Latest vitals (flagged if abnormal)
     - Latest disinfection time + next due
   - "Log Disinfection" button per patient (calls `logDisinfection()`)
   - Overall disinfection status: next due time, overdue alert

Compute disinfection overdue: parse `disinfectionInterval` (e.g., "Q4H" → 4 hours), compare to time since last `DisinfectionLog.performedAt`. If > interval + 1 hour, show red overdue alert.

- [ ] **Step 2: Test and commit**

1. Create an isolation patient
2. Navigate to Isolation tab in bottom nav
3. Should see biosecurity header, patient info, disinfection schedule
4. Log a disinfection — should update the log

```bash
git add "src/app/(app)/isolation"
git commit -m "feat: isolation ward page — biosecurity protocol, disinfection tracking, patient list"
```

---

## Task 21: Google Drive Integration

**Files:**
- Create: `src/lib/google-drive.ts`, `src/app/api/uploads/route.ts`
- Modify: `src/components/forms/registration-form.tsx`, `src/components/patient/lab-form.tsx`

- [ ] **Step 1: Create Google Drive helper**

Create `src/lib/google-drive.ts`:

```ts
import { google } from "googleapis";

function getAuth() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");

  const credentials = JSON.parse(Buffer.from(key, "base64").toString());
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
}

export async function uploadToGoogleDrive(
  file: Buffer,
  fileName: string,
  mimeType: string,
  subfolder: string
): Promise<{ fileId: string; shareableLink: string }> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

  // Find or create subfolder
  const folderQuery = await drive.files.list({
    q: `name='${subfolder}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
  });

  let folderId: string;
  if (folderQuery.data.files && folderQuery.data.files.length > 0) {
    folderId = folderQuery.data.files[0].id!;
  } else {
    const folder = await drive.files.create({
      requestBody: {
        name: subfolder,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      },
      fields: "id",
    });
    folderId = folder.data.id!;
  }

  // Upload file
  const { Readable } = await import("stream");
  const uploaded = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(file),
    },
    fields: "id, webViewLink",
  });

  // Make shareable
  await drive.permissions.create({
    fileId: uploaded.data.id!,
    requestBody: { role: "reader", type: "anyone" },
  });

  return {
    fileId: uploaded.data.id!,
    shareableLink: uploaded.data.webViewLink!,
  };
}
```

Install googleapis:

```bash
npm install googleapis
```

- [ ] **Step 2: Create upload route handler**

Create `src/app/api/uploads/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uploadToGoogleDrive } from "@/lib/google-drive";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const subfolder = formData.get("subfolder") as string || "uploads";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadToGoogleDrive(
    buffer,
    file.name,
    file.type,
    subfolder
  );

  return NextResponse.json(result);
}
```

- [ ] **Step 3: Update registration form for photo upload**

Modify `src/components/forms/registration-form.tsx` to:
- On photo file selection, upload to `/api/uploads` with subfolder = patient name
- Store returned shareable link in the hidden `photoUrl` form field
- Show upload progress indicator

- [ ] **Step 4: Update lab form for report upload**

Modify `src/components/patient/lab-form.tsx` to:
- Add file input for lab report (PDF or image)
- Upload to `/api/uploads` with subfolder = patient name
- Store returned URL in `reportUrl` field

- [ ] **Step 5: Test uploads**

Requires Google Drive service account configured in `.env.local`. If not configured, uploads will fail gracefully — the forms still work, just without file upload.

1. Register a patient with a photo — should upload to Google Drive and display
2. Add a lab result with a report PDF — should upload and show link

- [ ] **Step 6: Commit**

```bash
git add src/lib/google-drive.ts src/app/api/uploads/ src/components/forms/registration-form.tsx src/components/patient/lab-form.tsx
git commit -m "feat: Google Drive integration — photo uploads, lab report uploads"
```

---

## Task 22: PWA Service Worker

**Files:**
- Modify: `next.config.ts`
- Create: `src/app/sw.ts` (or appropriate serwist config)

- [ ] **Step 1: Install serwist**

```bash
npm install @serwist/next
npm install -D serwist
```

- [ ] **Step 2: Configure serwist in next.config.ts**

Update `next.config.ts` to wrap with serwist:

```ts
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
});

const nextConfig = {
  // existing config
};

export default withSerwist(nextConfig);
```

- [ ] **Step 3: Create service worker**

Create `src/app/sw.ts`:

```ts
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

- [ ] **Step 4: Test PWA**

```bash
npm run build && npm start
```

1. Open app in Chrome
2. Should see "Install" option in browser address bar
3. Install as PWA — should open as standalone app
4. Check DevTools > Application > Service Worker — should be registered

- [ ] **Step 5: Commit**

```bash
git add next.config.ts src/app/sw.ts
git commit -m "feat: PWA — service worker, installable, asset caching"
```

---

## Task 23: Seed Data & Final Integration

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Expand seed with realistic patient data**

Update `prisma/seed.ts` to also create:
- 3-4 ACTIVE patients in General ward with:
  - Vitals records (some with abnormal values)
  - Active treatment plans with scheduled times
  - MedicationAdministration records (some administered, some pending)
  - Diet plans with feeding schedules
  - Clinical notes
  - Bath logs (some patients with bath due)
- 1-2 ACTIVE patients in Isolation ward with:
  - Isolation protocol (CDV, PPE, disinfection schedule)
  - Disinfection logs
  - PCR lab results
- 1 REGISTERED patient (pending clinical setup)

This gives a realistic dashboard and patient detail view for testing.

- [ ] **Step 2: Run seed and verify**

```bash
npx prisma db seed
```

- [ ] **Step 3: Full integration test**

Run `npm run dev` and manually walk through:

1. **Login** — phone + password for each role
2. **Dashboard** — summary cards, patient list, ward filter, isolation alert, pending setup
3. **Patient detail** — all 7 tabs with real data
4. **Medications** — time-grouped checklist, administer, skip
5. **Vitals** — record, abnormal flagging
6. **Feeding** — log status
7. **Notes** — add note
8. **Labs** — add result (doctor)
9. **Bath** — log bath, due indicator
10. **Isolation** — protocol, disinfection log
11. **Schedule** — all tasks across patients
12. **Admin** — staff CRUD
13. **Clinical setup** — complete a registered patient's setup
14. **Discharge** — discharge a patient (doctor)
15. **Role enforcement** — verify non-doctors can't see/use doctor-only features
16. **Mobile** — test on phone or DevTools mobile view (bottom nav, FAB, tap targets)

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: realistic seed data — patients, vitals, meds, feeding, isolation"
```

---

## Spec Coverage Checklist

| Spec Item | Task |
|-----------|------|
| Auth (phone + password) | Task 3 |
| Dashboard (summary, alerts, patient list) | Task 9 |
| Two-step intake (register + clinical setup) | Tasks 7, 8 |
| Patient detail (header + 7 tabs) | Task 10 |
| Vitals tab (record, flag, history) | Task 11 |
| Medications tab (time-grouped checklist) | Task 12 |
| Fluid therapy (start, rate change, stop) | Task 13 |
| Food tab (diet plan, feeding log) | Task 14 |
| Notes tab (categorized timeline) | Task 15 |
| Labs tab (add results, abnormal flags) | Task 16 |
| Bath tab (log, 5-day reminder) | Task 17 |
| Isolation tab (protocol, PCR, disinfection) | Task 18 |
| Daily schedule page | Task 19 |
| Isolation ward page | Task 20 |
| Google Drive uploads | Task 21 |
| PWA (installable, caching) | Tasks 1, 22 |
| Admin page (staff, cages) | Task 6 |
| Doctor-only enforcement | Tasks 3, 8, 10, 12, 13, 14, 16, 18 |
| Discharge workflow | Task 10 |
| Cage uniqueness | Task 8 |
| Vitals auto-flag thresholds | Task 5 |
| Bath due badge | Tasks 9, 17, 19 |
| Med overdue detection | Tasks 12, 19 |
| Disinfection overdue | Tasks 18, 20 |
| IST timezone display | Task 5 |
| Soft deletes | Task 2 |
| Audit trail | Task 2 |
| Mobile-first | Tasks 4, 9, 10-18 |
