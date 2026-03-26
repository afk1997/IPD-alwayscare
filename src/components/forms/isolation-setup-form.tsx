"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PPE_OPTIONS, DISINFECTION_INTERVALS } from "@/lib/constants";

interface IsolationSetupFormProps {
  disease: string;
  onDiseaseChange: (v: string) => void;
  ppeRequired: string[];
  onPpeChange: (ppe: string[]) => void;
  disinfectant: string;
  onDisinfectantChange: (v: string) => void;
  disinfectionInterval: string;
  onDisinfectionIntervalChange: (v: string) => void;
  biosecurityNotes: string;
  onBiosecurityNotesChange: (v: string) => void;
}

export function IsolationSetupForm({
  disease,
  onDiseaseChange,
  ppeRequired,
  onPpeChange,
  disinfectant,
  onDisinfectantChange,
  disinfectionInterval,
  onDisinfectionIntervalChange,
  biosecurityNotes,
  onBiosecurityNotesChange,
}: IsolationSetupFormProps) {
  function togglePpe(option: string) {
    if (ppeRequired.includes(option)) {
      onPpeChange(ppeRequired.filter((p) => p !== option));
    } else {
      onPpeChange([...ppeRequired, option]);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-700">Isolation Protocol</p>

      {/* Disease */}
      <div className="space-y-1.5">
        <Label htmlFor="disease">
          Disease / Suspected Condition <span className="text-red-500">*</span>
        </Label>
        <Input
          id="disease"
          value={disease}
          onChange={(e) => onDiseaseChange(e.target.value)}
          placeholder="e.g., Parvovirus, Distemper"
          className="h-11 bg-white"
        />
      </div>

      {/* PPE Required */}
      <div className="space-y-2">
        <Label>PPE Required</Label>
        <div className="grid grid-cols-2 gap-2">
          {PPE_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-red-600"
                checked={ppeRequired.includes(option)}
                onChange={() => togglePpe(option)}
              />
              {option}
            </label>
          ))}
        </div>
      </div>

      {/* Disinfectant */}
      <div className="space-y-1.5">
        <Label htmlFor="disinfectant">Disinfectant</Label>
        <Input
          id="disinfectant"
          value={disinfectant}
          onChange={(e) => onDisinfectantChange(e.target.value)}
          placeholder="Quaternary ammonium compound"
          className="h-11 bg-white"
        />
      </div>

      {/* Disinfection Interval */}
      <div className="space-y-1.5">
        <Label>Disinfection Interval</Label>
        <Select
          value={disinfectionInterval}
          onValueChange={(v) => { if (v) onDisinfectionIntervalChange(v); }}
        >
          <SelectTrigger className="h-11 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISINFECTION_INTERVALS.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Biosecurity Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="biosecurityNotes">Biosecurity Notes</Label>
        <Textarea
          id="biosecurityNotes"
          value={biosecurityNotes}
          onChange={(e) => onBiosecurityNotesChange(e.target.value)}
          placeholder="Any additional biosecurity instructions..."
          rows={3}
          className="bg-white"
        />
      </div>
    </div>
  );
}
