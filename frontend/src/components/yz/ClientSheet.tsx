"use client";

import { Phone, MessageSquare, Plus, Star } from "lucide-react";
import { Avatar } from "./Avatar";
import { SheetBody, SheetContent, SheetHeader, SheetRoot } from "./Sheet";
import { useToast } from "./Toast";
import { callPhone, fmtSum, messageTelegram } from "./utils";

export type ClientDetail = {
  id: string;
  telegram_id?: number | null;
  first_name: string;
  last_name: string;
  phone?: string;
  visits?: number;
  total_spent?: number;
  last_visit?: string | null;
  favorite_service?: string | null;
  is_vip?: boolean;
};

function ActionBtn({
  icon,
  label,
  bg,
  fg,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  bg: string;
  fg: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-2 rounded-3xl px-3 py-4 tap"
      style={{ background: bg }}
    >
      <span
        className="grid h-11 w-11 place-items-center rounded-2xl bg-white/70"
        style={{ color: fg }}
      >
        {icon}
      </span>
      <span className="font-display text-xs font-bold" style={{ color: fg }}>
        {label}
      </span>
    </button>
  );
}

export function ClientSheet({
  open,
  onOpenChange,
  client,
  onNewBooking,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: ClientDetail | null;
  onNewBooking?: (client: ClientDetail) => void;
}) {
  const toast = useToast();
  if (!client) return null;
  const name = `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Mijoz";
  const spent = client.total_spent ?? 0;

  return (
    <SheetRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent height="tall">
        <SheetHeader />
        <SheetBody>
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex">
              <Avatar name={name} size={80} vip={client.is_vip} />
            </div>
            <div className="mt-4 font-display text-[22px] font-extrabold tracking-tight text-ink-900">
              {name}
            </div>
            <div className="mt-1 text-sm font-medium text-ink-500">{client.phone || "—"}</div>
            {client.is_vip && (
              <span className="pill-warn mt-2.5">
                <Star className="h-3 w-3 fill-current" strokeWidth={2.4} />
                VIP
              </span>
            )}
          </div>

          <div className="mt-6 flex gap-2.5">
            <ActionBtn
              icon={<Phone className="h-5 w-5" />}
              label="Qo'ng'iroq"
              bg="#EEF0FF"
              fg="#4853F5"
              onClick={() => callPhone(client.phone)}
            />
            <ActionBtn
              icon={<MessageSquare className="h-5 w-5" />}
              label="Xabar"
              bg="#E7F8F2"
              fg="#0FA98B"
              onClick={() => {
                if (client.phone) {
                  messageTelegram(client.phone);
                } else {
                  toast("Mijozning telefoni saqlanmagan");
                }
              }}
            />
            <ActionBtn
              icon={<Plus className="h-5 w-5" />}
              label="Yozilish"
              bg="#FFE7E3"
              fg="#FF7A6B"
              onClick={() => {
                if (onNewBooking) {
                  onNewBooking(client);
                  onOpenChange(false);
                } else {
                  toast("Yangi yozilish");
                }
              }}
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <div className="tile-indigo text-center">
              <div className="tnum font-display text-2xl font-extrabold tracking-tighter text-indigo-700">
                {client.visits ?? 0}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-indigo-700/70">Tashrif</div>
            </div>
            <div className="tile-mint text-center">
              <div className="tnum font-display text-2xl font-extrabold tracking-tighter text-success">
                {spent >= 1000 ? `${fmtSum(Math.round(spent / 1000))}k` : fmtSum(spent)}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-success/70">Jami so‘m</div>
            </div>
            <div className="tile-lemon text-center">
              <div className="truncate font-display text-sm font-extrabold tracking-tight text-warn">
                {client.favorite_service || "—"}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-warn/70">Sevimli</div>
            </div>
          </div>
        </SheetBody>
      </SheetContent>
    </SheetRoot>
  );
}
