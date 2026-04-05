import { formatInTimeZone } from "date-fns-tz";
import type { LogsTimelineEntry } from "@/lib/logs-read-model";

interface HistoryTabProps {
  notes: { id: string; category: string; content: string; recordedAt: Date; recordedBy: { name: string; role: string } }[];
  labs: { id: string; testName: string; testType: string; result: string; isAbnormal: boolean; resultDate: Date | null; notes: string | null }[];
  logEntries: LogsTimelineEntry[];
}

const CATEGORY_LABELS: Record<string, string> = {
  OBSERVATION: "Observation",
  BEHAVIOR: "Behavior",
  WOUND_CARE: "Wound Care",
  ELIMINATION: "Elimination",
  PROCEDURE: "Procedure",
  DOCTOR_ROUND: "Doctor Round",
  SHIFT_HANDOVER: "Shift Handover",
  OTHER: "Other",
};

export function HistoryTab({ notes, labs, logEntries }: HistoryTabProps) {
  return (
    <div className="space-y-6 pb-8">
      {/* Clinical Notes */}
      <section>
        <h3 className="text-sm font-semibold px-1 mb-2">Clinical Notes ({notes.length})</h3>
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="p-3 rounded-lg border bg-card text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">
                  {CATEGORY_LABELS[note.category] ?? note.category}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {note.recordedBy.name} · {formatInTimeZone(new Date(note.recordedAt), "Asia/Kolkata", "dd/MM HH:mm")}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
          {notes.length === 0 && <p className="text-xs text-muted-foreground px-1">No clinical notes</p>}
        </div>
      </section>

      {/* Lab Results */}
      {labs.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold px-1 mb-2">Lab Results ({labs.length})</h3>
          <div className="space-y-2">
            {labs.map((lab) => (
              <div key={lab.id} className="p-3 rounded-lg border bg-card text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{lab.testName}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${lab.isAbnormal ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                    {lab.isAbnormal ? "ABNORMAL" : "NORMAL"}
                  </span>
                </div>
                <p className="text-xs mt-1">{lab.result}</p>
                {lab.notes && <p className="text-xs text-muted-foreground mt-1">{lab.notes}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Activity Timeline */}
      <section>
        <h3 className="text-sm font-semibold px-1 mb-2">Activity Log ({logEntries.length})</h3>
        <div className="space-y-1">
          {logEntries.slice(0, 50).map((entry, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 text-xs border-b last:border-0">
              <span className="text-muted-foreground shrink-0 w-10">
                {formatInTimeZone(new Date(entry.time), "Asia/Kolkata", "HH:mm")}
              </span>
              <span>{entry.icon}</span>
              <span className="flex-1">{entry.description}</span>
              {entry.by && <span className="text-muted-foreground shrink-0">{entry.by}</span>}
            </div>
          ))}
          {logEntries.length === 0 && <p className="text-xs text-muted-foreground px-1">No activity recorded</p>}
        </div>
      </section>
    </div>
  );
}
