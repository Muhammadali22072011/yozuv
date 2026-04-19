"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import type { BusinessMe } from "@/types";

type Sub = { plan: string; status: string; expires_at: string | null };

export default function ProfilePage() {
  const [biz, setBiz] = useState<BusinessMe | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [me, setMe] = useState<{ first_name: string; last_name: string; telegram_id: number; username?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    address: "",
    phone: "",
    welcome_text: "",
    after_booking_text: "",
    reminder_text: "",
    language: "UZ" as "UZ" | "RU",
    confirmation_mode: "MANUAL" as "AUTO" | "MANUAL" | "PREPAYMENT",
  });

  useEffect(() => {
    Promise.all([
      apiFetch<BusinessMe>("/api/business/me"),
      apiFetch<Sub>("/api/subscription").catch(() => null),
      apiFetch<{ first_name: string; last_name: string; telegram_id: number; username?: string }>("/api/auth/me").catch(() => null),
    ]).then(([b, s, u]) => {
      setBiz(b);
      setSub(s);
      setMe(u);
      setForm({
        name: b.name,
        description: b.description,
        address: b.address,
        phone: b.phone,
        welcome_text: b.welcome_text,
        after_booking_text: b.after_booking_text,
        reminder_text: b.reminder_text,
        language: (b.language as "UZ" | "RU") || "UZ",
        confirmation_mode: (b.confirmation_mode as "AUTO" | "MANUAL" | "PREPAYMENT") || "MANUAL",
      });
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const updated = await apiFetch<BusinessMe>("/api/business/me", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setBiz(updated);
      setMsg("Saqlandi ✓");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setMsg((e as Error).message || "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  if (!biz) return <p className="text-sm text-ink/60">Yuklanmoqda…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="font-serif text-3xl">Profil</h2>

      <section className="rounded-2xl border border-ink/10 bg-white p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-ink text-xl text-white">
            {(me?.first_name?.[0] || "?").toUpperCase()}
          </div>
          <div>
            <div className="font-serif text-xl">
              {me?.first_name} {me?.last_name}
            </div>
            {me?.username && (
              <a
                href={`https://t.me/${me.username}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-brand hover:underline"
              >
                @{me.username}
              </a>
            )}
            <div className="text-xs text-ink/60">Telegram ID: {me?.telegram_id}</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-serif text-lg">Biznes</h3>
        <p className="mt-1 text-xs text-ink/60">
          Slug: <span className="font-mono">{biz.slug}</span> · Kategoriya: {biz.category}
        </p>
        {sub && (
          <p className="mt-2 text-xs text-ink/60">
            Tarif: <span className="font-medium">{sub.plan}</span> · {sub.status}
            {sub.expires_at ? ` · ${sub.expires_at.slice(0, 10)} gacha` : ""}
          </p>
        )}
        <p className="mt-3 rounded-md bg-cream p-3 font-mono text-xs">
          t.me/Yozuv_cl_bot?start={biz.slug}
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-serif text-lg">Asosiy ma&apos;lumot</h3>
        <div>
          <label className="block text-xs text-ink/60">Nomi</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-ink/60">Telefon</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-ink/60">Til</label>
            <select
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value as "UZ" | "RU" })}
              className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
            >
              <option value="UZ">O&apos;zbekcha</option>
              <option value="RU">Русский</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-ink/60">Manzil</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-ink/60">Tavsif</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
          />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-serif text-lg">Bot matnlari</h3>
        <div>
          <label className="block text-xs text-ink/60">Salomlashish matni</label>
          <textarea
            value={form.welcome_text}
            onChange={(e) => setForm({ ...form, welcome_text: e.target.value })}
            rows={2}
            placeholder="Xush kelibsiz! Yozilish uchun..."
            className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-ink/60">Yozilishdan keyin</label>
          <textarea
            value={form.after_booking_text}
            onChange={(e) => setForm({ ...form, after_booking_text: e.target.value })}
            rows={2}
            placeholder="5 daqiqa oldinroq keling."
            className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-ink/60">Eslatma matni</label>
          <textarea
            value={form.reminder_text}
            onChange={(e) => setForm({ ...form, reminder_text: e.target.value })}
            rows={2}
            placeholder="Bir soatdan keyin yozilishingiz bor."
            className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-serif text-lg">Tasdiqlash rejimi</h3>
        <div className="mt-3 space-y-2 text-sm">
          {(
            [
              ["AUTO", "Avtomatik", "Mijoz yozilishi avtomatik tasdiqlanadi"],
              ["MANUAL", "Qo'lda", "Siz har bir yozilishni tasdiqlaysiz"],
              ["PREPAYMENT", "Oldindan to'lov", "Mijoz to'laganda tasdiqlanadi"],
            ] as const
          ).map(([val, title, desc]) => (
            <label
              key={val}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                form.confirmation_mode === val ? "border-ink bg-cream/50" : "border-ink/10"
              }`}
            >
              <input
                type="radio"
                checked={form.confirmation_mode === val}
                onChange={() => setForm({ ...form, confirmation_mode: val })}
                className="mt-1"
              />
              <div>
                <div className="font-medium">{title}</div>
                <div className="text-xs text-ink/60">{desc}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saqlanmoqda…" : "Saqlash"}
        </Button>
        {msg && <span className="text-sm text-ink/60">{msg}</span>}
      </div>
    </div>
  );
}
