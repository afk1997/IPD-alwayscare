# Management Dashboard Redesign

**Problem**

The current management dashboard hides proof media (feeding photos, medication photos, bath photos) behind 3+ clicks — dashboard → patient → Media tab → find proof in list → open. Management's primary need is verifying that care is happening, which means seeing proof photos front and center. The current 10-tab patient detail page forces unnecessary navigation for a read-only role. The overall UX has no visual hierarchy — stats, alerts, patients, and activity are all given equal weight.

**Decision**

Complete overhaul of the management dashboard and patient detail page. The dashboard becomes a hybrid layout with a scrollable proof carousel at the top and compact patient cards below. The patient detail page collapses from 10 tabs to 3: Today, History, Media. Proof photos appear inline next to medication and feeding entries — zero extra clicks to see them.

**Scope**

- Redesign `/management` dashboard page
- Redesign `/management/patients/[admissionId]` patient detail page
- New data queries to support proof-inline and carousel views
- Mobile-first responsive layout
- Read-only (no new write functionality)

**Out of Scope**

- Internal staff dashboard (unchanged)
- New API routes for media serving (reuse existing `/api/media`)
- Push notification changes
- Authentication changes

---

## Dashboard Layout

The management dashboard has 4 sections in this order, top to bottom:

### 1. Stat Strip

A single compact row showing 4 key numbers:

- **Active** — count of ACTIVE admissions
- **Critical** — count of CRITICAL condition patients
- **Overdue Meds** — count of medication doses past scheduled time and not administered
- **Overdue Feeds** — count of feeding slots past scheduled time and not logged

Styled as a horizontal row of 4 small cards. Always visible at the top. On mobile, 4 columns in one row (compact numbers, no labels on xs screens — just icons + numbers).

### 2. Recent Proofs Carousel

A horizontally scrollable strip showing the most recent proof attachments across all patients, newest first. Limited to the last 20 proofs from today.

Each carousel item shows:
- Proof thumbnail (loaded via `/api/media?id={fileId}` or the proxy URL)
- Patient name (truncated to fit)
- Action type label: "Fed", "Med", "Bath", "Vitals", "Disinfect"
- Time (e.g., "8:12 AM")

Items that were skipped (fileId = "SKIPPED") show a placeholder with the skip reason instead of a thumbnail.

Tapping a thumbnail opens a full-screen image/video viewer overlay (lightbox). The lightbox shows the full image, patient name, action details, timestamp, and who performed it.

On desktop, the carousel shows 5-6 items visible. On mobile, 2.5 items visible (to hint at scrollability).

If no proofs exist for today, the carousel shows a "No proofs recorded today" message.

### 3. Overdue Alerts

A collapsible section showing overdue medications and feedings. Hidden entirely if nothing is overdue.

Each alert shows:
- Patient name
- What's overdue (drug name + scheduled time, or food type + scheduled time)
- Minutes overdue (calculated from scheduled time vs now in IST)
- Tapping navigates to the patient detail page's Today tab

Sorted by most overdue first. Maximum 10 items shown, with "View all" if more exist.

### 4. Patient Cards

A vertical list of cards, one per active patient. Sorted by condition severity (CRITICAL first, then GUARDED, STABLE, IMPROVING, RECOVERED).

Each card shows:
- **Condition badge** — colored dot (red=CRITICAL, orange=GUARDED, green=STABLE, blue=IMPROVING)
- **Patient name** and species
- **Diagnosis** (truncated to 1 line)
- **Ward + Cage** — e.g., "GENERAL · G-03"
- **Attending doctor**
- **Day N** — days since admission
- **Meds progress** — "3/5 given" with small progress indicator
- **Food progress** — "1/3 fed" with small progress indicator
- **Latest vitals summary** — temperature and heart rate, with abnormal flags (↑ HIGH / ↓ LOW)
- **Proof count** — "3 proofs today" with camera icon

Tapping a card navigates to `/management/patients/[admissionId]?tab=today`.

**Filtering:** Ward filter buttons (ALL / GENERAL / ISOLATION / ICU) above the cards. No condition filter — cards are already sorted by severity.

**Registered patients:** A separate collapsed section below active patient cards showing patients awaiting clinical setup, with a count badge.

---

## Patient Detail Page

The patient detail page has a header and 3 tabs.

### Header

- Back arrow → returns to dashboard
- Patient name, species, breed
- Condition badge (colored, prominent)
- Ward + Cage badge
- Diagnosis (full text, not truncated)
- Attending doctor
- Admission date + "Day N" count

### Tab: Today (default)

Shows everything happening today for this patient. This is the tab management will use 90% of the time.

**Medications section:**
- Header: "Medications (3/5 given)" with progress fraction
- For each active treatment plan, grouped by scheduled time:
  - Time slot (e.g., "08:00")
  - Drug name + dose + route
  - Status: given (green check + "by [name]" + time), skipped (orange + reason), overdue (red + minutes), pending (gray)
  - **Inline proof thumbnail** next to given/skipped entries — if a proof attachment exists for this administration, show the thumbnail right there. Tap to open lightbox.
  - If no proof: show "no proof" in muted text

