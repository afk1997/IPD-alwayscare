import { formatInTimeZone } from "date-fns-tz";
import { cacheLife, cacheTag } from "next/cache";
import {
  CLINICAL_LIVE_PROFILE,
  dashboardQueueTag,
  dashboardSetupTag,
  dashboardSummaryTag,
} from "@/lib/clinical-cache";
import { buildDashboardStats, type DashboardSummaryRow } from "@/lib/dashboard-data";
import { isBathDue } from "@/lib/date-utils";
import { db } from "@/lib/db";

const IST_ZONE = "Asia/Kolkata";
const FEEDING_WINDOW_HOURS = 2;

type SummaryAdmissionRow = {
  id: string;
  ward: string | null;
  condition: string | null;
  admissionDate: Date;
  bathLogs: Array<{ bathedAt: Date }>;
  treatmentPlans: Array<{
    scheduledTimes: string[];
    administrations: Array<{
      wasAdministered: boolean;
      wasSkipped: boolean;
    }>;
  }>;
  dietPlans: Array<{
    feedingSchedules: Array<{
      scheduledTime: string;
    }>;
  }>;
};

type QueueAdmissionRow = {
  id: string;
  cageNumber: string | null;
  condition: string | null;
  ward: string | null;
  diagnosis: string | null;
  attendingDoctor: string | null;
  admissionDate: Date;
  patient: {
    name: string;
    breed: string | null;
    age: string | null;
    weight: number | null;
  };
  vitalRecords: Array<{
    temperature: number | null;
    heartRate: number | null;
    weight: number | null;
  }>;
  bathLogs: Array<{
    bathedAt: Date;
  }>;
  treatmentPlans: Array<{
    drugName: string;
    administrations: Array<{
      scheduledTime: string;
    }>;
  }>;
};

export interface DashboardQueueAdmission {
  id: string;
  cageNumber: string | null;
  condition: string | null;
  ward: string | null;
  diagnosis: string | null;
  attendingDoctor: string | null;
  admissionDate: Date;
  bathReferenceDate: Date;
  patient: {
    name: string;
    breed: string | null;
    age: string | null;
    weight: number | null;
  };
  latestVital: {
    temperature: number | null;
    heartRate: number | null;
    weight: number | null;
  } | null;
  nextMedication: {
    drugName: string;
    scheduledTime: string;
  } | null;
}

export interface DashboardSecondaryData {
  registeredAdmissions: Array<{
    id: string;
    admissionDate: Date;
    patient: {
      id: string;
      name: string;
      species: string;
      breed: string | null;
      age: string | null;
      weight: number | null;
      sex: string;
      color: string | null;
      isStray: boolean;
      rescueLocation: string | null;
      rescuerInfo: string | null;
    };
    admittedBy: { name: string };
  }>;
  isolationAdmissions: Array<{
    id: string;
    patient: {
      name: string;
    };
    isolationProtocol: {
      disease: string;
      ppeRequired: string[];
    } | null;
  }>;
}

function countPendingMeds(
  treatmentPlans: SummaryAdmissionRow["treatmentPlans"]
): number {
  return treatmentPlans.reduce((sum, plan) => {
    const completedCount = plan.administrations.filter(
      (administration) =>
        administration.wasAdministered || administration.wasSkipped
    ).length;

    return sum + Math.max(0, plan.scheduledTimes.length - completedCount);
  }, 0);
}

function countUpcomingFeedings(
  dietPlans: SummaryAdmissionRow["dietPlans"],
  nowTime: string,
  laterTime: string
): number {
  return dietPlans.reduce((sum, plan) => {
    const upcomingCount = plan.feedingSchedules.filter((schedule) => {
      if (laterTime < nowTime) {
        return (
          schedule.scheduledTime >= nowTime ||
          schedule.scheduledTime <= laterTime
        );
      }

      return (
        schedule.scheduledTime >= nowTime &&
        schedule.scheduledTime <= laterTime
      );
    }).length;

    return sum + upcomingCount;
  }, 0);
}

function toDashboardSummaryRow(
  admission: SummaryAdmissionRow,
  nowTime: string,
  laterTime: string
): DashboardSummaryRow {
  const lastBathAt = admission.bathLogs[0]?.bathedAt ?? admission.admissionDate;

  return {
    id: admission.id,
    ward: admission.ward,
    condition: admission.condition,
    admissionDate: admission.admissionDate,
    pendingMeds: countPendingMeds(admission.treatmentPlans),
    upcomingFeedings: countUpcomingFeedings(
      admission.dietPlans,
      nowTime,
      laterTime
    ),
    bathDue: isBathDue(lastBathAt).isDue,
  };
}

