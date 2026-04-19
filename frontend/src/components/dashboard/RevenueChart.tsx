"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function shortDate(iso: string) {
  const s = (iso || "").slice(5); // MM-DD
  return s.replace("-", "/");
}

function fmtSum(n: number) {
  if (!n) return "0 so'm";
  return new Intl.NumberFormat("uz-UZ").format(n) + " so'm";
}

export function RevenueChart(props: { data: { date: string; amount: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={props.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={shortDate}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            width={36}
          />
          <Tooltip
            formatter={(v: number) => [fmtSum(v), "Daromad"]}
            labelFormatter={(l: string) => `Sana: ${l}`}
            contentStyle={{ borderRadius: 12, border: "1px solid #E5E5E5", fontSize: 12 }}
          />
          <Line type="monotone" dataKey="amount" stroke="#111111" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
