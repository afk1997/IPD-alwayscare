export const SCHEDULE_HOURS = [
  "00:00",
  "01:00",
  "02:00",
  "03:00",
  "04:00",
  "05:00",
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
] as const;

export type ScheduleHour = (typeof SCHEDULE_HOURS)[number];

export interface ScheduleAdministration {
  id: string;
  wasAdministered: boolean;
  wasSkipped: boolean;
  skipReason: string | null;
  actualTime: Date | null;
  administeredBy?: { name: string } | null;
}

export interface ScheduleMedTask {
  type: "med";
  hour: ScheduleHour;
  scheduledTime: string;
  treatmentPlan: {
    id: string;
    drugName: string;
    dose: string;
    route: string;
  };
  administration: ScheduleAdministration | null;
  patientName: string;
  ward: string;
  cageNumber: string | null;
  admissionId: string;
}

export interface ScheduleFeedingLog {
  id: string;
  date: Date;
  status: string;
  amountConsumed: string | null;
  notes: string | null;
}

export interface ScheduleFeedingTask {
  type: "feeding";
  hour: ScheduleHour;
  scheduledTime: string;
  feedingScheduleId: string;
  foodType: string;
  portion: string;
  todayLog: ScheduleFeedingLog | null;
  patientName: string;
  ward: string;
  cageNumber: string | null;
  admissionId: string;
}

export type ScheduleTask = ScheduleMedTask | ScheduleFeedingTask;

export interface BathDuePatient {
  admissionId: string;
  patientName: string;
  ward: string;
  cageNumber: string | null;
  daysSinceLast: number;
  isOverdue: boolean;
}

export type HourGroup<
  M extends { hour: string } = { hour: ScheduleHour },
  F extends { hour: string } = { hour: ScheduleHour },
> = {
  hour: ScheduleHour;
  meds: M[];
  feedings: F[];
};

export function getHourBucket(scheduledTime: string): ScheduleHour {
  const [hourPart] = scheduledTime.split(":");
  const hour = Number(hourPart);

  if (!Number.isFinite(hour)) {
    return "00:00";
  }

  const normalizedHour = Math.max(0, Math.min(23, hour));
  return `${String(normalizedHour).padStart(2, "0")}:00` as ScheduleHour;
}

export function buildHourGroups<
  M extends { hour: string },
  F extends { hour: string },
>(
  meds: readonly M[],
  feedings: readonly F[]
): HourGroup<M, F>[] {
  return SCHEDULE_HOURS.map((hour) => ({
    hour,
    meds: meds.filter((task) => task.hour === hour),
    feedings: feedings.filter((task) => task.hour === hour),
  }));
}

export function sortBathDuePatients<T extends { isOverdue: boolean; daysSinceLast: number }>(
  rows: readonly T[]
) {
  return [...rows].sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) {
      return a.isOverdue ? -1 : 1;
    }

    return b.daysSinceLast - a.daysSinceLast;
  });
}
