"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const FILTERS = [
  { label: "All", value: "" },
  { label: "General", value: "GENERAL" },
  { label: "Isolation", value: "ISOLATION" },
] as const;

export function WardFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentWard = searchParams.get("ward") ?? "";

  function setWard(ward: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (ward) {
      params.set("ward", ward);
    } else {
      params.delete("ward");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          onClick={() => setWard(filter.value)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            currentWard === filter.value
              ? "bg-clinic-teal text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
