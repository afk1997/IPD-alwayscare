export type VitalFlag = {
  isAbnormal: boolean;
  label: string; // "Normal", "↑ HIGH", "↓ LOW"
};

export function checkTemperature(value: number | null | undefined): VitalFlag {
  if (value == null) return { isAbnormal: false, label: "" };
  if (value > 39.5) return { isAbnormal: true, label: "↑ HIGH" };
  if (value < 37.5) return { isAbnormal: true, label: "↓ LOW" };
  return { isAbnormal: false, label: "Normal" };
}

export function checkHeartRate(value: number | null | undefined): VitalFlag {
  if (value == null) return { isAbnormal: false, label: "" };
  if (value > 140) return { isAbnormal: true, label: "↑ HIGH" };
  if (value < 60) return { isAbnormal: true, label: "↓ LOW" };
  return { isAbnormal: false, label: "Normal" };
}

export function checkRespRate(value: number | null | undefined): VitalFlag {
  if (value == null) return { isAbnormal: false, label: "" };
  if (value > 35) return { isAbnormal: true, label: "↑ HIGH" };
  return { isAbnormal: false, label: "Normal" };
}

export function checkPainScore(value: number | null | undefined): VitalFlag {
  if (value == null) return { isAbnormal: false, label: "" };
  if (value >= 5) return { isAbnormal: true, label: "↑ HIGH" };
  return { isAbnormal: false, label: "Normal" };
}

export function checkCRT(value: number | null | undefined): VitalFlag {
  if (value == null) return { isAbnormal: false, label: "" };
  if (value > 2) return { isAbnormal: true, label: "↑ SLOW" };
  return { isAbnormal: false, label: "Normal" };
}

export function hasAnyAbnormalVital(vitals: {
  temperature?: number | null;
  heartRate?: number | null;
  respRate?: number | null;
  painScore?: number | null;
  capillaryRefillTime?: number | null;
}): boolean {
  return (
    checkTemperature(vitals.temperature).isAbnormal ||
    checkHeartRate(vitals.heartRate).isAbnormal ||
    checkRespRate(vitals.respRate).isAbnormal ||
    checkPainScore(vitals.painScore).isAbnormal ||
    checkCRT(vitals.capillaryRefillTime).isAbnormal
  );
}
