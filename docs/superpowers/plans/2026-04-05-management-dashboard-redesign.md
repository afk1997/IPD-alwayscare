# Management Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the management dashboard with a proof carousel + patient cards hybrid layout, and collapse the 10-tab patient detail page into 3 tabs (Today, History, Media) with inline proof thumbnails.

**Architecture:** Server Components for data fetching, Client Components only for interactivity (carousel scroll, lightbox, tab switching). Reuse existing `/api/media` proxy for thumbnails. New dashboard query fetches proof attachments with patient context for the carousel. Patient detail page loads Today tab by default with meds/feedings that include inline proof data.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma/Neon, Tailwind CSS, shadcn/ui components, `@base-ui/react`.

---

## File Map

- `src/lib/management-dashboard-queries.ts` (CREATE)
  Dashboard data queries: proof carousel, stats, overdue items, patient cards.
- `src/components/management/proof-carousel.tsx` (CREATE)
  Horizontally scrollable proof strip with thumbnails.
- `src/components/management/proof-lightbox.tsx` (CREATE)
  Full-screen image/video viewer overlay with swipe navigation.
- `src/components/management/patient-card.tsx` (CREATE)
  Compact patient card showing status + progress + proof count.
- `src/components/management/today-tab.tsx` (CREATE)
  Patient Today tab: meds, feeding, vitals, bath, isolation with inline proofs.
- `src/components/management/history-tab.tsx` (CREATE)
  Patient History tab: notes, labs, activity timeline.
- `src/components/management/media-gallery.tsx` (CREATE)
  Filterable photo/video grid with category filter buttons.
- `src/lib/management-patient-page-queries.ts` (MODIFY)
  Add proof-inline queries for Today tab.
- `src/lib/management-patient-page-data.ts` (MODIFY)
  Update tab types from 10 to 3, update load plan.
- `src/app/(management)/management/page.tsx` (REWRITE)
  Dashboard with hybrid layout.
- `src/app/(management)/management/patients/[admissionId]/page.tsx` (REWRITE)
  Patient detail with 3 tabs.

---

### Task 1: Create Dashboard Data Queries

**Files:**
- Create: `src/lib/management-dashboard-queries.ts`

- [ ] **Step 1: Create the dashboard queries file**

