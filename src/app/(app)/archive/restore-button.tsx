"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { restorePatient } from "@/actions/admissions";

interface RestoreButtonProps {
  patientId: string;
  patientName: string;
}

export function RestoreButton({ patientId, patientName }: RestoreButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRestore() {
    setLoading(true);
    try {
      const result = await restorePatient(patientId);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${patientName} restored`);
        router.refresh();
      }
    } catch {
      toast.error("Failed to restore patient");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={handleRestore}
      disabled={loading}
    >
      <RotateCcw className="w-4 h-4" />
      {loading ? "Restoring..." : "Restore"}
    </Button>
  );
}
