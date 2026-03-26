"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Tab {
  key: string;
  label: string;
}

const BASE_TABS: Tab[] = [
  { key: "vitals", label: "Vitals" },
  { key: "meds", label: "Meds" },
  { key: "food", label: "Food" },
  { key: "notes", label: "Notes" },
  { key: "labs", label: "Labs" },
  { key: "bath", label: "Bath" },
];

const ISOLATION_TAB: Tab = { key: "isolation", label: "Isolation" };

interface TabNavProps {
  ward: string | null;
  activeTab: string;
}

export function TabNav({ ward, activeTab }: TabNavProps) {
  const pathname = usePathname();

  const tabs =
    ward === "ISOLATION" ? [...BASE_TABS, ISOLATION_TAB] : BASE_TABS;

  return (
    <div className="bg-white border-b border-gray-200 overflow-x-auto">
      <div className="flex min-w-max">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={`${pathname}?tab=${tab.key}`}
              className={cn(
                "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                isActive
                  ? "border-clinic-teal text-clinic-teal"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
