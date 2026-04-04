import { updateTag } from "next/cache";
import {
  dashboardQueueTag,
  dashboardSetupTag,
  dashboardSummaryTag,
} from "@/lib/clinical-cache";

type DashboardTagKey = "summary" | "queue" | "setup";

export const admissionDashboardInvalidations = {
  transferWard: ["summary", "queue", "setup"],
  dischargePatient: ["summary", "queue", "setup"],
} as const satisfies Record<string, readonly DashboardTagKey[]>;

const dashboardTagFactories: Record<DashboardTagKey, () => string> = {
  summary: dashboardSummaryTag,
  queue: dashboardQueueTag,
  setup: dashboardSetupTag,
};

export function invalidateDashboardTags(...tags: DashboardTagKey[]) {
  for (const tag of new Set(tags)) {
    updateTag(dashboardTagFactories[tag]());
  }
}
