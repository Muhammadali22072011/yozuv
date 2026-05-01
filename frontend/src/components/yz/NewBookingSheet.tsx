"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Avatar } from "./Avatar";
import {
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetRoot,
} from "./Sheet";
import { useToast } from "./Toast";
import { fmtSum, isoFor } from "./utils";
import { cn } from "@/lib/utils";

type Client = { id: string; first_name: string; last_name: string; phone?: string };
type Service = { id: string; name: string; price: number; duration_minutes: number };

const STEPS = ["Mijoz", "Xizmat", "Vaqt", "Tasdiq"] as const;

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <div className="font-medium text-ink-400">{label}</div>
      <div
        className={`font-display text-ink-900 ${bold ? "text-base font-extrabold" : "font-bold"}`}
      >
        {value}
      </div>
    </div>
  );
}

export function NewBookingSheet({
  open,
  onOpenChange,
  defaultDate,
  defaultTime,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate?: string;
  defaultTime?: string;
  onCreated?: () => void;
}) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [busySlots, setBusySlots] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<string>(defaultDate || isoFor(new Date()));
  const [time, setTime] = useState<string>(defaultTime || "14:00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setClient(null);
    setService(null);
    setDate(defaultDate || isoFor(new Date()));
    setTime(defaultTime || "14:00");
    setQ("");
    Promise.all([
      apiFetch<Client[]>("/api/business/me/clients").catch(() => []),
      apiFetch<Service[]>("/api/business/me/services").catch(() => []),
    ]).then(([cl, sv]) => {
      setClients(cl);
      setServices(sv);
    });
  }, [open, defaultDate, defaultTime]);

  useEffect(() => {
    if (!open) return;
    apiFetch<{ start_time: string }[]>(`/api/business/me/bookings?booking_date=${date}`)
      .then((rows) => setBusySlots(new Set(rows.map((r) => r.start_time.slice(0, 5)))))
      .catch(() => setBusySlots(new Set()));
  }, [open, date]);

  const filteredClients = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = clients.slice(0, 40);
    if (!needle) return list;
    return list.filter((c) =>
      `${c.first_name} ${c.last_name} ${c.phone || ""}`.toLowerCase().includes(needle)
    );
  }, [clients, q]);

  const canNext =
    (step === 0 && client) || (step === 1 && service) || step === 2 || step === 3;

  async function finish() {
    if (!client || !service) return;
    setSaving(true);
    try {
      const [h, m] = time.split(":").map(Number);
      const endMin = h * 60 + m + service.duration_minutes;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}:00`;
      await apiFetch("/api/business/me/bookings", {
        method: "POST",
        body: JSON.stringify({
          client_id: client.id,
          service_id: service.id,
          date,
          start_time: `${time}:00`,
          end_time: endTime,
        }),
      });
      toast("Yozilish qo'shildi ✓");
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SheetRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent height="tall">
        <SheetHeader title="Yangi yozilish" />

        <div className="mt-3 flex gap-1.5 px-5">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full",
                i <= step ? "yz-grad" : "bg-ink-200"
              )}
            />
          ))}
        </div>
        <div className="px-5 pt-2.5 text-xs font-bold text-ink-400">
          {step + 1}/{STEPS.length} · {STEPS[step]}
        </div>

        <SheetBody>
          {step === 0 && (
            <div className="flex flex-col gap-2">
              <div className="mb-2 flex items-center gap-2.5 rounded-2xl bg-ink-100 px-3.5 py-3">
                <Search className="h-4 w-4 text-ink-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Mijoz qidirish"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400"
                />
              </div>
              {filteredClients.length === 0 && (
                <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-5 text-center text-sm text-ink-400">
                  Mijoz topilmadi
                </div>
              )}
              {filteredClients.map((c) => {
                const active = client?.id === c.id;
                const name = `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Mijoz";
                return (
                  <button
                    key={c.id}
                    onClick={() => setClient(c)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border-[1.5px] px-3 py-3 text-left tap",
                      active ? "border-indigo-600 bg-indigo-50" : "border-ink-100 bg-white"
                    )}
                  >
                    <Avatar name={name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm font-bold text-ink-900">
                        {name}
                      </div>
                      <div className="truncate text-xs text-ink-400">{c.phone || "—"}</div>
                    </div>
                    {active && (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-600 text-white">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-2">
              {services.length === 0 && (
                <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-5 text-center text-sm text-ink-400">
                  Xizmatlar yo‘q — avval qo‘shing
                </div>
              )}
              {services.map((s) => {
                const active = service?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setService(s)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border-[1.5px] px-3 py-3 text-left tap",
                      active ? "border-indigo-600 bg-indigo-50" : "border-ink-100 bg-white"
                    )}
                  >
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-100 text-lg">
                      ✂️
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm font-bold text-ink-900">
                        {s.name}
                      </div>
                      <div className="text-xs text-ink-400">
                        {s.duration_minutes} daq · {fmtSum(s.price)} so‘m
                      </div>
                    </div>
                    {active && (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-600 text-white">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-500">
                <span>Sana</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="yz-input w-auto px-3 py-1.5"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  "09:00",
                  "10:00",
                  "11:00",
                  "12:00",
                  "13:00",
                  "14:00",
                  "15:00",
                  "16:00",
                  "17:00",
                  "18:00",
                ].map((t) => {
                  const busy = busySlots.has(t);
                  const active = time === t;
                  return (
                    <button
                      key={t}
                      onClick={() => !busy && setTime(t)}
                      disabled={busy}
                      className={cn(
                        "rounded-2xl border-[1.5px] py-3.5 text-center font-display text-[15px] font-bold transition-colors",
                        active
                          ? "yz-grad border-indigo-600 text-white shadow-indigo"
                          : busy
                          ? "border-ink-100 bg-ink-100 text-ink-300 line-through"
                          : "border-ink-200 bg-white text-ink-900 active:opacity-80"
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="rounded-[22px] border-[1.5px] border-indigo-100 bg-white p-5">
              <Row
                label="Mijoz"
                value={
                  client
                    ? `${client.first_name || ""} ${client.last_name || ""}`.trim()
                    : "—"
                }
              />
              <Row label="Telefon" value={client?.phone || "—"} />
              <Row label="Xizmat" value={service?.name || "—"} />
              <Row label="Vaqt" value={`${date}, ${time}`} />
              <Row label="Davomiyligi" value={`${service?.duration_minutes || 0} daqiqa`} />
              <div className="my-3 h-px bg-ink-200" />
              <Row label="Jami" value={`${fmtSum(service?.price || 0)} so‘m`} bold />
            </div>
          )}
        </SheetBody>

        <SheetFooter>
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 rounded-2xl bg-ink-100 px-4 py-4 font-display text-[15px] font-bold text-ink-900 tap"
            >
              Orqaga
            </button>
          )}
          <button
            disabled={!canNext || saving}
            onClick={() => (step === 3 ? finish() : setStep(step + 1))}
            className="btn-primary flex-[2]"
          >
            {step === 3 ? (saving ? "Saqlanmoqda…" : "Tasdiqlash") : "Davom etish"}
          </button>
        </SheetFooter>
      </SheetContent>
    </SheetRoot>
  );
}
