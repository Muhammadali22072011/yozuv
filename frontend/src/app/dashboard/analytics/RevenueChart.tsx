"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type BarData = { day: string; value: number };

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { value?: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl bg-white/95 px-3 py-1.5 shadow-[0_8px_24px_-8px_rgba(11,15,31,0.45)] backdrop-blur-sm">
      <div className="font-display tnum text-sm font-extrabold tracking-tight text-ink-900">
        {payload[0]?.value}
      </div>
    </div>
  );
}

export function RevenueChart({
  bars,
  maxBar,
  highlightIdx,
}: {
  bars: BarData[];
  maxBar: number;
  highlightIdx: number;
}) {
  return (
    <ResponsiveContainer>
      <BarChart data={bars} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid
          vertical={false}
          stroke="rgba(255,255,255,0.08)"
          strokeDasharray="4 6"
        />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 700 }}
          dy={4}
        />
        <YAxis hide domain={[0, maxBar]} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.06)", radius: 10 }}
          content={<ChartTooltip />}
        />
        <Bar dataKey="value" radius={[10, 10, 10, 10]} maxBarSize={28}>
          {bars.map((_, i) => (
            <Cell
              key={i}
              fill={i === highlightIdx ? "#FFC94A" : "rgba(255,255,255,0.22)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