function getNextMedication(
  treatmentPlans: QueueAdmissionRow["treatmentPlans"]
): DashboardQueueAdmission["nextMedication"] {
  return (
    treatmentPlans
      .flatMap((plan) =>
        plan.administrations.map((administration) => ({
          drugName: plan.drugName,
          scheduledTime: administration.scheduledTime,
        }))
      )
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))[0] ?? null
  );
}

function toDashboardQueueAdmission(
  admission: QueueAdmissionRow
): DashboardQueueAdmission {
  return {
    id: admission.id,
    cageNumber: admission.cageNumber,
    condition: admission.condition,
    ward: admission.ward,
    diagnosis: admission.diagnosis,
    attendingDoctor: admission.attendingDoctor,
    admissionDate: admission.admissionDate,
    bathReferenceDate: admission.bathLogs[0]?.bathedAt ?? admission.admissionDate,
    patient: admission.patient,
    latestVital: admission.vitalRecords[0] ?? null,
    nextMedication: getNextMedication(admission.treatmentPlans),
  };
}

export async function getDashboardSummary(today: Date) {
  "use cache";

  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(dashboardSummaryTag());

  const now = new Date();
  const twoHoursLater = new Date(
    now.getTime() + FEEDING_WINDOW_HOURS * 60 * 60 * 1000
  );
  const nowTime = formatInTimeZone(now, IST_ZONE, "HH:mm");
  const laterTime = formatInTimeZone(twoHoursLater, IST_ZONE, "HH:mm");

  const admissions = await db.admission.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      patient: { deletedAt: null },
    },
    orderBy: { admissionDate: "desc" },
    select: {
      id: true,
      ward: true,
      condition: true,
      admissionDate: true,
      treatmentPlans: {
        where: { isActive: true, deletedAt: null },
        select: {
          scheduledTimes: true,
          administrations: {
            where: { scheduledDate: today },
            select: {
              wasAdministered: true,
              wasSkipped: true,
            },
          },
        },
      },
      bathLogs: {
        orderBy: { bathedAt: "desc" },
        take: 1,
        select: { bathedAt: true },
      },
      dietPlans: {
        where: { isActive: true, deletedAt: null },
        select: {
          feedingSchedules: {
            where: { isActive: true },
            select: { scheduledTime: true },
          },
        },
      },
    },
  });

  const rows = admissions.map((admission) =>
    toDashboardSummaryRow(admission, nowTime, laterTime)
  );

  return buildDashboardStats(rows);
}

export async function getDashboardQueue(today: Date) {
  "use cache";

  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(dashboardQueueTag());

  const admissions = await db.admission.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      patient: { deletedAt: null },
    },
    orderBy: { admissionDate: "desc" },
    select: {
      id: true,
      cageNumber: true,
      condition: true,
      ward: true,
      diagnosis: true,
      attendingDoctor: true,
      admissionDate: true,
      patient: {
        select: {
          name: true,
          breed: true,
          age: true,
          weight: true,
        },
      },
      vitalRecords: {
        orderBy: { recordedAt: "desc" },
        take: 1,
        select: {
          temperature: true,
          heartRate: true,
          weight: true,
        },
      },
      bathLogs: {
        orderBy: { bathedAt: "desc" },
        take: 1,
        select: {
          bathedAt: true,
        },
      },
      treatmentPlans: {
        where: { isActive: true, deletedAt: null },
        select: {
          drugName: true,
          administrations: {
            where: { scheduledDate: today },
            orderBy: { scheduledTime: "asc" },
            select: {
              scheduledTime: true,
            },
          },
        },
      },
    },
  });

  return admissions.map(toDashboardQueueAdmission);
}

export async function getDashboardSecondaryData(): Promise<DashboardSecondaryData> {
  "use cache";

  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(dashboardSetupTag());

  const [registeredAdmissions, isolationAdmissions] = await Promise.all([
    db.admission.findMany({
      where: {
        status: "REGISTERED",
        deletedAt: null,
        patient: { deletedAt: null },
      },
      orderBy: { admissionDate: "desc" },
      select: {
        id: true,
        admissionDate: true,
        admittedBy: {
          select: { name: true },
        },
        patient: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            age: true,
            weight: true,
            sex: true,
            color: true,
            isStray: true,
            rescueLocation: true,
            rescuerInfo: true,
          },
        },
      },
    }),
    db.admission.findMany({
      where: {
        status: "ACTIVE",
        ward: "ISOLATION",
        deletedAt: null,
        patient: { deletedAt: null },
      },
      orderBy: { admissionDate: "desc" },
      select: {
        id: true,
        patient: {
          select: {
            name: true,
          },
        },
        isolationProtocol: {
          select: {
            disease: true,
            ppeRequired: true,
          },
        },
      },
    }),
  ]);

  return {
    registeredAdmissions,
    isolationAdmissions,
  };
}
