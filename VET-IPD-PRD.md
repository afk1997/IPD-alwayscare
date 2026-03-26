# Product Requirements Document: Veterinary IPD Management System

## Overview

A web application for managing inpatient animals at the Always Care animal clinic. Doctors and staff use it to track every admitted animal's treatment, medications, vitals, food intake, and nursing observations. The clinic currently handles general IPD cases (post-surgical, dehydration, trauma, tick fever, etc.) and isolation ward cases (primarily Canine Distemper). Most animals are strays rescued via the Arham Animal Ambulance network — there are no "pet owners" in the traditional sense.

The app replaces paper treatment sheets that are currently used in the ward. It needs to work on phones since paravets and attendants do rounds with their phones. Doctors use it from desktop or phone.

---

## Tech Stack

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **ORM**: Prisma
- **Database**: PostgreSQL on Neon DB (serverless)
- **Styling**: Tailwind CSS
- **Auth**: Simple phone-number + OTP based login (no email). Use NextAuth or a lightweight custom auth. Staff are pre-registered by admin — no self-signup.
- **File uploads**: Google Drive API. Patient photos, wound images, and lab reports are uploaded to a shared Google Drive folder. Store the Google Drive file ID and shareable link in the database. Organize into subfolders by patient name/ID.
- **Notifications**: WhatsApp via Interakt API. Notifications are sent for:
  - **Missed medications**: If a medication is 30+ minutes overdue and not marked as administered or skipped, send a WhatsApp alert to the on-duty staff group.
  - **Missed feedings**: If a feeding slot passes without being logged, send alert.
  - **Bath reminders**: Every 5 days from last bath, send a reminder for each patient due for a bath.
  - **Disinfection overdue**: If isolation ward disinfection is overdue by 1+ hour.
  - **Critical vitals**: If newly recorded vitals cross the abnormal thresholds.

---

## User Roles

| Role | Description |
|------|-------------|
| **Doctor** | Veterinarian. Can do everything in the app. Only role that can perform clinical setup actions (see below). |
| **Paravet** | Paraveterinary staff. Assists the doctor. Can register patients, do all daily execution tasks (vitals, med checkoffs, feeding logs, notes, baths, disinfection, photo uploads). Cannot do clinical setup actions. |
| **Attendant** | Ward attendant. Same access as paravet — can register patients and do all daily execution tasks. Cannot do clinical setup actions. |
| **Admin** | Staff management (add/deactivate staff accounts), view all data, reports. Same access as paravet for clinical operations. |

### Access Model — Two-Step Intake + Doctor-Only Clinical Setup

**The ONE hard restriction in the app: Clinical setup actions are doctor-only.** Everything else is open to all roles.

**Doctor-only actions (clinical setup):**
- Complete an admission's clinical setup (diagnosis, ward assignment, cage, condition)
- Create / modify / stop treatment plans (prescribe medications, set dose, route, frequency, schedule)
- Create / modify diet plans (diet type, feeding schedule, portions)
- Start / modify / stop fluid therapy
- Set up isolation protocol (disease, PPE, disinfection schedule, biosecurity notes)
- Order labs
- Change patient condition (Critical → Guarded → Stable → etc.)
- Transfer ward (General ↔ Isolation)
- Discharge patient

**Everyone can do (all roles including doctor):**
- Register a new patient (Step 1 of intake — basic info only)
- Record vitals
- Mark medications as administered or skipped
- Log feeding status (eaten / partial / refused)
- Write clinical notes and observations
- Log baths
- Log disinfection
- Upload photos / files
- View all data

### Two-Step Patient Intake Flow

**Step 1 — Register Patient (any role):**
Creates a patient record with basic info: name, species, breed, age, weight, sex, color, photo, stray toggle, rescue location, rescuer info. The patient gets status `REGISTERED` — visible in the system but NOT yet in IPD. Shows up in a "Pending Clinical Setup" section on the dashboard.

**Step 2 — Clinical Setup (doctor only):**
Doctor opens the registered patient and completes the admission: diagnosis, chief complaint, diagnosis notes, ward (General / Isolation), cage number, initial condition, attending doctor. Optionally adds initial medications, diet plan, fluid therapy, and isolation protocol. On submit, the patient status changes to `ACTIVE` and they appear in the ward.

