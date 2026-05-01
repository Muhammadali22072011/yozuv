"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";

type BarData = { day: string; value: number };

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
      <BarChart data={bars}>
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 700 }}
        />
        <YAxis hide domain={[0, maxBar]} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {bars.map((_, i) => (
            <Cell
              key={i}
              fill={i === highlightIdx ? "#FFC94A" : "rgba(255,255,255,0.25)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
