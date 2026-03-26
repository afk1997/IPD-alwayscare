"use client";

import { useState } from "react";
import { toast } from "sonner";
import { logDisinfection } from "@/actions/isolation";

interface LogDisinfectionButtonProps {
  protocolId: string;
}

export function LogDisinfectionButton({
  protocolId,
}: LogDisinfectionButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await logDisinfection(protocolId);
      if (result?.success) {
        toast.success("Disinfection logged");
      }
    } catch {
      toast.error("Failed to log disinfection");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
    >
      {loading ? "Logging..." : "Log Disinfection"}
    </button>
  );
}
