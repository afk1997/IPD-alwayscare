export type ManagementPatientTabKey = "today" | "history" | "media";

export const MANAGEMENT_PATIENT_TABS: ManagementPatientTabKey[] = [
  "today",
  "history",
  "media",
];

export interface ManagementPatientTabLoadPlan {
  today: boolean;
  history: boolean;
  media: boolean;
}

export function getManagementPatientTabLoadPlan(
  tab: string
): ManagementPatientTabLoadPlan {
  const normalized = normalizeManagementPatientTab(tab);
  return {
    today: normalized === "today",
    history: normalized === "history",
    media: normalized === "media",
  };
}

export function normalizeManagementPatientTab(
  tab: string | undefined
): ManagementPatientTabKey {
  if (tab === "today" || tab === "history" || tab === "media") return tab;
  return "today";
}
