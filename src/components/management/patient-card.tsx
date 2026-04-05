import Link from "next/link";
import type { PatientCardData } from "@/lib/management-dashboard-queries";
import { Camera } from "lucide-react";
import { differenceInDays } from "date-fns";

const CONDITION_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-500",
  GUARDED: "bg-orange-500",
  STABLE: "bg-green-500",
  IMPROVING: "bg-blue-500",
  RECOVERED: "bg-emerald-500",
};

export function PatientCard({ patient }: { patient: PatientCardData }) {
  const dayNum = differenceInDays(new Date(), patient.admissionDate) + 1;

  return (
    <Link
      href={`/management/patients/${patient.admissionId}?tab=today`}
      className="block border rounded-xl p-3 bg-card shadow-sm active:bg-muted/50 transition-colors"
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${CONDITION_STYLES[patient.condition ?? ""] ?? "bg-gray-400"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm truncate">{patient.patientName}</h3>
            <span className="text-[10px] text-muted-foreground shrink-0">Day {dayNum}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{patient.diagnosis}</p>
          <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
            <span>{patient.ward} · {patient.cageNumber}</span>
            {patient.attendingDoctor && <span>· {patient.attendingDoctor}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2 text-xs">
        <span className={patient.medsGiven < patient.medsTotal ? "text-amber-600 font-medium" : "text-green-600"}>
          Meds {patient.medsGiven}/{patient.medsTotal}
        </span>
        <span className={patient.feedsLogged < patient.feedsTotal ? "text-amber-600 font-medium" : "text-green-600"}>
          Food {patient.feedsLogged}/{patient.feedsTotal}
        </span>

        {patient.latestTemp != null && (
          <span className={patient.tempAbnormal ? "text-red-600 font-medium" : "text-muted-foreground"}>
            {patient.latestTemp}&deg;C{patient.tempAbnormal ? " \u2191" : ""}
          </span>
        )}
        {patient.latestHR != null && (
          <span className={patient.hrAbnormal ? "text-red-600 font-medium" : "text-muted-foreground"}>
            HR {patient.latestHR}{patient.hrAbnormal ? " \u2191" : ""}
          </span>
        )}

        {patient.proofCountToday > 0 && (
          <span className="text-muted-foreground flex items-center gap-0.5 ml-auto">
            <Camera className="w-3 h-3" /> {patient.proofCountToday}
          </span>
        )}
      </div>
    </Link>
  );
}
