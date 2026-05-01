"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Check,
  CreditCard,
  Database,
  Megaphone,
  Shield,
  Wallet,
  X,
} from "lucide-react";
import { ScreenHeader, YzLoader, fmtShort, fmtSum, useToast } from "@/components/yz";
import { apiBase, apiFetch, getToken } from "@/lib/api";
import { cn } from "@/lib/utils";

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

type Tab = "summary" | "businesses" | "payments" | "broadcast" | "settings" | "backup";

const TABS: { k: Tab; label: string; icon: typeof Shield }[] = [
  { k: "summary", label: "Statistika", icon: BarChart3 },
  { k: "businesses", label: "Bizneslar", icon: Building2 },
  { k: "payments", label: "To‘lovlar", icon: Wallet },
  { k: "settings", label: "Karta", icon: CreditCard },
  { k: "broadcast", label: "Xabar", icon: Megaphone },
  { k: "backup", label: "Backup", icon: Database },
];

export default function AdminPage() {
  const toast = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [sum, setSum] = useState<Summary | null>(null);
  const [biz, setBiz] = useState<Biz[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [card, setCard] = useState<CardInfo>({ card_number: "", card_holder: "", payment_comment: "" });
  const [broadcastText, setBroadcastText] = useState("");
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [backupBusy, setBackupBusy] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    apiFetch<{ is_admin?: boolean }>("/api/auth/me")
      .then((u) => setIsAdmin(!!u?.is_admin))
      .catch(() => setIsAdmin(false));
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      setSum(await apiFetch<Summary>("/api/admin/summary"));
    } catch (e) {
      toast(`Statistika yuklanmadi: ${(e as Error).message?.slice(0, 80) || "xatolik"}`);
    }
  }, [toast]);

  const loadBusinesses = useCallback(async () => {
    try {
      setBiz(await apiFetch<Biz[]>("/api/admin/businesses"));
    } catch (e) {
      toast(`Bizneslar yuklanmadi: ${(e as Error).message?.slice(0, 80) || "xatolik"}`);
    }
  }, [toast]);

  const loadPending = useCallback(async () => {
    let list: Pending[] = [];
    try {
      list = await apiFetch<Pending[]>("/api/payments/pending");
    } catch (e) {
      toast(`To'lovlar yuklanmadi: ${(e as Error).message?.slice(0, 80) || "xatolik"}`);
      return;
    }
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
          if (res.ok) urls[p.transaction_id] = URL.createObjectURL(await res.blob());
        } catch {
          // screenshot fetch failure is non-fatal — admin can still approve/reject
        }
      })
    );
    setImageUrls((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return urls;
    });
  }, [toast]);

  const loadCard = useCallback(async () => {
    try {
      setCard(await apiFetch<CardInfo>("/api/payments/card/info"));
    } catch {
      // optional: card may not be configured yet
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadSummary();
    loadBusinesses();
    loadPending();
    loadCard();
  }, [isAdmin, loadSummary, loadBusinesses, loadPending, loadCard]);

  // Free blob URLs on unmount to avoid memory leak when admin navigates away.
  useEffect(() => {
    return () => {
      setImageUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
  }, []);

  async function extend(business_id: string, days: number) {
    try {
      await apiFetch("/api/admin/subscription/extend", {
        method: "POST",
        body: JSON.stringify({ business_id, days }),
      });
      toast(`+${days} kun qo‘shildi`);
      await loadBusinesses();
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Uzaytirish xatolik");
    }
  }

  async function toggleBiz(business_id: string, is_active: boolean) {
    try {
      await apiFetch("/api/admin/business/toggle", {
        method: "POST",
        body: JSON.stringify({ business_id, is_active }),
      });
      toast(is_active ? "Yoqildi" : "Bloklandi");
      await loadBusinesses();
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Xatolik");
    }
  }

  async function approve(txId: string) {
    try {
      await apiFetch("/api/payments/approve", {
        method: "POST",
        body: JSON.stringify({ transaction_id: txId }),
      });
      toast("Tasdiqlandi");
      await loadPending();
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Tasdiqlash xatolik");
    }
  }

  async function reject(txId: string) {
    const reason = (rejectReason[txId] || "").trim();
    if (!reason) {
      toast("Rad etish sababini kiriting");
      return;
    }
    try {
      await apiFetch("/api/payments/reject", {
        method: "POST",
        body: JSON.stringify({ transaction_id: txId, reason }),
      });
      toast("Rad etildi");
      setRejectReason((prev) => {
        const next = { ...prev };
        delete next[txId];
        return next;
      });
      await loadPending();
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Rad etish xatolik");
    }
  }

  async function saveCard() {
    const digits = card.card_number.replace(/\D/g, "");
    if (digits.length < 12 || digits.length > 19) {
      toast("Karta raqami 12–19 raqam bo‘lishi kerak");
      return;
    }
    if (!card.card_holder.trim()) {
      toast("Karta egasi nomi kerak");
      return;
    }
    setSavingCard(true);
    try {
      const r = await apiFetch<CardInfo>("/api/payments/card/info", {
        method: "PUT",
        body: JSON.stringify(card),
      });
      setCard(r);
      toast("Karta saqlandi");
    } catch (e) {
      toast((e as Error).message?.slice(0, 80) || "Saqlashda xatolik");
    } finally {
      setSavingCard(false);
    }
  }

  async function exportBackup() {
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
      toast("Eksport tayyor");
    } catch (e) {
      toast((e as Error).message || "Eksport xatolik");
    } finally {
      setBackupBusy(false);
    }
  }

  async function importBackup() {
    if (!importFile) {
      toast("Fayl tanlanmagan");
      return;
    }
    if (
      !window.confirm(
        "DIQQAT! Barcha ma‘lumotlar o‘chirilib, fayldan tiklanadi. Davom etasizmi?"
      )
    )
      return;
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
      toast(`Import: ${r.inserted_rows} qator`);
      setImportFile(null);
      await loadSummary();
      await loadBusinesses();
    } catch (e) {
      toast((e as Error).message || "Import xatolik");
    } finally {
      setBackupBusy(false);
    }
  }

  async function sendBroadcast() {
    if (broadcastText.trim().length < 3) {
      toast("Kamida 3 ta belgi");
      return;
    }
    try {
      const r = await apiFetch<{ sent: number; failed: number; total: number }>(
        "/api/admin/broadcast",
        {
          method: "POST",
          body: JSON.stringify({ text: broadcastText, only_active: true }),
        }
      );
      toast(`Yuborildi: ${r.sent}/${r.total}`);
      setBroadcastText("");
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    }
  }

  if (isAdmin === null) {
    return <YzLoader />;
  }
  if (!isAdmin) {
    return (
      <div>
        <ScreenHeader title="Admin" />
        <div className="card-soft mx-4 p-5 md:mx-0">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFE7E3] text-[#C93A2A]">
            <Shield className="h-6 w-6" />
          </div>
          <h3 className="mt-3 font-display text-lg font-bold text-ink-900">
            Kirish cheklangan
          </h3>
          <p className="mt-1 text-sm text-ink-500">
            Bu sahifa faqat admin uchun. <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs">ADMIN_TELEGRAM_IDS</code>{" "}
            .env-ga qo‘shing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Admin paneli" subtitle="Platformani boshqaring" />

      <div className="mt-2 grid grid-cols-3 gap-2 px-4 md:grid-cols-6 md:px-0">
        {TABS.map(({ k, label, icon: Icon }) => {
          const active = tab === k;
          const badge =
            k === "payments" && pending.length > 0 ? pending.length : undefined;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 font-display text-[12px] font-bold transition-colors tap md:py-3.5 md:text-[13px]",
                active
                  ? "bg-ink-900 text-white shadow-[0_4px_12px_rgba(11,15,31,0.2)]"
                  : "bg-white text-ink-700 shadow-soft hover:bg-ink-50"
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.6 : 2.2} />
              <span className="leading-tight">{label}</span>
              {badge !== undefined && (
                <span
                  className={cn(
                    "absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-extrabold",
                    active ? "bg-lemon text-ink-900" : "bg-coral text-white"
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-3 px-4 md:px-0">
        {tab === "summary" && !card.card_number && (
          <button
            type="button"
            onClick={() => setTab("settings")}
            className="flex w-full items-start gap-3 rounded-[22px] bg-[#FFE7E3] p-4 text-left tap"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#C93A2A] text-white">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-sm font-extrabold text-[#C93A2A]">
                Karta sozlanmagan
              </div>
              <div className="mt-0.5 text-xs text-[#C93A2A]/80">
                Mijozlar karta orqali to‘lay olmaydi. Bosing va kartani kiriting.
              </div>
            </div>
          </button>
        )}

        {tab === "summary" && sum && (
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            <StatCard label="Bizneslar" value={sum.businesses_total} sub={`Faol: ${sum.businesses_active}`} color="#4853F5" />
            <StatCard label="Yangi (7 kun)" value={sum.businesses_new_7d} color="#22C8A8" />
            <StatCard label="Faol obunalar" value={sum.active_subscriptions} sub={`Trial: ${sum.trial_subscriptions} · Pulli: ${sum.paid_subscriptions}`} color="#FFC94A" />
            <StatCard label="MRR" value={fmtShort(sum.mrr_uzs)} sub="so‘m / oy" color="#22C8A8" />
            <StatCard label="Daromad (7 kun)" value={fmtShort(sum.revenue_7d_uzs)} sub="so‘m" color="#4853F5" />
            <StatCard label="Tasdiqlash kutmoqda" value={sum.pending_card_payments} sub="kutilmoqda" color="#FF7A6B" />
          </div>
        )}

        {tab === "businesses" && (
          <div className="grid gap-3 md:grid-cols-2">
            {biz.length === 0 && (
              <div className="rounded-[22px] border border-dashed border-ink-200 bg-white p-8 text-center text-sm text-ink-400 md:col-span-2">
                Bizneslar yo‘q
              </div>
            )}
            {biz.map((b) => (
              <div key={b.id} className="card-soft p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-display text-base font-extrabold text-ink-900">
                        {b.name}
                      </div>
                      {!b.is_active && (
                        <span className="shrink-0 rounded-full bg-[#FFE7E3] px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-[#C93A2A]">
                          BLOK
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                      <span className="truncate font-mono">{b.slug}</span>
                      <span className="text-ink-300">·</span>
                      <span>{b.category}</span>
                    </div>
                    <div className="mt-2 truncate text-xs text-ink-500">
                      👤 {b.owner.name || "—"}
                      {b.owner.telegram_id != null && (
                        <span className="ml-1 font-mono text-ink-400">
                          · {b.owner.telegram_id}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {b.subscription ? (
                      <div className="rounded-2xl bg-indigo-50 px-3 py-2">
                        <div className="font-display text-[11px] font-extrabold uppercase tracking-wide text-indigo-700">
                          {b.subscription.plan || "—"}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-indigo-600/70">
                          {b.subscription.expires_at?.slice(0, 10) || "—"}
                        </div>
                      </div>
                    ) : (
                      <span className="rounded-full bg-[#FFE7E3] px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-[#C93A2A]">
                        OBUNA YO‘Q
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => extend(b.id, 7)}
                    className="rounded-xl bg-indigo-50 px-3.5 py-2 text-[13px] font-bold text-indigo-700 tap hover:bg-indigo-100"
                  >
                    +7 kun
                  </button>
                  <button
                    onClick={() => extend(b.id, 30)}
                    className="rounded-xl bg-indigo-50 px-3.5 py-2 text-[13px] font-bold text-indigo-700 tap hover:bg-indigo-100"
                  >
                    +30 kun
                  </button>
                  <button
                    onClick={() => toggleBiz(b.id, !b.is_active)}
                    className={cn(
                      "ml-auto rounded-xl px-3.5 py-2 text-[13px] font-bold tap",
                      b.is_active
                        ? "bg-[#FFE7E3] text-[#C93A2A] hover:bg-[#FCD7CE]"
                        : "bg-[#E6FAF3] text-[#0E9577] hover:bg-[#CFF1E1]"
                    )}
                  >
                    {b.is_active ? "Bloklash" : "Yoqish"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "payments" && (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.length === 0 && (
              <div className="rounded-[22px] border border-dashed border-ink-200 bg-white p-8 text-center text-sm text-ink-400 md:col-span-2">
                Hozircha kutilayotgan to‘lov yo‘q
              </div>
            )}
            {pending.map((p) => (
              <div key={p.transaction_id} className="card-soft p-5">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-extrabold text-ink-900">
                      {p.business_name}
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-display text-xl font-extrabold tracking-[-0.02em] text-ink-900">
                        {fmtSum(p.amount)}
                      </span>
                      <span className="text-xs font-semibold text-ink-500">so‘m</span>
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-indigo-700">
                        {p.plan}
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-[11px] text-ink-400">
                      {p.created_at.replace("T", " ").slice(0, 16)}
                    </div>
                  </div>
                  {imageUrls[p.transaction_id] && (
                    <a
                      href={imageUrls[p.transaction_id]}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0"
                      title="Chekni kattalashtirish"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrls[p.transaction_id]}
                        alt="chek"
                        className="h-24 w-24 rounded-2xl object-cover ring-1 ring-ink-100 transition-transform hover:scale-105"
                      />
                    </a>
                  )}
                </div>

                {p.user_comment && (
                  <div className="mt-3 rounded-2xl bg-ink-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-700">
                    💬 {p.user_comment}
                  </div>
                )}

                <div className="mt-4 space-y-2.5">
                  <button
                    onClick={() => approve(p.transaction_id)}
                    className="btn-primary w-full justify-center py-2.5 text-sm"
                  >
                    <Check className="mr-1.5 h-4 w-4" strokeWidth={2.6} />
                    Tasdiqlash
                  </button>
                  <div className="flex gap-2">
                    <input
                      value={rejectReason[p.transaction_id] || ""}
                      onChange={(e) =>
                        setRejectReason({
                          ...rejectReason,
                          [p.transaction_id]: e.target.value,
                        })
                      }
                      placeholder="Rad etish sababi (majburiy)"
                      className="yz-input flex-1 py-2.5 text-xs"
                    />
                    <button
                      onClick={() => reject(p.transaction_id)}
                      className="shrink-0 rounded-2xl bg-[#FFE7E3] px-4 py-2.5 text-sm font-bold text-[#C93A2A] tap hover:bg-[#FCD7CE]"
                      aria-label="Rad etish"
                    >
                      <X className="h-4 w-4" strokeWidth={2.6} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "broadcast" && (
          <div className="mx-auto max-w-2xl">
            <div className="card-soft p-5 md:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFF3DA] text-[#A8751A]">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-extrabold text-ink-900">
                    Barcha egalariga xabar
                  </h3>
                  <p className="mt-1 text-xs text-ink-500">
                    Faqat faol bizneslarning Telegram egalariga yuboriladi.
                  </p>
                </div>
              </div>
              <textarea
                rows={8}
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Yangilik matni..."
                className="yz-input mt-4"
              />
              <div className="mt-2 text-right text-[11px] font-semibold text-ink-400">
                {broadcastText.length} / 4000
              </div>
              <button
                onClick={sendBroadcast}
                className="btn-primary mt-3 w-full justify-center"
              >
                <Megaphone className="mr-2 h-4 w-4" />
                Yuborish
              </button>
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-2">
            <div className="card-soft space-y-3 p-5 md:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-extrabold text-ink-900">
                    To‘lov uchun karta
                  </h3>
                  <p className="mt-1 text-xs text-ink-500">
                    Mijozlar shu kartaga to‘laydi.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-500">
                  Karta raqami
                </label>
                <input
                  value={card.card_number}
                  onChange={(e) => setCard({ ...card, card_number: e.target.value })}
                  placeholder="8600 1234 5678 9012"
                  className="yz-input mt-1 font-mono tracking-wider"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-500">Egasi</label>
                <input
                  value={card.card_holder}
                  onChange={(e) => setCard({ ...card, card_holder: e.target.value })}
                  placeholder="ALIYEV ALI"
                  className="yz-input mt-1 uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-500">
                  Mijozga ko‘rsatiladigan izoh
                </label>
                <textarea
                  value={card.payment_comment}
                  onChange={(e) => setCard({ ...card, payment_comment: e.target.value })}
                  rows={3}
                  placeholder="To‘lash uchun kartaga o‘tkazma qiling..."
                  className="yz-input mt-1"
                />
              </div>
              <button
                onClick={saveCard}
                disabled={savingCard}
                className="btn-primary w-full justify-center"
              >
                {savingCard ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </div>

            {/* Live preview of how the card looks to clients */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">
                Mijoz ko‘radi
              </div>
              <div
                className="relative overflow-hidden rounded-[22px] p-5 text-white shadow-soft"
                style={{ background: "linear-gradient(135deg,#0B0F1F 0%,#1E2270 100%)" }}
              >
                <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-indigo-500/30 blur-2xl" />
                <div className="relative">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-white/60">
                    Karta raqami
                  </div>
                  <div className="mt-2 font-mono text-2xl font-bold tracking-[0.12em]">
                    {card.card_number || "•••• •••• •••• ••••"}
                  </div>
                  <div className="mt-5 text-[11px] font-bold uppercase tracking-wide text-white/60">
                    Egasi
                  </div>
                  <div className="mt-1 font-display text-base font-extrabold uppercase tracking-wide">
                    {card.card_holder || "EGAGA NOMI"}
                  </div>
                </div>
              </div>
              {card.payment_comment && (
                <div className="card-soft p-4 text-[13px] leading-relaxed text-ink-700">
                  💬 {card.payment_comment}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "backup" && (
          <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-2">
            <div className="card-soft p-5 md:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#E6FAF3] text-[#0E9577]">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-extrabold text-ink-900">
                    Eksport
                  </h3>
                  <p className="mt-1 text-xs text-ink-500">
                    Barcha ma‘lumotlar JSON fayl sifatida yuklab olinadi.
                  </p>
                </div>
              </div>
              <button
                onClick={exportBackup}
                disabled={backupBusy}
                className="btn-primary mt-4 w-full justify-center"
              >
                {backupBusy ? "Tayyorlanmoqda…" : "Eksport (JSON)"}
              </button>
            </div>

            <div className="card-soft border-2 border-[#FFE7E3] p-5 md:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFE7E3] text-[#C93A2A]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-extrabold text-ink-900">
                    Import
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-[#C93A2A]">
                    DIQQAT! Joriy ma‘lumotlar butunlay o‘chiriladi.
                  </p>
                </div>
              </div>
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50 px-4 py-6 text-center transition-colors hover:border-ink-300">
                <Database className="h-6 w-6 text-ink-400" />
                <span className="text-sm font-bold text-ink-700">
                  {importFile ? importFile.name : "Faylni tanlang"}
                </span>
                {!importFile && (
                  <span className="text-[11px] text-ink-400">JSON, max 50 MB</span>
                )}
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              <button
                onClick={importBackup}
                disabled={backupBusy || !importFile}
                className="btn-soft mt-3 w-full justify-center disabled:opacity-50"
              >
                {backupBusy ? "Yuklanmoqda…" : "Import qilish"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="card-soft relative overflow-hidden p-4 md:p-5">
      <span
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: color }}
        aria-hidden
      />
      <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">
        {label}
      </div>
      <div
        className="mt-2 font-display text-[28px] font-extrabold leading-none tracking-[-0.02em] md:text-[32px]"
        style={{ color }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1.5 text-[11px] font-semibold text-ink-500">{sub}</div>
      )}
    </div>
  );
}
