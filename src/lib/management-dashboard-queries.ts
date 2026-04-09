import { db } from "@/lib/db";
import { getTodayUTCDate, getNowTimeIST } from "@/lib/date-utils";
import { hasAnyAbnormalVital, checkTemperature, checkHeartRate } from "@/lib/vitals-thresholds";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export interface ProofCarouselItem {
  fileId: string;
  fileName: string;
  admissionId: string;
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
  patientNumber: string | null;
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
  registeredPatients: {
    admissionId: string;
    patientNumber: string | null;
    patientName: string;
    species: string;
    admittedBy: string;
  }[];
}

export async function getManagementDashboardData(wardFilter?: string): Promise<ManagementDashboardData> {
  const today = getTodayUTCDate();
  const nowTime = getNowTimeIST();
  const nowMinutes = toMinutes(nowTime);
  const ward =
    wardFilter === "GENERAL" ||
    wardFilter === "ISOLATION" ||
    wardFilter === "ICU"
      ? wardFilter
      : undefined;

  const admissions = await db.admission.findMany({
    where: {
      status: { in: ["ACTIVE", "REGISTERED"] },
      deletedAt: null,
      patient: { deletedAt: null },
      ...(ward ? { ward } : {}),
    },
    include: {
      patient: {
        select: { id: true, patientNumber: true, name: true, species: true },
      },
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
    },
    orderBy: { admissionDate: "desc" },
  });

  const active = admissions.filter((a) => a.status === "ACTIVE");
  const registered = admissions.filter((a) => a.status === "REGISTERED");

  // Overdue items
  const overdueItems: OverdueItem[] = [];
  for (const a of active) {
    for (const plan of a.treatmentPlans) {
      for (const slot of plan.scheduledTimes as string[]) {
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

  // Patient cards
  const conditionOrder: Record<string, number> = { CRITICAL: 0, GUARDED: 1, STABLE: 2, IMPROVING: 3, RECOVERED: 4 };
  const patientCards: PatientCardData[] = active.map((a) => {
    let medsTotal = 0;
    let medsGiven = 0;
    for (const plan of a.treatmentPlans) {
      for (const slot of plan.scheduledTimes as string[]) {
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
    return {
      admissionId: a.id,
      patientId: a.patient.id,
      patientNumber: a.patient.patientNumber,
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
      proofCountToday: 0,
    };
  });
  patientCards.sort((a, b) => (conditionOrder[a.condition ?? ""] ?? 5) - (conditionOrder[b.condition ?? ""] ?? 5));

  // Proof carousel
  const activeIds = active.map((a) => a.id);
  const proofCarousel = await getRecentProofs(activeIds, today);

  // Fill proof counts per patient card (keyed by admissionId to avoid name collisions)
  const proofCountByAdmission = new Map<string, number>();
  for (const p of proofCarousel) {
    proofCountByAdmission.set(p.admissionId, (proofCountByAdmission.get(p.admissionId) ?? 0) + 1);
  }
  for (const card of patientCards) {
    card.proofCountToday = proofCountByAdmission.get(card.admissionId) ?? 0;
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
      patientNumber: a.patient.patientNumber,
      patientName: a.patient.name,
      species: a.patient.species,
      admittedBy: a.admittedBy.name,
    })),
  };
}

async function getRecentProofs(admissionIds: string[], today: Date): Promise<ProofCarouselItem[]> {
  if (admissionIds.length === 0) return [];

  const [medAdmins, feedingLogs, bathLogs, vitalRecords, disinfectionLogs] = await Promise.all([
    db.medicationAdministration.findMany({
      where: { treatmentPlan: { admissionId: { in: admissionIds } }, scheduledDate: today },
      select: { id: true, scheduledTime: true, actualTime: true, treatmentPlan: { select: { drugName: true, admission: { select: { id: true, patient: { select: { name: true } } } } } }, administeredBy: { select: { name: true } } },
    }),
    db.feedingLog.findMany({
      where: { feedingSchedule: { dietPlan: { admissionId: { in: admissionIds } } }, date: today, status: { not: "PENDING" } },
      select: { id: true, createdAt: true, feedingSchedule: { select: { foodType: true, dietPlan: { select: { admission: { select: { id: true, patient: { select: { name: true } } } } } } } }, loggedBy: { select: { name: true } } },
    }),
    db.bathLog.findMany({
      where: { admissionId: { in: admissionIds }, bathedAt: { gte: today } },
      select: { id: true, bathedAt: true, admission: { select: { id: true, patient: { select: { name: true } } } }, bathedBy: { select: { name: true } } },
    }),
    db.vitalRecord.findMany({
      where: { admissionId: { in: admissionIds }, recordedAt: { gte: today } },
      select: { id: true, recordedAt: true, admission: { select: { id: true, patient: { select: { name: true } } } }, recordedBy: { select: { name: true } } },
    }),
    db.disinfectionLog.findMany({
      where: { isolationProtocol: { admissionId: { in: admissionIds } }, performedAt: { gte: today } },
      select: { id: true, performedAt: true, isolationProtocol: { select: { admission: { select: { id: true, patient: { select: { name: true } } } } } }, performedBy: { select: { name: true } } },
    }),
  ]);

  const allRecordIds = [
    ...medAdmins.map((r) => r.id),
    ...feedingLogs.map((r) => r.id),
    ...bathLogs.map((r) => r.id),
    ...vitalRecords.map((r) => r.id),
    ...disinfectionLogs.map((r) => r.id),
  ];

  if (allRecordIds.length === 0) return [];

  const proofs = await db.proofAttachment.findMany({
    where: { recordId: { in: allRecordIds } },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const recordContextMap = new Map<string, { admissionId: string; patientName: string; actionType: ProofCarouselItem["actionType"]; actionDetail: string; performedBy: string; timestamp: Date }>();

  for (const r of medAdmins) {
    recordContextMap.set(r.id, { admissionId: r.treatmentPlan.admission.id, patientName: r.treatmentPlan.admission.patient.name, actionType: "Med", actionDetail: r.treatmentPlan.drugName, performedBy: r.administeredBy?.name ?? "Unknown", timestamp: r.actualTime ?? new Date() });
  }
  for (const r of feedingLogs) {
    recordContextMap.set(r.id, { admissionId: r.feedingSchedule.dietPlan.admission.id, patientName: r.feedingSchedule.dietPlan.admission.patient.name, actionType: "Fed", actionDetail: r.feedingSchedule.foodType, performedBy: r.loggedBy.name, timestamp: r.createdAt });
  }
  for (const r of bathLogs) {
    recordContextMap.set(r.id, { admissionId: r.admission.id, patientName: r.admission.patient.name, actionType: "Bath", actionDetail: "Bath", performedBy: r.bathedBy.name, timestamp: r.bathedAt });
  }
  for (const r of vitalRecords) {
    recordContextMap.set(r.id, { admissionId: r.admission.id, patientName: r.admission.patient.name, actionType: "Vitals", actionDetail: "Vitals", performedBy: r.recordedBy.name, timestamp: r.recordedAt });
  }
  for (const r of disinfectionLogs) {
    recordContextMap.set(r.id, { admissionId: r.isolationProtocol.admission.id, patientName: r.isolationProtocol.admission.patient.name, actionType: "Disinfect", actionDetail: "Disinfection", performedBy: r.performedBy.name, timestamp: r.performedAt });
  }

  return proofs.map((proof) => {
    const ctx = recordContextMap.get(proof.recordId);
    return {
      fileId: proof.fileId,
      fileName: proof.fileName,
      admissionId: ctx?.admissionId ?? "",
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
