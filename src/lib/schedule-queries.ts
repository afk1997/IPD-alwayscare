import { cacheLife, cacheTag } from "next/cache";
import { CLINICAL_LIVE_PROFILE, scheduleTag } from "@/lib/clinical-cache";
import { isBathDue } from "@/lib/date-utils";
import { db } from "@/lib/db";
import {
  getHourBucket,
  sortBathDuePatients,
  type BathDuePatient,
  type ScheduleAdministration,
  type ScheduleFeedingLog,
  type ScheduleFeedingTask,
  type ScheduleMedTask,
} from "@/lib/schedule-data";

function mapAdministration(
  administration: {
    id: string;
    wasAdministered: boolean;
    wasSkipped: boolean;
    skipReason: string | null;
    actualTime: Date | null;
    administeredBy: { name: string } | null;
  } | null
): ScheduleAdministration | null {
  if (!administration) {
    return null;
  }

  return {
    id: administration.id,
    wasAdministered: administration.wasAdministered,
    wasSkipped: administration.wasSkipped,
    skipReason: administration.skipReason,
    actualTime: administration.actualTime,
    administeredBy: administration.administeredBy,
  };
}

function mapFeedingLog(
  log: {
    id: string;
    date: Date;
    status: string;
    amountConsumed: string | null;
    notes: string | null;
  } | null
): ScheduleFeedingLog | null {
  if (!log) {
    return null;
  }

  return {
    id: log.id,
    date: log.date,
    status: log.status,
    amountConsumed: log.amountConsumed,
    notes: log.notes,
  };
}

export async function getScheduleMedTasks(today: Date) {
  "use cache";

  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(scheduleTag("meds"));

  const treatmentPlans = await db.treatmentPlan.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      admission: {
        status: "ACTIVE",
        deletedAt: null,
        patient: {
          deletedAt: null,
        },
      },
    },
    select: {
      id: true,
      drugName: true,
      dose: true,
      route: true,
      scheduledTimes: true,
      admission: {
        select: {
          id: true,
          ward: true,
          cageNumber: true,
          patient: {
            select: {
              name: true,
            },
          },
        },
      },
      administrations: {
        where: {
          scheduledDate: today,
        },
        select: {
          id: true,
          wasAdministered: true,
          wasSkipped: true,
          skipReason: true,
          actualTime: true,
          scheduledTime: true,
          administeredBy: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return treatmentPlans.flatMap<ScheduleMedTask>((plan) =>
    plan.scheduledTimes.map((scheduledTime) => {
      const administration =
        plan.administrations.find(
          (entry) => entry.scheduledTime === scheduledTime
        ) ?? null;

      return {
        type: "med",
        hour: getHourBucket(scheduledTime),
        scheduledTime,
        treatmentPlan: {
          id: plan.id,
          drugName: plan.drugName,
          dose: plan.dose,
          route: plan.route,
        },
        administration: mapAdministration(administration),
        patientName: plan.admission.patient.name,
        ward: plan.admission.ward as string,
        cageNumber: plan.admission.cageNumber,
        admissionId: plan.admission.id,
      };
    })
  );
}

export async function getScheduleFeedingTasks(today: Date) {
  "use cache";

  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(scheduleTag("feedings"));

  const dietPlans = await db.dietPlan.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      admission: {
        status: "ACTIVE",
        deletedAt: null,
        patient: {
          deletedAt: null,
        },
      },
    },
    select: {
      id: true,
      admission: {
        select: {
          id: true,
          ward: true,
          cageNumber: true,
          patient: {
            select: {
              name: true,
            },
          },
        },
      },
      feedingSchedules: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
          scheduledTime: true,
          foodType: true,
          portion: true,
          feedingLogs: {
            where: {
              date: today,
            },
            select: {
              id: true,
              date: true,
              status: true,
              amountConsumed: true,
              notes: true,
            },
          },
        },
      },
    },
  });

  return dietPlans.flatMap<ScheduleFeedingTask>((plan) =>
    plan.feedingSchedules.map((schedule) => {
      const todayLog = schedule.feedingLogs[0] ?? null;

      return {
        type: "feeding",
        hour: getHourBucket(schedule.scheduledTime),
        scheduledTime: schedule.scheduledTime,
        feedingScheduleId: schedule.id,
        foodType: schedule.foodType,
        portion: schedule.portion,
        todayLog: mapFeedingLog(todayLog),
        patientName: plan.admission.patient.name,
        ward: plan.admission.ward as string,
        cageNumber: plan.admission.cageNumber,
        admissionId: plan.admission.id,
      };
    })
  );
}

export async function getScheduleBathTasks(): Promise<BathDuePatient[]> {
  "use cache";

  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(scheduleTag("baths"));

  const admissions = await db.admission.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      patient: {
        deletedAt: null,
      },
    },
    select: {
      id: true,
      admissionDate: true,
      ward: true,
      cageNumber: true,
      patient: {
        select: {
          name: true,
        },
      },
      bathLogs: {
        orderBy: {
          bathedAt: "desc",
        },
        take: 1,
        select: {
          bathedAt: true,
        },
      },
    },
  });

  return sortBathDuePatients(
    admissions.flatMap((admission) => {
      const lastBath = admission.bathLogs[0]?.bathedAt ?? admission.admissionDate;
      const bathStatus = isBathDue(lastBath);

      if (!bathStatus.isDue) {
        return [];
      }

      return [
        {
          admissionId: admission.id,
          patientName: admission.patient.name,
          ward: admission.ward as string,
          cageNumber: admission.cageNumber,
          daysSinceLast: bathStatus.daysSinceLast,
          isOverdue: bathStatus.isOverdue,
        },
      ];
    })
  );
}
