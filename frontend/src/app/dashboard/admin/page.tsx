"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiBase, apiFetch, getToken } from "@/lib/api";

type Summary = {
  businesses_total: number;
  businesses_active: number;
  businesses_new_7d: number;
  active_subscriptions: number;
  trial_subscriptions: number;
  paid_subscriptions: number;
  mrr_uzs: number;
  revenue_7d_uzs: number;
  pending_card_payments: number;
};

type Biz = {
  id: string;
  name: string;
  slug: string;
  category: string;
  is_active: boolean;
  created_at: string;
  owner: { telegram_id: number | null; name: string };
  subscription: { plan: string | null; expires_at: string | null } | null;
};

type Pending = {
  transaction_id: string;
  business_id: string;
  business_name: string;
  amount: number;
  plan: string;
  status: string;
  user_comment: string;
  screenshot_url: string;
  created_at: string;
};

type CardInfo = { card_number: string; card_holder: string; payment_comment: string };

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"summary" | "businesses" | "payments" | "broadcast" | "settings" | "backup">("summary");
  const [sum, setSum] = useState<Summary | null>(null);
  const [biz, setBiz] = useState<Biz[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [card, setCard] = useState<CardInfo>({ card_number: "", card_holder: "", payment_comment: "" });
  const [cardMsg, setCardMsg] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    apiFetch<{ is_admin?: boolean }>("/api/auth/me")
      .then((u) => setIsAdmin(!!u?.is_admin))
      .catch(() => setIsAdmin(false));
  }, []);

  const loadSummary = useCallback(async () => {
    const s = await apiFetch<Summary>("/api/admin/summary").catch(() => null);
    if (s) setSum(s);
  }, []);

  const loadBusinesses = useCallback(async () => {
    const b = await apiFetch<Biz[]>("/api/admin/businesses").catch(() => []);
    setBiz(b);
  }, []);

  const loadPending = useCallback(async () => {
    const list = await apiFetch<Pending[]>("/api/payments/pending").catch(() => []);
    setPending(list);
    const token = getToken();
    const urls: Record<string, string> = {};
    await Promise.all(
      list.map(async (p) => {
        if (!p.screenshot_url) return;
        try {
          const res = await fetch(`${apiBase()}${p.screenshot_url}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            urls[p.transaction_id] = URL.createObjectURL(await res.blob());
          }
        } catch {}
      })
    );
    setImageUrls((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return urls;
    });
  }, []);

  const loadCard = useCallback(async () => {
    const c = await apiFetch<CardInfo>("/api/payments/card/info").catch(() => null);
    if (c) setCard(c);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadSummary();
    loadBusinesses();
    loadPending();
    loadCard();
  }, [isAdmin, loadSummary, loadBusinesses, loadPending, loadCard]);

  async function extend(business_id: string, days: number) {
    await apiFetch("/api/admin/subscription/extend", {
      method: "POST",
      body: JSON.stringify({ business_id, days }),
    }).catch(() => {});
    await loadBusinesses();
  }

  async function toggleBiz(business_id: string, is_active: boolean) {
    await apiFetch("/api/admin/business/toggle", {
      method: "POST",
      body: JSON.stringify({ business_id, is_active }),
    }).catch(() => {});
    await loadBusinesses();
  }

  async function approve(txId: string) {
    await apiFetch("/api/payments/approve", {
      method: "POST",
      body: JSON.stringify({ transaction_id: txId }),
    }).catch(() => {});
    await loadPending();
  }

  async function reject(txId: string) {
    await apiFetch("/api/payments/reject", {
      method: "POST",
      body: JSON.stringify({ transaction_id: txId, reason: rejectReason[txId] || "" }),
    }).catch(() => {});
    await loadPending();
  }

  async function saveCard() {
    setCardMsg("");
    try {
      const r = await apiFetch<CardInfo>("/api/payments/card/info", {
        method: "PUT",
        body: JSON.stringify(card),
      });
      setCard(r);
      setCardMsg("Saqlandi ✓");
      setTimeout(() => setCardMsg(""), 2000);
    } catch (e) {
      setCardMsg((e as Error).message || "Xatolik");
    }
  }

  async function exportBackup() {
    setBackupMsg("");
    setBackupBusy(true);
    try {
      const token = getToken();
      const res = await fetch(`${apiBase()}/api/admin/backup/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") || "";
      const m = disp.match(/filename="?([^"]+)"?/i);
      const filename = m?.[1] || `yozuv-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupMsg("Eksport tayyor ✓");
    } catch (e) {
      setBackupMsg((e as Error).message || "Eksport xatolik");
    } finally {
      setBackupBusy(false);
    }
  }

  async function importBackup() {
    setBackupMsg("");
    if (!importFile) {
      setBackupMsg("Fayl tanlanmagan");
      return;
    }
    const ok = window.confirm(
      "DIQQAT! Barcha joriy ma'lumotlar o'chirilib, tanlangan fayldan tiklanadi. Davom etasizmi?"
    );
    if (!ok) return;
    setBackupBusy(true);
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append("file", importFile);
      const res = await fetch(`${apiBase()}/api/admin/backup/import`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const r = (await res.json()) as { inserted_rows: number; tables: number };
      setBackupMsg(`Import bajarildi: ${r.inserted_rows} qator, ${r.tables} jadval ✓`);
      setImportFile(null);
      await loadSummary();
      await loadBusinesses();
    } catch (e) {
      setBackupMsg((e as Error).message || "Import xatolik");
    } finally {
      setBackupBusy(false);
    }
  }

  async function sendBroadcast() {
    setBroadcastMsg("");
    if (broadcastText.trim().length < 3) {
      setBroadcastMsg("Matn kamida 3 belgidan iborat bo'lsin");
      return;
    }
    try {
      const r = await apiFetch<{ sent: number; failed: number; total: number }>("/api/admin/broadcast", {
        method: "POST",
        body: JSON.stringify({ text: broadcastText, only_active: true }),
      });
      setBroadcastMsg(`Yuborildi: ${r.sent}/${r.total}, xatolik: ${r.failed}`);
      setBroadcastText("");
    } catch (e) {
      setBroadcastMsg((e as Error).message || "Xatolik");
    }
  }

  if (isAdmin === null) return <p className="text-sm text-ink/60">Yuklanmoqda…</p>;
  if (!isAdmin)
    return (
      <div className="rounded-2xl border border-ink/10 bg-white p-6">
        <h2 className="font-serif text-2xl">Admin</h2>
        <p className="mt-2 text-sm text-ink/60">
          Bu sahifa faqat admin uchun. <code>ADMIN_TELEGRAM_IDS</code> .env ga qo&apos;shing.
        </p>
      </div>
    );

  const tabs: [typeof tab, string][] = [
    ["summary", "Статистика"],
    ["businesses", "Bizneslar"],
    ["payments", `Tasdiqlash${pending.length ? ` (${pending.length})` : ""}`],
    ["broadcast", "Xabar yuborish"],
    ["settings", "Karta"],
    ["backup", "Backup"],
  ];

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-2xl">Admin paneli</h2>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              tab === k ? "bg-ink text-white" : "bg-cream hover:bg-ochre/20"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "summary" && sum && (
        <div className="grid gap-3 md:grid-cols-3">
          <StatCard label="Bizneslar (jami)" value={String(sum.businesses_total)} sub={`Faol: ${sum.businesses_active}`} />
          <StatCard label="Yangi (7 kun)" value={String(sum.businesses_new_7d)} />
          <StatCard label="Faol obunalar" value={String(sum.active_subscriptions)} sub={`Trial: ${sum.trial_subscriptions} · Pulli: ${sum.paid_subscriptions}`} />
          <StatCard label="MRR" value={`${sum.mrr_uzs.toLocaleString("uz-UZ")} so'm`} sub="oylik" />
          <StatCard label="Daromad 7 kun" value={`${sum.revenue_7d_uzs.toLocaleString("uz-UZ")} so'm`} />
          <StatCard label="Tasdiqlashni kutayapti" value={String(sum.pending_card_payments)} />
        </div>
      )}

      {tab === "businesses" && (
        <div className="space-y-2">
          {biz.length === 0 && <p className="text-sm text-ink/60">Bizneslar yo&apos;q.</p>}
          {biz.map((b) => (
            <div key={b.id} className="rounded-2xl border border-ink/10 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-ink/60">
                    {b.slug} · {b.category} · {b.owner.name} (TG: {b.owner.telegram_id ?? "—"})
                  </div>
                  <div className="mt-1 text-xs">
                    {b.subscription ? (
                      <>
                        📅 {b.subscription.plan?.replace("SubscriptionPlan.", "")} —{" "}
                        {b.subscription.expires_at?.slice(0, 10)}
                      </>
                    ) : (
                      <span className="text-red-600">Obuna yo&apos;q</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => extend(b.id, 7)}>
                    +7 kun
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => extend(b.id, 30)}>
                    +30 kun
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleBiz(b.id, !b.is_active)}>
                    {b.is_active ? "Bloklash" : "Yoqish"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-3">
          {pending.length === 0 && <p className="text-sm text-ink/60">Hozircha yo&apos;q.</p>}
          {pending.map((p) => (
            <div key={p.transaction_id} className="rounded-2xl border border-ink/10 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="text-sm">
                  <div className="font-medium">{p.business_name}</div>
                  <div className="text-ink/60">
                    {p.plan} · {p.amount.toLocaleString("uz-UZ")} so&apos;m
                  </div>
                  {p.user_comment && (
                    <div className="mt-1 rounded border border-ink/10 bg-cream/40 p-2 text-xs">
                      {p.user_comment}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-ink/50">{p.created_at}</div>
                </div>
                {imageUrls[p.transaction_id] && (
                  <a href={imageUrls[p.transaction_id]} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrls[p.transaction_id]}
                      alt="receipt"
                      className="h-28 w-28 rounded border border-ink/10 object-cover"
                    />
                  </a>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button onClick={() => approve(p.transaction_id)}>✓ Tasdiqlash</Button>
                <input
                  value={rejectReason[p.transaction_id] || ""}
                  onChange={(e) =>
                    setRejectReason({ ...rejectReason, [p.transaction_id]: e.target.value })
                  }
                  placeholder="Rad etish sababi (ixtiyoriy)"
                  className="flex-1 min-w-[160px] rounded-md border border-ink/10 p-2 text-xs"
                />
                <Button variant="outline" onClick={() => reject(p.transaction_id)}>
                  ✗ Rad etish
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "broadcast" && (
        <div className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5">
          <h3 className="font-serif text-lg">Barcha egalarga xabar yuborish</h3>
          <p className="text-xs text-ink/60">
            Faqat faol bizneslarning Telegram egalariga yuboriladi.
          </p>
          <textarea
            rows={6}
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            placeholder="Yangi imkoniyatlar haqida yangilik..."
            className="w-full rounded-md border border-ink/10 p-3 text-sm"
          />
          <div className="flex items-center gap-3">
            <Button onClick={sendBroadcast}>Yuborish</Button>
            {broadcastMsg && <span className="text-sm text-ink/60">{broadcastMsg}</span>}
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5">
          <h3 className="font-serif text-lg">To&apos;lov uchun karta</h3>
          <div>
            <label className="block text-xs text-ink/60">Karta raqami</label>
            <input
              value={card.card_number}
              onChange={(e) => setCard({ ...card, card_number: e.target.value })}
              placeholder="8600 1234 5678 9012"
              className="mt-1 w-full rounded-md border border-ink/10 p-2 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-ink/60">Karta egasi</label>
            <input
              value={card.card_holder}
              onChange={(e) => setCard({ ...card, card_holder: e.target.value })}
              placeholder="ALIYEV ALI"
              className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-ink/60">Izoh (mijozga ko&apos;rsatiladi)</label>
            <textarea
              value={card.payment_comment}
              onChange={(e) => setCard({ ...card, payment_comment: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveCard}>Saqlash</Button>
            {cardMsg && <span className="text-xs text-ink/60">{cardMsg}</span>}
          </div>
        </div>
      )}

      {tab === "backup" && (
        <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-5">
          <div>
            <h3 className="font-serif text-lg">Bazani eksport qilish</h3>
            <p className="mt-1 text-xs text-ink/60">
              Barcha jadvallardagi ma&apos;lumotlar JSON fayl sifatida yuklab olinadi.
            </p>
            <div className="mt-3">
              <Button onClick={exportBackup} disabled={backupBusy}>
                {backupBusy ? "Tayyorlanmoqda…" : "⬇ Eksport (JSON)"}
              </Button>
            </div>
          </div>

          <div className="border-t border-ink/10 pt-4">
            <h3 className="font-serif text-lg">Bazani import qilish</h3>
            <p className="mt-1 text-xs text-red-600">
              DIQQAT! Import joriy ma&apos;lumotlarni butunlay o&apos;chirib, fayldan
              tiklaydi. Avval eksport qilib saqlab qo&apos;ying.
            </p>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="mt-3 block w-full text-sm"
            />
            <div className="mt-3">
              <Button
                onClick={importBackup}
                disabled={backupBusy || !importFile}
                variant="outline"
              >
                {backupBusy ? "Yuklanmoqda…" : "⬆ Import qilish"}
              </Button>
            </div>
          </div>

          {backupMsg && <div className="text-sm text-ink/70">{backupMsg}</div>}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-ink/50">{label}</div>
      <div className="mt-2 font-serif text-2xl">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink/60">{sub}</div>}
    </div>
  );
}
