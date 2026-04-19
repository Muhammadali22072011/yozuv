"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

type Promo = {
  id: string;
  code: string;
  discount_percent: number;
  discount_amount: number;
  max_uses: number;
  uses_count: number;
  is_active: boolean;
};

export default function PromoPage() {
  const [rows, setRows] = useState<Promo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    code: "",
    discount_percent: "10",
    discount_amount: "",
    max_uses: "0",
  });

  async function load() {
    try {
      const r = await apiFetch<Promo[]>("/api/business/me/promo-codes");
      setRows(r);
    } catch (e) {
      setErr((e as Error).message || "Xatolik");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!form.code.trim()) {
      setErr("Kod kiriting");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/business/me/promo-codes", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          discount_percent: parseInt(form.discount_percent || "0", 10) || 0,
          discount_amount: parseInt(form.discount_amount || "0", 10) || 0,
          max_uses: parseInt(form.max_uses || "0", 10) || 0,
        }),
      });
      setForm({ code: "", discount_percent: "10", discount_amount: "", max_uses: "0" });
      setShowForm(false);
      await load();
    } catch (e) {
      setErr((e as Error).message || "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: string) {
    await apiFetch(`/api/business/me/promo-codes/${id}/toggle`, { method: "PATCH" }).catch(() => {});
    await load();
  }

  async function remove(id: string) {
    await apiFetch(`/api/business/me/promo-codes/${id}`, { method: "DELETE" }).catch(() => {});
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl">Promo-kodlar</h2>
          <p className="mt-1 text-sm text-ink/60">
            Mijozlarga chegirma bering — yangi mijozlar jalb qiling.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Yopish" : "+ Yangi kod"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={add} className="space-y-3 rounded-2xl border border-ink/10 bg-white p-4">
          <div>
            <label className="block text-xs text-ink/60">Kod (masalan: SUMMER20)</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="SUMMER20"
              className="mt-1 w-full rounded-md border border-ink/10 p-2 font-mono text-sm uppercase"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink/60">Chegirma %</label>
              <input
                type="number"
                value={form.discount_percent}
                onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                placeholder="10"
                className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink/60">Yoki so&apos;m</label>
              <input
                type="number"
                value={form.discount_amount}
                onChange={(e) => setForm({ ...form, discount_amount: e.target.value })}
                placeholder="10000"
                className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-ink/60">Maksimal qo&apos;llanilish (0 = cheksiz)</label>
            <input
              type="number"
              value={form.max_uses}
              onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
            />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </Button>
        </form>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/10 bg-white p-6 text-center text-sm text-ink/60">
          Hali promo-kod yo&apos;q. Yuqoridan yangi yarating.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border p-4 ${
                p.is_active ? "border-ink/10 bg-white" : "border-ink/10 bg-cream/40 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-lg font-bold tracking-wide">{p.code}</div>
                  <div className="mt-1 text-sm text-ink/70">
                    {p.discount_percent > 0 && <>−{p.discount_percent}% </>}
                    {p.discount_amount > 0 && (
                      <>−{p.discount_amount.toLocaleString("uz-UZ")} so&apos;m </>
                    )}
                    · Ishlatildi: {p.uses_count}
                    {p.max_uses > 0 ? `/${p.max_uses}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggle(p.id)}>
                    {p.is_active ? "Faol" : "O'chiq"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(p.id)}>
                    🗑
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
