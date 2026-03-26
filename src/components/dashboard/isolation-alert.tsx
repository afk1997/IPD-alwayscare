import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface IsolationAdmission {
  id: string;
  patient: { name: string };
  isolationProtocol: {
    disease: string;
    ppeRequired: string[];
  } | null;
}

export function IsolationAlert({
  admissions,
}: {
  admissions: IsolationAdmission[];
}) {
  if (admissions.length === 0) return null;

  const diseases = [
    ...new Set(
      admissions
        .map((a) => a.isolationProtocol?.disease)
        .filter(Boolean) as string[]
    ),
  ];

  const allPPE = [
    ...new Set(
      admissions.flatMap((a) => a.isolationProtocol?.ppeRequired ?? [])
    ),
  ];

  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 shrink-0 text-clinic-red" />
        <span className="font-semibold text-clinic-red">
          ISOLATION WARD ACTIVE
        </span>
        <span className="ml-auto text-sm font-medium text-clinic-red">
          {admissions.length} patient{admissions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {diseases.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {diseases.map((disease) => (
            <span
              key={disease}
              className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-clinic-red"
            >
              {disease}
            </span>
          ))}
        </div>
      )}

      {allPPE.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-xs font-medium text-red-700">PPE Required:</p>
          <div className="flex flex-wrap gap-1">
            {allPPE.map((ppe) => (
              <Badge
                key={ppe}
                variant="outline"
                className="border-red-300 bg-white text-[11px] text-clinic-red"
              >
                {ppe}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs font-medium text-red-700">
        Handle isolation patients LAST in rotation
      </p>
    </div>
  );
}
