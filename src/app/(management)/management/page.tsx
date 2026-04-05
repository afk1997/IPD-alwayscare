import Link from "next/link";
import { getManagementDashboardData } from "@/lib/management-dashboard-queries";
import { ProofCarousel } from "@/components/management/proof-carousel";
import { PatientCard } from "@/components/management/patient-card";
import { AlertTriangle, Users, HeartPulse, Pill, Utensils } from "lucide-react";

interface ManagementPageProps {
  searchParams: Promise<{ ward?: string }>;
}

const WARDS = ["ALL", "GENERAL", "ISOLATION", "ICU"] as const;

export default async function ManagementDashboardPage({ searchParams }: ManagementPageProps) {
  const { ward } = await searchParams;
  const data = await getManagementDashboardData(ward);

  return (
    <div className="pb-8">
      {/* Stat Strip */}
      <div className="grid grid-cols-4 gap-2 p-4">
        <StatCard icon={<Users className="w-4 h-4" />} value={data.stats.active} label="Active" />
        <StatCard icon={<HeartPulse className="w-4 h-4 text-red-500" />} value={data.stats.critical} label="Critical" alert={data.stats.critical > 0} />
        <StatCard icon={<Pill className="w-4 h-4 text-amber-500" />} value={data.stats.overdueMeds} label="Meds Due" alert={data.stats.overdueMeds > 0} />
        <StatCard icon={<Utensils className="w-4 h-4 text-amber-500" />} value={data.stats.overdueFeeds} label="Feeds Due" alert={data.stats.overdueFeeds > 0} />
      </div>

      {/* Proof Carousel */}
      <div className="border-y bg-muted/30">
        <ProofCarousel items={data.proofCarousel} />
      </div>

      {/* Overdue Alerts */}
      {data.overdueItems.length > 0 && (
        <div className="px-4 pt-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <h3 className="text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center gap-1 mb-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              {data.overdueItems.length} Overdue
            </h3>
            <div className="space-y-1">
              {data.overdueItems.map((item, i) => (
                <Link
                  key={i}
                  href={`/management/patients/${item.admissionId}?tab=today`}
                  className="flex items-center justify-between text-xs py-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1 -mx-1"
                >
                  <span className="truncate">
                    <span className="font-medium">{item.patientName}</span>: {item.label}
                  </span>
                  <span className="text-amber-700 dark:text-amber-300 shrink-0 ml-2">{item.minutesLate}m</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ward Filter */}
      <div className="flex gap-1.5 px-4 pt-4">
        {WARDS.map((w) => (
          <Link
            key={w}
            href={w === "ALL" ? "/management" : `/management?ward=${w}`}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              (ward ?? "ALL") === w
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {w}
          </Link>
        ))}
      </div>

      {/* Patient Cards */}
      <div className="space-y-2 px-4 pt-3">
        {data.patientCards.map((patient) => (
          <PatientCard key={patient.admissionId} patient={patient} />
        ))}
        {data.patientCards.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No active patients{ward ? ` in ${ward}` : ""}</p>
        )}
      </div>

      {/* Registered Patients */}
      {data.registeredPatients.length > 0 && (
        <div className="px-4 pt-4">
          <details className="rounded-lg border">
            <summary className="p-3 text-sm font-medium cursor-pointer">
              Awaiting Setup ({data.registeredPatients.length})
            </summary>
            <div className="border-t px-3 pb-3 space-y-2 pt-2">
              {data.registeredPatients.map((p) => (
                <div key={p.admissionId} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{p.patientName}</span> · {p.species} · by {p.admittedBy}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, alert }: { icon: React.ReactNode; value: number; label: string; alert?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 text-center ${alert ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : "bg-card"}`}>
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className="text-lg font-bold">{value}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