**Feeding section:**
- Header: "Feeding (1/3 fed)" with progress fraction
- Diet type and instructions (collapsible)
- For each feeding schedule:
  - Time + food type + portion
  - Status: EATEN/PARTIAL/REFUSED/SKIPPED/PENDING with appropriate color
  - Amount consumed (if logged)
  - Who logged it
  - **Inline proof thumbnail** if proof exists for this feeding log
  - If no proof: "no proof" muted

**Vitals section:**
- Header: "Latest Vitals"
- Most recent vital record displayed as a compact grid:
  - Temperature (with abnormal flag)
  - Heart Rate (with abnormal flag)
  - Respiratory Rate (with abnormal flag)
  - Pain Score (with abnormal flag)
  - SpO2, CRT, weight if available
- Recorded by + timestamp
- If no vitals recorded today: "No vitals recorded today" with last recorded date

**IV Fluids section** (if any active):
- Fluid type, rate, additives
- Start time

**Bath status:**
- Last bath date + "N days ago"
- Due/overdue indicator
- Proof thumbnail if bath has proof

**Isolation section** (if patient is in isolation):
- Disease, PPE required, disinfectant
- Disinfection interval + last disinfection time
- Overdue warning if past interval

### Tab: History

Shows retrospective clinical data.

**Clinical Notes** — reverse chronological list of all notes. Each shows: category badge, content, recorded by (name + role), timestamp.

**Lab Results** — reverse chronological list. Each shows: test name, type, result, normal/abnormal badge, date, notes.

**Activity Timeline** — the existing logs timeline showing all actions (meds given, vitals recorded, feedings logged, baths, notes, disinfections) in chronological order.

### Tab: Media

All photos and videos organized by category.

**Category filter buttons:** ALL / Patient Photos / Medication / Feeding / Bath / Vitals / Disinfection

**Grid layout:** 3 columns on mobile, 4 on desktop. Each item shows:
- Thumbnail image
- Category badge overlay (small, bottom-left)
- Timestamp overlay (bottom-right)
- Patient name (if viewing from "all" filter on dashboard)

Tapping opens the same full-screen lightbox viewer.

**Skipped proofs** shown separately at the bottom with skip reasons — no thumbnail, just text entries.

---

## Data Requirements

### New query: Dashboard proof carousel

Fetch the 20 most recent proof attachments from today across all active admissions, with their associated record context (which patient, what action type, who did it).

This requires joining ProofAttachment with MedicationAdministration/FeedingLog/BathLog/VitalRecord/DisinfectionLog to determine the action type and patient name. The query should return: fileId, fileName, patientName, actionType, performedBy, timestamp.

### New query: Patient today view with inline proofs

Extend the existing medication and feeding queries to include associated proof attachments. For each MedicationAdministration record, LEFT JOIN ProofAttachment where recordType = "MedicationAdministration" and recordId matches. Same for FeedingLog, BathLog, VitalRecord.

### Reuse existing queries

- Dashboard stats (active count, condition counts) — reuse `getDashboardSummary` pattern
- Overdue calculations — reuse existing overdue logic from notification snapshot
- Patient shell data — reuse `getManagementPatientPageShell`
- History tab data — reuse `getPatientNotesData`, `getPatientLabsData`, existing logs queries
- Media tab data — reuse `getPatientPhotosData` + `getManagementPatientMediaProofs`

---

## Lightbox Viewer

A full-screen overlay component for viewing proof photos and videos.

- Shows the image/video at full resolution
- Displays: patient name, action type (e.g., "Medication — Ceftriaxone 08:00"), performed by, timestamp
- Swipe left/right to navigate between proofs (within the same context — carousel or patient)
- Close button (X) or swipe down to dismiss
- Video playback controls if the file is a video

This is a shared component used by both the dashboard carousel and the patient detail inline thumbnails.

---

## Mobile Considerations

- All layouts are mobile-first (this is primarily used on phones)
- Stat strip: 4 compact cells, icons + numbers only on small screens
- Proof carousel: 2.5 items visible, horizontal scroll with momentum
- Patient cards: full-width stacked, no side-by-side grid on mobile
- Patient detail tabs: 3 tabs fit comfortably on any screen (no horizontal scroll needed)
- Inline proof thumbnails: small (48x48) next to each entry, tap to expand
- Lightbox: full-screen with gesture controls (swipe)

---

## Files to Modify

- `src/app/(management)/management/page.tsx` — complete rewrite of dashboard
- `src/app/(management)/management/patients/[admissionId]/page.tsx` — complete rewrite of patient detail
- `src/lib/management-patient-page-queries.ts` — add proof-inline queries
- `src/lib/management-patient-page-data.ts` — update data assembly
- New: `src/components/management/proof-carousel.tsx` — dashboard proof strip
- New: `src/components/management/patient-card.tsx` — dashboard patient card
- New: `src/components/management/proof-lightbox.tsx` — full-screen viewer
- New: `src/components/management/today-tab.tsx` — patient today view
- New: `src/components/management/history-tab.tsx` — patient history view
- New: `src/components/management/media-gallery.tsx` — patient media grid with filters
- New: `src/lib/management-dashboard-queries.ts` — new dashboard queries including proof carousel
