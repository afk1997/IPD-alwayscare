"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dischargePatient } from "@/actions/admissions";
import { LogOut } from "lucide-react";

interface DischargeFormProps {
  admissionId: string;
}

export function DischargeForm({ admissionId }: DischargeFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [condition, setCondition] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("condition", condition);

    const result = await dischargePatient(admissionId, formData);
    setLoading(false);

    if (result && "error" in result && result.error) {
      toast.error(result.error);
    }
    // On success, dischargePatient server action calls redirect("/") itself
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-clinic-red border-clinic-red hover:bg-clinic-red-light"
          />
        }
      >
        <LogOut className="w-4 h-4" />
        <span className="text-xs">Discharge</span>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Discharge Patient</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="dischargeNotes">Discharge Notes *</Label>
            <Textarea
              id="dischargeNotes"
              name="dischargeNotes"
              placeholder="Summary of treatment, follow-up instructions..."
              rows={4}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Final Condition *</Label>
            <Select
              value={condition}
              onValueChange={(v) => setCondition(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select final condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RECOVERED">Recovered</SelectItem>
                <SelectItem value="DECEASED">Deceased</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !condition}>
              {loading ? "Discharging..." : "Confirm Discharge"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