**Shortcut:** If a doctor is doing the intake themselves, they can do Step 1 + Step 2 in a single form (the admission form shows both sections together for doctors). For paravets/attendants, the clinical setup section is not shown — they only see the basic registration fields.

### Enforcement
- API routes for clinical setup actions must check that the logged-in user's role is DOCTOR. Return 403 if not.
- The UI should not show clinical setup buttons/forms to non-doctor roles.
- All daily execution actions (vitals, med checkoff, feeding log, notes, baths, disinfection) have NO role check — any authenticated user can perform them.

---

## Data Model

### Patient (Animal)
Every animal that comes into IPD gets a patient record. Fields:

- `name` — string, required. Even strays get a name at the clinic.
- `species` — enum: DOG, CAT, BIRD, OTHER. Default DOG.
- `breed` — string, optional. e.g., "Indian Pariah", "Labrador Mix", "Mixed (Puppy)"
- `age` — string, optional. Free text because for strays it's estimated. e.g., "~3 years", "4 months"
- `weight` — float in kg. Updated on admission and tracked daily.
- `sex` — enum: MALE, FEMALE, UNKNOWN
- `color` — string, optional. Helpful for identification.
- `microchipId` — string, optional.
- `photoUrl` — string. Photo of the animal for identification. Stored as Google Drive shareable link.
- `isStray` — boolean, default true.
- `rescueLocation` — string, optional. Where the ambulance picked them up.
- `rescuerInfo` — string, optional. Name/phone of person who called for rescue.

A patient can have multiple admissions over time (e.g., comes back for a different issue).

### Admission
One admission = one IPD stay. This is the central entity everything hangs off of.

- `patient` — relation to Patient
- `admissionDate` — datetime
- `dischargeDate` — datetime, null while active
- `ward` — enum: GENERAL, ISOLATION, ICU
- `cageNumber` — string. e.g., "G-01", "G-02", "ISO-01". Must be unique among active admissions.
- `status` — enum: REGISTERED (Step 1 done, awaiting clinical setup), ACTIVE (fully admitted to IPD), DISCHARGED, DECEASED, TRANSFERRED
- `condition` — enum: CRITICAL, GUARDED, STABLE, IMPROVING, RECOVERED. Updated by any staff member (typically doctor dictates, staff updates).
- `diagnosis` — string. Primary diagnosis.
- `diagnosisNotes` — text, optional. Additional clinical context.
- `chiefComplaint` — string, optional. What the animal presented with.
- `admittedBy` — relation to Staff (whoever admitted the patient — can be doctor, paravet, or attendant)
- `attendingDoctor` — string. Primary doctor's name.
- `dischargedBy` — relation to Staff, optional
- `dischargeNotes` — text, optional. Summary at discharge.

### Treatment Plan (Medication Orders)
Each medication prescribed for an admission is a separate treatment plan entry.

- `admission` — relation
- `drugName` — string. e.g., "Ceftriaxone", "Meloxicam", "Nebulization (Salbutamol + NS)"
- `dose` — string. e.g., "25 mg/kg", "0.2 mg/kg", "0.5ml"
- `calculatedDose` — string, optional. The actual amount after weight calculation.
- `route` — enum: PO (oral), IV, SC (subcutaneous), IM (intramuscular), TOPICAL, NEBULIZER, RECTAL, OPHTHALMIC, OTIC, OTHER
- `frequency` — enum: SID (once daily), BID (twice), TID (three times), QID (four times), Q4H, Q6H, Q8H, Q12H, PRN (as needed), STAT (one-time), WEEKLY, OTHER
- `scheduledTimes` — string array. The specific times this med is to be given. e.g., ["08:00", "20:00"] for BID. Doctor sets these at prescription time.
- `startDate` — datetime
- `endDate` — datetime, optional. Null means ongoing until manually stopped.
- `isActive` — boolean. Set to false when treatment is stopped.
- `notes` — text. e.g., "Give with food", "Monitor for vomiting after dose"

### Medication Administration Record
Each individual dose event. This is what staff interact with on a daily basis — they see a list of meds due at each time slot and check them off.

- `treatmentPlan` — relation
- `scheduledDate` — date. The specific day.
- `scheduledTime` — string. e.g., "08:00"
- `wasAdministered` — boolean
- `actualTime` — datetime, optional. When it was actually given.
- `wasSkipped` — boolean
- `skipReason` — string, optional. e.g., "Patient vomiting", "Refused oral medication"
- `administeredBy` — relation to Staff
- `notes` — text, optional

