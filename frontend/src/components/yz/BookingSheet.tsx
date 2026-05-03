"use client";

import { useEffect, useState } from "react";
import { Phone, MessageSquare, Pencil } from "lucide-react";
import type { BookingRow } from "@/types";
import { apiFetch } from "@/lib/api";
import { Avatar } from "./Avatar";
import { StatusBadge } from "./StatusBadge";
import {
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetRoot,
} from "./Sheet";
import type { ClientLite, ServiceLite } from "./BookingCard";
import { useToast } from "./Toast";
import { callPhone, fmtSum, hm, messageTelegramUser, shortDate } from "./utils";

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

function ActionBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-indigo-50 px-3 py-3 tap"
    >
      <span className="text-indigo-600">{icon}</span>
      <span className="font-display text-xs font-bold text-indigo-600">{label}</span>
    </button>
  );
}

export function BookingSheet({
  open,
  onOpenChange,
  booking,
  services = [],
  clients = [],
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: BookingRow | null;
  services?: ServiceLite[];
  clients?: ClientLite[];
  onChanged?: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editServiceId, setEditServiceId] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editTime, setEditTime] = useState<string>("");

  useEffect(() => {
    if (!open) {
      setEditing(false);
      return;
    }
    if (booking) {
      setEditServiceId(booking.service_id || "");
      setEditDate(booking.date);
      setEditTime(hm(booking.start_time));
    }
  }, [open, booking]);

  if (!booking) return null;

  const svc = services.find((s) => s.id === booking.service_id);
  const cli = clients.find((c) => c.id === booking.client_id);
  const name = cli
    ? `${cli.first_name || ""} ${cli.last_name || ""}`.trim() || "Mijoz"
    : "Mijoz";
  const dur =
    (parseInt(booking.end_time.slice(0, 2)) - parseInt(booking.start_time.slice(0, 2))) * 60 +
    (parseInt(booking.end_time.slice(3, 5)) - parseInt(booking.start_time.slice(3, 5)));

  const complete = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/business/me/bookings/${booking.id}/confirm`, { method: "PUT" });
      toast("Tasdiqlandi");
      onChanged?.();
      onOpenChange(false);
    } catch {
      toast("Xatolik");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/business/me/bookings/${booking.id}/cancel`, {
        method: "PUT",
        body: JSON.stringify({ reason: "Dashboard" }),
      });
      toast("Bekor qilindi");
      onChanged?.();
      onOpenChange(false);
    } catch {
      toast("Xatolik");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editServiceId || !editDate || !editTime) {
      toast("Barcha maydonlarni to'ldiring");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/business/me/bookings/${booking.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          service_id: editServiceId,
          date: editDate,
          start_time: `${editTime}:00`,
        }),
      });
      toast("Yozilish yangilandi ✓");
      setEditing(false);
      onChanged?.();
      onOpenChange(false);
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader />
        <SheetBody>
          <div className="text-center">
            <div className="inline-flex">
              <Avatar name={name} size={68} />
            </div>
            <div className="mt-3 font-display text-[22px] font-extrabold tracking-tight text-ink-900">
              {name}
            </div>
            <div className="mt-0.5 text-sm text-ink-500">{cli?.phone || "—"}</div>
            <div className="mt-2.5 inline-flex">
              <StatusBadge status={booking.status} />
            </div>
          </div>

          {!editing && (
            <div className="mt-5 flex gap-2.5">
              <ActionBtn
                icon={<Phone className="h-5 w-5" />}
                label="Qo'ng'iroq"
                onClick={() => callPhone(cli?.phone)}
              />
              <ActionBtn
                icon={<MessageSquare className="h-5 w-5" />}
                label="Xabar"
                onClick={() => {
                  if (cli?.telegram_id) {
                    messageTelegramUser(cli.telegram_id);
                  } else {
                    toast("Mijoz Telegram orqali bog'lanmagan");
                  }
                }}
              />
              <ActionBtn
                icon={<Pencil className="h-5 w-5" />}
                label="Tahrir"
                onClick={() => setEditing(true)}
              />
            </div>
          )}

          {editing ? (
            <div className="mt-5 rounded-[22px] border-[1.5px] border-indigo-100 bg-white p-4">
              <label className="block text-xs font-semibold text-ink-500">Xizmat</label>
              <select
                value={editServiceId}
                onChange={(e) => setEditServiceId(e.target.value)}
                className="yz-input mt-1 w-full"
              >
                {services.length === 0 && <option value="">—</option>}
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-500">Sana</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="yz-input mt-1 w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-500">Vaqt</label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="yz-input mt-1 w-full"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              className="mt-4 rounded-[22px] p-4"
              style={{ background: "linear-gradient(135deg,#EEF0FF,#F8F9FC)" }}
            >
              <Row label="Vaqt" value={`${shortDate(booking.date)} · ${hm(booking.start_time)}`} />
              <Row label="Davomiyligi" value={`${dur} daqiqa`} />
              <Row label="Xizmat" value={svc?.name || "—"} />
              {booking.notes && <Row label="Izoh" value={booking.notes} />}
              <div className="my-3 h-px bg-ink-900/10" />
              <Row label="Narx" value={`${fmtSum(booking.payment_amount)} so‘m`} bold />
            </div>
          )}
        </SheetBody>
        <SheetFooter>
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                disabled={busy}
                className="flex-1 rounded-2xl bg-ink-100 px-4 py-3.5 font-display text-sm font-bold text-ink-900 tap"
              >
                Bekor
              </button>
              <button onClick={saveEdit} disabled={busy} className="btn-primary flex-[2]">
                {busy ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </>
          ) : booking.status === "PENDING" || booking.status === "CONFIRMED" ? (
            <>
              <button
                onClick={cancel}
                disabled={busy}
                className="flex-1 rounded-2xl bg-[#FFE7E3] px-4 py-3.5 font-display text-sm font-bold text-[#C93A2A] tap"
              >
                Bekor qilish
              </button>
              <button onClick={complete} disabled={busy} className="btn-primary flex-[2]">
                Bajarildi ✓
              </button>
            </>
          ) : (
            <button onClick={() => onOpenChange(false)} className="btn-primary flex-1">
              Yopish
            </button>
          )}
        </SheetFooter>
      </SheetContent>
    </SheetRoot>
  );
}
