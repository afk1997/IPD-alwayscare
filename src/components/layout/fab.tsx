"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, UserPlus, Pill } from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  {
    href: "/patients/new",
    label: "Admit Patient",
    icon: UserPlus,
  },
  {
    href: "/schedule",
    label: "Med Checkoff",
    icon: Pill,
  },
];

export function FAB() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-3">
      {/* Action buttons — expand upward when open */}
      <div
        className={cn(
          "flex flex-col items-end gap-2 transition-all duration-200",
          open ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2"
        )}
      >
        {actions.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-foreground shadow-md ring-1 ring-border active:bg-muted"
          >
            <Icon className="size-4 text-clinic-teal" />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      {/* Main FAB button */}
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open quick actions"}
        onClick={() => setOpen((prev) => !prev)}
        className="flex size-14 items-center justify-center rounded-full bg-clinic-teal text-white shadow-lg transition-transform active:scale-95"
      >
        <Plus
          className={cn(
            "size-6 transition-transform duration-200",
            open && "rotate-45"
          )}
        />
      </button>
    </div>
  );
}
