import { cn } from "@/lib/utils";

interface WeightAlertProps {
  admissionWeight: number | null;
  currentWeight: number | null;
  patientName: string;
}

export function WeightAlert({
  admissionWeight,
  currentWeight,
  patientName,
}: WeightAlertProps) {
  if (admissionWeight == null || currentWeight == null) return null;
  if (currentWeight >= admissionWeight) return null;

  const dropPercent = ((admissionWeight - currentWeight) / admissionWeight) * 100;

  if (dropPercent <= 5) return null;

  const isSevere = dropPercent > 10;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium",
        isSevere
          ? "border-red-600 bg-red-100 text-red-800"
          : "border-red-400 bg-red-50 text-red-700"
      )}
      role="alert"
      aria-label={`Weight alert for ${patientName}`}
    >
      <span className="text-base">⚠</span>
      <span>
        Weight dropped{" "}
        <strong>{dropPercent.toFixed(1)}%</strong> since admission
        {" "}({admissionWeight} kg → {currentWeight} kg)
      </span>
    </div>
  );
}
