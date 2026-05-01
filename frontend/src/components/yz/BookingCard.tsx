"use client";

import type { BookingRow } from "@/types";
import { Avatar } from "./Avatar";
import { StatusBadge, statusAccent } from "./StatusBadge";
import { fmtSum, hm, durationMin } from "./utils";

export type ServiceLite = { id: string; name: string; price?: number };
export type ClientLite = {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
};

export function BookingCard({
  b,
  services,
  clients,
  onClick,
}: {
  b: BookingRow;
  services?: ServiceLite[];
  clients?: ClientLite[];
  onClick?: () => void;
}) {
  const svc = services?.find((s) => s.id === b.service_id);
  const cli = clients?.find((c) => c.id === b.client_id);
  const name = cli ? `${cli.first_name || ""} ${cli.last_name || ""}`.trim() || "Mijoz" : "Mijoz";
  const dur = durationMin(b.start_time, b.end_time);
  const accent = statusAccent(b.status);

  return (
    <button
      onClick={onClick}
      className="card-soft flex w-full items-center gap-3 p-3 text-left tap"
    >
      <div className="min-w-[52px]">
        <div className="font-display text-base font-extrabold tracking-tight text-ink-900">
          {hm(b.start_time)}
        </div>
        <div className="text-[11px] font-semibold text-ink-400">{dur} daq</div>
      </div>
      <div className="h-10 w-[3px] rounded-full" style={{ background: accent }} />
      <Avatar name={name} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-bold text-ink-900">{name}</div>
        <div className="truncate text-xs text-ink-500">{svc?.name || "Xizmat"}</div>
      </div>
      <StatusBadge status={b.status} compact />
    </button>
  );
}

export function TimelineBlock({
  b,
  services,
  clients,
  onClick,
}: {
  b: BookingRow;
  services?: ServiceLite[];
  clients?: ClientLite[];
  onClick?: () => void;
}) {
  const svc = services?.find((s) => s.id === b.service_id);
  const cli = clients?.find((c) => c.id === b.client_id);
  const name = cli ? `${cli.first_name || ""} ${cli.last_name || ""}`.trim() || "Mijoz" : "Mijoz";
  const dur = durationMin(b.start_time, b.end_time);
  const isPending = b.status === "PENDING";
  const bg = isPending
    ? "linear-gradient(135deg,#FFF3DA,#FFE5B0)"
    : "linear-gradient(135deg,#EEF0FF,#E0E4FF)";
  const border = isPending ? "#D97706" : "#4853F5";

  return (
    <button
      onClick={onClick}
      className="mb-2 flex w-full items-center gap-3 rounded-2xl border-l-[3px] px-3.5 py-3 text-left tap"
      style={{ background: bg, borderLeftColor: border }}
    >
      <Avatar name={name} size={32} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-bold text-ink-900">{name}</div>
        <div className="truncate text-xs text-ink-500">
          {svc?.name || "Xizmat"} · {dur} daq
        </div>
      </div>
      <div className="font-display text-[13px] font-extrabold text-ink-900">
        {fmtSum(b.payment_amount)}
      </div>
    </button>
  );
}
