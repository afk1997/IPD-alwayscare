import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryStats {
  totalActive: number;
  criticalCount: number;
  pendingMedsCount: number;
  feedingsCount: number;
  bathsDueCount: number;
}

interface StatCardProps {
  value: number;
  label: string;
  accentClass: string;
}

function StatCard({ value, label, accentClass }: StatCardProps) {
  return (
    <Card size="sm" className="min-w-[100px] flex-1 shrink-0">
      <CardContent className="flex flex-col items-center justify-center gap-0.5 py-3 px-2">
        <span className={cn("text-2xl font-bold leading-none", accentClass)}>
          {value}
        </span>
        <span className="text-center text-[11px] leading-tight text-muted-foreground">
          {label}
        </span>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ stats }: { stats: SummaryStats }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-5 md:overflow-visible">
      <StatCard
        value={stats.totalActive}
        label="Total IPD"
        accentClass="text-clinic-teal"
      />
      <StatCard
        value={stats.criticalCount}
        label="Critical"
        accentClass="text-clinic-red"
      />
      <StatCard
        value={stats.pendingMedsCount}
        label="Meds Due"
        accentClass="text-clinic-amber"
      />
      <StatCard
        value={stats.feedingsCount}
        label="Feedings"
        accentClass="text-clinic-blue"
      />
      <StatCard
        value={stats.bathsDueCount}
        label="Baths Due"
        accentClass="text-orange-500"
      />
    </div>
  );
}
