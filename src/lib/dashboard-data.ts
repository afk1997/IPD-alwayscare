export interface DashboardSummaryRow {
  id: string;
  ward: string | null;
  condition: string | null;
  pendingMeds: number;
  upcomingFeedings: number;
  bathDue: boolean;
  admissionDate: Date;
}

export function buildDashboardStats(rows: DashboardSummaryRow[]) {
  return {
    totalActive: rows.length,
    criticalCount: rows.filter((row) => row.condition === "CRITICAL").length,
    pendingMedsCount: rows.reduce((sum, row) => sum + row.pendingMeds, 0),
    feedingsCount: rows.reduce((sum, row) => sum + row.upcomingFeedings, 0),
    bathsDueCount: rows.filter((row) => row.bathDue).length,
  };
}

export function sortDashboardQueue<
  T extends { condition: string | null; admissionDate: Date },
>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aRank = a.condition === "CRITICAL" ? 0 : 1;
    const bRank = b.condition === "CRITICAL" ? 0 : 1;

    if (aRank !== bRank) {
      return aRank - bRank;
    }

    return b.admissionDate.getTime() - a.admissionDate.getTime();
  });
}

export function filterDashboardQueue<T extends { ward: string | null }>(
  rows: T[],
  wardFilter?: string
) {
  if (!wardFilter) {
    return rows;
  }

  return rows.filter((row) => row.ward === wardFilter);
}
