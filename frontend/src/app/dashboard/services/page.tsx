"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

type Svc = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  order: number;
};

export default function ServicesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Svc[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", duration_minutes: "30" });
  const [err, setErr] = useState("");
  const [loadErr, setLoadErr] = useState("");

  async function load() {
    setLoadErr("");
    try {
      setRows(await apiFetch<Svc[]>("/api/business/me/services"));
    } catch (e) {
      const msg = (e as Error).message || "";
      if (/business not found/i.test(msg) || /404/.test(msg)) {
        router.replace("/dashboard/onboarding");
        return;
      }
      if (/401|not authenticated|invalid user/i.test(msg)) {
        router.replace("/login");
        return;
      }
      setLoadErr(msg || "Xizmatlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addSvc(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!form.name.trim()) {
      setErr("Xizmat nomini kiriting");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/business/me/services", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          price: parseInt(form.price || "0", 10) || 0,
          duration_minutes: parseInt(form.duration_minutes || "30", 10) || 30,
          order: rows.length,
        }),
      });
      setForm({ name: "", price: "", duration_minutes: "30" });
      setShowForm(false);
      await load();
    } catch (e) {
      setErr((e as Error).message || "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  async function removeSvc(id: string) {
    await apiFetch(`/api/business/me/services/${id}`, { method: "DELETE" }).catch(() => {});
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl">Xizmatlar</h2>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Yopish" : "+ Qo'shish"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={addSvc} className="space-y-3 rounded-xl border border-ink/10 bg-white p-4">
          <div>
            <label className="block text-xs text-ink/60">Xizmat nomi</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Soch olish"
              className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink/60">Narxi (so'm)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="50000"
                className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink/60">Davomiyligi (daq)</label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
              />
            </div>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </Button>
        </form>
      )}

      {loadErr ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          <div className="font-medium">Xatolik:</div>
          <div className="mt-1 break-all">{loadErr}</div>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => load()}>
            Qayta urinish
          </Button>
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-ink/10 bg-white p-6 text-sm text-ink/60">
          Yuklanmoqda…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-ink/10 bg-white p-6 text-sm text-ink/60">
          Hali xizmat qo'shilmagan. Yuqoridagi tugma orqali qo'shing.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-ink/10 bg-white p-4"
            >
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-ink/60">
                  {s.price.toLocaleString("uz-UZ")} so'm · {s.duration_minutes} daq
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await apiFetch(`/api/business/me/services/${s.id}/toggle`, { method: "PATCH" });
                    await load();
                  }}
                >
                  {s.is_active ? "Faol" : "O'chiq"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => removeSvc(s.id)}>
                  🗑
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