Unique constraint on (treatmentPlan + scheduledDate + scheduledTime) so the same dose slot can't be logged twice.

### Vital Records
Vitals are recorded at regular intervals (every 4-6 hours typically, more frequently for critical patients).

- `admission` — relation
- `recordedAt` — datetime
- `temperature` — float, Celsius. Normal for dogs: 38.0–39.2°C. Flag if >39.5 or <37.5.
- `heartRate` — int, bpm. Normal for dogs: 60-140 depending on size. Flag if >140.
- `respRate` — int, breaths/min. Normal: 10-30. Flag if >35.
- `painScore` — int, 0-10 scale. Flag if >=5.
- `weight` — float, kg. Tracked daily to monitor recovery/decline.
- `bloodPressure` — string, optional.
- `spo2` — float, optional. Oxygen saturation.
- `capillaryRefillTime` — float, optional. In seconds. Normal <2 seconds.
- `mucousMembraneColor` — string, optional. "Pink" = normal, "Pale"/"White" = anemia, "Yellow" = jaundice, "Brick red" = sepsis.
- `notes` — text, optional
- `recordedBy` — relation to Staff

### Fluid Therapy
IV fluid management. One entry per active fluid line.

- `admission` — relation
- `fluidType` — string. "RL" (Ringer's Lactate), "NS" (Normal Saline), "DNS" (Dextrose Normal Saline), "D5W"
- `rate` — string. e.g., "40 ml/hr"
- `additives` — string, optional. "KCl 20mEq/L", "B-complex"
- `startTime` — datetime
- `endTime` — datetime, optional
- `isActive` — boolean
- `notes` — text

Fluid rate changes should be tracked as a sub-log (FluidRateChange) with old rate, new rate, time, and reason.

### Diet Plan & Feeding
Each admission has an active diet plan with a feeding schedule.

**DietPlan:**
- `admission` — relation
- `dietType` — string. e.g., "Soft recovery diet", "High-calorie gruel (syringe feed)", "NPO" (nothing by mouth)
- `instructions` — text. Detailed feeding instructions.
- `isActive` — boolean

**FeedingSchedule** (template for daily feeding times):
- `dietPlan` — relation
- `scheduledTime` — string. e.g., "08:00"
- `foodType` — string. e.g., "Boiled chicken + rice", "Cerelac + egg yolk gruel"
- `portion` — string. e.g., "150g", "50ml"

**FeedingLog** (actual daily record):
- `feedingSchedule` — relation
- `date` — date
- `status` — enum: PENDING, EATEN, PARTIAL, REFUSED, SKIPPED
- `amountConsumed` — string, optional. e.g., "~100g of 150g"
- `notes` — text, optional. e.g., "Syringe fed, accepted well"
- `loggedBy` — relation to Staff

### Clinical Notes (formerly "Nursing Notes")
Free-text observations and clinical notes, categorized and timestamped. Any staff member (doctor, paravet, or attendant) can add notes.

- `admission` — relation
- `category` — enum: OBSERVATION, BEHAVIOR, WOUND_CARE, ELIMINATION (pee/poop tracking), PROCEDURE, DOCTOR_ROUND, SHIFT_HANDOVER, OTHER
- `content` — text
- `recordedAt` — datetime
- `recordedBy` — relation to Staff

### Bath Tracking
Track when each patient is bathed. The system reminds staff when a bath is due (every 5 days from last bath).

**BathLog:**
- `admission` — relation
- `bathedAt` — datetime. When the bath was given.
- `bathedBy` — relation to Staff. Who gave the bath.
- `notes` — text, optional. e.g., "Medicated shampoo used", "Only sponge bath — wound area avoided"
- `nextBathDue` — datetime, computed. Auto-calculated as `bathedAt + 5 days`. Used by the notification system to trigger reminders.

Business logic: On the dashboard patient card, show "Bath due" badge if current date >= last bath date + 5 days. If no bath has ever been logged for this admission, start counting from admission date. The WhatsApp notification fires on the morning of the due date.

### Lab Results
Lab test results including PCR tests critical for CD tracking.

- `admission` — relation
- `testType` — enum: CBC, BLOOD_CHEMISTRY, PCR, URINALYSIS, FECAL_EXAM, XRAY, ULTRASOUND, SEROLOGY, SKIN_SCRAPING, OTHER
- `testName` — string. e.g., "CDV PCR", "CBC", "Blood smear for tick fever"
- `result` — text. Free text or structured.
- `resultDate` — datetime
- `isAbnormal` — boolean
- `notes` — text, optional
- `reportUrl` — string, optional. Google Drive shareable link to uploaded report image/PDF.

### Isolation Protocol
Only for patients in the isolation ward. One protocol per admission.

- `admission` — one-to-one relation
- `disease` — string. e.g., "Canine Distemper (CDV)", "Parvovirus"
- `pcrStatus` — string. "Positive", "Negative", "Pending"
- `lastPcrDate` — datetime
- `pcrTrend` — string. e.g., "High → still shedding", "Declining"
- `ppeRequired` — string array. ["Gloves", "Gown", "Shoe covers", "Hand sanitize on exit"]
- `disinfectant` — string. "Quaternary ammonium compound"
- `disinfectionInterval` — string. "Q4H" (every 4 hours)
- `biosecurityNotes` — text. Free text instructions specific to this case.
- `isCleared` — boolean. Set to true when PCR is negative and animal can leave isolation.
- `clearedDate` — datetime, optional

**DisinfectionLog:**
- `isolationProtocol` — relation
- `performedAt` — datetime
- `performedBy` — relation to Staff
- `notes` — text, optional

### Staff
Pre-registered by admin. No self-signup.

- `name` — string
- `phone` — string, unique. Used for login.
- `role` — enum: DOCTOR, PARAVET, ATTENDANT, ADMIN
- `isActive` — boolean

---

## Pages & Screens

### 1. Login
- Phone number input → OTP sent via SMS/WhatsApp → verify → logged in
- Session persists. No password.
- Redirect to dashboard after login.

### 2. Dashboard (Home) — `/`
The main screen everyone sees. A ward overview.

**Top section — Summary cards:**
- Total patients in IPD
- General ward count
- Isolation ward count
- Critical patients count
- Pending medications (meds not yet administered today across all patients)
- Upcoming feedings (next 2 hours)
- Baths due (patients whose last bath was 5+ days ago)

**Alert banner:** If isolation ward has active patients, show a persistent red alert with the disease name and key instructions (PPE required, handle last in rotation).

**Pending Clinical Setup section** (shown above the ward lists):
If there are any patients with status=REGISTERED (Step 1 done, awaiting doctor), show them in a yellow/amber highlighted section titled "Awaiting Clinical Setup". Each shows patient name, breed, age, weight, who registered them, and when. Tapping opens the clinical setup form (Step 2). This section is only actionable by doctors — paravets/attendants can see it but the "Complete Setup" button is hidden for them.

**Patient list — grouped by ward:**

First group: General IPD patients. Second group: Isolation ward patients.

Each patient card in the list shows:
- Patient name, breed, age, weight
- Cage number
- Status badge (CRITICAL in red, GUARDED in yellow, STABLE in green, IMPROVING in blue)
- Ward badge (GENERAL in teal, ISOLATION in red)
- Bath due badge (orange "🛁 Bath due" if 5+ days since last bath)
- Diagnosis (truncated)
- Latest vitals snapshot (temp + HR, highlighted red if abnormal)
- Next pending medication with time
- Attending doctor name

**Ward filter tabs** at top: All | General | Isolation

Clicking any patient card navigates to that patient's detail page.

**Quick actions floating button (mobile):** + button that opens options:
- Admit new patient
- Quick vitals entry (select patient → enter vitals)
- Quick med checkoff (shows all meds due now or overdue)

### 3. Patient Detail — `/patients/[admissionId]`
The core treatment sheet screen. Everything about one patient's current admission.

**Header:**
- Patient name, breed, age, sex, weight
- Photo (if available)
- Ward badge + status badge
- Cage number
- Admission date, days admitted
- Attending doctor
- Diagnosis

**Tabs below the header:**

#### Tab: Vitals
- Latest vitals in large metric cards (temp, HR, RR, pain score, weight, SpO2). Cards turn red if values are abnormal.
- Vitals trend chart showing last 48 hours of temp + HR plotted over time. Use Recharts.
- Table of all vitals records for this admission, newest first.
- "Record Vitals" button opens a form: temperature, heart rate, respiratory rate, pain score (0-10 slider), weight, SpO2, CRT, mucous membrane color (dropdown), notes. Submit creates a new VitalRecord.

#### Tab: Medications
- **Active fluid therapy** card at top (if any): fluid type, rate, additives, start time. "Change Rate" button (doctor only, logs a FluidRateChange) or "Stop Fluids" (doctor only).
- **Medications list**: Each active medication shown as a card with drug name, dose, route, frequency. Below each card: time slots for today. Each slot is a button — tap to mark as administered (turns green with checkmark and logs the staff member's name + actual time). Long-press or secondary action to mark as "Skipped" with reason. Slots in the past that aren't checked are highlighted yellow (overdue). Future slots are grey.
- **Add Medication** button (doctor only): Form to prescribe new medication — drug name (text input with common drug suggestions), dose, route (dropdown), frequency (dropdown, auto-populates time slots based on selection), start date, end date (optional), notes.
- **Stopped medications** section (collapsed): Shows medications where isActive=false, for history.

#### Tab: Food & Nutrition
- **Active diet plan** card: diet type, instructions.
- **Today's feeding schedule**: List of all scheduled feedings for today. Each shows time, food type, portion. Status indicator: green (eaten), yellow (partial), red (refused), grey (pending). Tap to log: opens a quick sheet with status dropdown (Eaten/Partial/Refused), amount consumed (optional text), notes. Logged by the current user.
- **Change Diet** button (doctor only): Update diet plan.
- **Feeding history**: Past 7 days of feeding logs.

#### Tab: Notes
- Timeline view of all clinical notes, observations, doctor's round notes. Newest at top.
- Each note shows: time, category badge, author name (color-coded: doctors in purple, paravets in teal, attendants in grey), content.
- "Add Note" floating button: Category dropdown, text area for content. Auto-stamps time and logged-in user.

#### Tab: Labs
- List of all lab results, newest first. Each shows test name, type badge, date, result (truncated), abnormal flag.
- Tap to expand and see full result + notes + report image.
- "Add Lab Result" button (doctor only): test type dropdown, test name, result text, abnormal toggle, notes, upload report image (uploaded to Google Drive).

#### Tab: Isolation *(only shown if patient is in isolation ward)*
- **Biosecurity protocol** card in red: disease name, PPE required (as badges), disinfection schedule, biosecurity instructions.
- **PCR tracking**: Timeline of all PCR tests with date, result, trend. Visual indicator showing if viral load is trending up/down/stable.
- **Disinfection log**: List of all disinfection events with timestamp and who performed it. "Log Disinfection" button that stamps current time + logged-in user.
- **Clearance status**: If not cleared — shows "Not yet cleared for general ward" with last PCR date. If cleared — shows clearance date and green badge.

#### Tab: Bath
- **Last bath info**: Date and time of last bath, who gave it, notes. Days since last bath prominently displayed.
- **Bath due indicator**: Green if bathed within last 5 days. Yellow/orange if bath due today. Red if overdue.
- **"Log Bath" button**: One-tap to log a bath now. Opens a quick form: notes (optional, e.g., "Medicated shampoo", "Sponge bath only — wound area avoided"). Auto-stamps current time and logged-in user.
- **Bath history**: List of all bath records for this admission with date, who bathed, and notes.

**Bottom of patient detail (doctor-only actions — hidden for paravet/attendant):**
- "Update Condition" button: dropdown to change patient condition (Critical → Guarded → Stable → Improving → Recovered)
- "Transfer Ward" button: move between General ↔ Isolation
- "Discharge" button: opens discharge form with discharge notes text area, final condition, discharge summary auto-generated from admission data.

### 4. Register / Admit Patient — `/patients/new`
This page implements the two-step intake flow.

#### Step 1 — Register Patient (any role)
All staff see this form. Creates a patient record with status=REGISTERED.

**Fields:**
- Name (required)
- Species (dropdown, default Dog)
- Breed (text)
- Age (text)
- Weight (number, kg)
- Sex (dropdown)
- Color (text)
- Photo upload (uploaded to Google Drive, shareable link stored)
- Is stray? (toggle, default on)
- Rescue location (text, shown if stray)
- Rescuer info (text, shown if stray)

Submit creates a Patient record and an Admission record with status=REGISTERED. The patient now appears in the "Awaiting Clinical Setup" section on the dashboard.

#### Step 2 — Clinical Setup (doctor only)
Only shown to doctors. Can be accessed either:
- As a continuation after Step 1 (if the doctor is doing intake themselves, Step 2 fields appear below Step 1 on the same page)
- From the "Awaiting Clinical Setup" section on the dashboard (tapping a registered patient opens this form)

**Fields:**
- Diagnosis (text, required)
- Chief complaint (text)
- Diagnosis notes (textarea)
- Ward (dropdown: General / Isolation, required)
- Cage number (dropdown showing available cages, required)
- Initial condition (dropdown: Critical / Guarded / Stable, required)
- Attending doctor (dropdown from active doctors, required)

**Initial treatment section (optional but encouraged):**
- Add initial medications (repeatable: drug + dose + route + frequency + scheduled times)
- Initial fluid therapy (fluid type + rate + additives)
- Diet plan (diet type + feeding schedule with times/food/portions)
- Initial notes (textarea)

If ward is Isolation, also show:
- Disease name (text)
- PPE requirements (multi-select checkboxes)
- Disinfectant (text)
- Disinfection interval (dropdown)
- Biosecurity notes (textarea)

Submit updates the Admission status from REGISTERED → ACTIVE and creates any TreatmentPlans + DietPlan + FluidTherapy + IsolationProtocol records. The patient now appears in the appropriate ward on the dashboard.

### 5. Daily Schedule — `/schedule`
A single page showing everything due across ALL active patients for today. This is the "shift overview" screen.

**Grouped by time slot (hourly blocks):**

For each hour of the day (06:00 through 23:00):
- All medications due in this hour across all patients. Each shows: patient name (with ward badge), drug name, dose, route. Checkbox to mark as done.
- All feedings due in this hour. Patient name, food type, portion. Status buttons.
- Any vitals due (e.g., Q4H vitals schedule).

**Bath due section** (shown at top of schedule page, separate from hourly blocks):
- List of all patients whose bath is due today or overdue. Each shows patient name, days since last bath, "Log Bath" button.

Color coding:
- Past + done = green
- Past + not done = red (overdue)
- Current hour = highlighted/bold
- Future = grey

This page is the "command center" for the staff on duty. They work through it hour by hour.

### 6. Isolation Ward — `/isolation`
Dedicated view for the isolation ward with biosecurity front-and-center.

**Biosecurity reminder** at top (always visible): PPE checklist, disinfection instructions.

**Isolation patients** listed with expanded info showing their isolation protocol, PCR status, and latest vitals.

**Disinfection schedule**: Shows next disinfection due time, overdue alert if late. One-tap "Log Disinfection" button.

### 7. Admin — `/admin`
**Staff management:**
- List all staff with name, phone, role, active status.
- Add new staff member form.
- Deactivate/reactivate staff.

**Ward configuration:**
- Manage cage numbers per ward.
- Set cage capacity.

---

## UI/UX Requirements

### Mobile-First
The primary users (paravets, attendants) are on their phones in the ward. Design mobile-first.

- Large tap targets for medication checkoffs (at least 44px × 44px)
- Minimal typing needed for routine actions (vitals entry, med checkoff, feeding log)
- Quick actions accessible without deep navigation
- Bottom navigation bar on mobile: Dashboard | Schedule | Isolation | Profile

### Color System
- **General ward**: Teal/green tones
- **Isolation ward**: Red tones — everything isolation-related should feel visually distinct and "warning"
- **Status colors**: Critical = red, Guarded = amber, Stable = green, Improving = blue
- **Overdue items**: Red background or badge
- **Completed items**: Green with checkmark

### Data Entry Patterns
- **Vitals**: Number inputs with +/- steppers. Pre-fill with last recorded value for easy "no change" entry. Auto-flag abnormal values on input.
- **Medication checkoff**: Single tap to mark done. Swipe or long-press to mark skipped. Confirmation for skip (requires reason).
- **Feeding log**: Tap status buttons (Eaten / Partial / Refused). Optional notes expand on tap.
- **Notes**: Free text with category selector. Auto-timestamp.

### Timestamps & Timezone
- All times in IST (Asia/Kolkata).
- Display times in 24hr format for clinical consistency (08:00, 14:00, 22:00).
- Dates in DD/MM/YYYY format.

---

## API Design

Use Next.js Route Handlers in `src/app/api/`.

### Core Endpoints

**Admissions (the central resource):**
- `GET /api/admissions` — List admissions. Query params: `ward`, `status`, `condition`. Status=ACTIVE returns IPD patients. Status=REGISTERED returns pending clinical setup. Includes patient info, latest vitals, today's pending meds count.
- `GET /api/admissions/[id]` — Full admission detail with all relations.
- `POST /api/admissions` — Register a new patient (Step 1). Any role. Creates Patient + Admission with status=REGISTERED.
- `POST /api/admissions/[id]/clinical-setup` — Complete clinical setup (Step 2). **Doctor only.** Sets diagnosis, ward, cage, condition, initial meds/diet/fluids/isolation. Changes status from REGISTERED → ACTIVE.
- `PATCH /api/admissions/[id]` — Update condition, ward, status. **Doctor only.**
- `POST /api/admissions/[id]/discharge` — Discharge patient. **Doctor only.**

**Vitals:**
- `GET /api/admissions/[id]/vitals` — All vitals for admission. Query: `limit`, `from`, `to`.
- `POST /api/admissions/[id]/vitals` — Record new vitals.

**Medications:**
- `GET /api/admissions/[id]/medications` — Active treatment plans with today's administration records.
- `POST /api/admissions/[id]/medications` — Prescribe new medication. **Doctor only.**
- `PATCH /api/admissions/[id]/medications/[medId]` — Update or stop a treatment plan. **Doctor only.**
- `POST /api/admissions/[id]/medications/[medId]/administer` — Mark a dose as given or skipped. Any role.

**Fluids:**
- `GET /api/admissions/[id]/fluids` — Active fluid therapies.
- `POST /api/admissions/[id]/fluids` — Start new fluid therapy. **Doctor only.**
- `PATCH /api/admissions/[id]/fluids/[fluidId]` — Change rate or stop. **Doctor only.**

**Feeding:**
- `GET /api/admissions/[id]/feeding` — Active diet plan with today's feeding logs.
- `POST /api/admissions/[id]/feeding` — Create/update diet plan. **Doctor only.**
- `POST /api/admissions/[id]/feeding/log` — Log a feeding event. Any role.

**Notes:**
- `GET /api/admissions/[id]/notes` — Clinical notes. Query: `category`, `limit`.
- `POST /api/admissions/[id]/notes` — Add a note.

**Labs:**
- `GET /api/admissions/[id]/labs` — Lab results.
- `POST /api/admissions/[id]/labs` — Add lab result. **Doctor only.**

**Bath:**
- `GET /api/admissions/[id]/baths` — Bath history for this admission. Includes `daysSinceLastBath` and `nextBathDue` computed fields.
- `POST /api/admissions/[id]/baths` — Log a bath. Body: `notes` (optional). Auto-stamps time + logged-in user.

**Isolation:**
- `GET /api/admissions/[id]/isolation` — Isolation protocol + disinfection logs.
- `POST /api/admissions/[id]/isolation/disinfect` — Log disinfection. Any role.
- `PATCH /api/admissions/[id]/isolation` — Update PCR status, clear for discharge. **Doctor only.**

**Schedule:**
- `GET /api/schedule` — All tasks for today across all active admissions. Returns meds, feedings, vitals due, baths due, grouped by time. Bath due items are returned as a separate top-level array (not hourly).

**File Uploads (Google Drive):**
- `POST /api/uploads` — Upload a file to Google Drive. Accepts multipart form data with file + metadata (patientId, admissionId, category: "photo" | "wound" | "lab_report" | "other"). Creates a subfolder per patient if it doesn't exist. Returns Google Drive file ID and shareable view link. Store both in the relevant database record (Patient.photoUrl, LabResult.reportUrl, etc.).

**Staff:**
- `GET /api/staff` — List staff.
- `POST /api/staff` — Create staff.
- `PATCH /api/staff/[id]` — Update/deactivate staff.

**Auth:**
- `POST /api/auth/send-otp` — Send OTP to phone number.
- `POST /api/auth/verify-otp` — Verify OTP, return session.

### Query Performance Notes
- Always use Prisma `include` selectively — don't load all relations by default.
- The dashboard query (all active admissions with latest vitals + today's pending meds) is the most common and should be optimized. Use `select` to limit fields. Consider a materialized view or Prisma `$queryRaw` if the ORM query gets slow with 20+ patients.
- Add database indexes on: `(admissionId, isActive)` for treatment plans, `(admissionId, recordedAt)` for vitals and notes, `(scheduledDate)` for med administrations, `(ward, status)` for admissions.

---

## Business Rules

1. **Cage uniqueness**: No two active admissions can share the same cage number.
2. **Isolation handling order**: The app should display a reminder that isolation patients must be handled LAST in staff rotation to prevent cross-contamination.
3. **Medication overdue alerts**: Any medication past its scheduled time by 30+ minutes without being marked administered should be visually flagged as overdue.
4. **Disinfection overdue**: If a disinfection log is overdue by more than 1 hour per the protocol interval, show alert.
5. **Critical patient highlighting**: Patients with condition=CRITICAL should always be visually prominent (red border, top of list).
6. **Discharge requires**: Discharge notes are mandatory. Condition must be set to RECOVERED or DECEASED before discharge.
7. **Vitals auto-flag thresholds** (for dogs):
   - Temperature: Flag if >39.5°C or <37.5°C
   - Heart rate: Flag if >140 bpm or <60 bpm
   - Respiratory rate: Flag if >35 /min
   - Pain score: Flag if >=5
   - CRT: Flag if >2 seconds
8. **Feeding refusal tracking**: If a patient has REFUSED status on 2+ consecutive feedings, show a yellow alert on their card.
9. **Weight tracking**: If weight drops by >5% from admission weight, flag with alert.
10. **Bath reminder**: Every 5 days from last bath, the system should show a "Bath due" badge on the patient card and the daily schedule page. If no bath has been logged for the current admission, count from the admission date. A WhatsApp reminder is sent on the morning the bath is due. If overdue by 1+ day, escalate the badge to red.

---

## Environment Variables

```env
DATABASE_URL="postgresql://..."        # Neon pooled connection
DIRECT_URL="postgresql://..."          # Neon direct connection (for migrations)
NEXTAUTH_SECRET="..."                  # Random secret for session encryption
NEXTAUTH_URL="http://localhost:3000"   # App URL
GOOGLE_DRIVE_FOLDER_ID="..."           # Shared Google Drive folder for all uploads
GOOGLE_SERVICE_ACCOUNT_KEY="..."       # Google service account JSON (base64 encoded)
INTERAKT_API_KEY="..."                 # For WhatsApp notifications
INTERAKT_WEBHOOK_SECRET="..."          # For incoming webhook verification (optional)
WHATSAPP_GROUP_NUMBERS="..."           # Comma-separated phone numbers for alert recipients
```

---

## Build Phases

### Phase 1 — Core System (Build First)
Everything needed for daily use:
- Auth (phone + OTP login)
- Dashboard with ward overview
- Patient admission form (any staff can admit)
- Patient detail page with all tabs (vitals, meds, food, notes, bath)
- Medication administration (checkoff by any staff)
- Vitals recording
- Feeding schedule + logging
- Clinical notes (anyone can write)
- Bath tracking with 5-day reminders
- Isolation tab with biosecurity protocol

### Phase 2 — Operations
- Daily schedule page (all tasks across all patients — meds, feedings, baths due)
- Isolation ward dedicated page
- Lab results module
- Fluid therapy management with rate changes
- Discharge workflow
- Disinfection logging
- Google Drive integration for photo/report uploads

### Phase 3 — Enhancements
- WhatsApp notifications via Interakt (missed meds, missed feedings, bath reminders, disinfection overdue, critical vitals)
- Vitals trend charts (Recharts)
- Admin panel (staff management, cage configuration)
- Weight trend monitoring with alerts
- PWA support for offline-capable mobile use

---

## Non-Functional Requirements

- **Performance**: Dashboard should load in <2 seconds even with 20+ active patients. Use Prisma's `select` to limit payloads.
- **Reliability**: All medical data writes (vitals, med administration, notes) must be transactional. Use Prisma transactions where multiple records are created together.
- **Security**: Authentication required for all API routes. Two-tier access model: (1) **Clinical setup actions** (prescribe meds, set diet, start fluids, set up isolation, order labs, change condition, transfer ward, discharge, complete admission) require role=DOCTOR — API returns 403 for other roles, UI hides these buttons. (2) **Daily execution actions** (record vitals, mark meds administered, log feedings, write notes, log baths, log disinfection, upload files, register new patients) are open to all authenticated users regardless of role. Validate in API middleware.
- **Audit trail**: Every record includes who created it and when, including their role at time of action. Never hard-delete medical records — use soft deletes or status flags.
- **Timezone**: All timestamps stored in UTC, displayed in IST. Use `Asia/Kolkata` for all display formatting.
