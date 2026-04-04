export interface FoodTodayLog {
  id: string;
  status: string;
  amountConsumed: string | null;
  notes: string | null;
}

export interface FoodSchedule {
  id: string;
  scheduledTime: string;
  foodType: string;
  portion: string;
  todayLog: FoodTodayLog | null;
}

export interface FoodActivePlan {
  id: string;
  dietType: string;
  instructions: string | null;
  createdByName: string;
  feedingSchedules: FoodSchedule[];
}

export interface FoodHistoryEntry {
  id: string;
  date: string;
  foodType: string;
  scheduledTime: string;
  status: string;
  amountConsumed: string | null;
  notes: string | null;
}

export interface FoodTabData {
  activePlan: FoodActivePlan | null;
  historyEntries: FoodHistoryEntry[];
}

interface FoodActivePlanSource {
  id: string;
  dietType: string;
  instructions: string | null;
  createdBy: { name: string } | null;
  feedingSchedules: Array<{
    id: string;
    scheduledTime: string;
    foodType: string;
    portion: string;
    feedingLogs: Array<{
      id: string;
      status: string;
      amountConsumed: string | null;
      notes: string | null;
    }>;
  }>;
}

interface FoodHistoryLogSource {
  id: string;
  date: Date;
  status: string;
  amountConsumed: string | null;
  notes: string | null;
  feedingSchedule: {
    scheduledTime: string;
    foodType: string;
  };
}

export function buildFoodTabData(
  activePlan: FoodActivePlanSource | null,
  historyLogs: FoodHistoryLogSource[]
): FoodTabData {
  return {
    activePlan: activePlan
      ? {
          id: activePlan.id,
          dietType: activePlan.dietType,
          instructions: activePlan.instructions,
          createdByName: activePlan.createdBy?.name ?? "—",
          feedingSchedules: activePlan.feedingSchedules
            .map((schedule) => ({
              id: schedule.id,
              scheduledTime: schedule.scheduledTime,
              foodType: schedule.foodType,
              portion: schedule.portion,
              todayLog: schedule.feedingLogs[0]
                ? {
                    id: schedule.feedingLogs[0].id,
                    status: schedule.feedingLogs[0].status,
                    amountConsumed: schedule.feedingLogs[0].amountConsumed,
                    notes: schedule.feedingLogs[0].notes,
                  }
                : null,
            }))
            .sort((left, right) =>
              left.scheduledTime.localeCompare(right.scheduledTime)
            ),
        }
      : null,
    historyEntries: historyLogs
      .map((log) => ({
        id: log.id,
        date: log.date.toISOString().slice(0, 10),
        foodType: log.feedingSchedule.foodType,
        scheduledTime: log.feedingSchedule.scheduledTime,
        status: log.status,
        amountConsumed: log.amountConsumed,
        notes: log.notes,
      }))
      .sort(
        (left, right) =>
          right.date.localeCompare(left.date) ||
          left.scheduledTime.localeCompare(right.scheduledTime) ||
          left.id.localeCompare(right.id)
      ),
  };
}
