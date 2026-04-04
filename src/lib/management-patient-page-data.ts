export type ManagementPatientTabKey =
  | "overview"
  | "meds"
  | "food"
  | "vitals"
  | "notes"
  | "labs"
  | "bath"
  | "isolation"
  | "media"
  | "logs";

export const MANAGEMENT_PATIENT_TABS: ManagementPatientTabKey[] = [
  "overview",
  "meds",
  "food",
  "vitals",
  "notes",
  "labs",
  "bath",
  "isolation",
  "media",
  "logs",
];

export interface ManagementPatientTabLoadPlan {
  overview: boolean;
  meds: boolean;
  food: boolean;
  vitals: boolean;
  notes: boolean;
  labs: boolean;
  bath: boolean;
  isolation: boolean;
  media: boolean;
  logs: boolean;
}

export function getManagementPatientTabLoadPlan(
  tab: string
): ManagementPatientTabLoadPlan {
  return {
    overview: tab === "overview",
    meds: tab === "meds",
    food: tab === "food",
    vitals: tab === "vitals",
    notes: tab === "notes",
    labs: tab === "labs",
    bath: tab === "bath",
    isolation: tab === "isolation",
    media: tab === "media",
    logs: tab === "logs",
  };
}

export function normalizeManagementPatientTab(
  tab: string | undefined
): ManagementPatientTabKey {
  return MANAGEMENT_PATIENT_TABS.includes(tab as ManagementPatientTabKey)
    ? (tab as ManagementPatientTabKey)
    : "overview";
}
