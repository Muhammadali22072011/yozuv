"use client";

import { CalendarDays, Users, Wallet } from "lucide-react";

function Stat({
  icon: Icon,
  label,
  value,
  caption,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  caption: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-ink/50">{label}</span>
        <div className={`grid h-9 w-9 place-items-center rounded-lg ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 font-serif text-3xl text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink/50">{caption}</p>
    </div>
  );
}

export function StatsCards(props: { bookings: number; revenue: number; clients: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Stat
        icon={CalendarDays}
        label="Yozilishlar"
        value={String(props.bookings)}
        caption="so'nggi 7 kun"
        accent="bg-cream text-ink"
      />
      <Stat
        icon={Wallet}
        label="Daromad"
        value={`${props.revenue.toLocaleString("uz-UZ")} so'm`}
        caption="taxminiy, 7 kun"
        accent="bg-ink text-white"
      />
      <Stat
        icon={Users}
        label="Mijozlar"
        value={String(props.clients)}
        caption="faol davr"
        accent="bg-cream text-ink"
      />
    </div>
  );
}
