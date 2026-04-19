"use client";

import { Button } from "@/components/ui/button";
import type { BookingRow, BookingStatus } from "@/types";
import { apiFetch } from "@/lib/api";

export type ServiceLite = { id: string; name: string; price?: number };
export type ClientLite = {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
};

type Props = {
  rows: BookingRow[];
  services?: ServiceLite[];
  clients?: ClientLite[];
  onChanged?: () => void;
  emptyMessage?: string;
};

const statusLabel: Record<BookingStatus, string> = {
  PENDING: "Kutilmoqda",
  CONFIRMED: "Tasdiqlangan",
  CANCELLED: "Bekor qilingan",
  COMPLETED: "Yakunlangan",
};

const statusClass: Record<BookingStatus, string> = {
  PENDING: "pill-warn",
  CONFIRMED: "pill-success",
  CANCELLED: "pill-danger",
  COMPLETED: "pill-muted",
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y.slice(2)}`;
}

function formatSum(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toLocaleString("uz-UZ")} so'm`;
}

export function BookingsList({
  rows,
  services = [],
  clients = [],
  onChanged,
  emptyMessage = "Hali yozilish yo'q.",
}: Props) {
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  async function confirm(id: string) {
    await apiFetch(`/api/business/me/bookings/${id}/confirm`, { method: "PUT" });
    onChanged?.();
  }

  async function cancel(id: string) {
    await apiFetch(`/api/business/me/bookings/${id}/cancel`, {
      method: "PUT",
      body: JSON.stringify({ reason: "Dashboard" }),
    });
    onChanged?.();
  }

  if (rows.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-ink/60">{emptyMessage}</div>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((b) => {
        const svc = b.service_id ? serviceById.get(b.service_id) : undefined;
        const cli = b.client_id ? clientById.get(b.client_id) : undefined;
        const fullName = cli
          ? `${cli.first_name || ""} ${cli.last_name || ""}`.trim() || "Mijoz"
          : "Mijoz";

        return (
          <li key={b.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="text-lg font-semibold">{fullName}</div>
              <span className={statusClass[b.status]}>{statusLabel[b.status]}</span>
            </div>

            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <span className="w-5 text-ink/50">✂️</span>
                <span>{svc?.name ?? "Xizmat"}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-5 text-ink/50">📅</span>
                <span>
                  {formatDate(b.date)} · {b.start_time?.slice(0, 5)}
                </span>
              </div>
              {cli?.phone && (
                <div className="flex gap-2">
                  <span className="w-5 text-ink/50">📞</span>
                  <a href={`tel:${cli.phone}`} className="text-brand hover:underline">
                    {cli.phone}
                  </a>
                </div>
              )}
              <div className="flex gap-2">
                <span className="w-5 text-ink/50">💰</span>
                <span className="font-medium">{formatSum(b.payment_amount)}</span>
              </div>
            </div>

            {b.status === "PENDING" && (
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => confirm(b.id)}
                  className="flex-1 bg-success hover:bg-success/90"
                >
                  ✅ Tasdiqlash
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cancel(b.id)}
                  className="flex-1"
                >
                  ❌ Bekor qilish
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
