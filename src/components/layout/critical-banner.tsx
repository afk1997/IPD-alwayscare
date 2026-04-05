"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { useNotifications } from "./notification-provider";

export function CriticalBanner() {
  const { notifications } = useNotifications();
  const [dismissedSignature, setDismissedSignature] = useState("");
  const router = useRouter();

  // When new critical/urgent notifications arrive after a dismiss, show the banner again
  const criticalAndUrgent = notifications.filter(
    (n) => n.type === "urgent" || n.type === "critical"
  );

  const currentSignature = criticalAndUrgent
    .map((n) => n.id)
    .sort()
    .join("|");
  const dismissed = currentSignature !== "" && currentSignature === dismissedSignature;

  if (criticalAndUrgent.length === 0 || dismissed) {
    return null;
  }

  const most = criticalAndUrgent[0];

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    setDismissedSignature(currentSignature);
  }

  function handleNavigate() {
    const tab =
      most.category === "MEDS"
        ? "meds"
        : most.category === "FOOD"
          ? "food"
          : most.category === "BATH"
            ? "bath"
            : most.category === "DISINFECTION"
              ? "isolation"
              : "vitals";
    router.push(`/patients/${most.admissionId}?tab=${tab}`);
  }

  return (
    <div
      role="alert"
      className="sticky top-14 z-30 flex w-full cursor-pointer items-center gap-2 bg-red-600 px-3 py-2 text-white shadow-sm"
      onClick={handleNavigate}
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 items-center gap-2 flex-wrap">
        {criticalAndUrgent.length > 1 && (
          <span className="shrink-0 rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] font-bold">
            {criticalAndUrgent.length}
          </span>
        )}
        <span className="truncate text-sm font-semibold">
          {most.patientName}: {most.title}
        </span>
        {most.description && (
          <span className="hidden shrink-0 text-xs text-red-200 sm:block">
            {most.description}
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss alert"
        onClick={handleDismiss}
        className="ml-auto shrink-0 rounded p-0.5 hover:bg-white/20 active:bg-white/30"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
