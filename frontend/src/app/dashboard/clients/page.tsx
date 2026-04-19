"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  visits: number;
  last_visit: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y.slice(2)}`;
}

export default function ClientsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Row[]>("/api/business/me/clients")
      .then((data) => {
        setRows(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const full = `${r.first_name || ""} ${r.last_name || ""}`.toLowerCase();
      return full.includes(needle) || (r.phone || "").toLowerCase().includes(needle);
    });
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Mijozlar</h2>
        <p className="mt-1 text-sm text-ink/60">{rows.length} ta mijoz</p>
      </div>

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ism yoki telefon bo'yicha qidirish"
        className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />

      {loading ? (
        <div className="card p-6 text-center text-sm text-ink/60">Yuklanmoqda…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink/60">
          {rows.length === 0 ? "Hali mijoz yo'q." : "Mijoz topilmadi."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => {
            const fullName =
              `${r.first_name || ""} ${r.last_name || ""}`.trim() || "Mijoz";
            return (
              <li key={r.id} className="card p-4">
                <div className="text-lg font-semibold">{fullName}</div>
                <div className="mt-2 space-y-1.5 text-sm">
                  <div className="flex gap-2">
                    <span className="w-5 text-ink/50">📞</span>
                    {r.phone ? (
                      <a href={`tel:${r.phone}`} className="text-brand hover:underline">
                        {r.phone}
                      </a>
                    ) : (
                      <span className="text-ink/40">Telefon yo&apos;q</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <span className="w-5 text-ink/50">📅</span>
                    <span>
                      {r.visits} ta tashrif · oxirgisi {formatDate(r.last_visit)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
