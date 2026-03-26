import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CONDITION_CONFIG, WARD_CONFIG } from "@/lib/constants";
import { daysSince, formatIST } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface PatientHeaderProps {
  admission: {
    id: string;
    admissionDate: Date;
    ward: string | null;
    cageNumber: string | null;
    condition: string | null;
    diagnosis: string | null;
    attendingDoctor: string | null;
    patient: {
      name: string;
      breed: string | null;
      age: string | null;
      sex: string;
      weight: number | null;
      species: string;
    };
  };
}

export function PatientHeader({ admission }: PatientHeaderProps) {
  const { patient } = admission;
  const conditionCfg = admission.condition ? CONDITION_CONFIG[admission.condition] : null;
  const wardCfg = admission.ward ? WARD_CONFIG[admission.ward] : null;
  const daysIn = daysSince(admission.admissionDate);

  const sexLabel =
    patient.sex === "MALE" ? "M" : patient.sex === "FEMALE" ? "F" : "?";

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      {/* Back button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      {/* Main row */}
      <div className="flex items-start gap-3">
        {/* Photo placeholder */}
        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl shrink-0">
          🐾
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Name + breed/age/sex */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-base font-bold text-gray-900 leading-tight">
              {patient.name}
            </span>
            {patient.breed && (
              <span className="text-sm text-gray-500">{patient.breed}</span>
            )}
            {patient.age && (
              <span className="text-sm text-gray-500">{patient.age}</span>
            )}
            <span className="text-sm text-gray-500">{sexLabel}</span>
          </div>

          {/* Weight */}
          {patient.weight != null && (
            <p className="text-sm text-gray-600 mt-0.5">{patient.weight} kg</p>
          )}

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {conditionCfg && (
              <Badge
                className={cn(
                  "text-xs font-medium border",
                  conditionCfg.color,
                  conditionCfg.bg,
                  conditionCfg.border
                )}
                variant="outline"
              >
                {conditionCfg.label}
              </Badge>
            )}
            {wardCfg && (
              <Badge
                className={cn(
                  "text-xs font-medium",
                  wardCfg.color,
                  wardCfg.bg
                )}
                variant="outline"
              >
                {wardCfg.label}
              </Badge>
            )}
            {admission.cageNumber && (
              <span className="text-xs text-gray-500 font-medium">
                Cage {admission.cageNumber}
              </span>
            )}
          </div>

          {/* Diagnosis */}
          {admission.diagnosis && (
            <p className="text-sm text-gray-700 mt-1 font-medium">
              {admission.diagnosis}
            </p>
          )}

          {/* Bottom row: day count + doctor + admission date */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
            <span className="font-semibold text-clinic-teal">
              Day {daysIn === 0 ? 1 : daysIn + 1}
            </span>
            {admission.attendingDoctor && (
              <span>Dr. {admission.attendingDoctor}</span>
            )}
            <span>Admitted {formatIST(admission.admissionDate)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
