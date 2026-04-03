import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Shield, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkTemperature, checkHeartRate } from "@/lib/vitals-thresholds";
import { CONDITION_CONFIG } from "@/lib/constants";
import { formatDateTimeIST } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { LogDisinfectionButton } from "./log-disinfection-button";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PCR_COLORS: Record<string, string> = {
  Positive: "bg-red-100 text-red-700 border-red-200",
  Negative: "bg-green-100 text-green-700 border-green-200",
  Pending: "bg-amber-100 text-amber-700 border-amber-200",
  Inconclusive: "bg-gray-100 text-gray-600 border-gray-200",
};

function parseIntervalHours(interval: string): number {
  const match = interval.match(/\d+/);
  return parseInt(match?.[0] || "4", 10);
}

function computeNextDue(lastAt: Date, intervalHours: number): Date {
  return new Date(lastAt.getTime() + intervalHours * 60 * 60 * 1000);
}

function isOverdue(nextDue: Date): boolean {
  return new Date() > new Date(nextDue.getTime() + 60 * 60 * 1000); // >1 hour past due
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function IsolationWardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const admissions = await db.admission.findMany({
    where: {
      status: "ACTIVE",
      ward: "ISOLATION",
      deletedAt: null,
      patient: { deletedAt: null },
    },
    include: {
      patient: true,
      isolationProtocol: {
        include: {
          disinfectionLogs: {
            orderBy: { performedAt: "desc" },
            take: 1,
            include: { performedBy: { select: { name: true } } },
          },
        },
      },
      vitalRecords: {
        orderBy: { recordedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { admissionDate: "desc" },
  });

  // Aggregate unique PPE across all isolation patients
  const allPpe: string[] = Array.from(
    new Set(
      admissions.flatMap((a: any) => a.isolationProtocol?.ppeRequired ?? [])
    )
  );

  // Check if any patient has an overdue disinfection
  const anyOverdue = admissions.some((a: any) => {
    const protocol = a.isolationProtocol;
    if (!protocol) return false;
    const lastLog = protocol.disinfectionLogs[0];
    if (!lastLog) return false;
    const intervalHours = parseIntervalHours(protocol.disinfectionInterval);
    const nextDue = computeNextDue(lastLog.performedAt, intervalHours);
    return isOverdue(nextDue);
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      {/* Red-tinted header */}
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-600 flex-shrink-0" />
          <h1 className="text-lg font-bold text-red-800 uppercase tracking-wide">
            Isolation Ward
          </h1>
          {admissions.length > 0 && (
            <span className="ml-auto rounded-full bg-red-200 px-2.5 py-0.5 text-xs font-bold text-red-800">
              {admissions.length}
            </span>
          )}
        </div>

        <p className="text-sm font-semibold text-red-700">
          PPE REQUIRED — Handle isolation patients LAST
        </p>

        {/* Aggregate PPE checklist */}
        {allPpe.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allPpe.map((ppe) => (
              <span
                key={String(ppe)}
                className="rounded-full border border-red-300 bg-white/80 px-2.5 py-0.5 text-xs font-medium text-red-700"
              >
                {String(ppe)}
              </span>
            ))}
          </div>
        )}

        {/* Global overdue warning */}
        {anyOverdue && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-100 px-3 py-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" />
            <p className="text-xs font-semibold text-red-700">
              One or more patients have overdue disinfection
            </p>
          </div>
        )}
      </div>

      {/* Patient list */}
      {admissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Shield className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No patients in isolation ward
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {admissions.map((admission: any) => {
            const protocol = admission.isolationProtocol;
            const vitals = admission.vitalRecords[0] ?? null;
            const conditionCfg = admission.condition
              ? CONDITION_CONFIG[admission.condition]
              : null;
            const lastLog = protocol?.disinfectionLogs[0] ?? null;
            const intervalHours = protocol
              ? parseIntervalHours(protocol.disinfectionInterval)
              : 4;
            const nextDue =
              lastLog && protocol
                ? computeNextDue(lastLog.performedAt, intervalHours)
                : null;
            const overdueFlag = nextDue ? isOverdue(nextDue) : false;

            const tempFlag = checkTemperature(vitals?.temperature);
            const hrFlag = checkHeartRate(vitals?.heartRate);

            const pcrColor =
              protocol?.pcrStatus
                ? PCR_COLORS[protocol.pcrStatus] ??
                  "bg-gray-100 text-gray-600 border-gray-200"
                : null;

            return (
              <div
                key={String(admission.id)}
                className={cn(
                  "rounded-xl border bg-card px-4 py-4 space-y-3 shadow-sm",
                  overdueFlag ? "border-red-300" : "border-border"
                )}
              >
                {/* Patient header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-foreground">
                        {admission.patient.name}
                      </h2>
                      {admission.cageNumber && (
                        <span className="text-xs text-muted-foreground">
                          Cage {admission.cageNumber}
                        </span>
                      )}
                      {conditionCfg && (
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-xs font-medium",
                            conditionCfg.bg,
                            conditionCfg.color,
                            conditionCfg.border
                          )}
                        >
                          {conditionCfg.label}
                        </span>
                      )}
                    </div>

                    {/* Disease + PCR status */}
                    {protocol && (
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-muted-foreground">
                          {protocol.disease}
                        </p>
                        {pcrColor && (
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-xs font-semibold",
                              pcrColor
                            )}
                          >
                            PCR: {protocol.pcrStatus}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/patients/${admission.id}`}
                    className="flex-shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    View
                  </Link>
                </div>

                {/* Latest vitals */}
                {vitals && (
                  <div className="flex flex-wrap gap-3">
                    {vitals.temperature != null && (
                      <div
                        className={cn(
                          "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs",
                          tempFlag.isAbnormal
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-border bg-muted/50 text-foreground"
                        )}
                      >
                        <span className="font-medium">
                          {vitals.temperature}°C
                        </span>
                        {tempFlag.isAbnormal && (
                          <span className="font-semibold">
                            {tempFlag.label}
                          </span>
                        )}
                      </div>
                    )}
                    {vitals.heartRate != null && (
                      <div
                        className={cn(
                          "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs",
                          hrFlag.isAbnormal
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-border bg-muted/50 text-foreground"
                        )}
                      >
                        <span className="font-medium">
                          {vitals.heartRate} bpm
                        </span>
                        {hrFlag.isAbnormal && (
                          <span className="font-semibold">
                            {hrFlag.label}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Disinfection section */}
                {protocol && (
                  <div
                    className={cn(
                      "rounded-lg border px-3 py-2.5 space-y-2",
                      overdueFlag
                        ? "border-red-300 bg-red-50"
                        : "border-border bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-xs font-semibold text-foreground">
                          Disinfection
                        </p>
                        <span className="text-xs text-muted-foreground">
                          · {protocol.disinfectant} · {protocol.disinfectionInterval}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {lastLog ? (
                        <span>
                          Last:{" "}
                          <span className="font-medium text-foreground">
                            {formatDateTimeIST(lastLog.performedAt)} IST
                          </span>
                          {lastLog.performedBy && (
                            <span> by {lastLog.performedBy.name}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-amber-600">
                          No disinfection logged yet
                        </span>
                      )}

                      {nextDue && (
                        <span>
                          Next due:{" "}
                          <span
                            className={cn(
                              "font-medium",
                              overdueFlag
                                ? "text-red-600"
                                : "text-foreground"
                            )}
                          >
                            {formatDateTimeIST(nextDue)} IST
                          </span>
                        </span>
                      )}
                    </div>

                    {overdueFlag && (
                      <div className="flex items-center gap-1.5 rounded border border-red-300 bg-red-100 px-2.5 py-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-red-600" />
                        <p className="text-xs font-semibold text-red-700">
                          Disinfection overdue by more than 1 hour
                        </p>
                      </div>
                    )}

                    <LogDisinfectionButton protocolId={protocol.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
