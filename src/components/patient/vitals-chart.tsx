"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatInTimeZone } from "date-fns-tz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VitalRecord {
  recordedAt: Date;
  temperature?: number | null;
  heartRate?: number | null;
}

interface VitalsChartProps {
  vitals: VitalRecord[];
}

const IST_ZONE = "Asia/Kolkata";

function formatXAxis(value: string) {
  return value;
}

// Custom dot renderer that colours abnormal readings red
function TempDot(props: {
  cx?: number;
  cy?: number;
  payload?: { temperature?: number | null };
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || payload?.temperature == null) return null;
  const temp = payload.temperature;
  const isAbnormal = temp > 39.5 || temp < 37.5;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={isAbnormal ? "#ef4444" : "#22c55e"}
      stroke="white"
      strokeWidth={1}
    />
  );
}

function HRDot(props: {
  cx?: number;
  cy?: number;
  payload?: { heartRate?: number | null };
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || payload?.heartRate == null) return null;
  const hr = payload.heartRate;
  const isAbnormal = hr > 140 || hr < 60;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={isAbnormal ? "#ef4444" : "#22c55e"}
      stroke="white"
      strokeWidth={1}
    />
  );
}

interface TooltipPayloadItem {
  name: string;
  value: number | null;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-background p-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.value != null ? entry.value : "—"}
          {entry.name === "Temp" ? "°C" : " bpm"}
        </p>
      ))}
    </div>
  );
}

export function VitalsChart({ vitals }: VitalsChartProps) {
  // Need at least 2 records to draw a meaningful chart
  if (vitals.length < 2) {
    return (
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Vitals Trend</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Not enough data for chart
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort oldest → newest for the chart
  const sorted = [...vitals].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  const data = sorted.map((v) => ({
    time: formatInTimeZone(new Date(v.recordedAt), IST_ZONE, "dd/MM HH:mm"),
    temperature: v.temperature ?? null,
    heartRate: v.heartRate ?? null,
  }));

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Vitals Trend</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 pr-2">
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />

            <XAxis
              dataKey="time"
              tick={{ fontSize: 10 }}
              tickFormatter={formatXAxis}
              interval="preserveStartEnd"
            />

            {/* Left Y-axis: Temperature */}
            <YAxis
              yAxisId="temp"
              orientation="left"
              domain={[36, 42]}
              tick={{ fontSize: 10 }}
              tickCount={7}
              label={{
                value: "°C",
                angle: -90,
                position: "insideLeft",
                offset: 10,
                style: { fontSize: 10 },
              }}
            />

            {/* Right Y-axis: Heart Rate */}
            <YAxis
              yAxisId="hr"
              orientation="right"
              domain={[40, 200]}
              tick={{ fontSize: 10 }}
              tickCount={6}
              label={{
                value: "bpm",
                angle: 90,
                position: "insideRight",
                offset: 10,
                style: { fontSize: 10 },
              }}
            />

            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            {/* Normal range band — Temperature: 37.5–39.5°C (light green) */}
            <ReferenceArea
              yAxisId="temp"
              y1={37.5}
              y2={39.5}
              fill="#86efac"
              fillOpacity={0.25}
              strokeOpacity={0}
            />

            {/* Normal range band — Heart Rate: 60–140 bpm (light blue) */}
            <ReferenceArea
              yAxisId="hr"
              y1={60}
              y2={140}
              fill="#93c5fd"
              fillOpacity={0.2}
              strokeOpacity={0}
            />

            {/* Temperature line (orange/red) */}
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temperature"
              name="Temp"
              stroke="#f97316"
              strokeWidth={2}
              dot={<TempDot />}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />

            {/* Heart Rate line (blue) */}
            <Line
              yAxisId="hr"
              type="monotone"
              dataKey="heartRate"
              name="HR"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={<HRDot />}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
