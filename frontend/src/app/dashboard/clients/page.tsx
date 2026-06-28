"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, RefreshCw, Search, Send, UserPlus, Users } from "lucide-react";
import {
  Avatar,
  ClientSheet,
  NewBookingSheet,
  ScreenHeader,
  TourFloat,
  fmtSum,
  useToast,
} from "@/components/yz";
import type { ClientDetail, TourStep } from "@/components/yz";
import {
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetRoot,
} from "@/components/yz/Sheet";
import { Chip } from "@/components/yz/Chip";
import { ApiError, apiFetch } from "@/lib/api";
import { usePageTour } from "@/lib/use-page-tour";

const CLIENTS_TOUR: TourStep[] = [
  {
    targetSelector: "[data-tour='clients-search']",
    title: "Mijozlaringiz ro'yxati",
    body:
      "Bu yerda har bir mijoz: tashriflar soni, oxirgi tashrif sanasi, telefon. Qidiruv orqali ism yoki raqam bo'yicha tezda topiladi.",
    mode: "info",
  },
  {
    targetSelector: "[data-tour='clients-list']",
    title: "Kartochkani bosing",
    body:
      "Mijozni bossangiz uning tarixini ko'rasiz: hamma yozilishlari, NO_SHOW soni, tug'ilgan kun. O'sha yerdan blokirovka qilsangiz ham bo'ladi.",
    mode: "info",
  },
];

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
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "vip" | "new">("all");
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [active, setActive] = useState<ClientDetail | null>(null);
  const [newBookingFor, setNewBookingFor] = useState<string | null>(null);
  const [bcOpen, setBcOpen] = useState(false);
  const [bcText, setBcText] = useState("");
  const [bcBusy, setBcBusy] = useState(false);
  const toast = useToast();
  const tour = usePageTour("clients_v1", CLIENTS_TOUR);

  async function sendBroadcast() {
    const text = bcText.trim();
    if (!text || bcBusy) return;
    setBcBusy(true);
    try {
      const r = await apiFetch<{ recipients: number; sent: number; failed: number }>(
        "/api/business/me/broadcast",
        { method: "POST", body: JSON.stringify({ text }) },
      );
      toast(`${r.sent}/${r.recipients} mijozga yuborildi`);
      setBcText("");
      setBcOpen(false);
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    } finally {
      setBcBusy(false);
    }
  }

  async function load() {
    setLoading(true);
    setLoadErr("");
    try {
      setRows(await apiFetch<Row[]>("/api/business/me/clients"));
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      const msg = (e as Error).message || "";
      // Not onboarded yet → send to onboarding, don't show a scary error.
      if (status === 404 || /business not found/i.test(msg)) {
        router.replace("/dashboard/onboarding");
        return;
      }
      // Session gone → back to login (apiFetch already redirects on hard 401,
      // this covers the message-based cases).
      if (status === 401 || /not authenticated|invalid user|session expired/i.test(msg)) {
        router.replace("/auth/login");
        return;
      }
      // Network / server error → surface it with a retry, NOT a fake empty list.
      setLoadErr(msg || "Mijozlarni yuklab bo‘lmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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
      <ScreenHeader
        title="Mijozlar"
        subtitle={`${rows.length} ta faol mijoz`}
        right={
          <button
            onClick={() => setBcOpen(true)}
            disabled={rows.length === 0}
            aria-label="Mijozlarga xabar"
            title="Mijozlarga xabar"
            className="grid h-10 w-10 place-items-center rounded-2xl bg-ink-900 text-white tap disabled:opacity-40"
          >
            <Megaphone className="h-5 w-5" strokeWidth={2.2} />
          </button>
        }
      />

      <div className="mt-2 px-4 md:px-0">
        <div
          data-tour="clients-search"
          className="flex items-center gap-3 rounded-3xl bg-white px-3.5 py-3 shadow-soft transition focus-within:ring-4 focus-within:ring-indigo-500/15"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Search className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
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

      <div data-tour="clients-list" className="mt-4 grid gap-2.5 px-4 md:px-0 lg:grid-cols-2 2xl:grid-cols-3">
        {loadErr ? (
          <div className="card-soft col-span-full flex flex-col items-center gap-3 p-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-3xl bg-danger-bg text-danger">
              <RefreshCw className="h-6 w-6" strokeWidth={2} />
            </span>
            <div className="text-sm font-medium text-ink-500">{loadErr}</div>
            <button
              onClick={load}
              className="btn-primary tap gap-2 px-5"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={2.4} />
              Qayta urinish
            </button>
          </div>
        ) : loading ? (
          <div className="card-soft col-span-full p-6 text-center text-sm text-ink-400">
            Yuklanmoqda…
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-soft col-span-full flex flex-col items-center gap-3 p-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-3xl bg-indigo-50 text-indigo-600">
              {rows.length === 0 ? (
                <UserPlus className="h-6 w-6" strokeWidth={2} />
              ) : (
                <Users className="h-6 w-6" strokeWidth={2} />
              )}
            </span>
            <div className="text-sm font-medium text-ink-400">
              {rows.length === 0 ? "Hali mijoz yo‘q" : "Mijoz topilmadi"}
            </div>
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
                className="card-soft flex items-center gap-3.5 p-3.5 text-left tap"
              >
                <Avatar name={name} size={48} vip={r.is_vip} isNew={isNew} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate font-display text-[15px] font-bold tracking-tight text-ink-900">
                      {name}
                    </div>
                    {isNew && (
                      <span className="shrink-0 rounded-full bg-danger-bg px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-danger">
                        YANGI
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-ink-500">
                    <span className="tnum">{r.visits}</span> ta tashrif · {r.last_visit?.slice(0, 10) || "—"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="tnum font-display text-sm font-extrabold tracking-tight text-ink-900">
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

      <SheetRoot open={bcOpen} onOpenChange={setBcOpen}>
        <SheetContent>
          <SheetHeader title="Mijozlarga xabar" />
          <SheetBody>
            <p className="mb-3 text-xs text-ink-500">
              Hamma mijozlaringizga Telegram orqali bitta xabar yuboriladi.
            </p>
            <textarea
              value={bcText}
              onChange={(e) => setBcText(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Masalan: Ertaga dam olish kuni — yopiqmiz. Dushanba kutamiz!"
              className="yz-input w-full resize-none text-sm"
            />
            <div className="mt-1.5 text-right text-[11px] text-ink-400">
              {bcText.length}/2000
            </div>
          </SheetBody>
          <SheetFooter>
            <button
              onClick={sendBroadcast}
              disabled={bcBusy || !bcText.trim()}
              className="btn-primary tap w-full justify-center gap-2 disabled:opacity-50"
            >
              {bcBusy ? "Yuborilmoqda…" : "Yuborish"}
              {!bcBusy && <Send className="h-4 w-4" />}
            </button>
          </SheetFooter>
        </SheetContent>
      </SheetRoot>

      <TourFloat tour={tour} />
    </div>
  );
}
