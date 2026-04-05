export type PatientTabKey =
  | "vitals"
  | "meds"
  | "food"
  | "notes"
  | "logs"
  | "labs"
  | "bath"
  | "photos"
  | "isolation";

export const PATIENT_TABS: PatientTabKey[] = [
  "vitals",
  "meds",
  "food",
  "notes",
  "logs",
  "labs",
  "bath",
  "photos",
  "isolation",
];

export interface PatientTabLoadPlan {
  vitals: boolean;
  meds: boolean;
  food: boolean;
  notes: boolean;
  labs: boolean;
  bath: boolean;
  isolation: boolean;
  logs: boolean;
  photos: boolean;
  profilePhoto: boolean;
  availableCages: boolean;
}

export function getPatientTabLoadPlan(
  tab: string,
  isDoctor: boolean
): PatientTabLoadPlan {
  return {
    vitals: tab === "vitals",
    meds: tab === "meds",
    food: tab === "food",
    notes: tab === "notes",
    labs: tab === "labs",
    bath: tab === "bath",
    isolation: tab === "isolation",
    logs: tab === "logs",
    photos: tab === "photos",
    profilePhoto: true,
    availableCages: isDoctor,
  };
}

export function normalizePatientTab(tab: string | undefined): PatientTabKey {
  return PATIENT_TABS.includes(tab as PatientTabKey)
    ? (tab as PatientTabKey)
    : "vitals";
}
