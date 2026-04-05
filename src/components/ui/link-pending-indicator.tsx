"use client";

import { useLinkStatus } from "next/link";

interface LinkPendingIndicatorProps {
  loadingLabel: string;
  className?: string;
}

export function LinkPendingIndicator({
  loadingLabel,
  className = "tap-pending-indicator",
}: LinkPendingIndicatorProps) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span
        className={className}
        data-pending={pending ? "true" : "false"}
        aria-hidden="true"
      />
      {pending && <span className="sr-only">Loading {loadingLabel}</span>}
    </>
  );
}
