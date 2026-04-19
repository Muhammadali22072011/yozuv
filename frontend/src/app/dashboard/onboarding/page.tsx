"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "barbershop", label: "💈 Barbershop" },
  { value: "salon", label: "💇 Salon krasoty" },
  { value: "dentist", label: "🦷 Stomatologiya" },
  { value: "tutor", label: "📚 Repetitor" },
  { value: "photo", label: "📸 Fotograf" },
  { value: "massage", label: "💆 Massaj / Spa" },
  { value: "fitness", label: "🏋 Fitnes" },
  { value: "clinic", label: "⚕️ Klinika" },
  { value: "other", label: "📦 Boshqa" },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    name: "",
    slug: "",
    category: "barbershop",
    description: "",
    address: "",
    phone: "",
  });
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    apiFetch<{ id: string }>("/api/business/me")
      .then(() => {
        router.replace("/dashboard");
      })
      .catch(() => {
        setLoading(false);
      });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!form.name.trim() || !form.slug.trim()) {
      setErr("Nomi va slug majburiy");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/business", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim(),
          category: form.category,
          description: form.description.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
        }),
      });
      router.replace("/dashboard");
    } catch (e) {
      setErr((e as Error).message || "Xatolik");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="p-6 text-sm text-ink/60">Yuklanmoqda…</p>;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Biznesingizni yarating</h1>
        <p className="mt-2 text-sm text-ink/60">
          2 minutda sozlab oling. Keyin xizmatlar va jadvalni qo&apos;shasiz.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-ink/10 bg-white p-6">
        <div>
          <label className="block text-xs text-ink/60">Biznes nomi *</label>
          <input
            value={form.name}
            onChange={(e) => {
              const n = e.target.value;
              setForm((f) => ({
                ...f,
                name: n,
                slug: slugTouched ? f.slug : slugify(n),
              }));
            }}
            placeholder="Masalan: Barber Akbar"
            className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60">URL-slug *</label>
          <input
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setForm({ ...form, slug: slugify(e.target.value) });
            }}
            placeholder="barber-akbar"
            className="mt-1 w-full rounded-md border border-ink/10 p-2 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-ink/50">
            Mijoz sizni shu havola orqali topadi:{" "}
            <span className="font-mono">t.me/Yozuv_cl_bot?start={form.slug || "sizning-slug"}</span>
          </p>
        </div>

        <div>
          <label className="block text-xs text-ink/60">Kategoriya *</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-ink/60">Telefon</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+998 90 123 45 67"
            className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60">Manzil</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Amir Temur ko'chasi 15"
            className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60">Tavsif</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Qisqa: biznes haqida bir-ikki jumla"
            className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
          />
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Yaratilmoqda…" : "Biznes yaratish"}
        </Button>
        <p className="text-xs text-ink/50">🎁 14 kun bepul trial avtomatik yoqiladi.</p>
      </form>
    </div>
  );
}
