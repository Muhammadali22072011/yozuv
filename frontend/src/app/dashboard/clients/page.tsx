"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Avatar,
  ClientSheet,
  NewBookingSheet,
  ScreenHeader,
  fmtSum,
} from "@/components/yz";
import type { ClientDetail } from "@/components/yz";
import { Chip } from "@/components/yz/Chip";
import { apiFetch } from "@/lib/api";

type Row = {
  id: string;
  telegram_id?: number | null;
  first_name: string;
  last_name: string;
  phone: string;
  visits: number;
  last_visit: string | null;
  total_spent?: number;
  favorite_service?: string | null;
  is_vip?: boolean;
  is_new?: boolean;
};

export default function ClientsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "vip" | "new">("all");
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ClientDetail | null>(null);
  const [newBookingFor, setNewBookingFor] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Row[]>("/api/business/me/clients")
      .then((data) => {
        setRows(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === "vip") list = list.filter((r) => r.is_vip);
    if (filter === "new") list = list.filter((r) => r.visits === 0 || r.is_new);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((r) => {
        const full = `${r.first_name || ""} ${r.last_name || ""}`.toLowerCase();
        return full.includes(needle) || (r.phone || "").toLowerCase().includes(needle);
      });
    }
    return list;
  }, [rows, q, filter]);

  const vipCount = rows.filter((r) => r.is_vip).length;
  const newCount = rows.filter((r) => r.visits === 0 || r.is_new).length;

  return (
    <div>
      <ScreenHeader title="Mijozlar" subtitle={`${rows.length} ta faol mijoz`} />

      <div className="mt-1 px-4 md:px-0">
        <div className="flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-3 shadow-soft">
          <Search className="h-5 w-5 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ism yoki telefon"
            className="flex-1 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
          />
        </div>
      </div>

      <div className="mt-3 flex gap-2 px-4 md:px-0">
        <Chip active={filter === "all"} count={rows.length} onClick={() => setFilter("all")}>
          Hammasi
        </Chip>
        <Chip active={filter === "vip"} count={vipCount} onClick={() => setFilter("vip")}>
          VIP
        </Chip>
        <Chip active={filter === "new"} count={newCount} onClick={() => setFilter("new")}>
          Yangi
        </Chip>
      </div>

      <div className="mt-4 flex flex-col gap-2 px-4 md:px-0">
        {loading ? (
          <div className="rounded-[22px] bg-white p-6 text-center text-sm text-ink-400 shadow-soft">
            Yuklanmoqda…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[22px] bg-white p-6 text-center text-sm text-ink-400 shadow-soft">
            {rows.length === 0 ? "Hali mijoz yo‘q" : "Mijoz topilmadi"}
          </div>
        ) : (
          filtered.map((r) => {
            const name =
              `${r.first_name || ""} ${r.last_name || ""}`.trim() || "Mijoz";
            const isNew = r.visits === 0 || r.is_new;
            return (
              <button
                key={r.id}
                onClick={() =>
                  setActive({
                    id: r.id,
                    telegram_id: r.telegram_id ?? null,
                    first_name: r.first_name,
                    last_name: r.last_name,
                    phone: r.phone,
                    visits: r.visits,
                    last_visit: r.last_visit,
                    total_spent: r.total_spent,
                    favorite_service: r.favorite_service,
                    is_vip: r.is_vip,
                  })
                }
                className="card-soft flex items-center gap-3 p-3.5 text-left tap"
              >
                <Avatar name={name} size={46} vip={r.is_vip} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate font-display text-[15px] font-bold text-ink-900">
                      {name}
                    </div>
                    {isNew && (
                      <span className="rounded-full bg-[#FFE7E3] px-1.5 py-0.5 text-[10px] font-extrabold text-[#C93A2A]">
                        YANGI
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-ink-500">
                    {r.visits} ta tashrif · {r.last_visit?.slice(0, 10) || "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-sm font-extrabold text-ink-900">
                    {fmtSum(r.total_spent)}
                  </div>
                  <div className="text-[10px] font-semibold text-ink-400">so‘m</div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <ClientSheet
        open={!!active}
        onOpenChange={(v) => !v && setActive(null)}
        client={active}
        onNewBooking={(c) => setNewBookingFor(c.id)}
      />
      <NewBookingSheet
        open={!!newBookingFor}
        onOpenChange={(v) => !v && setNewBookingFor(null)}
        defaultClientId={newBookingFor || undefined}
        onCreated={() => setNewBookingFor(null)}
      />
    </div>
  );
}
