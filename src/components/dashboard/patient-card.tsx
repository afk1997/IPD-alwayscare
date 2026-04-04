import Link from "next/link";
import { Thermometer, Heart, Pill, Bath, Clock } from "lucide-react";
import { CONDITION_CONFIG, WARD_CONFIG } from "@/lib/constants";
import {
  checkTemperature,
  checkHeartRate,
} from "@/lib/vitals-thresholds";
import { isBathDue } from "@/lib/date-utils";
import type { DashboardQueueAdmission } from "@/lib/dashboard-queries";
import { cn } from "@/lib/utils";

interface PatientCardProps {
  admission: DashboardQueueAdmission;
}

export function PatientCard({ admission }: PatientCardProps) {
  const isCritical = admission.condition === "CRITICAL";
  const conditionConfig = admission.condition
    ? CONDITION_CONFIG[admission.condition]
    : null;
  const wardConfig = admission.ward ? WARD_CONFIG[admission.ward] : null;

  const latestVital = admission.latestVital;
  const tempFlag = checkTemperature(latestVital?.temperature);
  const hrFlag = checkHeartRate(latestVital?.heartRate);

  const bathStatus = isBathDue(admission.bathReferenceDate);

  // Weight drop check
  const admissionWeight = admission.patient.weight;
  const latestWeight = latestVital?.weight ?? null;
  const weightDropPercent =
    admissionWeight != null && latestWeight != null && latestWeight < admissionWeight
      ? ((admissionWeight - latestWeight) / admissionWeight) * 100
      : null;
  const hasWeightDrop = weightDropPercent != null && weightDropPercent > 5;

  // Next med
  return (
    <Link
      href={`/patients/${admission.id}`}
      className={cn(
        "block rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow hover:shadow-md active:shadow-sm",
        isCritical && "border-l-4 border-clinic-red"
      )}
    >
      <div className="p-3 md:p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">
              {admission.patient.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {[admission.patient.breed, admission.patient.age]
                .filter(Boolean)
                .join(" · ")}
              {admission.cageNumber && (
                <span className="ml-1 text-xs text-muted-foreground">
                  · Cage {admission.cageNumber}
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {conditionConfig && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  conditionConfig.bg,
                  conditionConfig.color
                )}
              >
                {conditionConfig.label}
              </span>
            )}
            {wardConfig && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  wardConfig.bg,
                  wardConfig.color
                )}
              >
                {wardConfig.label}
              </span>
            )}
          </div>
        </div>

        {/* Diagnosis */}
        {admission.diagnosis && (
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {admission.diagnosis}
          </p>
        )}

        {/* Vitals + Bath row */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {latestVital?.temperature != null && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs",
                tempFlag.isAbnormal ? "font-semibold text-clinic-red" : "text-muted-foreground"
              )}
            >
              <Thermometer className="h-3 w-3" />
              {latestVital.temperature}°C
              {tempFlag.isAbnormal && (
                <span className="ml-0.5 text-[10px]">{tempFlag.label}</span>
              )}
            </span>
          )}
          {latestVital?.heartRate != null && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs",
                hrFlag.isAbnormal ? "font-semibold text-clinic-red" : "text-muted-foreground"
              )}
            >
              <Heart className="h-3 w-3" />
              {latestVital.heartRate} bpm
              {hrFlag.isAbnormal && (
                <span className="ml-0.5 text-[10px]">{hrFlag.label}</span>
              )}
            </span>
          )}
          {bathStatus.isDue && (
            <span
              className={cn(
                "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                bathStatus.isOverdue
                  ? "bg-red-100 text-clinic-red"
                  : "bg-orange-100 text-orange-600"
              )}
            >
              <Bath className="h-3 w-3" />
              {bathStatus.isOverdue ? "Bath overdue" : "Bath due"}
            </span>
          )}
          {hasWeightDrop && (
            <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-clinic-red">
              ↓ Weight
            </span>
          )}
        </div>

        {/* Next med */}
        {admission.nextMedication && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Pill className="h-3 w-3 shrink-0" />
            <span className="truncate">{admission.nextMedication.drugName}</span>
            <span className="shrink-0 font-medium text-foreground">
              <Clock className="mr-0.5 inline h-3 w-3" />
              {admission.nextMedication.scheduledTime}
            </span>
          </div>
        )}

        {/* Attending doctor */}
        {admission.attendingDoctor && (
          <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
            Dr. {admission.attendingDoctor}
          </p>
        )}
      </div>
    </Link>
  );
}
