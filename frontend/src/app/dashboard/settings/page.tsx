"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiBase, apiFetch, getToken } from "@/lib/api";
import type { BusinessMe } from "@/types";

type CardCreateResp = {
  transaction_id: string;
  amount: number;
  card_number: string;
  card_holder: string;
  payment_comment: string;
};

type TxStatus = {
  transaction_id: string;
  status: string;
  amount: number;
  plan: string;
};

type Plan = "MONTHLY" | "YEARLY";

export default function SettingsPage() {
  const [biz, setBiz] = useState<BusinessMe | null>(null);
  const [sub, setSub] = useState<{ plan: string; status: string; expires_at: string | null } | null>(null);
  const [info, setInfo] = useState<CardCreateResp | null>(null);
  const [plan, setPlan] = useState<Plan>("MONTHLY");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [status, setStatus] = useState<TxStatus | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<BusinessMe>("/api/business/me"),
      apiFetch<{ plan: string; status: string; expires_at: string | null }>("/api/subscription").catch(() => null),
    ])
      .then(([b, s]) => {
        setBiz(b);
        setSub(s);
      })
      .catch(() => {});
  }, []);

  const startCardPayment = async (selectedPlan: Plan) => {
    setMsg("");
    setStatus(null);
    setFile(null);
    setComment("");
    try {
      const r = await apiFetch<CardCreateResp>("/api/payments/card/create", {
        method: "POST",
        body: JSON.stringify({ plan: selectedPlan }),
      });
      setInfo(r);
      setPlan(selectedPlan);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Xatolik";
      setMsg(m);
    }
  };

  const uploadReceipt = async () => {
    if (!info || !file) return;
    setUploading(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("transaction_id", info.transaction_id);
      fd.append("comment", comment);
      fd.append("file", file);
      const token = getToken();
      const res = await fetch(`${apiBase()}/api/payments/card/upload-receipt`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || res.statusText);
      }
      const data = (await res.json()) as TxStatus;
      setStatus(data);
      setMsg("✅ Chek yuklandi. Admin tekshirmoqda…");
      pollStatus(info.transaction_id);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "Yuklashda xatolik";
      setMsg(m);
    } finally {
      setUploading(false);
    }
  };

  const pollStatus = (txId: string) => {
    const interval = setInterval(async () => {
      try {
        const s = await apiFetch<TxStatus>(`/api/payments/status/${txId}`);
        setStatus(s);
        if (s.status === "PaymentRecordStatus.COMPLETED" || s.status === "COMPLETED") {
          clearInterval(interval);
          setMsg("🎉 To'lov tasdiqlandi! Obuna faollashtirildi.");
          const fresh = await apiFetch<{ plan: string; status: string; expires_at: string | null }>(
            "/api/subscription"
          ).catch(() => null);
          setSub(fresh);
        } else if (s.status.includes("REJECTED") || s.status.includes("FAILED")) {
          clearInterval(interval);
          setMsg("❌ To'lov rad etildi. Admin bilan bog'laning.");
        }
      } catch {
        // ignore
      }
    }, 4000);
    setTimeout(() => clearInterval(interval), 10 * 60 * 1000);
  };

  const amountFmt = (n: number) => new Intl.NumberFormat("uz-UZ").format(n) + " so'm";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h2 className="font-serif text-2xl">Sozlamalar</h2>
      {biz ? (
        <div className="space-y-2 rounded-xl border border-ink/10 bg-white p-6 text-sm">
          <div>
            <div className="text-xs text-ink/50">Nomi</div>
            <div className="font-medium">{biz.name}</div>
          </div>
          <div>
            <div className="text-xs text-ink/50">Slug</div>
            <div className="font-mono">{biz.slug}</div>
          </div>
          <div>
            <div className="text-xs text-ink/50">Manzil</div>
            <div>{biz.address || "—"}</div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink/60">Yuklanmoqda…</p>
      )}

      <div className="rounded-xl border border-ink/10 bg-white p-6">
        <h3 className="font-serif text-xl">Obuna</h3>
        {sub ? (
          <p className="mt-2 text-sm text-ink/70">
            {sub.plan} · {sub.status}
            {sub.expires_at ? ` · ${sub.expires_at}` : ""}
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink/60">Obuna ma&apos;lumoti yo&apos;q</p>
        )}

        {!info && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-ink/70">
              To&apos;lovni karta orqali amalga oshiring. Karta ma&apos;lumotlari va summani ko&apos;rish
              uchun rejani tanlang:
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => startCardPayment("MONTHLY")}>Oylik (karta)</Button>
              <Button variant="outline" onClick={() => startCardPayment("YEARLY")}>
                Yillik (karta)
              </Button>
            </div>
          </div>
        )}

        {info && (
          <div className="mt-4 space-y-4 rounded-lg border border-ink/10 bg-cream/40 p-4">
            <div>
              <div className="text-xs text-ink/50">To&apos;lovni quyidagi kartaga o&apos;tkazing</div>
              <div className="mt-1 font-mono text-lg tracking-wider">{info.card_number || "—"}</div>
              {info.card_holder && <div className="text-sm text-ink/70">{info.card_holder}</div>}
            </div>
            <div>
              <div className="text-xs text-ink/50">Summa</div>
              <div className="font-medium">{amountFmt(info.amount)}</div>
              <div className="text-xs text-ink/50">Reja: {plan}</div>
            </div>
            {info.payment_comment && (
              <div className="rounded-md border border-ink/10 bg-white p-3 text-sm text-ink/80">
                {info.payment_comment}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs text-ink/60">Izoh (ixtiyoriy)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-ink/10 bg-white p-2 text-sm"
                placeholder="Masalan: 4278 xxxxdan yuborildi"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-ink/60">Chek skrinshoti (JPG/PNG)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={uploadReceipt} disabled={!file || uploading}>
                {uploading ? "Yuklanmoqda…" : "Chekni yuborish"}
              </Button>
              <Button variant="outline" onClick={() => setInfo(null)} disabled={uploading}>
                Bekor qilish
              </Button>
            </div>

            {status && (
              <div className="text-xs text-ink/60">
                Holati: <span className="font-mono">{status.status}</span>
              </div>
            )}
          </div>
        )}

        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </div>
    </div>
  );
}
