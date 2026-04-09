const HANDLING_NOTES = [
  "STANDARD",
  "GENTLE",
  "ADVANCED_HANDLER_ONLY",
] as const;

const SPAY_NEUTER_STATUSES = [
  "UNKNOWN",
  "INTACT",
  "SPAYED_NEUTERED",
] as const;

export type HandlingNoteValue = (typeof HANDLING_NOTES)[number];
export type SpayNeuterStatusValue = (typeof SPAY_NEUTER_STATUSES)[number];

export function formatPatientNumber(sequence: number): string {
  return `IPD-${String(sequence).padStart(6, "0")}`;
}

export function validateHandlingNote(value: string): HandlingNoteValue {
  if (!HANDLING_NOTES.includes(value as HandlingNoteValue)) {
    throw new Error(`Invalid handling note: ${value}`);
  }

  return value as HandlingNoteValue;
}

export function validateSpayNeuterStatus(
  value: string
): SpayNeuterStatusValue {
  if (!SPAY_NEUTER_STATUSES.includes(value as SpayNeuterStatusValue)) {
    throw new Error(`Invalid spay/neuter status: ${value}`);
  }

  return value as SpayNeuterStatusValue;
}

export function parseViralRisk(value: string): boolean {
  if (value === "YES") return true;
  if (value === "NO") return false;

  throw new Error(`Invalid viral risk: ${value}`);
}
