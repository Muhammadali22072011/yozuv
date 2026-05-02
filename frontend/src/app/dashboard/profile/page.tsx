"use client";

import { useEffect, useState } from "react";
import { ScreenHeader, YzLoader, YzLogo, useToast } from "@/components/yz";
import { MapPicker } from "@/components/yz/MapPicker";
import { apiFetch } from "@/lib/api";
import type { BusinessMe } from "@/types";

type Sub = { plan: string; status: string; expires_at: string | null };

export default function ProfilePage() {
  const toast = useToast();
  const [biz, setBiz] = useState<BusinessMe | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [saving, setSaving] = useState(false);
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
    viloyat: "",
    tuman: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [viloyats, setViloyats] = useState<string[]>([]);
  const [tumans, setTumans] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<string[]>("/api/geo/viloyats", { auth: false })
      .then(setViloyats)
      .catch(() => setViloyats([]));
  }, []);

  useEffect(() => {
    if (!form.viloyat) {
      setTumans([]);
      return;
    }
    apiFetch<string[]>(
      `/api/geo/tumans?viloyat=${encodeURIComponent(form.viloyat)}`,
      { auth: false },
    )
      .then(setTumans)
      .catch(() => setTumans([]));
  }, [form.viloyat]);

  useEffect(() => {
    Promise.all([
      apiFetch<BusinessMe>("/api/business/me"),
      apiFetch<Sub>("/api/subscription").catch(() => null),
    ])
      .then(([b, s]) => {
        setBiz(b);
        setSub(s);
        setForm({
          name: b.name,
          description: b.description,
          address: b.address,
          phone: b.phone,
          welcome_text: b.welcome_text,
          after_booking_text: b.after_booking_text,
          reminder_text: b.reminder_text,
          language: (b.language as "UZ" | "RU") || "UZ",
          confirmation_mode:
            (b.confirmation_mode as "AUTO" | "MANUAL" | "PREPAYMENT") || "MANUAL",
          viloyat: b.viloyat || "",
          tuman: b.tuman || "",
          latitude: b.latitude ?? null,
          longitude: b.longitude ?? null,
        });
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const updated = await apiFetch<BusinessMe>("/api/business/me", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setBiz(updated);
      toast("Saqlandi");
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  if (!biz) {
    return <YzLoader />;
  }

  return (
    <div>
      <ScreenHeader
        title="Biznes profili"
        back="/dashboard/settings"
        right={
          <button onClick={save} disabled={saving} className="btn-primary px-4 py-2.5 text-sm">
            {saving ? "…" : "Saqlash"}
          </button>
        }
      />

      <div className="mt-2 px-4 md:px-0">
        <div className="card-soft p-5 text-center">
          <div className="mx-auto grid place-items-center">
            <YzLogo size={80} />
          </div>
          <div className="mt-3 font-display text-[22px] font-extrabold tracking-tight text-ink-900">
            {biz.name}
          </div>
          <div className="mt-0.5 text-[13px] text-ink-500">{biz.description || "—"}</div>
          {sub && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-600">
              💎 {sub.plan} · {sub.status}
            </div>
          )}
        </div>

        <div className="mt-3 space-y-2.5">
          <Field
            icon="🏪"
            bg="#EEF0FF"
            label="Nomi"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
          />
          <Field
            icon="📞"
            bg="#FFF3DA"
            label="Telefon"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
          />
          <Field
            icon="📍"
            bg="#E6FAF3"
            label="Manzil"
            value={form.address}
            onChange={(v) => setForm({ ...form, address: v })}
          />
          <Field
            icon="📝"
            bg="#FFE7E3"
            label="Tavsif"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            multi
          />
        </div>

        <div className="mt-5 text-[12px] font-bold uppercase tracking-wide text-ink-400 px-1 pb-2">
          Joylashuv
        </div>
        <div className="card-soft space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-ink-500">Viloyat</label>
              <select
                value={form.viloyat}
                onChange={(e) => setForm({ ...form, viloyat: e.target.value, tuman: "" })}
                className="yz-input mt-1"
              >
                <option value="">Tanlang…</option>
                {viloyats.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-500">
                Tuman / Shahar
              </label>
              <select
                value={form.tuman}
                onChange={(e) => setForm({ ...form, tuman: e.target.value })}
                disabled={!form.viloyat}
                className="yz-input mt-1 disabled:opacity-50"
              >
                <option value="">{form.viloyat ? "Tanlang…" : "Avval viloyat"}</option>
                {tumans.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <MapPicker
            value={
              form.latitude !== null && form.longitude !== null
                ? { lat: form.latitude, lng: form.longitude }
                : null
            }
            onChange={(v) => setForm((f) => ({ ...f, latitude: v.lat, longitude: v.lng }))}
            onAddressLookup={(addr) =>
              setForm((f) => (f.address.trim() ? f : { ...f, address: addr }))
            }
          />
        </div>

        <div className="mt-5 text-[12px] font-bold uppercase tracking-wide text-ink-400 px-1 pb-2">
          Bot matnlari
        </div>
        <div className="card-soft space-y-3 p-4">
          <div>
            <label className="block text-xs font-semibold text-ink-500">Salomlashish</label>
            <textarea
              rows={2}
              value={form.welcome_text}
              onChange={(e) => setForm({ ...form, welcome_text: e.target.value })}
              className="yz-input mt-1"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-500">Yozilishdan keyin</label>
            <textarea
              rows={2}
              value={form.after_booking_text}
              onChange={(e) => setForm({ ...form, after_booking_text: e.target.value })}
              className="yz-input mt-1"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-500">Eslatma matni</label>
            <textarea
              rows={2}
              value={form.reminder_text}
              onChange={(e) => setForm({ ...form, reminder_text: e.target.value })}
              className="yz-input mt-1"
            />
          </div>
        </div>

        <div className="mt-5 text-[12px] font-bold uppercase tracking-wide text-ink-400 px-1 pb-2">
          Tasdiqlash rejimi
        </div>
        <div className="card-soft p-2">
          {(
            [
              ["AUTO", "Avtomatik", "Avtomatik tasdiqlanadi"],
              ["MANUAL", "Qo‘lda", "Siz har bir yozilishni tasdiqlaysiz"],
              ["PREPAYMENT", "Oldindan to‘lov", "Mijoz to‘laganda tasdiqlanadi"],
            ] as const
          ).map(([val, title, desc]) => {
            const active = form.confirmation_mode === val;
            return (
              <button
                key={val}
                onClick={() => setForm({ ...form, confirmation_mode: val })}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left tap ${
                  active ? "bg-indigo-50" : ""
                }`}
              >
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full border-2 ${
                    active ? "border-indigo-600" : "border-ink-200"
                  }`}
                >
                  {active && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                </span>
                <div>
                  <div className="font-display text-sm font-bold text-ink-900">{title}</div>
                  <div className="text-xs text-ink-500">{desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  bg,
  label,
  value,
  onChange,
  multi,
  placeholder,
}: {
  icon: string;
  bg: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  multi?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="card-soft flex cursor-text items-start gap-3 p-3.5 transition-colors focus-within:ring-2 focus-within:ring-indigo-500/30">
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl"
        style={{ background: bg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-ink-400">{label}</div>
        {multi ? (
          <textarea
            rows={2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "—"}
            className="mt-1 w-full resize-none bg-transparent font-display text-sm font-bold text-ink-900 outline-none placeholder:font-medium placeholder:text-ink-300"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "—"}
            className="mt-1 w-full bg-transparent font-display text-sm font-bold text-ink-900 outline-none placeholder:font-medium placeholder:text-ink-300"
          />
        )}
      </div>
    </label>
  );
}
