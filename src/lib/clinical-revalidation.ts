import { updateTag } from "next/cache";
import {
  notificationsTag,
  patientShellTag,
  patientTabTag,
  scheduleTag,
} from "@/lib/clinical-cache";

const NOTIFICATION_ROLE_TAGS = [
  notificationsTag("ADMIN"),
  notificationsTag("ATTENDANT"),
  notificationsTag("DOCTOR"),
  notificationsTag("MANAGEMENT"),
  notificationsTag("PARAVET"),
];

function patientTags(
  admissionId: string,
  tabs: ReadonlyArray<
    | "vitals"
    | "meds"
    | "food"
    | "notes"
    | "labs"
    | "bath"
    | "isolation"
    | "logs"
  >
) {
  return tabs.map((tab) => patientTabTag(admissionId, tab));
}

// Schedule caches are global today; admission ids are reserved for future scoping.
export function getMedicationMutationTags(_admissionId: string): string[] {
  return [
    scheduleTag("meds"),
    ...patientTags(_admissionId, ["meds", "logs"]),
    ...NOTIFICATION_ROLE_TAGS,
  ];
}

export function getFeedingMutationTags(_admissionId: string): string[] {
  return [
    scheduleTag("feedings"),
    ...patientTags(_admissionId, ["food", "logs"]),
    ...NOTIFICATION_ROLE_TAGS,
  ];
}

export function getBathMutationTags(_admissionId: string): string[] {
  return [
    scheduleTag("baths"),
    ...patientTags(_admissionId, ["bath", "logs"]),
    ...NOTIFICATION_ROLE_TAGS,
  ];
}

export function getAdmissionMutationTags(_admissionId?: string): string[] {
  const tags = [
    scheduleTag("meds"),
    scheduleTag("feedings"),
    scheduleTag("baths"),
    ...NOTIFICATION_ROLE_TAGS,
  ];

  if (!_admissionId) {
    return tags;
  }

  return [
    scheduleTag("meds"),
    scheduleTag("feedings"),
    scheduleTag("baths"),
    patientShellTag(_admissionId),
    ...patientTags(_admissionId, [
      "vitals",
      "meds",
      "food",
      "notes",
      "labs",
      "bath",
      "isolation",
      "logs",
    ]),
    ...NOTIFICATION_ROLE_TAGS,
  ];
}

export function getVitalsMutationTags(_admissionId: string): string[] {
  return [
    ...patientTags(_admissionId, ["vitals", "logs"]),
    ...NOTIFICATION_ROLE_TAGS,
  ];
}

export function getIsolationMutationTags(_admissionId: string): string[] {
  return [
    ...patientTags(_admissionId, ["isolation", "logs"]),
    ...NOTIFICATION_ROLE_TAGS,
  ];
}

export function getLabMutationTags(_admissionId: string): string[] {
  return patientTags(_admissionId, ["labs", "isolation"]);
}

export function getNoteMutationTags(_admissionId: string): string[] {
  return patientTags(_admissionId, ["notes", "logs"]);
}

export function getFluidMutationTags(_admissionId: string): string[] {
  return patientTags(_admissionId, ["meds", "notes", "logs"]);
}

export function updateClinicalTags(tags: readonly string[]) {
  for (const tag of new Set(tags)) {
    updateTag(tag);
  }
}