```ts
import { db } from "@/lib/db";
import { getTodayUTCDate, getNowTimeIST } from "@/lib/date-utils";
import { hasAnyAbnormalVital } from "@/lib/vitals-thresholds";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export interface ProofCarouselItem {
  fileId: string;
  fileName: string;
  patientName: string;
  actionType: "Med" | "Fed" | "Bath" | "Vitals" | "Disinfect";
  actionDetail: string;
  performedBy: string;
  timestamp: Date;
  isSkipped: boolean;
  skipReason: string | null;
}

export interface OverdueItem {
  admissionId: string;
  patientName: string;
  label: string;
  minutesLate: number;
  type: "MED" | "FOOD";
}

export interface PatientCardData {
  admissionId: string;
  patientId: string;
  patientName: string;
  species: string;
  diagnosis: string | null;
  ward: string | null;
  cageNumber: string | null;
  condition: string | null;
  attendingDoctor: string | null;
  admissionDate: Date;
  medsGiven: number;
  medsTotal: number;
  feedsLogged: number;
  feedsTotal: number;
  latestTemp: number | null;
  latestHR: number | null;
  tempAbnormal: boolean;
  hrAbnormal: boolean;
  proofCountToday: number;
}

export interface ManagementDashboardData {
  stats: { active: number; critical: number; overdueMeds: number; overdueFeeds: number; registered: number };
  proofCarousel: ProofCarouselItem[];
  overdueItems: OverdueItem[];
  patientCards: PatientCardData[];
  registeredPatients: { admissionId: string; patientName: string; species: string; admittedBy: string }[];
}

export async function getManagementDashboardData(wardFilter?: string): Promise<ManagementDashboardData> {
  const today = getTodayUTCDate();
  const nowTime = getNowTimeIST();
  const nowMinutes = toMinutes(nowTime);

  // Single comprehensive query for all active + registered admissions
  const admissions = await db.admission.findMany({
    where: {
      status: { in: ["ACTIVE", "REGISTERED"] },
      deletedAt: null,
      patient: { deletedAt: null },
      ...(wardFilter && wardFilter !== "ALL" ? { ward: wardFilter as any } : {}),
    },
    include: {
      patient: { select: { id: true, name: true, species: true } },
      admittedBy: { select: { name: true } },
      vitalRecords: { orderBy: { recordedAt: "desc" }, take: 1 },
      treatmentPlans: {
        where: { isActive: true, deletedAt: null },
        include: {
          administrations: { where: { scheduledDate: today } },
        },
      },
      dietPlans: {
        where: { isActive: true, deletedAt: null },
        include: {
          feedingSchedules: {
            where: { isActive: true },
            include: { feedingLogs: { where: { date: today }, take: 1 } },
          },
        },
      },
      bathLogs: { orderBy: { bathedAt: "desc" }, take: 1 },
    },
    orderBy: { admissionDate: "desc" },
  });

  const active = admissions.filter((a) => a.status === "ACTIVE");
  const registered = admissions.filter((a) => a.status === "REGISTERED");

  // Build overdue items
  const overdueItems: OverdueItem[] = [];
  for (const a of active) {
    for (const plan of a.treatmentPlans) {
      for (const slot of (plan.scheduledTimes as string[])) {
        const done = plan.administrations.find(
          (adm) => adm.scheduledTime === slot && (adm.wasAdministered || adm.wasSkipped),
        );
        if (done) continue;
        const minutesLate = nowMinutes - toMinutes(slot);
        if (minutesLate > 30) {
          overdueItems.push({
            admissionId: a.id,
            patientName: a.patient.name,
            label: `${plan.drugName} ${slot}`,
            minutesLate,
            type: "MED",
          });
        }
      }
    }
    for (const diet of a.dietPlans) {
      for (const schedule of diet.feedingSchedules) {
        const log = schedule.feedingLogs[0];
        const isDone = log && log.status !== "PENDING";
        const minutesLate = nowMinutes - toMinutes(schedule.scheduledTime);
        if (!isDone && minutesLate > 30) {
          overdueItems.push({
            admissionId: a.id,
            patientName: a.patient.name,
            label: `${schedule.foodType} ${schedule.scheduledTime}`,
            minutesLate,
            type: "FOOD",
          });
        }
      }
    }
  }
  overdueItems.sort((a, b) => b.minutesLate - a.minutesLate);

  // Build patient cards
  const patientCards: PatientCardData[] = active.map((a) => {
    let medsTotal = 0;
    let medsGiven = 0;
    for (const plan of a.treatmentPlans) {
      for (const slot of (plan.scheduledTimes as string[])) {
        if (toMinutes(slot) <= nowMinutes) {
          medsTotal++;
          const done = plan.administrations.find(
            (adm) => adm.scheduledTime === slot && (adm.wasAdministered || adm.wasSkipped),
          );
          if (done) medsGiven++;
        }
      }
    }

    let feedsTotal = 0;
    let feedsLogged = 0;
    for (const diet of a.dietPlans) {
      for (const schedule of diet.feedingSchedules) {
        if (toMinutes(schedule.scheduledTime) <= nowMinutes) {
          feedsTotal++;
          const log = schedule.feedingLogs[0];
          if (log && log.status !== "PENDING") feedsLogged++;
        }
      }
    }

    const v = a.vitalRecords[0];
    const { checkTemperature, checkHeartRate } = require("@/lib/vitals-thresholds");

    return {
      admissionId: a.id,
      patientId: a.patient.id,
      patientName: a.patient.name,
      species: a.patient.species,
      diagnosis: a.diagnosis,
      ward: a.ward,
      cageNumber: a.cageNumber,
      condition: a.condition,
      attendingDoctor: a.attendingDoctor,
      admissionDate: a.admissionDate,
      medsGiven,
      medsTotal,
      feedsLogged,
      feedsTotal,
      latestTemp: v?.temperature ?? null,
      latestHR: v?.heartRate ?? null,
      tempAbnormal: v ? checkTemperature(v.temperature).isAbnormal : false,
      hrAbnormal: v ? checkHeartRate(v.heartRate).isAbnormal : false,
      proofCountToday: 0, // will be filled from proof query
    };
  });

  // Condition sort order
  const conditionOrder: Record<string, number> = { CRITICAL: 0, GUARDED: 1, STABLE: 2, IMPROVING: 3, RECOVERED: 4 };
  patientCards.sort((a, b) => (conditionOrder[a.condition ?? ""] ?? 5) - (conditionOrder[b.condition ?? ""] ?? 5));

  // Proof carousel: fetch today's proofs across all admissions
  const activeAdmissionIds = active.map((a) => a.id);
  const proofCarousel = await getRecentProofs(activeAdmissionIds, today);

  // Fill proof counts per patient
  for (const card of patientCards) {
    card.proofCountToday = proofCarousel.filter((p) => {
      // Match by patient name since proofs carry patient context
      return p.patientName === card.patientName;
    }).length;
  }

  // Stats
  const criticalCount = active.filter((a) => {
    if (a.condition === "CRITICAL") return true;
    const v = a.vitalRecords[0];
    return v ? hasAnyAbnormalVital(v) : false;
  }).length;

  return {
    stats: {
      active: active.length,
      critical: criticalCount,
      overdueMeds: overdueItems.filter((o) => o.type === "MED").length,
      overdueFeeds: overdueItems.filter((o) => o.type === "FOOD").length,
      registered: registered.length,
    },
    proofCarousel,
    overdueItems: overdueItems.slice(0, 10),
    patientCards,
    registeredPatients: registered.map((a) => ({
      admissionId: a.id,
      patientName: a.patient.name,
      species: a.patient.species,
      admittedBy: a.admittedBy.name,
    })),
  };
}

async function getRecentProofs(admissionIds: string[], today: Date): Promise<ProofCarouselItem[]> {
  if (admissionIds.length === 0) return [];

  // Get all record IDs from today for these admissions
  const [medAdmins, feedingLogs, bathLogs, vitalRecords, disinfectionLogs] = await Promise.all([
    db.medicationAdministration.findMany({
      where: { treatmentPlan: { admissionId: { in: admissionIds } }, scheduledDate: today },
      select: { id: true, scheduledTime: true, actualTime: true, treatmentPlan: { select: { drugName: true, admission: { select: { patient: { select: { name: true } } } } } }, administeredBy: { select: { name: true } } },
    }),
    db.feedingLog.findMany({
      where: { feedingSchedule: { dietPlan: { admissionId: { in: admissionIds } } }, date: today, status: { not: "PENDING" } },
      select: { id: true, createdAt: true, feedingSchedule: { select: { foodType: true, dietPlan: { select: { admission: { select: { patient: { select: { name: true } } } } } } } }, loggedBy: { select: { name: true } } },
    }),
    db.bathLog.findMany({
      where: { admissionId: { in: admissionIds }, bathedAt: { gte: today } },
      select: { id: true, bathedAt: true, admission: { select: { patient: { select: { name: true } } } }, bathedBy: { select: { name: true } } },
    }),
    db.vitalRecord.findMany({
      where: { admissionId: { in: admissionIds }, recordedAt: { gte: today } },
      select: { id: true, recordedAt: true, admission: { select: { patient: { select: { name: true } } } }, recordedBy: { select: { name: true } } },
    }),
    db.disinfectionLog.findMany({
      where: { isolationProtocol: { admissionId: { in: admissionIds } }, performedAt: { gte: today } },
      select: { id: true, performedAt: true, isolationProtocol: { select: { admission: { select: { patient: { select: { name: true } } } } } }, performedBy: { select: { name: true } } },
    }),
  ]);

  // Collect all record IDs
  const allRecordIds = [
    ...medAdmins.map((r) => r.id),
    ...feedingLogs.map((r) => r.id),
    ...bathLogs.map((r) => r.id),
    ...vitalRecords.map((r) => r.id),
    ...disinfectionLogs.map((r) => r.id),
  ];

  if (allRecordIds.length === 0) return [];

  // Fetch proof attachments for these records
  const proofs = await db.proofAttachment.findMany({
    where: { recordId: { in: allRecordIds } },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Map proofs to carousel items with context
  const recordContextMap = new Map<string, { patientName: string; actionType: ProofCarouselItem["actionType"]; actionDetail: string; performedBy: string; timestamp: Date }>();

  for (const r of medAdmins) {
    recordContextMap.set(r.id, { patientName: r.treatmentPlan.admission.patient.name, actionType: "Med", actionDetail: r.treatmentPlan.drugName, performedBy: r.administeredBy?.name ?? "Unknown", timestamp: r.actualTime ?? new Date() });
  }
  for (const r of feedingLogs) {
    recordContextMap.set(r.id, { patientName: r.feedingSchedule.dietPlan.admission.patient.name, actionType: "Fed", actionDetail: r.feedingSchedule.foodType, performedBy: r.loggedBy.name, timestamp: r.createdAt });
  }
  for (const r of bathLogs) {
    recordContextMap.set(r.id, { patientName: r.admission.patient.name, actionType: "Bath", actionDetail: "Bath", performedBy: r.bathedBy.name, timestamp: r.bathedAt });
  }
  for (const r of vitalRecords) {
    recordContextMap.set(r.id, { patientName: r.admission.patient.name, actionType: "Vitals", actionDetail: "Vitals", performedBy: r.recordedBy.name, timestamp: r.recordedAt });
  }
  for (const r of disinfectionLogs) {
    recordContextMap.set(r.id, { patientName: r.isolationProtocol.admission.patient.name, actionType: "Disinfect", actionDetail: "Disinfection", performedBy: r.performedBy.name, timestamp: r.performedAt });
  }

  return proofs.map((proof) => {
    const ctx = recordContextMap.get(proof.recordId);
    return {
      fileId: proof.fileId,
      fileName: proof.fileName,
      patientName: ctx?.patientName ?? "Unknown",
      actionType: ctx?.actionType ?? "Vitals",
      actionDetail: ctx?.actionDetail ?? "",
      performedBy: ctx?.performedBy ?? proof.uploadedBy.name,
      timestamp: ctx?.timestamp ?? proof.createdAt,
      isSkipped: proof.fileId === "SKIPPED",
      skipReason: proof.skipReason,
    };
  });
}
```

