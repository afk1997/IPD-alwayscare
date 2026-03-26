import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { formatRelative } from "@/lib/date-utils";

interface RegisteredAdmission {
  id: string;
  admissionDate: Date;
  patient: {
    name: string;
    breed: string | null;
    age: string | null;
    weight: number | null;
  };
  admittedBy: { name: string };
}

interface PendingSetupProps {
  admissions: RegisteredAdmission[];
  isDoctor: boolean;
}

export function PendingSetup({ admissions, isDoctor }: PendingSetupProps) {
  if (admissions.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 shrink-0 text-amber-600" />
        <span className="font-semibold text-amber-800">
          Awaiting Clinical Setup
        </span>
        <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
          {admissions.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {admissions.map((admission) => (
          <div
            key={admission.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2.5 ring-1 ring-amber-200"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {admission.patient.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[
                  admission.patient.breed,
                  admission.patient.age,
                  admission.patient.weight
                    ? `${admission.patient.weight} kg`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-xs text-muted-foreground">
                Registered by {admission.admittedBy.name} &middot;{" "}
                {formatRelative(admission.admissionDate)}
              </p>
            </div>

            {isDoctor && (
              <Link
                href={`/patients/${admission.id}/setup`}
                className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 active:bg-amber-700"
              >
                Complete Setup
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
