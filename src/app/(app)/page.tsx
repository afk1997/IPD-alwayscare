import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTodayUTCDate } from "@/lib/date-utils";
import {
  filterDashboardQueue,
  sortDashboardQueue,
} from "@/lib/dashboard-data";
import {
  getDashboardQueue,
  getDashboardSecondaryData,
  getDashboardSummary,
} from "@/lib/dashboard-queries";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { IsolationAlert } from "@/components/dashboard/isolation-alert";
import { PendingSetup } from "@/components/dashboard/pending-setup";
import { PatientCard } from "@/components/dashboard/patient-card";
import { WardFilter } from "@/components/dashboard/ward-filter";

interface DashboardPageProps {
  searchParams: Promise<{ ward?: string }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { ward: wardFilter } = await searchParams;
  const today = getTodayUTCDate();
  const [stats, queueAdmissions, secondaryData] = await Promise.all([
    getDashboardSummary(today),
    getDashboardQueue(today),
    getDashboardSecondaryData(),
  ]);
  const sortedActive = sortDashboardQueue(queueAdmissions);
  const filteredAdmissions = filterDashboardQueue(sortedActive, wardFilter);
  const generalPatients = sortedActive.filter(
    (admission) => admission.ward === "GENERAL"
  );
  const isolationPatients = sortedActive.filter(
    (admission) => admission.ward === "ISOLATION"
  );
  const otherPatients = sortedActive.filter(
    (admission) =>
      admission.ward !== "GENERAL" && admission.ward !== "ISOLATION"
  );

  const isDoctor = session.role === "DOCTOR";

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <SummaryCards stats={stats} />

      <IsolationAlert admissions={secondaryData.isolationAdmissions} />

      <PendingSetup
        admissions={secondaryData.registeredAdmissions}
        isDoctor={isDoctor}
      />

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Active Patients
          {queueAdmissions.length > 0 && (
            <span className="ml-1.5 text-muted-foreground font-normal">
              ({queueAdmissions.length})
            </span>
          )}
        </h2>
        <Suspense fallback={null}>
          <WardFilter />
        </Suspense>
      </div>

      {filteredAdmissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {wardFilter
              ? `No ${wardFilter.toLowerCase()} ward patients`
              : "No active admissions"}
          </p>
        </div>
      ) : wardFilter ? (
        // Filtered view — flat list
        <div className="space-y-3">
          {filteredAdmissions.map((admission) => (
            <PatientCard key={String(admission.id)} admission={admission} />
          ))}
        </div>
      ) : (
        // Grouped view: General → Isolation → Others
        <div className="space-y-4">
          {generalPatients.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-clinic-teal">
                General Ward
              </p>
              <div className="space-y-3">
                {generalPatients.map((admission) => (
                  <PatientCard key={String(admission.id)} admission={admission} />
                ))}
              </div>
            </section>
          )}

          {isolationPatients.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-clinic-red">
                Isolation Ward
              </p>
              <div className="space-y-3">
                {isolationPatients.map((admission) => (
                  <PatientCard key={String(admission.id)} admission={admission} />
                ))}
              </div>
            </section>
          )}

          {otherPatients.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Other
              </p>
              <div className="space-y-3">
                {otherPatients.map((admission) => (
                  <PatientCard key={String(admission.id)} admission={admission} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