- [ ] **Step 2: Verify the module imports cleanly**

Run: `node --env-file=.env --env-file=.env.local --import tsx -e "import('@/lib/management-dashboard-queries').then(() => console.log('OK'))"`

Expected: prints "OK" (may fail in eval context — try from a file if needed).

- [ ] **Step 3: Commit**

```bash
git add src/lib/management-dashboard-queries.ts
git commit -m "feat(management): add dashboard data queries with proof carousel"
```

---

### Task 2: Create Proof Lightbox Component

**Files:**
- Create: `src/components/management/proof-lightbox.tsx`

- [ ] **Step 1: Create the lightbox component**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";

interface LightboxItem {
  fileId: string;
  patientName: string;
  actionType: string;
  actionDetail: string;
  performedBy: string;
  timestamp: Date;
  isSkipped: boolean;
  skipReason: string | null;
}

interface ProofLightboxProps {
  items: LightboxItem[];
  initialIndex: number;
  onClose: () => void;
}

export function ProofLightbox({ items, initialIndex, onClose }: ProofLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const item = items[index];

  const prev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : items.length - 1)), [items.length]);
  const next = useCallback(() => setIndex((i) => (i < items.length - 1 ? i + 1 : 0)), [items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  if (!item) return null;

  const timeStr = formatInTimeZone(new Date(item.timestamp), "Asia/Kolkata", "dd/MM HH:mm");

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="font-medium truncate">{item.patientName}</p>
          <p className="text-sm text-white/70">{item.actionType} — {item.actionDetail} · {timeStr} · {item.performedBy}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full shrink-0">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center relative" onClick={(e) => e.stopPropagation()}>
        {items.length > 1 && (
          <button onClick={prev} className="absolute left-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 z-10">
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {item.isSkipped ? (
          <div className="text-white text-center p-8">
            <p className="text-lg">Proof Skipped</p>
            <p className="text-white/70 mt-2">{item.skipReason ?? "No reason provided"}</p>
          </div>
        ) : (
          <img
            src={`/api/media?id=${item.fileId}`}
            alt={`${item.actionType} proof for ${item.patientName}`}
            className="max-h-[80vh] max-w-full object-contain"
          />
        )}

        {items.length > 1 && (
          <button onClick={next} className="absolute right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 z-10">
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {items.length > 1 && (
        <div className="text-center text-white/50 text-sm pb-4">
          {index + 1} / {items.length}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/management/proof-lightbox.tsx
git commit -m "feat(management): add proof lightbox viewer"
```

---

### Task 3: Create Proof Carousel Component

**Files:**
- Create: `src/components/management/proof-carousel.tsx`

- [ ] **Step 1: Create the carousel component**

```tsx
"use client";

import { useRef, useState } from "react";
import type { ProofCarouselItem } from "@/lib/management-dashboard-queries";
import { ProofLightbox } from "./proof-lightbox";
import { formatInTimeZone } from "date-fns-tz";
import { Camera } from "lucide-react";

interface ProofCarouselProps {
  items: ProofCarouselItem[];
}

const ACTION_COLORS: Record<string, string> = {
  Med: "bg-blue-100 text-blue-700",
  Fed: "bg-green-100 text-green-700",
  Bath: "bg-cyan-100 text-cyan-700",
  Vitals: "bg-purple-100 text-purple-700",
  Disinfect: "bg-orange-100 text-orange-700",
};

export function ProofCarousel({ items }: ProofCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-muted-foreground text-sm">
        <Camera className="w-5 h-5 mx-auto mb-1 opacity-50" />
        No proofs recorded today
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Proofs</h3>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 pb-3 snap-x snap-mandatory scrollbar-none"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {items.map((item, i) => (
          <button
            key={`${item.fileId}-${i}`}
            className="shrink-0 w-28 snap-start rounded-lg overflow-hidden border bg-card shadow-sm active:scale-95 transition-transform"
            onClick={() => setLightboxIndex(i)}
          >
            {item.isSkipped ? (
              <div className="h-24 bg-muted flex items-center justify-center text-xs text-muted-foreground px-2 text-center">
                Skipped
              </div>
            ) : (
              <img
                src={`/api/media?id=${item.fileId}`}
                alt={`${item.actionType} proof`}
                className="h-24 w-full object-cover"
                loading="lazy"
              />
            )}
            <div className="p-1.5">
              <p className="text-[10px] font-medium truncate">{item.patientName}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${ACTION_COLORS[item.actionType] ?? "bg-gray-100 text-gray-700"}`}>
                  {item.actionType}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {formatInTimeZone(new Date(item.timestamp), "Asia/Kolkata", "HH:mm")}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <ProofLightbox
          items={items}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/management/proof-carousel.tsx
git commit -m "feat(management): add proof carousel strip"
```

---

### Task 4: Create Patient Card Component

**Files:**
- Create: `src/components/management/patient-card.tsx`

- [ ] **Step 1: Create the patient card component**

```tsx
import Link from "next/link";
import type { PatientCardData } from "@/lib/management-dashboard-queries";
import { Camera } from "lucide-react";
import { differenceInDays } from "date-fns";

const CONDITION_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-500",
  GUARDED: "bg-orange-500",
  STABLE: "bg-green-500",
  IMPROVING: "bg-blue-500",
  RECOVERED: "bg-emerald-500",
};

export function PatientCard({ patient }: { patient: PatientCardData }) {
  const dayNum = differenceInDays(new Date(), patient.admissionDate) + 1;

  return (
    <Link
      href={`/management/patients/${patient.admissionId}?tab=today`}
      className="block border rounded-xl p-3 bg-card shadow-sm active:bg-muted/50 transition-colors"
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${CONDITION_STYLES[patient.condition ?? ""] ?? "bg-gray-400"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm truncate">{patient.patientName}</h3>
            <span className="text-[10px] text-muted-foreground shrink-0">Day {dayNum}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{patient.diagnosis}</p>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
            <span>{patient.ward} · {patient.cageNumber}</span>
            <span>· {patient.attendingDoctor}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2 text-xs">
        <span className={patient.medsGiven < patient.medsTotal ? "text-amber-600 font-medium" : "text-green-600"}>
          Meds {patient.medsGiven}/{patient.medsTotal}
        </span>
        <span className={patient.feedsLogged < patient.feedsTotal ? "text-amber-600 font-medium" : "text-green-600"}>
          Food {patient.feedsLogged}/{patient.feedsTotal}
        </span>

        {patient.latestTemp != null && (
          <span className={patient.tempAbnormal ? "text-red-600 font-medium" : "text-muted-foreground"}>
            {patient.latestTemp}°C{patient.tempAbnormal ? " ↑" : ""}
          </span>
        )}
        {patient.latestHR != null && (
          <span className={patient.hrAbnormal ? "text-red-600 font-medium" : "text-muted-foreground"}>
            HR {patient.latestHR}{patient.hrAbnormal ? " ↑" : ""}
          </span>
        )}

        {patient.proofCountToday > 0 && (
          <span className="text-muted-foreground flex items-center gap-0.5 ml-auto">
            <Camera className="w-3 h-3" /> {patient.proofCountToday}
          </span>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/management/patient-card.tsx
git commit -m "feat(management): add patient card component"
```

---

### Task 5: Rewrite Management Dashboard Page

**Files:**
- Rewrite: `src/app/(management)/management/page.tsx`

- [ ] **Step 1: Rewrite the dashboard page**

```tsx
import Link from "next/link";
import { getManagementDashboardData } from "@/lib/management-dashboard-queries";
import { ProofCarousel } from "@/components/management/proof-carousel";
import { PatientCard } from "@/components/management/patient-card";
import { AlertTriangle, Users, HeartPulse, Pill, Utensils } from "lucide-react";

interface ManagementPageProps {
  searchParams: Promise<{ ward?: string }>;
}

const WARDS = ["ALL", "GENERAL", "ISOLATION", "ICU"] as const;

export default async function ManagementDashboardPage({ searchParams }: ManagementPageProps) {
  const { ward } = await searchParams;
  const data = await getManagementDashboardData(ward);

  return (
    <div className="pb-8">
      {/* Stat Strip */}
      <div className="grid grid-cols-4 gap-2 p-4">
        <StatCard icon={<Users className="w-4 h-4" />} value={data.stats.active} label="Active" />
        <StatCard icon={<HeartPulse className="w-4 h-4 text-red-500" />} value={data.stats.critical} label="Critical" alert={data.stats.critical > 0} />
        <StatCard icon={<Pill className="w-4 h-4 text-amber-500" />} value={data.stats.overdueMeds} label="Meds Due" alert={data.stats.overdueMeds > 0} />
        <StatCard icon={<Utensils className="w-4 h-4 text-amber-500" />} value={data.stats.overdueFeeds} label="Feeds Due" alert={data.stats.overdueFeeds > 0} />
      </div>

      {/* Proof Carousel */}
      <div className="border-y bg-muted/30">
        <ProofCarousel items={data.proofCarousel} />
      </div>

      {/* Overdue Alerts */}
      {data.overdueItems.length > 0 && (
        <div className="px-4 pt-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <h3 className="text-xs font-medium text-amber-800 flex items-center gap-1 mb-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              {data.overdueItems.length} Overdue
            </h3>
            <div className="space-y-1">
              {data.overdueItems.map((item, i) => (
                <Link
                  key={i}
                  href={`/management/patients/${item.admissionId}?tab=today`}
                  className="flex items-center justify-between text-xs py-1 hover:bg-amber-100 rounded px-1 -mx-1"
                >
                  <span className="truncate">
                    <span className="font-medium">{item.patientName}</span>: {item.label}
                  </span>
                  <span className="text-amber-700 shrink-0 ml-2">{item.minutesLate}m</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ward Filter */}
      <div className="flex gap-1.5 px-4 pt-4">
        {WARDS.map((w) => (
          <Link
            key={w}
            href={w === "ALL" ? "/management" : `/management?ward=${w}`}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              (ward ?? "ALL") === w
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {w}
          </Link>
        ))}
      </div>

      {/* Patient Cards */}
      <div className="space-y-2 px-4 pt-3">
        {data.patientCards.map((patient) => (
          <PatientCard key={patient.admissionId} patient={patient} />
        ))}
        {data.patientCards.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No active patients{ward ? ` in ${ward}` : ""}</p>
        )}
      </div>

      {/* Registered Patients */}
      {data.registeredPatients.length > 0 && (
        <div className="px-4 pt-4">
          <details className="rounded-lg border">
            <summary className="p-3 text-sm font-medium cursor-pointer">
              Awaiting Setup ({data.registeredPatients.length})
            </summary>
            <div className="border-t px-3 pb-3 space-y-2 pt-2">
              {data.registeredPatients.map((p) => (
                <div key={p.admissionId} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{p.patientName}</span> · {p.species} · by {p.admittedBy}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, alert }: { icon: React.ReactNode; value: number; label: string; alert?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 text-center ${alert ? "border-amber-300 bg-amber-50" : "bg-card"}`}>
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className="text-lg font-bold">{value}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run: `npm run dev` and open `/management` in a browser. Verify the new layout renders with stat strip, proof carousel (may be empty), and patient cards.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(management\)/management/page.tsx
git commit -m "feat(management): rewrite dashboard with hybrid proof+cards layout"
```

---

### Task 6: Create Today Tab, History Tab, and Media Gallery Components

**Files:**
- Create: `src/components/management/today-tab.tsx`
- Create: `src/components/management/history-tab.tsx`
- Create: `src/components/management/media-gallery.tsx`

- [ ] **Step 1: Create the Today tab component**

```tsx
"use client";

import { useState } from "react";
import { ProofLightbox } from "./proof-lightbox";
import { formatInTimeZone } from "date-fns-tz";
import { checkTemperature, checkHeartRate, checkRespRate, checkPainScore } from "@/lib/vitals-thresholds";
import { isBathDue } from "@/lib/date-utils";

interface ProofInfo {
  fileId: string;
  fileName: string;
  isSkipped: boolean;
  skipReason: string | null;
}

interface MedSlot {
  time: string;
  drugName: string;
  dose: string;
  route: string;
  wasAdministered: boolean;
  wasSkipped: boolean;
  skipReason: string | null;
  administeredBy: string | null;
  actualTime: Date | null;
  proof: ProofInfo | null;
}

interface FeedSlot {
  time: string;
  foodType: string;
  portion: string;
  status: string | null;
  amountConsumed: string | null;
  loggedBy: string | null;
  proof: ProofInfo | null;
}

interface TodayTabProps {
  meds: MedSlot[];
  medsGiven: number;
  medsTotal: number;
  feeds: FeedSlot[];
  feedsLogged: number;
  feedsTotal: number;
  latestVitals: {
    temperature: number | null;
    heartRate: number | null;
    respRate: number | null;
    painScore: number | null;
    spo2: number | null;
    weight: number | null;
    recordedBy: string;
    recordedAt: Date;
  } | null;
  bathLastDate: Date | null;
  isolation: {
    disease: string;
    ppeRequired: string[];
    disinfectant: string;
    disinfectionInterval: string;
    lastDisinfection: Date | null;
  } | null;
  fluidTherapies: { fluidType: string; rate: string; isActive: boolean }[];
  patientName: string;
}

export function TodayTab(props: TodayTabProps) {
  const [lightbox, setLightbox] = useState<{ items: ProofInfo[]; index: number } | null>(null);

  const allProofs = [
    ...props.meds.filter((m) => m.proof).map((m) => m.proof!),
    ...props.feeds.filter((f) => f.proof).map((f) => f.proof!),
  ];

  function openProof(proof: ProofInfo) {
    const idx = allProofs.findIndex((p) => p.fileId === proof.fileId);
    setLightbox({ items: allProofs, index: idx >= 0 ? idx : 0 });
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Medications */}
      <section>
        <h3 className="text-sm font-semibold px-1 mb-2">
          Medications ({props.medsGiven}/{props.medsTotal} given)
        </h3>
        <div className="space-y-1">
          {props.meds.map((slot, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg border bg-card text-sm">
              <StatusDot status={slot.wasAdministered ? "done" : slot.wasSkipped ? "skipped" : "pending"} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{slot.drugName}</span>
                  <span className="text-xs text-muted-foreground">{slot.time}</span>
                </div>
                <p className="text-xs text-muted-foreground">{slot.dose} · {slot.route}</p>
                {slot.wasAdministered && slot.administeredBy && (
                  <p className="text-xs text-green-600 mt-0.5">by {slot.administeredBy} at {slot.actualTime ? formatInTimeZone(new Date(slot.actualTime), "Asia/Kolkata", "HH:mm") : ""}</p>
                )}
                {slot.wasSkipped && <p className="text-xs text-amber-600 mt-0.5">Skipped: {slot.skipReason}</p>}
              </div>
              {slot.proof && (
                <button onClick={() => openProof(slot.proof!)} className="shrink-0">
                  {slot.proof.isSkipped ? (
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-[9px] text-muted-foreground">Skip</div>
                  ) : (
                    <img src={`/api/media?id=${slot.proof.fileId}`} alt="proof" className="w-12 h-12 rounded object-cover" loading="lazy" />
                  )}
                </button>
              )}
            </div>
          ))}
          {props.meds.length === 0 && <p className="text-xs text-muted-foreground px-1">No medications prescribed</p>}
        </div>
      </section>

      {/* Feeding */}
      <section>
        <h3 className="text-sm font-semibold px-1 mb-2">
          Feeding ({props.feedsLogged}/{props.feedsTotal} logged)
        </h3>
        <div className="space-y-1">
          {props.feeds.map((slot, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg border bg-card text-sm">
              <StatusDot status={slot.status && slot.status !== "PENDING" ? "done" : "pending"} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{slot.foodType}</span>
                  <span className="text-xs text-muted-foreground">{slot.time}</span>
                </div>
                <p className="text-xs text-muted-foreground">{slot.portion}</p>
                {slot.status && slot.status !== "PENDING" && (
                  <p className={`text-xs mt-0.5 ${slot.status === "EATEN" ? "text-green-600" : slot.status === "REFUSED" ? "text-red-600" : "text-amber-600"}`}>
                    {slot.status}{slot.amountConsumed ? ` · ${slot.amountConsumed}` : ""}{slot.loggedBy ? ` · ${slot.loggedBy}` : ""}
                  </p>
                )}
              </div>
              {slot.proof && (
                <button onClick={() => openProof(slot.proof!)} className="shrink-0">
                  <img src={`/api/media?id=${slot.proof.fileId}`} alt="proof" className="w-12 h-12 rounded object-cover" loading="lazy" />
                </button>
              )}
            </div>
          ))}
          {props.feeds.length === 0 && <p className="text-xs text-muted-foreground px-1">No diet plan</p>}
        </div>
      </section>

      {/* Vitals */}
      <section>
        <h3 className="text-sm font-semibold px-1 mb-2">Latest Vitals</h3>
        {props.latestVitals ? (
          <div className="p-3 rounded-lg border bg-card">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <VitalCell label="Temp" value={props.latestVitals.temperature} unit="°C" flag={checkTemperature(props.latestVitals.temperature)} />
              <VitalCell label="HR" value={props.latestVitals.heartRate} unit="bpm" flag={checkHeartRate(props.latestVitals.heartRate)} />
              <VitalCell label="RR" value={props.latestVitals.respRate} unit="/min" flag={checkRespRate(props.latestVitals.respRate)} />
              {props.latestVitals.painScore != null && <VitalCell label="Pain" value={props.latestVitals.painScore} unit="/10" flag={checkPainScore(props.latestVitals.painScore)} />}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {props.latestVitals.recordedBy} · {formatInTimeZone(new Date(props.latestVitals.recordedAt), "Asia/Kolkata", "HH:mm")}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground px-1">No vitals recorded today</p>
        )}
      </section>

      {/* IV Fluids */}
      {props.fluidTherapies.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold px-1 mb-2">IV Fluids</h3>
          {props.fluidTherapies.filter((f) => f.isActive).map((f, i) => (
            <div key={i} className="p-2 rounded-lg border bg-card text-sm">
              <span className="font-medium">{f.fluidType}</span> · {f.rate}
            </div>
          ))}
        </section>
      )}

      {/* Bath */}
      <section>
        <h3 className="text-sm font-semibold px-1 mb-2">Bath</h3>
        <div className="p-2 rounded-lg border bg-card text-sm">
          {props.bathLastDate ? (
            (() => {
              const status = isBathDue(props.bathLastDate);
              return (
                <span className={status.isOverdue ? "text-red-600 font-medium" : status.isDue ? "text-amber-600" : "text-muted-foreground"}>
                  Last: {status.daysSinceLast} days ago{status.isOverdue ? " — OVERDUE" : status.isDue ? " — DUE" : ""}
                </span>
              );
            })()
          ) : (
            <span className="text-amber-600">No bath recorded</span>
          )}
        </div>
      </section>

      {/* Isolation */}
      {props.isolation && (
        <section>
          <h3 className="text-sm font-semibold px-1 mb-2">Isolation</h3>
          <div className="p-3 rounded-lg border bg-card text-sm space-y-1">
            <p className="font-medium">{props.isolation.disease}</p>
            <p className="text-xs text-muted-foreground">PPE: {props.isolation.ppeRequired.join(", ")}</p>
            <p className="text-xs text-muted-foreground">Disinfectant: {props.isolation.disinfectant} · {props.isolation.disinfectionInterval}</p>
            {props.isolation.lastDisinfection && (
              <p className="text-xs text-muted-foreground">
                Last: {formatInTimeZone(new Date(props.isolation.lastDisinfection), "Asia/Kolkata", "HH:mm")}
              </p>
            )}
          </div>
        </section>
      )}

      {lightbox && (
        <ProofLightbox
          items={lightbox.items.map((p) => ({
            fileId: p.fileId,
            patientName: props.patientName,
            actionType: "Proof",
            actionDetail: p.fileName,
            performedBy: "",
            timestamp: new Date(),
            isSkipped: p.isSkipped,
            skipReason: p.skipReason,
          }))}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function StatusDot({ status }: { status: "done" | "skipped" | "pending" }) {
  const colors = { done: "bg-green-500", skipped: "bg-amber-500", pending: "bg-gray-300" };
  return <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${colors[status]}`} />;
}

function VitalCell({ label, value, unit, flag }: { label: string; value: number | null; unit: string; flag: { isAbnormal: boolean; label: string } }) {
  if (value == null) return null;
  return (
    <div className={flag.isAbnormal ? "text-red-600 font-medium" : ""}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p>{value}{unit} {flag.isAbnormal && flag.label}</p>
    </div>
  );
}
```

- [ ] **Step 2: Create the History tab component**

```tsx
import { formatInTimeZone } from "date-fns-tz";
import type { LogsTimelineEntry } from "@/lib/logs-read-model";

interface HistoryTabProps {
  notes: { id: string; category: string; content: string; recordedAt: Date; recordedBy: { name: string; role: string } }[];
  labs: { id: string; testName: string; testType: string; result: string; isAbnormal: boolean; resultDate: Date | null; notes: string | null }[];
  logEntries: LogsTimelineEntry[];
}

const CATEGORY_LABELS: Record<string, string> = {
  OBSERVATION: "Observation", BEHAVIOR: "Behavior", WOUND_CARE: "Wound Care",
  ELIMINATION: "Elimination", PROCEDURE: "Procedure", DOCTOR_ROUND: "Doctor Round",
  SHIFT_HANDOVER: "Shift Handover", OTHER: "Other",
};

export function HistoryTab({ notes, labs, logEntries }: HistoryTabProps) {
  return (
    <div className="space-y-6 pb-8">
      {/* Clinical Notes */}
      <section>
        <h3 className="text-sm font-semibold px-1 mb-2">Clinical Notes ({notes.length})</h3>
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="p-3 rounded-lg border bg-card text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">{CATEGORY_LABELS[note.category] ?? note.category}</span>
                <span className="text-[11px] text-muted-foreground">
                  {note.recordedBy.name} · {formatInTimeZone(new Date(note.recordedAt), "Asia/Kolkata", "dd/MM HH:mm")}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
          {notes.length === 0 && <p className="text-xs text-muted-foreground px-1">No clinical notes</p>}
        </div>
      </section>

      {/* Lab Results */}
      {labs.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold px-1 mb-2">Lab Results ({labs.length})</h3>
          <div className="space-y-2">
            {labs.map((lab) => (
              <div key={lab.id} className="p-3 rounded-lg border bg-card text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{lab.testName}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${lab.isAbnormal ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                    {lab.isAbnormal ? "ABNORMAL" : "NORMAL"}
                  </span>
                </div>
                <p className="text-xs mt-1">{lab.result}</p>
                {lab.notes && <p className="text-xs text-muted-foreground mt-1">{lab.notes}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Activity Timeline */}
      <section>
        <h3 className="text-sm font-semibold px-1 mb-2">Activity Log ({logEntries.length})</h3>
        <div className="space-y-1">
          {logEntries.slice(0, 50).map((entry, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 text-xs border-b last:border-0">
              <span className="text-muted-foreground shrink-0 w-10">
                {formatInTimeZone(new Date(entry.time), "Asia/Kolkata", "HH:mm")}
              </span>
              <span>{entry.icon}</span>
              <span className="flex-1">{entry.description}</span>
              {entry.by && <span className="text-muted-foreground shrink-0">{entry.by}</span>}
            </div>
          ))}
          {logEntries.length === 0 && <p className="text-xs text-muted-foreground px-1">No activity recorded</p>}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Create the Media Gallery component**

```tsx
"use client";

import { useState } from "react";
import { ProofLightbox } from "./proof-lightbox";

interface MediaItem {
  fileId: string;
  fileName: string;
  category: string;
  uploadedBy: string;
  createdAt: Date;
  isSkipped: boolean;
  skipReason: string | null;
}

interface MediaGalleryProps {
  patientPhotos: { fileId: string; fileName: string; uploadedBy: { name: string }; createdAt: Date }[];
  proofAttachments: MediaItem[];
  patientName: string;
}

const CATEGORIES = ["All", "Patient Photos", "Medication", "Feeding", "Bath", "Vitals", "Disinfection"] as const;

export function MediaGallery({ patientPhotos, proofAttachments, patientName }: MediaGalleryProps) {
  const [filter, setFilter] = useState<string>("All");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const allItems: MediaItem[] = [
    ...patientPhotos.map((p) => ({
      fileId: p.fileId,
      fileName: p.fileName,
      category: "Patient Photos",
      uploadedBy: p.uploadedBy.name,
      createdAt: p.createdAt,
      isSkipped: false,
      skipReason: null,
    })),
    ...proofAttachments.filter((p) => !p.isSkipped),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = filter === "All" ? allItems : allItems.filter((item) => item.category.toLowerCase().includes(filter.toLowerCase()));
  const skipped = proofAttachments.filter((p) => p.isSkipped);

  return (
    <div className="space-y-4 pb-8">
      {/* Category Filter */}
      <div className="flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === cat ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {filtered.map((item, i) => (
          <button
            key={`${item.fileId}-${i}`}
            onClick={() => setLightboxIndex(i)}
            className="relative aspect-square rounded-lg overflow-hidden bg-muted"
          >
            <img
              src={`/api/media?id=${item.fileId}`}
              alt={item.fileName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/60 text-white px-1 py-0.5 rounded">
              {item.category.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No media in this category</p>
      )}

      {/* Skipped Proofs */}
      {skipped.length > 0 && (
        <div className="px-1">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Skipped Proofs ({skipped.length})</h4>
          {skipped.map((s, i) => (
            <div key={i} className="text-xs text-muted-foreground py-1 border-b last:border-0">
              {s.category}: {s.skipReason ?? "No reason"}
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <ProofLightbox
          items={filtered.map((item) => ({
            fileId: item.fileId,
            patientName,
            actionType: item.category,
            actionDetail: item.fileName,
            performedBy: item.uploadedBy,
            timestamp: item.createdAt,
            isSkipped: item.isSkipped,
            skipReason: item.skipReason,
          }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/management/today-tab.tsx src/components/management/history-tab.tsx src/components/management/media-gallery.tsx
git commit -m "feat(management): add Today, History, Media tab components"
```

---

### Task 7: Update Data Layer and Rewrite Patient Detail Page

**Files:**
- Modify: `src/lib/management-patient-page-data.ts`
- Modify: `src/lib/management-patient-page-queries.ts`
- Rewrite: `src/app/(management)/management/patients/[admissionId]/page.tsx`

- [ ] **Step 1: Update tab types in management-patient-page-data.ts**

Replace the existing `ManagementPatientTabKey` type and load plan:

```ts
export type ManagementPatientTabKey = "today" | "history" | "media";

export interface ManagementPatientTabLoadPlan {
  today: boolean;
  history: boolean;
  media: boolean;
}

export function normalizeManagementPatientTab(tab: string | undefined): ManagementPatientTabKey {
  if (tab === "today" || tab === "history" || tab === "media") return tab;
  return "today";
}

export function getManagementPatientTabLoadPlan(tab: string): ManagementPatientTabLoadPlan {
  const normalized = normalizeManagementPatientTab(tab);
  return {
    today: normalized === "today",
    history: normalized === "history",
    media: normalized === "media",
  };
}
```

- [ ] **Step 2: Add proof-inline query in management-patient-page-queries.ts**

Add this new exported function:

```ts
export async function getManagementPatientTodayData(admissionId: string, today: Date) {
  const [admission, proofs] = await Promise.all([
    db.admission.findUnique({
      where: { id: admissionId },
      include: {
        vitalRecords: { orderBy: { recordedAt: "desc" }, take: 1, include: { recordedBy: { select: { name: true } } } },
        treatmentPlans: {
          where: { isActive: true, deletedAt: null },
          include: {
            administrations: {
              where: { scheduledDate: today },
              include: { administeredBy: { select: { name: true } } },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        dietPlans: {
          where: { isActive: true, deletedAt: null },
          include: {
            feedingSchedules: {
              where: { isActive: true },
              include: { feedingLogs: { where: { date: today }, take: 1, include: { loggedBy: { select: { name: true } } } } },
            },
          },
        },
        fluidTherapies: { where: { isActive: true }, select: { fluidType: true, rate: true, isActive: true } },
        bathLogs: { orderBy: { bathedAt: "desc" }, take: 1 },
        isolationProtocol: {
          include: { disinfectionLogs: { orderBy: { performedAt: "desc" }, take: 1 } },
        },
      },
    }),
    getManagementPatientMediaProofs(admissionId),
  ]);

  // Build proof lookup by recordId for inline display
  const proofByRecordId = new Map<string, { fileId: string; fileName: string; isSkipped: boolean; skipReason: string | null }>();
  for (const p of proofs) {
    proofByRecordId.set(p.recordId, { fileId: p.fileId, fileName: p.fileName, isSkipped: p.fileId === "SKIPPED", skipReason: p.skipReason });
  }

  return { admission, proofByRecordId };
}
```

- [ ] **Step 3: Rewrite the patient detail page**

Replace the entire content of `src/app/(management)/management/patients/[admissionId]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getManagementPatientPageShell, getManagementPatientTodayData, getManagementPatientMediaProofs } from "@/lib/management-patient-page-queries";
import { getPatientNotesData, getPatientLabsData, getPatientPhotosData } from "@/lib/patient-page-queries";
import { getLogsTimelineEntries } from "@/lib/logs-queries";
import { normalizeManagementPatientTab, getManagementPatientTabLoadPlan } from "@/lib/management-patient-page-data";
import { getTodayUTCDate, formatIST } from "@/lib/date-utils";
import { TodayTab } from "@/components/management/today-tab";
import { HistoryTab } from "@/components/management/history-tab";
import { MediaGallery } from "@/components/management/media-gallery";
import { differenceInDays } from "date-fns";
import { ArrowLeft } from "lucide-react";

const CONDITION_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  GUARDED: "bg-orange-100 text-orange-700",
  STABLE: "bg-green-100 text-green-700",
  IMPROVING: "bg-blue-100 text-blue-700",
  RECOVERED: "bg-emerald-100 text-emerald-700",
};

const TABS = [
  { key: "today", label: "Today" },
  { key: "history", label: "History" },
  { key: "media", label: "Media" },
] as const;

interface Props {
  params: Promise<{ admissionId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ManagementPatientPage({ params, searchParams }: Props) {
  const { admissionId } = await params;
  const query = await searchParams;
  const tab = normalizeManagementPatientTab(query.tab);
  const loadPlan = getManagementPatientTabLoadPlan(tab);
  const today = getTodayUTCDate();

  const shell = await getManagementPatientPageShell(admissionId);
  if (!shell || shell.patient.deletedAt) notFound();

  const dayNum = differenceInDays(new Date(), shell.admissionDate) + 1;

  // Load data based on active tab
  const [todayData, notes, labs, logEntries, patientPhotos, proofs] = await Promise.all([
    loadPlan.today ? getManagementPatientTodayData(admissionId, today) : Promise.resolve(null),
    loadPlan.history ? getPatientNotesData(admissionId) : Promise.resolve([]),
    loadPlan.history ? getPatientLabsData(admissionId) : Promise.resolve([]),
    loadPlan.history ? getLogsTimelineEntries(admissionId) : Promise.resolve([]),
    loadPlan.media ? getPatientPhotosData(shell.patientId) : Promise.resolve([]),
    loadPlan.media ? getManagementPatientMediaProofs(admissionId) : Promise.resolve([]),
  ]);

  // Build Today tab props if needed
  let todayProps = null;
  if (todayData?.admission) {
    const a = todayData.admission;
    const proofMap = todayData.proofByRecordId;

    const meds = a.treatmentPlans.flatMap((plan) =>
      (plan.scheduledTimes as string[]).map((time) => {
        const admin = plan.administrations.find((adm) => adm.scheduledTime === time);
        return {
          time,
          drugName: plan.drugName,
          dose: plan.dose,
          route: plan.route,
          wasAdministered: admin?.wasAdministered ?? false,
          wasSkipped: admin?.wasSkipped ?? false,
          skipReason: admin?.skipReason ?? null,
          administeredBy: admin?.administeredBy?.name ?? null,
          actualTime: admin?.actualTime ?? null,
          proof: admin ? proofMap.get(admin.id) ?? null : null,
        };
      }),
    ).sort((a, b) => a.time.localeCompare(b.time));

    const feeds = a.dietPlans.flatMap((diet) =>
      diet.feedingSchedules.map((schedule) => {
        const log = schedule.feedingLogs[0];
        return {
          time: schedule.scheduledTime,
          foodType: schedule.foodType,
          portion: schedule.portion ?? "",
          status: log?.status ?? null,
          amountConsumed: log?.amountConsumed ?? null,
          loggedBy: log?.loggedBy?.name ?? null,
          proof: log ? proofMap.get(log.id) ?? null : null,
        };
      }),
    ).sort((a, b) => a.time.localeCompare(b.time));

    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

    todayProps = {
      meds,
      medsGiven: meds.filter((m) => (m.wasAdministered || m.wasSkipped) && toMin(m.time) <= nowMinutes).length,
      medsTotal: meds.filter((m) => toMin(m.time) <= nowMinutes).length,
      feeds,
      feedsLogged: feeds.filter((f) => f.status && f.status !== "PENDING").length,
      feedsTotal: feeds.length,
      latestVitals: a.vitalRecords[0] ? {
        temperature: a.vitalRecords[0].temperature,
        heartRate: a.vitalRecords[0].heartRate,
        respRate: a.vitalRecords[0].respRate,
        painScore: a.vitalRecords[0].painScore,
        spo2: a.vitalRecords[0].spo2 ?? null,
        weight: a.vitalRecords[0].weight ?? null,
        recordedBy: a.vitalRecords[0].recordedBy.name,
        recordedAt: a.vitalRecords[0].recordedAt,
      } : null,
      bathLastDate: a.bathLogs[0]?.bathedAt ?? null,
      isolation: a.isolationProtocol ? {
        disease: a.isolationProtocol.disease,
        ppeRequired: a.isolationProtocol.ppeRequired as string[],
        disinfectant: a.isolationProtocol.disinfectant,
        disinfectionInterval: a.isolationProtocol.disinfectionInterval,
        lastDisinfection: a.isolationProtocol.disinfectionLogs[0]?.performedAt ?? null,
      } : null,
      fluidTherapies: a.fluidTherapies,
      patientName: shell.patient.name,
    };
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b space-y-1">
        <Link href="/management" className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
        <h1 className="text-lg font-bold">{shell.patient.name}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CONDITION_STYLES[shell.condition ?? ""] ?? "bg-gray-100"}`}>
            {shell.condition}
          </span>
          {shell.ward && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-medium">{shell.ward} · {shell.cageNumber}</span>}
          <span className="text-[10px] text-muted-foreground">Day {dayNum}</span>
        </div>
        <p className="text-sm text-muted-foreground">{shell.diagnosis}</p>
        <p className="text-xs text-muted-foreground">{shell.attendingDoctor} · Admitted {formatIST(shell.admissionDate)}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/management/patients/${admissionId}?tab=${t.key}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 pt-4">
        {tab === "today" && todayProps && <TodayTab {...todayProps} />}
        {tab === "history" && <HistoryTab notes={notes} labs={labs} logEntries={logEntries} />}
        {tab === "media" && (
          <MediaGallery
            patientPhotos={patientPhotos}
            proofAttachments={proofs.map((p) => ({
              fileId: p.fileId,
              fileName: p.fileName,
              category: p.category,
              uploadedBy: p.uploadedBy.name,
              createdAt: p.createdAt,
              isSkipped: p.fileId === "SKIPPED",
              skipReason: p.skipReason,
            }))}
            patientName={shell.patient.name}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify both pages render**

Run: `npm run dev` and test:
1. `/management` — should show new dashboard with stat strip, proof carousel, patient cards
2. `/management/patients/{id}?tab=today` — should show Today tab with inline proofs
3. `/management/patients/{id}?tab=history` — should show notes + labs + logs
4. `/management/patients/{id}?tab=media` — should show filterable gallery

- [ ] **Step 5: Run lint and build**

```bash
npm run lint
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/management-patient-page-data.ts src/lib/management-patient-page-queries.ts src/app/\(management\)/management/patients/\[admissionId\]/page.tsx
git commit -m "feat(management): rewrite patient detail with 3-tab layout and inline proofs"
```

---

## Self-Review

- **Spec coverage:** Dashboard hybrid layout (stat strip + proof carousel + overdue alerts + patient cards) — covered in Tasks 1-5. Patient detail 3-tab layout (Today/History/Media) — covered in Tasks 6-7. Lightbox viewer — Task 2. Inline proofs — Task 6 (TodayTab) + Task 7 (data layer). Mobile-first — all components use responsive Tailwind classes.
- **Placeholder scan:** No TBD, TODO, or "implement later" found. All code blocks are complete.
- **Type consistency:** `ProofCarouselItem` defined in Task 1, used in Task 3. `PatientCardData` defined in Task 1, used in Task 4. `ManagementPatientTabKey` updated in Task 7 from 10 values to 3. `TodayTab` props defined and consumed consistently.
