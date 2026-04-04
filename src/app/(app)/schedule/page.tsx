import { formatInTimeZone } from "date-fns-tz";
import { CalendarClock } from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTodayIST, getTodayUTCDate } from "@/lib/date-utils";
import { BathDueSection } from "@/components/schedule/bath-due-section";
import { ScheduleFeedingRow } from "@/components/schedule/schedule-feeding-row";
import { ScheduleMedRow } from "@/components/schedule/schedule-med-row";
import { TimeBlock } from "@/components/schedule/time-block";
import {
  buildHourGroups,
  type ScheduleTask,
} from "@/lib/schedule-data";
import {
  getScheduleBathTasks,
  getScheduleFeedingTasks,
  getScheduleMedTasks,
} from "@/lib/schedule-queries";

function isDone(task: ScheduleTask): boolean {
  if (task.type === "med") {
    return (
      task.administration?.wasAdministered === true ||
      task.administration?.wasSkipped === true
    );
  }

  const status = task.todayLog?.status;
  return (
    status === "EATEN" ||
    status === "PARTIAL" ||
    status === "REFUSED" ||
    status === "SKIPPED"
  );
}

export default async function SchedulePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const today = getTodayUTCDate();
  const todayIST = getTodayIST();

  const [medTasks, feedingTasks, bathDuePatients] = await Promise.all([
    getScheduleMedTasks(today),
    getScheduleFeedingTasks(today),
    getScheduleBathTasks(),
  ]);

  const allTasks: ScheduleTask[] = [...medTasks, ...feedingTasks];
  const hourGroups = buildHourGroups(medTasks, feedingTasks);

  for (const group of hourGroups) {
    group.meds.sort(
      (a, b) =>
        a.scheduledTime.localeCompare(b.scheduledTime) ||
        a.patientName.localeCompare(b.patientName)
    );
    group.feedings.sort(
      (a, b) =>
        a.scheduledTime.localeCompare(b.scheduledTime) ||
        a.patientName.localeCompare(b.patientName)
    );
  }

  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter(isDone).length;
  const hasAnyTasks = totalTasks > 0;

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Daily Schedule</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatInTimeZone(new Date(), "Asia/Kolkata", "EEEE, d MMMM yyyy")}
          </p>
        </div>
        {hasAnyTasks && (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-sm font-semibold text-gray-800">
              {doneTasks}/{totalTasks}
            </span>
            <span className="text-xs text-gray-400">tasks done</span>
          </div>
        )}
      </div>

      <BathDueSection patients={bathDuePatients} />

      {!hasAnyTasks && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <CalendarClock className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No tasks scheduled</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Medications and feedings will appear here once assigned to active patients.
          </p>
        </div>
      )}

      {hasAnyTasks && (
        <div>
          {hourGroups.map((group) => {
            const taskCount = group.meds.length + group.feedings.length;
            if (taskCount === 0) return null;

            const doneCount =
              group.meds.filter((task) => isDone(task)).length +
              group.feedings.filter((task) => isDone(task)).length;

            return (
              <TimeBlock
                key={group.hour}
                hour={group.hour}
                taskCount={taskCount}
                doneCount={doneCount}
              >
                {group.meds.map((task) => (
                  <ScheduleMedRow
                    key={`${task.treatmentPlan.id}-${task.scheduledTime}`}
                    treatmentPlan={task.treatmentPlan}
                    scheduledDate={todayIST}
                    scheduledTime={task.scheduledTime}
                    administration={task.administration}
                    patientName={task.patientName}
                    ward={task.ward}
                    cageNumber={task.cageNumber}
                    staffName={session.name}
                  />
                ))}
                {group.feedings.map((task) => (
                  <ScheduleFeedingRow
                    key={`${task.feedingScheduleId}-${task.scheduledTime}`}
                    feedingScheduleId={task.feedingScheduleId}
                    scheduledTime={task.scheduledTime}
                    foodType={task.foodType}
                    portion={task.portion}
                    todayLog={task.todayLog}
                    patientName={task.patientName}
                    ward={task.ward}
                    cageNumber={task.cageNumber}
                  />
                ))}
              </TimeBlock>
            );
          })}
        </div>
      )}
    </div>
  );
}
